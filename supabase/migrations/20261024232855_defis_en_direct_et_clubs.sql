-- ══════════ défis en direct, clubs qu'on reconnaît ══════════
-- Refonte du cercle des lecteurs (2026-10-24). Le cercle devient trois
-- choses, et seulement trois : des amis, des clubs, des défis. Les défis
-- se jouent soit chacun à son rythme (les `duels` d'avant, inchangés), soit
-- EN DIRECT, à la manière de Kahoot : un hôte ouvre une salle avec un code
-- à 6 chiffres, les joueurs entrent depuis leur téléphone, l'hôte fait
-- défiler les questions et la base compte les points.
--
-- Ce qu'on a trouvé en relisant la base avant d'y toucher :
--   1. `gm_join` laissait n'importe quel compte s'inscrire dans n'importe
--      quel club dont il connaissait l'identifiant, sans le code. Seul
--      `join_group` (qui vérifie le code) doit pouvoir faire entrer.
--   2. `duels_write` ne vérifiait pas `group_id` : on pouvait poster un défi
--      dans un club dont on n'est pas membre.
--   3. Rien n'empêchait côté base un élève de classe (établissement ou
--      compte à carte) de créer ou de rejoindre un club : seul l'écran le
--      cachait. Un club est un lieu ouvert, hors du contrôle d'un
--      professeur ; un mineur inscrit par son école n'y a pas sa place.
--   4. Un code de club faux ne coûtait rien : 5 caractères, aucune limite
--      d'essais.
--
-- ══════════ qui peut quoi ══════════
--
--   action                           compte perso   élève de      professeur
--                                                   classe (*)
--   créer / rejoindre un club        oui            —             oui
--   ouvrir une salle de club         membre         —             membre
--   ouvrir une salle de classe       —              —             sa classe
--   ouvrir une salle ouverte (code)  oui            —             oui
--   entrer dans une salle de classe  inscrit        inscrit       sa classe
--   entrer dans une salle de club    membre         —             membre
--   entrer dans une salle ouverte    oui            si l'hôte est professeur
--
--   (*) élève d'un établissement, ou compte à carte ouvert par un professeur.
--
-- Le nom affiché dans une salle : le prénom et le nom complets dans une
-- salle de classe (on y est entre camarades, qui se voient déjà) ; ailleurs,
-- pour un élève de classe, le prénom et l'initiale du nom ; pour un compte
-- personnel, son pseudo, à défaut son prénom. Jamais d'adresse.
--
-- Le score est calculé ICI, jamais par l'app : l'énoncé et les choix
-- partent sans la bonne réponse, qui ne sort qu'à la correction. Les points
-- d'une bonne réponse vont de 500 à 1 000 selon la vitesse, comptée depuis
-- l'instant où CE joueur a reçu les choix (pas depuis l'ouverture de la
-- question : un téléphone qui interroge la base une seconde plus tard n'est
-- pas pénalisé), plus 50 points par bonne réponse d'affilée (250 au plus).

-- ── 0. qui est « élève de classe » ─────────────────────────────────────
-- Fonction interne (aucun droit d'exécution) : savoir si un autre compte
-- est un élève de classe n'a pas à sortir de la base.
create or replace function public.est_eleve_de_classe(u uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select r.role from public.user_roles r where r.user_id = u), 'eleve') = 'eleve'
     and (exists (select 1 from public.org_members m where m.user_id = u)
       or exists (select 1 from public.comptes_geres g where g.user_id = u))
$$;
revoke all on function public.est_eleve_de_classe(uuid) from public, anon, authenticated;

-- Le nom qu'un compte porte dans une salle (voir en tête).
create or replace function public.nom_joueur(u uuid, complet boolean)
returns text language plpgsql stable security definer set search_path = '' as $$
declare p public.profiles%rowtype; n text; fam text; pre text;
begin
  select * into p from public.profiles x where x.id = u;
  if not found then return 'Joueur'; end if;
  n := btrim(regexp_replace(coalesce(p.name, ''), '\s+', ' ', 'g'));
  if public.est_eleve_de_classe(u) then
    if n = '' then return 'Élève'; end if;
    if complet then return n; end if;
    -- « Prénom NOM » : le nom de famille est la suite de mots en capitales à la fin
    fam := substring(n from '((?:\s[[:upper:]][[:upper:]''’-]+)+)$');
    pre := btrim(case when fam is null then split_part(n, ' ', 1) else left(n, char_length(n) - char_length(fam)) end);
    fam := btrim(coalesce(fam, split_part(n, ' ', 2)));
    return pre || case when fam <> '' then ' ' || left(fam, 1) || '.' else '' end;
  end if;
  return coalesce(nullif(btrim(p.handle), ''), nullif(split_part(n, ' ', 1), ''), 'Joueur');
end $$;
revoke all on function public.nom_joueur(uuid, boolean) from public, anon, authenticated;

-- Les essais de code faux (salles et clubs), pour les limiter par compte.
create table if not exists public.essais_codes (
  user_id uuid not null references auth.users(id) on delete cascade,
  sorte   text not null check (sorte in ('salle', 'club')),
  at      timestamptz not null default now()
);
create index if not exists essais_codes_idx on public.essais_codes (user_id, sorte, at desc);
alter table public.essais_codes enable row level security;
drop policy if exists essais_lire on public.essais_codes;
create policy essais_lire on public.essais_codes for select to authenticated
  using (user_id = (select auth.uid()));

