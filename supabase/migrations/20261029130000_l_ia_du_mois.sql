-- L'IA du mois, pour l'écran de création (2026-10-29) : ce que chacun a déjà
-- demandé depuis le 1er (en UTC, comme la fonction ai) et ce à quoi il a
-- droit. L'app pose, sur chaque façon de créer qui passe par l'IA (Fichier,
-- Prompt, Photo), le reste du mois ; un élève Campus à qui sa licence
-- n'accorde rien (quota 0) y voit ces onglets fermés, et pourquoi.
--
-- Le quota est celui que la fonction ai applique (supabase/functions/ai) :
-- celui de la licence s'il y en a une (ia_quota : un établissement ou un
-- professeur particulier, par professeur et par élève), sinon celui de
-- l'offre — 400 pour un professeur, 30 pour un élève en Mirandola+, rien
-- en Mirandola gratuit (l'IA y est fermée). ia_quota reste interne : on
-- n'en rend que sa propre ligne.
create or replace function public.mon_ia()
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare
  u uuid := auth.uid(); q integer; o text; prof boolean; fait integer;
begin
  if u is null then return null; end if;
  select count(*)::integer into fait from public.ai_usage a
  where a.user_id = u and a.day >= date_trunc('month', now() at time zone 'utc')::date;
  q := public.ia_quota(u);
  o := public.offre_de(u);
  prof := exists (select 1 from public.user_roles r where r.user_id = u and r.role in ('prof', 'ref', 'admin'));
  return jsonb_build_object(
    'fait', fait,
    'quota', coalesce(q, case when o = 'gratuit' then 0 when prof then 400 else 30 end),
    'licence', q is not null,
    'offre', o);
end $$;
revoke all on function public.mon_ia() from public, anon;
grant execute on function public.mon_ia() to authenticated;
