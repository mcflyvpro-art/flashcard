// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { I, svg } from '../icones.js';
import { SITE } from '../adresse.js';
import { prof, setMenu } from '../data/etat.js';
import { formatCode, lienRejoindre } from '../classe.js';
import { qrSvg } from '../qr.js';
import { esc, plur } from '../core/coeur-sync.js';
import {
  classePull, classesEtabPull, codePull, ecrire, elevesEtabPull, mesElevesPull, profPull, relire
} from '../core/espace-prof.js';
import { atSchool } from './classement.js';
import { toast } from './import-cartes.js';
import { closeMenu, paintMenu } from './menus-a.js';
import { btn, chargement, classeOuverte, pastilleClasse } from './prof-accueil.js';
import { champ, feuille, focus } from './prof-feuilles.js';

/* ══════════ l'espace professeur, au modèle « un seul code » (2026-10-26) ══════════
   docs/PARCOURS.md : un élève entre avec UN code, puis choisit sa classe.
   - Dans un établissement, les classes viennent du référent : le professeur
     choisit les siennes (prof_enseigner) et forme des groupes en
     sélectionnant des élèves (prof_groupe) ; il peut projeter le code élèves
     de l'établissement (prof_code_etab).
   - Professeur particulier : un seul code, le sien (prof_mon_code) ; ses
     élèves choisissent leur cours, et il range un élève dans une autre de
     ses classes (prof_ajouter_eleve). */

export const etab = () => atSchool();

/* ---------- le code à donner ---------- */
const lienCode = () => lienRejoindre(SITE, prof.code || '');

export function codeBande() {
  const titre = etab() ? 'Code élèves de l’établissement' : 'Mon code';
  const aide = etab() ? 'Vos élèves le tapent dans Réglages → J’ai un code, puis choisissent leur classe.'
    : 'Vos élèves le tapent dans Réglages → J’ai un code, puis choisissent leur cours.';
  if (prof.code === null) codePull();
  return `<section class="pf-codeband" title="${aide}">
      <span class="pf-cb-l">${svg(I.key)}${titre}</span>
      ${prof.code ? `<b class="pf-cb-c">${esc(formatCode(prof.code))}</b>
        <span class="pf-cb-a">${btn('code-copier', I.copy, 'Copier', 'sm')}${btn('tableau', I.grid, 'Projeter', 'sm')}${
          etab() ? '' : btn('code-changer', I.refresh, 'Changer', 'sm')}</span>`
      : prof.code === null ? chargement() : `<span class="pf-note">${esc(prof.codeErr || 'Pas encore de code')}</span>`}
    </section>`;
}

/* La feuille « Ajouter des élèves » : le code et son QR, ce que l'élève fait,
   et — à part, discret — les cartes pour qui n'a pas d'adresse e-mail. */
export function inviterCode(c) {
  if (prof.code === null) { codePull(); return chargement(); }
  if (!prof.code) return `<p class="pf-note">${esc(prof.codeErr || 'Pas encore de code')}</p>`;
  return `<div class="pf-inv">
      <div class="pf-inv-qr">${qrSvg(lienCode(), 'QR pour rejoindre')}</div>
      <div class="pf-inv-t"><span>${etab() ? 'Code élèves' : 'Mon code'}</span><b class="pf-gros">${esc(formatCode(prof.code))}</b>
        <div class="pf-lien"><input readonly value="${esc(lienCode())}" aria-label="Lien">${btn('code-lien', I.copy, '', 'ic sm', 'aria-label="Copier le lien"')}</div>
      </div></div>
    <ol class="pf-etapes">
      <li><b>1</b><span>Mirandola → Réglages → J’ai un code</span></li>
      <li><b>2</b><span>Choisir « ${esc(c.name)} »</span></li>
    </ol>
    ${c.gere ? `<button class="pf-lnk seul" data-pf="f-mode" data-v="liste">${svg(I.card)}Des élèves sans adresse e-mail ?</button>` : ''}`;
}

/* Le mode tableau : le code en très grand, le QR, et qui vient d'arriver. */
export function tableauCode(w) {
  const c = classeOuverte(), r = c ? (prof.roster || []) : [];
  if (prof.code === null) codePull();
  feuille(w, 'pf-tableau', '', '', `<div class="pf-tb">
      <div class="pf-tb-g">${c ? pastilleClasse(c, true) : ''}<h1>${esc(c ? c.name : 'Rejoindre Mirandola')}</h1>
        <ol><li>Ouvrez <b>Mirandola</b> → Réglages → <b>J’ai un code</b></li><li>Visez le QR code, ou tapez le code</li>
          ${c ? `<li>Choisissez <b>${esc(c.name)}</b></li>` : ''}</ol>
        <b class="pf-tb-code">${prof.code ? esc(formatCode(prof.code)) : '— — —'}</b>
        <p>${esc(SITE.replace(/^https?:\/\//, '').replace(/\/$/, ''))}</p></div>
      <div class="pf-tb-qr">${prof.code ? qrSvg(lienCode(), 'QR pour rejoindre') : ''}</div>
    </div>
    ${c ? `<div class="pf-tb-att"><span><b>${r.length}</b> ${r.length > 1 ? 'élèves' : 'élève'}</span>
      <div class="pf-noms">${[...r].sort((a, b) => String(b.inscrit || '').localeCompare(String(a.inscrit || ''))).slice(0, 24)
        .map(m => `<span>${esc(m.who)}</span>`).join('')}</div></div>` : ''}`, '');
}

