-- Tests de la migration 20261108133515_visuels_chacun_son_niveau : visuels()
-- dit le niveau de chacun — Mirandola+, Infini ou rien —, jamais celui de
-- qui regarde. Même mode que jetons.sql : transaction ANNULÉE, comptes
-- jetables, vrai rôle `authenticated`.

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
  moi uuid := gen_random_uuid(); ap uuid := gen_random_uuid(); ai uuid := gen_random_uuid();
  ag uuid := gen_random_uuid(); inconnu uuid := gen_random_uuid(); u uuid; r record;
begin
  foreach u in array array[moi, ap, ai, ag, inconnu] loop
    insert into auth.users (instance_id, id, aud, role, email)
    values ('00000000-0000-0000-0000-000000000000', u, 'authenticated', 'authenticated', 'zz-' || u || '@exemple.invalid');
    insert into public.profiles (id, email, name) values (u, 'zz-' || u || '@exemple.invalid', 'Zz')
    on conflict (id) do nothing;
    insert into public.user_roles (user_id, role) values (u, 'eleve') on conflict (user_id) do update set role = 'eleve';
  end loop;
  -- moi : Infini offert ; ap : Mirandola+ offert ; ai : Infini offert ; ag : rien
  insert into public.abonnements (user_id, statut, source, formule) values
    (moi, 'actif', 'offert', 'infini_annuel'), (ap, 'actif', 'offert', null), (ai, 'actif', 'offert', 'infini_annuel');
  insert into public.friends (user_id, friend_id, status) values (moi, ap, 'ok'), (moi, ai, 'ok'), (moi, ag, 'ok');

  perform public.zz_comme(moi);
  select * into r from public.visuels(array[ap], '{}');
  insert into public.zz_res (nom, ok, vu) values ('un ami Mirandola+ : plus, pas infini (même vu par un abonné Infini)',
    r.plus and not r.infini, r.plus || '/' || r.infini);
  select * into r from public.visuels(array[ai], '{}');
  insert into public.zz_res (nom, ok, vu) values ('un ami Infini : infini (et plus, pour une app d''avant)',
    r.plus and r.infini, r.plus || '/' || r.infini);
  select * into r from public.visuels(array[ag], '{}');
  insert into public.zz_res (nom, ok, vu) values ('un ami en Mirandola gratuit : rien',
    not r.plus and not r.infini, r.plus || '/' || r.infini);
  select * into r from public.visuels(array[moi], '{}');
  insert into public.zz_res (nom, ok, vu) values ('soi-même : son propre niveau', r.infini, r.infini::text);
  insert into public.zz_res (nom, ok, vu) values ('un inconnu : rien du tout, pas même son niveau', not exists (
    select 1 from public.visuels(array[inconnu], '{}')), 'inconnu');

  perform public.zz_comme(ap);
  select * into r from public.visuels(array[moi], '{}');
  insert into public.zz_res (nom, ok, vu) values ('vu par un ami Mirandola+, l''abonné Infini reste Infini',
    r.infini, r.infini::text);

  perform public.zz_root();
  -- Mirandola+ repris : plus rien
  update public.abonnements set statut = 'fini', fin_periode = now() - interval '1 day' where user_id = ap;
  perform public.zz_comme(moi);
  select * into r from public.visuels(array[ap], '{}');
  insert into public.zz_res (nom, ok, vu) values ('un abonnement fini : le liseré s''en va',
    not r.plus and not r.infini, r.plus || '/' || r.infini);

  perform public.zz_root();
  insert into public.zz_res (nom, ok, vu) values ('les droits : authenticated seul',
    not has_function_privilege('anon', 'public.visuels(uuid[], uuid[])', 'execute')
    and has_function_privilege('authenticated', 'public.visuels(uuid[], uuid[])', 'execute'), 'droits');
end $$;

select n, ok, nom, vu from public.zz_res order by n;
rollback;
