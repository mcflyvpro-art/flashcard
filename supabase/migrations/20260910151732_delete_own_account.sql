-- Un compte peut se supprimer lui-même ; les données partent en cascade.
create or replace function public.delete_me()
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not authenticated'; end if;
  delete from auth.users where id = me;
end $$;
revoke all on function public.delete_me() from public;
grant execute on function public.delete_me() to authenticated;
