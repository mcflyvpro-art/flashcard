-- Tests de la migration 20261024125435_un_eleve_sappelle_prenom_nom : comptes à
-- carte, nom imposé et verrouillé, rejoindre avec son vrai nom. Même mode
-- que classes_securisees.sql : transaction ANNULÉE, comptes jetables, vrai
-- rôle `authenticated`.

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
  oa uuid := gen_random_uuid(); pa uuid := gen_random_uuid(); pa2 uuid := gen_random_uuid();
  pp uuid := gen_random_uuid(); perso uuid := gen_random_uuid();
  cid uuid; cid2 uuid; cid3 uuid; code1 text; code3 text; s text; t text; n integer; b boolean;
  alice uuid; bob uuid; ident text; secret text; secret2 text; hash1 text; hash2 text; u record;
begin
  insert into public.orgs (id, code, name) values (oa, 'ZZA', 'Lycée Zed');
  for u in select * from (values (pa, 'prof', oa, 'Mme Zed'), (pa2, 'prof', oa, 'M. Autre'),
      (pp, 'prof', null, 'Mme Libre'), (perso, 'eleve', null, 'Batman du 93')) x(id, role, org, nom) loop
    insert into auth.users (instance_id, id, aud, role, email)
    values ('00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', 'zz-' || u.id || '@exemple.invalid');
    insert into public.profiles (id, email, name, handle)
    values (u.id, 'zz-' || u.id || '@exemple.invalid', u.nom, 'zz' || substr(u.id::text, 1, 8))
    on conflict (id) do update set name = excluded.name;
    insert into public.user_roles (user_id, role) values (u.id, u.role)
    on conflict (user_id) do update set role = excluded.role;
    if u.org is not null then insert into public.org_members (user_id, org_id) values (u.id, u.org); end if;
  end loop;

  -- ── créer les comptes d'une classe depuis une liste ──
  perform public.zz_comme(pa);
  cid := public.prof_creer_classe('ZZ 2nde 4', 'Seconde', 'Anglais');
  select count(*) filter (where e.statut = 'cree'), count(*) filter (where e.statut = 'invalide'),
         count(*) filter (where e.statut = 'deja')
    into n, t, s
  from public.prof_creer_eleves(cid, '[{"prenom":"alice","nom":"martin"},
    {"prenom":"jean-pierre","nom":"de la fontaine"},{"prenom":"Élodie","nom":"Ñúñez"},
    {"prenom":"","nom":"Sans"},{"prenom":"x<script>","nom":"y"},{"prenom":"Alice","nom":"MARTIN"}]'::jsonb) e;
  insert into public.zz_res (nom, ok, vu) values ('3 créés, 2 invalides, 1 doublon dans la liste',
    n = 3 and t = '2' and s = '1', n || '/' || t || '/' || s);
  perform public.zz_root();
  select string_agg(p.name || '=' || g.identifiant, ' | ' order by g.identifiant) into t
  from public.comptes_geres g join public.profiles p on p.id = g.user_id
  join public.class_members m on m.user_id = g.user_id and m.class_id = cid;
  insert into public.zz_res (nom, ok, vu) values ('noms mis en forme, identifiants sans accents',
    t = 'Alice MARTIN=alice.martin | Élodie ÑÚÑEZ=elodie.nunez | Jean-Pierre DE LA FONTAINE=jeanpierre.delafontaine', t);
  select g.user_id into alice from public.comptes_geres g where g.identifiant = 'alice.martin';
  insert into public.zz_res (nom, ok, vu) values ('le compte est élève, de l''établissement, inscrit, jamais connecté',
    exists (select 1 from public.user_roles where user_id = alice and role = 'eleve')
    and exists (select 1 from public.org_members where user_id = alice and org_id = oa)
    and exists (select 1 from auth.users where id = alice and email = 'alice.martin@eleves.folio.invalid'
                and last_sign_in_at is null and encrypted_password like '$2%'), '');

  -- l'identifiant suivant prend un numéro, le code n'est jamais stocké en clair
  perform public.zz_comme(pp);
  cid2 := public.prof_creer_classe('ZZ Soutien', '', 'Maths');
  select e.identifiant, e.code into ident, secret from public.prof_creer_eleves(cid2, '[{"prenom":"Alice","nom":"Martin"}]'::jsonb) e;
  insert into public.zz_res (nom, ok, vu) values ('un deuxième Alice Martin ailleurs : alice.martin2, code de 8',
    ident = 'alice.martin2' and secret ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$', ident || '/' || length(secret));
  perform public.zz_root();
  insert into public.zz_res (nom, ok, vu) values ('le code n''apparaît nulle part en clair',
    not exists (select 1 from auth.users where encrypted_password like '%' || secret || '%')
    and not exists (select 1 from public.comptes_geres g where g.identifiant like '%' || secret || '%'), '');

  -- homonyme dans le même établissement
  perform public.zz_comme(pa);
  cid3 := public.prof_creer_classe('ZZ Option latin', '', 'Latin');
  select e.statut into s from public.prof_creer_eleves(cid3, '[{"prenom":"Alice","nom":"Martin"}]'::jsonb) e;
  select e.statut into t from public.prof_creer_eleves(cid3, '[{"prenom":"Alice","nom":"Martin"}]'::jsonb, true) e;
  insert into public.zz_res (nom, ok, vu) values ('homonyme dans le lycée : signalé, créé seulement si confirmé',
    s = 'homonyme' and t = 'cree', s || '/' || t);

  -- seul le gestionnaire crée des comptes
  perform public.zz_comme(pa2);
  begin perform public.prof_creer_eleves(cid, '[{"prenom":"Pirate","nom":"Intrus"}]'::jsonb); s := 'passé';
  exception when others then s := 'refusé'; end;
  insert into public.zz_res (nom, ok, vu) values ('un collègue hors de la classe ne crée pas de compte', s = 'refusé', s);

  -- ── le nom ne se change pas ──
  perform public.zz_comme(alice);
  update public.profiles set name = 'DarkAlice', handle = 'darkalice' where id = alice;
  perform public.zz_root();
  select p.name || '/' || p.handle into t from public.profiles p where p.id = alice;
  insert into public.zz_res (nom, ok, vu) values ('l''élève ne change ni son nom ni son pseudo',
    t = 'Alice MARTIN/alice.martin', t);
  select g.gere, g.nom, g.identifiant into b, s, t from public.mon_compte() g;
  perform public.zz_comme(alice);
  select g.gere, g.nom, g.identifiant into b, s, t from public.mon_compte() g;
  insert into public.zz_res (nom, ok, vu) values ('l''app sait que c''est un compte à carte',
    b and s = 'Alice MARTIN' and t = 'alice.martin', b || '/' || s || '/' || t);

  -- le gestionnaire corrige une faute de frappe, partout
  perform public.zz_comme(pa);
  t := public.prof_nommer_eleve(cid, alice, 'alyce', 'martin');
  perform public.zz_root();
  insert into public.zz_res (nom, ok, vu) values ('le gestionnaire corrige le nom, partout',
    t = 'Alyce MARTIN'
    and (select name from public.profiles where id = alice) = 'Alyce MARTIN'
    and (select who from public.class_members where class_id = cid and user_id = alice) = 'Alyce MARTIN', t);
  perform public.zz_comme(pa2);
  begin perform public.prof_nommer_eleve(cid, alice, 'Hack', 'Er'); s := 'passé';
  exception when others then s := 'refusé'; end;
  insert into public.zz_res (nom, ok, vu) values ('… et personne d''autre', s = 'refusé', s);

  -- ── une carte perdue ──
  perform public.zz_root();
  select encrypted_password into hash1 from auth.users where id = alice;
  insert into auth.sessions (id, user_id, created_at, updated_at) values (gen_random_uuid(), alice, now(), now());
  perform public.zz_comme(pa);
  select c.code into secret2 from public.prof_nouvelles_cartes(cid, array[alice]) c;
  perform public.zz_root();
  select encrypted_password into hash2 from auth.users where id = alice;
  insert into public.zz_res (nom, ok, vu) values ('nouvelle carte : nouveau code, appareils déconnectés',
    hash1 <> hash2 and hash2 = extensions.crypt(secret2, hash2)
    and not exists (select 1 from auth.sessions where user_id = alice), '');
end $$;

-- Second bloc : retrouve le décor du premier (même transaction).
do $$
declare
  pa uuid; pa2 uuid; pp uuid; perso uuid; alice uuid; cid uuid; cid2 uuid; code1 text; s text; t text; n integer;
begin
  select g.user_id into alice from public.comptes_geres g where g.identifiant = 'alice.martin';
  select c.id into cid from public.classes c where c.name = 'ZZ 2nde 4';
  select c.id into cid2 from public.classes c where c.name = 'ZZ Soutien';
  select p.id into pa from public.profiles p where p.name = 'Mme Zed' and p.email like 'zz-%';
  select p.id into pa2 from public.profiles p where p.name = 'M. Autre' and p.email like 'zz-%';
  select p.id into pp from public.profiles p where p.name = 'Mme Libre' and p.email like 'zz-%';
  select p.id into perso from public.profiles p where p.name = 'Batman du 93' and p.email like 'zz-%';
  insert into public.zz_res (nom, ok, vu) values ('le premier bloc s''est déroulé jusqu''au bout',
    alice is not null and cid is not null, coalesce(alice::text, '∅'));

  perform public.zz_comme(pa2);
  begin perform public.prof_nouvelles_cartes(cid, array[alice]); s := 'passé';
  exception when others then s := 'refusé'; end;
  insert into public.zz_res (nom, ok, vu) values ('personne d''autre ne remplace la carte', s = 'refusé', s);

  -- ── un compte personnel rejoint avec son vrai nom ──
  perform public.zz_root();
  select c.code into code1 from public.classes c where c.id = cid2;
  perform public.zz_comme(perso);
  select j.statut into s from public.class_join(code1) j;
  insert into public.zz_res (nom, ok, vu) values ('compte personnel sans prénom ni nom : « nom », rien d''inscrit',
    s = 'nom' and not exists (select 1 from public.class_requests r where r.user_id = perso), s);
  select j.statut into s from public.class_join(code1, 'Lucas', 'Batman<3') j;
  insert into public.zz_res (nom, ok, vu) values ('un faux nom (caractères interdits) est refusé', s = 'nom', s);
  select j.statut into s from public.class_join(code1, '  lucas ', ' durand ') j;
  perform public.zz_comme(pp);
  select d.who into t from public.prof_demandes(cid2) d where d.user_id = perso;
  insert into public.zz_res (nom, ok, vu) values ('le professeur voit « Lucas DURAND », pas le pseudo',
    s = 'attente' and t = 'Lucas DURAND', s || '/' || coalesce(t, '∅'));

  -- un compte à carte rejoint une autre classe avec son nom, sans le retaper
  perform public.zz_root();
  select c.code into code1 from public.classes c where c.name = 'ZZ Option latin';
  perform public.zz_comme(alice);
  select j.statut into s from public.class_join(code1, 'Faux', 'Nom') j;
  perform public.zz_comme(pa);
  select d.who into t from public.prof_demandes((select id from public.classes where name = 'ZZ Option latin')) d
  where d.user_id = alice;
  insert into public.zz_res (nom, ok, vu) values ('un compte à carte garde son nom (le nom tapé est ignoré)',
    s = 'attente' and t = 'Alyce MARTIN', s || '/' || coalesce(t, '∅'));

  -- ── supprimer un compte à carte ──
  perform public.zz_comme(pa);
  n := public.prof_admettre((select id from public.classes where name = 'ZZ Option latin'), array[alice]);
  begin perform public.prof_supprimer_eleve(cid, alice); s := 'passé';
  exception when others then s := 'refusé'; end;
  insert into public.zz_res (nom, ok, vu) values ('pas de suppression s''il est dans une autre classe', s = 'refusé', s);
  perform public.prof_retirer((select id from public.classes where name = 'ZZ Option latin'), alice, false);
  perform public.prof_supprimer_eleve(cid, alice);
  perform public.zz_root();
  insert into public.zz_res (nom, ok, vu) values ('supprimé : plus de compte, plus de ligne',
    not exists (select 1 from auth.users where id = alice)
    and not exists (select 1 from public.comptes_geres where user_id = alice)
    and not exists (select 1 from public.class_members where user_id = alice), '');
  perform public.zz_comme(pp);
  n := public.prof_admettre(cid2, array[perso]);
  begin perform public.prof_supprimer_eleve(cid2, perso); s := 'passé';
  exception when others then s := 'refusé'; end;
  insert into public.zz_res (nom, ok, vu) values ('un compte personnel ne se supprime pas par le prof', s = 'refusé', s);

  insert into public.zz_res (nom, ok, vu) values ('fonctions internes fermées',
    not has_function_privilege('authenticated', 'public.creer_compte_eleve(text, text, uuid)', 'execute')
    and not has_function_privilege('authenticated', 'public.code_secret()', 'execute')
    and not has_function_privilege('anon', 'public.prof_creer_eleves(uuid, jsonb, boolean)', 'execute'), '');
end $$;

select n, ok, nom, vu from public.zz_res order by n;

rollback;
