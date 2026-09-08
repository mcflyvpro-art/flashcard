/* Cartes — révision + quiz. PWA locale, sans dépendance. */
const KEY = 'cartes.v2';
const $ = document.getElementById('app');

/* ---------- matières ---------- */
const SUBJ = [
  { id: 'italien',    n: 'Italien',    c: '#F6D2CB', ci: '#6B2A20', d: '#C5503F' },
  { id: 'anglais',    n: 'Anglais',    c: '#DBD7DD', ci: '#201D25', d: '#2A2730' },
  { id: 'philo',      n: 'Philo',      c: '#FADCB8', ci: '#6A4014', d: '#D4842E' },
  { id: 'eco',        n: 'Éco',        c: '#CFE7D3', ci: '#1D4630', d: '#4C9862' },
  { id: 'droit',      n: 'Droit',      c: '#F8D2E3', ci: '#63234A', d: '#CB6C9E' },
  { id: 'management', n: 'Management', c: '#F7E7AE', ci: '#5C4810', d: '#C9A526' },
  { id: 'lettres',    n: 'Lettres',    c: '#F0E9E0', ci: '#4A4137', d: '#A99A88' }
];
const NONE = { id: '', n: 'Sans matière', c: '#E8E3E9', ci: '#2A2530', d: '#8E8794' };
const subj = id => SUBJ.find(s => s.id === id) || NONE;
const sty = s => `--c:${s.c};--ci:${s.ci};--d:${s.d}`;

/* ---------- état ---------- */
let db = load();
let view = { name: 'home' };
let filter = '';
let peek = false;
let study = null, quiz = null, menu = null, draft = '';

function load() {
  let d = null;
  try { d = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
  if (!d) { try { d = JSON.parse(localStorage.getItem('cartes.v1')); } catch (e) {} }
  if (!d || !Array.isArray(d.decks)) d = { decks: [] };
  d.decks.forEach(k => { k.subject = k.subject || ''; k.hidden = !!k.hidden; });
  return d;
}
function save() { localStorage.setItem(KEY, JSON.stringify(db)); }
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
const deck = id => db.decks.find(d => d.id === id);
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0;[a[i], a[j]] = [a[j], a[i]]; } return a; };
const live = () => db.decks.filter(d => !d.hidden);