/* ---------- choisir ses classes (établissement) ---------- */
function listeClasses() {
  const l = prof.etabClasses;
  if (!l) return chargement();
  if (!l.length) return '<p class="pf-note">Le référent n’a pas encore créé de classe.</p>';
  return l.map(c => `<div class="pf-li">${pastilleClasse({ id: c.id })}
    <span class="pf-lit"><b>${esc(c.nom)}</b><i>${esc([c.niveau, plur(c.effectif, 'élève'), c.enseigne && c.matiere].filter(Boolean).join(' · '))}</i></span>
    ${c.enseigne ? btn('enseigner', I.check, 'J’y enseigne', 'sm on', `data-id="${esc(c.id)}" data-v="0"`)
      : btn('enseigner', I.plus, 'Ajouter', 'sm', `data-id="${esc(c.id)}" data-v="1"`)}</div>`).join('');
}

function choisir(w) {
  const corps = `${champ('Votre matière', 'matiere', 'id="pfmat" maxlength="60" placeholder="Mathématiques" autocomplete="off"')}
    <div class="pf-list" id="pfcl">${listeClasses()}</div>`;
  feuille(w, 'large', '<b>Mes classes</b>', '', corps, btn('fermer', '', 'Terminé', 'pri lg'));
}

/* ---------- former un groupe (établissement) ---------- */
function ligneEleve(e) {
  const on = prof.f.sel.has(e.id);
  return `<button class="pf-gl${on ? ' on' : ''}" data-pf="gsel" data-id="${esc(e.id)}" role="checkbox" aria-checked="${on}">
    <i class="pf-gl-c">${on ? svg(I.check) : ''}</i><b>${esc(e.nom)}</b><span>${esc(e.classe || 'sans classe')}</span></button>`;
}

export function listeGroupe() {
  const l = prof.etabEleves;
  if (!l) return chargement();
  if (!l.length) return '<p class="pf-note">Personne</p>';
  return l.map(ligneEleve).join('');
}

function groupe(w) {
  const f = prof.f, n = f.sel.size, cl = prof.etabClasses || [];
  const corps = `<div class="pf-form">
      ${champ('Nom du groupe', 'nom', 'id="pfgnom" maxlength="60" placeholder="Spé maths, Latin, Atelier…" autocomplete="off"')}
      ${f.gid ? '' : champ('Matière', 'matiere', 'maxlength="60" placeholder="Mathématiques" autocomplete="off"')}
    </div>
    <div class="pf-gf">
      <input data-pfin="f.gq" value="${esc(f.gq || '')}" type="search" placeholder="Chercher un élève" autocomplete="off" aria-label="Chercher un élève">
      <select data-pfch="gcls" aria-label="Classe"><option value="">Toutes les classes</option>${cl.map(c =>
        `<option value="${esc(c.id)}"${f.gcls === c.id ? ' selected' : ''}>${esc(c.nom)}</option>`).join('')}</select>
    </div>
    <div class="pf-gls" id="pfgl">${listeGroupe()}</div>`;
  feuille(w, 'large', `<b>${f.gid ? 'Élèves du groupe' : 'Nouveau groupe'}</b>`, '', corps,
    btn('groupe-go', I.check, f.gid ? `Enregistrer (${n})` : `Créer le groupe${n ? ` (${n})` : ''}`, 'pri lg',
      `id="pfgo" ${(f.nom || '').trim() ? '' : 'disabled'}`));
  if (!f.gid) focus('pfgnom');
}

/* L'espace ne repeint jamais une feuille sous les doigts de qui tape
   (core/espace-prof.js, repeindre) : la liste arrivée se pose donc sur
   place, sans toucher aux champs. */
const surPlace = (id, html) => { const n = document.getElementById(id); if (n) n.innerHTML = html(); };
const chargerEleves = (q, cid) => elevesEtabPull(q, cid).then(() => surPlace('pfgl', listeGroupe));
const chargerClasses = () => classesEtabPull().then(() => surPlace('pfcl', listeClasses));

let attente = 0;
export function chercherEleves() {
  clearTimeout(attente);
  attente = setTimeout(() => chargerEleves(prof.f.gq, prof.f.gcls), 220);
}

