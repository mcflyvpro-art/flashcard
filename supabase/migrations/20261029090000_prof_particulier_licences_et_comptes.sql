-- ══════════ Le professeur particulier en licence, la salle d'attente, les comptes ouverts par l'éditeur (2026-10-29) ══════════
-- Le parcours demandé le 2026-10-28 (docs/PARCOURS.md) :
--
--   · l'éditeur ouvre le compte d'un professeur particulier (adresse et mot
--     de passe provisoire, à changer à la première connexion) et lui accorde
--     X places d'élèves et un nombre de générations IA par mois ;
--   · l'élève crée son propre compte (Folio gratuit), puis entre le code de
--     son professeur : il passe dans la SALLE D'ATTENTE de la classe, ce qui
--     réserve aussitôt une place de la licence et lui ouvre Folio Campus ;
--   · le professeur vérifie le prénom et le nom : accepté, l'élève entre dans
--     la classe (la place reste prise) ; refusé, la place revient à la
--     licence, l'élève retombe en Folio gratuit et reçoit un mot qui lui dit
--     de recommencer ;
--   · le professeur voit ses places restantes et en commande d'autres.
--
-- Et, partout : la carte élève (comptes sans adresse, identifiant + code
-- imprimé) n'existe plus ; un compte ouvert par quelqu'un d'autre (l'éditeur,
-- le référent) a un mot de passe provisoire, qu'il remplace à sa première
-- connexion ; dans un établissement, le référent prend une place comme les
-- élèves et les professeurs ; l'IA d'un compte Campus a le quota que
-- l'éditeur a fixé.

