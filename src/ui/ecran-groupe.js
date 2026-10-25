// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { $ } from '../racine.js';
import { I, svg } from '../icones.js';
import { findQ, quiz, setAnimate, setFindQ, study, view } from '../data/etat.js';
import { render } from './bibliotheque.js';
import { plain } from './carte-media.js';
import { esc, live, sty, subj } from '../core/coeur-sync.js';
import { toast } from './import-cartes.js';
import { mountMenu } from './menus-a.js';
import { norm } from './quiz.js';

/* ══════════ le journal de lecture : la porte ══════════
   L'écran du journal (ses graphiques, sa feuille de style, l'export) est un
   morceau chargé à la demande, comme une partie en direct : on ne le
   télécharge qu'en l'ouvrant, puis le service worker le garde. Rien d'autre
   ne doit importer `ui/journal-ecran.js` — passer par ici. */
let ecranJournal = null, chargeJournal = null;

function chargerJournal() {
  if (ecranJournal) return Promise.resolve(ecranJournal);
  if (!chargeJournal) {
    chargeJournal = import('./journal-ecran.js').then(m => (ecranJournal = m))
      .catch(e => { chargeJournal = null; throw e; });
  }
  return chargeJournal;
}

export function statsView() {
  if (ecranJournal) return ecranJournal.journalEcran();
  $.innerHTML = `<div class="bar"><button class="ic" data-act="home" aria-label="Retour">${svg(I.back)}</button></div>
    <div class="page"><div class="top"><div class="hero">Journal</div></div><div class="empty">${svg(I.chart)}</div></div>`;
  chargerJournal().then(() => { if (view.name === 'stats') { setAnimate(false); render(); } })
    .catch(() => toast(I.x, 'Le journal n’a pas pu s’ouvrir : vérifie ta connexion'));
}

export async function exportStats() {
  try { (await chargerJournal()).exporterJournal(); }
  catch (e) { toast(I.x, 'Export impossible'); }
}

/* ---------- recherche globale ----------
   Un seul champ pour les paquets et les cartes : on cherche un mot, pas
   un endroit où chercher. Tout se fait en mémoire, la bibliothèque tient
   déjà entière dans le navigateur. */
function findResults(q) {
  const n = norm(q);
  if (!n) return { decks: [], cards: [] };
  const decks = live().filter(d => norm(d.name).includes(n)).slice(0, 12);
  const cards = [];
  for (const d of live()) {
    for (const c of d.cards) {
      if (norm(plain(c.f)).includes(n) || norm(plain(c.b)).includes(n)) cards.push({ c, d });
      if (cards.length >= 60) break;
    }
    if (cards.length >= 60) break;
  }
  return { decks, cards };
}

export function findView() {
  $.innerHTML = `
    <div class="bar"><button class="ic" data-act="home" aria-label="Retour">${svg(I.back)}</button>
      <div class="fld"><input id="fq" type="search" placeholder="Chercher un mot, un livre…"
        autocomplete="off" autocapitalize="none" spellcheck="false" enterkeyhint="search"
        value="${esc(findQ)}" aria-label="Recherche"></div></div>
    <div class="page" id="fres"></div>`;
  paintFind();
  bindFind();
function paintFind() {
  const box = document.getElementById('fres'); if (!box) return;
  const r = findResults(findQ);
  box.innerHTML = `
      ${!findQ.trim() ? `<div class="empty">${svg(I.search)}</div>`
        : (!r.decks.length && !r.cards.length) ? `<div class="empty">${svg(I.search)}<p><b>Rien trouvé</b>pour « ${esc(findQ)} »</p></div>`
        : `${r.decks.length ? `<div class="lbl"><span>Livres</span><span>${r.decks.length}</span></div>
          <div class="slist">${r.decks.map(d => `<button class="sr flat" data-go="${d.id}">
            <i class="ldot" style="${sty(subj(d.subject))}"></i>
            <span class="n">${esc(d.name)}</span>
            <span class="c">${d.cards.length}</span>${svg(I.arrow)}</button>`).join('')}</div>` : ''}
        ${r.cards.length ? `<div class="lbl"><span>Pages</span><span>${r.cards.length}</span></div>
          <div class="slist">${r.cards.map(({ c, d }) => `<button class="sr flat" data-go="${d.id}">
            <span class="ml2"><span class="n">${hl(plain(c.f), findQ)}</span>
              <span class="sub">${hl(plain(c.b), findQ)} · ${esc(d.name)}</span></span>
            ${svg(I.arrow)}</button>`).join('')}</div>` : ''}`}`;
}
function bindFind() {
  const f = document.getElementById('fq');
  /* On ne redessine que les résultats. Redessiner l'écran entier
     recréait le champ à chaque lettre : il perdait le curseur et le
     clavier se refermait au milieu du mot. */
  let t = 0;
  f.addEventListener('input', () => {
    setFindQ(f.value);
    clearTimeout(t);
    t = setTimeout(paintFind, 90);
  });
  if (document.activeElement !== f) setTimeout(() => {
    f.focus(); f.setSelectionRange(f.value.length, f.value.length);
  }, 50);
}
}

/* surligne ce qui a été cherché, sans jamais laisser passer de balise */
function hl(txt, q) {
  const t = String(txt), n = norm(q);
  if (!n) return esc(t);
  const i = norm(t).indexOf(n);
  if (i < 0) return esc(t);
  return esc(t.slice(0, i)) + '<mark>' + esc(t.slice(i, i + q.trim().length)) + '</mark>'
    + esc(t.slice(i + q.trim().length));
}

/* Ce qui serait perdu en quittant maintenant : un exercice court, sans
   reprise possible, et déjà entamé. */
export function lostOnLeave() {
  if (quiz && quiz.pool && quiz.i > 0 && quiz.i < quiz.pool.length) return true;
  if (study && study.mode && study.i > 0 && study.i < study.queue.length) return true;
  return false;
}

/* ---------- pages d'un PDF ----------
   Une feuille légère, hors du système de menus : elle se referme d'
   elle-même et rend la main au code qui l'a ouverte. Laisser le champ
   vide prend tout le document. */
export function askPages(done) {
  document.querySelectorAll('.scrim,.menu').forEach(n => n.remove());
  const w = document.createElement('div');
  w.innerHTML = `<div class="scrim" id="pgx"></div>
    <div class="menu">
      <div class="mi" style="font-weight:750">${svg(I.file)}Quelles pages ?</div>
      <input class="tok" id="pgin" placeholder="Toutes les pages" spellcheck="false"
        autocapitalize="none" inputmode="numeric" enterkeyhint="done">
      <div class="note">Par exemple <b>3-7</b> pour une suite, <b>2, 5, 9</b> pour un choix,
        ou rien du tout pour prendre le document entier.</div>
      <button class="mi" id="pgok" style="justify-content:center;font-weight:700">
        ${svg(I.check)}Lire le PDF</button>
    </div>`;
  mountMenu(w);
  const inp = document.getElementById('pgin');
  const close = () => document.querySelectorAll('.scrim,.menu').forEach(n => n.remove());
  const go2 = () => { const v = inp.value.trim(); close(); done(v); };
  document.getElementById('pgok').onclick = go2;
  document.getElementById('pgx').onclick = close;
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go2(); } });
  setTimeout(() => inp.focus(), 60);
}
