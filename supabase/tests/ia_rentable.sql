-- Tests de 20261108111044_ia_rentable_quel_que_soit_l_usage : le plafond de
-- coût de chaque compte, tenu par la réservation au pire coût ; le solde qui
-- remplace le pire par le réel ; une réservation abandonnée qui cesse de
-- compter ; ia_droits qui dit le nombre et la dépense du mois ; les droits.
-- Transaction ANNULÉE, comptes jetables. Pour lire le bilan par MCP
-- execute_sql : remplacer le select final et le rollback par un
-- `do $$ begin raise exception 'RESULTATS %', ...; end $$;`.

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

  -- un plafond de 89 cents : le pire de l'appel est réservé, et compte tant qu'il est en vol
  j := public.ia_reserver(a, 'prompt', jour, mois, null, 50, 10, 1e9, 89, 40);
  k := public.ia_reserver(a, 'prompt', jour, mois, null, 50, 10, 1e9, 89, 40);
  insert into public.zz_res (nom, ok, vu) values ('deux appels en vol : 80 cents réservés au pire',
    j->>'statut' = 'ok' and k->>'statut' = 'ok'
    and (select sum(estime) from public.ai_usage where user_id = a) = 80, k::text);
  j := public.ia_reserver(a, 'prompt', jour, mois, null, 50, 10, 1e9, 89, 40);
  insert into public.zz_res (nom, ok, vu) values ('un troisième passerait le plafond : refusé, avec ce qui reste',
    j->>'statut' = 'plafond' and (j->>'reste')::numeric = 9, j::text);
  select count(*) into n from public.ai_usage where user_id = a;
  insert into public.zz_res (nom, ok, vu) values ('un refus ne réserve rien', n = 2, n::text);

  -- le solde : le coût réel remplace le pire, et la place revient
  perform public.ia_solder((k->>'id')::bigint, 2000, 900, 1.3);
  insert into public.zz_res (nom, ok, vu) values ('le solde efface le pire réservé',
    exists (select 1 from public.ai_usage where id = (k->>'id')::bigint and cents = 1.3 and estime = 0), k->>'id');
  j := public.ia_reserver(a, 'prompt', jour, mois, null, 50, 10, 1e9, 89, 40);
  insert into public.zz_res (nom, ok, vu) values ('soldé à 1,3 cent, un appel de plus repasse',
    j->>'statut' = 'ok', j::text);

  -- une réservation abandonnée (une fonction tombée en route) cesse de compter au bout de dix minutes
  update public.ai_usage set created_at = now() - interval '11 minutes' where user_id = a and cents = 0;
  j := public.ia_reserver(a, 'prompt', jour, mois, null, 50, 10, 1e9, 89, 80);
  insert into public.zz_res (nom, ok, vu) values ('une réservation de plus de dix minutes ne compte plus',
    j->>'statut' = 'ok', j::text);

  -- le plafond tient même sans rien en vol : ce qui est soldé compte
  insert into public.ai_usage (user_id, day, op, in_tok, out_tok, cents) values (b, jour, 'pdf', 1, 1, 159);
  j := public.ia_reserver(b, 'cards', jour, mois, null, 50, 10, 1e9, 160, 2);
  insert into public.zz_res (nom, ok, vu) values ('159 cents dépensés sur 160 : un appel de 2 au pire est refusé',
    j->>'statut' = 'plafond' and (j->>'reste')::numeric = 1, j::text);
  j := public.ia_reserver(b, 'cards', jour, mois, null, 50, 10, 1e9);
  insert into public.zz_res (nom, ok, vu) values ('sans plafond (une fonction d’avant), rien ne change',
    j->>'statut' = 'ok', j::text);

  -- ia_droits : le nombre et la dépense du mois
  j := public.ia_droits(b);
  insert into public.zz_res (nom, ok, vu) values ('ia_droits dit le nombre et la dépense du mois',
    (j->>'fait')::int = 2 and (j->>'depense')::numeric = 159, j::text);

  insert into public.zz_res (nom, ok, vu) values ('rôle service seul ; ia_depense interne',
    not has_function_privilege('authenticated', 'public.ia_reserver(uuid, text, date, date, integer, integer, integer, numeric, numeric, numeric)', 'execute')
    and not has_function_privilege('anon', 'public.ia_reserver(uuid, text, date, date, integer, integer, integer, numeric, numeric, numeric)', 'execute')
    and not has_function_privilege('authenticated', 'public.ia_depense(uuid, date)', 'execute')
    and not has_function_privilege('authenticated', 'public.ia_droits(uuid)', 'execute')
    and has_function_privilege('service_role', 'public.ia_reserver(uuid, text, date, date, integer, integer, integer, numeric, numeric, numeric)', 'execute')
    and to_regprocedure('public.ia_reserver(uuid, text, date, date, integer, integer, integer, numeric)') is null,
    'droits');
end $$;

select n, case when ok then 'ok' else 'ÉCHEC' end as resultat, nom, vu from public.zz_res order by n;
rollback;
