-- Tests de 20261105185359_ia_reservee_avant_l_appel : la réservation de
-- l'IA tient chaque quota d'un seul tenant, le solde et l'annulation, et
-- personne d'autre que le rôle service n'y touche. Transaction ANNULÉE,
-- comptes jetables. (Deux appels simultanés d'un même compte s'attendent sur
-- le verrou consultatif : ce que la transaction unique ne peut pas montrer,
-- la définition le dit — `pg_advisory_xact_lock` en première ligne.)
-- Pour lire le bilan par MCP execute_sql : remplacer le select final et le
-- rollback par un `do $$ begin raise exception 'RESULTATS %', ...; end $$;`.

begin;

create table public.zz_res (n serial primary key, nom text, ok boolean, vu text);

do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); u uuid;
  j jsonb; k jsonb; jour date := (now() at time zone 'utc')::date;
  mois date := date_trunc('month', (now() at time zone 'utc'))::date; n integer;
begin
  foreach u in array array[a, b] loop
    insert into auth.users (instance_id, id, aud, role, email)
    values ('00000000-0000-0000-0000-000000000000', u, 'authenticated', 'authenticated', 'zz-' || u || '@exemple.invalid');
  end loop;

  j := public.ia_reserver(a, 'cards', jour, mois, 30, 2, 10, 1e9);
  insert into public.zz_res (nom, ok, vu) values ('une première génération est réservée', j->>'statut' = 'ok' and (j->>'id') is not null, j::text);
  k := public.ia_reserver(a, 'cards', jour, mois, 30, 2, 10, 1e9);
  j := public.ia_reserver(a, 'cards', jour, mois, 30, 2, 10, 1e9);
  insert into public.zz_res (nom, ok, vu) values ('le quota du jour tient : la troisième est refusée',
    k->>'statut' = 'ok' and j->>'statut' = 'quota', k->>'statut' || '/' || (j->>'statut'));
  select count(*) into n from public.ai_usage where user_id = a;
  insert into public.zz_res (nom, ok, vu) values ('un refus ne réserve rien', n = 2, n::text);

  j := public.ia_reserver(b, 'cards', jour, mois, 1, 50, 10, 1e9);
  k := public.ia_reserver(b, 'cards', jour, mois, 1, 50, 10, 1e9);
  insert into public.zz_res (nom, ok, vu) values ('le quota du mois tient, et dit où l''on en est',
    j->>'statut' = 'ok' and k->>'statut' = 'mquota' and (k->>'fait')::int = 1 and (k->>'quota')::int = 1, k::text);
  j := public.ia_reserver(b, 'ocr', jour, mois, null, 50, 0, 1e9);
  insert into public.zz_res (nom, ok, vu) values ('les photos et PDF ont leur quota à part', j->>'statut' = 'fquota', j->>'statut');
  j := public.ia_reserver(b, 'cards', jour, mois, null, 50, 0, 0);
  insert into public.zz_res (nom, ok, vu) values ('le budget du mois de tout le projet tient', j->>'statut' = 'budget', j->>'statut');

  -- solder et annuler
  j := public.ia_reserver(b, 'prompt', jour, mois, null, 50, 10, 1e9);
  perform public.ia_solder((j->>'id')::bigint, 1200, 300, 0.42);
  insert into public.zz_res (nom, ok, vu) values ('le solde écrit les jetons et le coût',
    exists (select 1 from public.ai_usage where id = (j->>'id')::bigint and in_tok = 1200 and out_tok = 300 and cents = 0.42), j->>'id');
  perform public.ia_annuler((j->>'id')::bigint);
  insert into public.zz_res (nom, ok, vu) values ('une ligne soldée ne s''annule plus',
    exists (select 1 from public.ai_usage where id = (j->>'id')::bigint), j->>'id');
  k := public.ia_reserver(b, 'prompt', jour, mois, null, 50, 10, 1e9);
  perform public.ia_annuler((k->>'id')::bigint);
  insert into public.zz_res (nom, ok, vu) values ('un appel qui échoue rend sa réservation',
    not exists (select 1 from public.ai_usage where id = (k->>'id')::bigint), k->>'id');

  insert into public.zz_res (nom, ok, vu) values ('rôle service seul : ni authenticated ni anon',
    not has_function_privilege('authenticated', 'public.ia_reserver(uuid, text, date, date, integer, integer, integer, numeric, numeric, numeric)', 'execute')
    and not has_function_privilege('anon', 'public.ia_reserver(uuid, text, date, date, integer, integer, integer, numeric, numeric, numeric)', 'execute')
    and not has_function_privilege('authenticated', 'public.ia_solder(bigint, integer, integer, numeric)', 'execute')
    and not has_function_privilege('authenticated', 'public.ia_annuler(bigint)', 'execute')
    and has_function_privilege('service_role', 'public.ia_reserver(uuid, text, date, date, integer, integer, integer, numeric, numeric, numeric)', 'execute'),
    'droits');
end $$;

select n, case when ok then 'ok' else 'ÉCHEC' end as resultat, nom, vu from public.zz_res order by n;
rollback;
