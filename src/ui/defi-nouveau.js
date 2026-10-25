// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { $ } from '../racine.js';
import { I, svg } from '../icones.js';
import { cercle, db, defi, defiNeuf, prof, setDefi, view } from '../data/etat.js';
import { go, render } from './bibliotheque.js';
import { isProf, isPupil } from './classement.js';
import { esc, subj } from '../core/coeur-sync.js';
import { ouvrirSalle } from '../core/cercle.js';
import { duelMake, DUELQ } from '../core/defis.js';
import { rangerClasses } from '../classe.js';
import { DUREES, JEUX, NOMBRES, fabriquerQuestions, jouable, pagesJouables } from '../defi.js';
import { infos } from './cercle.js';
import { blason, blasonClub } from './jeton.js';
import { hlp } from './connexion.js';
import { plain } from './carte-media.js';
import { ouvrirDirect } from './direct-porte.js';
import { toast } from './import-cartes.js';

/* ══════════ lancer un défi ══════════
   Un seul écran, quatre questions dans l'ordre où on se les pose : avec
   qui, sur quel livre, à quel jeu, comment. Ce qui ne va pas avec le choix
   fait plus haut se grise au lieu de disparaître : on voit pourquoi.
   - Mes amis : à son rythme seulement (ils ne sont pas là en même temps).
   - Un club : en direct ou à son rythme.
   - Une classe (professeur) : en direct ou à son rythme.
   - Une salle ouverte : en direct seulement, avec un code à donner.
   « À son rythme » est un QCM de 10 questions (les défis d'avant) ; le
   direct se règle : jeu, nombre de questions, temps par question. */

export function ouvrirDefi(o = {}) {
  setDefi({ ...defiNeuf(), ...o });
  if (!defi.ou) defi.ou = choixDefaut();
  ajusterMode();
  go('defi');
}

function choixOu() {
  const l = [];
  const ic = i => `<i class="jt groupe vide">${svg(I[i])}</i>`;
  if (isProf()) for (const c of rangerClasses(prof.classes || []).actives) l.push({ k: 'classe:' + c.id, nom: c.name, jt: blason(c.id) });
  if (!isPupil()) for (const g of cercle.clubs || []) l.push({ k: 'club:' + g.id, nom: g.nom, jt: blasonClub(g), club: g });
  l.push({ k: 'amis', nom: isPupil() ? 'Camarades' : 'Amis', jt: ic('users') });
  if (!isPupil()) l.push({ k: 'ouverte', nom: 'Salle ouverte', jt: ic('hash') });
  return l;
}

const choixDefaut = () => { const l = choixOu(); return (l[0] || { k: 'amis' }).k; };

// ce que chaque destination permet
const modesPossibles = ou => ou === 'amis' ? ['rythme'] : ou === 'ouverte' ? ['direct'] : ['direct', 'rythme'];

function ajusterMode() {
  const m = modesPossibles(defi.ou);
  if (!m.includes(defi.mode)) defi.mode = m[0];
  if (defi.mode === 'rythme') defi.jeu = 'qcm';
}

const cartesDe = d => pagesJouables(d.cards.filter(c => !c.x).map(c => ({ f: plain(c.f), b: plain(c.b) })));

function livrePossible(d) {
  if (defi.mode === 'rythme') return new Set(cartesDe(d).map(c => c.b.toLowerCase())).size >= 4;
  return jouable(cartesDe(d), defi.jeu);
}

function ouHtml() {
  return `<section class="dn-step"><h2><i>1</i>Avec qui ?</h2><div class="dn-ou">${choixOu().map(o => `
    <button class="dn-choix ${defi.ou === o.k ? 'on' : ''}" data-cc="dn-ou" data-id="${esc(o.k)}">
      ${o.jt}<b>${esc(o.nom)}</b></button>`).join('')}</div></section>`;
}

function livresHtml() {
  const tous = db.decks.filter(d => !d.hidden && d.cards.length);
  const q = defi.q.trim().toLowerCase();
  const l = q ? tous.filter(d => d.name.toLowerCase().includes(q)) : tous;
  return `<section class="dn-step"><h2><i>2</i>Quel livre ?</h2>
    ${tous.length > 6 ? `<div class="dn-cherche">${svg(I.search)}<input id="dnq" type="search" placeholder="Chercher un livre"
      value="${esc(defi.q)}" autocomplete="off" spellcheck="false" aria-label="Chercher un livre"></div>` : ''}
    ${!tous.length ? `<p class="cc-vide">${svg(I.book)}Aucun livre</p>`
      : `<div class="dn-livres" id="dnl">${l.map(d => {
        const ok = livrePossible(d);
        return `<button class="dn-livre ${defi.livre === d.id ? 'on' : ''}" data-cc="dn-livre" data-id="${esc(d.id)}" ${ok ? '' : 'disabled'}>
          <i class="dn-dot" style="--d:${subj(d.subject).d}"></i>
          <span><b>${esc(d.name)}</b>${ok ? infos([['card', d.cards.length, 'Pages']]) : '<i>Trop court</i>'}</span>
          ${defi.livre === d.id ? svg(I.check) : ''}</button>`;
      }).join('') || `<p class="cc-vide">Aucun livre ne s’appelle ainsi.</p>`}</div>`}
  </section>`;
}

