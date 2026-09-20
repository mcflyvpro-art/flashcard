import {
  DEFPREFS, auth, conflicts, db, demo, dirty, flushTimer, flushing, gone, groups, mailbox,
  menu, online, outbox, prefs, refreshing, scope, setAnimate, setAuth, setDirty,
  setFlushTimer, setFlushing, setGone, setOnlineState, setOutbox, setPrefs, setRefreshing,
  study, trash, undos, view
} from '../data/etat.js';
import { I } from '../icones.js';
import { $ } from '../racine.js';
import { queueChip, render } from '../ui/bibliotheque.js';
import { fsrsAuto, fsrsMigrate } from '../ui/carte-media.js';
import { cerclePull } from './classement.js';
import { addDeck, freeName, toast } from '../ui/import-cartes.js';
import { closeMenu, openMenu } from '../ui/menus-a.js';
import { maybeAskInstall, resetSession } from '../ui/onboarding.js';
import { upsertProfile } from './reglages-corbeille.js';

/* Cartes — révision + quiz. PWA, comptes cloisonnés sur Supabase. */
export const SB = {
  /* Valeurs injectées au build depuis .env.local (en local) ou les
     variables d'environnement Vercel (en ligne). La clé anon est publique
     par nature : ce sont les règles RLS de la base qui cloisonnent les
     comptes. Elle sort du code pour pouvoir pointer vers un autre projet
     (préproduction, établissement) sans toucher une ligne. */
  url: import.meta.env.VITE_SUPABASE_URL,
  key: import.meta.env.VITE_SUPABASE_ANON_KEY
};

const AKEY = 'cartes.auth';

/* `loadAuth` lit `AKEY` ci-dessus : cet appel doit rester après sa
   déclaration. Avant, il était fait juste après les imports, avant même la
   définition de `AKEY` (le TDZ du `const`) — `loadAuth` levait
   silencieusement « Cannot access 'AKEY' before initialization », avalée
   par son propre `try/catch`, et renvoyait toujours `null`. La session
   restait bien dans `localStorage`, mais l'app démarrait chaque fois
   convaincue qu'il n'y avait personne de connecté : c'était la vraie cause
   de la déconnexion systématique à chaque réouverture, pas un problème de
   jeton expiré. */
setAuth(loadAuth());

