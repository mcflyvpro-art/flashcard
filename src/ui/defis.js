// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { $ } from '../racine.js';
import { I, svg } from '../icones.js';
import { shuffle } from '../file.js';
import {
  auth, duelRun, duels, setAnimate, setDuelRun, setView
} from '../data/etat.js';
import { render } from './bibliotheque.js';
import { esc } from '../core/coeur-sync.js';
import { duelEnd } from '../core/defis.js';
import { groupView } from './ecran-groupe.js';
import { beep, toast } from './import-cartes.js';
import { closeMenu } from './menus-a.js';

/* ---------- défis ----------
   Les questions sont figées à la création : tout le monde répond
   exactement aux mêmes, dans le même ordre. Sinon comparer les scores ne
   voudrait rien dire, et le paquet d'origine peut très bien changer
   ensuite. Un essai par personne, pour la même raison. */
export const myScore = id => (duels.scores || []).find(s => s.duel_id === id && s.user_id === auth.uid);

export const rankOf = id => (duels.scores || []).filter(s => s.duel_id === id)
  .sort((a, b) => b.score - a.score || a.ms - b.ms);

function duelOpts() {
  const r = duelRun, c = r.cards[r.i];
  const pool = r.cards.filter((_, k) => k !== r.i).map(x => x[1]).filter(v => v !== c[1]);
  r.opts = shuffle([c[1], ...shuffle(pool).slice(0, 3)]);
  r.pick = null;
}

export function duelStart(du) {
  if (myScore(du.id)) return;
  setDuelRun({ id: du.id, name: du.name, cards: du.cards || [], i: 0, score: 0,
              t0: Date.now(), pick: null, opts: [] });
  if (duelRun.cards.length < 4) { setDuelRun(null); return toast(I.x, 'Défi incomplet'); }
  duelOpts(); closeMenu();
  setView({ name: 'duel' }); setAnimate(true); render();
}

export function duelPick(k) {
  const r = duelRun; if (!r || r.pick != null) return;
  r.pick = k;
  const good = r.opts[k] === r.cards[r.i][1];
  if (good) r.score++;
  beep(good);
  render();
  setTimeout(() => {
    if (!duelRun || duelRun !== r) return;
    if (r.i + 1 >= r.cards.length) return duelEnd();
    r.i++; duelOpts(); render();
  }, good ? 700 : 1300);
}

export function duelView() {
  const r = duelRun;
  if (!r) { setView({ name: 'group' }); return groupView(); }
  const c = r.cards[r.i], good = c[1];
  $.innerHTML = `
    <div class="bar"><button class="ic" data-act="duelquit" aria-label="Abandonner">${svg(I.x)}</button>
      <h1>${esc(r.name)}</h1>
      <span class="num">${r.i + 1}/${r.cards.length}</span></div>
    <div class="page">
      <div class="dbar"><i style="width:${Math.round(r.i / r.cards.length * 100)}%"></i></div>
      <div class="qcard"><span>${esc(c[0])}</span></div>
      <div class="opts">${r.opts.map((o, k) => {
        const cl = r.pick == null ? '' : o === good ? ' ok' : (r.pick === k ? ' ko' : ' dim');
        return `<button class="op${cl}" data-dpick="${k}">${esc(o)}</button>`;
      }).join('')}</div>
    </div>`;
}
