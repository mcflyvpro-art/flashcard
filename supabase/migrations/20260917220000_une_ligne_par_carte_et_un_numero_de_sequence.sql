-- M03.T1 — une ligne par carte, un numéro de séquence par objet.
--
-- Aujourd'hui un paquet est une seule ligne (`decks`) avec toutes ses
-- cartes dans un tableau JSONB : impossible de savoir laquelle a changé
-- entre deux appareils sans comparer le tableau entier, donc impossible
-- de fusionner deux modifications concurrentes sans écraser l'une des
-- deux avec l'autre. `cards` donne à chaque carte sa propre ligne.
--
-- `usn` (update sequence number, comme dans le protocole de
-- synchronisation d'Anki) donne à chaque objet un numéro qui n'augmente
-- que lorsque l'objet change. Un appareil qui revient après une coupure
-- demandera "tout ce qui a un usn plus grand que le dernier que j'ai vu"
-- (M03.T6) au lieu de retélécharger toute la bibliothèque. Le numéro est
-- posé par un déclencheur, jamais par le client : deux écritures
-- concurrentes du même compte ne peuvent pas recevoir le même usn, parce
-- que l'UPSERT qui l'incrémente est une seule opération verrouillée par
-- Postgres.
--
-- Cette table ne remplace pas encore `decks.cards` : les deux vivront en
-- parallèle (double écriture, M03.T3) tant que la lecture n'a pas basculé
-- (M03.T6) et que la fusion à trois versions n'est pas prouvée (M03.T4).
-- Les dates de révision restent en millisecondes (bigint), pas en
-- timestamptz : c'est le format que lit et écrit `src/fsrs.js`, et le
-- moteur ne doit jamais être retouché pour un détail de stockage.

create table if not exists public.cards (
  deck_id       uuid not null references public.decks(id) on delete cascade,
  id            text not null,
  user_id       uuid not null references auth.users(id) on delete cascade,
  front         text not null default '',
  back          text not null default '',
  state         smallint,           -- st : 1 apprentissage · 2 révision · 3 rechute
  step          smallint,           -- sp : palier en cours
  stability     double precision,   -- S
  difficulty    double precision,   -- D
  trace2        double precision,   -- F : seconde trace mémoire (= S en FSRS-6)
  due           bigint,             -- d : échéance, ms epoch
  last_review   bigint,             -- lr : dernière révision, ms epoch
  interval_days double precision,   -- i
  reviews_count integer not null default 0,  -- n
  lapses        integer not null default 0,  -- l
  meta          jsonb not null default '{}'::jsonb, -- champs rares ou hérités (e, x, fi, fa...)
  usn           bigint not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (deck_id, id)
);

create index if not exists cards_user_usn_idx on public.cards (user_id, usn);

alter table public.cards enable row level security;

-- Lecture : son propre compte, sans jointure (chemin chaud, une ligne par
-- carte révisée). Écriture : en plus, la carte doit s'attacher à un
-- paquet qu'on possède déjà — sinon rien n'empêcherait d'accrocher une
-- ligne à l'id d'un paquet d'un autre compte.
create policy cards_own on public.cards for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.decks d
      where d.id = deck_id and d.user_id = (select auth.uid())
    )
  );

drop trigger if exists cards_touch on public.cards;
create trigger cards_touch before update on public.cards
  for each row execute function public.touch_updated_at();

-- Le compteur : un par compte, jamais lu ni écrit directement par un
-- client. RLS activée sans aucune politique = personne n'y touche via
-- PostgREST ; seule la fonction ci-dessous y accède, avec les droits de
-- son propriétaire (security definer).
create table if not exists public.sync_counters (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  next_usn bigint not null default 1
);
alter table public.sync_counters enable row level security;

create or replace function public.assign_usn() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  insert into public.sync_counters (user_id, next_usn) values (new.user_id, 2)
    on conflict (user_id) do update set next_usn = sync_counters.next_usn + 1
    returning next_usn - 1 into new.usn;
  return new;
end $$;

drop trigger if exists cards_usn on public.cards;
create trigger cards_usn before insert or update on public.cards
  for each row execute function public.assign_usn();

-- Les paquets sont eux aussi un objet synchronisé (nom, matière, position,
-- masqué...) : même compteur, même déclencheur.
alter table public.decks add column if not exists usn bigint not null default 0;
create index if not exists decks_user_usn_idx on public.decks (user_id, usn);

drop trigger if exists decks_usn on public.decks;
create trigger decks_usn before insert or update on public.decks
  for each row execute function public.assign_usn();