/* ---------- icônes ---------- */
const I = {
  plus: '<path d="M12 5.5v13M5.5 12h13"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  play: '<path d="M8.5 5.6l10 6.4-10 6.4z" fill="currentColor" stroke-linejoin="round"/>',
  pen: '<path d="M4.5 19.5h3.6L19 8.6a1.9 1.9 0 0 0-2.7-2.7L5.2 16.5v3z"/><path d="M14.5 7.7l2.8 2.8"/>',
  trash: '<path d="M4.5 7h15M9.5 7V5.2h5V7M6.5 7l.9 12.3h9.2L17.5 7"/><path d="M10.4 10.5v5.6M13.6 10.5v5.6"/>',
  x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  check: '<path d="M4.5 12.8l4.8 4.7L19.5 6.8"/>',
  down: '<path d="M12 4v11m0 0l-4.4-4.4M12 15l4.4-4.4M4.5 19.5h15"/>',
  share: '<path d="M12 3.5v12M12 3.5L7.8 7.7M12 3.5l4.2 4.2M5 14v6.5h14V14"/>',
  redo: '<path d="M4.2 11.6a7.8 7.8 0 1 1 2.4 6M4.2 11.6V6.4m0 5.2h5.2"/>',
  shuffle: '<path d="M3.5 6.5h3.8l9.4 11h3.8M3.5 17.5h3.8l2.9-3.4M20.5 17.5l-2.6-2.6M20.5 6.5l-2.6 2.6M14.4 8.9L16.9 6.5h3.6"/>',
  layers: '<path d="M12 3.4l8.6 4.7-8.6 4.7-8.6-4.7z"/><path d="M3.4 12.6l8.6 4.7 8.6-4.7"/><path d="M3.4 16.9l8.6 4.7 8.6-4.7"/>',
  eye: '<path d="M2.4 12S6 5.9 12 5.9 21.6 12 21.6 12 18 18.1 12 18.1 2.4 12 2.4 12z"/><circle cx="12" cy="12" r="2.7"/>',
  eyeoff: '<path d="M3.2 3.2l17.6 17.6"/><path d="M10.7 6.1A10.5 10.5 0 0 1 12 6c6 0 9.6 6 9.6 6a17.3 17.3 0 0 1-3.2 3.7M6.6 7.7A16.7 16.7 0 0 0 2.4 12s3.6 6 9.6 6a10 10 0 0 0 3.4-.6"/><path d="M9.9 10.1a2.8 2.8 0 0 0 4 4"/>',
  arrow: '<path d="M4.5 12h14m0 0l-5.2-5.2M18.5 12l-5.2 5.2"/>',
  more: '<circle cx="6" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="18" cy="12" r="1.5" fill="currentColor" stroke="none"/>',
  card: '<rect x="3" y="5.2" width="18" height="13.6" rx="3"/><path d="M7.2 10h6M7.2 13.4h9"/>',
  tag: '<path d="M11.4 3.6H20v8.6l-8.8 8.8a1.6 1.6 0 0 1-2.3 0l-6.3-6.3a1.6 1.6 0 0 1 0-2.3z"/><circle cx="16.3" cy="7.7" r="1.3"/>',
  trophy: '<path d="M7.5 4.5h9v4.2a4.5 4.5 0 0 1-9 0z"/><path d="M7.5 5.8H5a2 2 0 0 0 2 3.4M16.5 5.8H19a2 2 0 0 1-2 3.4"/><path d="M12 13.2v3.3M8.7 19.5h6.6a3.3 3.3 0 0 0-3.3-3v0a3.3 3.3 0 0 0-3.3 3z"/>',
  target: '<circle cx="12" cy="12" r="8.4"/><circle cx="12" cy="12" r="4.6"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>',
  swipe: '<path d="M22 6l-5 6 5 6M17 12h13M50 6l5 6-5 6M55 12H42"/>'
};
const svg = p => `<svg viewBox="0 0 24 24">${p}</svg>`;
const SWIPE = `<svg viewBox="0 0 72 24">${I.swipe}</svg>`;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const plur = (n, w) => `${n} ${w}${n > 1 ? 's' : ''}`;

/* ---------- base64url <-> unicode ---------- */
function enc(o) {
  const b = new TextEncoder().encode(JSON.stringify(o)); let s = '';
  b.forEach(c => s += String.fromCharCode(c));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function dec(t) {
  const s = atob(t.replace(/-/g, '+').replace(/_/g, '/'));
  const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
  return JSON.parse(new TextDecoder().decode(b));
}

/* ---------- texte brut -> cartes ---------- */
const SEPS = [/\s*\t+\s*/, /\s*::\s*/, /\s*=>?\s*/, /\s*\|\s*/, /\s+[–—]\s+/, /\s+-\s+/, /\s*:\s*/, /\s*;\s*/, /\s*,\s*/];
function parseText(txt) {
  const t = txt.trim(); if (!t) return [];
  if (t[0] === '{' || t[0] === '[') {
    try {
      const j = JSON.parse(t), arr = Array.isArray(j) ? j : (j.cards || []);
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
        out.push({ f: m[0].trim(), b: m.slice(1).join(' ').trim() }); break;
      }
    }
  }
  return out;
}

/* ---------- paquets ---------- */
function addDeck(name, cards, subject) {
  const d = { id: uid(), name: (name || '').trim() || 'Paquet', subject: subject || '', hidden: false,
              cards: cards.map(c => ({ id: uid(), f: c.f, b: c.b })) };
  db.decks.unshift(d); save(); return d;
}
function importPayload(p) {
  let last = null;
  for (const k of (Array.isArray(p) ? p : [p])) {
    const cards = (k.cards || []).map(c => Array.isArray(c) ? { f: c[0], b: c[1] } : c).filter(c => c && c.f);
    if (!cards.length) continue;
    const ex = k.key && db.decks.find(d => d.key === k.key);
    if (ex) {
      ex.name = k.name || ex.name; ex.subject = k.subject ?? ex.subject;
      ex.cards = cards.map(c => ({ id: uid(), f: c.f, b: c.b })); last = ex;
    } else { last = addDeck(k.name, cards, k.subject); last.key = k.key; }
  }
  save(); return last;
}
async function syncRepo() {
  try {
    const r = await fetch('decks/index.json', { cache: 'no-store' }); if (!r.ok) return;
    let changed = false;
    for (const it of await r.json()) {
      const cur = db.decks.find(d => d.key === it.key);
      if (cur && cur.rev === it.rev) continue;
      const dr = await fetch('decks/' + it.file, { cache: 'no-store' }); if (!dr.ok) continue;
      const pack = await dr.json();
      const cards = (pack.cards || []).map(c => Array.isArray(c) ? { f: c[0], b: c[1] } : c).filter(c => c && c.f);
      if (!cards.length) continue;
      if (cur) {
        cur.name = pack.name || cur.name; cur.subject = pack.subject ?? cur.subject;
        cur.cards = cards.map(c => ({ id: uid(), f: c.f, b: c.b })); cur.rev = it.rev;
      } else {
        const nd = addDeck(pack.name || it.key, cards, pack.subject);
        nd.key = it.key; nd.rev = it.rev;
      }
      changed = true;
    }
    if (changed) { save(); if (view.name === 'home' || view.name === 'quiz') render(); }
  } catch (e) {}
}

