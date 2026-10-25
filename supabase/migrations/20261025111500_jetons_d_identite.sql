-- Les jetons d'identité (2026-10-25).
--
-- Ce qui représente une personne ou une classe à l'écran : une figure (un
-- émoji) ou un emblème (une icône), et une couleur, choisis dans des listes
-- fermées que l'app connaît (src/jeton.js). La base ne garde que des clés
-- (^[a-z]{2,16}$) et un rang de couleur (0–11), jamais une image ni un texte
-- libre : des élèves mineurs, rien à modérer. Tant que rien n'est choisi,
-- l'app tire le jeton de l'identifiant (initiales pour une personne, un
-- emblème pour une classe), stable d'un appareil à l'autre.
--
-- Le sigle de classe qui abrégeait le nom (« CPGE ECP1 » → « CE1 ») a disparu
-- avec cette migration : un emblème ne fait croire à aucun niveau.
--
-- Qui voit le jeton choisi de qui — une seule porte, visuels() :
--   • soi ; ses amis (demande en attente comprise) ; les membres d'un club
--     commun ; les joueurs d'une même partie en direct ;
--   • dans une classe : ses camarades et ses professeurs ; un professeur, ses
--     élèves, sa salle d'attente et ses collègues de la classe ;
--   • un référent, les membres de son établissement.
-- Les autres voient le jeton par défaut. Une classe : son professeur, ses
-- élèves et ceux qui attendent d'y entrer.
--
-- Qui choisit : chacun le sien (mon_jeton) ; pour une classe, qui la gère
-- (prof_jeton_classe : créateur, professeur principal, référent).

alter table public.profiles
  add column if not exists figure text,
  add column if not exists teinte smallint;
alter table public.profiles
  add constraint profiles_figure_cle check (figure is null or figure ~ '^[a-z]{2,16}$'),
  add constraint profiles_teinte_rang check (teinte is null or teinte between 0 and 11);

alter table public.classes
  add column if not exists embleme text,
  add column if not exists teinte smallint;
alter table public.classes
  add constraint classes_embleme_cle check (embleme is null or embleme ~ '^[a-z]{2,16}$'),
  add constraint classes_teinte_rang check (teinte is null or teinte between 0 and 11);

