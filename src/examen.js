/* L'objectif examen (Mirandola Infini, 2026-11-05), sans dépendance : un
   livre peut porter la date d'un examen (`deck.meta.examen`, « AAAA-MM-JJ »,
   synchronisé avec le livre — il part à la corbeille avec lui et revient
   avec lui). Le moteur reste FSRS, ses formules ne changent pas : seuls deux
   réglages qu'Anki laisse à chacun bougent, et seulement avant l'examen.

   - La rétention visée passe de 90 à 95 % dans les 30 jours qui précèdent :
     les pages reviennent plus tôt, au moment où l'on a le temps de les
     revoir et où une page oubliée coûte le plus.
   - L'intervalle plafond devient « la veille de l'examen » : une page ne
     part jamais se faire oublier au-delà du jour J — un intervalle de deux
     mois, posé trois semaines avant, ne servirait à rien.

   Le jour de l'examen et après, tout revient au réglage d'Anki : 90 %,
   36 500 jours. Les pages déjà planifiées gardent leur date (rien ne se
   réécrit en arrière), la suivante se calcule normalement. */

export const FENETRE = 30;           // jours avant l'examen où la rétention monte
export const RETENTION_EXAMEN = 0.95;
const DAY = 86400000;

// « AAAA-MM-JJ » → minuit local de ce jour, ou null
export function dateExamen(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(typeof s === 'string' ? s : '');
  if (!m) return null;
  const t = new Date(+m[1], +m[2] - 1, +m[3]);
  return t.getMonth() === +m[2] - 1 && t.getDate() === +m[3] ? t.getTime() : null;
}

/* Combien de jours de calendrier avant l'examen (0 le jour même, négatif
   après) ; null sans date valable. Le jour se compte au calendrier local,
   pas en tranches de 24 h : un examen demain est à 1 jour, quelle que soit
   l'heure. */
export function joursAvant(examen, now) {
  const e = dateExamen(examen);
  if (e == null) return null;
  const n = new Date(now); const auj = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
  return Math.round((e - auj) / DAY);
}

/* Le réglage du moteur pour un livre : `base` celui d'Anki ({ dr, maxIvl }),
   `actif` faux hors Mirandola Infini — la date reste rangée, sans effet. */
export function reglageExamen(examen, now, base, actif) {
  const j = actif ? joursAvant(examen, now) : null;
  if (j == null || j <= 0) return base;
  return {
    dr: j <= FENETRE ? Math.max(base.dr, RETENTION_EXAMEN) : base.dr,
    maxIvl: Math.max(1, Math.min(base.maxIvl, j - 1))
  };
}

/* Ce que dit la pastille du livre : « J-12 », « Demain », « Aujourd'hui »,
   rien une fois passé. */
export function compte(examen, now) {
  const j = joursAvant(examen, now);
  if (j == null || j < 0) return '';
  return j === 0 ? 'Aujourd’hui' : j === 1 ? 'Demain' : 'J-' + j;
}
