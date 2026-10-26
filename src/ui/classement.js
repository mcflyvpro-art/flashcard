// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { $ } from '../racine.js';
import { I, svg } from '../icones.js';
import {
  adm, blocks, compte, mods, myRole, reportOn, reportWhy, school, setAnimate, setMenu, setReportOn, setReportWhy, view
} from '../data/etat.js';
import { esc } from '../core/coeur-sync.js';
import { admPull } from '../core/classement.js';
import { go, render } from './bibliotheque.js';
import { toast } from './import-cartes.js';
import { joursDici } from './etablissement.js';
import { openMenu, mountMenu } from './menus-a.js';
import { cb, cf, timeAgo } from './reglages-corbeille.js';

/* ---------- classement ----------
   Les révisions de chacun restent privées : la fonction côté serveur ne
   rend qu'un décompte par compte, jamais le détail des cartes ni des
   erreurs. On compare un volume de travail, pas un contenu. */

/* Les motifs sont courts et nommés du point de vue de l'élève : « ça me
   harcèle » se trouve plus vite que « atteinte aux personnes ». */
const RAISONS = [
  ['harass', 'Harcèlement, menaces'],
  ['hate', 'Contenu haineux ou illégal'],
  ['sexual', 'Contenu sexuel'],
  ['private', 'Données personnelles de quelqu’un'],
  ['spam', 'Spam ou publicité'],
  ['copy', 'Copié sans autorisation'],
  ['other', 'Autre']
];

export function openReport(kind, id, user, label, snapshot) {
  setReportOn({ kind, id: String(id || ''), user: user || null, label: label || '', snapshot: snapshot || {} });
  setReportWhy('');
  openMenu('report');
}

export function reportSheet(w) {
  const r = reportOn;
  if (!r) { setMenu(null); return; }
  w.innerHTML = `<div class="scrim" data-mact="close"></div>
    <div class="menu">
      <div class="mhd">${svg(I.warn)}<span class="mhx"><b>Signaler</b>
        <span class="msub">${esc(r.label || 'Ce contenu')} — le contenu est joint au signalement,
          même s’il est effacé ensuite. Rien n’est envoyé à la personne visée.</span></span></div>
      <div class="rlist">${RAISONS.map(([k, t]) =>
        `<button class="mi${reportWhy === k ? ' on' : ''}" data-why="${k}">
          ${svg(reportWhy === k ? I.check : I.arrow)}${t}</button>`).join('')}</div>
      <input class="tok" id="rnote" placeholder="Précision (facultatif)" maxlength="500">
      <button class="mi" data-mact="rsend" ${reportWhy ? '' : 'disabled'}
        style="justify-content:center;font-weight:700">${svg(I.share)}Envoyer le signalement</button>
      ${r.user ? `<div class="msep"></div>
        <button class="mi warn" data-mact="rblock">${svg(I.lock)}<span>Bloquer aussi ce compte</span></button>` : ''}
    </div>`;
  mountMenu(w);
}

/* La liste des comptes coupés, pour pouvoir revenir en arrière : un
   blocage qu'on ne peut pas défaire est une punition, pas un réglage. */
export function blockedSheet(w) {
  const l = blocks || [];
  w.innerHTML = `<div class="scrim" data-mact="close"></div>
    <div class="menu">
      <div class="mhd">${svg(I.lock)}<span class="mhx"><b>Comptes bloqués</b>
        <span class="msub">Ils ne voient plus rien de toi, et toi non plus.</span></span></div>
      ${!l.length ? `<div class="note" style="padding:4px 18px 14px">Aucun compte bloqué.</div>`
        : `<div class="mscroll">${l.map(b => `<button class="mi" data-unblock="${esc(b.blocked_id)}">
             ${svg(I.redo)}<span>${esc(b.who || 'Un compte')}</span>
             <span class="tail">Débloquer</span></button>`).join('')}</div>`}
    </div>`;
  mountMenu(w);
}

const RNAME = Object.fromEntries(RAISONS);

const KNAME = { mail: 'Courrier', library: 'Étagère', duel: 'Défi', profile: 'Compte' };

/* La copie jointe s'affiche telle qu'elle a été prise : c'est la pièce du
   dossier, pas un aperçu à rafraîchir. */
