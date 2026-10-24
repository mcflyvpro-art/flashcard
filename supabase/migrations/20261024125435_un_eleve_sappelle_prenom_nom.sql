-- ══════════ un élève s'appelle Prénom NOM ══════════
-- Dans une classe, un élève n'a qu'un nom : le sien, « Prénom NOM ». Il ne
-- le choisit pas et ne le change pas — un pseudo inventé ne dit pas au
-- professeur qui est devant lui, et un nom qui change d'une semaine à
-- l'autre rend le suivi illisible.
--
-- Trois façons d'entrer, une seule identité :
--
--   1. LA CARTE (le cas courant au collège et au lycée) : le professeur colle
--      la liste de sa classe, la base ouvre un compte par élève — nom
--      imposé, identifiant « prenom.nom », code secret de 8 caractères — et
--      le professeur imprime une carte par élève (identifiant, code, QR).
--      L'élève se connecte en tapant les deux, ou en visant le QR.
--   2. L'ÉTABLISSEMENT : le référent ouvre les comptes (inchangé).
--   3. UN COMPTE PERSONNEL qui demande à rejoindre : il doit écrire son vrai
--      prénom et son vrai nom ; c'est ce nom-là, mis en forme par la base,
--      que voit le professeur dans la salle d'attente et dans la classe.
--
-- Dans les trois cas, l'élève ne peut plus modifier ce nom : le
-- déclencheur `lock_identite_scolaire` le renverse. Seuls le gestionnaire
-- de sa classe (faute de frappe dans la liste) et le référent le corrigent.
--
-- L'identifiant devient l'adresse « prenom.nom@eleves.folio.invalid » du
-- compte : `.invalid` est réservé (RFC 2606), aucun courriel ne peut y
-- partir, et l'authentification Supabase connecte ces comptes comme les
-- autres (vérifié le 2026-10-24 sur un compte jetable, supprimé ensuite).
-- Le code n'est stocké que haché (bcrypt) : il n'est montré qu'une fois, à
-- la création ou au remplacement de la carte.

create extension if not exists unaccent with schema extensions;

-- ── 1. Les outils ───────────────────────────────────────────────────────
-- « jean-pierre » → « Jean-Pierre », « de la fontaine » → « DE LA FONTAINE ».
create or replace function public.nom_propre(prenom text, nom text)
returns text language sql immutable set search_path = '' as $$
  select initcap(lower(regexp_replace(trim(coalesce(prenom, '')), '\s+', ' ', 'g')))
         || ' ' || upper(regexp_replace(trim(coalesce(nom, '')), '\s+', ' ', 'g'))
$$;

create or replace function public.nom_valide(t text)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(trim(t), '') ~ '^[[:alpha:]][[:alpha:] ''’.-]{0,39}$'
$$;

create or replace function public.cle_nom(t text)
returns text language sql stable set search_path = '' as $$
  select lower(extensions.unaccent(regexp_replace(trim(coalesce(t, '')), '\s+', ' ', 'g')))
$$;

create or replace function public.slug_eleve(t text)
returns text language sql stable set search_path = '' as $$
  select left(regexp_replace(lower(extensions.unaccent(coalesce(t, ''))), '[^a-z0-9]', '', 'g'), 20)
$$;

-- Le code secret : même tirage par rejet que le code de classe.
create or replace function public.code_secret()
returns text language plpgsql volatile security definer set search_path = '' as $$
declare a constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; b bytea; s text := ''; i integer; o integer;
begin
  while length(s) < 8 loop
    b := extensions.gen_random_bytes(16);
    for i in 0..15 loop
      o := get_byte(b, i);
      if o < 248 and length(s) < 8 then s := s || substr(a, 1 + o % 31, 1); end if;
    end loop;
  end loop;
  return s;
end $$;

