// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { $ } from '../racine.js';
import { I, svg } from '../icones.js';
import { auth, db, online, prefs, view } from '../data/etat.js';
import { COLORS, delSubject, esc, pushSubject, save } from '../core/coeur-sync.js';
import { envoyerPrefs, saveHandle } from '../core/reglages-corbeille.js';
import { choisirMonJeton } from '../core/visuels.js';
import { avatarSvg } from '../avatar.js';
import { COULEURS } from '../jeton.js';
import {
  MATIERES, matieresApres, NIVEAUX_PERSO, OBJECTIFS, prenomValide, propositions, pseudoPropose, pseudoValide
} from '../bienvenue.js';
import { go } from './bibliotheque.js';
import { ouvrirCode } from './code-entree.js';
import { savePrefs } from './import-cartes.js';
import './bienvenue.css';

/* ══════════ l'accueil d'un nouveau compte (2026-10-26) ══════════
   Chargé une fois par compte par ui/bienvenue-porte.js. Un particulier :
   « pour moi » ou « j'ai un code », puis son prénom et son pseudo, son
   visage, son niveau et ses matières, un objectif — et la visite guidée.
   Un élève entré par son établissement : son visage seulement. Peu de
   mots, de gros boutons, une étape par écran ; « Passer » à tout moment. */

const e = { mode: 'perso', etape: 0, apres: null, prenom: '', pseudo: '', pseudoTouche: false,
  tour: 0, choix: null, niveau: '', matieres: new Set(), objectif: 20, envoi: false };

const ETAPES_PERSO = ['choix', 'nom', 'visage', 'matieres', 'objectif'];
const etapes = () => (e.mode === 'classe' ? ['visage'] : ETAPES_PERSO);

export function commencer(mode, apres) {
  Object.assign(e, { mode, etape: 0, apres, prenom: String(prefs.name || '').trim(), pseudo: '', pseudoTouche: false,
    tour: 0, choix: null, niveau: '', matieres: new Set(), objectif: prefs.goal || 20, envoi: false });
  e.pseudo = pseudoPropose(e.prenom, auth && auth.email);
  go('bienvenue');
}

const repeint = () => { if (view.name === 'bienvenue') bienvenueEcran(); };
const gros = (act, ic, titre, on, attr = '') => `<button class="bv-gros${on ? ' on' : ''}" data-bv="${act}" ${attr}>
  ${ic ? svg(ic) : ''}<b>${titre}</b></button>`;

/* ---------- les étapes ---------- */
function choix() {
  return `<h1 class="bv-t">Bienvenue sur Folio</h1>
    <div class="bv-duo">
      ${gros('pour-moi', I.book, 'Je révise pour moi')}
      ${gros('code', I.key, 'J’ai un code')}
    </div>`;
}

function nom() {
  return `<h1 class="bv-t">Comment t’appelles-tu&nbsp;?</h1>
    <div class="bv-champs">
      <label class="bv-ch"><span>Prénom</span><input id="bvpre" data-bvin="prenom" value="${esc(e.prenom)}" maxlength="40"
        autocomplete="given-name" enterkeyhint="next"></label>
      <label class="bv-ch"><span>Pseudo</span><span class="bv-arobase"><i>@</i><input id="bvpse" data-bvin="pseudo"
        value="${esc(e.pseudo)}" maxlength="20" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="done"></span></label>
    </div>`;
}

function visage() {
  const l = propositions(auth ? auth.uid : 'folio', e.tour);
  if (!e.choix) e.choix = l[0];
  return `<h1 class="bv-t">Choisis ton visage</h1>
    <div class="bv-moi"><i class="jt xl vis" style="--k:${COULEURS[e.choix.teinte]}">${avatarSvg(e.choix.avatar)}</i></div>
    <div class="bv-visages">${l.map((p, i) => `<button class="bv-vis${p.cle === e.choix.cle ? ' on' : ''}" data-bv="visage" data-i="${i}"
      aria-label="Visage ${i + 1}" aria-pressed="${p.cle === e.choix.cle}"><i class="jt lg vis" style="--k:${COULEURS[p.teinte]}">${
        avatarSvg(p.avatar)}</i></button>`).join('')}</div>
    <button class="bv-lnk" data-bv="autres">${svg(I.shuffle)}D’autres</button>`;
}

function matieres() {
  return `<h1 class="bv-t">Tu es en…</h1>
    <div class="bv-niveaux">${Object.entries(NIVEAUX_PERSO).map(([k, t]) =>
      `<button class="bv-pil${e.niveau === k ? ' on' : ''}" data-bv="niveau" data-v="${k}">${t}</button>`).join('')}</div>
    ${e.niveau ? `<div class="bv-mats">${MATIERES[e.niveau].map(m =>
      `<button class="bv-mat${e.matieres.has(m) ? ' on' : ''}" data-bv="matiere" data-v="${esc(m)}" aria-pressed="${e.matieres.has(m)}">${
        e.matieres.has(m) ? svg(I.check) : ''}${esc(m)}</button>`).join('')}</div>` : ''}`;
}

function objectif() {
  return `<h1 class="bv-t">Combien de pages par jour&nbsp;?</h1>
    <div class="bv-objectifs">${OBJECTIFS.map(o => `<button class="bv-obj${e.objectif === o.n ? ' on' : ''}" data-bv="objectif"
      data-v="${o.n}"><b>${o.n}</b><span>${o.t}</span></button>`).join('')}</div>`;
}

const ECRANS = { choix, nom, visage, matieres, objectif };

/* Le bouton du bas : « Continuer », ou « C'est parti » à la dernière étape.
   La première étape d'un particulier se choisit par ses deux gros boutons. */
