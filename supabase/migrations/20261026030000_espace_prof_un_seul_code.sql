-- ══════════ l'espace professeur au modèle « un seul code » (2026-10-26) ══════════
-- Trois retouches, pour que l'espace professeur parle comme le reste depuis
-- 20261026001000 (docs/PARCOURS.md) :
--
-- 1. prof_classes dit si une ligne est une classe ou un groupe (`genre`) :
--    un groupe se modifie (ses élèves), une classe de l'établissement non.
-- 2. Dans un établissement, les classes viennent du référent ; un
--    professeur forme des groupes. prof_creer_classe, appelée par une app
--    déjà installée (« Nouvelle classe »), crée donc un groupe : elle ne
--    peut plus glisser une classe de plus dans la liste que choisissent les
--    élèves en tapant le code.
-- 3. prof_code_etab() : le code élèves de son établissement, pour qu'un
--    professeur le projette devant sa classe. Il est fait pour circuler
--    parmi les élèves ; un professeur de l'établissement peut le lire. Le
--    code professeurs et le code référent restent au référent.

drop function if exists public.prof_classes(text);
create function public.prof_classes(annee text default null)
returns table (id uuid, name text, niveau text, cycle text, filiere text, annee_scolaire text, code text, matiere text,
               principal boolean, effectif integer, devoirs integer, encours integer, retard integer, pas_ouvert integer,
               jamais integer, actifs7 integer, pct integer, dernier text, dernier_due date, gere boolean, createur boolean,
               etab boolean, attente integer, archivee boolean, ouvert boolean, validation boolean, places integer,
               fin timestamptz, code_collegue text, fin_collegue timestamptz, genre text)
language sql stable security definer set search_path to '' as $$
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
         case when c.owner = auth.uid() and c.staff_until > now() then c.staff_until end,
         c.genre
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
revoke all on function public.prof_classes(text) from public, anon;
grant execute on function public.prof_classes(text) to authenticated;

create or replace function public.prof_creer_classe(nom text, niveau text default '', matiere text default '')
returns uuid language plpgsql security definer set search_path to '' as $$
declare k uuid; mat text; o uuid := public.my_org();
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
  -- dans un établissement : un groupe, jamais une classe de plus dans la liste des élèves
  insert into public.classes (name, level, year, code, owner, org_id, genre, join_open)
  values (trim(nom), left(trim(coalesce(niveau, '')), 40),
          case when extract(month from current_date) >= 8
               then extract(year from current_date)::text || '-' || (extract(year from current_date) + 1)::text
               else (extract(year from current_date) - 1)::text || '-' || extract(year from current_date)::text end,
          public.code_classe(), auth.uid(), o,
          case when o is null then 'classe' else 'groupe' end, o is null)
  returning id into k;
  insert into public.teachings (class_id, teacher, subject, principal) values (k, auth.uid(), mat, true);
  if o is not null then
    perform public.ref_trace(null, 'groupe créé par un professeur', jsonb_build_object('nom', trim(nom)));
  end if;
  return k;
end $$;
revoke all on function public.prof_creer_classe(text, text, text) from public, anon;
grant execute on function public.prof_creer_classe(text, text, text) to authenticated;

create or replace function public.prof_code_etab()
returns text language plpgsql stable security definer set search_path to '' as $$
declare o uuid := public.my_org(); s text;
begin
  if public.my_role() <> 'prof' or o is null then raise exception 'Réservé aux professeurs d''un établissement'; end if;
  select k.eleve into s from public.org_codes k where k.org_id = o;
  if s is null then raise exception 'Le référent n''a pas encore de code élèves'; end if;
  return s;
end $$;
revoke all on function public.prof_code_etab() from public, anon;
grant execute on function public.prof_code_etab() to authenticated;
