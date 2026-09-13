-- Bloquer rompt le lien, et le profil de la personne cesse d'être lisible :
-- la liste des comptes coupés n'aurait plus que des identifiants bruts à
-- afficher, sur lesquels personne ne peut décider de débloquer. On garde
-- donc le nom tel qu'il était au moment du geste.
alter table public.blocks add column if not exists who text not null default '';

create or replace function public.block_user(other uuid, who text default '')
returns void language plpgsql security definer set search_path to '' as $$
begin
  if auth.uid() is null or other = auth.uid() then raise exception 'cible invalide'; end if;
  insert into public.blocks (user_id, blocked_id, who)
  values (auth.uid(), other, left(coalesce(who, ''), 60))
    on conflict (user_id, blocked_id) do update set who = excluded.who;
  delete from public.friends f
   where (f.user_id = auth.uid() and f.friend_id = other)
      or (f.user_id = other and f.friend_id = auth.uid());
end $$;

-- L'ancienne signature rendrait l'appel ambigu : la nouvelle a une valeur
-- par défaut, Postgres ne saurait plus laquelle choisir.
drop function if exists public.block_user(uuid);
revoke all on function public.block_user(uuid, text) from public, anon;
grant execute on function public.block_user(uuid, text) to authenticated;
