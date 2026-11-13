-- La demande d'un professeur particulier (2026-11-13).
--
-- Demandé : « séparer vraiment l'espace prof particulier et établissement ;
-- prof particulier c'est prof particulier. Là ça redirige vers Mirandola
-- Campus quand on choisit prof particulier ». Le bouton « Ouvrir mon espace »
-- des cours particuliers menait à « Demander une démo » — un formulaire
-- d'établissement, qui créait un établissement prospect (orgs, org_suivi).
--
-- Un professeur particulier a désormais sa propre demande, rangée à part de
-- tout établissement : `demandes_profs`. L'éditeur la lit dans sa console
-- (Comptes), ouvre le compte du professeur avec sa licence (le chemin de
-- docs/PARCOURS.md § 4.5, inchangé), puis la marque traitée.
--
-- RLS activée et AUCUNE politique, comme org_suivi : personne ne la lit ni ne
-- l'écrit par l'API brute. On écrit par demander_espace_prof (ouverte à anon,
-- comme demander_demo : le formulaire est sans compte, freiné en base — 20
-- demandes par heure en tout, une par adresse et par jour), on lit par
-- admin_demandes_profs (l'éditeur), on clôt par admin_demande_prof_traitee.
-- L'éditeur est prévenu par la fonction prevenir (déclencheur
-- prevenir_demande_prof, pg_net), comme pour une demande de démo.

create table public.demandes_profs (
  id uuid primary key default gen_random_uuid(),
  nom text not null check (length(nom) between 2 and 80),
  email text not null check (length(email) between 6 and 120),
  tel text not null default '' check (length(tel) <= 30),
  eleves integer check (eleves between 1 and 1000),
  message text not null default '' check (length(message) <= 2000),
  cree timestamptz not null default now(),
  traitee_le timestamptz,
  prevenu_le timestamptz
);
alter table public.demandes_profs enable row level security;
revoke all on public.demandes_profs from anon, authenticated;
create index demandes_profs_attente on public.demandes_profs (cree desc) where traitee_le is null;
create index demandes_profs_email on public.demandes_profs (email, cree);

create function public.demander_espace_prof(nom text, email text, tel text default '', eleves integer default null,
                                            message text default '')
returns text
language plpgsql
security definer
set search_path to ''
as $function$
declare ml text := lower(trim(coalesce(email, '')));
begin
  if length(trim(coalesce(nom, ''))) not between 2 and 80 then return 'champs'; end if;
  if ml !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or length(ml) > 120 then return 'email'; end if;
  if eleves is not null and eleves not between 1 and 1000 then return 'champs'; end if;
  if (select count(*) from public.demandes_profs d where d.cree > now() - interval '1 hour') >= 20 then return 'trop'; end if;
  if exists (select 1 from public.demandes_profs d where d.email = ml and d.cree > now() - interval '1 day') then
    return 'deja';
  end if;
  insert into public.demandes_profs (nom, email, tel, eleves, message)
  values (left(trim(nom), 80), ml, left(trim(coalesce(tel, '')), 30), eleves, left(trim(coalesce(message, '')), 2000));
  return 'ok';
end $function$;

revoke all on function public.demander_espace_prof(text, text, text, integer, text) from public;
grant execute on function public.demander_espace_prof(text, text, text, integer, text) to anon, authenticated;

-- L'éditeur : les demandes en attente, puis les traitées des 30 derniers jours
create function public.admin_demandes_profs()
returns jsonb
language plpgsql
stable security definer
set search_path to ''
as $function$
begin
  if not public.is_admin() then raise exception 'Réservé à l’éditeur' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'nom', d.nom, 'email', d.email, 'tel', d.tel,
      'eleves', d.eleves, 'message', d.message, 'cree', d.cree, 'traitee_le', d.traitee_le)
      order by d.traitee_le is not null, d.cree desc)
    from public.demandes_profs d
    where d.traitee_le is null or d.traitee_le > now() - interval '30 days'), '[]'::jsonb);
end $function$;

revoke all on function public.admin_demandes_profs() from public, anon;
grant execute on function public.admin_demandes_profs() to authenticated;

create function public.admin_demande_prof_traitee(did uuid, traitee boolean default true)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if not public.is_admin() then raise exception 'Réservé à l’éditeur' using errcode = '42501'; end if;
  update public.demandes_profs set traitee_le = case when traitee then now() end where id = did;
  return found;
end $function$;

revoke all on function public.admin_demande_prof_traitee(uuid, boolean) from public, anon;
grant execute on function public.admin_demande_prof_traitee(uuid, boolean) to authenticated;

-- prévenir l'éditeur : la fonction prevenir relit la demande au rôle service
create function public.prevenir_demande_prof()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  begin
    perform net.http_post(
      url := 'https://qqbzefpdeinlynjtarqr.supabase.co/functions/v1/prevenir',
      body := jsonb_build_object('prof', new.id),
      headers := jsonb_build_object('Content-Type', 'application/json'),
      timeout_milliseconds := 8000);
  exception when others then
    -- pg_net absent, réseau refusé : la demande est rangée, l'éditeur la verra dans sa console
    null;
  end;
  return new;
end $function$;

revoke all on function public.prevenir_demande_prof() from public, anon, authenticated;

create trigger prevenir_demande_prof after insert on public.demandes_profs
  for each row execute function public.prevenir_demande_prof();
