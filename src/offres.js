/* Ce que chaque offre ouvre (2026-10-27) — module pur, sans dépendance,
   testé dans test/offres.test.js. La page d'accueil le dit (tarifs, tableau,
   FAQ) ; la démo d'un élève, qui essaie Folio gratuit, s'en sert déjà pour
   griser ce qui est dans Folio+ (ui/demo.js) ; la vraie app s'en servira
   quand le paiement et les licences de compte seront branchés (M12) : c'est
   ici qu'on change une règle, nulle part ailleurs.

   Trois offres : `gratuit` (Folio), `plus` (Folio+) et `campus` (un compte
   d'établissement, qui a tout ce qu'a Folio+). */

export const OFFRES = ['gratuit', 'plus', 'campus'];

// le moteur de chaque offre : Memory Engine Lite ou Ultra (docs/LANDING.md)
export const MOTEUR = { gratuit: 'lite', plus: 'ultra', campus: 'ultra' };

// Folio gratuit garde 5 livres à soi ; les devoirs ne comptent pas
export const LIVRES_GRATUITS = 5;

// les cours mis en flashcards par l'IA, par mois
export const IA_PAR_MOIS = { gratuit: 0, plus: 50, campus: 50 };

/* Ce qui n'est que dans Folio+ (et Campus) : toute l'IA (cours, photo,
   fichier), les exercices (QCM, associations), les images et les sons, les
   livres sans limite et le journal complet. */
export const PLUS_SEUL = ['ia', 'photo', 'fichier', 'exercices', 'media', 'livres', 'journal'];

/* Le journal gratuit garde la série, la régularité et l'activité ; ces
   volets-là (data-volet de ui/journal-ecran.js) sont dans Folio+. */
export const JOURNAL_PLUS = ['memoire', 'pause', 'heures', 'matieres', 'livres', 'resistent'];

export const permis = (offre, fonction) => offre !== 'gratuit' || !PLUS_SEUL.includes(fonction);
export const livresPermis = (offre, n) => offre !== 'gratuit' || n < LIVRES_GRATUITS;
export const voletPermis = (offre, volet) => offre !== 'gratuit' || !JOURNAL_PLUS.includes(volet);