-- ---------- 1. la carte élève s'en va ----------
-- Aucun compte à carte n'existait en production. La table comptes_geres
-- reste, vide et sans plus aucun écrivain : des fonctions plus anciennes la
-- lisent encore (elle n'y répond plus jamais « oui »).
drop function if exists public.prof_creer_eleves(uuid, jsonb, boolean);
drop function if exists public.prof_nouvelles_cartes(uuid, uuid[]);
drop function if exists public.prof_supprimer_eleve(uuid, uuid);
drop function if exists public.creer_compte_eleve(text, text, uuid);
drop function if exists public.identifiant_libre(text, text);

-- ---------- 2. le mot de passe provisoire ----------
-- Une ligne tant que le compte n'a pas choisi son mot de passe. Elle part
-- d'elle-même quand le mot de passe change (le compte le remplace dans
-- l'app, ou par « mot de passe oublié ») : un déclencheur sur auth.users,
-- pour que rien ne dépende de l'app pour la retirer.
create table if not exists public.mdp_provisoires (
  user_id uuid primary key references auth.users(id) on delete cascade,
  depuis timestamptz not null default now()
);
alter table public.mdp_provisoires enable row level security;
drop policy if exists mdp_provisoires_lire on public.mdp_provisoires;
create policy mdp_provisoires_lire on public.mdp_provisoires for select to authenticated
  using (user_id = (select auth.uid()));
revoke insert, update, delete, truncate on public.mdp_provisoires from anon, authenticated;

create or replace function public.mdp_choisi()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
  delete from public.mdp_provisoires where user_id = new.id;
  return new;
end $$;
revoke all on function public.mdp_choisi() from public, anon, authenticated;
drop trigger if exists mdp_choisi on auth.users;
create trigger mdp_choisi after update of encrypted_password on auth.users
  for each row when (new.encrypted_password is distinct from old.encrypted_password)
  execute function public.mdp_choisi();

-- Interne : appelé APRÈS avoir écrit le mot de passe (le déclencheur vient
-- d'effacer la ligne, celle-ci la repose).
create or replace function public.mdp_provisoire(cible uuid)
returns void language sql security definer set search_path to '' as $$
  insert into public.mdp_provisoires (user_id) values (cible)
  on conflict (user_id) do update set depuis = now()
$$;
revoke all on function public.mdp_provisoire(uuid) from public, anon, authenticated;

-- Ce que l'app sait du compte. `gere` et `identifiant` restent pour les
-- apps déjà installées (toujours faux et vide : plus de carte) ;
-- `provisoire` : le mot de passe est à choisir avant tout le reste.
drop function if exists public.mon_compte();
create function public.mon_compte()
returns table(gere boolean, nom text, identifiant text, provisoire boolean)
language sql stable security definer set search_path to '' as $$
  select false, coalesce(p.name, ''), ''::text,
         exists (select 1 from public.mdp_provisoires x where x.user_id = p.id)
  from public.profiles p where p.id = auth.uid()
$$;
revoke all on function public.mon_compte() from public, anon;
grant execute on function public.mon_compte() to authenticated;

-- Un compte ouvert par quelqu'un d'autre, avec son mot de passe provisoire.
-- Interne (l'éditeur, le référent passent par leurs fonctions à eux).
create or replace function public.compte_ouvrir(adresse text, nom text, pw text)
returns uuid language plpgsql security definer set search_path to '' as $$
declare uid uuid; ad text := lower(trim(coalesce(adresse, '')));
begin
  if length(coalesce(pw, '')) < 10 then raise exception 'Mot de passe : dix caractères au moins'; end if;
  if ad !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'Adresse e-mail invalide'; end if;
  if exists (select 1 from auth.users u where u.email = ad) then raise exception 'Cette adresse a déjà un compte'; end if;
  uid := gen_random_uuid();
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous,
    confirmation_token, recovery_token, email_change_token_new,
    email_change_token_current, email_change, phone_change,
    phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
    ad, extensions.crypt(pw, extensions.gen_salt('bf')), now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false, false,
    '', '', '', '', '', '', '', ''
  );
  insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (uid::text, uid, jsonb_build_object('sub', uid::text, 'email', ad, 'email_verified', true),
          'email', now(), now(), now());
  -- le pseudo vient du déclencheur profiles_pseudo (20261027090000)
  insert into public.profiles (id, email, name) values (uid, ad, nullif(trim(coalesce(nom, '')), ''));
  perform public.mdp_provisoire(uid);
  return uid;
end $$;
revoke all on function public.compte_ouvrir(text, text, text) from public, anon, authenticated;

-- Le référent ouvre un compte : il prend une place, et son mot de passe est provisoire.
create or replace function public.ref_new_account(adresse text, nom text, pseudo text default ''::text,
  qrole text default 'eleve'::text, cid uuid default null::uuid, pw text default ''::text)
returns uuid language plpgsql security definer set search_path to '' as $$
declare uid uuid;
begin
  if not public.is_ref() then raise exception 'Réservé au référent de l''établissement'; end if;
  if qrole not in ('eleve', 'prof') then
    raise exception 'Un référent ouvre des comptes d''élève et de professeur.';
  end if;
  if public.etab_libres(public.my_org()) = 0 then
    raise exception 'Toutes les places de la licence sont prises : demande-en d''autres à Folio, ou retire un compte parti';
  end if;
  if cid is not null and not public.class_in_org(cid) then
    raise exception 'Cette classe n''est pas dans ton établissement';
  end if;
  uid := public.compte_ouvrir(adresse, nom, pw);
  insert into public.user_roles (user_id, role) values (uid, qrole)
    on conflict (user_id) do update set role = excluded.role, set_at = now();
  insert into public.org_members (user_id, org_id) values (uid, public.my_org()) on conflict do nothing;
  if cid is not null and qrole = 'eleve' then
    insert into public.class_members (class_id, user_id, who)
    values (cid, uid, nullif(trim(nom), '')) on conflict do nothing;
  end if;
  perform public.ref_trace(uid, 'compte ouvert', jsonb_build_object('nom', nullif(trim(nom), ''), 'role', qrole));
  return uid;
end $$;
revoke all on function public.ref_new_account(text, text, text, text, uuid, text) from public, anon;
grant execute on function public.ref_new_account(text, text, text, text, uuid, text) to authenticated;

-- « Mot de passe oublié » chez le référent : le nouveau est provisoire aussi.
create or replace function public.ref_set_password(cible uuid, pw text)
returns void language plpgsql security definer set search_path to '' as $$
begin
  perform public.ref_garde(cible);
  if length(coalesce(pw, '')) < 10 then raise exception 'Au moins dix caractères'; end if;
  update auth.users set encrypted_password = extensions.crypt(pw, extensions.gen_salt('bf')), updated_at = now()
   where id = cible;
  perform public.mdp_provisoire(cible);
  perform public.ref_trace(cible, 'mot de passe refait');
end $$;
revoke all on function public.ref_set_password(uuid, text) from public, anon;
grant execute on function public.ref_set_password(uuid, text) to authenticated;

-- ---------- 3. l'éditeur ouvre des comptes ----------
-- Un professeur particulier, un autre éditeur, un élève : une adresse, un
-- nom, un mot de passe provisoire montré une seule fois dans la console.
create or replace function public.admin_creer_compte(adresse text, nom text, qrole text, pw text)
returns uuid language plpgsql security definer set search_path to '' as $$
declare uid uuid;
begin
  if not public.is_admin() then raise exception 'Réservé à l''éditeur' using errcode = '42501'; end if;
  if qrole not in ('prof', 'admin', 'eleve') then raise exception 'Rôle inconnu'; end if;
  if length(trim(coalesce(nom, ''))) not between 2 and 80 then raise exception 'Un nom de 2 à 80 caractères'; end if;
  uid := public.compte_ouvrir(adresse, nom, pw);
  insert into public.user_roles (user_id, role) values (uid, qrole)
    on conflict (user_id) do update set role = excluded.role, set_at = now();
  return uid;
end $$;
revoke all on function public.admin_creer_compte(text, text, text, text) from public, anon;
grant execute on function public.admin_creer_compte(text, text, text, text) to authenticated;

-- Un nouveau mot de passe provisoire (le compte l'a perdu, ou n'est jamais venu).
create or replace function public.admin_mdp(cible uuid, pw text)
returns void language plpgsql security definer set search_path to '' as $$
begin
  if not public.is_admin() then raise exception 'Réservé à l''éditeur' using errcode = '42501'; end if;
  if cible = auth.uid() then raise exception 'Ton propre mot de passe se change dans tes réglages'; end if;
  if length(coalesce(pw, '')) < 10 then raise exception 'Mot de passe : dix caractères au moins'; end if;
  update auth.users set encrypted_password = extensions.crypt(pw, extensions.gen_salt('bf')), updated_at = now()
   where id = cible;
  if not found then raise exception 'Compte inconnu' using errcode = '22023'; end if;
  perform public.mdp_provisoire(cible);
end $$;
revoke all on function public.admin_mdp(uuid, text) from public, anon;
grant execute on function public.admin_mdp(uuid, text) to authenticated;

-- ---------- 4. la licence d'un professeur particulier ----------
-- `places` : les élèves qu'il peut avoir (son propre compte n'en prend pas) ;
-- `ia_prof`, `ia_eleve` : les générations IA par mois, pour lui et pour
-- chacun de ses élèves ; `fin` : nulle = sans date de fin.
create table if not exists public.prof_licences (
  prof uuid primary key references auth.users(id) on delete cascade,
  places integer not null default 0 check (places between 0 and 5000),
  ia_prof integer not null default 50 check (ia_prof between 0 and 5000),
  ia_eleve integer not null default 0 check (ia_eleve between 0 and 1000),
  fin date,
  maj_le timestamptz not null default now()
);
alter table public.prof_licences enable row level security;
drop policy if exists prof_licences_lire on public.prof_licences;
create policy prof_licences_lire on public.prof_licences for select to authenticated
  using (prof = (select auth.uid()));
revoke insert, update, delete, truncate on public.prof_licences from anon, authenticated;

-- Des places en plus, demandées par le professeur ; l'éditeur y répond en
-- changeant la licence (la demande est alors traitée).
create table if not exists public.demandes_places (
  id bigint generated always as identity primary key,
  prof uuid not null references auth.users(id) on delete cascade,
  places integer not null check (places between 1 and 1000),
  message text not null default '' check (length(message) <= 1000),
  cree_le timestamptz not null default now(),
  traitee_le timestamptz
);
create index if not exists demandes_places_prof on public.demandes_places (prof, cree_le desc);
alter table public.demandes_places enable row level security;
drop policy if exists demandes_places_lire on public.demandes_places;
create policy demandes_places_lire on public.demandes_places for select to authenticated
  using (prof = (select auth.uid()));
revoke insert, update, delete, truncate on public.demandes_places from anon, authenticated;

-- Les professeurs particuliers qui existaient gardent ce qu'ils avaient :
-- 30 places, assez pour continuer, et l'éditeur ajuste.
insert into public.prof_licences (prof, places)
select r.user_id, 30 from public.user_roles r
where r.role = 'prof' and not exists (select 1 from public.org_members m where m.user_id = r.user_id)
on conflict (prof) do nothing;

-- Interne : une licence qui court.
create or replace function public.licence_prof(p uuid)
returns public.prof_licences language sql stable security definer set search_path to '' as $$
  select l.* from public.prof_licences l where l.prof = p and (l.fin is null or l.fin >= current_date)
$$;
revoke all on function public.licence_prof(uuid) from public, anon, authenticated;

-- Interne : les élèves d'un professeur particulier, inscrits ou en attente
-- (une demande tient sa place jusqu'à la réponse).
create or replace function public.prof_places_prises(p uuid)
returns integer language sql stable security definer set search_path to '' as $$
  select count(distinct x.user_id)::integer from (
    select m.user_id from public.class_members m join public.classes c on c.id = m.class_id
    where c.owner = p and c.org_id is null and c.archived_at is null
    union
    select r.user_id from public.class_requests r join public.classes c on c.id = r.class_id
    where c.owner = p and c.org_id is null and c.archived_at is null) x
$$;
revoke all on function public.prof_places_prises(uuid) from public, anon, authenticated;

create or replace function public.prof_inscrits(p uuid)
returns integer language sql stable security definer set search_path to '' as $$
  select count(distinct m.user_id)::integer from public.class_members m join public.classes c on c.id = m.class_id
  where c.owner = p and c.org_id is null and c.archived_at is null
$$;
revoke all on function public.prof_inscrits(uuid) from public, anon, authenticated;

-- Ce que le professeur particulier voit de sa licence (nul : il n'en a pas).
create or replace function public.prof_licence()
returns jsonb language sql stable security definer set search_path to '' as $$
  select jsonb_build_object(
    'places', l.places, 'prises', public.prof_places_prises(l.prof), 'inscrits', public.prof_inscrits(l.prof),
    'attente', (select count(distinct r.user_id) from public.class_requests r join public.classes c on c.id = r.class_id
                where c.owner = l.prof and c.org_id is null and c.archived_at is null),
    'fin', l.fin, 'active', (l.fin is null or l.fin >= current_date),
    'ia_prof', l.ia_prof, 'ia_eleve', l.ia_eleve,
    'ia_mois', (select count(*) from public.ai_usage a where a.user_id = l.prof
                and a.day >= date_trunc('month', current_date)::date),
    'demande', (select jsonb_build_object('places', d.places, 'le', d.cree_le) from public.demandes_places d
                where d.prof = l.prof and d.traitee_le is null order by d.cree_le desc limit 1))
  from public.prof_licences l where l.prof = auth.uid()
$$;
revoke all on function public.prof_licence() from public, anon;
grant execute on function public.prof_licence() to authenticated;

-- « Commander des places » : la demande arrive chez l'éditeur.
create or replace function public.prof_commander(places integer, mot text default '')
returns bigint language plpgsql security definer set search_path to '' as $$
declare i bigint;
begin
  if public.my_role() <> 'prof' or public.my_org() is not null then
    raise exception 'Réservé aux professeurs particuliers';
  end if;
  if places is null or places < 1 or places > 1000 then raise exception 'Entre 1 et 1000 places'; end if;
  if length(coalesce(mot, '')) > 1000 then raise exception 'Mille caractères au plus'; end if;
  if (select count(*) from public.demandes_places d where d.prof = auth.uid() and d.cree_le > now() - interval '1 day') >= 5 then
    raise exception 'Cinq demandes par jour au plus : Folio te répond vite';
  end if;
  insert into public.demandes_places (prof, places, message) values (auth.uid(), places, trim(coalesce(mot, '')))
  returning id into i;
  return i;
end $$;
revoke all on function public.prof_commander(integer, text) from public, anon;
grant execute on function public.prof_commander(integer, text) to authenticated;

-- L'éditeur fixe la licence ; les demandes en cours sont alors traitées.
create or replace function public.admin_prof_licence(prof uuid, places integer, ia_prof integer, ia_eleve integer, fin date)
returns jsonb language plpgsql security definer set search_path to '' as $$
begin
  if not public.is_admin() then raise exception 'Réservé à l''éditeur' using errcode = '42501'; end if;
  if coalesce((select r.role from public.user_roles r where r.user_id = admin_prof_licence.prof), 'eleve') <> 'prof' then
    raise exception 'Ce compte n''est pas professeur : donne-lui d''abord ce rôle';
  end if;
  if exists (select 1 from public.org_members m where m.user_id = admin_prof_licence.prof) then
    raise exception 'Ce professeur est dans un établissement : sa place est dans la licence de l''établissement';
  end if;
  if places is null or places not between 0 and 5000 then raise exception 'Entre 0 et 5000 places'; end if;
  if ia_prof is null or ia_prof not between 0 and 5000 then raise exception 'IA du professeur : entre 0 et 5000 par mois'; end if;
  if ia_eleve is null or ia_eleve not between 0 and 1000 then raise exception 'IA par élève : entre 0 et 1000 par mois'; end if;
  insert into public.prof_licences as l (prof, places, ia_prof, ia_eleve, fin, maj_le)
  values (admin_prof_licence.prof, places, ia_prof, ia_eleve, fin, now())
  on conflict on constraint prof_licences_pkey do update
    set places = excluded.places, ia_prof = excluded.ia_prof, ia_eleve = excluded.ia_eleve,
        fin = excluded.fin, maj_le = now();
  update public.demandes_places d set traitee_le = now()
   where d.prof = admin_prof_licence.prof and d.traitee_le is null;
  return jsonb_build_object('places', places, 'prises', public.prof_places_prises(admin_prof_licence.prof));
end $$;
revoke all on function public.admin_prof_licence(uuid, integer, integer, integer, date) from public, anon;
grant execute on function public.admin_prof_licence(uuid, integer, integer, integer, date) to authenticated;

-- Les professeurs particuliers, pour la console de l'éditeur : la licence,
-- ce qui en est pris, l'IA du mois, la demande de places en cours.
create or replace function public.admin_profs()
returns table(id uuid, licence boolean, places integer, prises integer, inscrits integer, attente integer, fin date,
              ia_prof integer, ia_eleve integer, ia_mois integer, cents_mois numeric,
              demande_places integer, demande_mot text, demande_le timestamptz)
language sql stable security definer set search_path to '' as $$
  with profs as (
    select r.user_id as p from public.user_roles r
    where r.role = 'prof' and not exists (select 1 from public.org_members m where m.user_id = r.user_id)
  ), eleves as (
    select c.owner as p, x.user_id as u from (
      select m.class_id, m.user_id from public.class_members m
      union select q.class_id, q.user_id from public.class_requests q) x
    join public.classes c on c.id = x.class_id
    where c.org_id is null and c.archived_at is null
  )
  select pr.p, l.prof is not null, coalesce(l.places, 0), public.prof_places_prises(pr.p), public.prof_inscrits(pr.p),
         public.prof_places_prises(pr.p) - public.prof_inscrits(pr.p), l.fin,
         coalesce(l.ia_prof, 0), coalesce(l.ia_eleve, 0),
         (select count(*)::integer from public.ai_usage a where a.user_id = pr.p
            and a.day >= date_trunc('month', current_date)::date),
         coalesce((select sum(a.cents) from public.ai_usage a
                   where a.day >= date_trunc('month', current_date)::date
                     and (a.user_id = pr.p or a.user_id in (select e.u from eleves e where e.p = pr.p))), 0),
         d.places, d.message, d.cree_le
  from profs pr
  left join public.prof_licences l on l.prof = pr.p
  left join lateral (select x.places, x.message, x.cree_le from public.demandes_places x
                     where x.prof = pr.p and x.traitee_le is null order by x.cree_le desc limit 1) d on true
  where public.is_admin()
$$;
revoke all on function public.admin_profs() from public, anon;
grant execute on function public.admin_profs() to authenticated;

-- ---------- 5. l'IA : un quota fixé par l'éditeur ----------
alter table public.orgs add column if not exists ia_prof integer not null default 50 check (ia_prof between 0 and 5000);
alter table public.orgs add column if not exists ia_eleve integer not null default 0 check (ia_eleve between 0 and 1000);

-- Le coût moyen d'une génération, sur les 90 derniers jours (nul sans
-- historique : la console prend alors son estimation par défaut).
create or replace function public.admin_cout_ia()
returns jsonb language sql stable security definer set search_path to '' as $$
  select jsonb_build_object(
    'moyenne', (select round(avg(a.cents)::numeric, 4) from public.ai_usage a where a.day >= current_date - 90),
    'appels', (select count(*) from public.ai_usage a where a.day >= current_date - 90),
    'mois', (select coalesce(sum(a.cents), 0) from public.ai_usage a where a.day >= date_trunc('month', current_date)::date))
  where public.is_admin()
$$;
revoke all on function public.admin_cout_ia() from public, anon;
grant execute on function public.admin_cout_ia() to authenticated;

-- L'IA d'un établissement : par professeur et par élève, chaque mois.
create or replace function public.admin_ia(org uuid, ia_prof integer, ia_eleve integer)
returns void language plpgsql security definer set search_path to '' as $$
begin
  if not public.is_admin() then raise exception 'Réservé à l''éditeur' using errcode = '42501'; end if;
  if ia_prof is null or ia_prof not between 0 and 5000 then raise exception 'IA par professeur : entre 0 et 5000 par mois'; end if;
  if ia_eleve is null or ia_eleve not between 0 and 1000 then raise exception 'IA par élève : entre 0 et 1000 par mois'; end if;
  update public.orgs o set ia_prof = admin_ia.ia_prof, ia_eleve = admin_ia.ia_eleve where o.id = admin_ia.org;
  if not found then raise exception 'Établissement inconnu' using errcode = '22023'; end if;
end $$;
revoke all on function public.admin_ia(uuid, integer, integer) from public, anon;
grant execute on function public.admin_ia(uuid, integer, integer) to authenticated;

create or replace function public.admin_orgs_ia()
returns table(org_id uuid, ia_prof integer, ia_eleve integer)
language sql stable security definer set search_path to '' as $$
  select o.id, o.ia_prof, o.ia_eleve from public.orgs o where public.is_admin()
$$;
revoke all on function public.admin_orgs_ia() from public, anon;
grant execute on function public.admin_orgs_ia() to authenticated;

-- Interne (la fonction ai, rôle service) : les générations par mois d'un
-- compte Campus. Nul pour un autre compte (Folio+ : le quota de la fonction).
create or replace function public.ia_quota(u uuid)
returns integer language sql stable security definer set search_path to '' as $$
  select coalesce(
    (select case when coalesce(r.role, 'eleve') = 'eleve' then o.ia_eleve else o.ia_prof end
     from public.org_members m join public.orgs o on o.id = m.org_id
     left join public.user_roles r on r.user_id = m.user_id
     where m.user_id = u and (o.licence_fin is null or o.licence_fin >= current_date) limit 1),
    (select l.ia_prof from public.licence_prof(u) l where l.prof is not null),
    (select max(l.ia_eleve) from public.classes c
     join public.prof_licences l on l.prof = c.owner and (l.fin is null or l.fin >= current_date)
     where c.org_id is null and c.archived_at is null
       and (exists (select 1 from public.class_members m where m.class_id = c.id and m.user_id = u)
            or exists (select 1 from public.class_requests q where q.class_id = c.id and q.user_id = u))))
$$;
revoke all on function public.ia_quota(uuid) from public, anon, authenticated;
grant execute on function public.ia_quota(uuid) to service_role;

-- ---------- 6. Folio Campus chez un professeur particulier ----------
-- Le professeur dont la licence court, et ses élèves — inscrits ou en
-- attente : la demande tient une place, l'élève a Campus dès qu'il a entré
-- le code (son tuto ne lui propose pas Folio+). Refusé, il n'a plus rien.
create or replace function public.campus_prof(u uuid)
returns uuid language sql stable security definer set search_path to '' as $$
  select coalesce(
    (select l.prof from public.licence_prof(u) l where l.prof is not null),
    (select c.owner from public.classes c
     join public.prof_licences l on l.prof = c.owner and (l.fin is null or l.fin >= current_date)
     where c.org_id is null and c.archived_at is null
       and (exists (select 1 from public.class_members m where m.class_id = c.id and m.user_id = u)
            or exists (select 1 from public.class_requests q where q.class_id = c.id and q.user_id = u))
     order by c.created_at limit 1))
$$;
revoke all on function public.campus_prof(uuid) from public, anon, authenticated;

create or replace function public.offre_de(u uuid)
returns text language sql stable security definer set search_path to '' as $$
  select case
    when exists (select 1 from public.org_members m join public.orgs o on o.id = m.org_id
                 where m.user_id = u and (o.licence_fin is null or o.licence_fin >= current_date)) then 'campus'
    when public.campus_prof(u) is not null then 'campus'
    when exists (select 1 from public.abonnements a
                 where a.user_id = u and public.abonnement_ouvre(a.statut, a.fin_periode)) then 'plus'
    else 'gratuit' end
$$;
revoke all on function public.offre_de(uuid) from public, anon, authenticated;
grant execute on function public.offre_de(uuid) to service_role;

-- `professeur` : le nom du professeur particulier qui ouvre Campus (le sien
-- pour un élève, nul pour le professeur lui-même), `licence_fin` la fin de
-- sa licence.
create or replace function public.mon_offre()
returns jsonb language sql stable security definer set search_path to '' as $$
  with etab as (
    select o.name, o.licence_fin
    from public.org_members m
    join public.orgs o on o.id = m.org_id
    where m.user_id = auth.uid() and (o.licence_fin is null or o.licence_fin >= current_date)
    limit 1
  ), pp as (
    select public.campus_prof(auth.uid()) as p
  ), ab as (
    select a.* from public.abonnements a where a.user_id = auth.uid()
    order by public.abonnement_ouvre(a.statut, a.fin_periode) desc, a.fin_periode desc nulls first, a.maj_le desc
    limit 1
  )
  select jsonb_build_object(
    'offre', public.offre_de(auth.uid()),
    'etablissement', (select name from etab),
    'professeur', (select coalesce(nullif(pr.name, ''), pr.handle) from pp join public.profiles pr on pr.id = pp.p
                   where pp.p <> auth.uid() and not exists (select 1 from etab)),
    'licence_fin', coalesce((select licence_fin from etab),
                            (select l.fin from pp join public.prof_licences l on l.prof = pp.p)),
    'abonnement', (select jsonb_build_object('statut', ab.statut, 'formule', ab.formule, 'source', ab.source,
                     'fin_periode', ab.fin_periode, 'fin_prevue', ab.fin_prevue) from ab))
  where auth.uid() is not null
$$;
revoke all on function public.mon_offre() from public, anon;
grant execute on function public.mon_offre() to authenticated;

-- ---------- 7. entrer chez un professeur particulier : la salle d'attente ----------
create or replace function public.prof_verdict(p uuid)
returns text language plpgsql stable security definer set search_path to '' as $$
declare moi uuid := auth.uid(); l public.prof_licences%rowtype;
begin
  if p = moi then return 'soi'; end if;
  if public.my_role() <> 'eleve' then return 'role'; end if;
  if exists (select 1 from public.class_members m join public.classes c on c.id = m.class_id
             where m.user_id = moi and c.owner = p and c.org_id is null and c.archived_at is null) then
    return 'deja';
  end if;
  if exists (select 1 from public.class_requests r join public.classes c on c.id = r.class_id
             where r.user_id = moi and c.owner = p and c.org_id is null and c.archived_at is null) then
    return 'attente';
  end if;
  select * into l from public.licence_prof(p);
  if l.prof is null then return 'licence'; end if;
  if (select count(*) from public.class_requests r where r.user_id = moi) >= 3 then return 'demandes'; end if;
  if public.prof_places_prises(p) >= l.places then return 'plein'; end if;
  return 'ok';
end $$;
revoke all on function public.prof_verdict(uuid) from public, anon, authenticated;

create or replace function public.etab_verdict(o uuid, quel text)
returns text language plpgsql stable security definer set search_path to '' as $$
declare moi uuid := auth.uid(); mon_role text := public.my_role(); x public.orgs%rowtype;
begin
  select * into x from public.orgs where id = o;
  if x.licence_fin is not null and x.licence_fin < current_date then return 'licence'; end if;
  if exists (select 1 from public.org_members m where m.user_id = moi and m.org_id = o) then return 'deja'; end if;
  if exists (select 1 from public.org_members m where m.user_id = moi) then return 'autre'; end if;
  if quel = 'eleve' and mon_role <> 'eleve' then return 'role'; end if;
  if quel in ('prof', 'ref') and mon_role not in ('eleve', 'prof') then return 'role'; end if;
  -- élèves, professeurs et référents : une place chacun (2026-10-28)
  if public.etab_libres(o) = 0 then return 'plein'; end if;
  return 'ok';
end $$;
revoke all on function public.etab_verdict(uuid, text) from public, anon, authenticated;

create or replace function public.etab_places_prises(o uuid)
returns integer language sql stable security definer set search_path to '' as $$
  select count(*)::integer from public.org_members m
  left join public.user_roles r on r.user_id = m.user_id
  where m.org_id = o and coalesce(r.role, 'eleve') in ('eleve', 'prof', 'ref')
$$;
revoke all on function public.etab_places_prises(uuid) from public, anon, authenticated;

create or replace function public.rejoindre(code text, son_prenom text, son_nom text, classe uuid default null::uuid)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  moi uuid := auth.uid();
  k text := upper(regexp_replace(coalesce(code, ''), '[^A-Za-z0-9]', '', 'g'));
  e record; x public.orgs%rowtype; p uuid; s text; nom text; c public.classes%rowtype; n integer;
begin
  if moi is null then return jsonb_build_object('statut', 'connexion'); end if;
  if public.class_trop_essais() then return jsonb_build_object('statut', 'trop'); end if;
  select * into e from public.etab_du_code(k);
  if e.o_org is null then
    select cp.prof into p from public.codes_profs cp where length(k) = 8 and cp.code = k;
  end if;
  insert into public.class_join_attempts (user_id, ok) values (moi, e.o_org is not null or p is not null);
  if e.o_org is null and p is null then return jsonb_build_object('statut', 'inconnu'); end if;
  s := case when e.o_org is not null then public.etab_verdict(e.o_org, e.o_quel) else public.prof_verdict(p) end;
  if s <> 'ok' then return jsonb_build_object('statut', s); end if;
  if not (public.nom_valide(son_prenom) and public.nom_valide(son_nom)) then
    return jsonb_build_object('statut', 'nom');
  end if;
  nom := public.nom_propre(son_prenom, son_nom);

  if e.o_org is not null then
    select * into x from public.orgs where id = e.o_org;
    if e.o_quel = 'eleve' then
      if classe is not null then
        select * into c from public.classes cl
        where cl.id = classe and cl.org_id = x.id and cl.genre = 'classe' and cl.archived_at is null;
        if c.id is null then return jsonb_build_object('statut', 'classe'); end if;
      elsif exists (select 1 from public.classes cl where cl.org_id = x.id and cl.genre = 'classe'
                    and cl.archived_at is null) then
        return jsonb_build_object('statut', 'choisir');
      end if;
    end if;
    update public.profiles set name = nom where id = moi;
    insert into public.org_members (user_id, org_id) values (moi, x.id);
    insert into public.user_roles (user_id, role) values (moi, e.o_quel)
      on conflict (user_id) do update set role = excluded.role, set_at = now();
    if c.id is not null then
      insert into public.class_members (class_id, user_id, who) values (c.id, moi, nom) on conflict do nothing;
    end if;
    if e.o_quel = 'ref' then
      update public.org_codes set ref = null, ref_fin = null, maj = now() where org_id = x.id;
      perform public.poser_exemples(x.id, moi);
    end if;
    perform public.ref_trace(moi, case e.o_quel when 'eleve' then 'élève entré avec le code'
                                                when 'prof' then 'professeur entré avec le code'
                                                else 'référent entré avec son code' end,
      jsonb_build_object('nom', nom, 'classe', c.name));
    return jsonb_build_object('statut', 'ok', 'type', 'etab', 'quel', e.o_quel, 'nom', x.name, 'classe', c.name);
  end if;

  -- chez un professeur particulier : la classe choisie (ou la seule, ou
  -- « Mes élèves » créée au premier élève), puis la salle d'attente — qui
  -- réserve la place (prof_places_prises compte les demandes)
  if classe is not null then
    select * into c from public.classes cl
    where cl.id = classe and cl.owner = p and cl.org_id is null and cl.archived_at is null;
    if c.id is null then return jsonb_build_object('statut', 'classe'); end if;
  else
    select count(*) into n from public.classes cl where cl.owner = p and cl.org_id is null and cl.archived_at is null;
    if n > 1 then return jsonb_build_object('statut', 'choisir'); end if;
    select * into c from public.classes cl where cl.owner = p and cl.org_id is null and cl.archived_at is null limit 1;
    if c.id is null then
      insert into public.classes (name, level, year, code, owner, org_id)
      values ('Mes élèves', '',
              case when extract(month from current_date) >= 8
                   then extract(year from current_date)::text || '-' || (extract(year from current_date) + 1)::text
                   else (extract(year from current_date) - 1)::text || '-' || extract(year from current_date)::text end,
              public.code_classe(), p, null)
      returning * into c;
      insert into public.teachings (class_id, teacher, subject, principal) values (c.id, p, 'Cours', true);
    end if;
  end if;
  if exists (select 1 from public.class_bans b where b.class_id = c.id and b.user_id = moi) then
    return jsonb_build_object('statut', 'refuse');
  end if;
  insert into public.class_requests (class_id, user_id, who) values (c.id, moi, nom) on conflict do nothing;
  return jsonb_build_object('statut', 'attente', 'type', 'prof', 'classe', c.name,
    'nom', (select coalesce(nullif(pr.name, ''), pr.handle, 'Professeur') from public.profiles pr where pr.id = p));
end $$;
revoke all on function public.rejoindre(text, text, text, uuid) from public, anon;
grant execute on function public.rejoindre(text, text, text, uuid) to authenticated;

-- Accepter : la place était déjà réservée par la demande ; on vérifie
-- seulement que la licence court et que les inscrits n'y dépassent pas.
create or replace function public.prof_admettre(cid uuid, qui uuid[])
returns integer language plpgsql security definer set search_path to '' as $$
declare c public.classes%rowtype; l public.prof_licences%rowtype; libres integer; n integer;
begin
  if not public.class_staff(cid) then raise exception 'Cette classe n''est pas la tienne'; end if;
  select * into c from public.classes where id = cid for update;
  if c.archived_at is not null then raise exception 'Cette classe est archivée'; end if;
  if c.org_id is null then
    select * into l from public.licence_prof(c.owner);
    if l.prof is null then raise exception 'Ta licence Folio Campus est finie : renouvelle-la pour accepter des élèves'; end if;
    libres := l.places - public.prof_inscrits(c.owner);
    if libres <= 0 then raise exception 'Toutes tes places sont prises : commande des places en plus'; end if;
  else
    libres := c.places - (select count(*) from public.class_members m where m.class_id = cid);
    if libres <= 0 then
      raise exception 'La classe est complète (% places). Ajoute des places dans les réglages.', c.places;
    end if;
  end if;
  with pris as (
    select r.user_id, r.who from public.class_requests r
    where r.class_id = cid and r.user_id = any(qui)
      and not exists (select 1 from public.class_bans b where b.class_id = cid and b.user_id = r.user_id)
    order by r.created_at limit libres
  ), entres as (
    insert into public.class_members (class_id, user_id, who)
    select cid, pris.user_id, pris.who from pris
    on conflict do nothing
    returning user_id
  )
  delete from public.class_requests r using pris
  where r.class_id = cid and r.user_id = pris.user_id;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.prof_admettre(uuid, uuid[]) from public, anon;
grant execute on function public.prof_admettre(uuid, uuid[]) to authenticated;

-- Refuser : la demande part, sa place revient à la licence, l'élève
-- retombe en Folio gratuit. Un mot dans son courrier lui dit pourquoi et
-- quoi faire — sans lui, il ne verrait que sa classe disparaître.
create or replace function public.prof_refuser(cid uuid, qui uuid[], exclure boolean default false)
returns integer language plpgsql security definer set search_path to '' as $$
declare n integer; moi text;
begin
  if not public.class_staff(cid) then raise exception 'Cette classe n''est pas la tienne'; end if;
  if exclure then
    insert into public.class_bans (class_id, user_id, who, by_user)
    select cid, r.user_id, r.who, auth.uid() from public.class_requests r
    where r.class_id = cid and r.user_id = any(qui)
    on conflict do nothing;
  end if;
  select coalesce(nullif(name, ''), handle, 'Ton professeur') into moi from public.profiles where id = auth.uid();
  insert into public.mail (from_user, to_user, from_name, deck_name, message, cards)
  select auth.uid(), r.user_id, coalesce(moi, 'Ton professeur'), c.name,
         case when exclure then 'Ton professeur n''a pas accepté ta demande pour cette classe.'
              else 'Ton professeur n''a pas validé ton inscription. Vérifie ton prénom et ton nom, '
                   || 'puis entre de nouveau son code (Réglages → J''ai un code).' end,
         '[]'::jsonb
  from public.class_requests r join public.classes c on c.id = r.class_id
  where r.class_id = cid and r.user_id = any(qui);
  delete from public.class_requests r where r.class_id = cid and r.user_id = any(qui);
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.prof_refuser(uuid, uuid[], boolean) from public, anon;
grant execute on function public.prof_refuser(uuid, uuid[], boolean) to authenticated;
