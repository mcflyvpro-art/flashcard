// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { I, svg } from '../icones.js';
import { pinLisible } from '../defi.js';
import { codeClubLisible } from '../club.js';
import { formatCode } from '../classe.js';
import { toast } from './import-cartes.js';

/* ══════════ la carte de passage (iOS, en attendant Capacitor) ══════════
   Sur iPhone, une app d'écran d'accueil n'intercepte jamais un lien : un QR
   de partie, de club ou de classe scanné ouvre Safari, dont le stockage est
   séparé de l'app — pas de session, l'écran de connexion. Plutôt que de
   faire recréer une session dans Safari, on montre le code en gros, prêt à
   copier, et où le coller dans l'app. Seulement dans un navigateur : dans
   l'app installée, le code est déjà suivi après la connexion. */
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
    let k = '';
    try { k = sessionStorage.getItem(cle) || ''; } catch (e) { /* stockage indisponible : rien n'attend */ }
    if (k) return { k, ic, code: lisible(k), ou };
  }
  return null;
}

export function cartePassage() {
  if (dansLApp()) return '';
  const a = attente(); if (!a) return '';
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
