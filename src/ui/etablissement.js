// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { $ } from '../racine.js';
import { I, svg } from '../icones.js';
import { iso, joursEntre } from '../classe.js';
import { setAnimate, view } from '../data/etat.js';
import { render } from './bibliotheque.js';
import { toast } from './import-cartes.js';

/* ---------- la porte de la console du référent ----------
   La console (2026-10-26) est un morceau chargé à la demande —
   ui/ref-console.js, sa feuille ref-console.css (préfixe rf-) et
   core/referent.js : un élève ou un professeur ne la télécharge jamais.
   Rien d'autre ne doit importer ui/ref-console.js — passer par ici. */
let ecran = null, charge = null;

function charger() {
  if (ecran) return Promise.resolve(ecran);
  if (!charge) {
    charge = import('./ref-console.js').then(m => (ecran = m))
      .catch(e => { charge = null; throw e; });
  }
  return charge;
}

export function refView() {
  if (ecran) return ecran.consoleRef();
  $.innerHTML = `<div class="page"><div class="top"><div class="hero">Mon établissement</div></div>
    <div class="empty">${svg(I.school)}</div></div>`;
  charger().then(() => { if (view.name === 'ref') { setAnimate(false); render(); } })
    .catch(() => toast(I.x, 'La console n’a pas pu s’ouvrir : vérifie ta connexion'));
}

export const joursDici = s => joursEntre(iso(new Date()), s);