-- ── 1. les clubs ───────────────────────────────────────────────────────
alter table public.groups add column if not exists embleme text not null default 'livre';
alter table public.groups add column if not exists teinte smallint not null default 0;
alter table public.groups add column if not exists devise text not null default '';
alter table public.groups drop constraint if exists groups_nom_lisible;
alter table public.groups add constraint groups_nom_lisible check (char_length(btrim(name)) between 1 and 40);
alter table public.groups drop constraint if exists groups_embleme_connu;
alter table public.groups add constraint groups_embleme_connu check (embleme ~ '^[a-z]{2,16}$');
alter table public.groups drop constraint if exists groups_teinte_connue;
alter table public.groups add constraint groups_teinte_connue check (teinte between 0 and 11);
alter table public.groups drop constraint if exists groups_devise_courte;
alter table public.groups add constraint groups_devise_courte check (char_length(devise) <= 90);
create index if not exists groups_owner_idx on public.groups (owner);
create index if not exists group_members_user_idx on public.group_members (user_id);

-- On ne crée plus un club par l'API brute (il faut un code tiré par la base
-- et un premier membre), et on n'y entre plus sans son code.
drop policy if exists groups_make on public.groups;
drop policy if exists gm_join on public.group_members;

create or replace function public.club_creer(nom text, embleme text default 'livre',
                                            teinte integer default 0, devise text default '')
returns table (id uuid, code text)
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); g uuid; k text; b bytea;
begin
  if u is null then raise exception 'Connexion requise'; end if;
  if public.est_eleve_de_classe(u) then raise exception 'Les clubs ne sont pas ouverts aux comptes de classe'; end if;
  if (select count(*) from public.groups x where x.owner = u) >= 10 then
    raise exception 'Dix clubs au plus par compte';
  end if;
  loop
    b := extensions.gen_random_bytes(8);
    k := (select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + get_byte(b, i) % 31, 1), '')
          from generate_series(0, 7) i);
    exit when not exists (select 1 from public.groups x where x.code = k);
  end loop;
  insert into public.groups (name, code, owner, embleme, teinte, devise)
  values (btrim(coalesce(club_creer.nom, '')), k, u, coalesce(club_creer.embleme, 'livre'),
          coalesce(club_creer.teinte, 0), btrim(coalesce(club_creer.devise, '')))
  returning groups.id into g;
  insert into public.group_members (group_id, user_id) values (g, u);
  return query select g, k;
end $$;
revoke all on function public.club_creer(text, text, integer, text) from public, anon;
grant execute on function public.club_creer(text, text, integer, text) to authenticated;

-- Rejoindre par code : élèves de classe exclus, 10 codes faux par heure,
-- 100 membres au plus. Un code faux ne lève plus d'exception : elle
-- annulerait la ligne d'essai, et la limite ne compterait jamais rien. La
-- fonction ne renvoie alors aucune ligne, et l'app dit « code inconnu ».
create or replace function public.join_group(join_code text)
returns table(id uuid, name text) language plpgsql security definer set search_path = '' as $$
declare g public.groups%rowtype; u uuid := auth.uid();
begin
  if u is null then raise exception 'Connexion requise'; end if;
  if public.est_eleve_de_classe(u) then raise exception 'Les clubs ne sont pas ouverts aux comptes de classe'; end if;
  if (select count(*) from public.essais_codes e
      where e.user_id = u and e.sorte = 'club' and e.at > now() - interval '1 hour') >= 10 then
    raise exception 'Trop de codes faux : réessaie dans une heure';
  end if;
  select * into g from public.groups x
  where upper(x.code) = upper(regexp_replace(coalesce(join_code, ''), '[^A-Za-z0-9]', '', 'g'));
  if not found then
    insert into public.essais_codes (user_id, sorte) values (u, 'club');
    return;
  end if;
  if not exists (select 1 from public.group_members m where m.group_id = g.id and m.user_id = u)
     and (select count(*) from public.group_members m where m.group_id = g.id) >= 100 then
    raise exception 'Ce club est complet (100 membres)';
  end if;
  insert into public.group_members (group_id, user_id) values (g.id, u) on conflict do nothing;
  return query select g.id, g.name;
end $$;
revoke all on function public.join_group(text) from public, anon;
grant execute on function public.join_group(text) to authenticated;

-- Le chef change le code d'invitation (un code qui a trop circulé).
create or replace function public.club_nouveau_code(club uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare k text; b bytea;
begin
  if not exists (select 1 from public.groups g where g.id = club and g.owner = auth.uid()) then
    raise exception 'Seul le chef du club change son code';
  end if;
  loop
    b := extensions.gen_random_bytes(8);
    k := (select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + get_byte(b, i) % 31, 1), '')
          from generate_series(0, 7) i);
    exit when not exists (select 1 from public.groups x where x.code = k);
  end loop;
  update public.groups set code = k where id = club;
  return k;
end $$;
revoke all on function public.club_nouveau_code(uuid) from public, anon;
grant execute on function public.club_nouveau_code(uuid) to authenticated;

-- Les membres d'un club, avec leurs pages de la semaine.
create or replace function public.club_membres(club uuid)
returns table (user_id uuid, nom text, pseudo text, chef boolean, depuis timestamptz,
               pages integer, justes integer, jours integer, moi boolean)
