// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { auth, cercle, demoEtab, myRole, prefs, setView, tuto, view } from '../data/etat.js';
import { go, render } from './bibliotheque.js';
import { boot, consumeHash } from './onboarding.js';
import { consumeRejoindre } from './eleve-classes.js';
import { consumeDefi } from './direct-porte.js';
import { consumeGoto } from './raccourcis.js';
import { consumePlus } from './plus-porte.js';
import { aInstaller } from './pwa-porte.js';
import { reprendrePassage } from './passage.js';
import { lireRetour, sessionDepuisRetour } from '../core/connexion-externe.js';
import { demanderNouveauMdp } from './mdp-porte.js';
import { toast } from './import-cartes.js';
import { I } from '../icones.js';
import { openShared } from '../core/reglages-corbeille.js';
import { garder, lire, oublier, prendre } from '../lien-garde.js';
import { codeClubDepuisTexte } from '../club.js';
import { clubsPull } from '../core/cercle.js';
import { tokComplet, tokDepuisTexte } from '../livre-code.js';
import { ouvrirCode } from './code-porte.js';

/* ══════════ les liens qui entrent dans l'app ══════════
   Une seule porte pour tout lien qui ouvre l'app : « #i= » / « #s= » (un
   livre partagé), « ?go= » (raccourci de
   l'icône), « ?rejoindre= » (une classe), « ?defi= » (une partie en
   direct), « ?club= » (un club), « ?ami= » (un ami), « ?plus= » (l'écran Mirandola+ : un bouton du
   site, le retour de Stripe). Chacun a son consommateur, qui lit
   l'adresse et la nettoie ; ce fichier ne fait que les appeler dans le
   bon ordre — le même au démarrage (`boot()`) qu'à l'arrivée d'un lien
   alors que l'app tourne déjà.

   Sous Capacitor, un lien universel (iOS) ou App Link (Android) n'ouvre
   pas une page : il réveille l'app, qui reçoit l'URL par l'événement
   `appUrlOpen`. C'est ici qu'il faudra la brancher, et nulle part ailleurs :
     App.addListener('appUrlOpen', e => traiterLienEntrant(e.url));
   (voir docs/CAPACITOR.md). */

/* Avant tout le reste. Sans session, les codes de classe, de partie et de club sont rangés en
   sessionStorage (et retirés de l'adresse) : ils attendent la connexion,
   repris par `lienApresRole()` depuis `accueil()`. Rend vrai s'il y a une
   session. */
export async function lienAvantSession() {
  reprendrePassage();                  // l'app installée reprend le code laissé par son navigateur (ui/passage.js)
  await consumeRetour();
  if (auth) return true;
  await rangerLiens();
  return false;
}

/* Le retour de Google, d'Apple ou d'un lien reçu par e-mail
   (core/connexion-externe.js) : la session est dans l'adresse ; on l'ouvre,
   et on retire aussitôt les jetons de l'adresse (l'historique, une capture
   d'écran, un lien copié ne doivent jamais les garder). Un lien « mot de
   passe oublié » mène tout droit au choix d'un nouveau mot de passe. */
async function consumeRetour() {
  const r = lireRetour(location.hash);
  if (!r) return;
  history.replaceState(history.state, '', location.pathname + location.search);
  if (r.erreur) { toast(I.x, /expired|invalid/i.test(r.erreur) ? 'Ce lien a expiré : redemande-le' : 'Connexion refusée'); return; }
  if (r.message) { toast(I.mail, 'C’est noté : ouvre aussi le lien envoyé à l’autre adresse'); return; }
  try {
    if (await sessionDepuisRetour(r) === 'recovery') demanderNouveauMdp();
  } catch (e) { toast(I.x, 'Ce lien a expiré : redemande-le'); }
}

/* Les codes de l'adresse, rangés pour plus tard : sans session, ou devant
   la porte d'installation (ui/pwa.js), qui les confie à l'app installée. */
export async function rangerLiens() {
  rangerLivre();
  consumeAmi(false);
  consumeRejoindre(false);
  await consumeDefi(false);
  consumeClub(false);
  consumePlus(false);
}

/* Un livre partagé (« #s= », src/livre-code.js) ou envoyé tout entier
   (« #i= ») : sans session, il se perdait — l'adresse repartait à la
   connexion, ou à la porte d'installation. Il attend désormais comme les
   autres codes (src/lien-garde.js, une heure), montré sur la carte de
   passage (ui/passage.js), et s'ouvre une fois le compte connu. */
