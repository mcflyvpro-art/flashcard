-- ══════════ des classes qu'on ne force pas ══════════
-- Refonte de l'espace professeur (2026-10-24). Ce qu'on a trouvé en
-- lisant la base avant d'y toucher :
--
-- 1. `join_class` (créée à la main dans le tableau de bord, absente des
--    migrations) laissait N'IMPORTE QUEL compte entrer dans N'IMPORTE
--    QUELLE classe avec son code : aucun contrôle d'établissement, aucun
--    contrôle de rôle, aucune limite d'essais, aucune validation. Les codes
--    faisaient 4 caractères : 923 521 combinaisons, qu'un script parcourt
--    en une après-midi. Et le code ne pouvait jamais être changé : un code
--    partagé sur un réseau social restait une porte ouverte toute l'année.
-- 2. Tout élève inscrit pouvait relire le code de sa classe par l'API
--    (`classes_read` → `in_class`), donc le repartager même après qu'un
--    professeur l'aurait changé.
-- 3. `prof_roster`, `prof_eleve`, `prof_devoirs`, `prof_cartes` et
--    `prof_assignment_cards` ouvraient tout à `is_ref()` SANS vérifier
--    l'établissement : le référent d'un lycée lisait la liste d'une classe
--    d'un autre lycée dont il connaissait l'identifiant.
-- 4. L'élève écrivait lui-même son avancement (`ap_mine`, `ap_edit`) : il
--    pouvait se déclarer « rendu, 100 % » d'une requête. Et l'app ne
--    l'écrivait jamais : aucun devoir n'était jamais marqué rendu.
-- 5. `prof_roster` comptait les révisions de TOUS les livres de l'élève,
--    personnels compris : le professeur voyait le volume de travail privé.
--
-- Ce qui suit ferme chacune de ces portes, dans la base — masquer un bouton
-- ne ferme rien, l'API reste ouverte.
--
-- ══════════ qui peut quoi dans une classe ══════════
--
--   action                                   élève   prof     gestion- référent
--                                                    de la    naire    (même
--                                                    classe   (*)      étab.)
--   voir la classe, ses devoirs              inscrit  oui      oui      oui
--   voir la liste, la fiche d'un élève        —       oui      oui      oui
--   donner, modifier, retirer SES devoirs     —       oui      oui      —
--   admettre / refuser une demande            —       oui      oui      oui
--   retirer un élève, l'exclure, le réadmettre—       —        oui      oui
--   régler les inscriptions, changer le code  —       —        oui      oui
--   renommer, archiver la classe              —       —        créateur oui
--   supprimer la classe                       —       —        créateur (console)
--   inviter / retirer un collègue             —       —        créateur —
--   écrire à toute la classe                  —       oui      oui      —
--   quitter la classe                         hors     co-ens.  —        —
--                                             étab.    hors étab.
--
--   (*) gestionnaire = le créateur de la classe ou son professeur principal.
--
-- ══════════ rejoindre une classe : sept verrous ══════════
--   a. un code de 8 caractères tiré par `gen_random_bytes` (8,5·10¹¹
--      combinaisons), sans 0/O ni 1/I/L pour qu'on le recopie sans erreur ;
--   b. 10 codes faux par heure et 30 essais par 10 minutes, par compte ;
--   c. la frontière d'établissement : un compte d'un lycée n'entre que dans
--      une classe de ce lycée, un compte personnel que dans une classe hors
--      établissement ;
--   d. seul un compte élève entre comme élève ; les professeurs ont leur
--      propre code, à durée limitée, que seul le créateur distribue ;
--   e. la salle d'attente (par défaut) : le professeur admet chaque élève
--      en voyant son nom — un code qui fuit ne fait entrer personne ;
--   f. inscriptions ouvertes ou fermées, durée de validité, nombre de
--      places, 60 demandes en attente au plus par classe, 10 par élève ;
--   g. la liste d'exclusion : un élève retiré « et exclu » ne peut plus
--      redemander, même avec le bon code.
--
-- Les fonctions renvoient un statut plutôt que de lever une erreur quand
-- l'essai doit être compté : une exception annulerait la transaction, et
-- avec elle la ligne qui compte l'essai — la limite ne verrait jamais les
-- essais ratés.

-- ── 0. Le générateur de codes ───────────────────────────────────────────
-- Tirage par rejet : 248 = 31 × 8, un octet au-delà est jeté plutôt que
-- ramené par modulo (qui avantagerait les huit premières lettres).
create or replace function public.code_classe()
returns text language plpgsql volatile security definer set search_path = '' as $$
declare
  a constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  b bytea; s text; i integer; o integer;
begin
  loop
    s := '';
    while length(s) < 8 loop
      b := extensions.gen_random_bytes(16);
      for i in 0..15 loop
        o := get_byte(b, i);
        if o < 248 and length(s) < 8 then s := s || substr(a, 1 + o % 31, 1); end if;
      end loop;
    end loop;
    exit when not exists (select 1 from public.classes c where c.code = s or c.staff_code = s);
  end loop;
  return s;
end $$;

-- ── 1. Ce qu'une classe sait de ses inscriptions ────────────────────────
alter table public.classes add column if not exists join_open boolean not null default true;
alter table public.classes add column if not exists join_approval boolean not null default true;
alter table public.classes add column if not exists join_until timestamptz;
alter table public.classes add column if not exists places integer not null default 40;
alter table public.classes add column if not exists archived_at timestamptz;
alter table public.classes add column if not exists staff_code text;
alter table public.classes add column if not exists staff_until timestamptz;
alter table public.classes drop constraint if exists classes_places_check;
alter table public.classes add constraint classes_places_check check (places between 1 and 300);
create unique index if not exists classes_staff_code on public.classes (staff_code) where staff_code is not null;

-- Aucune classe existante ne doit devenir « complète » du seul fait de la
-- nouvelle colonne.
update public.classes c set places = least(300, greatest(40, coalesce(c.effectif, 0),
  (select count(*)::integer from public.class_members m where m.class_id = c.id)));

-- Les codes de 4 caractères sont remplacés un par un (une commande par
-- ligne : le générateur voit ainsi les codes déjà tirés).
do $$
declare r record;
begin
  for r in select id from public.classes where length(code) <> 8 loop
    update public.classes set code = public.code_classe() where id = r.id;
  end loop;
end $$;

