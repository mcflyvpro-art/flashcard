-- ══════════ bloquer ══════════
-- Une seule ligne, de celui qui bloque vers celui qu'il bloque. Mais la
-- coupure est symétrique : si l'un bloque, aucun des deux ne voit plus
-- l'autre. Un blocage à sens unique laisse celui qu'on fuit continuer de
-- vous lire, ce qui est exactement ce qu'on voulait empêcher.
create table if not exists public.blocks (
  user_id    uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, blocked_id),
  check (user_id <> blocked_id)
);
alter table public.blocks enable row level security;
create policy blocks_read on public.blocks for select to authenticated
  using (user_id = (select auth.uid()));
create policy blocks_add on public.blocks for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy blocks_drop on public.blocks for delete to authenticated
  using (user_id = (select auth.uid()));
create index if not exists blocks_blocked_idx on public.blocks (blocked_id);

create or replace function public.blocked(other uuid)
returns boolean language sql stable security definer set search_path to ''
as $$ select exists (select 1 from public.blocks b
       where (b.user_id = auth.uid() and b.blocked_id = other)
          or (b.user_id = other and b.blocked_id = auth.uid())) $$;
revoke all on function public.blocked(uuid) from public, anon;
grant execute on function public.blocked(uuid) to authenticated;

-- Bloquer rompt le lien de lecture : sans ça, la personne resterait dans
-- la liste d'amis, invisible mais présente, et un déblocage la ferait
-- réapparaître sans qu'on l'ait redemandé.
create or replace function public.block_user(other uuid)
returns void language plpgsql security definer set search_path to '' as $$
begin
  if auth.uid() is null or other = auth.uid() then raise exception 'cible invalide'; end if;
  insert into public.blocks (user_id, blocked_id) values (auth.uid(), other)
    on conflict do nothing;
  delete from public.friends f
   where (f.user_id = auth.uid() and f.friend_id = other)
      or (f.user_id = other and f.friend_id = auth.uid());
end $$;
revoke all on function public.block_user(uuid) from public, anon;
grant execute on function public.block_user(uuid) to authenticated;

-- ══════════ signaler ══════════
-- Le signalement emporte une copie du contenu visé. Sans elle, il suffit
-- d'effacer pour rendre le signalement incompréhensible : on se retrouve
-- avec une plainte sur un objet qui n'existe plus, impossible à instruire.
create table if not exists public.reports (
  id bigserial primary key,
  reporter    uuid not null references auth.users(id) on delete cascade,
  kind        text not null,          -- mail | library | duel | profile
  target_id   text not null default '',
  target_user uuid references auth.users(id) on delete set null,
  reason      text not null,
  note        text not null default '',
  snapshot    jsonb not null default '{}'::jsonb,
  status      text not null default 'open',
  created_at  timestamptz not null default now(),
  check (kind in ('mail', 'library', 'duel', 'profile')),
  check (status in ('open', 'reviewed', 'closed'))
);
alter table public.reports enable row level security;
-- On signale en son nom, et on ne relit que ses propres signalements.
-- L'instruction se fait hors de l'API, avec la clé de service : personne
-- ne doit pouvoir lire ce que les autres ont signalé.
create policy reports_mine on public.reports for select to authenticated
  using (reporter = (select auth.uid()));
create policy reports_add on public.reports for insert to authenticated
  with check (reporter = (select auth.uid()));
create index if not exists reports_open_idx on public.reports (status, created_at desc);

-- ══════════ ce qui circule tient compte du blocage ══════════
drop policy if exists library_read on public.library;
create policy library_read on public.library for select to authenticated
  using (not public.blocked(user_id)
     and (user_id = (select auth.uid())
       or (group_id is null and public.is_friend(user_id))
       or (group_id is not null and public.in_group(group_id))));

drop policy if exists duels_read on public.duels;
create policy duels_read on public.duels for select to authenticated
  using (not public.blocked(owner)
     and (owner = (select auth.uid())
       or (group_id is null and public.is_friend(owner))
       or (group_id is not null and public.in_group(group_id))));

-- Le courrier déjà reçu d'une personne bloquée disparaît de la boîte, et
-- on ne peut plus lui en envoyer.
drop policy if exists "mail recipient reads own" on public.mail;
create policy "mail recipient reads own" on public.mail for select to authenticated
  using (to_user = (select auth.uid()) and not public.blocked(from_user));
drop policy if exists "mail sender inserts as self" on public.mail;
create policy "mail sender inserts as self" on public.mail for insert to authenticated
  with check (from_user = (select auth.uid()) and not public.blocked(to_user));

-- Une demande d'ami ne part pas vers quelqu'un qu'on a bloqué, ni de la
-- part de quelqu'un qui nous a bloqués.
drop policy if exists friends_ask on public.friends;
create policy friends_ask on public.friends for insert to authenticated
  with check (user_id = (select auth.uid()) and not public.blocked(friend_id));

-- Et le classement ne compte plus les comptes coupés.
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
  where not public.blocked(r.user_id)
    and (days <= 0
      or r.created_at >= now() - (least(days, 3650) || ' days')::interval)
  group by r.user_id, p.name, p.handle
  order by count(*) desc
$$;
revoke all on function public.leaderboard(integer, uuid) from public, anon;
grant execute on function public.leaderboard(integer, uuid) to authenticated;
