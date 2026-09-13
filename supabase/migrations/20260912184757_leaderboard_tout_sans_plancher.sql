create or replace function public.leaderboard(days integer default 7, gid uuid default null::uuid)
returns table(uid uuid, who text, handle text, n bigint, ok bigint, jours bigint)
language sql
stable security definer
set search_path to ''
as $function$
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
  where days <= 0
     or r.created_at >= now() - (least(days, 3650) || ' days')::interval
  group by r.user_id, p.name, p.handle
  order by count(*) desc
$function$;
