import { $ } from '../racine.js';
import { I, SWIPE, svg } from '../icones.js';
import { DAY } from '../fsrs.js';
import { buildQueue, shuffle } from '../file.js';
import {
  auth, db, demo, dirty, flipAt, pendingGrade, prefs, setFlipAt, setPendingGrade, setStudy,
  stats, study, tour
} from '../data/etat.js';
import { go, liveBump } from './bibliotheque.js';
import {
  TTS, grade, mimg, paintMedia, plain, preview, rt
} from './carte-media.js';
import {
  DEFMETA, deck, enqueue, esc, live, metaOf, pushHist, save, scheduleFlush, sty, subj, uid
} from '../core/coeur-sync.js';
import { beep, bumpToday, simpleMode, toast } from './import-cartes.js';
import { norm } from './quiz.js';

/* ---------- révision ---------- */
function studySource(id) {
  if (id === 'all') {                                  // mode marathon
    return { cards: live().flatMap(d => d.cards.map(c => ({ ...c, _d: d.id }))), name: 'Marathon' };
  }
  const d = deck(id);
  return d ? { cards: d.cards, name: d.name } : null;
}

function studyIds(cards, subset, o, sm) {
  if (subset && subset.length) {
    const keep = new Set(subset);
    return cards.filter(c => keep.has(c.id)).map(c => c.id);
  }
  /* un ordre demandé par l'appelant (le bouton mélanger) l'emporte sur
     la préférence, dans les deux modes */
  return buildQueue(cards, sm
    ? { order: o.order || (prefs.order === 'due' ? 'random' : prefs.order), cap: 0,
        fresh: prefs.fresh, only: o.only === 'leech' ? 'leech' : '' }
    : { ...o, order: o.order || prefs.order, fresh: prefs.fresh,
        cap: o.cap != null ? o.cap : prefs.cap }, Date.now()).map(c => c.id);
}

/* Le QCM a besoin d'au moins deux réponses distinctes pour avoir un sens ;
   une carte vrai/faux n'a pas sa place dans un QCM à quatre entrées. */
function mcqPoolAndIds(cards, ids) {
  const seen = new Set(), pool = [];
  for (const c of cards) {
    if (isTF(c) || isBool(c.b)) continue;
    const k = norm(plain(c.b));
    if (k && !seen.has(k)) { seen.add(k); pool.push(c.b); }
  }
  if (pool.length < 2) return { error: 'Pas assez de réponses différentes' };
  const keep = new Set(cards.filter(c => !isTF(c)).map(c => c.id));
  const kept = ids.filter(x => keep.has(x));
  return kept.length ? { pool, ids: kept } : { error: 'Rien à mettre en QCM' };
}

export function startStudy(id, rev, subset, opt) {
  const o = opt || {};
  const sm = simpleMode();          // figé pour toute la session : pas de bascule à chaud
  const src = studySource(id);
  if (!src) return;
  let ids = studyIds(src.cards, subset, o, sm);
  if (!ids.length) { toast(I.check, 'Rien à revoir ici'); return; }
  const dm = id === 'all' ? DEFMETA : metaOf(deck(id));
  const mode = o.mode || '';
  let pool = [];
  if (mode === 'mcq') {
    const mcq = mcqPoolAndIds(src.cards, ids);
    if (mcq.error) { toast(I.x, mcq.error); return; }
    pool = mcq.pool; ids = mcq.ids;
  }
  setStudy({ id, name: src.name, langf: dm.langf, langb: dm.langb, mode, pool, rev: !!rev, both: !!o.both, queue: ids, i: 0, again: [], flip: false,
            ok: 0, total: ids.length, t0: Date.now(), tq: Date.now(), tried: {}, missSet: {},
            miss: [], log: [], saved: false, opt: o, simple: sm,
            dirs: Object.fromEntries(ids.map(x => [x, o.both ? Math.random() < .5 : !!rev])) });
  saveResume();
  go('study', id);
}

/* Reprise : l'état de la session survit à la fermeture de l'app */
export function saveResume() {
  /* La séance de démonstration ne laisse pas de trace : sans ça, le
     bandeau « Reprendre Italien — les bases » s'affichait sur le vrai
     compte, qui n'a jamais eu ce paquet. */
  if (demo) return;
  try {
    /* QCM et association sont des exercices courts, et leur état porte des
       références de cartes : on ne les met pas en reprise. */
    if (!study || study.mode || study.i >= study.queue.length) localStorage.removeItem('cartes.resume.' + auth.uid);
    else localStorage.setItem('cartes.resume.' + auth.uid, JSON.stringify({ ...study, t: Date.now() }));
  } catch (e) { /* stockage indisponible : la reprise ne sera simplement pas proposée */ }
}

