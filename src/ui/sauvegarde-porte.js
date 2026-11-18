// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { I } from '../icones.js';
import { setMenu } from '../data/etat.js';
import { toast } from './import-cartes.js';
import { openMenu } from './menus-a.js';

/* ══════════ la porte de la sauvegarde (2026-11-18) ══════════
   « Sauvegarde » des Réglages : exporter tous ses paquets, restaurer un
   fichier. La feuille (ui/sauvegarde.js), le noyau (core/sauvegarde.js,
   src/sauvegarde.js) arrivent à la demande : une sauvegarde se fait
   rarement, et le démarrage n'a pas de marge. Rien d'autre ne doit
   importer ui/sauvegarde.js. */
let feuille = null;

export async function ouvrirSauvegarde() {
  try { feuille = feuille || await import('./sauvegarde.js'); }
  catch (e) { toast(I.x, 'Impossible hors ligne pour l’instant'); return; }
  feuille.preparer();
  openMenu('backup');
}

export const paintMenuSauvegarde = w => (feuille ? feuille.peindre(w) : setMenu(null));
