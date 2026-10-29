-- Tests de 20261029090000 (et de son correctif 20261029091000) : le parcours
-- d'un professeur particulier, de son compte ouvert par l'éditeur à ses
-- élèves acceptés ou refusés. Même mode que abonnements.sql : transaction
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
grant execute on function public.zz_comme(uuid), public.zz_root() to authenticated;

do $$
declare
  adm uuid := gen_random_uuid(); lea uuid := gen_random_uuid(); tom uuid := gen_random_uuid();
  ana uuid := gen_random_uuid(); col uuid := gen_random_uuid(); oa uuid := gen_random_uuid();
  ref uuid := gen_random_uuid();
  mira uuid; u record; j jsonb; n integer; refus text; code text; cid uuid; t text;
begin
  for u in select * from (values (adm, 'zzadmpp'), (lea, 'zzleapp'), (tom, 'zztompp'), (ana, 'zzanapp'),
                                 (col, 'zzcolpp'), (ref, 'zzrefpp')) x(id, pseudo) loop
    insert into auth.users (instance_id, id, aud, role, email)
    values ('00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', 'zz-' || u.id || '@exemple.invalid');
    insert into public.profiles (id, email, name, handle)
    values (u.id, 'zz-' || u.id || '@exemple.invalid', u.pseudo, u.pseudo)
    on conflict (id) do update set name = excluded.name, handle = excluded.handle;
  end loop;
  insert into public.user_roles (user_id, role) values (adm, 'admin'), (lea, 'eleve'), (tom, 'eleve'),
    (ana, 'eleve'), (col, 'prof'), (ref, 'ref')
    on conflict (user_id) do update set role = excluded.role;

  -- ══════════ l'éditeur ouvre le compte du professeur ══════════
  perform public.zz_comme(lea);
  begin perform public.admin_creer_compte('zz-mira@exemple.invalid', 'Lucie Mira', 'prof', 'provisoire-123');
        refus := 'passe';
  exception when others then refus := sqlstate; end;
  insert into public.zz_res (nom, ok, vu) values ('un élève n''ouvre pas de compte', refus = '42501', refus);

  perform public.zz_comme(adm);
  mira := public.admin_creer_compte('ZZ-Mira@Exemple.invalid ', 'Lucie Mira', 'prof', 'provisoire-123');
  perform public.zz_root();
  select r.role into t from public.user_roles r where r.user_id = mira;
  insert into public.zz_res (nom, ok, vu) values ('compte ouvert : professeur, adresse en minuscules, pseudo d''office',
    t = 'prof' and exists (select 1 from auth.users x where x.id = mira and x.email = 'zz-mira@exemple.invalid')
    and exists (select 1 from public.profiles p where p.id = mira and p.handle is not null and p.name = 'Lucie Mira'), t);
  insert into public.zz_res (nom, ok, vu) values ('il se connecte avec ce mot de passe',
    exists (select 1 from auth.users x where x.id = mira
            and x.encrypted_password = extensions.crypt('provisoire-123', x.encrypted_password)), 'crypt');
  perform public.zz_comme(adm);
  begin perform public.admin_creer_compte('zz-mira@exemple.invalid', 'Lucie Mira', 'prof', 'provisoire-123');
        refus := 'passe';
  exception when others then refus := sqlerrm; end;
  insert into public.zz_res (nom, ok, vu) values ('une adresse déjà prise est refusée', refus like '%déjà un compte%', refus);
  begin perform public.admin_creer_compte('zz-court@exemple.invalid', 'Court', 'prof', 'court');
        refus := 'passe';
  exception when others then refus := sqlerrm; end;
  insert into public.zz_res (nom, ok, vu) values ('un mot de passe trop court est refusé', refus like '%dix caractères%', refus);

  perform public.zz_comme(mira);
  select x.provisoire into n from (select (provisoire)::int as provisoire from public.mon_compte()) x;
  insert into public.zz_res (nom, ok, vu) values ('à la première connexion : mot de passe à choisir', n = 1, n::text);
  perform public.zz_root();
  update auth.users set encrypted_password = extensions.crypt('le-sien-a-lui', extensions.gen_salt('bf')) where id = mira;
  perform public.zz_comme(mira);
  select (provisoire)::int into n from public.mon_compte();
  insert into public.zz_res (nom, ok, vu) values ('son mot de passe changé, plus rien à choisir', n = 0, n::text);
  perform public.zz_comme(adm);
  perform public.admin_mdp(mira, 'nouveau-provisoire');
  perform public.zz_comme(mira);
  select (provisoire)::int into n from public.mon_compte();
  insert into public.zz_res (nom, ok, vu) values ('un mot de passe refait par l''éditeur est provisoire', n = 1, n::text);

  -- ══════════ la licence ══════════
  perform public.zz_comme(mira);
  j := public.prof_licence();
  insert into public.zz_res (nom, ok, vu) values ('sans licence : rien', j is null, coalesce(j::text, 'null'));
  j := public.mon_offre();
  insert into public.zz_res (nom, ok, vu) values ('sans licence : pas de Campus', j->>'offre' <> 'campus', j::text);
  perform public.zz_comme(adm);
  begin perform public.admin_prof_licence(lea, 5, 50, 0, null); refus := 'passe';
  exception when others then refus := sqlerrm; end;
  insert into public.zz_res (nom, ok, vu) values ('une licence de professeur, pas pour un élève', refus like '%pas professeur%', refus);
  perform public.admin_prof_licence(mira, 2, 120, 15, current_date + 300);
  perform public.zz_comme(mira);
  j := public.prof_licence();
  insert into public.zz_res (nom, ok, vu) values ('la licence : 2 places, 120 IA pour lui, 15 par élève',
    (j->>'places')::int = 2 and (j->>'prises')::int = 0 and (j->>'ia_prof')::int = 120 and (j->>'ia_eleve')::int = 15, j::text);
  j := public.mon_offre();
  insert into public.zz_res (nom, ok, vu) values ('le professeur sous licence : Campus, sans « professeur » pour lui',
    j->>'offre' = 'campus' and j->'professeur' = 'null'::jsonb, j::text);
  code := public.prof_mon_code(false);

  -- ══════════ les élèves entrent : la salle d'attente ══════════
  perform public.zz_comme(lea);
  j := public.code_apercu(code);
  insert into public.zz_res (nom, ok, vu) values ('l''aperçu : ce professeur, statut ok', j->>'type' = 'prof' and j->>'statut' = 'ok'
    and j->>'nom' = 'Lucie Mira', j::text);
  j := public.rejoindre(code, 'léa', 'martin', null);
  insert into public.zz_res (nom, ok, vu) values ('Léa entre le code : en attente', j->>'statut' = 'attente'
    and j->>'classe' = 'Mes élèves', j::text);
  j := public.mon_offre();
  insert into public.zz_res (nom, ok, vu) values ('en attente : Campus déjà, le nom du professeur',
    j->>'offre' = 'campus' and j->>'professeur' = 'Lucie Mira', j::text);
  j := public.rejoindre(code, 'Léa', 'Martin', null);
  insert into public.zz_res (nom, ok, vu) values ('entrer deux fois : toujours en attente', j->>'statut' = 'attente', j::text);
  select count(*) into n from public.eleve_classes() e where e.statut = 'attente';
  insert into public.zz_res (nom, ok, vu) values ('Léa voit sa demande', n = 1, n::text);
  perform public.zz_comme(tom);
  j := public.rejoindre(code, 'Tom', 'Durand', null);
  insert into public.zz_res (nom, ok, vu) values ('Tom aussi', j->>'statut' = 'attente', j::text);
  perform public.zz_comme(ana);
  j := public.code_apercu(code);
  insert into public.zz_res (nom, ok, vu) values ('deux places, deux demandes : Ana trouve la licence pleine', j->>'statut' = 'plein', j::text);
  j := public.rejoindre(code, 'Ana', 'Petit', null);
  insert into public.zz_res (nom, ok, vu) values ('et ne passe pas', j->>'statut' = 'plein', j::text);
  perform public.zz_comme(col);
  j := public.rejoindre(code, 'Paul', 'Collègue', null);
  insert into public.zz_res (nom, ok, vu) values ('un professeur n''entre pas en élève', j->>'statut' = 'role', j::text);

  perform public.zz_comme(mira);
  j := public.prof_licence();
  insert into public.zz_res (nom, ok, vu) values ('chez le professeur : 2 prises, dont 2 en attente',
    (j->>'prises')::int = 2 and (j->>'attente')::int = 2 and (j->>'inscrits')::int = 0, j::text);
  select c.id into cid from public.classes c where c.owner = mira;
  select count(*) into n from public.prof_demandes(cid);
  insert into public.zz_res (nom, ok, vu) values ('la salle d''attente montre les deux', n = 2, n::text);
  select p.who into t from public.prof_demandes(cid) p where p.user_id = lea;
  insert into public.zz_res (nom, ok, vu) values ('sous le nom donné, écrit proprement', t = 'Léa MARTIN', t);

  -- ══════════ refuser rend la place ; accepter la garde ══════════
  n := public.prof_refuser(cid, array[lea], false);
  perform public.zz_root();
  insert into public.zz_res (nom, ok, vu) values ('Léa refusée : un mot dans son courrier',
    n = 1 and exists (select 1 from public.mail m where m.to_user = lea and m.from_user = mira and m.message like '%pas validé%'
                      and m.cards = '[]'::jsonb), n::text);
  perform public.zz_comme(lea);
  j := public.mon_offre();
  insert into public.zz_res (nom, ok, vu) values ('refusée : plus de Campus', j->>'offre' <> 'campus', j::text);
  perform public.zz_comme(mira);
  n := public.prof_admettre(cid, array[tom]);
  j := public.prof_licence();
  insert into public.zz_res (nom, ok, vu) values ('Tom accepté : 1 inscrit, 1 place prise',
    n = 1 and (j->>'inscrits')::int = 1 and (j->>'prises')::int = 1 and (j->>'attente')::int = 0, j::text);
  perform public.zz_comme(tom);
  j := public.mon_offre();
  select count(*) into n from public.eleve_classes() e where e.statut = 'inscrit';
  insert into public.zz_res (nom, ok, vu) values ('Tom dans la classe, en Campus', j->>'offre' = 'campus' and n = 1, j::text);
  perform public.zz_comme(lea);
  j := public.rejoindre(code, 'Léa', 'Martin', null);
  insert into public.zz_res (nom, ok, vu) values ('Léa recommence : la place rendue l''attend', j->>'statut' = 'attente', j::text);
  perform public.zz_comme(ana);
  j := public.rejoindre(code, 'Ana', 'Petit', null);
  insert into public.zz_res (nom, ok, vu) values ('Ana, elle, trouve toujours plein', j->>'statut' = 'plein', j::text);

  -- ══════════ des places en plus ══════════
  perform public.zz_comme(mira);
  perform public.prof_commander(10, 'Une nouvelle classe en janvier');
  perform public.zz_comme(adm);
  select a.demande_places into n from public.admin_profs() a where a.id = mira;
  insert into public.zz_res (nom, ok, vu) values ('l''éditeur voit la demande', n = 10, n::text);
  perform public.admin_prof_licence(mira, 12, 120, 15, current_date + 300);
  select count(*) into n from public.admin_profs() a where a.id = mira and a.demande_places is null and a.places = 12;
  insert into public.zz_res (nom, ok, vu) values ('licence changée : la demande est traitée', n = 1, n::text);
  perform public.zz_comme(ana);
  j := public.rejoindre(code, 'Ana', 'Petit', null);
  insert into public.zz_res (nom, ok, vu) values ('avec des places en plus, Ana entre', j->>'statut' = 'attente', j::text);
  perform public.zz_comme(tom);
  begin perform public.prof_commander(10, ''); refus := 'passe';
  exception when others then refus := sqlerrm; end;
  insert into public.zz_res (nom, ok, vu) values ('un élève ne commande pas de places', refus like '%professeurs particuliers%', refus);

  -- ══════════ l'IA ══════════
  perform public.zz_root();
  insert into public.zz_res (nom, ok, vu) values ('le quota IA : 120 pour lui, 15 pour un élève inscrit ou en attente, nul ailleurs',
    public.ia_quota(mira) = 120 and public.ia_quota(tom) = 15 and public.ia_quota(ana) = 15 and public.ia_quota(adm) is null,
    concat_ws(' ', public.ia_quota(mira), public.ia_quota(tom), public.ia_quota(ana), public.ia_quota(adm)));

  -- ══════════ la licence finit ══════════
  update public.prof_licences set fin = current_date - 1 where prof = mira;
  perform public.zz_comme(tom);
  j := public.mon_offre();
  insert into public.zz_res (nom, ok, vu) values ('licence finie : l''élève perd Campus', j->>'offre' <> 'campus', j::text);
  perform public.zz_comme(mira);
  begin perform public.prof_admettre(cid, array[ana]); refus := 'passe';
  exception when others then refus := sqlerrm; end;
  insert into public.zz_res (nom, ok, vu) values ('licence finie : accepter est refusé', refus like '%licence%', refus);
  perform public.zz_comme(ana);
  perform public.eleve_annuler(cid);
  j := public.code_apercu(code);
  insert into public.zz_res (nom, ok, vu) values ('licence finie : le code le dit', j->>'statut' = 'licence', j::text);

  -- ══════════ un établissement : le référent prend une place ══════════
  perform public.zz_root();
  insert into public.orgs (id, code, name, offre, places, licence_fin) values (oa, 'ZZPP', 'Lycée Mira', 'etablissement', 1, current_date + 100);
  insert into public.org_members (user_id, org_id) values (ref, oa);
  insert into public.zz_res (nom, ok, vu) values ('une place, prise par le référent : plus rien de libre',
    public.etab_places_prises(oa) = 1 and public.etab_libres(oa) = 0, public.etab_libres(oa)::text);

  -- ══════════ ce que personne ne fait à la main ══════════
  perform public.zz_comme(tom);
  select count(*) into n from public.prof_licences;
  insert into public.zz_res (nom, ok, vu) values ('un élève ne lit pas la licence du professeur', n = 0, n::text);
  begin insert into public.demandes_places (prof, places) values (tom, 3); refus := 'passe';
  exception when others then refus := sqlstate; end;
  insert into public.zz_res (nom, ok, vu) values ('ni n''écrit une demande à la main', refus = '42501', refus);
  begin delete from public.mdp_provisoires where user_id = mira; get diagnostics n = row_count; refus := n::text;
  exception when others then refus := sqlstate; end;
  insert into public.zz_res (nom, ok, vu) values ('ni n''efface le mot de passe provisoire d''un autre', refus in ('0', '42501'), refus);
  perform public.zz_comme(mira);
  begin update public.prof_licences set places = 999 where prof = mira; refus := 'passe';
  exception when others then refus := sqlstate; end;
  insert into public.zz_res (nom, ok, vu) values ('le professeur ne s''ajoute pas de places', refus = '42501', refus);
  perform public.zz_root();

  -- ══════════ les droits ══════════
  insert into public.zz_res (nom, ok, vu) values ('ouvertes aux comptes connectés, jamais à anon',
    has_function_privilege('authenticated', 'public.admin_creer_compte(text, text, text, text)', 'execute')
    and not has_function_privilege('anon', 'public.admin_creer_compte(text, text, text, text)', 'execute')
    and not has_function_privilege('anon', 'public.prof_licence()', 'execute')
    and not has_function_privilege('anon', 'public.prof_commander(integer, text)', 'execute')
    and not has_function_privilege('anon', 'public.admin_prof_licence(uuid, integer, integer, integer, date)', 'execute'), 'droits');
  insert into public.zz_res (nom, ok, vu) values ('internes : compte_ouvrir, mdp_provisoire, ia_quota, campus_prof, licence_prof',
    not has_function_privilege('authenticated', 'public.compte_ouvrir(text, text, text)', 'execute')
    and not has_function_privilege('authenticated', 'public.mdp_provisoire(uuid)', 'execute')
    and not has_function_privilege('authenticated', 'public.ia_quota(uuid)', 'execute')
    and not has_function_privilege('authenticated', 'public.campus_prof(uuid)', 'execute')
    and not has_function_privilege('authenticated', 'public.licence_prof(uuid)', 'execute')
    and has_function_privilege('service_role', 'public.ia_quota(uuid)', 'execute'), 'droits');
  insert into public.zz_res (nom, ok, vu) values ('la carte élève n''existe plus',
    not exists (select 1 from pg_proc where proname in ('prof_creer_eleves', 'prof_nouvelles_cartes', 'creer_compte_eleve',
                                                         'identifiant_libre', 'prof_supprimer_eleve')), 'cartes');
  insert into public.zz_res (nom, ok, vu) values ('plus un mot « Folio » dans les messages de la base',
    not exists (select 1 from pg_proc p join pg_namespace s on s.oid = p.pronamespace
                where s.nspname = 'public' and p.prosrc like '%Folio%'), 'Mirandola');
end $$;

select n, ok, nom, vu from public.zz_res order by n;
rollback;
