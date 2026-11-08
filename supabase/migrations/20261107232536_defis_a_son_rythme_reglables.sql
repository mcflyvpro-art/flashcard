-- Les défis « à son rythme » se règlent (2026-11-07, demandé : « les défis
-- sur mobile ne sont pas éditables, c'est toujours QCM 10 »). Le nombre de
-- questions tient déjà dans `total` et `cards` ; il manquait le jeu. Une
-- ligne d'avant, ou une app d'avant qui n'envoie rien, reste un QCM (la
-- valeur par défaut) ; les questions d'un vrai ou faux portent leur réponse
-- proposée en troisième case, qu'une app d'avant ignore (elle le joue en QCM).
-- Les droits ne changent pas : la table a ses politiques et ses droits de
-- table, la colonne en hérite.
alter table public.duels add column if not exists jeu text not null default 'qcm';
alter table public.duels drop constraint if exists duels_jeu;
alter table public.duels add constraint duels_jeu check (jeu in ('qcm', 'vf', 'ecrit'));
