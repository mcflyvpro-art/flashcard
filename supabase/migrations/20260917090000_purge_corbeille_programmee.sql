-- ══════════ la corbeille se vide toute seule ══════════
-- La confidentialité promet : « un livre supprimé part en corbeille et
-- s'efface définitivement au bout de 30 jours ». Jusqu'ici, rien ne le
-- faisait vraiment : `trashPull()` (app.js) ne purge que lorsque le compte
-- concerné rouvre son propre écran Corbeille. Un compte qui supprime un
-- livre puis n'y revient jamais garde ce livre en base indéfiniment — la
-- promesse de suppression n'était donc pas tenue par construction.
--
-- Article 5.1.e RGPD (limitation de la conservation) et 5.1.a (loyauté :
-- la politique de confidentialité doit décrire ce qui se passe réellement)
-- veulent une purge qui ne dépende pas d'un geste de l'utilisateur.

create or replace function public.purge_corbeille()
returns integer language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  delete from public.decks where deleted_at is not null and deleted_at < now() - interval '30 days';
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.purge_corbeille() from public, anon, authenticated;

-- pg_cron est l'extension officiellement supportée par Supabase pour les
-- tâches planifiées ; elle ne s'active pas toujours toute seule selon le
-- projet, d'où le garde ci-dessous plutôt qu'un échec de migration.
do $$
begin
  create extension if not exists pg_cron with schema extensions;
exception when insufficient_privilege or feature_not_supported then
  raise notice 'pg_cron indisponible sur ce projet : activer « Database → Extensions → pg_cron » '
    'dans le tableau de bord Supabase, puis rejouer la commande cron.schedule ci-dessous à la main.';
end $$;

-- ══════════ les signalements instruits ne restent pas éternellement ══════
-- Le contenu joint à un signalement (copie du livre, du message ou du
-- profil visé) n'avait aucune limite de conservation une fois l'affaire
-- close : ni purge, ni date à laquelle en juger. `closed_at` marque le
-- moment où `mod_act` sort un signalement de l'état « open » ; douze mois
-- plus tard — le temps de répondre à une contestation — il s'efface.
alter table public.reports add column if not exists closed_at timestamptz;

create or replace function public.mod_act(rid bigint, act text)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.reports%rowtype;
begin
  if not public.is_mod() then raise exception 'non autorisé'; end if;
  select * into r from public.reports where id = rid;
  if not found then raise exception 'signalement introuvable'; end if;

  if act = 'hide' then
    if r.kind = 'library' then
      update public.library set hidden = true where deck_id::text = r.target_id;
    elsif r.kind = 'duel' then
      update public.duels set hidden = true where id::text = r.target_id;
    end if;
    update public.reports set status = 'reviewed', closed_at = now()
     where kind = r.kind and target_id = r.target_id and status = 'open';

  elsif act = 'clear' then
    if r.kind = 'library' then
      update public.library set hidden = false where deck_id::text = r.target_id;
    elsif r.kind = 'duel' then
      update public.duels set hidden = false where id::text = r.target_id;
    end if;
    update public.reports set status = 'closed', closed_at = now()
     where kind = r.kind and target_id = r.target_id and status = 'open';
  else
    raise exception 'action inconnue';
  end if;
end $$;
revoke all on function public.mod_act(bigint, text) from public, anon;
grant execute on function public.mod_act(bigint, text) to authenticated;

create or replace function public.purge_signalements_clos()
returns integer language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  delete from public.reports where closed_at is not null and closed_at < now() - interval '12 months';
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.purge_signalements_clos() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'purge-corbeille-quotidienne') then
    perform cron.unschedule('purge-corbeille-quotidienne');
  end if;
  perform cron.schedule('purge-corbeille-quotidienne', '17 3 * * *', 'select public.purge_corbeille();');
  if exists (select 1 from cron.job where jobname = 'purge-signalements-mensuelle') then
    perform cron.unschedule('purge-signalements-mensuelle');
  end if;
  perform cron.schedule('purge-signalements-mensuelle', '32 3 1 * *', 'select public.purge_signalements_clos();');
exception when undefined_table or undefined_function then
  raise notice 'pg_cron non actif : voir supabase/REGLAGES.md pour l''activer, puis exécuter : '
    'select cron.schedule(''purge-corbeille-quotidienne'', ''17 3 * * *'', ''select public.purge_corbeille();''); '
    'select cron.schedule(''purge-signalements-mensuelle'', ''32 3 1 * *'', ''select public.purge_signalements_clos();'');';
end $$;
