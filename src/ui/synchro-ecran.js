// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { auth, cardEdit, demoEtab, mailbox, menu, quiz, sel, setAnimate, study, tuto, view } from '../data/etat.js';
import { mailPull } from '../core/reglages-corbeille.js';
import { statsPull } from '../core/ecran-groupe.js';
import { eleveClassesPull } from '../core/eleve-classes.js';
import { sallesPull } from '../core/cercle.js';
import { duelsPull } from '../core/defis.js';
import { syncBibliotheque } from '../core/synchro.js';
import { aUneClasse, gestion, render } from './bibliotheque.js';
import { commuPull } from './cercle.js';
import { isProf } from './classement.js';
import { prechargerJournal } from './ecran-groupe.js';
import { prechargerCourrier } from './reglages-corbeille.js';

/* ══════════ des écrans prêts, des appareils d'accord (2026-10-28) ══════════
   Deux choses que l'on sentait : un écran vide le temps d'un battement en
   touchant Courrier, Journal, Cercle ou Classe — leur morceau et leurs
   données ne partaient qu'au toucher —, et une bibliothèque qui ne
   suivait l'autre appareil qu'après un rechargement.

   prechauffer() : à l'arrivée (accueil(), core/classement.js), au calme,
   les morceaux du courrier et du journal se chargent et les données des
   onglets voisins se lisent ; toucher l'onglet montre aussitôt ce qui est
   là, la relecture arrive par-dessus sans rien effacer. Dans la démo
   aussi : chaque rôle repasse par accueil().

   La synchro (core/synchro.js) : au retour sur l'app (focus, onglet
   visible, réseau revenu) et une fois par minute tant qu'on s'en sert.
   Jamais pendant une lecture, un quiz, une création ou une partie (on y
   tient des pages par leur adresse en mémoire), et l'écran ne se repeint
   pas sous les doigts : feuille ouverte, champ actif, sélection, page en
   cours de modification. */
let pret = false;

export function prechauffer() {
  if (!auth || gestion()) return;
  pret = true;
  const auCalme = window.requestIdleCallback || (f => setTimeout(f, 800));
  auCalme(() => {
    prechargerCourrier();
    prechargerJournal();
    if (mailbox.list == null) mailPull();
    statsPull(1);                                     // de fond : ne repeint que si le journal est à l'écran et a bougé
    commuPull();
    if (aUneClasse() && !isProf()) { eleveClassesPull(); sallesPull(); duelsPull(); }
  }, { timeout: 3000 });
}

const CALMES = /^(home|deck|stats|classes|classe|commu|friends|club|mail|lettre|settings|trash|profil|prof|profclasse|profagenda|plus)$/;
const tranquille = () => CALMES.test(view.name) && !study && !quiz && !tuto;

function peutRepeindre() {
  if (!tranquille() || menu || sel || cardEdit) return false;
  const a = document.activeElement;
  return !(a && a.closest && a.closest('#app') && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName));
}

let dernier = 0, actif = Date.now();
for (const t of ['pointerdown', 'keydown']) addEventListener(t, () => { actif = Date.now(); }, { capture: true, passive: true });

async function regarder(retour) {
  if (!pret || !auth || demoEtab || document.hidden || !tranquille()) return;
  const depuis = Date.now() - dernier;
  // au retour : pas deux fois en cinq secondes ; sinon une fois par minute, et seulement si l'on s'en sert
  if (retour ? depuis < 5000 : depuis < 55000 || Date.now() - actif > 5 * 60000) return;
  dernier = Date.now();
  if (await syncBibliotheque(peutRepeindre) && peutRepeindre()) { setAnimate(false); render(); }
}

document.addEventListener('visibilitychange', () => { if (!document.hidden) regarder(true); });
addEventListener('focus', () => regarder(true));
addEventListener('online', () => regarder(true));
setInterval(() => regarder(false), 15000);

// une déconnexion, un changement de rôle dans la démo : on repart de l'arrivée
export function oublierSynchro() { pret = false; dernier = 0; }