/* ---------- palette : 16 teintes accordées à l'app ---------- */
export const PALETTE = {
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

export const COLORS = Object.keys(PALETTE);

const SEED = [
  ['italien', 'Italien', 'red'], ['anglais', 'Anglais', 'graphite'],
  ['philo', 'Philo', 'orange'], ['eco', 'Éco', 'green'],
  ['droit', 'Droit', 'pink'], ['management', 'Management', 'yellow'],
  ['lettres', 'Lettres', 'sand']
];

const NONE = { id: '', name: 'Sans matière', color: 'graphite',
               c: '#E8E3E9', ci: '#2A2530', d: '#8E8794' };

export const subj = id => {
  const t = db.subjects.find(x => x.id === id);
  return t ? { ...t, ...(PALETTE[t.color] || PALETTE.graphite) } : NONE;
};

export const sty = s => `--c:${s.c};--ci:${s.ci};--d:${s.d}`;

/* ---------- état ---------- */
export const scopeName = () => {
  const g = (groups || []).find(x => x.id === scope);
  return g ? g.name : 'Mes lecteurs';
};

/* ---------- annuler ----------
   Avant toute action qui écrase ou efface, on photographie les paquets
   touchés. Annuler repose la photo et la repousse en base. Dix pas en
   arrière suffisent : au-delà, ce n'est plus une erreur qu'on rattrape. */
const snap = ids => ids.map(id => {
  const d = db.decks.find(x => x.id === id);
  return { id, deck: d ? JSON.parse(JSON.stringify(d)) : null };
});

export function pushUndo(label, ids) {
  undos.push({ label, before: snap(ids) });
  if (undos.length > 10) undos.shift();
}

export function canUndo() { return undos.length > 0; }

export const undoLabel = () => (undos.length ? undos[undos.length - 1].label : '');

export function doUndo() {
  const u = undos.pop();
  if (!u) return false;
  for (const { id, deck } of u.before) {
    const k = db.decks.findIndex(x => x.id === id);
    if (deck) {
      if (k < 0) db.decks.push(deck); else db.decks[k] = deck;
      dirty[id] = 1;
      const g = gone.indexOf(id);           // un paquet ressuscité n'est plus à jeter
      if (g >= 0) gone.splice(g, 1);
    } else if (k >= 0) {
      db.decks.splice(k, 1);                // il n'existait pas avant : on le retire
      gone.push(id);
    }
  }
  save(); flush();
  toast(I.redo, u.label ? 'Annulé · ' + u.label : 'Annulé');
  render();
  return true;
}

export function loadAuth() { try { return JSON.parse(localStorage.getItem(AKEY)); } catch (e) { return null; } }

export function saveAuth(a) { setAuth(a); a ? localStorage.setItem(AKEY, JSON.stringify(a)) : localStorage.removeItem(AKEY); }

export const cacheKey = () => 'cartes.cache.' + (auth && auth.uid);

/* La file d'attente est enregistrée avec les données. Sans elle, une
   modification faite dans le métro survivait à l'écran mais pas au
   rechargement : le prochain démarrage relisait la base et remplaçait
   tout par la version du serveur, sans un mot. Ce qui est en attente est
   donc noté noir sur blanc, et repart dès que le réseau revient. */
export function load() {
  try {
    const d = JSON.parse(localStorage.getItem(cacheKey()));
    if (d && Array.isArray(d.decks)) {
      setPrefs({ ...DEFPREFS, ...(d.prefs || {}) });     // le mode reste le bon hors ligne
      setDirty(d.dirty && typeof d.dirty === 'object' ? { ...d.dirty } : {});
      setGone(Array.isArray(d.gone) ? d.gone.slice() : []);
      setOutbox(Array.isArray(d.outbox) ? d.outbox.slice() : []);
      return { subjects: d.subjects || [], decks: d.decks, hist: d.hist || {}, today: d.today };
    }
  } catch (e) { /* cache local corrompu ou absent : on repart d'un état vide, régénéré par la sync */ }
  return { subjects: [], decks: [], hist: {} };
}

export function save() {
  if (demo) return;                       // la démonstration n'écrase pas le cache du compte
  if (auth) localStorage.setItem(cacheKey(), JSON.stringify({ ...db, prefs, dirty, gone, outbox }));
}

/* combien de changements attendent leur tour */
export const pending = () => Object.keys(dirty).length + gone.length + outbox.length;

/* enregistre localement puis pousse en base */
export function saveDeck(d) {
  /* marquer d'abord, enregistrer ensuite : dans l'autre sens, la copie
     écrite sur l'appareil ignorait que ce paquet restait à envoyer, et un
     rechargement hors ligne effaçait le travail en le relisant du serveur. */
  if (d) dirty[d.id] = 1;
  save();
  if (d) flush();
}

export function pushHist(id, mode, pct) {
  const k = id + ':' + mode;
  (db.hist[k] = db.hist[k] || []).push({ t: Date.now(), p: pct });
  if (db.hist[k].length > 24) db.hist[k].shift();
  save();
  enqueue('/rest/v1/sessions', { id: uid(), user_id: auth.uid, deck_id: String(id), mode, pct });
  /* Une séance vient de se terminer : c'est le seul moment où proposer
     l'écran d'accueil a du sens, l'app vient de servir à quelque chose. */
  maybeAskInstall();
  return db.hist[k];
}

export const uid = () => (crypto.randomUUID ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 3 | 8)).toString(16);
    }));

export const deck = id => db.decks.find(d => d.id === id);

export const live = () => db.decks.filter(d => !d.hidden);

