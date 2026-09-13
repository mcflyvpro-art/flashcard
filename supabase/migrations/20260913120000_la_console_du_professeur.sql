-- ══════════ la console du professeur ══════════
-- Un professeur de collège tient dix classes et voit trois cents élèves
-- par semaine. Lui rendre des listes brutes, c'est lui demander de faire
-- lui-même le comptage : il ne le fera pas, et l'outil ne servira pas.
--
-- Ces fonctions rendent donc des chiffres déjà faits. Une classe se lit en
-- une ligne — combien d'élèves, combien de devoirs en cours, combien
-- traînent — et l'écran n'a plus qu'à les poser. Tout le comptage se fait
-- ici, où les index sont, et pas dans le téléphone.
--
-- Chacune vérifie elle-même qui appelle : `teaches()` dit si on enseigne
-- dans la classe, `classes.owner` si on l'a créée. L'un ou l'autre suffit,
-- et rien d'autre n'ouvre la porte. Ces fonctions sont SECURITY DEFINER :
-- la politique RLS ne les rattrapera pas si elles se trompent, elles n'ont
-- donc pas le droit de se tromper.

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

-- ── Mes classes, une ligne chacune ──────────────────────────────────────
-- Les compteurs portent sur les devoirs que CE professeur a donnés, pas
-- sur ceux de la classe : un professeur de mathématiques qui lit
-- « 14 devoirs » pour une 6e où il en a donné deux a reçu une réponse
-- juste à une question qu'il ne posait pas.
--
-- `retard` compte des élèves, pas des devoirs. Savoir que huit devoirs
-- échus ne sont pas rendus par quelqu'un n'aide personne ; savoir que
-- seize élèves traînent, si — c'est à eux qu'on parle en début de cours.
create or replace function public.prof_classes()
returns table (id uuid, name text, niveau text, cycle text, filiere text,
               matiere text, principal boolean, effectif integer,
               devoirs integer, encours integer, retard integer,
               pas_ouvert integer, pct integer)
language sql stable security definer set search_path = '' as $$
  with mes as (
    select c.id, c.name, c.level, c.cycle, c.filiere,
           string_agg(distinct t.subject, ' · ') as matiere,
           bool_or(coalesce(t.principal, false)) as principal
    from public.classes c
    join public.teachings t on t.class_id = c.id
    where t.teacher = auth.uid()
    group by c.id, c.name, c.level, c.cycle, c.filiere
    union
    select c.id, c.name, c.level, c.cycle, c.filiere, '', true
    from public.classes c
    where c.owner = auth.uid()
      and not exists (select 1 from public.teachings t
                      where t.class_id = c.id and t.teacher = auth.uid())
  )
  select m.id, m.name, m.level, m.cycle, m.filiere,
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
         coalesce(d.pas_ouvert, 0), coalesce(d.pct, 0)
  from mes m
  left join lateral (
    -- le dernier devoir que j'ai donné : c'est son état qui m'intéresse
    select (select count(*)::integer from public.class_members cm
            where cm.class_id = m.id
              and not exists (select 1 from public.assignment_progress ap
                              where ap.assignment_id = a.id and ap.user_id = cm.user_id)) as pas_ouvert,
           (select coalesce(round(avg(ap.pct)), 0)::integer from public.assignment_progress ap
            where ap.assignment_id = a.id and ap.pct > 0) as pct
    from public.assignments a
    where a.class_id = m.id and a.created_by = auth.uid()
    order by a.created_at desc
    limit 1
  ) d on true
  order by public.niveau_rang(m.cycle, m.level), m.name
$$;

-- ── Une classe, élève par élève ─────────────────────────────────────────
-- Combien de devoirs rendus sur combien donnés, et le taux moyen. Jamais
-- le détail carte par carte, jamais les horaires : suivre une classe n'est
-- pas surveiller quelqu'un.
--
-- ⚠ La première version de cette fonction n'avait pas la ligne
-- `cm.class_id = cid` : sa clause `where` ne contenait que le contrôle
-- d'accès, et passé celui-ci elle rendait les 2 070 élèves de la base en
-- attribuant à chacun les devoirs de la classe demandée. Le contrôle
-- d'accès était bon ; la requête ne l'était pas. C'est précisément ce
-- qu'une politique RLS ne rattrape pas sur une fonction SECURITY DEFINER.
create or replace function public.prof_roster(cid uuid)
returns table (user_id uuid, who text, handle text,
               rendus integer, donnes integer, pct integer, vu timestamptz)
language sql stable security definer set search_path = '' as $$
  select cm.user_id,
         coalesce(nullif(cm.who, ''), nullif(p.name, ''), p.handle, 'Élève'),
         p.handle,
         (select count(*)::integer from public.assignment_progress ap
          join public.assignments a on a.id = ap.assignment_id
          where a.class_id = cid and ap.user_id = cm.user_id and ap.done_at is not null),
         (select count(*)::integer from public.assignments a where a.class_id = cid),
         (select coalesce(round(avg(ap.pct)), 0)::integer from public.assignment_progress ap
          join public.assignments a on a.id = ap.assignment_id
          where a.class_id = cid and ap.user_id = cm.user_id and ap.pct > 0),
         (select max(ap.done_at) from public.assignment_progress ap
          join public.assignments a on a.id = ap.assignment_id
          where a.class_id = cid and ap.user_id = cm.user_id)
  from public.class_members cm
  join public.profiles p on p.id = cm.user_id
  where cm.class_id = cid
    and (public.teaches(cid)
      or exists (select 1 from public.classes c where c.id = cid and c.owner = auth.uid())
      or public.is_ref() or public.is_admin())
  order by 2
$$;

-- ── Ce qui bloque, toutes classes confondues ────────────────────────────
-- Le premier écran que le professeur ouvre en arrivant : ce qui demande
-- une décision maintenant. Un devoir dont l'échéance approche et que la
-- moitié de la classe n'a pas ouvert se rattrape en cours ; découvert une
-- semaine plus tard, non.
create or replace function public.prof_alertes()
returns table (class_id uuid, classe text, niveau text,
               assignment_id uuid, devoir text, due date,
               effectif integer, ouvert integer, rendu integer, pct integer)
language sql stable security definer set search_path = '' as $$
  select c.id, c.name, c.level, a.id, a.name, a.due,
         (select count(*)::integer from public.class_members cm where cm.class_id = c.id),
         (select count(*)::integer from public.assignment_progress ap where ap.assignment_id = a.id),
         (select count(*)::integer from public.assignment_progress ap
          where ap.assignment_id = a.id and ap.done_at is not null),
         (select coalesce(round(avg(ap.pct)), 0)::integer from public.assignment_progress ap
          where ap.assignment_id = a.id and ap.pct > 0)
  from public.assignments a
  join public.classes c on c.id = a.class_id
  where a.created_by = auth.uid()
    and (a.due is null or a.due >= current_date - 14)
  order by a.due nulls last, c.name
  limit 60
$$;

grant execute on function public.niveau_rang(text, text) to authenticated;
grant execute on function public.prof_classes() to authenticated;
grant execute on function public.prof_roster(uuid) to authenticated;
grant execute on function public.prof_alertes() to authenticated;
