// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { I } from '../icones.js';
import { openMenu } from './menus-a.js';
import { toast } from './import-cartes.js';

/* ══════════ la porte de « Modifier avec l'IA » (2026-11-07) ══════════
   Le bouton « IA » de la page d'un paquet et la ligne du menu « … »
   ouvrent la feuille `retouche` ; elle et la barre de l'IA (ui/retouche.js,
   ui/prompt-ia.js) se chargent ici, à la demande — rien d'autre ne doit
   importer ui/retouche.js. Un compte gratuit n'arrive jamais ici : son geste
   ouvre Mirandola+ (ui/bridage.js). */

let mod = null, charge = null;
const charger = () => charge || (charge = import('./retouche.js').then(m => (mod = m)));

export function ouvrirRetouche() {
  charger().then(() => { openMenu('retouche'); mod.relire(); })
    .catch(() => { charge = null; toast(I.x, 'L’IA revient avec le réseau'); });
}

export function paintMenuRetouche(w) { if (mod) mod.peindre(w); }
