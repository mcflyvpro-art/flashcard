// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { I } from '../icones.js';
import { setMenu } from '../data/etat.js';
import { toast } from './import-cartes.js';
import { openMenu } from './menus-a.js';

/* ══════════ la porte de « Sécurité du compte » (2026-11-02) ══════════
   La ligne des Réglages (élèves, professeurs, référents, éditeur) ouvre une
   feuille : l'adresse e-mail, le mot de passe, la vérification en deux
   étapes. La feuille et ses règles (ui/securite.js, src/securite.js,
   core/compte-auth.js, src/qr.js) arrivent à la demande : le démarrage n'a
   pas de marge. Rien d'autre ne doit importer ui/securite.js. */
let feuille = null;

export async function ouvrirSecurite(etape = 'accueil') {
  try { feuille = feuille || await import('./securite.js'); }
  catch (e) { toast(I.x, 'Impossible hors ligne pour l’instant'); return; }
  feuille.preparer(etape);
  openMenu('secu');
}

export function paintMenuSecurite(w) {
  if (feuille) return feuille.peindre(w);
  setMenu(null);
}
