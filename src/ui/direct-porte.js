// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { $ } from '../racine.js';
import { I, svg } from '../icones.js';
import { defi, directNeuf, setDirect, view } from '../data/etat.js';
import { go, render } from './bibliotheque.js';
import { rejoindreSalle } from '../core/cercle.js';
import { messageSalle, pinComplet, pinDepuisTexte } from '../defi.js';
import { toast } from './import-cartes.js';
import { garder, lire, oublier } from '../lien-garde.js';

/* ══════════ la porte d'une partie en direct ══════════
   L'écran d'une partie (hôte et joueur, sa feuille de style, sa boucle
   réseau) est un morceau chargé à la demande, comme l'espace professeur :
   on ne le télécharge qu'en ouvrant une partie, puis le service worker le
   garde. Rien d'autre ne doit importer `ui/direct-ecran.js` directement —
   passer par ici, sinon le morceau retombe dans le démarrage. */

let ecran = null, charge = null;

export function chargerDirect() {
  if (ecran) return Promise.resolve(ecran);
  if (!charge) charge = import('./direct-ecran.js').then(m => (ecran = m)).catch(e => { charge = null; throw e; });
  return charge;
}

/* En quittant la partie, on revient d'où on l'avait ouverte : le cercle, un
   club, « Ma classe » — ou, pour l'hôte, l'écran d'où il avait lancé le défi. */
export function ouvrirDirect(id) {
  if (!id) return;
  const retour = view.name === 'defi' ? defi.retour : view.name === 'direct' ? null : { name: view.name, id: view.id };
  setDirect({ ...directNeuf(), id, retour });
  go('direct');
}

export function directView() {
  if (ecran) return ecran.directEcran();
  $.innerHTML = `<div class="dx-porte">${svg(I.bolt)}<p>Ouverture de la partie…</p></div>`;
  chargerDirect().then(() => { if (view.name === 'direct') render(); }).catch(() => {
    toast(I.x, 'La partie n’a pas pu s’ouvrir : vérifie ta connexion');
    go('commu');
  });
}

/* « ?defi=482913 » : le lien (ou le QR) projeté par l'hôte. Sans session, le
   code attend la connexion (sessionStorage), comme « ?rejoindre= ». */
export async function consumeDefi(connecte) {
  const p = new URLSearchParams(location.search), brut = p.get('defi');
  let k = brut ? pinDepuisTexte(brut) : '';
  if (brut) {
    p.delete('defi');
    history.replaceState(null, '', location.pathname + (p.toString() ? '?' + p : '') + location.hash);
  }
  k = k || lire('folio.defi');
  if (!pinComplet(k)) return false;
  connecte ? oublier('folio.defi') : garder('folio.defi', k);             // src/lien-garde.js
  if (!connecte) return false;
  const r = await rejoindreSalle(k);
  if (r.statut === 'ok' || r.statut === 'hote') { ouvrirDirect(r.salle); return true; }
  toast(I.x, messageSalle(r.statut) || 'Impossible d’entrer dans la partie');
  return false;
}
