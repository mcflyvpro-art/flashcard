// Un Supabase en mémoire pour les parcours de bout en bout (M07).
//
// Pourquoi pas le vrai : il n'y a pas encore de préproduction (M13.T4), et
// un parcours « inscription → livre → révision » lancé à chaque passage de
// CI créerait de vrais comptes, de vraies lignes, dans la base des élèves.
// Ici tout vit dans un objet JavaScript, jeté à la fin du test.
//
// Ce que ça vérifie : l'app (écrans, file hors ligne, synchro, moteur) de
// bout en bout. Ce que ça ne vérifie pas : la RLS et les fonctions SQL —
// elles se testent en base (M04.T3, M10). L'émulation est volontairement
// minimale : juste les filtres et en-têtes que l'app emploie réellement
// (`eq`, `is.null`, `not.is.null`, `lt`, `gte`, alias de `select`, `Range`
// + `Content-Range`, `Prefer: resolution=merge-duplicates`, le `rev` des
// paquets — M03). Les fonctions des classes (espace professeur, « Mes
// classes ») sont rejouées à part, dans faux-classes.js ; celles du cercle
// (amis, clubs, parties en direct) dans faux-cercle.js.
//
// `store` est un objet ordinaire : deux pages branchées sur le même store
// sont deux appareils du même compte (M07.T4).

import { randomUUID } from 'node:crypto';
import { rpcClasses } from './faux-classes.js';
import { rpcCercle } from './faux-cercle.js';
import { contexteRevision, journalFaux } from './faux-journal.js';

const CARD_COLS = { f: 'front', b: 'back', st: 'state', sp: 'step', S: 'stability', D: 'difficulty',
  F: 'trace2', d: 'due', lr: 'last_review', i: 'interval_days', n: 'reviews_count', l: 'lapses' };

export function nouveauStore() {
  return { users: [], tables: {}, online: true, journal: [] };
}

const table = (store, name) => (store.tables[name] = store.tables[name] || []);

function jeton(user) {
  return { access_token: 'tok-' + user.id + '-' + randomUUID(), refresh_token: 'ref-' + user.id,
    expires_in: 3600, token_type: 'bearer', user: { id: user.id, email: user.email } };
}

const userOf = (store, req) => {
  const m = /tok-([0-9a-f-]{36})-/.exec(req.headers().authorization || '');
  return m && store.users.find(u => u.id === m[1]);
};

function auth(store, path, url, body) {
  if (path.endsWith('/signup')) {
    if (store.users.some(u => u.email === body.email)) return [422, { msg: 'User already registered' }];
    const user = { id: randomUUID(), email: body.email, password: body.password };
    store.users.push(user);
    return [200, jeton(user)];
  }
  if (path.endsWith('/token')) {
    const grant = url.searchParams.get('grant_type');
    const user = grant === 'refresh_token'
      ? store.users.find(u => 'ref-' + u.id === body.refresh_token)
      : store.users.find(u => u.email === body.email && u.password === body.password);
    return user ? [200, jeton(user)] : [400, { error_description: 'Invalid login credentials' }];
  }
  if (path.endsWith('/recover')) return [200, {}];
  return [404, {}];
}

/* `col=op.valeur` — seulement les opérateurs que l'app emploie. */
function filtre(url) {
  const tests = [];
  for (const [k, v] of url.searchParams) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict'].includes(k)) continue;
    const [op, ...rest] = v.split('.');
    const val = rest.join('.');
    const t = {
      eq: r => String(r[k]) === val,
      is: r => (val === 'null' ? r[k] == null : String(r[k]) === val),
      not: r => (val === 'is.null' ? r[k] != null : true),
      lt: r => r[k] != null && String(r[k]) < val,
      gte: r => r[k] != null && String(r[k]) >= val,
      in: r => val.replace(/[()]/g, '').split(',').includes(String(r[k]))
    }[op];
    if (t) tests.push(t);
  }
  return r => tests.every(t => t(r));
}

