-- ══════════ Correctif de 20261029090000 : Mirandola (2026-10-29) ══════════
-- 20261029090000 a été écrite avant la migration Mirandola (20261028090000,
-- appliquée par une autre session) et appliquée après elle : sa mon_offre()
-- perdait le `montant` de l'abonnement, et trois de ses messages disaient
-- encore « Folio » (ref_new_account, prof_admettre, prof_commander).
--
-- mon_offre() réunit les deux : le montant de 20261028090000 et le
-- professeur particulier de 20261029090000. Puis, comme 20261028090000, chaque
-- fonction qui dit encore « Folio » est réécrite depuis sa propre définition,
-- le mot seul remplacé (signature, propriétaire et droits ne bougent pas).

create or replace function public.mon_offre()
returns jsonb language sql stable security definer set search_path to '' as $$
  with etab as (
    select o.name, o.licence_fin
    from public.org_members m
    join public.orgs o on o.id = m.org_id
    where m.user_id = auth.uid() and (o.licence_fin is null or o.licence_fin >= current_date)
    limit 1
  ), pp as (
    select public.campus_prof(auth.uid()) as p
  ), ab as (
    select a.* from public.abonnements a where a.user_id = auth.uid()
    order by public.abonnement_ouvre(a.statut, a.fin_periode) desc, a.fin_periode desc nulls first, a.maj_le desc
    limit 1
  )
  select jsonb_build_object(
    'offre', public.offre_de(auth.uid()),
    'etablissement', (select name from etab),
    'professeur', (select coalesce(nullif(pr.name, ''), pr.handle) from pp join public.profiles pr on pr.id = pp.p
                   where pp.p <> auth.uid() and not exists (select 1 from etab)),
    'licence_fin', coalesce((select licence_fin from etab),
                            (select l.fin from pp join public.prof_licences l on l.prof = pp.p)),
    'abonnement', (select jsonb_build_object('statut', ab.statut, 'formule', ab.formule, 'source', ab.source,
                     'fin_periode', ab.fin_periode, 'fin_prevue', ab.fin_prevue, 'montant', ab.montant) from ab))
  where auth.uid() is not null
$$;
revoke all on function public.mon_offre() from public, anon;
grant execute on function public.mon_offre() to authenticated;

do $$
declare f record;
begin
  for f in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    left join pg_depend d on d.objid = p.oid and d.deptype = 'e'
    where n.nspname = 'public' and p.prokind in ('f', 'p') and d.objid is null
      and p.prosrc like '%Folio%'
  loop
    execute replace(pg_get_functiondef(f.oid), 'Folio', 'Mirandola');
  end loop;
end $$;