/* Le bouton suit le nom tapé et le nombre d'élèves cochés, sans repeindre. */
export function majBoutonGroupe() {
  const b = document.getElementById('pfgo'); if (!b) return;
  const n = prof.f.sel.size;
  b.disabled = !(prof.f.nom || '').trim();
  b.querySelector('span').textContent = prof.f.gid ? `Enregistrer (${n})` : `Créer le groupe${n ? ` (${n})` : ''}`;
}

/* ---------- ranger un élève dans cette classe (professeur particulier) ---------- */
function ajouter(w) {
  const c = classeOuverte(); if (!c) return setMenu(null);
  const ici = new Set((prof.roster || []).map(m => m.user_id));
  const l = prof.mesEleves && prof.mesEleves.filter(e => !ici.has(e.id));
  feuille(w, '', '<b>Un élève de mes autres classes</b>', esc(c.name), !l ? chargement()
    : !l.length ? '<p class="pf-note">Tous vos élèves sont déjà dans cette classe.</p>'
    : `<div class="pf-list">${l.map(e => `<div class="pf-li"><span class="pf-lit"><b>${esc(e.nom)}</b><i>${esc(e.classe)}</i></span>
        ${btn('ajouter-go', I.plus, 'Ajouter', 'sm', `data-id="${esc(e.id)}"`)}</div>`).join('')}</div>`, '');
}

export const FEUILLES_ETAB = { choisir, groupe, ajouter };

/* ---------- les gestes ---------- */
async function copier(t, quoi) {
  try { await navigator.clipboard.writeText(t); toast(I.check, quoi + ' copié'); }
  catch (e) { toast(I.x, 'Copie impossible : sélectionnez-le à la main'); }
}

export function actionsEtab({ ouvrir, ouvrirClasse, arme, allerAccueil }) {
  return {
    'code-copier': () => copier(formatCode(prof.code || ''), 'Code'),
    'code-lien': () => copier(lienCode(), 'Lien'),
    'code-changer': (id, v, b) => { if (arme(b, 'L’ancien cessera de marcher')) codePull(true); },
    choisir: () => { if (!prof.etabClasses) chargerClasses(); ouvrir('choisir', { matiere: '' }); },
    enseigner: async (id, v) => {
      const oui = v === '1';
      if (oui && !(prof.f.matiere || '').trim()) { toast(I.x, 'Indiquez votre matière'); return document.getElementById('pfmat')?.focus(); }
      if (await ecrire('prof_enseigner', { cid: id, oui, matiere: prof.f.matiere || '' }, oui ? 'Classe ajoutée' : 'Classe retirée')) {
        const c = (prof.etabClasses || []).find(x => x.id === id);
        if (c) Object.assign(c, { enseigne: oui, matiere: oui ? prof.f.matiere : '' });
        surPlace('pfcl', listeClasses); profPull();
      }
    },
    groupe: () => {
      if (!prof.etabClasses) classesEtabPull();
      prof.etabEleves = null; chargerEleves('', null);
      ouvrir('groupe', { nom: '', matiere: '', gq: '', gcls: '', sel: new Set() });
    },
    'groupe-modifier': () => {
      const c = classeOuverte(); if (!c) return;
      if (!prof.etabClasses) classesEtabPull();
      prof.etabEleves = null; chargerEleves('', null);
      ouvrir('groupe', { gid: c.id, nom: c.name, gq: '', gcls: '', sel: new Set((prof.roster || []).map(m => m.user_id)) });
    },
    gsel: id => {
      const s = prof.f.sel; s.has(id) ? s.delete(id) : s.add(id);
      const n = document.querySelector(`.pf-gl[data-id="${CSS.escape(id)}"]`), e = (prof.etabEleves || []).find(x => x.id === id);
      if (n && e) n.outerHTML = ligneEleve(e);
      majBoutonGroupe();
    },
    'groupe-go': async () => {
      const f = prof.f;
      const r = await ecrire('prof_groupe', { nom: (f.nom || '').trim(), eleves: [...f.sel], gid: f.gid || null, matiere: f.matiere || '' },
        f.gid ? 'Groupe enregistré' : 'Groupe créé');
      if (!r) return;
      closeMenu();
      if (f.gid) return relire();
      prof.annees = null; await profPull(); ouvrirClasse(r);
    },
    'ne-plus-enseigner': async (id, v, b) => {
      if (!arme(b, 'Retirer cette classe ?')) return;
      if (await ecrire('prof_enseigner', { cid: prof.open, oui: false }, 'Classe retirée de votre espace')) {
        prof.open = null; prof.etabClasses = null; prof.classes = null; allerAccueil();
      }
    },
    ajouter: () => { prof.mesEleves = null; mesElevesPull(prof.open); ouvrir('ajouter'); },
    'ajouter-go': async id => {
      if (await ecrire('prof_ajouter_eleve', { cid: prof.open, qui: id }, 'Élève ajouté')) { await classePull(prof.open); paintMenu(); relire(); }
    }
  };
}