-- ── 2. Les comptes à carte ──────────────────────────────────────────────
create table if not exists public.comptes_geres (
  user_id uuid primary key references auth.users(id) on delete cascade,
  identifiant text not null unique,
  cree_par uuid references auth.users(id) on delete set null,
  org_id uuid references public.orgs(id) on delete cascade,
  carte_le timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists comptes_geres_cree_par on public.comptes_geres (cree_par);
create index if not exists comptes_geres_org on public.comptes_geres (org_id);
alter table public.comptes_geres enable row level security;
drop policy if exists cg_self on public.comptes_geres;
create policy cg_self on public.comptes_geres for select to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.identifiant_libre(prenom text, nom text)
returns text language plpgsql volatile security definer set search_path = '' as $$
declare base text; k text; i integer := 1;
begin
  base := coalesce(nullif(public.slug_eleve(prenom), ''), 'eleve') || '.'
       || coalesce(nullif(public.slug_eleve(nom), ''), 'x');
  k := base;
  while exists (select 1 from public.comptes_geres g where g.identifiant = k)
     or exists (select 1 from public.profiles p where p.handle = k)
     or exists (select 1 from auth.users u where u.email = k || '@eleves.folio.invalid') loop
    i := i + 1; k := base || i::text;
  end loop;
  return k;
end $$;

create or replace function public.creer_compte_eleve(prenom text, nom text, org uuid,
  out o_uid uuid, out o_identifiant text, out o_code text)
language plpgsql volatile security definer set search_path = '' as $$
declare ad text; nc text := public.nom_propre(prenom, nom);
begin
  o_uid := gen_random_uuid();
  o_identifiant := public.identifiant_libre(prenom, nom);
  o_code := public.code_secret();
  ad := o_identifiant || '@eleves.folio.invalid';
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous, confirmation_token, recovery_token,
    email_change_token_new, email_change_token_current, email_change, phone_change, phone_change_token,
    reauthentication_token)
  values ('00000000-0000-0000-0000-000000000000', o_uid, 'authenticated', 'authenticated', ad,
    extensions.crypt(o_code, extensions.gen_salt('bf', 8)), now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false, false, '', '', '', '', '', '', '', '');
  insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (o_uid::text, o_uid, jsonb_build_object('sub', o_uid::text, 'email', ad, 'email_verified', true),
          'email', null, now(), now());
  insert into public.profiles (id, email, name, handle) values (o_uid, ad, nc, o_identifiant)
  on conflict (id) do update set name = excluded.name, handle = excluded.handle, email = excluded.email;
  insert into public.user_roles (user_id, role) values (o_uid, 'eleve')
  on conflict (user_id) do update set role = 'eleve', set_at = now();
  if org is not null then
    insert into public.org_members (user_id, org_id) values (o_uid, org) on conflict do nothing;
  end if;
  insert into public.comptes_geres (user_id, identifiant, cree_par, org_id)
  values (o_uid, o_identifiant, auth.uid(), org);
end $$;

-- ── 3. Le nom ne se change plus ─────────────────────────────────────────
-- Même principe que 20260913113350 : on regarde qui appelle, à chaque
-- ligne, plutôt qu'un drapeau qu'on oublierait de refermer. Passent : le
-- référent de l'établissement de l'élève, et pour un compte à carte, celui
-- qui l'a créé ou le gestionnaire d'une classe où il est inscrit.
create or replace function public.lock_identite_scolaire()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if public.is_ref()
     and exists (select 1 from public.org_members m
                 where m.user_id = new.id and m.org_id = public.my_org()) then
    return new;
  end if;
  if exists (select 1 from public.comptes_geres g
             where g.user_id = new.id
               and (g.cree_par = auth.uid()
                    or exists (select 1 from public.class_members cm
                               where cm.user_id = new.id and public.class_manager(cm.class_id)))) then
    return new;
  end if;
  if (exists (select 1 from public.org_members m where m.user_id = new.id)
      and coalesce((select r.role from public.user_roles r where r.user_id = new.id), 'eleve') = 'eleve')
     or exists (select 1 from public.comptes_geres g where g.user_id = new.id) then
    new.handle := old.handle;
    new.name   := old.name;
    new.email  := old.email;
  end if;
  return new;
