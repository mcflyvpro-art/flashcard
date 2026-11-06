-- À l'échelle d'un lycée entier le même matin (session de débogage du
-- 2026-11-05, advisors de performance) : deux choses qui ne coûtent rien
-- aujourd'hui et coûteraient cher demain.
--
-- 1. Cinq politiques recalculaient `auth.uid()` pour chaque ligne lue
--    (auth_rls_initplan). `(select auth.uid())` le calcule une fois par
--    requête — exactement la même règle. `ai_usage_own_read` ne vaut plus
--    que pour `authenticated` (anon n'y lisait déjà rien : son uid est nul).
--
-- 2. Onze clés étrangères sans index (unindexed_foreign_keys). Supprimer un
--    compte (`delete_me`, `admin_supprimer_compte`) ou un livre efface en
--    cascade ses lignes de ces tables : sans index, chaque suppression les
--    parcourt en entier. Des index simples, sans rien changer d'autre.

drop policy if exists "profiles self insert" on public.profiles;
create policy "profiles self insert" on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));

drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists ai_usage_own_read on public.ai_usage;
create policy ai_usage_own_read on public.ai_usage for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "mail recipient deletes own" on public.mail;
create policy "mail recipient deletes own" on public.mail for delete to authenticated
  using (to_user = (select auth.uid()));

drop policy if exists "mail recipient updates own" on public.mail;
create policy "mail recipient updates own" on public.mail for update to authenticated
  using (to_user = (select auth.uid())) with check (to_user = (select auth.uid()));

create index if not exists assignment_progress_user_idx on public.assignment_progress (user_id);
create index if not exists assignments_created_by_idx on public.assignments (created_by);
create index if not exists duel_scores_user_idx on public.duel_scores (user_id);
create index if not exists duels_owner_idx on public.duels (owner);
create index if not exists library_group_idx on public.library (group_id);
create index if not exists library_user_idx on public.library (user_id);
create index if not exists mail_from_user_idx on public.mail (from_user);
create index if not exists reports_reporter_idx on public.reports (reporter);
create index if not exists reports_target_user_idx on public.reports (target_user);
create index if not exists shares_deck_idx on public.shares (deck_id);
create index if not exists shares_user_idx on public.shares (user_id);
