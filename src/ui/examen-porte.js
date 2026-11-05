// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { I } from '../icones.js';
import { setMenu } from '../data/etat.js';
import { toast } from './import-cartes.js';
import { openMenu } from './menus-a.js';

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