export const slugify = n => (n || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'matiere';

/* ---------- accès à Supabase ---------- */
/* On renouvelle avant d'essuyer un refus plutôt qu'après : un 401 au
   milieu d'un envoi coûte un aller-retour et, sur une requête d'écriture,
   la refaire n'est pas toujours anodin. */
const tokenExpiring = () => !!(auth && auth.refresh && auth.exp && Date.now() > auth.exp - 60000);

function authHeaders(extra) {
  const h = { apikey: SB.key, 'Content-Type': 'application/json', ...extra };
  if (auth && auth.token) h.Authorization = 'Bearer ' + auth.token;
  return h;
}

async function refreshIfUnauthorized(r) {
  return r.status === 401 && auth && auth.refresh && await refreshToken();
}

/** @returns {Error & { status: number }} */
function apiError(message, status) {
  const e = /** @type {Error & { status: number }} */ (new Error(message));
  e.status = status;                   // la file d'attente en a besoin
  return e;
}

async function throwIfError(r) {
  if (r.ok) return;
  throw apiError(await r.text().catch(() => String(r.status)), r.status);
}

export async function api(path, method = 'GET', body, extra = {}) {
  /* Pendant la visite guidée, aucune requête ne part : ni lecture, ni
     écriture. Le compte de démonstration n'existe que dans cet onglet. */
  if (demo) return [];
  if (tokenExpiring()) await refreshToken();
  const r = await fetch(SB.url + path,
    { method, headers: authHeaders(extra), body: body ? JSON.stringify(body) : undefined });
  if (await refreshIfUnauthorized(r)) return api(path, method, body, extra);
  await throwIfError(r);
  return r.status === 204 ? null : r.json().catch(() => null);
}

/* PostgREST refuse de rendre plus de `db-max-rows` lignes d'un coup
   (1000 sur ce projet) — une lecture simple au-delà de ce nombre serait
   tronquée en silence, sans erreur, sans rien qui le signale. `apiAll`
   lit la première page, découvre le total réel dans l'en-tête
   `Content-Range` (`Prefer: count=exact`), puis va chercher le reste en
   parallèle. M03.T6 : c'est la bibliothèque de cartes, une ligne par
   carte désormais, qui peut dépasser cette limite. */
const PAGE = 1000;

async function throwIfPageError(r) {
  if (r.ok || r.status === 206) return;
  throw apiError(await r.text().catch(() => String(r.status)), r.status);
}

async function apiPage(path, from, to) {
  if (demo) return { rows: [], total: 0 };
  if (tokenExpiring()) await refreshToken();
  const h = { apikey: SB.key, Range: `${from}-${to}`, Prefer: 'count=exact' };
  if (auth && auth.token) h.Authorization = 'Bearer ' + auth.token;
  const r = await fetch(SB.url + path, { headers: h });
  if (await refreshIfUnauthorized(r)) return apiPage(path, from, to);
  await throwIfPageError(r);
  const rows = await r.json().catch(() => []);
  const total = +((r.headers.get('content-range') || '').split('/')[1]) || rows.length;
  return { rows, total };
}

async function apiAll(path) {
  const first = await apiPage(path, 0, PAGE - 1);
  if (first.total <= first.rows.length) return first.rows;
  const suite = [];
  for (let from = first.rows.length; from < first.total; from += PAGE) {
    suite.push(apiPage(path, from, from + PAGE - 1));
  }
  return first.rows.concat(...(await Promise.all(suite)).map(p => p.rows));
}

function keepSession(j) {
  /* Le seul endroit par lequel passe TOUT changement de compte : connexion,
     inscription, renouvellement de jeton. Si l'identifiant change, c'est
     quelqu'un d'autre — on efface donc ce que l'écran gardait du précédent.
     Mettre ce nettoyage dans le formulaire de connexion aurait laissé
     passer les autres chemins ; ici, aucun ne l'évite. */
  if (auth && auth.uid && j.user && auth.uid !== j.user.id) resetSession();
  saveAuth({
    token: j.access_token, refresh: j.refresh_token,
    exp: Date.now() + (j.expires_in || 3600) * 1000,
    uid: j.user.id, email: j.user.email
  });
}

export async function signUp(email, password) {
  const r = await fetch(SB.url + '/auth/v1/signup', {
    method: 'POST', headers: { apikey: SB.key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim().toLowerCase(), password })
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.msg || j.error_description || j.message || 'Inscription refusée');
  if (j.access_token) { keepSession(j); return true; }
  return false;                       // confirmation par e-mail exigée par le projet
}

export async function resetPassword(email) {
  const r = await fetch(SB.url + '/auth/v1/recover', {
    method: 'POST', headers: { apikey: SB.key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim().toLowerCase() })
  });
  if (!r.ok) throw new Error('Envoi impossible');
}

export async function signIn(email, password) {
  const r = await fetch(SB.url + '/auth/v1/token?grant_type=password', {
    method: 'POST', headers: { apikey: SB.key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim().toLowerCase(), password })
  });
  const j = await r.json();
  if (!r.ok || !j.access_token) throw new Error(j.error_description || j.msg || j.error || 'Connexion refusée');
  keepSession(j);
  return j;
}

