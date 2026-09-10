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
let study = null, quiz = null, menu = null, typing = 0, pendingGrade = null;
let dirty = {}, gone = [], online = true;

function loadAuth() { try { return JSON.parse(localStorage.getItem(AKEY)); } catch (e) { return null; } }
function saveAuth(a) { auth = a; a ? localStorage.setItem(AKEY, JSON.stringify(a)) : localStorage.removeItem(AKEY); }
const cacheKey = () => 'cartes.cache.' + (auth && auth.uid);

/* ---------- réglages du compte ----------
   simple  : moteur coupé, on ne fait plus que swiper
   simpleAt: date de bascule, pour étaler l'arriéré au retour du moteur       */
const DEFPREFS = { goal: 30, cap: 20, order: 'random', fresh: true, sound: false,
                   font: 1, tol: 'normal', name: '', simple: false, simpleAt: 0 };
let prefs = { ...DEFPREFS };
let prefsTimer = 0;

function load() {
  try {
    const d = JSON.parse(localStorage.getItem(cacheKey()));
    if (d && Array.isArray(d.decks)) {
      prefs = { ...DEFPREFS, ...(d.prefs || {}) };     // le mode reste le bon hors ligne
      return { subjects: d.subjects || [], decks: d.decks, hist: d.hist || {}, today: d.today };
    }
  } catch (e) {}
  return { subjects: [], decks: [], hist: {} };
}
function save() {
  if (auth) localStorage.setItem(cacheKey(), JSON.stringify({ ...db, prefs }));
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
async function signUp(email, password) {
  const r = await fetch(SB.url + '/auth/v1/signup', {
    method: 'POST', headers: { apikey: SB.key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim().toLowerCase(), password })
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.msg || j.error_description || j.message || 'Inscription refusée');
  if (j.access_token) { keepSession(j); return true; }
  return false;                       // confirmation par e-mail exigée par le projet
}
async function resetPassword(email) {
  const r = await fetch(SB.url + '/auth/v1/recover', {
    method: 'POST', headers: { apikey: SB.key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim().toLowerCase() })
  });
  if (!r.ok) throw new Error('Envoi impossible');
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
                      hidden: !!d.hidden, cards: d.cards, pos: d.pos || 0,
                      pinned: !!d.pinned, meta: d.meta || {} });
/* réglages propres à un paquet : tolérance du quiz, langue de lecture, chrono */
const DEFMETA = { tol: 'normal', lang: '', timer: 0 };
const metaOf = d => ({ ...DEFMETA, ...((d && d.meta) || {}) });
function setMeta(d, patch) { d.meta = { ...metaOf(d), ...patch }; saveDeck(d); }

