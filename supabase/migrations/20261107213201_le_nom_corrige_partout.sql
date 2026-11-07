-- Le nom corrigé par le référent, partout (2026-11-07, trouvé par la base
-- neuve de la CI : supabase/tests/identite_eleve.sql réécrit).
--
-- Le référent corrige le nom d'un élève (« Alice MARTIN » → « Alyce
-- MARTIN ») depuis sa console : ref_update_account changeait
-- profiles.name, et rien d'autre. Or ce que voient les professeurs vient
-- de la copie rangée à l'entrée dans la classe — class_members.who (la
-- liste d'une classe, prof_roster ; le nom dans une partie en direct,
-- nom_joueur), class_requests.who (la salle d'attente),
-- assignment_progress.who (qui a rendu un devoir). Prouvé sur la
-- production en transaction annulée : profil « Alyce MARTIN », liste du
-- professeur « Alice MARTIN ».
--
-- Désormais la correction suit dans les classes de SON établissement. Pas
-- ailleurs : chez un professeur particulier, c'est lui qui nomme l'élève
-- (prof_nommer_eleve), et le référent n'a pas à écrire dans ses classes.
-- Le reste de la fonction ne change pas (pseudo, adresse, journal).

create or replace function public.ref_update_account(
  cible uuid, nom text default null, pseudo text default null, adresse text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare av jsonb; etab uuid := public.my_org(); nouveau text := nullif(trim(nom), '');
begin
  perform public.ref_garde(cible);
  select jsonb_build_object('nom', name, 'pseudo', handle, 'adresse', email)
    into av from public.profiles where id = cible;
  update public.profiles set
    name   = coalesce(nouveau, name),
    handle = coalesce(nullif(lower(trim(pseudo)), ''), handle),
    email  = coalesce(nullif(lower(trim(adresse)), ''), email),
    updated_at = now()
  where id = cible;
  if nouveau is not null then
    update public.class_members m set who = nouveau
    from public.classes c where c.id = m.class_id and c.org_id = etab and m.user_id = cible and m.who is distinct from nouveau;
    update public.class_requests r set who = nouveau
    from public.classes c where c.id = r.class_id and c.org_id = etab and r.user_id = cible and r.who is distinct from nouveau;
    update public.assignment_progress ap set who = nouveau
    from public.assignments a join public.classes c on c.id = a.class_id
    where a.id = ap.assignment_id and c.org_id = etab and ap.user_id = cible and ap.who is distinct from nouveau;
  end if;
  if nullif(lower(trim(adresse)), '') is not null then
    update auth.users set email = lower(trim(adresse)), updated_at = now() where id = cible;
  end if;
  perform public.ref_trace(cible, 'identité corrigée',
    jsonb_build_object('avant', av, 'apres',
      jsonb_build_object('nom', nom, 'pseudo', pseudo, 'adresse', adresse)));
end $$;
revoke all on function public.ref_update_account(uuid, text, text, text) from public, anon;
grant execute on function public.ref_update_account(uuid, text, text, text) to authenticated;