end $$;

-- ── 4. Créer les comptes d'une classe ───────────────────────────────────
-- Une ligne par élève, et un statut par ligne : `cree` (avec son code, à
-- imprimer tout de suite), `deja` (ce nom est déjà dans la classe),
-- `homonyme` (ce nom existe déjà dans l'établissement : sans doute le même
-- élève, qui a déjà sa carte — il rejoint avec le code de la classe ; on ne
-- crée un second compte que si le professeur confirme `forcer`),
-- `complet`, `invalide`.
create or replace function public.prof_creer_eleves(cid uuid, eleves jsonb, forcer boolean default false)
returns table (rang integer, statut text, user_id uuid, nom text, identifiant text, code text)
language plpgsql security definer set search_path = '' as $$
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
  libres := c.places - (select count(*) from public.class_members m where m.class_id = cid);
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

-- Une carte perdue se remplace : nouveau code, l'ancien ne marche plus, et
-- les appareils déjà connectés avec sont déconnectés.
create or replace function public.prof_nouvelles_cartes(cid uuid, qui uuid[])
returns table (user_id uuid, nom text, identifiant text, code text)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare r record; k text; n integer := 0;
begin
  if not public.class_manager(cid) then raise exception 'Réservé au gestionnaire de la classe'; end if;
  for r in select g.user_id as u, g.identifiant as ident, coalesce(nullif(m.who, ''), p.name) as nm
           from public.comptes_geres g
           join public.class_members m on m.user_id = g.user_id and m.class_id = cid
           join public.profiles p on p.id = g.user_id
           where g.user_id = any(qui)
           order by 3 loop
    k := public.code_secret();
    update auth.users set encrypted_password = extensions.crypt(k, extensions.gen_salt('bf', 8)),
                          updated_at = now()
    where id = r.u;
    delete from auth.sessions s where s.user_id = r.u;
    update public.comptes_geres g set carte_le = now() where g.user_id = r.u;
    user_id := r.u; nom := r.nm; identifiant := r.ident; code := k; n := n + 1;
    return next;
  end loop;
  if n > 0 and public.my_org() is not null then
    perform public.ref_trace(null, 'cartes de connexion remplacées', jsonb_build_object('nombre', n));
  end if;
end $$;

-- Corriger un nom mal tapé dans la liste. Pour un compte à carte, le nom
-- change partout ; pour un compte personnel, dans cette classe seulement ;
-- dans un établissement, le nom officiel ne se corrige que par le référent.
drop function if exists public.prof_renommer_eleve(uuid, uuid, text);
create or replace function public.prof_nommer_eleve(cid uuid, qui uuid, prenom text, nom text)
returns text language plpgsql security definer set search_path = '' as $$
declare nc text;
begin
  if not public.class_manager(cid) then raise exception 'Réservé au gestionnaire de la classe'; end if;
  if not public.nom_valide(prenom) or not public.nom_valide(nom) then
    raise exception 'Un prénom et un nom, en lettres';
  end if;
  if not exists (select 1 from public.class_members m where m.class_id = cid and m.user_id = qui) then
    raise exception 'Cet élève n''est pas dans la classe';
  end if;
  nc := public.nom_propre(prenom, nom);
  if exists (select 1 from public.comptes_geres g where g.user_id = qui) then
    update public.profiles set name = nc, updated_at = now() where id = qui;
    update public.class_members m set who = nc where m.user_id = qui;
  elsif exists (select 1 from public.classes c where c.id = cid and c.org_id is not null) then
    raise exception 'Le nom vient de l''établissement : demande au référent de le corriger';
  else
    update public.class_members m set who = nc where m.class_id = cid and m.user_id = qui;
  end if;
  return nc;
end $$;

