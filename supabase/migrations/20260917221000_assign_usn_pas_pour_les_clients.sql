-- `assign_usn()` (M03.T1) est une fonction de déclencheur : elle ne doit
-- jamais être appelée autrement que par Postgres lui-même quand une ligne
-- de `cards` ou `decks` est écrite. Comme toute fonction `security
-- definer` du schéma public, PostgREST l'exposait pourtant par défaut en
-- RPC — `anon` et `authenticated` pouvaient tous les deux l'appeler
-- directement (`/rest/v1/rpc/assign_usn`), avant même la ligne qu'elle est
-- censée modifier. La précédente migration
-- (20260917210000_anon_ne_peut_plus_appeler_les_fonctions.sql) fermait
-- cette porte pour les fonctions existantes ; celle-ci est née après coup
-- et n'était pas encore couverte.
--
-- Un déclencheur s'exécute quel que soit le droit `execute` du rôle qui a
-- déclenché l'écriture : retirer ce droit à `anon` et `authenticated` ne
-- casse rien, ça ferme seulement l'appel direct.

revoke execute on function public.assign_usn() from anon, authenticated;
