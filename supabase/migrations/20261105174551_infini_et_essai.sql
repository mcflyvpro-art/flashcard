-- Mirandola Infini et l'essai de 7 jours (décidés le 2026-11-05).
--
-- Deux niveaux payants : Mirandola+ (formules annuel, mensuel) et Mirandola
-- Infini (infini_annuel, infini_mensuel), au-dessus. L'offre reste « plus »
-- pour les deux (abonnements.offre, offre_de) : tout ce que Mirandola+
-- ouvre, Infini l'ouvre aussi, et rien de ce qui lit l'offre n'a à changer.
-- Le niveau s'ajoute à côté :
--   - niveau_de(u)  (interne) : 'infini' si un abonnement Infini court, sinon
--                    l'offre (gratuit, plus, campus) ;
--   - mon_offre()   rend aussi `niveau` ;
--   - mon_ia()      rend le quota du niveau : Infini, 150 générations du
--                    meilleur modèle puis sans compter (`sans_compter`) ;
--                    pendant l'essai, 10 (l'IA coûte, l'essai est gratuit) ;
--   - ia_droits(u)  (rôle service seul) : ce que la fonction ai doit savoir
--                    d'un compte en une lecture — offre, niveau, essai,
--                    professeur, quota de licence.
-- Rien ne change pour un compte qui n'a ni Infini ni essai.

alter table public.abonnements drop constraint if exists abonnements_formule_check;
alter table public.abonnements add constraint abonnements_formule_check
  check (formule = any (array['annuel', 'mensuel', 'infini_annuel', 'infini_mensuel']));

-- l'abonnement qui court, pour un compte : le plus favorable d'abord (Infini avant Mirandola+)
create or replace function public.abonnement_courant(u uuid)
returns table (statut text, formule text, source text)
language sql stable security definer
set search_path = ''
as $$
  select a.statut, a.formule, a.source from public.abonnements a
  where a.user_id = u and public.abonnement_ouvre(a.statut, a.fin_periode)
  order by coalesce(a.formule like 'infini%', false) desc, (a.statut = 'essai') asc, a.fin_periode desc nulls first
  limit 1
$$;
revoke all on function public.abonnement_courant(uuid) from public, anon, authenticated;

create or replace function public.niveau_de(u uuid)
returns text
language sql stable security definer
set search_path = ''
as $$
  select case
    when public.offre_de(u) = 'campus' then 'campus'
    when exists (select 1 from public.abonnement_courant(u) c where c.formule like 'infini%') then 'infini'
    else public.offre_de(u) end
$$;
revoke all on function public.niveau_de(uuid) from public, anon, authenticated;

-- mon_offre : la même réponse, et le niveau
create or replace function public.mon_offre()
returns jsonb
language sql stable security definer
set search_path = ''
as $$
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
    order by public.abonnement_ouvre(a.statut, a.fin_periode) desc, coalesce(a.formule like 'infini%', false) desc,
      a.fin_periode desc nulls first, a.maj_le desc
    limit 1
  )
  select jsonb_build_object(
    'offre', public.offre_de(auth.uid()),
    'niveau', public.niveau_de(auth.uid()),
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

-- ce que la fonction ai doit savoir d'un compte, en une lecture (rôle service)
create or replace function public.ia_droits(u uuid)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'offre', public.offre_de(u),
    'niveau', public.niveau_de(u),
    'essai', coalesce((select c.statut = 'essai' from public.abonnement_courant(u) c), false)
             and public.offre_de(u) = 'plus',
    'prof', exists (select 1 from public.user_roles r where r.user_id = u and r.role in ('prof', 'ref', 'admin')),
    'licence', public.ia_quota(u))
$$;
revoke all on function public.ia_droits(uuid) from public, anon, authenticated;
grant execute on function public.ia_droits(uuid) to service_role;

-- mon_ia : le quota du niveau (Infini : 150 du meilleur modèle, puis sans compter ; l'essai : 10)
create or replace function public.mon_ia()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  u uuid := auth.uid(); d jsonb; fait integer; q integer;
begin
  if u is null then return null; end if;
  select count(*)::integer into fait from public.ai_usage a
  where a.user_id = u and a.day >= date_trunc('month', now() at time zone 'utc')::date;
  d := public.ia_droits(u);
  q := case
    when d->>'licence' is not null then (d->>'licence')::integer
    when d->>'offre' = 'gratuit' then 0
    when (d->>'essai')::boolean then 10
    when d->>'niveau' = 'infini' then 150
    when (d->>'prof')::boolean then 400
    else 30 end;
  return jsonb_build_object('fait', fait, 'quota', q, 'licence', d->>'licence' is not null,
    'offre', d->>'offre', 'niveau', d->>'niveau', 'essai', (d->>'essai')::boolean,
    'sans_compter', d->>'niveau' = 'infini' and not (d->>'essai')::boolean);
end $$;
revoke all on function public.mon_ia() from public, anon;
grant execute on function public.mon_ia() to authenticated;