export function refreshToken() {
  if (refreshing) return refreshing;
  const had = auth && auth.refresh;
  setRefreshing((async () => {
    try {
      const r = await fetch(SB.url + '/auth/v1/token?grant_type=refresh_token', {
        method: 'POST', headers: { apikey: SB.key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: had })
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.access_token) {
        /* Un refus net du serveur (jeton révoqué, compte supprimé
           ailleurs) ne se répare pas en réessayant : autant le dire et
           rendre la main à l'écran de connexion. Une panne réseau, elle,
           laisse la session en place. */
        if (r.status === 400 || r.status === 401) sessionLost();
        return false;
      }
      keepSession(j);
      return true;
    } catch (e) { return false; }
    finally { setRefreshing(null); }
  })());
  return refreshing;
}

function sessionLost() {
  if (!auth) return;
  flushSave();
  saveAuth(null);
  resetSession();
  setAnimate(true); render();
  toast(I.lock, 'Session expirée, reconnecte-toi');
}

/* ce qui attend encore reste sur l'appareil : une déconnexion ne doit pas
   emporter des modifications qu'on n'a pas réussi à envoyer */
function flushSave() { try { save(); } catch (e) { /* quota localStorage dépassé : rien de plus à tenter ici */ } }

/* deleted_at: null est écrit à chaque fois, sans exception. Un paquet
   présent ici est vivant par définition ; sans cette ligne, annuler une
   suppression le remettrait à l'écran tout en le laissant marqué
   supprimé en base — il repartirait au prochain chargement. */
const rowOf = d => ({ id: d.id, user_id: auth.uid, name: d.name, subject: d.subject,
                      hidden: !!d.hidden, cards: d.cards, pos: d.pos || 0,
                      pinned: !!d.pinned, meta: d.meta || {}, deleted_at: null });

/* ---------- conflits entre appareils ----------
   Deux téléphones sur le même compte, l'un hors ligne : au retour du
   réseau, les deux versions existent et aucune n'est « la bonne ». On ne
   choisit pas à la place de l'utilisateur — on montre les deux, avec de
   quoi les départager, et « garder les deux » reste toujours possible. */
async function raiseConflict(d) {
  let row = null;
  try {
    const got = await api(`/rest/v1/decks?id=eq.${encodeURIComponent(d.id)}&select=*`);
    row = got && got[0];
  } catch (e) { /* réseau indisponible : traité comme un paquet distant absent, cf. ligne suivante */ }
  if (!row) { d.rev = 0; dirty[d.id] = 1; return; }   // disparu : on le repose tel quel
  if (conflicts.some(c => c.id === d.id)) return;
  conflicts.push({
    id: d.id,
    mine: { name: d.name, subject: d.subject, hidden: !!d.hidden, pinned: !!d.pinned,
            meta: d.meta || {}, cards: d.cards.slice() },
    theirs: { name: row.name, subject: row.subject, hidden: !!row.hidden, pinned: !!row.pinned,
              meta: row.meta || {}, rev: row.rev,
              cards: (row.cards || []).map(c => ({ ...c, id: c.id || uid() })),
              at: row.updated_at }
  });
  save();
  if (!menu) openMenu('conflict');
}

function applyTo(d, v) {
  d.name = v.name; d.subject = v.subject; d.hidden = v.hidden;
  d.pinned = v.pinned; d.meta = v.meta; d.cards = v.cards;
}

export function solveConflict(how) {
  const c = conflicts.shift(); if (!c) return closeMenu();
  const d = deck(c.id);
  if (!d) { closeMenu(); return render(); }
  d.rev = c.theirs.rev;                      // dans tous les cas on repart de la sienne
  if (how === 'mine') { applyTo(d, c.mine); dirty[d.id] = 1; }
  else if (how === 'theirs') applyTo(d, c.theirs);
  else {
    applyTo(d, c.theirs);
    const n = addDeck(freeName(c.mine.name + ' (cet appareil)'), c.mine.cards, c.mine.subject);
    n.cards = c.mine.cards.map(x => ({ ...x }));   // la progression suit la copie
    dirty[n.id] = 1;
  }
  save(); flush();
  closeMenu();
  if (conflicts.length) return openMenu('conflict');
  render();
  toast(I.check, how === 'both' ? 'Les deux versions sont gardées' : 'Version choisie');
}

/* réglages propres à un paquet : tolérance du quiz, langue par face, chrono.
   La langue suit le CONTENU (recto/verso), jamais le côté physique de la
   carte : si le paquet est inversé (bouton « inverser », mélange des deux
   sens), le texte qui était au recto continue de se lire dans sa langue
   d'origine, même s'il s'affiche maintenant au verso. */
