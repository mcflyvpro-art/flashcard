-- ══════════ un seul code (2026-10-26) ══════════
-- Retour sur la version de la veille (20261025233000, avec des demandes à
-- valider une par une) : une seule manière d'entrer. L'élève a UN code —
-- celui de son établissement, ou celui de son professeur particulier — il le
-- tape, donne son prénom et son nom, choisit sa classe dans la liste : c'est
-- fait. La sécurité est dans le code (8 caractères tirés au hasard, 10 faux
-- par heure, changeable à tout moment par qui le distribue), pas dans une
-- file d'attente que personne ne veut tenir à la rentrée.
--
-- Plus de code par classe pour les élèves : une classe a dix matières, dix
-- codes seraient ingérables. Dans un établissement, chaque élève a UNE
-- classe (la même pour tous ses camarades : classes.genre = 'classe') ; les
-- professeurs y choisissent les classes qu'ils ont, et forment des groupes
-- (genre 'groupe') en sélectionnant des élèves. Un professeur particulier a
-- son code ; ses élèves choisissent une de ses classes. Un élève peut être
-- dans un établissement ET chez des professeurs particuliers.
--
-- Le nom « Prénom NOM » est figé à l'entrée : seul le référent le corrige
-- (lock_identite_scolaire, ref_update_account).
--
-- Et le côté vente, pour l'éditeur seul : le suivi d'un établissement, de la
-- demande de démo au client (org_suivi), la démo lancée en un geste
-- (licence de 30 jours, classes d'exemple), le formulaire public « Demander
-- une démo » (demander_demo, ouvert sans compte, limité).

-- ── 1. Plus de demandes : le code suffit ────────────────────────────────
drop function if exists public.ref_admettre(uuid, uuid);
drop function if exists public.ref_refuser(uuid);
drop function if exists public.ref_demandes();
drop function if exists public.ma_demande_etab();
drop function if exists public.etab_annuler();
drop function if exists public.etab_demander(text, text, text, text);
drop function if exists public.admin_orgs();
drop function if exists public.admin_creer_etab(text, text, text, text, integer, date, text);
drop table if exists public.etab_demandes;

-- ── 2. La licence : démo ou établissement ───────────────────────────────
alter table public.orgs drop constraint if exists orgs_offre_check;
update public.orgs set offre = 'demo' where offre = 'essai';
alter table public.orgs alter column offre set default 'demo';
alter table public.orgs add constraint orgs_offre_check check (offre in ('demo', 'etablissement'));
-- Des classes d'exemple à poser quand le référent arrive (démo).
alter table public.orgs add column if not exists exemples boolean not null default false;

-- ── 3. Une classe, ou un groupe ─────────────────────────────────────────
alter table public.classes add column if not exists genre text not null default 'classe';
alter table public.classes drop constraint if exists classes_genre_check;
alter table public.classes add constraint classes_genre_check check (genre in ('classe', 'groupe'));
create index if not exists classes_org on public.classes (org_id) where org_id is not null;

-- ── 4. Le code d'un professeur particulier ──────────────────────────────
create table if not exists public.codes_profs (
  prof uuid primary key references auth.users(id) on delete cascade,
  code text not null unique,
  maj  timestamptz not null default now()
);
alter table public.codes_profs enable row level security;
-- Aucune politique : seules les fonctions ci-dessous le lisent.

-- ── 5. Le suivi commercial (l'éditeur seul) ─────────────────────────────
-- À part de `orgs`, que tout membre d'un établissement lit : un référent n'a
-- pas à lire le budget qu'on a noté pour lui, ni nos notes.
create table if not exists public.org_suivi (
  org_id           uuid primary key references public.orgs(id) on delete cascade,
  statut           text not null default 'prospect' check (statut in ('prospect', 'demo', 'client', 'pause', 'perdu')),
  source           text not null default 'editeur' check (source in ('editeur', 'demande')),
  contact_nom      text not null default '' check (length(contact_nom) <= 80),
  contact_fonction text not null default '' check (length(contact_fonction) <= 80),
  contact_email    text not null default '' check (length(contact_email) <= 120),
  contact_tel      text not null default '' check (length(contact_tel) <= 30),
  eleves_estimes   integer check (eleves_estimes is null or eleves_estimes between 0 and 100000),
  budget_euros     integer check (budget_euros is null or budget_euros between 0 and 10000000),
  prix_euros       integer check (prix_euros is null or prix_euros between 0 and 10000000),
  besoins          text[] not null default '{}',
  message          text not null default '' check (length(message) <= 2000),
  notes            text not null default '' check (length(notes) <= 4000),
  relance          date,
  cree             timestamptz not null default now(),
  maj              timestamptz not null default now()
);
alter table public.org_suivi enable row level security;
-- Aucune politique : l'éditeur passe par admin_orgs / admin_etab_enregistrer.

-- ── 6. Les outils internes ──────────────────────────────────────────────
create or replace function public.code_unique()
returns text language plpgsql volatile security definer set search_path to '' as $$
declare s text;
begin
  loop
    s := public.code_classe();
    exit when not exists (select 1 from public.org_codes c where s in (c.eleve, c.prof, c.ref))
          and not exists (select 1 from public.codes_profs p where p.code = s);
  end loop;
  return s;
end $$;

-- Le préfixe des identifiants lisibles d'un établissement (A, J2…).
create or replace function public.org_prefixe(nom text)
returns text language plpgsql stable security definer set search_path to '' as $$
declare base text; c text; n integer := 1;
begin
  base := upper(left(regexp_replace(translate(trim(coalesce(nom, '')), 'ÀÂÄÉÈÊËÎÏÔÖÙÛÜÇàâäéèêëîïôöùûüç',
                                    'AAAEEEEIIOOUUUCaaaeeeeiioouuuc'), '[^A-Za-z]', '', 'g'), 1));
  if base = '' then base := 'E'; end if;
  c := base;
  while exists (select 1 from public.orgs x where x.code = c) loop n := n + 1; c := base || n; end loop;
  return c;
end $$;

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
  if quel = 'eleve' and x.places is not null and public.etab_eleves(o) >= x.places then return 'plein'; end if;
  return 'ok';
end $$;

create or replace function public.prof_verdict(p uuid)
returns text language plpgsql stable security definer set search_path to '' as $$
declare moi uuid := auth.uid();
begin
  if p = moi then return 'soi'; end if;
  if exists (select 1 from public.comptes_geres g where g.user_id = moi) then return 'gere'; end if;
  if public.my_role() <> 'eleve' then return 'role'; end if;
  if exists (select 1 from public.class_members m join public.classes c on c.id = m.class_id
             where m.user_id = moi and c.owner = p and c.org_id is null and c.archived_at is null) then
    return 'deja';
  end if;
  return 'ok';
end $$;

-- Les classes d'exemple d'une démo, posées à l'arrivée du référent.
create or replace function public.poser_exemples(o uuid, ref uuid)
returns void language plpgsql security definer set search_path to '' as $$
declare an text;
begin
  if not (select exemples from public.orgs where id = o)
     or exists (select 1 from public.classes c where c.org_id = o) then return; end if;
  an := case when extract(month from current_date) >= 8
             then extract(year from current_date)::text || '-' || (extract(year from current_date) + 1)::text
             else (extract(year from current_date) - 1)::text || '-' || extract(year from current_date)::text end;
  insert into public.classes (name, level, cycle, year, code, owner, org_id, genre)
  select x.nom, x.niveau, x.cycle, an, public.code_classe(), ref, o, 'classe'
  from (values ('2nde A — exemple', '2nde', 'lycee_gt'), ('1re B — exemple', '1re', 'lycee_gt'),
               ('Tle C — exemple', 'Tle', 'lycee_gt')) x(nom, niveau, cycle);
end $$;

revoke all on function public.code_unique() from public, anon, authenticated;
revoke all on function public.org_prefixe(text) from public, anon, authenticated;
revoke all on function public.etab_verdict(uuid, text) from public, anon, authenticated;
revoke all on function public.prof_verdict(uuid) from public, anon, authenticated;
revoke all on function public.poser_exemples(uuid, uuid) from public, anon, authenticated;

-- ── 7. « J'ai un code » : voir, puis entrer ─────────────────────────────
-- Un code d'établissement : son nom, le rôle qu'il donne, et pour un élève
-- la liste des classes. Un code de professeur particulier : son nom et ses
-- classes. Sinon, l'ancien code d'une classe (les liens déjà distribués
-- continuent de marcher). L'essai est compté une seule fois.
create or replace function public.code_apercu(code text)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  moi uuid := auth.uid();
  k text := upper(regexp_replace(coalesce(code, ''), '[^A-Za-z0-9]', '', 'g'));
  e record; x public.orgs%rowtype; p uuid; s text;
begin
  if moi is null then return jsonb_build_object('type', 'etab', 'statut', 'connexion'); end if;
  if public.class_trop_essais() then return jsonb_build_object('type', 'etab', 'statut', 'trop'); end if;
  select * into e from public.etab_du_code(k);
  if e.o_org is not null then
    insert into public.class_join_attempts (user_id, ok) values (moi, true);
    select * into x from public.orgs where id = e.o_org;
    s := public.etab_verdict(e.o_org, e.o_quel);
    return jsonb_build_object('type', 'etab', 'statut', s, 'quel', e.o_quel,
      'nom', x.name, 'ville', x.ville, 'genre', x.kind,
      'classes', case when e.o_quel = 'eleve' and s = 'ok' then coalesce((
        select jsonb_agg(jsonb_build_object('id', c.id, 'nom', c.name, 'niveau', coalesce(c.level, ''))
                         order by public.niveau_rang(c.cycle, c.level), c.name)
        from public.classes c where c.org_id = x.id and c.genre = 'classe' and c.archived_at is null), '[]'::jsonb)
        else '[]'::jsonb end);
  end if;
  select cp.prof into p from public.codes_profs cp where length(k) = 8 and cp.code = k;
  if p is not null then
    insert into public.class_join_attempts (user_id, ok) values (moi, true);
    s := public.prof_verdict(p);
    return jsonb_build_object('type', 'prof', 'statut', s,
      'nom', (select coalesce(nullif(pr.name, ''), pr.handle, 'Professeur') from public.profiles pr where pr.id = p),
      'classes', case when s = 'ok' then coalesce((
        select jsonb_agg(jsonb_build_object('id', c.id, 'nom', c.name, 'niveau', coalesce(c.level, '')) order by c.name)
        from public.classes c where c.owner = p and c.org_id is null and c.archived_at is null), '[]'::jsonb)
        else '[]'::jsonb end);
  end if;
  return jsonb_build_object('type', 'classe',
    'fiche', (select to_jsonb(f) from public.class_preview(code) f limit 1));
end $$;

create or replace function public.rejoindre(code text, son_prenom text, son_nom text, classe uuid default null)
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

  -- ── un établissement ──
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
    -- Le nom d'abord : une fois dans l'établissement, il est verrouillé.
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

  -- ── un professeur particulier ──
  if classe is not null then
    select * into c from public.classes cl
    where cl.id = classe and cl.owner = p and cl.org_id is null and cl.archived_at is null;
    if c.id is null then return jsonb_build_object('statut', 'classe'); end if;
  else
    select count(*) into n from public.classes cl where cl.owner = p and cl.org_id is null and cl.archived_at is null;
    if n > 1 then return jsonb_build_object('statut', 'choisir'); end if;
    select * into c from public.classes cl where cl.owner = p and cl.org_id is null and cl.archived_at is null limit 1;
    if c.id is null then
      -- Son premier élève : une classe « Mes élèves » l'attend, qu'il renommera.
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
  if (select count(*) from public.class_members m where m.class_id = c.id) >= c.places then
    return jsonb_build_object('statut', 'complet');
  end if;
  insert into public.class_members (class_id, user_id, who) values (c.id, moi, nom) on conflict do nothing;
  return jsonb_build_object('statut', 'ok', 'type', 'prof', 'classe', c.name,
    'nom', (select coalesce(nullif(pr.name, ''), pr.handle, 'Professeur') from public.profiles pr where pr.id = p));
end $$;

-- ── 8. L'élève : ses classes (et ses groupes) ───────────────────────────
-- Le type de retour gagne `genre` : l'app distingue sa classe de ses groupes.
drop function if exists public.eleve_classes();
create function public.eleve_classes()
returns table (class_id uuid, nom text, niveau text, etab text, prof text, matieres text, effectif integer,
               statut text, depuis timestamptz, peut_quitter boolean, a_faire integer, genre text)
language sql stable security definer set search_path to '' as $$
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
                            where ap.assignment_id = a.id and ap.user_id = auth.uid() and ap.done_at is not null)),
         c.genre
  from public.class_members cm join public.classes c on c.id = cm.class_id
  where cm.user_id = auth.uid() and c.archived_at is null
  union all
  select c.id, c.name, coalesce(c.level, ''),
         coalesce((select o.name from public.orgs o where o.id = c.org_id), ''),
         coalesce((select coalesce(nullif(p.name, ''), p.handle) from public.teachings t
                   join public.profiles p on p.id = t.teacher where t.class_id = c.id
                   order by (t.teacher = c.owner) desc, t.principal desc limit 1), ''),
         '', 0, 'attente', r.created_at, false, 0, c.genre
  from public.class_requests r join public.classes c on c.id = r.class_id
  where r.user_id = auth.uid()
  order by 8 desc, 2
