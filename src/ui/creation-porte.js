// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { $ } from '../racine.js';
import { I } from '../icones.js';
import { setComp, view } from '../data/etat.js';
import { render } from './bibliotheque.js';
import { toast } from './import-cartes.js';
import { chargeur } from './chargeur.js';

/* ══════════ la porte de l'écran de création (2026-11-18) ══════════
   Demandé : « lazy load tout pour optimiser ». L'écran de création (ses
   onglets, sa zone de vérification, sa liste) et ses styles
   (ui/creation.css) ne servent qu'à qui crée : ils arrivent à la demande,
   préchauffés au calme après l'accueil (prechauffer de ui/synchro-ecran.js),
   si bien qu'on ne voit presque jamais le chargeur. `resetComp` reste ici :
   on remet la création à zéro avant d'y aller, morceau là ou pas. Rien
   d'autre ne doit importer ui/creation.js, sauf deux morceaux qui le
   chargent avec eux (ui/tuto.js, ui/retouche.js). */
let mod = null, demande = null;

export function chargerCreation() {
  if (mod) return Promise.resolve(mod);
  if (!demande) demande = import('./creation.js').then(m => (mod = m)).catch(e => { demande = null; throw e; });
  return demande;
}

export const resetComp = extra => { setComp({ subject: '', cards: [], edit: -1, mode: 'ecrire',
  text: '', dups: false, ...(extra || {}) }); };

export function importView() {
  if (mod) return mod.importView();
  $.innerHTML = `<div class="page">${chargeur()}</div>`;
  // le second argument : seule une panne de chargement se dit « connexion » ; une erreur de l'écran remonte telle quelle
  chargerCreation().then(() => { if (view.name === 'import') render(); },
    () => toast(I.x, 'La création n’a pas pu s’ouvrir : vérifie ta connexion'));
}

// une matière touchée sur l'écran de création : il est là, donc son morceau aussi
export const poserMatiere = id => mod && mod.poserMatiere(id);