/* `select=a,b:c,meta` → { a, b: ligne.c, meta } ; `*` → tout. */
function projette(url, rows) {
  const sel = url.searchParams.get('select');
  if (!sel || sel === '*') return rows;
  const champs = sel.split(',').map(x => x.split(':'));
  return rows.map(r => Object.fromEntries(champs.map(([a, b]) => [a, r[b || a]])));
}

/* La RLS « user_id = auth.uid() », réduite à ce qu'il faut pour que deux
   comptes sur le même store (un professeur et un élève) ne voient pas les
   livres l'un de l'autre. Les autres tables restent lues telles quelles. */
const PROPRES = new Set(['decks', 'cards', 'subjects', 'sessions', 'prefs', 'reviews']);
const mien = (name, user) => r => !PROPRES.has(name) || !r.user_id || !user || r.user_id === user.id;

function lit(store, name, url, req, user) {
  const rows = projette(url, table(store, name).filter(mien(name, user)).filter(filtre(url)));
  const range = /^(\d+)-(\d+)$/.exec(req.headers().range || '');
  if (!range) return [200, rows];
  const [from, to] = [+range[1], +range[2]];
  const page = rows.slice(from, to + 1);
  return [200, page, { 'content-range': `${from}-${from + page.length - 1}/${rows.length}` }];
}

const cle = (name, r) => (name === 'cards' ? r.deck_id + '/' + r.id : name === 'reviews' && r.client_id ? r.client_id
  : name === 'subjects' ? r.user_id + '/' + r.id : r.id);   // les matières de départ portent les mêmes identifiants chez tous

function ecrit(store, name, body, prefer, user) {
  const t = table(store, name);
  const out = [];
  for (const row of Array.isArray(body) ? body : [body]) {
    const r = { ...row };
    if (user && !r.user_id) r.user_id = user.id;
    if (!r.id && name !== 'prefs') r.id = randomUUID();
    if (name === 'prefs') r.id = r.user_id;
    if (!r.created_at) r.created_at = new Date().toISOString();
    if (name === 'decks') r.rev = 1;
    const i = t.findIndex(x => cle(name, x) === cle(name, r));
    if (name === 'reviews' && i < 0) contexteRevision(store, r);
    if (i >= 0) {
      if (!/merge-duplicates/.test(prefer)) return [409, { message: 'duplicate key' }];
      if (name === 'decks') r.rev = (t[i].rev || 0) + 1;
      t[i] = { ...t[i], ...r };
      out.push(t[i]);
    } else { t.push(r); out.push(r); }
  }
  return [/return=representation/.test(prefer) ? 201 : 201, /return=representation/.test(prefer) ? out : null];
}

function modifie(store, name, url, body, prefer, user) {
  const rows = table(store, name).filter(mien(name, user)).filter(filtre(url));
  for (const r of rows) {
    Object.assign(r, body);
    if (name === 'decks' && body.rev == null) r.rev = (r.rev || 0) + 1;
  }
  return [200, /return=representation/.test(prefer) ? rows : null];
}

function efface(store, name, url, user) {
  const f = filtre(url), m = mien(name, user);
  store.tables[name] = table(store, name).filter(r => !(m(r) && f(r)));
  return [204, null];
}

/* Le miroir « une ligne par carte » (M03.T3) : même découpage que la vraie
   fonction SQL — colonnes connues, le reste dans `meta`. */
function syncDeckCards(store, body, user) {
  const t = table(store, 'cards');
  store.tables.cards = t.filter(r => r.deck_id !== body.p_deck_id);
  for (const c of body.p_cards || []) {
    const row = { deck_id: body.p_deck_id, id: c.id, user_id: user.id, meta: {} };
    for (const [k, v] of Object.entries(c)) {
      if (k === 'id') continue;
      if (CARD_COLS[k]) row[CARD_COLS[k]] = v; else row.meta[k] = v;
    }
    store.tables.cards.push(row);
  }
  return [204, null];
}

