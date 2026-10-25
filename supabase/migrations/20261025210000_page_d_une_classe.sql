-- La page d'une classe, côté élève (2026-10-25) : toucher sa classe dans
-- « Mes classes » ouvre une page — son nom, son établissement, ses
-- professeurs et leur matière, ses élèves — au lieu d'une petite fiche.
--
-- Qui voit quoi :
--   · un élève inscrit dans la classe : tout ce qui précède. Ses camarades
--     sous le nom que la classe leur donne (« Prénom NOM », class_members.who,
--     le même que dans my_classmates), avec le lien d'amitié qu'il a avec
--     chacun ; jamais leurs chiffres (le profil, profil_lecteur, ne les
--     montre qu'entre amis) ; jamais un compte bloqué dans un sens ou l'autre.
--   · un élève en salle d'attente : le nom de la classe et son établissement.
--   · personne d'autre : « inconnue », sans dire si la classe existe. Le code
--     de la classe n'est jamais rendu (20261024113815).

create or replace function public.eleve_classe(cid uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  moi uuid := auth.uid();
  c record;
begin
  if moi is null then
    raise exception 'eleve_classe : authentification requise' using errcode = '42501';
  end if;
  select cl.id, cl.name, coalesce(cl.level, '') as niveau, cl.org_id, cl.owner,
         coalesce((select o.name from public.orgs o where o.id = cl.org_id), '') as etab
    into c from public.classes cl where cl.id = cid and cl.archived_at is null;
  if not found then
    return jsonb_build_object('statut', 'inconnue');
  end if;

  if not exists (select 1 from public.class_members m where m.class_id = cid and m.user_id = moi) then
    if exists (select 1 from public.class_requests r where r.class_id = cid and r.user_id = moi) then
      return jsonb_build_object('statut', 'attente', 'id', c.id, 'nom', c.name, 'niveau', c.niveau, 'etab', c.etab);
    end if;
    return jsonb_build_object('statut', 'inconnue');
  end if;

  return jsonb_build_object(
    'statut', 'inscrit',
    'id', c.id, 'nom', c.name, 'niveau', c.niveau, 'etab', c.etab,
    'depuis', (select m.joined_at from public.class_members m where m.class_id = cid and m.user_id = moi),
    'peut_quitter', c.org_id is null,
    'profs', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', t.teacher,
               'nom', coalesce(nullif(p.name, ''), p.handle, 'Professeur'),
               'matiere', coalesce(t.subject, ''),
               'principal', coalesce(t.principal, false) or t.teacher = c.owner)
             order by (t.teacher = c.owner) desc, coalesce(t.principal, false) desc, t.subject)
      from public.teachings t
      left join public.profiles p on p.id = t.teacher
      where t.class_id = cid and not public.blocked(t.teacher)), '[]'::jsonb),
    'eleves', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', m.user_id,
               'nom', coalesce(nullif(m.who, ''), nullif(p.name, ''), p.handle, 'Élève'),
               'pseudo', coalesce(p.handle, ''),
               'moi', m.user_id = moi,
               'ami', coalesce((select f.status from public.friends f
                                where (f.user_id = moi and f.friend_id = m.user_id)
                                   or (f.friend_id = moi and f.user_id = m.user_id)
                                limit 1), ''))
             order by (m.user_id = moi) desc, coalesce(nullif(m.who, ''), nullif(p.name, ''), p.handle))
      from public.class_members m
      left join public.profiles p on p.id = m.user_id
      where m.class_id = cid and (m.user_id = moi or not public.blocked(m.user_id))), '[]'::jsonb)
  );
end $$;

revoke all on function public.eleve_classe(uuid) from public, anon;
grant execute on function public.eleve_classe(uuid) to authenticated;
