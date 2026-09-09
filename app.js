/* Cartes — révision + quiz. PWA, comptes cloisonnés sur Supabase. */
const SB = {
  url: 'https://qqbzefpdeinlynjtarqr.supabase.co',
  // clé publique : elle est faite pour vivre dans le code client.
  // Ce sont les règles RLS de la base qui cloisonnent réellement les comptes.
  key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxYnplZnBkZWlubHluanRhcnFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5Nzk0MTIsImV4cCI6MjEwNDU1NTQxMn0.CLTRJl1ZOg1tbzSIEBiRhhoiiJIVD4cHqkk1qBwV9FI'
};
const AKEY = 'cartes.auth';
const $ = document.getElementById('app');

/* ---------- palette : 16 teintes accordées à l'app ---------- */
const PALETTE = {
  red:      { c: '#F6D2CB', ci: '#6B2A20', d: '#C5503F' },
  coral:    { c: '#FAD7C7', ci: '#6B3319', d: '#D0703C' },
  orange:   { c: '#FADCB8', ci: '#6A4014', d: '#D4842E' },
  amber:    { c: '#F8E4B0', ci: '#61460F', d: '#CE9A21' },
  yellow:   { c: '#F7E7AE', ci: '#5C4810', d: '#C9A526' },
  lime:     { c: '#E4EBB4', ci: '#454E15', d: '#93A32C' },
  green:    { c: '#CFE7D3', ci: '#1D4630', d: '#4C9862' },
  teal:     { c: '#C4E6E4', ci: '#12433F', d: '#3B9490' },
  cyan:     { c: '#C8E4EF', ci: '#14414F', d: '#3E8FA8' },
  blue:     { c: '#CFDDF2', ci: '#1B3A5E', d: '#4A7FBE' },
  indigo:   { c: '#D6D7F0', ci: '#2A2C5C', d: '#6366B4' },
  violet:   { c: '#DFD3F0', ci: '#3A2559', d: '#7C5CB0' },
  purple:   { c: '#EBD4EF', ci: '#4A2352', d: '#9857A6' },
  pink:     { c: '#F8D2E3', ci: '#63234A', d: '#CB6C9E' },
  sand:     { c: '#F0E9E0', ci: '#4A4137', d: '#A99A88' },
  graphite: { c: '#DBD7DD', ci: '#201D25', d: '#2A2730' }
};
const COLORS = Object.keys(PALETTE);
const SEED = [
  ['italien', 'Italien', 'red'], ['anglais', 'Anglais', 'graphite'],
  ['philo', 'Philo', 'orange'], ['eco', 'Éco', 'green'],
  ['droit', 'Droit', 'pink'], ['management', 'Management', 'yellow'],
  ['lettres', 'Lettres', 'sand']
];
const NONE = { id: '', name: 'Sans matière', color: 'graphite',
               c: '#E8E3E9', ci: '#2A2530', d: '#8E8794' };
const subj = id => {
  const t = db.subjects.find(x => x.id === id);
  return t ? { ...t, ...(PALETTE[t.color] || PALETTE.graphite) } : NONE;
};
const sty = s => `--c:${s.c};--ci:${s.ci};--d:${s.d}`;

/* ---------- état ---------- */
let auth = loadAuth();
let db = { subjects: [], decks: [], hist: {} };
let view = { name: 'home' };
let filter = '';
let peek = false;
let study = null, quiz = null, menu = null, typing = 0;
let dirty = {}, gone = [], online = true;

function loadAuth() { try { return JSON.parse(localStorage.getItem(AKEY)); } catch (e) { return null; } }
function saveAuth(a) { auth = a; a ? localStorage.setItem(AKEY, JSON.stringify(a)) : localStorage.removeItem(AKEY); }
const cacheKey = () => 'cartes.cache.' + (auth && auth.uid);

function load() {
  try {
    const d = JSON.parse(localStorage.getItem(cacheKey()));
    if (d && Array.isArray(d.decks)) return { subjects: d.subjects || [], decks: d.decks, hist: d.hist || {} };
  } catch (e) {}
  return { subjects: [], decks: [], hist: {} };
}
function save() {
  if (auth) localStorage.setItem(cacheKey(), JSON.stringify(db));
}
/* enregistre localement puis pousse en base */
function saveDeck(d) { save(); if (d) { dirty[d.id] = 1; flush(); } }

function pushHist(id, mode, pct) {
  const k = id + ':' + mode;
  (db.hist[k] = db.hist[k] || []).push({ t: Date.now(), p: pct });
  if (db.hist[k].length > 24) db.hist[k].shift();
  save();
  api('/rest/v1/sessions', 'POST', [{ user_id: auth.uid, deck_id: String(id), mode, pct }]).catch(() => {});
  return db.hist[k];
}
const histOf = (id, mode) => db.hist[id + ':' + mode] || [];

const uid = () => (crypto.randomUUID ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 3 | 8)).toString(16);
    }));
const deck = id => db.decks.find(d => d.id === id);
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0;[a[i], a[j]] = [a[j], a[i]]; } return a; };
const live = () => db.decks.filter(d => !d.hidden);
const slugify = n => (n || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'matiere';

/* ---------- accès à Supabase ---------- */
async function api(path, method = 'GET', body, extra = {}) {
  const h = { apikey: SB.key, 'Content-Type': 'application/json', ...extra };
  if (auth && auth.token) h.Authorization = 'Bearer ' + auth.token;
  const r = await fetch(SB.url + path, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  if (r.status === 401 && auth && auth.refresh) {
    if (await refreshToken()) return api(path, method, body, extra);
  }
  if (!r.ok) throw new Error(await r.text().catch(() => r.status));
  return r.status === 204 ? null : r.json().catch(() => null);
}
function keepSession(j) {
  saveAuth({
    token: j.access_token, refresh: j.refresh_token,
    exp: Date.now() + (j.expires_in || 3600) * 1000,
    uid: j.user.id, email: j.user.email
  });
}
async function signIn(email, password) {
  const r = await fetch(SB.url + '/auth/v1/token?grant_type=password', {
    method: 'POST', headers: { apikey: SB.key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim().toLowerCase(), password })
  });
  const j = await r.json();
  if (!r.ok || !j.access_token) throw new Error(j.error_description || j.msg || j.error || 'Connexion refusée');
  keepSession(j);
  return j;
}
async function refreshToken() {
  try {
    const r = await fetch(SB.url + '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST', headers: { apikey: SB.key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: auth.refresh })
    });
    const j = await r.json();
    if (!r.ok || !j.access_token) return false;
    keepSession(j);
    return true;
  } catch (e) { return false; }
}

