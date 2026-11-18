// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { $ } from '../racine.js';
import { I } from '../icones.js';
import { view } from '../data/etat.js';
import { render } from './bibliotheque.js';
import { toast } from './import-cartes.js';
import { chargeur } from './chargeur.js';

/* ══════════ la porte de « Nouveau défi » (2026-11-18) ══════════
   L'écran (ui/defi-nouveau.js), ses gestes et ses styles (ui/defi-nouveau.css,
   préfixe dn-) arrivent à la demande, préchauffés au calme après l'accueil.
   Rien d'autre ne doit importer ui/defi-nouveau.js. */
let mod = null, demande = null;

export function chargerDefi() {
  if (mod) return Promise.resolve(mod);
  if (!demande) demande = import('./defi-nouveau.js').then(m => (mod = m)).catch(e => { demande = null; throw e; });
  return demande;
}

const panne = () => toast(I.x, 'Le défi n’a pas pu s’ouvrir : vérifie ta connexion');

// le second argument de then : seule une panne de chargement se dit « connexion » ; une erreur de l'écran remonte telle quelle
export const ouvrirDefi = (o = {}) => chargerDefi().then(m => m.ouvrirDefi(o), panne);

export function defiView() {
  if (mod) return mod.defiView();
  $.innerHTML = `<div class="page">${chargeur()}</div>`;
  chargerDefi().then(() => { if (view.name === 'defi') render(); }, panne);
}
