-- ══════════ La console du référent compte aussi les référents (2026-10-29) ══════════
-- Depuis 20261029090000, un référent prend une place de la licence comme un
-- élève et un professeur (etab_places_prises). ref_codes() rend donc aussi
-- le nombre de référents, pour que la tuile de la licence dise juste
-- (« 299 places · 0 libre » plutôt que 1). Le reste est recopié de
-- 20261026110000, sans changement.
create or replace function public.ref_codes()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare o uuid := public.my_org(); x public.orgs%rowtype; c public.org_codes%rowtype;
begin
  if not public.is_ref() or o is null then raise exception 'Réservé au référent de l''établissement'; end if;
  insert into public.org_codes (org_id) values (o) on conflict do nothing;
  update public.org_codes set eleve = coalesce(eleve, public.code_unique()),
                              prof = coalesce(prof, public.code_unique()),
                              eleve_au = case when eleve is null then now() else eleve_au end,
                              prof_au = case when prof is null then now() else prof_au end
  where org_id = o and (eleve is null or prof is null);
  select * into c from public.org_codes where org_id = o;
  select * into x from public.orgs where id = o;
  return jsonb_build_object('eleve', c.eleve, 'prof', c.prof, 'offre', x.offre,
    'places', x.places, 'licence_fin', x.licence_fin, 'eleves', public.etab_eleves(o),
    'profs', (select count(*) from public.org_members m join public.user_roles r on r.user_id = m.user_id
              where m.org_id = o and r.role = 'prof'),
    'refs', (select count(*) from public.org_members m join public.user_roles r on r.user_id = m.user_id
             where m.org_id = o and r.role = 'ref'),
    'rythme', c.rythme,
    'eleve_jusqua', c.eleve_au + public.duree_rythme(c.rythme),
    'prof_jusqua', c.prof_au + public.duree_rythme(c.rythme));
end $$;
revoke all on function public.ref_codes() from public, anon;
grant execute on function public.ref_codes() to authenticated;