function suite() {
  const k = etapes()[e.etape], dernier = e.etape === etapes().length - 1;
  if (k === 'choix') return '';
  const pret = k === 'nom' ? prenomValide(e.prenom) && pseudoValide(e.pseudo) : k === 'matieres' ? !!e.niveau : true;
  return `<button class="cta bv-go" id="bvgo" data-bv="suivant" ${pret && !e.envoi ? '' : 'disabled'}>${
    dernier ? 'C’est parti' : 'Continuer'}${svg(I.arrow)}</button>`;
}

export function bienvenueEcran() {
  const l = etapes(), k = l[e.etape];
  $.innerHTML = `<div class="bv" id="page" data-etape="${k}">
      <div class="bv-haut">
        ${e.etape > 0 ? `<button class="ic" data-bv="retour" aria-label="Retour">${svg(I.back)}</button>` : '<span></span>'}
        ${l.length > 1 ? `<div class="bv-points">${l.map((x, i) => `<i class="${i <= e.etape ? 'on' : ''}"></i>`).join('')}</div>` : '<span></span>'}
        <button class="bv-passer" data-bv="passer">Passer</button>
      </div>
      <div class="bv-corps">${ECRANS[k]()}</div>
      <div class="bv-bas">${suite()}</div>
    </div>`;
  if (k === 'nom') setTimeout(() => { const i = document.getElementById(e.prenom ? 'bvpse' : 'bvpre'); if (i && !e.prenom) i.focus(); }, 80);
}

/* ---------- la fin : tout ce qu'on a choisi part d'un coup ---------- */
async function poserMatieres() {
  if (!e.matieres.size) return;
  const { liste, retirees } = matieresApres(db.subjects, db.decks, [...e.matieres], COLORS);
  const avant = new Set(db.subjects.map(s => s.id));
  db.subjects = liste;
  save();
  for (const s of liste) if (!avant.has(s.id)) pushSubject(s);
  for (const s of retirees) delSubject(s.id);
}

async function terminer(complet) {
  e.envoi = true; repeint();
  prefs.bienvenue = 1;
  if (complet && e.mode === 'perso') {
    prefs.name = e.prenom.trim(); prefs.goal = e.objectif; if (e.niveau) prefs.niveau = e.niveau;
    await poserMatieres();
    if (online && pseudoValide(e.pseudo)) await saveHandle(e.pseudo);
  }
  await envoyerPrefs();                 // tout de suite : la visite guidée qui suit n'envoie plus rien
  if (complet && e.choix) await choisirMonJeton(e.choix.cle, e.choix.teinte);
  e.envoi = false;
  go(e.mode === 'classe' ? 'classes' : 'home');
  if (e.mode === 'perso' && e.apres) e.apres();
}

/* ---------- les gestes ---------- */
const ACTIONS = {
  'pour-moi': () => { e.etape = 1; repeint(); },
  code: () => { prefs.bienvenue = 1; savePrefs(); go('home'); ouvrirCode(); },
  passer: () => terminer(false),
  retour: () => { e.etape = Math.max(0, e.etape - 1); repeint(); },
  suivant: () => { if (e.etape >= etapes().length - 1) return terminer(true); e.etape++; repeint(); },
  visage: (b) => { e.choix = propositions(auth ? auth.uid : 'folio', e.tour)[+b.dataset.i]; repeint(); },
  autres: () => { e.tour++; e.choix = null; repeint(); },
  niveau: (b) => { if (e.niveau !== b.dataset.v) e.matieres = new Set(); e.niveau = b.dataset.v; repeint(); },
  matiere: (b) => { const m = b.dataset.v; e.matieres.has(m) ? e.matieres.delete(m) : e.matieres.add(m); repeint(); },
  objectif: (b) => { e.objectif = +b.dataset.v; repeint(); }
};

document.addEventListener('click', ev => {
  const b = ev.target.closest('[data-bv]');
  if (!b || b.disabled || view.name !== 'bienvenue') return;
  const f = ACTIONS[b.dataset.bv];
  if (!f) return;
  ev.preventDefault();
  f(b);
});

/* La saisie ne repeint pas l'écran (le clavier du téléphone sauterait) : le
   pseudo suit le prénom tant qu'on ne l'a pas touché, le bouton s'allume. */
document.addEventListener('input', ev => {
  const n = ev.target.closest && ev.target.closest('[data-bvin]');
  if (!n || view.name !== 'bienvenue') return;
  if (n.dataset.bvin === 'prenom') {
    e.prenom = n.value;
    if (!e.pseudoTouche) {
      e.pseudo = pseudoPropose(e.prenom, auth && auth.email);
      const p = document.getElementById('bvpse'); if (p) p.value = e.pseudo;
    }
  } else {
    e.pseudoTouche = true;
    e.pseudo = n.value.toLowerCase().replace(/[^a-z0-9_.-]/g, '').slice(0, 20);
    if (n.value !== e.pseudo) n.value = e.pseudo;
  }
  const b = document.getElementById('bvgo');
  if (b) b.disabled = !(prenomValide(e.prenom) && pseudoValide(e.pseudo));
});

document.addEventListener('keydown', ev => {
  if (ev.key !== 'Enter' || view.name !== 'bienvenue' || !ev.target.closest || !ev.target.closest('[data-bvin]')) return;
  const b = document.getElementById('bvgo');
  if (b && !b.disabled) { ev.preventDefault(); b.click(); }
  else if (ev.target.id === 'bvpre') { ev.preventDefault(); document.getElementById('bvpse')?.focus(); }
});

