-- Tests de la migration 20261027190000_folio_plus_abonnements : ce qu'un
-- compte a le droit d'ouvrir, et qui peut écrire un abonnement. Même mode que
-- classe_eleve.sql : transaction ANNULÉE, comptes jetables, vrai rôle
-- `authenticated`.

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
  lea uuid := gen_random_uuid(); tom uuid := gen_random_uuid(); ana uuid := gen_random_uuid();
  eli uuid := gen_random_uuid(); zed uuid := gen_random_uuid(); oa uuid := gen_random_uuid(); u record;
  j jsonb; n integer; refus text;
begin
  for u in select * from (values (lea, 'zzleaab'), (tom, 'zztomab'), (ana, 'zzanaab'), (eli, 'zzeliab'), (zed, 'zzzedab')) x(id, pseudo) loop
    insert into auth.users (instance_id, id, aud, role, email)
    values ('00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', 'zz-' || u.id || '@exemple.invalid');
    insert into public.profiles (id, email, name, handle)
    values (u.id, 'zz-' || u.id || '@exemple.invalid', u.pseudo, u.pseudo)
    on conflict (id) do update set name = excluded.name, handle = excluded.handle;
  end loop;
  insert into public.orgs (id, code, name, offre, licence_fin) values (oa, 'ZZAB', 'Lycée Zed', 'etablissement', current_date + 200);
  insert into public.org_members (user_id, org_id) values (eli, oa);
  insert into public.abonnements (user_id, statut, formule, client_stripe, abonnement_stripe, fin_periode) values
    (lea, 'actif', 'annuel', 'cus_zz_lea', 'sub_zz_lea', now() + interval '300 days'),
    (tom, 'fini', 'mensuel', 'cus_zz_tom', 'sub_zz_tom', now() - interval '2 days'),
    (ana, 'impaye', 'mensuel', 'cus_zz_ana', 'sub_zz_ana', now() + interval '20 days'),
    (eli, 'actif', 'mensuel', 'cus_zz_eli', 'sub_zz_eli', now() + interval '20 days');

  -- ══════════ ce que chacun ouvre ══════════
  perform public.zz_comme(lea);
  j := public.mon_offre();
  insert into public.zz_res (nom, ok, vu) values ('un abonnement actif : Mirandola+',
    j->>'offre' = 'plus' and j->'abonnement'->>'formule' = 'annuel' and j->'abonnement'->>'statut' = 'actif', j::text);
  perform public.zz_comme(tom);
  j := public.mon_offre();
  insert into public.zz_res (nom, ok, vu) values ('un abonnement fini : gratuit, l''abonnement rendu quand même',
    j->>'offre' = 'gratuit' and j->'abonnement'->>'statut' = 'fini', j::text);
  perform public.zz_comme(ana);
  j := public.mon_offre();
  insert into public.zz_res (nom, ok, vu) values ('impayé pendant les relances : Mirandola+ reste ouvert', j->>'offre' = 'plus', j::text);
  perform public.zz_comme(zed);
  j := public.mon_offre();
  insert into public.zz_res (nom, ok, vu) values ('aucun abonnement : gratuit, abonnement nul',
    j->>'offre' = 'gratuit' and j->'abonnement' = 'null'::jsonb and j->'etablissement' = 'null'::jsonb, j::text);
  perform public.zz_comme(eli);
  j := public.mon_offre();
  insert into public.zz_res (nom, ok, vu) values ('un établissement sous licence : Campus, et son abonnement à part',
    j->>'offre' = 'campus' and j->>'etablissement' = 'Lycée Zed' and j->'abonnement'->>'formule' = 'mensuel', j::text);
  perform public.zz_root();
  update public.orgs set licence_fin = current_date - 1 where id = oa;
  perform public.zz_comme(eli);
  j := public.mon_offre();
  insert into public.zz_res (nom, ok, vu) values ('licence finie : son abonnement personnel reprend', j->>'offre' = 'plus', j::text);
  perform public.zz_root();
  update public.abonnements set fin_periode = now() - interval '1 minute' where user_id = lea;
  perform public.zz_comme(lea);
  j := public.mon_offre();
  insert into public.zz_res (nom, ok, vu) values ('période passée sans renouvellement : gratuit', j->>'offre' = 'gratuit', j::text);

  -- ══════════ personne n'écrit un abonnement à la main ══════════
  perform public.zz_comme(zed);
  begin
    insert into public.abonnements (user_id, statut, fin_periode) values (zed, 'actif', now() + interval '1 year');
    refus := 'passe';
  exception when others then refus := sqlstate;
  end;
  insert into public.zz_res (nom, ok, vu) values ('s''offrir Mirandola+ par l''API brute : refusé', refus = '42501', refus);
  perform public.zz_comme(tom);
  begin
    update public.abonnements set statut = 'actif', fin_periode = now() + interval '1 year' where user_id = tom;
    refus := 'passe';
  exception when others then refus := sqlstate;
  end;
  insert into public.zz_res (nom, ok, vu) values ('se rallonger son abonnement : refusé', refus = '42501', refus);
  select count(*) into n from public.abonnements;
  insert into public.zz_res (nom, ok, vu) values ('on ne lit que sa ligne', n = 1, n::text);
  -- table de service : un compte n'a aucun droit dessus, la lecture même est refusée
  begin
    select count(*) into n from public.stripe_evenements;
    refus := 'lu : ' || n;
  exception when others then refus := sqlstate;
  end;
  insert into public.zz_res (nom, ok, vu) values ('les évènements Stripe : lecture refusée', refus = '42501', refus);

  -- ══════════ supprimer son compte ══════════
  perform public.zz_root();
  update public.abonnements set fin_periode = now() + interval '300 days' where user_id = lea;
  perform public.zz_comme(lea);
  begin
    perform public.delete_me();
    refus := 'passe';
  exception when others then refus := sqlerrm;
  end;
  insert into public.zz_res (nom, ok, vu) values ('abonnement qui court : la suppression demande de le résilier',
    refus like 'Résilie d''abord%', refus);
  perform public.zz_root();
  update public.abonnements set fin_prevue = true where user_id = lea;
  perform public.zz_comme(lea);
  perform public.delete_me();
  perform public.zz_root();
  select count(*) into n from public.abonnements where user_id = lea;
  insert into public.zz_res (nom, ok, vu) values ('résilié : le compte part, son abonnement avec', n = 0, n::text);
  perform public.zz_comme(tom);
  perform public.delete_me();
  perform public.zz_root();
  select count(*) into n from auth.users where id = tom;
  insert into public.zz_res (nom, ok, vu) values ('abonnement fini : la suppression passe', n = 0, n::text);

  -- ══════════ les droits ══════════
  insert into public.zz_res (nom, ok, vu) values ('mon_offre : authenticated oui, anon non',
    has_function_privilege('authenticated', 'public.mon_offre()', 'execute')
    and not has_function_privilege('anon', 'public.mon_offre()', 'execute'), 'droits');
  insert into public.zz_res (nom, ok, vu) values ('abonnement_ouvre est interne',
    not has_function_privilege('authenticated', 'public.abonnement_ouvre(text, timestamptz)', 'execute')
    and not has_function_privilege('anon', 'public.abonnement_ouvre(text, timestamptz)', 'execute'), 'droits');
  insert into public.zz_res (nom, ok, vu) values ('anon ne lit pas les abonnements',
    not has_table_privilege('anon', 'public.abonnements', 'select')
    or not exists (select 1 from pg_policies where tablename = 'abonnements' and 'anon' = any(roles)), 'droits');
end $$;

select n, ok, nom, vu from public.zz_res order by n;
rollback;
