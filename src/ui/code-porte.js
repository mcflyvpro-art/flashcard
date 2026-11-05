// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { I } from '../icones.js';
import { setMenu } from '../data/etat.js';
import { toast } from './import-cartes.js';

/* ══════════ la porte de « J'ai un code » (2026-11-05) ══════════
   La feuille (ui/code-entree.js) et ses règles — les messages de chaque
   statut d'un code (src/etablissement.js), le code d'un livre
   (src/livre-code.js) — arrivent à la demande : une dizaine de Ko qui
   pesaient sur le démarrage pour une feuille qu'on ouvre rarement, et le
   démarrage n'avait plus de marge. Rien d'autre ne doit importer
   ui/code-entree.js : ouvrir la feuille passe par `ouvrirCode` d'ici, un
   bouton `data-ce="ouvrir"` aussi (l'écouteur ci-dessous, tant que la
   feuille n'est pas chargée ; ensuite, le sien). */
let feuille = null;
const charger = () => import('./code-entree.js').then(m => (feuille = m));

export async function ouvrirCode(code, o) {
  try { await (feuille || charger()); }
  catch (e) { return toast(I.x, 'Impossible hors ligne pour l’instant'); }
  feuille.ouvrirCode(code, o);
}

export function paintMenuCode(w) {
  if (feuille) return feuille.paintMenuCode(w);
  setMenu(null);
}

document.addEventListener('click', e => {
  if (feuille) return;                       // chargée : son propre écouteur répond
  const b = e.target.closest('[data-ce="ouvrir"]');
  if (!b || b.disabled) return;
  e.preventDefault();
  ouvrirCode();
});
