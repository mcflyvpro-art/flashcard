-- ══════════ le référent d'établissement — ce qu'il voit ══════════
-- Entre le professeur, qui ne connaît que ses classes, et l'éditeur, qui
-- ne doit jamais entrer dans un établissement, il manquait quelqu'un : la
-- personne qui, dans le lycée, ouvre les comptes, refait les mots de passe
-- oubliés et déplace un élève de la 2nde 3 à la 2nde 1 en octobre.
--
-- Ce rôle a beaucoup de pouvoir, et exactement dans un périmètre : son
-- établissement. Chaque fonction le vérifie elle-même — `is_ref()` pour le
-- rôle, l'appartenance à `my_org()` pour la cible — parce qu'elles sont
-- SECURITY DEFINER et que RLS ne les rattrapera pas.
--
-- Ce fichier ne contient que la lecture. L'écriture, qui touche à des
-- comptes d'élèves mineurs, vit dans le fichier suivant avec sa trace.

-- ── L'établissement d'un coup d'œil ─────────────────────────────────────
create or replace function public.ref_dashboard()
returns table (org_id uuid, org text, kind text, ville text, uai text,
               classes integer, eleves integer, profs integer, refs integer,
               services integer, devoirs integer,
               actifs7 integer, jamais_venus integer,
               sans_classe integer, classes_vides integer, sans_pp integer)
language sql stable security definer set search_path = '' as $$
  with o as (select id, name, kind, ville, uai from public.orgs
             where id = public.my_org() and public.is_ref())
  select o.id, o.name, o.kind, o.ville, o.uai,
    (select count(*)::integer from public.classes c where c.org_id = o.id),
    (select count(*)::integer from public.org_members m
     join public.user_roles r on r.user_id = m.user_id
     where m.org_id = o.id and r.role = 'eleve'),
    (select count(*)::integer from public.org_members m
     join public.user_roles r on r.user_id = m.user_id
     where m.org_id = o.id and r.role = 'prof'),
    (select count(*)::integer from public.org_members m
     join public.user_roles r on r.user_id = m.user_id
     where m.org_id = o.id and r.role = 'ref'),
    (select count(*)::integer from public.teachings t
     join public.classes c on c.id = t.class_id where c.org_id = o.id),
    (select count(*)::integer from public.assignments a
     join public.classes c on c.id = a.class_id where c.org_id = o.id),
    -- qui a révisé ces sept derniers jours : la seule mesure d'usage réel
    (select count(distinct s.user_id)::integer from public.sessions s
     join public.org_members m on m.user_id = s.user_id
     where m.org_id = o.id and s.created_at > now() - interval '7 days'),
    -- les comptes ouverts et jamais utilisés : c'est là que le déploiement
    -- se joue, et personne ne le sait sans ce chiffre
    (select count(*)::integer from public.org_members m
     join auth.users u on u.id = m.user_id
     where m.org_id = o.id and u.last_sign_in_at is null),
    (select count(*)::integer from public.org_members m
     join public.user_roles r on r.user_id = m.user_id
     where m.org_id = o.id and r.role = 'eleve'
       and not exists (select 1 from public.class_members cm where cm.user_id = m.user_id)),
    (select count(*)::integer from public.classes c where c.org_id = o.id
       and not exists (select 1 from public.class_members cm where cm.class_id = c.id)),
    (select count(*)::integer from public.classes c where c.org_id = o.id
       and not exists (select 1 from public.teachings t
                       where t.class_id = c.id and t.principal))
  from o
$$;

-- ── L'annuaire, filtré et paginé ────────────────────────────────────────
-- Deux mille élèves ne se font pas défiler. On cherche par nom, par pseudo
-- ou par adresse, on filtre par rôle et par classe, et on reçoit une page.
-- `total` revient avec chaque page : sans lui, l'écran ne peut pas dire
-- « 47 résultats » et l'utilisateur ne sait pas s'il doit affiner.
create or replace function public.ref_people(
  q text default '', qrole text default '', qclass uuid default null,
  lim integer default 50, off integer default 0)
returns table (id uuid, email text, handle text, name text, role text,
               classe text, class_id uuid, matiere text,
               derniere timestamptz, jamais boolean, total bigint)
