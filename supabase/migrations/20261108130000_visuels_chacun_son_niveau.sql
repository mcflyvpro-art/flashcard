-- Le liseré d'un jeton dit l'offre de CETTE personne (2026-11-08).
--
-- Demandé : « faut vraiment différencier les gens : ceux de Mirandola+ en
-- arc-en-ciel, ceux d'Infini en or, les autres rien ». visuels() ne disait
-- que `plus` (vrai pour Mirandola+ ET Infini) : l'app ne pouvait pas
-- distinguer un abonné Infini, et l'or que voyait un abonné Infini sur tous
-- ses amis venait de sa propre lumière (corrigé dans app.css).
--
-- La colonne `infini` s'ajoute EN FIN : une app d'avant lit `plus` comme
-- avant et ignore la nouvelle. Le type de retour change : drop puis create,
-- avec les mêmes droits. Rien d'autre ne bouge : mêmes bornes (200 personnes,
-- 100 classes), même contrôle de qui voit qui (voit_personne, voit_classe).

drop function if exists public.visuels(uuid[], uuid[]);

create function public.visuels(personnes uuid[] default '{}'::uuid[], classes uuid[] default '{}'::uuid[])
returns table(id uuid, genre text, cle text, teinte smallint, plus boolean, infini boolean)
language sql
stable security definer
set search_path to ''
as $function$
  select p.id, 'p'::text, p.figure, p.teinte, n.niveau in ('plus', 'infini'), n.niveau = 'infini'
  from public.profiles p
  cross join lateral (select public.niveau_de(p.id) as niveau) n
  where p.id = any ((coalesce(personnes, '{}'::uuid[]))[1:200]) and public.voit_personne(p.id)
  union all
  select c.id, 'c'::text, c.embleme, c.teinte, false, false
  from public.classes c
  where c.id = any ((coalesce(classes, '{}'::uuid[]))[1:100]) and public.voit_classe(c.id)
$function$;

revoke all on function public.visuels(uuid[], uuid[]) from public, anon;
grant execute on function public.visuels(uuid[], uuid[]) to authenticated;
