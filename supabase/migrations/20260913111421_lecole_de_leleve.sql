-- ══════════ l'école de l'élève ══════════
-- L'élève doit voir sa classe sous son pseudo, sans avoir à la chercher.
-- Deux fonctions, deux allers-retours, et l'écran sait tout : où il est
-- scolarisé, et qui lui fait cours.

-- Son établissement et sa classe. Le professeur n'est pas dans
-- `class_members` — il enseigne, il n'est pas inscrit — donc pour lui les
-- colonnes de classe reviennent vides, ce qui est juste : il en a plusieurs.
create or replace function public.my_school()
returns table (org_id uuid, org text, org_kind text, ville text,
               class_id uuid, classe text, niveau text, filiere text,
               cycle text, effectif integer, role text)
language sql stable security definer set search_path = '' as $$
  select o.id, o.name, o.kind, o.ville,
         c.id, c.name, c.level, c.filiere, c.cycle,
         (select count(*)::integer from public.class_members m where m.class_id = c.id),
         public.my_role()
  from public.org_members om
  join public.orgs o on o.id = om.org_id
  left join public.class_members cm on cm.user_id = om.user_id
  left join public.classes c on c.id = cm.class_id
  where om.user_id = auth.uid()
  order by c.created_at nulls last
  limit 1
$$;

-- Qui lui fait cours, et en quoi. Le nom du professeur seulement : ni son
-- adresse, ni son compte — l'élève n'a rien à en faire.
create or replace function public.my_class_team()
returns table (subject text, teacher text, principal boolean)
language sql stable security definer set search_path = '' as $$
  select t.subject,
         coalesce(nullif(p.name, ''), p.handle, 'Professeur'),
         coalesce(t.principal, false)
  from public.class_members cm
  join public.teachings t on t.class_id = cm.class_id
  left join public.profiles p on p.id = t.teacher
  where cm.user_id = auth.uid()
  order by coalesce(t.principal, false) desc, t.subject
$$;

grant execute on function public.my_school() to authenticated;
grant execute on function public.my_class_team() to authenticated;
