-- Tests de la migration 20261025233000_codes_et_licences_d_etablissement :
-- créer un établissement, ses trois codes, les demandes et leur validation,
-- la licence (places, date de fin). Même mode que jetons.sql : transaction
-- ANNULÉE, comptes jetables, vrai rôle `authenticated`.

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
create function public.zz_leve(q text) returns text language plpgsql as $$
begin execute q; return null; exception when others then return sqlerrm; end $$;
grant execute on function public.zz_comme(uuid), public.zz_root(), public.zz_leve(text) to authenticated;

do $$
declare
  adm uuid := gen_random_uuid(); dir uuid := gen_random_uuid(); prof uuid := gen_random_uuid();
  emma uuid := gen_random_uuid(); lucas uuid := gen_random_uuid(); ines uuid := gen_random_uuid();
  autre uuid := gen_random_uuid(); u record;
  j jsonb; o uuid; o2 uuid; cref text; ce text; cp text; ce2 text; cid uuid; s text; n integer;
begin
  for u in select * from (values
      (adm, 'zzadmin', 'admin'), (dir, 'zzdir', null), (prof, 'zzprof', null), (emma, 'zzemma', null),
      (lucas, 'zzlucas', null), (ines, 'zzines', null), (autre, 'zzautre', null)) x(id, pseudo, role) loop
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

  -- ══════════ l'éditeur crée l'établissement ══════════
  perform public.zz_comme(emma);
  s := public.zz_leve('select public.admin_creer_etab(''ZZ Lycée Camus'')');
  insert into public.zz_res (nom, ok, vu) values ('un compte personnel ne crée pas d''établissement',
    s like '%Réservé à l''éditeur%', s);
  perform public.zz_comme(adm);
  j := public.admin_creer_etab('ZZ Lycée Camus', 'Nîmes', '0300021k', 'lycee', 2, null, 'essai');
  o := (j->>'id')::uuid; cref := j->>'code_ref';
  insert into public.zz_res (nom, ok, vu) values ('créé : un code référent de 8 caractères, valable 30 jours',
    cref ~ '^[A-HJKMNP-Z2-9]{8}$' and (j->>'ref_fin')::timestamptz > now() + interval '29 days', j::text);
  perform public.zz_root();
  select k.eleve, k.prof into ce, cp from public.org_codes k where k.org_id = o;
  insert into public.zz_res (nom, ok, vu) values ('codes élève et professeur posés, distincts, essai de 30 jours, UAI en majuscules',
    ce <> cp and ce <> cref and (select licence_fin = current_date + 30 and uai = '0300021K' and places = 2 from public.orgs where id = o),
    ce || ' ' || cp);
  perform public.zz_comme(adm);
  s := public.zz_leve('select public.admin_creer_etab(''ZZ X'', '''', ''12AB'')');
  insert into public.zz_res (nom, ok, vu) values ('UAI mal formée : refusée', s like '%7 chiffres%', s);

  -- ══════════ le référent entre avec son code ══════════
  perform public.zz_comme(dir);
  j := public.code_apercu(lower(substr(cref, 1, 4) || '-' || substr(cref, 5)));
  insert into public.zz_res (nom, ok, vu) values ('aperçu du code référent (casse et tiret ignorés)',
    j->>'type' = 'etab' and j->>'quel' = 'ref' and j->>'statut' = 'ok' and j->>'nom' = 'ZZ Lycée Camus', j::text);
  j := public.etab_demander(cref, 'marie', 'curie');
  insert into public.zz_res (nom, ok, vu) values ('code référent : admise tout de suite', j->>'statut' = 'admis', j::text);
  insert into public.zz_res (nom, ok, vu) values ('elle est référente de l''établissement, sous « Marie CURIE »',
    public.my_role() = 'ref' and public.my_org() = o
    and (select name from public.profiles where id = dir) = 'Marie CURIE', public.my_role());
  perform public.zz_comme(autre);
  j := public.code_apercu(cref);
  insert into public.zz_res (nom, ok, vu) values ('le code référent ne sert qu''une fois',
    j->>'type' = 'classe' and j->'fiche'->>'statut' = 'inconnu', j::text);

  -- ══════════ les codes restent fermés ══════════
  perform public.zz_comme(dir);
  select count(*) into n from public.org_codes;
  insert into public.zz_res (nom, ok, vu) values ('personne ne lit org_codes directement, pas même le référent', n = 0, n::text);
  j := public.ref_codes();
  insert into public.zz_res (nom, ok, vu) values ('le référent lit ses codes et sa licence par ref_codes()',
    j->>'eleve' = ce and j->>'prof' = cp and (j->>'places')::int = 2 and j->>'offre' = 'essai', j::text);

  -- ══════════ un professeur ══════════
  perform public.zz_comme(prof);
  j := public.code_apercu(cp);
  insert into public.zz_res (nom, ok, vu) values ('code professeur : aperçu', j->>'quel' = 'prof' and j->>'statut' = 'ok', j::text);
  j := public.etab_demander(cp, 'Jean', '');
  insert into public.zz_res (nom, ok, vu) values ('sans nom : refusé, rien n''est envoyé',
    j->>'statut' = 'nom' and public.ma_demande_etab() is null, j::text);
  j := public.etab_demander(cp, 'Jean', 'Moulin');
  insert into public.zz_res (nom, ok, vu) values ('avec son nom : en attente, il voit sa demande',
    j->>'statut' = 'attente' and public.ma_demande_etab()->>'org' = 'ZZ Lycée Camus'
    and public.ma_demande_etab()->>'quel' = 'prof', j::text);
  perform public.zz_comme(dir);
  perform public.ref_admettre(prof);
  perform public.zz_comme(prof);
  insert into public.zz_res (nom, ok, vu) values ('admis : professeur de l''établissement',
    public.my_role() = 'prof' and public.my_org() = o and public.ma_demande_etab() is null, public.my_role());
  cid := public.prof_creer_classe('ZZ 2nde B', '2nde', 'Histoire');

  -- ══════════ des élèves ══════════
  perform public.zz_comme(emma);
  j := public.etab_demander(ce, 'emma', 'durand', '2nde B');
  insert into public.zz_res (nom, ok, vu) values ('élève : en attente', j->>'statut' = 'attente', j::text);
  j := public.code_apercu(ce);
  insert into public.zz_res (nom, ok, vu) values ('retaper le code dit « en attente »', j->>'statut' = 'attente', j::text);
  perform public.zz_comme(lucas);
  perform public.etab_demander(ce, 'Lucas', 'Martin', '2nde B');
  perform public.zz_comme(ines);
  perform public.etab_demander(ce, 'Inès', 'Roux', '1re A');
  perform public.etab_annuler();
  insert into public.zz_res (nom, ok, vu) values ('elle annule sa demande', public.ma_demande_etab() is null, 'annulée');
  perform public.etab_demander(ce, 'Inès', 'Roux', '1re A');

  perform public.zz_comme(dir);
  select count(*) into n from public.ref_demandes();
  insert into public.zz_res (nom, ok, vu) values ('le référent voit les trois demandes d''élèves', n = 3, n::text);
  select count(*) into n from public.etab_demandes;
  insert into public.zz_res (nom, ok, vu) values ('et par la table, sous sa politique', n = 3, n::text);
  perform public.zz_comme(lucas);
  select count(*) into n from public.etab_demandes;
  insert into public.zz_res (nom, ok, vu) values ('un élève ne lit que la sienne', n = 1, n::text);

  perform public.zz_comme(dir);
  s := public.ref_admettre(emma, cid);
  perform public.zz_root();   -- relire en dehors de la RLS : un référent ne lit pas le profil d'un élève
  insert into public.zz_res (nom, ok, vu) values ('Emma admise dans sa classe, sous « Emma DURAND »',
    s = 'ok' and exists (select 1 from public.class_members m where m.class_id = cid and m.user_id = emma and m.who = 'Emma DURAND')
    and (select name from public.profiles where id = emma) = 'Emma DURAND', s);
  perform public.zz_comme(emma);
  update public.profiles set name = 'Emma la Reine' where id = emma;
  insert into public.zz_res (nom, ok, vu) values ('son nom est verrouillé', (select name from public.profiles where id = emma) = 'Emma DURAND',
    (select name from public.profiles where id = emma));
  insert into public.zz_res (nom, ok, vu) values ('elle est élève de l''établissement', public.my_org() = o and public.my_role() = 'eleve', 'org');

  perform public.zz_comme(dir);
  perform public.ref_admettre(lucas, cid);
  s := public.zz_leve('select public.ref_admettre(''' || ines || ''')');
  insert into public.zz_res (nom, ok, vu) values ('licence pleine (2 places) : refusée, avec la raison', s like '%Licence pleine%', s);
  perform public.zz_comme(adm);
  perform public.admin_licence(o, 30, current_date + 300, 'etablissement');
  perform public.zz_comme(dir);
  s := public.ref_admettre(ines);
  insert into public.zz_res (nom, ok, vu) values ('places ajoutées par l''éditeur : admise (sans classe)', s = 'ok', s);

  -- ══════════ refuser, changer un code ══════════
  perform public.zz_comme(autre);
  perform public.etab_demander(ce, 'Paul', 'Petit');
  perform public.zz_comme(dir);
  perform public.ref_refuser(autre);
  perform public.zz_comme(autre);
  insert into public.zz_res (nom, ok, vu) values ('refusé : sa demande s''en va, il n''entre pas',
    public.ma_demande_etab() is null and public.my_org() is null, 'refus');
  perform public.zz_comme(dir);
  ce2 := public.ref_nouveau_code('eleve');
  perform public.zz_comme(autre);
  j := public.code_apercu(ce);
  insert into public.zz_res (nom, ok, vu) values ('l''ancien code élève ne marche plus', j->>'type' = 'classe', j::text);
  j := public.code_apercu(ce2);
  insert into public.zz_res (nom, ok, vu) values ('le nouveau, si', j->>'type' = 'etab' and j->>'statut' = 'ok', j::text);

  -- ══════════ les frontières ══════════
  perform public.zz_comme(adm);
  j := public.admin_creer_etab('ZZ Collège Hugo', 'Lyon');
  o2 := (j->>'id')::uuid;
  perform public.zz_root();
  select k.eleve into ce from public.org_codes k where k.org_id = o2;
  insert into public.zz_res (nom, ok, vu) values ('deuxième établissement : préfixe libre, essai par défaut de 60 places',
    (select code from public.orgs where id = o2) <> (select code from public.orgs where id = o)
    and (select places = 60 and offre = 'essai' from public.orgs where id = o2), (select code from public.orgs where id = o2));
  perform public.zz_comme(emma);
  j := public.code_apercu(ce);
  insert into public.zz_res (nom, ok, vu) values ('une élève d''un lycée ne demande pas un autre établissement', j->>'statut' = 'autre', j::text);
  perform public.zz_comme(prof);
  j := public.code_apercu(ce);
  insert into public.zz_res (nom, ok, vu) values ('un professeur ne prend pas un code élève', j->>'statut' in ('role', 'autre'), j::text);
  perform public.zz_comme(dir);
  s := public.zz_leve('select public.ref_refuser(''' || autre || ''')');
  insert into public.zz_res (nom, ok, vu) values ('rien à refuser hors de ses demandes', s like '%n''existe plus%', s);
  perform public.zz_comme(autre);
  s := public.zz_leve('select public.ref_codes()');
  insert into public.zz_res (nom, ok, vu) values ('un compte personnel ne lit pas de codes', s like '%Réservé au référent%', s);
  s := public.zz_leve('select public.admin_licence(''' || o || ''', 9999, null, ''etablissement'')');
  insert into public.zz_res (nom, ok, vu) values ('ni ne règle une licence', s like '%Réservé à l''éditeur%', s);

  -- ══════════ licence échue ══════════
  perform public.zz_comme(adm);
  perform public.admin_licence(o2, 60, current_date - 1, 'etablissement');
  perform public.zz_comme(autre);
  j := public.code_apercu(ce);
  insert into public.zz_res (nom, ok, vu) values ('licence échue : le code ne fait plus entrer', j->>'statut' = 'licence', j::text);
  perform public.zz_comme(adm);
  select count(*) into n from public.admin_orgs() a where a.name like 'ZZ %' and a.offre is not null;
  insert into public.zz_res (nom, ok, vu) values ('l''éditeur voit les deux établissements et leur licence', n = 2, n::text);
  j := public.admin_code_ref(o);
  insert into public.zz_res (nom, ok, vu) values ('l''éditeur refait un code référent',
    exists (select 1 from public.admin_orgs() a where a.id = o and a.code_ref = j->>'code_ref'), j::text);

  -- ══════════ les essais comptent ══════════
  perform public.zz_comme(lucas);
  for n in 1..10 loop perform public.code_apercu('ZZZZ' || lpad(n::text, 4, '2')); end loop;
  j := public.code_apercu(ce2);
  insert into public.zz_res (nom, ok, vu) values ('dix codes faux dans l''heure : même un bon code attend', j->>'statut' = 'trop', j::text);

  perform public.zz_root();
  insert into public.zz_res (nom, ok, vu) values ('anon n''appelle aucune fonction, authenticated oui',
    not has_function_privilege('anon', 'public.code_apercu(text)', 'execute')
    and not has_function_privilege('anon', 'public.etab_demander(text, text, text, text)', 'execute')
    and not has_function_privilege('anon', 'public.admin_creer_etab(text, text, text, text, integer, date, text)', 'execute')
    and has_function_privilege('authenticated', 'public.code_apercu(text)', 'execute')
    and has_function_privilege('authenticated', 'public.ref_admettre(uuid, uuid)', 'execute'), 'droits');
  insert into public.zz_res (nom, ok, vu) values ('les outils internes ne s''appellent pas de l''extérieur',
    not has_function_privilege('authenticated', 'public.code_unique()', 'execute')
    and not has_function_privilege('authenticated', 'public.etab_verdict(uuid, text)', 'execute')
    and not has_function_privilege('authenticated', 'public.etab_du_code(text)', 'execute'), 'internes');
end $$;

select n, ok, nom, vu from public.zz_res order by n;
rollback;
