// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { I } from '../icones.js';
import { toast } from './import-cartes.js';

/* ══════════ la porte de la démo sans compte ══════════
   ui/demo.js, sa feuille et le lycée fictif ne servent qu'aux visiteurs : un
   morceau à part, chargé à la demande. On y entre par « Essayer sans
   compte » (ui/connexion.js, vue `decouvrir`) ou par une adresse /demo/…
   rechargée (boot(), ui/onboarding.js). Rien d'autre ne doit importer
   ui/demo.js — passer par ici. */
let morceau = null, attente = null;

export function chargerDemo() {
  if (morceau) return Promise.resolve(morceau);
  if (!attente) {
    attente = import('./demo.js').then(m => (morceau = m)).catch(e => { attente = null; throw e; });
  }
  return attente;
}

/* Une adresse /demo/<rôle>/… : la démo reprend avec ce rôle, sur cet écran. */
export function ouvrirDemo(adresse) {
  return chargerDemo().then(m => m.lancer(adresse.role, adresse))
    .catch(() => toast(I.x, 'La démo n’a pas pu s’ouvrir : vérifie ta connexion'));
}
