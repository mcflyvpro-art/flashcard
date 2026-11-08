-- Tests de la migration 20261107232536_defis_a_son_rythme_reglables : le jeu
-- d'un défi à son rythme. Transaction ANNULÉE, compte jetable, vrai rôle
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
grant execute on function public.zz_comme(uuid) to authenticated;

do $$
declare
  lea uuid := gen_random_uuid(); tom uuid := gen_random_uuid(); j text; refus text;
begin
  insert into auth.users (instance_id, id, aud, role, email) values
    ('00000000-0000-0000-0000-000000000000', lea, 'authenticated', 'authenticated', 'zz-' || lea || '@exemple.invalid'),
    ('00000000-0000-0000-0000-000000000000', tom, 'authenticated', 'authenticated', 'zz-' || tom || '@exemple.invalid');

  perform public.zz_comme(lea);
  insert into public.duels (owner, name, total, cards) values (lea, 'Italien', 2, '[["merci","grazie"],["la gare","la stazione"]]')
    returning jeu into j;
  insert into public.zz_res (nom, ok, vu) values ('sans jeu (une app d’avant) : un QCM', j = 'qcm', j);
  insert into public.duels (owner, name, total, cards, jeu)
    values (lea, 'Italien', 2, '[["merci","grazie","il treno"],["la gare","la stazione","la stazione"]]', 'vf') returning jeu into j;
  insert into public.zz_res (nom, ok, vu) values ('vrai ou faux, la proposée en troisième case', j = 'vf', j);
  insert into public.duels (owner, name, total, cards, jeu) values (lea, 'Italien', 1, '[["merci","grazie"]]', 'ecrit')
    returning jeu into j;
  insert into public.zz_res (nom, ok, vu) values ('réponse écrite', j = 'ecrit', j);
  begin
    insert into public.duels (owner, name, total, cards, jeu) values (lea, 'Italien', 1, '[["merci","grazie"]]', 'pendu');
    refus := 'passe';
  exception when others then refus := sqlstate;
  end;
  insert into public.zz_res (nom, ok, vu) values ('un jeu inconnu : refusé', refus = '23514', refus);
  begin
    insert into public.duels (owner, name, total, cards, jeu) values (tom, 'Italien', 1, '[["merci","grazie"]]', 'vf');
    refus := 'passe';
  exception when others then refus := sqlstate;
  end;
  insert into public.zz_res (nom, ok, vu) values ('au nom d’un autre : refusé, comme avant', refus = '42501', refus);
  insert into public.zz_res (nom, ok, vu) values ('le jeu se relit',
    (select count(*) from public.duels where owner = lea and jeu in ('vf', 'ecrit')) = 2, 'lecture');
end $$;

select n, ok, nom, vu from public.zz_res order by n;
rollback;
