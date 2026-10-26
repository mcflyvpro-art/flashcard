-- ══════════ un établissement : sa licence, ses codes, ses demandes ══════════
-- (2026-10-25 — docs/PARCOURS.md, § 4.)
--
-- Jusqu'ici, un établissement n'existait que s'il avait été créé à la main
-- en SQL, et l'on n'y entrait que par un compte ouvert par le référent ou
-- par une carte imprimée par un professeur. Il manquait le parcours de
-- vente : Folio crée l'établissement et sa licence, donne un code au
-- référent ; le référent distribue un code aux professeurs et un code aux
-- élèves ; chacun le tape avec son prénom et son nom, et le référent admet
-- (en plaçant l'élève dans sa classe) ou refuse.
--
-- Qui peut quoi :
--   · l'éditeur (admin)   : créer un établissement, régler sa licence,
--                           refaire un code référent ;
--   · le référent         : lire ses codes et sa licence, changer un code,
--                           lire, admettre ou refuser les demandes ;
--   · un compte personnel : taper un code, envoyer une demande, l'annuler ;
--     le code référent fait entrer tout de suite (Folio l'a donné à une
--     personne désignée, une seule fois, pour 30 jours).
--
-- Les codes ne vivent pas dans `orgs` : tout membre d'un établissement lit
-- sa ligne (`orgs_read`), un élève y aurait lu le code des professeurs.
-- Ils ont leur table, sans aucune politique : seules les fonctions
-- ci-dessous les lisent. Les essais comptent dans `class_join_attempts`,
-- avec ceux des codes de classe : 10 codes faux par heure, tous confondus.

-- ── 1. La licence ───────────────────────────────────────────────────────
alter table public.orgs
  add column if not exists offre text not null default 'essai',
  add column if not exists places integer,
  add column if not exists licence_fin date;
alter table public.orgs drop constraint if exists orgs_offre_check;
alter table public.orgs add constraint orgs_offre_check check (offre in ('essai', 'etablissement'));
alter table public.orgs drop constraint if exists orgs_places_check;
alter table public.orgs add constraint orgs_places_check check (places is null or places between 0 and 100000);

-- ── 2. Les codes ────────────────────────────────────────────────────────
create table if not exists public.org_codes (
  org_id  uuid primary key references public.orgs(id) on delete cascade,
  eleve   text unique,
  prof    text unique,
  ref     text unique,
  ref_fin timestamptz,
  maj     timestamptz not null default now()
);
alter table public.org_codes enable row level security;
-- Aucune politique, exprès : ni lecture ni écriture directe, pour personne.

-- ── 3. Les demandes ─────────────────────────────────────────────────────
-- Une seule demande en cours par compte (clé primaire) : on attend une
-- réponse avant d'en envoyer une autre ailleurs.
create table if not exists public.etab_demandes (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  org_id     uuid not null references public.orgs(id) on delete cascade,
  role       text not null check (role in ('eleve', 'prof')),
  prenom     text not null check (length(prenom) between 1 and 40),
  nom        text not null check (length(nom) between 1 and 40),
  classe     text not null default '' check (length(classe) <= 40),
  created_at timestamptz not null default now()
);
create index if not exists etab_demandes_org on public.etab_demandes (org_id, created_at);
alter table public.etab_demandes enable row level security;
drop policy if exists ed_read on public.etab_demandes;
create policy ed_read on public.etab_demandes for select to authenticated
  using (user_id = (select auth.uid())
         or ((select public.is_ref()) and org_id = (select public.my_org())));
-- Aucune politique d'écriture : seules les fonctions ci-dessous y écrivent.

-- ── 4. Les outils internes ──────────────────────────────────────────────
-- Un code neuf, libre parmi ceux des classes ET des établissements : un même
-- champ « J'ai un code » les reçoit tous.
create or replace function public.code_unique()
returns text language plpgsql volatile security definer set search_path to '' as $$
declare s text;
begin
  loop
    s := public.code_classe();
    exit when not exists (select 1 from public.org_codes c where s in (c.eleve, c.prof, c.ref));
  end loop;
  return s;
end $$;

create or replace function public.etab_eleves(o uuid)
returns integer language sql stable security definer set search_path to '' as $$
  select count(*)::integer from public.org_members m
  left join public.user_roles r on r.user_id = m.user_id
  where m.org_id = o and coalesce(r.role, 'eleve') = 'eleve'
$$;

-- Le code tapé, s'il est celui d'un établissement : lequel, et pour quel rôle.
create or replace function public.etab_du_code(k text, out o_org uuid, out o_quel text)
language sql stable security definer set search_path to '' as $$
  select c.org_id,
         case when c.eleve = k then 'eleve' when c.prof = k then 'prof' else 'ref' end
  from public.org_codes c
  where length(k) = 8
    and (c.eleve = k or c.prof = k or (c.ref = k and c.ref_fin > now()))
  limit 1
$$;

-- Ce qui empêche (ou non) ce compte d'entrer avec ce code.
create or replace function public.etab_verdict(o uuid, quel text)
returns text language plpgsql stable security definer set search_path to '' as $$
declare
  moi uuid := auth.uid();
  mon_role text := public.my_role();
  x public.orgs%rowtype;
  d public.etab_demandes%rowtype;
begin
  select * into x from public.orgs where id = o;
  if x.licence_fin is not null and x.licence_fin < current_date then return 'licence'; end if;
  if exists (select 1 from public.org_members m where m.user_id = moi and m.org_id = o) then return 'deja'; end if;
  if exists (select 1 from public.org_members m where m.user_id = moi) then return 'autre'; end if;
  if exists (select 1 from public.comptes_geres g where g.user_id = moi) then return 'gere'; end if;
  if quel = 'eleve' and mon_role <> 'eleve' then return 'role'; end if;
  if quel in ('prof', 'ref') and mon_role not in ('eleve', 'prof') then return 'role'; end if;
  select * into d from public.etab_demandes e where e.user_id = moi;
  if d.user_id is not null then
    return case when d.org_id = o then 'attente' else 'demande' end;
  end if;
  if quel = 'eleve' and x.places is not null and public.etab_eleves(o) >= x.places then return 'plein'; end if;
  return 'ok';
end $$;

revoke all on function public.code_unique() from public, anon, authenticated;
revoke all on function public.etab_eleves(uuid) from public, anon, authenticated;
revoke all on function public.etab_du_code(text) from public, anon, authenticated;
revoke all on function public.etab_verdict(uuid, text) from public, anon, authenticated;

-- ── 5. Un code tapé dans « J'ai un code » ───────────────────────────────
-- Un code d'établissement : son nom, sa ville, le rôle qu'il donne, et ce
-- qui arriverait. Sinon, la réponse d'un code de classe (class_preview),
-- telle quelle. L'essai est compté une fois, ici ou dans class_preview.
create or replace function public.code_apercu(code text)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  moi uuid := auth.uid();
  k text := upper(regexp_replace(coalesce(code, ''), '[^A-Za-z0-9]', '', 'g'));
  e record; x public.orgs%rowtype;
begin
  if moi is null then return jsonb_build_object('type', 'etab', 'statut', 'connexion'); end if;
  if public.class_trop_essais() then return jsonb_build_object('type', 'etab', 'statut', 'trop'); end if;
  select * into e from public.etab_du_code(k);
  if e.o_org is null then
    return jsonb_build_object('type', 'classe',
      'fiche', (select to_jsonb(f) from public.class_preview(code) f limit 1));
  end if;
  insert into public.class_join_attempts (user_id, ok) values (moi, true);
  select * into x from public.orgs where id = e.o_org;
  return jsonb_build_object('type', 'etab', 'statut', public.etab_verdict(e.o_org, e.o_quel),
    'quel', e.o_quel, 'nom', x.name, 'ville', x.ville, 'genre', x.kind);
end $$;

-- ── 6. Envoyer sa demande (ou entrer, avec le code référent) ────────────
create or replace function public.etab_demander(code text, son_prenom text, son_nom text, sa_classe text default '')
returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  moi uuid := auth.uid();
  k text := upper(regexp_replace(coalesce(code, ''), '[^A-Za-z0-9]', '', 'g'));
  e record; x public.orgs%rowtype; s text;
begin
  if moi is null then return jsonb_build_object('statut', 'connexion'); end if;
  if public.class_trop_essais() then return jsonb_build_object('statut', 'trop'); end if;
  select * into e from public.etab_du_code(k);
  insert into public.class_join_attempts (user_id, ok) values (moi, e.o_org is not null);
  if e.o_org is null then return jsonb_build_object('statut', 'inconnu'); end if;
  select * into x from public.orgs where id = e.o_org;
  s := public.etab_verdict(e.o_org, e.o_quel);
  if s = 'ok' and not (public.nom_valide(son_prenom) and public.nom_valide(son_nom)) then s := 'nom'; end if;
  if s = 'ok' and length(trim(coalesce(sa_classe, ''))) > 40 then s := 'classe'; end if;
  if s = 'ok' and (select count(*) from public.etab_demandes d where d.org_id = e.o_org) >= 500 then s := 'complet'; end if;
  if s <> 'ok' then
    return jsonb_build_object('statut', s, 'quel', e.o_quel, 'nom', x.name);
  end if;

  if e.o_quel = 'ref' then
    -- Le nom d'abord : une fois dans l'établissement, il serait verrouillé
    -- pour un élève (lock_identite_scolaire) — pas pour un référent, mais
    -- l'ordre reste le même partout.
    update public.profiles set name = public.nom_propre(son_prenom, son_nom) where id = moi;
    insert into public.org_members (user_id, org_id) values (moi, e.o_org);
    insert into public.user_roles (user_id, role) values (moi, 'ref')
      on conflict (user_id) do update set role = 'ref', set_at = now();
    update public.org_codes set ref = null, ref_fin = null, maj = now() where org_id = e.o_org;
    perform public.ref_trace(moi, 'référent entré avec son code',
      jsonb_build_object('nom', public.nom_propre(son_prenom, son_nom)));
    return jsonb_build_object('statut', 'admis', 'quel', 'ref', 'nom', x.name);
  end if;

  insert into public.etab_demandes (user_id, org_id, role, prenom, nom, classe)
  values (moi, e.o_org, e.o_quel, trim(son_prenom), trim(son_nom), trim(coalesce(sa_classe, '')));
  return jsonb_build_object('statut', 'attente', 'quel', e.o_quel, 'nom', x.name);
end $$;

-- Sa demande en cours, s'il y en a une : à quel établissement, pour quoi.
create or replace function public.ma_demande_etab()
returns jsonb language sql stable security definer set search_path to '' as $$
  select jsonb_build_object('org', o.name, 'ville', o.ville, 'quel', d.role, 'classe', d.classe,
                            'prenom', d.prenom, 'nom', d.nom, 'depuis', d.created_at)
  from public.etab_demandes d join public.orgs o on o.id = d.org_id
  where d.user_id = auth.uid()
$$;

create or replace function public.etab_annuler()
returns void language sql security definer set search_path to '' as $$
  delete from public.etab_demandes where user_id = auth.uid()
$$;

-- ── 7. Le référent : ses codes, sa licence, ses demandes ────────────────
create or replace function public.ref_codes()
returns jsonb language plpgsql security definer set search_path to '' as $$
declare o uuid := public.my_org(); x public.orgs%rowtype; c public.org_codes%rowtype;
begin
  if not public.is_ref() or o is null then raise exception 'Réservé au référent de l''établissement'; end if;
  insert into public.org_codes (org_id) values (o) on conflict do nothing;
  update public.org_codes set eleve = coalesce(eleve, public.code_unique()),
                              prof = coalesce(prof, public.code_unique())
  where org_id = o and (eleve is null or prof is null);
  select * into c from public.org_codes where org_id = o;
  select * into x from public.orgs where id = o;
  return jsonb_build_object('eleve', c.eleve, 'prof', c.prof, 'offre', x.offre,
    'places', x.places, 'licence_fin', x.licence_fin, 'eleves', public.etab_eleves(o),
    'demandes', (select count(*) from public.etab_demandes d where d.org_id = o));
end $$;

create or replace function public.ref_nouveau_code(quel text)
returns text language plpgsql security definer set search_path to '' as $$
declare o uuid := public.my_org(); s text := public.code_unique();
begin
  if not public.is_ref() or o is null then raise exception 'Réservé au référent de l''établissement'; end if;
  if quel = 'eleve' then
    update public.org_codes set eleve = s, maj = now() where org_id = o;
  elsif quel = 'prof' then
    update public.org_codes set prof = s, maj = now() where org_id = o;
  else
    raise exception 'Code inconnu';
  end if;
  if not found then raise exception 'Ouvre d''abord tes codes'; end if;
  perform public.ref_trace(null, 'code changé', jsonb_build_object('role', quel));
  return s;
end $$;

create or replace function public.ref_demandes()
returns table (user_id uuid, role text, prenom text, nom text, classe text, depuis timestamptz)
language sql stable security definer set search_path to '' as $$
  select d.user_id, d.role, d.prenom, d.nom, d.classe, d.created_at
  from public.etab_demandes d
  where public.is_ref() and d.org_id = public.my_org()
  order by d.created_at
$$;

-- Admettre : la personne entre dans l'établissement avec son rôle, son nom
-- « Prénom NOM » (verrouillé ensuite pour un élève), et l'élève dans la
-- classe choisie. Ici on lève : rien n'est à compter, et le message de la
-- base est celui que le référent lit.
create or replace function public.ref_admettre(qui uuid, cid uuid default null)
returns text language plpgsql security definer set search_path to '' as $$
declare
  o uuid := public.my_org(); d public.etab_demandes%rowtype; x public.orgs%rowtype;
  r text; nom text;
begin
  if not public.is_ref() or o is null then raise exception 'Réservé au référent de l''établissement'; end if;
  select * into d from public.etab_demandes e where e.user_id = qui and e.org_id = o for update;
  if d.user_id is null then raise exception 'Cette demande n''existe plus'; end if;
  select * into x from public.orgs where id = o;
  if x.licence_fin is not null and x.licence_fin < current_date then
    raise exception 'La licence a pris fin le % : écris à Folio pour la renouveler', to_char(x.licence_fin, 'DD/MM/YYYY');
  end if;
  if d.role = 'eleve' and x.places is not null and public.etab_eleves(o) >= x.places then
    raise exception 'Licence pleine : % places sur %. Écris à Folio pour en ajouter', x.places, x.places;
  end if;
  if exists (select 1 from public.org_members m where m.user_id = qui) then
    delete from public.etab_demandes where user_id = qui;
    raise exception 'Ce compte appartient déjà à un établissement';
  end if;
  r := coalesce((select ur.role from public.user_roles ur where ur.user_id = qui), 'eleve');
  if r in ('ref', 'admin') then raise exception 'Ce compte ne peut pas être admis ainsi'; end if;
  if cid is not null and d.role = 'eleve' and not exists (
       select 1 from public.classes c where c.id = cid and c.org_id = o and c.archived_at is null) then
    raise exception 'Cette classe n''est pas dans ton établissement';
  end if;

  nom := public.nom_propre(d.prenom, d.nom);
  update public.profiles set name = nom where id = qui;
  insert into public.org_members (user_id, org_id) values (qui, o);
  insert into public.user_roles (user_id, role) values (qui, d.role)
    on conflict (user_id) do update set role = excluded.role, set_at = now();
  if cid is not null and d.role = 'eleve' then
    insert into public.class_members (class_id, user_id, who) values (cid, qui, nom) on conflict do nothing;
    delete from public.class_requests where class_id = cid and user_id = qui;
  end if;
  delete from public.etab_demandes where user_id = qui;
  perform public.ref_trace(qui, 'admis avec le code', jsonb_build_object('nom', nom, 'role', d.role,
    'classe', (select c.name from public.classes c where c.id = cid)));
  return 'ok';
end $$;

create or replace function public.ref_refuser(qui uuid)
returns void language plpgsql security definer set search_path to '' as $$
declare o uuid := public.my_org(); d public.etab_demandes%rowtype;
begin
  if not public.is_ref() or o is null then raise exception 'Réservé au référent de l''établissement'; end if;
  delete from public.etab_demandes e where e.user_id = qui and e.org_id = o returning * into d;
  if d.user_id is null then raise exception 'Cette demande n''existe plus'; end if;
  perform public.ref_trace(qui, 'demande refusée',
    jsonb_build_object('nom', public.nom_propre(d.prenom, d.nom), 'role', d.role));
end $$;

-- ── 8. L'éditeur : créer un établissement, régler sa licence ────────────
create or replace function public.admin_creer_etab(nom text, ville text default '', uai text default '',
  genre text default 'lycee', places integer default 60, fin date default null, offre text default 'essai')
returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  o uuid; base text; c text; n integer := 1; ref text := public.code_unique();
  u text := upper(trim(coalesce(uai, '')));
begin
  if not public.is_admin() then raise exception 'Réservé à l''éditeur'; end if;
  if length(trim(coalesce(nom, ''))) not between 2 and 120 then raise exception 'Un nom de 2 à 120 caractères'; end if;
  if u <> '' and u !~ '^[0-9]{7}[A-Z]$' then raise exception 'L''UAI s''écrit 7 chiffres et une lettre'; end if;
  if genre not in ('college', 'lycee', 'lycee_pro', 'sup', 'autre') then raise exception 'Type inconnu'; end if;
  if offre not in ('essai', 'etablissement') then raise exception 'Offre inconnue'; end if;
  if places is not null and places not between 0 and 100000 then raise exception 'Nombre de places impossible'; end if;
  -- Le préfixe des identifiants lisibles (A, J2…) : la première lettre du
  -- nom, puis un chiffre tant qu'il est pris.
  base := upper(left(regexp_replace(translate(trim(nom), 'ÀÂÄÉÈÊËÎÏÔÖÙÛÜÇàâäéèêëîïôöùûüç',
                                    'AAAEEEEIIOOUUUCaaaeeeeiioouuuc'), '[^A-Za-z]', '', 'g'), 1));
  if base = '' then base := 'E'; end if;
  c := base;
  while exists (select 1 from public.orgs x where x.code = c) loop n := n + 1; c := base || n; end loop;
  insert into public.orgs (code, name, kind, ville, uai, offre, places, licence_fin)
  values (c, trim(nom), genre, left(trim(coalesce(ville, '')), 80), u, offre, places,
          coalesce(fin, case when offre = 'essai' then current_date + 30 end))
  returning id into o;
  insert into public.org_codes (org_id, eleve, prof, ref, ref_fin)
  values (o, public.code_unique(), public.code_unique(), ref, now() + interval '30 days');
  return jsonb_build_object('id', o, 'code_ref', ref, 'ref_fin', now() + interval '30 days');
end $$;

create or replace function public.admin_licence(org uuid, places integer, fin date, offre text)
returns void language plpgsql security definer set search_path to '' as $$
begin
  if not public.is_admin() then raise exception 'Réservé à l''éditeur'; end if;
  if offre not in ('essai', 'etablissement') then raise exception 'Offre inconnue'; end if;
  if places is not null and places not between 0 and 100000 then raise exception 'Nombre de places impossible'; end if;
  update public.orgs set places = admin_licence.places, licence_fin = fin, offre = admin_licence.offre where id = org;
  if not found then raise exception 'Établissement inconnu'; end if;
end $$;

create or replace function public.admin_code_ref(org uuid)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare s text := public.code_unique();
begin
  if not public.is_admin() then raise exception 'Réservé à l''éditeur'; end if;
  if not exists (select 1 from public.orgs where id = org) then raise exception 'Établissement inconnu'; end if;
  insert into public.org_codes (org_id, ref, ref_fin) values (org, s, now() + interval '30 days')
  on conflict (org_id) do update set ref = s, ref_fin = now() + interval '30 days', maj = now();
  return jsonb_build_object('code_ref', s, 'ref_fin', now() + interval '30 days');
end $$;

-- La liste des établissements gagne la licence et le code référent en
-- cours (l'éditeur doit pouvoir le renvoyer) : le type de retour change.
drop function if exists public.admin_orgs();
create function public.admin_orgs()
returns table (id uuid, code text, name text, kind text, ville text, uai text,
               classes integer, eleves integer, profs integer, refs integer,
               devoirs integer, actifs7 integer, actifs30 integer,
               jamais_venus integer, cents_mois numeric, cents_total numeric,
               ouvert timestamptz, offre text, places integer, licence_fin date,
               code_ref text, code_ref_fin timestamptz, demandes integer)
language sql stable security definer set search_path to '' as $$
  select o.id, o.code, o.name, o.kind, o.ville, o.uai,
    (select count(*)::integer from public.classes c where c.org_id = o.id),
    public.etab_eleves(o.id),
    (select count(*)::integer from public.org_members m join public.user_roles r
     on r.user_id = m.user_id where m.org_id = o.id and r.role = 'prof'),
    (select count(*)::integer from public.org_members m join public.user_roles r
     on r.user_id = m.user_id where m.org_id = o.id and r.role = 'ref'),
    (select count(*)::integer from public.assignments a join public.classes c
     on c.id = a.class_id where c.org_id = o.id),
    (select count(distinct s.user_id)::integer from public.sessions s
     join public.org_members m on m.user_id = s.user_id
     where m.org_id = o.id and s.created_at > now() - interval '7 days'),
    (select count(distinct s.user_id)::integer from public.sessions s
     join public.org_members m on m.user_id = s.user_id
     where m.org_id = o.id and s.created_at > now() - interval '30 days'),
    (select count(*)::integer from public.org_members m join auth.users u
     on u.id = m.user_id where m.org_id = o.id and u.last_sign_in_at is null),
    (select coalesce(sum(a.cents), 0) from public.ai_usage a
     join public.org_members m on m.user_id = a.user_id
     where m.org_id = o.id and a.day >= date_trunc('month', current_date)),
    (select coalesce(sum(a.cents), 0) from public.ai_usage a
     join public.org_members m on m.user_id = a.user_id where m.org_id = o.id),
    o.created_at, o.offre, o.places, o.licence_fin,
    (select k.ref from public.org_codes k where k.org_id = o.id and k.ref_fin > now()),
    (select k.ref_fin from public.org_codes k where k.org_id = o.id and k.ref_fin > now()),
    (select count(*)::integer from public.etab_demandes d where d.org_id = o.id)
  from public.orgs o
  where public.is_admin()
  order by o.name
$$;

-- ── 9. Les droits ───────────────────────────────────────────────────────
revoke all on function public.code_apercu(text) from public, anon;
revoke all on function public.etab_demander(text, text, text, text) from public, anon;
revoke all on function public.ma_demande_etab() from public, anon;
revoke all on function public.etab_annuler() from public, anon;
revoke all on function public.ref_codes() from public, anon;
revoke all on function public.ref_nouveau_code(text) from public, anon;
revoke all on function public.ref_demandes() from public, anon;
revoke all on function public.ref_admettre(uuid, uuid) from public, anon;
revoke all on function public.ref_refuser(uuid) from public, anon;
revoke all on function public.admin_creer_etab(text, text, text, text, integer, date, text) from public, anon;
revoke all on function public.admin_licence(uuid, integer, date, text) from public, anon;
revoke all on function public.admin_code_ref(uuid) from public, anon;
revoke all on function public.admin_orgs() from public, anon;
grant execute on function public.code_apercu(text) to authenticated;
grant execute on function public.etab_demander(text, text, text, text) to authenticated;
grant execute on function public.ma_demande_etab() to authenticated;
grant execute on function public.etab_annuler() to authenticated;
grant execute on function public.ref_codes() to authenticated;
grant execute on function public.ref_nouveau_code(text) to authenticated;
grant execute on function public.ref_demandes() to authenticated;
grant execute on function public.ref_admettre(uuid, uuid) to authenticated;
grant execute on function public.ref_refuser(uuid) to authenticated;
grant execute on function public.admin_creer_etab(text, text, text, text, integer, date, text) to authenticated;
grant execute on function public.admin_licence(uuid, integer, date, text) to authenticated;
grant execute on function public.admin_code_ref(uuid) to authenticated;
grant execute on function public.admin_orgs() to authenticated;
