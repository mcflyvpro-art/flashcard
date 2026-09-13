-- Un professeur de mathématiques n'a aucune raison de pouvoir énumérer les
-- six cent cinquante élèves du lycée. Il voit ses collègues — il travaille
-- avec eux — et les élèves à qui il enseigne. Rien de plus.
-- Le référent, lui, voit tout son établissement : c'est son métier.
drop policy if exists om_read on public.org_members;
create policy om_read on public.org_members for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_admin()
    or (org_id = public.my_org() and public.my_role() = 'ref')
    or (org_id = public.my_org() and public.my_role() in ('prof','ref')
        and exists (select 1 from public.user_roles r
                    where r.user_id = org_members.user_id and r.role in ('prof','ref')))
    or (public.my_role() = 'prof'
        and exists (select 1 from public.class_members cm
                    join public.teachings t on t.class_id = cm.class_id
                    where cm.user_id = org_members.user_id and t.teacher = (select auth.uid())))
  );
