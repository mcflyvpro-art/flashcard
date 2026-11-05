/* Les règles de la feuille de l'objectif examen (Mirandola Infini,
   2026-11-05), sans autre dépendance que src/examen.js : à part, parce que
   seule la feuille (ui/examen.js, chargée à la demande) s'en sert — le
   démarrage n'emporte que ce que le moteur et la pastille du livre lisent. */
import { dateExamen, joursAvant } from './examen.js';

const DAY = 86400000;

// une date d'examen qu'on peut poser : demain au plus tôt, dans deux ans au plus
export function dateValable(s, now) {
  const j = joursAvant(s, now);
  return j != null && j >= 1 && j <= 730;
}

/* Le jour J, combien de pages du livre on saura encore : la moyenne du
   rappel prévu par FSRS à la date de l'examen (une page jamais lue compte
   pour 0, une page mise de côté ne compte pas). `rappel(c, jours)` est la
   courbe du moteur, passée par l'appelant pour rester sans dépendance. */
export function prevision(cartes, examen, now, rappel) {
  const e = dateExamen(examen);
  const pages = (cartes || []).filter(c => !c.x);
  if (e == null || !pages.length) return null;
  let s = 0;
  for (const c of pages) {
    if (!c.S || !c.lr) continue;
    s += rappel(c, Math.max(0, (e - c.lr) / DAY));
  }
  return Math.round((s / pages.length) * 100);
}
