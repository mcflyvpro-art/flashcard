// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { I, svg } from '../icones.js';
import { ia, offre, setMenu, view } from '../data/etat.js';
import { examensRestants } from '../offres.js';
import { $ } from '../racine.js';
import { go, render } from './bibliotheque.js';
import { toast } from './import-cartes.js';
import { closeMenu, openMenu } from './menus-a.js';
import { ouvrirPlus, sansFolioPlus } from './plus-porte.js';

/* ══════════ la porte de l'objectif examen (Mirandola Infini, 2026-11-05) ══════════
   « Objectif examen » dans le menu « … » d'un livre, ou sa pastille « J-12 »
   en tête du livre : la feuille et ses règles (ui/examen.js, examen.css,
   src/examen.js pour l'écran) arrivent à la demande. Rien d'autre ne doit
   importer ui/examen.js. */
let feuille = null;

/* L'examen blanc offert (2026-11-08) : sans limite pour Infini, 1 à vie en
   Mirandola gratuit, 2 en Mirandola+ et Campus — la fonction ai en décide,
   ceci ne fait que le dire avant. `null` : on ne sait pas encore (l'IA du
   mois pas lue) ; l'écran laisse essayer, la fonction tranchera. */
export function examensOfferts() {
  const niveau = (ia || offre || {}).niveau;
  return niveau === 'infini' ? Infinity : niveau && ia && ia.examens >= 0 ? examensRestants(niveau, ia.examens) : null;
}

/* L'entrée « Examen blanc » du menu d'un paquet (2026-11-08) : pour tout
   élève ou professeur — Infini, ce qui reste d'offert, ou, tout pris, la
   pastille d'or ; le geste décide au toucher (ouvrirEntreeBlanc). Jamais
   dans la démo, où l'IA est fermée. L'IA du mois se lit au calme après
   l'accueil (prechauffer de ui/synchro-ecran.js) ; pas encore lue, rien
   n'est dit, l'écran de l'examen le dira. */
export function examenBlancMi() {
  if (sansFolioPlus() || !offre) return '';
  const n = examensOfferts();
  const queue = n === 0 ? '<span class="tail mi-infini">Infini</span>' : n > 0 && n < 9 ? `<span class="tail mi-offert">${n} offert${n > 1 ? 's' : ''}</span>` : '';
  return `<button class="mi" data-mact="examen-blanc">${svg(I.pen)}Examen blanc${queue}</button>`;
}
export const ouvrirEntreeBlanc = id => (examensOfferts() === 0 ? (closeMenu(), ouvrirPlus({ niveau: 'infini', raison: 'examen' })) : ouvrirExamenBlanc(id));

export async function ouvrirExamen() {
  try { feuille = feuille || await import('./examen.js'); }
  catch (e) { toast(I.x, 'Impossible hors ligne pour l’instant'); return; }
  feuille.preparer();
  openMenu('examen');
}

export function paintMenuExamen(w) {
  if (feuille) return feuille.peindre(w);
  setMenu(null);
}

/* L'examen blanc (2026-11-06) : la vue `examen` d'un livre, chargée à la
   demande (ui/examen-blanc.js, examen-blanc.css, core/examen.js,
   src/examen-blanc.js). Rien d'autre ne doit importer ui/examen-blanc.js. */
let blanc = null;
const chargerBlanc = () => blanc || (blanc = import('./examen-blanc.js'));
let blancPret = null;

export async function ouvrirExamenBlanc(id) {
  try { blancPret = await chargerBlanc(); }
  catch (e) { blanc = null; toast(I.x, 'Impossible hors ligne pour l’instant'); return; }
  closeMenu();
  blancPret.preparer(id);
  go('examen', id);
}

export function examenView() {
  if (blancPret) return blancPret.ecran();
  $.innerHTML = '<div class="page"><div class="empty"></div></div>';
  chargerBlanc().then(m => { blancPret = m; if (view.name === 'examen') render(); })
    .catch(() => { blanc = null; toast(I.x, 'L’examen blanc n’a pas pu s’ouvrir : vérifie ta connexion'); });
}
