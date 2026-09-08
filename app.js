/* Cartes — flashcards + quiz, PWA sans dépendance, tout en local */
const KEY = 'cartes.v1';
const PAL = ['--p1', '--p2', '--p3', '--p4', '--p5', '--p6', '--p7', '--p8'];
const $ = document.getElementById('app');

/* ---------- state ---------- */
let db = load();
let view = { name: 'home' };
let study = null;
let quiz = null;

function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && Array.isArray(d.decks)) return d;
  } catch (e) {}
  return { decks: [] };
}
function save() { localStorage.setItem(KEY, JSON.stringify(db)); }
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
const deck = id => db.decks.find(d => d.id === id);
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0;[a[i], a[j]] = [a[j], a[i]]; } return a; };

/* ---------- icons ---------- */
const I = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  play: '<path d="M7 4.5l12 7.5-12 7.5z" fill="currentColor" stroke-linejoin="round"/>',
  trash: '<path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M4 13l5 5L20 6"/>',
  down: '<path d="M12 4v12m0 0l-5-5m5 5l5-5M4 20h16"/>',
  share: '<path d="M12 3v13M12 3L7 8m5-5l5 5M5 14v6h14v-6"/>',
  again: '<path d="M4 12a8 8 0 1 1 2.3 5.6M4 12V6m0 6h6"/>',
  tap: '<path d="M9 11V6a2 2 0 1 1 4 0v6M13 12v-1a2 2 0 1 1 4 0v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-4.6-3L5 20"/>',
  stack: '<path d="M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 17.5l9 5 9-5"/>',
  shuffle: '<path d="M3 6h4l10 12h4M3 18h4l3-3.6M21 18l-3-3M21 6l-3 3M14.5 8.6L17 6h4"/>',
  pen: '<path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3z"/>',
  arrow: '<path d="M5 12h13m0 0l-5-5m5 5l-5 5"/>'
};
const svg = p => `<svg viewBox="0 0 24 24">${p}</svg>`;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- base64url <-> unicode ---------- */
function enc(obj) {
  const b = new TextEncoder().encode(JSON.stringify(obj));
  let s = ''; b.forEach(c => s += String.fromCharCode(c));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function dec(str) {
  const s = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
  return JSON.parse(new TextDecoder().decode(b));
}

/* ---------- parsing texte brut ---------- */
const SEPS = [/\s*\t+\s*/, /\s*::\s*/, /\s*=>?\s*/, /\s*\|\s*/, /\s+[–—]\s+/, /\s+-\s+/, /\s*:\s*/, /\s*;\s*/, /\s*,\s*/];
function parseText(txt) {
  const t = txt.trim();
  if (!t) return [];
  if (t[0] === '{' || t[0] === '[') {
    try {
      const j = JSON.parse(t);
      const arr = Array.isArray(j) ? j : (j.cards || []);
      const out = arr.map(c => Array.isArray(c)
        ? { f: String(c[0] || '').trim(), b: String(c[1] || '').trim() }
        : { f: String(c.f ?? c.front ?? c.q ?? '').trim(), b: String(c.b ?? c.back ?? c.a ?? '').trim() })
        .filter(c => c.f);
      if (out.length) return out;
    } catch (e) {}
  }
  const out = [];
  for (let line of t.split(/\r?\n/)) {
    line = line.replace(/^\s*(?:[-*•·–—]|\d+[.)])\s+/, '').trim();
    if (!line) continue;
    for (const s of SEPS) {
      const m = line.split(s);
      if (m.length >= 2 && m[0].trim() && m.slice(1).join(' ').trim()) {
        out.push({ f: m[0].trim(), b: m.slice(1).join(' ').trim() });
        break;
      }
    }
  }
  return out;
}

