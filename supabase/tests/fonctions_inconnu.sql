-- L'attaque d'un inconnu (2026-11-06, M10.T3) : on sème un petit monde —
-- un établissement (son référent, un professeur, une élève dans sa classe),
-- une professeure particulière (sa classe, son élève, un devoir, une partie
-- en direct), un club, un livre, une facture —, puis un compte neuf, sans
-- rôle, sans établissement, sans ami ni classe, appelle CHAQUE fonction
-- security definer ouverte à `authenticated`, avec chacun de ces
-- identifiants, qui ne sont pas à lui. Ce qu'il en tire est noté sans jamais
-- son contenu : un nombre de lignes, une longueur, les clés et le statut d'un
-- jsonb. Une fonction qui rend quelque chose à un inconnu doit être sur la
-- liste des attendus (ce qu'elle rend est à lui, ou un statut qui ne dit
-- rien), sinon le cas échoue. Transaction ANNULÉE, comptes jetables.
-- Pour lire le bilan par MCP execute_sql : remplacer le select final et le
-- rollback par un `do $$ begin raise exception 'RESULTATS %', ...; end $$;`.

begin;

create table public.zz_res (n serial primary key, nom text, ok boolean, vu text);
create table public.zz_vu (fn text, cible text, quoi text);
create table public.zz_cibles (k serial, nom text, id uuid);
grant all on public.zz_res, public.zz_vu, public.zz_cibles to authenticated;
grant all on sequence public.zz_res_n_seq, public.zz_cibles_k_seq to authenticated;
create function public.zz_comme(u uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function public.zz_root() returns void language plpgsql as $$
begin perform set_config('role', 'postgres', true); end $$;
grant execute on function public.zz_comme(uuid), public.zz_root() to authenticated;

-- ══════════ le monde des victimes ══════════
do $$
declare
  adm uuid := gen_random_uuid(); dir uuid := gen_random_uuid(); jean uuid := gen_random_uuid();
  emma uuid := gen_random_uuid(); lea uuid := gen_random_uuid(); tom uuid := gen_random_uuid();
  zoe uuid := gen_random_uuid(); u record; j jsonb; o uuid; ce text; cp text; c1 uuid; cp1 uuid;
  aid uuid; sid uuid; gid uuid; fid uuid; livre uuid := gen_random_uuid();
  q3 jsonb := '[{"e":"bonjour","c":["ciao","buongiorno","grazie","prego"],"b":1,"r":"buongiorno"},
                {"e":"merci","c":["grazie","ciao","prego","scusi"],"b":0,"r":"grazie"},
                {"e":"la gare","c":["la stazione","il treno","la piazza","il porto"],"b":0,"r":"la stazione"}]';
begin
  for u in select * from (values
      (adm, 'zzadm', 'admin'), (dir, 'zzdir', null), (jean, 'zzjean', null), (emma, 'zzemma', null),
      (lea, 'zzlea', 'prof'), (tom, 'zztom', null), (zoe, 'zzzoe', null)) x(id, pseudo, role) loop
    insert into auth.users (instance_id, id, aud, role, email)
    values ('00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', 'zz-' || u.id || '@exemple.invalid');
    insert into public.profiles (id, email, name, handle)
    values (u.id, 'zz-' || u.id || '@exemple.invalid', u.pseudo, u.pseudo)
    on conflict (id) do update set name = excluded.name, handle = excluded.handle;
    if u.role is not null then
      insert into public.user_roles (user_id, role) values (u.id, u.role) on conflict (user_id) do update set role = excluded.role;
    end if;
  end loop;

  -- un établissement : le référent, un professeur, une élève dans sa classe
  perform public.zz_comme(adm);
  o := public.admin_etab_enregistrer(null, '{"nom":"ZZ Lycée Attaque","ville":"Nîmes"}'::jsonb);
  j := public.admin_lancer_demo(o, 30, 30, true);
  perform public.zz_comme(dir); perform public.rejoindre(j->>'code_ref', 'Marie', 'Curie');
  perform public.zz_root();
  select k.eleve, k.prof into ce, cp from public.org_codes k where k.org_id = o;
  select c.id into c1 from public.classes c where c.org_id = o and c.genre = 'classe' order by c.name limit 1;
  perform public.zz_comme(jean); perform public.rejoindre(cp, 'Jean', 'Moulin');
  perform public.zz_comme(emma); perform public.rejoindre(ce, 'Emma', 'Durand', c1);
  begin
    perform public.zz_comme(adm);
    select (x->>'id')::uuid into fid from (select public.admin_facturer(o, '[{"libelle":"Licence","quantite":1,"prix_ht":100}]'::jsonb) x) f;
  exception when others then fid := null;   -- sans vendeur enregistré, pas de facture : la cible manque, rien d'autre
  end;

  -- une professeure particulière : sa classe, son élève, un devoir, une partie
  perform public.zz_comme(lea);
  cp1 := public.prof_creer_classe('ZZ Italien', '2nde', 'Italien');
  perform public.zz_root();
  insert into public.class_members (class_id, user_id, who) values (cp1, tom, 'Tom PETIT');
  perform public.zz_comme(lea);
  perform public.prof_give(array[cp1], 'ZZ Vocabulaire', 'Italien', '[["ciao","salut"],["grazie","merci"]]'::jsonb, current_date + 7);
  select o2.id into sid from public.salle_ouvrir('ZZ Italien', 'qcm', 20, q3, cp1) o2;
  perform public.zz_root();
  select a.id into aid from public.assignments a where a.class_id = cp1;

  -- un club, un livre
  perform public.zz_comme(zoe);
  select c.id into gid from public.club_creer('ZZ Club', 'chouette', 3, 'On lit') c;
  perform public.zz_root();
  insert into public.decks (id, user_id, name) values (livre, zoe, 'ZZ Livre de Zoé');

  insert into public.zz_cibles (nom, id) select nm, v from (values
    ('classe d''établissement', c1), ('classe de particulier', cp1), ('établissement', o), ('référent', dir),
    ('professeur', jean), ('professeure particulière', lea), ('élève d''établissement', emma),
    ('élève de particulier', tom), ('devoir', aid), ('partie', sid), ('club', gid), ('facture', fid),
    ('livre', livre), ('lectrice', zoe)) x(nm, v) where v is not null;
