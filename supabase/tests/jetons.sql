-- Tests de la migration 20261025111500_jetons_d_identite : qui choisit son
-- jeton, qui voit celui de qui. Même mode que classes_securisees.sql :
-- transaction ANNULÉE, comptes jetables, vrai rôle `authenticated`.

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
  oa uuid := gen_random_uuid(); pa uuid := gen_random_uuid(); e1 uuid := gen_random_uuid();
  e2 uuid := gen_random_uuid(); b1 uuid := gen_random_uuid(); b2 uuid := gen_random_uuid();
  b3 uuid := gen_random_uuid(); b4 uuid := gen_random_uuid(); u record;
  cid uuid; gid uuid; sid uuid; s text; n integer; ids uuid[];
begin
  insert into public.orgs (id, code, name) values (oa, 'ZZJ', 'Lycée Jeton');
  for u in select * from (values
      (pa, 'prof', oa, 'Mme Jeton', 'zzjprof'), (e1, 'eleve', oa, 'Emma DURAND', null),
      (e2, 'eleve', oa, 'Lucas MARTIN', null), (b1, 'eleve', null, 'Sam François', 'zzsamf'),
      (b2, 'eleve', null, 'Tibo', 'zztibo'), (b3, 'eleve', null, 'Inès', 'zzines'),
      (b4, 'eleve', null, 'Ava', 'zzava')) x(id, role, org, nom, pseudo) loop
    insert into auth.users (instance_id, id, aud, role, email)
    values ('00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', 'zz-' || u.id || '@exemple.invalid');
    insert into public.profiles (id, email, name, handle)
    values (u.id, 'zz-' || u.id || '@exemple.invalid', u.nom, u.pseudo)
    on conflict (id) do update set name = excluded.name, handle = excluded.handle;
    insert into public.user_roles (user_id, role) values (u.id, u.role)
    on conflict (user_id) do update set role = excluded.role;
    if u.org is not null then insert into public.org_members (user_id, org_id) values (u.id, u.org); end if;
  end loop;
  perform public.zz_comme(pa);
  cid := public.prof_creer_classe('ZZ CPGE ECP1', 'CPGE', 'Physique');
  perform public.zz_root();
  insert into public.class_members (class_id, user_id, who) values (cid, e1, 'Emma DURAND');
  insert into public.class_requests (class_id, user_id, who) values (cid, e2, 'Lucas MARTIN');
  insert into public.friends (user_id, friend_id, status) values (b1, b2, 'ok'), (b3, b1, 'pending');

  -- ══════════ choisir le sien ══════════
  perform public.zz_comme(b1);
  perform public.mon_jeton('renard', 3::smallint);
  insert into public.zz_res (nom, ok, vu) values ('chacun choisit sa figure et sa couleur, et se voit',
    exists (select 1 from public.visuels(array[b1], '{}') v where v.id = b1 and v.genre = 'p' and v.cle = 'renard' and v.teinte = 3),
    (select string_agg(v.cle || '/' || v.teinte, ',') from public.visuels(array[b1], '{}') v));

  begin perform public.mon_jeton('<img src=x>', 1::smallint); s := 'passé'; exception when others then s := sqlstate; end;
  insert into public.zz_res (nom, ok, vu) values ('une figure hors des clés est refusée', s = '22023', s);
  begin perform public.mon_jeton('chat', 12::smallint); s := 'passé'; exception when others then s := sqlstate; end;
  insert into public.zz_res (nom, ok, vu) values ('une couleur hors des douze est refusée', s = '22023', s);
  begin update public.profiles set figure = 'Pas Une Clé!' where id = b1; s := 'passé'; exception when others then s := sqlstate; end;
  insert into public.zz_res (nom, ok, vu) values ('même par l''API brute, la contrainte tient', s = '23514', s);

  perform public.zz_comme(e1);
  perform public.mon_jeton('hibou', 6::smallint);
  perform public.zz_root();
  insert into public.zz_res (nom, ok, vu) values ('un élève d''établissement choisit le sien, son nom reste verrouillé',
    exists (select 1 from public.profiles p where p.id = e1 and p.figure = 'hibou' and p.teinte = 6 and p.name = 'Emma DURAND'),
    (select p.figure || '/' || p.name from public.profiles p where p.id = e1));

  perform public.zz_comme(e1);
  perform public.mon_jeton(null, null);
  perform public.mon_jeton('hibou', 6::smallint);
  insert into public.zz_res (nom, ok, vu) values ('revenir aux initiales puis rechoisir', exists (
    select 1 from public.visuels(array[e1], '{}') v where v.cle = 'hibou'), 'ok');

  -- ══════════ qui voit qui ══════════
  perform public.zz_comme(b2);
  insert into public.zz_res (nom, ok, vu) values ('un ami voit le jeton choisi', exists (
    select 1 from public.visuels(array[b1], '{}') v where v.cle = 'renard'), 'ami');
  perform public.zz_comme(b3);
  insert into public.zz_res (nom, ok, vu) values ('une demande d''ami en attente suffit', exists (
    select 1 from public.visuels(array[b1], '{}') v where v.id = b1), 'demande');
  perform public.zz_comme(b4);
  select count(*) into n from public.visuels(array[b1, e1, pa], '{}');
  insert into public.zz_res (nom, ok, vu) values ('un inconnu ne voit le choix de personne', n = 0, n::text);

  perform public.zz_comme(b1);
  select c.id into gid from public.club_creer('ZZ Les Renards', 'feuille', 1, '') c;
  perform public.zz_root();
  insert into public.group_members (group_id, user_id) values (gid, b4);
  perform public.zz_comme(b4);
  insert into public.zz_res (nom, ok, vu) values ('un membre du même club voit le jeton', exists (
    select 1 from public.visuels(array[b1], '{}') v where v.cle = 'renard'), 'club');

  perform public.zz_comme(pa);
  insert into public.zz_res (nom, ok, vu) values ('le professeur voit le jeton de son élève', exists (
    select 1 from public.visuels(array[e1], '{}') v where v.cle = 'hibou'), 'élève');
  insert into public.zz_res (nom, ok, vu) values ('… et celui de qui attend en salle d''attente', exists (
    select 1 from public.visuels(array[e2], '{}') v where v.id = e2), 'attente');
  insert into public.zz_res (nom, ok, vu) values ('… mais pas celui d''un inconnu', not exists (
    select 1 from public.visuels(array[b1], '{}') v), 'inconnu');
  perform public.zz_comme(e1);
  insert into public.zz_res (nom, ok, vu) values ('l''élève voit le jeton de son professeur', exists (
    select 1 from public.visuels(array[pa], '{}') v where v.id = pa), 'prof');

  -- une partie en direct ouverte à tous : ses joueurs se voient
  perform public.zz_root();
  insert into public.salles (pin, hote, hote_nom, titre, jeu, duree, total)
  values ('918273', b2, 'Tibo', 'ZZ', 'qcm', 20, 5) returning id into sid;
  insert into public.salle_joueurs (salle_id, user_id, nom) values (sid, b3, 'zzines');
  perform public.zz_comme(b2);
  insert into public.zz_res (nom, ok, vu) values ('l''hôte d''une partie voit ses joueurs', exists (
    select 1 from public.visuels(array[b3], '{}') v where v.id = b3), 'salle');

  -- ══════════ le jeton d'une classe ══════════
  perform public.zz_comme(pa);
  perform public.prof_jeton_classe(cid, 'atome', 8::smallint);
  insert into public.zz_res (nom, ok, vu) values ('le professeur choisit l''emblème de sa classe', exists (
    select 1 from public.visuels('{}', array[cid]) v where v.genre = 'c' and v.cle = 'atome' and v.teinte = 8), 'classe');
  update public.classes set embleme = 'fusee' where id = cid;
  get diagnostics n = row_count;
  insert into public.zz_res (nom, ok, vu) values ('pas par l''API brute (seul le référent écrit la table)', n = 0, n::text);

  perform public.zz_comme(e1);
  insert into public.zz_res (nom, ok, vu) values ('un élève de la classe voit son emblème', exists (
    select 1 from public.visuels('{}', array[cid]) v where v.cle = 'atome'), 'élève');
  begin perform public.prof_jeton_classe(cid, 'fusee', 1::smallint); s := 'passé'; exception when others then s := sqlstate; end;
  insert into public.zz_res (nom, ok, vu) values ('… mais ne le change pas', s = '42501', s);
  perform public.zz_comme(e2);
  insert into public.zz_res (nom, ok, vu) values ('qui attend d''entrer voit l''emblème de la classe', exists (
    select 1 from public.visuels('{}', array[cid]) v where v.id = cid), 'attente');
  perform public.zz_comme(b4);
  insert into public.zz_res (nom, ok, vu) values ('un inconnu ne voit pas celui d''une classe', not exists (
    select 1 from public.visuels('{}', array[cid]) v), 'inconnu');

  -- ══════════ les bornes ══════════
  perform public.zz_comme(b1);
  ids := array(select gen_random_uuid() from generate_series(1, 200)) || b1;
  insert into public.zz_res (nom, ok, vu) values ('au plus 200 personnes par appel', not exists (
    select 1 from public.visuels(ids, '{}') v), 'borne');
  perform public.zz_root();
  insert into public.zz_res (nom, ok, vu) values ('anon n''appelle aucune des trois fonctions, ni les internes personne',
    not has_function_privilege('anon', 'public.visuels(uuid[], uuid[])', 'execute')
    and not has_function_privilege('anon', 'public.mon_jeton(text, smallint)', 'execute')
    and not has_function_privilege('anon', 'public.prof_jeton_classe(uuid, text, smallint)', 'execute')
    and not has_function_privilege('authenticated', 'public.voit_personne(uuid)', 'execute')
    and not has_function_privilege('authenticated', 'public.voit_classe(uuid)', 'execute'), 'droits');
end $$;

select n, ok, nom, vu from public.zz_res order by n;
rollback;
