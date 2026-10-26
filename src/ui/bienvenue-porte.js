// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { $ } from '../racine.js';
import { I, svg } from '../icones.js';
import { view } from '../data/etat.js';
import { render } from './bibliotheque.js';
import { toast } from './import-cartes.js';

/* ══════════ la porte de l'accueil d'un nouveau compte ══════════
   L'accueil (ui/bienvenue.js et sa feuille bienvenue.css, préfixe bv-) ne
   sert qu'une fois par compte : il se charge à la demande. Rien d'autre ne
   doit importer ui/bienvenue.js — passer par ici. */
let mod = null, charge = null;

function charger() {
  if (mod) return Promise.resolve(mod);
  if (!charge) charge = import('./bienvenue.js').then(m => (mod = m)).catch(e => { charge = null; throw e; });
  return charge;
}

export function bienvenueView() {
  if (mod) return mod.bienvenueEcran();
  $.innerHTML = `<div class="page"><div class="empty">${svg(I.spark)}</div></div>`;
  charger().then(() => { if (view.name === 'bienvenue') render(); })
    .catch(() => toast(I.x, 'L’accueil n’a pas pu s’ouvrir : vérifie ta connexion'));
}

/* `mode` : 'perso' (un particulier) ou 'classe' (un élève entré par son
   établissement) ; `apres` : ce qui suit l'accueil (la visite guidée). Hors
   ligne au premier lancement, l'accueil attend la prochaine ouverture. */
export function ouvrirBienvenue(mode, apres) {
  charger().then(m => m.commencer(mode, apres)).catch(() => { /* sans réseau : il reviendra à la prochaine ouverture */ });
}
