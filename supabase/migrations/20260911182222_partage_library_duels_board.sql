-- ══════════ bibliothèque commune ══════════
-- Le paquet publié voyage avec une copie de ses cartes, comme le courrier :
-- la table decks reste privée à son propriétaire, et personne n'a besoin
-- d'y accéder pour lire ce qui a été publié volontairement.
create table if not exists public.library (
  deck_id   uuid primary key references public.decks(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  who       text not null default '',
  name      text not null default 'Paquet',
  subject   text not null default '',
  cards     jsonb not null default '[]'::jsonb,
  n         integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.library enable row level security;
drop policy if exists library_read on public.library;
create policy library_read on public.library for select to authenticated using (true);
drop policy if exists library_mine on public.library;
create policy library_mine on public.library for insert to authenticated
  with check (user_id = (select auth.uid()));
drop policy if exists library_edit on public.library;
create policy library_edit on public.library for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists library_drop on public.library;
create policy library_drop on public.library for delete to authenticated
  using (user_id = (select auth.uid()));
create index if not exists library_updated_idx on public.library (updated_at desc);

-- ══════════ défis ══════════
-- Les questions du défi sont figées à la création : tout le monde doit
-- répondre exactement aux mêmes, dans le même ordre, sinon comparer les
-- scores ne veut rien dire. Le paquet d'origine peut changer après coup.
alter table public.duels add column if not exists cards jsonb not null default '[]'::jsonb;
alter table public.duels add column if not exists who text not null default '';
alter table public.duels alter column deck_id drop not null;
drop policy if exists duels_drop on public.duels;
create policy duels_drop on public.duels for delete to authenticated
  using (owner = (select auth.uid()));
create index if not exists duels_created_idx on public.duels (created_at desc);

-- ══════════ classement ══════════
-- Les révisions de chacun sont privées (RLS sur reviews) : seul ce
-- décompte agrégé traverse, jamais le détail des cartes ni des erreurs.
create or replace function public.leaderboard(days integer default 7)
returns table(uid uuid, who text, n bigint, ok bigint, jours bigint)
language sql stable security definer set search_path to ''
as $$
  select r.user_id as uid,
         coalesce(nullif(p.name, ''), p.email, 'Compte') as who,
         count(*) as n,
         count(*) filter (where r.correct) as ok,
         count(distinct (r.created_at at time zone 'utc')::date) as jours
  from public.reviews r
  left join public.profiles p on p.id = r.user_id
  where r.created_at >= now() - (greatest(1, least(days, 365)) || ' days')::interval
  group by r.user_id, p.name, p.email
  order by count(*) desc
$$;
revoke all on function public.leaderboard(integer) from public;
grant execute on function public.leaderboard(integer) to authenticated;
grant execute on function public.shared_deck(text) to authenticated;