/* ---------- toast ---------- */
let tt;
function toast(icon, text) {
  clearTimeout(tt); document.querySelectorAll('.toast').forEach(n => n.remove());
  const n = document.createElement('div'); n.className = 'toast';
  n.innerHTML = svg(icon) + (text ? `<span>${esc(text)}</span>` : '');
  document.body.appendChild(n); tt = setTimeout(() => n.remove(), 1600);
}

/* ---------- rendu ---------- */
let animate = true;
function render() {
  const v = { home, deck: deckView, study: studyView, import: importView, quiz: quizHome, run: quizView };
  (v[view.name] || home)();
  if (animate) { $.classList.remove('fade'); void $.offsetWidth; $.classList.add('fade'); }
  animate = false;
  const on = $.querySelector('.pills .p.on');
  if (on && on.previousElementSibling) on.scrollIntoView({ block: 'nearest', inline: 'center' });
  if (menu) paintMenu();
}
function go(name, id) { closeMenu(); view = { name, id }; animate = true; render(); window.scrollTo(0, 0); }

const tabs = on => `<div class="tabs">
  <div class="sl" style="transform:translateX(${on === 'quiz' ? 74 : 0}px)"></div>
  <button class="${on === 'home' ? 'on' : ''}" data-act="tab-home">${svg(I.layers)}</button>
  <button class="${on === 'quiz' ? 'on' : ''}" data-act="tab-quiz">${svg(I.pen)}</button>
</div>`;

const pills = (active, list, act) => `<div class="pills">
  <button class="p ${active === '' ? 'on' : ''}" data-${act}="">Tout</button>
  ${list.map(s => `<button class="p ${active === s.id ? 'on' : ''}" data-${act}="${s.id}" style="--d:${s.d}">
    <i></i>${s.n}</button>`).join('')}
</div>`;

const tile = (d, i) => `<button class="tile ${d.hidden ? 'mute' : ''}" data-go="${d.id}" style="${sty(subj(d.subject))};--i:${i}">
  <span class="n">${esc(d.name)}</span>
  <span class="m">${svg(d.hidden ? I.eyeoff : I.card)}${d.cards.length}</span>
</button>`;

function home() {
  const used = SUBJ.filter(s => db.decks.some(d => d.subject === s.id && (peek || !d.hidden)));
  const hidden = db.decks.some(d => d.hidden);
  const list = db.decks.filter(d => (peek || !d.hidden) && (!filter || d.subject === filter));
  $.innerHTML = `
    <div class="bar"><div style="flex:1"></div>
      ${hidden ? `<button class="ic ${peek ? 'solid' : ''}" data-act="peek">${svg(peek ? I.eye : I.eyeoff)}</button>` : ''}
      <button class="ic" data-act="paste">${svg(I.down)}</button>
    </div>
    <div class="hero">Mes paquets</div>
    ${used.length > 1 ? pills(filter, used, 'filt') : ''}
    ${list.length ? `<div class="grid">${list.map(tile).join('')}</div>`
      : `<div class="empty">${svg(I.layers)}</div>`}
    <button class="fab" data-act="new">${svg(I.plus)}</button>
    ${tabs('home')}`;
}