language sql stable security definer set search_path = '' as $$
  with base as (
    select p.id, p.email, p.handle,
           coalesce(nullif(p.name, ''), p.handle, p.email) as name,
           coalesce(r.role, 'eleve') as role,
           c.name as classe, c.id as class_id,
           nullif(m.subject, '') as matiere,
           u.last_sign_in_at as derniere,
           u.last_sign_in_at is null as jamais
    from public.org_members m
    join public.profiles p on p.id = m.user_id
    join auth.users u on u.id = m.user_id
    left join public.user_roles r on r.user_id = m.user_id
    left join public.class_members cm on cm.user_id = m.user_id
    left join public.classes c on c.id = cm.class_id
    where public.is_ref() and m.org_id = public.my_org()
      and (qrole = '' or coalesce(r.role, 'eleve') = qrole)
      and (qclass is null or cm.class_id = qclass)
      and (q = '' or p.email ilike '%' || q || '%'
           or coalesce(p.handle, '') ilike '%' || q || '%'
           or coalesce(p.name, '') ilike '%' || q || '%')
  )
  select b.*, count(*) over () from base b
  order by b.role, b.name
  limit greatest(1, least(coalesce(lim, 50), 200)) offset greatest(0, coalesce(off, 0))
$$;

-- ── Les classes de l'établissement ──────────────────────────────────────
create or replace function public.ref_classes()
returns table (id uuid, name text, niveau text, cycle text, filiere text,
               code text, annee text, effectif integer, prevu integer,
               profs integer, pp text, devoirs integer, actifs7 integer)
language sql stable security definer set search_path = '' as $$
  select c.id, c.name, c.level, c.cycle, c.filiere, c.code, c.year,
    (select count(*)::integer from public.class_members cm where cm.class_id = c.id),
    c.effectif,
    (select count(distinct t.teacher)::integer from public.teachings t where t.class_id = c.id),
    (select coalesce(nullif(p.name, ''), p.handle) from public.teachings t
     join public.profiles p on p.id = t.teacher
     where t.class_id = c.id and t.principal limit 1),
    (select count(*)::integer from public.assignments a where a.class_id = c.id),
    (select count(distinct s.user_id)::integer from public.sessions s
     join public.class_members cm on cm.user_id = s.user_id
     where cm.class_id = c.id and s.created_at > now() - interval '7 days')
  from public.classes c
  where public.is_ref() and c.org_id = public.my_org()
  order by public.niveau_rang(c.cycle, c.level), c.name
$$;

-- ── Une classe en détail : qui y enseigne ───────────────────────────────
create or replace function public.ref_class_team(cid uuid)
returns table (teaching_id uuid, teacher uuid, nom text, matiere text, principal boolean)
language sql stable security definer set search_path = '' as $$
  select t.id, t.teacher, coalesce(nullif(p.name, ''), p.handle, p.email),
         t.subject, coalesce(t.principal, false)
  from public.teachings t
  join public.profiles p on p.id = t.teacher
  where t.class_id = cid and public.is_ref() and public.class_in_org(cid)
  order by coalesce(t.principal, false) desc, t.subject
$$;

-- ── Le service d'un professeur : ce qu'il enseigne, et où ───────────────
create or replace function public.ref_service(uid uuid)
returns table (teaching_id uuid, class_id uuid, classe text, niveau text,
               matiere text, principal boolean, effectif integer)
language sql stable security definer set search_path = '' as $$
  select t.id, c.id, c.name, c.level, t.subject, coalesce(t.principal, false),
         (select count(*)::integer from public.class_members cm where cm.class_id = c.id)
  from public.teachings t
  join public.classes c on c.id = t.class_id
  where t.teacher = uid and public.is_ref() and c.org_id = public.my_org()
  order by public.niveau_rang(c.cycle, c.level), c.name
$$;

grant execute on function public.ref_dashboard() to authenticated;
grant execute on function public.ref_people(text, text, uuid, integer, integer) to authenticated;
grant execute on function public.ref_classes() to authenticated;
grant execute on function public.ref_class_team(uuid) to authenticated;
grant execute on function public.ref_service(uuid) to authenticated;
