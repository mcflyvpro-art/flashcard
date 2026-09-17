-- Suite de 20260917221000 : `revoke ... from anon, authenticated` ne
-- suffisait pas. Postgres accorde `execute` à `public` (le pseudo-rôle
-- qui vaut pour tout le monde) à la création d'une fonction, et ce don
-- survit à une révocation nommée — les advisors de sécurité montraient
-- `assign_usn` toujours appelable par `anon` et `authenticated` après la
-- migration précédente, hérité de ce grant `public` qu'elle avait oublié.

revoke execute on function public.assign_usn() from public;
