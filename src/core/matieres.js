import { db } from '../data/etat.js';
import { choisirMatiere } from '../matieres.js';
import { COLORS, pushSubject } from './coeur-sync.js';

/* La matière d'un livre qui arrive d'ailleurs (devoir, lien, envoi) :
   retrouvée par son nom, ou créée — la règle est dans src/matieres.js.
   Une matière créée hors ligne attend la prochaine synchro : pull() la
   renvoie tant qu'un livre s'en sert (core/coeur-sync.js). */
export function matiereLocale(demande) {
  const r = choisirMatiere(db.subjects, demande, COLORS);
  if (r.creer) { db.subjects.push(r.creer); pushSubject(r.creer); }
  return r.id;
}
