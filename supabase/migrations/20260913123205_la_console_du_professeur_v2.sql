-- ══════════ la console du professeur, deuxième version ══════════
-- Ce qu'un professeur fait vraiment avec un cahier de textes : il regarde
-- ses classes, il ouvre une classe, il lit la ligne d'un élève, il donne du
-- travail, il repousse une échéance, il relance ceux qui n'ont rien ouvert.
-- Six gestes. Tout ce qui suit ne sert qu'à ces six-là.
--
-- Aucune de ces fonctions ne laisse voir les réponses d'un élève, ses
-- horaires de travail ou ses paquets personnels. Un professeur suit une
-- classe ; il ne surveille personne.
--
-- Et il ne crée plus de classe : elles viennent de l'installation dans
-- l'établissement, puis du référent d'une année sur l'autre. Lui, il
-- enseigne dans celles qu'on lui a données.
--
-- Deux signatures changent, d'où les DROP : `prof_classes` prend l'année
-- scolaire, `prof_roster` rend l'activité réelle de chaque élève.

drop function if exists public.prof_classes();
drop function if exists public.prof_roster(uuid);
drop function if exists public.prof_alertes();

-- ── L'ordre scolaire des niveaux ────────────────────────────────────────
-- Trié par ordre alphabétique, un emploi du temps donne « Cinquième,
-- Quatrième, Sixième, Troisième » : personne ne lit ça. L'ordre n'est ni
-- alphabétique ni numérique, il est conventionnel — il faut l'écrire.
create or replace function public.niveau_rang(cycle text, niveau text)
returns integer language sql immutable set search_path = '' as $$
  select coalesce(
    case lower(coalesce(cycle, ''))
      when 'college' then 100 when 'lycee_gt' then 200
      when 'lycee_techno' then 300 when 'lycee_pro' then 400
      when 'cpge' then 500 else 600 end
    + case lower(coalesce(niveau, ''))
      when 'sixième' then 1 when 'cinquième' then 2
      when 'quatrième' then 3 when 'troisième' then 4
      when 'seconde' then 1 when 'première' then 2 when 'terminale' then 3
      when '1re année' then 1 when '2e année' then 2
      else 9 end, 999)
$$;


-- ── Les années scolaires où ce professeur a un service ──────────────────
-- Une année ne se devine pas à la date : on consulte l'an dernier en
-- septembre, et son service de l'an prochain en juin.
create or replace function public.prof_annees()
returns table (annee text, classes integer, courante boolean)
language sql stable security definer set search_path = '' as $$
  select c.year, count(distinct c.id)::integer,
         c.year = case when extract(month from current_date) >= 8
           then extract(year from current_date)::text || '-' || (extract(year from current_date) + 1)::text
           else (extract(year from current_date) - 1)::text || '-' || extract(year from current_date)::text end
  from public.classes c
  where exists (select 1 from public.teachings t where t.class_id = c.id and t.teacher = auth.uid())
     or c.owner = auth.uid()
  group by c.year
  order by c.year desc
$$;

-- ── Mes classes ─────────────────────────────────────────────────────────
-- Les compteurs portent sur les devoirs que CE professeur a donnés : un
-- professeur de mathématiques qui lit « 14 devoirs » pour une 6e où il en a
-- donné deux a reçu une réponse juste à une question qu'il ne posait pas.
--
-- `retard` compte des élèves, pas des devoirs. Savoir que huit devoirs
-- échus traînent n'aide personne ; savoir que seize élèves traînent, si —
-- c'est à eux qu'on parle en début de cours.
--
-- `jamais` compte les comptes que personne n'a jamais ouverts. Ni retard ni
-- paresse : un lien qui n'est pas arrivé. C'est le premier chiffre à
-- regarder les trois premières semaines, et il n'appelle pas la même
-- réaction qu'un devoir non rendu.
create or replace function public.prof_classes(annee text default null)
returns table (id uuid, name text, niveau text, cycle text, filiere text,
               annee_scolaire text, code text, matiere text, principal boolean,
               effectif integer, devoirs integer, encours integer, retard integer,
               pas_ouvert integer, jamais integer, actifs7 integer, pct integer,
               dernier text, dernier_due date)
