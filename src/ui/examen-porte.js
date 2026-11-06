// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { I } from '../icones.js';
import { setMenu, view } from '../data/etat.js';
import { $ } from '../racine.js';
import { go, render } from './bibliotheque.js';
import { toast } from './import-cartes.js';
import { closeMenu, openMenu } from './menus-a.js';

/* ══════════ la porte de l'objectif examen (Mirandola Infini, 2026-11-05) ══════════
   « Objectif examen » dans le menu « … » d'un livre, ou sa pastille « J-12 »
   en tête du livre : la feuille et ses règles (ui/examen.js, examen.css,
   src/examen.js pour l'écran) arrivent à la demande. Rien d'autre ne doit
   importer ui/examen.js. */
let feuille = null;

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
