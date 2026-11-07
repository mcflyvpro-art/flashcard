-- Tests de la migration 20261107231943_offrir_infini : l'éditeur offre
-- Mirandola Infini. Transaction ANNULÉE, comptes jetables, vrai rôle
-- `authenticated`. Pour lire le bilan avec execute_sql, remplacer le select
-- final et le rollback par
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
  ed uuid := gen_random_uuid(); lea uuid := gen_random_uuid(); tom uuid := gen_random_uuid();
  u record; j jsonb; refus text;
begin
  for u in select * from (values (ed), (lea), (tom)) x(id) loop
    insert into auth.users (instance_id, id, aud, role, email)
    values ('00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', 'zz-' || u.id || '@exemple.invalid');
  end loop;
  insert into public.user_roles (user_id, role) values (ed, 'admin')
    on conflict (user_id) do update set role = excluded.role;
  -- des comptes neufs : sans ligne d'abonnement (la migration des comptes d'avant ne les voit pas)
  delete from public.abonnements where user_id in (lea, tom);

  -- ══════════ personne d'autre ══════════
  perform public.zz_comme(lea);
  begin
    perform public.admin_offrir_plus(lea, null, false, 'infini');
    refus := 'passe';
  exception when others then refus := sqlstate;
  end;
  insert into public.zz_res (nom, ok, vu) values ('s’offrir Infini soi-même : refusé', refus = '42501', refus);

  -- ══════════ l'éditeur offre Infini ══════════
  perform public.zz_comme(ed);
  j := public.admin_offrir_plus(lea, null, false, 'infini');
  insert into public.zz_res (nom, ok, vu) values ('l’éditeur offre Infini : offre plus, niveau infini',
    j->>'offre' = 'plus' and j->>'niveau' = 'infini', j::text);
  perform public.zz_comme(lea);
  j := public.mon_offre();
  insert into public.zz_res (nom, ok, vu) values ('le compte le voit : Infini, offert, sans fin',
    j->>'niveau' = 'infini' and j->'abonnement'->>'source' = 'offert' and j->'abonnement'->>'formule' = 'infini_annuel'
    and j->'abonnement'->>'fin_periode' is null, j::text);
  j := public.mon_ia();
  insert into public.zz_res (nom, ok, vu) values ('l’IA d’Infini : 150 puis sans compter',
    (j->>'quota')::int = 150 and (j->>'sans_compter')::boolean, j::text);

  -- ══════════ revenir à Mirandola+, reprendre ══════════
  perform public.zz_comme(ed);
  j := public.admin_offrir_plus(lea, now() + interval '30 days');
  insert into public.zz_res (nom, ok, vu) values ('offrir Mirandola+ (sans niveau, comme une app d’avant) ramène à Mirandola+',
    j->>'offre' = 'plus' and j->>'niveau' = 'plus', j::text);
  perform public.zz_root();
  insert into public.zz_res (nom, ok, vu) values ('une seule ligne offerte', (select count(*) from public.abonnements
    where user_id = lea and source = 'offert') = 1, 'lignes');
  perform public.zz_comme(ed);
  j := public.admin_offrir_plus(lea, now() + interval '60 days', false, 'infini');
  j := public.admin_offrir_plus(lea, null, true);
  insert into public.zz_res (nom, ok, vu) values ('reprendre un Infini offert : gratuit', j->>'offre' = 'gratuit'
    and j->>'niveau' = 'gratuit', j::text);

  -- ══════════ ce qui est refusé ══════════
  begin
    perform public.admin_offrir_plus(tom, null, false, 'campus');
    refus := 'passe';
  exception when others then refus := sqlstate;
  end;
  insert into public.zz_res (nom, ok, vu) values ('un niveau inconnu : refusé', refus = '22023', refus);
  begin
    perform public.admin_offrir_plus(tom, now() - interval '1 day', false, 'infini');
    refus := 'passe';
  exception when others then refus := sqlstate;
  end;
  insert into public.zz_res (nom, ok, vu) values ('Infini jusqu’à une date passée : refusé', refus = '22023', refus);
  perform public.zz_root();
  insert into public.zz_res (nom, ok, vu) values ('rien d’écrit pour un refus', not exists (select 1 from public.abonnements
    where user_id = tom), 'lignes');

  -- ══════════ les droits ══════════
  insert into public.zz_res (nom, ok, vu) values ('authenticated, jamais anon ; l’ancienne signature partie',
    has_function_privilege('authenticated', 'public.admin_offrir_plus(uuid, timestamptz, boolean, text)', 'execute')
    and not has_function_privilege('anon', 'public.admin_offrir_plus(uuid, timestamptz, boolean, text)', 'execute')
    and to_regprocedure('public.admin_offrir_plus(uuid, timestamptz, boolean)') is null, 'droits');
end $$;

select n, ok, nom, vu from public.zz_res order by n;
rollback;
