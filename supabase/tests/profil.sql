-- Tests de la migration 20261025200000_profil_d_un_lecteur : qui voit les
-- chiffres de qui. Même mode que jetons.sql : transaction ANNULÉE, comptes
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
  sam uuid := gen_random_uuid(); ami uuid := gen_random_uuid(); attente uuid := gen_random_uuid();
  club uuid := gen_random_uuid(); camarade uuid := gen_random_uuid(); inconnu uuid := gen_random_uuid();
  bloque uuid := gen_random_uuid(); prof uuid := gen_random_uuid(); u record;
  livre uuid := gen_random_uuid(); cid uuid; gid uuid; j jsonb; k integer;
begin
  for u in select * from (values
      (sam, 'Sam François', 'zzsamp'), (ami, 'Tibo', 'zztibop'), (attente, 'Inès', 'zzinesp'),
      (club, 'Ava', 'zzavap'), (camarade, 'Léo', null), (inconnu, 'Zoé', 'zzzoep'),
      (bloque, 'Max', 'zzmaxp'), (prof, 'Mme Profil', 'zzprofp')) x(id, nom, pseudo) loop
    insert into auth.users (instance_id, id, aud, role, email)
    values ('00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', 'zz-' || u.id || '@exemple.invalid');
    insert into public.profiles (id, email, name, handle)
    values (u.id, 'zz-' || u.id || '@exemple.invalid', u.nom, u.pseudo)
    on conflict (id) do update set name = excluded.name, handle = excluded.handle;
    insert into public.user_roles (user_id, role) values (u.id, case when u.id = prof then 'prof' else 'eleve' end)
    on conflict (user_id) do update set role = excluded.role;
  end loop;
  insert into public.friends (user_id, friend_id, status) values
    (sam, ami, 'ok'), (attente, sam, 'pending'), (bloque, sam, 'ok');
  insert into public.blocks (user_id, blocked_id) values (sam, bloque);
  perform public.zz_comme(prof);
  cid := public.prof_creer_classe('ZZ Profil 2nde', '2nde', 'Anglais');
  perform public.zz_root();
  insert into public.class_members (class_id, user_id, who) values (cid, sam, 'Sam FRANÇOIS'), (cid, camarade, 'Léo MARTIN');
  perform public.zz_comme(sam);
  select c.id into gid from public.club_creer('ZZ Les Lecteurs', 'livre', 2, '') c;
  perform public.zz_root();
  insert into public.group_members (group_id, user_id) values (gid, club);

  -- Sam lit : 3 jours d'affilée jusqu'à aujourd'hui (série 3), un trou, puis
  -- 5 jours d'affilée il y a deux semaines (record 5) ; 2 réponses fausses.
  insert into public.decks (id, user_id, name, subject) values (livre, sam, 'Verbes', 'zzang');
  for k in 0..2 loop
    insert into public.reviews (user_id, deck_id, card_id, mode, correct, ms, created_at, subject, subject_name, deck_name, ecart)
    values (sam, livre, 'c' || k, 'study', k <> 1, 4000, now() - (k || ' days')::interval, 'zzang', 'Anglais', 'Verbes', 1),
           (sam, livre, 'd' || k, 'study', true, 4000, now() - (k || ' days')::interval, 'zzhis', 'Histoire', 'Dates', 1);
  end loop;
  for k in 14..18 loop
    insert into public.reviews (user_id, deck_id, card_id, mode, correct, ms, created_at, subject, subject_name, deck_name, ecart)
    values (sam, livre, 'e' || k, 'study', k <> 15, 4000, now() - (k || ' days')::interval, 'zzang', 'anglais ', 'Verbes', 3);
  end loop;

  -- ══════════ le profil complet ══════════
  perform public.zz_comme(sam);
  j := public.profil_lecteur(sam, 'Europe/Paris');
  insert into public.zz_res (nom, ok, vu) values ('soi-même : le profil complet', j->>'statut' = 'ok' and (j->>'moi')::boolean, j->>'statut');
  insert into public.zz_res (nom, ok, vu) values ('pages : 6 cette semaine, 11 sur 30 jours, 11 depuis toujours',
    (j->>'semaine')::int = 6 and (j->>'mois')::int = 11 and (j->>'toujours')::int = 11, concat_ws('/', j->>'semaine', j->>'mois', j->>'toujours'));
  insert into public.zz_res (nom, ok, vu) values ('justes sur 30 jours : 9 sur 11 → 82 %', (j->>'justes')::int = 82, j->>'justes');
  insert into public.zz_res (nom, ok, vu) values ('série en cours 3, record 5', (j->>'serie')::int = 3 and (j->>'record')::int = 5,
    concat_ws('/', j->>'serie', j->>'record'));
  insert into public.zz_res (nom, ok, vu) values ('35 jours, le dernier = aujourd''hui (2 pages)',
    jsonb_array_length(j->'jours') = 35 and (j->'jours'->>34)::int = 2, j->'jours'->>34);
  insert into public.zz_res (nom, ok, vu) values ('matières par leur nom, sans double compte, sous l''écriture la plus récente',
    j->'matieres'->0->>'n' = '8' and j->'matieres'->0->>'nom' = 'Anglais' and j->'matieres'->1->>'nom' = 'Histoire',
    (j->'matieres')::text);
  insert into public.zz_res (nom, ok, vu) values ('un livre lu sur 30 jours, des heures entre 0 et 23',
    (j->>'livres')::int = 1 and (j->>'heure')::int between 0 and 23, concat_ws('/', j->>'livres', j->>'heure'));
  insert into public.zz_res (nom, ok, vu) values ('jamais un livre, une carte ni une réponse dans la réponse',
    position('Verbes' in j::text) = 0 and position('"c0"' in j::text) = 0, 'contenu');

  perform public.zz_comme(ami);
  j := public.profil_lecteur(sam);
  insert into public.zz_res (nom, ok, vu) values ('un ami voit les chiffres', j->>'statut' = 'ok' and (j->>'ami')::boolean
    and (j->>'mois')::int = 11, j->>'statut');
  perform public.zz_comme(club);
  j := public.profil_lecteur(sam);
  insert into public.zz_res (nom, ok, vu) values ('un membre du même club voit les chiffres, et le club en commun',
    j->>'statut' = 'ok' and j->'clubs'->0->>'nom' = 'ZZ Les Lecteurs' and not (j->>'ami')::boolean, (j->'clubs')::text);

  -- ══════════ le profil réduit ══════════
  perform public.zz_comme(attente);
  j := public.profil_lecteur(sam);
  insert into public.zz_res (nom, ok, vu) values ('une demande en attente : le nom, pas les chiffres',
    j->>'statut' = 'prive' and j->>'nom' = 'Sam François' and not j ? 'mois', j::text);
  perform public.zz_comme(camarade);
  j := public.profil_lecteur(sam);
  insert into public.zz_res (nom, ok, vu) values ('un camarade de classe : le nom, pas les chiffres',
    j->>'statut' = 'prive' and not j ? 'semaine' and not j ? 'jours', j->>'statut');
  perform public.zz_comme(prof);
  j := public.profil_lecteur(sam);
  insert into public.zz_res (nom, ok, vu) values ('son professeur non plus (l''espace prof a ses propres chiffres)',
    j->>'statut' = 'prive', j->>'statut');

  -- ══════════ personne ══════════
  perform public.zz_comme(inconnu);
  j := public.profil_lecteur(sam);
  insert into public.zz_res (nom, ok, vu) values ('un inconnu : rien, pas même le nom', j = '{"statut": "inconnu"}'::jsonb, j::text);
  perform public.zz_comme(bloque);
  j := public.profil_lecteur(sam);
  insert into public.zz_res (nom, ok, vu) values ('bloqué par Sam, même ami : rien', j->>'statut' = 'inconnu', j->>'statut');
  perform public.zz_comme(sam);
  j := public.profil_lecteur(bloque);
  insert into public.zz_res (nom, ok, vu) values ('… et dans l''autre sens non plus', j->>'statut' = 'inconnu', j->>'statut');
  j := public.profil_lecteur(gen_random_uuid());
  insert into public.zz_res (nom, ok, vu) values ('un identifiant qui n''existe pas : inconnu', j->>'statut' = 'inconnu', j->>'statut');
  j := public.profil_lecteur(sam, 'Pas/Un_Fuseau');
  insert into public.zz_res (nom, ok, vu) values ('un fuseau inconnu retombe sur Paris', (j->>'mois')::int = 11, j->>'mois');

  perform public.zz_root();
  insert into public.zz_res (nom, ok, vu) values ('anon ne l''appelle pas, authenticated oui',
    not has_function_privilege('anon', 'public.profil_lecteur(uuid, text)', 'execute')
    and has_function_privilege('authenticated', 'public.profil_lecteur(uuid, text)', 'execute'), 'droits');
end $$;

select n, ok, nom, vu from public.zz_res order by n;
rollback;