const rowOf = d => ({ id: d.id, user_id: auth.uid, name: d.name, subject: d.subject,
                      hidden: !!d.hidden, cards: d.cards, pos: d.pos || 0 });

/* pousse tout ce qui est en attente ; garde la file si le réseau manque */
let flushing = false;
async function flush() {
  if (flushing || !auth) return;
  flushing = true;
  try {
    const ids = Object.keys(dirty);
    if (ids.length) {
      const rows = ids.map(deck).filter(Boolean).map(rowOf);
      if (rows.length) await api('/rest/v1/decks', 'POST', rows,
        { Prefer: 'resolution=merge-duplicates,return=minimal' });
      ids.forEach(i => delete dirty[i]);
    }
    while (gone.length) {
      const id = gone[0];
      await api(`/rest/v1/decks?id=eq.${encodeURIComponent(id)}`, 'DELETE');
      gone.shift();
    }
    setOnline(true);
  } catch (e) { setOnline(false); }
  flushing = false;
}
function setOnline(v) {
  if (online === v) return;
  online = v;
  const n = document.getElementById('offdot');
  if (n) n.style.display = v ? 'none' : '';
}

/* récupère matières, paquets et historique du compte */
async function pull() {
  const [subs, decks, sess] = await Promise.all([
    api('/rest/v1/subjects?select=*&order=pos.asc'),
    api('/rest/v1/decks?select=*&order=pos.asc'),
    api('/rest/v1/sessions?select=deck_id,mode,pct,created_at&order=created_at.asc')
  ]);
  db.subjects = subs.map(x => ({ id: x.id, name: x.name, color: x.color, pos: x.pos }));
  db.decks = decks.map(x => ({
    id: x.id, name: x.name, subject: x.subject, hidden: x.hidden,
    pos: x.pos, cards: (x.cards || []).map(c => ({ id: c.id || uid(), f: c.f, b: c.b }))
  }));
  db.hist = {};
  for (const r of sess) {
    const k = r.deck_id + ':' + r.mode;
    (db.hist[k] = db.hist[k] || []).push({ t: +new Date(r.created_at), p: r.pct });
    if (db.hist[k].length > 24) db.hist[k].shift();
  }
  if (!db.subjects.length) await seedSubjects();
  save();
}
async function seedSubjects() {
  db.subjects = SEED.map(([id, name, color], i) => ({ id, name, color, pos: i }));
  await api('/rest/v1/subjects', 'POST',
    db.subjects.map(s => ({ ...s, user_id: auth.uid })),
    { Prefer: 'resolution=merge-duplicates,return=minimal' });
}
async function pushSubject(s) {
  save();
  return api('/rest/v1/subjects', 'POST', [{ ...s, user_id: auth.uid }],
    { Prefer: 'resolution=merge-duplicates,return=minimal' }).catch(() => setOnline(false));
}
async function delSubject(id) {
  save();
  return api(`/rest/v1/subjects?id=eq.${encodeURIComponent(id)}`, 'DELETE').catch(() => setOnline(false));
}