language sql stable security definer set search_path = '' as $$
  with mes as (
    select c.id, c.name, c.level, c.cycle, c.filiere, c.year, c.code,
           string_agg(distinct t.subject, ' · ') as matiere,
           bool_or(coalesce(t.principal, false)) as principal
    from public.classes c
    join public.teachings t on t.class_id = c.id
    where t.teacher = auth.uid() and (annee is null or c.year = annee)
    group by c.id, c.name, c.level, c.cycle, c.filiere, c.year, c.code
    union
    select c.id, c.name, c.level, c.cycle, c.filiere, c.year, c.code, '', true
    from public.classes c
    where c.owner = auth.uid() and (annee is null or c.year = annee)
      and not exists (select 1 from public.teachings t
                      where t.class_id = c.id and t.teacher = auth.uid())
  )
  select m.id, m.name, m.level, m.cycle, m.filiere, m.year, m.code,
         nullif(m.matiere, ''), m.principal,
         (select count(*)::integer from public.class_members cm where cm.class_id = m.id),
         (select count(*)::integer from public.assignments a
          where a.class_id = m.id and a.created_by = auth.uid()),
         (select count(*)::integer from public.assignments a
          where a.class_id = m.id and a.created_by = auth.uid()
            and (a.due is null or a.due >= current_date)),
         (select count(*)::integer from public.class_members cm
          where cm.class_id = m.id
            and exists (select 1 from public.assignments a
                        where a.class_id = m.id and a.created_by = auth.uid()
                          and a.due < current_date
                          and not exists (select 1 from public.assignment_progress ap
                                          where ap.assignment_id = a.id
                                            and ap.user_id = cm.user_id
                                            and ap.done_at is not null))),
         coalesce(d.pas_ouvert, 0),
         (select count(*)::integer from public.class_members cm
          join auth.users u on u.id = cm.user_id
          where cm.class_id = m.id and u.last_sign_in_at is null),
         (select count(distinct s.user_id)::integer from public.sessions s
          join public.class_members cm on cm.user_id = s.user_id
          where cm.class_id = m.id and s.created_at > now() - interval '7 days'),
         coalesce(d.pct, 0), d.nom, d.due
  from mes m
  left join lateral (
    -- le dernier devoir que j'ai donné : c'est son état qui m'intéresse
    select (select count(*)::integer from public.class_members cm
            where cm.class_id = m.id
              and not exists (select 1 from public.assignment_progress ap
                              where ap.assignment_id = a.id and ap.user_id = cm.user_id)) as pas_ouvert,
           (select coalesce(round(avg(ap.pct)), 0)::integer from public.assignment_progress ap
            where ap.assignment_id = a.id and ap.pct > 0) as pct,
           a.name as nom, a.due
    from public.assignments a
    where a.class_id = m.id and a.created_by = auth.uid()
    order by a.created_at desc limit 1
  ) d on true
  order by public.niveau_rang(m.cycle, m.level), m.name
$$;

-- ── Une classe, élève par élève ─────────────────────────────────────────
-- ⚠ La première version n'avait pas `cm.class_id = cid` : sa clause `where`
-- ne contenait que le contrôle d'accès, et passé celui-ci elle rendait les
-- 2 070 élèves de la base. C'est ce qu'une politique RLS ne rattrape pas
-- sur une fonction SECURITY DEFINER.
create or replace function public.prof_roster(cid uuid)
returns table (user_id uuid, who text, handle text,
               rendus integer, donnes integer, pct integer, vu timestamptz,
               jamais boolean, pages7 integer, jours7 integer, retard integer)
