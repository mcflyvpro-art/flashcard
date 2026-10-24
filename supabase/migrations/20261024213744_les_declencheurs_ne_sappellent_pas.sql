-- Deux fonctions de déclencheur restaient appelables par `authenticated` via
-- /rest/v1/rpc (advisor 0029) : `lock_identite_scolaire` (le nom d'un élève de
-- classe ne se change pas) et `auto_hide` (masquage après signalements). Un
-- déclencheur s'exécute sans le droit EXECUTE de celui qui écrit la ligne —
-- `avancement_devoir` et `assign_usn` tournent déjà ainsi — : retirer ce
-- droit ne change rien à leur travail et ferme une porte qui ne servait à rien.
revoke all on function public.lock_identite_scolaire() from public, anon, authenticated;
revoke all on function public.auto_hide() from public, anon, authenticated;
