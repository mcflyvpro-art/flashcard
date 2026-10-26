-- ══════════ la licence d'un établissement : places, factures, échanges (2026-10-26) ══════════
-- Le référent a désormais sous les yeux tout ce qui touche à sa licence :
-- les places prises et libres, le prix convenu, ses factures et ses avoirs,
-- ses coordonnées de facturation, ses échanges avec Folio. L'éditeur émet
-- les factures depuis sa console.
--
-- 1. UNE PLACE PAR ÉLÈVE ET PAR PROFESSEUR (décidé le 2026-10-26 : « même
--    licence peu importe »). Le référent ne prend pas de place. Le code
--    professeurs, l'ouverture d'un compte par le référent et les cartes
--    élève s'arrêtent tous au même plafond. `ref_retirer` sort quelqu'un de
--    l'établissement (d'une année à l'autre : un élève qui part, un
--    professeur muté) et libère sa place ; le compte reste, ses livres avec.
--
-- 2. LES FACTURES. Une facture émise ne se modifie ni ne s'efface jamais
--    (déclencheur `factures_inalterables`) : une erreur se corrige par un
--    avoir, qui la reprend en négatif. Numérotation continue, sans trou, par
--    série et par année (F-2026-0001, A-2026-0001 pour les avoirs) : le
--    compteur avance dans la même transaction que l'insertion. Chaque
--    facture garde la photographie du vendeur et du client au jour de son
--    émission (une adresse qui change ne réécrit pas le passé). Mentions
--    obligatoires (art. L441-9 du code de commerce, art. 242 nonies A de
--    l'annexe II du CGI) : identité et SIREN/SIRET des deux parties,
--    numéro, dates, désignation, quantités, prix unitaires HT, taux et
--    montant de TVA (ou la mention de franchise), échéance — les pénalités
--    de retard et l'indemnité de 40 € s'impriment avec (src/facture.js).
--    Seules les dates de dépôt sur Chorus Pro et de paiement bougent.
--    Un établissement facturé ne s'efface plus (conservation dix ans,
--    art. L123-22 du code de commerce).
--
-- 3. LES ÉCHANGES : un fil par établissement, entre le référent et Folio
--    (des places en plus, le renouvellement, une facture, une question).
--
-- Tables : RLS active, lecture par le référent de l'établissement et
-- l'éditeur ; aucune écriture directe — tout passe par les fonctions.

-- ---------- 1. les places ----------
create or replace function public.etab_places_prises(o uuid)
returns integer language sql stable security definer set search_path = '' as $$
  select count(*)::integer from public.org_members m
  left join public.user_roles r on r.user_id = m.user_id
  where m.org_id = o and coalesce(r.role, 'eleve') in ('eleve', 'prof')
$$;
revoke all on function public.etab_places_prises(uuid) from public, anon, authenticated;

-- null : sans plafond
create or replace function public.etab_libres(o uuid)
returns integer language sql stable security definer set search_path = '' as $$
  select case when x.places is null then null else greatest(0, x.places - public.etab_places_prises(o)) end
  from public.orgs x where x.id = o
$$;
revoke all on function public.etab_libres(uuid) from public, anon, authenticated;

create or replace function public.etab_verdict(o uuid, quel text)
returns text language plpgsql stable security definer set search_path to '' as $$
declare
  moi uuid := auth.uid();
  mon_role text := public.my_role();
  x public.orgs%rowtype;
begin
  select * into x from public.orgs where id = o;
  if x.licence_fin is not null and x.licence_fin < current_date then return 'licence'; end if;
  if exists (select 1 from public.org_members m where m.user_id = moi and m.org_id = o) then return 'deja'; end if;
  if exists (select 1 from public.org_members m where m.user_id = moi) then return 'autre'; end if;
  if exists (select 1 from public.comptes_geres g where g.user_id = moi) then return 'gere'; end if;
  if quel = 'eleve' and mon_role <> 'eleve' then return 'role'; end if;
  if quel in ('prof', 'ref') and mon_role not in ('eleve', 'prof') then return 'role'; end if;
  -- un professeur prend une place comme un élève ; le référent, non
  if quel in ('eleve', 'prof') and public.etab_libres(o) = 0 then return 'plein'; end if;
  return 'ok';
end $$;
revoke all on function public.etab_verdict(uuid, text) from public, anon, authenticated;