$$;

-- Sa classe d'abord, pas un groupe pris au hasard.
create or replace function public.my_school()
returns table (org_id uuid, org text, org_kind text, ville text, class_id uuid, classe text, niveau text,
               filiere text, cycle text, effectif integer, role text)
language sql stable security definer set search_path to '' as $$
  select o.id, o.name, o.kind, o.ville,
         c.id, c.name, c.level, c.filiere, c.cycle,
         (select count(*)::integer from public.class_members m where m.class_id = c.id),
         public.my_role()
  from public.org_members om
  join public.orgs o on o.id = om.org_id
  left join public.class_members cm on cm.user_id = om.user_id
       and exists (select 1 from public.classes k where k.id = cm.class_id and k.org_id = o.id)
  left join public.classes c on c.id = cm.class_id
  where om.user_id = auth.uid()
  order by (c.genre = 'classe') desc nulls last, c.created_at nulls last
  limit 1
$$;

-- ── 9. Le professeur d'un établissement : ses classes, ses groupes ──────
create or replace function public.prof_classes_etab()
returns table (id uuid, nom text, niveau text, effectif integer, enseigne boolean, matiere text)
language sql stable security definer set search_path to '' as $$
  select c.id, c.name, coalesce(c.level, ''),
         (select count(*)::integer from public.class_members m where m.class_id = c.id),
         exists (select 1 from public.teachings t where t.class_id = c.id and t.teacher = auth.uid()),
         coalesce((select t.subject from public.teachings t where t.class_id = c.id and t.teacher = auth.uid() limit 1), '')
  from public.classes c
  where public.my_role() = 'prof' and public.my_org() is not null
    and c.org_id = public.my_org() and c.genre = 'classe' and c.archived_at is null
  order by public.niveau_rang(c.cycle, c.level), c.name
