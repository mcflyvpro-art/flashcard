// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { I } from '../icones.js';
import { me, setMenu } from '../data/etat.js';
import { mePull } from '../core/reglages-corbeille.js';
import { toast } from './import-cartes.js';
import { openMenu } from './menus-a.js';

/* ══════════ la porte de la feuille du pseudo (2026-10-27) ══════════
   Changer son pseudo s'ouvre de partout — Réglages, « Mon jeton » du
   cercle — pour tous les comptes, élèves de classe compris. La feuille et
   la règle (src/pseudo.js, ses listes de mots) arrivent à la demande : le
   démarrage n'a pas de marge. Rien d'autre ne doit importer
   ui/pseudo-feuille.js. */
let feuille = null;

export async function ouvrirPseudo() {
  try { feuille = feuille || await import('./pseudo-feuille.js'); }
  catch (e) { toast(I.x, 'Impossible hors ligne pour l’instant'); return; }
  if (!me) await mePull();
  feuille.preparer();
  openMenu('handle');
}

export function paintMenuPseudo(w) {
  if (feuille) return feuille.peindre(w);
  setMenu(null);
}