export const DEFMETA = { tol: 'normal', langf: '', langb: '', timer: 0 };

export const metaOf = d => {
  const raw = (d && d.meta) || {};
  const m = { ...DEFMETA, ...raw };
  if (raw.lang && !raw.langb) m.langb = raw.lang;   // ancien réglage : une seule langue, côté verso
  return m;
};

export function setMeta(d, patch) { d.meta = { ...metaOf(d), ...patch }; saveDeck(d); }

/* ---------- la file des écritures qui ne doivent pas se perdre ----------
   Une révision et une séance ne se rattrapent pas : si l'envoi échoue, la
   page jouée n'a jamais existé pour le serveur. C'était le cas jusqu'ici —
   `api(...).catch(() => {})`, et la ligne partait à la poubelle dès qu'on
   révisait dans le métro. Les statistiques s'en trouvaient trouées, et
   l'optimiseur FSRS apprenait sur un historique incomplet.

   Tout passe désormais par cette file : écrite sur l'appareil avec le
   reste du cache, rejouée à la reconnexion, et idempotente — chaque ligne
   porte un identifiant tiré ici, donc la rejouer ne la compte pas deux
   fois (migration 20260917200000). */
const OUTMAX = 5000;

export function enqueue(path, row) {
  outbox.push({ path, row });
  if (outbox.length > OUTMAX) outbox.splice(0, outbox.length - OUTMAX);
  save();
  scheduleFlush();
}

async function flushOutbox() {
  while (outbox.length) {
    const { path, row } = outbox[0];
    try {
      await api(path, 'POST', [row], { Prefer: 'resolution=merge-duplicates,return=minimal' });
    } catch (e) {
      /* 4xx : le serveur a compris et refuse — réessayer à l'infini
         bloquerait tout ce qui suit. On jette cette ligne-là, bruyamment,
         et on continue. 401 et 403 sont à part : le jeton se renouvelle,
         et 429 veut dire « plus tard ». Le reste (réseau, 5xx) attend. */
      const st = e && e.status;
      if (st >= 400 && st < 500 && st !== 401 && st !== 403 && st !== 429) {
        console.error('Folio : ligne refusée par le serveur, abandonnée', path, row, e.message);
        outbox.shift(); save();
        continue;
      }
      throw e;
    }
    outbox.shift(); save();
  }
}

export function scheduleFlush() { clearTimeout(flushTimer); setFlushTimer(setTimeout(flush, 2500)); }

/* Envoi d'un paquet, en tenant compte de ce que le serveur a déjà.
   Chaque ligne porte un numéro de révision ; on n'écrit que si ce numéro
   est encore celui qu'on a lu. Sinon c'est qu'un autre appareil est passé
   entre-temps, et écraser sa version sans rien dire était la façon la plus
   simple de perdre une soirée de travail. Rend false dans ce cas.

   Un paquet créé ici n'a pas encore de révision : il s'insère simplement. */
async function pushDeck(d) {
  const row = rowOf(d);
  if (!d.rev) {
    /* Sans numéro connu, on insère sans en imposer un : si la ligne
       existait déjà, écrire « rev: 1 » la ferait reculer et ferait crier
       au conflit l'appareil qui, lui, est à jour. */
    const got = await api('/rest/v1/decks', 'POST', [row],
      { Prefer: 'resolution=merge-duplicates,return=representation' });
    d.rev = (got && got[0] && got[0].rev) || 1;
    return true;
  }
  const got = await api(`/rest/v1/decks?id=eq.${encodeURIComponent(d.id)}&rev=eq.${d.rev}`,
    'PATCH', { ...row, rev: d.rev + 1 }, { Prefer: 'return=representation' });
  /* Une liste vide, c'est net : aucune ligne ne portait ce numéro, donc
     quelqu'un est passé avant. Pas de corps du tout, en revanche, veut
     seulement dire que le serveur n'a rien renvoyé — ce n'est pas un
     désaccord, et ouvrir une fenêtre de conflit là-dessus serait
     inquiéter pour rien. */
  if (Array.isArray(got) && !got.length) return false;
  d.rev = (got && got[0] && got[0].rev) || d.rev + 1;
  return true;
}