-- Supprimer un compte à carte : seulement s'il n'est dans aucune autre
-- classe (sinon on le retire, on ne l'efface pas). Tout part avec lui.
create or replace function public.prof_supprimer_eleve(cid uuid, qui uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare nc text;
begin
  if not public.class_manager(cid) then raise exception 'Réservé au gestionnaire de la classe'; end if;
  select m.who into nc from public.class_members m where m.class_id = cid and m.user_id = qui;
  if not found then raise exception 'Cet élève n''est pas dans la classe'; end if;
  if not exists (select 1 from public.comptes_geres g where g.user_id = qui) then
    raise exception 'Ce compte n''a pas été créé avec une carte : retire l''élève de la classe';
  end if;
  if exists (select 1 from public.class_members m where m.user_id = qui and m.class_id <> cid) then
    raise exception 'Cet élève est aussi dans une autre classe : retire-le seulement';
  end if;
  delete from auth.users where id = qui;
  if public.my_org() is not null then
    perform public.ref_trace(null, 'compte élève supprimé par un professeur', jsonb_build_object('nom', nc));
  end if;
end $$;

-- Ce que l'app doit savoir du compte connecté.
create or replace function public.mon_compte()
returns table (gere boolean, nom text, identifiant text)
language sql stable security definer set search_path = '' as $$
  select g.user_id is not null, coalesce(p.name, ''), coalesce(g.identifiant, '')
  from public.profiles p left join public.comptes_geres g on g.user_id = p.id
  where p.id = auth.uid()
$$;

-- ── 5. Rejoindre avec son vrai nom ──────────────────────────────────────
-- Un compte à carte ou d'établissement a déjà son nom : on le prend. Un
-- compte personnel doit écrire son prénom et son nom ; sans eux, la base
-- répond `nom` et n'inscrit rien.
drop function if exists public.class_join(text);
create function public.class_join(join_code text, son_prenom text default '', son_nom text default '')
returns table (statut text, class_id uuid, nom text, niveau text, prof text, etab text,
               validation boolean, collegue boolean)
language plpgsql volatile security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v record; c public.classes%rowtype; s text; qui text;
  moi uuid := auth.uid();
begin
  select * into v from public.class_verdict(join_code);
  s := v.o_statut;
  if s = 'ok' and not v.o_collegue then
    if exists (select 1 from public.comptes_geres g where g.user_id = moi)
       or exists (select 1 from public.org_members m where m.user_id = moi) then
      qui := left(coalesce((select coalesce(nullif(p.name, ''), p.handle) from public.profiles p
                            where p.id = moi), 'Élève'), 80);
    elsif public.nom_valide(son_prenom) and public.nom_valide(son_nom) then
      qui := public.nom_propre(son_prenom, son_nom);
    else
      s := 'nom';
    end if;
  end if;
  if s = 'ok' then
    select * into c from public.classes x where x.id = v.o_cid for update;
    if v.o_collegue then
      insert into public.teachings (class_id, teacher, subject, principal)
      values (c.id, moi, coalesce(nullif((select m.subject from public.org_members m where m.user_id = moi), ''),
                                  'Cours'), false)
      on conflict do nothing;
      s := 'collegue';
    elsif (select count(*) from public.class_members m where m.class_id = c.id) >= c.places then
      s := 'complet';
    elsif c.join_approval then
      if (select count(*) from public.class_requests r where r.class_id = c.id) >= 60 then
        s := 'complet';
      elsif (select count(*) from public.class_requests r where r.user_id = moi) >= 10 then
        s := 'demandes';
      else
        insert into public.class_requests (class_id, user_id, who) values (c.id, moi, qui)
        on conflict do nothing;
        s := 'attente';
      end if;
    else
      insert into public.class_members (class_id, user_id, who) values (c.id, moi, qui)
      on conflict do nothing;
      s := 'inscrit';
    end if;
  end if;
  return query select * from public.class_fiche(
    case when s in ('inconnu', 'etablissement', 'trop', 'connexion') then null else v.o_cid end,
    s, v.o_collegue);
end $$;

create or replace function public.join_class(join_code text, who text default '')
returns table (id uuid, name text)
language sql volatile security definer set search_path = '' as $$
  select j.class_id, j.nom from public.class_join(join_code) j where j.statut in ('inscrit', 'deja')
$$;

-- ── 6. La liste du professeur sait qui a une carte ──────────────────────
drop function if exists public.prof_roster(uuid);
create function public.prof_roster(cid uuid)
returns table (user_id uuid, who text, handle text,
               rendus integer, donnes integer, pct integer, vu timestamptz,
               jamais boolean, pages7 integer, jours7 integer, retard integer, inscrit timestamptz,
               carte boolean, identifiant text)
language sql stable security definer set search_path = '' as $$
  select cm.user_id,
         coalesce(nullif(cm.who, ''), nullif(p.name, ''), p.handle, 'Élève'),
         p.handle,
         (select count(*)::integer from public.assignment_progress ap
          join public.assignments a on a.id = ap.assignment_id
          where a.class_id = cid and a.created_by = auth.uid()
            and ap.user_id = cm.user_id and ap.done_at is not null),
         (select count(*)::integer from public.assignments a
          where a.class_id = cid and a.created_by = auth.uid()
            and (a.due is null or a.due >= cm.joined_at::date)),
         (select coalesce(round(avg(ap.pct)), 0)::integer from public.assignment_progress ap
          join public.assignments a on a.id = ap.assignment_id
          where a.class_id = cid and a.created_by = auth.uid()
            and ap.user_id = cm.user_id and ap.vus > 0),
         (select max(ap.done_at) from public.assignment_progress ap
          join public.assignments a on a.id = ap.assignment_id
          where a.class_id = cid and ap.user_id = cm.user_id),
         (select u.last_sign_in_at is null from auth.users u where u.id = cm.user_id),
         (select count(*)::integer from public.reviews r
          where r.user_id = cm.user_id and r.created_at > now() - interval '7 days'
            and r.card_id like 'a:%'
            and split_part(r.card_id, ':', 2) in (select a.id::text from public.assignments a where a.class_id = cid)),
         (select count(distinct r.created_at::date)::integer from public.reviews r
          where r.user_id = cm.user_id and r.created_at > now() - interval '7 days'
            and r.card_id like 'a:%'
            and split_part(r.card_id, ':', 2) in (select a.id::text from public.assignments a where a.class_id = cid)),
         (select count(*)::integer from public.assignments a
          where a.class_id = cid and a.created_by = auth.uid()
            and a.due < current_date and a.due >= cm.joined_at::date
            and not exists (select 1 from public.assignment_progress ap
                            where ap.assignment_id = a.id and ap.user_id = cm.user_id
                              and ap.done_at is not null)),
         cm.joined_at,
         g.user_id is not null, coalesce(g.identifiant, '')
  from public.class_members cm
  join public.profiles p on p.id = cm.user_id
  left join public.comptes_geres g on g.user_id = cm.user_id
  where cm.class_id = cid and public.class_staff(cid)
  order by 2
$$;

-- ── 7. Les droits ───────────────────────────────────────────────────────
revoke all on function public.code_secret() from public, anon, authenticated;
revoke all on function public.identifiant_libre(text, text) from public, anon, authenticated;
revoke all on function public.creer_compte_eleve(text, text, uuid) from public, anon, authenticated;

do $$
declare f text;
begin
  foreach f in array array[
    'public.prof_creer_eleves(uuid, jsonb, boolean)', 'public.prof_nouvelles_cartes(uuid, uuid[])',
    'public.prof_nommer_eleve(uuid, uuid, text, text)', 'public.prof_supprimer_eleve(uuid, uuid)',
    'public.mon_compte()', 'public.class_join(text, text, text)', 'public.join_class(text, text)',
    'public.prof_roster(uuid)', 'public.nom_propre(text, text)', 'public.nom_valide(text)',
    'public.cle_nom(text)', 'public.slug_eleve(text)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
