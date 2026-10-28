-- Tests de la migration 20261027210000_folio_plus_pour_tous : une ligne par
-- source, l'offre d'un compte (offre_de, interne), les médias réservés à
-- Mirandola+ et Campus, les comptes d'avant la migration qui gardent tout,
-- Mirandola+ offert par l'éditeur et vu sur le jeton. Même mode que
-- abonnements.sql : transaction ANNULÉE, comptes jetables, vrai rôle
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
  lea uuid := gen_random_uuid(); zed uuid := gen_random_uuid(); adm uuid := gen_random_uuid();
  u record; j jsonb; n integer; refus text; b boolean;
begin
  for u in select * from (values (lea, 'zzleafp'), (zed, 'zzzedfp'), (adm, 'zzadmfp')) x(id, pseudo) loop
    insert into auth.users (instance_id, id, aud, role, email)
    values ('00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', 'zz-' || u.id || '@exemple.invalid');
    insert into public.profiles (id, email, name, handle)
    values (u.id, 'zz-' || u.id || '@exemple.invalid', u.pseudo, u.pseudo)
    on conflict (id) do update set name = excluded.name, handle = excluded.handle;
  end loop;
  insert into public.user_roles (user_id, role) values (adm, 'admin')
    on conflict (user_id) do update set role = excluded.role;

  -- ══════════ les comptes d'avant la migration ══════════
  select count(*) into n from auth.users x
  where x.created_at < (select min(a.cree_le) from public.abonnements a where a.source = 'offert')
    and not exists (select 1 from public.user_roles r where r.user_id = x.id and r.role in ('ref', 'admin'))
    and not exists (select 1 from public.abonnements a where a.user_id = x.id and a.source = 'offert');
  insert into public.zz_res (nom, ok, vu) values ('chaque compte d''avant la migration a Mirandola+ offert', n = 0, n::text);

  -- ══════════ une ligne par source ══════════
  insert into public.abonnements (user_id, statut, source, formule, client_stripe, abonnement_stripe, fin_periode) values
    (lea, 'fini', 'stripe', 'mensuel', 'cus_zz_leafp', 'sub_zz_leafp', now() - interval '3 days');
  insert into public.abonnements (user_id, statut, source, formule, fin_periode) values
    (lea, 'actif', 'apple', 'annuel', now() + interval '200 days');
  perform public.zz_comme(lea);
  j := public.mon_offre();
  insert into public.zz_res (nom, ok, vu) values ('Stripe fini, Apple qui court : Mirandola+, et l''abonnement Apple dit',
    j->>'offre' = 'plus' and j->'abonnement'->>'source' = 'apple' and j->'abonnement'->>'formule' = 'annuel', j::text);
  perform public.zz_comme(zed);
  j := public.mon_offre();
  insert into public.zz_res (nom, ok, vu) values ('un compte neuf : Mirandola gratuit', j->>'offre' = 'gratuit', j::text);

  -- ══════════ offre_de est interne ══════════
  begin
    perform public.offre_de(lea);
    refus := 'passe';
  exception when others then refus := sqlstate;
  end;
  insert into public.zz_res (nom, ok, vu) values ('l''offre d''un autre compte : refusée', refus = '42501', refus);

  -- ══════════ les médias ══════════
  begin
    insert into storage.objects (bucket_id, name, owner) values ('media', zed::text || '/zz.png', zed);
    refus := 'passe';
  exception when others then refus := sqlstate;
  end;
  insert into public.zz_res (nom, ok, vu) values ('Mirandola gratuit : déposer une image refusé', refus = '42501', refus);
  insert into public.zz_res (nom, ok, vu) values ('la règle des médias : une politique restrictive par écriture',
    (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects'
       and policyname in ('media_folio_plus', 'media_folio_plus_maj') and permissive = 'RESTRICTIVE') = 2, 'politiques');

  -- ══════════ offrir Mirandola+ ══════════
  perform public.zz_comme(lea);
  begin
    perform public.admin_offrir_plus(zed);
    refus := 'passe';
  exception when others then refus := sqlstate;
  end;
  insert into public.zz_res (nom, ok, vu) values ('offrir Mirandola+ : l''éditeur seul', refus = '42501', refus);
  perform public.zz_comme(adm);
  j := public.admin_offrir_plus(zed, now() + interval '30 days');
  insert into public.zz_res (nom, ok, vu) values ('l''éditeur offre Mirandola+ pour 30 jours', j->>'offre' = 'plus', j::text);
  perform public.zz_comme(zed);
  j := public.mon_offre();
  insert into public.zz_res (nom, ok, vu) values ('le compte le voit : offert, avec sa fin',
    j->>'offre' = 'plus' and j->'abonnement'->>'source' = 'offert' and j->'abonnement'->>'fin_periode' is not null, j::text);
  perform public.zz_comme(adm);
  j := public.admin_offrir_plus(zed, null, true);
  insert into public.zz_res (nom, ok, vu) values ('l''éditeur le reprend', j->>'offre' = 'gratuit', j::text);
  begin
    perform public.admin_offrir_plus(zed, now() - interval '1 day');
    refus := 'passe';
  exception when others then refus := sqlstate;
  end;
  insert into public.zz_res (nom, ok, vu) values ('offrir jusqu''à une date passée : refusé', refus = '22023', refus);

  -- ══════════ Mirandola+ sur le jeton ══════════
  perform public.zz_comme(lea);
  select v.plus into b from public.visuels(array[lea], '{}') v where v.id = lea;
  insert into public.zz_res (nom, ok, vu) values ('visuels dit Mirandola+', b is true, coalesce(b::text, 'nul'));

  -- ══════════ les droits ══════════
  insert into public.zz_res (nom, ok, vu) values ('offre_de : ni authenticated ni anon',
    not has_function_privilege('authenticated', 'public.offre_de(uuid)', 'execute')
    and not has_function_privilege('anon', 'public.offre_de(uuid)', 'execute'), 'droits');
  insert into public.zz_res (nom, ok, vu) values ('admin_offrir_plus : pas anon',
    not has_function_privilege('anon', 'public.admin_offrir_plus(uuid, timestamptz, boolean)', 'execute'), 'droits');
  insert into public.zz_res (nom, ok, vu) values ('visuels : pas anon',
    not has_function_privilege('anon', 'public.visuels(uuid[], uuid[])', 'execute'), 'droits');
end $$;

select n, ok, nom, vu from public.zz_res order by n;
rollback;
