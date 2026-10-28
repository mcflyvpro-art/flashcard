/* Ce que chaque offre ouvre (2026-10-27) — module pur, sans dépendance,
   testé dans test/offres.test.js. La page d'accueil le dit (tarifs, tableau,
   FAQ) ; la démo d'un élève, qui essaie Mirandola gratuit, s'en sert déjà pour
   griser ce qui est dans Mirandola+ (ui/demo.js) ; la vraie app s'en servira
   quand le paiement et les licences de compte seront branchés (M12) : c'est
   ici qu'on change une règle, nulle part ailleurs.

   Trois offres : `gratuit` (Mirandola), `plus` (Mirandola+) et `campus` (un compte
   d'établissement, qui a tout ce qu'a Mirandola+). */

export const OFFRES = ['gratuit', 'plus', 'campus'];

// le moteur de chaque offre : Memory Engine Lite ou Ultra (docs/LANDING.md)
export const MOTEUR = { gratuit: 'lite', plus: 'ultra', campus: 'ultra' };

// Mirandola gratuit garde 5 livres à soi ; les devoirs ne comptent pas
export const LIVRES_GRATUITS = 5;

/* Les cours mis en flashcards par l'IA, par mois (2026-10-28) : 30 pour
   un élève — de quoi mettre en flashcards chaque chapitre de l'année, pas
   de quoi faire tourner un service à ses frais. Un professeur prépare pour
   toute une classe : pour lui, en pratique, sans compter (IA_PROF_PAR_MOIS
   est un garde-fou contre un compte volé, pas une limite d'usage). La
   fonction ai les applique (AI_MONTHLY_PLUS, AI_MONTHLY_PROF). */
export const IA_PAR_MOIS = { gratuit: 0, plus: 30, campus: 30 };
export const IA_PROF_PAR_MOIS = 400;
export const iaParMois = (offre, prof) => (!IA_PAR_MOIS[offre] ? 0 : prof ? IA_PROF_PAR_MOIS : IA_PAR_MOIS[offre]);

/* Ce qui n'est que dans Mirandola+ (et Campus) : toute l'IA (cours, photo,
   fichier), les exercices (QCM, associations), les images et les sons, les
   livres sans limite et le journal complet. */
export const PLUS_SEUL = ['ia', 'photo', 'fichier', 'exercices', 'media', 'livres', 'journal'];

/* Le journal gratuit garde la série, la régularité et l'activité ; ces
   volets-là (data-volet de ui/journal-ecran.js) sont dans Mirandola+. */
export const JOURNAL_PLUS = ['memoire', 'pause', 'heures', 'matieres', 'livres', 'resistent'];

export const permis = (offre, fonction) => offre !== 'gratuit' || !PLUS_SEUL.includes(fonction);
export const livresPermis = (offre, n) => offre !== 'gratuit' || n < LIVRES_GRATUITS;
export const voletPermis = (offre, volet) => offre !== 'gratuit' || !JOURNAL_PLUS.includes(volet);
