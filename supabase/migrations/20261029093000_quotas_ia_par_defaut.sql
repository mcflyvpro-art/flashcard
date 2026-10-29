-- ══════════ Les quotas IA par défaut d'une licence (2026-10-29) ══════════
-- 20261029090000 donnait 50 générations par mois à un professeur et 0 à un
-- élève Campus. La page d'accueil et la fonction ai (20261028090000,
-- src/offres.js) disent 400 pour un professeur, 30 pour un élève : une
-- licence neuve part de là, et l'éditeur ajuste dans sa console (le coût
-- estimé suit). Les lignes posées par 20261029090000 à ses valeurs d'alors
-- (personne n'y avait encore touché) reprennent ces défauts.

alter table public.prof_licences alter column ia_prof set default 400;
alter table public.prof_licences alter column ia_eleve set default 30;
alter table public.orgs alter column ia_prof set default 400;
alter table public.orgs alter column ia_eleve set default 30;

update public.prof_licences set ia_prof = 400, ia_eleve = 30 where ia_prof = 50 and ia_eleve = 0;
update public.orgs set ia_prof = 400, ia_eleve = 30 where ia_prof = 50 and ia_eleve = 0;
