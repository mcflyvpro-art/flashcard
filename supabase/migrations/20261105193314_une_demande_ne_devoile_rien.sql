-- Une demande d'amitié ne dévoile rien de celui qu'on demande (session de
-- débogage du 2026-11-05).
--
-- Le nom d'un élève d'établissement est son vrai « Prénom NOM », figé par
-- le référent. Or n'importe quel compte pouvait :
-- 1. taper des pseudos au hasard (« lea », « lea1 »…) dans `find_user`, qui
--    rendait le nom de qui le portait ;
-- 2. lui envoyer une demande d'amitié, et lire aussitôt son nom par
--    `my_friends`, son profil réduit (`profil_lecteur`, statut « prive » :
--    nom, ancienneté, clubs) et son visage (`visuels`) — tous trois passent
--    par `voit_personne`, qui comptait toute ligne d'amitié, même une
--    demande qu'on venait d'envoyer soi-même.
--
-- Désormais, celui qui REÇOIT une demande voit qui la lui fait (il en a
-- besoin pour décider), mais celui qui l'ENVOIE ne voit rien de plus que le
-- pseudo qu'il a tapé tant que l'autre n'a pas accepté. `find_user` ne rend
-- un nom qu'à qui voit déjà la personne. L'app n'affiche jamais une demande
-- envoyée (seuls les amis acceptés et les demandes reçues) : rien ne change
-- à l'écran pour qui s'en sert normalement.
--
-- Les trois fonctions sont reprises mot pour mot (pg_get_functiondef),
-- seule la règle des amis change. Tests : supabase/tests/profil.sql et
-- jetons.sql, mis à jour.

create or replace function public.voit_personne(u uuid)
returns boolean
language sql
stable security definer
set search_path to ''
as $function$
  select u = auth.uid()
    -- une demande reçue fait voir qui la fait ; une demande envoyée, rien tant qu'elle n'est pas acceptée
    or exists (select 1 from public.friends f
               where (f.user_id = auth.uid() and f.friend_id = u and f.status = 'ok')
                  or (f.friend_id = auth.uid() and f.user_id = u))
    or exists (select 1 from public.group_members a join public.group_members b on b.group_id = a.group_id
               where a.user_id = auth.uid() and b.user_id = u)
    or exists (select 1 from public.class_members a join public.class_members b on b.class_id = a.class_id
               where a.user_id = auth.uid() and b.user_id = u)
    or exists (select 1 from public.class_members a join public.classes c on c.id = a.class_id
               where a.user_id = auth.uid()
                 and (c.owner = u or exists (select 1 from public.teachings t where t.class_id = c.id and t.teacher = u)))
    or exists (select 1 from public.class_members m
               where m.user_id = u and (public.teaches(m.class_id) or public.class_manager(m.class_id)))
    or exists (select 1 from public.class_requests r
               where r.user_id = u and (public.teaches(r.class_id) or public.class_manager(r.class_id)))
    or exists (select 1 from public.teachings a join public.teachings b on b.class_id = a.class_id
               where a.teacher = auth.uid() and b.teacher = u)
    or exists (select 1 from public.salles s
               where (s.hote = auth.uid()
                      or exists (select 1 from public.salle_joueurs j where j.salle_id = s.id and j.user_id = auth.uid()))
                 and (s.hote = u
                      or exists (select 1 from public.salle_joueurs j where j.salle_id = s.id and j.user_id = u)))
    or (public.is_ref()
        and exists (select 1 from public.org_members m where m.user_id = u and m.org_id = public.my_org()))
$function$;

create or replace function public.find_user(q text)
returns table(id uuid, handle text, name text)
language sql
stable security definer
set search_path to ''
as $function$
  select p.id, p.handle,
         -- le nom seulement à qui voit déjà la personne : sinon, le pseudo qu'on a tapé
         case when public.voit_personne(p.id) then coalesce(nullif(p.name, ''), p.handle) else p.handle end
  from public.profiles p
  where public.cle_pseudo(p.handle) = public.cle_pseudo(trim(replace(q, '@', '')))
    and p.id <> auth.uid()
    and (public.my_org() is null
      or public.my_role() <> 'eleve'
      or public.same_class(p.id))
  limit 1
$function$;

create or replace function public.my_friends()
returns table(id uuid, handle text, name text, status text, sens text)
language sql
stable security definer
set search_path to ''
as $function$
  select p.id, p.handle,
         -- une demande envoyée et pas encore acceptée : le pseudo seulement
         case when f.user_id = auth.uid() and f.status <> 'ok' then coalesce(p.handle, 'Compte')
              else coalesce(nullif(p.name, ''), p.handle, 'Compte') end as name,
         f.status,
         case when f.user_id = auth.uid() then 'envoyee' else 'recue' end as sens
  from public.friends f
  join public.profiles p
    on p.id = case when f.user_id = auth.uid() then f.friend_id else f.user_id end
  where f.user_id = auth.uid() or f.friend_id = auth.uid()
  order by f.status, p.handle
$function$;