/* reprise unique de l'ancienne bibliothèque locale */
async function importLegacy() {
  const flag = 'cartes.migrated.' + auth.uid;
  if (localStorage.getItem(flag)) return 0;
  localStorage.setItem(flag, '1');
  let old = null;
  try { old = JSON.parse(localStorage.getItem('cartes.v2')); } catch (e) {}
  if (!old || !Array.isArray(old.decks) || !old.decks.length) return 0;
  const have = new Set(db.decks.map(d => d.name));
  const add = old.decks.filter(d => d.cards && d.cards.length && !have.has(d.name));
  if (!add.length) return 0;
  let pos = db.decks.length;
  for (const d of add) {
    const nd = { id: uid(), name: d.name, subject: d.subject || '', hidden: !!d.hidden,
                 pos: pos++, cards: d.cards.map(c => ({ id: uid(), f: c.f, b: c.b })) };
    db.decks.push(nd); dirty[nd.id] = 1;
  }
  await flush();
  save();
  return add.length;
}

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
  swipe: '<path d="M22 6l-5 6 5 6M17 12h13M50 6l5 6-5 6M55 12H42"/>',
  cloud: '<path d="M7.2 18.4a4 4 0 0 1-.4-8 5.5 5.5 0 0 1 10.6-1.1 3.8 3.8 0 0 1-.4 9.1"/><path d="M12 20.4v-8.6m0 0L9.3 14.5M12 11.8l2.7 2.7"/>',
  cloudok: '<path d="M7.2 18.4a4 4 0 0 1-.4-8 5.5 5.5 0 0 1 10.6-1.1 3.8 3.8 0 0 1-.4 9.1"/><path d="M9.6 14.2l1.9 1.9 3.2-3.6"/>',
  gear: '<circle cx="12" cy="12" r="3.1"/><path d="M19.4 14.4a1.6 1.6 0 0 0 .3 1.8l.1.1a1.9 1.9 0 1 1-2.7 2.7l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5v.2a1.9 1.9 0 1 1-3.8 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a1.9 1.9 0 1 1-2.7-2.7l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1h-.2a1.9 1.9 0 1 1 0-3.8h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a1.9 1.9 0 1 1 2.7-2.7l.1.1a1.6 1.6 0 0 0 1.8.3h.1a1.6 1.6 0 0 0 1-1.5v-.2a1.9 1.9 0 1 1 3.8 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a1.9 1.9 0 1 1 2.7 2.7l-.1.1a1.6 1.6 0 0 0-.3 1.8v.1a1.6 1.6 0 0 0 1.5 1h.2a1.9 1.9 0 1 1 0 3.8h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
  user: '<circle cx="12" cy="8.2" r="3.8"/><path d="M4.6 20.2a7.4 7.4 0 0 1 14.8 0"/>',
  mail: '<rect x="2.8" y="5.2" width="18.4" height="13.6" rx="3"/><path d="M3.4 7.6l8.6 5.6 8.6-5.6"/>',
  lock: '<rect x="4.6" y="10.4" width="14.8" height="9.4" rx="3"/><path d="M8.2 10.4V7.8a3.8 3.8 0 0 1 7.6 0v2.6"/>',
  swap: '<path d="M4 8.6h13.5m0 0l-3.6-3.6M17.5 8.6l-3.6 3.6"/><path d="M20 15.4H6.5m0 0l3.6-3.6M6.5 15.4l3.6 3.6"/>',
  key: '<circle cx="8.2" cy="15.8" r="3.5"/><path d="M10.7 13.3L19.4 4.6M16.4 7.6l2.1 2.1M14 10l2.1 2.1"/>',
  exit: '<path d="M9.5 4.5H6a1.9 1.9 0 0 0-1.9 1.9v11.2A1.9 1.9 0 0 0 6 19.5h3.5"/><path d="M13.5 8.2l3.8 3.8-3.8 3.8M17 12H9.5"/>'
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
  const d = { id: uid(), name: (name || '').trim() || 'Paquet', subject: subject || '',
              hidden: false, pos: -Date.now() / 1000 | 0,
              cards: cards.map(c => ({ id: uid(), f: c.f, b: c.b })) };
  db.decks.unshift(d); saveDeck(d); return d;
}
function importPayload(p) {
  let last = null;
  for (const k of (Array.isArray(p) ? p : [p])) {
    const cards = (k.cards || []).map(c => Array.isArray(c) ? { f: c[0], b: c[1] } : c).filter(c => c && c.f);
    if (!cards.length) continue;
    const ex = db.decks.find(d => d.name === k.name);
    if (ex) {
      ex.subject = k.subject ?? ex.subject;
      ex.cards = cards.map(c => ({ id: uid(), f: c.f, b: c.b }));
      last = ex; dirty[ex.id] = 1;
    } else last = addDeck(k.name, cards, k.subject);
  }
  save(); flush(); return last;
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
  const v = { home, deck: deckView, study: studyView, import: importView, quiz: quizHome,
              run: quizView, login: loginView, settings: settingsView };
  (v[view.name] || home)();
  if (animate) { $.classList.remove('fade'); void $.offsetWidth; $.classList.add('fade'); }
  if (pageDir) {
    const pg = document.getElementById('page');
    if (pg) pg.classList.add(pageDir < 0 ? 'in-right' : 'in-left');
    pageDir = 0;
  }
  animate = false;
  const on = $.querySelector('.pills .p.on');
  if (on && on.previousElementSibling) on.scrollIntoView({ block: 'nearest', inline: 'center' });
  if (menu) paintMenu();
}
let pageDir = 0;
function go(name, id, dir) {
  closeMenu(); pageDir = dir || 0; view = { name, id }; animate = !dir;
  render(); window.scrollTo(0, 0);
}

/* balayage horizontal entre « Mes paquets » et « Quiz » */
function bindPager() {
  const pg = document.getElementById('page'); if (!pg) return;
  const home = view.name === 'home';
  let x0 = 0, y0 = 0, dx = 0, on = false, lock = 0, t0 = 0;
  pg.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button) return;
    if (e.target.closest('.pills')) return;   // laisse défiler les matières
    on = true; lock = 0; dx = 0; x0 = e.clientX; y0 = e.clientY; t0 = Date.now();
    pg.style.transition = 'none';
  });
  pg.addEventListener('pointermove', e => {
    if (!on) return;
    const ax = e.clientX - x0, ay = e.clientY - y0;
    if (!lock) {
      if (Math.abs(ax) < 10 && Math.abs(ay) < 10) return;
      lock = Math.abs(ax) > Math.abs(ay) * 1.3 ? 1 : -1;
      if (lock < 0) { on = false; pg.style.transition = ''; return; }
    }
    dx = ax;
    const edge = home ? dx > 0 : dx < 0;          // rien de l'autre côté
    const d = edge ? dx * .26 : dx;
    pg.style.transform = `translateX(${d}px)`;
    pg.style.opacity = String(Math.max(.5, 1 - Math.abs(d) / 480));
  });
  const end = () => {
    if (!on) return;
    on = false; pg.style.transition = ''; pg.style.transform = ''; pg.style.opacity = '';
    if (lock !== 1) return;
    const fast = Math.abs(dx) / Math.max(1, Date.now() - t0) > .5;
    if (Math.abs(dx) < innerWidth * .26 && !fast) return;
    if (home && dx < 0) go('quiz', null, -1);
    else if (!home && dx > 0) go('home', null, 1);
  };
  pg.addEventListener('pointerup', end);
  pg.addEventListener('pointercancel', end);
  pg.addEventListener('pointerleave', end);
}

const tabs = on => `<div class="tabs">
  <div class="sl" style="transform:translateX(${on === 'quiz' ? 74 : 0}px)"></div>
  <button class="${on === 'home' ? 'on' : ''}" data-act="tab-home">${svg(I.layers)}</button>
  <button class="${on === 'quiz' ? 'on' : ''}" data-act="tab-quiz">${svg(I.pen)}</button>
</div>`;

const pills = (active, list, act) => `<div class="pills">
  <button class="p ${active === '' ? 'on' : ''}" data-${act}="">Tout</button>
  ${list.map(s => `<button class="p ${active === s.id ? 'on' : ''}" data-${act}="${s.id}" style="--d:${s.d}">
    <i></i>${esc(s.name)}</button>`).join('')}
</div>`;

const tile = (d, i) => `<button class="tile ${d.hidden ? 'mute' : ''}" data-go="${d.id}" style="${sty(subj(d.subject))};--i:${i}">
  <span class="n">${esc(d.name)}</span>
  <span class="m">${svg(d.hidden ? I.eyeoff : I.card)}${d.cards.length}</span>
</button>`;