-- ══════════ qui voit qui (fonctions internes, aucun droit d'exécution) ══════════
create or replace function public.voit_personne(u uuid)
returns boolean
language sql stable security definer set search_path to ''
as $$
  select u = auth.uid()
    or exists (select 1 from public.friends f
               where (f.user_id = auth.uid() and f.friend_id = u) or (f.friend_id = auth.uid() and f.user_id = u))
    or exists (select 1 from public.group_members a join public.group_members b on b.group_id = a.group_id
               where a.user_id = auth.uid() and b.user_id = u)
    or exists (select 1 from public.class_members a join public.class_members b on b.class_id = a.class_id
               where a.user_id = auth.uid() and b.user_id = u)
    or exists (select 1 from public.class_members a join public.classes c on c.id = a.class_id
               where a.user_id = auth.uid()
                 and (c.owner = u or exists (select 1 from public.teachings t where t.class_id = c.id and t.teacher = u)))
    or exists (select 1 from public.class_members m
               where m.user_id = u and (public.teaches(m.class_id) or public.class_manager(m.class_id)))
    or exists (select 1 from public.class_requests r
               where r.user_id = u and (public.teaches(r.class_id) or public.class_manager(r.class_id)))
    or exists (select 1 from public.teachings a join public.teachings b on b.class_id = a.class_id
               where a.teacher = auth.uid() and b.teacher = u)
    or exists (select 1 from public.salles s
               where (s.hote = auth.uid()
                      or exists (select 1 from public.salle_joueurs j where j.salle_id = s.id and j.user_id = auth.uid()))
                 and (s.hote = u
                      or exists (select 1 from public.salle_joueurs j where j.salle_id = s.id and j.user_id = u)))
    or (public.is_ref()
        and exists (select 1 from public.org_members m where m.user_id = u and m.org_id = public.my_org()))
$$;
revoke all on function public.voit_personne(uuid) from public, anon;   -- et authenticated : 20261025113100

create or replace function public.voit_classe(cid uuid)
returns boolean
language sql stable security definer set search_path to ''
as $$
  select public.class_manager(cid) or public.teaches(cid)
    or exists (select 1 from public.classes c where c.id = cid and c.owner = auth.uid())
    or exists (select 1 from public.class_members m where m.class_id = cid and m.user_id = auth.uid())
    or exists (select 1 from public.class_requests r where r.class_id = cid and r.user_id = auth.uid())
$$;
revoke all on function public.voit_classe(uuid) from public, anon;

-- ══════════ lire : une seule porte ══════════
-- Au plus 200 personnes et 100 classes par appel (l'app regroupe ce qu'un
-- écran affiche). Une ligne revient pour chaque identifiant visible, même
-- sans choix (cle et teinte nulles) : l'app sait alors qu'il n'y a rien à
-- attendre et garde le jeton par défaut.
create or replace function public.visuels(personnes uuid[] default '{}', classes uuid[] default '{}')
returns table(id uuid, genre text, cle text, teinte smallint)
language sql stable security definer set search_path to ''
as $$
  select p.id, 'p'::text, p.figure, p.teinte
  from public.profiles p
  where p.id = any ((coalesce(personnes, '{}'::uuid[]))[1:200]) and public.voit_personne(p.id)
  union all
  select c.id, 'c'::text, c.embleme, c.teinte
  from public.classes c
  where c.id = any ((coalesce(classes, '{}'::uuid[]))[1:100]) and public.voit_classe(c.id)
$$;
revoke all on function public.visuels(uuid[], uuid[]) from public, anon;
grant execute on function public.visuels(uuid[], uuid[]) to authenticated;

-- ══════════ choisir ══════════
-- Un élève à carte ou d'établissement choisit le sien aussi : son nom reste
-- verrouillé (lock_identite_scolaire ne touche que handle, name et email).
create or replace function public.mon_jeton(cle text, rang smallint)
returns void
language plpgsql security definer set search_path to ''
as $$
begin
  if auth.uid() is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  if cle is not null and cle !~ '^[a-z]{2,16}$' then raise exception 'Figure inconnue' using errcode = '22023'; end if;
  if rang is not null and (rang < 0 or rang > 11) then raise exception 'Couleur inconnue' using errcode = '22023'; end if;
  update public.profiles set figure = cle, teinte = rang, updated_at = now() where id = auth.uid();
  if not found then
    insert into public.profiles (id, email, figure, teinte)
    select u.id, coalesce(u.email, ''), cle, rang from auth.users u where u.id = auth.uid();
  end if;
end $$;
revoke all on function public.mon_jeton(text, smallint) from public, anon;
grant execute on function public.mon_jeton(text, smallint) to authenticated;

create or replace function public.prof_jeton_classe(cid uuid, cle text, rang smallint)
returns void
language plpgsql security definer set search_path to ''
as $$
begin
  if not (public.class_manager(cid)
          or exists (select 1 from public.classes c where c.id = cid and c.owner = auth.uid())) then
    raise exception 'Seul qui gère la classe choisit son emblème' using errcode = '42501';
  end if;
  if cle is not null and cle !~ '^[a-z]{2,16}$' then raise exception 'Emblème inconnu' using errcode = '22023'; end if;
  if rang is not null and (rang < 0 or rang > 11) then raise exception 'Couleur inconnue' using errcode = '22023'; end if;
  update public.classes set embleme = cle, teinte = rang where id = cid;
end $$;
revoke all on function public.prof_jeton_classe(uuid, text, smallint) from public, anon;
grant execute on function public.prof_jeton_classe(uuid, text, smallint) to authenticated;