$$;

create or replace function public.prof_enseigner(cid uuid, oui boolean, matiere text default '')
returns void language plpgsql security definer set search_path to '' as $$
declare o uuid := public.my_org(); mat text;
begin
  if public.my_role() <> 'prof' or o is null then raise exception 'Réservé aux professeurs d''un établissement'; end if;
  if not exists (select 1 from public.classes c where c.id = cid and c.org_id = o and c.genre = 'classe'
                 and c.archived_at is null) then
    raise exception 'Cette classe n''est pas dans ton établissement';
  end if;
  if oui then
    mat := left(coalesce(nullif(trim(coalesce(matiere, '')), ''),
                         nullif((select m.subject from public.org_members m where m.user_id = auth.uid()), ''), 'Cours'), 60);
    insert into public.teachings (class_id, teacher, subject, principal) values (cid, auth.uid(), mat, false)
      on conflict do nothing;
  else
    delete from public.teachings t where t.class_id = cid and t.teacher = auth.uid();
  end if;
end $$;

-- Les élèves de l'établissement, pour former un groupe : nom et classe.
create or replace function public.prof_eleves_etab(q text default '', cid uuid default null)
returns table (id uuid, nom text, classe text, classe_id uuid)
language sql stable security definer set search_path to '' as $$
  select m.user_id, coalesce(nullif(p.name, ''), p.handle, 'Élève'), coalesce(c.name, ''), c.id
  from public.org_members m
  join public.profiles p on p.id = m.user_id
  left join public.class_members cm on cm.user_id = m.user_id
       and exists (select 1 from public.classes k where k.id = cm.class_id and k.genre = 'classe' and k.org_id = m.org_id)
  left join public.classes c on c.id = cm.class_id
  where public.my_role() = 'prof' and m.org_id = public.my_org()
    and coalesce((select r.role from public.user_roles r where r.user_id = m.user_id), 'eleve') = 'eleve'
    and (cid is null or c.id = cid)
    and (coalesce(q, '') = '' or public.cle_nom(coalesce(p.name, '')) like '%' || public.cle_nom(q) || '%')
  order by c.name nulls last, p.name
  limit 400
