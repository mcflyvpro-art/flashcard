-- Tests de la migration 20261106054530_examens_blancs : qui lit, écrit et
-- efface un examen blanc, et ce qui part avec un livre ou un compte.
-- Transaction ANNULÉE, comptes jetables, vrai rôle `authenticated`. Pour
-- lire le bilan avec execute_sql, remplacer le select final et le rollback par
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
  lea uuid := gen_random_uuid(); tom uuid := gen_random_uuid();
  livre uuid := gen_random_uuid(); autre uuid := gen_random_uuid(); ex uuid; n int; refus text;
begin
  insert into auth.users (instance_id, id, aud, role, email) values
    ('00000000-0000-0000-0000-000000000000', lea, 'authenticated', 'authenticated', 'zz-' || lea || '@exemple.invalid'),
    ('00000000-0000-0000-0000-000000000000', tom, 'authenticated', 'authenticated', 'zz-' || tom || '@exemple.invalid');
  insert into public.decks (id, user_id, name) values (livre, lea, 'Histoire'), (autre, tom, 'Chimie');

  -- ══════════ écrire ══════════
  perform public.zz_comme(lea);
  insert into public.examens (deck_id, note, questions, justes, copie, detail)
  values (livre, 14.5, 10, 7, 'photo', '{"bilan":"Revois 1789."}') returning id into ex;
  insert into public.zz_res (nom, ok, vu) values ('Léa écrit un examen sur son livre', ex is not null, ex::text);

  begin
    insert into public.examens (deck_id, note, questions, justes) values (autre, 20, 10, 10);
    refus := 'accepté';
  exception when insufficient_privilege then refus := sqlstate;
  end;
  insert into public.zz_res (nom, ok, vu) values ('pas sur le livre d’un autre', refus = '42501', refus);

  begin
    insert into public.examens (user_id, deck_id, note, questions, justes) values (tom, livre, 20, 10, 10);
    refus := 'accepté';
  exception when insufficient_privilege then refus := sqlstate;
  end;
  insert into public.zz_res (nom, ok, vu) values ('pas au nom d’un autre', refus = '42501', refus);

  begin
    insert into public.examens (deck_id, note, questions, justes) values (livre, 21, 10, 10);
    refus := 'accepté';
  exception when check_violation then refus := sqlstate;
  end;
  insert into public.zz_res (nom, ok, vu) values ('une note au-delà de 20 : refusée', refus = '23514', refus);

  begin
    insert into public.examens (deck_id, note, questions, justes) values (livre, 10, 5, 6);
    refus := 'accepté';
  exception when check_violation then refus := sqlstate;
  end;
  insert into public.zz_res (nom, ok, vu) values ('plus de justes que de questions : refusé', refus = '23514', refus);

  -- ══════════ lire, modifier ══════════
  perform public.zz_comme(tom);
  select count(*) into n from public.examens;
  insert into public.zz_res (nom, ok, vu) values ('Tom ne voit pas les examens de Léa', n = 0, n::text);
  delete from public.examens where id = ex;
  perform public.zz_comme(lea);
  select count(*) into n from public.examens where id = ex;
  insert into public.zz_res (nom, ok, vu) values ('ni ne les efface', n = 1, n::text);

  begin
    update public.examens set note = 20 where id = ex;
    refus := 'accepté';
  exception when insufficient_privilege then refus := sqlstate;
  end;
  insert into public.zz_res (nom, ok, vu) values ('une note ne se réécrit pas, même par Léa', refus = '42501', refus);

  -- ══════════ avec le livre, avec le compte ══════════
  perform public.zz_root();
  update public.decks set deleted_at = now() where id = livre;
  select count(*) into n from public.examens where deck_id = livre;
  insert into public.zz_res (nom, ok, vu) values ('livre à la corbeille : ses examens restent', n = 1, n::text);
  delete from public.decks where id = livre;
  select count(*) into n from public.examens where deck_id = livre;
  insert into public.zz_res (nom, ok, vu) values ('livre supprimé pour de bon : ses examens partent', n = 0, n::text);

  insert into public.decks (id, user_id, name) values (livre, lea, 'Histoire');
  insert into public.examens (user_id, deck_id, note, questions, justes) values (lea, livre, 12, 10, 6);
  delete from auth.users where id = lea;
  select count(*) into n from public.examens where user_id = lea;
  insert into public.zz_res (nom, ok, vu) values ('compte supprimé : ses examens partent', n = 0, n::text);

  -- ══════════ les droits ══════════
  insert into public.zz_res (nom, ok, vu) values ('anon : rien',
    not has_table_privilege('anon', 'public.examens', 'select')
    and not has_table_privilege('anon', 'public.examens', 'insert'), 'droits');
  insert into public.zz_res (nom, ok, vu) values ('RLS active, deux_etapes restrictive',
    (select relrowsecurity from pg_class where oid = 'public.examens'::regclass)
    and exists (select 1 from pg_policies where tablename = 'examens' and policyname = 'deux_etapes' and permissive = 'RESTRICTIVE'), 'rls');
end $$;

select n, ok, nom, vu from public.zz_res order by n;
rollback;
