-- ═══ Réglages par compte (objectif, plafond, tolérance, son, police…) ═══
create table if not exists public.prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ═══ Journal : une ligne par réponse. Base de toutes les statistiques ═══
create table if not exists public.reviews (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  deck_id uuid not null,
  card_id text not null,
  mode text not null,                       -- study | quiz
  rating smallint not null,                 -- 0 encore · 1 difficile · 2 correct · 3 facile
  correct boolean not null,
  ms integer not null default 0,
  reversed boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists reviews_time on public.reviews (user_id, created_at desc);
create index if not exists reviews_card on public.reviews (user_id, deck_id, card_id);

-- ═══ Corbeille, épinglage, verrou de concurrence ═══
alter table public.decks add column if not exists deleted_at timestamptz;
alter table public.decks add column if not exists pinned boolean not null default false;
alter table public.decks add column if not exists rev integer not null default 1;

-- ═══ Historique des versions d'un paquet ═══
create table if not exists public.deck_versions (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  deck_id uuid not null,
  name text not null,
  cards jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists versions_deck on public.deck_versions (user_id, deck_id, created_at desc);

-- ═══ Partage par lien ═══
create table if not exists public.shares (
  token text primary key,
  deck_id uuid not null references public.decks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null default 'ro',          -- ro | copy
  created_at timestamptz not null default now()
);

-- ═══ Duels : même quiz, deux scores ═══
create table if not exists public.duels (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null,
  owner uuid not null references auth.users(id) on delete cascade,
  name text not null,
  total integer not null,
  created_at timestamptz not null default now()
);
create table if not exists public.duel_scores (
  duel_id uuid not null references public.duels(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  who text not null,
  score integer not null,
  ms integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (duel_id, user_id)
);

alter table public.prefs         enable row level security;
alter table public.reviews       enable row level security;
alter table public.deck_versions enable row level security;
alter table public.shares        enable row level security;
alter table public.duels         enable row level security;
alter table public.duel_scores   enable row level security;

create policy prefs_own    on public.prefs         for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy reviews_own  on public.reviews       for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy versions_own on public.deck_versions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy shares_own   on public.shares        for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- un duel est visible de tous les comptes connectés, seul son auteur l'écrit
create policy duels_read   on public.duels for select to authenticated using (true);
create policy duels_write  on public.duels for insert to authenticated
  with check (owner = (select auth.uid()));
create policy scores_read  on public.duel_scores for select to authenticated using (true);
create policy scores_mine  on public.duel_scores for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy scores_edit  on public.duel_scores for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ═══ Lecture d'un paquet partagé : par jeton seulement, jamais énumérable ═══
create or replace function public.shared_deck(tok text)
returns table (name text, subject text, cards jsonb, mode text)
language sql security definer set search_path = '' stable as $$
  select d.name, d.subject, d.cards, s.mode
  from public.shares s join public.decks d on d.id = s.deck_id
  where s.token = tok and d.deleted_at is null
$$;
revoke all on function public.shared_deck(text) from public;
grant execute on function public.shared_deck(text) to anon, authenticated;