$$;

-- Un groupe : des élèves choisis, de toutes classes, sous un nom.
create or replace function public.prof_groupe(nom text, eleves uuid[], gid uuid default null, matiere text default '')
returns uuid language plpgsql security definer set search_path to '' as $$
declare o uuid := public.my_org(); g uuid := gid; mat text;
begin
  if public.my_role() <> 'prof' or o is null then raise exception 'Réservé aux professeurs d''un établissement'; end if;
  if length(trim(coalesce(nom, ''))) not between 1 and 60 then raise exception 'Un nom de groupe de 1 à 60 caractères'; end if;
  if coalesce(array_length(eleves, 1), 0) > 300 then raise exception 'Trois cents élèves au plus'; end if;
  if g is null then
    mat := left(coalesce(nullif(trim(coalesce(matiere, '')), ''),
                         nullif((select m.subject from public.org_members m where m.user_id = auth.uid()), ''), 'Cours'), 60);
    insert into public.classes (name, level, year, code, owner, org_id, genre, join_open)
    values (trim(nom), '',
            case when extract(month from current_date) >= 8
                 then extract(year from current_date)::text || '-' || (extract(year from current_date) + 1)::text
                 else (extract(year from current_date) - 1)::text || '-' || extract(year from current_date)::text end,
            public.code_classe(), auth.uid(), o, 'groupe', false)
    returning id into g;
    insert into public.teachings (class_id, teacher, subject, principal) values (g, auth.uid(), mat, true);
  else
    if not exists (select 1 from public.classes c where c.id = g and c.genre = 'groupe' and c.org_id = o
                   and public.class_manager(c.id)) then
      raise exception 'Ce groupe n''est pas à toi';
    end if;
    update public.classes set name = trim(nom) where id = g;
    delete from public.class_members m where m.class_id = g and not (m.user_id = any(coalesce(eleves, '{}')));
  end if;
  insert into public.class_members (class_id, user_id, who)
  select g, m.user_id, coalesce(nullif(p.name, ''), p.handle, 'Élève')
  from public.org_members m join public.profiles p on p.id = m.user_id
  where m.org_id = o and m.user_id = any(coalesce(eleves, '{}'))
    and coalesce((select r.role from public.user_roles r where r.user_id = m.user_id), 'eleve') = 'eleve'
  on conflict do nothing;
  return g;