language sql stable security definer set search_path = '' as $$
  select cm.user_id,
         coalesce(nullif(cm.who, ''), nullif(p.name, ''), p.handle, 'Élève'),
         p.handle,
         (select count(*)::integer from public.assignment_progress ap
          join public.assignments a on a.id = ap.assignment_id
          where a.class_id = cid and a.created_by = auth.uid()
            and ap.user_id = cm.user_id and ap.done_at is not null),
         (select count(*)::integer from public.assignments a
          where a.class_id = cid and a.created_by = auth.uid()),
         (select coalesce(round(avg(ap.pct)), 0)::integer from public.assignment_progress ap
          join public.assignments a on a.id = ap.assignment_id
          where a.class_id = cid and a.created_by = auth.uid()
            and ap.user_id = cm.user_id and ap.pct > 0),
         (select max(ap.done_at) from public.assignment_progress ap
          join public.assignments a on a.id = ap.assignment_id
          where a.class_id = cid and ap.user_id = cm.user_id),
         (select u.last_sign_in_at is null from auth.users u where u.id = cm.user_id),
         -- son activité réelle : des pages révisées, pas des connexions
         (select count(*)::integer from public.reviews r
          where r.user_id = cm.user_id and r.created_at > now() - interval '7 days'),
         (select count(distinct r.created_at::date)::integer from public.reviews r
          where r.user_id = cm.user_id and r.created_at > now() - interval '7 days'),
         (select count(*)::integer from public.assignments a
          where a.class_id = cid and a.created_by = auth.uid() and a.due < current_date
            and not exists (select 1 from public.assignment_progress ap
                            where ap.assignment_id = a.id and ap.user_id = cm.user_id
                              and ap.done_at is not null))
  from public.class_members cm
  join public.profiles p on p.id = cm.user_id
  where cm.class_id = cid
    and (public.teaches(cid)
      or exists (select 1 from public.classes c where c.id = cid and c.owner = auth.uid())
      or public.is_ref() or public.is_admin())
  order by 2
$$;

-- ── La fiche d'un élève : devoir par devoir, dans cette classe ──────────
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
    and (public.teaches(cid)
      or exists (select 1 from public.classes c where c.id = cid and c.owner = auth.uid())
      or public.is_ref() or public.is_admin())
  order by a.due desc nulls last, a.created_at desc
$$;

-- ── Les devoirs d'une classe, avec leur état ────────────────────────────
create or replace function public.prof_devoirs(cid uuid)
returns table (id uuid, nom text, matiere text, n integer, due date,
               donne timestamptz, mien boolean, auteur text,
               effectif integer, ouvert integer, rendu integer, pct integer)
language sql stable security definer set search_path = '' as $$
  select a.id, a.name, a.subject, a.n, a.due, a.created_at,
         a.created_by = auth.uid(),
         coalesce(nullif(p.name, ''), p.handle, 'un collègue'),
         (select count(*)::integer from public.class_members cm where cm.class_id = cid),
         (select count(*)::integer from public.assignment_progress ap where ap.assignment_id = a.id),
         (select count(*)::integer from public.assignment_progress ap
          where ap.assignment_id = a.id and ap.done_at is not null),
         (select coalesce(round(avg(ap.pct)), 0)::integer from public.assignment_progress ap
          where ap.assignment_id = a.id and ap.pct > 0)
  from public.assignments a
  left join public.profiles p on p.id = a.created_by
  where a.class_id = cid
    and (public.teaches(cid)
      or exists (select 1 from public.classes c where c.id = cid and c.owner = auth.uid())
      or public.is_ref() or public.is_admin())
  order by a.due desc nulls last, a.created_at desc
$$;

-- ── Les cartes qui bloquent ─────────────────────────────────────────────
-- L'app range dans chaque devoir des identifiants de carte stables
-- (« a:<devoir>:<rang> ») que l'élève garde en important le paquet. On peut
-- donc remonter, pour un devoir, ce que la classe rate le plus — la seule
-- chose qu'un professeur de langue veut savoir avant de reprendre son cours.
-- Des comptes, jamais des noms : qui s'est trompé ne le regarde pas.
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
  select v.rang, a.cards -> v.rang ->> 0, a.cards -> v.rang ->> 1,
         v.vues, v.ratees, v.eleves
  from vus v join a on true
  where v.ratees > 0
  order by v.ratees desc, v.vues desc
  limit 30
$$;

-- ── Donner un devoir, à une classe ou à cinq ────────────────────────────
-- Un professeur a trois sixièmes et le même chapitre pour les trois. Une
-- seule fonction, un seul aller-retour, et les cartes ne traversent le
-- réseau qu'une fois au lieu de trois.
create or replace function public.prof_give(
  cids uuid[], nom text, matiere text, cartes jsonb, jours integer default 7)
