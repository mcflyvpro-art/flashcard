// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { $ } from '../racine.js';
import { I, svg } from '../icones.js';
import {
  DEFPREFS, admNeuf, demoEtab, eleveNeuf, profNeuf, refNeuf, setAdm, setAuth, setCompte, setDb, setDemo, setDemoEtab, setEleve, setMe,
  setMyRole, setPrefs, setProf, setRef, setSchool
} from '../data/etat.js';
import { esc } from '../core/coeur-sync.js';
import { refPull } from '../core/classement.js';
import { eleveClassesPull } from '../core/eleve-classes.js';
import { ETAB, journalDemo, reponseDemo, ROLES_DEMO } from '../demo-etab.js';
import { go } from './bibliotheque.js';
import { demoDB } from './onboarding.js';
import { allerAccueil } from './prof-porte.js';
import './demo.css';

/* ══════════ « Essayer Folio », sans compte (2026-10-26) ══════════
   Chargé à la demande par ui/connexion.js (`decouvrirView`). Le visiteur
   choisit un rôle dans le « Lycée Démo Folio » (src/demo-etab.js) et l'app
   s'ouvre comme pour un vrai compte — ses vrais écrans — ; seules ses
   demandes à la base sont servies par le lycée fictif (setDemoEtab,
   branché dans api()). Rien ne part : une écriture est refusée avec
   « Démo : rien n'est enregistré », le cache local n'est jamais touché
   (`demo`), et « Quitter » recharge la page — rien ne reste en mémoire. */

const ROLES = [
  { k: 'eleve', t: 'Élève', s: 'Ses devoirs, ses livres', ic: I.user, nom: 'Léa' },
  { k: 'prof', t: 'Professeur', s: 'Ses classes, un groupe, un devoir', ic: I.school, nom: 'Marc' },
  { k: 'ref', t: 'Référent', s: 'Les codes, les classes, les élèves', ic: I.build, nom: 'Claire' }
];

export function decouvrirEcran() {
  $.innerHTML = `<div class="bar"><button class="ic" data-act="tolog" aria-label="Retour">${svg(I.back)}</button></div>
    <div class="page dm" id="page">
      <div class="top"><div class="hero">Essayer Folio</div></div>
      <span class="dm-etab">${svg(I.school)}${esc(ETAB.nom)}</span>
      <div class="dm-roles">${ROLES.map(r => `<button class="dm-role" data-dm="lancer" data-v="${r.k}">
        <i class="dm-ic">${svg(r.ic)}</i><b>${r.t}</b><span>${r.s}</span></button>`).join('')}</div>
      <button class="lnk" data-act="demande" type="button">${svg(I.mail)}Une démo pour mon établissement</button>
    </div>`;
}

/* Le lycée fictif répond à tout ce que l'app demande. Une écriture lève :
   chaque écran la montre déjà comme un refus (« Démo : rien n'est
   enregistré »), au lieu de faire croire qu'elle a réussi. */
function repondre(role, path, method, body) {
  const m = /\/rest\/v1\/rpc\/([a-z_]+)/.exec(path);
  if (m) {
    const r = reponseDemo(role, m[1], body || {});
    if (r === undefined) throw new Error('Démo : rien n’est enregistré');
    return JSON.parse(JSON.stringify(r));
  }
  if (/\/rest\/v1\/ref_audit/.test(path)) return journalDemo();
  return (method || 'GET') === 'GET' ? [] : null;      // le reste (préférences, révisions…) se tait : rien ne part
}

function bandeau(role) {
  let b = document.getElementById('dmbandeau');
  if (!b) { b = document.createElement('div'); b.id = 'dmbandeau'; b.className = 'dm-bandeau'; document.body.appendChild(b); }
  b.innerHTML = `<b>Démo</b>
    <select data-dm-role aria-label="Rôle">${ROLES.map(r => `<option value="${r.k}"${r.k === role ? ' selected' : ''}>${r.t}</option>`).join('')}</select>
    <button data-dm="quitter">${svg(I.exit)}<span>Quitter</span></button>`;
  document.documentElement.classList.add('en-demo');
}

/* Quelques caches par compte (jetons, journal) s'écrivent quand même sous
   l'identifiant de démo : on les efface en entrant et en sortant. */
function nettoyer() {
  try {
    Object.keys(localStorage).filter(k => /demo-(eleve|prof|ref)$/.test(k)).forEach(k => localStorage.removeItem(k));
  } catch (e) { /* stockage indisponible : il n'y a alors rien à effacer */ }
}

function quitter() {
  nettoyer();
  location.replace(location.pathname);   // tout repart de zéro : plus de session, plus de lycée fictif
}

export function lancer(role) {
  const r = ROLES.find(x => x.k === role) || ROLES[0], uid = ROLES_DEMO[r.k];
  nettoyer();
  setDemo(true);
  setDemoEtab((path, method, body) => repondre(r.k, path, method, body));
  setAuth({ uid, email: 'demo@folio.app', token: '', refresh: '', exp: Date.now() + 864e5 });   // en mémoire seulement
  setMyRole(r.k);
  setSchool(reponseDemo(r.k, 'my_school')[0]);
  setCompte(reponseDemo(r.k, 'mon_compte')[0]);
  setMe({ id: uid, handle: '' });
  setProf(profNeuf()); setRef(refNeuf()); setEleve(eleveNeuf()); setAdm(admNeuf());
  setPrefs({ ...DEFPREFS, name: r.nom, tuto: 1, bienvenue: 1 });   // ni visite guidée ni accueil
  setDb(r.k === 'ref' ? { subjects: [], decks: [], hist: {} } : demoDB());
  bandeau(r.k);
  if (r.k === 'ref') { refPull(); return go('ref'); }
  if (r.k === 'prof') return allerAccueil();
  eleveClassesPull();
  return go('classes');
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-dm]');
  if (!b) return;
  e.preventDefault();
  if (b.dataset.dm === 'lancer') lancer(b.dataset.v);
  if (b.dataset.dm === 'quitter') quitter();
});

/* « Se déconnecter », dans la démo, c'est la quitter : la déconnexion
   ordinaire laisserait le lycée fictif branché sur api() pour le compte
   qui se connecterait ensuite. Écouté avant le gestionnaire de l'app. */
document.addEventListener('click', e => {
  if (!demoEtab || !e.target.closest('[data-act="logout"]')) return;
  e.stopPropagation(); e.preventDefault();
  quitter();
}, true);

document.addEventListener('change', e => {
  if (e.target.matches && e.target.matches('[data-dm-role]')) lancer(e.target.value);
});