end $$;

-- ── 10. Le professeur particulier : son code ────────────────────────────
create or replace function public.prof_mon_code(nouveau boolean default false)
returns text language plpgsql security definer set search_path to '' as $$
declare s text;
begin
  if public.my_role() <> 'prof' or public.my_org() is not null then
    raise exception 'Réservé aux professeurs hors établissement';
  end if;
  select code into s from public.codes_profs where prof = auth.uid();
  if s is null or nouveau then
    s := public.code_unique();
    insert into public.codes_profs (prof, code) values (auth.uid(), s)
      on conflict (prof) do update set code = excluded.code, maj = now();
  end if;
  return s;
end $$;

-- Ranger un de ses élèves dans une autre de ses classes (il y reste aussi
-- dans la première : un élève peut suivre deux cours chez le même professeur).
create or replace function public.prof_ajouter_eleve(cid uuid, qui uuid)
returns void language plpgsql security definer set search_path to '' as $$
declare w text;
begin
  if not exists (select 1 from public.classes c where c.id = cid and c.owner = auth.uid() and c.org_id is null
                 and c.archived_at is null) then
    raise exception 'Cette classe n''est pas à toi';
  end if;
  select m.who into w from public.class_members m join public.classes c on c.id = m.class_id
  where m.user_id = qui and c.owner = auth.uid() and c.org_id is null limit 1;
  if w is null then raise exception 'Ce compte n''est pas un de tes élèves'; end if;
  insert into public.class_members (class_id, user_id, who) values (cid, qui, w) on conflict do nothing;
end $$;

-- ── 11. Le référent ─────────────────────────────────────────────────────
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
    'profs', (select count(*) from public.org_members m join public.user_roles r on r.user_id = m.user_id
              where m.org_id = o and r.role = 'prof'));
end $$;

-- Changer un élève de classe ne touche que sa classe, jamais ses groupes.
create or replace function public.ref_move_student(cible uuid, vers uuid default null)
returns void language plpgsql security definer set search_path to '' as $$
declare qui text; avant text;
begin
  perform public.ref_garde(cible);
  if vers is not null and not exists (select 1 from public.classes c where c.id = vers
       and c.org_id = public.my_org() and c.genre = 'classe') then
    raise exception 'Cette classe n''est pas dans ton établissement';
  end if;
  select string_agg(c.name, ', ') into avant
    from public.class_members cm join public.classes c on c.id = cm.class_id
    where cm.user_id = cible and c.org_id = public.my_org() and c.genre = 'classe';
  delete from public.class_members cm using public.classes c
    where c.id = cm.class_id and cm.user_id = cible and c.org_id = public.my_org() and c.genre = 'classe';
  if vers is not null then
    select coalesce(nullif(name, ''), handle, email) into qui from public.profiles where id = cible;
    insert into public.class_members (class_id, user_id, who) values (vers, cible, qui) on conflict do nothing;
  end if;
  perform public.ref_trace(cible, case when vers is null then 'retiré de sa classe' else 'changé de classe' end,
    jsonb_build_object('avant', avant, 'apres', (select name from public.classes where id = vers)));
end $$;

drop function if exists public.ref_classes();
create function public.ref_classes()
returns table (id uuid, name text, niveau text, cycle text, filiere text, code text, annee text, effectif integer,
               prevu integer, profs integer, pp text, devoirs integer, actifs7 integer, genre text)
