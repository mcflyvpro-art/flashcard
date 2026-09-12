-- Matières : propres à chaque compte, renommables et recolorables
create table if not exists public.subjects (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  name text not null,
  color text not null default 'graphite',
  pos int not null default 0,
  primary key (user_id, id)
);

-- Paquets : les cartes vivent en JSONB, un paquet = une ligne
create table if not exists public.decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Paquet',
  subject text not null default '',
  hidden boolean not null default false,
  cards jsonb not null default '[]'::jsonb,
  pos int not null default 0,
  updated_at timestamptz not null default now()
);
create index if not exists decks_user_idx on public.decks (user_id, pos);

-- Historique des sessions, pour les courbes de progression
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  deck_id text not null,
  mode text not null,
  pct real not null,
  created_at timestamptz not null default now()
);
create index if not exists sessions_user_idx on public.sessions (user_id, deck_id, mode, created_at);

alter table public.subjects enable row level security;
alter table public.decks    enable row level security;
alter table public.sessions enable row level security;

-- Chaque compte ne voit et n'écrit que ses propres lignes
create policy subjects_own on public.subjects for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy decks_own on public.decks for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy sessions_own on public.sessions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- updated_at tenu à jour côté base
create or replace function public.touch_updated_at() returns trigger
  language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists decks_touch on public.decks;
create trigger decks_touch before update on public.decks
  for each row execute function public.touch_updated_at();
