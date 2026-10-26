-- Tests de 20261025233000 + 20261026001000 (un seul code) : du prospect au
-- client, le code qui fait entrer tout de suite (élève, professeur,
-- référent, professeur particulier), la classe choisie, les groupes, la
-- licence. Même mode que jetons.sql : transaction ANNULÉE, comptes
-- jetables, vrais rôles `authenticated` et `anon`.

begin;

create table public.zz_res (n serial primary key, nom text, ok boolean, vu text);
grant all on public.zz_res to authenticated, anon;
grant all on sequence public.zz_res_n_seq to authenticated, anon;
create function public.zz_comme(u uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function public.zz_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
end $$;
create function public.zz_root() returns void language plpgsql as $$
begin perform set_config('role', 'postgres', true); end $$;
create function public.zz_leve(q text) returns text language plpgsql as $$
begin execute q; return null; exception when others then return sqlerrm; end $$;
grant execute on function public.zz_comme(uuid), public.zz_anon(), public.zz_root(), public.zz_leve(text) to authenticated, anon;

do $$
declare
  adm uuid := gen_random_uuid(); dir uuid := gen_random_uuid(); prof uuid := gen_random_uuid();
  emma uuid := gen_random_uuid(); lucas uuid := gen_random_uuid(); ines uuid := gen_random_uuid();
  tuteur uuid := gen_random_uuid(); paul uuid := gen_random_uuid(); zoe uuid := gen_random_uuid(); u record;
  j jsonb; o uuid; o2 uuid; cref text; ce text; cp text; ct text; c1 uuid; c2 uuid; g uuid; t2 uuid; s text; n integer;
begin
  for u in select * from (values
      (adm, 'zzadmin', 'admin'), (dir, 'zzdir', null), (prof, 'zzprof', null), (emma, 'zzemma', null),
      (lucas, 'zzlucas', null), (ines, 'zzines', null), (tuteur, 'zztuteur', 'prof'), (paul, 'zzpaul', null),
      (zoe, 'zzzoe', null)) x(id, pseudo, role) loop
    insert into auth.users (instance_id, id, aud, role, email)
    values ('00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', 'zz-' || u.id || '@exemple.invalid');
    insert into public.profiles (id, email, name, handle)
    values (u.id, 'zz-' || u.id || '@exemple.invalid', u.pseudo, u.pseudo)
    on conflict (id) do update set name = excluded.name, handle = excluded.handle;
    if u.role is not null then
      insert into public.user_roles (user_id, role) values (u.id, u.role)
      on conflict (user_id) do update set role = excluded.role;
    end if;
  end loop;

  -- ══════════ la prospection ══════════
  perform public.zz_comme(emma);
  s := public.zz_leve('select public.admin_etab_enregistrer(null, ''{"nom":"ZZ X"}''::jsonb)');
  insert into public.zz_res (nom, ok, vu) values ('un compte personnel ne crée pas d''établissement', s like '%Réservé à l''éditeur%', s);
  perform public.zz_comme(adm);
  o := public.admin_etab_enregistrer(null, jsonb_build_object('nom', 'ZZ Lycée Camus', 'ville', 'Nîmes', 'uai', '0300021k',
    'contact_nom', 'Mme Proviseure', 'contact_email', 'Direction@Camus.zz', 'eleves_estimes', '900',
    'budget_euros', '2500', 'besoins', jsonb_build_array('devoirs', 'ia')));
  select count(*) into n from public.admin_orgs() a
  where a.id = o and a.statut = 'prospect' and a.contact_email = 'direction@camus.zz' and a.eleves_estimes = 900
    and a.besoins = array['devoirs', 'ia'] and a.code_eleve is null and a.uai = '0300021K';
  insert into public.zz_res (nom, ok, vu) values ('un prospect : sa fiche, son contact, ses besoins, pas encore de code', n = 1, n::text);
  select count(*) into n from public.org_suivi;
  insert into public.zz_res (nom, ok, vu) values ('org_suivi ne se lit pas directement, pas même par l''éditeur', n = 0, n::text);

  perform public.zz_anon();
  s := public.demander_demo('ZZ Collège Hugo', 'Lyon', 'M. Principal', 'principal', 'Principal@Hugo.zz', '', 450, 'Pour nos 3e');
  insert into public.zz_res (nom, ok, vu) values ('sans compte, un établissement demande une démo', s = 'ok', s);
  s := public.demander_demo('ZZ Collège Hugo', 'Lyon', 'M. Principal', 'principal', 'principal@hugo.zz');
  insert into public.zz_res (nom, ok, vu) values ('la même adresse le même jour : une seule demande', s = 'deja', s);
  s := public.demander_demo('ZZ Y', 'Lyon', 'M. Y', '', 'pas-une-adresse');
  insert into public.zz_res (nom, ok, vu) values ('une adresse fausse : refusée', s = 'email', s);
  s := public.zz_leve('select public.code_apercu(''AAAA2222'')');
  insert into public.zz_res (nom, ok, vu) values ('anon ne tape pas de code', s like '%permission%', s);
  perform public.zz_comme(adm);
  select count(*) into n from public.admin_orgs() a where a.name = 'ZZ Collège Hugo' and a.source = 'demande'
    and a.statut = 'prospect' and a.message = 'Pour nos 3e' and a.eleves_estimes = 450;
  insert into public.zz_res (nom, ok, vu) values ('l''éditeur la voit arriver dans son suivi', n = 1, n::text);
  select a.id into o2 from public.admin_orgs() a where a.name = 'ZZ Collège Hugo';

  -- ══════════ la démo, en un geste ══════════
  j := public.admin_lancer_demo(o, 3, 30, true);
  cref := j->>'code_ref';
  perform public.zz_root();
  select k.eleve, k.prof into ce, cp from public.org_codes k where k.org_id = o;
  insert into public.zz_res (nom, ok, vu) values ('démo lancée : code référent, codes élève et professeur, 30 jours, 3 places',
    cref ~ '^[A-HJKMNP-Z2-9]{8}$' and ce is not null and cp is not null and ce <> cp
    and (select offre = 'demo' and places = 3 and licence_fin = current_date + 30 and exemples from public.orgs where id = o)
    and (select statut from public.org_suivi where org_id = o) = 'demo', j::text);

  -- ══════════ le référent ══════════
  perform public.zz_comme(dir);
  j := public.code_apercu(lower(substr(cref, 1, 4) || '-' || substr(cref, 5)));
  insert into public.zz_res (nom, ok, vu) values ('code référent : aperçu (casse et tiret ignorés)',
    j->>'type' = 'etab' and j->>'quel' = 'ref' and j->>'statut' = 'ok' and j->>'nom' = 'ZZ Lycée Camus', j::text);
  j := public.rejoindre(cref, 'marie', 'curie');
  insert into public.zz_res (nom, ok, vu) values ('il entre aussitôt, référent, sous « Marie CURIE »',
    j->>'statut' = 'ok' and public.my_role() = 'ref' and public.my_org() = o
    and (select name from public.profiles where id = dir) = 'Marie CURIE', j::text);
  select count(*) into n from public.classes c where c.org_id = o and c.genre = 'classe' and c.name like '%exemple';
  insert into public.zz_res (nom, ok, vu) values ('les trois classes d''exemple apparaissent', n = 3, n::text);
  perform public.zz_comme(zoe);
  j := public.code_apercu(cref);
  insert into public.zz_res (nom, ok, vu) values ('le code référent ne sert qu''une fois', j->>'type' = 'classe', j::text);

  -- ══════════ un professeur : pas de file d'attente ══════════
  perform public.zz_comme(prof);
  j := public.rejoindre(cp, 'Jean', '');
  insert into public.zz_res (nom, ok, vu) values ('sans nom : refusé', j->>'statut' = 'nom', j::text);
  j := public.rejoindre(cp, 'jean', 'moulin');
  insert into public.zz_res (nom, ok, vu) values ('avec son nom : professeur de l''établissement, tout de suite',
    j->>'statut' = 'ok' and public.my_role() = 'prof' and public.my_org() = o, j::text);

  -- ══════════ des élèves : le code, le nom, la classe ══════════
  perform public.zz_comme(emma);
  j := public.code_apercu(ce);
  insert into public.zz_res (nom, ok, vu) values ('code élève : la liste des classes à choisir',
    j->>'quel' = 'eleve' and jsonb_array_length(j->'classes') = 3, j::text);
  c1 := (j->'classes'->0->>'id')::uuid; c2 := (j->'classes'->1->>'id')::uuid;
  j := public.rejoindre(ce, 'emma', 'durand');
  insert into public.zz_res (nom, ok, vu) values ('sans classe alors qu''il y en a : il faut choisir', j->>'statut' = 'choisir', j::text);
  j := public.rejoindre(ce, 'emma', 'durand', o2);
  insert into public.zz_res (nom, ok, vu) values ('une classe qui n''est pas d''ici : refusée', j->>'statut' = 'classe', j::text);
  j := public.rejoindre(ce, 'emma', 'durand', c1);
  insert into public.zz_res (nom, ok, vu) values ('Emma entre dans sa classe, sous « Emma DURAND »',
    j->>'statut' = 'ok' and exists (select 1 from public.class_members m where m.class_id = c1 and m.user_id = emma
    and m.who = 'Emma DURAND') and public.my_org() = o, j::text);
  update public.profiles set name = 'Emma la Reine' where id = emma;
  insert into public.zz_res (nom, ok, vu) values ('son nom est figé', (select name from public.profiles where id = emma) = 'Emma DURAND',
    (select name from public.profiles where id = emma));
  j := public.code_apercu(ce);
  insert into public.zz_res (nom, ok, vu) values ('retaper le code : déjà dedans', j->>'statut' = 'deja', j::text);
  perform public.zz_comme(lucas);
  perform public.rejoindre(ce, 'Lucas', 'Martin', c1);
  perform public.zz_comme(ines);
  j := public.rejoindre(ce, 'Inès', 'Roux', c2);
  insert into public.zz_res (nom, ok, vu) values ('trois places : la troisième élève entre encore', j->>'statut' = 'ok', j::text);
  perform public.zz_comme(paul);
  j := public.code_apercu(ce);
  insert into public.zz_res (nom, ok, vu) values ('la 4e personne voit « plein »', j->>'statut' = 'plein', j::text);

  -- ══════════ le professeur choisit ses classes, forme un groupe ══════════
  perform public.zz_comme(prof);
  select count(*) into n from public.prof_classes_etab() x where not x.enseigne;
  insert into public.zz_res (nom, ok, vu) values ('le professeur voit les classes de l''établissement', n = 3, n::text);
  perform public.prof_enseigner(c1, true, 'Histoire');
  insert into public.zz_res (nom, ok, vu) values ('il prend la sienne, avec sa matière',
    exists (select 1 from public.prof_classes_etab() x where x.id = c1 and x.enseigne and x.matiere = 'Histoire'), 'enseigne');
  select count(*) into n from public.prof_eleves_etab('dur');
  insert into public.zz_res (nom, ok, vu) values ('il cherche un élève de l''établissement (sans casse ni accent)', n = 1, n::text);
  g := public.prof_groupe('Spé HGGSP', array[emma, ines, dir]);
  select count(*) into n from public.class_members m where m.class_id = g;
  insert into public.zz_res (nom, ok, vu) values ('un groupe de deux élèves de classes différentes (pas le référent)', n = 2, n::text);
  perform public.zz_comme(emma);
  select count(*) into n from public.eleve_classes() x where x.genre in ('classe', 'groupe');
  insert into public.zz_res (nom, ok, vu) values ('Emma voit sa classe et son groupe', n = 2, n::text);
  s := public.zz_leve('select public.prof_groupe(''Pirate'', array[''' || emma || '''::uuid])');
  insert into public.zz_res (nom, ok, vu) values ('un élève ne forme pas de groupe', s like '%Réservé aux professeurs%', s);

  -- ══════════ seul le référent corrige ══════════
  perform public.zz_comme(dir);
  perform public.ref_move_student(emma, c2);
  perform public.zz_root();
  insert into public.zz_res (nom, ok, vu) values ('changer Emma de classe ne la sort pas de son groupe',
    exists (select 1 from public.class_members m where m.class_id = c2 and m.user_id = emma)
    and not exists (select 1 from public.class_members m where m.class_id = c1 and m.user_id = emma)
    and exists (select 1 from public.class_members m where m.class_id = g and m.user_id = emma), 'groupe gardé');
  perform public.zz_comme(dir);
  perform public.ref_update_account(emma, 'Emma DURAND-LEROY');
  perform public.zz_root();
  insert into public.zz_res (nom, ok, vu) values ('le référent corrige son nom', (select name from public.profiles where id = emma) = 'Emma DURAND-LEROY', 'nom');
  perform public.zz_comme(dir);
  j := public.ref_codes();
  insert into public.zz_res (nom, ok, vu) values ('le référent lit ses codes, sa licence, ses effectifs',
    j->>'eleve' = ce and (j->>'eleves')::int = 3 and (j->>'profs')::int = 1, j::text);
  select count(*) into n from public.ref_classes() x where x.genre = 'groupe';
  insert into public.zz_res (nom, ok, vu) values ('il voit aussi les groupes des professeurs', n = 1, n::text);

  -- ══════════ un professeur particulier : son code ══════════
  perform public.zz_comme(prof);
  s := public.zz_leve('select public.prof_mon_code()');
  insert into public.zz_res (nom, ok, vu) values ('un professeur d''établissement n''a pas de code personnel', s like '%hors établissement%', s);
  perform public.zz_comme(tuteur);
  ct := public.prof_mon_code();
  insert into public.zz_res (nom, ok, vu) values ('le professeur particulier a son code, le même à chaque fois',
    ct ~ '^[A-HJKMNP-Z2-9]{8}$' and public.prof_mon_code() = ct, ct);
  perform public.zz_comme(zoe);
  j := public.code_apercu(ct);
  insert into public.zz_res (nom, ok, vu) values ('aperçu : son nom, pas encore de classe', j->>'type' = 'prof' and j->>'statut' = 'ok'
    and j->>'nom' = 'zztuteur' and jsonb_array_length(j->'classes') = 0, j::text);
  j := public.rejoindre(ct, 'Zoé', 'Blanc');
  insert into public.zz_res (nom, ok, vu) values ('sa première élève : une classe « Mes élèves » l''attend',
    j->>'statut' = 'ok' and j->>'classe' = 'Mes élèves', j::text);
  insert into public.zz_res (nom, ok, vu) values ('elle reste un compte personnel, son nom ne bouge pas',
    public.my_org() is null and (select name from public.profiles where id = zoe) = 'zzzoe', 'perso');
  perform public.zz_comme(emma);
  j := public.rejoindre(ct, 'Emma', 'Durand');
  insert into public.zz_res (nom, ok, vu) values ('une élève d''un lycée suit aussi un professeur particulier', j->>'statut' = 'ok', j::text);
  perform public.zz_comme(tuteur);
  t2 := public.prof_creer_classe('Maths Tle', 'Tle', 'Maths');
  perform public.prof_ajouter_eleve(t2, zoe);
  perform public.zz_root();
  insert into public.zz_res (nom, ok, vu) values ('il range Zoé dans une deuxième classe',
    exists (select 1 from public.class_members m where m.class_id = t2 and m.user_id = zoe and m.who = 'Zoé BLANC'), 'rangée');
  perform public.zz_comme(paul);
  j := public.rejoindre(ct, 'Paul', 'Petit');
  insert into public.zz_res (nom, ok, vu) values ('deux classes : il faut choisir', j->>'statut' = 'choisir', j::text);
  j := public.rejoindre(ct, 'Paul', 'Petit', t2);
  insert into public.zz_res (nom, ok, vu) values ('il choisit, il entre', j->>'statut' = 'ok' and j->>'classe' = 'Maths Tle', j::text);
  perform public.zz_comme(tuteur);
  j := public.code_apercu(ct);
  insert into public.zz_res (nom, ok, vu) values ('le professeur ne prend pas son propre code', j->>'statut' = 'soi', j::text);

  -- ══════════ la licence ══════════
  perform public.zz_comme(adm);
  perform public.admin_licence(o, 900, current_date + 300, 'etablissement');
  insert into public.zz_res (nom, ok, vu) values ('passer en licence fait du prospect un client',
    exists (select 1 from public.admin_orgs() a where a.id = o and a.statut = 'client' and a.places = 900), 'client');
  perform public.zz_comme(paul);
  j := public.code_apercu(ce);
  insert into public.zz_res (nom, ok, vu) values ('des places ajoutées : Paul peut entrer', j->>'statut' = 'ok', j::text);
  perform public.zz_comme(adm);
  perform public.admin_licence(o, 900, current_date - 1, 'etablissement');
  perform public.zz_comme(paul);
  j := public.code_apercu(ce);
  insert into public.zz_res (nom, ok, vu) values ('licence échue : le code ne fait plus entrer', j->>'statut' = 'licence', j::text);
  perform public.zz_comme(adm);
  s := public.zz_leve('select public.admin_supprimer_etab(''' || o || ''')');
  insert into public.zz_res (nom, ok, vu) values ('on n''efface pas un établissement qui a des comptes', s like '%Des comptes%', s);
  perform public.admin_supprimer_etab(o2);
  insert into public.zz_res (nom, ok, vu) values ('on efface un prospect, son contact avec',
    not exists (select 1 from public.admin_orgs() a where a.id = o2), 'effacé');

  -- ══════════ les essais, les droits ══════════
  perform public.zz_comme(lucas);
  for n in 1..10 loop perform public.code_apercu('ZZZZ' || lpad(n::text, 4, '2')); end loop;
  j := public.code_apercu(ct);
  insert into public.zz_res (nom, ok, vu) values ('dix codes faux dans l''heure : même un bon code attend', j->>'statut' = 'trop', j::text);
  perform public.zz_root();
  insert into public.zz_res (nom, ok, vu) values ('anon : la demande de démo seulement',
    has_function_privilege('anon', 'public.demander_demo(text, text, text, text, text, text, integer, text)', 'execute')
    and not has_function_privilege('anon', 'public.rejoindre(text, text, text, uuid)', 'execute')
    and not has_function_privilege('anon', 'public.admin_lancer_demo(uuid, integer, integer, boolean)', 'execute'), 'anon');
  insert into public.zz_res (nom, ok, vu) values ('les outils internes ne s''appellent pas de l''extérieur',
    not has_function_privilege('authenticated', 'public.code_unique()', 'execute')
    and not has_function_privilege('authenticated', 'public.prof_verdict(uuid)', 'execute')
    and not has_function_privilege('authenticated', 'public.poser_exemples(uuid, uuid)', 'execute')
    and not has_function_privilege('authenticated', 'public.org_prefixe(text)', 'execute'), 'internes');
end $$;

select n, ok, nom, vu from public.zz_res order by n;
rollback;