function rangerLivre() {
  const h = location.hash;
  if (!/^#[si]=/.test(h)) return;
  if (h[1] === 's') { const t = tokDepuisTexte(h); if (tokComplet(t)) garder('folio.livre', t); }
  else garder('folio.import', h.slice(3));
  history.replaceState(history.state, '', location.pathname + location.search);
}

function consumeLivre() {
  const t = prendre('folio.livre');
  if (tokComplet(t)) { openShared(t); return true; }
  const i = prendre('folio.import');
  if (!i) return false;
  history.replaceState(history.state, '', location.pathname + location.search + '#i=' + i);
  return consumeHash();
}

/* Un élève qui commence (2026-10-29) : son accueil n'est pas fait, ou son
   tuto tourne. Ses codes attendent : celui d'une classe ouvre son accueil
   sur le nom et la classe (ui/bienvenue.js le reprend lui-même) ; une
   partie ou un club passent après le tuto (`premiers-pas-finis`). */
// comme ui/tuto-porte.js (premiereFois) : l'accueil ne s'ouvre qu'à qui n'a vu ni lui ni le tuto
const commence = () => !demoEtab && myRole === 'eleve' && ((!prefs.bienvenue && !prefs.tuto) || !!tuto);

/* Une fois le rôle connu (un code de classe ne veut pas dire la même chose
   pour un professeur et pour un élève) : la classe, la partie, le club. */
export async function lienApresRole() {
  if (aInstaller()) return false;      // devant la porte d'installation : le code attend l'app installée (ui/pwa.js)
  if (commence()) { await rangerLiens(); return false; }     // ceux de l'adresse aussi : gardés pour plus tard
  if (consumeRejoindre()) return true;
  if (await consumeDefi(true)) return true;
  if (consumeClub(true)) return true;
  if (consumeLivre()) return true;
  if (consumeAmi(true)) return true;
  return consumePlus(true);
}

/* « ?ami=pseudo » (2026-11-16) : le lien d'un ami. Dans l'app (Android,
   l'app native), la feuille « J'ai un code » s'ouvre sur son pseudo ; un
   appui envoie la demande. Sans session, il attend comme les autres. */
function consumeAmi(connecte) {
  const p = new URLSearchParams(location.search), a = p.get('ami');
  if (a) {
    p.delete('ami');
    history.replaceState(history.state, '', location.pathname + (p.toString() ? '?' + p : '') + location.hash);
    garder('folio.ami', a.replace(/^@/, '').toLowerCase());
  }
  if (!connecte) return false;
  const h = prendre('folio.ami');
  if (!h) return false;
  ouvrirCode('@' + h, { attendre: true });
  return true;
}

/* « ?club=CODE » : un lien d'invitation. Sans session, il attend la
   connexion (src/lien-garde.js), comme « ?rejoindre= » pour une classe. */
function consumeClub(connecte) {
  const p = new URLSearchParams(location.search), brut = p.get('club');
  let k = brut ? codeClubDepuisTexte(brut) : '';
  if (brut) {
    p.delete('club');
    history.replaceState(null, '', location.pathname + (p.toString() ? '?' + p : '') + location.hash);
  }
  k = k || lire('folio.club');
  if (!k) return false;
  connecte ? oublier('folio.club') : garder('folio.club', k);
  if (!connecte) return false;
  if (cercle.clubs === null) clubsPull();
  go('commu'); ouvrirCode('?club=' + k, { attendre: true });   // la feuille montre le code : on entre d'un appui
  return true;
}

/* Les premiers pas finis (le tuto s'en va pour de bon, ui/tuto.js) : ce
   qui attendait passe. Un peu plus tard : un tuto qui se relance aussitôt
   (le bandeau, les Réglages) n'est pas une fin. */
document.addEventListener('premiers-pas-finis', () => setTimeout(() => {
  if (auth && view.name !== 'login' && !commence()) lienApresRole();
}, 400));

/* Un lien reçu alors que l'app est déjà ouverte (Capacitor, ou tout appel
   qui fournit une URL). Son `search` et son `hash` remplacent ceux de
   l'adresse, puis les mêmes consommateurs que le démarrage passent. */
export async function traiterLienEntrant(url) {
  let u;
  try { u = new URL(url, location.href); } catch (e) { return false; }   // pas une adresse : rien à suivre
  history.replaceState(null, '', location.pathname + u.search + u.hash);
  const avant = auth && auth.uid;
  if (!(await lienAvantSession())) {
    if (view.name !== 'login') setView({ name: 'login' });
    render();
    return false;
  }
  /* La carte vient d'ouvrir une autre session : tout le démarrage, comme
     au premier lancement (bibliothèque du compte, rôle, écran d'arrivée). */
  if (auth.uid !== avant) { await boot(); return true; }
  if (consumeHash() || consumeGoto()) return true;
  return lienApresRole();
}
