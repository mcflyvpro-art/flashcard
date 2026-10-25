-- Correctif de 20261025111500_jetons_d_identite : voit_personne() et
-- voit_classe() ne servent qu'à l'intérieur de visuels(), qui s'exécute avec
-- les droits de son propriétaire. Les privilèges par défaut de Supabase les
-- ouvraient pourtant à `authenticated` (révoquer PUBLIC et anon n'y touche
-- pas) : n'importe quel compte pouvait demander « suis-je lié à tel autre ? ».
-- Le test « anon n'appelle aucune des trois fonctions, ni les internes
-- personne » de supabase/tests/jetons.sql échouait avant ce correctif.
revoke all on function public.voit_personne(uuid) from public, anon, authenticated;
revoke all on function public.voit_classe(uuid) from public, anon, authenticated;
