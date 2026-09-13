-- L'ancienne version à un seul argument rendrait l'appel ambigu : la
-- nouvelle a une valeur par défaut, Postgres ne saurait plus laquelle
-- choisir et refuserait la requête.
drop function if exists public.leaderboard(integer);

-- On ne lit plus l'annuaire entier : soi-même, ses amis (demande en cours
-- comprise, sinon on ne saurait pas qui a demandé) et les gens de ses
-- groupes. Pour ajouter quelqu'un, on passe par la recherche ci-dessous,
-- qui exige le pseudo exact.
drop policy if exists "profiles readable by signed-in users" on public.profiles;
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
  using (id = (select auth.uid())
      or exists (select 1 from public.friends f
                 where (f.user_id = (select auth.uid()) and f.friend_id = profiles.id)
                    or (f.friend_id = (select auth.uid()) and f.user_id = profiles.id))
      or exists (select 1 from public.group_members m
                 where m.user_id = profiles.id and public.in_group(m.group_id)));

create or replace function public.find_user(q text)
returns table(id uuid, handle text, name text)
language sql stable security definer set search_path to ''
as $$
  select p.id, p.handle, coalesce(nullif(p.name, ''), p.handle)
  from public.profiles p
  where p.handle is not null
    and lower(p.handle) = lower(trim(replace(q, '@', '')))
    and p.id <> auth.uid()
  limit 1
$$;
revoke all on function public.find_user(text) from public;
grant execute on function public.find_user(text) to authenticated;

-- La liste de mes amis, avec leur pseudo, en un appel.
create or replace function public.my_friends()
returns table(id uuid, handle text, name text, status text, sens text)
language sql stable security definer set search_path to ''
as $$
  select p.id, p.handle, coalesce(nullif(p.name, ''), p.handle, 'Compte') as name,
         f.status,
         case when f.user_id = auth.uid() then 'envoyee' else 'recue' end as sens
  from public.friends f
  join public.profiles p
    on p.id = case when f.user_id = auth.uid() then f.friend_id else f.user_id end
  where f.user_id = auth.uid() or f.friend_id = auth.uid()
  order by f.status, p.handle
$$;
revoke all on function public.my_friends() from public;
grant execute on function public.my_friends() to authenticated;
