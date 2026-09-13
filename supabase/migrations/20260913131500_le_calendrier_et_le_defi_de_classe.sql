-- ══════════ une date de rendu, un défi de classe, des médias de cours ══
-- Trois manques qui se voyaient dès le premier usage réel.

-- ── 1. Une date, pas un délai ───────────────────────────────────────────
-- « Dans 7 jours » n'est pas une échéance : c'est un calcul que le
-- professeur doit faire de tête en connaissant la date du jour, et qui
-- tombe un dimanche une fois sur sept. Il choisit un jour dans un
-- calendrier ; ces fonctions reçoivent donc ce jour.
drop function if exists public.prof_give(uuid[], text, text, jsonb, integer);
drop function if exists public.prof_set_due(uuid, integer);

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
    if public.teaches(k)
       or exists (select 1 from public.classes c where c.id = k and c.owner = auth.uid()) then
      insert into public.assignments (class_id, name, cards, n, due, created_by, subject)
      values (k, trim(nom), cartes, nb, due, auth.uid(), nullif(trim(coalesce(matiere, '')), ''));
      n := n + 1;
    end if;
  end loop;
  if n = 0 then raise exception 'Aucune de ces classes n''est la tienne'; end if;
  return n;
end $$;

create or replace function public.prof_set_due(aid uuid, due date)
returns date language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.assignments a
                 where a.id = aid and a.created_by = auth.uid()) then
    raise exception 'Ce devoir n''est pas le tien';
  end if;
  if due is null then raise exception 'Il faut une date de rendu'; end if;
  if due > current_date + 400 then raise exception 'Cette date est trop lointaine'; end if;
  update public.assignments set due = prof_set_due.due where id = aid;
  return due;
end $$;

-- Le mois d'un professeur, toutes classes confondues : la vue d'un cahier
-- de textes, qui n'existait pas.
create or replace function public.prof_agenda(du date, au date)
returns table (id uuid, nom text, matiere text, n integer, due date,
               class_id uuid, classe text, niveau text, mien boolean,
               effectif integer, ouvert integer, rendu integer, pct integer)
language sql stable security definer set search_path = '' as $$
  select a.id, a.name, a.subject, a.n, a.due, c.id, c.name, c.level,
         a.created_by = auth.uid(),
         (select count(*)::integer from public.class_members cm where cm.class_id = c.id),
         (select count(*)::integer from public.assignment_progress ap where ap.assignment_id = a.id),
         (select count(*)::integer from public.assignment_progress ap
          where ap.assignment_id = a.id and ap.done_at is not null),
         (select coalesce(round(avg(ap.pct)), 0)::integer from public.assignment_progress ap
          where ap.assignment_id = a.id and ap.pct > 0)
  from public.assignments a
  join public.classes c on c.id = a.class_id
  where a.due between du and au
    and (public.teaches(c.id) or c.owner = auth.uid())
  order by a.due, c.name
$$;

-- ── 2. Un défi pour toute une classe ────────────────────────────────────
-- Un défi ne se voyait qu'entre amis ou dans un club. À l'école, ni l'un
-- ni l'autre n'existe : l'élève n'a que sa classe.
alter table public.duels add column if not exists class_id uuid references public.classes(id) on delete cascade;
create index if not exists duels_classe_idx on public.duels (class_id, created_at desc);

drop policy if exists duels_read on public.duels;
create policy duels_read on public.duels for select to authenticated
using (
  owner = (select auth.uid())
  or (not hidden and not public.blocked(owner) and (
        (class_id is not null and (public.in_class(class_id) or public.teaches(class_id)))
     or (class_id is null and group_id is null and public.is_friend(owner))
     or (class_id is null and group_id is not null and public.in_group(group_id))
  ))
);

