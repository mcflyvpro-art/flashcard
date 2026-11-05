-- Décidé le 2026-11-05 : aucun compte qui existe aujourd'hui ne se supprime,
-- confirmé ou non, connecté ou non (de vrais utilisateurs ont des adresses
-- fictives). La purge ne regarde plus que les comptes créés à partir du
-- 2026-11-06 : ceux qui naissent sous la confirmation par code, et qui ne
-- l'ont jamais faite.
create or replace function public.purger_comptes_non_confirmes()
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare n integer;
begin
  delete from auth.users u
  where u.created_at >= timestamptz '2026-11-06 00:00:00+00'
    and u.email_confirmed_at is null
    and u.phone_confirmed_at is null
    and u.last_sign_in_at is null
    and u.created_at < now() - interval '7 days'
    and not exists (select 1 from auth.identities i where i.user_id = u.id and i.provider <> 'email');
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.purger_comptes_non_confirmes() from public, anon, authenticated;