export function loadResume() {
  if (demo) return null;
  try {
    const r = JSON.parse(localStorage.getItem('cartes.resume.' + auth.uid));
    if (r && Date.now() - r.t < 3 * DAY && r.i < r.queue.length
        && !!r.simple === simpleMode()) return r;      // snapshot d'un autre mode : on l'ignore
  } catch (e) { /* snapshot corrompu ou absent : pas de reprise, comme un démarrage neuf */ }
  return null;
}

/* Retrouve la carte d'une file, y compris en marathon */
function findCard(cid) {
  if (study.id === 'all') {
    for (const d of db.decks) { const c = d.cards.find(x => x.id === cid); if (c) return [c, d]; }
    return [null, null];
  }
  const d = deck(study.id);
  return [d ? d.cards.find(x => x.id === cid) : null, d];
}

const ringCol = p => p >= .8 ? 'var(--ok)' : p >= .5 ? '#C9A526' : 'var(--ko)';

const ring = (ok, total) => {
  const p = total ? ok / total : 0;
  return `<div class="ring" style="--rc:${ringCol(p)}">
    <svg viewBox="0 0 172 172">
      <circle class="bgc" cx="86" cy="86" r="75"/>
      <circle class="fgc" cx="86" cy="86" r="75" style="stroke-dashoffset:471"/>
    </svg>
    <div class="in"><div class="v">${Math.round(p * 100)}<span style="font-size:22px">%</span></div>
      <div class="u">${ok} / ${total}</div></div>
  </div>`;
};

export function fillRing(ok, total) {
  requestAnimationFrame(() => {
    const c = document.querySelector('.ring .fgc');
    if (c) c.style.strokeDashoffset = String(471 * (1 - (total ? ok / total : 0)));
  });
}

