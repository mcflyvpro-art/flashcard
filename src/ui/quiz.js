import { $ } from '../racine.js';
import { I, svg } from '../icones.js';
import { shuffle } from '../file.js';
import { parseText } from '../parseur.js';
import {
  aiBusy, asrOn, asrRec, comp, db, prefs, quiz, quizTick, setAiBusy, setAsrOn, setAsrRec,
  setComp, setQuiz, setQuizTick, view
} from '../data/etat.js';
import { go, pills, render } from './bibliotheque.js';
import { donnerLivre } from './bilan-devoirs.js';
import {
  ASRC, MAXB, MAXF, TTS, listen, markDups, markOver, plain, rt
} from './carte-media.js';
import { DEFMETA, deck, esc, live, metaOf, plur, pushHist, saveDeck, sty, subj, uid } from '../core/coeur-sync.js';
import { askPages } from './ecran-groupe.js';
import {
  AIERR, addDeck, aiCards, aiFromFile, toast
} from './import-cartes.js';
import { fillRing, isBool, review } from './revision.js';

/* ---------- quiz ---------- */
export const norm = s => String(s).trim().toLowerCase()
  .replace(/[’‘‛´`]/g, "'").replace(/\s+/g, ' ').replace(/[?!.…]+$/, '').trim();

/* --- validation avec marge d'erreur --- */
// mots outils et tirets neutralisés : « to be cool-headed » == « be cool headed »
const strip = s => norm(s).replace(/[-–—_]/g, ' ').replace(/\s+/g, ' ')
  .replace(/^(?:to|the|an?|le|la|les|l'|un|une|des|de)\s+/, '').trim();

function lev(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m || !n) return m || n;
  let prev = Array.from({ length: n + 1 }, (_, j) => j), cur = new Array(n + 1);
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    [prev, cur] = [cur, prev];
  }
  return prev[n];
}

// marge proportionnelle : un accent ou une lettre sur un mot, ~8 % sur une phrase
/* Marge d'erreur acceptée, réglable par paquet : stricte pour le droit où un
   mot près change le sens, souple pour du vocabulaire où l'accent oublié
   n'apprend rien. */
function near(x, y, tol) {
  const a = strip(x), b = strip(y);
  if (a === b) return true;
  if (!a || !b) return false;
  if (tol === 'strict') return norm(x) === norm(y);
  const L = Math.max(a.length, b.length);
  const allow = tol === 'soft'
    ? (L <= 4 ? 1 : L <= 9 ? 2 : Math.max(3, Math.round(L * 0.16)))
    : (L <= 4 ? 0 : L <= 9 ? 1 : Math.max(2, Math.round(L * 0.08)));
  return lev(a, b) <= allow;
}

const parts = s => norm(s).split(/\s*[,;/·|]+\s*/).map(x => x.trim()).filter(Boolean);

// accepte l'ordre libre d'une énumération, et un seul synonyme d'une liste courte
function accepts(typed, answers, tol) {
  for (const raw of answers) {
    const a = plain(raw);
    if (near(typed, a, tol)) return true;
    if (tol === 'strict') continue;
    const exp = parts(a), got = parts(typed);
    if (exp.length < 2) continue;
    if (got.length === exp.length) {
      const pool = exp.slice();
      let all = true;
      for (const g of got) {
        const k = pool.findIndex(e => near(g, e, tol));
        if (k < 0) { all = false; break; }
        pool.splice(k, 1);
      }
      if (all) return true;
    }
    const synonyms = exp.every(e => e.split(' ').length <= 3);
    if (synonyms && got.length && got.length < exp.length &&
        got.every(g => exp.some(e => near(g, e, tol)))) return true;
  }
  return false;
}

/* ---------- différence surlignée ----------
   « faux » n'apprend rien ; on montre la lettre qui cloche. Alignement par
   programmation dynamique sur la réponse attendue la plus proche. */
function diffHtml(typed, answers) {
  const t = norm(typed).slice(0, 200);
  let best = plain(answers[0]), bd = Infinity;
  for (const raw of answers) {
    const a = plain(raw), d = lev(t, norm(a));
    if (d < bd) { bd = d; best = a; }
  }
  const b = norm(best).slice(0, 200);
  const m = t.length, n = b.length;
  const D = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      D[i][j] = Math.min(D[i - 1][j] + 1, D[i][j - 1] + 1,
                         D[i - 1][j - 1] + (t[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  let i = m, j = n;
  const out = [];
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && D[i][j] === D[i - 1][j - 1] + (t[i - 1] === b[j - 1] ? 0 : 1)) {
      out.unshift(t[i - 1] === b[j - 1] ? esc(t[i - 1]) : `<i class="df">${esc(t[i - 1])}</i>`);
      i--; j--;
    } else if (i > 0 && D[i][j] === D[i - 1][j] + 1) {
      out.unshift(`<i class="df">${esc(t[i - 1])}</i>`); i--;
    } else {
      out.unshift('<i class="df gap"></i>'); j--;
    }
  }
  return out.join('');
}

/* Indice : on dévoile lettre à lettre la plus courte réponse attendue.
   Les espaces gardent leur vraie valeur (pas d'espace insécable) pour que
   la ligne puisse toujours se couper — sinon, dès que la partie masquée
   dépasse la largeur de l'écran, elle n'a plus aucun point de coupure et
   sort du cadre. Une définition très longue est en plus tronquée : un mur
   de points au-delà d'une certaine longueur n'aide plus personne. */
const HINT_MAX = 90;

function hintMask(q, n) {
  const full = q.a.map(plain).sort((x, y) => x.length - y.length)[0] || '';
  const cut = full.length > HINT_MAX ? full.slice(0, HINT_MAX) : full;
  const mask = [...cut].map((ch, k) => (k < n || /\s/.test(ch)) ? ch : '·').join('');
  return full.length > HINT_MAX ? mask + ' …' : mask;
}

function buildPool(cards) {
  const m = new Map();
  for (const c of cards) {
    if (!c.f || !c.b) continue;
    const k = norm(c.f);
    if (!m.has(k)) m.set(k, { f: c.f, a: [] });
    const e = m.get(k);
    if (!e.a.some(x => norm(x) === norm(c.b))) e.a.push(c.b);
  }
  return [...m.values()];
}

export function startQuiz(id, pool, rev, opt) {
  const o = opt || {};
  let src = id === 'all' ? live().flatMap(d => d.cards) : (deck(id) || { cards: [] }).cards;
  if (rev) src = src.map(c => ({ ...c, f: c.b, b: c.f, fi: c.bi, bi: c.fi, fa: c.ba, ba: c.fa }));
  const items = pool || shuffle(buildPool(src));
  if (!items.length) return;
  const m = id === 'all' ? DEFMETA : metaOf(deck(id));
  const seen = new Set(), answers = [];
  for (const it of items) {
    for (const a of it.a) {
      if (isBool(a)) continue;
      const k = norm(plain(a));
      if (k && !seen.has(k)) { seen.add(k); answers.push(a); }
    }
  }
  const mode = o.mode !== undefined ? o.mode : (quiz && quiz.id === id ? quiz.mode : '');
  setQuiz({ id, rev: !!rev, name: id === 'all' ? 'Tout' : (deck(id) || {}).name || '',
           sub: id === 'all' ? '' : (deck(id) || {}).subject,
           pool: items, answers, i: 0, ok: 0, bad: [], miss: [], log: [], forced: 0,
           t0: Date.now(), saved: false, state: 'ask', typed: '',
           mode: mode === 'qcm' && answers.length >= 2 ? 'qcm' : '',
           /* qlang lit la question, alang attend/écoute la réponse — la langue
              suit ce qui est vraiment affiché à chaque rôle, pas un côté fixe :
              si le quiz est inversé, question et réponse ont échangé de langue
              avec leur contenu. */
           tol: m.tol, qlang: rev ? m.langb : m.langf, alang: rev ? m.langf : m.langb, timer: m.timer,
           streak: 0, best: 0, hint: 0, hints: 0, opts: null, optsFor: -1 });
  if (o.at) {
    const k = quiz.pool.findIndex(q => norm(plain(q.f)) === o.at);
    if (k > 0) quiz.i = k;
  }
  go('run');
}

/* ---------- chrono par question ----------
   La barre se vide ; à zéro la question est perdue, comme à l'oral. */
/* Dictée : le navigateur transcrit, on garde la variante qui passe la
   correction, sinon la première. */
export function dictate() {
  if (asrOn) { try { asrRec && asrRec.stop(); } catch (e) {} return; }
  const q = quiz.pool[quiz.i];
  setAsrOn(true); render();
  setAsrRec(listen(quiz.alang, alts => {
    if (alts) {
      const best = alts.find(t => accepts(t, q.a, quiz.tol)) || alts[0];
      quiz.typed = best;
    }
    if (alts !== null && alts !== undefined) { setAsrOn(false); setAsrRec(null); render(); submit(); return; }
    setAsrOn(false); setAsrRec(null); render();
  }));
  if (!asrRec) { setAsrOn(false); toast(I.x, 'Dictée indisponible'); render(); }
}

export function stopTimer() { clearInterval(quizTick); setQuizTick(0); }

function armTimer() {
  stopTimer();
  if (!quiz || quiz.state !== 'ask' || !quiz.timer) return;
  const span = quiz.timer * 1000;
  quiz.tEnd = Date.now() + span;
  setQuizTick(setInterval(() => {
    if (!quiz || quiz.state !== 'ask') return stopTimer();
    const left = Math.max(0, quiz.tEnd - Date.now());
    const el = document.getElementById('tmr');
    if (el) {
      el.style.width = (left / span * 100) + '%';
      el.classList.toggle('low', left < span * 0.3);
    }
    if (left <= 0) { stopTimer(); if (quiz.state === 'ask') fail(); }
  }, 90));
}

function quizOpts(q) {
  if (quiz.optsFor === quiz.i && quiz.opts) return quiz.opts;
  const good = norm(plain(q.a[0]));
  const wrong = shuffle(quiz.answers.filter(x => norm(plain(x)) !== good)).slice(0, 3);
  quiz.opts = shuffle([q.a[0], ...wrong]);
  quiz.optsFor = quiz.i;
  return quiz.opts;
}

export function quizView() {
  const qcm = quiz.mode === 'qcm';
  const bar = n => `<div class="bar">
      <button class="ic" data-act="quitquiz" aria-label="Retour">${svg(I.back)}</button>
      <h1>${esc(quiz.name)}</h1>
      ${n}
      ${quiz.streak >= 5 ? `<span class="strk">${svg(I.flame)}${quiz.streak}</span>` : ''}
      <button class="ic ${quiz.rev ? 'solid' : ''}" data-act="swapq">${svg(I.swap)}</button>
      <button class="ic" data-act="requiz" aria-label="Relancer">${svg(I.shuffle)}</button>
    </div>`;
  if (quiz.i >= quiz.pool.length) {
    stopTimer();
    const n = quiz.pool.length;
    if (!quiz.saved) { quiz.saved = true; quiz.ms = Date.now() - quiz.t0;
      quiz.hist = pushHist(quiz.id, 'quiz', n ? quiz.ok / n : 0); }
    $.innerHTML = bar('') + review({
      ok: quiz.ok, total: n, log: quiz.log, ms: quiz.ms, hist: quiz.hist, forced: quiz.forced,
      hints: quiz.hints,
      miss: quiz.miss, redo: 'redo', again: 'requiz', done: 'quitquiz'
    });
    return fillRing(quiz.ok, n);
  }
  const q = quiz.pool[quiz.i];
  const ask = quiz.state === 'ask';
  const canSay = quiz.qlang && TTS && plain(q.f);
  $.innerHTML = bar(`<span class="num">${quiz.i + 1}/${quiz.pool.length}</span>`)
    + `<div class="study">
      <div class="prog"><i id="pg" style="width:0%"></i></div>
      ${quiz.timer ? `<div class="tbar"><i id="tmr" style="width:100%"></i></div>` : ''}
      <div class="qz">
        <div class="ask ${quiz.state}">${rt(q.f)}
          ${canSay ? `<button class="snd sm" data-qsay>${svg(I.sound)}</button>` : ''}</div>
        ${ask && quiz.hint ? `<div class="hmask">${esc(hintMask(q, quiz.hint))}</div>` : ''}
        ${quiz.state === 'bad' ? `<div class="sol">${svg(I.check)}${q.a.map(rt).join('  ·  ')}</div>` : ''}
      </div>
      ${qcm
        ? `<div class="opts qopts">${quizOpts(q).map((o, k) => {
            const right = norm(plain(o)) === norm(plain(q.a[0]));
            const cl = ask ? '' : right ? ' ok' : (quiz.pickd === k ? ' ko' : ' dim');
            return `<button class="op${cl}" data-qp="${k}">${rt(o)}</button>`;
          }).join('')}</div>`
        : `<div class="arow">
            <input id="ans" class="ans ${quiz.state}" value="${esc(quiz.typed)}" placeholder="Réponse"
              autocapitalize="none" autocorrect="off" autocomplete="off" spellcheck="false"
              enterkeyhint="go" ${ask ? '' : 'readonly'}>
            ${ASRC && ask ? `<button class="ai mic ${asrOn ? 'busy' : ''}" data-act="asr">${svg(I.mic)}</button>` : ''}
          </div>`}
      ${quiz.state === 'bad'
        ? `<div class="duo" style="margin:11px 0 0">
            <button data-act="anyway">${svg(I.check)}Compter juste</button>
            <button class="prim" data-act="next">Suivant${svg(I.arrow)}</button>
          </div>`
        : ask
        ? `<div class="qrow">
            ${qcm ? '' : `<button class="qb" data-act="hint" title="Indice">${svg(I.bulb)}</button>
            <button class="qb" data-act="idk" title="Je ne sais pas">${svg(I.skip)}</button>`}
            ${quiz.answers.length >= 2
              ? `<button class="qb ${qcm ? 'on' : ''}" data-act="qcm2" title="Choix multiples">${svg(I.grid)}</button>`
              : ''}
            ${qcm ? '<div style="flex:1"></div>'
                  : `<button class="cta" data-act="send">Valider${svg(I.arrow)}</button>`}
          </div>`
        : `<button class="cta" style="margin-top:11px" data-act="next">Suivant${svg(I.arrow)}</button>`}
    </div>`;
  requestAnimationFrame(() => {
    const p = document.getElementById('pg');
    if (p) p.style.width = Math.round(quiz.i / quiz.pool.length * 100) + '%';
  });
  const inp = document.getElementById('ans');
  if (inp) {
    inp.addEventListener('input', () => quiz.typed = inp.value);
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); ask ? submit() : nextQ(); }
    });
    if (ask && !asrOn) setTimeout(() => inp.focus(), 40);
  }
  armTimer();
}

function win() {
  quiz.ok++; quiz.log.push(1);
  quiz.streak++; quiz.best = Math.max(quiz.best, quiz.streak);
  quiz.state = 'good'; stopTimer(); render();
  /* Par défaut on s'arrête sur la bonne réponse : c'est le moment où on la
     lit vraiment. Le mode rapide enchaîne à la place. */
  if (prefs.fast) setTimeout(() => { if (quiz && quiz.state === 'good') nextQ(); }, 560);
}

export function fail() {
  const q = quiz.pool[quiz.i];
  const typed = quiz.typed.trim();
  quiz.bad.push(q); quiz.log.push(0); quiz.streak = 0;
  quiz.miss.push({ q: q.f, a: q.a.join('  ·  '), typed,
                   diff: typed ? diffHtml(typed, q.a) : '' });
  quiz.state = 'bad'; stopTimer(); render();
}

export function submit() {
  if (quiz.state !== 'ask' || !quiz.typed.trim()) return;
  accepts(quiz.typed, quiz.pool[quiz.i].a, quiz.tol) ? win() : fail();
}

export function pickQuiz(k) {
  if (quiz.state !== 'ask') return;
  const q = quiz.pool[quiz.i];
  quiz.pickd = k;
  quiz.typed = quiz.opts[k];
  norm(plain(quiz.opts[k])) === norm(plain(q.a[0])) ? win() : fail();
}

export function nextQ() {
  stopTimer();
  quiz.i++; quiz.state = 'ask'; quiz.typed = '';
  quiz.hint = 0; quiz.pickd = null; quiz.opts = null; quiz.optsFor = -1;
  render();
}

/* ---------- création / import ---------- */
export const resetComp = extra => { setComp({ subject: '', cards: [], edit: -1, bulk: false,
  text: '', dups: false, ...(extra || {}) }); };

export function importView() {
  const t = view.id ? deck(view.id) : null;
  const s = subj(t ? t.subject : comp.subject);
  $.innerHTML = `
    <div class="bar">
      <button class="ic" data-act="${t ? 'deck' : comp.pour === 'devoir' ? 'prof' : 'home'}"
        aria-label="Retour">${svg(I.back)}</button>
      <h1>${t ? esc(t.name) : comp.pour === 'devoir' ? 'Nouveau devoir' : 'Nouveau livre'}</h1>
      <button class="ic ${comp.bulk ? 'solid' : ''}" data-act="bulk">${svg(I.down)}</button>
    </div>
    <div class="sheet ${comp.bulk ? 'sh-bulk' : 'sh-comp'}">
      ${t ? '' : `<div class="field"><input id="nm" placeholder="${
        comp.pour === 'devoir' ? 'Titre du devoir' : 'Titre du livre'}" spellcheck="false"
        enterkeyhint="next" value="${esc(comp.name || '')}"></div>
        ${pills(comp.subject, db.subjects.map(x => subj(x.id)), 'nsubj')}`}
      ${comp.bulk ? `
        <div class="ta"><textarea id="tx" placeholder="chat = gatto&#10;chien = cane&#10;maison = casa"
          autocapitalize="off" autocorrect="off" spellcheck="false">${esc(comp.text)}</textarea></div>
        <div class="airow">
          <button class="ai" id="aishot" title="Photo d'une ou plusieurs pages de cours, prises ou depuis la galerie">${svg(I.image)}</button>
          <button class="ai" id="aipdf" title="Fichier : PDF, texte, CSV, export Anki ou Quizlet">${svg(I.file)}</button>
          <button class="ai" id="aigen" title="Fabriquer les pages">${svg(I.spark)}</button>
          <button class="cta" id="bulkadd" disabled>Ajouter${svg(I.plus)}</button>
        </div>
        <!-- Sans « capture », le sélecteur propose l'appareil photo ET la
             galerie (Photos sur iPhone, Galerie/Fichiers sur Android),
             et « multiple » permet d'en choisir plusieurs d'un coup. Avec
             « capture », les deux systèmes sautaient tout droit à
             l'appareil photo, sans jamais montrer la pellicule. -->
        <input type="file" id="fshot" accept="image/*" multiple hidden>
        <input type="file" id="fpdf" accept=".pdf,.txt,.csv,.tsv,.apkg,application/pdf,text/plain,text/csv" hidden>
        <div class="prev" id="prev"></div>`
      : `
        <div class="comp" id="comp" style="${sty(s)}">
          <input id="cf" class="cf" placeholder="Recto" enterkeyhint="next" spellcheck="false">
          <div class="csep"></div>
          <input id="cb" class="cb" placeholder="Verso" enterkeyhint="done" spellcheck="false">
          <button class="cadd" id="cadd">${svg(comp.edit >= 0 ? I.check : I.plus)}</button>
        </div>
        <div class="lbl"><span>Pages</span><span id="cn">${comp.cards.length}</span></div>
        <div class="dlist" id="dlist"></div>`}
      ${comp.bulk ? '' : `<button class="cta" id="ok" ${comp.cards.length ? '' : 'disabled'}>
        ${t ? 'Ajouter' : comp.pour === 'devoir' ? 'Continuer' : 'Créer'}${svg(I.check)}</button>`}
    </div>`;

  const nm = document.getElementById('nm');
  if (nm) nm.addEventListener('input', () => comp.name = nm.value);

  if (comp.bulk) {
    const tx = document.getElementById('tx'), prev = document.getElementById('prev'),
          add = document.getElementById('bulkadd'), gen = document.getElementById('aigen');
    const up = () => {
      comp.text = tx.value;
      const cards = parseText(tx.value);
      const dup = markDups(cards, t);
      const big = markOver(cards);
      const keep = (comp.dups ? cards.length : cards.length - dup.total) - big;
      add.disabled = !keep;
      gen.disabled = aiBusy || tx.value.trim().length < 40;
      add.firstChild.textContent = keep ? `Ajouter ${keep} ` : 'Ajouter';
      prev.innerHTML = (big ? `<div class="dupb warn">
          <span>${big} carte${big > 1 ? 's' : ''} trop longue${big > 1 ? 's' : ''} — recto ${MAXF}
            caractères, verso ${MAXB}</span>
          <button class="dupt" disabled>Écartée${big > 1 ? 's' : ''}</button>
        </div>` : '')
        + (dup.total ? `<div class="dupb">
          <span>${dup.total} doublon${dup.total > 1 ? 's' : ''}${
            dup.already ? ` · ${dup.already} déjà dans le paquet` : ''}${
            dup.inside ? ` · ${dup.inside} en double dans le texte` : ''}</span>
          <button class="dupt ${comp.dups ? 'on' : ''}" id="dupt">${
            comp.dups ? 'Les ajouter quand même' : 'Ignorés'}</button>
        </div>` : '')
        + cards.slice(0, 40).map(c => `<div class="pr ${(c.dup && !comp.dups) || c.big ? 'dup' : ''}">
          <span class="a">${esc(c.f.slice(0, 120))}</span>${svg(I.arrow)}<span class="b">${esc(c.b.slice(0, 120))}</span>
          ${c.big ? `<i class="dpi" title="${c.big === 'f' ? 'Recto' : 'Verso'} trop long">${svg(I.warn)}</i>`
            : c.dup ? `<i class="dpi" title="${c.dup === 'deck' ? 'Déjà dans le livre' : 'En double dans le texte'}">${svg(I.copy)}</i>` : ''}
        </div>`).join('');
      const dt = document.getElementById('dupt');
      if (dt) dt.onclick = () => { comp.dups = !comp.dups; up(); };
    };
    const fit = () => { tx.style.height = 'auto'; tx.style.height = Math.min(tx.scrollHeight + 2, innerHeight * .3) + 'px'; };
    tx.addEventListener('input', () => { fit(); up(); }); fit(); up();
    setTimeout(() => tx.focus(), 60);
    /* Colle un cours, un tableau de vocabulaire, une liste : le texte revient
       découpé en cartes, éditable avant l'ajout. */
    gen.onclick = async () => {
      if (aiBusy || gen.disabled) return;
      setAiBusy(true); gen.classList.add('busy'); gen.disabled = true;
      try {
        const cards = await aiCards(tx.value, t ? t.name : comp.name);
        if (!cards.length) throw new Error('empty');
        tx.value = cards.map(c => c.f + '\t' + c.b).join('\n');
        fit(); up(); toast(I.spark, plur(cards.length, 'page'));
      } catch (x) {
        toast(I.x, AIERR[String(x.message)] || 'IA indisponible');
      }
      setAiBusy(false); gen.classList.remove('busy'); up();
    };
    /* Photo et PDF passent par la même passerelle : ils reviennent sous
       forme de texte tabulé dans la zone, donc tout ce qui suit — aperçu,
       doublons, correction à la main — fonctionne à l'identique. */
    const shot = document.getElementById('aishot'), pdf = document.getElementById('aipdf');
    const fshot = document.getElementById('fshot'), fpdf = document.getElementById('fpdf');
    const grab = async (btn, file, pages) => {
      if (aiBusy || !file) return;
      setAiBusy(true); btn.classList.add('busy'); [shot, pdf, gen].forEach(x => x.disabled = true);
      try {
        const cards = await aiFromFile(file, t ? t.name : comp.name, pages);
        if (!cards.length) throw new Error('empty');
        const had = tx.value.trim();
        tx.value = (had ? had + '\n' : '') + cards.map(c => c.f + '\t' + c.b).join('\n');
        fit(); up(); toast(I.spark, plur(cards.length, 'page'));
      } catch (x) {
        toast(I.x, AIERR[String(x.message)] || 'IA indisponible');
      }
      setAiBusy(false); btn.classList.remove('busy');
      [shot, pdf].forEach(x => x.disabled = false); up();
    };
    /* La galerie peut rendre plusieurs photos d'un coup : chacune passe
       par la passerelle l'une après l'autre, et leurs pages s'ajoutent
       toutes au même texte — choisir dix photos revient à les prendre
       une par une, en une seule fois. */
    const grabShots = async files => {
      if (aiBusy || !files.length) return;
      setAiBusy(true); shot.classList.add('busy'); [shot, pdf, gen].forEach(x => x.disabled = true);
      let total = 0, fail = 0, lastMsg = '';
      for (const file of files) {
        try {
          const cards = await aiFromFile(file, t ? t.name : comp.name);
          if (!cards.length) throw new Error('empty');
          const had = tx.value.trim();
          tx.value = (had ? had + '\n' : '') + cards.map(c => c.f + '\t' + c.b).join('\n');
          total += cards.length;
        } catch (x) {
          fail++; lastMsg = AIERR[String(x.message)] || 'IA indisponible';
        }
      }
      fit(); up();
      if (total) toast(I.spark, plur(total, 'page') + (fail ? ` · ${fail} photo${fail > 1 ? 's' : ''} en échec` : ''));
      else toast(I.x, lastMsg);
      setAiBusy(false); shot.classList.remove('busy'); [shot, pdf].forEach(x => x.disabled = false);
    };
    shot.onclick = () => { if (!aiBusy) fshot.click(); };
    pdf.onclick = () => { if (!aiBusy) fpdf.click(); };
    fshot.onchange = () => { const files = [...fshot.files]; fshot.value = ''; grabShots(files); };
    /* Un fichier texte (export « notes en texte brut » d'Anki, export
       Quizlet, CSV d'un tableur) se lit ici même : pas de réseau, pas
       d'IA, pas d'attente — l'analyseur reconnaît le séparateur seul.
       Seul le PDF a besoin de la passerelle. */
    fpdf.onchange = async () => {
      const f = fpdf.files[0]; fpdf.value = '';
      if (!f) return;
      const nm = f.name.toLowerCase();
      if (nm.endsWith('.apkg')) return toast(I.x, 'Exporte en texte depuis Anki');
      if (f.type === 'application/pdf' || nm.endsWith('.pdf'))
        return askPages(p => grab(pdf, f, p));
      let txt = '';
      try { txt = await f.text(); } catch (x) { return toast(I.x, 'Fichier illisible'); }
      const found = parseText(txt);
      if (!found.length) return toast(I.x, 'Aucune carte reconnue');
      const had = tx.value.trim();
      tx.value = (had ? had + '\n' : '') + found.map(c => c.f + '\t' + c.b).join('\n');
      fit(); up(); toast(I.check, plur(found.length, 'page'));
    };
    add.onclick = () => {
      let cards = parseText(tx.value); if (!cards.length) return;
      const dup = markDups(cards, t);
      const big = markOver(cards);
      if (!comp.dups) cards = cards.filter(c => !c.dup);
      cards = cards.filter(c => !c.big);
      cards = cards.map(c => ({ f: c.f, b: c.b }));
      if (!cards.length) return;
      comp.cards.push(...cards); comp.text = ''; comp.bulk = false;
      render();
      toast(I.check, plur(cards.length, 'page')
        + (!comp.dups && dup.total ? ` · ${dup.total} doublon${dup.total > 1 ? 's' : ''} écarté${dup.total > 1 ? 's' : ''}` : '')
        + (big ? ` · ${big} trop longue${big > 1 ? 's' : ''}` : ''));
    };
    return;
  }

  const cf = document.getElementById('cf'), cb = document.getElementById('cb');
  if (comp.edit >= 0) { cf.value = comp.cards[comp.edit].f; cb.value = comp.cards[comp.edit].b; }
  paintDraft();
  setTimeout(() => (comp.cards.length || comp.edit >= 0 ? cf : (nm || cf)).focus(), 60);

  const addCard = () => {
    const f = cf.value.trim(), b = cb.value.trim();
    if (!f && !b) return;
    if (comp.edit >= 0) { comp.cards[comp.edit] = { f, b }; comp.edit = -1; }
    else comp.cards.push({ f, b });
    cf.value = ''; cb.value = ''; cf.focus();
    document.getElementById('cadd').innerHTML = svg(I.plus);
    paintDraft();
  };
  cf.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); cb.focus(); } });
  cb.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addCard(); } });
  document.getElementById('cadd').onclick = addCard;

  document.getElementById('ok').onclick = () => {
    if (!comp.cards.length) return;
    const cards = comp.cards.slice();
    const pour = comp.pour;
    if (t) {
      t.cards.push(...cards.map(c => ({ ...c, id: uid() })));
      saveDeck(t); resetComp(); go('deck', t.id);
    } else {
      const d = addDeck(comp.name, cards, comp.subject);
      if (comp.cours) { d.cours = true; saveDeck(d); }
      resetComp();
      /* Un livre composé pour une classe enchaîne directement sur « à qui,
         et pour quand » : c'est le même geste, il n'a pas à le rouvrir. */
      if (pour === 'devoir') { donnerLivre(d); return; }
      go('deck', d.id);
    }
    toast(I.check, plur(cards.length, 'page'));
  };
}

function paintDraft() {
  const l = document.getElementById('dlist'); if (!l) return;
  l.innerHTML = comp.cards.map((c, i) => `<div class="dc ${i === comp.edit ? 'on' : ''}" data-ed="${i}">
      <div class="tx"><b>${esc(c.f) || '—'}</b><span>${esc(c.b) || '—'}</span></div>
      <button class="x" data-dl="${i}">${svg(I.x)}</button>
    </div>`).reverse().join('');
  const n = document.getElementById('cn'); if (n) n.textContent = comp.cards.length;
  const ok = document.getElementById('ok'); if (ok) ok.disabled = !comp.cards.length;
}