-- Le référent ouvre un compte (un professeur arrivé en cours d'année) : il prend une place.
create or replace function public.ref_new_account(adresse text, nom text, pseudo text default ''::text,
  qrole text default 'eleve'::text, cid uuid default null::uuid, pw text default ''::text)
returns uuid language plpgsql security definer set search_path to '' as $$
declare uid uuid; h text; ad text;
begin
  if not public.is_ref() then raise exception 'Réservé au référent de l''établissement'; end if;
  if qrole not in ('eleve', 'prof') then
    raise exception 'Un référent ouvre des comptes d''élève et de professeur.';
  end if;
  if public.etab_libres(public.my_org()) = 0 then
    raise exception 'Toutes les places de la licence sont prises : demande-en d''autres à Folio, ou retire un compte parti';
  end if;
  if length(coalesce(pw, '')) < 10 then raise exception 'Au moins dix caractères'; end if;
  ad := lower(trim(coalesce(adresse, '')));
  if ad !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Adresse e-mail invalide';
  end if;
  if exists (select 1 from auth.users u where u.email = ad) then
    raise exception 'Cette adresse a déjà un compte';
  end if;
  if cid is not null and not public.class_in_org(cid) then
    raise exception 'Cette classe n''est pas dans ton établissement';
  end if;
  h := regexp_replace(lower(trim(coalesce(nullif(pseudo, ''), split_part(ad, '@', 1)))),
                      '[^a-z0-9_.-]', '', 'g');
  if exists (select 1 from public.profiles p where p.handle = h) then
    h := h || '.' || substr(md5(random()::text), 1, 3);
  end if;
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
  insert into auth.identities (provider_id, user_id, identity_data, provider,
                               last_sign_in_at, created_at, updated_at)
  values (uid::text, uid,
          jsonb_build_object('sub', uid::text, 'email', ad, 'email_verified', true),
          'email', now(), now(), now());
  insert into public.profiles (id, email, name, handle)
  values (uid, ad, nullif(trim(nom), ''), h);
  insert into public.user_roles (user_id, role) values (uid, qrole)
    on conflict (user_id) do update set role = excluded.role, set_at = now();
  insert into public.org_members (user_id, org_id) values (uid, public.my_org())
    on conflict do nothing;
  if cid is not null and qrole = 'eleve' then
    insert into public.class_members (class_id, user_id, who)
    values (cid, uid, nullif(trim(nom), '')) on conflict do nothing;
  end if;
  perform public.ref_trace(uid, 'compte ouvert',
    jsonb_build_object('nom', nullif(trim(nom), ''), 'role', qrole));
  return uid;
end $$;
revoke all on function public.ref_new_account(text, text, text, text, uuid, text) from public, anon;
grant execute on function public.ref_new_account(text, text, text, text, uuid, text) to authenticated;

-- Les cartes élève s'arrêtent aussi au plafond de la licence.
create or replace function public.prof_creer_eleves(cid uuid, eleves jsonb, forcer boolean default false)
returns table(rang integer, statut text, user_id uuid, nom text, identifiant text, code text)
language plpgsql security definer set search_path to '' as $$
#variable_conflict use_column
declare
  c public.classes%rowtype; e jsonb; i integer := 0; p text; n text; nc text; k text;
  r record; libres integer; crees integer := 0;
begin
  if not public.class_manager(cid) then raise exception 'Réservé au gestionnaire de la classe'; end if;
  select * into c from public.classes x where x.id = cid for update;
  if c.archived_at is not null then raise exception 'Cette classe est archivée'; end if;
  if jsonb_typeof(eleves) <> 'array' or jsonb_array_length(eleves) = 0 then
    raise exception 'La liste est vide';
  end if;
  if jsonb_array_length(eleves) > 60 then raise exception 'Soixante élèves au plus à la fois'; end if;
  if (select count(*) from public.comptes_geres g
      where g.cree_par = auth.uid() and g.created_at > now() - interval '1 day')
     + jsonb_array_length(eleves) > 300 then
    raise exception 'Trois cents comptes par jour au plus';
  end if;
  libres := coalesce(c.places - (select count(*) from public.class_members m where m.class_id = cid), 1000000);
  if c.org_id is not null then libres := least(libres, coalesce(public.etab_libres(c.org_id), 1000000)); end if;
  for e in select x.value from jsonb_array_elements(eleves) x loop
    i := i + 1;
    p := regexp_replace(trim(coalesce(e->>'prenom', '')), '\s+', ' ', 'g');
    n := regexp_replace(trim(coalesce(e->>'nom', '')), '\s+', ' ', 'g');
    rang := i; user_id := null; identifiant := null; code := null;
    nom := trim(p || ' ' || n);
    if not public.nom_valide(p) or not public.nom_valide(n) then
      statut := 'invalide'; return next; continue;
    end if;
    nc := public.nom_propre(p, n); nom := nc; k := public.cle_nom(nc);
    if exists (select 1 from public.class_members m left join public.profiles pr on pr.id = m.user_id
               where m.class_id = cid and public.cle_nom(coalesce(nullif(m.who, ''), pr.name)) = k) then
      statut := 'deja'; return next; continue;
    end if;
    if not forcer and c.org_id is not null and exists (
         select 1 from public.org_members om
         join public.profiles pr on pr.id = om.user_id
         where om.org_id = c.org_id and public.cle_nom(pr.name) = k
           and coalesce((select ur.role from public.user_roles ur where ur.user_id = om.user_id), 'eleve') = 'eleve') then
      statut := 'homonyme'; return next; continue;
    end if;
    if libres <= 0 then statut := 'complet'; return next; continue; end if;
    select * into r from public.creer_compte_eleve(p, n, c.org_id);
    insert into public.class_members (class_id, user_id, who) values (cid, r.o_uid, nc);
    libres := libres - 1; crees := crees + 1;
    statut := 'cree'; user_id := r.o_uid; identifiant := r.o_identifiant; code := r.o_code;
    return next;
  end loop;
  if crees > 0 and c.org_id is not null then
    perform public.ref_trace(null, 'comptes élèves créés par un professeur',
      jsonb_build_object('classe', c.name, 'nombre', crees));
  end if;
end $$;
revoke all on function public.prof_creer_eleves(uuid, jsonb, boolean) from public, anon;
grant execute on function public.prof_creer_eleves(uuid, jsonb, boolean) to authenticated;

/* Sortir quelqu'un de l'établissement : sa place se libère. Il quitte ses
   classes et ses groupes d'ici, un professeur ses services ; les groupes
   qu'un professeur avait formés sont archivés (plus personne ne les tient).
   Le compte reste, ses livres avec : un élève parti au lycée garde ce qu'il
   a appris. Ni soi-même, ni un autre référent (ref_garde). */
create or replace function public.ref_retirer(cible uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare r text; o uuid := public.my_org(); nm text;
begin
  r := public.ref_garde(cible);
  if cible = auth.uid() then raise exception 'On ne se retire pas soi-même'; end if;
  select name into nm from public.profiles where id = cible;
  delete from public.class_members m using public.classes c
  where c.id = m.class_id and c.org_id = o and m.user_id = cible;
  delete from public.teachings t using public.classes c
  where c.id = t.class_id and c.org_id = o and t.teacher = cible;
  update public.classes set archived_at = now()
  where org_id = o and owner = cible and genre = 'groupe' and archived_at is null;
  delete from public.org_members where user_id = cible and org_id = o;
  perform public.ref_trace(cible, 'retiré de l''établissement', jsonb_build_object('nom', nm, 'role', r));
end $$;
revoke all on function public.ref_retirer(uuid) from public, anon;
grant execute on function public.ref_retirer(uuid) to authenticated;

-- ---------- 2. le vendeur : l'éditeur de Folio, une seule ligne ----------
create table if not exists public.vendeur (
  id boolean primary key default true check (id),
  raison_sociale text not null default '',
  forme text not null default '',
  adresse text not null default '',
  code_postal text not null default '',
  ville text not null default '',
  siret text not null default '',
  immatriculation text not null default '',
  tva_intracom text not null default '',
  regime_tva text not null default 'franchise' check (regime_tva in ('franchise', 'normal')),
  taux_tva numeric(4, 2) not null default 20 check (taux_tva between 0 and 30),
  iban text not null default '',
  bic text not null default '',
  email text not null default '',
  delai_jours integer not null default 30 check (delai_jours between 0 and 60),
  maj timestamptz not null default now(),
  constraint vendeur_siret check (siret = '' or siret ~ '^[0-9]{14}$')
);
alter table public.vendeur enable row level security;
drop policy if exists vendeur_editeur on public.vendeur;
create policy vendeur_editeur on public.vendeur for select to authenticated using ((select public.is_admin()));

-- ---------- 3. les coordonnées de facturation d'un établissement ----------
create table if not exists public.org_facturation (
  org_id uuid primary key references public.orgs(id) on delete cascade,
  nom text not null default '',
  adresse text not null default '',
  code_postal text not null default '',
  ville text not null default '',
  siret text not null default '',
  service text not null default '',
  engagement text not null default '',
  email text not null default '',
  maj timestamptz not null default now(),
  constraint org_facturation_siret check (siret = '' or siret ~ '^[0-9]{14}$')
);
alter table public.org_facturation enable row level security;
drop policy if exists org_facturation_lecture on public.org_facturation;
create policy org_facturation_lecture on public.org_facturation for select to authenticated
  using ((org_id = (select public.my_org()) and (select public.is_ref())) or (select public.is_admin()));

-- ---------- 4. les factures et les avoirs ----------
create table if not exists public.facture_compteurs (
  serie text not null check (serie in ('F', 'A')),
  annee integer not null,
  dernier integer not null default 0,
  primary key (serie, annee)
);
alter table public.facture_compteurs enable row level security;
drop policy if exists facture_compteurs_editeur on public.facture_compteurs;
create policy facture_compteurs_editeur on public.facture_compteurs for select to authenticated
  using ((select public.is_admin()));

create table if not exists public.factures (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete restrict,
  numero text not null unique,
  genre text not null check (genre in ('facture', 'avoir')),
  origine uuid references public.factures(id) on delete restrict,
  emise_le date not null default current_date,
  echeance date not null,
  periode_debut date,
  periode_fin date,
  objet text not null default '',
  lignes jsonb not null,
  total_ht bigint not null,
  tva bigint not null,
  total_ttc bigint not null,
  taux_tva numeric(4, 2) not null,
  mention_tva text not null default '',
  vendeur jsonb not null,
  client jsonb not null,
  engagement text not null default '',
  deposee_le date,
  payee_le date,
  created_at timestamptz not null default now(),
  constraint factures_avoir check ((genre = 'avoir') = (origine is not null)),
  constraint factures_totaux check (total_ttc = total_ht + tva)
);
create index if not exists factures_org on public.factures (org_id, emise_le desc);
create unique index if not exists factures_un_avoir on public.factures (origine) where genre = 'avoir';
alter table public.factures enable row level security;
drop policy if exists factures_lecture on public.factures;
create policy factures_lecture on public.factures for select to authenticated
  using ((org_id = (select public.my_org()) and (select public.is_ref())) or (select public.is_admin()));

create or replace function public.factures_inalterables()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then raise exception 'Une facture ne s''efface pas : on émet un avoir'; end if;
  if (to_jsonb(new) - 'payee_le' - 'deposee_le') is distinct from (to_jsonb(old) - 'payee_le' - 'deposee_le') then
    raise exception 'Une facture émise ne se modifie pas : on émet un avoir';
  end if;
  return new;
end $$;
revoke all on function public.factures_inalterables() from public, anon, authenticated;
drop trigger if exists factures_inalterables on public.factures;
create trigger factures_inalterables before update or delete on public.factures
  for each row execute function public.factures_inalterables();

/* Le numéro suivant d'une série, dans la transaction de la facture : si
   l'insertion échoue, le compteur recule avec elle — jamais de trou. */
create or replace function public.numero_suivant(s text)
returns text language plpgsql security definer set search_path = '' as $$
declare a integer := extract(year from current_date)::integer; n integer;
begin
  insert into public.facture_compteurs as k (serie, annee, dernier) values (s, a, 1)
  on conflict (serie, annee) do update set dernier = k.dernier + 1
  returning k.dernier into n;
  return s || '-' || a || '-' || lpad(n::text, 4, '0');
end $$;
revoke all on function public.numero_suivant(text) from public, anon, authenticated;

-- ---------- 5. les échanges ----------
create table if not exists public.org_echanges (
  id bigserial primary key,
  org_id uuid not null references public.orgs(id) on delete cascade,
  de text not null check (de in ('etab', 'folio')),
  auteur uuid references auth.users(id) on delete set null,
  sujet text not null default 'question' check (sujet in ('places', 'renouvellement', 'facture', 'question')),
  message text not null check (length(message) between 1 and 2000),
  created_at timestamptz not null default now(),
  lu_le timestamptz
);
create index if not exists org_echanges_org on public.org_echanges (org_id, created_at);
create index if not exists org_echanges_auteur on public.org_echanges (auteur);
alter table public.org_echanges enable row level security;
drop policy if exists org_echanges_lecture on public.org_echanges;
create policy org_echanges_lecture on public.org_echanges for select to authenticated
  using ((org_id = (select public.my_org()) and (select public.is_ref())) or (select public.is_admin()));

-- ---------- 6. les fonctions ----------
/* L'établissement dont on parle : le sien pour un référent, celui qu'il
   désigne pour l'éditeur. */
create or replace function public.licence_org(org uuid)
returns uuid language plpgsql stable security definer set search_path = '' as $$
begin
  if org is not null and public.is_admin() then return org; end if;
  if public.is_ref() and public.my_org() is not null and (org is null or org = public.my_org()) then
    return public.my_org();
  end if;
  raise exception 'Réservé au référent de l''établissement';
end $$;
revoke all on function public.licence_org(uuid) from public, anon, authenticated;

/* Tout le tableau de la licence, d'un coup. Le prix convenu (org_suivi) est
   le seul chiffre du suivi commercial que voit le référent : ni budget, ni
   notes. Les factures sans leurs lignes (`facture(id)` les rend). */
create or replace function public.licence_tableau(org uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare o uuid := public.licence_org(org); x public.orgs%rowtype; f public.org_facturation%rowtype;
        v public.vendeur%rowtype; prix integer;
begin
  select * into x from public.orgs where id = o;
  select * into f from public.org_facturation where org_id = o;
  select * into v from public.vendeur where id;
  select s.prix_euros into prix from public.org_suivi s where s.org_id = o;
  return jsonb_build_object(
    'org', x.name, 'offre', x.offre, 'places', x.places, 'licence_fin', x.licence_fin,
    'eleves', public.etab_eleves(o), 'prises', public.etab_places_prises(o),
    'profs', (select count(*) from public.org_members m join public.user_roles r on r.user_id = m.user_id
              where m.org_id = o and r.role = 'prof'),
    'prix', prix,
    'facturation', case when f.org_id is null then null else to_jsonb(f) - 'org_id' end,
    'factures', coalesce((select jsonb_agg(to_jsonb(k) - 'vendeur' - 'client' - 'lignes' order by k.emise_le desc, k.numero desc)
                          from public.factures k where k.org_id = o), '[]'::jsonb),
    'echanges', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'de', e.de, 'sujet', e.sujet, 'message', e.message,
                            'cree', e.created_at, 'lu', e.lu_le,
                            'auteur', case when e.de = 'folio' then 'Folio' else coalesce(p.name, '') end) order by e.created_at, e.id)
                          from public.org_echanges e left join public.profiles p on p.id = e.auteur where e.org_id = o), '[]'::jsonb),
    'vendeur', case when v.id is null then null else
      jsonb_build_object('raison_sociale', v.raison_sociale, 'forme', v.forme, 'adresse', v.adresse,
        'code_postal', v.code_postal, 'ville', v.ville, 'siret', v.siret, 'email', v.email, 'regime_tva', v.regime_tva) end);