/* M03.T3 — double écriture : le JSONB (ci-dessus) reste la seule chose
   lue, mais chaque paquet poussé pousse aussi une ligne par carte dans
   `cards` (M03.T1), via une fonction serveur qui fait l'upsert et le
   ménage en une seule transaction (migration 20260918090000). Le paquet
   ne quitte `dirty` que si les deux écritures ont réussi : si le miroir
   échoue seul, `pushDeck` est rejoué au prochain passage — un PATCH
   identique est sans conséquence, la file n'a pas d'autre état à tenir
   pour ça. */
async function pushCardsTable(d) {
  await api('/rest/v1/rpc/sync_deck_cards', 'POST', { p_deck_id: d.id, p_cards: d.cards });
}

export async function flush() {
  if (demo || flushing || !auth) return;
  setFlushing(true);
  try {
    const ids = Object.keys(dirty);
    for (const id of ids) {
      const d = deck(id);
      if (!d) { delete dirty[id]; continue; }
      if (await pushDeck(d)) { await pushCardsTable(d); delete dirty[id]; }
      else { delete dirty[id]; await raiseConflict(d); }
    }
    if (ids.length) save();
    /* Supprimer un paquet le marque, ne l'efface pas : il reste
       récupérable trente jours depuis la corbeille. */
    while (gone.length) {
      const id = gone[0];
      await api(`/rest/v1/decks?id=eq.${encodeURIComponent(id)}`, 'PATCH',
        { deleted_at: new Date().toISOString() }, { Prefer: 'return=minimal' });
      gone.shift(); save();
    }
    await flushOutbox();
    setOnline(true);
  } catch (e) { setOnline(false); }
  setFlushing(false);
}

export function setOnline(v) {
  const was = online;
  setOnlineState(v);
  const n = document.getElementById('offdot');
  if (n) n.style.display = v ? 'none' : '';
  /* la pastille porte un compteur : elle change aussi quand la file bouge,
     pas seulement quand le réseau bascule */
  if (view.name === 'home' && (was !== v || document.querySelector('.qchip'))) {
    const top = $.querySelector('.top');
    if (top) {
      const old = top.querySelector('.qchip,#offdot');
      if (old) old.outerHTML = queueChip();
    }
  }
}

/* M03.T6 — bascule des lectures : les cartes viennent désormais de
   `cards` (une ligne chacune, M03.T1), plus du tableau JSONB embarqué
   dans `decks`. Celui-ci reste écrit (double écriture, M03.T3, encore en
   observation jusqu'au 2026-09-25) mais plus lu ici — `decks` ne demande
   même plus la colonne. Les alias (`f:front`, `S:stability`...) évitent
   qu'une carte pèse plus sur le réseau qu'avant : les noms de colonnes,
   lisibles en base, redeviennent les clés courtes que le reste de l'app
   attend, sans passer par une conversion côté client. */
const CARDS_SELECT = 'deck_id,id,f:front,b:back,st:state,sp:step,'
  + 'S:stability,D:difficulty,F:trace2,d:due,lr:last_review,i:interval_days,'
  + 'n:reviews_count,l:lapses,meta';

function cardsParDeck(rows) {
  const m = new Map();
  for (const r of rows) {
    const { deck_id, meta, ...c } = r;
    let arr = m.get(deck_id);
    if (!arr) { arr = []; m.set(deck_id, arr); }
    arr.push({ ...c, ...(meta || {}) });
  }
  return m;
}

function applyPulledPrefs(pf) {
  const wasSimple = prefs.simple;
  setPrefs({ ...DEFPREFS, ...((pf && pf[0] && pf[0].data) || {}) });
  if (pf && pf[0] && pf[0].name) prefs.name = pf[0].name;
  if (study && prefs.simple !== wasSimple) prefs.simple = wasSimple;   // pas de bascule à chaud
}

/* Ce qui attend d'être envoyé ne se fait pas écraser par la relecture :
   on garde la version locale et son tour dans la file. Sans cette
   réserve, ouvrir l'app hors ligne puis retrouver le réseau effaçait la
   dernière séance de travail au moment même où elle allait partir. */
function mergeDecks(decks, cardsByDeck) {
  const held = new Map(db.decks.filter(d => dirty[d.id]).map(d => [d.id, d]));
  const merged = decks.map(x => {
    const mine = held.get(x.id);
    if (mine) { mine.rev = x.rev; held.delete(x.id); return mine; }
    return {
      id: x.id, name: x.name, subject: x.subject, hidden: x.hidden,
      pos: x.pos, pinned: x.pinned, meta: x.meta || {}, rev: x.rev,
      cards: cardsByDeck.get(x.id) || []
    };
  });
  for (const d of held.values()) merged.push(d);   // un paquet créé hors ligne reprend sa place
  return merged;
}