function home() {
  const used = db.subjects.filter(s => db.decks.some(d => d.subject === s.id && (peek || !d.hidden))).map(x => subj(x.id));
  const hidden = db.decks.some(d => d.hidden);
  const list = db.decks.filter(d => (peek || !d.hidden) && (!filter || d.subject === filter));
  $.innerHTML = `
    <div class="page" id="page">
      <div class="top">
        <div class="hero">Mes paquets</div>
        <span id="offdot" class="off-dot" style="display:${online ? 'none' : ''}"></span>
        <button class="ic" data-act="settings">${svg(I.gear)}</button>
        ${hidden ? `<button class="ic ${peek ? 'solid' : ''}" data-act="peek">${svg(peek ? I.eye : I.eyeoff)}</button>` : ''}
      </div>
      ${used.length > 1 ? pills(filter, used, 'filt') : ''}
      ${list.length ? `<div class="grid">${list.map(tile).join('')}</div>`
        : `<div class="empty">${svg(I.layers)}</div>`}
    </div>
    <button class="fab" data-act="new">${svg(I.plus)}</button>
    ${tabs('home')}`;
  bindPager();
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
    if (v !== d.name) { d.name = v || 'Paquet'; saveDeck(d); t.textContent = d.name; }
  });
  t.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); t.blur(); } });
  $.querySelectorAll('.row input').forEach(inp => inp.addEventListener('input', () => {
    const c = d.cards.find(x => x.id === inp.closest('.row').dataset.id);
    if (c) { c[inp.dataset.k] = inp.value; clearTimeout(typing); typing = setTimeout(() => saveDeck(d), 700); }
  }));
}


/* ---------- connexion ---------- */
let loginBusy = false;
function loginView() {
  $.innerHTML = `<div class="login">
    <img class="logo" src="icons/icon-192.png" alt="">
    <div class="lt">Cartes</div>
    <form class="lf" id="lf" autocomplete="on">
      <div class="lrow">${svg(I.mail)}
        <input id="em" type="email" placeholder="Adresse e-mail" autocomplete="username"
          autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="next"></div>
      <div class="lrow">${svg(I.lock)}
        <input id="pw" type="password" placeholder="Mot de passe" autocomplete="current-password"
          autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="go">
        <button type="button" class="peek" id="pk">${svg(I.eye)}</button></div>
      <div class="lerr" id="le"></div>
      <button class="cta" id="go" type="submit">Se connecter${svg(I.arrow)}</button>
    </form>
  </div>`;
  const em = document.getElementById('em'), pw = document.getElementById('pw'),
        err = document.getElementById('le'), btn = document.getElementById('go');
  document.getElementById('pk').onclick = () => {
    const on = pw.type === 'password';
    pw.type = on ? 'text' : 'password';
    document.getElementById('pk').innerHTML = svg(on ? I.eyeoff : I.eye);
    pw.focus();
  };
  document.getElementById('lf').onsubmit = async e => {
    e.preventDefault();
    if (loginBusy) return;
    if (!em.value.trim() || !pw.value) { err.textContent = 'Renseigne les deux champs'; return; }
    loginBusy = true; btn.disabled = true; err.textContent = '';
    btn.firstChild.textContent = 'Connexion…';
    try {
      await signIn(em.value, pw.value);
      db = load();
      await pull();
      const n = await importLegacy();
      go('home');
      if (n) toast(I.check, plur(n, 'paquet') + ' repris');
    } catch (x) {
      err.textContent = /Invalid|credentials|refus/i.test(String(x.message))
        ? 'E-mail ou mot de passe incorrect' : 'Connexion impossible';
      btn.disabled = false; btn.firstChild.textContent = 'Se connecter';
    }
    loginBusy = false;
  };
  setTimeout(() => em.focus(), 80);
}

/* ---------- réglages ---------- */
let subjEdit = null, subjColor = 'graphite', subjName = '';
function openSubject(id) {
  subjEdit = id;
  const t = db.subjects.find(x => x.id === id);
  subjColor = t ? t.color : COLORS[db.subjects.length % COLORS.length];
  subjName = t ? t.name : '';
  openMenu('subject');
}
function settingsView() {
  $.innerHTML = `
    <div class="bar"><button class="ic" data-act="home">${svg(I.back)}</button></div>
    <div class="page">
      <div class="top"><div class="hero">Réglages</div></div>
      <div class="lbl"><span>Matières</span><span>${db.subjects.length}</span></div>
      <div class="slist">
        ${db.subjects.map(t => {
          const pal = PALETTE[t.color] || PALETTE.graphite;
          const n = db.decks.filter(d => d.subject === t.id).length;
          return `<button class="sr" data-sub="${t.id}" style="${sty(pal)}">
            <i></i><span class="n">${esc(t.name)}</span>
            <span class="c">${n || ''}</span>${svg(I.arrow)}</button>`;
        }).join('')}
        <button class="sr add" data-sub="">${svg(I.plus)}<span class="n">Nouvelle matière</span></button>
      </div>
      <div class="lbl"><span>Compte</span></div>
      <div class="slist">
        <div class="sr flat">${svg(I.user)}<span class="n">${esc(auth ? auth.email : '')}</span></div>
        <button class="sr flat" data-act="backup2">${svg(I.share)}<span class="n">Sauvegarder</span>
          <span class="c">${db.decks.length}</span>${svg(I.arrow)}</button>
        <button class="sr flat warn" data-act="logout">${svg(I.exit)}<span class="n">Se déconnecter</span></button>
      </div>
      <div class="foot">${online ? 'Synchronisé' : 'Hors ligne — reprise automatique'}</div>
    </div>`;
}