language sql stable security definer set search_path to '' as $$
  select c.id, c.name, c.level, c.cycle, c.filiere, c.code, c.year,
    (select count(*)::integer from public.class_members cm where cm.class_id = c.id),
    c.effectif,
    (select count(distinct t.teacher)::integer from public.teachings t where t.class_id = c.id),
    (select coalesce(nullif(p.name, ''), p.handle) from public.teachings t
     join public.profiles p on p.id = t.teacher where t.class_id = c.id and t.principal limit 1),
    (select count(*)::integer from public.assignments a where a.class_id = c.id),
    (select count(distinct s.user_id)::integer from public.sessions s
     join public.class_members cm on cm.user_id = s.user_id
     where cm.class_id = c.id and s.created_at > now() - interval '7 days'),
    c.genre
  from public.classes c
  where public.is_ref() and c.org_id = public.my_org() and c.archived_at is null
  order by (c.genre = 'classe') desc, public.niveau_rang(c.cycle, c.level), c.name
$$;

-- ── 12. L'éditeur : du prospect au client ───────────────────────────────
-- Une seule porte pour la fiche (le formulaire) : créer ou mettre à jour.
create or replace function public.admin_etab_enregistrer(org uuid default null, fiche jsonb default '{}')
returns uuid language plpgsql security definer set search_path to '' as $$
declare
  o uuid := org; nom text := trim(coalesce(fiche->>'nom', ''));
  u text := upper(trim(coalesce(fiche->>'uai', '')));
  g text := coalesce(nullif(fiche->>'genre', ''), 'lycee');
  st text := coalesce(nullif(fiche->>'statut', ''), 'prospect');
  ml text := lower(trim(coalesce(fiche->>'contact_email', '')));
begin
  if not public.is_admin() then raise exception 'Réservé à l''éditeur'; end if;
  if length(nom) not between 2 and 120 then raise exception 'Un nom de 2 à 120 caractères'; end if;
  if u <> '' and u !~ '^[0-9]{7}[A-Z]$' then raise exception 'L''UAI s''écrit 7 chiffres et une lettre'; end if;
  if g not in ('college', 'lycee', 'lycee_pro', 'sup', 'autre') then raise exception 'Type inconnu'; end if;
  if st not in ('prospect', 'demo', 'client', 'pause', 'perdu') then raise exception 'Étape inconnue'; end if;
  if ml <> '' and ml !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'Adresse e-mail invalide'; end if;
  if o is null then
    insert into public.orgs (code, name, kind, ville, uai, offre)
    values (public.org_prefixe(nom), nom, g, left(trim(coalesce(fiche->>'ville', '')), 80), u, 'demo')
    returning id into o;
    insert into public.org_suivi (org_id) values (o);
  else
    update public.orgs set name = nom, kind = g, ville = left(trim(coalesce(fiche->>'ville', '')), 80), uai = u
    where id = o;
    if not found then raise exception 'Établissement inconnu'; end if;
    insert into public.org_suivi (org_id) values (o) on conflict do nothing;
  end if;
  update public.org_suivi set
    statut = st,
    contact_nom = left(trim(coalesce(fiche->>'contact_nom', '')), 80),
    contact_fonction = left(trim(coalesce(fiche->>'contact_fonction', '')), 80),
    contact_email = left(ml, 120),
    contact_tel = left(trim(coalesce(fiche->>'contact_tel', '')), 30),
    eleves_estimes = nullif(fiche->>'eleves_estimes', '')::integer,
    budget_euros = nullif(fiche->>'budget_euros', '')::integer,
    prix_euros = nullif(fiche->>'prix_euros', '')::integer,
    besoins = coalesce((select array_agg(left(b, 40)) from jsonb_array_elements_text(
                coalesce(fiche->'besoins', '[]'::jsonb)) b), '{}'),
    notes = left(coalesce(fiche->>'notes', ''), 4000),
    relance = nullif(fiche->>'relance', '')::date,
    maj = now()
  where org_id = o;
  return o;
end $$;

-- La démo en un geste : licence de `jours` jours pour `places` élèves, les
-- codes, le code référent à transmettre, et des classes d'exemple qui
-- apparaîtront quand le référent arrivera.
create or replace function public.admin_lancer_demo(org uuid, places integer default 60, jours integer default 30,
                                                    exemples boolean default true)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare r text := public.code_unique(); fin date := current_date + greatest(1, least(jours, 365));
