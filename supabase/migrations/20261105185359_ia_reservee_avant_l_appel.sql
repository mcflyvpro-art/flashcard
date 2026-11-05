-- L'IA réservée avant l'appel (session de débogage du 2026-11-05).
--
-- La fonction `ai` comptait les générations du jour et du mois, appelait
-- Anthropic (des secondes, parfois des dizaines), puis seulement écrivait sa
-- ligne dans `ai_usage`. Cinquante appels lancés ensemble par un même
-- compte lisaient donc tous « sous le quota » et passaient tous : un seul
-- compte payant, avec un script, pouvait vider le budget du mois de tout le
-- monde (AI_BUDGET_USD) — l'IA en panne pour chacun jusqu'au mois suivant.
--
-- `ia_reserver` fait le contrôle et l'écriture d'un seul tenant, un compte à
-- la fois (verrou consultatif de transaction, par compte) : le quota du
-- mois, le budget global, le quota du jour, celui des photos et PDF ; puis
-- la ligne est posée à zéro, réservée. La fonction `ai` y écrit ensuite les
-- jetons et le coût (`ia_solder`), ou la retire si l'appel échoue
-- (`ia_annuler`) : une panne ne compte toujours pas. Une ligne réservée
-- dont l'appel n'est jamais revenu (fonction tuée à 150 s) reste comptée
-- à zéro centime : elle tient sa place dans le quota, ce qui est le bon
-- côté de l'erreur.
--
-- Rôle service seul : rien de tout cela n'est ouvert à un compte.

create or replace function public.ia_reserver(u uuid, p_op text, p_jour date, p_mois date,
  p_mensuel integer, p_par_jour integer, p_fichiers_par_jour integer, p_budget_cents numeric)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  j integer; m integer; f integer; depense numeric; rid bigint;
  fichier boolean := p_op in ('ocr', 'pdf');
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
  select coalesce(sum(a.cents), 0) into depense from public.ai_usage a where a.day >= p_mois;
  if depense >= p_budget_cents then return jsonb_build_object('statut', 'budget', 'fait', m); end if;
  if j >= p_par_jour then return jsonb_build_object('statut', 'quota', 'fait', m); end if;
  if fichier and f >= p_fichiers_par_jour then return jsonb_build_object('statut', 'fquota', 'fait', m); end if;
  insert into public.ai_usage (user_id, day, op, in_tok, out_tok, cents)
  values (u, p_jour, p_op, 0, 0, 0) returning id into rid;
  return jsonb_build_object('statut', 'ok', 'id', rid, 'fait', m, 'jour', j, 'fichiers', f);
end $$;

create or replace function public.ia_solder(rid bigint, p_in integer, p_out integer, p_cents numeric)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.ai_usage set in_tok = greatest(0, p_in), out_tok = greatest(0, p_out), cents = greatest(0, p_cents)
  where id = rid;
$$;

create or replace function public.ia_annuler(rid bigint)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.ai_usage where id = rid and cents = 0 and in_tok = 0 and out_tok = 0;
$$;

revoke all on function public.ia_reserver(uuid, text, date, date, integer, integer, integer, numeric) from public, anon, authenticated;
revoke all on function public.ia_solder(bigint, integer, integer, numeric) from public, anon, authenticated;
revoke all on function public.ia_annuler(bigint) from public, anon, authenticated;
grant execute on function public.ia_reserver(uuid, text, date, date, integer, integer, integer, numeric) to service_role;
grant execute on function public.ia_solder(bigint, integer, integer, numeric) to service_role;
grant execute on function public.ia_annuler(bigint) to service_role;