function deckView() {
  const d = deck(view.id); if (!d) return go('home');
  const s = subj(d.subject);
  $.innerHTML = `
    <div class="bar">
      <button class="ic" data-act="home">${svg(I.back)}</button>
      <div style="flex:1"></div>
      <button class="ic" data-act="menu">${svg(I.more)}</button>
    </div>
    <div class="head" style="${sty(s)}">
      <div class="t" id="dn" contenteditable="plaintext-only" spellcheck="false" enterkeyhint="done">${esc(d.name)}</div>
      <div class="s">
        <span>${svg(I.tag)}${esc(s.n)}</span><b></b>
        <span>${svg(I.card)}${plur(d.cards.length, 'carte')}</span>
        ${d.hidden ? `<b></b><span>${svg(I.eyeoff)}Masqué</span>` : ''}
      </div>
    </div>
    <div class="duo">
      <button class="prim" data-act="study">${svg(I.play)}Réviser</button>
      <button data-act="quizdeck">${svg(I.pen)}Quiz</button>
    </div>
    <div class="lbl"><span>Cartes</span><span>${d.cards.length}</span></div>
    <div class="rows">
      ${d.cards.map((c, i) => `
        <div class="row" data-id="${c.id}" style="--i:${i}">
          <div class="fl">
            <input value="${esc(c.f)}" data-k="f" placeholder="Recto">
            <input class="b" value="${esc(c.b)}" data-k="b" placeholder="Verso">
          </div>
          <button class="x" data-rm="${c.id}">${svg(I.x)}</button>
        </div>`).join('')}
      <div class="duo ghost">
        <button data-act="add">${svg(I.plus)}Carte</button>
        <button data-act="paste">${svg(I.down)}Coller</button>
      </div>
    </div>`;
  const t = document.getElementById('dn');
  t.addEventListener('blur', () => {
    const v = t.textContent.replace(/\s+/g, ' ').trim();
    if (v !== d.name) { d.name = v || 'Paquet'; save(); t.textContent = d.name; }
  });
  t.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); t.blur(); } });
  $.querySelectorAll('.row input').forEach(inp => inp.addEventListener('input', () => {
    const c = d.cards.find(x => x.id === inp.closest('.row').dataset.id);
    if (c) { c[inp.dataset.k] = inp.value; save(); }
  }));
}

/* ---------- menu contextuel ---------- */
function openMenu(kind) { menu = kind; paintMenu(); }
function closeMenu() { menu = null; document.querySelectorAll('.scrim,.menu').forEach(n => n.remove()); }
function paintMenu() {
  document.querySelectorAll('.scrim,.menu').forEach(n => n.remove());
  const d = deck(view.id); if (!d) return;
  const w = document.createElement('div');
  w.innerHTML = `<div class="scrim" data-mact="close"></div>
    <div class="menu">
      <div class="mgrid">
        ${SUBJ.map(s => `<button class="ms ${d.subject === s.id ? 'on' : ''}" data-msubj="${s.id}" style="--d:${s.d}">
          <i></i>${s.n}</button>`).join('')}
      </div>
      <div class="msep"></div>
      <button class="mi" data-mact="hide">${svg(d.hidden ? I.eye : I.eyeoff)}${d.hidden ? 'Réafficher' : 'Masquer'}</button>
      <button class="mi" data-mact="share">${svg(I.share)}Partager</button>
      <button class="mi warn" data-mact="del">${svg(I.trash)}<span>Supprimer</span></button>
    </div>`;
  document.body.append(...w.childNodes);
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-mact],[data-msubj]'); if (!b) return;
  const d = deck(view.id);
  if (b.dataset.msubj !== undefined) { d.subject = b.dataset.msubj; save(); render(); return; }
  const a = b.dataset.mact;
  if (a === 'close') return closeMenu();
  if (a === 'hide') { d.hidden = !d.hidden; save(); closeMenu(); render(); toast(d.hidden ? I.eyeoff : I.eye); return; }
  if (a === 'share') {
    closeMenu();
    const url = location.origin + location.pathname + '#i=' +
      enc({ key: d.key || d.id, name: d.name, subject: d.subject, cards: d.cards.map(c => [c.f, c.b]) });
    if (navigator.share) navigator.share({ url }).catch(() => {});
    else navigator.clipboard.writeText(url).then(() => toast(I.check, 'Lien copié'));
    return;
  }
  if (a === 'del') {
    const lab = b.querySelector('span');
    if (b.dataset.arm) { db.decks = db.decks.filter(x => x.id !== d.id); save(); closeMenu(); return go('home'); }
    b.dataset.arm = 1; b.style.background = 'rgba(196,86,107,.12)'; lab.textContent = 'Confirmer la suppression';
    setTimeout(() => { if (b.isConnected) { delete b.dataset.arm; b.style.background = ''; lab.textContent = 'Supprimer'; } }, 3000);
  }
});

