-- La sécurité du compte (2026-11-04) : ce qui, dans la base, tient les
-- promesses de l'app (core/compte-auth.js, ui/verif.js, ui/securite.js).
--
-- 1. La vérification en deux étapes tenue par la base. Un compte qui l'a
--    activée (un facteur `verified` dans auth.mfa_factors) n'ouvre ses
--    données personnelles qu'avec une session de second niveau (`aal` =
--    aal2 dans le jeton) : sans cela, son mot de passe seul suffirait à lire
--    ses livres par l'API, et le code de l'application ne protégerait que
--    l'écran. Politiques RESTRICTIVES (elles s'ajoutent aux autres, qui
--    restent), sur les tables de ce qui est à soi ; un compte sans facteur
--    n'y voit aucune différence. `mfa_ok()` est lue une fois par requête
--    (`(select …)`), pas par ligne. Les fonctions `security definer` (classes,
--    cercle, consoles) passent outre, comme toute RLS : le code de l'app
--    n'en appelle aucune avant le second facteur (envoyer, core/coeur-sync.js).
-- 2. L'adresse suivie. Changer d'adresse (« Secure email change », deux
--    codes) change auth.users.email ; profiles.email suit. Un élève
--    d'établissement n'a pas cette porte (son adresse est celle que le
--    référent a donnée, verrouillée par lock_identite_scolaire) : la base le
--    refuse, sauf au référent (ref_update_account).
-- 3. Les comptes jamais confirmés s'en vont. Depuis que la confirmation de
--    l'adresse est demandée (un code de 8 chiffres), un compte créé avec une
--    adresse qui n'existe pas — ou d'une faute de frappe — ne s'ouvre jamais :
--    il ne reste qu'une ligne sans propriétaire. Au bout de 7 jours sans
--    confirmation ni connexion, elle part (minimisation, règle 4 ; ses
--    lignes liées suivent, toutes en cascade). Jamais un compte venu de Google,
--    ni un compte ouvert par l'éditeur ou le référent (confirmé à
--    l'ouverture, compte_ouvrir).

-- ══════════ 1. la vérification en deux étapes, tenue par la base ══════════
create or replace function public.mfa_ok()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce((auth.jwt() ->> 'aal') = 'aal2', false)
      or not exists (select 1 from auth.mfa_factors f
                     where f.user_id = (select auth.uid()) and f.status = 'verified');
$$;
revoke all on function public.mfa_ok() from public, anon;
grant execute on function public.mfa_ok() to authenticated;

do $$
declare t text;
begin
  foreach t in array array['decks', 'cards', 'reviews', 'subjects', 'prefs', 'sessions', 'library',
                           'deck_versions', 'shares', 'mail', 'friends', 'blocks', 'profiles'] loop
    execute format('drop policy if exists deux_etapes on public.%I', t);
    execute format('create policy deux_etapes on public.%I as restrictive for all to authenticated '
                   'using ((select public.mfa_ok())) with check ((select public.mfa_ok()))', t);
  end loop;
end $$;

-- ══════════ 2. l'adresse suivie ══════════
create or replace function public.adresse_suivie()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.email is not distinct from old.email then return new; end if;
  if exists (select 1 from public.org_members m where m.user_id = new.id)
     and coalesce((select r.role from public.user_roles r where r.user_id = new.id), 'eleve') = 'eleve'
     and not public.is_ref() then
    raise exception 'Ton établissement gère ton adresse : demande au référent.' using errcode = '42501';
  end if;
  update public.profiles set email = new.email, updated_at = now() where id = new.id;
  return new;
end $$;
revoke all on function public.adresse_suivie() from public, anon, authenticated;

drop trigger if exists adresse_suivie on auth.users;
create trigger adresse_suivie before update of email on auth.users
  for each row execute function public.adresse_suivie();

-- ══════════ 3. les comptes jamais confirmés ══════════
create or replace function public.purger_comptes_non_confirmes()
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare n integer;
begin
  delete from auth.users u
  where u.email_confirmed_at is null
    and u.phone_confirmed_at is null
    and u.last_sign_in_at is null
    and u.created_at < now() - interval '7 days'
    and not exists (select 1 from auth.identities i where i.user_id = u.id and i.provider <> 'email');
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.purger_comptes_non_confirmes() from public, anon, authenticated;

select cron.unschedule('purge-comptes-non-confirmes')
where exists (select 1 from cron.job where jobname = 'purge-comptes-non-confirmes');
select cron.schedule('purge-comptes-non-confirmes', '41 3 * * *', 'select public.purger_comptes_non_confirmes()');
