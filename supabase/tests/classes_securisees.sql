-- Tests d'attaque de la migration 20261024113815_des_classes_quon_ne_force_pas.
--
-- À lancer tel quel (MCP Supabase `execute_sql`, ou psql) : tout se passe
-- dans une transaction ANNULÉE à la fin — comptes, établissements, classes
-- et révisions créés ici disparaissent, rien ne reste dans la base des
-- élèves. Chaque ligne du résultat est un test ; `ok` doit être vrai partout.
--
-- On se fait passer pour un compte comme le fait PostgREST : rôle
-- `authenticated` et `request.jwt.claims` portant son identifiant — donc
-- avec la RLS et les droits d'exécution réels, pas ceux du propriétaire.

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
  oa uuid := gen_random_uuid(); ob uuid := gen_random_uuid();
  pa uuid := gen_random_uuid(); pa2 uuid := gen_random_uuid(); pb uuid := gen_random_uuid();
  pp uuid := gen_random_uuid(); ra uuid := gen_random_uuid(); rb uuid := gen_random_uuid();
  e1 uuid := gen_random_uuid(); e2 uuid := gen_random_uuid(); e3 uuid := gen_random_uuid();
  e4 uuid := gen_random_uuid(); e5 uuid := gen_random_uuid(); eb uuid := gen_random_uuid();
  perso uuid := gen_random_uuid();
  cid uuid; cid2 uuid; aid uuid; aid2 uuid; code1 text; code2 text; kcol text;
  s text; t text; n integer; b boolean; j jsonb;
  u record;