const mmss = ms => {
  const t = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

const bestRun = log => { let b = 0, c = 0; for (const v of log) { c = v ? c + 1 : 0; if (c > b) b = c; } return b; };

/* bilan de fin de session : chiffres, séries, historique, liste des ratés */
export function review(o) {
  const per = o.log.length ? o.ms / o.log.length : 0;
  const hist = o.hist || [];
  const tiles = [
    [o.total - o.ok, 'erreurs'],
    [bestRun(o.log), 'série'],
    [mmss(o.ms), 'durée'],
    [(per / 1000).toFixed(1).replace('.', ',') + 's', 'par carte']
  ];
  if (o.forced) tiles.splice(1, 0, [o.forced, 'forcées']);
  if (o.hints) tiles.push([o.hints, 'indices']);
  return `<div class="rev">
    ${ring(o.ok, o.total)}
    <div class="tiles">
      ${tiles.map(([v, l]) => `<div class="st"><b>${v}</b><span>${l}</span></div>`).join('')}
    </div>
    <div class="strip">${o.log.map(v => `<i class="${v ? 'y' : 'n'}"></i>`).join('')}</div>
    ${hist.length > 1 ? `<div class="lbl lh"><span>Sessions</span><span>${hist.length}</span></div>
      <div class="hist">${hist.slice(-12).map((h, i, a) =>
        `<div class="hb ${i === a.length - 1 ? 'now' : ''}"><i style="height:${Math.max(4, h.p * 100)}%"></i></div>`
      ).join('')}</div>` : ''}
    <div class="b">
      ${o.miss.length ? `<button data-act="${o.redo}">${svg(I.target)}Erreurs</button>` : ''}
      <button data-act="${o.again}">${svg(I.redo)}Rejouer</button>
      <button class="prim" data-act="${o.done}">${svg(I.check)}Fin</button>
    </div>
    ${o.miss.length ? `<div class="lbl lm"><span>À revoir</span><span>${o.miss.length}</span></div>
      <div class="miss">${o.miss.map((m, i) => `<div class="mr" style="animation-delay:${i * 22}ms">
        <div class="q">${rt(m.q)}</div>
        ${m.typed ? `<div class="w">${svg(I.x)}${m.diff || esc(m.typed)}</div>` : ''}
        <div class="g">${svg(I.check)}${rt(m.a)}</div>
      </div>`).join('')}</div>` : ''}
  </div>`;
}

export function studyView() {
  const d = study.id === 'all' ? null : deck(study.id);
  if (study.id !== 'all' && !d) return go('home');
  const s = subj(d ? d.subject : '');
  const bar = n => `<div class="bar">
      <button class="ic" data-act="deck" aria-label="Retour">${svg(I.back)}</button>
      <h1>${esc(study.name || (d ? d.name : ''))}</h1>
      ${n}
      <button class="ic ${prefs.zen ? 'solid' : ''}" data-act="zen"
        aria-label="Mode sans distraction">${svg(I.zen)}</button>
      <button class="ic ${study.rev ? 'solid' : ''}" data-act="swap" aria-label="Inverser le sens">${svg(I.swap)}</button>
      <button class="ic" data-act="restart" aria-label="Mélanger">${svg(I.shuffle)}</button>
    </div>`;
  if (study.i >= study.queue.length) {
    if (study.again.length) { study.queue = study.again; study.again = []; study.i = 0; study.flip = false; }
    else {
      if (!study.saved) { study.saved = true; study.ms = Date.now() - study.t0;
        study.hist = pushHist(study.id, 'study', study.total ? study.ok / study.total : 0);
        saveResume(); }
      $.innerHTML = bar('') + review({
        ok: study.ok, total: study.total, log: study.log, ms: study.ms, hist: study.hist,
        miss: study.miss, redo: 'redostudy', again: 'restart', done: 'deck'
      });
      return fillRing(study.ok, study.total);
    }
  }
  if (study.mode === 'match') {
    if (!study.batch) nextBatch();
    $.innerHTML = bar(`<span class="num">${Math.min(study.i + (study.batch || []).length, study.queue.length)}/${study.queue.length}</span>`)
      + `<div class="study">
        <div class="prog"><i id="pg" style="width:0%"></i></div>
        <div class="mwrap" id="mwrap" style="${sty(s)}">${matchBody()}</div>
      </div>`;
    requestAnimationFrame(() => { const p = document.getElementById('pg'); if (p) p.style.width = pct() + '%'; });
    return;
  }
  $.innerHTML = bar(`<span class="num">${Math.min(study.i + 1, study.queue.length)}/${study.queue.length}</span>`)
    + `<div class="study${study.mode === 'mcq' ? ' mcq' : ''}${prefs.zen ? ' zen' : ''}">
      <div class="prog"><i id="pg" style="width:0%"></i></div>
      ${study.mode === 'mcq'
        ? `<div class="qcard" id="stack" style="${sty(s)}"></div>`
        : `<div class="stage"><div class="stack" id="stack" style="${sty(s)}"></div></div>`}
      <div id="foot"></div>
    </div>`;
  paintQ();
  requestAnimationFrame(() => { const p = document.getElementById('pg'); if (p) p.style.width = pct() + '%'; });
}

const pct = () => study.total ? Math.round(study.ok / study.total * 100) : 0;

export const cardOf = n => findCard(study.queue[study.i + n])[0];

/* ---------- d'où vient la carte affichée ----------
   En marathon les cartes viennent de paquets différents : la matière, sa
   couleur et les langues des deux faces appartiennent au paquet de la
   carte en cours, pas à la session. Hors marathon, tout le paquet partage
   les mêmes, et on garde ce qui a été figé au démarrage. */
export function cardOrigin(c) {
  if (!c || study.id !== 'all') return { langf: study.langf, langb: study.langb, subj: null };
  const [, d] = findCard(c.id);
  const m = d ? metaOf(d) : DEFMETA;
  return { langf: m.langf, langb: m.langb, subj: d ? subj(d.subject) : null };
}

/* Une face : image, texte mis en forme, bouton de son. Le bouton lit
   l'enregistrement de la carte s'il y en a un, sinon fait parler le
   navigateur quand le paquet déclare une langue. */
/* Le texte grandit ou rétrécit selon sa longueur, sinon une longue
   définition déborde d'une carte à hauteur fixe. Au-delà, le repli est un
   vrai défilement interne (la carte reste lisible en entier, sans jamais
   couper le contenu ou sortir du cadre). */
const faceSize = txt => {
  const n = plain(txt).length;
  return n > 260 ? ' xxl' : n > 160 ? ' xl' : n > 90 ? ' l' : '';
};

/* Une face peut ne porter qu'un son, qu'une image, qu'un texte, ou les
   trois. Les commandes de son étaient collées dans un coin : sur une fiche
   qui n'a qu'un enregistrement, tout le cadre paraissait vide et le seul
   contenu se cachait en bas à droite. Elles entrent donc dans le flux —
   image, puis texte, puis sons — et l'ensemble se centre d'un bloc, quelle
   que soit la combinaison.

   Deux sons ne se disputent plus le même bouton. L'enregistrement d'une
   vraie voix et la lecture par la machine sont deux choses différentes :
   le micro pour l'un, le haut-parleur pour l'autre, et on peut écouter
   les deux. Avant, dès qu'un enregistrement existait, la voix de synthèse
   devenait inatteignable. */
function faceHtml(bk, txt, img, aud, lang, tag) {
  const side = bk ? 'b' : 'f';
  const hasTxt = !!plain(txt);
  const canSay = !!(lang && TTS && hasTxt);
  const seul = !hasTxt && !img && (aud || canSay);   // le son est tout le contenu
  const btns = (aud ? `<button class="snd" data-snd="${side}"
        aria-label="Écouter l’enregistrement">${svg(I.mic)}</button>` : '')
    + (canSay ? `<button class="snd" data-say="${side}"
        aria-label="Lire le texte à voix haute">${svg(I.sound)}</button>` : '');
  return `<div class="face${bk ? ' bk' : ''}${faceSize(txt)}">
    ${tag || ''}
    <div class="fbody">
      ${mimg('fim', img)}
      ${hasTxt ? `<div class="tx">${rt(txt)}</div>` : ''}
      ${btns ? `<div class="snds${seul ? ' seul' : ''}">${btns}</div>` : ''}
    </div>
  </div>`;
}

export const isTF = c => c && c.t === 'tf';

export const isBool = t => /^(vrai|faux|true|false|oui|non|yes|no)$/i.test(plain(t).trim());

const tfTruth = c => /^\s*(v|vrai|true|oui|yes|1|y)\b/i.test(plain(c.b));

/* Les deux faces d'une carte, selon son sens d'affichage : le sens fixé
   pour la carte (`study.dirs`) ou celui de la session, sauf sur une
   carte vrai/faux, qui n'a pas de sens à inverser. */
function cardFacesFor(c, tf) {
  const rv = !tf && (study.dirs ? study.dirs[c.id] : study.rev);
  const org = cardOrigin(c);
  return {
    rv, org,
    front: rv ? c.b : c.f, back: rv ? c.f : c.b,
    fimg: rv ? c.bi : c.fi, bimg: rv ? c.fi : c.bi,
    faud: rv ? c.ba : c.fa, baud: rv ? c.fa : c.ba,
    frontLang: rv ? org.langb : org.langf, backLang: rv ? org.langf : org.langb
  };
}

/* Posées sur la fiche et non dedans, la matière et les étiquettes
   restaient en place pendant que la fiche se retournait : elles avaient
   l'air collées par-dessus. Elles appartiennent maintenant à chaque
   face, donc elles tournent avec. */
function cardTagHtml(c, org) {
  return `${org.subj ? `<div class="sbj"><i></i>${esc(org.subj.name)}</div>` : ''}${
    (c.g || []).length ? `<div class="ctags">${c.g.slice(0, 3).map(t =>
      `<i>${esc(t)}</i>`).join('')}</div>` : ''}`;
}

function paintStack() {
  const st = document.getElementById('stack'); if (!st) return;
  const c = cardOf(0);
  if (!c) { st.innerHTML = ''; return; }
  study.tf = null;                                   // verdict vrai/faux de la carte courante
  const tf = isTF(c);
  const { front, back, fimg, bimg, faud, baud, frontLang, backLang, org } = cardFacesFor(c, tf);
  /* la pile prend la couleur de la matière de la carte, carte après carte */
  if (org.subj) st.setAttribute('style', sty(org.subj));
  const tag = cardTagHtml(c, org);
  st.innerHTML = `<div class="card in${tf ? ' tf' : ''}" id="top">
      <div class="flipper">
        ${faceHtml(false, front, fimg, faud, frontLang, tag)}
        ${faceHtml(true, back, bimg, baud, backLang, tag)}
      </div>
      <i class="swr" aria-hidden="true"></i>
      <div class="ov y">${svg(I.check)}</div>
      <div class="ov n">${svg(I.x)}</div>
    </div>`;
  paintMedia(st);
  const top = document.getElementById('top');
  requestAnimationFrame(() => top.classList.remove('in'));
  if (!tf) bindDrag(top);
}

/* QCM : les distracteurs sortent du paquet lui-même, ce sont donc des
   réponses plausibles et non du remplissage. Trois au maximum, moins si le
   paquet est court. */
function paintMCQ() {
  const st = document.getElementById('stack'), f = document.getElementById('foot');
  const c = cardOf(0);
  if (!c || !st || !f) return;
  if (!study.opts || study.optsFor !== c.id) {
    const good = norm(plain(c.b));
    const wrong = shuffle(study.pool.filter(x => norm(plain(x)) !== good)).slice(0, 3);
    study.opts = shuffle([c.b, ...wrong]);
    study.optsFor = c.id;
    study.pick = null;
  }
  st.innerHTML = `${mimg('fim', c.fi)}
    <span>${rt(c.f)}</span>
    ${(() => {
      const o = cardOrigin(c), sayable = o.langf && TTS && plain(c.f);
      const b = (c.fa ? `<button class="snd" data-snd="f" aria-label="Écouter l’enregistrement">${svg(I.mic)}</button>` : '')
        + (sayable ? `<button class="snd" data-say="f" aria-label="Lire à voix haute">${svg(I.sound)}</button>` : '');
      return b ? `<div class="snds">${b}</div>` : '';
    })()}`;
  paintMedia(st);
  const good = norm(plain(c.b));
  f.innerHTML = `<div class="opts">${study.opts.map((o, k) => {
    const right = norm(plain(o)) === good;
    const cl = study.pick == null ? '' : right ? ' ok' : (study.pick === k ? ' ko' : ' dim');
    return `<button class="op${cl}" data-pick="${k}">${rt(o)}</button>`;
  }).join('')}</div>
  ${study.pick != null && !prefs.fast
    ? `<button class="cta" style="margin-top:9px" data-act="nextcard">Suivant${svg(I.arrow)}</button>` : ''}`;
}

export function pickMCQ(k) {
  if (study.pick != null) return;
  const c = cardOf(0); if (!c) return;
  study.pick = k;
  study.pickOk = norm(plain(study.opts[k])) === norm(plain(c.b));
  paintMCQ();
  if (prefs.fast) setTimeout(() => {
    if (study && study.pick != null) commit(study.pickOk, study.pickOk ? 2 : 0);
  }, study.pickOk ? 560 : 1150);
}

/* ---------- association ----------
   Six pages par lot, douze étiquettes jetées en vrac dans une seule
   grille : les deux faces d'une même page peuvent tomber n'importe où, et
   on relie deux étiquettes dans l'ordre qu'on veut. Une paire trouvée du
   premier coup compte juste, sinon elle est comptée ratée — sans ça le
   format serait un jeu de devinettes gratuit. */
function nextBatch() {
  const cards = study.queue.slice(study.i, study.i + 6).map(id => findCard(id)[0]).filter(Boolean);
  study.batch = cards;
  study.tiles = shuffle(cards.reduce((a, c) => a.concat([{ id: c.id, s: 'L' }, { id: c.id, s: 'R' }]), []));
  study.sel = null; study.done = {}; study.wrong = {};
}

function matchBody() {
  const byId = Object.fromEntries((study.batch || []).map(c => [c.id, c]));
  const sel = study.sel;
  return `<div class="match">${(study.tiles || []).map(t => {
    const c = byId[t.id];
    if (!c) return '';
    const on = sel && sel.id === t.id && sel.s === t.s;
    return `<button class="mc${on ? ' on' : ''}${study.done[t.id] ? ' done' : ''}"
      data-mt="${t.s}:${t.id}">${rt(t.s === 'L' ? c.f : c.b)}</button>`;
  }).join('')}</div>`;
}

function paintMatch() {
  const w = document.getElementById('mwrap');
  if (w) w.innerHTML = matchBody();
}

export function pickMatch(side, id) {
  if (study.done[id]) return;
  const sel = study.sel;
  if (!sel) { study.sel = { id, s: side }; return paintMatch(); }
  if (sel.id === id && sel.s === side) { study.sel = null; return paintMatch(); }
  if (sel.id === id) {
    study.done[id] = 1;
    scoreCard(id, !study.wrong[id], study.wrong[id] ? 0 : 2);
    study.sel = null;
    paintMatch();
    const p = document.getElementById('pg');
    if (p) p.style.width = pct() + '%';
    if (Object.keys(study.done).length >= study.batch.length) {
      setTimeout(() => {
        if (!study) return;
        study.i += study.batch.length;
        saveResume();
        if (study.i < study.queue.length) nextBatch();
        studyView();
      }, 480);
    }
    return;
  }
  /* raté : les deux étiquettes tremblent, et les deux pages concernées
     perdent leur bonus « du premier coup ». */
  study.wrong[sel.id] = 1; study.wrong[id] = 1;
  study.sel = null;
  [`${sel.s}:${sel.id}`, `${side}:${id}`].forEach(k => {
    const el = document.querySelector(`[data-mt="${k}"]`);
    if (el) { el.classList.add('shk'); setTimeout(() => el.classList.remove('shk'), 380); }
  });
  setTimeout(() => { if (study && study.mode === 'match') paintMatch(); }, 400);
}

/* Vrai / faux : pas de note à choisir, la réponse est binaire. On révèle,
   on laisse une seconde pour voir, on enchaîne. */
export function answerTF(said) {
  const c = cardOf(0);
  if (!c || !isTF(c) || study.tf != null) return;
  study.tf = (said === tfTruth(c));
  study.flip = true;
  turnPage(document.getElementById('top'), true);
  paintFoot();
  if (prefs.fast) {
    setPendingGrade(study.tf ? 2 : 0);
    setTimeout(() => { if (study && study.tf != null) fling(study.tf ? 1 : -1); }, 820);
  }
}

function paintFoot() {
  const f = document.getElementById('foot'); if (!f) return;
  const c = cardOf(0) || {};
  if (isTF(c)) {
    f.innerHTML = study.tf == null
      ? `<div class="tfb">
          <button class="tv y" data-tf="1">${svg(I.check)}<span>Vrai</span></button>
          <button class="tv n" data-tf="0">${svg(I.x)}<span>Faux</span></button>
        </div>`
      : `<div class="tfv ${study.tf ? 'y' : 'n'}">${svg(study.tf ? I.check : I.x)}
          ${prefs.fast ? '' : `<button class="cta" data-act="nextcard">Suivant${svg(I.arrow)}</button>`}
        </div>`;
    return;
  }
  f.innerHTML = study.flip && !study.simple
    ? `<div class="grades">
        ${[[0, 'Encore', 'g0'], [1, 'Difficile', 'g1'], [2, 'Correct', 'g2'], [3, 'Facile', 'g3']]
          .map(([r, lab, cl]) => `<button class="gr ${cl}" data-g="${r}">
            <span>${lab}</span><i>${esc(preview(c, r))}</i></button>`).join('')}
      </div>`
    : `<div class="hint">${SWIPE}<span class="keys">
        <kbd>←</kbd>${svg(I.x)}<kbd>→</kbd>${svg(I.check)}<kbd>espace</kbd>${svg(I.swap)}</span></div>`;
}

export function toggleFlip() {
  const top = document.getElementById('top'); if (!top) return;
  const now = Date.now();
  if (now - flipAt < 480) return;
  setFlipAt(now);
  study.flip = !study.flip;
  turnPage(top, study.flip);
  paintFoot();
}

const turnPage = (top, on) => { if (top) top.classList.toggle('flip', !!on); };

/* ---------- le geste ----------
   La fiche ne suivait que l'axe horizontal : on la poussait à gauche ou à
   droite et elle revenait sur un rail. C'était lisible, mais ça n'était
   pas une carte — un objet posé sur une table se prend, se promène, se
   repose, et part dans la direction où on l'a lancé.

   Elle se déplace donc librement, dans les deux axes, aussi loin qu'on
   veut. Trois choses font la fluidité :

   — l'écran ne se repeint qu'une fois par image. Un doigt produit plus
     d'événements que l'écran n'a de trames ; écrire la transformation à
     chaque événement fait travailler le navigateur pour rien et saccade.
   — la rotation dépend de l'endroit où l'on a saisi. Prise par le haut la
     fiche penche dans un sens, prise par le bas dans l'autre, comme un
     carton qu'on fait pivoter autour du point qu'on tient.
   — le lancer garde sa direction. On relâche en diagonale, elle sort en
     diagonale, à la vitesse qu'on lui a donnée, au lieu de rejoindre une
     trajectoire décidée d'avance.

   Ce qui ne change pas : la décision reste à gauche ou à droite. Un
   déplacement vertical promène la fiche, il ne répond pas à sa place. */
const tint = dx => Math.min(1, Math.max(0, (Math.abs(dx) - 6) / 60));

function swipeTint(el, dx) {
  const t = tint(dx);
  el.style.setProperty('--sw', t.toFixed(3));
  if (t) el.style.setProperty('--swc', dx > 0 ? 'var(--ok)' : 'var(--ko)');
}

function bindDrag(el) {
  let x0 = 0, y0 = 0, dx = 0, dy = 0, on = false, moved = false;
  let haut = true;                    // saisie au-dessus du milieu de la fiche
  let raf = 0, pid = -1;
  /* Les derniers instants du geste, pour connaître la vitesse au lâcher.
     La moyenne depuis le départ mentirait : on ralentit souvent avant de
     relâcher, et un long déplacement lent finirait par compter comme un
     lancer. */
  let trace = [];
  const SUIVI = 90;                   // millisecondes retenues

  const ov = (k, v) => { const n = el.querySelector('.ov.' + k); if (n) { n.style.opacity = v; n.style.transform = `scale(${.55 + v * .45})`; } };

  const peindre = () => {
    raf = 0;
    /* La rotation suit l'écart horizontal, signée par le point de saisie,
       et se plafonne : au-delà d'une vingtaine de degrés la fiche devient
       illisible pendant qu'on la déplace. */
    const rot = Math.max(-20, Math.min(20, dx * .07)) * (haut ? 1 : -1);
    el.style.transform = `translate3d(${dx}px, ${dy}px, 0) rotate(${rot}deg)`;
    swipeTint(el, dx);
    const t = tint(dx);
    ov('y', dx > 0 ? t : 0);
    ov('n', dx < 0 ? t : 0);
  };
  const demander = () => { if (!raf) raf = requestAnimationFrame(peindre); };

  const vitesse = () => {
    const t = Date.now();
    const p = trace.filter(s => t - s.t < SUIVI);
    if (p.length < 2) return { vx: 0, vy: 0 };
    const a = p[0], b = p[p.length - 1];
    const dt = Math.max(8, b.t - a.t);
    return { vx: (b.x - a.x) / dt, vy: (b.y - a.y) / dt };   // pixels par milliseconde
  };

  el.addEventListener('pointerdown', e => {
    if (e.target.closest('[data-snd],[data-say]')) return;   // le son ne retourne pas la fiche
    on = true; moved = false; dx = 0; dy = 0;
    x0 = e.clientX; y0 = e.clientY; pid = e.pointerId;
    const r = el.getBoundingClientRect();
    haut = e.clientY < r.top + r.height / 2;
    trace = [{ x: 0, y: 0, t: Date.now() }];
    try { el.setPointerCapture(pid); } catch (x) { /* capture refusée : le glissé marche quand même via pointermove */ }
    el.style.transition = 'none';
  });
  el.addEventListener('pointermove', e => {
    if (!on || e.pointerId !== pid) return;
    dx = e.clientX - x0; dy = e.clientY - y0;
    if (!moved && Math.hypot(dx, dy) > 5) moved = true;
    const t = Date.now();
    trace.push({ x: dx, y: dy, t });
    while (trace.length > 2 && t - trace[0].t > SUIVI) trace.shift();
    demander();
  });
  const end = () => {
    if (!on) return; on = false;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    el.style.transition = '';
    const v = vitesse();
    /* Deux façons de valider : aller assez loin, ou lancer assez vite. La
       seconde permet un geste court et sec, qui est celui qu'on fait quand
       on enchaîne. */
    if (Math.abs(dx) > 92 || (Math.abs(v.vx) > .45 && Math.abs(dx) > 26)) return fling(dx < 0 ? -1 : 1, v, dx, dy);
    el.style.transform = ''; ov('y', 0); ov('n', 0);
    el.style.setProperty('--sw', 0);           // la fiche revient au centre, la couleur s'efface
    if (!moved) toggleFlip();
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
}

/* La fiche sort dans la direction où on l'a lancée, et non sur une
   trajectoire décidée d'avance : c'est ce qui donne l'impression de
   l'avoir jetée soi-même. Appelée sans lancer — depuis un bouton — elle
   part à l'horizontale, comme avant. */
export function fling(dir, v, fx, fy) {
  const el = document.getElementById('top'); if (!el || el.dataset.gone) return;
  /* Pendant l'étape qui apprend le geste, seul le bon sens passe : partir
     du mauvais côté pendant qu'on lit « balaie à droite » embrouille plus
     qu'autre chose. */
  if (tour && tour.lock && dir !== tour.lock) {
    el.style.transition = ''; el.style.transform = '';
    el.style.setProperty('--sw', 0);
    return;
  }
  el.dataset.gone = 1; el.classList.add('gone');
  /* Partie au bouton plutôt qu'au doigt, la fiche n'a jamais été teintée :
     on l'allume au départ, sinon les deux façons de répondre ne donnent
     pas le même retour. */
  swipeTint(el, dir * 100);
  const vx = v ? v.vx : 0, vy = v ? v.vy : 0;
  const sp = Math.max(.5, Math.hypot(vx, vy));
  /* On garde la pente du lancer, mais on impose le côté : une fiche qui
     sortirait du mauvais bord contredirait la réponse qu'on vient de
     donner. Et un minimum d'horizontale l'empêche de partir tout droit
     vers le haut sur un geste presque vertical. */
  const ux = dir * Math.max(.6, Math.abs(vx) / sp);
  const uy = Math.max(-1.1, Math.min(1.1, vy / sp));
  const loin = 1500;
  el.style.transform = `translate3d(${(fx || 0) + ux * loin}px, ${(fy || 0) + uy * loin}px, 0)`
    + ` rotate(${dir * (18 + Math.min(16, sp * 9))}deg)`;
  el.style.opacity = 0;
  const g = pendingGrade; setPendingGrade(null);
  /* À droite je sais, à gauche à revoir : le sens des applications de
     cartes, et celui des deux pastilles qui apparaissent sous le doigt. */
  setTimeout(() => commit(g != null ? g > 0 : dir > 0, g), 250);
}

/* Mode simple : on ne planifie pas et on ne touche ni à n, ni à i, ni à d.
   La carte garde son état exact, seul le compteur de ratés avance —
   il sert au tri « ratées » et vaut dans les deux modes. */
function applyGrade(c, ok, r) {
  if (study.simple) { if (!ok) c.l = (c.l || 0) + 1; }
  else grade(c, r);
}

function scoreRow(id, d, r, ok, ms, rv) {
  return {
    client_id: uid(),                       // rejouable sans doublon
    user_id: auth.uid, deck_id: d ? d.id : null, card_id: id,
    mode: study.simple ? 'simple' : (study.mode || 'study'),
    rating: study.simple ? null : r, correct: !!ok, ms: Math.min(ms, 600000), reversed: !!rv
  };
}

function recordTried(id, ok) {
  if (!study.tried[id]) { study.tried[id] = 1; if (ok) study.ok++; study.log.push(ok ? 1 : 0); }
}

function recordMiss(id, ok, c, rv) {
  if (!ok && !study.missSet[id]) {
    study.missSet[id] = 1;
    study.miss.push({ id, q: rv ? c.b : c.f, a: rv ? c.f : c.b });
  }
}

/* Note une carte et l'inscrit au journal. Partagé par la révision, le QCM et
   l'association : un seul endroit décide de ce qui est écrit dans la carte. */
function scoreCard(id, ok, rating) {
  const r = rating != null ? rating : (ok ? 2 : 0);
  const [c, d] = findCard(id);
  if (!c) return [null, null, false];
  const rv = !isTF(c) && (study.dirs ? study.dirs[id] : study.rev);
  const ms = Date.now() - (study.tq || Date.now());
  study.tq = Date.now();
  applyGrade(c, ok, r);
  if (d) { dirty[d.id] = 1; save(); scheduleFlush(); }
  const row = scoreRow(id, d, r, ok, ms, rv);
  /* Sans paquet identifié, la ligne serait refusée par la base (deck_id
     est un uuid) : mieux vaut ne pas l'inscrire que boucher la file. */
  if (d) enqueue('/rest/v1/reviews', row);
  /* La ligne rejoint aussi le journal local : le Journal et le classement
     comptent la page à la seconde où elle est jouée, sans attendre le
     prochain aller-retour avec le serveur. */
  if (stats.rows) stats.rows.push(Object.assign({ created_at: new Date().toISOString() }, row));
  liveBump();
  bumpToday();
  /* Le son dit la note, pas le verdict : « Difficile » compte comme su
     pour le moteur, mais à l'oreille c'est une fiche qui a résisté. Les
     deux notes de gauche sonnent bas, les deux de droite sonnent haut. */
  beep(r >= 2);
  recordTried(id, ok);
  recordMiss(id, ok, c, rv);
  return [c, d, !!rv];
}

export const paintQ = () => { study.mode === 'mcq' ? paintMCQ() : (paintStack(), paintFoot()); };

export function commit(ok, rating) {
  const id = study.queue[study.i];
  const [card] = scoreCard(id, ok, rating);
  /* Une fiche quitte la séance quand elle est acquise, pas quand elle est
     juste juste. FSRS la fait passer par des paliers — une minute, dix
     minutes — avant de l'envoyer à des jours de distance : tant qu'elle
     est sur ces paliers, elle revient avant la fin de la séance. C'est la
     file d'apprentissage d'Anki, et c'est ce qui donne son sens aux
     paliers : sans ça, la fiche sortait de l'écran et revenait dix
     minutes plus tard sans qu'on s'y attende. */
  const learning = card && !study.simple && (card.st === 1 || card.st === 3);
  if (!ok || learning) study.again.push(id);
  study.i++; study.flip = false; study.pick = null; study.opts = null;
  saveResume();
  if (study.i >= study.queue.length) return studyView();
  paintQ();
  const p = document.getElementById('pg'); if (p) p.style.width = pct() + '%';
  const n = document.querySelector('.bar .num');
  if (n) n.textContent = `${study.i + 1}/${study.queue.length}`;
}
