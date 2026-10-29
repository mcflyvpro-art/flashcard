// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { auth, demoEtab, myRole, prefs, setView, tuto, view } from '../data/etat.js';
import { render } from './bibliotheque.js';
import { boot, consumeHash } from './onboarding.js';
import { consumeRejoindre } from './eleve-classes.js';
import { consumeDefi } from './direct-porte.js';
import { consumeClub } from './cercle-feuilles.js';
import { consumeGoto } from './raccourcis.js';
import { consumePlus } from './plus-porte.js';
import { aInstaller } from './pwa-porte.js';
import { reprendrePassage } from './passage.js';
import { lireRetour, sessionDepuisRetour } from '../core/connexion-externe.js';
import { demanderNouveauMdp } from './mdp-porte.js';
import { toast } from './import-cartes.js';
import { I } from '../icones.js';

/* ══════════ les liens qui entrent dans l'app ══════════
   Une seule porte pour tout lien qui ouvre l'app : « #i= » / « #s= » (un
   livre partagé), « ?go= » (raccourci de
   l'icône), « ?rejoindre= » (une classe), « ?defi= » (une partie en
   direct), « ?club= » (un club), « ?plus= » (l'écran Mirandola+ : un bouton du
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
  try {
    if (await sessionDepuisRetour(r) === 'recovery') demanderNouveauMdp();
  } catch (e) { toast(I.x, 'Ce lien a expiré : redemande-le'); }
}

/* Les codes de l'adresse, rangés pour plus tard : sans session, ou devant
   la porte d'installation (ui/pwa.js), qui les confie à l'app installée. */
export async function rangerLiens() {
  consumeRejoindre(false);
  await consumeDefi(false);
  consumeClub(false);
  consumePlus(false);
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
  return consumePlus(true);
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