begin
  -- ── le décor ──
  insert into public.orgs (id, code, name) values (oa, 'ZZA', 'Lycée Zed'), (ob, 'ZZB', 'Lycée Autre');
  for u in select * from (values
      (pa, 'prof', oa, 'Mme Zed'), (pa2, 'prof', oa, 'M. Collègue'), (pb, 'prof', ob, 'M. Ailleurs'),
      (pp, 'prof', null, 'Mme Libre'), (ra, 'ref', oa, 'Réf Zed'), (rb, 'ref', ob, 'Réf Autre'),
      (e1, 'eleve', oa, 'Alice Zed'), (e2, 'eleve', oa, 'Bob Zed'), (e3, 'eleve', oa, 'Chloé Zed'),
      (e4, 'eleve', oa, 'Dan Zed'), (e5, 'eleve', oa, 'Eva Zed'), (eb, 'eleve', ob, 'Intrus Autre'),
      (perso, 'eleve', null, 'Perso')) x(id, role, org, nom) loop
    insert into auth.users (instance_id, id, aud, role, email)
    values ('00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated',
            'zz-' || u.id || '@exemple.invalid');
    insert into public.profiles (id, email, name, handle)
    values (u.id, 'zz-' || u.id || '@exemple.invalid', u.nom, 'zz' || substr(u.id::text, 1, 8))
    on conflict (id) do update set name = excluded.name;
    insert into public.user_roles (user_id, role) values (u.id, u.role)
    on conflict (user_id) do update set role = excluded.role;
    if u.org is not null then insert into public.org_members (user_id, org_id) values (u.id, u.org); end if;
  end loop;

  -- ── créer une classe ──
  perform public.zz_comme(e1);
  begin perform public.prof_creer_classe('ZZ pirate', '', ''); s := 'passé';
  exception when others then s := 'refusé'; end;
  insert into public.zz_res (nom, ok, vu) values ('un élève ne crée pas de classe', s = 'refusé', s);

  perform public.zz_comme(pa);
  cid := public.prof_creer_classe('ZZ 2nde 4', 'Seconde', 'Anglais');
  perform public.zz_root();
  select c.code into code1 from public.classes c where c.id = cid;
  insert into public.zz_res (nom, ok, vu) values ('code de 8 caractères sûrs',
    code1 ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$', code1);
  insert into public.zz_res (nom, ok, vu) values ('rattachée à l''établissement, prof principal',
    exists (select 1 from public.classes c join public.teachings t on t.class_id = c.id
            where c.id = cid and c.org_id = oa and t.teacher = pa and t.principal and t.subject = 'Anglais'), '');
  insert into public.zz_res (nom, ok, vu) values ('plus aucun code court dans la base',
    not exists (select 1 from public.classes where length(code) <> 8), '');

  -- ── la frontière d'établissement ──
  perform public.zz_comme(eb);
  select p.statut, p.nom into s, t from public.class_preview(code1) p;
  insert into public.zz_res (nom, ok, vu) values ('élève d''un autre lycée : refusé, rien de révélé',
    s = 'etablissement' and t = '', s || '/' || t);
  perform public.zz_comme(perso);
  select p.statut, p.nom into s, t from public.class_join(code1) p;
  insert into public.zz_res (nom, ok, vu) values ('compte personnel : refusé',
    s = 'etablissement' and t = '', s);

  -- ── aperçu puis salle d'attente ──
  perform public.zz_comme(e1);
  select p.statut, p.nom, p.prof into s, t, kcol from public.class_preview(lower(substr(code1, 1, 4)) || '-' || substr(code1, 5)) p;
  insert into public.zz_res (nom, ok, vu) values ('aperçu (code tapé en minuscules avec tiret)',
    s = 'apercu' and t = 'ZZ 2nde 4' and kcol = 'Mme Zed', s || '/' || t || '/' || kcol);
  select p.statut into s from public.class_join(code1) p;
  insert into public.zz_res (nom, ok, vu) values ('rejoindre → salle d''attente par défaut', s = 'attente', s);
  select p.statut into s from public.class_join(code1) p;
  insert into public.zz_res (nom, ok, vu) values ('redemander ne crée pas de doublon', s = 'attente', s);
  select count(*) into n from public.classes c where c.id = cid;
  insert into public.zz_res (nom, ok, vu) values ('l''élève ne lit pas la ligne de la classe (ni son code)', n = 0, n::text);
  select count(*) into n from public.class_members m where m.class_id = cid;
  insert into public.zz_res (nom, ok, vu) values ('en attente, il n''est pas inscrit', n = 0, n::text);
  begin
    insert into public.class_members (class_id, user_id, who) values (cid, e1, 'moi'); s := 'passé';
  exception when others then s := 'refusé'; end;
  insert into public.zz_res (nom, ok, vu) values ('il ne s''inscrit pas seul par l''API', s = 'refusé', s);

  perform public.zz_comme(pa2);
  select count(*) into n from public.prof_demandes(cid);
  insert into public.zz_res (nom, ok, vu) values ('un collègue hors de la classe ne voit pas les demandes', n = 0, n::text);
  begin perform public.prof_admettre(cid, array[e1]); s := 'passé';
  exception when others then s := 'refusé'; end;
  insert into public.zz_res (nom, ok, vu) values ('… ni ne les admet', s = 'refusé', s);
  perform public.zz_comme(rb);
  select count(*) into n from public.prof_demandes(cid);
  insert into public.zz_res (nom, ok, vu) values ('le référent d''un autre lycée ne voit rien', n = 0, n::text);
  perform public.zz_comme(ra);
  select count(*) into n from public.prof_demandes(cid);
  insert into public.zz_res (nom, ok, vu) values ('le référent du lycée voit la demande', n = 1, n::text);

  perform public.zz_comme(pa);
  select p.who into t from public.prof_demandes(cid) p;
  insert into public.zz_res (nom, ok, vu) values ('le nom affiché vient du profil, pas de l''app', t = 'Alice Zed', t);
  n := public.prof_admettre(cid, array[e1]);
  insert into public.zz_res (nom, ok, vu) values ('le prof admet', n = 1, n::text);
  perform public.zz_comme(e1);
  select p.statut into s from public.class_preview(code1) p;
  insert into public.zz_res (nom, ok, vu) values ('admis : « déjà inscrit »', s = 'deja', s);

  -- ── refuser et exclure ──
  perform public.zz_comme(e2);
  select p.statut into s from public.class_join(code1) p;
  perform public.zz_comme(pa);
  n := public.prof_refuser(cid, array[e2], true);
  perform public.zz_comme(e2);
  select p.statut into s from public.class_join(code1) p;
  insert into public.zz_res (nom, ok, vu) values ('refusé et exclu : il ne peut plus redemander', s = 'refuse' and n = 1, s);

  -- ── la limite d'essais ──
  perform public.zz_comme(e3);
  for n in 1..10 loop select p.statut into s from public.class_preview('ZZZZ' || lpad(n::text, 4, '2')) p; end loop;
  insert into public.zz_res (nom, ok, vu) values ('dix codes faux : « inconnu »', s = 'inconnu', s);
  select p.statut into s from public.class_preview(code1) p;
  insert into public.zz_res (nom, ok, vu) values ('au onzième, même le bon code est bloqué', s = 'trop', s);

  -- ── les réglages ──
  perform public.zz_comme(pa2);
  begin perform public.prof_reglages(cid, false, true, 40, -1); s := 'passé';
  exception when others then s := 'refusé'; end;
  insert into public.zz_res (nom, ok, vu) values ('un non-gestionnaire ne règle rien', s = 'refusé', s);
  perform public.zz_comme(pa);
  perform public.prof_reglages(cid, false, true, 40, -1);
  perform public.zz_comme(e4);
  select p.statut into s from public.class_preview(code1) p;
  insert into public.zz_res (nom, ok, vu) values ('inscriptions fermées', s = 'ferme', s);
  perform public.zz_comme(pa);
  perform public.prof_reglages(cid, true, true, 40, 60);
  perform public.zz_root();
  update public.classes set join_until = now() - interval '1 minute' where id = cid;
  perform public.zz_comme(e4);
  select p.statut into s from public.class_preview(code1) p;
  insert into public.zz_res (nom, ok, vu) values ('code expiré', s = 'expire', s);
  perform public.zz_comme(pa);
  perform public.prof_reglages(cid, true, false, 1, 0);
  perform public.zz_comme(e4);
  select p.statut into s from public.class_join(code1) p;
  insert into public.zz_res (nom, ok, vu) values ('classe complète', s = 'complet', s);
  perform public.zz_comme(pa);
  begin perform public.prof_reglages(cid, true, false, 0, 0); s := 'passé';
  exception when others then s := 'refusé'; end;
  insert into public.zz_res (nom, ok, vu) values ('pas moins de places que d''élèves', s = 'refusé', s);
  perform public.prof_reglages(cid, true, false, 40, 0);
  perform public.zz_comme(e4);
  select p.statut into s from public.class_join(code1) p;
  insert into public.zz_res (nom, ok, vu) values ('sans validation : inscrit d''office', s = 'inscrit', s);

  -- ── un code qui a fui se remplace ──
  perform public.zz_comme(pa);
  code2 := public.prof_nouveau_code(cid);
  perform public.zz_comme(e5);
  select p.statut into s from public.class_preview(code1) p;
  select p.statut into t from public.class_preview(code2) p;
  insert into public.zz_res (nom, ok, vu) values ('l''ancien code ne marche plus, le nouveau si',
    s = 'inconnu' and t = 'apercu' and code1 <> code2, s || '/' || t);

  -- ── qui lit la liste ──
  perform public.zz_comme(rb);
  select count(*) into n from public.prof_roster(cid);
  insert into public.zz_res (nom, ok, vu) values ('fuite inter-établissements fermée (référent B)', n = 0, n::text);
  perform public.zz_comme(pa2);
  select count(*) into n from public.prof_roster(cid);
  insert into public.zz_res (nom, ok, vu) values ('un prof ne lit que ses classes', n = 0, n::text);
  perform public.zz_comme(ra);
  select count(*) into n from public.prof_roster(cid);
  insert into public.zz_res (nom, ok, vu) values ('le référent du lycée lit la liste', n = 2, n::text);

  -- ── l'avancement, calculé par la base ──
  perform public.zz_comme(pa);
  n := public.prof_give(array[cid], 'ZZ Vocabulaire', 'Anglais', '[["cat","chat"],["dog","chien"]]'::jsonb,
                        current_date + 7);
  select a.id into aid from public.assignments a where a.class_id = cid;
  -- l'avancement ne s'écrit pas à la main
  perform public.zz_comme(e1);
  begin
    insert into public.assignment_progress (assignment_id, user_id, pct, done_at)
    values (aid, e1, 100, now()); s := 'passé';
  exception when others then s := 'refusé'; end;
  insert into public.zz_res (nom, ok, vu) values ('l''élève ne se déclare pas « rendu 100 % »', s = 'refusé', s);
  select o.cartes into j from public.eleve_ouvrir_devoir(aid) o;
  update public.assignment_progress set pct = 100, done_at = now() where assignment_id = aid and user_id = e1;
  get diagnostics n = row_count;
  insert into public.zz_res (nom, ok, vu) values ('… ni ne retouche la ligne ouverte', n = 0, n::text);
  select d.etat into s from public.eleve_devoirs() d where d.id = aid;
  insert into public.zz_res (nom, ok, vu) values ('ouvrir un devoir : cartes rendues, « commencé »',
    jsonb_array_length(j) = 2 and s = 'commence', s);
  perform public.zz_comme(e5);
  begin perform public.eleve_ouvrir_devoir(aid); s := 'passé';
  exception when others then s := 'refusé'; end;
  insert into public.zz_res (nom, ok, vu) values ('un non-inscrit n''ouvre pas le devoir', s = 'refusé', s);
  perform public.zz_comme(e1);
  insert into public.reviews (user_id, deck_id, card_id, mode, rating, correct)
  values (e1, gen_random_uuid(), 'a:' || aid || ':0', 'study', 2, true),
         (e1, gen_random_uuid(), 'a:' || aid || ':1', 'study', 0, false),
         (e1, gen_random_uuid(), 'a:' || aid || ':x', 'study', 0, false),
         (e1, gen_random_uuid(), 'a:' || aid || ':99', 'study', 0, false);
  perform public.zz_root();
  select ap.vus, round(ap.pct)::integer, ap.done_at is not null into n, kcol, b
  from public.assignment_progress ap where ap.assignment_id = aid and ap.user_id = e1;
  insert into public.zz_res (nom, ok, vu) values ('2 cartes revues sur 2 : rendu, 50 % (déchets ignorés)',
    n = 2 and kcol = '50' and b, n || '/' || kcol || '/' || b);
  perform public.zz_comme(e5);
  insert into public.reviews (user_id, deck_id, card_id, mode, rating, correct)
  values (e5, gen_random_uuid(), 'a:' || aid || ':0', 'study', 2, true);
  perform public.zz_root();
  insert into public.zz_res (nom, ok, vu) values ('une révision forgée hors classe ne crée rien',
    not exists (select 1 from public.assignment_progress where assignment_id = aid and user_id = e5), '');
  perform public.zz_comme(pa);
  select r.rendus, r.donnes, r.pct, r.pages7 into n, kcol, t, s from public.prof_roster(cid) r where r.user_id = e1;
  insert into public.zz_res (nom, ok, vu) values ('la fiche du prof : 1 rendu sur 1, 50 %, 4 pages de devoir',
    n = 1 and kcol = '1' and t = '50' and s = '4', n || '/' || kcol || '/' || t || '/' || s);

  -- ── les collègues ──
  perform public.zz_comme(pa);
  kcol := public.prof_code_collegue(cid, true);
  perform public.zz_comme(e5);
  select p.statut into s from public.class_join(kcol) p;
  insert into public.zz_res (nom, ok, vu) values ('un élève ne passe pas par le code collègue', s = 'role', s);
  perform public.zz_comme(pb);
  select p.statut into s from public.class_join(kcol) p;
  insert into public.zz_res (nom, ok, vu) values ('un prof d''un autre lycée non plus', s = 'etablissement', s);
  perform public.zz_comme(pa2);
  select p.statut into s from public.class_join(kcol) p;
  select count(*) into n from public.prof_equipe(cid);
  insert into public.zz_res (nom, ok, vu) values ('un collègue du lycée rejoint l''équipe', s = 'collegue' and n = 2, s || '/' || n);
  begin perform public.prof_retirer(cid, e1, false); s := 'passé';
  exception when others then s := 'refusé'; end;
  insert into public.zz_res (nom, ok, vu) values ('un co-enseignant ne retire pas d''élève', s = 'refusé', s);
  perform public.prof_quitter(cid);
  perform public.zz_comme(pa);
  select count(*) into n from public.prof_equipe(cid);
  insert into public.zz_res (nom, ok, vu) values ('il peut quitter une classe créée par un prof', n = 1, n::text);

  -- ── retirer, exclure ──
  perform public.zz_comme(pa);
  perform public.prof_retirer(cid, e4, true);
  perform public.zz_comme(e4);
  select p.statut into s from public.class_preview(code2) p;
  insert into public.zz_res (nom, ok, vu) values ('retiré et exclu : il ne revient pas', s = 'refuse', s);
  perform public.zz_comme(e1);
  begin perform public.eleve_quitter(cid); s := 'passé';
  exception when others then s := 'refusé'; end;
  insert into public.zz_res (nom, ok, vu) values ('on ne quitte pas une classe de son établissement', s = 'refusé', s);

  -- ── hors établissement ──
  perform public.zz_comme(pp);
  cid2 := public.prof_creer_classe('ZZ Soutien', '', 'Maths');
  perform public.zz_root();
  select c.code into kcol from public.classes c where c.id = cid2;
  perform public.zz_comme(e1);
  select p.statut into s from public.class_join(kcol) p;
  insert into public.zz_res (nom, ok, vu) values ('un compte scolaire n''entre pas dans une classe privée', s = 'etablissement', s);
  perform public.zz_comme(perso);
  select p.statut into s from public.class_join(kcol) p;
  perform public.zz_comme(pp);
  n := public.prof_admettre(cid2, array[perso]);
  perform public.prof_renommer_eleve(cid2, perso, 'Lucas M.');
  perform public.zz_comme(perso);
  select e.statut, e.peut_quitter into t, b from public.eleve_classes() e where e.class_id = cid2;
  insert into public.zz_res (nom, ok, vu) values ('compte personnel : attente, admis, peut quitter',
    s = 'attente' and n = 1 and t = 'inscrit' and b, s || '/' || n || '/' || t || '/' || b);
  perform public.eleve_quitter(cid2);
  select count(*) into n from public.eleve_classes();
  insert into public.zz_res (nom, ok, vu) values ('… et quitte', n = 0, n::text);
  perform public.zz_comme(pp);
  perform public.prof_reglages(cid2, true, false, 40, 0);
  perform public.zz_comme(perso);
  select count(*) into n from public.join_class(kcol, 'Nom forgé');
  perform public.zz_root();
  select m.who into t from public.class_members m where m.class_id = cid2 and m.user_id = perso;
  insert into public.zz_res (nom, ok, vu) values ('l''ancienne porte passe par les verrous et ignore le nom envoyé',
    n = 1 and t = 'Perso', n || '/' || coalesce(t, '∅'));

  -- ── archiver, supprimer ──
  perform public.zz_comme(pa);
  perform public.prof_archiver(cid, true);
  begin perform public.prof_give(array[cid], 'ZZ x', '', '[["a","b"]]'::jsonb, current_date + 1); s := 'passé';
  exception when others then s := 'refusé'; end;
  perform public.zz_comme(e5);
  select p.statut into t from public.class_preview(code2) p;
  insert into public.zz_res (nom, ok, vu) values ('archivée : ni devoir ni inscription', s = 'refusé' and t = 'archive', s || '/' || t);
  perform public.zz_comme(pa);
  begin perform public.prof_supprimer_classe(cid, 'mauvais nom'); s := 'passé';
  exception when others then s := 'refusé'; end;
  insert into public.zz_res (nom, ok, vu) values ('supprimer exige le nom retapé', s = 'refusé', s);
  perform public.zz_comme(ra);
  begin perform public.prof_supprimer_classe(cid, 'zz 2nde 4'); s := 'passé';
  exception when others then s := 'refusé'; end;
  insert into public.zz_res (nom, ok, vu) values ('seul le créateur supprime (pas même le référent)', s = 'refusé', s);
  perform public.zz_comme(pa);
  perform public.prof_supprimer_classe(cid, ' zz 2nde 4 ');
  perform public.zz_root();
  insert into public.zz_res (nom, ok, vu) values ('supprimée, avec tout ce qui en dépendait',
    not exists (select 1 from public.classes where id = cid)
    and not exists (select 1 from public.assignments where class_id = cid)
    and not exists (select 1 from public.class_bans where class_id = cid), '');

  -- ── les droits d'exécution ──
  insert into public.zz_res (nom, ok, vu) values ('anon n''appelle aucune fonction de classe',
    not has_function_privilege('anon', 'public.class_join(text)', 'execute')
    and not has_function_privilege('anon', 'public.prof_admettre(uuid, uuid[])', 'execute'), '');
  insert into public.zz_res (nom, ok, vu) values ('les fonctions internes sont fermées à l''app',
    not has_function_privilege('authenticated', 'public.class_verdict(text)', 'execute')
    and not has_function_privilege('authenticated', 'public.code_classe()', 'execute'), '');
end $$;

select n, ok, nom, vu from public.zz_res order by n;

rollback;