function rest(store, req, url, path, body) {
  const user = userOf(store, req);
  if (!user) return [401, { message: 'JWT expired' }];
  const name = path.replace('/rest/v1/', '');
  const prefer = req.headers().prefer || '';
  if (name === 'rpc/sync_deck_cards') return syncDeckCards(store, body, user);
  if (name === 'rpc/journal') return journalFaux(store, body || {}, user);
  if (name.startsWith('rpc/')) return rpcClasses(store, name.slice(4), body, user) || rpcCercle(store, name.slice(4), body, user) || [200, []];
  const m = req.method();
  if (m === 'GET') return lit(store, name, url, req, user);
  if (m === 'POST') return ecrit(store, name, body, prefer, user);
  if (m === 'PATCH') return modifie(store, name, url, body, prefer, user);
  if (m === 'DELETE') return efface(store, name, url, user);
  return [405, {}];
}

/* Branche le faux serveur sur une page (ou un contexte). Couper le réseau
   (`store.online = false`) fait échouer chaque requête comme une vraie
   coupure : `fetch` rejette, exactement ce que voit l'app dans un tunnel. */
export async function brancher(cible, store) {
  await cible.route(/supabase\.co\//, async route => {
    const req = route.request();
    if (!store.online) return route.abort('internetdisconnected');
    const url = new URL(req.url());
    const path = url.pathname;
    let body;
    try { body = req.postDataJSON(); } catch { body = null; } // pas de corps (GET, DELETE)
    if (body == null && req.postDataBuffer()) {                  // WebKit ne rend parfois le corps qu'en octets
      try { body = JSON.parse(req.postDataBuffer().toString('utf8')); } catch { body = null; }
    }
    const [status, json, headers] = path.startsWith('/auth/v1/') ? auth(store, path, url, body || {})
      : path.startsWith('/rest/v1/') ? rest(store, req, url, path, body)
      : [404, {}];
    store.journal.push(`${req.method()} ${path} → ${status}`);
    return route.fulfill({ status, headers: { 'content-type': 'application/json', ...(headers || {}) },
      body: json == null ? '' : JSON.stringify(json) });
  });
}

/* Un paquet déjà travaillé, posé directement dans le faux serveur (le
   compte doit exister) : `n` cartes en révision, toutes dues maintenant —
   pas de quota de cartes neuves pour brouiller les comptes. */
export function semerPaquetDu(store, email, n, nom = 'Révisions') {
  const user = store.users.find(u => u.email === email);
  const deckId = randomUUID(), now = Date.now(), jour = 864e5;
  table(store, 'decks').push({ id: deckId, user_id: user.id, name: nom, subject: '', hidden: false, pos: 0,
    pinned: false, meta: {}, rev: 1, deleted_at: null, cards: [], created_at: new Date().toISOString() });
  for (let k = 1; k <= n; k++) {
    table(store, 'cards').push({ deck_id: deckId, id: 'c' + k, user_id: user.id, front: 'Question ' + k, back: 'Réponse ' + k,
      state: 2, step: null, stability: 3, difficulty: 5, trace2: 3, due: now - jour, last_review: now - 4 * jour,
      interval_days: 3, reviews_count: 2, lapses: 0, meta: {} });
  }
  return deckId;
}

/* Un livre neuf, posé dans le faux serveur : `cartes` = [[recto, verso, extra?]]. */
export function semerLivre(store, email, nom, cartes) {
  const user = store.users.find(u => u.email === email);
  const deckId = randomUUID();
  table(store, 'decks').push({ id: deckId, user_id: user.id, name: nom, subject: '', hidden: false, pos: 0,
    pinned: false, meta: {}, rev: 1, deleted_at: null, cards: [], created_at: new Date().toISOString() });
  cartes.forEach(([f, b, extra], k) => table(store, 'cards').push({ deck_id: deckId, id: 'q' + (k + 1), user_id: user.id,
    front: f, back: b, reviews_count: 0, lapses: 0, meta: extra || {} }));
  return deckId;
}
