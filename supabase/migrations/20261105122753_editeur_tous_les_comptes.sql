-- La console de l'éditeur : tous les comptes de l'app, de quoi les trier,
-- et la main sur chacun (demandé le 2026-11-05 : « le compte god : supprimer
-- les comptes, trier les comptes de toute l'app, faire ce que je veux »).
--
-- Jusqu'ici l'éditeur voyait une liste (admin_accounts : nom, adresse, rôle,
-- livres) et changeait un rôle, un mot de passe, Mirandola+ offert. Il
-- gagne :
--   - admin_comptes()            : chaque compte et ce qui sert à trier —
--                                  dernière connexion, adresse confirmée,
--                                  suspendu, mot de passe provisoire, Google,
--                                  deux étapes, livres, cartes, révisions,
--                                  dernière révision, offre, établissement ;
--                                  jamais le contenu d'un livre ;
--   - admin_supprimer_compte(c)  : le compte et tout ce qui est à lui, comme
--                                  delete_me (tout part en cascade : aucune
--                                  table ne retient un compte, vérifié le
--                                  2026-11-05) ;
--   - admin_suspendre(c, jusqua) : plus de connexion jusqu'à cette date (nul :
--                                  rétabli), ses sessions fermées ;
--   - admin_confirmer(c)         : l'adresse confirmée à la main.
--
-- Deux garde-fous seulement, qui protègent l'éditeur de lui-même :
--   - on ne se supprime ni ne se suspend soi-même (sinon plus personne ne
--     tient la console ; son propre compte se supprime depuis ses Réglages) ;
--   - un abonnement Stripe qui court sans résiliation bloque la suppression,
--     comme dans delete_me : Stripe continuerait de prélever une personne
--     qui n'a plus de compte. On le résilie d'abord dans Stripe.
-- admin_accounts reste, pour les apps déjà installées.

create or replace function public.admin_comptes()
returns table (
  id uuid, email text, handle text, name text, role text, cree timestamptz, vu timestamptz,
  confirme boolean, suspendu timestamptz, provisoire boolean, google boolean, deux_etapes boolean,
  livres bigint, cartes bigint, revisions bigint, revise timestamptz, offre text, etablissement text
)
language sql stable security definer
set search_path = ''
as $$
  select u.id,
         u.email::text,
         coalesce(p.handle, ''),
         coalesce(nullif(p.name, ''), ''),
         coalesce(r.role, 'eleve'),
         u.created_at,
         u.last_sign_in_at,
         u.email_confirmed_at is not null,
         case when u.banned_until > now() then u.banned_until end,
         exists (select 1 from public.mdp_provisoires m where m.user_id = u.id),
         exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'google'),
         exists (select 1 from auth.mfa_factors f where f.user_id = u.id and f.status = 'verified'),
         coalesce(d.n, 0),
         coalesce(c.n, 0),
         coalesce(v.n, 0),
         v.dernier,
         public.offre_de(u.id),
         o.name
  from auth.users u
  left join public.profiles p   on p.id = u.id
  left join public.user_roles r on r.user_id = u.id
  left join (select user_id, count(*) n from public.decks where deleted_at is null group by user_id) d on d.user_id = u.id
  left join (select user_id, count(*) n from public.cards group by user_id) c on c.user_id = u.id
  left join (select user_id, count(*) n, max(created_at) dernier from public.reviews group by user_id) v on v.user_id = u.id
  left join public.org_members om on om.user_id = u.id
  left join public.orgs o on o.id = om.org_id
  where public.is_admin()
  order by u.created_at desc
$$;
revoke all on function public.admin_comptes() from public, anon;
grant execute on function public.admin_comptes() to authenticated;

create or replace function public.admin_supprimer_compte(cible uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Réservé à l’éditeur' using errcode = '42501'; end if;
  if cible = auth.uid() then raise exception 'Ton propre compte se supprime depuis tes Réglages'; end if;
  if not exists (select 1 from auth.users where id = cible) then raise exception 'Ce compte n’existe plus'; end if;
  if exists (select 1 from public.abonnements a
             where a.user_id = cible and a.source = 'stripe' and not a.fin_prevue
               and public.abonnement_ouvre(a.statut, a.fin_periode)) then
    raise exception 'Son abonnement Mirandola+ court chez Stripe : résilie-le d’abord dans Stripe, sinon il continuerait d’être prélevé';
  end if;
  delete from auth.users where id = cible;
end $$;
revoke all on function public.admin_supprimer_compte(uuid) from public, anon;
grant execute on function public.admin_supprimer_compte(uuid) to authenticated;

-- banned_until : Supabase Auth refuse la connexion et le renouvellement de
-- session (« user_banned ») ; ses sessions fermées, il est dehors à
-- l'expiration de son jeton du moment (une heure au plus).
create or replace function public.admin_suspendre(cible uuid, jusqua timestamptz)
returns timestamptz
language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Réservé à l’éditeur' using errcode = '42501'; end if;
  if cible = auth.uid() then raise exception 'On ne se suspend pas soi-même'; end if;
  if jusqua is not null and jusqua <= now() then raise exception 'Une date à venir'; end if;
  update auth.users set banned_until = jusqua, updated_at = now() where id = cible;
  if not found then raise exception 'Ce compte n’existe plus'; end if;
  if jusqua is not null then delete from auth.sessions where user_id = cible; end if;
  return jusqua;
end $$;
revoke all on function public.admin_suspendre(uuid, timestamptz) from public, anon;
grant execute on function public.admin_suspendre(uuid, timestamptz) to authenticated;

create or replace function public.admin_confirmer(cible uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Réservé à l’éditeur' using errcode = '42501'; end if;
  update auth.users set email_confirmed_at = coalesce(email_confirmed_at, now()), updated_at = now() where id = cible;
  if not found then raise exception 'Ce compte n’existe plus'; end if;
end $$;
revoke all on function public.admin_confirmer(uuid) from public, anon;
grant execute on function public.admin_confirmer(uuid) to authenticated;