function snapHtml(s) {
  if (!s || typeof s !== 'object') return '';
  const line = (k, v) => `<div class="sl"><i>${esc(k)}</i><span>${esc(v)}</span></div>`;
  let out = '';
  for (const [k, v] of Object.entries(s)) {
    if (k === 'cartes') continue;
    if (v) out += line(k, String(v).slice(0, 300));
  }
  const c = s.cartes;
  if (Array.isArray(c) && c.length) {
    out += `<div class="scards">${c.slice(0, 12).map(x => `<div class="pr">
      <span class="a">${esc(cf(x))}</span>${svg(I.arrow)}<span class="b">${esc(cb(x))}</span></div>`).join('')}
      ${c.length > 12 ? `<div class="note">…et ${c.length - 12} autres</div>` : ''}</div>`;
  }
  return out;
}

export function modView() {
  const l = mods.list;
  $.innerHTML = `
    <div class="bar"><button class="ic" data-act="settings" aria-label="Retour">${svg(I.back)}</button>
      <h1>Signalements</h1></div>
    <div class="page">
      ${!l ? `<div class="empty">${svg(I.warn)}<p>${mods.err ? 'Liste indisponible' : 'Chargement…'}</p></div>`
      : !l.length ? `<div class="empty">${svg(I.check)}<p><b>Rien à traiter</b>Tous les signalements sont classés.</p></div>`
      : `<div class="note" style="padding:0 0 14px">Un contenu signalé par deux comptes différents est déjà
           masqué automatiquement. Ce qui suit attend une décision.</div>
         ${l.map(r => `<div class="rep">
           <div class="rh"><b>${esc(KNAME[r.kind] || r.kind)}</b>
             <i>${esc(RNAME[r.reason] || r.reason)}</i>
             <span>${timeAgo(r.created_at)}</span></div>
           ${r.note ? `<div class="rn">${svg(I.quote)}<p>${esc(r.note)}</p></div>` : ''}
           <div class="rs">${snapHtml(r.snapshot)}</div>
           <div class="rb">
             <button data-modact="clear" data-rid="${r.id}">${svg(I.check)}Rien à signaler</button>
             <button class="warn" data-modact="hide" data-rid="${r.id}">${svg(I.eyeoff)}Masquer</button>
           </div>
         </div>`).join('')}`}
    </div>`;
}

/* ---------- la porte de la console de l'éditeur ----------
   La console (2026-10-26) est un morceau chargé à la demande —
   ui/admin-console.js, sa feuille admin-console.css (préfixe ed-) et
   core/admin.js : personne d'autre ne la télécharge. Rien d'autre ne doit
   importer ui/admin-console.js — passer par ici. */
let consoleAdm = null, chargeAdm = null;

function chargerAdmin() {
  if (consoleAdm) return Promise.resolve(consoleAdm);
  if (!chargeAdm) {
    chargeAdm = import('./admin-console.js').then(m => (consoleAdm = m))
      .catch(e => { chargeAdm = null; throw e; });
  }
  return chargeAdm;
}

export function admAller(sous, id) {
  if (consoleAdm && adm.charge && view.name === 'admin') return consoleAdm.allerA(sous, id);
  admPull();
  chargerAdmin().then(m => m.allerA(sous, id)).catch(() => { /* hors ligne : adminView le dira */ });
  go('admin');
}

export function adminView() {
  if (consoleAdm) return consoleAdm.consoleAdmin();
  $.innerHTML = `<div class="page"><div class="top"><div class="hero">Administration</div></div>
    <div class="empty">${svg(I.key)}</div></div>`;
  chargerAdmin().then(() => { if (view.name === 'admin') { setAnimate(false); render(); } })
    .catch(() => toast(I.x, 'La console n’a pas pu s’ouvrir : vérifie ta connexion'));
}

export const atSchool = () => !!(school && school.org_id);

/* Un élève « de classe » : inscrit par son établissement, ou ouvert par un
   professeur avec une carte. Ni l'un ni l'autre n'a de pseudo à choisir ni
   de nom à changer, et son accueil est « Mes classes ». */
export const isPupil = () => (atSchool() || !!(compte && compte.gere)) && myRole === 'eleve';

export const isProf = () => myRole === 'prof' || myRole === 'admin';

export const isAdmin = () => myRole === 'admin';

export const dueLabel = s => {
  if (!s) return '';
  const j = joursDici(s);
  return j < 0 ? (j === -1 ? 'hier' : `il y a ${-j} jours`)
       : j === 0 ? 'aujourd’hui' : j === 1 ? 'demain' : `dans ${j} jours`;
};
