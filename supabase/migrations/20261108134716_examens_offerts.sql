-- L'examen blanc offert (2026-11-08).
--
-- Demandé : « l'utilisateur en Mirandola gratuit peut tester un examen IA
-- gratuit, et avec + il en débloque 1 de plus (pour faire 2) » ; Infini, sans
-- limite. La règle vit dans la fonction ai (_shared/rentabilite.js,
-- EXAMENS_OFFERTS) ; la base ne fait que compter, à vie : les sujets composés
-- (`examens`) et les copies corrigées (`corrections`) de ai_usage — une
-- génération annulée (ia_annuler) en sort, comme elle sort du mois.
--
-- ia_droits (rôle service seul) les rend à la fonction ai ; mon_ia (l'app)
-- rend `examens`, pour dire « 1 examen offert » avant qu'on le demande.
-- Rien d'autre ne bouge dans l'une ou l'autre.

create or replace function public.ia_droits(u uuid)
returns jsonb
language sql
stable security definer
set search_path to ''
as $function$
  select jsonb_build_object(
    'offre', public.offre_de(u),
    'niveau', public.niveau_de(u),
    'essai', coalesce((select c.statut = 'essai' from public.abonnement_courant(u) c), false)
             and public.offre_de(u) = 'plus',
    'prof', exists (select 1 from public.user_roles r where r.user_id = u and r.role in ('prof', 'ref', 'admin')),
    'licence', public.ia_quota(u),
    'fait', (select count(*) from public.ai_usage a
             where a.user_id = u and a.day >= date_trunc('month', now() at time zone 'utc')::date),
    'depense', public.ia_depense(u, date_trunc('month', now() at time zone 'utc')::date),
    'examens', (select count(*) from public.ai_usage a where a.user_id = u and a.op = 'examen'),
    'corrections', (select count(*) from public.ai_usage a where a.user_id = u and a.op = 'corriger'))
$function$;

revoke all on function public.ia_droits(uuid) from public, anon, authenticated;
grant execute on function public.ia_droits(uuid) to service_role;

create or replace function public.mon_ia()
returns jsonb
language plpgsql
stable security definer
set search_path to ''
as $function$
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
    'sans_compter', d->>'niveau' = 'infini' and not (d->>'essai')::boolean,
    'examens', (d->>'examens')::integer);
end $function$;

revoke all on function public.mon_ia() from public, anon;
grant execute on function public.mon_ia() to authenticated;
