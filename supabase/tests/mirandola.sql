-- Tests de la migration 20261028090000_mirandola : le montant d'un
-- abonnement rendu par mon_offre(), plus un « Folio » dans ce que la base
-- renvoie, le pseudo « mirandola » réservé. Même mode que abonnements.sql :
-- transaction ANNULÉE, comptes jetables, vrai rôle `authenticated`.

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
  lea uuid := gen_random_uuid(); tom uuid := gen_random_uuid(); u record;
  j jsonb; n integer; refus text;
begin
  for u in select * from (values (lea, 'zzleami'), (tom, 'zztommi')) x(id, pseudo) loop
    insert into auth.users (instance_id, id, aud, role, email)
    values ('00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', 'zz-' || u.id || '@exemple.invalid');
    insert into public.profiles (id, email, name, handle)
    values (u.id, 'zz-' || u.id || '@exemple.invalid', u.pseudo, u.pseudo)
    on conflict (id) do update set name = excluded.name, handle = excluded.handle;
  end loop;
  insert into public.abonnements (user_id, statut, formule, source, client_stripe, abonnement_stripe, fin_periode, montant) values
    (lea, 'actif', 'annuel', 'stripe', 'cus_zz_lea', 'sub_zz_lea', now() + interval '300 days', 4999);
  insert into public.abonnements (user_id, statut, formule, source, fin_periode) values
    (tom, 'actif', null, 'offert', null)
  on conflict (user_id, source) do nothing;

  -- ══════════ le montant ══════════
  perform public.zz_comme(lea);
  j := public.mon_offre();
  insert into public.zz_res (nom, ok, vu) values ('mon_offre rend le montant de l''abonnement',
    (j->'abonnement'->>'montant')::int = 4999, j::text);
  perform public.zz_comme(tom);
  j := public.mon_offre();
  insert into public.zz_res (nom, ok, vu) values ('offert : le montant est nul, la clé est là',
    (j->'abonnement') ? 'montant' and j->'abonnement'->'montant' = 'null'::jsonb, j::text);
  perform public.zz_root();
  begin
    update public.abonnements set montant = -1 where user_id = lea;
    refus := 'accepté';
  exception when check_violation then refus := sqlstate;
  end;
  insert into public.zz_res (nom, ok, vu) values ('un montant négatif : refusé', refus = '23514', refus);

  -- ══════════ le nom ══════════
  select count(*) into n from pg_proc p join pg_namespace s on s.oid = p.pronamespace
  where s.nspname = 'public' and p.prosrc like '%Folio%';
  insert into public.zz_res (nom, ok, vu) values ('plus une fonction qui dise « Folio »', n = 0, n::text);
  insert into public.zz_res (nom, ok, vu) values ('delete_me parle de Mirandola+ et du geste « Résilier l''abonnement »',
    exists (select 1 from pg_proc where proname = 'delete_me' and prosrc like '%Mirandola+%'
      and prosrc like '%Résilier l''''abonnement%'), 'delete_me');
  insert into public.zz_res (nom, ok, vu) values ('les droits de mon_offre n''ont pas bougé',
    has_function_privilege('authenticated', 'public.mon_offre()', 'execute')
    and not has_function_privilege('anon', 'public.mon_offre()', 'execute'), 'droits');
  insert into public.zz_res (nom, ok, vu) values ('les fonctions réécrites gardent leurs droits : delete_me',
    has_function_privilege('authenticated', 'public.delete_me()', 'execute')
    and not has_function_privilege('anon', 'public.delete_me()', 'execute'), 'droits');

  -- ══════════ les pseudos ══════════
  insert into public.zz_res (nom, ok, vu) values ('« mirandola » réservé, comme mot et comme début',
    public.pseudo_motif('mirandola') = 'reserve' and public.pseudo_motif('mirandola_officiel') = 'reserve'
    and public.pseudo_motif('lea.mirandola') = 'reserve', public.pseudo_motif('mirandola_officiel'));
  insert into public.zz_res (nom, ok, vu) values ('« folio » reste réservé, un pseudo honnête passe',
    public.pseudo_motif('folio') = 'reserve' and public.pseudo_motif('lea.martin') = 'ok', public.pseudo_motif('folio'));
end $$;

select n, ok, nom, vu from public.zz_res order by n;
rollback;
