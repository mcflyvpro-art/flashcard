-- L'identité d'un élève : un vrai prénom et un vrai nom, mis en forme, et
-- figés. Réécrit le 2026-11-07 : la première version (20261024125435)
-- éprouvait surtout les comptes à carte, partis le 2026-10-28
-- (20261029090000) ; la base neuve de la CI l'a vu, le fichier appelait des
-- fonctions qui n'existent plus. Restent, éprouvées ici par les chemins
-- d'aujourd'hui (rejoindre, class_join) : le nom donné à l'entrée, le
-- verrou du nom (lock_identite_scolaire), qui le corrige (le référent dans
-- son établissement — partout depuis 20261107213201 —, le professeur
-- particulier dans sa classe), et la carte élève bien partie.
-- Transaction ANNULÉE, comptes jetables, vrai rôle `authenticated`.

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
  oa uuid := gen_random_uuid(); pa uuid := gen_random_uuid(); ra uuid := gen_random_uuid();
  pp uuid := gen_random_uuid(); alice uuid := gen_random_uuid(); bob uuid := gen_random_uuid();
  perso uuid := gen_random_uuid();
  cid uuid; cid2 uuid; aid uuid; ce text; kcol text; s text; t text; b boolean; j jsonb; u record;
begin
  insert into public.orgs (id, code, name, offre, places, licence_fin)
  values (oa, 'ZZA', 'Lycée Zed', 'etablissement', 50, current_date + 30);
  for u in select * from (values (pa, 'prof', true, 'Mme Zed'), (ra, 'ref', true, 'Réf Zed'),
      (pp, 'prof', false, 'Mme Libre'), (alice, null, false, 'zzalice'), (bob, null, false, 'zzbob'),
      (perso, null, false, 'Batman du 93')) x(id, role, org, nom) loop
    insert into auth.users (instance_id, id, aud, role, email)
    values ('00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', 'zz-' || u.id || '@exemple.invalid');
    insert into public.profiles (id, email, name, handle)
    values (u.id, 'zz-' || u.id || '@exemple.invalid', u.nom, 'zz' || substr(u.id::text, 1, 8))
    on conflict (id) do update set name = excluded.name;
    if u.role is not null then
      insert into public.user_roles (user_id, role) values (u.id, u.role)
      on conflict (user_id) do update set role = excluded.role;
    end if;
    if u.org then insert into public.org_members (user_id, org_id) values (u.id, oa); end if;
  end loop;
  insert into public.org_codes (org_id) values (oa) on conflict do nothing;
  update public.org_codes set eleve = public.code_unique(), prof = public.code_unique() where org_id = oa;
  select k.eleve into ce from public.org_codes k where k.org_id = oa;
  -- une classe de l'établissement (un professeur y crée un groupe : on en fait une classe)
  perform public.zz_comme(pa);
  cid := public.prof_creer_classe('ZZ 2nde 4', 'Seconde', 'Anglais');
  perform public.zz_root();
  update public.classes set genre = 'classe' where id = cid;

  -- ── entrer avec son code : un vrai nom, mis en forme ──
  perform public.zz_comme(bob);
  j := public.rejoindre(ce, '', '', cid);
  insert into public.zz_res (nom, ok, vu) values ('sans prénom ni nom : « nom », personne n''entre',
    j->>'statut' = 'nom' and public.my_org() is null, j::text);
  j := public.rejoindre(ce, 'Lucas', 'Batman<3', cid);
  insert into public.zz_res (nom, ok, vu) values ('un faux nom (caractères interdits) : refusé', j->>'statut' = 'nom', j::text);
  perform public.zz_comme(alice);
  j := public.rejoindre(ce, '  alice ', ' martin ', cid);
  perform public.zz_root();
  insert into public.zz_res (nom, ok, vu) values ('Alice entre sous « Alice MARTIN », partout',
    j->>'statut' = 'ok' and (select name from public.profiles where id = alice) = 'Alice MARTIN'
    and (select who from public.class_members where class_id = cid and user_id = alice) = 'Alice MARTIN', j::text);

  -- ── le nom ne se change pas ; le pseudo, seulement par sa porte ──
  perform public.zz_comme(alice);
  update public.profiles set name = 'DarkAlice' where id = alice;
  begin update public.profiles set handle = 'darkalice' where id = alice; s := 'passé';
  exception when others then s := sqlstate; end;
  perform public.zz_root();
  select p.name into t from public.profiles p where p.id = alice;
  insert into public.zz_res (nom, ok, vu) values ('l''élève ne change pas son nom, ni son pseudo par l''API brute',
    t = 'Alice MARTIN' and s = '42501', t || ' ' || s);
  perform public.zz_comme(alice);
  insert into public.zz_res (nom, ok, vu) values ('son pseudo, par changer_pseudo (pseudos.sql)',
    public.changer_pseudo('zz.alice.lit')->>'statut' = 'ok', '');
  select g.gere, g.nom, g.identifiant into b, s, t from public.mon_compte() g;
  insert into public.zz_res (nom, ok, vu) values ('mon_compte : son nom, plus de compte à carte',
    not b and s = 'Alice MARTIN' and coalesce(t, '') = '', b || '/' || s || '/' || coalesce(t, '∅'));

  -- ── qui corrige le nom ──
  perform public.zz_comme(pa);
  perform public.prof_give(array[cid], 'ZZ Vocabulaire', 'Anglais', '[["cat","chat"]]'::jsonb, current_date + 7);
  perform public.zz_root();
  select a.id into aid from public.assignments a where a.class_id = cid;
  perform public.zz_comme(alice);
  perform public.eleve_ouvrir_devoir(aid);
  perform public.zz_comme(pa);
  begin perform public.prof_nommer_eleve(cid, alice, 'Hack', 'Er'); s := 'passé';
  exception when others then s := sqlerrm; end;
  insert into public.zz_res (nom, ok, vu) values ('un professeur d''établissement ne corrige pas le nom', s like '%référent%', s);
  begin perform public.ref_update_account(alice, 'Hack ER'); s := 'passé';
  exception when others then s := 'refusé'; end;
  insert into public.zz_res (nom, ok, vu) values ('… ni par la porte du référent', s = 'refusé', s);
  perform public.zz_comme(ra);
  perform public.ref_update_account(alice, 'Alyce MARTIN');
  perform public.zz_root();
  insert into public.zz_res (nom, ok, vu) values ('le référent corrige le nom : profil, liste de la classe, devoir',
    (select name from public.profiles where id = alice) = 'Alyce MARTIN'
    and (select who from public.class_members where class_id = cid and user_id = alice) = 'Alyce MARTIN'
    and (select who from public.assignment_progress where assignment_id = aid and user_id = alice) = 'Alyce MARTIN', '');
  perform public.zz_comme(pa);
  select r.who into t from public.prof_roster(cid) r where r.user_id = alice;
  insert into public.zz_res (nom, ok, vu) values ('le professeur voit le nom corrigé', t = 'Alyce MARTIN', coalesce(t, '∅'));

  -- ── chez un professeur particulier : un compte personnel, son vrai nom ──
  perform public.zz_root();
  insert into public.prof_licences (prof, places, fin) values (pp, 5, current_date + 30);
  perform public.zz_comme(pp);
  cid2 := public.prof_creer_classe('ZZ Soutien', '', 'Maths');
  perform public.zz_root();
  select c.code into kcol from public.classes c where c.id = cid2;
  perform public.zz_comme(perso);
  select x.statut into s from public.class_join(kcol) x;
  insert into public.zz_res (nom, ok, vu) values ('compte personnel sans prénom ni nom : « nom », rien d''inscrit',
    s = 'nom' and not exists (select 1 from public.class_requests r where r.user_id = perso), s);
  select x.statut into s from public.class_join(kcol, 'Lucas', 'Batman<3') x;
  insert into public.zz_res (nom, ok, vu) values ('un faux nom (caractères interdits) est refusé', s = 'nom', s);
  select x.statut into s from public.class_join(kcol, '  lucas ', ' durand ') x;
  perform public.zz_comme(pp);
  select d.who into t from public.prof_demandes(cid2) d where d.user_id = perso;
  insert into public.zz_res (nom, ok, vu) values ('le professeur voit « Lucas DURAND », pas le pseudo',
    s = 'attente' and t = 'Lucas DURAND', s || '/' || coalesce(t, '∅'));
  perform public.prof_admettre(cid2, array[perso]);
  t := public.prof_nommer_eleve(cid2, perso, 'luc', 'durand');
  perform public.zz_root();
  insert into public.zz_res (nom, ok, vu) values ('le professeur particulier corrige le nom dans sa classe, pas le profil',
    t = 'Luc DURAND' and (select who from public.class_members where class_id = cid2 and user_id = perso) = 'Luc DURAND'
    and (select name from public.profiles where id = perso) = 'Batman du 93', t);
  perform public.zz_comme(ra);
  begin perform public.ref_update_account(perso, 'Pirate'); s := 'passé';
  exception when others then s := 'refusé'; end;
  insert into public.zz_res (nom, ok, vu) values ('un référent ne renomme pas qui n''est pas de son établissement', s = 'refusé', s);

  -- ── les droits ──
  perform public.zz_root();
  insert into public.zz_res (nom, ok, vu) values ('la carte élève est partie, le verrou reste fermé à l''API',
    to_regprocedure('public.prof_creer_eleves(uuid, jsonb, boolean)') is null
    and to_regprocedure('public.prof_nouvelles_cartes(uuid, uuid[])') is null
    and to_regprocedure('public.prof_supprimer_eleve(uuid, uuid)') is null
    and not has_function_privilege('authenticated', 'public.lock_identite_scolaire()', 'execute')
    and not has_function_privilege('anon', 'public.ref_update_account(uuid, text, text, text)', 'execute')
    and not has_function_privilege('anon', 'public.prof_nommer_eleve(uuid, uuid, text, text)', 'execute'), '');
end $$;

select n, ok, nom, vu from public.zz_res order by n;

rollback;
