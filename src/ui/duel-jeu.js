// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { $ } from '../racine.js';
import { I, svg } from '../icones.js';
import { shuffle } from '../file.js';
import { cercle, duelRun, setAnimate, setDuelRun, setView } from '../data/etat.js';
import { go, render } from './bibliotheque.js';
import { esc } from '../core/coeur-sync.js';
import { duelEnd } from '../core/defis.js';
import { ecriteJuste, jeuRythme, proposeeJuste } from '../defi.js';
import { beep, toast } from './import-cartes.js';
import { closeMenu } from './menus-a.js';
import './duel-jeu.css';

/* ══════════ jouer un défi à son rythme (chargé à la demande) ══════════
   QCM, vrai ou faux ou réponse écrite (2026-11-07) : sorti du démarrage le
   même jour, qui n'avait plus la place pour les deux jeux nouveaux — on ne
   le télécharge qu'en lançant une partie. Sa porte est ui/defis.js : rien
   d'autre ne doit importer ce fichier. */

// QCM : la bonne et trois autres réponses du défi, tirées pour chacun
function duelOpts() {
  const r = duelRun, c = r.cards[r.i];
  r.pick = null; r.ecrit = '';
  if (r.jeu !== 'qcm') { r.opts = []; return; }
  const pool = r.cards.filter((_, k) => k !== r.i).map(x => x[1]).filter(v => v !== c[1]);
  r.opts = shuffle([c[1], ...shuffle(pool).slice(0, 3)]);
}

export function commencer(du) {
  const jeu = jeuRythme(du.jeu);
  setDuelRun({ id: du.id, name: du.name, cards: du.cards || [], jeu, i: 0, score: 0,
              t0: Date.now(), pick: null, opts: [] });
  // un QCM a besoin d'autres réponses pour ses choix ; un vrai ou faux et l'écrit, non
  if (!duelRun.cards.length || (jeu === 'qcm' && duelRun.cards.length < 4)) { setDuelRun(null); return toast(I.x, 'Défi incomplet'); }
  duelOpts(); closeMenu();
  setView({ name: 'duel' }); setAnimate(true); render();
  if (jeu === 'ecrit') document.getElementById('duelecrit')?.focus();
}

/* Une réponse donnée, quel que soit le jeu : on la marque, on la dit juste
   ou pas, puis la question suivante (plus de temps pour lire la bonne). */
function repondre(r, good) {
  if (good) r.score++;
  beep(good);
  render();
  setTimeout(() => {
    if (!duelRun || duelRun !== r) return;
    if (r.i + 1 >= r.cards.length) return duelEnd();
    r.i++; duelOpts(); render();
    if (r.jeu === 'ecrit') document.getElementById('duelecrit')?.focus();
  }, good ? 700 : r.jeu === 'ecrit' ? 1800 : 1300);
}

// QCM : le rang du choix ; vrai ou faux : 0 pour « Vrai », 1 pour « Faux »
export function duelPick(k) {
  const r = duelRun; if (!r || r.pick != null) return;
  r.pick = k;
  const c = r.cards[r.i];
  repondre(r, r.jeu === 'vf' ? (k === 0) === proposeeJuste(c) : r.opts[k] === c[1]);
}

export function duelEcrit(texte) {
  const r = duelRun; if (!r || r.pick != null || r.jeu !== 'ecrit') return;
  r.ecrit = String(texte || '').trim();
  r.pick = ecriteJuste(r.cards[r.i], r.ecrit) ? 0 : 1;
  repondre(r, r.pick === 0);
}

function choixQcm(r, c) {
  return `<div class="opts">${r.opts.map((o, k) => {
    const cl = r.pick == null ? '' : o === c[1] ? ' ok' : (r.pick === k ? ' ko' : ' dim');
    return `<button class="op${cl}" data-dpick="${k}">${esc(o)}</button>`;
  }).join('')}</div>`;
}

function choixVf(r, c) {
  const vrai = proposeeJuste(c);
  const cl = k => (r.pick == null ? '' : (k === 0) === vrai ? ' ok' : r.pick === k ? ' ko' : ' dim');
  return `<div class="duel-propose"><i>Réponse proposée</i><b>${esc(c.length > 2 ? c[2] : c[1])}</b></div>
    <div class="opts vf">
      <button class="op${cl(0)}" data-dpick="0">${svg(I.check)}Vrai</button>
      <button class="op${cl(1)}" data-dpick="1">${svg(I.x)}Faux</button>
    </div>
    ${r.pick != null && !vrai ? `<p class="duel-juste">${esc(c[1])}</p>` : ''}`;
}

function champEcrit(r, c) {
  if (r.pick != null) {
    return `<div class="duel-ecrit-fait ${r.pick === 0 ? 'ok' : 'ko'}">${svg(r.pick === 0 ? I.check : I.x)}
      <span>${r.ecrit ? esc(r.ecrit) : '<i>Sans réponse</i>'}</span></div>
      ${r.pick === 0 ? '' : `<p class="duel-juste">${esc(c[1])}</p>`}`;
  }
  return `<form class="duel-ecrit" data-duel-ecrit>
      <label class="fld"><input id="duelecrit" type="text" autocomplete="off" autocapitalize="off" spellcheck="false"
        enterkeyhint="done" placeholder="Ta réponse" aria-label="Ta réponse"></label>
      <button class="cta" type="submit">Valider</button>
    </form>`;
}

export function duelView() {
  const r = duelRun;
  if (!r) { const ret = cercle.retour || { name: 'commu' }; return go(ret.name, ret.id); }
  const c = r.cards[r.i];
  $.innerHTML = `
    <div class="bar"><button class="ic" data-act="duelquit" aria-label="Abandonner">${svg(I.x)}</button>
      <h1>${esc(r.name)}</h1>
      <span class="num">${r.i + 1}/${r.cards.length}</span></div>
    <div class="page">
      <div class="dbar"><i style="width:${Math.round(r.i / r.cards.length * 100)}%"></i></div>
      <div class="qcard" data-k="duel:${r.i}"><span>${esc(c[0])}</span></div>
      ${r.jeu === 'vf' ? choixVf(r, c) : r.jeu === 'ecrit' ? champEcrit(r, c) : choixQcm(r, c)}
    </div>`;
}

// la réponse écrite part par « Valider » ou la touche Entrée du clavier
document.addEventListener('submit', e => {
  const f = e.target.closest && e.target.closest('[data-duel-ecrit]');
  if (!f) return;
  e.preventDefault();
  duelEcrit(f.querySelector('input').value);
});
