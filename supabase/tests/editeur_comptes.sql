-- Tests de la migration 20261105122753_editeur_tous_les_comptes : la liste
-- de tous les comptes et la main de l'éditeur sur chacun (supprimer,
-- suspendre, confirmer). Même mode que les autres : transaction ANNULÉE,
-- comptes jetables, vrai rôle `authenticated`. Pour lire le bilan avec
-- execute_sql, remplacer le select final et le rollback par
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
  zoe uuid := gen_random_uuid(); u record; r record; n integer; refus text; d uuid := gen_random_uuid();
begin
  for u in select * from (values (ed, 'zzediteur'), (lea, 'zzleacpt'), (tom, 'zztomcpt'), (zoe, 'zzzoecpt')) x(id, pseudo) loop
    insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at)
    values ('00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated',
      'zz-' || u.id || '@exemple.invalid', case when u.id = tom then null else now() end);
    insert into public.profiles (id, email, name, handle)
    values (u.id, 'zz-' || u.id || '@exemple.invalid', u.pseudo, u.pseudo)
    on conflict (id) do update set name = excluded.name, handle = excluded.handle;
  end loop;
  insert into public.user_roles (user_id, role) values (ed, 'admin');
  insert into public.decks (id, user_id, name) values (d, lea, 'Histoire');
  insert into public.abonnements (user_id, statut, formule, source, client_stripe, abonnement_stripe, fin_periode) values
    (zoe, 'actif', 'annuel', 'stripe', 'cus_zz_zoe', 'sub_zz_zoe', now() + interval '300 days');
  insert into auth.sessions (id, user_id, created_at, updated_at, aal) values (gen_random_uuid(), lea, now(), now(), 'aal1');

  -- ══════════ la liste ══════════
  perform public.zz_comme(ed);
  select * into r from public.admin_comptes() c where c.id = lea;
  insert into public.zz_res (nom, ok, vu) values ('l’éditeur voit un compte, ses livres, son adresse confirmée, son offre',
    r.livres = 1 and r.confirme and r.offre = 'gratuit' and r.handle = 'zzleacpt' and r.suspendu is null, row_to_json(r)::text);
  select * into r from public.admin_comptes() c where c.id = tom;
  insert into public.zz_res (nom, ok, vu) values ('une adresse jamais confirmée se voit', not r.confirme, row_to_json(r)::text);
  select * into r from public.admin_comptes() c where c.id = zoe;
  insert into public.zz_res (nom, ok, vu) values ('un abonné Stripe se voit en Mirandola+', r.offre = 'plus', r.offre);
  select count(*) into n from public.admin_comptes();
  perform public.zz_root();
  insert into public.zz_res (nom, ok, vu) values ('une ligne par compte, tous les comptes',
    n = (select count(*) from auth.users), n::text);

  perform public.zz_comme(lea);
  select count(*) into n from public.admin_comptes();
  insert into public.zz_res (nom, ok, vu) values ('un autre compte ne voit rien', n = 0, n::text);
  begin perform public.admin_supprimer_compte(tom); refus := 'accepté';
  exception when others then refus := sqlstate; end;
  perform public.zz_root();
  insert into public.zz_res (nom, ok, vu) values ('un autre compte ne supprime personne',
    refus = '42501' and exists (select 1 from auth.users where id = tom), refus);
  perform public.zz_comme(lea);
  begin perform public.admin_suspendre(tom, now() + interval '1 day'); refus := 'accepté';
  exception when others then refus := sqlstate; end;
  insert into public.zz_res (nom, ok, vu) values ('ni ne suspend', refus = '42501', refus);
  begin perform public.admin_confirmer(tom); refus := 'accepté';
  exception when others then refus := sqlstate; end;
  insert into public.zz_res (nom, ok, vu) values ('ni ne confirme', refus = '42501', refus);

  -- ══════════ confirmer, suspendre, rétablir ══════════
  perform public.zz_comme(ed);
  perform public.admin_confirmer(tom);
  select * into r from public.admin_comptes() c where c.id = tom;
  insert into public.zz_res (nom, ok, vu) values ('l’éditeur confirme une adresse', r.confirme, row_to_json(r)::text);

  perform public.admin_suspendre(lea, now() + interval '7 days');
  select * into r from public.admin_comptes() c where c.id = lea;
  insert into public.zz_res (nom, ok, vu) values ('suspendu : la date se voit',
    r.suspendu > now() + interval '6 days', coalesce(r.suspendu::text, 'nul'));
  perform public.zz_root();
  select count(*) into n from auth.sessions where user_id = lea;
  insert into public.zz_res (nom, ok, vu) values ('suspendu : ses sessions sont fermées', n = 0, n::text);
  insert into public.zz_res (nom, ok, vu) values ('suspendu : Supabase Auth le refuse (banned_until)',
    (select banned_until from auth.users where id = lea) > now(), 'banned_until');
  perform public.zz_comme(ed);
  perform public.admin_suspendre(lea, null);
  select * into r from public.admin_comptes() c where c.id = lea;
  insert into public.zz_res (nom, ok, vu) values ('rétabli', r.suspendu is null, coalesce(r.suspendu::text, 'nul'));
  begin perform public.admin_suspendre(lea, now() - interval '1 day'); refus := 'accepté';
  exception when others then refus := sqlerrm; end;
  insert into public.zz_res (nom, ok, vu) values ('une date passée : refusée', refus like 'Une date%', refus);
  begin perform public.admin_suspendre(ed, now() + interval '1 day'); refus := 'accepté';
  exception when others then refus := sqlerrm; end;
  insert into public.zz_res (nom, ok, vu) values ('on ne se suspend pas soi-même', refus like 'On ne se suspend%', refus);

  -- ══════════ supprimer ══════════
  begin perform public.admin_supprimer_compte(ed); refus := 'accepté';
  exception when others then refus := sqlerrm; end;
  perform public.zz_root();
  insert into public.zz_res (nom, ok, vu) values ('on ne se supprime pas soi-même ici',
    refus like 'Ton propre compte%' and exists (select 1 from auth.users where id = ed), refus);
  perform public.zz_comme(ed);
  begin perform public.admin_supprimer_compte(zoe); refus := 'accepté';
  exception when others then refus := sqlerrm; end;
  perform public.zz_root();
  insert into public.zz_res (nom, ok, vu) values ('un abonnement Stripe qui court bloque la suppression',
    refus like 'Son abonnement%' and exists (select 1 from auth.users where id = zoe), refus);
  update public.abonnements set fin_prevue = true where user_id = zoe;
  perform public.zz_comme(ed);
  perform public.admin_supprimer_compte(zoe);
  perform public.zz_root();
  insert into public.zz_res (nom, ok, vu) values ('résilié : il se supprime',
    not exists (select 1 from auth.users where id = zoe), 'zoe');

  perform public.zz_comme(ed);
  perform public.admin_supprimer_compte(lea);
  perform public.zz_root();
  insert into public.zz_res (nom, ok, vu) values ('supprimé : le compte, son profil, ses livres partent',
    not exists (select 1 from auth.users where id = lea) and not exists (select 1 from public.profiles where id = lea)
    and not exists (select 1 from public.decks where id = d), 'lea');
  perform public.zz_comme(ed);
  begin perform public.admin_supprimer_compte(lea); refus := 'accepté';
  exception when others then refus := sqlerrm; end;
  insert into public.zz_res (nom, ok, vu) values ('deux fois : « n’existe plus »', refus like 'Ce compte n’existe plus%', refus);

  -- ══════════ les droits ══════════
  perform public.zz_root();
  insert into public.zz_res (nom, ok, vu) values ('anon n’exécute aucune des quatre',
    not has_function_privilege('anon', 'public.admin_comptes()', 'execute')
    and not has_function_privilege('anon', 'public.admin_supprimer_compte(uuid)', 'execute')
    and not has_function_privilege('anon', 'public.admin_suspendre(uuid, timestamptz)', 'execute')
    and not has_function_privilege('anon', 'public.admin_confirmer(uuid)', 'execute'), 'droits');
  insert into public.zz_res (nom, ok, vu) values ('authenticated les exécute (chacune vérifie l’éditeur)',
    has_function_privilege('authenticated', 'public.admin_comptes()', 'execute')
    and has_function_privilege('authenticated', 'public.admin_supprimer_compte(uuid)', 'execute'), 'droits');
end $$;

select n, ok, nom, vu from public.zz_res order by n;
rollback;
