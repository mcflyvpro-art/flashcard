// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { I, svg } from '../icones.js';
import { pinLisible } from '../defi.js';
import { codeClubLisible } from '../club.js';
import { formatCode } from '../classe.js';
import { toast } from './import-cartes.js';
import { garder, lire } from '../lien-garde.js';
import { mobile, plateforme } from '../plateformes.js';

/* ══════════ la carte de passage ══════════
   Sur iPhone, une app d'écran d'accueil n'intercepte jamais un lien : un QR
   de partie, de club ou de classe scanné ouvre Safari, dont le stockage est
   séparé de l'app — et Safari, sur un téléphone, n'ouvre plus que la porte
   d'installation (ui/pwa.js). On y montre le code en gros, prêt à copier,
   et où le coller dans l'app. Seulement dans un navigateur : dans l'app
   installée, le code est déjà suivi après la connexion. Sur Android, l'app
   installée partage le stockage du navigateur : le code lui est confié
   (confierPassage) et elle le reprend seule (reprendrePassage).
   Sur un ordinateur (2026-10-29), il n'y a rien à recopier : le code sera
   suivi dès la connexion, la carte le dit en une ligne, sans « Copier ». */
const ATTENTES = [
  ['folio.defi', I.bolt, pinLisible, 'Dans l’app : Entrer un code'],
  ['folio.club', I.users, codeClubLisible, 'Dans l’app : J’ai un code'],
  ['folio.rejoindre', I.school, formatCode, 'Dans l’app : Classe → Rejoindre']
];

const dansLApp = () => {
  try { return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; }
  catch (e) { return false; }     // matchMedia absent : un navigateur, on montre la carte
};

function attente() {
  for (const [cle, ic, lisible, ou] of ATTENTES) {
    const k = lire(cle);                           // src/lien-garde.js
    if (k) return { k, ic, code: lisible(k), ou };
  }
  return null;
}

const surOrdinateur = () => !mobile(plateforme({ ua: navigator.userAgent, touches: navigator.maxTouchPoints || 0 }));

export function cartePassage() {
  if (dansLApp()) return '';
  const a = attente(); if (!a) return '';
  if (surOrdinateur()) return `<div class="passage pc" id="passage">${svg(a.ic)}<b>${a.code}</b><i>Après la connexion</i></div>`;
  return `<div class="passage" id="passage">${svg(a.ic)}
    <b data-code="${a.k}">${a.code}</b>
    <button type="button" class="ghost" id="passcopie">${svg(I.copy)}Copier</button>
    <i>${a.ou}</i></div>`;
}

export function lierPassage() {
  const b = document.getElementById('passcopie'); if (!b) return;
  b.onclick = async () => {
    const k = document.querySelector('#passage [data-code]').dataset.code;
    try { await navigator.clipboard.writeText(k); toast(I.check, 'Code copié'); }
    catch (e) { toast(I.copy, k); }     // presse-papiers refusé : le code s'affiche, à recopier
  };
}

/* ---------- du navigateur à l'app installée (Android) ----------
   La porte d'installation confie les codes en attente au stockage que
   l'app installée partagera (localStorage : sessionStorage, lui, reste à
   l'onglet) ; l'app les reprend à son premier lancement. Une heure au
   plus : un code oublié ne doit pas ressurgir des jours après. Sur iPhone
   le stockage est à part : rien ne passe, la carte ci-dessus le montre. */
const PASSAGE = 'folio.passage';
const CONFIES = ['folio.rejoindre', 'folio.defi', 'folio.club', 'folio.plus'];

export function confierPassage() {
  try {
    const o = {};
    for (const k of CONFIES) { const v = k === 'folio.plus' ? sessionStorage.getItem(k) : lire(k) || null; if (v != null) o[k] = v; }
    if (Object.keys(o).length) localStorage.setItem(PASSAGE, JSON.stringify({ ...o, at: Date.now() }));
  } catch (e) { /* stockage indisponible : le code reste montré, à recopier */ }
}

export function reprendrePassage() {
  if (!dansLApp()) return;
  try {
    const o = JSON.parse(localStorage.getItem(PASSAGE) || 'null');
    localStorage.removeItem(PASSAGE);
    if (!o || !(Date.now() - o.at < 3600e3)) return;
    for (const k of CONFIES) {
      if (typeof o[k] !== 'string') continue;
      if (k === 'folio.plus') { if (sessionStorage.getItem(k) == null) sessionStorage.setItem(k, o[k]); }
      else if (!lire(k)) garder(k, o[k]);
    }
  } catch (e) { /* passage illisible : rien ne reprend, le code s'entre à la main */ }
}