end $$;

-- ══════════ l'inconnu attaque ══════════
do $$
declare
  moi uuid := gen_random_uuid(); cb record; r record; a text; t text; q text; n bigint; x text; j jsonb;
begin
  insert into auth.users (instance_id, id, aud, role, email)
  values ('00000000-0000-0000-0000-000000000000', moi, 'authenticated', 'authenticated', 'zz-' || moi || '@exemple.invalid');
  insert into public.profiles (id, email, name) values (moi, 'zz-' || moi || '@exemple.invalid', 'Inconnu')
  on conflict (id) do nothing;
  perform public.zz_comme(moi);

  for r in
    select p.proname, p.proretset, format_type(p.prorettype, null) rt,
           array(select format_type(ty, null) from unnest(p.proargtypes) ty) types
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public' and p.prosecdef and has_function_privilege('authenticated', p.oid, 'execute')
      and p.proname not like 'zz\_%'
    order by p.proname
  loop
    for cb in select nom, id from public.zz_cibles order by k loop
      a := (select coalesce(string_agg(case ty
              when 'uuid' then quote_literal(cb.id) || '::uuid'
              when 'uuid[]' then 'array[' || quote_literal(cb.id) || '::uuid]'
              when 'text' then quote_literal('Essai inconnu')
              when 'text[]' then 'array[''x'']'
              when 'integer' then '1' when 'bigint' then '1' when 'smallint' then '1' when 'numeric' then '1'
              when 'boolean' then 'true' when 'date' then 'current_date'
              when 'timestamp with time zone' then 'now()'
              when 'jsonb' then '''{}''::jsonb' when 'json' then '''{}''::json'
              else 'null' end, ', ' order by o), '')
            from unnest(r.types) with ordinality u(ty, o));
      q := format('public.%I(%s)', r.proname, a);
      begin
        if r.proretset then
          execute 'select count(*) from ' || q into n;
          x := case when n > 0 then n || ' ligne(s)' end;
        elsif r.rt = 'void' then
          execute 'select ' || q; x := null;
        elsif r.rt = 'jsonb' then
          execute 'select ' || q into j;
          x := case when j is null or j = '{}'::jsonb or j = '[]'::jsonb then null
                    when jsonb_typeof(j) = 'object' then 'jsonb {' || (select string_agg(key, ',' order by key) from jsonb_object_keys(j) key) || '}'
                      || coalesce(' statut=' || (j->>'statut'), '') || coalesce(' etat=' || (j->>'etat'), '')
                    else 'jsonb ' || jsonb_typeof(j) || ' ' || coalesce(jsonb_array_length(case when jsonb_typeof(j) = 'array' then j end), 0) end;
        else
          execute 'select (' || q || ')::text' into t;
          x := case when t is null or t in ('', 'false', 'f', '0') then null else r.rt || ' de ' || length(t) || ' signes' end;
        end if;
      exception when others then x := null;   -- un refus : c'est ce qu'on attend
      end;
      if x is not null then insert into public.zz_vu values (r.proname, cb.nom, x); end if;
    end loop;
  end loop;
end $$;

select public.zz_root();

insert into public.zz_res (nom, ok, vu)
select 'tout le monde est semé, chaque fonction essayée sur chaque cible',
  (select count(*) from public.zz_cibles) >= 13 and count(*) >= 150,
  (select count(*) from public.zz_cibles) || ' cibles, ' || count(*) || ' fonctions'
from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
where ns.nspname = 'public' and p.prosecdef and has_function_privilege('authenticated', p.oid, 'execute');

-- ce qu'un inconnu a le droit de recevoir : ce qui est à lui, ou un statut qui ne dit rien d'un autre
insert into public.zz_res (nom, ok, vu)
select 'rien d''un autre pour ' || fn,
  fn = any (array[
    'is_admin', 'is_prof', 'is_ref', 'my_role', 'mfa_ok',            -- son propre rôle
    'mon_compte', 'mon_offre', 'mon_ia', 'my_school', 'leaderboard',  -- son propre compte
    'code_apercu', 'rejoindre', 'class_preview', 'class_join',         -- un statut : ce code n'existe pas
    'salle_rejoindre', 'salle_etat', 'salle_repondre',
    'pseudo_libre', 'changer_pseudo', 'profil_lecteur', 'eleve_classe',
    'demander_demo', 'club_creer', 'join_group', 'salle_ouvrir',      -- un statut, ou ce qu'il vient de créer pour lui
    'blocked',                                                         -- ceux qu'il vient de bloquer : block_user passe juste avant dans la boucle
    'shared_deck'                                                      -- public par nature : un livre prêté par son code
  ]) and (fn <> 'profil_lecteur' or bool_and(quoi like '%statut=inconnu'))
     and (fn <> 'eleve_classe' or bool_and(quoi like '%statut=inconnue'))
     and (fn <> 'salle_etat' or bool_and(quoi like '%etat=absent')),
  string_agg(distinct cible || ' → ' || quoi, ' | ')
from public.zz_vu group by fn;

select n, case when ok then 'ok' else 'ÉCHEC' end as resultat, nom, vu from public.zz_res order by n;
rollback;