returns integer language plpgsql security definer set search_path = '' as $$
declare k uuid; n integer := 0; d date; nb integer;
begin
  if nullif(trim(coalesce(nom, '')), '') is null then raise exception 'Il faut un titre'; end if;
  nb := coalesce(jsonb_array_length(cartes), 0);
  if nb = 0 then raise exception 'Il faut au moins une carte'; end if;
  if nb > 300 then raise exception 'Trois cents cartes au maximum pour un devoir'; end if;
  d := current_date + greatest(0, least(coalesce(jours, 7), 180));
  foreach k in array cids loop
    if public.teaches(k)
       or exists (select 1 from public.classes c where c.id = k and c.owner = auth.uid()) then
      insert into public.assignments (class_id, name, cards, n, due, created_by, subject)
      values (k, trim(nom), cartes, nb, d, auth.uid(), nullif(trim(coalesce(matiere, '')), ''));
      n := n + 1;
    end if;
  end loop;
  if n = 0 then raise exception 'Aucune de ces classes n''est la tienne'; end if;
  return n;
end $$;

-- ── Repousser une échéance ──────────────────────────────────────────────
-- Le geste le plus banal d'un cahier de textes, et celui qu'on ne peut pas
-- faire en supprimant puis redonnant : l'avancement de ceux qui ont déjà
-- rendu serait perdu.
create or replace function public.prof_set_due(aid uuid, jours integer)
returns date language plpgsql security definer set search_path = '' as $$
declare d date;
begin
  if not exists (select 1 from public.assignments a
                 where a.id = aid and a.created_by = auth.uid()) then
    raise exception 'Ce devoir n''est pas le tien';
  end if;
  d := current_date + greatest(0, least(coalesce(jours, 7), 180));
  update public.assignments set due = d where id = aid;
  return d;
end $$;

-- ── Relancer ceux qui n'ont pas ouvert ──────────────────────────────────
-- Un mot dans leur courrier, à eux seuls. Ni notification ni e-mail :
-- l'app n'en envoie pas, et prétendre le contraire serait pire que rien.
create or replace function public.prof_relance(aid uuid, mot text default '')
returns integer language plpgsql security definer set search_path = '' as $$
declare a record; moi text; n integer := 0;
begin
  select x.id, x.class_id, x.name, x.due, x.cards into a
  from public.assignments x where x.id = aid and x.created_by = auth.uid();
  if a.id is null then raise exception 'Ce devoir n''est pas le tien'; end if;
  select coalesce(nullif(name, ''), handle, 'Ton professeur') into moi
  from public.profiles where id = auth.uid();
  insert into public.mail (from_user, to_user, from_name, deck_name, message, cards)
  select auth.uid(), cm.user_id, moi, a.name,
         coalesce(nullif(trim(mot), ''),
           'Tu n''as pas encore ouvert ce devoir'
           || case when a.due is not null then ', à rendre pour le ' || to_char(a.due, 'DD/MM')
                   else '' end || '.'),
         a.cards
  from public.class_members cm
  where cm.class_id = a.class_id
    and not exists (select 1 from public.assignment_progress ap
                    where ap.assignment_id = a.id and ap.user_id = cm.user_id);
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.prof_del_work(aid uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.assignments a
                 where a.id = aid and a.created_by = auth.uid()) then
    raise exception 'Ce devoir n''est pas le tien';
  end if;
  delete from public.assignments where id = aid;
end $$;

grant execute on function public.niveau_rang(text, text) to authenticated;
grant execute on function public.prof_annees() to authenticated;
grant execute on function public.prof_classes(text) to authenticated;
grant execute on function public.prof_roster(uuid) to authenticated;
grant execute on function public.prof_eleve(uuid, uuid) to authenticated;
grant execute on function public.prof_devoirs(uuid) to authenticated;
grant execute on function public.prof_cartes(uuid) to authenticated;
grant execute on function public.prof_give(uuid[], text, text, jsonb, integer) to authenticated;
grant execute on function public.prof_set_due(uuid, integer) to authenticated;
grant execute on function public.prof_relance(uuid, text) to authenticated;
grant execute on function public.prof_del_work(uuid) to authenticated;
