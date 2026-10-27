// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { $ } from '../racine.js';
import { I, svg } from '../icones.js';
import { setAuth, setDb, setDemo, setDemoEtab, demoEtab } from '../data/etat.js';
import { esc, flush, pull, setOnline } from '../core/coeur-sync.js';
import { accueil } from '../core/classement.js';
import { nouveauStore, repondre } from '../base-locale/serveur.js';
import { COMPTES, ETAB, PREFIXE, semerMonde, teinteDemo, visageDemo } from '../base-locale/monde.js';
import { avatarSvg, ecrireAvatar, lireAvatar } from '../avatar.js';
import { COULEURS } from '../jeton.js';
import { go } from './bibliotheque.js';
import { resetSession } from './onboarding.js';
import { pubTete } from './connexion.js';
import { armerSur, desarmer } from './routeur.js';
import './demo.css';

/* ══════════ « Essayer Folio », sans compte (2026-10-26) ══════════
   Chargé à la demande par sa porte, ui/demo-porte.js. Le visiteur choisit un
   rôle dans le « Lycée Démo Folio » et l'app s'ouvre pour de vrai : ses
   écrans, sa synchro, ses gestes — seul le réseau est remplacé. Chaque
   requête est servie dans l'onglet par la base locale (src/base-locale/,
   le même Supabase en mémoire que les parcours e2e), semée du monde de
   monde.js. Tout marche donc : créer une classe, donner un devoir, le
   faire en tant qu'élève, écrire à la classe, prêter un livre, lire, voir
   son journal. Rien ne part vers la base, et chaque visiteur a son lycée à
   lui : mille personnes peuvent essayer en même temps sans se croiser.

   Le monde est rangé en sessionStorage (`folio.demo`) : rafraîchir la page
   le retrouve tel qu'on l'a laissé, fermer l'onglet l'efface. La session
   ne vit qu'en mémoire (saveAuth ne touche pas au stockage en démo, save()
   non plus) ; ce que l'app range quand même sous l'identifiant d'un compte
   de démo (jetons, journal) est effacé en entrant et en sortant. Changer de
   rôle, c'est se reconnecter sur un autre compte du même lycée : ce que
   Marc donne, Léa le reçoit. */

/* n : le numéro de la personne dans monde.js (son visage, sa couleur) ;
   t : le rôle sur la porte, c : dans le bandeau, q : ce qu'on y verra. */
const ROLES = [
  { k: 'eleve', n: 1, t: 'Élève', c: 'Élève', s: 'Léa · 2nde B', q: 'Ses devoirs, ses livres, sa série' },
  { k: 'prof', n: 2, t: 'Professeur', c: 'Professeur', s: 'Marc · mathématiques', q: 'Ses classes, un devoir à donner' },
  { k: 'ref', n: 3, t: 'Référent de l’établissement', c: 'Référent', s: 'Claire · le lycée', q: 'Les codes, les classes, les comptes' }
];
const CLE = 'folio.demo';

export function decouvrirEcran() {
  $.innerHTML = `<div class="pub pub-essai">${pubTete()}
    <div class="dm">
      <span class="dm-etab">${svg(I.school)}${esc(ETAB.nom)}</span>
      <h1 class="dm-t">Essaie <em>Folio.</em></h1>
      <p class="dm-s">Choisis qui tu es. Rien ne s’enregistre.</p>
      <div class="dm-roles">${ROLES.map(r => `<button class="dm-role" data-dm="lancer" data-v="${r.k}">
        <i class="dm-av" style="--c:${COULEURS[teinteDemo(r.n)]}">${avatarSvg(lireAvatar(ecrireAvatar(visageDemo(r.n))))}</i>
        <span class="dm-qui"><b>${r.t}</b><span>${r.s}</span><small>${r.q}</small></span>
        <i class="dm-go">${svg(I.arrow)}</i></button>`).join('')}</div>
      <button class="lnk dm-lien" data-act="demande" type="button">${svg(I.mail)}Une démo pour mon établissement</button>
    </div>
  </div>`;
}

/* ---------- le lycée, gardé le temps de l'onglet ---------- */
let monde = null, minuteur = 0;

function chargerMonde() {
  try {
    const s = JSON.parse(sessionStorage.getItem(CLE) || 'null');
    if (s && s.v === 1 && s.monde) return s.monde;
  } catch (e) { /* stockage refusé ou abîmé : un lycée neuf */ }
  return semerMonde(nouveauStore());
}

function ranger() {
  clearTimeout(minuteur);
  if (!monde) return;
  monde.journal = [];
  try { sessionStorage.setItem(CLE, JSON.stringify({ v: 1, monde })); }
  catch (e) { /* trop gros ou refusé : la démo continue, un rafraîchissement repartirait du lycée neuf */ }
}
const garder = () => { clearTimeout(minuteur); minuteur = setTimeout(ranger, 300); };
// un rafraîchissement juste après un geste : ce geste est rangé avant que la page parte
window.addEventListener('pagehide', () => { if (demoEtab) ranger(); });

