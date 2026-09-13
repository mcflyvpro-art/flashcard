-- ══════════ le rôle ══════════
-- Il ne vit pas dans profiles. Un compte peut modifier son propre profil :
-- si le rôle y était, il suffirait d'une requête pour se déclarer admin.
-- Ici, aucune politique d'écriture n'existe — ni insert, ni update, ni
-- delete. Le rôle ne se change donc que depuis la console d'administration
-- ou avec la clé de service. L'élévation de privilège est impossible par
-- construction, pas par vigilance.
create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role    text not null default 'eleve' check (role in ('eleve','prof','admin')),
  set_at  timestamptz not null default now()
);
alter table public.user_roles enable row level security;
create policy roles_self on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.my_role()
returns text language sql stable security definer set search_path to ''
as $$ select coalesce((select r.role from public.user_roles r where r.user_id = auth.uid()), 'eleve') $$;
create or replace function public.is_prof()
returns boolean language sql stable security definer set search_path to ''
as $$ select public.my_role() in ('prof','admin') $$;
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path to ''
as $$ select public.my_role() = 'admin' $$;
revoke all on function public.my_role() from public, anon;
revoke all on function public.is_prof() from public, anon;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.my_role() to authenticated;
grant execute on function public.is_prof() to authenticated;
grant execute on function public.is_admin() to authenticated;

-- ══════════ les classes ══════════
create table if not exists public.classes (
  id      uuid primary key default gen_random_uuid(),
  name    text not null default 'Ma classe',
  level   text not null default '',
  year    text not null default '',
  code    text not null unique,
  owner   uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.class_members (
  class_id uuid not null references public.classes(id) on delete cascade,
  user_id  uuid not null references auth.users(id) on delete cascade,
  who      text not null default '',
  joined_at timestamptz not null default now(),
  primary key (class_id, user_id)
);
alter table public.classes       enable row level security;
alter table public.class_members enable row level security;

create or replace function public.in_class(cid uuid)
returns boolean language sql stable security definer set search_path to ''
as $$ select exists (select 1 from public.class_members m
                     where m.class_id = cid and m.user_id = auth.uid()) $$;
revoke all on function public.in_class(uuid) from public, anon;
grant execute on function public.in_class(uuid) to authenticated;

-- ══════════ les devoirs ══════════
-- Le paquet voyage en copie, comme le courrier et l'étagère : la table
-- decks reste privée à son auteur, et l'élève reçoit de quoi travailler
-- sans qu'on ouvre la bibliothèque du professeur.
create table if not exists public.assignments (
  id       uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  name     text not null default 'Devoir',
  cards    jsonb not null default '[]'::jsonb,
  n        integer not null default 0,
  due      date,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.assignments enable row level security;
create policy asg_read on public.assignments for select to authenticated
  using (public.in_class(class_id)
      or exists (select 1 from public.classes c
                 where c.id = class_id and c.owner = (select auth.uid())));

-- L'avancement : ce que le professeur a le droit de voir, et rien de plus.
-- Fait ou pas fait, et le pourcentage de la dernière séance. Jamais le
-- détail carte par carte, jamais les horaires.
create table if not exists public.assignment_progress (
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  user_id  uuid not null references auth.users(id) on delete cascade,
  who      text not null default '',
  pct      real not null default 0,
  done_at  timestamptz,
  primary key (assignment_id, user_id)
);
alter table public.assignment_progress enable row level security;
create policy ap_read on public.assignment_progress for select to authenticated
  using (user_id = (select auth.uid())
      or exists (select 1 from public.assignments a join public.classes c on c.id = a.class_id
                 where a.id = assignment_id and c.owner = (select auth.uid())));
create policy ap_mine on public.assignment_progress for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy ap_edit on public.assignment_progress for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create index if not exists classes_owner_idx on public.classes (owner);
create index if not exists cm_user_idx on public.class_members (user_id);
create index if not exists asg_class_idx on public.assignments (class_id, created_at desc);
