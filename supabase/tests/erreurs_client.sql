-- Tests de 20261107143227_erreurs_du_client : une erreur arrive anonyme et
-- nettoyée, se compte au lieu de se recopier, ne peut ni grossir la base ni
-- faire une erreur de plus ; personne ne la lit par l'API brute ; la vigie
-- ne rend aucun texte. Transaction ANNULÉE, comptes jetables.
-- Pour lire le bilan par MCP execute_sql : remplacer le select final et le
-- rollback par un `do $$ begin raise exception 'RESULTATS %', ...; end $$;`.

begin;

create table public.zz_res (n serial primary key, nom text, ok boolean, vu text);
grant all on public.zz_res to anon, authenticated;
grant all on sequence public.zz_res_n_seq to anon, authenticated;
create function public.zz_comme(u uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function public.zz_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
end $$;
create function public.zz_root() returns void language plpgsql as $$
begin perform set_config('role', 'postgres', true); end $$;
grant execute on function public.zz_comme(uuid), public.zz_anon(), public.zz_root() to anon, authenticated;

-- partir d'une base vide pour ces tables, le temps de la transaction
delete from public.erreurs_client;
delete from public.vigie_heures;

do $$
declare
  eleve uuid := gen_random_uuid(); adm uuid := gen_random_uuid();
  j date := (now() at time zone 'utc')::date; x record; n integer; s text; v jsonb;
  pile text := E'ouvrirLivre app-3f2a91bc.js:1:123456\nrender menus-9a8b7c6d.js:2:777';
begin
  insert into auth.users (instance_id, id, aud, role, email) values
    ('00000000-0000-0000-0000-000000000000', eleve, 'authenticated', 'authenticated', 'zz-' || eleve || '@exemple.invalid'),
    ('00000000-0000-0000-0000-000000000000', adm, 'authenticated', 'authenticated', 'zz-' || adm || '@exemple.invalid');
  insert into public.user_roles (user_id, role) values (adm, 'admin') on conflict (user_id) do update set role = 'admin';

  -- 1. sans compte, une erreur arrive, nettoyée une seconde fois en base
  perform public.zz_anon();
  perform public.signaler(jsonb_build_object('type', 'erreur', 'empreinte', 'e1a2b3c4d',
    'message', 'Échec pour lea@lycee.fr, 3f2a9c1e-7b4d-4e2a-9f10-2c3d4e5f6a7b, 0612345678, https://mirandola.fr/x?jeton=secret',
    'pile', pile, 'ecran', 'deck', 'navigateur', 'safari 26', 'build', 'abc123', 'installee', true));
  perform public.zz_root();
  select * into x from public.erreurs_client where empreinte = 'e1a2b3c4d' and jour = j;
  insert into public.zz_res (nom, ok, vu) values ('une erreur arrive sans compte, sans rien qui désigne quelqu''un',
    x.message = 'Échec pour <courriel>, <id>, <n>, https://mirandola.fr/x' and x.n = 1, x.message);
  insert into public.zz_res (nom, ok, vu) values ('la pile garde ses lignes, ses fichiers et ses colonnes à six chiffres',
    x.pile = pile, x.pile);

  -- 2. la même erreur se compte, elle ne se recopie pas
  perform public.zz_comme(eleve);
  perform public.signaler(jsonb_build_object('type', 'erreur', 'empreinte', 'e1a2b3c4d', 'message', 'autre texte',
    'ecran', 'deck', 'navigateur', 'chrome 140', 'build', 'abc123', 'installee', false));
  perform public.zz_root();
  select * into x from public.erreurs_client where empreinte = 'e1a2b3c4d' and jour = j;
  insert into public.zz_res (nom, ok, vu) values ('la même erreur se compte : une ligne, deux fois, deux navigateurs',
    x.n = 2 and (x.navigateurs->>'safari 26')::int = 1 and (x.navigateurs->>'chrome 140')::int = 1
    and (x.ecrans->>'deck')::int = 2 and x.installee = 1, x.n || ' ' || x.navigateurs::text);

  -- 3. ce qui est mal formé ne laisse rien, et ne lève jamais
  perform public.zz_anon();
  perform public.signaler(null);
  perform public.signaler('[]'::jsonb);
  perform public.signaler(jsonb_build_object('type', 'pirate', 'empreinte', 'e00000000'));
  perform public.signaler(jsonb_build_object('type', 'erreur', 'empreinte', 'DROP TABLE'));
  perform public.signaler(jsonb_build_object('type', 'erreur', 'empreinte', 'e00000001', 'message', repeat('x', 9000)));
  perform public.signaler(jsonb_build_object('type', 'demarrage', 'ms', 'beaucoup'));
  perform public.zz_root();
  select count(*) into n from public.erreurs_client;
  insert into public.zz_res (nom, ok, vu) values ('rien de mal formé n''entre, et rien ne lève', n = 1, n::text);

  -- 4. une ouverture se compte, son temps dans sa case
  perform public.zz_anon();
  perform public.signaler(jsonb_build_object('type', 'demarrage', 'ms', 1500, 'installee', true));
  perform public.signaler(jsonb_build_object('type', 'demarrage', 'ms', 400));
  perform public.zz_root();
  select demarrages || '/' || installees || '/' || cases::text into s from public.vigie_heures where heure = date_trunc('hour', now());
  insert into public.zz_res (nom, ok, vu) values ('les ouvertures se comptent, leur temps rangé en six cases',
    s = '3/1/{1,1,0,0,0,0}', s);

  -- 5. 200 erreurs différentes par jour au plus : le reste dans « autres »
  perform public.zz_anon();
  for n in 1 .. 205 loop
    perform public.signaler(jsonb_build_object('type', 'promesse', 'empreinte', 'p' || lpad(to_hex(n), 8, '0'), 'message', 'm' || n));
  end loop;
  perform public.zz_root();
  select count(*) into n from public.erreurs_client where jour = j;
  insert into public.zz_res (nom, ok, vu) values ('200 erreurs différentes par jour au plus, le reste s''additionne dans « autres »',
    n = 201 and exists (select 1 from public.erreurs_client z where z.empreinte = 'autres' and z.jour = j and z.n = 6), n::text);

  -- 6. personne ne lit par l'API brute
  perform public.zz_anon();
  begin
    select count(*) into n from public.erreurs_client;
    insert into public.zz_res (nom, ok, vu) values ('anon ne lit pas les erreurs', false, n::text);
  exception when others then insert into public.zz_res (nom, ok, vu) values ('anon ne lit pas les erreurs', sqlstate = '42501', sqlstate); end;
  perform public.zz_comme(eleve);
  begin
    select count(*) into n from public.vigie_heures;
    insert into public.zz_res (nom, ok, vu) values ('un compte ne lit pas la vigie', false, n::text);
  exception when others then insert into public.zz_res (nom, ok, vu) values ('un compte ne lit pas la vigie', sqlstate = '42501', sqlstate); end;
  begin
    perform public.admin_erreurs(7);
    insert into public.zz_res (nom, ok, vu) values ('admin_erreurs refusée à un élève', false, 'passé');
  exception when others then insert into public.zz_res (nom, ok, vu) values ('admin_erreurs refusée à un élève', true, sqlerrm); end;

  -- 7. l'éditeur lit le détail
  perform public.zz_comme(adm);
  select count(*) into n from public.admin_erreurs(7);
  v := public.admin_vigie();
  insert into public.zz_res (nom, ok, vu) values ('l''éditeur lit les erreurs (les 200 plus fréquentes) et la vigie',
    n = 200 and (v->>'alerte')::boolean and (v->'jour'->>'demarrages')::int = 3, n || ' ' || (v->>'raisons'));

  -- 8. la vigie ne rend aucun texte d'erreur (le dépôt est public)
  perform public.zz_root();
  v := public.vigie();
  insert into public.zz_res (nom, ok, vu) values ('la vigie ne rend aucun texte d''erreur',
    v::text not like '%Échec%' and v::text not like '%lycee%' and v::text not like '%autre texte%'
    and jsonb_array_length(v->'neuves') = 200, jsonb_array_length(v->'neuves')::text);

  -- 9. M05.T6 : plus de 1 % d'erreurs sur la dernière heure, dès 20 ouvertures
  perform public.zz_anon();
  for n in 1 .. 20 loop perform public.signaler(jsonb_build_object('type', 'demarrage', 'ms', 900)); end loop;
  perform public.zz_root();
  v := public.vigie();
  insert into public.zz_res (nom, ok, vu) values ('l''alerte de la dernière heure : plus de 1 % d''erreurs dès 20 ouvertures',
    (v->>'alerte')::boolean and v->'raisons' ? 'taux d''erreur au-dessus de 1 % sur la dernière heure', v->>'raisons');

  -- 10. les droits
  insert into public.zz_res (nom, ok, vu) values ('signaler ouverte à anon et aux comptes, rien d''autre',
    has_function_privilege('anon', 'public.signaler(jsonb)', 'execute')
    and has_function_privilege('authenticated', 'public.signaler(jsonb)', 'execute')
    and not has_function_privilege('anon', 'public.vigie()', 'execute')
    and not has_function_privilege('authenticated', 'public.vigie()', 'execute')
    and not has_function_privilege('anon', 'public.admin_erreurs(integer)', 'execute')
    and not has_function_privilege('authenticated', 'public.texte_propre(text, integer, boolean)', 'execute')
    and not has_function_privilege('anon', 'public.compteur(jsonb, text)', 'execute')
    and not has_table_privilege('anon', 'public.erreurs_client', 'insert')
    and not has_table_privilege('authenticated', 'public.vigie_heures', 'select'), 'droits');
end $$;

select n, case when ok then 'ok' else 'ÉCHEC' end as resultat, nom, vu from public.zz_res order by n;
rollback;
