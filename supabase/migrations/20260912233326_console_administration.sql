-- ══════════ ce qu'un administrateur peut faire ══════════
-- Le rôle vit dans une table sans politique d'écriture : personne ne peut
-- se promouvoir. Il faut donc une porte, et une seule, ouverte aux seuls
-- administrateurs et vérifiant elle-même qui appelle.
create or replace function public.admin_accounts()
returns table(id uuid, email text, handle text, name text, role text,
              cree timestamptz, livres bigint, bloque boolean)
language sql stable security definer set search_path to ''
as $$
  select u.id, u.email::text, coalesce(p.handle,''), coalesce(nullif(p.name,''),''),
         coalesce(r.role,'eleve'), u.created_at,
         (select count(*) from public.decks d where d.user_id=u.id and d.deleted_at is null),
         exists (select 1 from public.moderators m where m.user_id=u.id)
  from auth.users u
  left join public.profiles p on p.id = u.id
  left join public.user_roles r on r.user_id = u.id
  where public.is_admin()
  order by u.created_at
$$;
revoke all on function public.admin_accounts() from public, anon;
grant execute on function public.admin_accounts() to authenticated;

-- Trois gardes : être administrateur, un rôle connu, et l'interdiction de
-- se retirer le sien — sinon le dernier administrateur se verrouille dehors.
create or replace function public.set_role(cible uuid, nouveau text)
returns void language plpgsql security definer set search_path to '' as $$
begin
  if not public.is_admin() then raise exception 'non autorisé'; end if;
  if nouveau not in ('eleve','prof','ref','admin') then raise exception 'rôle inconnu'; end if;
  if cible = auth.uid() and nouveau <> 'admin' then
    raise exception 'on ne retire pas son propre rôle';
  end if;
  insert into public.user_roles (user_id, role) values (cible, nouveau)
    on conflict (user_id) do update set role = excluded.role, set_at = now();
  if nouveau = 'admin' then
    insert into public.moderators (user_id) values (cible) on conflict do nothing;
  else
    delete from public.moderators where user_id = cible;
  end if;
end $$;
revoke all on function public.set_role(uuid, text) from public, anon;
grant execute on function public.set_role(uuid, text) to authenticated;