-- ── 2. Les trois tables de l'inscription ────────────────────────────────
-- La salle d'attente. Le nom est celui du profil, lu par la base au moment
-- de la demande — jamais un texte envoyé par l'app, sinon n'importe qui
-- pourrait se présenter sous le nom d'un camarade.
create table if not exists public.class_requests (
  class_id uuid not null references public.classes(id) on delete cascade,
  user_id  uuid not null references auth.users(id) on delete cascade,
  who      text not null default '',
  created_at timestamptz not null default now(),
  primary key (class_id, user_id)
);
create index if not exists class_requests_user on public.class_requests (user_id);
alter table public.class_requests enable row level security;

-- La liste d'exclusion.
create table if not exists public.class_bans (
  class_id uuid not null references public.classes(id) on delete cascade,
  user_id  uuid not null references auth.users(id) on delete cascade,
  who      text not null default '',
  by_user  uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (class_id, user_id)
);
create index if not exists class_bans_user on public.class_bans (user_id);
create index if not exists class_bans_by on public.class_bans (by_user);
alter table public.class_bans enable row level security;

-- Les essais, pour la limite. Minimisation : un compte, une heure, réussi
-- ou non — rien d'autre, et effacé au bout d'un jour.
create table if not exists public.class_join_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  ok boolean not null default false,
  at timestamptz not null default now()
);
create index if not exists class_join_attempts_user on public.class_join_attempts (user_id, at desc);
create index if not exists class_join_attempts_at on public.class_join_attempts (at);
alter table public.class_join_attempts enable row level security;

