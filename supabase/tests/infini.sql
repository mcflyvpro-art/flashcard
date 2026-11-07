-- Tests de la migration 20261105174551_infini_et_essai : le niveau Infini,
-- l'essai et le quota d'IA de chacun. Transaction ANNULÉE, comptes jetables,
-- vrai rôle `authenticated`. Pour lire le bilan avec execute_sql, remplacer
-- le select final et le rollback par
--   do $$ begin raise exception 'RESULTATS %', (select … from public.zz_res); end $$;

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
  plus uuid := gen_random_uuid(); inf uuid := gen_random_uuid(); essai uuid := gen_random_uuid();
  gratuit uuid := gen_random_uuid(); offert uuid := gen_random_uuid(); u record; j jsonb; refus text;
begin
  for u in select * from (values (plus), (inf), (essai), (gratuit), (offert)) x(id) loop
    insert into auth.users (instance_id, id, aud, role, email)
    values ('00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', 'zz-' || u.id || '@exemple.invalid');
  end loop;
  insert into public.abonnements (user_id, statut, formule, source, fin_periode) values
    (plus, 'actif', 'annuel', 'stripe', now() + interval '200 days'),
    (inf, 'actif', 'infini_mensuel', 'stripe', now() + interval '20 days'),
    (essai, 'essai', 'infini_annuel', 'stripe', now() + interval '7 days'),
    (offert, 'actif', null, 'offert', null),
    (offert, 'actif', 'infini_annuel', 'stripe', now() + interval '300 days')
  on conflict (user_id, source) do update set statut = excluded.statut, formule = excluded.formule,
    fin_periode = excluded.fin_periode;
  delete from public.abonnements where user_id = gratuit;

  -- ══════════ le niveau ══════════
  perform public.zz_comme(plus);   j := public.mon_offre();
  insert into public.zz_res (nom, ok, vu) values ('Mirandola+ : offre plus, niveau plus', j->>'offre' = 'plus' and j->>'niveau' = 'plus', j::text);
  perform public.zz_comme(inf);    j := public.mon_offre();
  insert into public.zz_res (nom, ok, vu) values ('Infini : offre plus, niveau infini', j->>'offre' = 'plus' and j->>'niveau' = 'infini', j::text);
  perform public.zz_comme(offert); j := public.mon_offre();
  insert into public.zz_res (nom, ok, vu) values ('offert puis Infini acheté : niveau infini, l’abonnement Infini rendu',
    j->>'niveau' = 'infini' and j->'abonnement'->>'formule' = 'infini_annuel', j::text);
  perform public.zz_comme(gratuit); j := public.mon_offre();
  insert into public.zz_res (nom, ok, vu) values ('sans abonnement : niveau gratuit, sauf comptes offerts d’avant',
    j->>'niveau' = j->>'offre', j::text);

  -- ══════════ l'IA du mois ══════════
  perform public.zz_comme(plus);  j := public.mon_ia();
  insert into public.zz_res (nom, ok, vu) values ('Mirandola+ : 30 par mois, compté', (j->>'quota')::int = 30
    and not (j->>'sans_compter')::boolean, j::text);
  perform public.zz_comme(inf);   j := public.mon_ia();
  insert into public.zz_res (nom, ok, vu) values ('Infini : 150 du meilleur modèle, puis sans compter', (j->>'quota')::int = 150
    and (j->>'sans_compter')::boolean, j::text);
  perform public.zz_comme(essai); j := public.mon_ia();
  insert into public.zz_res (nom, ok, vu) values ('l’essai, même d’Infini : 10, compté', (j->>'quota')::int = 10
    and (j->>'essai')::boolean and not (j->>'sans_compter')::boolean, j::text);

  -- ══════════ la formule ══════════
  perform public.zz_root();
  begin
    update public.abonnements set formule = 'a_vie' where user_id = plus;
    refus := 'accepté';
  exception when check_violation then refus := sqlstate;
  end;
  insert into public.zz_res (nom, ok, vu) values ('une formule inconnue : refusée', refus = '23514', refus);

  -- ══════════ les droits ══════════
  insert into public.zz_res (nom, ok, vu) values ('niveau_de, abonnement_courant, ia_droits : internes',
    not has_function_privilege('authenticated', 'public.niveau_de(uuid)', 'execute')
    and not has_function_privilege('authenticated', 'public.ia_droits(uuid)', 'execute')
    and not has_function_privilege('authenticated', 'public.abonnement_courant(uuid)', 'execute')
    and has_function_privilege('service_role', 'public.ia_droits(uuid)', 'execute'), 'droits');
  insert into public.zz_res (nom, ok, vu) values ('mon_offre et mon_ia : authenticated, jamais anon',
    has_function_privilege('authenticated', 'public.mon_offre()', 'execute')
    and not has_function_privilege('anon', 'public.mon_offre()', 'execute')
    and not has_function_privilege('anon', 'public.mon_ia()', 'execute'), 'droits');
end $$;

select n, ok, nom, vu from public.zz_res order by n;
rollback;