/* ---------- decks ---------- */
function addDeck(name, cards, color) {
  const d = {
    id: uid(),
    name: (name || '').trim() || 'Deck',
    color: color ?? db.decks.length % PAL.length,
    cards: cards.map(c => ({ id: uid(), f: c.f, b: c.b }))
  };
  db.decks.unshift(d); save(); return d;
}
function importPayload(p) {
  if (!p) return null;
  let last = null;
  for (const k of (Array.isArray(p) ? p : [p])) {
    const cards = (k.cards || []).map(c => Array.isArray(c) ? { f: c[0], b: c[1] } : c).filter(c => c && c.f);
    if (!cards.length) continue;
    const ex = k.key && db.decks.find(d => d.key === k.key);
    if (ex) { ex.name = k.name || ex.name; ex.cards = cards.map(c => ({ id: uid(), f: c.f, b: c.b })); last = ex; }
    else { last = addDeck(k.name, cards, k.color); last.key = k.key; }
  }
  save(); return last;
}
async function syncRepo() {
  try {
    const r = await fetch('decks/index.json', { cache: 'no-store' });
    if (!r.ok) return;
    let changed = false;
    for (const it of await r.json()) {
      const cur = db.decks.find(d => d.key === it.key);
      if (cur && cur.rev === it.rev) continue;
      const dr = await fetch('decks/' + it.file, { cache: 'no-store' });
      if (!dr.ok) continue;
      const pack = await dr.json();
      const cards = (pack.cards || []).map(c => Array.isArray(c) ? { f: c[0], b: c[1] } : c).filter(c => c && c.f);
      if (!cards.length) continue;
      if (cur) { cur.name = pack.name || cur.name; cur.cards = cards.map(c => ({ id: uid(), f: c.f, b: c.b })); cur.rev = it.rev; }
      else { const nd = addDeck(pack.name || it.key, cards, pack.color); nd.key = it.key; nd.rev = it.rev; }
      changed = true;
    }
    if (changed) { save(); render(); }
  } catch (e) {}
}

/* ---------- toast ---------- */
let tt;
function toast(txt) {
  clearTimeout(tt);
  document.querySelectorAll('.toast').forEach(n => n.remove());
  const n = document.createElement('div'); n.className = 'toast'; n.textContent = txt;
  document.body.appendChild(n); tt = setTimeout(() => n.remove(), 1400);
}

/* ---------- rendu ---------- */
function render() {
  const v = view.name;
  if (v === 'home') return home();
  if (v === 'deck') return deckView();
  if (v === 'study') return studyView();
  if (v === 'import') return importView();
  if (v === 'quiz') return quizHome();
  if (v === 'run') return quizView();
}
const nav = on => `<div class="nav">
  <button class="${on === 'home' ? 'on' : ''}" data-act="tab-home">${svg(I.stack)}</button>
  <button class="${on === 'quiz' ? 'on' : ''}" data-act="tab-quiz">${svg(I.pen)}</button>
</div>`;

function home() {
  $.innerHTML = `
    <div class="bar"><h1>Cartes</h1>
      <button class="ic" data-act="paste">${svg(I.down)}</button>
    </div>
    ${db.decks.length ? `<div class="grid">${db.decks.map(d => `
      <button class="deck" data-go="${d.id}" style="background:var(${PAL[d.color % PAL.length]})">
        ${d.key ? '<i class="dot"></i>' : ''}
        <span class="n">${esc(d.name)}</span>
        <span class="c">${d.cards.length}</span>
      </button>`).join('')}</div>` : `<div class="empty">${svg(I.stack)}</div>`}
    <button class="fab" data-act="new">${svg(I.plus)}</button>
    ${nav('home')}`;
}