-- ── 3. Qui tient la classe ──────────────────────────────────────────────
-- Un professeur rétrogradé en élève perd l'accès à l'instant : le rôle est
-- relu à chaque appel, pas seulement l'existence d'une ligne `teachings`.
create or replace function public.class_staff(cid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.my_role() in ('prof', 'ref', 'admin') and exists (
    select 1 from public.classes c
    where c.id = cid and (
      c.owner = auth.uid()
      or exists (select 1 from public.teachings t where t.class_id = c.id and t.teacher = auth.uid())
      or (public.is_ref() and c.org_id is not null and c.org_id = public.my_org())))
$$;

create or replace function public.class_manager(cid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.my_role() in ('prof', 'ref', 'admin') and exists (
    select 1 from public.classes c
    where c.id = cid and (
      c.owner = auth.uid()
      or exists (select 1 from public.teachings t
                 where t.class_id = c.id and t.teacher = auth.uid() and t.principal)
      or (public.is_ref() and c.org_id is not null and c.org_id = public.my_org())))
$$;

-- Le créateur, ou le référent de l'établissement : ceux qui décident de
-- l'existence même de la classe.
create or replace function public.class_owner_or_ref(cid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.classes c
                 where c.id = cid and (c.owner = auth.uid()
                   or (public.is_ref() and c.org_id is not null and c.org_id = public.my_org())))
$$;

drop policy if exists creq_read on public.class_requests;
create policy creq_read on public.class_requests for select to authenticated
  using (user_id = (select auth.uid()) or public.class_staff(class_id));
drop policy if exists cban_read on public.class_bans;
create policy cban_read on public.class_bans for select to authenticated
  using (public.class_staff(class_id));
drop policy if exists cja_read on public.class_join_attempts;
create policy cja_read on public.class_join_attempts for select to authenticated
  using (user_id = (select auth.uid()));

-- L'élève ne lit plus la ligne de sa classe : il n'en a besoin que par les
-- fonctions ci-dessous, qui ne lui rendent jamais le code.
drop policy if exists classes_read on public.classes;
create policy classes_read on public.classes for select to authenticated
  using (owner = (select auth.uid()) or public.teaches(id)
      or (org_id = public.my_org() and public.is_ref()) or public.is_admin());

-- L'avancement ne s'écrit plus depuis l'app : la base le calcule.
drop policy if exists ap_mine on public.assignment_progress;
drop policy if exists ap_edit on public.assignment_progress;
alter table public.assignment_progress add column if not exists vus integer not null default 0;
update public.assignment_progress ap
  set vus = case when ap.done_at is not null then a.n when ap.pct > 0 then greatest(1, a.n / 2) else 0 end
  from public.assignments a where a.id = ap.assignment_id and ap.vus = 0;

-- ── 4. Rejoindre : le verdict, l'aperçu, l'inscription ──────────────────
create or replace function public.class_trop_essais()
returns boolean language sql stable security definer set search_path = '' as $$
  select (select count(*) from public.class_join_attempts a
          where a.user_id = auth.uid() and not a.ok and a.at > now() - interval '1 hour') >= 10
      or (select count(*) from public.class_join_attempts a
          where a.user_id = auth.uid() and a.at > now() - interval '10 minutes') >= 30
$$;

create or replace function public.class_verdict(join_code text,
  out o_statut text, out o_cid uuid, out o_collegue boolean)
language plpgsql volatile security definer set search_path = '' as $$
declare
  moi uuid := auth.uid();
  mon_role text := public.my_role();
  mon_org uuid := public.my_org();
  k text := upper(regexp_replace(coalesce(join_code, ''), '[^A-Za-z0-9]', '', 'g'));
  c public.classes%rowtype;
begin
  o_collegue := false;
  if moi is null then o_statut := 'connexion'; return; end if;
  if public.class_trop_essais() then o_statut := 'trop'; return; end if;
  delete from public.class_join_attempts where at < now() - interval '1 day';
  if length(k) = 8 then
    select * into c from public.classes x where x.code = k;
    if c.id is null then
      select * into c from public.classes x where x.staff_code = k and x.staff_until > now();
      o_collegue := c.id is not null;
    end if;
  end if;
  insert into public.class_join_attempts (user_id, ok) values (moi, c.id is not null);
  if c.id is null then o_statut := 'inconnu'; return; end if;
  if c.org_id is distinct from mon_org then o_statut := 'etablissement'; o_collegue := false; return; end if;
  o_cid := c.id;
  if o_collegue then
    if mon_role not in ('prof', 'ref') then o_statut := 'role'; return; end if;
    if c.owner = moi or exists (select 1 from public.teachings t where t.class_id = c.id and t.teacher = moi) then
      o_statut := 'deja'; return;
    end if;
    if c.archived_at is not null then o_statut := 'archive'; return; end if;
    o_statut := 'ok'; return;
  end if;
  if mon_role <> 'eleve' then o_statut := 'role'; return; end if;
  if exists (select 1 from public.class_members m where m.class_id = c.id and m.user_id = moi) then
    o_statut := 'deja'; return;
  end if;
  if exists (select 1 from public.class_bans b where b.class_id = c.id and b.user_id = moi) then
    o_statut := 'refuse'; return;
  end if;
  if exists (select 1 from public.class_requests r where r.class_id = c.id and r.user_id = moi) then
    o_statut := 'attente'; return;
  end if;
  if c.archived_at is not null then o_statut := 'archive'; return; end if;
  if not c.join_open then o_statut := 'ferme'; return; end if;
  if c.join_until is not null and c.join_until <= now() then o_statut := 'expire'; return; end if;
  if (select count(*) from public.class_members m where m.class_id = c.id) >= c.places then
    o_statut := 'complet'; return;
  end if;
  o_statut := 'ok';
end $$;

-- Ce que l'élève voit avant de confirmer : le nom de la classe, son
-- professeur, l'établissement. Rien pour un code inconnu ou d'un autre
-- établissement.
create or replace function public.class_fiche(k uuid, s text, staff boolean)
returns table (statut text, class_id uuid, nom text, niveau text, prof text, etab text,
               validation boolean, collegue boolean)
language sql stable security definer set search_path = '' as $$
  select s, c.id, c.name, coalesce(c.level, ''),
         coalesce((select coalesce(nullif(p.name, ''), p.handle)
                   from public.teachings t join public.profiles p on p.id = t.teacher
                   where t.class_id = c.id
                   order by (t.teacher = c.owner) desc, t.principal desc limit 1), ''),
         coalesce((select o.name from public.orgs o where o.id = c.org_id), ''),
         c.join_approval, staff
  from public.classes c where c.id = k
  union all
  select s, null::uuid, '', '', '', '', false, staff where k is null
$$;

create or replace function public.class_preview(join_code text)
returns table (statut text, class_id uuid, nom text, niveau text, prof text, etab text,
               validation boolean, collegue boolean)
language plpgsql volatile security definer set search_path = '' as $$
declare v record;
begin
  select * into v from public.class_verdict(join_code);
  return query select * from public.class_fiche(
    case when v.o_statut in ('inconnu', 'etablissement', 'trop', 'connexion') then null else v.o_cid end,
    case when v.o_statut = 'ok' then 'apercu' else v.o_statut end, v.o_collegue);
end $$;

create or replace function public.class_join(join_code text)
returns table (statut text, class_id uuid, nom text, niveau text, prof text, etab text,
               validation boolean, collegue boolean)
language plpgsql volatile security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v record; c public.classes%rowtype; s text; nom_eleve text;
  moi uuid := auth.uid();
begin
  select * into v from public.class_verdict(join_code);
  s := v.o_statut;
  if s = 'ok' then
    -- une inscription à la fois par classe : deux élèves qui valident en
    -- même temps ne prennent pas la même dernière place
    select * into c from public.classes x where x.id = v.o_cid for update;
    if v.o_collegue then
      insert into public.teachings (class_id, teacher, subject, principal)
      values (c.id, moi, coalesce(nullif((select m.subject from public.org_members m where m.user_id = moi), ''),
                                  'Cours'), false)
      on conflict do nothing;
      s := 'collegue';
    else
      nom_eleve := left(coalesce((select coalesce(nullif(p.name, ''), p.handle) from public.profiles p
                                  where p.id = moi), 'Élève'), 80);
      if (select count(*) from public.class_members m where m.class_id = c.id) >= c.places then
        s := 'complet';
      elsif c.join_approval then
        if (select count(*) from public.class_requests r where r.class_id = c.id) >= 60 then
          s := 'complet';
        elsif (select count(*) from public.class_requests r where r.user_id = moi) >= 10 then
          s := 'demandes';
        else
          insert into public.class_requests (class_id, user_id, who) values (c.id, moi, nom_eleve)
          on conflict do nothing;
          s := 'attente';
        end if;
      else
        insert into public.class_members (class_id, user_id, who) values (c.id, moi, nom_eleve)
        on conflict do nothing;
        s := 'inscrit';
      end if;
    end if;
  end if;
  return query select * from public.class_fiche(
    case when s in ('inconnu', 'etablissement', 'trop', 'connexion') then null else v.o_cid end,
    s, v.o_collegue);
end $$;

-- L'ancienne porte reste ouverte aux versions de l'app déjà installées,
-- mais passe désormais par les mêmes verrous. Elle ne lève jamais : lever
-- annulerait le décompte de l'essai.
create or replace function public.join_class(join_code text, who text default '')
returns table (id uuid, name text)
language sql volatile security definer set search_path = '' as $$
  select j.class_id, j.nom from public.class_join(join_code) j where j.statut in ('inscrit', 'deja')
$$;

-- ── 5. La salle d'attente, côté professeur ──────────────────────────────
create or replace function public.prof_demandes(cid uuid)
returns table (user_id uuid, who text, handle text, depuis timestamptz)
language sql stable security definer set search_path = '' as $$
  select r.user_id, coalesce(nullif(r.who, ''), p.handle, 'Élève'), p.handle, r.created_at
  from public.class_requests r left join public.profiles p on p.id = r.user_id
  where r.class_id = cid and public.class_staff(cid)
  order by r.created_at
$$;

-- On admet dans l'ordre d'arrivée, jusqu'à la dernière place libre ; le
-- reste attend et la fonction le dit.
create or replace function public.prof_admettre(cid uuid, qui uuid[])
returns integer language plpgsql security definer set search_path = '' as $$
declare c public.classes%rowtype; libres integer; n integer;
begin
  if not public.class_staff(cid) then raise exception 'Cette classe n''est pas la tienne'; end if;
  select * into c from public.classes where id = cid for update;
  if c.archived_at is not null then raise exception 'Cette classe est archivée'; end if;
  libres := c.places - (select count(*) from public.class_members m where m.class_id = cid);
  if libres <= 0 then
    raise exception 'La classe est complète (% places). Ajoute des places dans les réglages.', c.places;
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

create or replace function public.prof_refuser(cid uuid, qui uuid[], exclure boolean default false)
returns integer language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if not public.class_staff(cid) then raise exception 'Cette classe n''est pas la tienne'; end if;
  if exclure then
    insert into public.class_bans (class_id, user_id, who, by_user)
    select cid, r.user_id, r.who, auth.uid() from public.class_requests r
    where r.class_id = cid and r.user_id = any(qui)
    on conflict do nothing;
  end if;
  delete from public.class_requests r where r.class_id = cid and r.user_id = any(qui);
  get diagnostics n = row_count;
  return n;
end $$;

-- Retirer un élève efface aussi ce que son professeur savait de lui dans
-- cette classe : son avancement n'a plus à rester chez quelqu'un qui ne
-- l'a plus en charge.
create or replace function public.prof_retirer(cid uuid, qui uuid, exclure boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
declare nom text;
begin
  if not public.class_manager(cid) then
    raise exception 'Seul le professeur principal ou le créateur de la classe retire un élève';
  end if;
  select m.who into nom from public.class_members m where m.class_id = cid and m.user_id = qui;
  if not found then raise exception 'Cet élève n''est pas dans la classe'; end if;
  if exclure then
    insert into public.class_bans (class_id, user_id, who, by_user)
    values (cid, qui, coalesce(nom, ''), auth.uid()) on conflict do nothing;
  end if;
  delete from public.assignment_progress ap using public.assignments a
  where a.id = ap.assignment_id and a.class_id = cid and ap.user_id = qui;
  delete from public.class_members m where m.class_id = cid and m.user_id = qui;
  if public.my_org() is not null then
    perform public.ref_trace(qui, case when exclure then 'exclu d''une classe' else 'retiré d''une classe' end,
      jsonb_build_object('classe', (select name from public.classes where id = cid)));
  end if;
end $$;

create or replace function public.prof_exclus(cid uuid)
returns table (user_id uuid, who text, depuis timestamptz)
language sql stable security definer set search_path = '' as $$
  select b.user_id, b.who, b.created_at from public.class_bans b
  where b.class_id = cid and public.class_staff(cid)
  order by b.created_at desc
$$;

create or replace function public.prof_reintegrer(cid uuid, qui uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.class_manager(cid) then raise exception 'Réservé au gestionnaire de la classe'; end if;
  delete from public.class_bans b where b.class_id = cid and b.user_id = qui;
end $$;

-- Hors établissement, le pseudo d'un élève peut être « xX_dark_Xx » : son
-- professeur le renomme pour la classe, sans toucher à son compte. Dans
-- un établissement, le nom vient de l'inscription officielle.
create or replace function public.prof_renommer_eleve(cid uuid, qui uuid, nom text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.class_manager(cid) then raise exception 'Réservé au gestionnaire de la classe'; end if;
  if exists (select 1 from public.classes c where c.id = cid and c.org_id is not null) then
    raise exception 'Le nom d''un élève vient de son établissement';
  end if;
  if nullif(trim(coalesce(nom, '')), '') is null then raise exception 'Il faut un nom'; end if;
  update public.class_members m set who = left(trim(nom), 80) where m.class_id = cid and m.user_id = qui;
  if not found then raise exception 'Cet élève n''est pas dans la classe'; end if;
end $$;

-- ── 6. Les réglages et le code ──────────────────────────────────────────
-- `minutes` : -1 garde la durée en cours, 0 retire toute limite, sinon le
-- code expire dans ce délai.
create or replace function public.prof_reglages(cid uuid, ouvert boolean, validation boolean,
  nb_places integer, minutes integer default -1)
returns void language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if not public.class_manager(cid) then raise exception 'Réservé au gestionnaire de la classe'; end if;
  if exists (select 1 from public.classes c where c.id = cid and c.archived_at is not null) then
    raise exception 'Cette classe est archivée';
  end if;
  if nb_places is null or nb_places < 1 or nb_places > 300 then
    raise exception 'Entre 1 et 300 places';
  end if;
  n := (select count(*) from public.class_members m where m.class_id = cid);
  if nb_places < n then raise exception 'La classe compte déjà % élèves', n; end if;
  if minutes is not null and minutes > 525600 then raise exception 'Un an au plus'; end if;
  update public.classes set
    join_open = coalesce(ouvert, join_open),
    join_approval = coalesce(validation, join_approval),
    places = nb_places,
    join_until = case when minutes is null or minutes < 0 then join_until
                      when minutes = 0 then null
                      else now() + make_interval(mins => minutes) end
  where id = cid;
end $$;

-- Un code qui a fui se remplace : l'ancien cesse de fonctionner à
-- l'instant, ceux qui sont déjà inscrits restent inscrits.
create or replace function public.prof_nouveau_code(cid uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare k text;
begin
  if not public.class_manager(cid) then raise exception 'Réservé au gestionnaire de la classe'; end if;
  k := public.code_classe();
  update public.classes set code = k where id = cid;
  if public.my_org() is not null then
    perform public.ref_trace(null, 'code de classe changé',
      jsonb_build_object('classe', (select name from public.classes where id = cid)));
  end if;
  return k;
end $$;

-- ── 7. Créer, modifier, archiver, supprimer une classe ──────────────────
-- Un professeur crée ses classes : un groupe d'option, une demi-classe, un
-- atelier. Dans un établissement elle y est rattachée d'office — le
-- référent la voit dans sa console et peut la reprendre — ce qui évite les
-- doublons que personne ne retrouverait.
create or replace function public.prof_creer_classe(nom text, niveau text default '',
  matiere text default '')
returns uuid language plpgsql security definer set search_path = '' as $$
declare k uuid; mat text;
begin
  if public.my_role() <> 'prof' then raise exception 'Réservé aux professeurs'; end if;
  if nullif(trim(coalesce(nom, '')), '') is null then raise exception 'Il faut un nom de classe'; end if;
  if length(trim(nom)) > 60 then raise exception 'Soixante caractères au plus pour le nom'; end if;
  if (select count(*) from public.classes c where c.owner = auth.uid() and c.archived_at is null) >= 40 then
    raise exception 'Quarante classes actives au plus : archive celles de l''an dernier';
  end if;
  mat := left(coalesce(nullif(trim(coalesce(matiere, '')), ''),
                       nullif((select m.subject from public.org_members m where m.user_id = auth.uid()), ''),
                       'Cours'), 60);
  insert into public.classes (name, level, year, code, owner, org_id)
  values (trim(nom), left(trim(coalesce(niveau, '')), 40),
          case when extract(month from current_date) >= 8
               then extract(year from current_date)::text || '-' || (extract(year from current_date) + 1)::text
               else (extract(year from current_date) - 1)::text || '-' || extract(year from current_date)::text end,
          public.code_classe(), auth.uid(), public.my_org())
  returning id into k;
  insert into public.teachings (class_id, teacher, subject, principal) values (k, auth.uid(), mat, true);
  if public.my_org() is not null then
    perform public.ref_trace(null, 'classe créée par un professeur', jsonb_build_object('nom', trim(nom)));
  end if;
  return k;
end $$;

create or replace function public.prof_modifier_classe(cid uuid, nom text, niveau text default '')
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.class_owner_or_ref(cid) then raise exception 'Seul le créateur de la classe la renomme'; end if;
  if nullif(trim(coalesce(nom, '')), '') is null then raise exception 'Il faut un nom de classe'; end if;
  if length(trim(nom)) > 60 then raise exception 'Soixante caractères au plus pour le nom'; end if;
  update public.classes set name = trim(nom), level = left(trim(coalesce(niveau, '')), 40) where id = cid;
end $$;

-- Archiver, c'est la fin de l'année : plus d'inscription, plus de devoir,
-- mais tout reste lisible. Cela se défait.
create or replace function public.prof_archiver(cid uuid, archiver boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.class_owner_or_ref(cid) then raise exception 'Seul le créateur de la classe l''archive'; end if;
  update public.classes set archived_at = case when archiver then coalesce(archived_at, now()) end
  where id = cid;
end $$;

-- Supprimer efface tout : inscriptions, devoirs, avancement, défis. Le nom
-- de la classe, retapé, est exigé par la base elle-même : un clic de trop
-- ne suffit pas à effacer une année de travail.
create or replace function public.prof_supprimer_classe(cid uuid, confirmation text)
returns void language plpgsql security definer set search_path = '' as $$
declare c public.classes%rowtype;
begin
  select * into c from public.classes where id = cid;
  if c.id is null or c.owner <> auth.uid() or public.my_role() <> 'prof' then
    raise exception 'Seul le professeur qui a créé la classe la supprime';
  end if;
  if lower(trim(coalesce(confirmation, ''))) <> lower(trim(c.name)) then
    raise exception 'Retape exactement le nom de la classe pour confirmer';
  end if;
  delete from public.classes where id = cid;
  if public.my_org() is not null then
    perform public.ref_trace(null, 'classe supprimée par un professeur', jsonb_build_object('nom', c.name));
  end if;
end $$;

-- ── 8. Les collègues ────────────────────────────────────────────────────
-- Le code collègue vit sept jours, et seul le créateur le voit.
create or replace function public.prof_code_collegue(cid uuid, actif boolean)
returns text language plpgsql security definer set search_path = '' as $$
declare k text;
begin
  if not exists (select 1 from public.classes c where c.id = cid and c.owner = auth.uid()) then
    raise exception 'Seul le créateur de la classe invite un collègue';
  end if;
  if actif then
    k := public.code_classe();
    update public.classes set staff_code = k, staff_until = now() + interval '7 days' where id = cid;
  else
    update public.classes set staff_code = null, staff_until = null where id = cid;
  end if;
  return k;
end $$;

create or replace function public.prof_equipe(cid uuid)
returns table (teacher uuid, nom text, matiere text, principal boolean, moi boolean, createur boolean)
language sql stable security definer set search_path = '' as $$
  select t.teacher, coalesce(nullif(p.name, ''), p.handle, 'Professeur'), t.subject,
         coalesce(t.principal, false), t.teacher = auth.uid(), t.teacher = c.owner
  from public.teachings t join public.classes c on c.id = t.class_id
  left join public.profiles p on p.id = t.teacher
  where t.class_id = cid and public.class_staff(cid)
  order by (t.teacher = c.owner) desc, t.principal desc, 2
$$;

create or replace function public.prof_retirer_collegue(cid uuid, qui uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.classes c where c.id = cid and c.owner = auth.uid()) then
    raise exception 'Seul le créateur de la classe retire un collègue';
  end if;
  if qui = auth.uid() then raise exception 'Le créateur ne se retire pas de sa propre classe'; end if;
  delete from public.teachings t where t.class_id = cid and t.teacher = qui;
end $$;

-- Quitter une classe où l'on a été invité. Dans une classe montée par le
-- référent, la répartition des services est la sienne : on ne la défait
-- pas seul.
create or replace function public.prof_quitter(cid uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.classes c
                 where c.id = cid and c.owner <> auth.uid()
                   and coalesce((select r.role from public.user_roles r where r.user_id = c.owner), 'eleve') = 'prof') then
    raise exception 'Demande au référent de ton établissement de te retirer de cette classe';
  end if;
  delete from public.teachings t where t.class_id = cid and t.teacher = auth.uid();
end $$;

-- ── 9. Écrire à toute la classe ─────────────────────────────────────────
-- Un mot dans le courrier de chaque élève. Trois cents messages par heure
-- au plus : de quoi écrire huit fois à trois classes, pas de quoi inonder.
create or replace function public.prof_message_classe(cid uuid, mot text)
returns integer language plpgsql security definer set search_path = '' as $$
declare moi text; n integer;
begin
  if not public.class_staff(cid) then raise exception 'Cette classe n''est pas la tienne'; end if;
  if nullif(trim(coalesce(mot, '')), '') is null then raise exception 'Le message est vide'; end if;
  if length(mot) > 1000 then raise exception 'Mille caractères au plus'; end if;
  if (select count(*) from public.mail m
      where m.from_user = auth.uid() and m.created_at > now() - interval '1 hour') > 300 then
    raise exception 'Trop de messages en une heure : réessaie plus tard';
  end if;
  select coalesce(nullif(name, ''), handle, 'Ton professeur') into moi from public.profiles where id = auth.uid();
  insert into public.mail (from_user, to_user, from_name, deck_name, message, cards)
  select auth.uid(), cm.user_id, coalesce(moi, 'Ton professeur'),
         (select c.name from public.classes c where c.id = cid), trim(mot), '[]'::jsonb
  from public.class_members cm where cm.class_id = cid;
  get diagnostics n = row_count;
  return n;
end $$;

-- ── 10. Les fonctions de lecture du professeur, refaites ────────────────
-- Toutes passent désormais par `class_staff` : plus de `is_ref()` sans
-- établissement. Celles dont la forme change sont recréées ; les versions
-- installées de l'app ignorent simplement les colonnes nouvelles.
drop function if exists public.prof_classes(text);
create function public.prof_classes(annee text default null)
returns table (id uuid, name text, niveau text, cycle text, filiere text,
               annee_scolaire text, code text, matiere text, principal boolean,
               effectif integer, devoirs integer, encours integer, retard integer,
               pas_ouvert integer, jamais integer, actifs7 integer, pct integer,
               dernier text, dernier_due date,
               gere boolean, createur boolean, etab boolean, attente integer, archivee boolean,
               ouvert boolean, validation boolean, places integer, fin timestamptz,
               code_collegue text, fin_collegue timestamptz)
language sql stable security definer set search_path = '' as $$
  with mes as (
    select c.id, string_agg(distinct t.subject, ' · ') as matiere,
           bool_or(coalesce(t.principal, false)) as principal
    from public.classes c join public.teachings t on t.class_id = c.id
    where t.teacher = auth.uid() and (annee is null or c.year = annee)
    group by c.id
    union
    select c.id, '', true from public.classes c
    where c.owner = auth.uid() and (annee is null or c.year = annee)
      and not exists (select 1 from public.teachings t where t.class_id = c.id and t.teacher = auth.uid())
  )
  select c.id, c.name, c.level, c.cycle, c.filiere, c.year, c.code, nullif(m.matiere, ''), m.principal,
         (select count(*)::integer from public.class_members cm where cm.class_id = c.id),
         (select count(*)::integer from public.assignments a
          where a.class_id = c.id and a.created_by = auth.uid()),
         (select count(*)::integer from public.assignments a
          where a.class_id = c.id and a.created_by = auth.uid()
            and (a.due is null or a.due >= current_date)),
         (select count(*)::integer from public.class_members cm
          where cm.class_id = c.id
            and exists (select 1 from public.assignments a
                        where a.class_id = c.id and a.created_by = auth.uid()
                          and a.due < current_date and a.due >= cm.joined_at::date
                          and not exists (select 1 from public.assignment_progress ap
                                          where ap.assignment_id = a.id and ap.user_id = cm.user_id
                                            and ap.done_at is not null))),
         coalesce(d.pas_ouvert, 0),
         (select count(*)::integer from public.class_members cm
          join auth.users u on u.id = cm.user_id
          where cm.class_id = c.id and u.last_sign_in_at is null),
         (select count(distinct s.user_id)::integer from public.sessions s
          join public.class_members cm on cm.user_id = s.user_id
          where cm.class_id = c.id and s.created_at > now() - interval '7 days'),
         coalesce(d.pct, 0), d.nom, d.due,
         public.class_manager(c.id), c.owner = auth.uid(), c.org_id is not null,
         (select count(*)::integer from public.class_requests r where r.class_id = c.id),
         c.archived_at is not null, c.join_open, c.join_approval, c.places, c.join_until,
         case when c.owner = auth.uid() and c.staff_until > now() then c.staff_code end,
         case when c.owner = auth.uid() and c.staff_until > now() then c.staff_until end
  from mes m join public.classes c on c.id = m.id
  left join lateral (
    select (select count(*)::integer from public.class_members cm
            where cm.class_id = c.id
              and not exists (select 1 from public.assignment_progress ap
                              where ap.assignment_id = a.id and ap.user_id = cm.user_id)) as pas_ouvert,
           (select coalesce(round(avg(ap.pct)), 0)::integer from public.assignment_progress ap
            where ap.assignment_id = a.id and ap.vus > 0) as pct,
           a.name as nom, a.due
    from public.assignments a
    where a.class_id = c.id and a.created_by = auth.uid()
    order by a.created_at desc limit 1
  ) d on true
  where public.my_role() in ('prof', 'ref', 'admin')
  order by c.archived_at is not null, public.niveau_rang(c.cycle, c.level), c.name
$$;

-- Un élève arrivé en mars n'est pas « en retard » sur les devoirs de
-- novembre ; et son activité ne compte que ses devoirs de cette classe —
-- jamais ses livres personnels.
drop function if exists public.prof_roster(uuid);
create function public.prof_roster(cid uuid)
returns table (user_id uuid, who text, handle text,
               rendus integer, donnes integer, pct integer, vu timestamptz,
               jamais boolean, pages7 integer, jours7 integer, retard integer, inscrit timestamptz)
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
         cm.joined_at
  from public.class_members cm
  join public.profiles p on p.id = cm.user_id
  where cm.class_id = cid and public.class_staff(cid)
  order by 2
$$;

create or replace function public.prof_eleve(cid uuid, qui uuid)
returns table (assignment_id uuid, devoir text, matiere text, n integer, due date,
               donne timestamptz, etat text, pct integer, rendu timestamptz, mien boolean)
language sql stable security definer set search_path = '' as $$
  select a.id, a.name, a.subject, a.n, a.due, a.created_at,
         case when ap.done_at is not null then 'rendu'
              when ap.user_id is not null then 'commencé'
              when a.due < current_date then 'non rendu'
              else 'pas ouvert' end,
         coalesce(round(ap.pct), 0)::integer, ap.done_at,
         a.created_by = auth.uid()
  from public.assignments a
  left join public.assignment_progress ap
    on ap.assignment_id = a.id and ap.user_id = qui
  where a.class_id = cid
    and exists (select 1 from public.class_members cm
                where cm.class_id = cid and cm.user_id = qui)
    and public.class_staff(cid)
  order by a.due desc nulls last, a.created_at desc
$$;

create or replace function public.prof_devoirs(cid uuid)
returns table (id uuid, nom text, matiere text, n integer, due date,
               donne timestamptz, mien boolean, auteur text,
               effectif integer, ouvert integer, rendu integer, pct integer)
language sql stable security definer set search_path = '' as $$
  select a.id, a.name, a.subject, a.n, a.due, a.created_at,
         a.created_by = auth.uid(),
         coalesce(nullif(p.name, ''), p.handle, 'un collègue'),
         (select count(*)::integer from public.class_members cm where cm.class_id = cid),
         (select count(*)::integer from public.assignment_progress ap
          join public.class_members cm on cm.user_id = ap.user_id and cm.class_id = cid
          where ap.assignment_id = a.id),
         (select count(*)::integer from public.assignment_progress ap
          join public.class_members cm on cm.user_id = ap.user_id and cm.class_id = cid
          where ap.assignment_id = a.id and ap.done_at is not null),
         (select coalesce(round(avg(ap.pct)), 0)::integer from public.assignment_progress ap
          join public.class_members cm on cm.user_id = ap.user_id and cm.class_id = cid
          where ap.assignment_id = a.id and ap.vus > 0)
  from public.assignments a
  left join public.profiles p on p.id = a.created_by
  where a.class_id = cid and public.class_staff(cid)
  order by a.due desc nulls last, a.created_at desc
$$;

create or replace function public.prof_cartes(aid uuid)
returns table (rang integer, recto text, verso text,
               vues integer, ratees integer, eleves integer)
language sql stable security definer set search_path = '' as $$
  with a as (
    select x.id, x.class_id, x.cards from public.assignments x
    where x.id = aid and public.class_staff(x.class_id)
  ),
  vus as (
    select split_part(r.card_id, ':', 3)::integer as rang,
           count(*)::integer as vues,
           count(*) filter (where not r.correct)::integer as ratees,
           count(distinct r.user_id)::integer as eleves
    from public.reviews r
    join a on true
    join public.class_members cm on cm.user_id = r.user_id and cm.class_id = a.class_id
    where r.card_id like 'a:' || a.id::text || ':%'
      and split_part(r.card_id, ':', 3) ~ '^[0-9]{1,6}$'
    group by 1
  )
  select v.rang,
         coalesce(a.cards -> v.rang ->> 'f', a.cards -> v.rang ->> 0),
         coalesce(a.cards -> v.rang ->> 'b', a.cards -> v.rang ->> 1),
         v.vues, v.ratees, v.eleves
  from vus v join a on true
  where v.ratees > 0
  order by v.ratees desc, v.vues desc
  limit 30
$$;

create or replace function public.prof_assignment_cards(aid uuid)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select x.cards from public.assignments x
  where x.id = aid and public.class_staff(x.class_id)
$$;

-- Une classe archivée ne reçoit plus de devoir.
create or replace function public.prof_give(
  cids uuid[], nom text, matiere text, cartes jsonb, due date)
returns integer language plpgsql security definer set search_path = '' as $$
declare k uuid; n integer := 0; nb integer;
begin
  if nullif(trim(coalesce(nom, '')), '') is null then raise exception 'Il faut un titre'; end if;
  nb := coalesce(jsonb_array_length(cartes), 0);
  if nb = 0 then raise exception 'Il faut au moins une carte'; end if;
  if nb > 300 then raise exception 'Trois cents cartes au maximum pour un devoir'; end if;
  if due is null then raise exception 'Il faut une date de rendu'; end if;
  if due > current_date + 400 then raise exception 'Cette date est trop lointaine'; end if;
  foreach k in array cids loop
    if (public.teaches(k)
        or exists (select 1 from public.classes c where c.id = k and c.owner = auth.uid()))
       and exists (select 1 from public.classes c where c.id = k and c.archived_at is null) then
      insert into public.assignments (class_id, name, cards, n, due, created_by, subject)
      -- `subject` est NOT NULL : l'ancienne version y écrivait NULL quand
      -- la matière était vide, et le devoir était refusé (23502)
      values (k, left(trim(nom), 120), cartes, nb, due, auth.uid(), left(trim(coalesce(matiere, '')), 60));
      n := n + 1;
    end if;
  end loop;
  if n = 0 then raise exception 'Aucune de ces classes n''est la tienne, ou elles sont archivées'; end if;
  return n;
end $$;

-- ── 11. Côté élève ──────────────────────────────────────────────────────
create or replace function public.eleve_classes()
returns table (class_id uuid, nom text, niveau text, etab text, prof text, matieres text,
               effectif integer, statut text, depuis timestamptz, peut_quitter boolean, a_faire integer)
language sql stable security definer set search_path = '' as $$
  select c.id, c.name, coalesce(c.level, ''),
         coalesce((select o.name from public.orgs o where o.id = c.org_id), ''),
         coalesce((select coalesce(nullif(p.name, ''), p.handle) from public.teachings t
                   join public.profiles p on p.id = t.teacher where t.class_id = c.id
                   order by (t.teacher = c.owner) desc, t.principal desc limit 1), ''),
         coalesce((select string_agg(distinct t.subject, ' · ') from public.teachings t where t.class_id = c.id), ''),
         (select count(*)::integer from public.class_members x where x.class_id = c.id),
         'inscrit', cm.joined_at, c.org_id is null,
         (select count(*)::integer from public.assignments a
          where a.class_id = c.id and (a.due is null or a.due >= current_date)
            and not exists (select 1 from public.assignment_progress ap
                            where ap.assignment_id = a.id and ap.user_id = auth.uid() and ap.done_at is not null))
  from public.class_members cm join public.classes c on c.id = cm.class_id
  where cm.user_id = auth.uid() and c.archived_at is null
  union all
  select c.id, c.name, coalesce(c.level, ''),
         coalesce((select o.name from public.orgs o where o.id = c.org_id), ''),
         coalesce((select coalesce(nullif(p.name, ''), p.handle) from public.teachings t
                   join public.profiles p on p.id = t.teacher where t.class_id = c.id
                   order by (t.teacher = c.owner) desc, t.principal desc limit 1), ''),
         '', 0, 'attente', r.created_at, false, 0
  from public.class_requests r join public.classes c on c.id = r.class_id
  where r.user_id = auth.uid()
  order by 8 desc, 2
$$;

create or replace function public.eleve_devoirs()
returns table (id uuid, class_id uuid, classe text, nom text, matiere text, n integer, due date,
               donne timestamptz, etat text, pct integer, vus integer)
language sql stable security definer set search_path = '' as $$
  select a.id, c.id, c.name, a.name, coalesce(a.subject, ''), a.n, a.due, a.created_at,
         case when ap.done_at is not null then 'rendu'
              when ap.user_id is not null then 'commence'
              else 'a_faire' end,
         coalesce(round(ap.pct), 0)::integer, coalesce(ap.vus, 0)
  from public.class_members cm
  join public.classes c on c.id = cm.class_id
  join public.assignments a on a.class_id = c.id
  left join public.assignment_progress ap on ap.assignment_id = a.id and ap.user_id = auth.uid()
  where cm.user_id = auth.uid() and c.archived_at is null
  order by (ap.done_at is not null), a.due nulls last, a.created_at desc
  limit 200
$$;

-- Ouvrir un devoir : la base note qu'il est ouvert, et rend ses cartes.
create or replace function public.eleve_ouvrir_devoir(aid uuid)
returns table (nom text, matiere text, cartes jsonb)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
begin
  if not exists (select 1 from public.assignments a
                 join public.class_members cm on cm.class_id = a.class_id and cm.user_id = auth.uid()
                 where a.id = aid) then
    raise exception 'Ce devoir n''est pas pour toi';
  end if;
  insert into public.assignment_progress (assignment_id, user_id, who, pct)
  values (aid, auth.uid(),
          coalesce((select coalesce(nullif(p.name, ''), p.handle) from public.profiles p where p.id = auth.uid()), ''), 0)
  on conflict do nothing;
  return query select a.name, coalesce(a.subject, ''), a.cards from public.assignments a where a.id = aid;
end $$;

create or replace function public.eleve_quitter(cid uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.class_members m where m.class_id = cid and m.user_id = auth.uid()) then
    raise exception 'Tu n''es pas dans cette classe';
  end if;
  if exists (select 1 from public.classes c where c.id = cid and c.org_id is not null) then
    raise exception 'C''est ton établissement qui t''a inscrit dans cette classe : lui seul peut t''en retirer';
  end if;
  delete from public.assignment_progress ap using public.assignments a
  where a.id = ap.assignment_id and a.class_id = cid and ap.user_id = auth.uid();
  delete from public.class_members m where m.class_id = cid and m.user_id = auth.uid();
end $$;

create or replace function public.eleve_annuler(cid uuid)
returns void language sql security definer set search_path = '' as $$
  delete from public.class_requests r where r.class_id = cid and r.user_id = auth.uid()
$$;

-- ── 12. L'avancement, calculé par la base ───────────────────────────────
-- Chaque carte d'un devoir garde chez l'élève l'identifiant
-- « a:<devoir>:<rang> ». Une révision de cette carte met à jour son
-- avancement : vu = cartes revues au moins une fois, réussite = cartes dont
-- la DERNIÈRE réponse est juste, rendu = toutes les cartes revues. Personne
-- ne peut plus l'écrire à la main.
create or replace function public.avancement_devoir()
returns trigger language plpgsql security definer set search_path = '' as $$
declare aid uuid; a record; nvus integer; npct real;
begin
  if new.card_id !~ '^a:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:[0-9]+$' then
    return new;
  end if;
  begin
    aid := split_part(new.card_id, ':', 2)::uuid;
    select x.id, x.n into a from public.assignments x
    where x.id = aid
      and exists (select 1 from public.class_members cm
                  where cm.class_id = x.class_id and cm.user_id = new.user_id);
    if a.id is null then return new; end if;
    select count(*)::integer, coalesce(avg(case when l.correct then 100 else 0 end), 0)
      into nvus, npct
    from (select distinct on (r.card_id) r.card_id, r.correct
          from public.reviews r
          where r.user_id = new.user_id and r.card_id like 'a:' || aid::text || ':%'
            -- le CASE garantit l'ordre : un AND laisserait Postgres convertir
            -- en entier avant d'avoir vérifié que ce sont bien des chiffres
            and case when split_part(r.card_id, ':', 3) ~ '^[0-9]{1,6}$'
                     then split_part(r.card_id, ':', 3)::integer end < a.n
          order by r.card_id, r.created_at desc, r.id desc) l;
    insert into public.assignment_progress (assignment_id, user_id, who, pct, vus, done_at)
    values (aid, new.user_id,
            coalesce((select coalesce(nullif(p.name, ''), p.handle) from public.profiles p where p.id = new.user_id), ''),
            npct, nvus, case when nvus >= a.n then now() end)
    on conflict (assignment_id, user_id) do update set
      pct = excluded.pct, vus = excluded.vus,
      done_at = coalesce(public.assignment_progress.done_at, excluded.done_at);
  exception when others then
    -- Un compteur de suivi ne doit jamais bloquer le journal de l'élève :
    -- refuser la ligne arrêterait toute sa file hors ligne. L'avertissement
    -- (code d'erreur seul, aucune donnée de l'élève) reste dans le journal
    -- Postgres.
    raise warning 'avancement_devoir : %', sqlstate;
  end;
  return new;
end $$;

drop trigger if exists avancement_devoir on public.reviews;
create trigger avancement_devoir after insert on public.reviews
  for each row execute function public.avancement_devoir();

create index if not exists reviews_devoir on public.reviews (user_id, card_id) where card_id like 'a:%';

-- ── 13. Les droits ──────────────────────────────────────────────────────
-- Internes : appelées seulement par les fonctions ci-dessus.
revoke all on function public.code_classe() from public, anon, authenticated;
revoke all on function public.class_trop_essais() from public, anon, authenticated;
revoke all on function public.class_verdict(text) from public, anon, authenticated;
revoke all on function public.class_fiche(uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.avancement_devoir() from public, anon, authenticated;

do $$
declare f text;
begin
  foreach f in array array[
    'public.class_staff(uuid)', 'public.class_manager(uuid)', 'public.class_owner_or_ref(uuid)',
    'public.class_preview(text)', 'public.class_join(text)', 'public.join_class(text, text)',
    'public.prof_demandes(uuid)', 'public.prof_admettre(uuid, uuid[])',
    'public.prof_refuser(uuid, uuid[], boolean)', 'public.prof_retirer(uuid, uuid, boolean)',
    'public.prof_exclus(uuid)', 'public.prof_reintegrer(uuid, uuid)',
    'public.prof_renommer_eleve(uuid, uuid, text)',
    'public.prof_reglages(uuid, boolean, boolean, integer, integer)', 'public.prof_nouveau_code(uuid)',
    'public.prof_creer_classe(text, text, text)', 'public.prof_modifier_classe(uuid, text, text)',
    'public.prof_archiver(uuid, boolean)', 'public.prof_supprimer_classe(uuid, text)',
    'public.prof_code_collegue(uuid, boolean)', 'public.prof_equipe(uuid)',
    'public.prof_retirer_collegue(uuid, uuid)', 'public.prof_quitter(uuid)',
    'public.prof_message_classe(uuid, text)', 'public.prof_classes(text)', 'public.prof_roster(uuid)',
    'public.prof_eleve(uuid, uuid)', 'public.prof_devoirs(uuid)', 'public.prof_cartes(uuid)',
    'public.prof_assignment_cards(uuid)', 'public.prof_give(uuid[], text, text, jsonb, date)',
    'public.eleve_classes()', 'public.eleve_devoirs()', 'public.eleve_ouvrir_devoir(uuid)',
    'public.eleve_quitter(uuid)', 'public.eleve_annuler(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
