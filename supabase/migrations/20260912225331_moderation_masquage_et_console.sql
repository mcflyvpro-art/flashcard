-- ══════════ qui modère ══════════
-- Une table, pas un rôle Postgres : on ajoute et on retire un modérateur
-- sans toucher aux droits de la base.
create table if not exists public.moderators (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  added_at timestamptz not null default now()
);
alter table public.moderators enable row level security;
-- chacun peut savoir s'il l'est ; personne ne peut lire la liste entière
create policy mods_self on public.moderators for select to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.is_mod()
returns boolean language sql stable security definer set search_path to ''
as $$ select exists (select 1 from public.moderators m where m.user_id = auth.uid()) $$;
revoke all on function public.is_mod() from public, anon;
grant execute on function public.is_mod() to authenticated;

-- ══════════ le masquage ══════════
alter table public.library add column if not exists hidden boolean not null default false;
alter table public.duels   add column if not exists hidden boolean not null default false;

-- Un contenu masqué disparaît pour tout le monde sauf son auteur, qui doit
-- pouvoir comprendre ce qui lui arrive plutôt que de voir son livre
-- s'évaporer sans un mot.
drop policy if exists library_read on public.library;
create policy library_read on public.library for select to authenticated
  using (user_id = (select auth.uid())
      or (not hidden and not public.blocked(user_id)
          and ((group_id is null and public.is_friend(user_id))
            or (group_id is not null and public.in_group(group_id)))));

drop policy if exists duels_read on public.duels;
create policy duels_read on public.duels for select to authenticated
  using (owner = (select auth.uid())
      or (not hidden and not public.blocked(owner)
          and ((group_id is null and public.is_friend(owner))
            or (group_id is not null and public.in_group(group_id)))));

-- ══════════ le deuxième signalement masque ══════════
-- Une personne seule ne peut pas répondre en deux heures, et prétendre le
-- contraire serait mentir. Alors la machine contient d'abord : au deuxième
-- signalement par des comptes distincts, le contenu se retire en attendant
-- un avis. Un seul signalement ne suffit pas — ce serait donner à n'importe
-- qui le pouvoir d'effacer le travail d'un autre.
create or replace function public.auto_hide() returns trigger
language plpgsql security definer set search_path to '' as $$
declare n int;
begin
  select count(distinct r.reporter) into n from public.reports r
   where r.kind = new.kind and r.target_id = new.target_id;
  if n >= 2 then
    if new.kind = 'library' then
      update public.library set hidden = true where deck_id::text = new.target_id;
    elsif new.kind = 'duel' then
      update public.duels set hidden = true where id::text = new.target_id;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists reports_auto_hide on public.reports;
create trigger reports_auto_hide after insert on public.reports
  for each row execute function public.auto_hide();

-- ══════════ la console ══════════
-- Le modérateur lit les signalements — qui portent leur propre copie du
-- contenu — et rien d'autre. Il n'obtient aucun accès aux bibliothèques ni
-- au courrier : c'est la copie jointe qui lui permet de juger, et c'est
-- exactement pour ça qu'on la garde.
create policy reports_mods on public.reports for select to authenticated
  using (public.is_mod());

-- Une seule porte pour agir, plutôt que des droits d'écriture étendus.
create or replace function public.mod_act(rid bigint, act text)
returns void language plpgsql security definer set search_path to '' as $$
declare r public.reports%rowtype;
begin
  if not public.is_mod() then raise exception 'non autorisé'; end if;
  select * into r from public.reports where id = rid;
  if not found then raise exception 'signalement introuvable'; end if;

  if act = 'hide' then
    if r.kind = 'library' then
      update public.library set hidden = true where deck_id::text = r.target_id;
    elsif r.kind = 'duel' then
      update public.duels set hidden = true where id::text = r.target_id;
    end if;
    update public.reports set status = 'reviewed'
     where kind = r.kind and target_id = r.target_id and status = 'open';

  elsif act = 'clear' then
    -- rien à signaler : le contenu masqué par le compteur revient
    if r.kind = 'library' then
      update public.library set hidden = false where deck_id::text = r.target_id;
    elsif r.kind = 'duel' then
      update public.duels set hidden = false where id::text = r.target_id;
    end if;
    update public.reports set status = 'closed'
     where kind = r.kind and target_id = r.target_id and status = 'open';
  else
    raise exception 'action inconnue';
  end if;
end $$;
revoke all on function public.mod_act(bigint, text) from public, anon;
grant execute on function public.mod_act(bigint, text) to authenticated;

-- Pour nommer un modérateur :
--   insert into public.moderators (user_id)
--   select id from auth.users where email = '…';
