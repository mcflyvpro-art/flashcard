-- M03.T3 exige « 100 % des écritures dans les deux, 7 jours — preuve :
-- requête de comparaison à 0 écart ». Une requête relancée une seule fois
-- ne prouve rien sur sept jours, seulement sur l'instant où on l'a
-- tapée. Cette migration transforme la preuve ponctuelle en preuve
-- continue : une tâche `pg_cron` rejoue chaque jour la comparaison entre
-- `decks.cards` (JSONB) et `cards` (M03.T1/M03.T3), et journalise le
-- résultat dans `card_sync_audit`. Le 25 septembre 2026, il suffira de
-- lire cette table — pas de se souvenir de relancer une requête à la
-- main.
create table if not exists public.card_sync_audit (
  id bigint generated always as identity primary key,
  checked_at timestamptz not null default now(),
  cartes_jsonb integer not null,
  cartes_table integer not null,
  ecarts integer not null
);
-- Journal d'exploitation, pas une donnée de compte : RLS activée, aucune
-- politique — ni anon ni authenticated n'y touchent par PostgREST, seule
-- la fonction ci-dessous (propriétaire du rôle de migration) y écrit.
alter table public.card_sync_audit enable row level security;

create or replace function public.check_card_sync_drift()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_ecarts integer;
  v_jsonb integer;
  v_table integer;
begin
  select count(*) into v_jsonb
    from public.decks d, jsonb_array_elements(d.cards) c where c ? 'id';
  select count(*) into v_table from public.cards;

  with jsonb_cartes as (
    select d.id as deck_id, c->>'id' as id,
      coalesce(c->>'f','') as front, coalesce(c->>'b','') as back,
      (c->>'st')::smallint as state, (c->>'sp')::smallint as step,
      (c->>'S')::double precision as stability, (c->>'D')::double precision as difficulty,
      (c->>'F')::double precision as trace2, (c->>'d')::bigint as due,
      (c->>'lr')::bigint as last_review, (c->>'i')::double precision as interval_days,
      coalesce((c->>'n')::integer,0) as reviews_count, coalesce((c->>'l')::integer,0) as lapses
    from public.decks d, jsonb_array_elements(d.cards) c where c ? 'id'
  )
  select count(*) into v_ecarts from (
    select j.deck_id, j.id from jsonb_cartes j
      left join public.cards t on t.deck_id = j.deck_id and t.id = j.id
      where t.id is null
    union all
    select t.deck_id, t.id from public.cards t
      left join jsonb_cartes j on j.deck_id = t.deck_id and j.id = t.id
      where j.id is null
    union all
    select j.deck_id, j.id from jsonb_cartes j
      join public.cards t on t.deck_id = j.deck_id and t.id = j.id
      where j.front is distinct from t.front or j.back is distinct from t.back
         or j.state is distinct from t.state or j.step is distinct from t.step
         or j.stability is distinct from t.stability or j.difficulty is distinct from t.difficulty
         or j.trace2 is distinct from t.trace2 or j.due is distinct from t.due
         or j.last_review is distinct from t.last_review or j.interval_days is distinct from t.interval_days
         or j.reviews_count is distinct from t.reviews_count or j.lapses is distinct from t.lapses
  ) x;

  insert into public.card_sync_audit (cartes_jsonb, cartes_table, ecarts)
    values (v_jsonb, v_table, v_ecarts);

  return v_ecarts;
end $$;
revoke all on function public.check_card_sync_drift() from public, anon, authenticated;

do $$
begin
  create extension if not exists pg_cron with schema extensions;
exception when insufficient_privilege or feature_not_supported then
  raise notice 'pg_cron indisponible sur ce projet : voir supabase/REGLAGES.md.';
end $$;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'audit-double-ecriture-cards-quotidien') then
    perform cron.unschedule('audit-double-ecriture-cards-quotidien');
  end if;
  perform cron.schedule('audit-double-ecriture-cards-quotidien', '3 4 * * *',
    'select public.check_card_sync_drift();');
exception when undefined_table or undefined_function then
  raise notice 'pg_cron non actif : voir supabase/REGLAGES.md pour l''activer, puis exécuter : '
    'select cron.schedule(''audit-double-ecriture-cards-quotidien'', ''3 4 * * *'', '
    '''select public.check_card_sync_drift();'');';
end $$;

-- Premier relevé, tout de suite : le 18 septembre 2026 a déjà sa ligne,
-- pas seulement les six jours suivants.
select public.check_card_sync_drift();