begin
  if not public.is_admin() then raise exception 'Réservé à l''éditeur'; end if;
  if places is not null and places not between 1 and 100000 then raise exception 'Nombre de places impossible'; end if;
  update public.orgs set offre = 'demo', places = admin_lancer_demo.places, licence_fin = fin,
                         exemples = admin_lancer_demo.exemples
  where id = org;
  if not found then raise exception 'Établissement inconnu'; end if;
  insert into public.org_codes (org_id, eleve, prof, ref, ref_fin)
  values (org, public.code_unique(), public.code_unique(), r, now() + interval '30 days')
  on conflict (org_id) do update set ref = r, ref_fin = now() + interval '30 days',
    eleve = coalesce(org_codes.eleve, public.code_unique()),
    prof = coalesce(org_codes.prof, public.code_unique()), maj = now();
  insert into public.org_suivi (org_id, statut) values (org, 'demo')
  on conflict (org_id) do update set statut = 'demo', maj = now();
  return jsonb_build_object('code_ref', r, 'ref_fin', now() + interval '30 days', 'fin', fin);
end $$;

-- La licence : places, date de fin, démo ou établissement. Passer en
-- licence fait du prospect un client.
create or replace function public.admin_licence(org uuid, places integer, fin date, offre text)
returns void language plpgsql security definer set search_path to '' as $$
begin
  if not public.is_admin() then raise exception 'Réservé à l''éditeur'; end if;
  if offre not in ('demo', 'etablissement') then raise exception 'Offre inconnue'; end if;
  if places is not null and places not between 0 and 100000 then raise exception 'Nombre de places impossible'; end if;
  update public.orgs set places = admin_licence.places, licence_fin = fin, offre = admin_licence.offre where id = org;
  if not found then raise exception 'Établissement inconnu'; end if;
  insert into public.org_codes (org_id, eleve, prof) values (org, public.code_unique(), public.code_unique())
  on conflict do nothing;
  if offre = 'etablissement' then
    insert into public.org_suivi (org_id, statut) values (org, 'client')
    on conflict (org_id) do update set statut = 'client', maj = now();
  end if;
end $$;

-- Effacer un établissement qui n'a personne dedans (un prospect, une démo
-- jamais ouverte) : sa fiche et le contact s'en vont avec (RGPD).
create or replace function public.admin_supprimer_etab(org uuid)
returns void language plpgsql security definer set search_path to '' as $$
begin
  if not public.is_admin() then raise exception 'Réservé à l''éditeur'; end if;
  if exists (select 1 from public.org_members m where m.org_id = org) then
    raise exception 'Des comptes y sont encore : passe-le plutôt en « perdu » ou en pause';
  end if;
  delete from public.orgs where id = org;
  if not found then raise exception 'Établissement inconnu'; end if;
end $$;

create or replace function public.admin_orgs()
returns table (id uuid, code text, name text, kind text, ville text, uai text,
               classes integer, eleves integer, profs integer, refs integer,
               devoirs integer, actifs7 integer, actifs30 integer,
               jamais_venus integer, cents_mois numeric, cents_total numeric,
               ouvert timestamptz, offre text, places integer, licence_fin date,
               code_ref text, code_ref_fin timestamptz, code_eleve text, code_prof text,
               statut text, source text, contact_nom text, contact_fonction text, contact_email text,
               contact_tel text, eleves_estimes integer, budget_euros integer, prix_euros integer,
               besoins text[], message text, notes text, relance date, suivi_maj timestamptz)
language sql stable security definer set search_path to '' as $$
  select o.id, o.code, o.name, o.kind, o.ville, o.uai,
    (select count(*)::integer from public.classes c where c.org_id = o.id and c.archived_at is null),
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
    k.ref, k.ref_fin, k.eleve, k.prof,
    coalesce(s.statut, 'prospect'), coalesce(s.source, 'editeur'), coalesce(s.contact_nom, ''),
    coalesce(s.contact_fonction, ''), coalesce(s.contact_email, ''), coalesce(s.contact_tel, ''),
    s.eleves_estimes, s.budget_euros, s.prix_euros, coalesce(s.besoins, '{}'), coalesce(s.message, ''),
    coalesce(s.notes, ''), s.relance, s.maj
  from public.orgs o
  left join public.org_suivi s on s.org_id = o.id
  left join lateral (select case when c.ref_fin > now() then c.ref end as ref,
                            case when c.ref_fin > now() then c.ref_fin end as ref_fin, c.eleve, c.prof
                     from public.org_codes c where c.org_id = o.id) k on true
  where public.is_admin()
  order by coalesce(s.maj, o.created_at) desc
$$;

