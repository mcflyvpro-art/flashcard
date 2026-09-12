-- ══════════ un pseudo par compte ══════════
-- On s'ajoute par pseudo, pas par adresse e-mail : c'est ce qu'on se dit
-- en classe, et ça évite de faire circuler des adresses.
alter table public.profiles add column if not exists handle text;
alter table public.profiles add column if not exists created_at timestamptz not null default now();
create unique index if not exists profiles_handle_key on public.profiles (lower(handle));

-- ══════════ amitiés ══════════
-- Une seule ligne par lien, de celui qui demande vers celui qui reçoit.
-- Tant qu'elle est « en attente », rien n'est partagé.
create table if not exists public.friends (
  user_id   uuid not null references auth.users(id) on delete cascade,
  friend_id uuid not null references auth.users(id) on delete cascade,
  status    text not null default 'pending',
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id),
  check (status in ('pending', 'ok'))
);
alter table public.friends enable row level security;
drop policy if exists friends_read on public.friends;
create policy friends_read on public.friends for select to authenticated
  using (user_id = (select auth.uid()) or friend_id = (select auth.uid()));
drop policy if exists friends_ask on public.friends;
create policy friends_ask on public.friends for insert to authenticated
  with check (user_id = (select auth.uid()));
-- seul celui qui reçoit accepte ; les deux peuvent rompre
drop policy if exists friends_accept on public.friends;
create policy friends_accept on public.friends for update to authenticated
  using (friend_id = (select auth.uid())) with check (friend_id = (select auth.uid()));
drop policy if exists friends_drop on public.friends;
create policy friends_drop on public.friends for delete to authenticated
  using (user_id = (select auth.uid()) or friend_id = (select auth.uid()));
create index if not exists friends_friend_idx on public.friends (friend_id);

-- ══════════ groupes ══════════
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Groupe',
  code text not null unique,
  owner uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id  uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
alter table public.groups enable row level security;
alter table public.group_members enable row level security;

-- Qui est où : deux fonctions en security definer, pour que les règles
-- ci-dessous ne se relisent pas elles-mêmes en boucle.
create or replace function public.in_group(gid uuid)
returns boolean language sql stable security definer set search_path to ''
as $$ select exists (select 1 from public.group_members m
                     where m.group_id = gid and m.user_id = auth.uid()) $$;
create or replace function public.is_friend(other uuid)
returns boolean language sql stable security definer set search_path to ''
as $$ select other = auth.uid() or exists (
        select 1 from public.friends f where f.status = 'ok'
        and ((f.user_id = auth.uid() and f.friend_id = other)
          or (f.friend_id = auth.uid() and f.user_id = other))) $$;

drop policy if exists groups_read on public.groups;
create policy groups_read on public.groups for select to authenticated
  using (owner = (select auth.uid()) or public.in_group(id));
drop policy if exists groups_make on public.groups;
create policy groups_make on public.groups for insert to authenticated
  with check (owner = (select auth.uid()));
drop policy if exists groups_edit on public.groups;
create policy groups_edit on public.groups for update to authenticated
  using (owner = (select auth.uid())) with check (owner = (select auth.uid()));
drop policy if exists groups_drop on public.groups;
create policy groups_drop on public.groups for delete to authenticated
  using (owner = (select auth.uid()));

drop policy if exists gm_read on public.group_members;
create policy gm_read on public.group_members for select to authenticated
  using (user_id = (select auth.uid()) or public.in_group(group_id));
drop policy if exists gm_join on public.group_members;
create policy gm_join on public.group_members for insert to authenticated
  with check (user_id = (select auth.uid()));
drop policy if exists gm_leave on public.group_members;
create policy gm_leave on public.group_members for delete to authenticated
  using (user_id = (select auth.uid())
      or exists (select 1 from public.groups g where g.id = group_id and g.owner = (select auth.uid())));

-- Rejoindre par code sans pouvoir lister les groupes des autres.
create or replace function public.join_group(join_code text)
returns table(id uuid, name text) language plpgsql security definer set search_path to ''
as $$
declare g public.groups%rowtype;
begin
  select * into g from public.groups where upper(code) = upper(trim(join_code));
  if not found then raise exception 'code inconnu'; end if;
  insert into public.group_members (group_id, user_id) values (g.id, auth.uid())
    on conflict do nothing;
  return query select g.id, g.name;
end $$;

-- ══════════ ce qui circule est réservé aux amis et aux groupes ══════════
alter table public.duels add column if not exists group_id uuid references public.groups(id) on delete cascade;
alter table public.library add column if not exists group_id uuid references public.groups(id) on delete cascade;

drop policy if exists duels_read on public.duels;
create policy duels_read on public.duels for select to authenticated
  using (owner = (select auth.uid())
      or (group_id is null and public.is_friend(owner))
      or (group_id is not null and public.in_group(group_id)));
drop policy if exists library_read on public.library;
create policy library_read on public.library for select to authenticated
  using (user_id = (select auth.uid())
      or (group_id is null and public.is_friend(user_id))
      or (group_id is not null and public.in_group(group_id)));
drop policy if exists scores_read on public.duel_scores;
create policy scores_read on public.duel_scores for select to authenticated
  using (exists (select 1 from public.duels d where d.id = duel_id));

-- Le classement ne compte plus tout le monde : moi, mes amis, ou un groupe.
create or replace function public.leaderboard(days integer default 7, gid uuid default null)
returns table(uid uuid, who text, handle text, n bigint, ok bigint, jours bigint)
language sql stable security definer set search_path to ''
as $$
  with cercle as (
    select auth.uid() as id
    union
    select case when f.user_id = auth.uid() then f.friend_id else f.user_id end
    from public.friends f
    where f.status = 'ok' and gid is null
      and (f.user_id = auth.uid() or f.friend_id = auth.uid())
    union
    select m.user_id from public.group_members m
    where gid is not null and m.group_id = gid and public.in_group(gid)
  )
  select r.user_id as uid,
         coalesce(nullif(p.name, ''), p.handle, 'Compte') as who,
         coalesce(p.handle, '') as handle,
         count(*) as n,
         count(*) filter (where r.correct) as ok,
         count(distinct (r.created_at at time zone 'utc')::date) as jours
  from public.reviews r
  join cercle c on c.id = r.user_id
  left join public.profiles p on p.id = r.user_id
  where r.created_at >= now() - (greatest(1, least(days, 3650)) || ' days')::interval
  group by r.user_id, p.name, p.handle
  order by count(*) desc
$$;
revoke all on function public.leaderboard(integer, uuid) from public;
grant execute on function public.leaderboard(integer, uuid) to authenticated;
grant execute on function public.join_group(text) to authenticated;
grant execute on function public.in_group(uuid) to authenticated;
grant execute on function public.is_friend(uuid) to authenticated;