function deckView() {
  const d = deck(view.id); if (!d) return go('home');
  $.innerHTML = `
    <div class="bar sub">
      <button class="ic" data-act="home">${svg(I.back)}</button>
      <h1 contenteditable="plaintext-only" id="dn" spellcheck="false">${esc(d.name)}</h1>
      <button class="ic" data-act="share">${svg(I.share)}</button>
      <button class="ic" data-act="del">${svg(I.trash)}</button>
      <button class="ic solid" data-act="study">${svg(I.play)}</button>
    </div>
    <div class="rows">
      ${d.cards.map(c => `
        <div class="row" data-id="${c.id}">
          <div class="f">
            <input value="${esc(c.f)}" data-k="f" placeholder="•">
            <input class="b" value="${esc(c.b)}" data-k="b" placeholder="•">
          </div>
          <button class="x" data-rm="${c.id}">${svg(I.x)}</button>
        </div>`).join('')}
      <div class="sw" style="margin-top:4px">
        <button data-act="add">${svg(I.plus)}</button>
        <button data-act="paste">${svg(I.down)}</button>
      </div>
    </div>`;
  const t = document.getElementById('dn');
  t.addEventListener('blur', () => { d.name = t.textContent.trim() || 'Deck'; save(); });
  $.querySelectorAll('.row input').forEach(inp => {
    inp.addEventListener('input', () => {
      const c = d.cards.find(x => x.id === inp.closest('.row').dataset.id);
      if (c) { c[inp.dataset.k] = inp.value; save(); }
    });
  });
}

/* ---------- étude ---------- */
function startStudy(id) {
  const d = deck(id); if (!d || !d.cards.length) return;
  study = { id, queue: shuffle(d.cards.map(c => c.id)), i: 0, again: [], flip: false, ok: 0, total: d.cards.length };
  view = { name: 'study', id }; render();
}
function studyView() {
  const d = deck(study.id); if (!d) return go('home');
  const bar = `<div class="bar sub">
      <button class="ic" data-act="deck">${svg(I.back)}</button>
      <h1>${esc(d.name)}</h1>
      <button class="ic" data-act="restart">${svg(I.shuffle)}</button>
    </div>`;
  if (study.i >= study.queue.length) {
    if (study.again.length) { study.queue = study.again; study.again = []; study.i = 0; study.flip = false; }
    else {
      $.innerHTML = bar + `<div class="done">
        <div class="big">🎉</div>
        <div class="sc">${study.ok}/${study.total}</div>
        <div class="b">
          <button data-act="restart" style="background:var(--p5)">${svg(I.again)}</button>
          <button data-act="deck" style="background:var(--p4)">${svg(I.check)}</button>
        </div></div>`;
      return;
    }
  }
  const c = d.cards.find(x => x.id === study.queue[study.i]) || { f: '', b: '' };
  const col = PAL[d.color % PAL.length], col2 = PAL[(d.color + 4) % PAL.length];
  const pct = study.total ? Math.round(study.ok / study.total * 100) : 0;
  $.innerHTML = bar + `
    <div class="study">
      <div class="prog"><i style="width:${pct}%"></i></div>
      <div class="stage">
        <div class="card ${study.flip ? 'flip' : ''}" id="card">
          <div class="face" style="background:var(${col})"><span>${esc(c.f)}</span></div>
          <div class="face back" style="background:var(${col2})"><span>${esc(c.b)}</span></div>
        </div>
      </div>
      ${study.flip ? `<div class="acts">
          <button class="act no" data-a="no">${svg(I.x)}</button>
          <button class="act yes" data-a="yes">${svg(I.check)}</button>
        </div>` : `<div class="hint">${svg(I.tap)}</div>`}
    </div>`;
  document.getElementById('card').onclick = () => { study.flip = !study.flip; render(); };
}
function answer(ok) {
  if (ok) study.ok++; else study.again.push(study.queue[study.i]);
  study.i++; study.flip = false; render();
}

