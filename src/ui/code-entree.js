// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { I, svg } from '../icones.js';
import { eleve, menu, online } from '../data/etat.js';
import { esc } from '../core/coeur-sync.js';
import { codeApercu, eleveClassesPull, messageErreur, rejoindreAvecCode } from '../core/eleve-classes.js';
import { cerclePull, refPull } from '../core/classement.js';
import { codeComplet, codeDepuisTexte, formatCode, nomPropre, nomValide, normCode } from '../classe.js';
import { bienvenue, messageEtab, ROLES_CODE } from '../etablissement.js';
import { go } from './bibliotheque.js';
import { isProf } from './classement.js';
import { toast } from './import-cartes.js';
import { closeMenu, mountMenu, openMenu } from './menus-a.js';
import { allerAccueil, rejoindreCollegue } from './prof-porte.js';
import { versClasse } from './eleve-classes.js';

/* ══════════ « J'ai un code » ══════════
   La seule porte d'entrée dans une école (docs/PARCOURS.md) : le code d'un
   établissement — élève, professeur ou référent — ou celui d'un professeur
   particulier. Deux temps : le code (la base dit ce que c'est), puis le
   prénom, le nom et la classe à choisir — et on est dedans. Ouverte depuis
   les Réglages, l'accueil d'un nouveau compte, « Ma classe » et les liens
   « ?rejoindre= ». Un ancien code de classe continue dans « Ma classe »,
   où vit déjà son parcours. */

const E = () => eleve.entree;

export function ouvrirCode(code) {
  Object.assign(E(), { code: formatCode(code || ''), fiche: null, reponse: null, envoi: false, classe: '' });
  openMenu('code');
  if (codeComplet(normCode(code || ''))) lire();
}

const peindre = () => { if (menu === 'code') openMenu('code'); };
const coque = corps => `<div class="scrim" data-mact="close"></div><div class="menu ce-f">${corps}</div>`;
const message = r => (r ? messageEtab(r) : null);

function feuilleCode(e) {
  const m = message(e.reponse);
  return coque(`<div class="mhd">${svg(I.key)}<span class="mhx"><b>J’ai un code</b></span></div>
    <form class="ce-form" id="ceform" autocomplete="off">
      <input class="ce-code" id="cecode" data-cein="code" value="${esc(e.code)}" placeholder="XXXX-XXXX"
        autocapitalize="characters" autocorrect="off" spellcheck="false" maxlength="40" enterkeyhint="go" aria-label="Code">
      <p class="ce-rep${m ? ' ' + m.ton : ''}" id="cerep">${m ? `<b>${esc(m.titre)}</b>${m.texte ? `<span>${esc(m.texte)}</span>` : ''}` : ''}</p>
      <button class="cta" data-ce="lire" id="ceok" ${codeComplet(normCode(e.code)) && !e.envoi ? '' : 'disabled'}>Continuer</button>
    </form>`);
}

/* Le nom figé à l'entrée : on le montre tel qu'il apparaîtra. */
const apparaitra = e => (nomValide(e.prenom) && nomValide(e.nom)
  ? `Tu apparaîtras comme <b>${esc(nomPropre(e.prenom, e.nom))}</b>` : '');

function choixClasse(f, e) {
  if (!f.classes || !f.classes.length) return '';
  return `<div class="ce-lbl">${f.type === 'prof' ? 'Ton cours' : 'Ta classe'}</div>
    <div class="ce-classes" role="radiogroup">${f.classes.map(c => `<button type="button" role="radio"
      class="ce-cl${e.classe === c.id ? ' on' : ''}" data-ce="classe" data-id="${esc(c.id)}" aria-checked="${e.classe === c.id}">
      ${esc(c.nom)}</button>`).join('')}</div>`;
}

function feuilleNom(e, f) {
  const role = f.type === 'prof' ? 'Cours particulier' : ROLES_CODE[f.quel] || '';
  const pret = nomValide(e.prenom) && nomValide(e.nom) && (!(f.classes || []).length || e.classe);
  const m = message(e.reponse);
  return coque(`<div class="mhd"><i class="jt groupe vide">${svg(f.type === 'prof' ? I.user : I.school)}</i>
      <span class="mhx"><b>${esc(f.nom)}</b><i>${esc([role, f.ville].filter(Boolean).join(' · '))}</i></span></div>
    <div class="ce-form">
      <div class="ce-noms">
        <input id="cepre" data-cein="prenom" value="${esc(e.prenom)}" placeholder="Prénom" autocomplete="given-name" maxlength="40" aria-label="Prénom">
        <input data-cein="nom" value="${esc(e.nom)}" placeholder="Nom" autocomplete="family-name" maxlength="40" aria-label="Nom">
      </div>
      <p class="ce-note" id="cenom">${apparaitra(e)}</p>
      ${choixClasse(f, e)}
      ${m ? `<p class="ce-rep ${m.ton}"><b>${esc(m.titre)}</b>${m.texte ? `<span>${esc(m.texte)}</span>` : ''}</p>` : ''}
      <div class="ce-b"><button class="el-btn" data-ce="retour">Retour</button>
        <button class="el-btn pri" data-ce="entrer" id="cego" ${pret && !e.envoi ? '' : 'disabled'}>Entrer</button></div>
    </div>`);
}

