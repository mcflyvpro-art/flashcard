-- ══════════ Folio+ : l'abonnement d'un compte (2026-10-27) ══════════
-- On paie Folio+ sur le site (Stripe Checkout) ; l'app, qu'elle tourne dans
-- un navigateur, sur un iPhone ou un ordinateur, demande ensuite à la base ce
-- que ce compte a le droit d'ouvrir. La réponse ne peut venir que d'ici :
-- l'app est publique, un drapeau posé par elle se contournerait en une ligne.
--
-- Qui écrit quoi :
--   abonnements         la fonction stripe-webhook seule (rôle service), sur
--                       un évènement signé par Stripe ; personne d'autre, ni
--                       l'app ni l'API brute (aucune politique d'écriture)
--   stripe_evenements   idem : les évènements déjà traités, pour qu'un
--                       évènement rejoué par Stripe ne compte qu'une fois
--   mon_offre()         la seule lecture de l'app : gratuit, plus ou campus
--
-- Les règles de traduction d'un abonnement Stripe (statut, formule, fin)
-- sont dans supabase/functions/_shared/abonnement.js, pur et testé.

create table if not exists public.abonnements (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  offre              text not null default 'plus' check (offre in ('plus')),
  -- actif, essai : payé ; impaye : Stripe relance la carte, l'accès reste le
  -- temps des relances ; incomplet : premier paiement pas abouti ; fini
  statut             text not null check (statut in ('actif', 'essai', 'impaye', 'incomplet', 'fini')),
  source             text not null default 'stripe' check (source in ('stripe', 'apple', 'google', 'offert')),
  formule            text check (formule in ('annuel', 'mensuel')),
  client_stripe      text unique,
  abonnement_stripe  text unique,
  fin_periode        timestamptz,
  -- résilié : il court jusqu'à fin_periode, puis s'arrête
  fin_prevue         boolean not null default false,
  cree_le            timestamptz not null default now(),
  maj_le             timestamptz not null default now()
);

alter table public.abonnements enable row level security;
drop policy if exists abonnements_lire_le_sien on public.abonnements;
create policy abonnements_lire_le_sien on public.abonnements
  for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete, truncate on public.abonnements from anon, authenticated;

-- Les évènements Stripe déjà traités : table de service, sans aucune
-- politique (comme org_codes et org_suivi) — ni l'app ni un compte n'y lisent.
create table if not exists public.stripe_evenements (
  id        text primary key,
  type      text not null,
  recu_le   timestamptz not null default now()
);
alter table public.stripe_evenements enable row level security;
revoke all on public.stripe_evenements from anon, authenticated;

-- Un abonnement ouvre Folio+ tant qu'il est payé (ou que Stripe relance la
-- carte) et que sa période court. Interne : mon_offre() est la porte.
create or replace function public.abonnement_ouvre(statut text, fin timestamptz)
returns boolean language sql stable set search_path to '' as $$
  select statut in ('actif', 'essai', 'impaye') and (fin is null or fin > now())
$$;
revoke all on function public.abonnement_ouvre(text, timestamptz) from public, anon, authenticated;

-- Ce que ce compte a le droit d'ouvrir. Un établissement dont la licence
-- court (démo comprise) donne Folio Campus, qui passe avant un abonnement
-- personnel ; l'abonnement est rendu à part, pour que l'élève qui en a un
-- sache qu'il continue (et puisse le résilier).
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
  )
  select jsonb_build_object(
    'offre', case
      when exists (select 1 from etab) then 'campus'
      when exists (select 1 from ab where public.abonnement_ouvre(ab.statut, ab.fin_periode)) then 'plus'
      else 'gratuit' end,
    'etablissement', (select name from etab),
    'licence_fin', (select licence_fin from etab),
    'abonnement', (select jsonb_build_object('statut', ab.statut, 'formule', ab.formule, 'source', ab.source,
                     'fin_periode', ab.fin_periode, 'fin_prevue', ab.fin_prevue) from ab))
  where auth.uid() is not null
$$;
revoke all on function public.mon_offre() from public, anon;
grant execute on function public.mon_offre() to authenticated;

-- Supprimer son compte avec un abonnement Stripe qui court : la ligne
-- partirait avec le compte, mais Stripe, lui, continuerait de prélever la
-- carte. On demande d'abord de le résilier (le portail Stripe, depuis
-- l'écran Folio+) ; résilié, il peut courir jusqu'à sa fin, plus rien ne
-- sera prélevé. Un abonnement Apple ou Google se résilie dans le magasin.
create or replace function public.delete_me()
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not authenticated'; end if;
  if exists (select 1 from public.abonnements a
             where a.user_id = me and a.source = 'stripe' and not a.fin_prevue
               and public.abonnement_ouvre(a.statut, a.fin_periode)) then
    raise exception 'Résilie d''abord ton abonnement Folio+ (Réglages, Folio+, Gérer mon abonnement) : sinon il continuerait d''être prélevé';
  end if;
  delete from auth.users where id = me;
end $$;
revoke all on function public.delete_me() from public, anon;
grant execute on function public.delete_me() to authenticated;

-- Les évènements Stripe ne servent qu'à repérer un doublon : Stripe ne
-- rejoue rien au-delà de trois jours ; trente suffisent largement.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'purge-stripe-evenements') then
      perform cron.unschedule('purge-stripe-evenements');
    end if;
    perform cron.schedule('purge-stripe-evenements', '41 3 * * *',
      'delete from public.stripe_evenements where recu_le < now() - interval ''30 days'';');
  else
    raise notice 'pg_cron absent : effacer chaque jour les évènements Stripe de plus de 30 jours (supabase/REGLAGES.md)';
  end if;
end $$;
