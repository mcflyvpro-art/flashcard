-- Tests de la migration 20261027090000_les_pseudos_ont_des_regles : un
-- pseudo pour tous, dans la règle, unique au point et au tiret bas près, qui
-- ne se change que par changer_pseudo. Même mode que classes_securisees.sql :
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
  oa uuid := gen_random_uuid(); a uuid := gen_random_uuid(); b uuid := gen_random_uuid();
  c uuid := gen_random_uuid(); e uuid := gen_random_uuid(); n1 uuid := gen_random_uuid();
  n2 uuid := gen_random_uuid(); n3 uuid := gen_random_uuid(); n4 uuid := gen_random_uuid();
  u record; s text; t text; v jsonb; n integer;
begin
  insert into public.orgs (id, code, name) values (oa, 'ZZP', 'Lycée Pseudo');
  for u in select * from (values
      (a, 'eleve', null, 'Ana Zed', 'zzpse.ana'), (b, 'eleve', null, 'Bao Zed', 'zzpse.bao'),
      (c, 'eleve', null, 'Cyd Zed', 'zzpse.cyd'), (e, 'eleve', oa, 'Emma DURAND', 'zzpse.emma'))
      x(id, role, org, nom, pseudo) loop
    insert into auth.users (instance_id, id, aud, role, email)
    values ('00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', 'zz-' || u.id || '@exemple.invalid');
    insert into public.profiles (id, email, name, handle) values (u.id, 'zz-' || u.id || '@exemple.invalid', u.nom, u.pseudo);
    insert into public.user_roles (user_id, role) values (u.id, u.role)
    on conflict (user_id) do update set role = excluded.role;
    if u.org is not null then insert into public.org_members (user_id, org_id) values (u.id, u.org); end if;
  end loop;
  for u in select * from (values (n1), (n2), (n3), (n4)) x(id) loop
    insert into auth.users (instance_id, id, aud, role, email)
    values ('00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', 'zz-' || u.id || '@exemple.invalid');
  end loop;

  -- ══════════ un pseudo pour tous ══════════
  insert into public.profiles (id, email, name, handle) values (n1, 'zz1@exemple.invalid', 'Zoéline Martin', null);
  select handle into t from public.profiles where id = n1;
  insert into public.zz_res (nom, ok, vu) values ('sans pseudo, il en reçoit un tiré du prénom',
    t ~ '^zoeline[0-9]*$' and public.pseudo_motif(t) = 'ok', t);

  insert into public.profiles (id, email, name, handle) values (n2, 'zz2@exemple.invalid', null, 'Admin!!');
  select handle into t from public.profiles where id = n2;
  insert into public.zz_res (nom, ok, vu) values ('un pseudo hors de la règle est remplacé, sans nom : « lecteur »',
    t ~ '^lecteur[0-9]*$', t);

  insert into public.profiles (id, email, name, handle) values (n3, 'zz3@exemple.invalid', 'Ana Bis', 'zzpse_ana');
  select handle into t from public.profiles where id = n3;
  insert into public.zz_res (nom, ok, vu) values ('un pseudo déjà pris au tiret bas près est remplacé',
    t <> 'zzpse_ana' and public.cle_pseudo(t) <> 'zzpseana' and public.pseudo_motif(t) = 'ok', t);

  insert into public.zz_res (nom, ok, vu) values ('plus aucun compte sans pseudo ni hors de la règle',
    not exists (select 1 from public.profiles p where p.handle is null or public.pseudo_motif(p.handle) <> 'ok'),
    (select count(*)::text from public.profiles p where p.handle is null or public.pseudo_motif(p.handle) <> 'ok'));

  begin update public.profiles set handle = 'ab' where id = a; s := 'passé'; exception when others then s := sqlstate; end;
  insert into public.zz_res (nom, ok, vu) values ('même en base, un pseudo hors de la règle est refusé', s = '23514', s);
  begin update public.profiles set handle = 'zzpse_bao' where id = a; s := 'passé'; exception when others then s := sqlstate; end;
  insert into public.zz_res (nom, ok, vu) values ('même en base, deux comptes n''ont pas le même pseudo', s = '23505', s);

  -- ══════════ l'API brute n'écrit plus le pseudo ══════════
  perform public.zz_comme(a);
  begin update public.profiles set handle = 'zzpse.anna' where id = a; s := 'passé'; exception when others then s := sqlstate; end;
  insert into public.zz_res (nom, ok, vu) values ('changer son pseudo par l''API brute : refusé', s = '42501', s);
  update public.profiles set name = 'Ana Zed' where id = a;
  insert into public.zz_res (nom, ok, vu) values ('son nom, si', true, '');

  perform public.zz_comme(n4);
  begin insert into public.profiles (id, email, handle) values (n4, 'zz4@exemple.invalid', 'zzpse.nat'); s := 'passé';
  exception when others then s := sqlstate; end;
  insert into public.zz_res (nom, ok, vu) values ('créer sa ligne avec un pseudo choisi : refusé', s = '42501', s);
  insert into public.profiles (id, email, name) values (n4, 'zz4@exemple.invalid', 'Nat Zed')
  on conflict (id) do update set id = excluded.id, email = excluded.email, name = excluded.name;
  insert into public.profiles (id, email, name) values (n4, 'zz4@exemple.invalid', 'Nat Zed')
  on conflict (id) do update set id = excluded.id, email = excluded.email, name = excluded.name;
  select handle into t from public.profiles where id = n4;
  insert into public.zz_res (nom, ok, vu) values ('la ligne que l''app écrit à chaque connexion passe, et reçoit un pseudo',
    t ~ '^nat[0-9]*$', t);

  -- ══════════ ce que l'écran demande pendant la frappe ══════════
  perform public.zz_comme(a);
  select string_agg(x.p || '=' || (public.pseudo_libre(x.p)->>'statut'), ' ' order by x.i) into t
  from (values (1, 'ab'), (2, 'lea-martin'), (3, '1lea'), (4, 'lea.'), (5, 'lea..m'), (6, 'lea.admin'),
               (7, 'folioman'), (8, 'c0nn4rd'), (9, 'xx.con'), (10, 'calcul'), (11, 'zzpse.ana'),
               (12, 'ZZPSE_BAO'), (13, 'abcdefghijklmnopqrstu'), (14, '@zzpse.neuf')) x(i, p);
  insert into public.zz_res (nom, ok, vu) values ('pseudo_libre dit ce qui ne va pas, dans l''ordre de la règle',
    t = 'ab=court lea-martin=caracteres 1lea=debut lea.=fin lea..m=double lea.admin=reserve folioman=reserve '
     || 'c0nn4rd=interdit xx.con=interdit calcul=ok zzpse.ana=meme ZZPSE_BAO=pris abcdefghijklmnopqrstu=long @zzpse.neuf=ok', t);
  v := public.pseudo_libre('zzpse.bao');
  insert into public.zz_res (nom, ok, vu) values ('un pseudo pris vient avec une variante libre',
    v->>'statut' = 'pris' and public.pseudo_motif(v->>'suggestion') = 'ok' and v->>'suggestion' like 'zzpse.bao%'
    and not exists (select 1 from public.profiles p where public.cle_pseudo(p.handle) = public.cle_pseudo(v->>'suggestion')), v::text);

  -- ══════════ changer_pseudo : la seule porte ══════════
  v := public.changer_pseudo('Zzpse.Anouk');
  select handle into t from public.profiles where id = a;
  insert into public.zz_res (nom, ok, vu) values ('changer son pseudo : écrit en minuscules, au journal',
    v->>'statut' = 'ok' and t = 'zzpse.anouk'
    and exists (select 1 from public.pseudo_journal j where j.user_id = a and j.ancien = 'zzpse.ana' and j.nouveau = 'zzpse.anouk'), v::text || ' ' || t);
  v := public.changer_pseudo('zzpse_bao');
  insert into public.zz_res (nom, ok, vu) values ('le pseudo d''un autre : pris', v->>'statut' = 'pris', v::text);
  v := public.changer_pseudo('zz.connard');
  insert into public.zz_res (nom, ok, vu) values ('hors de la règle : le verdict, rien d''écrit', v->>'statut' = 'interdit'
    and (select handle from public.profiles where id = a) = 'zzpse.anouk', v::text);
  v := public.changer_pseudo('zzpse.ana2');
  v := public.changer_pseudo('zzpse.ana3');
  select handle into t from public.profiles where id = a;
  insert into public.zz_res (nom, ok, vu) values ('deux changements par semaine, pas trois',
    v->>'statut' = 'trop' and v ? 'jusqua' and t = 'zzpse.ana2', v::text || ' ' || t);

  perform public.zz_comme(c);
  v := public.changer_pseudo('zzpse.ana');
  insert into public.zz_res (nom, ok, vu) values ('un pseudo quitté reste à son ancien titulaire 30 jours',
    v->>'statut' = 'pris', v::text);
  v := public.changer_pseudo('zzpse.anouk');
  insert into public.zz_res (nom, ok, vu) values ('même celui qu''il n''a gardé qu''un instant', v->>'statut' = 'pris', v::text);

  -- ══════════ l'élève d'établissement ══════════
  perform public.zz_comme(e);
  v := public.changer_pseudo('zzpse.emmy');
  update public.profiles set name = 'Emmy La Best' where id = e;
  perform public.zz_root();
  select p.name || '/' || p.handle into t from public.profiles p where p.id = e;
  insert into public.zz_res (nom, ok, vu) values ('un élève d''établissement change son pseudo, pas son nom',
    v->>'statut' = 'ok' and t = 'Emma DURAND/zzpse.emmy', t);

  -- ══════════ trouver quelqu'un, lire le journal ══════════
  perform public.zz_comme(c);
  select f.id into u from public.find_user('@ZZPSE_bao') f;
  insert into public.zz_res (nom, ok, vu) values ('trouver quelqu''un au point et au tiret bas près', u.id = b, coalesce(u.id::text, 'personne'));
  select count(*) into n from public.pseudo_journal;
  insert into public.zz_res (nom, ok, vu) values ('le journal des pseudos : chacun ne lit que le sien', n = 0, n::text);
  begin insert into public.pseudo_journal (user_id, ancien, nouveau) values (c, 'x', 'zzpse.triche'); s := 'passé';
  exception when others then s := sqlstate; end;
  insert into public.zz_res (nom, ok, vu) values ('et n''y écrit pas', s = '42501', s);
  perform public.zz_comme(a);
  select count(*) into n from public.pseudo_journal;
  insert into public.zz_res (nom, ok, vu) values ('le sien, oui', n = 2, n::text);

  -- ══════════ le référent corrige, dans la règle ══════════
  perform public.zz_root();
  insert into public.user_roles (user_id, role) values (n1, 'ref') on conflict (user_id) do update set role = 'ref';
  insert into public.org_members (user_id, org_id) values (n1, oa);
  perform public.zz_comme(n1);
  begin perform public.ref_update_account(e, null, 'Pas Bien!', null); s := 'passé'; exception when others then s := sqlstate; end;
  insert into public.zz_res (nom, ok, vu) values ('le référent ne pose pas un pseudo hors de la règle', s = '23514', s);
  perform public.ref_update_account(e, null, 'zzpse.emma.d', null);
  perform public.zz_root();
  insert into public.zz_res (nom, ok, vu) values ('dans la règle, si',
    (select handle from public.profiles where id = e) = 'zzpse.emma.d', (select handle from public.profiles where id = e));

  -- ══════════ les droits ══════════
  insert into public.zz_res (nom, ok, vu) values ('anon ne vérifie ni ne change aucun pseudo',
    not has_function_privilege('anon', 'public.changer_pseudo(text)', 'execute')
    and not has_function_privilege('anon', 'public.pseudo_libre(text)', 'execute')
    and not has_table_privilege('anon', 'public.pseudo_journal', 'select')
    and not has_column_privilege('anon', 'public.profiles', 'handle', 'update'), '');
  insert into public.zz_res (nom, ok, vu) values ('fonctions internes fermées',
    not has_function_privilege('authenticated', 'public.pseudo_pris(text, uuid)', 'execute')
    and not has_function_privilege('authenticated', 'public.pseudo_neuf(text, uuid)', 'execute')
    and not has_function_privilege('authenticated', 'public.profiles_pseudo()', 'execute')
    and not has_column_privilege('authenticated', 'public.profiles', 'handle', 'update')
    and not has_column_privilege('authenticated', 'public.profiles', 'handle', 'insert')
    and has_column_privilege('authenticated', 'public.profiles', 'name', 'update'), '');
end $$;

select n, ok, nom, vu from public.zz_res order by n;

rollback;
