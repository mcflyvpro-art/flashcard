-- Tests de 20261105183720_amis_courrier_et_adresses_verrouilles : une amitié
-- ne se force pas, le courrier ne part qu'à un ami ou à un élève de ses
-- classes et sous son vrai nom, l'adresse des autres ne se lit plus, un code
-- de partage ne se fait que sur ses livres. Même mode que profil.sql :
-- transaction ANNULÉE, comptes jetables, vrai rôle `authenticated`.
-- Pour lire le bilan par MCP execute_sql : remplacer le select final et le
-- rollback par un `do $$ begin raise exception 'RESULTATS %', ...; end $$;`.

begin;

create table public.zz_res (n serial primary key, nom text, ok boolean, vu text);
grant all on public.zz_res to authenticated;
grant all on sequence public.zz_res_n_seq to authenticated;
create function public.zz_comme(u uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function public.zz_root() returns void language plpgsql as $$
begin perform set_config('role', 'postgres', true); end $$;
create function public.zz_note(nom text, ok boolean, vu text default null) returns void language sql as $$
  insert into public.zz_res (nom, ok, vu) values (nom, ok, vu) $$;
grant execute on function public.zz_comme(uuid), public.zz_root(), public.zz_note(text, boolean, text) to authenticated;

do $$
declare
  pirate uuid := gen_random_uuid(); eleve uuid := gen_random_uuid(); tiers uuid := gen_random_uuid();
  autre uuid := gen_random_uuid(); prof uuid := gen_random_uuid(); loin uuid := gen_random_uuid();
  u record; cid uuid; livre uuid := gen_random_uuid(); sien uuid := gen_random_uuid();
  n integer; x text; j jsonb; etat text;
begin
  for u in select * from (values
      (pirate, 'Pirate', 'eleve'), (eleve, 'Lou Élève', 'eleve'), (tiers, 'Tiers', 'eleve'),
      (autre, 'Autre', 'eleve'), (prof, 'Mme Courrier', 'prof'), (loin, 'Loin', 'eleve')) x(id, nom, r) loop
    insert into auth.users (instance_id, id, aud, role, email)
    values ('00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', 'zz-' || u.id || '@exemple.invalid');
    insert into public.profiles (id, email, name) values (u.id, 'zz-' || u.id || '@exemple.invalid', u.nom)
    on conflict (id) do update set name = excluded.name;
    insert into public.user_roles (user_id, role) values (u.id, u.r) on conflict (user_id) do update set role = excluded.role;
  end loop;
  perform public.zz_comme(prof);
  cid := public.prof_creer_classe('ZZ Courrier', '2nde', 'Histoire');
  perform public.zz_root();
  insert into public.class_members (class_id, user_id, who) values (cid, eleve, 'Lou ÉLÈVE');
  insert into public.decks (id, user_id, name) values (livre, eleve, 'ZZ Livre de Lou'), (sien, pirate, 'ZZ Livre du pirate');

  -- 1. une amitié ne se force pas
  perform public.zz_comme(pirate);
  begin
    insert into public.friends (user_id, friend_id, status) values (pirate, eleve, 'ok');
    perform public.zz_note('ami « ok » d''emblée refusé', false);
  exception when others then perform public.zz_note('ami « ok » d''emblée refusé', sqlstate = '42501', sqlstate); end;
  begin
    insert into public.friends (user_id, friend_id, status) values (pirate, pirate, 'pending');
    perform public.zz_note('se demander soi-même refusé', false);
  exception when others then perform public.zz_note('se demander soi-même refusé', sqlstate = '42501', sqlstate); end;
  begin
    insert into public.friends (user_id, friend_id, status) values (pirate, eleve, 'pending');
    perform public.zz_note('une demande « pending » passe', true);
  exception when others then perform public.zz_note('une demande « pending » passe', false, sqlstate); end;
  j := public.profil_lecteur(eleve, 'Europe/Paris');
  perform public.zz_note('demande en attente : pas de chiffres', coalesce(j->>'statut', '') <> 'ok', j->>'statut');
  select count(*) into n from public.profiles where id = eleve;
  perform public.zz_note('demande en attente : sa ligne de profil ne se lit pas', n = 0, n::text);
  begin
    update public.friends set status = 'ok' where user_id = pirate and friend_id = eleve;
    get diagnostics n = row_count;
    perform public.zz_note('le demandeur ne s''accepte pas lui-même', n = 0, n::text);
  exception when others then perform public.zz_note('le demandeur ne s''accepte pas lui-même', true, sqlstate); end;

  -- celui qui reçoit ne détourne pas une demande
  perform public.zz_root();
  insert into public.friends (user_id, friend_id, status) values (tiers, autre, 'pending');
  perform public.zz_comme(autre);
  begin
    update public.friends set user_id = pirate, status = 'ok' where user_id = tiers and friend_id = autre;
    get diagnostics n = row_count;
    perform public.zz_note('une demande ne se détourne pas vers un tiers', n = 0, n::text);
  exception when others then perform public.zz_note('une demande ne se détourne pas vers un tiers', sqlstate = '42501', sqlstate); end;
  begin
    update public.friends set status = 'bof' where user_id = tiers and friend_id = autre;
    get diagnostics n = row_count;
    perform public.zz_note('accepter, c''est « ok » et rien d''autre', n = 0, n::text);
  exception when others then perform public.zz_note('accepter, c''est « ok » et rien d''autre', true, sqlstate); end;
  update public.friends set status = 'ok' where user_id = tiers and friend_id = autre;
  get diagnostics n = row_count;
  perform public.zz_note('celui qui reçoit accepte', n = 1, n::text);

  -- l'élève accepte le pirate : ils sont amis
  perform public.zz_comme(eleve);
  update public.friends set status = 'ok' where user_id = pirate and friend_id = eleve;

  -- 2. le courrier
  perform public.zz_comme(pirate);
  begin
    insert into public.mail (from_user, to_user, from_name, deck_name, message, cards)
    values (pirate, loin, 'Ton professeur', '', 'coucou', '[]');
    perform public.zz_note('écrire à un inconnu refusé', false);
  exception when others then perform public.zz_note('écrire à un inconnu refusé', sqlstate = '42501', sqlstate); end;
  insert into public.mail (from_user, to_user, from_name, deck_name, message, cards, created_at, read_at)
  values (pirate, eleve, 'Ton professeur', 'Livre', 'coucou', '[["a","b"]]', '2000-01-01', now());
  perform public.zz_root();
  select from_name || '|' || (created_at > now() - interval '1 minute')::text || '|' || (read_at is null)::text into x
    from public.mail where from_user = pirate and to_user = eleve;
  perform public.zz_note('à un ami : sous son vrai nom, daté du jour, non lu', x = 'Pirate|true|true', x);
  perform public.zz_comme(pirate);
  begin
    insert into public.mail (from_user, to_user, from_name, deck_name, message, cards)
    values (pirate, eleve, '', '', repeat('a', 2001), '[]');
    perform public.zz_note('un message de plus de 2 000 signes refusé', false);
  exception when others then perform public.zz_note('un message de plus de 2 000 signes refusé', sqlstate = '23514', sqlstate); end;

  perform public.zz_comme(eleve);
  begin
    update public.mail set message = 'réécrit' where to_user = eleve;
    perform public.zz_note('le destinataire ne réécrit pas une lettre', false);
  exception when others then perform public.zz_note('le destinataire ne réécrit pas une lettre', sqlstate = '42501', sqlstate); end;
  update public.mail set read_at = now() where to_user = eleve;
  get diagnostics n = row_count;
  perform public.zz_note('le destinataire marque une lettre lue', n = 1, n::text);

  -- un professeur écrit à un élève de ses classes, pas aux autres
  perform public.zz_comme(prof);
  begin
    insert into public.mail (from_user, to_user, from_name, deck_name, message, cards) values (prof, eleve, '', '', 'Bravo', '[]');
    perform public.zz_note('un mot du professeur à son élève', true);
  exception when others then perform public.zz_note('un mot du professeur à son élève', false, sqlstate); end;
  begin
    insert into public.mail (from_user, to_user, from_name, deck_name, message, cards) values (prof, loin, '', '', 'Bravo', '[]');
    perform public.zz_note('pas à l''élève d''un autre', false);
  exception when others then perform public.zz_note('pas à l''élève d''un autre', sqlstate = '42501', sqlstate); end;
  n := public.prof_message_classe(cid, 'Contrôle mardi');
  perform public.zz_root();
  select from_name into x from public.mail where from_user = prof and message = 'Contrôle mardi';
  perform public.zz_note('un mot à la classe garde le nom qu''y met la base', n = 1 and x is not null, x);

  -- 3. les adresses
  perform public.zz_comme(pirate);
  select count(*) into n from public.profiles where id = eleve;
  perform public.zz_note('même ami, la ligne de profil d''un autre ne se lit pas', n = 0, n::text);
  select email into x from public.profiles where id = pirate;
  perform public.zz_note('sa propre adresse se lit', x like 'zz-%', x);
  begin
    execute $q$WITH s AS (INSERT INTO "public"."profiles"("email", "id", "name") SELECT b."email", b."id", b."name" FROM json_to_recordset($1::json) AS b("email" text, "id" uuid, "name" text) ON CONFLICT("id") DO UPDATE SET "email" = EXCLUDED."email", "id" = EXCLUDED."id", "name" = EXCLUDED."name" RETURNING 1) SELECT count(*) FROM s$q$
    using json_build_array(json_build_object('id', pirate, 'email', 'zz-' || pirate || '@exemple.invalid', 'name', 'Pirate'));
    perform public.zz_note('l''upsert de profil de l''app passe toujours', true);
  exception when others then perform public.zz_note('l''upsert de profil de l''app passe toujours', false, sqlstate || ' ' || sqlerrm); end;
  select count(*) into n from public.my_friends();
  perform public.zz_note('ses amis se lisent toujours (my_friends)', n = 1, n::text);

  -- 4. un code de partage, sur ses livres seulement
  begin
    insert into public.shares (token, deck_id, user_id, mode) values ('zzzzzzzzzz', livre, pirate, 'ro');
    perform public.zz_note('un code sur le livre d''un autre refusé', false);
  exception when others then perform public.zz_note('un code sur le livre d''un autre refusé', sqlstate = '42501', sqlstate); end;
  begin
    insert into public.shares (token, deck_id, user_id, mode) values ('zzzzzzzzzy', sien, pirate, 'ro');
    perform public.zz_note('un code sur son livre', true);
  exception when others then perform public.zz_note('un code sur son livre', false, sqlstate); end;
  perform public.zz_root();
end $$;

select n, case when ok then 'ok' else 'ÉCHEC' end as resultat, nom, vu from public.zz_res order by n;
rollback;