export function paintMenuCode(w) {
  const e = E();
  w.innerHTML = e.fiche ? feuilleNom(e, e.fiche) : feuilleCode(e);
  mountMenu(w);
  const champ = document.getElementById(e.fiche ? 'cepre' : 'cecode'), a = document.activeElement;
  if (champ && !champ.value && !(a && a.tagName === 'INPUT')) setTimeout(() => champ.focus(), 80);
}

/* ---------- les gestes ---------- */
async function lire() {
  const e = E(), k = normCode(e.code);
  if (!codeComplet(k) || e.envoi) return;
  if (!online) return toast(I.cloud, 'Hors ligne : un code demande le réseau');
  e.envoi = true; e.reponse = null; peindre();
  try {
    const r = await codeApercu(k) || {};
    e.envoi = false;
    if (r.type === 'classe') {
      // un ancien code de classe, ou le code d'équipe d'un collègue
      closeMenu();
      return isProf() ? rejoindreCollegue(k) : versClasse(k, r.fiche);
    }
    if (r.statut === 'ok') { e.fiche = r; e.classe = ''; }
    else if (r.statut === 'deja') { closeMenu(); toast(I.check, messageEtab('deja').titre); return go('classes'); }
    else e.reponse = r.statut;
  } catch (x) { e.envoi = false; e.reponse = 'erreur'; toast(I.x, messageErreur(x).slice(0, 120) || 'Impossible pour l’instant'); }
  peindre();
}

/* Entré : on relit le rôle et l'établissement, puis on va là où l'on est
   attendu — sa classe, son espace professeur, sa console de référent. */
async function arriver(r) {
  toast(I.check, bienvenue(r));
  Object.assign(E(), { code: '', fiche: null, reponse: null, classe: '' });
  closeMenu();
  await cerclePull();
  eleveClassesPull();
  if (r.quel === 'ref') { refPull(); return go('ref'); }
  if (r.quel === 'prof') return allerAccueil();
  return go('classes');
}

async function entrer() {
  const e = E();
  if (e.envoi) return;
  e.envoi = true; e.reponse = null; peindre();
  try {
    const r = await rejoindreAvecCode(normCode(e.code), e.prenom, e.nom, e.classe) || {};
    e.envoi = false;
    if (r.statut === 'ok') return arriver(r);
    if (!['nom', 'choisir', 'classe'].includes(r.statut)) e.fiche = null;   // le code ne vaut plus : on revient au code
    e.reponse = r.statut;
  } catch (x) { e.envoi = false; toast(I.x, messageErreur(x).slice(0, 120) || 'Impossible pour l’instant'); }
  peindre();
}

const ACTIONS = {
  ouvrir: () => ouvrirCode(),
  lire,
  entrer,
  retour: () => { Object.assign(E(), { fiche: null, reponse: null }); peindre(); },
  classe: id => { E().classe = id; E().reponse = null; peindre(); }
};

document.addEventListener('click', e => {
  const b = e.target.closest('[data-ce]');
  if (!b || b.disabled) return;
  const f = ACTIONS[b.dataset.ce];
  if (!f) return;
  e.preventDefault();
  f(b.dataset.id, b);
});

document.addEventListener('submit', e => {
  if (e.target.id !== 'ceform') return;
  e.preventDefault();
  lire();
});

/* Les champs ne repeignent jamais la feuille où l'on tape : ils mettent à
   jour sur place ce qui dépend d'eux (le bouton, le nom tel qu'il
   apparaîtra). */
document.addEventListener('input', e => {
  const n = e.target.closest('[data-cein]'); if (!n) return;
  const k = n.dataset.cein, s = E();
  if (k === 'code') {
    const v = /rejoindre=/.test(n.value) ? codeDepuisTexte(n.value) : n.value;   // un lien collé se réduit à son code
    s.code = formatCode(v);
    if (n.value !== s.code) { n.value = s.code; n.setSelectionRange(n.value.length, n.value.length); }
    s.reponse = null;
    const b = document.getElementById('ceok'); if (b) b.disabled = !codeComplet(normCode(s.code));
    const p = document.getElementById('cerep'); if (p) { p.className = 'ce-rep'; p.innerHTML = ''; }
    return;
  }
  s[k] = n.value;
  const f = s.fiche || {};
  const b = document.getElementById('cego');
  if (b) b.disabled = !(nomValide(s.prenom) && nomValide(s.nom) && (!(f.classes || []).length || s.classe));
  const p = document.getElementById('cenom'); if (p) p.innerHTML = apparaitra(s);
});