/* pousse tout ce qui est en attente ; garde la file si le réseau manque */
let flushTimer = 0;
function scheduleFlush() { clearTimeout(flushTimer); flushTimer = setTimeout(flush, 2500); }
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
  const midnight = new Date(); midnight.setHours(0, 0, 0, 0);
  const [subs, decks, sess, pf, today] = await Promise.all([
    api('/rest/v1/subjects?select=*&order=pos.asc'),
    api('/rest/v1/decks?select=*&deleted_at=is.null&order=pos.asc'),
    api('/rest/v1/sessions?select=deck_id,mode,pct,created_at&order=created_at.asc'),
    api('/rest/v1/prefs?select=*'),
    api(`/rest/v1/reviews?select=id&created_at=gte.${midnight.toISOString()}`)
  ]);
  const wasSimple = prefs.simple;
  prefs = { ...DEFPREFS, ...((pf && pf[0] && pf[0].data) || {}) };
  if (pf && pf[0] && pf[0].name) prefs.name = pf[0].name;
  if (study && prefs.simple !== wasSimple) prefs.simple = wasSimple;   // pas de bascule à chaud
  db.today = { d: +midnight, n: (today || []).length };
  db.subjects = subs.map(x => ({ id: x.id, name: x.name, color: x.color, pos: x.pos }));
  db.decks = decks.map(x => ({
    id: x.id, name: x.name, subject: x.subject, hidden: x.hidden,
    pos: x.pos, pinned: x.pinned, meta: x.meta || {},
    cards: (x.cards || []).map(c => ({ ...c, id: c.id || uid() }))
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
  exit: '<path d="M9.5 4.5H6a1.9 1.9 0 0 0-1.9 1.9v11.2A1.9 1.9 0 0 0 6 19.5h3.5"/><path d="M13.5 8.2l3.8 3.8-3.8 3.8M17 12H9.5"/>',
  spark: '<path d="M11 3.6l1.6 4.4 4.4 1.6-4.4 1.6L11 15.6 9.4 11.2 5 9.6l4.4-1.6z"/><path d="M18 14.6l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7z"/>',
  sound: '<path d="M4.5 9.4h3L12 5.8v12.4L7.5 14.6h-3z"/><path d="M15.9 9.4a3.6 3.6 0 0 1 0 5.2M18.3 7a7 7 0 0 1 0 10"/>',
  mute: '<path d="M4.5 9.4h3L12 5.8v12.4L7.5 14.6h-3z"/><path d="M16 9.6l4.4 4.8M20.4 9.6L16 14.4"/>',
  mic: '<rect x="9" y="3.2" width="6" height="11" rx="3"/><path d="M5.5 11.4a6.5 6.5 0 0 0 13 0M12 18v2.8"/>',
  image: '<rect x="3" y="5" width="18" height="14" rx="3.2"/><circle cx="8.6" cy="10" r="1.5"/><path d="M4.2 17.4l4.6-4.3 3.4 3 3-2.6 4.6 4"/>',
  clock: '<circle cx="12" cy="12" r="8.4"/><path d="M12 7.4V12l3.2 2"/>',
  bulb: '<path d="M9.6 17.6h4.8M10.2 20.4h3.6"/><path d="M12 3.6a5.6 5.6 0 0 0-3.3 10.1c.6.5 1 1.2 1 1.9h4.6c0-.7.4-1.4 1-1.9A5.6 5.6 0 0 0 12 3.6z"/>',
  flame: '<path d="M12 3.5c3 3 4.8 5.3 4.8 8.2a4.8 4.8 0 1 1-9.6 0c0-1.7.8-3.2 2-4.4.1 1.6.8 2.5 1.7 2.5 1 0 1.6-.9 1.6-2.4 0-1.4-.3-2.7-.5-3.9z"/>',
  grid: '<rect x="3.6" y="3.6" width="7" height="7" rx="2"/><rect x="13.4" y="3.6" width="7" height="7" rx="2"/><rect x="3.6" y="13.4" width="7" height="7" rx="2"/><rect x="13.4" y="13.4" width="7" height="7" rx="2"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l2.8-2.8a4 4 0 0 0-5.7-5.7L11.4 6.9"/><path d="M14 10a4 4 0 0 0-5.7 0L5.5 12.8a4 4 0 0 0 5.7 5.7l1.4-1.4"/>',
  type: '<path d="M4.5 7.5V5.5h15v2M12 5.5v13M8.8 18.5h6.4"/>',
  skip: '<path d="M6 5.6l9 6.4-9 6.4z"/><path d="M18 5.6v12.8"/>',
  brain: '<path d="M12 5.6v12.8"/><path d="M12 6.6a2.5 2.5 0 1 0-3.5 2.3 2.5 2.5 0 0 0-.9 4.6 2.5 2.5 0 0 0 4.4 1.7"/><path d="M12 6.6a2.5 2.5 0 1 1 3.5 2.3 2.5 2.5 0 0 1 .9 4.6 2.5 2.5 0 0 1-4.4 1.7"/>'
};
const svg = p => `<svg viewBox="0 0 24 24">${p}</svg>`;
const SWIPE = `<svg viewBox="0 0 72 24">${I.swipe}</svg>`;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const plur = (n, w) => `${n} ${w}${n > 1 ? 's' : ''}`;

/* ---------- rendu du contenu d'une carte ----------
   Sous-ensemble volontairement étroit : ce qu'on écrit vraiment sur une fiche.
   **gras**, *italique*, __souligné__, retours à la ligne, listes à puces,
   et $formule$ pour les matières scientifiques. Aucune dépendance : l'app
   doit continuer de démarrer hors ligne et de tenir dans un cache.          */
const GREEK = { alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε',
  zeta: 'ζ', eta: 'η', theta: 'θ', iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν',
  xi: 'ξ', pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', upsilon: 'υ', phi: 'φ', varphi: 'φ',
  chi: 'χ', psi: 'ψ', omega: 'ω', Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ',
  Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω' };
const OPS = { times: '×', div: '÷', pm: '±', mp: '∓', cdot: '·', ast: '∗',
  le: '≤', leq: '≤', ge: '≥', geq: '≥', ne: '≠', neq: '≠', approx: '≈', equiv: '≡',
  infty: '∞', to: '→', rightarrow: '→', Rightarrow: '⇒', leftarrow: '←', Leftarrow: '⇐',
  leftrightarrow: '↔', Leftrightarrow: '⇔', mapsto: '↦', sum: '∑', prod: '∏', int: '∫',
  oint: '∮', partial: '∂', nabla: '∇', in: '∈', notin: '∉', ni: '∋', subset: '⊂',
  subseteq: '⊆', supset: '⊃', cup: '∪', cap: '∩', setminus: '∖', emptyset: '∅',
  varnothing: '∅', forall: '∀', exists: '∃', nexists: '∄', angle: '∠', perp: '⊥',
  parallel: '∥', circ: '∘', deg: '°', prime: '′', ldots: '…', cdots: '⋯', dots: '…',
  neg: '¬', land: '∧', lor: '∨', therefore: '∴', because: '∵', propto: '∝', sim: '∼',
  simeq: '≃', cong: '≅', hbar: 'ℏ', ell: 'ℓ', aleph: 'ℵ', star: '⋆', bullet: '•',
  oplus: '⊕', otimes: '⊗', bot: '⊥', top: '⊤' };

/* LaTeX → HTML sur le sous-ensemble scolaire : fractions, racines, indices,
   exposants, lettres grecques et opérateurs. Ce qui n'est pas reconnu est
   rendu tel quel plutôt que perdu. */
function mathHtml(src) {
  let i = 0, out = '';
  const grp = () => {
    while (src[i] === ' ') i++;
    if (src[i] === '{') {
      const start = ++i;
      let depth = 1;
      while (i < src.length && depth) { if (src[i] === '{') depth++; else if (src[i] === '}') depth--; i++; }
      return mathHtml(src.slice(start, i - 1));
    }
    if (src[i] === '\\') {
      const j = i++;
      while (/[a-zA-Z]/.test(src[i] || '')) i++;
      return mathHtml(src.slice(j, i));
    }
    return esc(src[i++] || '');
  };
  while (i < src.length) {
    const ch = src[i];
    if (ch === '\\') {
      let j = i + 1, name = '';
      while (/[a-zA-Z]/.test(src[j] || '')) name += src[j++];
      i = j;
      if (!name) { out += esc(src[i] || ''); i++; }
      else if (name === 'frac' || name === 'dfrac' || name === 'tfrac') {
        const a = grp(), b = grp();
        out += `<span class="fr"><i>${a}</i><i>${b}</i></span>`;
      } else if (name === 'sqrt') {
        let idx = '';
        if (src[i] === '[') {
          const k = src.indexOf(']', i);
          if (k > 0) { idx = mathHtml(src.slice(i + 1, k)); i = k + 1; }
        }
        out += `<span class="rt">${idx ? `<i class="ri">${idx}</i>` : ''}<i class="rs">√</i><i class="rb">${grp()}</i></span>`;
      } else if (name === 'text' || name === 'mathrm' || name === 'mbox') {
        out += `<span class="tx">${grp()}</span>`;
      } else if (name === 'left' || name === 'right' || name === 'displaystyle') { /* le délimiteur suit */ }
      else if (GREEK[name]) out += GREEK[name];
      else if (OPS[name]) out += OPS[name];
      else out += esc(name);
      continue;
    }
    if (ch === '^') { i++; out += `<sup>${grp()}</sup>`; continue; }
    if (ch === '_') { i++; out += `<sub>${grp()}</sub>`; continue; }
    i++;
    out += esc(ch);
  }
  return out;
}

/* Texte d'une carte → HTML. Toujours passer par ici, jamais par esc() seul :
   c'est le seul endroit qui échappe et met en forme d'un coup. */
const MK = '\u0001';
function rt(s) {
  s = String(s == null ? '' : s);
  const math = [];
  s = s.replace(/\$([^$\n]+)\$/g, (_, m) => MK + (math.push(mathHtml(m)) - 1) + MK);
  const inl = t => esc(t)
    .replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<i>$2</i>')
    .replace(/__([^_\n]+)__/g, '<u>$1</u>')
    .replace(new RegExp(MK + '(\\d+)' + MK, 'g'), (_, k) => `<span class="mth">${math[+k]}</span>`);
  const out = [];
  let list = null;
  for (const raw of s.split(/\r?\n/)) {
    const m = /^\s*(?:[-*•·–]|\d+[.)])\s+(.+)$/.exec(raw);
    if (m) { (list = list || []).push(`<li>${inl(m[1])}</li>`); continue; }
    if (list) { out.push(`<ul>${list.join('')}</ul>`); list = null; }
    if (raw.trim()) out.push(inl(raw));
  }
  if (list) out.push(`<ul>${list.join('')}</ul>`);
  return out.join('<br>').replace(/<br>(?=<ul>)/g, '').replace(/<\/ul><br>/g, '</ul>');
}
/* Version texte brut : comparaison de réponses, recherche, synthèse vocale.
   Les symboles connus sont traduits plutôt que supprimés, sinon « πr² » se
   lirait « r ». */
const plain = s => String(s == null ? '' : s)
  .replace(/\$([^$\n]+)\$/g, '$1')
  .replace(/\\(?:d|t)?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '($1)/($2)')
  .replace(/\\sqrt\s*(?:\[[^\]]*\])?\s*\{([^{}]*)\}/g, '√($1)')
  .replace(/\\(?:text|mathrm|mbox)\s*\{([^{}]*)\}/g, '$1')
  .replace(/\\([a-zA-Z]+)/g, (m, n) => GREEK[n] || OPS[n] || n)
  .replace(/[*_`{}]/g, '')
  .replace(/\s+/g, ' ').trim();

/* ---------- médias ----------
   Les fichiers partent dans le seau « media » du projet, sous un dossier au
   nom du compte : les règles d'accès n'autorisent l'écriture que là. */
async function upload(file) {
  if (!auth) throw new Error('auth');
  if (file.size > 7.5e6) throw new Error('big');
  const ext = ((file.name || '').split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
  const path = `${auth.uid}/${uid()}.${ext}`;
  if (auth.exp && Date.now() > auth.exp - 60000) await refreshToken();
  const r = await fetch(`${SB.url}/storage/v1/object/media/${path}`, {
    method: 'POST',
    headers: { apikey: SB.key, Authorization: 'Bearer ' + auth.token,
               'Content-Type': file.type || 'application/octet-stream', 'x-upsert': 'true' },
    body: file
  });
  if (!r.ok) throw new Error('up');
  return `${SB.url}/storage/v1/object/public/media/${path}`;
}
/* Choisit un fichier sans laisser d'input traîner dans le DOM. */
function pickFile(accept) {
  return new Promise(res => {
    const i = document.createElement('input');
    i.type = 'file'; i.accept = accept; i.style.display = 'none';
    i.onchange = () => { res(i.files && i.files[0]); i.remove(); };
    document.body.appendChild(i); i.click();
  });
}
let recorder = null, recChunks = [];
const REC = typeof MediaRecorder !== 'undefined' &&
            typeof navigator !== 'undefined' && !!(navigator.mediaDevices || {}).getUserMedia;
async function recStart() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  recChunks = [];
  recorder = new MediaRecorder(stream);
  recorder.ondataavailable = e => { if (e.data && e.data.size) recChunks.push(e.data); };
  recorder.onstop = () => stream.getTracks().forEach(t => t.stop());
  recorder.start();
}
function recStop() {
  return new Promise(res => {
    if (!recorder) return res(null);
    const r = recorder; recorder = null;
    r.addEventListener('stop', () => {
      const b = new Blob(recChunks, { type: r.mimeType || 'audio/webm' });
      b.name = 'voix.webm';
      res(b);
    }, { once: true });
    r.stop();
  });
}
/* Dictée : le navigateur transcrit, l'app corrige comme une réponse tapée. */
const ASRC = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
function listen(lang, done) {
  if (!ASRC) return null;
  try {
    const r = new ASRC();
    r.lang = lang || 'fr-FR';
    r.interimResults = false;
    r.maxAlternatives = 3;
    r.onresult = e => done([...e.results[0]].map(x => x.transcript));
    r.onerror = () => done(null);
    r.onend = () => done(undefined);
    r.start();
    return r;
  } catch (e) { return null; }
}

/* ---------- son ----------
   Deux sources : un enregistrement attaché à la carte, ou la synthèse vocale
   du navigateur quand le paquet déclare une langue. Aucun fichier à héberger
   dans le second cas. */
const TTS = typeof speechSynthesis !== 'undefined';
const LANGS = [['', 'Aucune'], ['fr-FR', 'Français'], ['it-IT', 'Italien'],
               ['en-GB', 'Anglais'], ['es-ES', 'Espagnol'], ['de-DE', 'Allemand']];
let player = null;
function play(url) {
  try {
    if (player) player.pause();
    player = new Audio(url);
    player.play().catch(() => {});
  } catch (e) {}
}
function say(text, lang) {
  const t = plain(text);
  if (!TTS || !t) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(t);
    if (lang) u.lang = lang;
    u.rate = 0.95;
    speechSynthesis.speak(u);
  } catch (e) {}
}


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


/* ---------- moteur de planification ----------
   État par carte, rangé dans la carte elle-même :
   d = échéance (ms) · i = intervalle (jours) · e = facilité · n = réussites
   l = rechutes · x = suspendue · fl = signalée coriace                       */
const DAY = 864e5;
const MIN = 6e4;
const cstate = c => {
  if (c.x) return 'susp';
  if (!c.n) return 'new';
  if (!c.i || c.i < 1) return 'learn';
  return c.i < 21 ? 'young' : 'mature';
};
const STATE = { new: 'Nouvelle', learn: 'En apprentissage', young: 'Jeune',
                mature: 'Mûre', susp: 'Suspendue' };
const isLeech = c => (c.l || 0) >= 4;
const isDue = c => !c.x && (!c.d || c.d <= Date.now());

/* Échelons de reprise recommandés en pédagogie scolaire.
   Ebbinghaus pour la forme de la courbe, Cepeda & Pashler pour l'écart :
   l'espacement optimal vaut 10 à 20 % de l'horizon visé, d'où J+1, J+3,
   J+7, J+15, J+30 — la série enseignée en collège et lycée — puis on
   double jusqu'à l'année. Rien n'est calculé au hasard : la carte monte
   d'un échelon quand elle passe, redescend d'un quand elle résiste. */
const LADDER = [1, 3, 7, 15, 30, 60, 120, 240, 365];
const rung = i => { for (let k = LADDER.length - 1; k >= 0; k--) if (i >= LADDER[k] - .01) return k; return -1; };
const step = k => LADDER[Math.max(0, Math.min(LADDER.length - 1, k))];

/* rating : 0 encore · 1 difficile · 2 correct · 3 facile */
function grade(c, rating) {
  const now = Date.now();
  c.e = Math.min(2.9, Math.max(1.3, (c.e || 2.5) + [-0.2, -0.15, 0, 0.15][rating]));
  const known = c.n && c.i >= 1;
  if (rating === 0) {                          // rechute : retour à l'apprentissage
    c.l = (c.l || 0) + 1;
    c.i = 0;
    c.d = now + (known ? 10 * MIN : MIN);      // une carte connue qui tombe reprend plus tard
  } else if (!known) {                         // paliers du jour, puis première reprise
    c.i = rating === 1 ? 0 : rating === 2 ? 1 : 3;
    c.d = rating === 1 ? now + 10 * MIN : now + c.i * DAY;
  } else {                                     // sur l'échelle
    const k = rung(c.i);
    const up = rating === 3 ? 2 : c.e < 1.9 ? 0 : 1;   // carte pénible : on ne monte pas
    c.i = step(rating === 1 ? k - 1 : k + up);
    c.d = now + c.i * DAY;
  }
  c.n = (c.n || 0) + (rating > 0 ? 1 : 0);
  return c;
}
/* Formulation lisible du prochain passage */
function nextIn(c) {
  if (!c.d) return '';
  const ms = c.d - Date.now();
  if (ms <= 0) return 'maintenant';
  if (ms < 45 * MIN) return Math.max(1, Math.round(ms / MIN)) + ' min';
  if (ms < DAY) return Math.round(ms / (60 * MIN)) + ' h';
  const j = Math.round(ms / DAY);
  return j < 31 ? j + ' j' : Math.round(j / 30) + ' mois';
}
/* Ce que proposerait chaque bouton, pour l'afficher dessus */
function preview(c, rating) {
  const copy = { ...c };
  grade(copy, rating);
  return nextIn(copy);
}

/* ---------- génération de cartes ----------
   La clé Anthropic n'est jamais ici. app.js est servi par GitHub Pages, donc
   public : la clé vit dans un secret de la fonction Supabase « ai », qui seule
   parle à l'API. L'app n'envoie que le texte, avec son jeton de session. */
const AIERR = {
  budget: 'Budget IA atteint', quota: 'Quota du jour atteint',
  long: 'Texte trop long', short: 'Texte trop court',
  nokey: 'IA non configurée', empty: 'Rien à extraire'
};
async function aiCards(text, hint) {
  if (auth && auth.exp && Date.now() > auth.exp - 60000) await refreshToken();
  const call = () => fetch(SB.url + '/functions/v1/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SB.key,
               Authorization: 'Bearer ' + (auth && auth.token) },
    body: JSON.stringify({ op: 'cards', text, hint: hint || '' })
  });
  let r = await call();
  if (r.status === 401 && auth && auth.refresh && await refreshToken()) r = await call();
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'net');
  return (j.cards || []).map(c => ({
    f: String(c.f || '').replace(/[\t\r\n]+/g, ' ').trim(),
    b: String(c.b || '').replace(/[\t\r\n]+/g, ' ').trim()
  })).filter(c => c.f && c.b);
}

/* ---------- construction d'une file ---------- */
function buildQueue(cards, o = {}) {
  let list = cards.filter(c => !c.x || o.susp);
  if (o.only === 'due') list = list.filter(isDue);
  if (o.only === 'leech') list = list.filter(isLeech);
  const fresh = list.filter(c => !c.n), seen = list.filter(c => c.n);
  const cap = o.cap != null ? o.cap : prefs.cap;
  const kept = cap > 0 ? fresh.slice(0, cap) : fresh;
  if (o.order === 'deck') list = [...kept, ...seen];
  else if (o.order === 'worst') list = [...kept, ...seen].sort((a, b) => (b.l || 0) - (a.l || 0));
  else if (o.order === 'due') list = [...kept, ...seen].sort((a, b) => (a.d || 0) - (b.d || 0));
  else if (o.fresh) list = [...shuffle(kept), ...shuffle(seen)];
  else list = shuffle([...kept, ...seen]);
  if (o.limit > 0) list = list.slice(0, o.limit);
  return list;
}
const dueCount = d => d.cards.filter(c => !c.x && isDue(c)).length;

/* ---------- mode simple ----------
   Le moteur est coupé : plus d'échéance, plus de note, on swipe et c'est tout.
   Rien n'est effacé. d, i, e, n, l restent inscrits dans chaque carte et
   reprennent exactement où ils en étaient le jour où le moteur revient. */
const simpleMode = () => !!prefs.simple;
const allCards = () => db.decks.flatMap(d => d.cards.map(c => [c, d]));
/* ce qui retombera d'un coup si on rallume le moteur maintenant */
const backlog = () => allCards().filter(([c]) => !c.x && c.n && c.d && c.d <= Date.now()).length;
/* Rallumage : sans étalement tout l'arriéré retombe le même jour et la
   reprise devient ingérable. On répartit sur autant de jours qu'il faut
   pour tenir l'objectif quotidien, les plus vieilles cartes en premier. */
function spreadBacklog() {
  const now = Date.now();
  const late = allCards().filter(([c]) => !c.x && c.n && c.d && c.d <= now)
    .sort((a, b) => (a[0].d || 0) - (b[0].d || 0));
  const per = Math.max(5, prefs.goal || 30);
  if (late.length <= per) return 0;
  const touched = {};
  late.forEach(([c, d], i) => {
    const day = Math.floor(i / per);
    if (!day) return;
    c.d = now + day * DAY;
    touched[d.id] = 1;
  });
  Object.keys(touched).forEach(id => { dirty[id] = 1; });
  save(); flush();
  return Math.ceil(late.length / per);
}

function savePrefs() {
  clearTimeout(prefsTimer);
  prefsTimer = setTimeout(() => {
    save();                                            // le cache local garde le mode
    api('/rest/v1/prefs', 'POST', [{ user_id: auth.uid, name: prefs.name || null, data: prefs }],
      { Prefer: 'resolution=merge-duplicates,return=minimal' }).catch(() => setOnline(false));
  }, 400);
}
/* Progression du jour, pour l'anneau d'objectif */
function todayCount() {
  const day = new Date(); day.setHours(0, 0, 0, 0);
  return (db.today && db.today.d === +day) ? db.today.n : 0;
}
function bumpToday() {
  const day = new Date(); day.setHours(0, 0, 0, 0);
  if (!db.today || db.today.d !== +day) db.today = { d: +day, n: 0 };
  db.today.n++;
  save();
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
  /* sans barre d'onglets (réglages, révision, quiz) le toast descend d'autant */
  if (!document.querySelector('.tabs')) n.style.bottom = 'calc(22px + env(safe-area-inset-bottom))';
  document.body.appendChild(n); tt = setTimeout(() => n.remove(), 1600);
}

/* ---------- rendu ---------- */
let animate = true;
function render() {
  const v = { home, deck: deckView, study: studyView, import: importView, quiz: quizHome,
              run: quizView, login: loginView, settings: settingsView };
  (v[view.name] || home)();
  $.dataset.view = view.name;
  paintRail();
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
  closeMenu();
  if (name !== 'run') stopTimer();
  pageDir = dir || 0; view = { name, id }; animate = !dir;
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

function paintRail() {
  let r = document.getElementById('rail');
  if (!auth || view.name === 'login') { if (r) r.remove(); return; }
  if (!r) { r = document.createElement('aside'); r.id = 'rail'; document.body.appendChild(r); }
  const on = /quiz|run/.test(view.name) ? 'quiz' : view.name === 'settings' ? 'settings' : 'home';
  r.innerHTML = `
    <div class="brand"><img src="icons/icon-192.png" alt=""><span>Cartes</span></div>
    <nav>
      <button class="${on === 'home' ? 'on' : ''}" data-r="home">${svg(I.layers)}<span>Paquets</span></button>
      <button class="${on === 'quiz' ? 'on' : ''}" data-r="quiz">${svg(I.pen)}<span>Quiz</span></button>
    </nav>
    <div class="sp"></div>
    <nav>
      <button class="${on === 'settings' ? 'on' : ''}" data-r="settings">${svg(I.gear)}<span>Réglages</span></button>
    </nav>
    <div class="who">${svg(I.user)}<span>${esc(prefs.name || auth.email)}</span></div>`;
  r.onclick = e => {
    const b = e.target.closest('[data-r]'); if (!b) return;
    go(b.dataset.r === 'quiz' ? 'quiz' : b.dataset.r === 'settings' ? 'settings' : 'home');
  };
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

const tile = (d, i) => {
  const due = simpleMode() ? 0 : dueCount(d);
  return `<button class="tile ${d.hidden ? 'mute' : ''}" data-go="${d.id}" style="${sty(subj(d.subject))};--i:${i}">
  ${due ? `<i class="due">${due}</i>` : ''}
  <span class="n">${esc(d.name)}</span>
  <span class="m">${svg(d.hidden ? I.eyeoff : I.card)}${d.cards.length}</span>
</button>`;
};
/* Anneau d'objectif du jour, en tête de l'accueil */
function goalRing() {
  const n = todayCount(), g = Math.max(1, prefs.goal || 30);
  const p = Math.min(1, n / g);
  return `<button class="goal" data-act="goalinfo" title="${n} / ${g} aujourd'hui">
    <svg viewBox="0 0 44 44"><circle class="b" cx="22" cy="22" r="18"/>
      <circle class="f" cx="22" cy="22" r="18"
        style="stroke-dasharray:113;stroke-dashoffset:${(113 * (1 - p)).toFixed(1)}"/></svg>
    <b>${n}</b></button>`;
}

function home() {
  const used = db.subjects.filter(s => db.decks.some(d => d.subject === s.id && (peek || !d.hidden))).map(x => subj(x.id));
  const hidden = db.decks.some(d => d.hidden);
  const list = db.decks.filter(d => (peek || !d.hidden) && (!filter || d.subject === filter));
  $.innerHTML = `
    <div class="page" id="page">
      <div class="top">
        <div class="hero">Mes paquets</div>
        <span id="offdot" class="off-dot" style="display:${online ? 'none' : ''}"></span>
        ${goalRing()}
        <button class="ic" data-act="settings">${svg(I.gear)}</button>
        ${hidden ? `<button class="ic ${peek ? 'solid' : ''}" data-act="peek">${svg(peek ? I.eye : I.eyeoff)}</button>` : ''}
      </div>
      ${resumeBanner()}
      ${used.length > 1 ? pills(filter, used, 'filt') : ''}
      ${list.length ? `<div class="grid">${list.map(tile).join('')}</div>`
        : `<div class="empty">${svg(I.layers)}</div>`}
      ${!simpleMode() && allDue() ? `<button class="marathon" data-act="marathon">${svg(I.shuffle)}
        <span>Marathon</span><i>${allDue()} cartes dues, toutes matières</i></button>` : ''}
    </div>
    <button class="fab" data-act="new">${svg(I.plus)}<span>Nouveau paquet</span></button>
    ${tabs('home')}`;
  bindPager();
}

const allDue = () => live().reduce((a, d) => a + dueCount(d), 0);
function resumeBanner() {
  const r = loadResume();
  if (!r) return '';
  const left = r.queue.length - r.i;
  return `<button class="resume" data-act="resume">${svg(I.play)}
    <span>Reprendre ${esc(r.name || '')}</span><i>${left} carte${left > 1 ? 's' : ''} restante${left > 1 ? 's' : ''}</i></button>`;
}
/* Répartition nouvelle / apprentissage / jeune / mûre, en une barre */
function mixBar(d) {
  const n = d.cards.length; if (!n) return '';
  const k = { new: 0, learn: 0, young: 0, mature: 0, susp: 0 };
  d.cards.forEach(c => k[cstate(c)]++);
  const seg = ['new', 'learn', 'young', 'mature', 'susp']
    .filter(x => k[x]).map(x => `<i class="${x}" style="flex:${k[x]}" title="${STATE[x]} : ${k[x]}"></i>`).join('');
  const leech = d.cards.filter(isLeech).length;
  return `<div class="mixwrap">
    <div class="mix">${seg}</div>
    <div class="mixk">
      ${['new', 'learn', 'young', 'mature'].filter(x => k[x])
        .map(x => `<span><i class="${x}"></i>${STATE[x]} ${k[x]}</span>`).join('')}
      ${leech ? `<span class="lee">${svg(I.target)}${leech} coriace${leech > 1 ? 's' : ''}</span>` : ''}
    </div></div>`;
}
/* Une carte est « enrichie » dès qu'elle porte autre chose que deux textes. */
const cardRich = c => !!(c.t || c.fi || c.bi || c.fa || c.ba || (c.g || []).length);
const cardIcon = c => c.t === 'tf' ? I.type : (c.fi || c.bi) ? I.image
                    : (c.fa || c.ba) ? I.sound : (c.g || []).length ? I.tag : I.more;

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
        <span>${svg(I.tag)}${esc(s.name)}</span><b></b>
        <span>${svg(I.card)}${plur(d.cards.length, 'carte')}</span>
        ${!simpleMode() && dueCount(d) ? `<b></b><span>${svg(I.play)}${dueCount(d)} à revoir</span>` : ''}
        ${d.hidden ? `<b></b><span>${svg(I.eyeoff)}Masqué</span>` : ''}
      </div>
    </div>
    <div class="duo">
      <button class="prim" data-act="study">${svg(I.play)}Réviser</button>
      <button data-act="quizdeck">${svg(I.pen)}Quiz</button>
    </div>
    ${simpleMode() ? '' : mixBar(d)}
    <div class="lbl"><span>Cartes</span><span>${d.cards.length}</span></div>
    <div class="rows">
      ${d.cards.map((c, i) => `
        <div class="row ${c.x ? 'off' : ''}" data-id="${c.id}" style="--i:${i}">
          ${simpleMode() ? '' : `<i class="cst ${cstate(c)}" title="${STATE[cstate(c)]}${isLeech(c) ? ' · coriace' : ''}${c.d ? ' · dans ' + nextIn(c) : ''}"></i>`}
          <div class="fl">
            <input value="${esc(c.f)}" data-k="f" placeholder="Recto">
            <input class="b" value="${esc(c.b)}" data-k="b" placeholder="Verso">
          </div>
          <button class="x ${cardRich(c) ? 'on' : ''}" data-card="${c.id}"
            title="Type, étiquettes, image, son">${svg(cardIcon(c))}</button>
          <button class="x sus ${c.x ? 'on' : ''}" data-sus="${c.id}"
            title="${c.x ? 'Réactiver' : 'Suspendre'}">${svg(c.x ? I.eyeoff : I.eye)}</button>
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
let loginBusy = false, loginMode = 'in';
function loginView() {
  const up = loginMode === 'up';
  $.innerHTML = `<div class="login">
    <img class="logo" src="icons/icon-192.png" alt="">
    <div class="lt">Cartes</div>
    <div class="seg lseg" id="lmode">
      <button data-lm="in" class="${up ? '' : 'on'}">Connexion</button>
      <button data-lm="up" class="${up ? 'on' : ''}">Créer un compte</button>
    </div>
    <form class="lf" id="lf" autocomplete="on">
      <div class="lrow">${svg(I.mail)}
        <input id="em" type="email" placeholder="Adresse e-mail" autocomplete="username"
          autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="next"></div>
      <div class="lrow">${svg(I.lock)}
        <input id="pw" type="password" placeholder="Mot de passe" autocomplete="current-password"
          autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="go">
        <button type="button" class="peek" id="pk">${svg(I.eye)}</button></div>
      <div class="lerr" id="le"></div>
      <button class="cta" id="go" type="submit">${up ? 'Créer le compte' : 'Se connecter'}${svg(I.arrow)}</button>
      ${up ? '' : `<button class="lnk" id="forgot" type="button">Mot de passe oublié</button>`}
    </form>
  </div>`;
  document.getElementById('lmode').onclick = e => {
    const b = e.target.closest('[data-lm]'); if (!b) return;
    loginMode = b.dataset.lm; loginView();
  };
  const em = document.getElementById('em'), pw = document.getElementById('pw'),
        err = document.getElementById('le'), btn = document.getElementById('go');
  document.getElementById('pk').onclick = () => {
    const on = pw.type === 'password';
    pw.type = on ? 'text' : 'password';
    document.getElementById('pk').innerHTML = svg(on ? I.eyeoff : I.eye);
    pw.focus();
  };
  const fg = document.getElementById('forgot');
  if (fg) fg.onclick = async () => {
    if (!em.value.trim()) { err.textContent = 'Renseigne ton adresse d’abord'; em.focus(); return; }
    err.textContent = 'Envoi…';
    try { await resetPassword(em.value); err.textContent = 'Lien envoyé à ' + em.value.trim(); }
    catch (x) { err.textContent = 'Envoi impossible'; }
  };
  document.getElementById('lf').onsubmit = async e => {
    e.preventDefault();
    if (loginBusy) return;
    if (!em.value.trim() || !pw.value) { err.textContent = 'Renseigne les deux champs'; return; }
    if (up && pw.value.length < 6) { err.textContent = 'Mot de passe : 6 caractères minimum'; return; }
    loginBusy = true; btn.disabled = true; err.textContent = '';
    btn.firstChild.textContent = up ? 'Création…' : 'Connexion…';
    try {
      if (up) {
        const done = await signUp(em.value, pw.value);
        if (!done) {
          err.textContent = 'Compte créé. Confirme l’e-mail reçu, puis connecte-toi.';
          loginMode = 'in'; loginBusy = false; loginView();
          return;
        }
      } else await signIn(em.value, pw.value);
      db = load();
      await pull();
      const n = await importLegacy();
      go('home');
      if (n) toast(I.check, plur(n, 'paquet') + ' repris');
    } catch (x) {
      const m = String(x.message || '');
      err.textContent = /already|exist|registered/i.test(m) ? 'Cette adresse a déjà un compte'
        : /Invalid|credentials|refus/i.test(m) ? 'E-mail ou mot de passe incorrect'
        : up ? 'Inscription impossible' : 'Connexion impossible';
      btn.disabled = false;
      btn.firstChild.textContent = up ? 'Créer le compte' : 'Se connecter';
    }
    loginBusy = false;
  };
  setTimeout(() => em.focus(), 80);
}

/* ---------- réglages ---------- */
let subjEdit = null, subjColor = 'graphite', subjName = '';
let cardEdit = null;
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
      <div class="lbl"><span>Révision</span></div>
      <div class="slist">
        <button class="sr flat" data-act="tglsimple">${svg(I.brain)}
          <span class="n">Mode simple</span>
          <span class="tgl ${prefs.simple ? 'on' : ''}"></span></button>
        <div class="note">${prefs.simple
          ? `Le moteur est éteint. Les cartes défilent dans l’ordre choisi, sans échéance
             et sans note : tu balaies à gauche si tu sais, à droite sinon. La progression
             déjà enregistrée est conservée intacte et repart où elle en était dès que tu
             rallumes le moteur.`
          : `Le moteur choisit quand chaque carte revient — le lendemain, puis à 3, 7, 15
             et 30 jours, en s’ajustant à ce que tu réponds. Le désactiver rend l’app
             purement manuelle : uniquement le balayage, comme au tout début.`}</div>
        <div class="sr flat col">
          <div class="srh">${svg(I.target)}<span class="n">Objectif du jour</span>
            <span class="c">${prefs.goal} cartes</span></div>
          <input class="rng" id="pGoal" type="range" min="5" max="200" step="5" value="${prefs.goal}">
        </div>
        ${prefs.simple ? '' : `<div class="sr flat col">
          <div class="srh">${svg(I.plus)}<span class="n">Nouvelles cartes par session</span>
            <span class="c">${prefs.cap || 'sans limite'}</span></div>
          <input class="rng" id="pCap" type="range" min="0" max="60" step="5" value="${prefs.cap}">
        </div>`}
        <div class="sr flat col">
          <div class="srh">${svg(I.shuffle)}<span class="n">Ordre des cartes</span></div>
          <div class="seg" id="pOrder">
            ${[['random', 'Aléatoire'], ['deck', 'Du paquet'], ['worst', 'Ratées'], ['due', 'Urgentes']]
              .filter(([v]) => !(prefs.simple && v === 'due'))
              .map(([v, l]) => `<button data-ord="${v}" class="${prefs.order === v ? 'on' : ''}">${l}</button>`).join('')}
          </div>
        </div>
        <button class="sr flat" data-act="tglfresh">${svg(I.card)}
          <span class="n">Nouvelles cartes d'abord</span>
          <span class="tgl ${prefs.fresh ? 'on' : ''}"></span></button>
        <button class="sr flat" data-act="tglboth">${svg(I.swap)}
          <span class="n">Mélanger les deux sens</span>
          <span class="tgl ${prefs.both ? 'on' : ''}"></span></button>
      </div>
      <div class="lbl"><span>Compte</span></div>
      <div class="slist">
        <button class="sr flat" data-act="rename">${svg(I.user)}
          <span class="n">${esc(prefs.name || auth.email)}</span>${svg(I.arrow)}</button>
        <button class="sr flat" data-act="chpwd">${svg(I.lock)}<span class="n">Changer le mot de passe</span>${svg(I.arrow)}</button>
        <button class="sr flat" data-act="backup2">${svg(I.share)}<span class="n">Sauvegarder</span>
          <span class="c">${db.decks.length}</span>${svg(I.arrow)}</button>
        <button class="sr flat warn" data-act="logout">${svg(I.exit)}<span class="n">Se déconnecter</span></button>
        <button class="sr flat warn" data-act="delacc">${svg(I.trash)}<span class="n">Supprimer le compte</span></button>
      </div>
      <div class="foot">${online ? 'Synchronisé' : 'Hors ligne — reprise automatique'}</div>
    </div>`;
  const g = document.getElementById('pGoal'), c = document.getElementById('pCap');
  g.addEventListener('input', () => {
    prefs.goal = +g.value; savePrefs();
    g.closest('.sr').querySelector('.c').textContent = prefs.goal + ' cartes';
  });
  if (c) c.addEventListener('input', () => {
    prefs.cap = +c.value; savePrefs();
    c.closest('.sr').querySelector('.c').textContent = prefs.cap || 'sans limite';
  });
  document.getElementById('pOrder').addEventListener('click', e => {
    const b = e.target.closest('[data-ord]'); if (!b) return;
    prefs.order = b.dataset.ord; savePrefs(); render();
  });
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
  if (menu === 'backup') {
    const n = db.decks.length, c = db.decks.reduce((a, x) => a + x.cards.length, 0);
    w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu">
        <button class="mi" data-mact="backup">${svg(I.share)}Sauvegarder
          <span class="tail">${n} · ${c}</span></button>
      </div>`;
    document.body.append(...w.childNodes);
    return;
  }
  if (menu === 'card') {
    const d = deck(view.id), c = d && d.cards.find(x => x.id === cardEdit);
    if (!c) { menu = null; return; }
    const med = (side, kind) => {
      const k = side + (kind === 'img' ? 'i' : 'a');
      const has = c[k];
      return `<button class="mb ${has ? 'on' : ''}" data-mact="med-${k}">
        ${kind === 'img' && has ? `<img src="${esc(has)}" alt="">` : svg(kind === 'img' ? I.image : I.mic)}
        ${has ? `<i class="rmv" data-mact="del-${k}">${svg(I.x)}</i>` : ''}</button>`;
    };
    w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu">
        <div class="mi" style="font-weight:750">${svg(I.card)}Carte</div>
        <div class="seg mseg">
          ${[['', 'Basique'], ['tf', 'Vrai / faux']].map(([v, l]) =>
            `<button data-ct="${v}" class="${(c.t || '') === v ? 'on' : ''}">${l}</button>`).join('')}
        </div>
        <div class="mrow">
          <span class="ml">${svg(I.arrow)}Recto</span>${med('f', 'img')}${med('f', 'aud')}
        </div>
        <div class="mrow">
          <span class="ml">${svg(I.swap)}Verso</span>${med('b', 'img')}${med('b', 'aud')}
        </div>
        <input class="tok" id="ctags" placeholder="Étiquettes, séparées par des virgules"
          value="${esc((c.g || []).join(', '))}" autocapitalize="none" spellcheck="false">
        ${recorder ? `<button class="mi warn" data-mact="rec-stop"
          style="justify-content:center;font-weight:700">${svg(I.mic)}<span>Arrêter l’enregistrement</span></button>` : ''}
        <button class="mi" data-mact="card-ok"
          style="justify-content:center;font-weight:700">${svg(I.check)}<span>Enregistrer</span></button>
      </div>`;
    document.body.append(...w.childNodes);
    return;
  }
  if (menu === 'deckset') {
    const d = deck(view.id); if (!d) { menu = null; return; }
    const m = metaOf(d);
    w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu">
        <div class="mi" style="font-weight:750">${svg(I.gear)}Réglages du paquet</div>
        <div class="mrow col"><span class="ml">${svg(I.target)}Tolérance du quiz</span>
          <div class="seg mseg">
            ${[['strict', 'Stricte'], ['normal', 'Normale'], ['soft', 'Souple']].map(([v, l]) =>
              `<button data-tol="${v}" class="${m.tol === v ? 'on' : ''}">${l}</button>`).join('')}
          </div></div>
        <div class="mrow col"><span class="ml">${svg(I.sound)}Langue lue</span>
          <div class="seg mseg wrap">
            ${LANGS.map(([v, l]) => `<button data-lg="${v}" class="${m.lang === v ? 'on' : ''}">${l}</button>`).join('')}
          </div></div>
        <div class="mrow col"><span class="ml">${svg(I.clock)}Chrono par question</span>
          <div class="seg mseg">
            ${[[0, 'Aucun'], [5, '5 s'], [10, '10 s'], [20, '20 s']].map(([v, l]) =>
              `<button data-tm="${v}" class="${m.timer === v ? 'on' : ''}">${l}</button>`).join('')}
          </div></div>
      </div>`;
    document.body.append(...w.childNodes);
    return;
  }
  if (menu === 'simple' || menu === 'engine') {
    const on = menu === 'simple';
    const n = backlog(), per = Math.max(5, prefs.goal || 30), j = Math.max(1, Math.ceil(n / per));
    const ago = prefs.simpleAt ? Date.now() - prefs.simpleAt : 0;
    const since = ago >= DAY ? Math.round(ago / DAY) : 0;
    const bloc = (t, items) => `<div class="pvh">${t}</div><ul class="pvl">${items.map(x => `<li>${x}</li>`).join('')}</ul>`;
    const body = on ? [
      bloc('Ce qui s’arrête', [
        `Les échéances. Plus aucune carte n’arrive à date : les pastilles de rappel sur les
         paquets et le marathon toutes matières disparaissent.`,
        `Les quatre boutons <b>Encore · Difficile · Correct · Facile</b> disparaissent. Il ne
         reste que le balayage : à gauche je sais, à droite je ne sais pas.`,
        `Les intervalles n’avancent plus. Une carte revue en mode simple reste exactement à
         l’échelon où elle était — réviser en mode simple ne fait pas progresser le moteur.`,
        `La barre de maturité et les pastilles d’état ne s’affichent plus.`,
        `Le tri « Urgentes » disparaît : il n’y a plus de date pour trier.`
      ]),
      bloc('Ce qui est conservé', [
        `<b>Rien n’est effacé.</b> Échéance, intervalle, facilité et nombre de réussites
         restent écrits dans chaque carte et t’attendent.`,
        `Le quiz, l’objectif du jour, le résumé de fin de session, les courbes, les matières,
         les cartes suspendues et les sauvegardes fonctionnent à l’identique.`,
        `Les cartes ratées continuent d’être comptées : le tri « Ratées » et les cartes
         coriaces restent justes.`
      ]),
      bloc('Quand tu rallumeras le moteur', [
        `Il repartira exactement où il s’est arrêté, sans rien réapprendre.`,
        `Les cartes dont la date sera passée entre-temps seront <b>étalées automatiquement</b>
         sur plusieurs jours, à hauteur de ton objectif, pour t’éviter un rattrapage massif
         le même jour.`,
        `Les cartes jamais notées avant la bascule repartiront comme des cartes neuves.`
      ]),
      bloc('Bon à savoir', [
        `Le réglage appartient à ton compte : il suit sur tous tes appareils.`,
        `Une session en cours est abandonnée par la bascule, pour qu’aucune carte ne soit
         validée dans un mode et enregistrée dans l’autre.`,
        `Tu peux revenir en arrière à tout moment, ici même.`
      ])
    ].join('') : [
      bloc('Ce qui revient', [
        `Les quatre boutons de notation, les échéances, les pastilles de rappel, la barre de
         maturité et le marathon.`,
        `Les échelons de reprise : le lendemain, puis 3, 7, 15 et 30 jours, puis 2, 4, 8 mois
         et un an — la carte monte d’un cran quand elle passe, redescend quand elle résiste.`
      ]),
      bloc('Où en est ta progression', [
        `Le moteur reprend au point exact où il s’était arrêté${since ? ` il y a ${since} jour${since > 1 ? 's' : ''}` : ''}.
         Aucune donnée n’a été perdue pendant le mode simple.`,
        n ? `<b>${n > 1 ? `${n} cartes ont dépassé leur échéance.` : `Une carte a dépassé son échéance.`}</b> ${n > per
              ? `Elles seront réparties sur ${j} jour${j > 1 ? 's' : ''}, environ ${per} par jour,
                 les plus anciennes d’abord.`
              : n > 1 ? `Elles seront à revoir dès la prochaine session.`
                      : `Elle sera à revoir dès la prochaine session.`}`
          : `Aucune carte en retard : la reprise se fera au fil de l’eau.`,
        `Les cartes vues en mode simple n’ont pas progressé. Celles qui n’avaient jamais été
         notées repartent comme des cartes neuves.`
      ])
    ].join('');
    w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu pv">
        <div class="mi" style="font-weight:750">${svg(on ? I.swap : I.brain)}${on ? 'Passer en mode simple' : 'Rallumer le moteur'}</div>
        <div class="pvb">${body}</div>
        <button class="mi" data-mact="do-${on ? 'simple' : 'engine'}"
          style="justify-content:center;font-weight:700">${svg(I.check)}<span>${on ? 'Passer en mode simple' : 'Rallumer le moteur'}</span></button>
      </div>`;
    document.body.append(...w.childNodes);
    return;
  }
  if (menu === 'rename' || menu === 'pwd' || menu === 'delacc') {
    const conf = {
      rename: ['Nom affiché', I.user, 'text', 'Comment on t’appelle', prefs.name || '', 'Enregistrer'],
      pwd: ['Nouveau mot de passe', I.lock, 'password', 'Au moins 6 caractères', '', 'Changer'],
      delacc: ['Supprimer le compte', I.trash, null, '', '', 'Tout supprimer']
    }[menu];
    w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu">
        <div class="mi" style="font-weight:750">${svg(conf[1])}${conf[0]}</div>
        ${conf[2] ? `<input class="tok" id="fld" type="${conf[2]}" placeholder="${esc(conf[3])}"
            value="${esc(conf[4])}" autocapitalize="none" autocorrect="off" spellcheck="false">`
          : `<div class="mi" style="font-size:13.5px;color:var(--soft);height:auto;padding:0 16px 12px;
               line-height:1.45">Tes paquets, tes matières et ton historique seront effacés définitivement.</div>`}
        <div class="mrr" id="mrr"></div>
        <button class="mi ${menu === 'delacc' ? 'warn' : ''}" data-mact="do-${menu}"
          style="justify-content:center;font-weight:700">${svg(I.check)}<span>${conf[5]}</span></button>
      </div>`;
    document.body.append(...w.childNodes);
    setTimeout(() => { const f = document.getElementById('fld'); if (f) f.focus(); }, 60);
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
      <button class="mi" data-mact="studyall">${svg(I.play)}Tout revoir<span class="tail">${d.cards.length}</span></button>
      <button class="mi" data-mact="mcq">${svg(I.grid)}QCM</button>
      <button class="mi" data-mact="match">${svg(I.link)}Association</button>
      <button class="mi" data-mact="deckset">${svg(I.gear)}Réglages du paquet</button>
      ${d.cards.filter(isLeech).length ? `<button class="mi" data-mact="studyleech">${svg(I.target)}Cartes coriaces<span class="tail">${d.cards.filter(isLeech).length}</span></button>` : ''}
      <button class="mi" data-mact="share">${svg(I.share)}Partager</button>
      <button class="mi warn" data-mact="del">${svg(I.trash)}<span>Supprimer</span></button>
    </div>`;
  document.body.append(...w.childNodes);
}
let recKey = null;
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-mact],[data-msubj],[data-color],[data-tol],[data-lg],[data-tm],[data-ct]');
  if (!b) return;
  const d = deck(view.id);
  if (b.dataset.msubj !== undefined) { d.subject = b.dataset.msubj; saveDeck(d); render(); return; }
  /* réglages propres au paquet, dans leur feuille */
  if (b.dataset.tol) { setMeta(d, { tol: b.dataset.tol }); return paintMenu(); }
  if (b.dataset.lg !== undefined) { setMeta(d, { lang: b.dataset.lg }); return paintMenu(); }
  if (b.dataset.tm !== undefined) { setMeta(d, { timer: +b.dataset.tm }); return paintMenu(); }
  if (b.dataset.ct !== undefined) {
    const c = d && d.cards.find(x => x.id === cardEdit);
    if (c) { if (b.dataset.ct) c.t = b.dataset.ct; else delete c.t; saveDeck(d); }
    return paintMenu();
  }
  const a = b.dataset.mact;
  if (a === 'close') return closeMenu();
  if (a === 'card-ok') {
    const d = deck(view.id), c = d && d.cards.find(x => x.id === cardEdit);
    const t = document.getElementById('ctags');
    if (c && t) {
      const tags = t.value.split(',').map(x => x.trim()).filter(Boolean).slice(0, 6);
      if (tags.length) c.g = tags; else delete c.g;
      saveDeck(d);
    }
    closeMenu(); return render();
  }
  if (a && a.startsWith('del-')) {
    const d = deck(view.id), c = d && d.cards.find(x => x.id === cardEdit);
    if (c) { delete c[a.slice(4)]; saveDeck(d); }
    return paintMenu();
  }
  if (a === 'rec-stop') {
    const key = recKey; recKey = null;
    const blob = await recStop();
    paintMenu();
    if (!blob || !blob.size) return;
    try {
      const url = await upload(blob);
      const d = deck(view.id), c = d && d.cards.find(x => x.id === cardEdit);
      if (c) { c[key] = url; saveDeck(d); }
      toast(I.check, 'Son enregistré');
    } catch (x) { toast(I.x, x.message === 'big' ? 'Fichier trop lourd' : 'Envoi impossible'); }
    return paintMenu();
  }
  if (a && a.startsWith('med-')) {
    const key = a.slice(4);
    const d = deck(view.id), c = d && d.cards.find(x => x.id === cardEdit);
    if (!c) return;
    if (key.endsWith('a') && REC && !recorder) {
      try { await recStart(); recKey = key; return paintMenu(); }
      catch (x) { /* micro refusé : on retombe sur le choix de fichier */ }
    }
    const f = await pickFile(key.endsWith('i') ? 'image/*' : 'audio/*');
    if (!f) return;
    toast(I.share, 'Envoi…');
    try { c[key] = await upload(f); saveDeck(d); toast(I.check); }
    catch (x) { toast(I.x, x.message === 'big' ? 'Fichier trop lourd' : 'Envoi impossible'); }
    return paintMenu();
  }
  if (a === 'deckset') { closeMenu(); return openMenu('deckset'); }
  if (a === 'do-simple') return setSimple(true);
  if (a === 'do-engine') return setSimple(false);
  if (a === 'do-rename') {
    prefs.name = document.getElementById('fld').value.trim(); savePrefs();
    closeMenu(); render(); toast(I.check, 'Nom enregistré'); return;
  }
  if (a === 'do-pwd') {
    const v = document.getElementById('fld').value, err = document.getElementById('mrr');
    if (v.length < 6) { err.textContent = 'Au moins 6 caractères'; return; }
    err.textContent = 'Envoi…';
    api('/auth/v1/user', 'PUT', { password: v })
      .then(() => { closeMenu(); toast(I.check, 'Mot de passe changé'); })
      .catch(() => { err.textContent = 'Changement impossible'; });
    return;
  }
  if (a === 'do-delacc') {
    const lab = b.querySelector('span'), err = document.getElementById('mrr');
    if (!b.dataset.arm) {
      b.dataset.arm = 1; lab.textContent = 'Confirmer la suppression';
      setTimeout(() => { if (b.isConnected) { delete b.dataset.arm; lab.textContent = 'Tout supprimer'; } }, 3000);
      return;
    }
    err.textContent = 'Suppression…';
    api('/rest/v1/rpc/delete_me', 'POST', {})
      .then(() => { closeMenu(); logout(); })
      .catch(() => { err.textContent = 'Suppression impossible'; });
    return;
  }
  if (b.dataset.color) { subjColor = b.dataset.color; return paintMenu(); }
  if (a === 'studyall' || a === 'studyleech') {
    closeMenu();
    return startStudy(view.id, false, null, a === 'studyleech' ? { only: 'leech' } : {});
  }
  if (a === 'mcq' || a === 'match') {
    closeMenu();
    return startStudy(view.id, false, null, { mode: a });
  }
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

/* Bascule du moteur. Une seule porte d'entrée, pour que rien ne traverse
   la frontière : la file en cours, la note en attente et la reprise
   sauvegardée appartiennent au mode qui les a créées. */
function setSimple(on) {
  closeMenu();
  study = null; pendingGrade = null;
  try { localStorage.removeItem('cartes.resume.' + auth.uid); } catch (e) {}
  const days = (!on && prefs.simple) ? spreadBacklog() : 0;   // rallumage : on étale l'arriéré
  prefs.simple = !!on;
  prefs.simpleAt = on ? Date.now() : 0;
  save(); savePrefs();
  if (view.name === 'study') view = { name: 'home' };
  render();
  toast(on ? I.swap : I.brain, on ? 'Mode simple'
    : days > 1 ? `Moteur rallumé · rattrapage sur ${days} jours` : 'Moteur rallumé');
}

/* ---------- révision ---------- */
function startStudy(id, rev, subset, opt) {
  const o = opt || {};
  const sm = simpleMode();          // figé pour toute la session : pas de bascule à chaud
  let cards, name, ids;
  if (id === 'all') {                                  // mode marathon
    cards = live().flatMap(d => d.cards.map(c => ({ ...c, _d: d.id })));
    name = 'Marathon';
  } else {
    const d = deck(id); if (!d) return;
    cards = d.cards; name = d.name;
  }
  if (subset && subset.length) {
    const keep = new Set(subset);
    ids = cards.filter(c => keep.has(c.id)).map(c => c.id);
  } else {
    ids = buildQueue(cards, sm
      ? { order: prefs.order === 'due' ? 'random' : prefs.order, cap: 0,
          fresh: prefs.fresh, only: o.only === 'leech' ? 'leech' : '' }
      : { ...o, order: o.order || prefs.order, fresh: prefs.fresh }).map(c => c.id);
  }
  if (!ids.length) { toast(I.check, 'Rien à revoir ici'); return; }
  const lang = id === 'all' ? '' : metaOf(deck(id)).lang;
  const mode = o.mode || '';
  /* Le QCM a besoin d'au moins deux réponses distinctes pour avoir un sens. */
  let pool = [];
  if (mode === 'mcq') {
    const seen = new Set();
    for (const c of cards) {
      if (isTF(c) || isBool(c.b)) continue;
      const k = norm(plain(c.b));
      if (k && !seen.has(k)) { seen.add(k); pool.push(c.b); }
    }
    if (pool.length < 2) { toast(I.x, 'Pas assez de réponses différentes'); return; }
    /* une carte vrai/faux n'a pas sa place dans un QCM à quatre entrées */
    const keep = new Set(cards.filter(c => !isTF(c)).map(c => c.id));
    ids = ids.filter(x => keep.has(x));
    if (!ids.length) { toast(I.x, 'Rien à mettre en QCM'); return; }
  }
  study = { id, name, lang, mode, pool, rev: !!rev, both: !!o.both, queue: ids, i: 0, again: [], flip: false,
            ok: 0, total: ids.length, t0: Date.now(), tq: Date.now(), tried: {}, missSet: {},
            miss: [], log: [], saved: false, opt: o, simple: sm,
            dirs: Object.fromEntries(ids.map(x => [x, o.both ? Math.random() < .5 : !!rev])) };
  saveResume();
  go('study', id);
}
/* Reprise : l'état de la session survit à la fermeture de l'app */
function saveResume() {
  try {
    /* QCM et association sont des exercices courts, et leur état porte des
       références de cartes : on ne les met pas en reprise. */
    if (!study || study.mode || study.i >= study.queue.length) localStorage.removeItem('cartes.resume.' + auth.uid);
    else localStorage.setItem('cartes.resume.' + auth.uid, JSON.stringify({ ...study, t: Date.now() }));
  } catch (e) {}
}
function loadResume() {
  try {
    const r = JSON.parse(localStorage.getItem('cartes.resume.' + auth.uid));
    if (r && Date.now() - r.t < 3 * DAY && r.i < r.queue.length
        && !!r.simple === simpleMode()) return r;      // snapshot d'un autre mode : on l'ignore
  } catch (e) {}
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

function studyView() {
  const d = study.id === 'all' ? null : deck(study.id);
  if (study.id !== 'all' && !d) return go('home');
  const s = subj(d ? d.subject : '');
  const bar = n => `<div class="bar">
      <button class="ic" data-act="deck">${svg(I.back)}</button>
      <h1>${esc(study.name || (d ? d.name : ''))}</h1>
      ${n}
      <button class="ic ${study.rev ? 'solid' : ''}" data-act="swap">${svg(I.swap)}</button>
      <button class="ic" data-act="restart">${svg(I.shuffle)}</button>
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
    + `<div class="study${study.mode === 'mcq' ? ' mcq' : ''}">
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
const cardOf = n => findCard(study.queue[study.i + n])[0];
/* Une face : image, texte mis en forme, bouton de son. Le bouton lit
   l'enregistrement de la carte s'il y en a un, sinon fait parler le
   navigateur quand le paquet déclare une langue. */
function faceHtml(bk, txt, img, aud, lang) {
  const snd = aud || (lang && TTS && plain(txt));
  return `<div class="face${bk ? ' bk' : ''}">
    ${img ? `<img class="fim" src="${esc(img)}" alt="">` : ''}
    ${plain(txt) ? `<span>${rt(txt)}</span>` : ''}
    ${snd ? `<button class="snd" data-snd="${bk ? 'b' : 'f'}">${svg(I.sound)}</button>` : ''}
  </div>`;
}
const isTF = c => c && c.t === 'tf';
const isBool = t => /^(vrai|faux|true|false|oui|non|yes|no)$/i.test(plain(t).trim());
const tfTruth = c => /^\s*(v|vrai|true|oui|yes|1|y)\b/i.test(plain(c.b));

function paintStack() {
  const st = document.getElementById('stack'); if (!st) return;
  const c = cardOf(0);
  if (!c) { st.innerHTML = ''; return; }
  study.tf = null;                                   // verdict vrai/faux de la carte courante
  const tf = isTF(c);
  const rv = !tf && (study.dirs ? study.dirs[c.id] : study.rev);
  const lang = study.lang || '';
  const front = rv ? c.b : c.f, back = rv ? c.f : c.b;
  const fimg = rv ? c.bi : c.fi, bimg = rv ? c.fi : c.bi;
  const faud = rv ? c.ba : c.fa, baud = rv ? c.fa : c.ba;
  st.innerHTML = `<div class="card in${tf ? ' tf' : ''}" id="top">
      <div class="flipper">
        ${faceHtml(false, front, fimg, faud, lang)}
        ${faceHtml(true, back, bimg, baud, lang)}
      </div>
      ${(c.g || []).length ? `<div class="ctags">${c.g.slice(0, 3).map(t =>
        `<i>${esc(t)}</i>`).join('')}</div>` : ''}
      <div class="ov y">${svg(I.check)}</div>
      <div class="ov n">${svg(I.x)}</div>
    </div>`;
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
  st.innerHTML = `${c.fi ? `<img class="fim" src="${esc(c.fi)}" alt="">` : ''}
    <span>${rt(c.f)}</span>
    ${(c.fa || (study.lang && TTS)) ? `<button class="snd" data-snd="f">${svg(I.sound)}</button>` : ''}`;
  const good = norm(plain(c.b));
  f.innerHTML = `<div class="opts">${study.opts.map((o, k) => {
    const right = norm(plain(o)) === good;
    const cl = study.pick == null ? '' : right ? ' ok' : (study.pick === k ? ' ko' : ' dim');
    return `<button class="op${cl}" data-pick="${k}">${rt(o)}</button>`;
  }).join('')}</div>`;
}
function pickMCQ(k) {
  if (study.pick != null) return;
  const c = cardOf(0); if (!c) return;
  study.pick = k;
  const ok = norm(plain(study.opts[k])) === norm(plain(c.b));
  paintMCQ();
  setTimeout(() => { if (study) commit(ok, ok ? 2 : 0); }, ok ? 560 : 1150);
}

/* ---------- association ----------
   Six paires par lot : on choisit à gauche, on relie à droite. Une paire
   trouvée du premier coup compte juste, sinon elle est comptée ratée — sans
   ça le format serait un jeu de devinettes gratuit. */
function nextBatch() {
  const cards = study.queue.slice(study.i, study.i + 6).map(id => findCard(id)[0]).filter(Boolean);
  study.batch = cards;
  study.right = shuffle(cards.map(c => c.id));
  study.sel = null; study.done = {}; study.wrong = {};
}
function matchBody() {
  const cards = study.batch || [];
  const byId = Object.fromEntries(cards.map(c => [c.id, c]));
  const cell = (side, c, on, done) => `<button class="mc${on ? ' on' : ''}${done ? ' done' : ''}"
      data-mt="${side}:${c.id}">${rt(side === 'L' ? c.f : c.b)}</button>`;
  return `<div class="match">
    <div class="mcol">${cards.map(c => cell('L', c, study.sel === c.id, !!study.done[c.id])).join('')}</div>
    <div class="mcol">${study.right.map(id => cell('R', byId[id], false, !!study.done[id])).join('')}</div>
  </div>`;
}
function paintMatch() {
  const w = document.getElementById('mwrap');
  if (w) w.innerHTML = matchBody();
}
function pickMatch(side, id) {
  if (study.done[id]) return;
  if (side === 'L') { study.sel = study.sel === id ? null : id; return paintMatch(); }
  if (!study.sel) return;
  if (study.sel === id) {
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
  study.wrong[study.sel] = 1;
  const el = document.querySelector(`[data-mt="R:${id}"]`);
  if (el) { el.classList.add('shk'); setTimeout(() => el.classList.remove('shk'), 380); }
}

/* Vrai / faux : pas de note à choisir, la réponse est binaire. On révèle,
   on laisse une seconde pour voir, on enchaîne. */
function answerTF(said) {
  const c = cardOf(0);
  if (!c || !isTF(c) || study.tf != null) return;
  study.tf = (said === tfTruth(c));
  study.flip = true;
  const top = document.getElementById('top');
  if (top) top.classList.add('flip');
  paintFoot();
  pendingGrade = study.tf ? 2 : 0;
  setTimeout(() => { if (study && study.tf != null) fling(study.tf ? -1 : 1); }, 820);
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
      : `<div class="tfv ${study.tf ? 'y' : 'n'}">${svg(study.tf ? I.check : I.x)}</div>`;
    return;
  }
  f.innerHTML = study.flip && !study.simple
    ? `<div class="grades">
        ${[[0, 'Encore', 'g0'], [1, 'Difficile', 'g1'], [2, 'Correct', 'g2'], [3, 'Facile', 'g3']]
          .map(([r, lab, cl]) => `<button class="gr ${cl}" data-g="${r}">
            <span>${lab}</span><i>${esc(preview(c, r))}</i></button>`).join('')}
      </div>`
    : `<div class="hint">${SWIPE}<span class="keys">
        <kbd>←</kbd>${svg(I.check)}<kbd>→</kbd>${svg(I.x)}<kbd>espace</kbd>${svg(I.swap)}</span></div>`;
}
function toggleFlip() {
  const top = document.getElementById('top'); if (!top) return;
  study.flip = !study.flip; top.classList.toggle('flip', study.flip); paintFoot();
}
function bindDrag(el) {
  let x0 = 0, dx = 0, on = false, moved = false, t0 = 0;
  const ov = (k, v) => { const n = el.querySelector('.ov.' + k); if (n) { n.style.opacity = v; n.style.transform = `scale(${.55 + v * .45})`; } };
  el.addEventListener('pointerdown', e => {
    if (e.target.closest('[data-snd]')) return;      // le son ne retourne pas la carte
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
  const g = pendingGrade; pendingGrade = null;
  setTimeout(() => commit(g != null ? g > 0 : dir < 0, g), 250);
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
  /* Mode simple : on ne planifie pas et on ne touche ni à n, ni à i, ni à d.
     La carte garde son état exact, seul le compteur de ratés avance —
     il sert au tri « ratées » et vaut dans les deux modes. */
  if (study.simple) { if (!ok) c.l = (c.l || 0) + 1; }
  else grade(c, r);
  if (d) { dirty[d.id] = 1; save(); scheduleFlush(); }
  api('/rest/v1/reviews', 'POST', [{
    user_id: auth.uid, deck_id: d ? d.id : study.id, card_id: id,
    mode: study.simple ? 'simple' : (study.mode || 'study'),
    rating: study.simple ? null : r, correct: !!ok, ms: Math.min(ms, 600000), reversed: !!rv
  }]).catch(() => {});
  bumpToday();
  if (!study.tried[id]) { study.tried[id] = 1; if (ok) study.ok++; study.log.push(ok ? 1 : 0); }
  if (!ok && !study.missSet[id]) {
    study.missSet[id] = 1;
    study.miss.push({ id, q: rv ? c.b : c.f, a: rv ? c.f : c.b });
  }
  return [c, d, !!rv];
}
const paintQ = () => { study.mode === 'mcq' ? paintMCQ() : (paintStack(), paintFoot()); };
function commit(ok, rating) {
  const id = study.queue[study.i];
  scoreCard(id, ok, rating);
  if (!ok) study.again.push(id);
  study.i++; study.flip = false; study.pick = null; study.opts = null;
  saveResume();
  if (study.i >= study.queue.length) return studyView();
  paintQ();
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
function startQuiz(id, pool, rev, opt) {
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
  quiz = { id, rev: !!rev, name: id === 'all' ? 'Tout' : (deck(id) || {}).name || '',
           sub: id === 'all' ? '' : (deck(id) || {}).subject,
           pool: items, answers, i: 0, ok: 0, bad: [], miss: [], log: [], forced: 0,
           t0: Date.now(), saved: false, state: 'ask', typed: '',
           mode: mode === 'qcm' && answers.length >= 2 ? 'qcm' : '',
           tol: m.tol, lang: m.lang, timer: m.timer,
           streak: 0, best: 0, hint: 0, hints: 0, opts: null, optsFor: -1 };
  go('run');
}
/* ---------- chrono par question ----------
   La barre se vide ; à zéro la question est perdue, comme à l'oral. */
let asrOn = false, asrRec = null;
/* Dictée : le navigateur transcrit, on garde la variante qui passe la
   correction, sinon la première. */
function dictate() {
  if (asrOn) { try { asrRec && asrRec.stop(); } catch (e) {} return; }
  const q = quiz.pool[quiz.i];
  asrOn = true; render();
  asrRec = listen(quiz.lang, alts => {
    if (alts) {
      const best = alts.find(t => accepts(t, q.a, quiz.tol)) || alts[0];
      quiz.typed = best;
    }
    if (alts !== null && alts !== undefined) { asrOn = false; asrRec = null; render(); submit(); return; }
    asrOn = false; asrRec = null; render();
  });
  if (!asrRec) { asrOn = false; toast(I.x, 'Dictée indisponible'); render(); }
}
let quizTick = 0;
function stopTimer() { clearInterval(quizTick); quizTick = 0; }
function armTimer() {
  stopTimer();
  if (!quiz || quiz.state !== 'ask' || !quiz.timer) return;
  const span = quiz.timer * 1000;
  quiz.tEnd = Date.now() + span;
  quizTick = setInterval(() => {
    if (!quiz || quiz.state !== 'ask') return stopTimer();
    const left = Math.max(0, quiz.tEnd - Date.now());
    const el = document.getElementById('tmr');
    if (el) {
      el.style.width = (left / span * 100) + '%';
      el.classList.toggle('low', left < span * 0.3);
    }
    if (left <= 0) { stopTimer(); if (quiz.state === 'ask') fail(); }
  }, 90);
}
function quizOpts(q) {
  if (quiz.optsFor === quiz.i && quiz.opts) return quiz.opts;
  const good = norm(plain(q.a[0]));
  const wrong = shuffle(quiz.answers.filter(x => norm(plain(x)) !== good)).slice(0, 3);
  quiz.opts = shuffle([q.a[0], ...wrong]);
  quiz.optsFor = quiz.i;
  return quiz.opts;
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
  const qcm = quiz.mode === 'qcm';
  const bar = n => `<div class="bar">
      <button class="ic" data-act="tab-quiz">${svg(I.back)}</button>
      <h1>${esc(quiz.name)}</h1>
      ${n}
      ${quiz.streak >= 5 ? `<span class="strk">${svg(I.flame)}${quiz.streak}</span>` : ''}
      <button class="ic ${quiz.rev ? 'solid' : ''}" data-act="swapq">${svg(I.swap)}</button>
      <button class="ic" data-act="requiz">${svg(I.shuffle)}</button>
    </div>`;
  if (quiz.i >= quiz.pool.length) {
    stopTimer();
    const n = quiz.pool.length;
    if (!quiz.saved) { quiz.saved = true; quiz.ms = Date.now() - quiz.t0;
      quiz.hist = pushHist(quiz.id, 'quiz', n ? quiz.ok / n : 0); }
    $.innerHTML = bar('') + review({
      ok: quiz.ok, total: n, log: quiz.log, ms: quiz.ms, hist: quiz.hist, forced: quiz.forced,
      hints: quiz.hints,
      miss: quiz.miss, redo: 'redo', again: 'requiz', done: 'tab-quiz'
    });
    return fillRing(quiz.ok, n);
  }
  const q = quiz.pool[quiz.i];
  const ask = quiz.state === 'ask';
  const canSay = quiz.lang && TTS && plain(q.f);
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
  setTimeout(() => { if (quiz && quiz.state === 'good') nextQ(); }, 560);
}
function fail() {
  const q = quiz.pool[quiz.i];
  const typed = quiz.typed.trim();
  quiz.bad.push(q); quiz.log.push(0); quiz.streak = 0;
  quiz.miss.push({ q: q.f, a: q.a.join('  ·  '), typed,
                   diff: typed ? diffHtml(typed, q.a) : '' });
  quiz.state = 'bad'; stopTimer(); render();
}
function submit() {
  if (quiz.state !== 'ask' || !quiz.typed.trim()) return;
  accepts(quiz.typed, quiz.pool[quiz.i].a, quiz.tol) ? win() : fail();
}
function pickQuiz(k) {
  if (quiz.state !== 'ask') return;
  const q = quiz.pool[quiz.i];
  quiz.pickd = k;
  quiz.typed = quiz.opts[k];
  norm(plain(quiz.opts[k])) === norm(plain(q.a[0])) ? win() : fail();
}
function nextQ() {
  stopTimer();
  quiz.i++; quiz.state = 'ask'; quiz.typed = '';
  quiz.hint = 0; quiz.pickd = null; quiz.opts = null; quiz.optsFor = -1;
  render();
}

/* ---------- création / import ---------- */
let comp = { subject: '', cards: [], edit: -1, bulk: false, text: '' };
let aiBusy = false;
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
    <div class="sheet ${comp.bulk ? 'sh-bulk' : 'sh-comp'}">
      ${t ? '' : `<div class="field"><input id="nm" placeholder="Nom du paquet" spellcheck="false"
        enterkeyhint="next" value="${esc(comp.name || '')}"></div>
        ${pills(comp.subject, db.subjects.map(x => subj(x.id)), 'nsubj')}`}
      ${comp.bulk ? `
        <div class="ta"><textarea id="tx" placeholder="chat = gatto&#10;chien = cane&#10;maison = casa"
          autocapitalize="off" autocorrect="off" spellcheck="false">${esc(comp.text)}</textarea></div>
        <div class="airow">
          <button class="ai" id="aigen" title="Fabriquer les cartes">${svg(I.spark)}</button>
          <button class="cta" id="bulkadd" disabled>Ajouter${svg(I.plus)}</button>
        </div>
        <div class="prev" id="prev"></div>`
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
          add = document.getElementById('bulkadd'), gen = document.getElementById('aigen');
    const up = () => {
      comp.text = tx.value;
      const cards = parseText(tx.value);
      add.disabled = !cards.length;
      gen.disabled = aiBusy || tx.value.trim().length < 40;
      add.firstChild.textContent = cards.length ? `Ajouter ${cards.length} ` : 'Ajouter';
      prev.innerHTML = cards.slice(0, 40).map((c, i) => `<div class="pr" style="animation-delay:${i * 18}ms">
        <span class="a">${esc(c.f)}</span>${svg(I.arrow)}<span class="b">${esc(c.b)}</span></div>`).join('');
    };
    const fit = () => { tx.style.height = 'auto'; tx.style.height = Math.min(tx.scrollHeight + 2, innerHeight * .3) + 'px'; };
    tx.addEventListener('input', () => { fit(); up(); }); fit(); up();
    setTimeout(() => tx.focus(), 60);
    /* Colle un cours, un tableau de vocabulaire, une liste : le texte revient
       découpé en cartes, éditable avant l'ajout. */
    gen.onclick = async () => {
      if (aiBusy || gen.disabled) return;
      aiBusy = true; gen.classList.add('busy'); gen.disabled = true;
      try {
        const cards = await aiCards(tx.value, t ? t.name : comp.name);
        if (!cards.length) throw new Error('empty');
        tx.value = cards.map(c => c.f + '\t' + c.b).join('\n');
        fit(); up(); toast(I.spark, plur(cards.length, 'carte'));
      } catch (x) {
        toast(I.x, AIERR[String(x.message)] || 'IA indisponible');
      }
      aiBusy = false; gen.classList.remove('busy'); up();
    };
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
  const b = e.target.closest('[data-act],[data-go],[data-rm],[data-a],[data-g],[data-q],[data-filt],[data-nsubj],[data-ed],[data-dl],[data-sub],[data-sus],[data-ord],[data-snd],[data-tf],[data-card],[data-pick],[data-mt],[data-qp],[data-qsay]');
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
  if (ds.g !== undefined) { pendingGrade = +ds.g; return fling(+ds.g > 0 ? -1 : 1); }
  if (ds.rm) { const d = deck(view.id); d.cards = d.cards.filter(c => c.id !== ds.rm); saveDeck(d); return render(); }
  if (ds.sus) {
    const d = deck(view.id), c = d.cards.find(x => x.id === ds.sus);
    c.x = !c.x; saveDeck(d); return render();
  }
  const a = ds.act, d = view.id ? deck(view.id) : null;
  if (ds.card) { cardEdit = ds.card; return openMenu('card'); }
  if (b.dataset.tf !== undefined) return answerTF(b.dataset.tf === '1');
  if (b.dataset.pick !== undefined) return pickMCQ(+b.dataset.pick);
  if (b.dataset.mt) { const [sd, mid] = b.dataset.mt.split(':'); return pickMatch(sd, mid); }
  if (b.dataset.snd !== undefined) {
    const c = cardOf(0); if (!c) return;
    const bk = b.dataset.snd === 'b';
    const tf = isTF(c);
    const rv = !tf && (study.dirs ? study.dirs[c.id] : study.rev);
    const useBack = bk !== !!rv;
    const aud = useBack ? c.ba : c.fa, txt = useBack ? c.b : c.f;
    if (aud) play(aud); else say(txt, study.lang);
    return;
  }
  if (a === 'home' || a === 'tab-home') return go('home');
  if (a === 'tab-quiz') return go('quiz');
  if (a === 'peek') { peek = !peek; render(); return; }
  if (a === 'marathon') return startStudy('all', false, null, { only: 'due', both: prefs.both });
  if (a === 'goalinfo') return go('settings');
  if (a === 'resume') {
    const r = loadResume(); if (!r) return render();
    study = r; return go('study', r.id);
  }
  if (a === 'settings') return go('settings');
  if (a === 'backup2') return openMenu('backup');
  if (a === 'logout') return logout();
  if (a === 'tglsimple') return openMenu(prefs.simple ? 'engine' : 'simple');
  if (a === 'tglfresh') { prefs.fresh = !prefs.fresh; savePrefs(); return render(); }
  if (a === 'tglboth') { prefs.both = !prefs.both; savePrefs(); return render(); }
  if (a === 'rename') return openMenu('rename');
  if (a === 'chpwd') return openMenu('pwd');
  if (a === 'delacc') return openMenu('delacc');
  if (a === 'puball') return openMenu('backup');
  if (a === 'new') { resetComp(); return go('import'); }
  if (a === 'paste') { resetComp(); return go('import', view.name === 'deck' ? view.id : null); }
  if (a === 'bulk') { comp.bulk = !comp.bulk; comp.edit = -1; return render(); }
  if (a === 'deck') {
    const t = (study && study.id) || view.id;
    return t === 'all' ? go('home') : go('deck', t);
  }
  if (a === 'menu') return openMenu('deck');
  if (a === 'study') {
    const d = deck(view.id);
    return startStudy(view.id, false, null, { only: dueCount(d) ? 'due' : null, both: prefs.both });
  }
  if (a === 'studyall') { closeMenu(); return startStudy(view.id, false, null, {}); }
  if (a === 'studyleech') { closeMenu(); return startStudy(view.id, false, null, { only: 'leech' }); }
  if (a === 'quizdeck') return startQuiz(view.id);
  if (a === 'restart') return startStudy(study ? study.id : view.id, study && study.rev, null,
    study ? { mode: study.mode, both: study.both } : {});
  if (a === 'swap') { toast(I.swap, study.rev ? 'Sens normal' : 'Sens inversé'); return startStudy(study.id, !study.rev); }
  if (a === 'swapq') { toast(I.swap, quiz.rev ? 'Sens normal' : 'Sens inversé'); return startQuiz(quiz.id, null, !quiz.rev); }
  if (a === 'anyway') {
    if (quiz.state !== 'bad') return;
    quiz.ok++; quiz.forced++; quiz.bad.pop(); quiz.miss.pop();
    quiz.log[quiz.log.length - 1] = 1;
    return nextQ();
  }
  if (a === 'redostudy') return startStudy(study.id, study.rev, study.miss.map(m => m.id));
  if (ds.qp !== undefined) return pickQuiz(+ds.qp);
  if (ds.qsay !== undefined) return say(quiz.pool[quiz.i].f, quiz.lang);
  if (a === 'hint') {
    if (quiz.state !== 'ask') return;
    if (!quiz.hint) quiz.hints++;
    quiz.hint++; return render();
  }
  if (a === 'idk') { if (quiz.state === 'ask') fail(); return; }
  if (a === 'qcm2') {
    if (quiz.answers.length < 2) return;
    quiz.mode = quiz.mode === 'qcm' ? '' : 'qcm';
    quiz.opts = null; quiz.optsFor = -1;
    return render();
  }
  if (a === 'asr') return dictate();
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
  if (!study) return;
  if (study.mode === 'match') return;
  const cur = cardOf(0);
  if (isTF(cur)) {                                   // vrai / faux : v ou f
    if (e.key === 'v' || e.key === 'V' || e.key === 'ArrowLeft') return answerTF(true);
    if (e.key === 'f' || e.key === 'F' || e.key === 'ArrowRight') return answerTF(false);
    return;
  }
  if (study.mode === 'mcq') {
    if ('1234'.includes(e.key)) { const k = +e.key - 1; if (study.opts && k < study.opts.length) pickMCQ(k); }
    return;
  }
  if (study.flip && !study.simple && '1234'.includes(e.key)) {
    pendingGrade = +e.key - 1;
    return fling(pendingGrade > 0 ? -1 : 1);
  }
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
  prefs = { ...DEFPREFS };
  view = { name: 'login' }; filter = ''; peek = false; loginMode = 'in';
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