/* Le `fetch` de la démo : la requête, servie par la base locale. */
async function servir(url, init = {}) {
  if (!monde) return new Response(null, { status: 503 });   // la démo est en train de partir
  const headers = {};
  for (const [k, v] of Object.entries(init.headers || {})) headers[k.toLowerCase()] = v;
  let body;
  try { body = typeof init.body === 'string' ? JSON.parse(init.body) : null; } catch (e) { body = null; }   // pas du JSON : pas de corps
  const method = (init.method || 'GET').toUpperCase();
  const [status, json, h] = repondre(monde, { method, url: new URL(url), headers, body });
  if (monde.journal.length > 200) monde.journal.length = 0;
  if (method !== 'GET') garder();
  return new Response(json == null || status === 204 ? null : JSON.stringify(json),
    { status, headers: { 'content-type': 'application/json', ...(h || {}) } });
}

/* Ce que l'app a rangé sous un compte de démo (jetons, journal, reprise
   d'une lecture) : effacé en entrant et en sortant. */
function nettoyer() {
  try {
    Object.keys(localStorage).filter(k => k.includes(PREFIXE)).forEach(k => localStorage.removeItem(k));
  } catch (e) { /* stockage indisponible : il n'y a alors rien à effacer */ }
}

function bandeau(role) {
  let b = document.getElementById('dmbandeau');
  if (!b) { b = document.createElement('div'); b.id = 'dmbandeau'; b.className = 'dm-bandeau'; document.body.appendChild(b); }
  b.innerHTML = `<b>Démo</b>
    <select data-dm-role aria-label="Rôle">${ROLES.map(r => `<option value="${r.k}"${r.k === role ? ' selected' : ''}>${r.c}</option>`).join('')}</select>
    <button data-dm="neuf" class="dm-neuf" aria-label="Recommencer la démo" title="Recommencer">${svg(I.refresh)}</button>
    <button data-dm="quitter">${svg(I.exit)}<span>Quitter</span></button>`;
  document.documentElement.classList.add('en-demo');
}

export function quitter() {
  monde = null;                        // plus rien ne se range, même pendant que la page part
  nettoyer();
  try { sessionStorage.removeItem(CLE); } catch (e) { /* rien à effacer */ }
  location.replace('/');               // le site : tout repart de zéro, plus de session, plus de lycée
}

/* Entrer (ou changer de rôle) : une connexion comme une autre, sur un
   compte du lycée. `adresse` : l'écran d'une adresse /demo/… rechargée. */
export async function lancer(role, adresse) {
  const r = ROLES.find(x => x.k === role) || ROLES[0], uid = COMPTES[r.k];
  desarmer();
  if (!monde) { nettoyer(); monde = chargerMonde(); }
  setDemoEtab(servir);
  setDemo(false);
  resetSession();                      // ce qui appartenait au rôle d'avant
  setAuth({ uid, email: `${r.k}@demo.folio.invalid`, token: `tok-${uid}-demo`, refresh: '', exp: Date.now() + 365 * 864e5 });
  bandeau(r.k);
  setDb({ subjects: [], decks: [], hist: {} });
  go('home');
  await pull();                        // sa bibliothèque, depuis la base locale
  setOnline(true);
  await accueil();                     // son rôle, son établissement, son écran d'arrivée
  flush();
  armerSur(adresse && adresse.name && !adresse.racine ? adresse : null);
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-dm]');
  if (!b) return;
  e.preventDefault();
  if (b.dataset.dm === 'lancer') lancer(b.dataset.v);
  if (b.dataset.dm === 'quitter') quitter();
  if (b.dataset.dm === 'neuf') {
    const role = (document.querySelector('[data-dm-role]') || {}).value || 'eleve';
    try { sessionStorage.removeItem(CLE); } catch (x) { /* rien à effacer */ }
    nettoyer(); monde = semerMonde(nouveauStore()); garder();
    lancer(role);
  }
});

/* « Se déconnecter », dans la démo, c'est la quitter : la déconnexion
   ordinaire laisserait la base locale branchée pour le compte qui se
   connecterait ensuite. Écouté avant le gestionnaire de l'app. */
document.addEventListener('click', e => {
  if (!demoEtab || !e.target.closest('[data-act="logout"]')) return;
  e.stopPropagation(); e.preventDefault();
  quitter();
}, true);

document.addEventListener('change', e => {
  if (e.target.matches && e.target.matches('[data-dm-role]')) lancer(e.target.value);
});
