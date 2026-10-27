-- ══════════ Folio+ pour de vrai : l'offre bride, les anciens comptes l'ont (2026-10-27) ══════════
-- Jusqu'ici l'app ne bridait rien : mon_offre() disait l'offre, personne ne
-- s'en servait. Elle bride désormais un compte « gratuit » (src/offres.js :
-- 5 livres à soi, ni IA, ni QCM et associations, ni images ni sons, le
-- journal réduit, le Memory Engine Lite). Ce qui coûte de l'argent se tient
-- ICI, pas dans l'app publique : les médias (le stockage) et l'IA (la
-- fonction ai, qui demande offre_de()). Le reste — les livres, les QCM, le
-- journal — est une règle d'écran : un compte qui la contournerait ne
-- coûterait rien à personne, et refuser un livre en base bloquerait la
-- synchro de toute la file d'un appareil (règle 5, hors ligne d'abord).
--
-- Décidé le 2026-10-27 : tous les comptes qui existent aujourd'hui gardent
-- tout — certains ont plus de 5 livres, rien ne doit casser. Ils reçoivent
-- Folio+ offert, sans date de fin (source « offert ») ; seuls les comptes
-- créés après cette migration commencent en Folio gratuit.
--
-- Un compte peut désormais avoir un abonnement par source : Stripe (le
-- site, l'ordinateur), Apple et Google (l'app des magasins, par RevenueCat :
-- la fonction magasins), offert (cette migration, ou l'éditeur). Chaque
-- source a sa ligne et son écrivain, aucune n'écrase une autre : un ancien
-- abonnement Stripe qui finit ne ferme plus celui pris sur l'iPhone.

-- ---------- une ligne par source ----------
alter table public.abonnements drop constraint if exists abonnements_pkey;
alter table public.abonnements add primary key (user_id, source);

-- ---------- l'offre d'un compte ----------
-- Interne : le rôle service seul (la fonction ai, la fonction paiement). Un
-- compte connecté demande la sienne par mon_offre() — jamais celle d'un autre.
create or replace function public.offre_de(u uuid)
returns text language sql stable security definer set search_path to '' as $$
  select case
    when exists (select 1 from public.org_members m join public.orgs o on o.id = m.org_id
                 where m.user_id = u and (o.licence_fin is null or o.licence_fin >= current_date)) then 'campus'
    when exists (select 1 from public.abonnements a
                 where a.user_id = u and public.abonnement_ouvre(a.statut, a.fin_periode)) then 'plus'
    else 'gratuit' end
$$;
revoke all on function public.offre_de(uuid) from public, anon, authenticated;
grant execute on function public.offre_de(uuid) to service_role;

-- Ce que ce compte a le droit d'ouvrir, et l'abonnement qui le dit : celui
-- qui court d'abord (le plus lointain), sinon le dernier touché — pour que
-- l'écran Folio+ dise « résilié », « paiement refusé » ou « offert ».
create or replace function public.mon_offre()
returns jsonb language sql stable security definer set search_path to '' as $$
  with etab as (
    select o.name, o.licence_fin
    from public.org_members m
    join public.orgs o on o.id = m.org_id
    where m.user_id = auth.uid() and (o.licence_fin is null or o.licence_fin >= current_date)
    limit 1
  ), ab as (
    select a.* from public.abonnements a where a.user_id = auth.uid()
    order by public.abonnement_ouvre(a.statut, a.fin_periode) desc, a.fin_periode desc nulls first, a.maj_le desc
    limit 1
  )
  select jsonb_build_object(
    'offre', public.offre_de(auth.uid()),
    'etablissement', (select name from etab),
    'licence_fin', (select licence_fin from etab),
    'abonnement', (select jsonb_build_object('statut', ab.statut, 'formule', ab.formule, 'source', ab.source,
                     'fin_periode', ab.fin_periode, 'fin_prevue', ab.fin_prevue) from ab))
  where auth.uid() is not null
$$;
revoke all on function public.mon_offre() from public, anon;
grant execute on function public.mon_offre() to authenticated;

-- ---------- les médias : Folio+ et Campus ----------
-- Politiques RESTRICTIVES : elles s'ajoutent (ET) à celles qui disent déjà
-- qui écrit dans quel dossier du seau, sans avoir à les connaître. Lire et
-- effacer ses médias reste permis à tous : un compte revenu en gratuit
-- garde les images de ses pages.
drop policy if exists media_folio_plus on storage.objects;
create policy media_folio_plus on storage.objects as restrictive for insert to authenticated
with check (bucket_id <> 'media' or (public.mon_offre() ->> 'offre') in ('plus', 'campus'));
drop policy if exists media_folio_plus_maj on storage.objects;
create policy media_folio_plus_maj on storage.objects as restrictive for update to authenticated
using (bucket_id <> 'media' or (public.mon_offre() ->> 'offre') in ('plus', 'campus'));

-- ---------- les comptes d'aujourd'hui gardent tout ----------
-- Tous, sauf un compte de gestion (référent, éditeur), qui ne lit ni ne
-- révise. Un compte qui a déjà une ligne offerte la garde telle quelle.
insert into public.abonnements (user_id, offre, statut, source)
select u.id, 'plus', 'actif', 'offert'
from auth.users u
where not exists (select 1 from public.user_roles r where r.user_id = u.id and r.role in ('ref', 'admin'))
on conflict (user_id, source) do nothing;

-- ---------- offrir Folio+ (l'éditeur) ----------
-- Un ami, un testeur, un geste commercial, un remboursement : Folio+ offert
-- jusqu'à une date, ou sans fin (`jusqua` nul) ; `retirer` le reprend. Ne
-- touche qu'à la ligne « offert » : un abonnement payé reste à son écrivain.
create or replace function public.admin_offrir_plus(cible uuid, jusqua timestamptz default null, retirer boolean default false)
returns jsonb language plpgsql security definer set search_path to '' as $$
begin
  if not public.is_admin() then raise exception 'Réservé à l''éditeur' using errcode = '42501'; end if;
  if not exists (select 1 from auth.users u where u.id = cible) then raise exception 'Compte inconnu' using errcode = '22023'; end if;
  if jusqua is not null and jusqua <= now() and not retirer then raise exception 'Date passée' using errcode = '22023'; end if;
  insert into public.abonnements as a (user_id, offre, statut, source, fin_periode, maj_le)
  values (cible, 'plus', case when retirer then 'fini' else 'actif' end, 'offert',
          case when retirer then now() else jusqua end, now())
  on conflict (user_id, source) do update
    set statut = excluded.statut, fin_periode = excluded.fin_periode, fin_prevue = false, maj_le = now();
  return jsonb_build_object('offre', public.offre_de(cible));
end $$;
revoke all on function public.admin_offrir_plus(uuid, timestamptz, boolean) from public, anon;
grant execute on function public.admin_offrir_plus(uuid, timestamptz, boolean) to authenticated;

-- ---------- Folio+ se voit sur le jeton ----------
-- visuels() dit en plus si la personne a Folio+ (pas Campus : il ne
-- s'achète pas) : son jeton porte alors le liseré de la marque, chez ses
-- amis comme chez elle. Rien de plus que ce que la fonction rendait déjà à
-- qui partage quelque chose avec elle. Changer le type rendu demande de
-- recréer la fonction ; une app ancienne lit ses quatre colonnes, la
-- cinquième ne la gêne pas.
drop function if exists public.visuels(uuid[], uuid[]);
create function public.visuels(personnes uuid[] default '{}', classes uuid[] default '{}')
returns table(id uuid, genre text, cle text, teinte smallint, plus boolean)
language sql stable security definer set search_path to ''
as $$
  select p.id, 'p'::text, p.figure, p.teinte, public.offre_de(p.id) = 'plus'
  from public.profiles p
  where p.id = any ((coalesce(personnes, '{}'::uuid[]))[1:200]) and public.voit_personne(p.id)
  union all
  select c.id, 'c'::text, c.embleme, c.teinte, false
  from public.classes c
  where c.id = any ((coalesce(classes, '{}'::uuid[]))[1:100]) and public.voit_classe(c.id)
$$;
revoke all on function public.visuels(uuid[], uuid[]) from public, anon;
grant execute on function public.visuels(uuid[], uuid[]) to authenticated;
