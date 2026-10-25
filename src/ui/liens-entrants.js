// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { auth, setView, view } from '../data/etat.js';
import { render } from './bibliotheque.js';
import { consumeCarte } from './connexion.js';
import { boot, consumeHash } from './onboarding.js';
import { consumeRejoindre } from './eleve-classes.js';
import { consumeDefi } from './direct-porte.js';
import { consumeClub } from './cercle-feuilles.js';
import { consumeGoto } from './raccourcis.js';

/* ══════════ les liens qui entrent dans l'app ══════════
   Une seule porte pour tout lien qui ouvre l'app : « ?carte= » (le QR d'une
   carte élève), « #i= » / « #s= » (un livre partagé), « ?go= » (raccourci de
   l'icône), « ?rejoindre= » (une classe), « ?defi= » (une partie en
   direct), « ?club= » (un club). Chacun a son consommateur, qui lit
   l'adresse et la nettoie ; ce fichier ne fait que les appeler dans le
   bon ordre — le même au démarrage (`boot()`) qu'à l'arrivée d'un lien
   alors que l'app tourne déjà.

   Sous Capacitor, un lien universel (iOS) ou App Link (Android) n'ouvre
   pas une page : il réveille l'app, qui reçoit l'URL par l'événement
   `appUrlOpen`. C'est ici qu'il faudra la brancher, et nulle part ailleurs :
     App.addListener('appUrlOpen', e => traiterLienEntrant(e.url));
   (voir docs/CAPACITOR.md). */

/* Avant tout le reste : la carte élève peut ouvrir une session. Sans
   session, les codes de classe, de partie et de club sont rangés en
   sessionStorage (et retirés de l'adresse) : ils attendent la connexion,
   repris par `lienApresRole()` depuis `accueil()`. Rend vrai s'il y a une
   session. */
export async function lienAvantSession() {
  await consumeCarte();
  if (auth) return true;
  consumeRejoindre();
  await consumeDefi(false);
  consumeClub(false);
  return false;
}

/* Une fois le rôle connu (un code de classe ne veut pas dire la même chose
   pour un professeur et pour un élève) : la classe, la partie, le club. */
export async function lienApresRole() {
  if (consumeRejoindre()) return true;
  if (await consumeDefi(true)) return true;
  return consumeClub(true);
}

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