language sql stable security definer set search_path = '' as $$
  select m.user_id,
         coalesce(nullif(btrim(p.name), ''), p.handle, 'Lecteur'),
         coalesce(p.handle, ''),
         g.owner = m.user_id, m.joined_at,
         coalesce(s.n, 0)::integer, coalesce(s.ok, 0)::integer, coalesce(s.j, 0)::integer,
         m.user_id = auth.uid()
  from public.group_members m
  join public.groups g on g.id = m.group_id
  left join public.profiles p on p.id = m.user_id
  left join lateral (
    select count(*) n, count(*) filter (where r.correct) ok,
           count(distinct (r.created_at at time zone 'utc')::date) j
    from public.reviews r
    where r.user_id = m.user_id and r.created_at >= now() - interval '7 days'
  ) s on true
  where m.group_id = club and public.in_group(club) and not public.blocked(m.user_id)
  order by coalesce(s.n, 0) desc, m.joined_at
$$;

-- Un défi « à son rythme » ne se poste que dans un club dont on est membre.
drop policy if exists duels_write on public.duels;
create policy duels_write on public.duels for insert to authenticated
with check (
  owner = (select auth.uid())
  and (group_id is null or public.in_group(group_id))
  and (class_id is null or public.teaches(class_id)
       or exists (select 1 from public.classes c where c.id = class_id and c.owner = (select auth.uid())))
);

-- ── 2. les salles de défi en direct ─────────────────────────────────────
create table if not exists public.salles (
  id         uuid primary key default gen_random_uuid(),
  pin        text not null check (pin ~ '^[0-9]{6}$'),
  hote       uuid not null references auth.users(id) on delete cascade,
  hote_nom   text not null,
  class_id   uuid references public.classes(id) on delete cascade,
  group_id   uuid references public.groups(id) on delete cascade,
  titre      text not null check (char_length(titre) between 1 and 80),
  jeu        text not null check (jeu in ('qcm', 'vf', 'ecrit')),
  duree      smallint not null check (duree between 5 and 120),
  total      smallint not null check (total between 1 and 50),
  etat       text not null default 'attente' check (etat in ('attente', 'question', 'correction', 'fini')),
  rang       smallint not null default -1,
  debut      timestamptz,
  fin        timestamptz,
  created_at timestamptz not null default now(),
  fini_at    timestamptz,
  check (class_id is null or group_id is null)
);
create unique index if not exists salles_pin_ouvert on public.salles (pin) where etat <> 'fini';
create index if not exists salles_hote_idx on public.salles (hote, created_at desc);
create index if not exists salles_classe_idx on public.salles (class_id, created_at desc);
create index if not exists salles_club_idx on public.salles (group_id, created_at desc);

-- Les questions, AVEC leurs réponses : seul l'hôte les lit directement.
create table if not exists public.salle_questions (
  salle_id uuid not null references public.salles(id) on delete cascade,
  rang     smallint not null,
  enonce   text not null check (char_length(enonce) between 1 and 400),
  choix    jsonb not null default '[]'::jsonb,   -- qcm : 2 à 4 choix ; vf : la proposition à juger
  bonne    smallint,                             -- qcm : rang du bon choix ; vf : 0 vrai, 1 faux
  attendu  jsonb not null default '[]'::jsonb,   -- écrit : réponses admises, déjà normalisées par l'app
  reponse  text not null check (char_length(reponse) between 1 and 400),
  primary key (salle_id, rang)
);

