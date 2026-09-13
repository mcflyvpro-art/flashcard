-- ══════════ l'établissement ══════════
-- Tout ce qui est scolaire appartient à un établissement. C'est la frontière
-- qui compte : un professeur de Camus n'a rien à faire dans les classes de
-- Jean Moulin, et un référent ne gère que sa maison.
create table if not exists public.orgs (
  id     uuid primary key default gen_random_uuid(),
  code   text not null unique,          -- A, J, B : le préfixe des identifiants
  name   text not null,
  kind   text not null default 'lycee',
  ville  text not null default '',
  uai    text not null default '',
  created_at timestamptz not null default now()
);

-- Une personne appartient à un établissement et un seul. « ref » est son
-- identifiant lisible : A.PROF.1, J.ELEVE.214.
create table if not exists public.org_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  org_id  uuid not null references public.orgs(id) on delete cascade,
  ref     text not null default '',
  joined_at timestamptz not null default now()
);
create index if not exists org_members_org on public.org_members (org_id);
create unique index if not exists org_members_ref on public.org_members (ref) where ref <> '';

-- ══════════ quatre rôles, pas trois ══════════
-- Entre le professeur et l'administrateur de la plateforme, il manquait
-- quelqu'un : celui qui, dans l'établissement, ouvre les comptes, monte les
-- classes et dit quel professeur enseigne quoi à qui. Sans lui, ce travail
-- remonte à l'éditeur, qui n'a aucune raison de connaître la répartition
-- des services d'un lycée.
alter table public.user_roles drop constraint if exists user_roles_role_check;
alter table public.user_roles add constraint user_roles_role_check
  check (role in ('eleve','prof','ref','admin'));

create or replace function public.my_org()
returns uuid language sql stable security definer set search_path to ''
as $$ select org_id from public.org_members where user_id = auth.uid() $$;
create or replace function public.is_ref()
returns boolean language sql stable security definer set search_path to ''
as $$ select public.my_role() in ('ref','admin') $$;
revoke all on function public.my_org() from public, anon;
revoke all on function public.is_ref() from public, anon;
grant execute on function public.my_org() to authenticated;
grant execute on function public.is_ref() to authenticated;

alter table public.classes add column if not exists org_id uuid references public.orgs(id) on delete cascade;
alter table public.classes add column if not exists filiere text not null default '';
alter table public.classes add column if not exists cycle text not null default '';

-- ══════════ qui enseigne quoi, à qui ══════════
-- La relation qui manquait. Un professeur ne « possède » pas une classe :
-- il y enseigne une matière. Plusieurs professeurs se partagent une classe,
-- et un professeur suit plusieurs classes — c'est la réalité d'un emploi du
-- temps, et c'est ce qui décide de ce que chacun a le droit de voir.
create table if not exists public.teachings (
  id       uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  teacher  uuid not null references auth.users(id) on delete cascade,
  subject  text not null,
  principal boolean not null default false,
  unique (class_id, teacher, subject)
);
create index if not exists teachings_teacher on public.teachings (teacher);
create index if not exists teachings_class on public.teachings (class_id);
alter table public.teachings enable row level security;

create or replace function public.teaches(cid uuid)
returns boolean language sql stable security definer set search_path to ''
as $$ select exists (select 1 from public.teachings t
                     where t.class_id = cid and t.teacher = auth.uid()) $$;
create or replace function public.class_in_org(cid uuid)
returns boolean language sql stable security definer set search_path to ''
as $$ select exists (select 1 from public.classes c
                     where c.id = cid and c.org_id = public.my_org()) $$;
revoke all on function public.teaches(uuid) from public, anon;
revoke all on function public.class_in_org(uuid) from public, anon;
grant execute on function public.teaches(uuid) to authenticated;
grant execute on function public.class_in_org(uuid) to authenticated;

-- ══════════ ce que chacun voit ══════════
alter table public.orgs enable row level security;
alter table public.org_members enable row level security;
create policy orgs_read on public.orgs for select to authenticated
  using (id = public.my_org() or public.is_admin());
create policy om_read on public.org_members for select to authenticated
  using (user_id = (select auth.uid())
      or (org_id = public.my_org() and public.my_role() in ('prof','ref'))
      or public.is_admin());

-- Le professeur voit les classes où il enseigne. Le référent, toutes celles
-- de son établissement. L'élève, celles où il est inscrit.
drop policy if exists classes_read on public.classes;
create policy classes_read on public.classes for select to authenticated
  using (owner = (select auth.uid()) or public.teaches(id) or public.in_class(id)
      or (org_id = public.my_org() and public.is_ref()) or public.is_admin());

-- Seul un référent monte une classe : c'est un acte d'organisation, pas
-- d'enseignement. Un professeur qui crée ses propres classes fabrique des
-- doublons que personne ne rattrape ensuite.
drop policy if exists classes_make on public.classes;
create policy classes_make on public.classes for insert to authenticated
  with check (public.is_ref() and org_id = public.my_org());
drop policy if exists classes_edit on public.classes;
create policy classes_edit on public.classes for update to authenticated
  using (public.is_ref() and org_id = public.my_org())
  with check (public.is_ref() and org_id = public.my_org());

create policy teach_read on public.teachings for select to authenticated
  using (teacher = (select auth.uid()) or public.in_class(class_id)
      or (public.is_ref() and public.class_in_org(class_id)) or public.is_admin());
create policy teach_write on public.teachings for all to authenticated
  using (public.is_ref() and public.class_in_org(class_id))
  with check (public.is_ref() and public.class_in_org(class_id));

drop policy if exists cm_read on public.class_members;
create policy cm_read on public.class_members for select to authenticated
  using (user_id = (select auth.uid()) or public.teaches(class_id)
      or exists (select 1 from public.classes c
                 where c.id = class_id and c.owner = (select auth.uid()))
      or (public.is_ref() and public.class_in_org(class_id)) or public.is_admin());

-- Un élève ne se désinscrit pas tout seul de sa classe : c'est
-- l'établissement qui l'y a mis, c'est lui qui l'en sort.
drop policy if exists cm_join on public.class_members;
create policy cm_join on public.class_members for insert to authenticated
  with check (public.is_ref() and public.class_in_org(class_id));
drop policy if exists cm_leave on public.class_members;
create policy cm_leave on public.class_members for delete to authenticated
  using (public.is_ref() and public.class_in_org(class_id));

-- Un devoir est donné par quelqu'un qui enseigne à cette classe.
drop policy if exists asg_make on public.assignments;
create policy asg_make on public.assignments for insert to authenticated
  with check (created_by = (select auth.uid()) and public.teaches(class_id));
drop policy if exists asg_drop on public.assignments;
create policy asg_drop on public.assignments for delete to authenticated
  using (created_by = (select auth.uid())
      or (public.is_ref() and public.class_in_org(class_id)));
alter table public.assignments add column if not exists subject text not null default '';