-- ── 13. « Demander une démo », sans compte ──────────────────────────────
-- Ouverte à anon, exprès : un chef d'établissement n'a pas de compte Folio.
-- Freins : 20 demandes par heure en tout, une par adresse et par jour, des
-- longueurs bornées. Rien d'autre n'est lu ni rendu qu'un statut.
create or replace function public.demander_demo(etab text, ville text, contact_nom text, fonction text,
                                                email text, tel text default '', eleves integer default null,
                                                message text default '')
returns text language plpgsql security definer set search_path to '' as $$
declare o uuid; ml text := lower(trim(coalesce(email, '')));
begin
  if length(trim(coalesce(etab, ''))) not between 2 and 120
     or length(trim(coalesce(contact_nom, ''))) not between 2 and 80 then return 'champs'; end if;
  if ml !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or length(ml) > 120 then return 'email'; end if;
  if eleves is not null and eleves not between 1 and 100000 then return 'champs'; end if;
  if (select count(*) from public.org_suivi s where s.source = 'demande' and s.cree > now() - interval '1 hour') >= 20 then
    return 'trop';
  end if;
  if exists (select 1 from public.org_suivi s where s.source = 'demande' and s.contact_email = ml
             and s.cree > now() - interval '1 day') then
    return 'deja';
  end if;
  insert into public.orgs (code, name, kind, ville, offre)
  values (public.org_prefixe(etab), trim(etab), 'lycee', left(trim(coalesce(ville, '')), 80), 'demo')
  returning id into o;
  insert into public.org_suivi (org_id, statut, source, contact_nom, contact_fonction, contact_email, contact_tel,
                                eleves_estimes, message)
  values (o, 'prospect', 'demande', left(trim(contact_nom), 80), left(trim(coalesce(fonction, '')), 80), ml,
          left(trim(coalesce(tel, '')), 30), eleves, left(trim(coalesce(message, '')), 2000));
  return 'ok';
end $$;

-- ── 14. Les droits ──────────────────────────────────────────────────────
revoke all on function public.code_apercu(text) from public, anon;
revoke all on function public.rejoindre(text, text, text, uuid) from public, anon;
revoke all on function public.eleve_classes() from public, anon;
revoke all on function public.my_school() from public, anon;
revoke all on function public.prof_classes_etab() from public, anon;
revoke all on function public.prof_enseigner(uuid, boolean, text) from public, anon;
revoke all on function public.prof_eleves_etab(text, uuid) from public, anon;
revoke all on function public.prof_groupe(text, uuid[], uuid, text) from public, anon;
revoke all on function public.prof_mon_code(boolean) from public, anon;
revoke all on function public.prof_ajouter_eleve(uuid, uuid) from public, anon;
revoke all on function public.ref_codes() from public, anon;
revoke all on function public.ref_move_student(uuid, uuid) from public, anon;
revoke all on function public.ref_classes() from public, anon;
revoke all on function public.admin_etab_enregistrer(uuid, jsonb) from public, anon;
revoke all on function public.admin_lancer_demo(uuid, integer, integer, boolean) from public, anon;
revoke all on function public.admin_licence(uuid, integer, date, text) from public, anon;
revoke all on function public.admin_supprimer_etab(uuid) from public, anon;
revoke all on function public.admin_orgs() from public, anon;
revoke all on function public.demander_demo(text, text, text, text, text, text, integer, text) from public;
grant execute on function public.code_apercu(text) to authenticated;
grant execute on function public.rejoindre(text, text, text, uuid) to authenticated;
grant execute on function public.eleve_classes() to authenticated;
grant execute on function public.my_school() to authenticated;
grant execute on function public.prof_classes_etab() to authenticated;
grant execute on function public.prof_enseigner(uuid, boolean, text) to authenticated;
grant execute on function public.prof_eleves_etab(text, uuid) to authenticated;
grant execute on function public.prof_groupe(text, uuid[], uuid, text) to authenticated;
grant execute on function public.prof_mon_code(boolean) to authenticated;
grant execute on function public.prof_ajouter_eleve(uuid, uuid) to authenticated;
grant execute on function public.ref_codes() to authenticated;
grant execute on function public.ref_move_student(uuid, uuid) to authenticated;
grant execute on function public.ref_classes() to authenticated;
grant execute on function public.admin_etab_enregistrer(uuid, jsonb) to authenticated;
grant execute on function public.admin_lancer_demo(uuid, integer, integer, boolean) to authenticated;
grant execute on function public.admin_licence(uuid, integer, date, text) to authenticated;
grant execute on function public.admin_supprimer_etab(uuid) to authenticated;
grant execute on function public.admin_orgs() to authenticated;
grant execute on function public.demander_demo(text, text, text, text, text, text, integer, text) to anon, authenticated;
