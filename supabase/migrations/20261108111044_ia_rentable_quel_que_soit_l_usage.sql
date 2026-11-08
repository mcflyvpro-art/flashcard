-- L'IA rentable quel que soit l'usage (2026-11-08, demandé : « calcule
-- toujours la rentabilité, pour que peu importe l'utilisation ce soit
-- rentable »). Un nombre de générations par mois ne bornait pas ce qu'un mois
-- coûte : une génération peut coûter de quelques dixièmes de cent à deux
-- dollars (un PDF de 20 Mo), et Infini continue sans limite de nombre.
--
-- Désormais la fonction ai passe à ia_reserver un PLAFOND DE COÛT par compte
-- et par mois (cents de dollar, calculé par supabase/functions/_shared/
-- rentabilite.js : la moitié de ce que le compte rapporte au pire) et le PIRE
-- COÛT de la génération qu'elle va lancer (son entrée comptée, sa sortie au
-- maximum permis). La réservation porte ce pire coût (`estime`) jusqu'à ce
-- que l'appel soit soldé : cinquante appels lancés ensemble ne passent pas
-- plus que le plafond. Une réservation que personne n'a soldée (une fonction
-- tombée en route) cesse de compter au bout de dix minutes — une fonction vit
-- 150 s au plus. ia_droits rend aussi le nombre et la dépense du mois : la
-- fonction choisit le modèle (le meilleur, puis le plus économe passé les
-- trois quarts du plafond) avant de réserver.
--
-- Une app d'avant ne voit rien changer ; la fonction d'avant appelle
-- ia_reserver sans ces deux arguments, servie pareil (ils valent nul et zéro).

alter table public.ai_usage add column if not exists estime numeric not null default 0;
alter table public.ai_usage drop constraint if exists ai_usage_estime;
alter table public.ai_usage add constraint ai_usage_estime check (estime >= 0);

-- ce qu'un compte a dépensé ce mois-ci : ce qui est soldé, et ce qui est en vol depuis moins de dix minutes
create or replace function public.ia_depense(u uuid, p_mois date)
returns numeric language sql stable security definer set search_path = '' as $$
  select coalesce(sum(a.cents), 0) + coalesce(sum(a.estime) filter (where a.created_at > now() - interval '10 minutes'), 0)
  from public.ai_usage a where a.user_id = u and a.day >= p_mois
$$;
revoke all on function public.ia_depense(uuid, date) from public, anon, authenticated;

create or replace function public.ia_droits(u uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'offre', public.offre_de(u),
    'niveau', public.niveau_de(u),
    'essai', coalesce((select c.statut = 'essai' from public.abonnement_courant(u) c), false)
             and public.offre_de(u) = 'plus',
    'prof', exists (select 1 from public.user_roles r where r.user_id = u and r.role in ('prof', 'ref', 'admin')),
    'licence', public.ia_quota(u),
    -- le mois en cours (UTC, comme la fonction ai) : combien, et ce que ça a coûté
    'fait', (select count(*) from public.ai_usage a
             where a.user_id = u and a.day >= date_trunc('month', now() at time zone 'utc')::date),
    'depense', public.ia_depense(u, date_trunc('month', now() at time zone 'utc')::date))
$$;

drop function if exists public.ia_reserver(uuid, text, date, date, integer, integer, integer, numeric);
create function public.ia_reserver(u uuid, p_op text, p_jour date, p_mois date, p_mensuel integer,
                                   p_par_jour integer, p_fichiers_par_jour integer, p_budget_cents numeric,
                                   p_plafond_cents numeric default null, p_estime_cents numeric default 0)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  j integer; m integer; f integer; depense numeric; mien numeric; rid bigint;
  fichier boolean := p_op in ('ocr', 'pdf');
  estime numeric := greatest(0, coalesce(p_estime_cents, 0));
begin
  -- un compte à la fois : deux appels lancés ensemble ne lisent plus le même compte
  perform pg_advisory_xact_lock(hashtextextended('ia_reserver:' || u::text, 0));
  select count(*) filter (where a.day = p_jour),
         count(*),
         count(*) filter (where a.day = p_jour and a.op in ('ocr', 'pdf'))
    into j, m, f
    from public.ai_usage a where a.user_id = u and a.day >= p_mois;
  if p_mensuel is not null and m >= p_mensuel then
    return jsonb_build_object('statut', 'mquota', 'fait', m, 'quota', p_mensuel);
  end if;
  -- le plafond de ce compte : ce qu'il a dépensé, ce qui est en vol, et le pire de cet appel
  if p_plafond_cents is not null then
    mien := public.ia_depense(u, p_mois);
    if mien + estime > p_plafond_cents then
      return jsonb_build_object('statut', 'plafond', 'fait', m, 'reste', greatest(0, p_plafond_cents - mien));
    end if;
  end if;
  select coalesce(sum(a.cents), 0) into depense from public.ai_usage a where a.day >= p_mois;
  if depense >= p_budget_cents then return jsonb_build_object('statut', 'budget', 'fait', m); end if;
  if j >= p_par_jour then return jsonb_build_object('statut', 'quota', 'fait', m); end if;
  if fichier and f >= p_fichiers_par_jour then return jsonb_build_object('statut', 'fquota', 'fait', m); end if;
  insert into public.ai_usage (user_id, day, op, in_tok, out_tok, cents, estime)
  values (u, p_jour, p_op, 0, 0, 0, estime) returning id into rid;
  return jsonb_build_object('statut', 'ok', 'id', rid, 'fait', m, 'jour', j, 'fichiers', f);
end $$;

-- le coût réel remplace le pire réservé
create or replace function public.ia_solder(rid bigint, p_in integer, p_out integer, p_cents numeric)
returns void language sql security definer set search_path = '' as $$
  update public.ai_usage set in_tok = greatest(0, p_in), out_tok = greatest(0, p_out), cents = greatest(0, p_cents), estime = 0
  where id = rid;
$$;

revoke all on function public.ia_reserver(uuid, text, date, date, integer, integer, integer, numeric, numeric, numeric) from public, anon, authenticated;
revoke all on function public.ia_solder(bigint, integer, integer, numeric) from public, anon, authenticated;
revoke all on function public.ia_droits(uuid) from public, anon, authenticated;
grant execute on function public.ia_reserver(uuid, text, date, date, integer, integer, integer, numeric, numeric, numeric) to service_role;
grant execute on function public.ia_solder(bigint, integer, integer, numeric) to service_role;
grant execute on function public.ia_droits(uuid) to service_role;
grant execute on function public.ia_depense(uuid, date) to service_role;
