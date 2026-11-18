/* ══════════ la sauvegarde intégrale, côté données (M04.T6, 2026-11-18) ══════════
   Le format, la lecture, le plan et la restauration sont purs et testés
   (src/sauvegarde.js) ; ici, seulement l'état courant et l'écriture :
   chaque paquet restauré passe par saveDeck (donc la file hors ligne), et
   toute la restauration s'annule d'un geste (pushUndo, avec les
   identifiants tirés d'avance quand le fichier vient d'un autre compte).
   Chargé avec la feuille de la sauvegarde (ui/sauvegarde.js) : une
   sauvegarde se fait rarement, et le démarrage n'a pas de marge. */
import { auth, db } from '../data/etat.js';
import { pushSubject, pushUndo, save, saveDeck, uid } from './coeur-sync.js';
import { render } from '../ui/bibliotheque.js';
import { dAilleurs, exportLibrary, planRestauration, readBackup, restoreLibrary } from '../sauvegarde.js';

const moi = () => (auth ? /** @type {any} */ (auth).uid : null);

export const exporter = () => exportLibrary(db, moi(), Date.now());
export const lire = (/** @type {string} */ txt) => readBackup(txt);
export const plan = (/** @type {any} */ data, /** @type {number} */ place) => planRestauration(db, data, moi(), place);

/** @param {any} data @param {number} place */
export function restaurer(data, place) {
  const owner = moi();
  const p = planRestauration(db, data, owner, place);
  const ids = p.garder.map((/** @type {any} */ d) => (dAilleurs(data, owner) ? uid() : d.id));
  pushUndo('Restauration', ids);
  let k = 0;
  const r = restoreLibrary(db, data, owner, () => ids[k++], place, uid);
  for (const d of r.decks) saveDeck(d);
  if (auth) for (const s of r.subjects) pushSubject(s);
  save(); render();
  return r;
}
