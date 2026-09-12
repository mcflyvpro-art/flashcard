
-- Annuaire minimal des comptes : juste de quoi choisir un destinataire.
-- Lisible par tout compte connecté (pas de données sensibles au-delà du
-- nom affiché), modifiable seulement par son propriétaire.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text,
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

drop policy if exists "profiles readable by signed-in users" on public.profiles;
create policy "profiles readable by signed-in users" on public.profiles
  for select to authenticated using (true);

drop policy if exists "profiles self insert" on public.profiles;
create policy "profiles self insert" on public.profiles
  for insert to authenticated with check (id = auth.uid());

drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- comptes déjà créés avant cette fonctionnalité : sans cette ligne ils
-- resteraient invisibles dans le sélecteur tant qu'ils ne se reconnectent pas
insert into public.profiles (id, email)
select id, email from auth.users
on conflict (id) do nothing;

-- Boîte de réception : un paquet envoyé par un compte à un autre.
-- Les cartes sont copiées telles quelles (texte des deux faces), jamais la
-- progression de révision de l'expéditeur, qui n'a pas de sens ailleurs.
create table if not exists public.mail (
  id bigint generated always as identity primary key,
  from_user uuid not null references auth.users(id) on delete cascade,
  to_user uuid not null references auth.users(id) on delete cascade,
  from_name text not null default '',
  deck_name text not null default 'Paquet',
  message text not null default '',
  cards jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  added_at timestamptz
);
alter table public.mail enable row level security;

drop policy if exists "mail recipient reads own" on public.mail;
create policy "mail recipient reads own" on public.mail
  for select to authenticated using (to_user = auth.uid());

drop policy if exists "mail sender inserts as self" on public.mail;
create policy "mail sender inserts as self" on public.mail
  for insert to authenticated with check (from_user = auth.uid());

drop policy if exists "mail recipient updates own" on public.mail;
create policy "mail recipient updates own" on public.mail
  for update to authenticated using (to_user = auth.uid()) with check (to_user = auth.uid());

drop policy if exists "mail recipient deletes own" on public.mail;
create policy "mail recipient deletes own" on public.mail
  for delete to authenticated using (to_user = auth.uid());

create index if not exists mail_to_user_created_idx on public.mail (to_user, created_at desc);
create index if not exists mail_to_user_unread_idx on public.mail (to_user) where read_at is null;
