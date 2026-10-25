-- Tests de la migration 20261025210000_page_d_une_classe : ce qu'un élève
-- voit de sa classe. Même mode que jetons.sql : transaction ANNULÉE, comptes
-- jetables, vrai rôle `authenticated`.

begin;

create table public.zz_res (n serial primary key, nom text, ok boolean, vu text);
grant all on public.zz_res to authenticated;
grant all on sequence public.zz_res_n_seq to authenticated;
create function public.zz_comme(u uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function public.zz_root() returns void language plpgsql as $$
begin perform set_config('role', 'postgres', true); end $$;
grant execute on function public.zz_comme(uuid), public.zz_root() to authenticated;

do $$
declare
  prof uuid := gen_random_uuid(); emma uuid := gen_random_uuid(); lucas uuid := gen_random_uuid();
  ines uuid := gen_random_uuid(); zoe uuid := gen_random_uuid(); max uuid := gen_random_uuid(); u record;
  cid uuid; code text; j jsonb;
begin
  for u in select * from (values
      (prof, 'Mme Classe', 'zzprofc', 'prof'), (emma, 'Emma', 'zzemmac', 'eleve'), (lucas, 'Lucas', 'zzlucasc', 'eleve'),
      (ines, 'Inès', 'zzinesc', 'eleve'), (zoe, 'Zoé', 'zzzoec', 'eleve'), (max, 'Max', 'zzmaxc', 'eleve')) x(id, nom, pseudo, role) loop
    insert into auth.users (instance_id, id, aud, role, email)
    values ('00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', 'zz-' || u.id || '@exemple.invalid');
    insert into public.profiles (id, email, name, handle)
    values (u.id, 'zz-' || u.id || '@exemple.invalid', u.nom, u.pseudo)
    on conflict (id) do update set name = excluded.name, handle = excluded.handle;
    insert into public.user_roles (user_id, role) values (u.id, u.role)
    on conflict (user_id) do update set role = excluded.role;
  end loop;
  perform public.zz_comme(prof);
  cid := public.prof_creer_classe('ZZ 2nde B', '2nde', 'Anglais');
  perform public.zz_root();
  select c.code into code from public.classes c where c.id = cid;
  insert into public.class_members (class_id, user_id, who) values
    (cid, emma, 'Emma DURAND'), (cid, lucas, 'Lucas MARTIN'), (cid, max, 'Max PETIT');
  insert into public.class_requests (class_id, user_id, who) values (cid, ines, 'Inès ROUX');
  insert into public.friends (user_id, friend_id, status) values (emma, lucas, 'ok');
  insert into public.blocks (user_id, blocked_id) values (max, emma);

  -- ══════════ un élève inscrit ══════════
  perform public.zz_comme(emma);
  j := public.eleve_classe(cid);
  insert into public.zz_res (nom, ok, vu) values ('inscrite : la page entière', j->>'statut' = 'inscrit' and j->>'nom' = 'ZZ 2nde B'
    and j->>'niveau' = '2nde' and (j->>'peut_quitter')::boolean, j->>'statut');
  insert into public.zz_res (nom, ok, vu) values ('son professeur, sa matière, principal',
    j->'profs'->0->>'nom' = 'Mme Classe' and j->'profs'->0->>'matiere' = 'Anglais' and (j->'profs'->0->>'principal')::boolean,
    (j->'profs')::text);
  insert into public.zz_res (nom, ok, vu) values ('elle d''abord, puis ses camarades sous leur nom de classe',
    (j->'eleves'->0->>'moi')::boolean and j->'eleves'->1->>'nom' = 'Lucas MARTIN', (j->'eleves')::text);
  insert into public.zz_res (nom, ok, vu) values ('le lien d''amitié de chacun', j->'eleves'->1->>'ami' = 'ok', j->'eleves'->1->>'ami');
  insert into public.zz_res (nom, ok, vu) values ('un camarade qui l''a bloquée n''apparaît pas',
    jsonb_array_length(j->'eleves') = 2 and position('Max' in (j->'eleves')::text) = 0, jsonb_array_length(j->'eleves')::text);
  insert into public.zz_res (nom, ok, vu) values ('jamais le code de la classe', position(code in j::text) = 0 and not j ? 'code', 'code');
  perform public.zz_comme(lucas);
  j := public.eleve_classe(cid);
  insert into public.zz_res (nom, ok, vu) values ('un autre inscrit voit les trois élèves', jsonb_array_length(j->'eleves') = 3,
    jsonb_array_length(j->'eleves')::text);

  -- ══════════ les autres ══════════
  perform public.zz_comme(ines);
  j := public.eleve_classe(cid);
  insert into public.zz_res (nom, ok, vu) values ('en salle d''attente : le nom de la classe, personne dedans',
    j->>'statut' = 'attente' and j->>'nom' = 'ZZ 2nde B' and not j ? 'eleves' and not j ? 'profs', j::text);
  perform public.zz_comme(zoe);
  j := public.eleve_classe(cid);
  insert into public.zz_res (nom, ok, vu) values ('une inconnue : rien', j = '{"statut": "inconnue"}'::jsonb, j::text);
  perform public.zz_comme(emma);
  j := public.eleve_classe(gen_random_uuid());
  insert into public.zz_res (nom, ok, vu) values ('une classe qui n''existe pas : inconnue', j->>'statut' = 'inconnue', j->>'statut');
  perform public.zz_root();
  update public.classes set archived_at = now() where id = cid;
  perform public.zz_comme(emma);
  j := public.eleve_classe(cid);
  insert into public.zz_res (nom, ok, vu) values ('une classe archivée : inconnue', j->>'statut' = 'inconnue', j->>'statut');

  perform public.zz_root();
  insert into public.zz_res (nom, ok, vu) values ('anon ne l''appelle pas, authenticated oui',
    not has_function_privilege('anon', 'public.eleve_classe(uuid)', 'execute')
    and has_function_privilege('authenticated', 'public.eleve_classe(uuid)', 'execute'), 'droits');
end $$;

select n, ok, nom, vu from public.zz_res order by n;
rollback;