create table if not exists public.salle_joueurs (
  salle_id  uuid not null references public.salles(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  nom       text not null,
  score     integer not null default 0,
  serie     smallint not null default 0,
  justes    smallint not null default 0,
  exclu     boolean not null default false,
  vu_rang   smallint,                -- la dernière question dont ce joueur a reçu les choix…
  vu_at     timestamptz,             -- …et quand : c'est de là que part SON chrono
  joined_at timestamptz not null default now(),
  primary key (salle_id, user_id)
);
create index if not exists salle_joueurs_user_idx on public.salle_joueurs (user_id);

create table if not exists public.salle_reponses (
  salle_id uuid not null,
  rang     smallint not null,
  user_id  uuid not null,
  choix    smallint,
  texte    text check (char_length(texte) <= 200),
  juste    boolean not null,
  points   integer not null,
  ms       integer not null,
  at       timestamptz not null default now(),
  primary key (salle_id, rang, user_id),
  foreign key (salle_id, user_id) references public.salle_joueurs (salle_id, user_id) on delete cascade
);
create index if not exists salle_reponses_joueur_idx on public.salle_reponses (salle_id, user_id);

alter table public.salles enable row level security;
alter table public.salle_questions enable row level security;
alter table public.salle_joueurs enable row level security;
alter table public.salle_reponses enable row level security;

-- Tout passe par les fonctions ci-dessous ; les lectures directes restent
-- possibles pour ce qui est à soi, et rien ne s'écrit sans elles. Les deux
-- fonctions d'appartenance sont en security definer : sans elles, la règle
-- des salles lirait les joueurs, dont la règle relirait les salles, à
-- l'infini (« infinite recursion detected in policy »).
create or replace function public.anime_salle(sid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.salles s where s.id = sid and s.hote = auth.uid()) $$;
create or replace function public.joue_salle(sid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.salle_joueurs j
                 where j.salle_id = sid and j.user_id = auth.uid() and not j.exclu) $$;
revoke all on function public.anime_salle(uuid) from public, anon;
revoke all on function public.joue_salle(uuid) from public, anon;
grant execute on function public.anime_salle(uuid) to authenticated;
grant execute on function public.joue_salle(uuid) to authenticated;

drop policy if exists salles_lire on public.salles;
create policy salles_lire on public.salles for select to authenticated
  using (hote = (select auth.uid()) or public.joue_salle(id));
drop policy if exists salle_questions_lire on public.salle_questions;
create policy salle_questions_lire on public.salle_questions for select to authenticated
  using (public.anime_salle(salle_id));
drop policy if exists salle_joueurs_lire on public.salle_joueurs;
create policy salle_joueurs_lire on public.salle_joueurs for select to authenticated
  using (user_id = (select auth.uid()) or public.anime_salle(salle_id));
drop policy if exists salle_reponses_lire on public.salle_reponses;
create policy salle_reponses_lire on public.salle_reponses for select to authenticated
  using (user_id = (select auth.uid()) or public.anime_salle(salle_id));

-- Ouvrir une salle. `questions` : [{e: énoncé, c: [choix], b: bon rang,
-- a: [réponses admises normalisées], r: réponse à afficher}], fabriquées par
-- l'app depuis un livre (src/defi.js). Une salle à la fois par hôte : en
-- ouvrir une ferme la précédente.
create or replace function public.salle_ouvrir(titre text, jeu text, duree integer, questions jsonb,
                                              classe uuid default null, club uuid default null)
returns table (id uuid, pin text)
language plpgsql security definer set search_path = '' as $$
declare
  u uuid := auth.uid(); s uuid; p text; n integer; q jsonb; k integer := 0; nc integer; b integer;
begin
  if u is null then raise exception 'Connexion requise'; end if;
  if salle_ouvrir.classe is not null and salle_ouvrir.club is not null then
    raise exception 'Une classe ou un club, pas les deux';
  end if;
  if salle_ouvrir.classe is not null and not (public.teaches(salle_ouvrir.classe)
     or exists (select 1 from public.classes c where c.id = salle_ouvrir.classe and c.owner = u)) then
    raise exception 'Cette classe n''est pas la tienne';
  end if;
  if salle_ouvrir.club is not null and not public.in_group(salle_ouvrir.club) then
    raise exception 'Tu n''es pas dans ce club';
  end if;
  if salle_ouvrir.classe is null and public.est_eleve_de_classe(u) then
    raise exception 'Un compte de classe ne peut pas ouvrir de salle';
  end if;
  if salle_ouvrir.jeu is null or salle_ouvrir.jeu not in ('qcm', 'vf', 'ecrit') then raise exception 'Jeu inconnu'; end if;
  if salle_ouvrir.duree is null or salle_ouvrir.duree not between 5 and 120 then
    raise exception 'Entre 5 et 120 secondes par question';
  end if;
  if char_length(btrim(coalesce(salle_ouvrir.titre, ''))) not between 1 and 80 then raise exception 'Il faut un titre'; end if;
  n := case when jsonb_typeof(salle_ouvrir.questions) = 'array' then jsonb_array_length(salle_ouvrir.questions) else 0 end;
  if n not between 1 and 50 then raise exception 'Entre 1 et 50 questions'; end if;
  if (select count(*) from public.salles x where x.hote = u and x.created_at > now() - interval '1 day') >= 40 then
    raise exception 'Trop de salles ouvertes aujourd''hui';
  end if;
  for q in select value from jsonb_array_elements(salle_ouvrir.questions) loop
    k := k + 1;
    if jsonb_typeof(q) <> 'object'
       or char_length(coalesce(q->>'e', '')) not between 1 and 400
       or char_length(coalesce(q->>'r', '')) not between 1 and 400 then
      raise exception 'Question % illisible', k;
    end if;
    nc := case when jsonb_typeof(q->'c') = 'array' then jsonb_array_length(q->'c') else 0 end;
    if exists (select 1 from jsonb_array_elements(coalesce(q->'c', '[]'::jsonb)) x
               where jsonb_typeof(x) <> 'string' or char_length(x #>> '{}') not between 1 and 200) then
      raise exception 'Question % : un choix est vide ou trop long', k;
    end if;
    b := case when coalesce(q->>'b', '') ~ '^[0-9]+$' then (q->>'b')::integer else -1 end;
    if salle_ouvrir.jeu = 'qcm' and (nc not between 2 and 4 or b not between 0 and nc - 1) then
      raise exception 'Question % : il faut 2 à 4 choix et le bon', k;
    end if;
    if salle_ouvrir.jeu = 'vf' and (nc <> 1 or b not in (0, 1)) then
      raise exception 'Question % : une proposition, vraie ou fausse', k;
    end if;
    if salle_ouvrir.jeu = 'ecrit' and (jsonb_typeof(q->'a') is distinct from 'array'
       or jsonb_array_length(q->'a') not between 1 and 10
       or exists (select 1 from jsonb_array_elements(q->'a') x
                  where jsonb_typeof(x) <> 'string' or char_length(x #>> '{}') not between 1 and 200)) then
      raise exception 'Question % : il faut la réponse attendue', k;
    end if;
  end loop;

  update public.salles x set etat = 'fini', fini_at = now() where x.hote = u and x.etat <> 'fini';
  loop
    p := lpad(((('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint) % 1000000)::text, 6, '0');
    exit when not exists (select 1 from public.salles x where x.pin = p and x.etat <> 'fini');
  end loop;
  insert into public.salles (pin, hote, hote_nom, class_id, group_id, titre, jeu, duree, total)
  values (p, u,
          coalesce((select coalesce(nullif(btrim(pr.name), ''), nullif(btrim(pr.handle), ''))
                    from public.profiles pr where pr.id = u), 'Hôte'),
          salle_ouvrir.classe, salle_ouvrir.club, btrim(salle_ouvrir.titre), salle_ouvrir.jeu,
          salle_ouvrir.duree, n)
  returning salles.id into s;
  insert into public.salle_questions (salle_id, rang, enonce, choix, bonne, attendu, reponse)
  select s, (t.o - 1)::smallint, t.x->>'e', coalesce(t.x->'c', '[]'::jsonb),
         case when coalesce(t.x->>'b', '') ~ '^[0-9]+$' then (t.x->>'b')::smallint end,
         coalesce(t.x->'a', '[]'::jsonb), t.x->>'r'
  from jsonb_array_elements(salle_ouvrir.questions) with ordinality as t(x, o);
  return query select s, p;
end $$;
revoke all on function public.salle_ouvrir(text, text, integer, jsonb, uuid, uuid) from public, anon;
grant execute on function public.salle_ouvrir(text, text, integer, jsonb, uuid, uuid) to authenticated;

-- Entrer avec le code. Renvoie un statut au lieu de lever : un essai faux
-- doit rester compté (une exception annulerait la ligne d'essai).
--   ok, hote, format, inconnu, trop (12 codes faux en 10 min), classe, club,
--   exclu, pleine (300 joueurs)
create or replace function public.salle_rejoindre(code text)
returns table (statut text, salle uuid, titre text)
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); p text; s public.salles%rowtype; j public.salle_joueurs%rowtype;
begin
  if u is null then raise exception 'Connexion requise'; end if;
  p := regexp_replace(coalesce(code, ''), '[^0-9]', '', 'g');
  if char_length(p) <> 6 then return query select 'format'::text, null::uuid, null::text; return; end if;
  if (select count(*) from public.essais_codes e
      where e.user_id = u and e.sorte = 'salle' and e.at > now() - interval '10 minutes') >= 12 then
    return query select 'trop'::text, null::uuid, null::text; return;
  end if;
  delete from public.essais_codes e where e.user_id = u and e.at < now() - interval '1 day';
  select * into s from public.salles x
  where x.pin = p and x.etat <> 'fini' and x.created_at > now() - interval '4 hours';
  if not found or public.blocked(s.hote)
     or (s.class_id is null and s.group_id is null and public.est_eleve_de_classe(u)
         and coalesce((select r.role from public.user_roles r where r.user_id = s.hote), 'eleve')
             not in ('prof', 'admin')) then
    insert into public.essais_codes (user_id, sorte) values (u, 'salle');
    return query select 'inconnu'::text, null::uuid, null::text; return;
  end if;
  if s.hote = u then return query select 'hote'::text, s.id, s.titre; return; end if;
  if s.class_id is not null and not (public.in_class(s.class_id) or public.teaches(s.class_id)) then
    insert into public.essais_codes (user_id, sorte) values (u, 'salle');
    return query select 'classe'::text, null::uuid, null::text; return;
  end if;
  if s.group_id is not null and not public.in_group(s.group_id) then
    insert into public.essais_codes (user_id, sorte) values (u, 'salle');
    return query select 'club'::text, null::uuid, null::text; return;
  end if;
  select * into j from public.salle_joueurs x where x.salle_id = s.id and x.user_id = u;
  if found then
    if j.exclu then return query select 'exclu'::text, null::uuid, null::text; return; end if;
    return query select 'ok'::text, s.id, s.titre; return;
  end if;
  if (select count(*) from public.salle_joueurs x where x.salle_id = s.id) >= 300 then
    return query select 'pleine'::text, null::uuid, null::text; return;
  end if;
  insert into public.salle_joueurs (salle_id, user_id, nom)
  values (s.id, u, public.nom_joueur(u, s.class_id is not null)) on conflict do nothing;
  return query select 'ok'::text, s.id, s.titre;
end $$;
revoke all on function public.salle_rejoindre(text) from public, anon;
grant execute on function public.salle_rejoindre(text) to authenticated;

-- L'état d'une salle, tel que celui qui demande a le droit de le voir.
-- Interrogée chaque seconde par chaque écran : elle fait aussi avancer la
-- salle d'elle-même (question close quand le temps est écoulé ou que tout
-- le monde a répondu, salle fermée au bout de 4 heures), et note l'instant
-- où un joueur reçoit les choix — le départ de son chrono.
create or replace function public.salle_etat(salle uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  u uuid := auth.uid(); s public.salles%rowtype; j public.salle_joueurs%rowtype; joueur boolean;
  hote boolean; nj integer; nr integer; q public.salle_questions%rowtype; res jsonb; nopt integer;
  choix_visibles boolean;
begin
  select * into s from public.salles x where x.id = salle_etat.salle;
  if not found then return jsonb_build_object('etat', 'absent'); end if;
  hote := s.hote = u;
  select * into j from public.salle_joueurs x where x.salle_id = s.id and x.user_id = u;
  joueur := found and not j.exclu;
  if not hote and not joueur then
    return jsonb_build_object('etat', case when found and j.exclu then 'exclu' else 'absent' end);
  end if;
  if s.etat <> 'fini' and s.created_at < now() - interval '4 hours' then
    update public.salles x set etat = 'fini', fini_at = now() where x.id = s.id returning * into s;
  end if;
  select count(*) into nj from public.salle_joueurs x where x.salle_id = s.id and not x.exclu;
  if s.etat = 'question' then
    select count(*) into nr from public.salle_reponses r where r.salle_id = s.id and r.rang = s.rang;
    if now() > s.fin or (nj > 0 and nr >= nj) then
      update public.salles x set etat = 'correction'
      where x.id = s.id and x.etat = 'question' and x.rang = s.rang;
      select * into s from public.salles x where x.id = salle_etat.salle;
    end if;
  end if;
  select count(*) into nr from public.salle_reponses r where r.salle_id = s.id and r.rang = s.rang;
  choix_visibles := s.etat = 'correction' or (s.etat = 'question' and now() >= s.debut);
  if joueur and s.etat = 'question' and choix_visibles and j.vu_rang is distinct from s.rang then
    update public.salle_joueurs x set vu_rang = s.rang, vu_at = now()
    where x.salle_id = s.id and x.user_id = u;
  end if;

  res := jsonb_build_object(
    'id', s.id, 'etat', s.etat, 'rang', s.rang, 'total', s.total, 'titre', s.titre, 'jeu', s.jeu,
    'duree', s.duree, 'pin', s.pin, 'hote', hote, 'hote_nom', s.hote_nom,
    'debut', s.debut, 'fin', s.fin, 'maintenant', now(), 'joueurs', nj, 'repondu', nr,
    'classe', (select c.name from public.classes c where c.id = s.class_id),
    'club', (select g.name from public.groups g where g.id = s.group_id));

  if s.etat in ('question', 'correction') then
    select * into q from public.salle_questions x where x.salle_id = s.id and x.rang = s.rang;
    res := res || jsonb_build_object('question', jsonb_build_object(
      'enonce', q.enonce,
      'choix', case when choix_visibles or hote then q.choix else '[]'::jsonb end));
  end if;

  if s.etat = 'correction' then
    nopt := case s.jeu when 'qcm' then jsonb_array_length(q.choix) when 'vf' then 2 else 0 end;
    res := res || jsonb_build_object('correction', jsonb_build_object(
      'bonne', q.bonne, 'reponse', q.reponse,
      'repartition', (select coalesce(jsonb_agg(coalesce(c.n, 0) order by k.i), '[]'::jsonb)
                      from generate_series(0, nopt - 1) k(i)
                      left join (select r.choix, count(*)::integer n from public.salle_reponses r
                                 where r.salle_id = s.id and r.rang = s.rang group by r.choix) c
                        on c.choix = k.i),
      'justes', (select count(*) from public.salle_reponses r
                 where r.salle_id = s.id and r.rang = s.rang and r.juste)));
  end if;

  if s.etat in ('correction', 'fini') then
    res := res || jsonb_build_object('top', (
      select coalesce(jsonb_agg(jsonb_build_object('nom', t.nom, 'score', t.score, 'justes', t.justes,
                                                   'moi', t.user_id = u) order by t.score desc, t.joined_at), '[]'::jsonb)
      from (select * from public.salle_joueurs x where x.salle_id = s.id and not x.exclu
            order by x.score desc, x.joined_at
            limit case when s.etat = 'fini' then 100 else 5 end) t));
  end if;

  if s.etat = 'attente' then
    res := res || jsonb_build_object('liste', (
      select coalesce(jsonb_agg(case when hote then jsonb_build_object('id', x.user_id, 'nom', x.nom)
                                     else jsonb_build_object('nom', x.nom, 'moi', x.user_id = u) end
                                order by x.joined_at), '[]'::jsonb)
      from public.salle_joueurs x where x.salle_id = s.id and not x.exclu));
  end if;

  if joueur then
    select * into j from public.salle_joueurs x where x.salle_id = s.id and x.user_id = u;
    res := res || jsonb_build_object('moi', jsonb_build_object(
      'nom', j.nom, 'score', j.score, 'serie', j.serie, 'justes', j.justes,
      'place', 1 + (select count(*) from public.salle_joueurs x
                    where x.salle_id = s.id and not x.exclu and x.score > j.score),
      'repondu', exists (select 1 from public.salle_reponses r
                         where r.salle_id = s.id and r.rang = s.rang and r.user_id = u),
      'derniere', case when s.etat = 'correction' then (
        select jsonb_build_object('juste', r.juste, 'points', r.points, 'choix', r.choix)
        from public.salle_reponses r where r.salle_id = s.id and r.rang = s.rang and r.user_id = u) end));
  end if;
  return res;
end $$;
revoke all on function public.salle_etat(uuid) from public, anon;
grant execute on function public.salle_etat(uuid) to authenticated;

-- Répondre. Renvoie ok, deja, ferme (trop tard, ou pas encore), absent.
-- Ne dit PAS si c'est juste : la correction le dira à tout le monde en même
-- temps, sans qu'un voisin puisse souffler pendant le compte à rebours.
create or replace function public.salle_repondre(salle uuid, rang integer, choix integer default null,
                                                texte text default null)
returns text language plpgsql security definer set search_path = '' as $$
declare
  u uuid := auth.uid(); s public.salles%rowtype; j public.salle_joueurs%rowtype;
  q public.salle_questions%rowtype; v_ok boolean; v_ms integer; v_pts integer; v_serie integer;
  nj integer; nr integer;
begin
  select * into s from public.salles x where x.id = salle_repondre.salle for update;
  if not found then return 'absent'; end if;
  select * into j from public.salle_joueurs x where x.salle_id = s.id and x.user_id = u;
  if not found or j.exclu then return 'absent'; end if;
  if s.etat <> 'question' or s.rang <> salle_repondre.rang or now() < s.debut
     or now() > s.fin + interval '1500 milliseconds' then
    return 'ferme';
  end if;
  if exists (select 1 from public.salle_reponses r
             where r.salle_id = s.id and r.rang = s.rang and r.user_id = u) then
    return 'deja';
  end if;
  select * into q from public.salle_questions x where x.salle_id = s.id and x.rang = s.rang;
  if s.jeu = 'ecrit' then
    v_ok := char_length(coalesce(salle_repondre.texte, '')) between 1 and 200
            and q.attendu ? salle_repondre.texte;
  else
    v_ok := salle_repondre.choix is not null and salle_repondre.choix = q.bonne;
  end if;
  v_ms := greatest(0, least(s.duree * 1000, (extract(epoch from (now() -
            case when j.vu_rang = s.rang and j.vu_at is not null then j.vu_at else s.debut end)) * 1000)::integer));
  v_serie := case when not v_ok then 0
                  when exists (select 1 from public.salle_reponses r where r.salle_id = s.id
                               and r.rang = s.rang - 1 and r.user_id = u and r.juste) then j.serie + 1
                  else 1 end;
  v_pts := case when v_ok then round(1000 * (1 - v_ms::numeric / (s.duree * 1000) / 2))::integer
                               + least(greatest(v_serie - 1, 0), 5) * 50
                else 0 end;
  insert into public.salle_reponses (salle_id, rang, user_id, choix, texte, juste, points, ms)
  values (s.id, s.rang, u,
          case when s.jeu = 'ecrit' then null else salle_repondre.choix end,
          case when s.jeu = 'ecrit' then left(salle_repondre.texte, 200) end,
          v_ok, v_pts, v_ms);
  update public.salle_joueurs x
  set score = x.score + v_pts, serie = v_serie, justes = x.justes + case when v_ok then 1 else 0 end
  where x.salle_id = s.id and x.user_id = u;
  select count(*) into nj from public.salle_joueurs x where x.salle_id = s.id and not x.exclu;
  select count(*) into nr from public.salle_reponses r where r.salle_id = s.id and r.rang = s.rang;
  if nr >= nj then
    update public.salles x set etat = 'correction' where x.id = s.id and x.etat = 'question' and x.rang = s.rang;
  end if;
  return 'ok';
end $$;
revoke all on function public.salle_repondre(uuid, integer, integer, text) from public, anon;
grant execute on function public.salle_repondre(uuid, integer, integer, text) to authenticated;

-- L'hôte fait avancer la salle. `depuis` et `rang_vu` disent ce que son
-- écran affichait : un double clic, ou deux onglets, n'avancent qu'une
-- fois. Chaque question laisse 3 secondes pour lire l'énoncé avant que les
-- choix n'apparaissent (et que les chronos ne partent).
create or replace function public.salle_avancer(salle uuid, depuis text, rang_vu integer)
returns text language plpgsql security definer set search_path = '' as $$
declare s public.salles%rowtype; nj integer;
begin
  select * into s from public.salles x where x.id = salle_avancer.salle for update;
  if not found or s.hote <> auth.uid() then raise exception 'Cette salle n''est pas la tienne'; end if;
  if s.etat <> salle_avancer.depuis or s.rang <> salle_avancer.rang_vu then return s.etat; end if;
  if s.etat = 'attente' then
    select count(*) into nj from public.salle_joueurs x where x.salle_id = s.id and not x.exclu;
    if nj = 0 then return 'vide'; end if;
    update public.salles x set etat = 'question', rang = 0, debut = now() + interval '3 seconds',
           fin = now() + interval '3 seconds' + make_interval(secs => s.duree)
    where x.id = s.id;
    return 'question';
  elsif s.etat = 'question' then
    update public.salles x set etat = 'correction' where x.id = s.id;
    return 'correction';
  elsif s.etat = 'correction' then
    if s.rang + 1 >= s.total then
      update public.salles x set etat = 'fini', fini_at = now() where x.id = s.id;
      return 'fini';
    end if;
    update public.salles x set etat = 'question', rang = s.rang + 1, debut = now() + interval '3 seconds',
           fin = now() + interval '3 seconds' + make_interval(secs => s.duree)
    where x.id = s.id;
    return 'question';
  end if;
  return s.etat;
end $$;
revoke all on function public.salle_avancer(uuid, text, integer) from public, anon;
grant execute on function public.salle_avancer(uuid, text, integer) to authenticated;

create or replace function public.salle_exclure(salle uuid, joueur uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.salles s where s.id = salle_exclure.salle and s.hote = auth.uid()) then
    raise exception 'Cette salle n''est pas la tienne';
  end if;
  update public.salle_joueurs x set exclu = true
  where x.salle_id = salle_exclure.salle and x.user_id = salle_exclure.joueur;
end $$;
revoke all on function public.salle_exclure(uuid, uuid) from public, anon;
grant execute on function public.salle_exclure(uuid, uuid) to authenticated;

create or replace function public.salle_fermer(salle uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.salles x set etat = 'fini', fini_at = now()
  where x.id = salle_fermer.salle and x.hote = auth.uid() and x.etat <> 'fini';
end $$;
revoke all on function public.salle_fermer(uuid) from public, anon;
grant execute on function public.salle_fermer(uuid) to authenticated;

-- Les salles en cours où je peux entrer : celles de mes classes, de mes
-- clubs, celles où je suis déjà, celle que j'anime.
create or replace function public.salles_ouvertes()
returns table (id uuid, pin text, titre text, jeu text, hote_nom text, etat text, joueurs integer,
               classe text, club text, class_id uuid, group_id uuid, dedans boolean, hote boolean,
               created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select s.id, s.pin, s.titre, s.jeu, s.hote_nom, s.etat,
         (select count(*) from public.salle_joueurs x where x.salle_id = s.id and not x.exclu)::integer,
         c.name, g.name, s.class_id, s.group_id,
         exists (select 1 from public.salle_joueurs x where x.salle_id = s.id and x.user_id = auth.uid() and not x.exclu),
         s.hote = auth.uid(), s.created_at
  from public.salles s
  left join public.classes c on c.id = s.class_id
  left join public.groups g on g.id = s.group_id
  where s.etat <> 'fini' and s.created_at > now() - interval '4 hours'
    and not public.blocked(s.hote)
    and not exists (select 1 from public.salle_joueurs x where x.salle_id = s.id and x.user_id = auth.uid() and x.exclu)
    and (s.hote = auth.uid()
      or exists (select 1 from public.salle_joueurs x where x.salle_id = s.id and x.user_id = auth.uid())
      or (s.class_id is not null and (public.in_class(s.class_id) or public.teaches(s.class_id)))
      or (s.group_id is not null and public.in_group(s.group_id)))
  order by s.created_at desc
  limit 20
$$;
revoke all on function public.salles_ouvertes() from public, anon;
grant execute on function public.salles_ouvertes() to authenticated;

-- Les dernières salles terminées d'un club ou d'une classe, avec leur
-- podium : ce qui fait vivre un club entre deux parties.
create or replace function public.salles_terminees(club uuid default null, classe uuid default null)
returns table (id uuid, titre text, jeu text, hote_nom text, fini_at timestamptz, joueurs integer,
               podium jsonb, moi jsonb)
language sql stable security definer set search_path = '' as $$
  select s.id, s.titre, s.jeu, s.hote_nom, s.fini_at,
         (select count(*) from public.salle_joueurs x where x.salle_id = s.id and not x.exclu)::integer,
         (select coalesce(jsonb_agg(jsonb_build_object('nom', t.nom, 'score', t.score) order by t.score desc), '[]'::jsonb)
          from (select x.nom, x.score from public.salle_joueurs x where x.salle_id = s.id and not x.exclu
                order by x.score desc, x.joined_at limit 3) t),
         (select jsonb_build_object('score', x.score, 'place', 1 + (select count(*) from public.salle_joueurs y
                 where y.salle_id = s.id and not y.exclu and y.score > x.score))
          from public.salle_joueurs x where x.salle_id = s.id and x.user_id = auth.uid() and not x.exclu)
  from public.salles s
  where s.etat = 'fini' and s.rang >= 0
    and ((salles_terminees.club is not null and s.group_id = salles_terminees.club and public.in_group(salles_terminees.club))
      or (salles_terminees.classe is not null and s.class_id = salles_terminees.classe
          and (public.in_class(salles_terminees.classe) or public.teaches(salles_terminees.classe))))
  order by s.fini_at desc nulls last
  limit 10
$$;
revoke all on function public.salles_terminees(uuid, uuid) from public, anon;
grant execute on function public.salles_terminees(uuid, uuid) to authenticated;


-- Mes clubs, avec de quoi les reconnaître et les comparer d'un coup d'œil :
-- membres, pages lues par le club cette semaine, mon rang dans le club,
-- une salle en direct ouverte.
create or replace function public.mes_clubs()
returns table (id uuid, nom text, code text, chef boolean, embleme text, teinte smallint,
               devise text, membres integer, pages integer, mes_pages integer, mon_rang integer,
               en_direct uuid)
language sql stable security definer set search_path = '' as $$
  with mes as (
    select g.* from public.groups g
    join public.group_members m on m.group_id = g.id and m.user_id = auth.uid()
  ), sem as (
    select m.group_id, m.user_id,
           (select count(*) from public.reviews r
            where r.user_id = m.user_id and r.created_at >= now() - interval '7 days')::integer as n
    from public.group_members m join mes on mes.id = m.group_id
    where not public.blocked(m.user_id)
  )
  select g.id, g.name, g.code, g.owner = auth.uid(), g.embleme, g.teinte, g.devise,
         (select count(*) from public.group_members m where m.group_id = g.id)::integer,
         coalesce((select sum(s.n) from sem s where s.group_id = g.id), 0)::integer,
         coalesce((select s.n from sem s where s.group_id = g.id and s.user_id = auth.uid()), 0),
         (1 + (select count(*) from sem s where s.group_id = g.id and s.n >
               coalesce((select s2.n from sem s2 where s2.group_id = g.id and s2.user_id = auth.uid()), 0)))::integer,
         (select x.id from public.salles x where x.group_id = g.id and x.etat <> 'fini'
            and x.created_at > now() - interval '4 hours' order by x.created_at desc limit 1)
  from mes g
  order by g.name
$$;

revoke all on function public.mes_clubs() from public, anon;
grant execute on function public.mes_clubs() to authenticated;
revoke all on function public.club_membres(uuid) from public, anon;
grant execute on function public.club_membres(uuid) to authenticated;

-- ── 3. minimisation (RGPD) ─────────────────────────────────────────────
-- Une partie en direct n'a pas à durer : salles, réponses et noms
-- disparaissent au bout de 60 jours, les essais de code au bout d'un jour.
create or replace function public.purge_salles()
returns void language sql security definer set search_path = '' as $$
  delete from public.salles where created_at < now() - interval '60 days';
  delete from public.essais_codes where at < now() - interval '1 day';
$$;
revoke all on function public.purge_salles() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'purge-salles-quotidienne') then
      perform cron.unschedule('purge-salles-quotidienne');
    end if;
    perform cron.schedule('purge-salles-quotidienne', '41 3 * * *', 'select public.purge_salles();');
  end if;
end $$;
