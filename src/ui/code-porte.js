// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { I } from '../icones.js';
import { setMenu } from '../data/etat.js';
import { toast } from './import-cartes.js';

/* ══════════ la porte de « J'ai un code » (2026-11-05) ══════════
   La feuille (ui/code-entree.js) et ses règles arrivent à la demande : on
   ne s'en sert qu'une fois, pour entrer dans une école, et le démarrage n'a
   plus de marge. Le service worker la garde hors ligne avec le reste. Rien
   d'autre ne doit importer ui/code-entree.js. */
let feuille = null;
const charger = () => feuille || (feuille = import('./code-entree.js'));

let pret = null;

export async function ouvrirCode(code, o) {
  try { pret = await charger(); }
  catch (e) { feuille = null; toast(I.x, 'Impossible hors ligne pour l’instant'); return; }
  pret.ouvrirCode(code, o);
}

export function paintMenuCode(w) {
  if (pret) return pret.paintMenuCode(w);
  setMenu(null);
}

// le bouton « J'ai un code » des Réglages et de « Ma classe » (`data-ce="ouvrir"`)
document.addEventListener('click', e => {
  const b = e.target.closest('[data-ce="ouvrir"]');
  if (!b || b.disabled) return;
  e.preventDefault();
  ouvrirCode();
});
