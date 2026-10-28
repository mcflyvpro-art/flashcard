// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { $ } from '../racine.js';
import { I, svg } from '../icones.js';
import { demoEtab, myRole, offre, plusNeuf, setPlus, view } from '../data/etat.js';
import { lireRetour } from '../abonnement.js';
import { iaMoisPull, offrePull } from '../core/abonnement.js';
import { go, render } from './bibliotheque.js';
import { toast } from './import-cartes.js';

/* ══════════ la porte de l'écran Mirandola+ (2026-10-27) ══════════
   L'écran (ui/plus.js et sa feuille plus.css, préfixe fp-) : ce que ce
   compte a, ce qu'il peut prendre, et, après le paiement, Mirandola sur tous
   ses écrans. Il sert rarement : il se charge à la demande. Rien d'autre ne
   doit importer ui/plus.js — passer par ici. Son adresse : …/mirandola-plus
   (src/routes.js), et « ?plus=… » pour y entrer depuis le site ou au retour
   de Stripe (consumePlus, branché dans ui/liens-entrants.js). */
let mod = null, charge = null;

function charger() {
  if (mod) return Promise.resolve(mod);
  if (!charge) charge = import('./plus.js').then(m => (mod = m)).catch(e => { charge = null; throw e; });
  return charge;
}

export function plusView() {
  if (mod) return mod.plusEcran();
  $.innerHTML = `<div class="page"><div class="empty">${svg(I.spark)}</div></div>`;
  charger().then(() => { if (view.name === 'plus') render(); })
    .catch(() => toast(I.x, 'Mirandola+ n’a pas pu s’ouvrir : vérifie ta connexion'));
}

/* Le référent et l'éditeur gèrent un établissement : Mirandola+ ne les regarde pas. */
export const sansFolioPlus = () => myRole === 'ref' || myRole === 'admin' || !!demoEtab;

/* L'onglet Mirandola+ (la barre au téléphone, la barre latérale sur
   ordinateur) : pour un élève ou un professeur en Mirandola gratuit, la base
   l'ayant dit — jamais sur une offre inconnue. Mirandola+ pris, il s'en va ;
   l'écran reste dans les Réglages (gérer son abonnement). */
export const ongletPlus = () => !sansFolioPlus() && !!offre && offre.offre === 'gratuit';

/* L'entrée de la barre latérale, sur ordinateur (2026-10-28) : toujours
   là pour un élève ou un professeur, en bas au-dessus des Réglages — pour
   un compte gratuit, ce qu'il peut prendre ; pour un abonné ou un compte
   d'établissement, sa licence (échéance, prix, résilier). */
export const entreePlus = () => !sansFolioPlus() && !!offre;

/* `o` : { etape, formule, raison } — le retour de Stripe, la formule
   choisie sur le site, ce que l'élève vient de toucher (ui/bridage.js). */
export function ouvrirPlus(o = {}) {
  setPlus({ ...plusNeuf(), formule: o.formule || 'annuel', etape: o.etape || null, raison: o.raison || null });
  go('plus');
  offrePull().then(() => (offre && offre.offre !== 'gratuit' ? iaMoisPull() : null))
    .then(() => { if (view.name === 'plus') render(); });
}

/* « ?plus=… », comme les codes de classe (ui/liens-entrants.js) : sans
   session, rangé jusqu'à la connexion ; avec, l'écran s'ouvre. Le paramètre
   `session` de Stripe part avec : recharger ne rejoue rien. */
export function consumePlus(connecte) {
  const p = new URLSearchParams(location.search), brut = p.get('plus');
  if (brut != null) {
    p.delete('plus'); p.delete('session');
    history.replaceState(null, '', location.pathname + (p.toString() ? '?' + p : '') + location.hash);
  }
  let v = brut;
  try { if (v == null) v = sessionStorage.getItem('folio.plus'); } catch (e) { /* stockage indisponible : le lien ne survivra pas à la connexion */ }
  if (v == null) return false;
  try { if (connecte) sessionStorage.removeItem('folio.plus'); else sessionStorage.setItem('folio.plus', v); }
  catch (e) { /* idem */ }
  if (!connecte || sansFolioPlus()) return false;
  ouvrirPlus(lireRetour(v) || {});
  return true;
}