/* ---------- quiz : français -> italien, écrit ---------- */
const norm = s => String(s).trim().toLowerCase()
  .replace(/[’‘‛´`]/g, "'").replace(/\s+/g, ' ')
  .replace(/[?!.…]+$/, '').trim();

function buildPool(cards) {
  const map = new Map();
  for (const c of cards) {
    if (!c.f || !c.b) continue;
    const k = norm(c.f);
    if (!map.has(k)) map.set(k, { f: c.f, a: [] });
    const e = map.get(k);
    if (!e.a.some(x => norm(x) === norm(c.b))) e.a.push(c.b);
  }
  return [...map.values()];
}
function startQuiz(id, pool) {
  const src = pool || (id === 'all' ? db.decks.flatMap(d => d.cards) : (deck(id) || { cards: [] }).cards);
  const items = pool || shuffle(buildPool(src));
  if (!items.length) return;
  quiz = {
    id, name: id === 'all' ? 'Tout' : (deck(id) || {}).name || '',
    pool: items, i: 0, ok: 0, bad: [], state: 'ask', typed: ''
  };
  view = { name: 'run' }; render();
}
function quizHome() {
  const total = buildPool(db.decks.flatMap(d => d.cards)).length;
  $.innerHTML = `
    <div class="bar"><h1>Quiz</h1></div>
    ${db.decks.length ? `<div class="grid">
      <button class="deck all" data-q="all"><span class="n">Tout</span><span class="c">${total}</span></button>
      ${db.decks.map(d => `
        <button class="deck" data-q="${d.id}" style="background:var(${PAL[d.color % PAL.length]})">
          <span class="n">${esc(d.name)}</span>
          <span class="c">${buildPool(d.cards).length}</span>
        </button>`).join('')}
    </div>` : `<div class="empty">${svg(I.pen)}</div>`}
    ${nav('quiz')}`;
}
function quizView() {
  const bar = `<div class="bar sub">
      <button class="ic" data-act="tab-quiz">${svg(I.back)}</button>
      <h1>${esc(quiz.name)}</h1>
      <button class="ic" data-act="requiz">${svg(I.shuffle)}</button>
    </div>`;
  if (quiz.i >= quiz.pool.length) {
    $.innerHTML = bar + `<div class="done">
      <div class="big">${quiz.bad.length ? '💪' : '🎉'}</div>
      <div class="sc">${quiz.ok}/${quiz.pool.length}</div>
      <div class="b">
        ${quiz.bad.length ? `<button data-act="redo" style="background:var(--p1)">${svg(I.again)}</button>` : ''}
        <button data-act="requiz" style="background:var(--p5)">${svg(I.shuffle)}</button>
        <button data-act="tab-quiz" style="background:var(--p4)">${svg(I.check)}</button>
      </div></div>`;
    return;
  }
  const q = quiz.pool[quiz.i];
  const pct = Math.round(quiz.i / quiz.pool.length * 100);
  $.innerHTML = bar + `
    <div class="study">
      <div class="prog"><i style="width:${pct}%"></i></div>
      <div class="qz">
        <div class="ask ${quiz.state}">${esc(q.f)}</div>
        ${quiz.state === 'bad' ? `<div class="sol"><b>${q.a.map(esc).join(' / ')}</b></div>` : ''}
      </div>
      <input id="ans" class="ans ${quiz.state}" value="${esc(quiz.typed)}" placeholder="…"
        autocapitalize="none" autocorrect="off" autocomplete="off" spellcheck="false"
        enterkeyhint="go" ${quiz.state === 'ask' ? '' : 'readonly'}>
      <button class="big-btn" data-act="${quiz.state === 'ask' ? 'send' : 'next'}">
        ${svg(quiz.state === 'ask' ? I.arrow : I.arrow)}
      </button>
    </div>`;
  const inp = document.getElementById('ans');
  inp.addEventListener('input', () => quiz.typed = inp.value);
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); quiz.state === 'ask' ? submit() : nextQ(); } });
  if (quiz.state === 'ask') setTimeout(() => inp.focus(), 30);
}
function submit() {
  if (quiz.state !== 'ask') return;
  const q = quiz.pool[quiz.i];
  if (!quiz.typed.trim()) return;
  if (q.a.some(a => norm(a) === norm(quiz.typed))) {
    quiz.ok++; quiz.state = 'good'; render();
    setTimeout(() => { if (quiz && quiz.state === 'good') nextQ(); }, 520);
  } else {
    quiz.bad.push(q); quiz.state = 'bad'; render();
  }
}
function nextQ() { quiz.i++; quiz.state = 'ask'; quiz.typed = ''; render(); }

/* ---------- import ---------- */
function importView() {
  const target = view.id ? deck(view.id) : null;
  $.innerHTML = `
    <div class="bar sub">
      <button class="ic" data-act="${target ? 'deck' : 'home'}">${svg(I.back)}</button>
      <h1>${target ? esc(target.name) : ''}</h1>
    </div>
    <div class="sheet">
      ${target ? '' : `<input class="name" id="nm" placeholder="…" spellcheck="false">`}
      <textarea id="tx" placeholder="chat = gatto&#10;chien = cane" autocapitalize="off" spellcheck="false"></textarea>
      <div class="chips"><span class="chip on" id="cnt">0</span></div>
      <button class="big-btn" id="ok" disabled>${svg(I.check)}</button>
    </div>`;
  const tx = document.getElementById('tx'), cnt = document.getElementById('cnt'), ok = document.getElementById('ok');
  tx.addEventListener('input', () => { const n = parseText(tx.value).length; cnt.textContent = n; ok.disabled = !n; });
  tx.focus();
  ok.onclick = () => {
    const cards = parseText(tx.value); if (!cards.length) return;
    if (target) { target.cards.push(...cards.map(c => ({ id: uid(), f: c.f, b: c.b }))); save(); go('deck', target.id); }
    else { const d = addDeck(document.getElementById('nm').value, cards); go('deck', d.id); }
    toast('+' + cards.length);
  };
}

/* ---------- nav ---------- */
function go(name, id) { view = { name, id }; render(); window.scrollTo(0, 0); }

$.addEventListener('click', e => {
  const b = e.target.closest('[data-act],[data-go],[data-rm],[data-a],[data-q]'); if (!b) return;
  if (b.dataset.go) return go('deck', b.dataset.go);
  if (b.dataset.q) return startQuiz(b.dataset.q);
  if (b.dataset.a) return answer(b.dataset.a === 'yes');
  if (b.dataset.rm) {
    const d = deck(view.id); d.cards = d.cards.filter(c => c.id !== b.dataset.rm); save(); return render();
  }
  const a = b.dataset.act, d = view.id ? deck(view.id) : null;
  if (a === 'home' || a === 'tab-home') return go('home');
  if (a === 'tab-quiz') return go('quiz');
  if (a === 'new') return go('import');
  if (a === 'paste') return go('import', view.name === 'deck' ? view.id : null);
  if (a === 'deck') return go('deck', (study && study.id) || view.id);
  if (a === 'study') return startStudy(view.id);
  if (a === 'restart') return startStudy(study ? study.id : view.id);
  if (a === 'send') return submit();
  if (a === 'next') return nextQ();
  if (a === 'requiz') return startQuiz(quiz.id);
  if (a === 'redo') return startQuiz(quiz.id, shuffle(quiz.bad.slice()));
  if (a === 'add') { d.cards.push({ id: uid(), f: '', b: '' }); save(); render(); $.querySelector('.rows .row:last-of-type input').focus(); return; }
  if (a === 'del') {
    if (!b.classList.contains('arm')) { b.classList.add('arm'); b.style.background = 'var(--p1)'; toast('×'); setTimeout(() => { b.classList.remove('arm'); b.style.background = ''; }, 2500); return; }
    db.decks = db.decks.filter(x => x.id !== d.id); save(); return go('home');
  }
  if (a === 'share') {
    const url = location.origin + location.pathname + '#i=' + enc({ key: d.key || d.id, name: d.name, cards: d.cards.map(c => [c.f, c.b]) });
    if (navigator.share) navigator.share({ url }).catch(() => {});
    else navigator.clipboard.writeText(url).then(() => toast('✓'));
    return;
  }
});

/* ---------- lien d'injection #i=… ---------- */
function consumeHash() {
  const h = location.hash;
  if (h.startsWith('#i=')) {
    try {
      const d = importPayload(dec(h.slice(3)));
      history.replaceState(null, '', location.pathname);
      if (d) { go('deck', d.id); toast('+' + d.cards.length); return true; }
    } catch (e) { history.replaceState(null, '', location.pathname); }
  }
  return false;
}

/* ---------- boot ---------- */
if (!consumeHash()) render();
window.addEventListener('hashchange', () => { consumeHash(); });
syncRepo();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