function buildHist(sess) {
  const hist = {};
  for (const r of sess) {
    const k = r.deck_id + ':' + r.mode;
    (hist[k] = hist[k] || []).push({ t: +new Date(r.created_at), p: r.pct });
    if (hist[k].length > 24) hist[k].shift();
  }
  return hist;
}

/* récupère matières, paquets et historique du compte */
export async function pull() {
  const midnight = new Date(); midnight.setHours(0, 0, 0, 0);
  const [subs, decks, cardRows, sess, pf, today, bin, unread] = await Promise.all([
    api('/rest/v1/subjects?select=*&order=pos.asc'),
    api('/rest/v1/decks?select=id,name,subject,hidden,pos,pinned,meta,rev&deleted_at=is.null&order=pos.asc'),
    apiAll(`/rest/v1/cards?select=${CARDS_SELECT}`),
    api('/rest/v1/sessions?select=deck_id,mode,pct,created_at&order=created_at.asc'),
    api('/rest/v1/prefs?select=*'),
    api(`/rest/v1/reviews?select=id&created_at=gte.${midnight.toISOString()}`),
    api('/rest/v1/decks?select=id&deleted_at=not.is.null'),
    api('/rest/v1/mail?select=id&read_at=is.null')
  ]);
  const cardsByDeck = cardsParDeck(cardRows || []);
  trash.n = (bin || []).length;
  mailbox.n = (unread || []).length;
  applyPulledPrefs(pf);
  upsertProfile();
  cerclePull();                 // rôle, coupures, classes : tout arrive ensemble
  db.today = { d: +midnight, n: (today || []).length };
  db.subjects = subs.map(x => ({ id: x.id, name: x.name, color: x.color, pos: x.pos }));
  db.decks = mergeDecks(decks, cardsByDeck);
  db.hist = buildHist(sess);
  if (!db.subjects.length) await seedSubjects();
  /* Les fiches d'avant FSRS reçoivent ici leur état de mémoire, une fois
     pour toutes : sans ça le moteur repartirait de zéro sur toute une
     bibliothèque déjà travaillée. */
  fsrsMigrate();
  fsrsAuto();                            // le moteur se règle tout seul, au calme
  save();
}

async function seedSubjects() {
  db.subjects = SEED.map(([id, name, color], i) => ({ id, name, color, pos: i }));
  await api('/rest/v1/subjects', 'POST',
    db.subjects.map(s => ({ ...s, user_id: auth.uid })),
    { Prefer: 'resolution=merge-duplicates,return=minimal' });
}

export async function pushSubject(s) {
  save();
  return api('/rest/v1/subjects', 'POST', [{ ...s, user_id: auth.uid }],
    { Prefer: 'resolution=merge-duplicates,return=minimal' }).catch(() => setOnline(false));
}

export async function delSubject(id) {
  save();
  return api(`/rest/v1/subjects?id=eq.${encodeURIComponent(id)}`, 'DELETE').catch(() => setOnline(false));
}

/* reprise unique de l'ancienne bibliothèque locale */

export const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const plur = (n, w) => `${n} ${w}${n > 1 ? 's' : ''}`;

/* iOS souligne et rend cliquable tout ce qui ressemble à une adresse
   e-mail : un appui sur le nom de l'expéditeur ouvrait l'app Mail. Un
   liant invisible avant l'arobase suffit à l'en dissuader, sans rien
   changer à ce qu'on lit. */
export const noDetect = s => String(s).replace(/@/g, '\u2060@');

/* Un compte qui n'a pas choisi de nom retombe sur son adresse. Dans une
   liste, la garder entière mange la place du paquet — on n'en montre donc
   que ce qui identifie, « Sam » plutôt que « sam@gmail.com ». L'adresse
   complète reste affichée dans le message ouvert, là où il y a la place
   et où lever un doute compte. */
export const shortWho = s => {
  const t = String(s || '').trim(), at = t.indexOf('@');
  if (at < 1) return t;
  const l = t.slice(0, at).replace(/[._-]+/g, ' ').trim();
  return l.charAt(0).toUpperCase() + l.slice(1);
};
