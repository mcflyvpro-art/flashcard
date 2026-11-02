-- ══════════ une demande de démo prévient l'éditeur, par e-mail (2026-11-02) ══════════
-- « Demander une démo » (sans compte, demander_demo) range la demande dans
-- org_suivi, où l'éditeur la voit… quand il ouvre sa console. Désormais,
-- chaque demande appelle la fonction `prevenir` (pg_net, sans attendre sa
-- réponse) : un e-mail à l'éditeur (ALERTE_EMAIL), un accusé de réception
-- au demandeur, par Brevo (BREVO_API_KEY). Sans ces secrets, la fonction ne
-- fait rien : la demande reste dans la console, comme avant.
--
-- On n'envoie à la fonction que l'identifiant de l'établissement ; elle
-- relit la demande elle-même (rôle service) et n'écrit qu'une fois
-- (`prevenu_le`), pour une demande de moins de deux heures : l'appeler à la
-- main ne fait rien de plus que ce que la demande avait déjà fait. Rien ne
-- doit empêcher une demande d'arriver : la moindre erreur ici est avalée.
create extension if not exists pg_net with schema extensions;

alter table public.org_suivi add column if not exists prevenu_le timestamptz;

create or replace function public.prevenir_demande()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
  if new.source = 'demande' then
    begin
      perform net.http_post(
        url := 'https://qqbzefpdeinlynjtarqr.supabase.co/functions/v1/prevenir',
        body := jsonb_build_object('org', new.org_id),
        headers := jsonb_build_object('Content-Type', 'application/json'),
        timeout_milliseconds := 8000);
    exception when others then
      -- pg_net absent, réseau refusé : la demande est rangée, l'éditeur la verra dans sa console
      null;
    end;
  end if;
  return new;
end $$;
revoke all on function public.prevenir_demande() from public, anon, authenticated;

drop trigger if exists prevenir_demande on public.org_suivi;
create trigger prevenir_demande after insert on public.org_suivi
  for each row execute function public.prevenir_demande();
