// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { I } from '../icones.js';
import { friends, setMenu } from '../data/etat.js';
import { friendsPull } from '../core/reglages-corbeille.js';
import { toast } from './import-cartes.js';
import { openMenu } from './menus-a.js';

/* ══════════ la porte de « Partager » un livre (2026-11-05) ══════════
   La feuille (le code du livre, son QR, le copier, l'envoyer, le révoquer)
   arrive à la demande, ui/livre-partage.js : le démarrage n'a pas de marge.
   Rien d'autre ne doit importer ui/livre-partage.js. */
let feuille = null;

export async function ouvrirPartage() {
  if (!friends) friendsPull();
  try { feuille = feuille || await import('./livre-partage.js'); }
  catch (e) { toast(I.x, 'Impossible hors ligne pour l’instant'); return; }
  openMenu('sharepick');
}

export function paintMenuSharepick(w) {
  if (feuille) return feuille.peindre(w);
  setMenu(null);
}

export function clickPartage(a, b, d) {
  if (feuille) return feuille.agir(a, d);
}