function commentHtml() {
  const m = modesPossibles(defi.ou), direct = defi.mode === 'direct';
  const seg = (k, l, cur, ic, t) => `<div class="dn-reglage" title="${t}">${svg(I[ic])}<div class="dn-seg">${l.map(v =>
    `<button class="${cur === v ? 'on' : ''}" data-cc="dn-${k}" data-id="${v}" aria-label="${v} ${k === 'duree' ? 'secondes' : 'questions'}">${
      k === 'duree' ? v + ' s' : v}</button>`).join('')}</div></div>`;
  return `<section class="dn-step"><h2><i>3</i>Comment ? ${hlp('modes')}</h2>
    <div class="dn-modes">
      <button class="dn-mode ${direct ? 'on' : ''}" data-cc="dn-mode" data-id="direct" ${m.includes('direct') ? '' : 'disabled'}>
        ${svg(I.bolt)}<b>En direct</b></button>
      <button class="dn-mode ${direct ? '' : 'on'}" data-cc="dn-mode" data-id="rythme" ${m.includes('rythme') ? '' : 'disabled'}>
        ${svg(I.clock)}<b>À son rythme</b></button>
    </div>
    ${direct ? `<div class="dn-jeux">${Object.entries(JEUX).map(([k, j]) => `
        <button class="dn-jeu ${defi.jeu === k ? 'on' : ''}" data-cc="dn-jeu" data-id="${k}">${svg(I[ICONE_JEU[k]])}<b>${j.nom}</b></button>`).join('')}</div>
      <div class="dn-reglages">${seg('n', NOMBRES, defi.n, 'card', 'Questions')}${seg('duree', DUREES, defi.duree, 'clock', 'Temps par question')}</div>`
      : `<p class="dn-rythme">${svg(I.card)}${DUELQ} · QCM</p>`}
  </section>`;
}

const ICONE_JEU = { qcm: 'grid', vf: 'check', ecrit: 'type' };

export function defiView() {
  ajusterMode();
  const d = db.decks.find(x => x.id === defi.livre);
  if (d && !livrePossible(d)) defi.livre = null;
  const pret = !!defi.livre && !defi.envoi;
  $.innerHTML = `
    <div class="bar"><button class="ic" data-cc="dn-retour" aria-label="Retour">${svg(I.back)}</button><h1>Nouveau défi</h1></div>
    <div class="dn">
      <div class="dn-main">${ouHtml()}${livresHtml()}</div>
      <aside class="dn-cote">${commentHtml()}
        <button class="cta dn-go" data-cc="dn-go" ${pret ? '' : 'disabled'}>${svg(defi.mode === 'direct' ? I.bolt : I.flame)}${
          defi.mode === 'direct' ? 'Ouvrir la salle' : 'Lancer le défi'}</button>
      </aside>
    </div>`;
  const q = document.getElementById('dnq');
  if (q) q.addEventListener('input', () => {
    defi.q = q.value;
    const l = document.getElementById('dnl');
    if (l) { const t = document.createElement('div'); t.innerHTML = livresHtml(); l.replaceWith(t.querySelector('#dnl') || l); }
  });
}

/* ---------- les gestes ---------- */
const repeint = () => { if (view.name === 'defi') render(); };

export const ACTIONS_DEFI = {
  'dn-retour': () => { const r = defi.retour; return r ? go(r.name, r.id) : go('commu'); },
  'dn-ou': k => { defi.ou = k; ajusterMode(); repeint(); },
  'dn-livre': id => { defi.livre = id; repeint(); },
  'dn-mode': m => { defi.mode = m; ajusterMode(); repeint(); },
  'dn-jeu': j => { defi.jeu = j; repeint(); },
  'dn-n': n => { defi.n = +n; repeint(); },
  'dn-duree': s => { defi.duree = +s; repeint(); },
  'dn-go': () => lancer()
};

async function lancer() {
  const d = db.decks.find(x => x.id === defi.livre); if (!d || defi.envoi) return;
  const ou = defi.ou, club = ou.startsWith('club:') ? ou.slice(5) : null, classe = ou.startsWith('classe:') ? ou.slice(7) : null;
  defi.envoi = true; repeint();
  if (defi.mode === 'rythme') {
    cercle.retour = club ? { name: 'club', id: club } : { name: 'commu' };
    const ok = await duelMake(d, { club, classe });
    defi.envoi = false;
    if (ok) return go(cercle.retour.name, cercle.retour.id);
    return repeint();
  }
  const questions = fabriquerQuestions(cartesDe(d), defi.jeu, defi.n);
  if (!questions.length) { defi.envoi = false; repeint(); return toast(I.x, 'Ce livre n’a pas de quoi poser ces questions'); }
  const r = await ouvrirSalle({ titre: d.name.slice(0, 80), jeu: defi.jeu, duree: defi.duree, questions, club, classe });
  defi.envoi = false;
  if (!r) return repeint();
  ouvrirDirect(r.id);
}