-- Seul le professeur de la classe peut y poser un défi : sans cette
-- clause, n'importe quel élève en créerait un pour toute sa classe.
drop policy if exists duels_write on public.duels;
create policy duels_write on public.duels for insert to authenticated
with check (
  owner = (select auth.uid())
  and (class_id is null or public.teaches(class_id)
       or exists (select 1 from public.classes c where c.id = class_id and c.owner = auth.uid()))
);

-- `scores_read` disait seulement « le défi existe » : le classement de
-- n'importe quel défi s'ouvrait à qui en devinait l'identifiant. On écrit
-- la condition en toutes lettres plutôt que de compter sur la politique de
-- `duels` pour se propager dans une sous-requête.
drop policy if exists scores_read on public.duel_scores;
create policy scores_read on public.duel_scores for select to authenticated
using (exists (
  select 1 from public.duels d
  where d.id = duel_id
    and (d.owner = (select auth.uid())
      or (not d.hidden and not public.blocked(d.owner) and (
            (d.class_id is not null and (public.in_class(d.class_id) or public.teaches(d.class_id)))
         or (d.class_id is null and d.group_id is null and public.is_friend(d.owner))
         or (d.class_id is null and d.group_id is not null and public.in_group(d.group_id))
      )))
));

-- ── 3. Les médias d'un cours suivent le devoir ──────────────────────────
-- Un devoir peut porter des photos et des enregistrements. Ces fichiers
-- vivent dans le seau `media`, dont la lecture est réservée au
-- propriétaire du dossier depuis qu'on l'a fermé : l'élève recevait un
-- devoir dont il ne pouvait ni voir l'image ni entendre le son.
--
-- On n'ouvre pas pour autant le dossier du professeur — ses livres
-- personnels n'ont rien à faire chez ses élèves. L'app range ce qui part
-- en cours sous « cours/<professeur>/… », et c'est le seul préfixe que la
-- classe peut lire.
drop policy if exists media_classe on storage.objects;
create policy media_classe on storage.objects for select to authenticated
using (
  bucket_id = 'media'
  and (storage.foldername(name))[1] = 'cours'
  and exists (
    select 1 from public.teachings t
    join public.class_members cm on cm.class_id = t.class_id
    where t.teacher::text = (storage.foldername(name))[2]
      and cm.user_id = auth.uid()
  )
);

-- Le propriétaire garde la main sur ce préfixe : les deux politiques
-- comparaient le premier dossier à son identifiant, ce qui ne correspond
-- plus pour « cours/<uid>/… ».
drop policy if exists media_read on storage.objects;
create policy media_read on storage.objects for select to authenticated
using (
  bucket_id = 'media'
  and (auth.uid())::text = case when (storage.foldername(name))[1] = 'cours'
       then (storage.foldername(name))[2] else (storage.foldername(name))[1] end
);

drop policy if exists media_del on storage.objects;
create policy media_del on storage.objects for delete to authenticated
using (
  bucket_id = 'media'
  and (auth.uid())::text = case when (storage.foldername(name))[1] = 'cours'
       then (storage.foldername(name))[2] else (storage.foldername(name))[1] end
);

-- Une carte de devoir était une paire [recto, verso] ; elle peut désormais
-- être un objet, pour porter image et son. La fonction lit les deux.
create or replace function public.prof_cartes(aid uuid)
returns table (rang integer, recto text, verso text,
               vues integer, ratees integer, eleves integer)
language sql stable security definer set search_path = '' as $$
  with a as (
    select x.id, x.class_id, x.cards from public.assignments x
    where x.id = aid
      and (public.teaches(x.class_id)
        or exists (select 1 from public.classes c where c.id = x.class_id and c.owner = auth.uid())
        or public.is_ref() or public.is_admin())
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
      and split_part(r.card_id, ':', 3) ~ '^[0-9]+$'
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

grant execute on function public.prof_give(uuid[], text, text, jsonb, date) to authenticated;
grant execute on function public.prof_set_due(uuid, date) to authenticated;
grant execute on function public.prof_agenda(date, date) to authenticated;