/* ---------- révision ---------- */
function startStudy(id) {
  const d = deck(id); if (!d || !d.cards.length) return;
  study = { id, queue: shuffle(d.cards.map(c => c.id)), i: 0, again: [], flip: false, ok: 0, total: d.cards.length };
  go('study', id);
}
const ring = (ok, total) => {
  const p = total ? ok / total : 0;
  const col = p >= .8 ? 'var(--ok)' : p >= .5 ? '#C9A526' : 'var(--ko)';
  return `<div class="ring" style="--rc:${col}">
    <svg viewBox="0 0 172 172">
      <circle class="bgc" cx="86" cy="86" r="75"/>
      <circle class="fgc" cx="86" cy="86" r="75" style="stroke-dashoffset:471"/>
    </svg>
    <div class="in"><div class="v">${Math.round(p * 100)}<span style="font-size:22px">%</span></div>
      <div class="u">${ok} / ${total}</div></div>
  </div>`;
};
function fillRing(ok, total) {
  requestAnimationFrame(() => {
    const c = document.querySelector('.ring .fgc');
    if (c) c.style.strokeDashoffset = String(471 * (1 - (total ? ok / total : 0)));
  });
}
function studyView() {
  const d = deck(study.id); if (!d) return go('home');
  const s = subj(d.subject);
  const bar = n => `<div class="bar">
      <button class="ic" data-act="deck">${svg(I.back)}</button>
      <h1>${esc(d.name)}</h1>
      ${n}
      <button class="ic" data-act="restart">${svg(I.shuffle)}</button>
    </div>`;
  if (study.i >= study.queue.length) {
    if (study.again.length) { study.queue = study.again; study.again = []; study.i = 0; study.flip = false; }
    else {
      $.innerHTML = bar('') + `<div class="done">
        ${ring(study.ok, study.total)}
        <div class="b">
          <button data-act="restart">${svg(I.redo)}Rejouer</button>
          <button class="prim" data-act="deck">${svg(I.check)}Terminer</button>
        </div></div>`;
      return fillRing(study.ok, study.total);
    }
  }
  $.innerHTML = bar(`<span class="num">${Math.min(study.i + 1, study.queue.length)}/${study.queue.length}</span>`)
    + `<div class="study">
      <div class="prog"><i id="pg" style="width:0%"></i></div>
      <div class="stage"><div class="stack" id="stack" style="${sty(s)}"></div></div>
      <div id="foot"></div>
    </div>`;
  paintStack(); paintFoot();
  requestAnimationFrame(() => { const p = document.getElementById('pg'); if (p) p.style.width = pct() + '%'; });
}
const pct = () => study.total ? Math.round(study.ok / study.total * 100) : 0;
const cardOf = n => deck(study.id).cards.find(x => x.id === study.queue[study.i + n]);
function paintStack() {
  const st = document.getElementById('stack'); if (!st) return;
  const html = [];
  for (let n = 2; n >= 0; n--) {
    const c = cardOf(n); if (!c) continue;
    html.push(n === 0
      ? `<div class="card g1" id="top">
          <div class="flipper">
            <div class="face"><span>${esc(c.f)}</span></div>
            <div class="face bk"><span>${esc(c.b)}</span></div>
          </div>
          <div class="ov y">${svg(I.check)}</div>
          <div class="ov n">${svg(I.x)}</div>
        </div>`
      : `<div class="card g${n}"><div class="face"></div></div>`);
  }
  st.innerHTML = html.join('');
  const top = document.getElementById('top');
  if (top) { requestAnimationFrame(() => top.classList.remove('g1')); bindDrag(top); }
}
function paintFoot() {
  const f = document.getElementById('foot'); if (!f) return;
  f.innerHTML = study.flip
    ? `<div class="acts">
        <button class="act yes" data-a="yes">${svg(I.check)}</button>
        <button class="act no" data-a="no">${svg(I.x)}</button>
      </div>`
    : `<div class="hint">${SWIPE}</div>`;
}
function toggleFlip() {
  const top = document.getElementById('top'); if (!top) return;
  study.flip = !study.flip; top.classList.toggle('flip', study.flip); paintFoot();
}
function bindDrag(el) {
  let x0 = 0, dx = 0, on = false, moved = false, t0 = 0;
  const ov = (k, v) => { const n = el.querySelector('.ov.' + k); if (n) { n.style.opacity = v; n.style.transform = `scale(${.55 + v * .45})`; } };
  el.addEventListener('pointerdown', e => {
    on = true; moved = false; dx = 0; x0 = e.clientX; t0 = Date.now();
    el.setPointerCapture(e.pointerId); el.style.transition = 'none';
  });
  el.addEventListener('pointermove', e => {
    if (!on) return;
    dx = e.clientX - x0; if (Math.abs(dx) > 5) moved = true;
    el.style.transform = `translateX(${dx}px) rotate(${dx / 26}deg)`;
    ov('y', dx < -20 ? Math.min(1, (-dx - 20) / 70) : 0);
    ov('n', dx > 20 ? Math.min(1, (dx - 20) / 70) : 0);
  });
  const end = () => {
    if (!on) return; on = false; el.style.transition = '';
    const v = Math.abs(dx) / Math.max(1, Date.now() - t0);
    if (Math.abs(dx) > 92 || (v > .6 && Math.abs(dx) > 34)) return fling(dx < 0 ? -1 : 1);
    el.style.transform = ''; ov('y', 0); ov('n', 0);
    if (!moved) toggleFlip();
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
}
function fling(dir) {
  const el = document.getElementById('top'); if (!el || el.dataset.gone) return;
  el.dataset.gone = 1; el.classList.add('gone');
  el.style.transform = `translateX(${dir * 130}vw) rotate(${dir * 20}deg)`;
  el.style.opacity = 0;
  setTimeout(() => commit(dir < 0), 250);
}
function commit(ok) {
  if (ok) study.ok++; else study.again.push(study.queue[study.i]);
  study.i++; study.flip = false;
  if (study.i >= study.queue.length) return studyView();
  paintStack(); paintFoot();
  const p = document.getElementById('pg'); if (p) p.style.width = pct() + '%';
  const n = document.querySelector('.bar .num');
  if (n) n.textContent = `${study.i + 1}/${study.queue.length}`;
}

/* ---------- quiz ---------- */
const norm = s => String(s).trim().toLowerCase()
  .replace(/[’‘‛´`]/g, "'").replace(/\s+/g, ' ').replace(/[?!.…]+$/, '').trim();
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
function startQuiz(id, pool) {
  const src = id === 'all' ? live().flatMap(d => d.cards) : (deck(id) || { cards: [] }).cards;
  const items = pool || shuffle(buildPool(src));
  if (!items.length) return;
  quiz = { id, name: id === 'all' ? 'Tout' : (deck(id) || {}).name || '',
           sub: id === 'all' ? '' : (deck(id) || {}).subject,
           pool: items, i: 0, ok: 0, bad: [], state: 'ask', typed: '' };
  go('run');
}
function quizHome() {
  const used = SUBJ.filter(s => live().some(d => d.subject === s.id));
  const list = live().filter(d => !filter || d.subject === filter);
  const total = buildPool(live().flatMap(d => d.cards)).length;
  $.innerHTML = `
    <div class="bar"><div style="flex:1"></div></div>
    <div class="hero">Quiz</div>
    ${used.length > 1 ? pills(filter, used, 'filt') : ''}
    ${live().length ? `<div class="grid">
      ${!filter ? `<button class="tile all" data-q="all" style="--i:0">
        <span class="n">Tout</span><span class="m">${svg(I.target)}${total}</span></button>` : ''}
      ${list.map((d, i) => `<button class="tile" data-q="${d.id}" style="${sty(subj(d.subject))};--i:${i + 1}">
        <span class="n">${esc(d.name)}</span>
        <span class="m">${svg(I.card)}${buildPool(d.cards).length}</span></button>`).join('')}
    </div>` : `<div class="empty">${svg(I.pen)}</div>`}
    ${tabs('quiz')}`;
}
function quizView() {
  const bar = n => `<div class="bar">
      <button class="ic" data-act="tab-quiz">${svg(I.back)}</button>
      <h1>${esc(quiz.name)}</h1>
      ${n}
      <button class="ic" data-act="requiz">${svg(I.shuffle)}</button>
    </div>`;
  if (quiz.i >= quiz.pool.length) {
    $.innerHTML = bar('') + `<div class="done">
      ${ring(quiz.ok, quiz.pool.length)}
      <div class="b">
        ${quiz.bad.length ? `<button data-act="redo">${svg(I.target)}Erreurs</button>` : ''}
        <button data-act="requiz">${svg(I.redo)}Rejouer</button>
        <button class="prim" data-act="tab-quiz">${svg(I.check)}Fin</button>
      </div></div>`;
    return fillRing(quiz.ok, quiz.pool.length);
  }
  const q = quiz.pool[quiz.i];
  $.innerHTML = bar(`<span class="num">${quiz.i + 1}/${quiz.pool.length}</span>`)
    + `<div class="study">
      <div class="prog"><i id="pg" style="width:0%"></i></div>
      <div class="qz">
        <div class="ask ${quiz.state}">${esc(q.f)}</div>
        ${quiz.state === 'bad' ? `<div class="sol">${svg(I.check)}${q.a.map(esc).join('  ·  ')}</div>` : ''}
      </div>
      <input id="ans" class="ans ${quiz.state}" value="${esc(quiz.typed)}" placeholder="Réponse"
        autocapitalize="none" autocorrect="off" autocomplete="off" spellcheck="false"
        enterkeyhint="go" ${quiz.state === 'ask' ? '' : 'readonly'}>
      <button class="cta" style="margin-top:11px" data-act="${quiz.state === 'ask' ? 'send' : 'next'}">
        ${quiz.state === 'ask' ? 'Valider' : 'Suivant'}${svg(I.arrow)}</button>
    </div>`;
  requestAnimationFrame(() => {
    const p = document.getElementById('pg');
    if (p) p.style.width = Math.round(quiz.i / quiz.pool.length * 100) + '%';
  });
  const inp = document.getElementById('ans');
  inp.addEventListener('input', () => quiz.typed = inp.value);
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); quiz.state === 'ask' ? submit() : nextQ(); }
  });
  if (quiz.state === 'ask') setTimeout(() => inp.focus(), 40);
}
function submit() {
  if (quiz.state !== 'ask' || !quiz.typed.trim()) return;
  const q = quiz.pool[quiz.i];
  if (q.a.some(a => norm(a) === norm(quiz.typed))) {
    quiz.ok++; quiz.state = 'good'; render();
    setTimeout(() => { if (quiz && quiz.state === 'good') nextQ(); }, 560);
  } else { quiz.bad.push(q); quiz.state = 'bad'; render(); }
}
function nextQ() { quiz.i++; quiz.state = 'ask'; quiz.typed = ''; render(); }

/* ---------- création / import ---------- */
let newSubject = '';
function importView() {
  const t = view.id ? deck(view.id) : null;
  $.innerHTML = `
    <div class="bar">
      <button class="ic" data-act="${t ? 'deck' : 'home'}">${svg(I.back)}</button>
      <h1>${t ? esc(t.name) : 'Nouveau paquet'}</h1>
    </div>
    <div class="sheet">
      ${t ? '' : `<div class="field"><input id="nm" placeholder="Nom du paquet" spellcheck="false" enterkeyhint="next"></div>
        ${pills(newSubject, SUBJ, 'nsubj')}`}
      <div class="ta"><textarea id="tx" placeholder="chat = gatto&#10;chien = cane&#10;maison = casa"
        autocapitalize="off" autocorrect="off" spellcheck="false">${esc(draft)}</textarea></div>
      <div class="prev" id="prev"></div>
      <div class="count" id="cnt">${svg(I.card)}<span>0</span></div>
      <button class="cta" id="ok" disabled>${t ? 'Ajouter' : 'Créer'}${svg(I.check)}</button>
    </div>`;
  const tx = document.getElementById('tx'), cnt = document.getElementById('cnt'),
        ok = document.getElementById('ok'), prev = document.getElementById('prev');
  const up = () => {
    draft = tx.value;
    const cards = parseText(tx.value);
    cnt.querySelector('span').textContent = cards.length;
    cnt.classList.toggle('on', !!cards.length);
    ok.disabled = !cards.length;
    prev.innerHTML = cards.slice(0, 40).map((c, i) => `<div class="pr" style="animation-delay:${i * 18}ms">
      <span class="a">${esc(c.f)}</span>${svg(I.arrow)}<span class="b">${esc(c.b)}</span></div>`).join('');
  };
  const fit = () => { tx.style.height = 'auto'; tx.style.height = Math.min(tx.scrollHeight + 2, innerHeight * .3) + 'px'; };
  tx.addEventListener('input', () => { fit(); up(); }); fit(); up();
  setTimeout(() => (document.getElementById('nm') || tx).focus(), 60);
  ok.onclick = () => {
    const cards = parseText(tx.value); if (!cards.length) return;
    draft = '';
    if (t) { t.cards.push(...cards.map(c => ({ id: uid(), f: c.f, b: c.b }))); save(); go('deck', t.id); }
    else { const d = addDeck(document.getElementById('nm').value, cards, newSubject); newSubject = ''; go('deck', d.id); }
    toast(I.check, plur(cards.length, 'carte'));
  };
}

/* ---------- interactions ---------- */
$.addEventListener('click', e => {
  const b = e.target.closest('[data-act],[data-go],[data-rm],[data-a],[data-q],[data-filt],[data-nsubj]');
  if (!b) return;
  const ds = b.dataset;
  if (ds.filt !== undefined) { filter = ds.filt; render(); return; }
  if (ds.nsubj !== undefined) {
    newSubject = ds.nsubj;
    $.querySelectorAll('[data-nsubj]').forEach(x => x.classList.toggle('on', x.dataset.nsubj === newSubject));
    return;
  }
  if (ds.go) return go('deck', ds.go);
  if (ds.q) return startQuiz(ds.q);
  if (ds.a) return fling(ds.a === 'yes' ? -1 : 1);
  if (ds.rm) { const d = deck(view.id); d.cards = d.cards.filter(c => c.id !== ds.rm); save(); return render(); }
  const a = ds.act, d = view.id ? deck(view.id) : null;
  if (a === 'home' || a === 'tab-home') return go('home');
  if (a === 'tab-quiz') return go('quiz');
  if (a === 'peek') { peek = !peek; render(); return; }
  if (a === 'new') { draft = ''; return go('import'); }
  if (a === 'paste') { draft = ''; return go('import', view.name === 'deck' ? view.id : null); }
  if (a === 'deck') return go('deck', (study && study.id) || view.id);
  if (a === 'menu') return openMenu('deck');
  if (a === 'study') return startStudy(view.id);
  if (a === 'quizdeck') return startQuiz(view.id);
  if (a === 'restart') return startStudy(study ? study.id : view.id);
  if (a === 'send') return submit();
  if (a === 'next') return nextQ();
  if (a === 'requiz') return startQuiz(quiz.id);
  if (a === 'redo') return startQuiz(quiz.id, shuffle(quiz.bad.slice()));
  if (a === 'add') {
    d.cards.push({ id: uid(), f: '', b: '' }); save(); render();
    const i = $.querySelector('.rows .row:last-of-type input'); if (i) i.focus();
  }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && menu) return closeMenu();
  if (view.name !== 'study' || /INPUT|TEXTAREA/.test(e.target.tagName) || e.target.isContentEditable) return;
  if (e.key === 'ArrowLeft') fling(-1);
  else if (e.key === 'ArrowRight') fling(1);
  else if (e.key === ' ') { e.preventDefault(); toggleFlip(); }
});

/* ---------- lien d'injection ---------- */
function consumeHash() {
  if (!location.hash.startsWith('#i=')) return false;
  try {
    const d = importPayload(dec(location.hash.slice(3)));
    history.replaceState(null, '', location.pathname);
    if (d) { go('deck', d.id); toast(I.check, plur(d.cards.length, 'carte')); return true; }
  } catch (e) { history.replaceState(null, '', location.pathname); }
  return false;
}

/* ---------- démarrage ---------- */
if (!consumeHash()) render();
window.addEventListener('hashchange', consumeHash);
syncRepo();
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!reloaded) { reloaded = true; location.reload(); }
  });
}
