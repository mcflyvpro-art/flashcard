-- Une partie en direct lancée pour une classe : chaque élève y porte son
-- nom de classe, « Prénom NOM » (2026-10-29).
--
-- Le constat : dans la salle d'attente d'un défi de classe, la professeure
-- voyait l'identifiant (le pseudo) de ses élèves. nom_joueur() ne donne le nom
-- complet qu'à un « élève de classe » au sens d'est_eleve_de_classe() — un
-- élève d'établissement ou un compte à carte — : l'élève d'un professeur
-- particulier, compte personnel entré avec un code, retombait sur son pseudo.
--
-- Or chaque élève d'une classe a son nom de classe, donné à l'entrée et
-- vérifié par le professeur : class_members.who. Dans une salle de classe, on
-- le prend d'abord ; à défaut (le professeur qui joue dans sa propre salle),
-- nom_joueur() comme avant. Hors d'une classe, rien ne change : un compte
-- personnel garde son pseudo.
--
-- Seule la ligne d'insertion du joueur change ; le reste de la fonction est
-- recopié tel qu'il est en service (pg_get_functiondef du 2026-10-29).
create or replace function public.salle_rejoindre(code text)
 returns table(statut text, salle uuid, titre text)
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare u uuid := auth.uid(); p text; s public.salles%rowtype; j public.salle_joueurs%rowtype;
begin
  if u is null then raise exception 'Connexion requise'; end if;
  p := regexp_replace(coalesce(code, ''), '[^0-9]', '', 'g');
  if char_length(p) <> 6 then return query select 'format'::text, null::uuid, null::text; return; end if;
  if (select count(*) from public.essais_codes e
      where e.user_id = u and e.sorte = 'salle' and e.at > now() - interval '10 minutes') >= 12 then
    return query select 'trop'::text, null::uuid, null::text; return;
  end if;
  delete from public.essais_codes e where e.user_id = u and e.at < now() - interval '1 day';
  select * into s from public.salles x
  where x.pin = p and x.etat <> 'fini' and x.created_at > now() - interval '4 hours';
  if not found or public.blocked(s.hote)
     or (s.class_id is null and s.group_id is null and public.est_eleve_de_classe(u)
         and coalesce((select r.role from public.user_roles r where r.user_id = s.hote), 'eleve')
             not in ('prof', 'admin')) then
    insert into public.essais_codes (user_id, sorte) values (u, 'salle');
    return query select 'inconnu'::text, null::uuid, null::text; return;
  end if;
  if s.hote = u then return query select 'hote'::text, s.id, s.titre; return; end if;
  if s.class_id is not null and not (public.in_class(s.class_id) or public.teaches(s.class_id)) then
    insert into public.essais_codes (user_id, sorte) values (u, 'salle');
    return query select 'classe'::text, null::uuid, null::text; return;
  end if;
  if s.group_id is not null and not public.in_group(s.group_id) then
    insert into public.essais_codes (user_id, sorte) values (u, 'salle');
    return query select 'club'::text, null::uuid, null::text; return;
  end if;
  select * into j from public.salle_joueurs x where x.salle_id = s.id and x.user_id = u;
  if found then
    if j.exclu then return query select 'exclu'::text, null::uuid, null::text; return; end if;
    return query select 'ok'::text, s.id, s.titre; return;
  end if;
  if (select count(*) from public.salle_joueurs x where x.salle_id = s.id) >= 300 then
    return query select 'pleine'::text, null::uuid, null::text; return;
  end if;
  insert into public.salle_joueurs (salle_id, user_id, nom)
  values (s.id, u, coalesce(
    (select nullif(btrim(m.who), '') from public.class_members m
     where s.class_id is not null and m.class_id = s.class_id and m.user_id = u),
    public.nom_joueur(u, s.class_id is not null)))
  on conflict do nothing;
  return query select 'ok'::text, s.id, s.titre;
end $function$;
revoke all on function public.salle_rejoindre(text) from public, anon;
grant execute on function public.salle_rejoindre(text) to authenticated;
