// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { $ } from '../racine.js';
import { I } from '../icones.js';
import { cercle, duels, view } from '../data/etat.js';
import { clubsPull, membresPull, sallesPull, termineesPull } from '../core/cercle.js';
import { duelsPull } from '../core/defis.js';
import { render } from './bibliotheque.js';
import { toast } from './import-cartes.js';
import { chargeur } from './chargeur.js';

/* ══════════ la porte de la page d'un club (2026-11-18) ══════════
   La page d'un club (ui/club.js) et ses styles (ui/club.css, préfixe cl-)
   arrivent à la demande, préchauffés au calme après l'accueil ; ce qui
   relit ses données et dit quel club est ouvert reste ici, parce que la
   feuille d'un club et « J'ai un code » s'en servent sans la page. Rien
   d'autre ne doit importer ui/club.js. */
let mod = null, demande = null;

export function chargerClub() {
  if (mod) return Promise.resolve(mod);
  if (!demande) demande = import('./club.js').then(m => (mod = m)).catch(e => { demande = null; throw e; });
  return demande;
}

export const clubOuvert = () => (cercle.clubs || []).find(g => g.id === view.id);

/* La liste des clubs est relue à chaque ouverture : un club personnalisé
   ailleurs (sa couleur, son nom, sur un autre appareil) se montre tel qu'il
   est, pas tel qu'on l'avait gardé (2026-11-16). */
export function clubPull(id) {
  clubsPull(cercle.clubs !== null);
  if (!duels.list) duelsPull();
  membresPull(id);
  termineesPull(id, null);
  sallesPull();
}

export function clubView() {
  if (mod) return mod.clubView();
  $.innerHTML = `<div class="page cc">${chargeur()}</div>`;
  // le second argument : seule une panne de chargement se dit « connexion » ; une erreur de l'écran remonte telle quelle
  chargerClub().then(() => { if (view.name === 'club') render(); },
    () => toast(I.x, 'Le club n’a pas pu s’ouvrir : vérifie ta connexion'));
}
