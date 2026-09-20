-- ══════════ « Redonner à d'autres classes » ══════════
-- M06.T7 : le bouton appelait une fonction qui n'existait nulle part
-- (`profCartesDeDevoir` côté client), ce qui faisait échouer le lint en
-- continu. Le premier correctif côté client lisait `assignments.cards` en
-- direct par PostgREST — mais la politique `asg_read` (migration
-- 20260912230513) n'autorise que l'élève inscrit (`in_class`, via
-- `class_members`) ou le propriétaire de la classe (`classes.owner`) : un
-- professeur de matière qui enseigne la classe sans en être propriétaire
-- (`teaches`, via `teachings`) se voyait renvoyer une ligne vide, en
-- silence — RLS filtre, ne renvoie jamais d'erreur. C'est exactement le cas
-- du compte de test (prof@folio.app enseigne l'anglais sur des classes
-- dont il n'est pas propriétaire).
--
-- Plutôt que d'élargir `asg_read` (une politique de lecture large sur toute
-- la table, alors qu'il ne s'agit que de relire le contenu d'un devoir déjà
-- donné), une fonction dédiée, security definer, au même contrôle d'accès
-- que `prof_cartes` juste au-dessus dans l'historique des migrations.
create or replace function public.prof_assignment_cards(aid uuid)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select x.cards from public.assignments x
  where x.id = aid
    and (public.teaches(x.class_id)
      or exists (select 1 from public.classes c where c.id = x.class_id and c.owner = auth.uid())
      or public.is_ref() or public.is_admin())
$$;

revoke all on function public.prof_assignment_cards(uuid) from public, anon;
grant execute on function public.prof_assignment_cards(uuid) to authenticated;
