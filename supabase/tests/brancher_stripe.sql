-- Tests des migrations 20261102191503_brancher_stripe et
-- 20261102191527_prevenir_des_demandes : personne d'autre que le rôle
-- service ne lit ni n'écrit les réglages de Stripe (le secret du webhook y
-- est) ; une demande de démo arrive toujours, et met en file l'appel à la
-- fonction `prevenir` (pg_net), avec le seul identifiant de l'établissement.
-- Même mode que les autres : transaction ANNULÉE (pg_net n'envoie rien :
-- sa file est une table), vrai rôle `authenticated` et `anon`.

begin;

create table public.zz_res (n serial primary key, nom text, ok boolean, vu text);
grant all on public.zz_res to authenticated, anon;
grant all on sequence public.zz_res_n_seq to authenticated, anon;

do $$
declare
  lea uuid := gen_random_uuid(); refus text; r text; n integer; o uuid; corps text;
begin
  insert into auth.users (instance_id, id, aud, role, email)
  values ('00000000-0000-0000-0000-000000000000', lea, 'authenticated', 'authenticated', 'zz-' || lea || '@exemple.invalid');
  insert into public.stripe_reglages (cle, valeur) values ('test:webhook_secret', 'whsec_zz');

  -- ══════════ stripe_reglages : le rôle service seul ══════════
  insert into public.zz_res (nom, ok, vu) values ('la RLS est activée, aucune politique',
    (select relrowsecurity from pg_class where oid = 'public.stripe_reglages'::regclass)
    and not exists (select 1 from pg_policies where tablename = 'stripe_reglages'), null);
  insert into public.zz_res (nom, ok, vu) values ('ni authenticated ni anon n''ont le moindre droit sur la table',
    not has_table_privilege('authenticated', 'public.stripe_reglages', 'select')
    and not has_table_privilege('authenticated', 'public.stripe_reglages', 'insert')
    and not has_table_privilege('anon', 'public.stripe_reglages', 'select'), null);
  insert into public.zz_res (nom, ok, vu) values ('le rôle service la lit et l''écrit',
    has_table_privilege('service_role', 'public.stripe_reglages', 'select')
    and has_table_privilege('service_role', 'public.stripe_reglages', 'insert'), null);

  perform set_config('request.jwt.claims', json_build_object('sub', lea, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  begin
    execute 'select valeur from public.stripe_reglages limit 1' into r;
    refus := 'lu : ' || coalesce(r, 'rien');
  exception when insufficient_privilege then refus := sqlstate;
  end;
  insert into public.zz_res (nom, ok, vu) values ('un compte connecté ne lit pas le secret du webhook', refus = '42501', refus);
  begin
    execute 'insert into public.stripe_reglages (cle, valeur) values (''test:prix_annuel'', ''price_pirate'')';
    refus := 'écrit';
  exception when insufficient_privilege then refus := sqlstate;
  end;
  insert into public.zz_res (nom, ok, vu) values ('… ni n''y écrit un prix', refus = '42501', refus);
  perform set_config('role', 'postgres', true);

  begin
    insert into public.stripe_reglages (cle, valeur) values ('prix', 'x');
    refus := 'accepté';
  exception when check_violation then refus := sqlstate;
  end;
  insert into public.zz_res (nom, ok, vu) values ('une clé sans son mode (test: ou live:) : refusée', refus = '23514', refus);

  -- ══════════ une demande de démo ══════════
  select count(*) into n from net.http_request_queue;
  perform set_config('role', 'anon', true);
  r := public.demander_demo('Lycée Zz Essai', 'Lyon', 'Claire Zz', 'Proviseure', 'zz-' || lea || '@exemple.invalid', '', 450, 'Bonjour');
  perform set_config('role', 'postgres', true);
  insert into public.zz_res (nom, ok, vu) values ('sans compte, la demande arrive toujours', r = 'ok', r);
  select s.org_id into o from public.org_suivi s where s.contact_email = 'zz-' || lea || '@exemple.invalid';
  select convert_from(q.body, 'UTF8') into corps from net.http_request_queue q
  where q.url like '%/functions/v1/prevenir' order by q.id desc limit 1;
  insert into public.zz_res (nom, ok, vu) values ('… et met en file l''appel à prevenir, avec le seul identifiant',
    (select count(*) from net.http_request_queue) = n + 1 and corps::jsonb = jsonb_build_object('org', o), corps);
  insert into public.zz_res (nom, ok, vu) values ('… pas encore prévenue',
    (select prevenu_le from public.org_suivi where org_id = o) is null, null);
  insert into public.zz_res (nom, ok, vu) values ('le déclencheur ne s''appelle pas à la main',
    not has_function_privilege('authenticated', 'public.prevenir_demande()', 'execute')
    and not has_function_privilege('anon', 'public.prevenir_demande()', 'execute'), null);
end $$;

select n, ok, nom, vu from public.zz_res order by n;
rollback;
