-- Tests de la migration 20261108134716_examens_offerts : la base compte, à
-- vie, les sujets composés et les copies corrigées de chacun — la fonction ai
-- en tire l'examen blanc offert (1 en Mirandola gratuit, 2 en Mirandola+).
-- Même mode que les autres : transaction ANNULÉE, comptes jetables, vrai
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
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); u uuid; d jsonb; m jsonb;
begin
  foreach u in array array[a, b] loop
    insert into auth.users (instance_id, id, aud, role, email)
    values ('00000000-0000-0000-0000-000000000000', u, 'authenticated', 'authenticated', 'zz-' || u || '@exemple.invalid');
    insert into public.profiles (id, email, name) values (u, 'zz-' || u || '@exemple.invalid', 'Zz') on conflict (id) do nothing;
  end loop;

  d := public.ia_droits(a);
  insert into public.zz_res (nom, ok, vu) values ('un compte neuf : aucun examen, aucune correction',
    (d->>'examens')::int = 0 and (d->>'corrections')::int = 0, d::text);

  -- un sujet composé il y a deux mois, sa copie corrigée ; un autre sujet ce mois-ci ; et des cartes
  insert into public.ai_usage (user_id, day, op) values
    (a, (now() - interval '60 days')::date, 'examen'), (a, (now() - interval '60 days')::date, 'corriger'),
    (a, now()::date, 'examen'), (a, now()::date, 'cards'), (b, now()::date, 'examen');
  d := public.ia_droits(a);
  insert into public.zz_res (nom, ok, vu) values ('à vie, pas au mois : deux sujets, une correction',
    (d->>'examens')::int = 2 and (d->>'corrections')::int = 1, d::text);
  insert into public.zz_res (nom, ok, vu) values ('le mois ne compte que ce mois (rien d''autre ne bouge)',
    (d->>'fait')::int = 2, d->>'fait');

  perform public.zz_comme(a);
  m := public.mon_ia();
  insert into public.zz_res (nom, ok, vu) values ('mon_ia dit ses examens à l''élève, pas ceux des autres',
    (m->>'examens')::int = 2, m::text);
  insert into public.zz_res (nom, ok, vu) values ('mon_ia garde ce qu''elle disait (gratuit : quota 0)',
    m->>'offre' = 'gratuit' and (m->>'quota')::int = 0 and (m->>'fait')::int = 2, m::text);

  perform public.zz_root();
  insert into public.zz_res (nom, ok, vu) values ('les droits : ia_droits au rôle service seul, mon_ia à authenticated',
    not has_function_privilege('authenticated', 'public.ia_droits(uuid)', 'execute')
    and not has_function_privilege('anon', 'public.ia_droits(uuid)', 'execute')
    and has_function_privilege('service_role', 'public.ia_droits(uuid)', 'execute')
    and has_function_privilege('authenticated', 'public.mon_ia()', 'execute')
    and not has_function_privilege('anon', 'public.mon_ia()', 'execute'), 'droits');
end $$;

select n, ok, nom, vu from public.zz_res order by n;
rollback;