end $$;
revoke all on function public.licence_tableau(uuid) from public, anon;
grant execute on function public.licence_tableau(uuid) to authenticated;

-- Une facture entière (lignes, vendeur, client), pour l'afficher et l'imprimer.
create or replace function public.facture(fid uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare k public.factures%rowtype;
begin
  select * into k from public.factures where id = fid;
  if not found then raise exception 'Facture inconnue'; end if;
  perform public.licence_org(k.org_id);
  return to_jsonb(k) || jsonb_build_object('origine_numero', (select o.numero from public.factures o where o.id = k.origine),
    'avoir_numero', (select a.numero from public.factures a where a.origine = k.id));
end $$;
revoke all on function public.facture(uuid) from public, anon;
grant execute on function public.facture(uuid) to authenticated;

-- Les coordonnées de facturation : le référent pour son établissement, l'éditeur pour n'importe lequel.
create or replace function public.facturation_enregistrer(fiche jsonb, org uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
declare o uuid := public.licence_org(org); s text; k text;
begin
  foreach k in array array['nom', 'adresse', 'code_postal', 'ville', 'siret', 'service', 'engagement', 'email'] loop
    if length(coalesce(fiche->>k, '')) > 200 then raise exception 'Deux cents caractères au plus'; end if;
  end loop;
  s := regexp_replace(coalesce(fiche->>'siret', ''), '\s', '', 'g');
  if s <> '' and s !~ '^[0-9]{14}$' then raise exception 'Un SIRET compte quatorze chiffres'; end if;
  if coalesce(fiche->>'email', '') <> '' and trim(fiche->>'email') !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Adresse e-mail invalide';
  end if;
  insert into public.org_facturation as f (org_id, nom, adresse, code_postal, ville, siret, service, engagement, email, maj)
  values (o, trim(coalesce(fiche->>'nom', '')), trim(coalesce(fiche->>'adresse', '')), trim(coalesce(fiche->>'code_postal', '')),
          trim(coalesce(fiche->>'ville', '')), s, trim(coalesce(fiche->>'service', '')), trim(coalesce(fiche->>'engagement', '')),
          lower(trim(coalesce(fiche->>'email', ''))), now())
  on conflict (org_id) do update set nom = excluded.nom, adresse = excluded.adresse, code_postal = excluded.code_postal,
    ville = excluded.ville, siret = excluded.siret, service = excluded.service, engagement = excluded.engagement,
    email = excluded.email, maj = now();
  insert into public.ref_audit (org_id, actor, cible, acte, detail)
  values (o, auth.uid(), null, 'coordonnées de facturation', '{}'::jsonb);
end $$;
revoke all on function public.facturation_enregistrer(jsonb, uuid) from public, anon;
grant execute on function public.facturation_enregistrer(jsonb, uuid) to authenticated;

-- L'identité du vendeur, pour l'éditeur seul.
create or replace function public.admin_vendeur()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Réservé à l''éditeur'; end if;
  return coalesce((select to_jsonb(v) - 'id' from public.vendeur v where v.id), '{}'::jsonb);
end $$;
revoke all on function public.admin_vendeur() from public, anon;
grant execute on function public.admin_vendeur() to authenticated;

create or replace function public.admin_vendeur_enregistrer(fiche jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare s text; k text; t numeric; d integer;
begin
  if not public.is_admin() then raise exception 'Réservé à l''éditeur'; end if;
  foreach k in array array['raison_sociale', 'forme', 'adresse', 'code_postal', 'ville', 'immatriculation', 'tva_intracom',
                           'iban', 'bic', 'email'] loop
    if length(coalesce(fiche->>k, '')) > 200 then raise exception 'Deux cents caractères au plus'; end if;
  end loop;
  s := regexp_replace(coalesce(fiche->>'siret', ''), '\s', '', 'g');
  if s <> '' and s !~ '^[0-9]{14}$' then raise exception 'Un SIRET compte quatorze chiffres'; end if;
  if coalesce(fiche->>'regime_tva', 'franchise') not in ('franchise', 'normal') then raise exception 'Régime de TVA inconnu'; end if;
  t := coalesce(nullif(fiche->>'taux_tva', '')::numeric, 20);
  d := coalesce(nullif(fiche->>'delai_jours', '')::integer, 30);
  if t not between 0 and 30 then raise exception 'Taux de TVA impossible'; end if;
  if d not between 0 and 60 then raise exception 'Soixante jours au plus (art. L441-10 du code de commerce)'; end if;
  insert into public.vendeur as v (id, raison_sociale, forme, adresse, code_postal, ville, siret, immatriculation, tva_intracom,
                                   regime_tva, taux_tva, iban, bic, email, delai_jours, maj)
  values (true, trim(coalesce(fiche->>'raison_sociale', '')), trim(coalesce(fiche->>'forme', '')), trim(coalesce(fiche->>'adresse', '')),
          trim(coalesce(fiche->>'code_postal', '')), trim(coalesce(fiche->>'ville', '')), s,
          trim(coalesce(fiche->>'immatriculation', '')), upper(regexp_replace(coalesce(fiche->>'tva_intracom', ''), '\s', '', 'g')),
          coalesce(fiche->>'regime_tva', 'franchise'), t, upper(regexp_replace(coalesce(fiche->>'iban', ''), '\s', '', 'g')),
          upper(trim(coalesce(fiche->>'bic', ''))), lower(trim(coalesce(fiche->>'email', ''))), d, now())
  on conflict (id) do update set raison_sociale = excluded.raison_sociale, forme = excluded.forme, adresse = excluded.adresse,
    code_postal = excluded.code_postal, ville = excluded.ville, siret = excluded.siret, immatriculation = excluded.immatriculation,
    tva_intracom = excluded.tva_intracom, regime_tva = excluded.regime_tva, taux_tva = excluded.taux_tva, iban = excluded.iban,
    bic = excluded.bic, email = excluded.email, delai_jours = excluded.delai_jours, maj = now();
end $$;
revoke all on function public.admin_vendeur_enregistrer(jsonb) from public, anon;
grant execute on function public.admin_vendeur_enregistrer(jsonb) to authenticated;

/* Émettre une facture. Les lignes : [{libelle, quantite, prix_ht}] (prix
   unitaire HT en centimes). Les totaux se calculent ici, jamais dans
   l'app ; la TVA selon le régime du vendeur. */
create or replace function public.admin_facturer(org uuid, lignes jsonb, debut date default null, fin date default null,
  objet text default '')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v public.vendeur%rowtype; f public.org_facturation%rowtype; x public.orgs%rowtype; l jsonb; lib text;
        q numeric; pu bigint; t bigint; ht bigint := 0; propres jsonb := '[]'::jsonb; taux numeric := 0; tva bigint := 0;
        mention text := ''; num text; fid uuid;
begin
  if not public.is_admin() then raise exception 'Réservé à l''éditeur'; end if;
  select * into x from public.orgs where id = org;
  if not found then raise exception 'Établissement inconnu'; end if;
  select * into v from public.vendeur where id;
  if not found or v.raison_sociale = '' or v.adresse = '' or v.siret = '' then
    raise exception 'Remplis d''abord ton entreprise : raison sociale, adresse, SIRET';
  end if;
  select * into f from public.org_facturation where org_id = org;
  if not found or f.nom = '' or f.adresse = '' or f.ville = '' then
    raise exception 'Il manque les coordonnées de facturation de l''établissement';
  end if;
  if jsonb_typeof(lignes) <> 'array' or jsonb_array_length(lignes) not between 1 and 20 then
    raise exception 'Une à vingt lignes';
  end if;
  if debut is not null and fin is not null and fin < debut then raise exception 'La période finit avant de commencer'; end if;
  for l in select e.value from jsonb_array_elements(lignes) e loop
    lib := trim(coalesce(l->>'libelle', ''));
    q := nullif(l->>'quantite', '')::numeric;
    pu := nullif(l->>'prix_ht', '')::bigint;
    if lib = '' or length(lib) > 200 or q is null or q <= 0 or q > 100000 or pu is null or pu < 0 or pu > 100000000 then
      raise exception 'Ligne illisible : un libellé, une quantité, un prix';
    end if;
    t := round(q * pu)::bigint;
    ht := ht + t;
    propres := propres || jsonb_build_array(jsonb_build_object('libelle', lib, 'quantite', q, 'prix_ht', pu, 'total_ht', t));
  end loop;
  if ht <= 0 then raise exception 'Une facture de zéro euro ne s''émet pas'; end if;
  if v.regime_tva = 'normal' then
    taux := v.taux_tva; tva := round(ht * taux / 100)::bigint;
  else
    mention := 'TVA non applicable, art. 293 B du CGI';
  end if;
  num := public.numero_suivant('F');
  insert into public.factures (org_id, numero, genre, emise_le, echeance, periode_debut, periode_fin, objet, lignes,
                               total_ht, tva, total_ttc, taux_tva, mention_tva, vendeur, client, engagement)
  values (org, num, 'facture', current_date, current_date + v.delai_jours, debut, fin, left(trim(coalesce(objet, '')), 200), propres,
          ht, tva, ht + tva, taux, mention, to_jsonb(v) - 'id' - 'maj',
          (to_jsonb(f) - 'org_id' - 'maj') || jsonb_build_object('uai', x.uai), f.engagement)
  returning id into fid;
  insert into public.ref_audit (org_id, actor, cible, acte, detail)
  values (org, auth.uid(), null, 'facture émise', jsonb_build_object('numero', num));
  return jsonb_build_object('id', fid, 'numero', num);
end $$;
revoke all on function public.admin_facturer(uuid, jsonb, date, date, text) from public, anon;
grant execute on function public.admin_facturer(uuid, jsonb, date, date, text) to authenticated;

/* Un avoir annule une facture en entier : mêmes lignes, en négatif, sous
   son propre numéro. Une facture n'a qu'un avoir. */
create or replace function public.admin_avoir(fid uuid, motif text default '')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare k public.factures%rowtype; v public.vendeur%rowtype; num text; aid uuid;
begin
  if not public.is_admin() then raise exception 'Réservé à l''éditeur'; end if;
  select * into k from public.factures where id = fid and genre = 'facture';
  if not found then raise exception 'Facture inconnue'; end if;
  if exists (select 1 from public.factures a where a.origine = fid) then raise exception 'Cette facture a déjà son avoir'; end if;
  select * into v from public.vendeur where id;
  num := public.numero_suivant('A');
  insert into public.factures (org_id, numero, genre, origine, emise_le, echeance, periode_debut, periode_fin, objet, lignes,
                               total_ht, tva, total_ttc, taux_tva, mention_tva, vendeur, client, engagement)
  values (k.org_id, num, 'avoir', fid, current_date, current_date, k.periode_debut, k.periode_fin,
          left('Avoir sur la facture ' || k.numero || coalesce(' — ' || nullif(trim(motif), ''), ''), 200),
          (select jsonb_agg(e || jsonb_build_object('quantite', -(e->>'quantite')::numeric, 'total_ht', -(e->>'total_ht')::bigint))
           from jsonb_array_elements(k.lignes) e),
          -k.total_ht, -k.tva, -k.total_ttc, k.taux_tva, k.mention_tva,
          coalesce(to_jsonb(v) - 'id' - 'maj', k.vendeur), k.client, k.engagement)
  returning id into aid;
  insert into public.ref_audit (org_id, actor, cible, acte, detail)
  values (k.org_id, auth.uid(), null, 'avoir émis', jsonb_build_object('numero', num, 'facture', k.numero));
  return jsonb_build_object('id', aid, 'numero', num);
end $$;
revoke all on function public.admin_avoir(uuid, text) from public, anon;
grant execute on function public.admin_avoir(uuid, text) to authenticated;

-- Les deux seules dates qui bougent : déposée sur Chorus Pro, payée (null pour revenir en arrière).
create or replace function public.admin_facture_dates(fid uuid, deposee date, payee date)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Réservé à l''éditeur'; end if;
  update public.factures set deposee_le = deposee, payee_le = payee where id = fid;
  if not found then raise exception 'Facture inconnue'; end if;
end $$;
revoke all on function public.admin_facture_dates(uuid, date, date) from public, anon;
grant execute on function public.admin_facture_dates(uuid, date, date) to authenticated;

-- Écrire à Folio (le référent), répondre (l'éditeur).
create or replace function public.ref_ecrire(sujet text, message text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare o uuid := public.my_org(); m text := trim(coalesce(message, '')); n bigint;
begin
  if not public.is_ref() or o is null then raise exception 'Réservé au référent de l''établissement'; end if;
  if sujet not in ('places', 'renouvellement', 'facture', 'question') then raise exception 'Sujet inconnu'; end if;
  if m = '' then raise exception 'Le message est vide'; end if;
  if length(m) > 2000 then raise exception 'Deux mille caractères au plus'; end if;
  if (select count(*) from public.org_echanges e where e.org_id = o and e.de = 'etab'
      and e.created_at > now() - interval '1 day') >= 20 then
    raise exception 'Vingt messages par jour au plus';
  end if;
  insert into public.org_echanges (org_id, de, auteur, sujet, message) values (o, 'etab', auth.uid(), sujet, m)
  returning id into n;
  return n;
end $$;
revoke all on function public.ref_ecrire(text, text) from public, anon;
grant execute on function public.ref_ecrire(text, text) to authenticated;

create or replace function public.admin_repondre(org uuid, message text, sujet text default 'question')
returns bigint language plpgsql security definer set search_path = '' as $$
declare m text := trim(coalesce(message, '')); n bigint;
begin
  if not public.is_admin() then raise exception 'Réservé à l''éditeur'; end if;
  if sujet not in ('places', 'renouvellement', 'facture', 'question') then raise exception 'Sujet inconnu'; end if;
  if m = '' or length(m) > 2000 then raise exception 'Un message de un à deux mille caractères'; end if;
  if not exists (select 1 from public.orgs where id = org) then raise exception 'Établissement inconnu'; end if;
  insert into public.org_echanges (org_id, de, auteur, sujet, message) values (org, 'folio', auth.uid(), sujet, m)
  returning id into n;
  -- répondre, c'est avoir lu
  update public.org_echanges set lu_le = now() where org_id = org and de = 'etab' and lu_le is null;
  return n;
end $$;
revoke all on function public.admin_repondre(uuid, text, text) from public, anon;
grant execute on function public.admin_repondre(uuid, text, text) to authenticated;

-- Ce qu'on a lu : le référent lit Folio, l'éditeur lit l'établissement.
create or replace function public.echanges_lus(org uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
declare o uuid := public.licence_org(org);
begin
  update public.org_echanges set lu_le = now()
  where org_id = o and lu_le is null and de = case when org is not null and public.is_admin() then 'etab' else 'folio' end;
end $$;
revoke all on function public.echanges_lus(uuid) from public, anon;
grant execute on function public.echanges_lus(uuid) to authenticated;

-- Pour la liste de l'éditeur : les établissements qui attendent une réponse.
create or replace function public.admin_echanges_attente()
returns table (org_id uuid, n integer) language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Réservé à l''éditeur'; end if;
  return query select e.org_id, count(*)::integer from public.org_echanges e
               where e.de = 'etab' and e.lu_le is null group by e.org_id;
end $$;
revoke all on function public.admin_echanges_attente() from public, anon;
grant execute on function public.admin_echanges_attente() to authenticated;

-- Un établissement facturé se garde : dix ans de conservation des pièces.
create or replace function public.admin_supprimer_etab(org uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Réservé à l''éditeur'; end if;
  if exists (select 1 from public.org_members m where m.org_id = org) then
    raise exception 'Des comptes y sont encore : passe-le plutôt en « perdu » ou en pause';
  end if;
  if exists (select 1 from public.factures k where k.org_id = org) then
    raise exception 'Il a été facturé : ses factures se gardent dix ans, passe-le en « perdu »';
  end if;
  delete from public.orgs where id = org;
  if not found then raise exception 'Établissement inconnu'; end if;
end $$;
revoke all on function public.admin_supprimer_etab(uuid) from public, anon;
grant execute on function public.admin_supprimer_etab(uuid) to authenticated;