/* ---------- menu contextuel ---------- */
function openMenu(kind) { menu = kind; paintMenu(); }
function closeMenu() { menu = null; document.querySelectorAll('.scrim,.menu').forEach(n => n.remove()); }
function paintMenu() {
  document.querySelectorAll('.scrim,.menu').forEach(n => n.remove());
  const w = document.createElement('div');
  if (menu === 'subject') {
    const t = db.subjects.find(x => x.id === subjEdit) || { id: '', name: '', color: 'graphite' };
    w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu">
        <input class="tok" id="sn" placeholder="Nom de la matière" spellcheck="false"
          enterkeyhint="done" value="${esc(subjName)}">
        <div class="swatch">${COLORS.map(k => `<button class="sw2 ${k === subjColor ? 'on' : ''}"
          data-color="${k}" style="background:${PALETTE[k].c};--dd:${PALETTE[k].d}"></button>`).join('')}</div>
        <div class="msep"></div>
        ${t.id ? `<button class="mi warn" data-mact="subjdel">${svg(I.trash)}<span>Supprimer</span></button>` : ''}
        <button class="mi" data-mact="subjok" style="justify-content:center;font-weight:700">
          ${svg(I.check)}${t.id ? 'Enregistrer' : 'Créer'}</button>
      </div>`;
    document.body.append(...w.childNodes);
    const sn = document.getElementById('sn');
    sn.addEventListener('input', () => subjName = sn.value);
    sn.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); sn.blur(); } });
    setTimeout(() => { if (!subjName) sn.focus(); }, 60);
    return;
  }
  const d = deck(view.id); if (!d) return;
  w.innerHTML = `<div class="scrim" data-mact="close"></div>
    <div class="menu">
      <div class="mgrid">
        ${db.subjects.map(x => subj(x.id)).map(s => `<button class="ms ${d.subject === s.id ? 'on' : ''}"
          data-msubj="${s.id}" style="--d:${s.d}"><i></i>${esc(s.name)}</button>`).join('')}
      </div>
      <div class="msep"></div>
      <button class="mi" data-mact="hide">${svg(d.hidden ? I.eye : I.eyeoff)}${d.hidden ? 'Réafficher' : 'Masquer'}</button>
      <button class="mi" data-mact="share">${svg(I.share)}Partager</button>
      <button class="mi warn" data-mact="del">${svg(I.trash)}<span>Supprimer</span></button>
    </div>`;
  document.body.append(...w.childNodes);
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-mact],[data-msubj],[data-color]'); if (!b) return;
  const d = deck(view.id);
  if (b.dataset.msubj !== undefined) { d.subject = b.dataset.msubj; saveDeck(d); render(); return; }
  const a = b.dataset.mact;
  if (a === 'close') return closeMenu();
  if (b.dataset.color) { subjColor = b.dataset.color; return paintMenu(); }
  if (a === 'subjok') {
    const name = (document.getElementById('sn').value || subjName).trim();
    if (!name) return;
    if (subjEdit) {
      const t = db.subjects.find(x => x.id === subjEdit);
      t.name = name; t.color = subjColor; pushSubject(t);
    } else {
      let id = slugify(name), n = 2;
      while (db.subjects.some(x => x.id === id)) id = slugify(name) + '-' + n++;
      const t = { id, name, color: subjColor, pos: db.subjects.length };
      db.subjects.push(t); pushSubject(t);
    }
    closeMenu(); return render();
  }
  if (a === 'subjdel') {
    const lab = b.querySelector('span');
    if (!b.dataset.arm) {
      b.dataset.arm = 1; b.style.background = 'rgba(196,86,107,.12)'; lab.textContent = 'Confirmer';
      setTimeout(() => { if (b.isConnected) { delete b.dataset.arm; b.style.background = ''; lab.textContent = 'Supprimer'; } }, 3000);
      return;
    }
    db.subjects = db.subjects.filter(x => x.id !== subjEdit);
    db.decks.filter(x => x.subject === subjEdit).forEach(x => { x.subject = ''; dirty[x.id] = 1; });
    delSubject(subjEdit); flush(); closeMenu(); return render();
  }
  if (a === 'backup') {
    closeMenu();
    const url = location.origin + location.pathname + '#i=' + enc(db.decks.map(x =>
      ({ key: x.key || x.id, name: x.name, subject: x.subject, cards: x.cards.map(c => [c.f, c.b]) })));
    if (navigator.share) navigator.share({ url }).catch(() => {});
    else navigator.clipboard.writeText(url).then(() => toast(I.check, 'Sauvegarde copiée'));
    return;
  }
  if (a === 'hide') { d.hidden = !d.hidden; saveDeck(d); closeMenu(); render(); toast(d.hidden ? I.eyeoff : I.eye); return; }
  if (a === 'share') {
    closeMenu();
    const url = location.origin + location.pathname + '#i=' +
      enc({ name: d.name, subject: d.subject, cards: d.cards.map(c => [c.f, c.b]) });
    if (navigator.share) navigator.share({ url }).catch(() => {});
    else navigator.clipboard.writeText(url).then(() => toast(I.check, 'Lien copié'));
    return;
  }
  if (a === 'del') {
    const lab = b.querySelector('span');
    if (b.dataset.arm) {
      db.decks = db.decks.filter(x => x.id !== d.id);
      delete dirty[d.id]; gone.push(d.id); save(); flush();
      closeMenu(); return go('home');
    }
    b.dataset.arm = 1; b.style.background = 'rgba(196,86,107,.12)'; lab.textContent = 'Confirmer la suppression';
    setTimeout(() => { if (b.isConnected) { delete b.dataset.arm; b.style.background = ''; lab.textContent = 'Supprimer'; } }, 3000);
  }
});

/* ---------- révision ---------- */
function startStudy(id, rev, subset) {
  const d = deck(id); if (!d || !d.cards.length) return;
  const ids = subset && subset.length ? subset.slice() : d.cards.map(c => c.id);
  study = { id, rev: !!rev, queue: shuffle(ids), i: 0, again: [], flip: false,
            ok: 0, total: ids.length, t0: Date.now(), tried: {}, missSet: {},
            miss: [], log: [], saved: false };
  go('study', id);
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
function fillRing(ok, total) {
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
function review(o) {
  const p = o.total ? o.ok / o.total : 0;
  const per = o.log.length ? o.ms / o.log.length : 0;
  const hist = o.hist || [];
  const tiles = [
    [o.total - o.ok, 'erreurs'],
    [bestRun(o.log), 'série'],
    [mmss(o.ms), 'durée'],
    [(per / 1000).toFixed(1).replace('.', ',') + 's', 'par carte']
  ];
  if (o.forced) tiles.splice(1, 0, [o.forced, 'forcées']);
  return `<div class="rev">
    ${ring(o.ok, o.total)}
    <div class="tiles">
      ${tiles.map(([v, l]) => `<div class="st"><b>${v}</b><span>${l}</span></div>`).join('')}
    </div>
    <div class="strip">${o.log.map(v => `<i class="${v ? 'y' : 'n'}"></i>`).join('')}</div>
    ${hist.length > 1 ? `<div class="lbl"><span>Sessions</span><span>${hist.length}</span></div>
      <div class="hist">${hist.slice(-12).map((h, i, a) =>
        `<div class="hb ${i === a.length - 1 ? 'now' : ''}"><i style="height:${Math.max(4, h.p * 100)}%"></i></div>`
      ).join('')}</div>` : ''}
    <div class="b">
      ${o.miss.length ? `<button data-act="${o.redo}">${svg(I.target)}Erreurs</button>` : ''}
      <button data-act="${o.again}">${svg(I.redo)}Rejouer</button>
      <button class="prim" data-act="${o.done}">${svg(I.check)}Fin</button>
    </div>
    ${o.miss.length ? `<div class="lbl"><span>À revoir</span><span>${o.miss.length}</span></div>
      <div class="miss">${o.miss.map((m, i) => `<div class="mr" style="animation-delay:${i * 22}ms">
        <div class="q">${esc(m.q)}</div>
        ${m.typed ? `<div class="w">${svg(I.x)}${esc(m.typed)}</div>` : ''}
        <div class="g">${svg(I.check)}${esc(m.a)}</div>
      </div>`).join('')}</div>` : ''}
  </div>`;
}

function studyView() {
  const d = deck(study.id); if (!d) return go('home');
  const s = subj(d.subject);
  const bar = n => `<div class="bar">
      <button class="ic" data-act="deck">${svg(I.back)}</button>
      <h1>${esc(d.name)}</h1>
      ${n}
      <button class="ic ${study.rev ? 'solid' : ''}" data-act="swap">${svg(I.swap)}</button>
      <button class="ic" data-act="restart">${svg(I.shuffle)}</button>
    </div>`;
  if (study.i >= study.queue.length) {
    if (study.again.length) { study.queue = study.again; study.again = []; study.i = 0; study.flip = false; }
    else {
      if (!study.saved) { study.saved = true; study.ms = Date.now() - study.t0;
        study.hist = pushHist(study.id, 'study', study.total ? study.ok / study.total : 0); }
      $.innerHTML = bar('') + review({
        ok: study.ok, total: study.total, log: study.log, ms: study.ms, hist: study.hist,
        miss: study.miss, redo: 'redostudy', again: 'restart', done: 'deck'
      });
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
  const c = cardOf(0);
  if (!c) { st.innerHTML = ''; return; }
  const front = study.rev ? c.b : c.f, back = study.rev ? c.f : c.b;
  st.innerHTML = `<div class="card in" id="top">
      <div class="flipper">
        <div class="face"><span>${esc(front)}</span></div>
        <div class="face bk"><span>${esc(back)}</span></div>
      </div>
      <div class="ov y">${svg(I.check)}</div>
      <div class="ov n">${svg(I.x)}</div>
    </div>`;
  const top = document.getElementById('top');
  requestAnimationFrame(() => top.classList.remove('in'));
  bindDrag(top);
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
  const id = study.queue[study.i];
  if (!study.tried[id]) { study.tried[id] = 1; if (ok) study.ok++; study.log.push(ok ? 1 : 0); }
  if (!ok) {
    study.again.push(id);
    if (!study.missSet[id]) {
      study.missSet[id] = 1;
      const c = deck(study.id).cards.find(x => x.id === id);
      if (c) study.miss.push({ id, q: study.rev ? c.b : c.f, a: study.rev ? c.f : c.b });
    }
  }
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
function near(x, y) {
  const a = strip(x), b = strip(y);
  if (a === b) return true;
  if (!a || !b) return false;
  const L = Math.max(a.length, b.length);
  const allow = L <= 4 ? 0 : L <= 9 ? 1 : Math.max(2, Math.round(L * 0.08));
  return lev(a, b) <= allow;
}
const parts = s => norm(s).split(/\s*[,;/·|]+\s*/).map(x => x.trim()).filter(Boolean);
// accepte l'ordre libre d'une énumération, et un seul synonyme d'une liste courte
function accepts(typed, answers) {
  for (const a of answers) {
    if (near(typed, a)) return true;
    const exp = parts(a), got = parts(typed);
    if (exp.length < 2) continue;
    if (got.length === exp.length) {
      const pool = exp.slice();
      let all = true;
      for (const g of got) {
        const k = pool.findIndex(e => near(g, e));
        if (k < 0) { all = false; break; }
        pool.splice(k, 1);
      }
      if (all) return true;
    }
    const synonyms = exp.every(e => e.split(' ').length <= 3);
    if (synonyms && got.length && got.length < exp.length &&
        got.every(g => exp.some(e => near(g, e)))) return true;
  }
  return false;
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
function startQuiz(id, pool, rev) {
  let src = id === 'all' ? live().flatMap(d => d.cards) : (deck(id) || { cards: [] }).cards;
  if (rev) src = src.map(c => ({ f: c.b, b: c.f }));
  const items = pool || shuffle(buildPool(src));
  if (!items.length) return;
  quiz = { id, rev: !!rev, name: id === 'all' ? 'Tout' : (deck(id) || {}).name || '',
           sub: id === 'all' ? '' : (deck(id) || {}).subject,
           pool: items, i: 0, ok: 0, bad: [], miss: [], log: [], forced: 0,
           t0: Date.now(), saved: false, state: 'ask', typed: '' };
  go('run');
}
function quizHome() {
  const used = db.subjects.filter(s => live().some(d => d.subject === s.id)).map(x => subj(x.id));
  const list = live().filter(d => !filter || d.subject === filter);
  const total = buildPool(live().flatMap(d => d.cards)).length;
  $.innerHTML = `
    <div class="page" id="page">
      <div class="top"><div class="hero">Quiz</div></div>
      ${used.length > 1 ? pills(filter, used, 'filt') : ''}
      ${live().length ? `<div class="grid">
        ${!filter ? `<button class="tile all" data-q="all" style="--i:0">
          <span class="n">Tout</span><span class="m">${svg(I.target)}${total}</span></button>` : ''}
        ${list.map((d, i) => `<button class="tile" data-q="${d.id}" style="${sty(subj(d.subject))};--i:${i + 1}">
          <span class="n">${esc(d.name)}</span>
          <span class="m">${svg(I.card)}${buildPool(d.cards).length}</span></button>`).join('')}
      </div>` : `<div class="empty">${svg(I.pen)}</div>`}
    </div>
    ${tabs('quiz')}`;
  bindPager();
}
function quizView() {
  const bar = n => `<div class="bar">
      <button class="ic" data-act="tab-quiz">${svg(I.back)}</button>
      <h1>${esc(quiz.name)}</h1>
      ${n}
      <button class="ic ${quiz.rev ? 'solid' : ''}" data-act="swapq">${svg(I.swap)}</button>
      <button class="ic" data-act="requiz">${svg(I.shuffle)}</button>
    </div>`;
  if (quiz.i >= quiz.pool.length) {
    const n = quiz.pool.length;
    if (!quiz.saved) { quiz.saved = true; quiz.ms = Date.now() - quiz.t0;
      quiz.hist = pushHist(quiz.id, 'quiz', n ? quiz.ok / n : 0); }
    $.innerHTML = bar('') + review({
      ok: quiz.ok, total: n, log: quiz.log, ms: quiz.ms, hist: quiz.hist, forced: quiz.forced,
      miss: quiz.miss, redo: 'redo', again: 'requiz', done: 'tab-quiz'
    });
    return fillRing(quiz.ok, n);
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
      ${quiz.state === 'bad' ? `<div class="duo" style="margin:11px 0 0">
          <button data-act="anyway">${svg(I.check)}Compter juste</button>
          <button class="prim" data-act="next">Suivant${svg(I.arrow)}</button>
        </div>`
        : `<button class="cta" style="margin-top:11px" data-act="${quiz.state === 'ask' ? 'send' : 'next'}">
            ${quiz.state === 'ask' ? 'Valider' : 'Suivant'}${svg(I.arrow)}</button>`}
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
  if (accepts(quiz.typed, q.a)) {
    quiz.ok++; quiz.log.push(1); quiz.state = 'good'; render();
    setTimeout(() => { if (quiz && quiz.state === 'good') nextQ(); }, 560);
  } else {
    quiz.bad.push(q); quiz.log.push(0);
    quiz.miss.push({ q: q.f, a: q.a.join('  ·  '), typed: quiz.typed.trim() });
    quiz.state = 'bad'; render();
  }
}
function nextQ() { quiz.i++; quiz.state = 'ask'; quiz.typed = ''; render(); }

/* ---------- création / import ---------- */
let comp = { subject: '', cards: [], edit: -1, bulk: false, text: '' };
const resetComp = () => { comp = { subject: '', cards: [], edit: -1, bulk: false, text: '' }; };

function importView() {
  const t = view.id ? deck(view.id) : null;
  const s = subj(t ? t.subject : comp.subject);
  $.innerHTML = `
    <div class="bar">
      <button class="ic" data-act="${t ? 'deck' : 'home'}">${svg(I.back)}</button>
      <h1>${t ? esc(t.name) : 'Nouveau paquet'}</h1>
      <button class="ic ${comp.bulk ? 'solid' : ''}" data-act="bulk">${svg(I.down)}</button>
    </div>
    <div class="sheet">
      ${t ? '' : `<div class="field"><input id="nm" placeholder="Nom du paquet" spellcheck="false"
        enterkeyhint="next" value="${esc(comp.name || '')}"></div>
        ${pills(comp.subject, db.subjects.map(x => subj(x.id)), 'nsubj')}`}
      ${comp.bulk ? `
        <div class="ta"><textarea id="tx" placeholder="chat = gatto&#10;chien = cane&#10;maison = casa"
          autocapitalize="off" autocorrect="off" spellcheck="false">${esc(comp.text)}</textarea></div>
        <div class="prev" id="prev"></div>
        <button class="cta" id="bulkadd" disabled>Ajouter${svg(I.plus)}</button>`
      : `
        <div class="comp" id="comp" style="${sty(s)}">
          <input id="cf" class="cf" placeholder="Recto" enterkeyhint="next" spellcheck="false">
          <div class="csep"></div>
          <input id="cb" class="cb" placeholder="Verso" enterkeyhint="done" spellcheck="false">
          <button class="cadd" id="cadd">${svg(comp.edit >= 0 ? I.check : I.plus)}</button>
        </div>
        <div class="lbl"><span>Cartes</span><span id="cn">${comp.cards.length}</span></div>
        <div class="dlist" id="dlist"></div>`}
      ${comp.bulk ? '' : `<button class="cta" id="ok" ${comp.cards.length ? '' : 'disabled'}>
        ${t ? 'Ajouter' : 'Créer'}${svg(I.check)}</button>`}
    </div>`;

  const nm = document.getElementById('nm');
  if (nm) nm.addEventListener('input', () => comp.name = nm.value);

  if (comp.bulk) {
    const tx = document.getElementById('tx'), prev = document.getElementById('prev'),
          add = document.getElementById('bulkadd');
    const up = () => {
      comp.text = tx.value;
      const cards = parseText(tx.value);
      add.disabled = !cards.length;
      add.firstChild.textContent = cards.length ? `Ajouter ${cards.length} ` : 'Ajouter';
      prev.innerHTML = cards.slice(0, 40).map((c, i) => `<div class="pr" style="animation-delay:${i * 18}ms">
        <span class="a">${esc(c.f)}</span>${svg(I.arrow)}<span class="b">${esc(c.b)}</span></div>`).join('');
    };
    const fit = () => { tx.style.height = 'auto'; tx.style.height = Math.min(tx.scrollHeight + 2, innerHeight * .3) + 'px'; };
    tx.addEventListener('input', () => { fit(); up(); }); fit(); up();
    setTimeout(() => tx.focus(), 60);
    add.onclick = () => {
      const cards = parseText(tx.value); if (!cards.length) return;
      comp.cards.push(...cards); comp.text = ''; comp.bulk = false;
      render(); toast(I.check, plur(cards.length, 'carte'));
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
    if (t) { t.cards.push(...cards.map(c => ({ id: uid(), f: c.f, b: c.b }))); saveDeck(t); resetComp(); go('deck', t.id); }
    else { const d = addDeck(comp.name, cards, comp.subject); resetComp(); go('deck', d.id); }
    toast(I.check, plur(cards.length, 'carte'));
  };
}

function paintDraft() {
  const l = document.getElementById('dlist'); if (!l) return;
  l.innerHTML = comp.cards.map((c, i) => `<div class="dc ${i === comp.edit ? 'on' : ''}" data-ed="${i}"
      style="animation-delay:${Math.min(i, 12) * 20}ms">
      <div class="tx"><b>${esc(c.f) || '—'}</b><span>${esc(c.b) || '—'}</span></div>
      <button class="x" data-dl="${i}">${svg(I.x)}</button>
    </div>`).reverse().join('');
  const n = document.getElementById('cn'); if (n) n.textContent = comp.cards.length;
  const ok = document.getElementById('ok'); if (ok) ok.disabled = !comp.cards.length;
}

/* ---------- interactions ---------- */
$.addEventListener('click', e => {
  const b = e.target.closest('[data-act],[data-go],[data-rm],[data-a],[data-q],[data-filt],[data-nsubj],[data-ed],[data-dl],[data-sub]');
  if (!b) return;
  const ds = b.dataset;
  if (ds.dl !== undefined) {
    const i = +ds.dl;
    comp.cards.splice(i, 1);
    if (comp.edit === i) comp.edit = -1; else if (comp.edit > i) comp.edit--;
    return render();
  }
  if (ds.ed !== undefined) { comp.edit = +ds.ed; return render(); }
  if (ds.filt !== undefined) { filter = ds.filt; render(); return; }
  if (ds.nsubj !== undefined) {
    comp.subject = ds.nsubj;
    $.querySelectorAll('[data-nsubj]').forEach(x => x.classList.toggle('on', x.dataset.nsubj === comp.subject));
    const c = document.getElementById('comp');
    if (c) c.setAttribute('style', sty(subj(comp.subject)));
    return;
  }
  if (ds.sub !== undefined) return openSubject(ds.sub || null);
  if (ds.go) return go('deck', ds.go);
  if (ds.q) return startQuiz(ds.q);
  if (ds.a) return fling(ds.a === 'yes' ? -1 : 1);
  if (ds.rm) { const d = deck(view.id); d.cards = d.cards.filter(c => c.id !== ds.rm); saveDeck(d); return render(); }
  const a = ds.act, d = view.id ? deck(view.id) : null;
  if (a === 'home' || a === 'tab-home') return go('home');
  if (a === 'tab-quiz') return go('quiz');
  if (a === 'peek') { peek = !peek; render(); return; }
  if (a === 'settings') return go('settings');
  if (a === 'backup2') return openMenu('backup');
  if (a === 'logout') return logout();
  if (a === 'puball') return openMenu('backup');
  if (a === 'new') { resetComp(); return go('import'); }
  if (a === 'paste') { resetComp(); return go('import', view.name === 'deck' ? view.id : null); }
  if (a === 'bulk') { comp.bulk = !comp.bulk; comp.edit = -1; return render(); }
  if (a === 'deck') return go('deck', (study && study.id) || view.id);
  if (a === 'menu') return openMenu('deck');
  if (a === 'study') return startStudy(view.id);
  if (a === 'quizdeck') return startQuiz(view.id);
  if (a === 'restart') return startStudy(study ? study.id : view.id, study && study.rev);
  if (a === 'swap') { toast(I.swap, study.rev ? 'Sens normal' : 'Sens inversé'); return startStudy(study.id, !study.rev); }
  if (a === 'swapq') { toast(I.swap, quiz.rev ? 'Sens normal' : 'Sens inversé'); return startQuiz(quiz.id, null, !quiz.rev); }
  if (a === 'anyway') {
    if (quiz.state !== 'bad') return;
    quiz.ok++; quiz.forced++; quiz.bad.pop(); quiz.miss.pop();
    quiz.log[quiz.log.length - 1] = 1;
    return nextQ();
  }
  if (a === 'redostudy') return startStudy(study.id, study.rev, study.miss.map(m => m.id));
  if (a === 'send') return submit();
  if (a === 'next') return nextQ();
  if (a === 'requiz') return startQuiz(quiz.id, null, quiz.rev);
  if (a === 'redo') return startQuiz(quiz.id, shuffle(quiz.bad.slice()), quiz.rev);
  if (a === 'add') {
    d.cards.push({ id: uid(), f: '', b: '' }); saveDeck(d); render();
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

function logout() {
  flush();
  const key = cacheKey();
  saveAuth(null);
  if (key) { try { localStorage.removeItem(key); } catch (e) {} }
  db = { subjects: [], decks: [], hist: {} };
  view = { name: 'login' }; filter = ''; peek = false;
  study = null; quiz = null; menu = null;
  animate = true; render();
}

/* ---------- démarrage ---------- */
async function boot() {
  if (!auth) { view = { name: 'login' }; return render(); }
  db = load();
  if (!consumeHash()) render();          // le cache s'affiche tout de suite
  try {
    if (auth.exp && Date.now() > auth.exp - 60000 && !(await refreshToken())) throw new Error('session');
    await pull();
    const n = await importLegacy();
    setOnline(true);
    render();
    if (n) toast(I.check, plur(n, 'paquet') + ' repris');
    flush();
  } catch (e) {
    if (/JWT|session|401/i.test(String(e.message || e))) { saveAuth(null); view = { name: 'login' }; render(); }
    else setOnline(false);
  }
}
boot();
window.addEventListener('hashchange', consumeHash);
window.addEventListener('online', flush);
document.addEventListener('visibilitychange', () => { if (!document.hidden) flush(); });
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!reloaded) { reloaded = true; location.reload(); }
  });
}
