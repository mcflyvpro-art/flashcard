-- Tests de la migration 20261113171304_demandes_professeurs_particuliers :
-- la demande d'un professeur particulier, à part de tout établissement.
-- Même mode que les autres : transaction ANNULÉE, comptes jetables, vrais
-- rôles `anon` et `authenticated`. (Le déclencheur pose son appel à prevenir
-- dans la file de pg_net, annulée avec le reste : rien ne part.)

begin;

create table public.zz_res (n serial primary key, nom text, ok boolean, vu text);
grant all on public.zz_res to anon, authenticated;
grant all on sequence public.zz_res_n_seq to anon, authenticated;
create function public.zz_comme(u uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function public.zz_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  perform set_config('role', 'anon', true);
end $$;
create function public.zz_root() returns void language plpgsql as $$
begin perform set_config('role', 'postgres', true); end $$;
grant execute on function public.zz_comme(uuid), public.zz_anon(), public.zz_root() to anon, authenticated;

do $$
declare
  ed uuid := gen_random_uuid(); lea uuid := gen_random_uuid(); u uuid; r text; j jsonb; n integer; did uuid; k integer;
  avant integer;
begin
  foreach u in array array[ed, lea] loop
    insert into auth.users (instance_id, id, aud, role, email)
    values ('00000000-0000-0000-0000-000000000000', u, 'authenticated', 'authenticated', 'zz-' || u || '@exemple.invalid');
    insert into public.profiles (id, email, name) values (u, 'zz-' || u || '@exemple.invalid', 'Zz') on conflict (id) do nothing;
  end loop;
  insert into public.user_roles (user_id, role) values (ed, 'admin') on conflict (user_id) do update set role = 'admin';
  select count(*) into avant from public.orgs;

  -- ══════════ sans compte, depuis le site ══════════
  perform public.zz_anon();
  r := public.demander_espace_prof('Marie Curie', '  Marie.Curie@Exemple.FR ', '06 12 34 56 78', 12, 'Physique, lycée');
  insert into public.zz_res (nom, ok, vu) values ('un visiteur sans compte demande son espace', r = 'ok', r);
  r := public.demander_espace_prof('Marie Curie', 'marie.curie@exemple.fr');
  insert into public.zz_res (nom, ok, vu) values ('la même adresse le même jour : déjà reçue', r = 'deja', r);
  r := public.demander_espace_prof('X', 'x@exemple.fr');
  insert into public.zz_res (nom, ok, vu) values ('un nom trop court : refusé', r = 'champs', r);
  r := public.demander_espace_prof('Paul Durand', 'pas-une-adresse');
  insert into public.zz_res (nom, ok, vu) values ('une adresse fausse : refusée', r = 'email', r);
  r := public.demander_espace_prof('Paul Durand', 'paul@exemple.fr', '', 0);
  insert into public.zz_res (nom, ok, vu) values ('zéro élève : refusé', r = 'champs', r);
  begin perform 1 from public.demandes_profs; r := 'lu'; exception when others then r := sqlstate; end;
  insert into public.zz_res (nom, ok, vu) values ('un visiteur ne lit pas les demandes', r = '42501', r);
  begin perform public.admin_demandes_profs(); r := 'lu'; exception when others then r := sqlstate; end;
  insert into public.zz_res (nom, ok, vu) values ('… ni par la fonction de l''éditeur', r = '42501', r);

  perform public.zz_root();
  select count(*) into n from public.demandes_profs where email = 'marie.curie@exemple.fr' and nom = 'Marie Curie'
    and eleves = 12 and message = 'Physique, lycée' and traitee_le is null;
  insert into public.zz_res (nom, ok, vu) values ('rangée une fois, l''adresse en minuscules', n = 1, n::text);
  insert into public.zz_res (nom, ok, vu) values ('aucun établissement créé', (select count(*) from public.orgs) = avant,
    (select count(*) from public.orgs)::text);

  -- ══════════ un compte, l'éditeur ══════════
  perform public.zz_comme(lea);
  begin perform public.admin_demandes_profs(); r := 'lu'; exception when others then r := sqlstate; end;
  insert into public.zz_res (nom, ok, vu) values ('un élève ne lit pas les demandes', r = '42501', r);
  begin j := to_jsonb(public.admin_demande_prof_traitee(gen_random_uuid())); r := 'passé'; exception when others then r := sqlstate; end;
  insert into public.zz_res (nom, ok, vu) values ('… ni ne les traite', r = '42501', r);
  perform public.zz_comme(ed);
  j := public.admin_demandes_profs();
  select (x->>'id')::uuid into did from jsonb_array_elements(j) x where x->>'email' = 'marie.curie@exemple.fr';
  insert into public.zz_res (nom, ok, vu) values ('l''éditeur lit la demande, en attente', did is not null
    and exists (select 1 from jsonb_array_elements(j) x where x->>'email' = 'marie.curie@exemple.fr' and x->>'traitee_le' is null), left(j::text, 200));
  insert into public.zz_res (nom, ok, vu) values ('… et la marque traitée', public.admin_demande_prof_traitee(did), 'traitee');
  j := public.admin_demandes_profs();
  insert into public.zz_res (nom, ok, vu) values ('… traitée, elle reste lisible trente jours', exists (
    select 1 from jsonb_array_elements(j) x where (x->>'id')::uuid = did and x->>'traitee_le' is not null), left(j::text, 200));

  -- ══════════ le frein ══════════
  perform public.zz_anon();
  for k in 1..25 loop r := public.demander_espace_prof('Prof ' || k, 'prof' || k || '@exemple.fr'); end loop;
  insert into public.zz_res (nom, ok, vu) values ('au-delà de 20 demandes par heure : « trop »', r = 'trop', r);

  perform public.zz_root();
  insert into public.zz_res (nom, ok, vu) values ('les droits : la demande ouverte à anon, le reste à l''éditeur, le déclencheur à personne',
    has_function_privilege('anon', 'public.demander_espace_prof(text, text, text, integer, text)', 'execute')
    and not has_function_privilege('anon', 'public.admin_demandes_profs()', 'execute')
    and not has_function_privilege('anon', 'public.admin_demande_prof_traitee(uuid, boolean)', 'execute')
    and not has_function_privilege('authenticated', 'public.prevenir_demande_prof()', 'execute')
    and not has_table_privilege('anon', 'public.demandes_profs', 'select')
    and not has_table_privilege('authenticated', 'public.demandes_profs', 'insert'), 'droits');
end $$;

select n, ok, nom, vu from public.zz_res order by n;
rollback;
