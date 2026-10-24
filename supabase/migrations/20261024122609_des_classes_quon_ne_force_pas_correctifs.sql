-- ══════════ correctifs trouvés en testant la migration précédente ══════════
-- Deux défauts, tous deux antérieurs à la refonte, mis au jour par
-- supabase/tests/classes_securisees.sql et par les advisors Supabase.

-- ── 1. Donner un devoir sans matière échouait ───────────────────────────
-- `assignments.subject` est NOT NULL (défaut ''), et `prof_give` y écrivait
-- NULL dès que la matière était vide : le devoir était refusé (23502), et
-- le professeur ne voyait qu'« Impossible pour l'instant ».
create or replace function public.prof_give(
  cids uuid[], nom text, matiere text, cartes jsonb, due date)
returns integer language plpgsql security definer set search_path = '' as $$
declare k uuid; n integer := 0; nb integer;
begin
  if nullif(trim(coalesce(nom, '')), '') is null then raise exception 'Il faut un titre'; end if;
  nb := coalesce(jsonb_array_length(cartes), 0);
  if nb = 0 then raise exception 'Il faut au moins une carte'; end if;
  if nb > 300 then raise exception 'Trois cents cartes au maximum pour un devoir'; end if;
  if due is null then raise exception 'Il faut une date de rendu'; end if;
  if due > current_date + 400 then raise exception 'Cette date est trop lointaine'; end if;
  foreach k in array cids loop
    if (public.teaches(k)
        or exists (select 1 from public.classes c where c.id = k and c.owner = auth.uid()))
       and exists (select 1 from public.classes c where c.id = k and c.archived_at is null) then
      insert into public.assignments (class_id, name, cards, n, due, created_by, subject)
      values (k, left(trim(nom), 120), cartes, nb, due, auth.uid(), left(trim(coalesce(matiere, '')), 60));
      n := n + 1;
    end if;
  end loop;
  if n = 0 then raise exception 'Aucune de ces classes n''est la tienne, ou elles sont archivées'; end if;
  return n;
end $$;

-- ── 2. Le rôle anonyme appelait encore trente fonctions ─────────────────
-- La migration 20260917210000 retirait `execute` à `anon`, mais Postgres
-- accorde ce droit à PUBLIC à la création de toute fonction, et `anon` en
-- hérite : le retrait nominatif ne changeait rien. `ref_set_password`,
-- `ref_new_account`, `ref_set_role` restaient appelables sans compte
-- (leur garde interne refusait, mais c'est précisément le garde-fou unique
-- que cette migration voulait cesser d'être), et `ref_trace` — fermée à
-- `authenticated` dans 20260913113350 — restait appelable par tout compte
-- connecté : n'importe qui pouvait écrire de fausses lignes dans le
-- journal d'audit de son établissement.
--
-- On retire PUBLIC à toutes les fonctions `security definer` du schéma,
-- sauf `shared_deck` (le lien de consultation, sans compte par nature).
-- Les droits nominatifs de `authenticated` ne bougent pas : l'app garde
-- exactement ce qu'elle appelait, et les fonctions internes (`ref_trace`,
-- `ref_garde`, les purges, les fonctions de déclencheur) ne sont plus
-- appelables par personne d'autre que leur propriétaire.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef and p.proname <> 'shared_deck'
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
  end loop;
end $$;

-- Et pour les prochaines : plus de droit d'exécution accordé à PUBLIC par
-- défaut. Chaque fonction dit à qui elle s'ouvre (`grant ... to
-- authenticated`), comme le rappelait déjà 20260917210000.
alter default privileges for role postgres in schema public revoke execute on functions from public;
