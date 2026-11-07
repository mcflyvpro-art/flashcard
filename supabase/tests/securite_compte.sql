-- Tests de la migration « sécurité du compte » (2026-11-04) : la
-- vérification en deux étapes tenue par la base (politiques restrictives
-- `deux_etapes`, `mfa_ok()`), l'adresse suivie (`adresse_suivie` sur
-- auth.users), la purge des comptes jamais confirmés. Même mode que les
-- autres : transaction ANNULÉE, comptes jetables, vrai rôle `authenticated`
-- et son jeton (`request.jwt.claims`, `aal` compris).

begin;

create table public.zz_res (n serial primary key, nom text, ok boolean, vu text);
grant all on public.zz_res to authenticated, anon;
grant all on sequence public.zz_res_n_seq to authenticated, anon;

do $$
declare
  lea uuid := gen_random_uuid(); tom uuid := gen_random_uuid(); zoe uuid := gen_random_uuid();
  vieux uuid := gen_random_uuid(); neuf uuid := gen_random_uuid(); google uuid := gen_random_uuid();
  venu uuid := gen_random_uuid(); confirme uuid := gen_random_uuid(); o uuid;
  n integer; refus text;
begin
  insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, created_at)
  select '00000000-0000-0000-0000-000000000000', u, 'authenticated', 'authenticated', 'zz-' || u || '@exemple.invalid', now(), now()
  from unnest(array[lea, tom, zoe]) u;
  insert into public.profiles (id, email, name) select u, 'zz-' || u || '@exemple.invalid', 'Zz'
  from unnest(array[lea, tom, zoe]) u on conflict (id) do nothing;
  insert into public.decks (user_id, name) values (lea, 'zz livre de Léa'), (tom, 'zz livre de Tom');
  -- Léa a activé la vérification en deux étapes ; Tom l'a seulement commencée
  insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at)
  values (gen_random_uuid(), lea, 'Mirandola', 'totp', 'verified', now(), now()),
         (gen_random_uuid(), tom, 'Mirandola', 'totp', 'unverified', now(), now());

  -- ══════════ la vérification en deux étapes ══════════
  perform set_config('request.jwt.claims', json_build_object('sub', lea, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  perform set_config('role', 'authenticated', true);
  select count(*) into n from public.decks;
  insert into public.zz_res (nom, ok, vu) values ('Léa, son mot de passe seul (aal1) : aucun livre', n = 0, n::text);
  begin
    insert into public.decks (user_id, name) values (lea, 'zz pirate');
    refus := 'écrit';
  exception when insufficient_privilege then refus := sqlstate;
  end;
  insert into public.zz_res (nom, ok, vu) values ('… ni écrire', refus = '42501', refus);
  select count(*) into n from public.profiles where id = lea;
  insert into public.zz_res (nom, ok, vu) values ('… ni lire son profil', n = 0, n::text);

  perform set_config('request.jwt.claims', json_build_object('sub', lea, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  select count(*) into n from public.decks;
  insert into public.zz_res (nom, ok, vu) values ('Léa avec le code de son application (aal2) : son livre', n = 1, n::text);
  insert into public.decks (user_id, name) values (lea, 'zz second livre');
  insert into public.zz_res (nom, ok, vu) values ('… et elle écrit', true, null);

  perform set_config('request.jwt.claims', json_build_object('sub', tom, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  select count(*) into n from public.decks;
  insert into public.zz_res (nom, ok, vu) values ('Tom, un facteur jamais validé : rien ne change', n = 1, n::text);
  perform set_config('request.jwt.claims', json_build_object('sub', zoe, 'role', 'authenticated')::text, true);
  insert into public.zz_res (nom, ok, vu) values ('Zoé, sans facteur ni aal dans le jeton : mfa_ok()', public.mfa_ok(), null);
  perform set_config('role', 'postgres', true);

  -- les treize du 2026-11-05, et examens (20261106054530) : nommées, pas
  -- comptées — une table de plus ne doit pas faire croire à une de moins
  insert into public.zz_res (nom, ok, vu) values ('chaque table de ce qui est à soi gardée par une politique restrictive',
    (select array_agg(tablename::text order by tablename) from pg_policies
      where schemaname = 'public' and policyname = 'deux_etapes' and permissive = 'RESTRICTIVE')
    @> array['blocks','cards','deck_versions','decks','examens','friends','library','mail','prefs','profiles',
             'reviews','sessions','shares','subjects'],
    (select string_agg(tablename::text, ',' order by tablename) from pg_policies
      where schemaname = 'public' and policyname = 'deux_etapes'));

  -- ══════════ l'adresse suivie ══════════
  update auth.users set email = 'zz-nouvelle-' || tom || '@exemple.invalid' where id = tom;
  insert into public.zz_res (nom, ok, vu) values ('une adresse changée : le profil suit',
    (select email from public.profiles where id = tom) = 'zz-nouvelle-' || tom || '@exemple.invalid', null);
  insert into public.orgs (code, name) values ('ZZ' || substr(md5(zoe::text), 1, 6), 'Lycée Zz') returning id into o;
  insert into public.org_members (user_id, org_id) values (zoe, o);
  begin
    update auth.users set email = 'zz-ailleurs-' || zoe || '@exemple.invalid' where id = zoe;
    refus := 'changée';
  exception when insufficient_privilege then refus := sqlstate;
  end;
  insert into public.zz_res (nom, ok, vu) values ('un élève d’établissement ne change pas son adresse lui-même', refus = '42501', refus);

  -- ══════════ les comptes jamais confirmés ══════════
  insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, last_sign_in_at, created_at)
  values ('00000000-0000-0000-0000-000000000000', vieux, 'authenticated', 'authenticated', 'zz-' || vieux || '@exemple.invalid', null, null, now() - interval '8 days'),
         ('00000000-0000-0000-0000-000000000000', neuf, 'authenticated', 'authenticated', 'zz-' || neuf || '@exemple.invalid', null, null, now() - interval '2 days'),
         ('00000000-0000-0000-0000-000000000000', google, 'authenticated', 'authenticated', 'zz-' || google || '@exemple.invalid', null, null, now() - interval '30 days'),
         ('00000000-0000-0000-0000-000000000000', venu, 'authenticated', 'authenticated', 'zz-' || venu || '@exemple.invalid', null, now() - interval '9 days', now() - interval '10 days'),
         ('00000000-0000-0000-0000-000000000000', confirme, 'authenticated', 'authenticated', 'zz-' || confirme || '@exemple.invalid', now(), null, now() - interval '30 days');
  -- auth.identities.email se calcule depuis identity_data
  insert into auth.identities (provider_id, user_id, identity_data, provider)
  values (google::text, google, jsonb_build_object('sub', google::text, 'email', 'zz-' || google || '@exemple.invalid'), 'google');
  insert into public.profiles (id, email, name) values (vieux, 'zz-' || vieux || '@exemple.invalid', 'Zz') on conflict (id) do nothing;
  perform public.purger_comptes_non_confirmes();
  -- décidé le 2026-11-05 : rien de ce qui existait avant le 2026-11-06 ne se supprime
  insert into public.zz_res (nom, ok, vu) values ('jamais confirmé depuis 8 jours, mais d’avant le 2026-11-06 : gardé, son profil avec',
    exists (select 1 from auth.users where id = vieux) and exists (select 1 from public.profiles where id = vieux), null);
  insert into public.zz_res (nom, ok, vu) values ('la purge ne vise que les comptes nés à partir du 2026-11-06',
    position('2026-11-06' in pg_get_functiondef('public.purger_comptes_non_confirmes()'::regprocedure)) > 0, null);
  insert into public.zz_res (nom, ok, vu) values ('… créé il y a 2 jours : encore là', exists (select 1 from auth.users where id = neuf), null);
  insert into public.zz_res (nom, ok, vu) values ('… venu de Google : encore là', exists (select 1 from auth.users where id = google), null);
  insert into public.zz_res (nom, ok, vu) values ('… déjà connecté une fois : encore là', exists (select 1 from auth.users where id = venu), null);
  insert into public.zz_res (nom, ok, vu) values ('un compte confirmé : encore là', exists (select 1 from auth.users where id = confirme), null);
  insert into public.zz_res (nom, ok, vu) values ('la purge passe chaque nuit',
    exists (select 1 from cron.job where jobname = 'purge-comptes-non-confirmes'), null);

  -- ══════════ les droits ══════════
  insert into public.zz_res (nom, ok, vu) values ('anon n’appelle pas mfa_ok, personne n’appelle la purge ni le déclencheur',
    not has_function_privilege('anon', 'public.mfa_ok()', 'execute')
    and not has_function_privilege('authenticated', 'public.purger_comptes_non_confirmes()', 'execute')
    and not has_function_privilege('authenticated', 'public.adresse_suivie()', 'execute'), null);
end $$;

select n, case when ok then 'OK' else 'KO' end as verdict, nom, vu from public.zz_res order by n;
rollback;
