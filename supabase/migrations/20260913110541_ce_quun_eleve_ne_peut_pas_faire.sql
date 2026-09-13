-- ══════════ ce qu'un élève ne peut pas faire ══════════
-- Un compte scolaire n'est pas un compte personnel. Le pseudo vient de
-- l'établissement, la matière vient du professeur, la classe ne se quitte
-- pas, et on n'ajoute que ses camarades. Tout cela se refuse ici, dans la
-- base : masquer un bouton ne ferme rien, l'API reste ouverte.
--
-- Les comptes hors établissement ne sont touchés par aucune de ces règles.

-- ── 1. L'identité est posée par l'établissement ─────────────────────────
-- On ne rejette pas la modification, on la renverse : l'app n'a pas besoin
-- de traiter une erreur pour un champ qu'elle n'affiche déjà plus.

create or replace function public.lock_identite_scolaire()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.org_members m where m.user_id = new.id)
     and coalesce((select r.role from public.user_roles r where r.user_id = new.id), 'eleve') = 'eleve'
  then
    new.handle := old.handle;
    new.name   := old.name;
    new.email  := old.email;
  end if;
  return new;
end $$;

drop trigger if exists lock_identite_scolaire on public.profiles;
create trigger lock_identite_scolaire
  before update on public.profiles
  for each row execute function public.lock_identite_scolaire();

-- ── 2. La matière du cours ne s'édite pas, la matière perso si ──────────
-- `locked` est posé par le professeur quand il distribue sa matière. L'élève
-- garde le droit d'en créer pour lui, et de les renommer ou les effacer.

alter table public.subjects add column if not exists locked boolean not null default false;

drop policy if exists subjects_own on public.subjects;
drop policy if exists subjects_read on public.subjects;
drop policy if exists subjects_add  on public.subjects;
drop policy if exists subjects_edit on public.subjects;
drop policy if exists subjects_del  on public.subjects;

create policy subjects_read on public.subjects for select
  using (user_id = (select auth.uid()));
create policy subjects_add on public.subjects for insert
  with check (user_id = (select auth.uid()));
create policy subjects_edit on public.subjects for update
  using (user_id = (select auth.uid()) and not locked)
  with check (user_id = (select auth.uid()));
create policy subjects_del on public.subjects for delete
  using (user_id = (select auth.uid()) and not locked);

-- ── 3. On n'ajoute que ses camarades de classe ──────────────────────────

create or replace function public.same_class(other uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.class_members a
                 join public.class_members b on b.class_id = a.class_id
                 where a.user_id = auth.uid() and b.user_id = other)
$$;

drop policy if exists friends_ask on public.friends;
create policy friends_ask on public.friends for insert
  with check (
    user_id = (select auth.uid())
    and not public.blocked(friend_id)
    and (public.my_org() is null
      or public.my_role() <> 'eleve'
      or public.same_class(friend_id))
  );

-- Et l'annuaire ne montre pas non plus ce qu'on ne peut pas ajouter : sans
-- cela l'élève cherche un pseudo, le trouve, et l'ajout échoue sans raison
-- lisible.
create or replace function public.find_user(q text)
returns table (id uuid, handle text, name text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.handle, coalesce(nullif(p.name, ''), p.handle)
  from public.profiles p
  where p.handle is not null
    and lower(p.handle) = lower(trim(replace(q, '@', '')))
    and p.id <> auth.uid()
    and (public.my_org() is null
      or public.my_role() <> 'eleve'
      or public.same_class(p.id))
  limit 1
$$;

-- ── 4. On ne quitte pas sa classe ───────────────────────────────────────
-- Rien à écrire : `cm_leave` (migration `etablissements_et_quatre_roles`)
-- réserve déjà la suppression au référent de l'établissement. L'élève n'a
-- jamais eu le droit de sortir seul, et le professeur non plus — ce dernier
-- point est un manque, corrigé quand la console du professeur arrive.
