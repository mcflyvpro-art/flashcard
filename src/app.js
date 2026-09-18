/* Cartes — révision + quiz. PWA, comptes cloisonnés sur Supabase. */
const SB = {
  /* Valeurs injectées au build depuis .env.local (en local) ou les
     variables d'environnement Vercel (en ligne). La clé anon est publique
     par nature : ce sont les règles RLS de la base qui cloisonnent les
     comptes. Elle sort du code pour pouvoir pointer vers un autre projet
     (préproduction, établissement) sans toucher une ligne. */
  url: import.meta.env.VITE_SUPABASE_URL,
  key: import.meta.env.VITE_SUPABASE_ANON_KEY
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
let outbox = [];          // révisions et séances en attente d'envoi
let trash = { n: 0, list: null, err: 0 };
let splitSize = 12;
/* boîte de réception : n = non lus (toujours à jour), list = plein détail
   (chargé seulement à l'ouverture de l'écran, comme la corbeille) */
let mailbox = { n: 0, list: null, err: 0 };
let stats = { rows: null, err: 0, range: 30 };
let reorder = false;          // l'accueil est en cours de réorganisation
let previewOf = null;         // paquet dont on regarde l'aperçu
let findQ = '';               // recherche globale
let deckQ = '';               // recherche à l'intérieur d'un paquet
let deckOpen = false;         // son champ est-il déployé
const DECKPAGE = 80;          // cartes posées d'un coup dans la liste
let deckShow = DECKPAGE;
let leaving = null;           // action de sortie en attente de confirmation
let friends = null;          // annuaire des autres comptes, pour choisir un destinataire
let sendTo = null;           // destinataire choisi dans la feuille d'envoi
let mailOpen = null;         // id de l'e-mail affiché dans sa feuille de détail
let sendMsg = '';            // message en cours de frappe dans la feuille d'envoi
let lib = { list: null, err: 0, open: null };      // l'étagère commune du groupe
let duels = { list: null, scores: null, err: 0, open: null };
let board = { rows: null, err: 0, range: 7 };
let shared = null;            // paquet ouvert par un lien de consultation
let duelRun = null;           // défi en cours de partie
let groupTab = 'lib';         // onglet courant de la bibliothèque du groupe
/* Où l'on regarde, et donc où l'on publie. null = mes lecteurs (les amis
   acceptés), sinon l'identifiant d'un club. La base sait déjà cloisonner
   — library.group_id et duels.group_id existent, et leurs règles de
   lecture s'appuient dessus — mais rien ne les renseignait : tout partait
   donc avec group_id nul, c'est-à-dire à tous les amis, sans qu'on ait
   jamais eu le choix. */
let scope = null;
const scopeName = () => {
  const g = (groups || []).find(x => x.id === scope);
  return g ? g.name : 'Mes lecteurs';
};
let mates = null, asks = null;   // amis acceptés, demandes reçues
let me = null;                   // mon profil public : pseudo
let groups = null, groupOf = null;  // mes groupes, et celui qu'on regarde
let addQ = '';                   // pseudo en cours de frappe
let mateOpen = null;             // ami dont on regarde la fiche

/* ---------- annuler ----------
   Avant toute action qui écrase ou efface, on photographie les paquets
   touchés. Annuler repose la photo et la repousse en base. Dix pas en
   arrière suffisent : au-delà, ce n'est plus une erreur qu'on rattrape. */
let undos = [];
const snap = ids => ids.map(id => {
  const d = db.decks.find(x => x.id === id);
  return { id, deck: d ? JSON.parse(JSON.stringify(d)) : null };
});
function pushUndo(label, ids) {
  undos.push({ label, before: snap(ids) });
  if (undos.length > 10) undos.shift();
}
function canUndo() { return undos.length > 0; }
const undoLabel = () => (undos.length ? undos[undos.length - 1].label : '');
function doUndo() {
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

function loadAuth() { try { return JSON.parse(localStorage.getItem(AKEY)); } catch (e) { return null; } }
function saveAuth(a) { auth = a; a ? localStorage.setItem(AKEY, JSON.stringify(a)) : localStorage.removeItem(AKEY); }
const cacheKey = () => 'cartes.cache.' + (auth && auth.uid);

/* ---------- réglages du compte ----------
   simple  : moteur coupé, on ne fait plus que swiper
   simpleAt: date de bascule, pour étaler l'arriéré au retour du moteur       */
const DEFPREFS = { goal: 30, cap: 20, order: 'random', fresh: true, sound: false,
                   font: 1, tol: 'normal', name: '', simple: false, simpleAt: 0, fast: false,
                   sort: 'manual', list: false, zen: false,
                   /* FSRS : rétention visée, paramètres du modèle, intervalle
                      plafond. `w` vide = les paramètres par défaut du moteur. */
                   dr: 0.9, w: null, maxIvl: 36500, wAt: 0, wN: 0 };
let prefs = { ...DEFPREFS };
let prefsTimer = 0;

/* La file d'attente est enregistrée avec les données. Sans elle, une
   modification faite dans le métro survivait à l'écran mais pas au
   rechargement : le prochain démarrage relisait la base et remplaçait
   tout par la version du serveur, sans un mot. Ce qui est en attente est
   donc noté noir sur blanc, et repart dès que le réseau revient. */
function load() {
  try {
    const d = JSON.parse(localStorage.getItem(cacheKey()));
    if (d && Array.isArray(d.decks)) {
      prefs = { ...DEFPREFS, ...(d.prefs || {}) };     // le mode reste le bon hors ligne
      dirty = d.dirty && typeof d.dirty === 'object' ? { ...d.dirty } : {};
      gone = Array.isArray(d.gone) ? d.gone.slice() : [];
      outbox = Array.isArray(d.outbox) ? d.outbox.slice() : [];
      return { subjects: d.subjects || [], decks: d.decks, hist: d.hist || {}, today: d.today };
    }
  } catch (e) {}
  return { subjects: [], decks: [], hist: {} };
}
function save() {
  if (demo) return;                       // la démonstration n'écrase pas le cache du compte
  if (auth) localStorage.setItem(cacheKey(), JSON.stringify({ ...db, prefs, dirty, gone, outbox }));
}
/* combien de changements attendent leur tour */
const pending = () => Object.keys(dirty).length + gone.length + outbox.length;
/* enregistre localement puis pousse en base */
function saveDeck(d) {
  /* marquer d'abord, enregistrer ensuite : dans l'autre sens, la copie
     écrite sur l'appareil ignorait que ce paquet restait à envoyer, et un
     rechargement hors ligne effaçait le travail en le relisant du serveur. */
  if (d) dirty[d.id] = 1;
  save();
  if (d) flush();
}

function pushHist(id, mode, pct) {
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
const histOf = (id, mode) => db.hist[id + ':' + mode] || [];

const uid = () => (crypto.randomUUID ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 3 | 8)).toString(16);
    }));
const deck = id => db.decks.find(d => d.id === id);
const live = () => db.decks.filter(d => !d.hidden);
const slugify = n => (n || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'matiere';

/* ---------- accès à Supabase ---------- */
async function api(path, method = 'GET', body, extra = {}) {
  /* Pendant la visite guidée, aucune requête ne part : ni lecture, ni
     écriture. Le compte de démonstration n'existe que dans cet onglet. */
  if (demo) return [];
  /* On renouvelle avant d'essuyer un refus plutôt qu'après : un 401 au
     milieu d'un envoi coûte un aller-retour et, sur une requête d'écriture,
     la refaire n'est pas toujours anodin. */
  if (auth && auth.refresh && auth.exp && Date.now() > auth.exp - 60000) await refreshToken();
  const h = { apikey: SB.key, 'Content-Type': 'application/json', ...extra };
  if (auth && auth.token) h.Authorization = 'Bearer ' + auth.token;
  const r = await fetch(SB.url + path, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  if (r.status === 401 && auth && auth.refresh) {
    if (await refreshToken()) return api(path, method, body, extra);
  }
  if (!r.ok) {
    const e = new Error(await r.text().catch(() => String(r.status)));
    e.status = r.status;                 // la file d'attente en a besoin
    throw e;
  }
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
async function apiPage(path, from, to) {
  if (demo) return { rows: [], total: 0 };
  if (auth && auth.refresh && auth.exp && Date.now() > auth.exp - 60000) await refreshToken();
  const h = { apikey: SB.key, Range: `${from}-${to}`, Prefer: 'count=exact' };
  if (auth && auth.token) h.Authorization = 'Bearer ' + auth.token;
  const r = await fetch(SB.url + path, { headers: h });
  if (r.status === 401 && auth && auth.refresh) {
    if (await refreshToken()) return apiPage(path, from, to);
  }
  if (!r.ok && r.status !== 206) {
    const e = new Error(await r.text().catch(() => String(r.status)));
    e.status = r.status;
    throw e;
  }
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
/* Supabase fait tourner le jeton de rafraîchissement : chaque échange en
   rend un neuf et invalide l'ancien. Deux appels partis en même temps —
   ce qui arrive dès qu'on revient sur l'app et que trois requêtes
   redémarrent ensemble — se battaient donc pour le même jeton, et le
   perdant déconnectait le compte. Un seul échange à la fois, tout le
   monde attend le même. */
let refreshing = null;
function refreshToken() {
  if (refreshing) return refreshing;
  const had = auth && auth.refresh;
  refreshing = (async () => {
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
    finally { refreshing = null; }
  })();
  return refreshing;
}
function sessionLost() {
  if (!auth) return;
  flushSave();
  saveAuth(null);
  resetSession();
  animate = true; render();
  toast(I.lock, 'Session expirée, reconnecte-toi');
}
/* ce qui attend encore reste sur l'appareil : une déconnexion ne doit pas
   emporter des modifications qu'on n'a pas réussi à envoyer */
function flushSave() { try { save(); } catch (e) {} }

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
let conflicts = [];
async function raiseConflict(d) {
  let row = null;
  try {
    const got = await api(`/rest/v1/decks?id=eq.${encodeURIComponent(d.id)}&select=*`);
    row = got && got[0];
  } catch (e) {}
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
function solveConflict(how) {
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
const DEFMETA = { tol: 'normal', langf: '', langb: '', timer: 0 };
const metaOf = d => {
  const raw = (d && d.meta) || {};
  const m = { ...DEFMETA, ...raw };
  if (raw.lang && !raw.langb) m.langb = raw.lang;   // ancien réglage : une seule langue, côté verso
  return m;
};
function setMeta(d, patch) { d.meta = { ...metaOf(d), ...patch }; saveDeck(d); }

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
const OUTMAX = 5000;              // au-delà, l'appareil a un vrai problème
function enqueue(path, row) {
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

/* pousse tout ce qui est en attente ; garde la file si le réseau manque */
let flushTimer = 0;
function scheduleFlush() { clearTimeout(flushTimer); flushTimer = setTimeout(flush, 2500); }
let flushing = false;
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
async function flush() {
  if (demo || flushing || !auth) return;
  flushing = true;
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
  flushing = false;
}
function setOnline(v) {
  const was = online;
  online = v;
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

/* récupère matières, paquets et historique du compte */
async function pull() {
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
  const wasSimple = prefs.simple;
  prefs = { ...DEFPREFS, ...((pf && pf[0] && pf[0].data) || {}) };
  if (pf && pf[0] && pf[0].name) prefs.name = pf[0].name;
  if (study && prefs.simple !== wasSimple) prefs.simple = wasSimple;   // pas de bascule à chaud
  upsertProfile();
  cerclePull();                 // rôle, coupures, classes : tout arrive ensemble
  db.today = { d: +midnight, n: (today || []).length };
  db.subjects = subs.map(x => ({ id: x.id, name: x.name, color: x.color, pos: x.pos }));
  /* Ce qui attend d'être envoyé ne se fait pas écraser par la relecture :
     on garde la version locale et son tour dans la file. Sans cette
     réserve, ouvrir l'app hors ligne puis retrouver le réseau effaçait la
     dernière séance de travail au moment même où elle allait partir. */
  const held = new Map(db.decks.filter(d => dirty[d.id]).map(d => [d.id, d]));
  db.decks = decks.map(x => {
    const mine = held.get(x.id);
    if (mine) { mine.rev = x.rev; held.delete(x.id); return mine; }
    return {
      id: x.id, name: x.name, subject: x.subject, hidden: x.hidden,
      pos: x.pos, pinned: x.pinned, meta: x.meta || {}, rev: x.rev,
      cards: cardsByDeck.get(x.id) || []
    };
  });
  /* un paquet créé hors ligne n'est encore nulle part : il reprend sa place */
  for (const d of held.values()) db.decks.push(d);
  db.hist = {};
  for (const r of sess) {
    const k = r.deck_id + ':' + r.mode;
    (db.hist[k] = db.hist[k] || []).push({ t: +new Date(r.created_at), p: r.pct });
    if (db.hist[k].length > 24) db.hist[k].shift();
  }
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
  out: '<path d="M14 4.5h4.2a1.3 1.3 0 0 1 1.3 1.3v12.4a1.3 1.3 0 0 1-1.3 1.3H14"/><path d="M9.6 8.2 5.4 12l4.2 3.8M5.8 12H15"/>',
  more: '<circle cx="6" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="18" cy="12" r="1.5" fill="currentColor" stroke="none"/>',
  card: '<rect x="3" y="5.2" width="18" height="13.6" rx="3"/><path d="M7.2 10h6M7.2 13.4h9"/>',
  tag: '<path d="M11.4 3.6H20v8.6l-8.8 8.8a1.6 1.6 0 0 1-2.3 0l-6.3-6.3a1.6 1.6 0 0 1 0-2.3z"/><circle cx="16.3" cy="7.7" r="1.3"/>',
  book: '<path d="M5 4.5h9.5A2.5 2.5 0 0 1 17 7v12.5H7.5A2.5 2.5 0 0 1 5 17z"/><path d="M5 17a2.5 2.5 0 0 1 2.5-2.5H17"/>',
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
  file: '<path d="M13.4 3.6H7.4a2 2 0 0 0-2 2v12.8a2 2 0 0 0 2 2h9.2a2 2 0 0 0 2-2V8.8z"/><path d="M13.4 3.6v5.2h5.2"/><path d="M8.8 13.4h6.4M8.8 16.6h4.2"/>',
  image: '<rect x="3" y="5" width="18" height="14" rx="3.2"/><circle cx="8.6" cy="10" r="1.5"/><path d="M4.2 17.4l4.6-4.3 3.4 3 3-2.6 4.6 4"/>',
  clock: '<circle cx="12" cy="12" r="8.4"/><path d="M12 7.4V12l3.2 2"/>',
  bulb: '<path d="M9.6 17.6h4.8M10.2 20.4h3.6"/><path d="M12 3.6a5.6 5.6 0 0 0-3.3 10.1c.6.5 1 1.2 1 1.9h4.6c0-.7.4-1.4 1-1.9A5.6 5.6 0 0 0 12 3.6z"/>',
  flame: '<path d="M12 3.5c3 3 4.8 5.3 4.8 8.2a4.8 4.8 0 1 1-9.6 0c0-1.7.8-3.2 2-4.4.1 1.6.8 2.5 1.7 2.5 1 0 1.6-.9 1.6-2.4 0-1.4-.3-2.7-.5-3.9z"/>',
  grid: '<rect x="3.6" y="3.6" width="7" height="7" rx="2"/><rect x="13.4" y="3.6" width="7" height="7" rx="2"/><rect x="3.6" y="13.4" width="7" height="7" rx="2"/><rect x="13.4" y="13.4" width="7" height="7" rx="2"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l2.8-2.8a4 4 0 0 0-5.7-5.7L11.4 6.9"/><path d="M14 10a4 4 0 0 0-5.7 0L5.5 12.8a4 4 0 0 0 5.7 5.7l1.4-1.4"/>',
  grip: '<path d="M9.4 6.4h.02M9.4 12h.02M9.4 17.6h.02M14.6 6.4h.02M14.6 12h.02M14.6 17.6h.02" stroke-width="2.9" stroke-linecap="round"/>',
  pick: '<path d="M5.4 9.2V6.6a1.2 1.2 0 0 1 1.2-1.2h2.6M14.8 5.4h2.6a1.2 1.2 0 0 1 1.2 1.2v2.6"/><path d="M18.6 14.8v2.6a1.2 1.2 0 0 1-1.2 1.2h-2.6M9.2 18.6H6.6a1.2 1.2 0 0 1-1.2-1.2v-2.6"/><path d="m9.3 12.1 2 2 3.4-3.9"/>',
  warn: '<path d="M12 4.6 3.2 19.4h17.6z"/><path d="M12 10.2v4.2M12 17.1h.02" stroke-width="2.4"/>',
  zen: '<path d="M8.6 3.8H5.6a1.8 1.8 0 0 0-1.8 1.8v3M15.4 3.8h3a1.8 1.8 0 0 1 1.8 1.8v3"/><path d="M8.6 20.2h-3a1.8 1.8 0 0 1-1.8-1.8v-3M15.4 20.2h3a1.8 1.8 0 0 0 1.8-1.8v-3"/>',
  pin: '<path d="M9.4 3.8h5.2l-.6 5.2 3 3.2H7l3-3.2z"/><path d="M12 12.2v7.4"/>',
  sort: '<path d="M4.6 7h9.8M4.6 12h6.6M4.6 17h3.4"/><path d="M17.4 6.6v10.8m0 0 2.4-2.6m-2.4 2.6-2.4-2.6"/>',
  rows: '<rect x="3.6" y="5" width="16.8" height="4.4" rx="1.6"/><rect x="3.6" y="14.6" width="16.8" height="4.4" rx="1.6"/>',
  chart: '<path d="M4 20V4"/><path d="M4 20h16"/><rect x="7.4" y="12" width="3" height="5" rx="1"/><rect x="12.4" y="8.4" width="3" height="8.6" rx="1"/><rect x="17.4" y="5.6" width="3" height="11.4" rx="1"/>',
  quote: '<rect x="3.6" y="4.4" width="16.8" height="12.2" rx="3.4"/><path d="M8.8 16.6v3.3l4.2-3.3"/>',
  search: '<circle cx="10.8" cy="10.8" r="6.4"/><path d="M15.5 15.5 20 20"/>',
  copy: '<rect x="8.6" y="8.6" width="11.8" height="11.8" rx="3"/><path d="M15.4 5.6a2 2 0 0 0-2-2H6.6a3 3 0 0 0-3 3v6.8a2 2 0 0 0 2 2"/>',
  split: '<path d="M12 3.6v6.8"/><path d="M12 10.4 6.6 15v5.4M12 10.4 17.4 15v5.4"/><circle cx="12" cy="3.6" r="0"/>',
  type: '<path d="M4.5 7.5V5.5h15v2M12 5.5v13M8.8 18.5h6.4"/>',
  skip: '<path d="M6 5.6l9 6.4-9 6.4z"/><path d="M18 5.6v12.8"/>',
  brain: '<path d="M12 5.6v12.8"/><path d="M12 6.6a2.5 2.5 0 1 0-3.5 2.3 2.5 2.5 0 0 0-.9 4.6 2.5 2.5 0 0 0 4.4 1.7"/><path d="M12 6.6a2.5 2.5 0 1 1 3.5 2.3 2.5 2.5 0 0 1 .9 4.6 2.5 2.5 0 0 1-4.4 1.7"/>',
  school: '<path d="M12 4 2.8 8.4 12 12.8l9.2-4.4z"/><path d="M6.6 10.6v5.2c0 1.6 2.4 3 5.4 3s5.4-1.4 5.4-3v-5.2"/><path d="M21.2 8.4v5.4"/>',
  users: '<circle cx="9.4" cy="8.6" r="3.4"/><path d="M3.4 19.4a6 6 0 0 1 12 0"/><path d="M16.2 5.6a3.4 3.4 0 0 1 0 6.6M17.6 14.4a5.6 5.6 0 0 1 3.4 5"/>',
  build: '<path d="M4 20.4V9.6l7-4.2 7 4.2v10.8"/><path d="M2.4 20.4h19.2"/><rect x="8.2" y="12.4" width="5.6" height="8"/>',
  mail2: '<rect x="3" y="5.4" width="18" height="13.2" rx="2.6"/><path d="m3.8 7 8.2 5.6L20.2 7"/>',
  refresh: '<path d="M20 11.2a8 8 0 0 0-13.8-4.8L3.6 9"/><path d="M4 12.8a8 8 0 0 0 13.8 4.8L20.4 15"/><path d="M3.6 4.4V9h4.6M20.4 19.6V15h-4.6"/>',
  cal: '<rect x="3.4" y="5" width="17.2" height="15.4" rx="3"/><path d="M3.4 9.6h17.2M8.2 3.4v3.4M15.8 3.4v3.4"/>',
  money: '<circle cx="12" cy="12" r="8.4"/><path d="M12 7v10M14.6 9.4a2.8 2.8 0 0 0-2.6-1.4c-1.6 0-2.6.9-2.6 2s.9 1.8 2.6 2.1c1.7.3 2.6 1 2.6 2.1s-1 2-2.6 2a2.8 2.8 0 0 1-2.6-1.4"/>'
};
const svg = p => `<svg viewBox="0 0 24 24">${p}</svg>`;
const SWIPE = `<svg viewBox="0 0 72 24">${I.swipe}</svg>`;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const plur = (n, w) => `${n} ${w}${n > 1 ? 's' : ''}`;
/* iOS souligne et rend cliquable tout ce qui ressemble à une adresse
   e-mail : un appui sur le nom de l'expéditeur ouvrait l'app Mail. Un
   liant invisible avant l'arobase suffit à l'en dissuader, sans rien
   changer à ce qu'on lit. */
const noDetect = s => String(s).replace(/@/g, '\u2060@');
/* Un compte qui n'a pas choisi de nom retombe sur son adresse. Dans une
   liste, la garder entière mange la place du paquet — on n'en montre donc
   que ce qui identifie, « Sam » plutôt que « sam@gmail.com ». L'adresse
   complète reste affichée dans le message ouvert, là où il y a la place
   et où lever un doute compte. */
const shortWho = s => {
  const t = String(s || '').trim(), at = t.indexOf('@');
  if (at < 1) return t;
  const l = t.slice(0, at).replace(/[._-]+/g, ' ').trim();
  return l.charAt(0).toUpperCase() + l.slice(1);
};

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
   nom du compte : les règles d'accès n'autorisent ni l'écriture ni la
   lecture ailleurs.

   Le seau n'est plus public. Il l'était, et c'était le trou le plus net
   du projet : la photo d'un cours ou l'enregistrement de la voix d'un
   élève se lisait sans compte, par simple URL, indéfiniment — un
   identifiant illisible n'a jamais été un contrôle d'accès.

   Ce qu'on range dans la carte est donc un chemin, plus une adresse.
   L'adresse est signée au moment de l'affichage et ne vaut que quelques
   heures. Une valeur absolue (http…) est laissée telle quelle : une
   carte écrite avant ce changement continue de s'afficher. */
/* Une adresse du seau, quelle que soit sa forme, redonne son chemin. On
   reconnaît aussi les anciennes adresses publiques : les cartes écrites
   avant la fermeture du seau pointaient vers /object/public/…, qui ne
   répond plus rien — plutôt que de les laisser cassées, on en extrait le
   chemin et on les relit comme les autres. Une adresse étrangère au seau
   (data:, blob:, un autre site) rend une chaîne vide : elle s'affiche
   telle quelle, sans passer par ici. */
const MOBJ = /\/storage\/v1\/object\/(?:public|authenticated|sign)\/media\/(.+?)(?:\?|$)/;
const mediaPath = r => {
  if (!r) return '';
  const m = String(r).match(MOBJ);
  if (m) return decodeURIComponent(m[1]);
  return /^(https?:|data:|blob:)/i.test(r) ? '' : String(r);
};
/* Le seau est privé : un <img src> ne sait pas porter d'en-tête
   d'autorisation. On récupère donc l'octet avec le jeton du compte, et on
   donne à la balise une adresse locale. Un seul mécanisme, sans durée de
   validité à surveiller — et le navigateur garde l'objet tant que
   l'onglet vit. */
const mediaCache = new Map();              // chemin -> adresse locale
async function mediaUrl(path) {
  const hit = mediaCache.get(path);
  if (hit) return hit;
  if (!auth) throw new Error('auth');
  if (auth.exp && Date.now() > auth.exp - 60000) await refreshToken();
  const h = { apikey: SB.key, Authorization: 'Bearer ' + auth.token };
  /* Deux chemins vers le même octet. Le direct d'abord ; si le serveur ne
     le sert pas, on demande une adresse signée et on la suit. Garder les
     deux coûte six lignes et évite de faire dépendre l'affichage d'une
     seule route — celle-là, je ne peux pas l'essayer avant de livrer. */
  let r = await fetch(`${SB.url}/storage/v1/object/authenticated/media/${path}`, { headers: h });
  if (!r.ok) {
    const s = await fetch(`${SB.url}/storage/v1/object/sign/media/${path}`, {
      method: 'POST', headers: { ...h, 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresIn: 3600 })
    });
    if (!s.ok) throw new Error('media:' + r.status + '/' + s.status);
    const j = await s.json().catch(() => null);
    /* la casse du champ a changé entre les versions de l'API : on accepte
       les deux plutôt que de parier sur celle d'aujourd'hui */
    const rel = j && (j.signedURL || j.signedUrl);
    if (!rel) throw new Error('media:sign');
    r = await fetch(SB.url + '/storage/v1' + (rel[0] === '/' ? rel : '/' + rel), { headers: h });
    if (!r.ok) throw new Error('media:' + r.status);
  }
  const url = URL.createObjectURL(await r.blob());
  mediaCache.set(path, url);
  return url;
}
/* L'écran se peint d'un coup, la récupération prend un aller-retour :
   l'image part donc sans adresse et la reçoit dès qu'elle arrive. */
const mimg = (cls, r) => {
  if (!r) return '';
  const p = mediaPath(r);
  return p ? `<img class="${cls}" data-m="${esc(p)}" alt="">`
           : `<img class="${cls}" src="${esc(r)}" alt="">`;
};
function paintMedia(root) {
  (root || document).querySelectorAll('img[data-m]').forEach(el => {
    const p = el.dataset.m;
    delete el.dataset.m;                   // une seule tentative par image
    /* Une image qu'on n'a pas pu chercher s'efface au lieu de laisser le
       carré cassé du navigateur : la fiche se lit encore, et le texte
       reprend la place. La cause part dans la console, pas à l'écran. */
    mediaUrl(p).then(u => { el.src = u; },
                     e => { console.warn('média', p, String(e && e.message)); el.remove(); });
  });
}

/* Le seau n'accepte qu'une liste de types. Safari ne rend pas « audio/mp4 »
   mais « audio/mp4;codecs=… » : le seau comparait la chaîne entière, ne
   reconnaissait rien, et refusait tous les enregistrements du micro sur
   iPhone. On ne garde donc que le type, sans ses paramètres.
   L'extension se déduit du type et non du nom : un enregistrement n'a pas
   de nom de fichier, et celui qu'on lui inventait annonçait « .webm »
   pour un contenu qui n'en était pas un. */
const MEXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
               'audio/webm': 'webm', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/ogg': 'ogg' };
/* Vrai quand on est en train de composer ou d'éditer un livre destiné à
   une classe : ses médias doivent être lisibles par les élèves. */
const coursOuvert = () => !!(comp && comp.cours)
  || !!(view.id && (deck(view.id) || {}).cours);

async function upload(file) {
  if (!auth) throw new Error('auth');
  if (file.size > 7.5e6) throw new Error('big');
  const mime = String(file.type || '').split(';')[0].trim().toLowerCase();
  const named = ((file.name || '').split('.').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const ext = MEXT[mime] || named || 'bin';
  /* Ce qui est déposé depuis un livre de cours part sous « cours/<uid>/ » :
     c'est le seul préfixe que la classe peut lire. Le reste de la
     bibliothèque du professeur lui reste privé. */
  const path = `${coursOuvert() ? 'cours/' : ''}${auth.uid}/${uid()}.${ext}`;
  if (auth.exp && Date.now() > auth.exp - 60000) await refreshToken();
  const r = await fetch(`${SB.url}/storage/v1/object/media/${path}`, {
    method: 'POST',
    headers: { apikey: SB.key, Authorization: 'Bearer ' + auth.token,
               'Content-Type': mime || 'application/octet-stream', 'x-upsert': 'true' },
    body: file
  });
  /* Le code de refus est repris dans le message : « impossible » sans
     rien d'autre ne se diagnostique pas, et c'est toujours le même mot
     pour un type refusé, un jeton périmé ou un seau plein. */
  if (!r.ok) throw new Error('up:' + r.status);
  return path;                             // le chemin, pas l'adresse : elle se résout à l'affichage
}
/* Dire ce qui a été refusé, et par qui. Un même « envoi impossible »
   couvrait le type rejeté, le jeton périmé et la coupure réseau : trois
   causes, trois gestes différents pour s'en sortir. */
function upErr(x) {
  const m = String((x && x.message) || '');
  if (m === 'big') return 'Fichier trop lourd';
  if (m === 'auth') return 'Reconnecte-toi pour envoyer';
  const code = (m.match(/^up:(\d+)$/) || [])[1];
  if (code === '415') return 'Ce format de fichier n’est pas accepté';
  if (code === '413') return 'Fichier trop lourd pour le serveur';
  if (code === '401' || code === '403') return 'Session expirée, reconnecte-toi';
  return code ? `Envoi refusé (${code})` : 'Envoi impossible — réseau ?';
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
/* Le son porte un chemin comme l'image : on le signe avant de le jouer.
   L'appui est déjà passé quand l'adresse arrive, mais c'est un
   aller-retour, pas une attente — et le navigateur garde l'autorisation
   de jouer accordée par le geste. */
async function play(ref) {
  try {
    const p = mediaPath(ref);
    const url = p ? await mediaUrl(p) : ref;
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

/* parseText, parseRaw et le reste du parseur de cartes : voir
   src/parseur.js (M01.T4, collage/Quizlet/CSV) */

/* ---------- doublons ----------
   Deux cartes font doublon si leur recto se lit pareil une fois la
   ponctuation et la casse mises de côté. On les signale, on ne les jette
   jamais sans le dire : c'est parfois voulu (deux sens d'un même mot). */
/* Un paquet entier tient dans une seule ligne de base : une carte
   démesurée ne gêne pas qu'elle-même, elle fait grossir chaque envoi du
   paquet et finit par les faire échouer tous. Les bornes sont larges — un
   article de code entre sans problème — mais elles existent. */
const MAXF = 500, MAXB = 4000;
const overLen = c => plain(c.f || '').length > MAXF ? 'f'
                   : plain(c.b || '').length > MAXB ? 'b' : '';
function markOver(cards) {
  let n = 0;
  for (const c of cards) {
    const o = overLen(c);
    if (o) { c.big = o; n++; } else delete c.big;
  }
  return n;
}
function markDups(cards, target) {
  const here = new Set((target ? target.cards : []).map(c => norm(c.f || '')));
  const seen = new Set();
  let inside = 0, already = 0;
  for (const c of cards) {
    const k = norm(c.f || '');
    if (seen.has(k)) { c.dup = 'inside'; inside++; }
    else if (here.has(k)) { c.dup = 'deck'; already++; }
    else delete c.dup;
    seen.add(k);
  }
  return { inside, already, total: inside + already };
}


import {
  DAY, MIN, S_MIN, S_MAX, D_MIN, D_MAX, cl, W6,
  fsrsR, fsrsStates, dayNo, fsrsReplayAll
} from './fsrs.js';
import { buildQueue, isDue, isLeech, shuffle } from './file.js';
import { parseText } from './parseur.js';

/* ══════════ FSRS ══════════
   Le moteur lui-même est dans src/fsrs.js — voir son bandeau. Ici ne
   restent que les trois choses qu'il ne peut pas savoir : les réglages du
   compte, et ce que l'app en fait. */
const fsrsW = () => (prefs.w && (prefs.w.length === 34 || prefs.w.length === 21)) ? prefs.w : W6;
const fsrsDR = () => cl(prefs.dr || 0.9, 0.7, 0.99);
const fsrsMax = () => Math.max(1, prefs.maxIvl || 36500);
const fsrsCfg = () => ({ w: fsrsW(), dr: fsrsDR(), maxIvl: fsrsMax() });

/* Probabilité de se rappeler la fiche à l'instant t : c'est la grandeur
   que FSRS optimise, et celle qui décide de l'échéance. */
function recall(c, at) {
  if (!c || !c.S || !c.lr) return c && c.n ? 0 : 1;
  const t = Math.max(0, Math.floor(((at || Date.now()) - c.lr) / DAY));
  return fsrsR(fsrsW(), t, { S: c.S, D: c.D || 5, F: c.F || c.S });
}
/* Les quatre boutons, calculés ensemble : l'aperçu affiché et ce qui sera
   réellement appliqué sortent du même calcul, donc ils ne peuvent pas
   diverger. */
const etats = (c, now) => fsrsStates(c, now || Date.now(), fsrsCfg());


const cstate = c => {
  if (c.x) return 'susp';
  if (!c.n && !c.S) return 'new';
  if (c.st === 1 || c.st === 3 || !c.i || c.i < 1) return 'learn';
  return c.i < 21 ? 'young' : 'mature';
};
/* Les quatre âges d'une fiche, dans le vocabulaire du livre : on l'ouvre,
   on la travaille, on la relit, puis on la sait. */
const STATE = { new: 'À lire', learn: 'En cours', young: 'Relue',
                mature: 'Sue', susp: 'De côté' };
/* isLeech, isDue : voir src/file.js (M01.T3, la file de révision) */

function grade(c, rating) {
  const now = Date.now();
  const p = etats(c, now)[cl(rating | 0, 0, 3)];
  if (rating === 0 && (c.st === 2 || (c.i || 0) >= 1)) c.l = (c.l || 0) + 1;
  c.S = p.S; c.D = p.D; c.F = p.F;
  c.st = p.st; if (p.sp == null) delete c.sp; else c.sp = p.sp;
  c.i = p.ivl; c.d = p.d; c.lr = now;
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
  if (j < 31) return j + ' j';
  if (j < 365) return Math.round(j / 30) + ' mois';
  const an = j / 365;
  return (an < 10 ? an.toFixed(1).replace('.0', '').replace('.', ',') : Math.round(an)) + ' ans';
}
/* Ce que le moteur sait d'une page, dit en clair. La stabilité est le
   nombre de jours au bout duquel le souvenir retombe à 90 % ; la
   difficulté, la peine intrinsèque de la page sur dix. Ces deux nombres,
   plus la date du dernier passage, suffisent à placer le suivant. */
function memDays(v) {
  if (v < 1) return Math.max(1, Math.round(v * 24)) + ' h';
  if (v < 31) return Math.round(v) + ' j';
  if (v < 365) return Math.round(v / 30) + ' mois';
  const an = v / 365;
  return (an < 10 ? an.toFixed(1).replace('.0', '').replace('.', ',') : Math.round(an)) + ' ans';
}
function memLine(c) {
  if (!c.S) return '';
  return `souvenir ${Math.round(recall(c, Date.now()) * 100)} %`
    + ` · tient ${memDays(c.S)}`
    + ` · difficulté ${(Math.round((c.D || 5) * 10) / 10).toString().replace('.', ',')}/10`;
}
/* Ce que proposerait chaque bouton, pour l'afficher dessus. Le flou étant
   dérivé de la fiche, l'aperçu dit exactement la vérité. */
function preview(c, rating) {
  const p = etats(c)[cl(rating | 0, 0, 3)];
  return nextIn({ d: p.d });
}

/* ---------- recalcul depuis l'historique réel ----------
   Le rejeu lui-même (`fsrsReplayAll`) est dans src/fsrs.js, pur et testé
   (test/revlog.test.js) : ici ne reste que ce qu'un module pur ne peut
   pas savoir — où vivent les fiches, et comment les écritures se
   propagent (file durable, sauvegarde). */
function fsrsReplay(rows) {
  const results = fsrsReplayAll(rows, fsrsCfg());
  const index = new Map();
  for (const d of db.decks) for (const c of d.cards) index.set(c.id, [c, d]);
  let done = 0;
  for (const [id, state] of results) {
    const hit = index.get(id); if (!hit) continue;
    const [c, d] = hit;
    c.S = state.S; c.D = state.D; c.F = state.F; c.lr = state.lr;
    c.st = state.st; delete c.sp;
    c.n = Math.max(c.n || 0, state.n);
    c.l = Math.max(c.l || 0, state.l);
    /* l'échéance n'est pas touchée : on refait la mémoire, pas le calendrier,
       exactement comme Anki qui ne replanifie que si on le lui demande */
    c.i = state.i;
    dirty[d.id] = 1; done++;
  }
  if (done) { save(); scheduleFlush(); }
  return done;
}

/* ══════════ l'optimiseur officiel ══════════
   Les paramètres par défaut décrivent un apprenant moyen. Anki apprend les
   tiens sur ton propre historique : c'est ce qui fait la moitié de sa
   force. L'optimiseur n'existe qu'en Rust ; plutôt que d'en réécrire un,
   `fsrs.wasm` est le crate officiel `fsrs` 6.6.2 — la version exacte
   qu'Anki épingle — compilé pour le navigateur (voir tools/BUILD-FSRS.md).
   Il tourne dans un fil séparé pour que rien ne se fige à l'écran.        */

const OPT_MIN_REVIEWS = 400;          // en dessous, les défauts font mieux
const OPT_EVERY = 14 * DAY;           // on repasse toutes les deux semaines
const OPT_GROWTH = 1.25;              // ou dès que l'historique a bien grossi

/* La conversion d'Anki (convert_to_fsrs_items) : chaque fiche donne un
   élément par révision — la révision et tout ce qui l'a précédée — et on
   écarte ceux dont la dernière révision tombe le jour même, qui
   n'apprennent rien sur l'oubli. */
function fsrsItems(rows) {
  const byCard = new Map();
  for (const r of rows || []) {
    if (r.rating == null) continue;
    if (!byCard.has(r.card_id)) byCard.set(r.card_id, []);
    byCard.get(r.card_id).push({ g: cl((+r.rating | 0) + 1, 1, 4), t: +new Date(r.created_at) });
  }
  const ratings = [], deltas = [], lengths = [];
  for (const log of byCard.values()) {
    if (log.length < 2) continue;
    log.sort((a, b) => a.t - b.t);
    const g = log.map(x => x.g);
    const dt = log.map((x, i) => i ? Math.max(0, dayNo(x.t) - dayNo(log[i - 1].t)) : 0);
    for (let i = 1; i < log.length; i++) {
      if (dt[i] <= 0) continue;
      lengths.push(i + 1);
      for (let k = 0; k <= i; k++) { ratings.push(g[k]); deltas.push(dt[k]); }
    }
  }
  return { ratings: Uint32Array.from(ratings), deltas: Uint32Array.from(deltas),
           lengths: Uint32Array.from(lengths) };
}

/* Le fil de calcul : il charge le module, lui passe les tableaux, rend les
   paramètres. Aucun import dans le wasm, donc rien à lui fournir. */
const OPT_WORKER = `onmessage = async e => {
  try {
    const d = e.data, r = await fetch(d.url, { cache: 'force-cache' });
    const { instance } = await WebAssembly.instantiate(await r.arrayBuffer(), {});
    const X = instance.exports;
    const put = a => { const p = X.folio_alloc(a.length);
      new Uint32Array(X.memory.buffer, p, a.length).set(a); return p; };
    const pr = put(d.ratings), pd = put(d.deltas), pl = put(d.lengths), po = X.folio_alloc(1);
    const out = X.folio_optimize(pr, pd, pl, d.lengths.length, 1, 0xFFFFFFFF, po);
    const n = new DataView(X.memory.buffer).getUint32(po, true);
    postMessage(out && n ? Array.from(new Float32Array(X.memory.buffer, out, n)) : null);
  } catch (err) { postMessage(null); }
};`;

function fsrsOptimize(items) {
  return new Promise(resolve => {
    let w = null, done = 0;
    const fin = v => { if (done) return; done = 1; try { w && w.terminate(); } catch (e) {} resolve(v); };
    try {
      const url = URL.createObjectURL(new Blob([OPT_WORKER], { type: 'text/javascript' }));
      w = new Worker(url);
      URL.revokeObjectURL(url);
      w.onmessage = e => fin(e.data);
      w.onerror = () => fin(null);
      setTimeout(() => fin(null), 60000);     // un calcul qui s'éternise n'aura pas lieu
      w.postMessage({ url: new URL('fsrs.wasm', location.href).href,
        ratings: items.ratings, deltas: items.deltas, lengths: items.lengths });
    } catch (e) { fin(null); }
  });
}

/* L'historique complet, sans la fenêtre d'un an des statistiques : le
   moteur apprend sur tout ce qu'on lui a donné depuis le début. */
async function histPull() {
  const out = [];
  for (let page = 0; page < 20; page++) {
    const rows = await api('/rest/v1/reviews?select=card_id,rating,created_at'
      + `&rating=not.is.null&order=created_at.asc&limit=10000&offset=${page * 10000}`);
    if (!rows || !rows.length) break;
    out.push(...rows);
    if (rows.length < 10000) break;
  }
  return out;
}

/* Un passage complet : on relit l'historique, on en tire les paramètres,
   puis on refait la mémoire de chaque fiche avec eux. Anki appelle ça
   « optimiser » puis « recalculer la mémoire » ; ici c'est un seul geste. */
let optRunning = 0;
async function fsrsTune(force) {
  if (optRunning) return 0;
  optRunning = 1;
  try {
    const rows = await histPull();
    const n = rows.length;
    if (!force && n < OPT_MIN_REVIEWS) return 0;
    const items = fsrsItems(rows);
    if (items.lengths.length >= 64) {
      const w = await fsrsOptimize(items);
      if (w && (w.length === 21 || w.length === 34) && w.every(x => isFinite(x))) {
        prefs.w = w; prefs.wAt = Date.now(); prefs.wN = n;
        savePrefs();
      }
    }
    return fsrsReplay(rows) || 0;
  } catch (e) { return 0; }
  finally { optRunning = 0; }
}

/* Anki réoptimise tout seul ; ici pareil, sans rien demander ni afficher :
   au calme après le démarrage, quand l'historique a assez bougé. */
function fsrsAuto() {
  if (prefs.simple || !auth.uid) return;
  const age = Date.now() - (prefs.wAt || 0);
  const grown = !prefs.wN || (stats.rows && stats.rows.length > prefs.wN * OPT_GROWTH);
  if (prefs.wAt && age < OPT_EVERY && !grown) return;
  const idle = window.requestIdleCallback || (f => setTimeout(f, 4000));
  idle(() => { fsrsTune(false); }, { timeout: 15000 });
}

/* ---------- reprise d'une bibliothèque existante ----------
   Les fiches déjà travaillées n'ont ni stabilité ni difficulté : on les
   convertit avec le pont officiel du crate. Rien n'est perdu — une fiche
   qui revenait dans 30 jours revient toujours dans 30 jours — et le moteur
   prend la suite à partir de là. C'est un point de départ approximatif :
   « Régler le moteur sur moi » rejoue ensuite l'historique réel, ce que ce
   pont ne sait pas faire. */
/* Le pont officiel vers une fiche déjà travaillée : `memory_state_from_sm2`
   (fsrs 6.6.2, src/inference.rs). Faute d'avoir jamais stocké une facilité
   par fiche, on prend 2,5 — la facilité de départ d'Anki. */
function sm2State(w, ease, ivl, ret) {
  const dec = -w[20], fac = Math.pow(0.9, 1 / dec) - 1;
  const S = Math.max(ivl, S_MIN) * fac / (Math.pow(ret, 1 / dec) - 1);
  const D = 11 - (ease - 1)
    / (Math.exp(w[8]) * Math.pow(S, -w[9]) * Math.expm1((1 - ret) * w[10]));
  return isFinite(S) && isFinite(D)
    ? { S: cl(S, S_MIN, S_MAX), D: cl(D, D_MIN, D_MAX) }
    : { S: cl(Math.max(ivl, S_MIN), S_MIN, S_MAX), D: 5 };
}
function fsrsSeed(c) {
  if (c.S || !c.n) return false;
  const ivl = +c.i || 0;
  if (ivl >= 1) {
    const m = sm2State(fsrsW(), 2.5, ivl, 0.9);
    c.S = m.S; c.D = m.D; c.F = m.S;
    c.st = 2; delete c.sp;
    c.lr = (c.d || Date.now()) - ivl * DAY;
  } else {
    c.st = 1; c.sp = 0;                      // encore en apprentissage
    c.lr = c.d ? c.d - 10 * MIN : Date.now();
  }
  return true;
}
function fsrsMigrate() {
  let n = 0;
  for (const d of db.decks) { let touched = 0; for (const c of d.cards) if (fsrsSeed(c)) { n++; touched = 1; } if (touched) dirty[d.id] = 1; }
  if (n) { save(); scheduleFlush(); }
  return n;
}

/* ---------- génération de cartes ----------
   La clé Anthropic n'est jamais ici. app.js est servi par GitHub Pages, donc
   public : la clé vit dans un secret de la fonction Supabase « ai », qui seule
   parle à l'API. L'app n'envoie que le texte, avec son jeton de session. */
const AIERR = {
  budget: 'Budget IA atteint', quota: 'Quota du jour atteint',
  fquota: 'Quota photos et PDF du jour atteint',
  long: 'Texte trop long', short: 'Texte trop court',
  big: 'Fichier trop lourd', mime: 'Format non reconnu',
  nokey: 'IA non configurée', empty: 'Rien à extraire'
};
async function aiCall(payload) {
  if (auth && auth.exp && Date.now() > auth.exp - 60000) await refreshToken();
  const call = () => fetch(SB.url + '/functions/v1/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SB.key,
               Authorization: 'Bearer ' + (auth && auth.token) },
    body: JSON.stringify(payload)
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
const aiCards = (text, hint) => aiCall({ op: 'cards', text, hint: hint || '' });

/* ---------- photo d'une page, PDF ----------
   La photo est réduite avant d'être envoyée : au-delà de 1568 pixels de
   côté, l'API la réduit elle-même sans rien y gagner en lisibilité, et
   une photo de téléphone brute pèse dix fois le nécessaire — donc dix
   fois le prix. Le PDF part tel quel ; ce sont les pages demandées qui
   limitent le travail. */
const IMGMAX = 1568;
function shrink(file) {
  return new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const s = Math.min(1, IMGMAX / Math.max(img.width, img.height));
      const cv = document.createElement('canvas');
      cv.width = Math.round(img.width * s); cv.height = Math.round(img.height * s);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      const out = cv.toDataURL('image/jpeg', .82);
      res({ mime: 'image/jpeg', data: out.slice(out.indexOf(',') + 1) });
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('mime')); };
    img.src = url;
  });
}
const asB64 = file => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res({ mime: file.type, data: String(r.result).slice(String(r.result).indexOf(',') + 1) });
  r.onerror = () => rej(new Error('mime'));
  r.readAsDataURL(file);
});
async function aiFromFile(file, hint, pages) {
  const pdf = file.type === 'application/pdf';
  const { mime, data } = pdf ? await asB64(file) : await shrink(file);
  return aiCall({ op: pdf ? 'pdf' : 'ocr', mime, data, hint: hint || '', pages: pages || '' });
}

const dueCount = d => d.cards.filter(c => isDue(c, Date.now())).length;

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
              /* un identifiant fourni est gardé : c'est ainsi qu'un devoir
                 reste reconnaissable une fois chez l'élève */
              cards: cards.map(c => ({ id: c.id || uid(), f: c.f, b: c.b })) };
  db.decks.unshift(d); saveDeck(d); return d;
}
/* ---------- opérations sur les paquets ----------
   Dupliquer, fusionner, scinder. Toutes passent par pushUndo avant de
   toucher quoi que ce soit : les identifiants qui n'existaient pas encore
   sont photographiés « absents », donc annuler les retire, tandis que les
   paquets modifiés ou mis à la corbeille reviennent à l'identique.
   Copier une carte, c'est copier tout son état d'apprentissage : un
   doublon qui repartirait de zéro ferait réviser deux fois la même chose. */
const copyCards = cs => cs.map(c => ({ ...c, id: uid() }));
const freeName = base => {
  if (!db.decks.some(d => d.name === base)) return base;
  for (let i = 2; ; i++) if (!db.decks.some(d => d.name === base + ' ' + i)) return base + ' ' + i;
};

function cloneDeck(d) {
  const n = { id: uid(), name: freeName(d.name + ' (copie)'), subject: d.subject,
              hidden: !!d.hidden, pinned: false, pos: -Date.now() / 1000 | 0,
              meta: { ...(d.meta || {}) }, cards: copyCards(d.cards) };
  pushUndo('Duplication', [n.id]);
  db.decks.unshift(n); saveDeck(n);
  return n;
}

/* Fusion : les cartes de la source rejoignent la cible, la source part à
   la corbeille (récupérable trente jours). Une carte déjà présente des
   deux côtés — même recto et même verso — n'est pas recopiée. */
function mergeDecks(target, src) {
  pushUndo('Fusion', [target.id, src.id]);
  snapVersion(target, 'avant fusion');
  const seen = new Set(target.cards.map(c => key2(c)));
  const add = src.cards.filter(c => !seen.has(key2(c)));
  target.cards.push(...copyCards(add));
  db.decks = db.decks.filter(x => x.id !== src.id);
  delete dirty[src.id]; gone.push(src.id);
  dirty[target.id] = 1; save(); flush();
  return { added: add.length, skipped: src.cards.length - add.length };
}
const key2 = c => norm(c.f || '') + ' ' + norm(c.b || '');

/* Scission : le paquet devient N paquets de `size` cartes, dans l'ordre
   où elles sont. L'original file à la corbeille plutôt que d'être effacé,
   pour que l'opération reste réversible même après un rechargement. */
function splitDeck(d, size) {
  snapVersion(d, 'avant découpe');
  const parts = [];
  for (let i = 0; i < d.cards.length; i += size) parts.push(d.cards.slice(i, i + size));
  if (parts.length < 2) return null;
  const made = parts.map((cards, i) => ({
    id: uid(), name: d.name + ' · ' + (i + 1), subject: d.subject,
    hidden: !!d.hidden, pinned: false, pos: (-Date.now() / 1000 | 0) + i,
    meta: { ...(d.meta || {}) }, cards: copyCards(cards)
  }));
  pushUndo('Scission', [d.id, ...made.map(x => x.id)]);
  db.decks = db.decks.filter(x => x.id !== d.id);
  delete dirty[d.id]; gone.push(d.id);
  db.decks.unshift(...made);
  made.forEach(x => dirty[x.id] = 1);
  save(); flush();
  return made;
}

/* ---------- chercher et remplacer ----------
   Recherche littérale, jamais une expression régulière : on remplace ce
   qu'on a tapé, caractère pour caractère. Le compte des occurrences est
   fait avant tout changement, pour qu'on sache ce qu'on s'apprête à faire. */
let fnr = { q: '', r: '', side: 'both', cs: false };
const fnrSides = () => fnr.side === 'both' ? ['f', 'b'] : [fnr.side];
function fnrCount(txt, q) {
  if (!q) return 0;
  const h = fnr.cs ? txt : txt.toLowerCase(), n = fnr.cs ? q : q.toLowerCase();
  let c = 0, i = 0;
  while ((i = h.indexOf(n, i)) >= 0) { c++; i += n.length; }
  return c;
}
function fnrScan(d) {
  let hits = 0, cards = 0;
  for (const c of d.cards) {
    let k = 0;
    for (const s of fnrSides()) k += fnrCount(String(c[s] || ''), fnr.q);
    if (k) { hits += k; cards++; }
  }
  return { hits, cards };
}
function fnrSwap(txt, q, r) {
  if (!fnr.cs) {
    const h = txt.toLowerCase(), n = q.toLowerCase();
    let out = '', i = 0, j;
    while ((j = h.indexOf(n, i)) >= 0) { out += txt.slice(i, j) + r; i = j + n.length; }
    return out + txt.slice(i);
  }
  return txt.split(q).join(r);
}
const fnrNote = s => !fnr.q ? 'Tape ce que tu cherches. La recherche est littérale : aucun caractère n’a de sens particulier.'
  : !s.hits ? 'Aucune occurrence dans ce livre.'
  : `<b>${s.hits} occurrence${s.hits > 1 ? 's' : ''}</b> dans ${s.cards} carte${s.cards > 1 ? 's' : ''}`
    + (fnr.r ? ` → « ${esc(fnr.r)} »` : ', qui seront simplement retirées');

function fnrApply(d) {
  const { hits } = fnrScan(d);
  if (!hits) return 0;
  pushUndo('Remplacement', [d.id]);
  snapVersion(d, 'avant remplacement');
  for (const c of d.cards)
    for (const s of fnrSides())
      if (c[s]) c[s] = fnrSwap(String(c[s]), fnr.q, fnr.r);
  saveDeck(d);
  return hits;
}

/* Réimporter son propre fichier doit remettre à jour le paquet du même
   nom, pas en empiler des copies. Mais un paquet qui vient d'ailleurs —
   lien, courrier, bibliothèque — n'a rien à voir avec le sien : « Italien »
   est un nom que trois comptes sur trois utilisent, et l'écraser ferait
   disparaître des cartes et toute leur progression sans un mot. D'où le
   second argument : « celui-ci arrive de l'extérieur, mets-le à côté ». */
function importPayload(p, fresh) {
  let last = null;
  for (const k of (Array.isArray(p) ? p : [p])) {
    const cards = (k.cards || []).map(c => Array.isArray(c) ? { f: c[0], b: c[1] } : c).filter(c => c && c.f);
    if (!cards.length) continue;
    const ex = fresh ? null : db.decks.find(d => d.name === k.name);
    if (ex) {
      snapVersion(ex, 'avant réimport');
      ex.subject = k.subject || ex.subject;      // sans matière à l'import : on garde la sienne
      ex.cards = cards.map(c => ({ id: c.id || uid(), f: c.f, b: c.b }));
      last = ex; dirty[ex.id] = 1;
    } else last = addDeck(fresh ? freeName((k.name || 'Paquet').trim() || 'Paquet') : k.name, cards, k.subject);
  }
  save(); flush(); return last;
}

/* ---------- sons ----------
   Deux notes synthétisées à la volée : rien à télécharger, rien à mettre
   en cache, et le son ne part jamais avant un vrai geste de l'utilisateur
   (iOS refuse d'ouvrir le contexte audio autrement). */
let actx = null;
function beep(good, force) {
  if (!prefs.sound && !force) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    const t = actx.currentTime;
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(good ? 660 : 300, t);
    o.frequency.exponentialRampToValueAtTime(good ? 880 : 220, t + .09);
    g.gain.setValueAtTime(.0001, t);
    g.gain.exponentialRampToValueAtTime(.12, t + .012);
    g.gain.exponentialRampToValueAtTime(.0001, t + .16);
    o.connect(g); g.connect(actx.destination);
    o.start(t); o.stop(t + .18);
  } catch (e) {}
}

/* ---------- toast ---------- */
let tt;
function toast(icon, text, undo) {
  clearTimeout(tt); document.querySelectorAll('.toast').forEach(n => n.remove());
  const n = document.createElement('div'); n.className = 'toast';
  n.setAttribute('role', 'status'); n.setAttribute('aria-live', 'polite');
  n.innerHTML = svg(icon) + (text ? `<span>${esc(text)}</span>` : '')
    + (undo ? `<button class="tun">${svg(I.redo)}Annuler</button>` : '');
  if (undo) n.querySelector('.tun').onclick = () => { n.remove(); doUndo(); };
  /* Il se pose au-dessus de ce qui occupe déjà le bas — barre de
     sélection, ou rien. Sauf si une feuille est ouverte : là il passe en
     haut, sinon il se met pile sur son bouton principal et on croit lire
     le bouton (« Envoi impossible » à la place d'« Enregistrer »). */
  if (document.querySelector('.menu')) {
    n.classList.add('up');
    n.style.top = 'calc(12px + env(safe-area-inset-top))';
    n.style.bottom = 'auto';
  } else if (document.querySelector('.selb')) n.style.bottom = 'calc(84px + env(safe-area-inset-bottom))';
  else if (document.querySelector('.tabs')) n.style.bottom = 'calc(80px + env(safe-area-inset-bottom))';
  else n.style.bottom = 'calc(22px + env(safe-area-inset-bottom))';
  document.body.appendChild(n); tt = setTimeout(() => n.remove(), undo ? 5200 : 1600);
}

/* ---------- rendu ---------- */
let animate = true;
/* .fade porte l'entrée en douceur des listes (tuiles, lignes, boutons…) —
   voir app.css. Elle n'est présente qu'au moment exact où le contenu neuf
   est inséré lors d'une vraie navigation (animate === true) ; retirée
   avant toute reconstruction en place (un réglage qu'on bascule, une
   carte qu'on suspend) pour qu'aucun élément ne rejoue son apparition. */
/* La taille du texte des cartes est un réglage de confort : les articles
   du CPC sont longs, les mots italiens courts. Une seule variable, posée
   sur la racine, que les tailles des faces multiplient. */
function applyFont() {
  document.documentElement.style.setProperty('--fs', prefs.font || 1);
}

/* Le voile de démarrage s'efface à la première vue dessinée, mais pas
   avant que son animation ait eu le temps d'exister. */
/* L'ouverture tient trois secondes, quoi qu'il arrive. Si le compte et
   les livres sont là en 200 ms tant mieux : le reste du temps sert à
   finir de charger en silence, et l'animation se regarde en entier au
   lieu d'être coupée au milieu. */
const BOOTMS = 3000;
let booted = 0;
function dropBoot() {
  const n = document.getElementById('boot');
  if (!n || booted) return;
  booted = 1;
  const rest = Math.max(0, BOOTMS - performance.now());
  setTimeout(() => { n.classList.add('off'); setTimeout(() => n.remove(), 520); }, rest);
}
/* filet de sécurité : si le premier écran ne vient jamais (script en
   erreur, réseau coupé au mauvais moment), l'ouverture s'efface quand
   même au lieu de rester plantée là. */
setTimeout(dropBoot, 6000);

/* ---------- synchronisation vivante ----------
   Le classement et le Journal ne doivent jamais attendre un rechargement.
   Tant qu'un de ces écrans est ouvert et que l'app est au premier plan,
   on redemande les chiffres à intervalle régulier ; on redemande aussi
   dès qu'on revient sur l'app, et une page jouée déclenche une mise à
   jour rapprochée pour que son effet se voie tout de suite. */
const LIVEMS = 15000;
let liveT = 0, liveAt = 0, liveSoon = 0;
const LIVEV = /^(stats|commu|board|duels|library|friends|groups|group)$/;
function livePull(force) {
  if (!auth || demo || document.hidden || !LIVEV.test(view.name)) return;
  if (!force && Date.now() - liveAt < 4000) return;
  liveAt = Date.now();
  if (view.name === 'stats') statsPull(1);
  else {
    boardPull(1);
    if (view.name === 'duels') duelsPull();
    if (view.name === 'library') libPull();
  }
}
function liveSync() {
  const want = auth && !demo && LIVEV.test(view.name);
  if (want && !liveT) { liveT = setInterval(livePull, LIVEMS); livePull(); }
  if (!want && liveT) { clearInterval(liveT); liveT = 0; }
}
/* Après une page jouée : le serveur vient d'encaisser la ligne, on lui
   laisse un souffle puis on redemande le décompte partagé. */
function liveBump() {
  clearTimeout(liveSoon);
  liveSoon = setTimeout(() => livePull(true), 1200);
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) livePull(true); });
window.addEventListener('focus', () => livePull(true));

function render() {
  const v = { home, deck: deckView, study: studyView, import: importView,
              run: quizView, login: loginView, settings: settingsView, trash: trashView, mail: mailView, stats: statsView, find: findView,
              group: groupView, shared: sharedView, duel: duelView, legal: legalView, mod: modView,
              classes: classesView, classe: classeView, maclasse: maClasseView,
              prof: profView, profclasse: profClasseView, profeleve: profEleveView,
              ref: refView,
              admin: adminView,
              commu: commuView, friends: friendsView, groups: groupsView,
              duels: duelsView, library: libraryView, board: boardView };
  $.classList.remove('fade');
  if (animate) void $.offsetWidth;             // force un vrai redémarrage si elle était déjà là
  (v[view.name] || home)();
  $.dataset.view = view.name;
  applyFont();
  paintRail();
  paintMedia($);                               // les images posées sans adresse la reçoivent ici
  if (animate) $.classList.add('fade');
  if (pageDir) {
    const pg = document.getElementById('page');
    if (pg) pg.classList.add(pageDir < 0 ? 'in-right' : 'in-left');
    pageDir = 0;
  }
  animate = false;
  const on = $.querySelector('.pills .p.on');
  if (on && on.previousElementSibling) on.scrollIntoView({ block: 'nearest', inline: 'center' });
  if (menu) paintMenu();
  liveSync();
  dropBoot();
}
let pageDir = 0;
function go(name, id, dir) {
  closeMenu();
  if (name !== 'run') stopTimer();
  if (name !== 'deck' || id !== view.id) { selOff(); deckQ = ''; deckOpen = false; deckShow = DECKPAGE; }
  pageDir = dir || 0; view = { name, id }; animate = !dir;
  render(); window.scrollTo(0, 0);
}

function paintRail() {
  let r = document.getElementById('rail');
  if (!auth || view.name === 'login') {
    if (r) r.remove();
    document.documentElement.classList.remove('nav-haut');
    return;
  }
  const on = view.name === 'settings' ? 'settings'
    : view.name === 'mail' ? 'mail' : view.name === 'stats' ? 'stats'
    : /^(classes|classe|maclasse|prof|ref$|admin$)/.test(view.name) ? 'classes'
    : /commu|friends|groups|duels|library|board|shared/.test(view.name) ? 'commu' : 'home';
  /* Un compte d'établissement travaille, il ne révise pas : ni journal de
     lecture, ni cercle des lecteurs. Quatre entrées, et elles passent en
     barre horizontale — la page de gestion prend alors toute la largeur au
     lieu de vivre dans les trois quarts restants. */
  const boulot = atSchool() && myRole !== 'eleve';
  const sig = on + '\u0000' + (prefs.name || auth.email) + '\u0000' + mailbox.n
            + '\u0000' + myRole + '\u0000' + (boulot ? 'h' : 'v');
  if (r && r.dataset.sig === sig) return;      // rien n'a changé : on ne redessine pas
  if (!r) { r = document.createElement('aside'); r.id = 'rail'; document.body.appendChild(r); }
  r.dataset.sig = sig;
  r.className = boulot ? 'haut' : '';
  document.documentElement.classList.toggle('nav-haut', boulot);
  const ent = (k, ic, nom, badge) => `<button class="${on === k ? 'on' : ''}" data-r="${k}">${
    svg(ic)}<span>${nom}</span>${badge ? `<i class="icb">${badge}</i>` : ''}</button>`;
  const classeNom = myRole === 'ref' ? 'Mon établissement'
    : myRole === 'admin' ? 'Administration'
    : isProf() ? 'Mes classes' : 'Ma classe';
  r.innerHTML = boulot ? `
    <div class="brand"><img src="icons/icon-192.png" alt=""><span>Folio</span></div>
    <nav>
      ${ent('classes', I.school, classeNom)}
      ${ent('home', I.layers, 'Livres')}
      ${ent('mail', I.mail, 'Courrier', mailbox.n ? (mailbox.n > 9 ? '9+' : mailbox.n) : 0)}
      ${ent('settings', I.gear, 'Réglages')}
    </nav>
    <div class="sp"></div>
    <div class="who">${svg(I.user)}<span>${esc(prefs.name || auth.email)}</span></div>`
  : `
    <div class="brand"><img src="icons/icon-192.png" alt=""><span>Folio</span></div>
    <nav>
      ${ent('home', I.layers, 'Livres')}
    </nav>
    <div class="sp"></div>
    <nav>
      ${ent('stats', I.chart, 'Journal')}
      ${isProf() || atSchool() || (classes || []).length ? ent('classes', I.school, classeNom) : ''}
      ${ent('commu', I.user, 'Le cercle', (asks || []).length)}
      ${ent('mail', I.mail, 'Courrier', mailbox.n ? (mailbox.n > 9 ? '9+' : mailbox.n) : 0)}
      ${ent('settings', I.gear, 'Réglages')}
    </nav>
    <div class="who">${svg(I.user)}<span>${esc(prefs.name || auth.email)}</span></div>`;
  r.onclick = e => {
    const b = e.target.closest('[data-r]'); if (!b) return;
    if (b.dataset.r === 'mail') { mailbox.list = null; mailPull(); return go('mail'); }
    if (b.dataset.r === 'stats') { stats.rows = null; statsPull(); return go('stats'); }
    if (b.dataset.r === 'commu') { commuPull(); return go('commu'); }
    if (b.dataset.r === 'classes') {
      if (isPupil()) { maClassePull(); return go('maclasse'); }
      if (myRole === 'admin') { if (!accounts) accountsPull(); if (!adm.orgs) admPull(); return go('admin'); }
      if (myRole === 'ref' && atSchool()) { refPull(); return go('ref'); }
      if (isProf() && atSchool()) { if (!prof.classes) profPull(); return go('prof'); }
      if (!classes) classesPull(); return go('classes');
    }
    go(b.dataset.r === 'settings' ? 'settings' : 'home');
  };
}


/* Deux écrans de premier niveau, donc deux onglets et un balayage entre
   les deux. C'est la seule navigation horizontale de l'app : partout
   ailleurs on entre et on ressort par la flèche. */
const tabs = on => `<div class="tabs">
  <div class="sl" style="transform:translateX(${on === 'commu' ? 74 : 0}px)"></div>
  <button class="${on === 'home' ? 'on' : ''}" data-act="tab-home" aria-label="Ma bibliothèque"
    aria-current="${on === 'home' ? 'page' : 'false'}">${svg(I.layers)}</button>
  <button class="${on === 'commu' ? 'on' : ''}" data-act="tab-commu" aria-label="Le cercle des lecteurs"
    aria-current="${on === 'commu' ? 'page' : 'false'}">${svg(I.user)}${
      (asks || []).length ? `<i class="icb">${(asks || []).length}</i>` : ''}</button>
</div>`;

/* balayage horizontal entre « Mes paquets » et « Communauté » */
function bindPager() {
  if (reorder) return;   // le rangement fige la page : plus rien d'autre ne bouge
  const pg = document.getElementById('page'); if (!pg) return;
  const home = view.name === 'home';
  let x0 = 0, y0 = 0, dx = 0, on = false, lock = 0, t0 = 0, raf = 0, pid = -1;
  const draw = () => {
    raf = 0;
    if (!on) return;
    const edge = home ? dx > 0 : dx < 0;
    pg.style.transform = `translate3d(${(edge ? dx * .26 : dx).toFixed(1)}px,0,0)`;
  };
  const reset = () => {
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    pg.style.transition = ''; pg.style.transform = '';
  };
  /* Une bande de pastilles défile toute seule : tant qu'elle a de quoi
     défiler du côté où va le doigt, c'est elle qui prend le geste. Une
     fois au bout, le geste redevient un changement d'écran — avant, poser
     le doigt dessus annulait le balayage pour de bon. */
  let strip = null;
  pg.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button) return;
    if (e.target.closest('.rng,.seg')) return;
    strip = e.target.closest('.pills,.heat,.mixwrap');
    on = true; lock = 0; dx = 0; x0 = e.clientX; y0 = e.clientY; t0 = Date.now(); pid = e.pointerId;
    pg.style.transition = 'none';
  });
  pg.addEventListener('pointermove', e => {
    if (!on || e.pointerId !== pid) return;
    const ax = e.clientX - x0, ay = e.clientY - y0;
    if (!lock) {
      if (Math.abs(ax) < 9 && Math.abs(ay) < 9) return;
      lock = Math.abs(ax) > Math.abs(ay) * 1.3 ? 1 : -1;
      if (lock < 0) { on = false; reset(); return; }
      if (strip) {
        const room = ax > 0 ? strip.scrollLeft
                            : strip.scrollWidth - strip.clientWidth - strip.scrollLeft;
        if (room > 1) { on = false; reset(); return; }
      }
    }
    dx = ax;
    if (!raf) raf = requestAnimationFrame(draw);
  });
  const end = () => {
    if (!on) return; on = false;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    pg.style.transition = '';
    const v = Math.abs(dx) / Math.max(1, Date.now() - t0);
    const far = Math.abs(dx) > innerWidth * .28 || (v > .55 && Math.abs(dx) > 40);
    const go2 = far && (home ? dx < 0 : dx > 0);
    pg.style.transform = '';
    if (go2) { if (home) { commuPull(); go('commu', null, 1); } else go('home', null, -1); }
  };
  /* le doigt finit souvent sa course hors de la page : sans écouter la
     fenêtre, le balayage restait suspendu à mi-chemin. La page est
     redessinée à chaque écran, la fenêtre non : on retire l'écoute
     précédente avant d'en poser une nouvelle. */
  pg.addEventListener('pointerup', end);
  pg.addEventListener('pointercancel', end);
  if (pagerEnd) { removeEventListener('pointerup', pagerEnd); removeEventListener('pointercancel', pagerEnd); }
  pagerEnd = end;
  addEventListener('pointerup', pagerEnd);
  addEventListener('pointercancel', pagerEnd);
}
let pagerEnd = null;

const pills = (active, list, act) => `<div class="pills">
  <button class="p ${active === '' ? 'on' : ''}" data-${act}="">Tout</button>
  ${list.map(s => `<button class="p ${active === s.id ? 'on' : ''}" data-${act}="${s.id}" style="--d:${s.d}">
    <i></i>${esc(s.name)}</button>`).join('')}
</div>`;

const maturePct = d => d.cards.length
  ? Math.round(d.cards.filter(c => cstate(c) === 'mature').length / d.cards.length * 100) : 0;

const tile = (d, i) => {
  const due = simpleMode() ? 0 : dueCount(d);
  const p = simpleMode() ? 0 : maturePct(d);
  return `<button class="tile ${d.hidden ? 'mute' : ''}" data-go="${d.id}" data-peek="${d.id}"
  data-id="${d.id}" data-pin="${d.pinned ? 1 : 0}"
  style="${sty(subj(d.subject))};--i:${i}">
  <i class="spine" aria-hidden="true"></i>
  ${due ? `<i class="due">${due}</i>` : ''}
  ${d.pinned ? `<i class="pind">${svg(I.pin)}</i>` : ''}
  <span class="n">${esc(d.name)}</span>
  <span class="m">${svg(d.hidden ? I.eyeoff : I.card)}${d.cards.length}</span>
  ${p ? `<i class="tbar"><b style="width:${p}%"></b></i>` : ''}
</button>`;
};

/* Vue liste : plus dense que la grille dès qu'il y a beaucoup de paquets,
   et c'est elle qui porte la poignée quand on réorganise. */
const listRow = (d, i) => {
  const due = simpleMode() ? 0 : dueCount(d);
  const p = simpleMode() ? 0 : maturePct(d);
  return `<div class="lrow ${d.hidden ? 'mute' : ''}" style="${sty(subj(d.subject))};--i:${i}"
    data-id="${d.id}" data-pin="${d.pinned ? 1 : 0}">
    ${reorder ? `<i class="grip">${svg(I.grip)}</i>` : `<i class="ldot"></i>`}
    <button class="lmain" data-go="${d.id}" data-peek="${d.id}">
      <span class="n">${esc(d.name)}${d.pinned ? svg(I.pin) : ''}</span>
      <span class="s">${plur(d.cards.length, 'page')}${p ? ' · ' + p + ' % mûres' : ''}</span>
    </button>
    ${due ? `<i class="ldue">${due}</i>` : ''}
  </div>`;
};

/* Tri de l'accueil. « Manuel » garde l'ordre que tu as posé toi-même ;
   les paquets épinglés passent devant dans tous les cas. */
const SORTS = { manual: 'Manuel', recent: 'Récents', az: 'A → Z', size: 'Taille', best: 'Réussite' };
function sortDecks(list) {
  const rate = d => {
    const h = [];
    for (const k of Object.keys(db.hist)) if (k.startsWith(d.id + ':')) h.push(...db.hist[k]);
    return h.length ? h.reduce((a, x) => a + x.p, 0) / h.length : -1;
  };
  const by = {
    manual: (a, b) => (a.pos || 0) - (b.pos || 0),
    recent: (a, b) => (b.pos || 0) - (a.pos || 0),
    az: (a, b) => a.name.localeCompare(b.name, 'fr'),
    size: (a, b) => b.cards.length - a.cards.length,
    best: (a, b) => rate(b) - rate(a)
  }[prefs.sort] || ((a, b) => (a.pos || 0) - (b.pos || 0));
  return [...list].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || by(a, b));
}
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

/* Le point gris disait « hors ligne » sans dire ce qui attendait. Un
   compteur vaut mieux : on sait ce qu'on risque en fermant l'app, et on
   peut relancer l'envoi à la main sans attendre la prochaine minute. */
function queueChip() {
  const n = pending();
  if (online && !n) return '<span id="offdot" class="off-dot" style="display:none"></span>';
  return `<button class="qchip ${online ? '' : 'off'}" data-act="retry"
    aria-label="${n ? n + ' modification' + (n > 1 ? 's' : '') + ' en attente d’envoi'
      : 'Hors ligne'}${online ? '' : ', hors ligne'}">
    ${svg(online ? I.cloud : I.warn)}${n ? `<b>${n}</b>` : 'hors ligne'}</button>`;
}
function home() {
  const used = db.subjects.filter(s => db.decks.some(d => d.subject === s.id && (peek || !d.hidden))).map(x => subj(x.id));
  const hidden = db.decks.some(d => d.hidden);
  const list = db.decks.filter(d => (peek || !d.hidden) && (!filter || d.subject === filter));
  $.innerHTML = `
    <div class="page ${reorder ? 'frozen' : ''}" id="page">
      <div class="top">
        <div class="hero">Mes livres</div>
        ${queueChip()}
        ${goalRing()}
        <button class="ic" data-act="find" aria-label="Rechercher">${svg(I.search)}</button>
        <button class="ic icmail" data-act="mail" aria-label="Boîte de réception">${svg(I.mail)}${mailbox.n ? `<i class="icb">${mailbox.n > 9 ? '9+' : mailbox.n}</i>` : ''}</button>
        <button class="ic" data-act="settings" aria-label="Réglages">${svg(I.gear)}</button>
        ${hidden ? `<button class="ic ${peek ? 'solid' : ''}" data-act="peek">${svg(peek ? I.eye : I.eyeoff)}</button>` : ''}
      </div>
      ${resumeBanner()}
      ${used.length > 1 ? pills(filter, used, 'filt') : ''}
      ${list.length ? subBar(list) : ''}
      ${list.length > 2 && !reorder ? `<div class="hbar">
        <button class="lnk" data-act="sortpick">${svg(I.sort)}${SORTS[prefs.sort] || 'Manuel'}</button>
        <div style="flex:1"></div>
        <button class="lnk" data-act="listview" aria-label="Changer d’affichage">${svg(prefs.list ? I.grid : I.rows)}</button>
      </div>` : ''}
      ${!list.length ? `<div class="empty">${svg(I.layers)}<p><b>Ta bibliothèque est vide</b>Appuie sur + pour écrire ton premier livre.</p></div>`
        : prefs.list
          ? `<div class="rows lst ${reorder ? 'reord' : ''}">${sortDecks(list).map(listRow).join('')}</div>`
          : `<div class="grid ${reorder ? 'reord' : ''}">${sortDecks(list).map(tile).join('')}</div>`}
      ${!simpleMode() && allDue() ? `<button class="marathon" data-act="marathon">${svg(I.shuffle)}
        <span>Lecture du jour</span><i>${allDue()} pages dues, toutes matières</i></button>` : ''}
    </div>
    ${reorder ? `<button class="fab fabok" data-act="reorder" aria-label="Valider l’ordre">${svg(I.check)}</button>`
      : `<button class="fab" data-act="new" aria-label="Nouveau livre">${svg(I.plus)}<span>Nouveau livre</span></button>`}
    ${tabs('home')}`;
  $.classList.toggle('reordering', reorder);
  bindPager();
  if (reorder) bindDeckOrder();
  bindPeek();
}

/* Progression de la sélection courante, en une ligne fine : la part de
   chaque état de carte, matière par matière quand aucun filtre n'est posé. */
function subBar(list) {
  if (simpleMode()) return '';
  const k = { new: 0, learn: 0, young: 0, mature: 0, susp: 0 };
  list.forEach(d => d.cards.forEach(c => k[cstate(c)]++));
  const tot = k.new + k.learn + k.young + k.mature;
  if (!tot) return '';
  return `<div class="sbar" title="${k.mature} mûres sur ${tot}">
    ${['mature', 'young', 'learn', 'new'].filter(x => k[x])
      .map(x => `<i class="${x}" style="flex:${k[x]}"></i>`).join('')}
  </div>`;
}

/* ---------- ranger sa bibliothèque ----------
   On appuie sur un livre, on le garde sous le doigt, on le pose ailleurs.
   Le même geste marche sur les couvertures et sur la liste : la vue ne
   change pas quand on entre en rangement, c'est le rangement qui s'adapte
   à la vue. Et il n'existe que dans ce mode — ailleurs, l'appui long
   ouvre les actions du livre.
   Les épinglés gardent leur tête de file : on ne peut déplacer un livre
   qu'au sein de son propre groupe, sinon le tri le remonterait aussitôt
   et le geste passerait pour cassé. */
function bindDeckOrder() {
  const wrap = $.querySelector('.grid.reord, .rows.lst.reord'); if (!wrap) return;
  const grid = wrap.classList.contains('grid');
  const SEL = grid ? '.tile' : '.lrow';
  let g = null, hold = 0;

  const items = () => [...wrap.querySelectorAll(SEL)];
  /* translate/scale sont posées à part de « transform » : le tremblement
     des livres non tenus tourne sur `rotate`, et les deux ne se marchent
     jamais dessus.
     Le livre tenu doit rester sous le doigt même quand `slot()` le
     réinsère ailleurs dans la liste — sa position « au repos » change
     alors sans prévenir. `getBoundingClientRect()` ne renvoie que la
     position peinte, translation déjà comprise : il faut en retrancher
     la translation qu'on a posée la fois d'avant pour retrouver le repos
     réel, sinon chaque image recalculait sa cible à partir d'un point de
     départ faux, et le livre partait à la dérive au lieu de suivre le
     doigt. g.tx/g.ty gardent donc la translation actuellement posée. */
  const LIFT_SCALE = 1.06;
  const place = () => {
    const r = g.el.getBoundingClientRect();
    /* Le grossissement du livre tenu (scale 1.06, centré) élargit sa
       boîte de façon symétrique et déplace donc son bord gauche/haut
       vers l'intérieur : une fois posé, `getBoundingClientRect()` ne
       renvoie plus le repos + la translation, mais repos + translation
       - ce décalage de mise à l'échelle (calculé sur sa taille d'origine,
       fixée une fois pour toutes à la prise — la taille mesurée après
       coup est déjà grossie). Sans le retrancher, chaque image partait
       d'un repos faux d'une dizaine de pixels — c'est ce qui faisait
       dériver le livre loin du doigt. */
    const dsx = g.scaled ? g.ow * (LIFT_SCALE - 1) / 2 : 0;
    const dsy = g.scaled ? g.oh * (LIFT_SCALE - 1) / 2 : 0;
    const restX = r.left + dsx - g.tx, restY = r.top + dsy - g.ty;
    g.tx = (g.bx + g.px - g.x0) - restX;
    g.ty = (g.by + g.py - g.y0) - restY;
    g.el.style.translate = `${g.tx.toFixed(1)}px ${g.ty.toFixed(1)}px`;
    g.el.style.scale = String(LIFT_SCALE);
    g.scaled = true;
  };
  /* on replace la couverture dans le flux, puis on remet les autres à
     leur place d'avant le temps d'une animation : elles glissent au lieu
     de sauter d'un coup. */
  const slot = () => {
    const others = items().filter(n => n !== g.el && n.dataset.pin === g.pin);
    const before = n => {
      const r = n.getBoundingClientRect();
      if (!grid) return g.py < r.top + r.height / 2;
      if (g.py < r.top) return true;
      if (g.py > r.bottom) return false;
      return g.px < r.left + r.width / 2;
    };
    const k = others.findIndex(before);
    const ref = k < 0 ? (others.length ? others[others.length - 1].nextSibling : null) : others[k];
    if (ref === g.el || (k < 0 && g.el.nextSibling === ref)) return;
    const was = new Map(items().map(n => [n, n.getBoundingClientRect()]));
    wrap.insertBefore(g.el, ref);
    for (const n of items()) {
      if (n === g.el) continue;
      const o = was.get(n); if (!o) continue;
      const r = n.getBoundingClientRect();
      const dx = o.left - r.left, dy = o.top - r.top;
      if (!dx && !dy) continue;
      n.style.transition = 'none';
      n.style.translate = `${dx}px ${dy}px`;
      requestAnimationFrame(() => { n.style.transition = ''; n.style.translate = ''; });
    }
  };
  const lift = () => {
    const r = g.el.getBoundingClientRect();
    g.bx = r.left; g.by = r.top; g.tx = 0; g.ty = 0; g.ow = r.width; g.oh = r.height;
    g.el.classList.add('drag');
    wrap.classList.add('dragging');
    try { g.el.setPointerCapture(g.pid); } catch (e) {}
    if (navigator.vibrate) try { navigator.vibrate(12); } catch (e) {}
    place();
  };
  wrap.addEventListener('pointerdown', e => {
    const el = e.target.closest(SEL); if (!el || g) return;
    g = { el, px: e.clientX, py: e.clientY, x0: e.clientX, y0: e.clientY,
          pid: e.pointerId, pin: el.dataset.pin || '0', up: 0, bx: 0, by: 0, tx: 0, ty: 0 };
    el.classList.add('hold');
    clearTimeout(hold);
    hold = setTimeout(() => { if (g) { g.up = 1; lift(); } }, 260);
  });
  wrap.addEventListener('pointermove', e => {
    if (!g || e.pointerId !== g.pid) return;
    g.px = e.clientX; g.py = e.clientY;
    if (!g.up) {
      if (Math.abs(g.px - g.x0) > 8 || Math.abs(g.py - g.y0) > 8) {
        clearTimeout(hold); g.el.classList.remove('hold'); g = null;
      }
      return;
    }
    e.preventDefault();
    /* slot() d'abord : elle peut réinsérer le livre ailleurs dans la
       grille (nouvelle rangée, nouvelle colonne) selon où en est le
       doigt. Appeler place() après lui laisse toujours mesurer la
       position de repos définitive de cette image — dans l'autre sens,
       place() se basait sur le repos d'avant le réarrangement et le
       livre sautait d'un coup avant de se corriger à l'image suivante. */
    slot(); place();
  });
  const drop = e => {
    if (!g || (e && e.pointerId !== g.pid)) return;
    clearTimeout(hold);
    const { el, up } = g;
    el.classList.remove('hold');
    g = null;
    if (!up) return;
    el.style.transition = ''; el.style.translate = ''; el.style.scale = '';
    el.classList.remove('drag'); wrap.classList.remove('dragging');
    const ids = items().map(n => n.dataset.id);
    if (ids.some(x => !x)) return;
    pushUndo('Ordre des livres', ids);
    ids.forEach((id, i) => { const d = deck(id); if (d) { d.pos = i; dirty[id] = 1; } });
    if (prefs.sort !== 'manual') { prefs.sort = 'manual'; savePrefs(); }
    save(); flush(); animate = false; render();
  };
  wrap.addEventListener('pointerup', drop);
  wrap.addEventListener('pointercancel', drop);
}

/* Aperçu : un appui long sur un paquet (ou le survol sur un écran qui en
   a un) montre ses premières cartes sans quitter l'accueil. */
function bindPeek() {
  /* #app ne change pas d'un écran à l'autre : une seule écoute suffit,
     sinon chaque rendu en empilait une de plus. */
  if ($.dataset.peekbound) return;
  $.dataset.peekbound = 1;
  let t = 0, moved = false;
  let held = null;
  const start = e => {
    if (reorder) return;                     // en rangement, l'appui long déplace
    const b = e.target.closest('[data-peek]'); if (!b) return;
    moved = false;
    clearTimeout(t);
    /* le livre s'enfonce doucement sous le doigt : on voit que quelque
       chose se prépare, au lieu d'une feuille qui surgit sans prévenir */
    held = b.closest('.tile, .lrow') || b;
    held.classList.add('hold');
    t = setTimeout(() => { if (!moved) { previewOf = b.dataset.peek; openMenu('preview'); } }, 480);
  };
  const stop = () => {
    moved = true; clearTimeout(t);
    if (held) { held.classList.remove('hold'); held = null; }
  };
  $.addEventListener('pointerdown', start);
  $.addEventListener('pointermove', stop);
  $.addEventListener('pointerup', stop);
  $.addEventListener('pointercancel', stop);
  $.addEventListener('scroll', stop, true);
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

/* ---------- sélection multiple ----------
   `sel` est nul hors du mode ; sinon c'est l'ensemble des cartes cochées.
   La barre du bas ne propose que ce qui a du sens : rien de grisé, rien
   qui ne réponde pas. */
let sel = null;
const selOff = () => { sel = null; };
function selBar(d) {
  const ids = [...sel].filter(i => d.cards.some(c => c.id === i));
  const n = ids.length;
  const all = n === d.cards.length;
  const anyOn = ids.some(i => !d.cards.find(c => c.id === i).x);
  return `<div class="selb">
    <button class="sbl" data-act="selall">${svg(all ? I.x : I.check)}${all ? 'Aucune' : 'Tout'}</button>
    <span class="sbn">${n ? n + ' carte' + (n > 1 ? 's' : '') : 'Aucune carte'}</span>
    <div class="sba">
      <button class="x" data-act="selmove" ${n && db.decks.length > 1 ? '' : 'disabled'}
        title="Déplacer vers un autre livre">${svg(I.out)}</button>
      <button class="x" data-act="selsus" ${n ? '' : 'disabled'}
        title="${anyOn ? 'Suspendre' : 'Réactiver'}">${svg(anyOn ? I.eyeoff : I.eye)}</button>
      <button class="x warn" data-act="seldel" ${n ? '' : 'disabled'}
        title="Supprimer">${svg(I.trash)}</button>
    </div>
  </div>`;
}

function deckView() {
  const d = deck(view.id); if (!d) return go('home');
  const s = subj(d.subject);
  /* Le filtre ne retire jamais de carte : il n'en montre qu'une partie.
     Tant qu'il est posé, la poignée disparaît — réordonner une liste
     filtrée écrirait des positions qui ne veulent rien dire. */
  const nq = norm(deckQ);
  const shown = nq ? d.cards.filter(c => norm(plain(c.f)).includes(nq) || norm(plain(c.b)).includes(nq))
                   : d.cards;
  /* Un paquet de mille cartes, c'est quatre mille champs de saisie à
     construire avant d'afficher quoi que ce soit : plusieurs secondes de
     page blanche sur un téléphone. On en pose une page, le reste arrive
     quand le bas de la liste approche. */
  const part = shown.slice(0, deckShow);
  const rest = shown.length - part.length;
  $.innerHTML = `
    <div class="bar">
      <button class="ic" data-act="home" aria-label="Retour">${svg(I.back)}</button>
      <div style="flex:1"></div>
      <button class="ic" data-act="menu" aria-label="Menu du livre">${svg(I.more)}</button>
    </div>
    <div class="head" style="${sty(s)}">
      <div class="t" id="dn" contenteditable="plaintext-only" spellcheck="false" enterkeyhint="done">${esc(d.name)}</div>
      <div class="s">
        <span>${svg(I.tag)}${esc(s.name)}</span><b></b>
        <span>${svg(I.card)}${plur(d.cards.length, 'page')}</span>
        ${!simpleMode() && dueCount(d) ? `<b></b><span>${svg(I.play)}${dueCount(d)} à revoir</span>` : ''}
        ${d.hidden ? `<b></b><span>${svg(I.eyeoff)}Masqué</span>` : ''}
      </div>
    </div>
    ${prof.comp && prof.comp.livre === d.id ? `<button class="cta read" data-act="pretour">
        ${svg(I.share)}Donner ce devoir</button>`
      : `<button class="cta read" data-act="study">${svg(I.play)}Lire${
          !simpleMode() && dueCount(d) ? ` <b>${dueCount(d)}</b>` : ''}</button>`}
    <div class="acts">
      <button data-act="quizdeck">${svg(I.pen)}Récitation</button>
      <button data-act="mcq">${svg(I.grid)}QCM</button>
      <button data-act="match">${svg(I.link)}Association</button>
      <button data-act="sharepick">${svg(I.share)}Partager</button>
    </div>
    ${simpleMode() ? '' : mixBar(d)}
    <div class="lbl"><span>Pages</span>
      ${d.cards.length > 5 ? `<button class="pick ico ${deckQ ? 'on' : ''}" data-act="deckfind"
        aria-label="Chercher dans ce livre">${svg(I.search)}</button>` : ''}
      ${d.cards.length ? `<button class="pick ${sel ? 'on' : ''}" data-act="selmode">${
        svg(sel ? I.check : I.pick)}${sel ? 'Terminer' : 'Sélectionner'}</button>` : ''}
      <span>${shown.length === d.cards.length ? d.cards.length : shown.length + ' / ' + d.cards.length}</span></div>
    ${deckOpen ? `<div class="fld deckfld"><input id="dq" type="search"
      placeholder="Chercher dans ce livre" autocomplete="off" autocapitalize="none"
      spellcheck="false" value="${esc(deckQ)}" aria-label="Chercher dans ce livre"></div>` : ''}
    <div class="rows ${sel ? 'picking' : ''}">
      ${!shown.length ? `<div class="note" style="padding:14px 4px">Aucune carte ne contient « ${esc(deckQ)} ».</div>` : ''}
      ${part.map((c, i) => `
        <div class="row ${c.x ? 'off' : ''} ${sel && sel.has(c.id) ? 'pk' : ''}" data-id="${c.id}" style="--i:${i}">
          ${sel ? `<button class="ck" data-pkc="${c.id}" aria-label="Sélectionner">${svg(I.check)}</button>`
            : `${nq ? '' : `<button class="grip" aria-label="Déplacer">${svg(I.grip)}</button>`}
              ${simpleMode() ? '' : `<i class="cst ${cstate(c)}" title="${STATE[cstate(c)]}${isLeech(c) ? ' · coriace' : ''}${c.d ? ' · dans ' + nextIn(c) : ''}"></i>`}`}
          <div class="fl">
            <input value="${esc(c.f)}" data-k="f" placeholder="Recto" ${sel ? 'tabindex="-1"' : ''}>
            <input class="b" value="${esc(c.b)}" data-k="b" placeholder="Verso" ${sel ? 'tabindex="-1"' : ''}>
          </div>
          ${sel ? '' : `<button class="x ${cardRich(c) ? 'on' : ''}" data-card="${c.id}"
            title="Type, étiquettes, image, son">${svg(cardIcon(c))}</button>
          <button class="x sus ${c.x ? 'on' : ''}" data-sus="${c.id}"
            title="${c.x ? 'Réactiver' : 'Suspendre'}">${svg(c.x ? I.eyeoff : I.eye)}</button>
          <button class="x" data-rm="${c.id}">${svg(I.x)}</button>`}
        </div>`).join('')}
      ${rest ? `<div class="more" id="more">${plur(rest, 'page')} de plus…</div>` : ''}
      ${sel ? '' : `<div class="duo ghost">
        <button data-act="add">${svg(I.plus)}Page</button>
        <button data-act="paste">${svg(I.down)}Coller</button>
      </div>`}
    </div>
    ${sel ? selBar(d) : ''}`;
  const more = document.getElementById('more');
  if (more) {
    const io2 = new IntersectionObserver(es => {
      if (!es.some(e => e.isIntersecting)) return;
      io2.disconnect();
      deckShow += DECKPAGE; animate = false; render();
    }, { rootMargin: '400px' });
    io2.observe(more);
  }
  const t = document.getElementById('dn');
  t.addEventListener('blur', () => {
    const v = t.textContent.replace(/\s+/g, ' ').trim();
    if (v !== d.name) { d.name = v || 'Paquet'; saveDeck(d); t.textContent = d.name; }
  });
  t.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); t.blur(); } });
  $.querySelectorAll('.row input').forEach(inp => inp.addEventListener('input', () => {
    const c = d.cards.find(x => x.id === inp.closest('.row').dataset.id);
    if (!c) return;
    c[inp.dataset.k] = inp.value;
    /* On n'empêche pas d'écrire — perdre ce qu'on vient de taper serait
       pire que tout — mais on le signale, et le compte restant apparaît
       quand on approche de la limite. */
    const max = inp.dataset.k === 'f' ? MAXF : MAXB;
    const len = plain(inp.value).length;
    inp.classList.toggle('over', len > max);
    let tag = inp.parentElement.querySelector('.lim');
    if (len > max * .8) {
      if (!tag) { tag = document.createElement('i'); tag.className = 'lim'; inp.parentElement.appendChild(tag); }
      tag.textContent = (max - len) + '';
      tag.classList.toggle('ko', len > max);
    } else if (tag) tag.remove();
    clearTimeout(typing); typing = setTimeout(() => saveDeck(d), 700);
  }));
  if (!nq) bindReorder(d);
  const dq = document.getElementById('dq');
  if (dq) {
    let dt = 0;
    dq.addEventListener('input', () => {
      deckQ = dq.value;
      clearTimeout(dt);
      dt = setTimeout(() => {
        /* on garde le champ vivant et on ne refait que la liste : sinon
           le clavier se referme entre deux lettres */
        const keep = document.activeElement === dq && dq.selectionStart;
        animate = false; render();
        const again = document.getElementById('dq');
        if (again && keep != null) { again.focus(); again.setSelectionRange(keep, keep); }
      }, 160);
    });
    if (!deckQ) setTimeout(() => dq.focus(), 50);
  }
}

/* ---------- réordonner par glisser-déposer ----------
   Seule la poignée prend le doigt (touch-action:none) : partout ailleurs
   la page défile normalement. Pendant le glissé rien n'est reconstruit —
   les lignes se décalent par transform, une écriture par image — et
   l'ordre n'est enregistré qu'au lâcher. */
function bindReorder(d) {
  const wrap = $.querySelector('.rows'); if (!wrap || sel) return;
  let g = null;
  const draw = () => {
    g.raf = 0;
    const { row, rows, from, step } = g;
    row.style.transform = `translate3d(0,${g.dy}px,0)`;
    g.to = Math.max(0, Math.min(rows.length - 1, from + Math.round(g.dy / step)));
    rows.forEach((r, i) => {
      if (r === row) return;
      const shift = g.to > from && i > from && i <= g.to ? -step
                  : g.to < from && i >= g.to && i < from ? step : 0;
      r.style.transform = shift ? `translate3d(0,${shift}px,0)` : '';
    });
  };
  wrap.addEventListener('pointerdown', e => {
    const h = e.target.closest('.grip'); if (!h || g) return;
    const rows = [...wrap.querySelectorAll('.row')];
    const row = h.closest('.row'), from = rows.indexOf(row);
    if (from < 0 || rows.length < 2) return;
    g = { row, rows, from, to: from, dy: 0, raf: 0, y0: e.clientY,
          step: rows[1].offsetTop - rows[0].offsetTop, pid: e.pointerId };
    /* le doigt garde la poignée même s'il sort de la liste ; si la capture
       est refusée (doigt déjà relâché), le glissé marche quand même, les
       mouvements étant écoutés sur la liste elle-même */
    try { h.setPointerCapture(e.pointerId); } catch (x) {}
    row.classList.add('drag'); wrap.classList.add('dragging');
    e.preventDefault();
  });
  wrap.addEventListener('pointermove', e => {
    if (!g || e.pointerId !== g.pid) return;
    g.dy = e.clientY - g.y0;
    if (!g.raf) g.raf = requestAnimationFrame(draw);
  });
  const drop = e => {
    if (!g || (e && e.pointerId !== g.pid)) return;
    cancelAnimationFrame(g.raf);
    const { from, to, rows, row } = g;
    rows.forEach(r => r.style.transform = '');
    row.classList.remove('drag'); wrap.classList.remove('dragging');
    g = null;
    if (from === to) return;
    pushUndo('Ordre des cartes', [d.id]);
    d.cards.splice(to, 0, d.cards.splice(from, 1)[0]);
    saveDeck(d); render();
  };
  wrap.addEventListener('pointerup', drop);
  wrap.addEventListener('pointercancel', drop);
}


/* ---------- connexion ---------- */
const PWMIN = 10;

/* ══════════ le cadre : mentions, confidentialité, conditions ══════════
   Trois textes, lisibles sans compte et hors ligne. Ils vivent dans le
   code plutôt que sur un site à part pour deux raisons : il faut pouvoir
   les lire AVANT de créer un compte — un consentement donné sans avoir pu
   lire n'en est pas un — et l'app doit rester entière hors réseau.

   Les passages entre ⟦crochets⟧ demandent une information que seul
   l'éditeur possède. Tant qu'ils sont là, ces textes ne sont pas
   opposables : ils sont une ossature juste, pas un document signé. Faire
   relire le contrat de sous-traitance par un juriste avant tout
   établissement — pas ces trois pages-ci, qui tiennent debout seules. */
const EDITEUR = '⟦nom ou raison sociale de l’éditeur⟧';
const CONTACT = '⟦adresse de contact⟧';
const LEGALV = '12 septembre 2026';

const LEGAL = {
  cgu: ['Conditions d’utilisation', `
**Ce que Folio est.** Une application de révision : tu écris des fiches,
l’app décide quand te les représenter, et tu peux en prêter à des lecteurs
que tu as toi-même ajoutés. Le service est fourni tel quel, sans garantie
de résultat scolaire.

**Âge minimum : 15 ans.** En France, c’est l’âge à partir duquel on peut
consentir seul au traitement de ses données par un service en ligne.
En dessous, il faut l’accord d’un parent ou du responsable légal : écris à
${CONTACT} avant de créer un compte.

**Ton compte est à toi.** Une adresse e-mail, un mot de passe d’au moins
${PWMIN} caractères, et tu en es responsable. Ne le prête pas : ce qui est
fait depuis ton compte est réputé fait par toi.

**Ce que tu écris t’appartient.** Tes fiches restent tienne. En publiant un
livre sur une étagère ou en le prêtant à un lecteur, tu autorises
seulement les personnes concernées à le lire et à le copier chez elles —
rien de plus, et tu peux le retirer quand tu veux.

**Ce qui n’a pas sa place ici.** Contenu illégal, haineux, sexuel,
harcelant ou qui expose la vie privée d’autrui ; contenu protégé par un
droit d’auteur que tu n’as pas ; usurpation d’identité. Un compte qui s’en
sert ainsi peut être suspendu sans préavis.

**Ce que nous ne faisons pas.** Aucune publicité, aucun traceur, aucune
revente de données, aucun profilage publicitaire. Ce n’est pas une
promesse commerciale : c’est la description du code.

**Interruptions.** Le service peut s’arrêter pour maintenance, ou changer.
Tes données restent exportables. Si Folio devait fermer, tu serais prévenu
avec un délai raisonnable pour les récupérer.

**Droit applicable.** Droit français. En cas de différend, on cherche
d’abord une solution à l’amiable en écrivant à ${CONTACT}.

*Version du ${LEGALV}.*`],

  vie: ['Confidentialité', `
**Qui traite tes données.** ${EDITEUR}, éditeur de Folio, joignable à
${CONTACT}. Lorsque Folio est déployé par un établissement scolaire, c’est
l’établissement qui décide du traitement et nous n’agissons que sur ses
instructions.

**Ce qui est collecté, et pourquoi.**

- *Ton adresse e-mail et ton mot de passe* — pour ouvrir la session et te
  permettre de la récupérer. Le mot de passe n’est jamais lisible, même
  par nous.
- *Ton pseudo et ton nom affiché*, si tu en mets — pour que les lecteurs
  que tu ajoutes sachent qui tu es. Le pseudo sert à t’ajouter sans faire
  circuler d’adresse e-mail.
- *Tes livres et tes fiches*, y compris les images et les sons que tu y
  attaches — c’est le contenu du service.
- *Ton historique de révision* : ce que tu as répondu, quand, juste ou
  faux, en combien de temps — c’est ce qui permet au moteur de choisir
  quand une fiche revient, et de tracer tes courbes.
- *Tes réglages.*
- *Les envois entre lecteurs* : les livres prêtés et le message qui
  accompagne.
- *L’usage de l’IA* : le nombre d’appels et leur coût, pour tenir les
  plafonds de dépense. Le texte de tes cours n’est pas conservé.
- *Un signalement que tu fais ou que tu reçois* : une copie du contenu visé
  est jointe, pour qu’elle reste lisible même si l’original est effacé
  entretemps. Seuls les modérateurs y accèdent, pour instruire la plainte.
- *Qui tu bloques.*

Aucun traceur publicitaire, aucune mesure d’audience, aucun cookie autre
que ce qui est strictement nécessaire à ta session.

**Sur quelle base.** L’exécution du service que tu demandes en créant un
compte. Les fonctions de partage — étagère, défis, classement — ne
s’activent que par ton geste, et tu peux revenir en arrière. En
établissement, la base est la mission d’intérêt public de l’établissement.

**Où vivent ces données.** Dans une base Supabase hébergée en Irlande
(Amazon Web Services, région eu-west-1), dans l’Union européenne. Supabase
Inc. et Amazon sont des sociétés de droit américain : un accès par une
autorité américaine ne peut donc pas être exclu, même si les serveurs sont
européens. L’application elle-même est servie par ⟦hébergeur du site⟧.

**L’intelligence artificielle.** Si tu utilises le bouton de génération de
fiches, le texte ou la photo que tu fournis est envoyé à l’API d’Anthropic,
aux États-Unis, le temps de fabriquer les fiches. Ce texte ne sert pas à
entraîner de modèle. Cette fonction ne part jamais toute seule : elle
n’existe que si tu appuies.

**Combien de temps.** Tes livres restent tant que ton compte existe. Un
livre supprimé part en corbeille et s’efface définitivement au bout de 30
jours, purgés chaque nuit sans qu’il soit besoin de rouvrir l’écran
Corbeille. Les dix dernières versions d’un livre sont conservées. Ton
historique de révision est gardé tant que ton compte vit, puisque c’est
lui qui fait fonctionner le moteur. Un signalement reste le temps de son
instruction, et douze mois après sa clôture — le temps de répondre à une
contestation — puis s’efface. Tout disparaît à la suppression du compte.

**Qui d’autre peut voir.** Personne, par défaut. Un autre compte ne voit
tes fiches que si tu les lui as prêtées, ou si tu les as posées sur une
étagère dont il fait partie. Ce n’est pas qu’une règle d’affichage : la
base elle-même refuse de rendre les lignes d’un autre compte. Les images
et les sons ne quittent jamais ton compte, même quand tu prêtes un livre :
seul le texte des fiches voyage. Si tu es signalé, un modérateur voit la
copie jointe au signalement, rien d’autre de ton compte. En établissement
scolaire, ton professeur voit si tu as ouvert et rendu ses devoirs, jamais
tes réponses ni tes livres personnels ; le référent de l’établissement
peut, lui, corriger ton identité ou refaire ton mot de passe — chacun de
ses gestes sur ton compte est tracé et consultable par l’établissement.

**Tes droits.** Tu peux consulter, corriger, exporter et effacer tes
données. L’export du journal se fait depuis l’écran Journal de lecture ;
la suppression définitive du compte depuis Réglages, et elle est
immédiate. Pour tout le reste, écris à ${CONTACT} ; réponse sous un mois.
Tu peux aussi saisir la CNIL.

**En cas de fuite.** Si des données venaient à être exposées, les
personnes concernées et, le cas échéant, la CNIL seraient prévenues dans
les délais prévus par le règlement.

*Version du ${LEGALV}.*`],

  mentions: ['Mentions légales', `
**Éditeur.** ${EDITEUR}
⟦statut juridique, adresse postale, et numéro SIREN s’il existe⟧
Contact : ${CONTACT}

**Directeur de la publication.** ⟦nom⟧

**Hébergement de l’application.** ⟦hébergeur du site : nom et adresse⟧

**Hébergement des données.** Supabase Inc., infrastructure Amazon Web
Services, région eu-west-1 (Irlande, Union européenne).

**Génération de fiches par IA.** Anthropic PBC (États-Unis), appelée
uniquement lorsque tu le demandes.

**Propriété.** Le nom Folio, son identité visuelle et le code de
l’application appartiennent à l’éditeur. Les fiches écrites par les
utilisateurs restent la propriété de leurs auteurs.

**Signaler un contenu ou un problème.** ${CONTACT}

*Version du ${LEGALV}.*`]
};

/* Tant qu'un ⟦crochet⟧ traîne dans ces trois textes, l'app ne dit pas qui
   traite les données ni comment le joindre — exigé dès la collecte par
   l'art. 13.1.a et .b du RGPD (et par la LCEN pour les mentions légales).
   Le commentaire au-dessus d'EDITEUR/CONTACT prévenait déjà ; ce signal-ci
   reste visible en production tant que le remplacement n'est pas fait. */
if (/⟦/.test(EDITEUR + CONTACT + Object.values(LEGAL).map(v => v[1]).join(''))) {
  console.error('Folio : mentions légales incomplètes — des ⟦placeholders⟧ sont encore '
    + 'servis aux utilisateurs (identité/coordonnées du responsable de traitement, art. 13 RGPD). '
    + 'Voir EDITEUR, CONTACT et LEGAL.mentions dans app.js.');
}

/* Le rendu : gras, italique, listes et paragraphes. Cinq lignes plutôt
   qu'une bibliothèque, pour la même raison que le reste de l'app. */
function legalHtml(src) {
  return src.trim().split(/\n\s*\n/).map(b => {
    const t = b.trim();
    const fmt = s => esc(s).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
                           .replace(/\*([^*]+)\*/g, '<i>$1</i>');
    if (/^- /.test(t)) {
      return `<ul>${t.split(/\n(?=- )/).map(li =>
        `<li>${fmt(li.replace(/^- /, '').replace(/\n\s+/g, ' '))}</li>`).join('')}</ul>`;
    }
    return `<p>${fmt(t.replace(/\n/g, ' '))}</p>`;
  }).join('');
}

let legalTab = 'cgu';
let legalBack = 'settings';        // d'où l'on vient : connexion ou réglages
function legalView() {
  const [title, body] = LEGAL[legalTab];
  $.innerHTML = `
    <div class="bar"><button class="ic" data-act="${legalBack === 'login' ? 'tolog' : 'settings'}"
        aria-label="Retour">${svg(I.back)}</button><h1>${esc(title)}</h1></div>
    <div class="page">
      <div class="pills" id="lgTabs">${Object.entries(LEGAL).map(([k, v]) =>
        `<button class="p${legalTab === k ? ' on' : ''}" data-legal="${k}">${esc(v[0])}</button>`).join('')}</div>
      <div class="legal">${legalHtml(body)}</div>
    </div>`;
}

let loginBusy = false, loginMode = 'in';
function loginView() {
  const up = loginMode === 'up';
  $.innerHTML = `<div class="login">
    <img class="logo" src="icons/icon-192.png" alt="">
    <div class="lt">Folio</div>
    <div class="lsub">Tes cours, reliés en livres.</div>
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
      ${up ? `<label class="lage"><input type="checkbox" id="age">
        <span>J’ai 15 ans ou plus, et j’accepte les conditions d’utilisation.</span></label>` : ''}
      <button class="cta" id="go" type="submit">${up ? 'Créer le compte' : 'Se connecter'}${svg(I.arrow)}</button>
      ${up ? '' : `<button class="lnk" id="forgot" type="button">Mot de passe oublié</button>`}
    </form>
    <div class="lleg">${Object.entries(LEGAL).map(([k, v]) =>
      `<button data-legal="${k}">${esc(v[0])}</button>`).join('<i>·</i>')}</div>
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
    /* Six caractères se cassent hors ligne en quelques secondes. Dix est
       le plancher, et il ne vaut que parce que le même est réglé côté
       Supabase : ce contrôle-ci ne protège que la personne qui se sert du
       formulaire, pas celle qui appelle l'API directement. */
    if (up && pw.value.length < PWMIN) {
      err.textContent = `Mot de passe : ${PWMIN} caractères minimum`; return;
    }
    /* La case n'est pas une formalité : en dessous de 15 ans, le
       consentement d'un parent est requis, et on ne peut pas le recueillir
       ici. Mieux vaut ne pas ouvrir le compte que de faire semblant. */
    const age = document.getElementById('age');
    if (up && age && !age.checked) {
      err.textContent = 'Confirme que tu as 15 ans ou plus'; return;
    }
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
      /* Un lien de partage ouvert alors qu'on n'était pas connecté attend
         dans l'adresse : c'est maintenant qu'il faut le suivre, sinon on
         atterrit sur l'accueil sans savoir ce qu'on venait voir. */
      if (!consumeHash() && !consumeGoto()) { go('home'); accueil(); }
      maybeTour();
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

/* ---------- petites explications ----------
   Les paragraphes posés sous chaque réglage se lisaient comme une notice
   et noyaient les réglages eux-mêmes. Ne reste qu'une pastille « ? », et
   seulement là où le nom ne suffit pas : ce qu'on perd en éteignant le
   moteur, ce que « ratées » veut dire, ce que « rapide » enchaîne.
   Tout ce qui se devine au premier coup d'œil n'a pas de pastille. */
const HELP = {
  simple: ['Mode simple',
    'Le moteur estime, pour chaque page, le jour où tu serais sur le point de l’oublier, et te ' +
    'la redonne juste avant.\n\nL’éteindre rend l’app manuelle — les pages défilent dans ' +
    'l’ordre choisi, tu balaies à droite si tu sais, à gauche sinon. Ta progression reste ' +
    'enregistrée et repart où elle en était dès que tu le rallumes.'],
  dr: ['Rétention visée',
    'La part de tes pages que tu veux encore savoir au moment où elles reviennent.\n\n' +
    'À 90 %, une page sur dix t’échappe au retour : c’est le réglage conseillé, celui qui ' +
    'demande le moins de révisions pour ce que tu retiens.\n\nViser plus haut fait revenir ' +
    'les pages plus souvent et coûte beaucoup plus de travail pour peu de mémoire en plus. ' +
    'Viser plus bas allège les journées mais laisse filer davantage.'],
  order: ['Ordre des cartes',
    'Aléatoire : mélangées à chaque séance.\nDu livre : l’ordre dans lequel tu les as écrites.\n' +
    'Ratées : celles que tu manques le plus souvent d’abord.\nUrgentes : les plus en retard d’abord.'],
  tune: ['Régler le moteur sur moi',
    'Les réglages d’origine décrivent une mémoire moyenne. Le moteur peut apprendre la ' +
    'tienne sur tes révisions passées : à quelle vitesse tu oublies, ce qui te résiste, ce ' +
    'qui tient tout seul.\n\nIl le fait de lui-même dès que tu as assez d’historique, et ' +
    'recommence de temps en temps. Ce bouton force le calcul tout de suite.'],
  fast: ['Mode rapide',
    'Une bonne réponse enchaîne toute seule sur la suivante, au quiz comme en QCM et en vrai/faux. ' +
    'Sans lui, la correction reste à l’écran jusqu’à ce que tu appuies sur Suivant.']
};
let helpKey = null;
const hlp = k => `<button class="hq" data-help="${k}" aria-label="${esc(HELP[k][0])}, explication">?</button>`;

/* ---------- réglages ---------- */
let subjEdit = null, subjColor = 'graphite', subjName = '';
let cardEdit = null;
function openSubject(id) {
  const t0 = db.subjects.find(x => x.id === id);
  /* Une matière posée par le professeur ne s'édite pas : elle sert de lien
     entre son cours et les livres de toute la classe. La base refuse déjà
     la modification comme l'effacement — ouvrir le formulaire ne ferait
     qu'annoncer un enregistrement qui n'aurait pas lieu. */
  if (t0 && t0.locked) return toast(I.lock, 'Matière du cours · posée par ton professeur');
  subjEdit = id;
  const t = t0;
  subjColor = t ? t.color : COLORS[db.subjects.length % COLORS.length];
  subjName = t ? t.name : '';
  openMenu('subject');
}
function settingsView() {
  $.innerHTML = `
    <div class="bar"><button class="ic" data-act="home" aria-label="Retour">${svg(I.back)}</button></div>
    <div class="page">
      <div class="top"><div class="hero">Réglages</div></div>
      <div class="lbl"><span>Révision</span></div>
      <div class="slist">
        <div class="srw"><button class="sr flat" data-act="tglsimple">${svg(I.brain)}
          <span class="n">Mode simple</span>
          <span class="tgl ${prefs.simple ? 'on' : ''}"></span></button>${hlp('simple')}</div>
        <div class="sr flat col">
          <div class="srh">${svg(I.target)}<span class="n">Objectif du jour</span>
            <span class="c">${prefs.goal} pages</span></div>
          <input class="rng" id="pGoal" type="range" min="5" max="200" step="5" value="${prefs.goal}"
            aria-label="Objectif du jour"></div>
        ${prefs.simple ? '' : `<div class="sr flat col">
          <div class="srh">${svg(I.plus)}<span class="n">Nouvelles pages par séance</span>
            <span class="c">${prefs.cap || 'sans limite'}</span></div>
          <input class="rng" id="pCap" type="range" min="0" max="100" step="5" value="${prefs.cap}"
            aria-label="Nouvelles pages par séance"></div>
        <div class="sr flat col">
          <div class="srh">${svg(I.brain)}<span class="n">Rétention visée</span>
            <span class="c">${Math.round(fsrsDR() * 100)} %</span>${hlp('dr')}</div>
          <input class="rng" id="pDr" type="range" min="70" max="97" step="1"
            value="${Math.round(fsrsDR() * 100)}" aria-label="Rétention visée"></div>`}
        <div class="sr flat col">
          <div class="srh">${svg(I.shuffle)}<span class="n">Ordre des pages</span>${hlp('order')}</div>
          <div class="seg" id="pOrder">
            ${[['random', 'Aléatoire'], 
['deck', 'Du livre'], ['worst', 'Ratées'], ['due', 'Urgentes']]
              .filter(([v]) => !(prefs.simple && v === 'due'))
              .map(([v, l]) => `<button data-ord="${v}" class="${prefs.order === v ? 'on' : ''}">${l}</button>`).join('')}
          </div>
        </div>
        <button class="sr flat" data-act="tglfresh">${svg(I.card)}
          <span class="n">Nouvelles pages d’abord</span>
          <span class="tgl ${prefs.fresh ? 'on' : ''}"></span></button>
        <button class="sr flat" data-act="tglboth">${svg(I.swap)}
          <span class="n">Mélanger les deux sens</span>
          <span class="tgl ${prefs.both ? 'on' : ''}"></span></button>
        <div class="srw"><button class="sr flat" data-act="tglfast">${svg(I.skip)}
          <span class="n">Mode rapide</span>
          <span class="tgl ${prefs.fast ? 'on' : ''}"></span></button>${hlp('fast')}</div>
        ${prefs.simple ? '' : `<div class="srw"><button class="sr flat" data-act="replay">${svg(I.chart)}
          <span class="n">Régler le moteur sur moi</span>
          <span class="c">${prefs.wAt
            ? (prefs.wN ? prefs.wN.toLocaleString('fr-FR') + ' révisions' : 'réglé')
            : 'réglages d’origine'}</span>
          ${svg(I.arrow)}</button>${hlp('tune')}</div>`}
      </div>

      <div class="lbl"><span>Affichage</span></div>
      <div class="slist">
        <div class="sr flat col">
          <div class="srh">${svg(I.card)}<span class="n">Taille du texte</span>
            <span class="c">${Math.round((prefs.font || 1) * 100)} %</span></div>
          <input class="rng" id="pFont" type="range" min="80" max="140" step="5"
            value="${Math.round((prefs.font || 1) * 100)}" aria-label="Taille du texte">
          <div class="fprev" style="font-size:calc(17px * var(--fs,1))">Aperçu : la casa</div>
        </div>
        <button class="sr flat" data-act="tglsound">${svg(I.sound)}
          <span class="n">Sons</span>
          <span class="tgl ${prefs.sound ? 'on' : ''}"></span></button>
      </div>

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

      <div class="lbl"><span>Mon compte</span></div>
      <div class="slist">
        <button class="sr flat" data-act="rename">${svg(I.user)}
          <span class="n">${esc(prefs.name || auth.email)}</span>${svg(I.arrow)}</button>
        <button class="sr flat" data-act="stats">${svg(I.chart)}<span class="n">Journal de lecture</span>${svg(I.arrow)}</button>
        <button class="sr flat" data-act="commu">${svg(I.user)}<span class="n">Le cercle des lecteurs</span>${svg(I.arrow)}</button>
        <button class="sr flat" data-act="chpwd">${svg(I.lock)}<span class="n">Changer le mot de passe</span>${svg(I.arrow)}</button>
      </div>

      <div class="lbl"><span>Mes données</span></div>
      <div class="slist">
        ${canUndo() ? `<button class="sr flat" data-act="undo2">${svg(I.redo)}
          <span class="n">Annuler ${esc(undoLabel().toLowerCase())}</span></button>` : ''}
        <button class="sr flat" data-act="trash">${svg(I.trash)}<span class="n">Corbeille</span>
          <span class="c">${trash.n || ''}</span>${svg(I.arrow)}</button>
        <button class="sr flat" data-act="help">${svg(I.bulb)}<span class="n">Aide</span>
          <span class="c">revoir la visite</span>${svg(I.arrow)}</button>
        ${installed() ? '' : `<button class="sr flat" data-act="install">${svg(I.plus)}
          <span class="n">Ajouter à l’écran d’accueil</span>${svg(I.arrow)}</button>`}
        ${myRole === 'ref' && atSchool() ? `<button class="sr flat" data-act="ref">${svg(I.build)}
          <span class="n">Mon établissement</span>
          <span class="c">${ref.board ? esc(ref.board.org) : ''}</span>${svg(I.arrow)}</button>` : ''}
        ${isAdmin() ? `<button class="sr flat" data-act="admin">${svg(I.key)}
          <span class="n">Administration</span>
          <span class="c">${accounts ? accounts.length : ''}</span>${svg(I.arrow)}</button>` : ''}
        ${iAmMod ? `<button class="sr flat" data-act="mod">${svg(I.warn)}
          <span class="n">Signalements</span>
          <span class="c">${mods.list ? (mods.list.length || '') : ''}</span>${svg(I.arrow)}</button>` : ''}
        <button class="sr flat" data-act="blocked">${svg(I.lock)}
          <span class="n">Comptes bloqués</span>
          <span class="c">${blocks && blocks.length ? blocks.length : ''}</span>${svg(I.arrow)}</button>
        <button class="sr flat" data-legal="cgu">${svg(I.file)}
          <span class="n">Conditions et confidentialité</span>${svg(I.arrow)}</button>
      </div>

      <div class="lbl"><span>Quitter</span></div>
      <div class="slist">
        <button class="sr flat warn" data-act="logout">${svg(I.exit)}<span class="n">Se déconnecter</span></button>
        <button class="sr flat warn" data-act="delacc">${svg(I.trash)}<span class="n">Supprimer le compte</span></button>
      </div>
      <div class="foot">${pending()
        ? plur(pending(), 'modification') + ' en attente' + (online ? ' d’envoi' : ' — reprise dès le retour du réseau')
        : online ? 'Synchronisé' : 'Hors ligne — rien en attente'}</div>
    </div>`;
  const g = document.getElementById('pGoal'), c = document.getElementById('pCap');
  g.addEventListener('input', () => {
    prefs.goal = +g.value; savePrefs();
    g.closest('.sr').querySelector('.c').textContent = prefs.goal + ' pages';
  });
  if (c) c.addEventListener('input', () => {
    prefs.cap = +c.value; savePrefs();
    c.closest('.sr').querySelector('.c').textContent = prefs.cap || 'sans limite';
  });
  /* Le seul bouton de réglage du moteur : viser plus haut, c'est plus de
     révisions ; viser plus bas, c'est en oublier davantage. */
  const dr = document.getElementById('pDr');
  if (dr) dr.addEventListener('input', () => {
    prefs.dr = +dr.value / 100; savePrefs();
    dr.closest('.sr').querySelector('.c').textContent = dr.value + ' %';
  });
  const fo = document.getElementById('pFont');
  if (fo) fo.addEventListener('input', () => {
    prefs.font = +fo.value / 100; savePrefs(); applyFont();
    fo.closest('.sr').querySelector('.c').textContent = fo.value + ' %';
  });
  document.getElementById('pOrder').addEventListener('click', e => {
    const b = e.target.closest('[data-ord]'); if (!b) return;
    prefs.order = b.dataset.ord; savePrefs(); render();
  });
}

/* ---------- corbeille ----------
   Supprimer un paquet le marque d'une date au lieu de l'effacer. Il reste
   là trente jours, restaurable en un geste ; passé ce délai il part pour
   de bon, purgé à l'ouverture de la corbeille — personne n'a à y penser. */
const KEEP = 30;
const leftFor = iso => Math.max(0, KEEP - Math.floor((Date.now() - Date.parse(iso)) / DAY));

async function trashPull() {
  const cut = new Date(Date.now() - KEEP * DAY).toISOString();
  try {
    /* purge d'abord : ce qui s'affiche ensuite est exactement ce qui reste */
    await api(`/rest/v1/decks?deleted_at=lt.${cut}`, 'DELETE', null, { Prefer: 'return=minimal' });
    const rows = await api('/rest/v1/decks?select=id,name,subject,cards,deleted_at'
      + '&deleted_at=not.is.null&order=deleted_at.desc');
    trash.list = (rows || []).map(x => ({
      id: x.id, name: x.name, subject: x.subject,
      cards: (x.cards || []).length, at: x.deleted_at
    }));
    trash.n = trash.list.length; trash.err = 0;
  } catch (e) { trash.err = 1; }
  if (view.name === 'trash') render();
}

function trashView() {
  const l = trash.list;
  $.innerHTML = `
    <div class="bar"><button class="ic" data-act="settings" aria-label="Retour">${svg(I.back)}</button></div>
    <div class="page">
      <div class="top"><div class="hero">Corbeille</div></div>
      <div class="note">Gardés ${KEEP} jours, pages et progression comprises.</div>
      ${!l ? `<div class="empty">${svg(I.clock)}<p>${trash.err ? 'Corbeille indisponible' : 'Chargement…'}</p></div>`
        : !l.length ? `<div class="empty">${svg(I.trash)}<p><b>Corbeille vide</b></p></div>`
        : `<div class="slist">${l.map(t => {
            const s = subj(t.subject), d = leftFor(t.at);
            return `<div class="sr flat col trr" style="${sty(s)}">
              <div class="srh"><i class="tri"></i><span class="n">${esc(t.name)}</span>
                <span class="c">${t.cards} carte${t.cards > 1 ? 's' : ''}</span></div>
              <div class="trf">
                <span class="trd ${d <= 3 ? 'soon' : ''}">${d
                  ? 'Encore ' + d + ' jour' + (d > 1 ? 's' : '') : 'Part aujourd’hui'}</span>
                <button class="trb" data-trr="${t.id}">${svg(I.redo)}Restaurer</button>
                <button class="trb warn" data-trd="${t.id}">${svg(I.trash)}Supprimer</button>
              </div></div>`;
          }).join('')}</div>`}
    </div>`;
}

async function trashRestore(id) {
  const t = trash.list && trash.list.find(x => x.id === id); if (!t) return;
  trash.list = trash.list.filter(x => x.id !== id); trash.n = trash.list.length;
  render();
  try {
    await api(`/rest/v1/decks?id=eq.${encodeURIComponent(id)}`, 'PATCH',
      { deleted_at: null }, { Prefer: 'return=minimal' });
    await pull(); save();
    if (view.name === 'trash') render();
    toast(I.check, 'Paquet restauré');
  } catch (e) { trash.list = null; trashPull(); toast(I.x, "Restauration impossible"); }
}

async function trashPurge(id) {
  trash.list = trash.list.filter(x => x.id !== id); trash.n = trash.list.length;
  render();
  try {
    await api(`/rest/v1/decks?id=eq.${encodeURIComponent(id)}`, 'DELETE', null,
      { Prefer: 'return=minimal' });
    toast(I.trash, 'Supprimé définitivement');
  } catch (e) { trash.list = null; trashPull(); toast(I.x, "Suppression impossible"); }
}

/* ---------- annuaire des comptes ----------
   De quoi choisir un destinataire, rien de plus : un nom, un identifiant.
   Chaque connexion réécrit sa propre ligne ; jamais celle d'un autre. */
async function upsertProfile() {
  if (!auth) return;
  try {
    await api('/rest/v1/profiles', 'POST',
      [{ id: auth.uid, email: auth.email, name: prefs.name || null }],
      { Prefer: 'resolution=merge-duplicates,return=minimal' });
  } catch (e) {}
}
/* On n'envoie un paquet qu'à quelqu'un qu'on a ajouté, et l'annuaire
   complet n'est plus lisible : chacun ne voit que ses propres liens. */
async function friendsPull() {
  try {
    const rows = await api('/rest/v1/rpc/my_friends', 'POST', {});
    friends = (rows || []);
    mates = friends.filter(f => f.status === 'ok');
    asks = friends.filter(f => f.status === 'pending' && f.sens === 'recue');
  } catch (e) { friends = friends || []; mates = mates || []; asks = asks || []; }
  if (view.name === 'commu' || view.name === 'friends') { animate = false; render(); }
  if (menu) paintMenu();
}
async function askFriend(q) {
  const one = (await api('/rest/v1/rpc/find_user', 'POST', { q }) || [])[0];
  if (!one) { toast(I.x, 'Aucun compte sous ce pseudo'); return false; }
  if (friends && friends.some(f => f.id === one.id)) { toast(I.check, 'Déjà dans ta liste'); return true; }
  await api('/rest/v1/friends', 'POST', [{ user_id: auth.uid, friend_id: one.id, status: 'pending' }],
    { Prefer: 'return=minimal' });
  toast(I.check, 'Demande envoyée à ' + (one.handle || one.name));
  friendsPull();
  return true;
}
async function answerFriend(id, yes) {
  try {
    if (yes) await api(`/rest/v1/friends?user_id=eq.${id}&friend_id=eq.${auth.uid}`, 'PATCH',
      { status: 'ok' }, { Prefer: 'return=minimal' });
    else await api(`/rest/v1/friends?user_id=eq.${id}&friend_id=eq.${auth.uid}`, 'DELETE',
      null, { Prefer: 'return=minimal' });
    toast(yes ? I.check : I.x, yes ? 'Lecteur ajouté' : 'Demande refusée');
  } catch (e) { toast(I.x, 'Impossible pour l’instant'); }
  friendsPull();
}
async function dropFriend(id) {
  try {
    await api(`/rest/v1/friends?or=(and(user_id.eq.${auth.uid},friend_id.eq.${id}),`
      + `and(user_id.eq.${id},friend_id.eq.${auth.uid}))`, 'DELETE', null, { Prefer: 'return=minimal' });
  } catch (e) {}
  closeMenu(); friendsPull();
}

/* ---------- pseudo ----------
   On s'ajoute par pseudo, pas par adresse : c'est ce qu'on se dit de vive
   voix, et ça évite de faire circuler les e-mails de tout le monde. */
const cleanHandle = v => String(v || '').toLowerCase().replace(/[^a-z0-9_.-]/g, '').slice(0, 20);
async function saveHandle(v) {
  const h = cleanHandle(v);
  if (h.length < 3) { toast(I.x, 'Au moins 3 caractères'); return false; }
  try {
    await api('/rest/v1/profiles', 'POST', [{ id: auth.uid, email: auth.email, handle: h, name: prefs.name || null }],
      { Prefer: 'resolution=merge-duplicates,return=minimal' });
    me.handle = h; save();
    toast(I.check, '@' + h);
    return true;
  } catch (e) {
    toast(I.x, /duplicate|unique/i.test(String(e.message || '')) ? 'Ce pseudo est déjà pris' : 'Impossible pour l’instant');
    return false;
  }
}
async function mePull() {
  try {
    const r = (await api('/rest/v1/profiles?select=id,handle,name&id=eq.' + auth.uid) || [])[0];
    me = r || { id: auth.uid, handle: '' };
  } catch (e) { me = me || { id: auth.uid, handle: '' }; }
}

/* ---------- envoyer un paquet à un ami ----------
   Seuls le recto et le verso voyagent, jamais la progression : la
   révision de l'expéditeur ne veut rien dire chez quelqu'un d'autre, qui
   doit pouvoir repartir de zéro sur ce paquet comme sur les siens. */
async function sendDeck(d, p) {
  const msg = sendMsg.trim(), cards = d.cards.map(c => [c.f, c.b]);
  sendTo = null; sendMsg = '';
  try {
    await api('/rest/v1/mail', 'POST', [{
      from_user: auth.uid, to_user: p.id, from_name: prefs.name || (me && me.handle) || 'Compte',
      deck_name: d.name, message: msg, cards
    }], { Prefer: 'return=minimal' });
    toast(I.check, 'Envoyé à ' + (p.name || p.email));
  } catch (e) { toast(I.x, 'Envoi impossible'); }
}

/* ---------- boîte de réception ----------
   Le détail (cartes, message) n'arrive qu'à l'ouverture de l'écran, comme
   la corbeille ; seul le compte de non-lus voyage à chaque connexion,
   pour que le petit repère au-dessus du gear reste à jour sans attendre. */
async function mailPull() {
  try {
    const rows = await api('/rest/v1/mail?select=id,from_user,from_name,deck_name,message,cards,created_at,read_at,added_at&order=created_at.desc');
    mailbox.list = rows || [];
    mailbox.n = mailbox.list.filter(r => !r.read_at).length;
    mailbox.err = 0;
  } catch (e) { mailbox.err = 1; }
  if (view.name === 'mail') render();
}
function timeAgo(iso) {
  const ms = Date.now() - Date.parse(iso);
  if (ms < MIN) return 'à l’instant';
  if (ms < 60 * MIN) return Math.round(ms / MIN) + ' min';
  if (ms < DAY) return Math.round(ms / (60 * MIN)) + ' h';
  const j = Math.round(ms / DAY);
  return j < 31 ? j + ' j' : Math.round(j / 30) + ' mois';
}
function mailView() {
  const l = mailbox.list;
  $.innerHTML = `
    <div class="bar"><button class="ic" data-act="home" aria-label="Retour">${svg(I.back)}</button></div>
    <div class="page">
      <div class="top"><div class="hero">Boîte de réception</div></div>
      ${!l ? `<div class="empty">${svg(I.mail)}<p>${mailbox.err ? 'Boîte indisponible' : 'Chargement…'}</p></div>`
        : !l.length ? `<div class="empty">${svg(I.mail)}<p><b>Aucun message</b></p></div>`
        : `<div class="slist">${l.map(it => `
          <button class="sr flat mlrow ${!it.read_at ? 'unread' : ''}" data-mail="${it.id}">
            ${it.read_at ? svg(I.mail) : '<i class="mdot"></i>'}
            <span class="ml2">
              <span class="n">${esc(shortWho(it.from_name) || 'Un ami')} → ${esc(it.deck_name)}</span>
              <span class="sub">${it.message
                ? `« ${esc(it.message)} »`
                : plur((it.cards || []).length, 'page')}</span>
            </span>
            <span class="c">${timeAgo(it.created_at)}</span>${svg(I.arrow)}
          </button>`).join('')}</div>`}
    </div>`;
}
async function openMail(id) {
  mailOpen = id;
  const it = mailbox.list && mailbox.list.find(x => x.id === id);
  openMenu('mailitem');
  if (it && !it.read_at) {
    it.read_at = new Date().toISOString();
    mailbox.n = mailbox.list.filter(r => !r.read_at).length;
    if (view.name === 'mail') render();
    try { await api(`/rest/v1/mail?id=eq.${id}`, 'PATCH', { read_at: it.read_at }, { Prefer: 'return=minimal' }); }
    catch (e) {}
  }
}
async function addMail(it) {
  const n = (it.cards || []).length;
  const d = importPayload({ name: it.deck_name, subject: '', cards: it.cards }, true);
  it.added_at = new Date().toISOString();
  closeMenu();
  if (d) go('deck', d.id);
  toast(I.check, plur(n, 'page') + ' ajoutée' + (n > 1 ? 's' : ''));
  try { await api(`/rest/v1/mail?id=eq.${it.id}`, 'PATCH', { added_at: it.added_at }, { Prefer: 'return=minimal' }); }
  catch (e) {}
}
async function delMail(id) {
  mailbox.list = mailbox.list.filter(x => x.id !== id);
  mailbox.n = mailbox.list.filter(r => !r.read_at).length;
  closeMenu(); render();
  try { await api(`/rest/v1/mail?id=eq.${id}`, 'DELETE', null, { Prefer: 'return=minimal' }); }
  catch (e) {}
}

/* ---------- historique d'un paquet ----------
   Annuler ne va pas plus loin que la session en cours et ne suit pas
   l'appareil. Avant chaque opération qui remplace le contenu d'un paquet
   — remplacement en masse, fusion, découpe, réimport — on en garde une
   photo côté serveur. Dix par paquet : au-delà, ce n'est plus de
   l'histoire, c'est du stockage. */
const VERSN = 10;
async function snapVersion(d, why) {
  if (!auth || !d || !d.cards.length) return;
  try {
    await api('/rest/v1/deck_versions', 'POST',
      [{ user_id: auth.uid, deck_id: d.id, name: d.name, why: why || '',
         cards: d.cards.map(c => [c.f, c.b, c.id]) }], { Prefer: 'return=minimal' });
    const old = await api(`/rest/v1/deck_versions?deck_id=eq.${encodeURIComponent(d.id)}`
      + `&select=id&order=created_at.desc&offset=${VERSN}`);
    if (old && old.length) {
      await api(`/rest/v1/deck_versions?id=in.(${old.map(r => r.id).join(',')})`, 'DELETE',
        null, { Prefer: 'return=minimal' });
    }
  } catch (e) {}
}
let vers = { list: null, err: 0, of: null };
async function versPull(id) {
  vers = { list: null, err: 0, of: id };
  paintMenu();
  try {
    vers.list = await api(`/rest/v1/deck_versions?deck_id=eq.${encodeURIComponent(id)}`
      + '&select=id,name,why,cards,created_at&order=created_at.desc') || [];
  } catch (e) { vers.err = 1; }
  if (menu === 'vers') paintMenu();
}
function versRestore(vid) {
  const v = (vers.list || []).find(x => x.id === vid);
  const d = deck(vers.of);
  if (!v || !d) return closeMenu();
  pushUndo('Restauration', [d.id]);
  snapVersion(d, 'avant restauration');
  /* La progression suit la carte, pas son texte : une version garde
     l'identifiant de chaque carte, donc restaurer un libellé — même après
     un remplacement en masse qui a réécrit les deux faces — ne remet pas à
     zéro trois semaines de révision. Le recto sert de repêchage pour les
     versions enregistrées avant que les identifiants ne soient gardés. */
  const byId = new Map(d.cards.map(c => [c.id, c]));
  const byF = new Map(d.cards.map(c => [norm(plain(c.f)), c]));
  d.cards = v.cards.map(([f, b, id]) => {
    const old = (id && byId.get(id)) || byF.get(norm(plain(f)));
    return old ? { ...old, f, b } : { id: id || uid(), f, b };
  });
  saveDeck(d); closeMenu(); render();
  toast(I.redo, plur(d.cards.length, 'page') + ' restaurée' + (d.cards.length > 1 ? 's' : ''), true);
}

/* ══════════ partage : lien, bibliothèque, défis, classement ══════════
   Trois façons de faire circuler un paquet, de la plus légère à la plus
   engageante : un lien qu'on donne à qui on veut, une étagère commune au
   groupe, et un défi où tout le monde répond aux mêmes questions.
   Aucun de ces chemins n'ouvre la table des paquets : ce qui est partagé
   voyage en copie, et decks reste privé à son propriétaire. */

const cf = c => Array.isArray(c) ? c[0] : ((c && c.f) || '');
const cb = c => Array.isArray(c) ? c[1] : ((c && c.b) || '');

/* ---------- lien de consultation ----------
   Le lien porte un jeton, pas les cartes : il tient sur une ligne quel que
   soit le paquet, il montre toujours la version du jour, et le révoquer le
   coupe pour de bon — alors qu'un lien qui contient tout reste valable à
   jamais une fois copié. */
const TOKC = 'abcdefghjkmnpqrstuvwxyz23456789';   // ni i, l, o, 0, 1 : indictables à l'oral
const newTok = () => Array.from(crypto.getRandomValues(new Uint8Array(10)),
                                b => TOKC[b % TOKC.length]).join('');

async function shareLink(d) {
  let tok = (d.meta || {}).tok;
  if (!tok) {
    tok = newTok();
    await api('/rest/v1/shares', 'POST',
      [{ token: tok, deck_id: d.id, user_id: auth.uid, mode: 'ro' }], { Prefer: 'return=minimal' });
    setMeta(d, { tok });
  }
  return location.origin + location.pathname + '#s=' + tok;
}
async function revokeShare(d) {
  const tok = (d.meta || {}).tok; if (!tok) return;
  const m = { ...metaOf(d) }; delete m.tok; d.meta = m; saveDeck(d);
  try { await api('/rest/v1/shares?token=eq.' + encodeURIComponent(tok), 'DELETE', null, { Prefer: 'return=minimal' }); }
  catch (e) {}
}
async function openShared(tok) {
  shared = { tok, st: 'load' };
  view = { name: 'shared' }; animate = true; render(); window.scrollTo(0, 0);
  try {
    const rows = await api('/rest/v1/rpc/shared_deck', 'POST', { tok });
    const r = (rows || [])[0];
    shared = r ? { tok, st: 'ok', d: r } : { tok, st: 'gone' };
  } catch (e) { shared = { tok, st: 'err' }; }
  if (view.name === 'shared') render();
}
function sharedView() {
  const s = shared || {}, d = s.d, cards = d ? (d.cards || []) : [];
  $.innerHTML = `
    <div class="bar"><button class="ic" data-act="home" aria-label="Retour">${svg(I.back)}</button>
      <h1>Livre partagé</h1></div>
    <div class="page">
      ${s.st === 'load' ? `<div class="empty">${svg(I.link)}<p>Ouverture du lien…</p></div>`
      : s.st !== 'ok' ? `<div class="empty">${svg(I.warn)}<p><b>${s.st === 'gone' ? 'Lien révoqué' : 'Lien illisible'}</b>${
          s.st === 'gone' ? 'Ce livre n’est plus prêté.' : 'Réessaie une fois en ligne.'}</p></div>`
      : `<div class="top"><div class="hero">${esc(d.name)}</div></div>
        <button class="cta" data-act="addshared">${svg(I.plus)}Ajouter à ma bibliothèque</button>
        <div class="rows">${cards.slice(0, 300).map(c => `<div class="pr">
          <span class="a">${esc(plain(cf(c)))}</span>${svg(I.arrow)}<span class="b">${esc(plain(cb(c)))}</span>
          </div>`).join('')}</div>`}
    </div>`;
}

/* ---------- bibliothèque commune ----------
   Publier, c'est poser une copie sur l'étagère du groupe : le paquet
   d'origine continue de vivre de son côté, et republier remplace la copie
   par la version du jour. Chacun ne peut retirer que ses propres paquets. */
async function libPull() {
  try {
    lib.list = await api('/rest/v1/library?select=deck_id,user_id,who,name,subject,cards,n,group_id,updated_at'
      + '&order=updated_at.desc&limit=100') || [];
    lib.err = 0;
  } catch (e) { lib.err = 1; }
  if (/^(commu|friends|groups|duels|library|board|group)$/.test(view.name)) { animate = false; render(); }
}
async function libPublish(d) {
  closeMenu();
  const where = scopeName();
  const row = { deck_id: d.id, user_id: auth.uid, who: prefs.name || (me && me.handle) || 'Compte',
                name: d.name, subject: d.subject ? subj(d.subject).name : '',
                n: d.cards.length, cards: d.cards.map(c => [plain(c.f), plain(c.b)]),
                group_id: scope, updated_at: new Date().toISOString() };
  try {
    await api('/rest/v1/library', 'POST', [row], { Prefer: 'resolution=merge-duplicates,return=minimal' });
    setMeta(d, { pub: 1 });
    lib.list = null; libPull();
    toast(I.book, 'Sur l’étagère · ' + where);
  } catch (e) { toast(I.x, 'Publication impossible'); }
}
async function libRemove(d) {
  closeMenu();
  setMeta(d, { pub: 0 });
  lib.list = (lib.list || []).filter(x => x.deck_id !== d.id);
  render();
  try { await api('/rest/v1/library?deck_id=eq.' + encodeURIComponent(d.id), 'DELETE', null, { Prefer: 'return=minimal' }); }
  catch (e) {}
  toast(I.check, 'Retiré de la bibliothèque');
}
function libAdd(it) {
  /* les identifiants de matière sont propres à chaque compte : on
     rattache par le nom quand il existe déjà ici, sinon sans matière */
  const s = db.subjects.find(x => x.name.toLowerCase() === String(it.subject || '').toLowerCase());
  const n = (it.cards || []).length;
  const d = importPayload({ name: it.name, subject: s ? s.id : '', cards: it.cards }, true);
  closeMenu();
  if (d) go('deck', d.id);
  toast(I.check, plur(n, 'page') + ' ajoutée' + (n > 1 ? 's' : ''));
}

/* ---------- défis ----------
   Les questions sont figées à la création : tout le monde répond
   exactement aux mêmes, dans le même ordre. Sinon comparer les scores ne
   voudrait rien dire, et le paquet d'origine peut très bien changer
   ensuite. Un essai par personne, pour la même raison. */
const DUELQ = 10;
async function duelsPull() {
  try {
    const [ds, sc] = await Promise.all([
      api('/rest/v1/duels?select=id,owner,who,name,total,cards,group_id,created_at&order=created_at.desc&limit=40'),
      api('/rest/v1/duel_scores?select=duel_id,user_id,who,score,ms')
    ]);
    duels.list = ds || []; duels.scores = sc || []; duels.err = 0;
  } catch (e) { duels.err = 1; }
  if (/^(commu|friends|groups|duels|library|board|group)$/.test(view.name)) { animate = false; render(); }
}
const myScore = id => (duels.scores || []).find(s => s.duel_id === id && s.user_id === auth.uid);
const rankOf = id => (duels.scores || []).filter(s => s.duel_id === id)
  .sort((a, b) => b.score - a.score || a.ms - b.ms);

async function duelMake(d) {
  const uniq = [];
  for (const c of d.cards) {
    const b = plain(c.b).trim();
    if (b && !uniq.some(x => x[1] === b)) uniq.push([plain(c.f).trim(), b]);
  }
  if (uniq.length < 4) { closeMenu(); return toast(I.x, 'Il faut 4 réponses différentes'); }
  const cards = shuffle(uniq.slice()).slice(0, DUELQ);
  closeMenu();
  try {
    await api('/rest/v1/duels', 'POST',
      [{ deck_id: d.id, owner: auth.uid, who: prefs.name || (me && me.handle) || 'Compte',
         name: d.name, total: cards.length, cards, group_id: scope }], { Prefer: 'return=minimal' });
    duels.list = null; groupTab = 'duel'; go('group'); duelsPull();
    toast(I.flame, 'Défi lancé chez ' + scopeName() + ' — ' + plur(cards.length, 'question'));
  } catch (e) { toast(I.x, 'Défi impossible'); }
}
/* Le même défi, mais pour une classe entière : l'élève scolaire n'a ni
   ami ni club, il n'a que ses camarades. Les questions sont tirées du
   devoir lui-même, pas d'un livre du professeur. */
async function duelClasse(aid, nom) {
  const cid = prof.open; if (!cid) return;
  let cartes = [];
  try {
    const [a] = await api('/rest/v1/assignments?select=cards,name&id=eq.'
      + encodeURIComponent(aid)) || [];
    cartes = ((a && a.cards) || []).map(c => Array.isArray(c)
      ? [String(c[0] || '').trim(), String(c[1] || '').trim()]
      : [String(c.f || '').trim(), String(c.b || '').trim()]);
  } catch (e) { return toast(I.x, 'Impossible pour l’instant'); }
  const uniq = [];
  for (const [f, b] of cartes) if (b && !uniq.some(x => x[1] === b)) uniq.push([f, b]);
  if (uniq.length < 4) { closeMenu(); return toast(I.x, 'Il faut 4 réponses différentes'); }
  const q = shuffle(uniq.slice()).slice(0, DUELQ);
  try {
    await api('/rest/v1/duels', 'POST',
      [{ deck_id: null, owner: auth.uid, who: prefs.name || (me && me.handle) || 'Compte',
         name: nom, total: q.length, cards: q, class_id: cid }], { Prefer: 'return=minimal' });
    closeMenu(); render();
    toast(I.flame, 'Défi lancé · ' + plur(q.length, 'question'));
  } catch (e) { toast(I.x, 'Défi impossible'); }
}

async function duelDrop(id) {
  duels.list = (duels.list || []).filter(x => x.id !== id);
  closeMenu(); render();
  try { await api('/rest/v1/duels?id=eq.' + encodeURIComponent(id), 'DELETE', null, { Prefer: 'return=minimal' }); }
  catch (e) { toast(I.x, 'Suppression impossible'); }
}
function duelOpts() {
  const r = duelRun, c = r.cards[r.i];
  const pool = r.cards.filter((_, k) => k !== r.i).map(x => x[1]).filter(v => v !== c[1]);
  r.opts = shuffle([c[1], ...shuffle(pool).slice(0, 3)]);
  r.pick = null;
}
function duelStart(du) {
  if (myScore(du.id)) return;
  duelRun = { id: du.id, name: du.name, cards: du.cards || [], i: 0, score: 0,
              t0: Date.now(), pick: null, opts: [] };
  if (duelRun.cards.length < 4) { duelRun = null; return toast(I.x, 'Défi incomplet'); }
  duelOpts(); closeMenu();
  view = { name: 'duel' }; animate = true; render();
}
function duelPick(k) {
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
async function duelEnd() {
  const r = duelRun; if (!r) return;
  const row = { duel_id: r.id, user_id: auth.uid, who: prefs.name || (me && me.handle) || 'Compte',
                score: r.score, ms: Date.now() - r.t0 };
  duelRun = null;
  duels.scores = (duels.scores || []).filter(s => !(s.duel_id === row.duel_id && s.user_id === auth.uid));
  duels.scores.push(row);
  duels.open = r.id; groupTab = 'duel';
  go('group'); openMenu('duelitem');
  try {
    await api('/rest/v1/duel_scores', 'POST', [row],
      { Prefer: 'resolution=merge-duplicates,return=minimal' });
  } catch (e) { toast(I.x, 'Score non enregistré'); }
}
function duelView() {
  const r = duelRun;
  if (!r) { view = { name: 'group' }; return groupView(); }
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

/* ---------- classement ----------
   Les révisions de chacun restent privées : la fonction côté serveur ne
   rend qu'un décompte par compte, jamais le détail des cartes ni des
   erreurs. On compare un volume de travail, pas un contenu. */
async function boardPull(bg) {
  try {
    board.rows = await api('/rest/v1/rpc/leaderboard', 'POST', { days: board.range, gid: scope }) || [];
    board.err = 0;
  } catch (e) { board.err = 1; }
  const sig = JSON.stringify(board.rows) + ':' + board.err;
  const same = bg && sig === board.sig;        // rien de neuf : on ne fait pas clignoter l'écran
  board.sig = sig;
  if (same) return;
  if (/^(commu|friends|groups|duels|library|board|group)$/.test(view.name)) { animate = false; render(); }
}

/* ══════════ signaler, bloquer ══════════
   Des mineurs, du contenu écrit librement, et jusqu'ici aucun moyen de
   dire « ça ne va pas » ni de couper le contact. C'était le dernier vrai
   trou du volet protection : le reste du cloisonnement tenait déjà, celui-ci
   n'existait pas du tout.

   Deux gestes distincts, volontairement. Bloquer est immédiat, personnel
   et réversible : je ne veux plus rien recevoir de cette personne, et la
   coupure vaut dans les deux sens — un blocage à sens unique laisserait
   celui qu'on fuit continuer de vous lire. Signaler ne coupe rien mais
   laisse une trace instruite ailleurs, avec une copie du contenu :
   sans elle, il suffirait d'effacer pour rendre la plainte incompréhensible. */
let blocks = null;                 // liste des comptes que j'ai bloqués
const isBlocked = id => !!(blocks || []).some(b => b.blocked_id === id);

async function blocksPull() {
  try { blocks = await api('/rest/v1/blocks?select=blocked_id,who,created_at&order=created_at.desc') || []; }
  catch (e) { blocks = blocks || []; }
}
async function blockUser(id, who) {
  closeMenu();
  try {
    await api('/rest/v1/rpc/block_user', 'POST', { other: id, who: shortWho(who || '') });
    blocks = null; await blocksPull();
    /* Ce que la personne avait posé doit disparaître tout de suite : la
       base ne le rend déjà plus, mais l'écran garde sa dernière copie. */
    lib.list = null; duels.list = null; mailbox.list = null; board.rows = null;
    friends = null; mates = null; asks = null;
    friendsPull(); libPull(); duelsPull(); mailPull(); boardPull();
    toast(I.lock, (who ? shortWho(who) : 'Ce compte') + ' est bloqué');
  } catch (e) { toast(I.x, 'Blocage impossible'); }
  render();
}
async function unblockUser(id) {
  try {
    await api('/rest/v1/blocks?blocked_id=eq.' + encodeURIComponent(id), 'DELETE',
      null, { Prefer: 'return=minimal' });
    blocks = null; await blocksPull();
    lib.list = null; duels.list = null; board.rows = null;
    toast(I.check, 'Compte débloqué');
  } catch (e) { toast(I.x, 'Impossible pour l’instant'); }
  paintMenu(); render();
}

/* Les motifs sont courts et nommés du point de vue de l'élève : « ça me
   harcèle » se trouve plus vite que « atteinte aux personnes ». */
const RAISONS = [
  ['harass', 'Harcèlement, menaces'],
  ['hate', 'Contenu haineux ou illégal'],
  ['sexual', 'Contenu sexuel'],
  ['private', 'Données personnelles de quelqu’un'],
  ['spam', 'Spam ou publicité'],
  ['copy', 'Copié sans autorisation'],
  ['other', 'Autre']
];
let reportOn = null;               // { kind, id, user, label, snapshot }
let reportWhy = '';

function openReport(kind, id, user, label, snapshot) {
  reportOn = { kind, id: String(id || ''), user: user || null, label: label || '', snapshot: snapshot || {} };
  reportWhy = '';
  openMenu('report');
}
async function sendReport() {
  const r = reportOn, note = (document.getElementById('rnote') || {}).value || '';
  if (!r || !reportWhy) return;
  closeMenu();
  try {
    await api('/rest/v1/reports', 'POST', [{
      reporter: auth.uid, kind: r.kind, target_id: r.id, target_user: r.user,
      reason: reportWhy, note: note.slice(0, 500), snapshot: r.snapshot
    }], { Prefer: 'return=minimal' });
    toast(I.check, 'Signalement envoyé');
  } catch (e) { toast(I.x, 'Envoi impossible'); }
  reportOn = null; reportWhy = '';
}

function reportSheet(w) {
  const r = reportOn;
  if (!r) { menu = null; return; }
  w.innerHTML = `<div class="scrim" data-mact="close"></div>
    <div class="menu">
      <div class="mhd">${svg(I.warn)}<span class="mhx"><b>Signaler</b>
        <span class="msub">${esc(r.label || 'Ce contenu')} — le contenu est joint au signalement,
          même s’il est effacé ensuite. Rien n’est envoyé à la personne visée.</span></span></div>
      <div class="rlist">${RAISONS.map(([k, t]) =>
        `<button class="mi${reportWhy === k ? ' on' : ''}" data-why="${k}">
          ${svg(reportWhy === k ? I.check : I.arrow)}${t}</button>`).join('')}</div>
      <input class="tok" id="rnote" placeholder="Précision (facultatif)" maxlength="500">
      <button class="mi" data-mact="rsend" ${reportWhy ? '' : 'disabled'}
        style="justify-content:center;font-weight:700">${svg(I.share)}Envoyer le signalement</button>
      ${r.user ? `<div class="msep"></div>
        <button class="mi warn" data-mact="rblock">${svg(I.lock)}<span>Bloquer aussi ce compte</span></button>` : ''}
    </div>`;
  mountMenu(w);
}

/* La liste des comptes coupés, pour pouvoir revenir en arrière : un
   blocage qu'on ne peut pas défaire est une punition, pas un réglage. */
function blockedSheet(w) {
  const l = blocks || [];
  w.innerHTML = `<div class="scrim" data-mact="close"></div>
    <div class="menu">
      <div class="mhd">${svg(I.lock)}<span class="mhx"><b>Comptes bloqués</b>
        <span class="msub">Ils ne voient plus rien de toi, et toi non plus.</span></span></div>
      ${!l.length ? `<div class="note" style="padding:4px 18px 14px">Aucun compte bloqué.</div>`
        : `<div class="mscroll">${l.map(b => `<button class="mi" data-unblock="${esc(b.blocked_id)}">
             ${svg(I.redo)}<span>${esc(b.who || 'Un compte')}</span>
             <span class="tail">Débloquer</span></button>`).join('')}</div>`}
    </div>`;
  mountMenu(w);
}

/* ══════════ la console de modération ══════════
   Elle n'apparaît que pour les comptes inscrits dans la table des
   modérateurs. Ce qu'elle montre, ce sont les signalements — qui portent
   chacun leur copie du contenu — et rien d'autre : un modérateur n'obtient
   aucun accès aux bibliothèques ni au courrier. C'est précisément à ça que
   sert la copie jointe, et c'est ce qui permet de juger sans ouvrir la vie
   privée de tout le monde à quelqu'un.

   Deux réponses seulement. Masquer, quand le contenu n'a pas sa place ;
   rien à signaler, qui rend visible ce que le compteur avait retiré. Une
   suspension de compte ne se décide pas depuis un téléphone à minuit :
   elle reste un geste manuel, tracé ailleurs. */
let iAmMod = false;
let mods = { list: null, err: 0, seen: 0 };

async function modCheck() {
  try { iAmMod = !!(await api('/rest/v1/rpc/is_mod', 'POST', {})); }
  catch (e) { iAmMod = false; }
}
async function modPull() {
  try {
    mods.list = await api('/rest/v1/reports?select=id,kind,target_id,target_user,reason,note,'
      + 'snapshot,status,created_at&status=eq.open&order=created_at.desc&limit=60') || [];
    mods.err = 0;
  } catch (e) { mods.err = 1; }
  if (view.name === 'mod') { animate = false; render(); }
  if (view.name === 'settings') { animate = false; render(); }
}
async function modAct(id, act) {
  closeMenu();
  try {
    await api('/rest/v1/rpc/mod_act', 'POST', { rid: id, act });
    mods.list = (mods.list || []).filter(r => r.id !== id);
    toast(I.check, act === 'hide' ? 'Contenu masqué' : 'Signalement classé');
  } catch (e) { toast(I.x, 'Action impossible'); }
  render();
}

const RNAME = Object.fromEntries(RAISONS);
const KNAME = { mail: 'Courrier', library: 'Étagère', duel: 'Défi', profile: 'Compte' };

/* La copie jointe s'affiche telle qu'elle a été prise : c'est la pièce du
   dossier, pas un aperçu à rafraîchir. */
function snapHtml(s) {
  if (!s || typeof s !== 'object') return '';
  const line = (k, v) => `<div class="sl"><i>${esc(k)}</i><span>${esc(v)}</span></div>`;
  let out = '';
  for (const [k, v] of Object.entries(s)) {
    if (k === 'cartes') continue;
    if (v) out += line(k, String(v).slice(0, 300));
  }
  const c = s.cartes;
  if (Array.isArray(c) && c.length) {
    out += `<div class="scards">${c.slice(0, 12).map(x => `<div class="pr">
      <span class="a">${esc(cf(x))}</span>${svg(I.arrow)}<span class="b">${esc(cb(x))}</span></div>`).join('')}
      ${c.length > 12 ? `<div class="note">…et ${c.length - 12} autres</div>` : ''}</div>`;
  }
  return out;
}

function modView() {
  const l = mods.list;
  $.innerHTML = `
    <div class="bar"><button class="ic" data-act="settings" aria-label="Retour">${svg(I.back)}</button>
      <h1>Signalements</h1></div>
    <div class="page">
      ${!l ? `<div class="empty">${svg(I.warn)}<p>${mods.err ? 'Liste indisponible' : 'Chargement…'}</p></div>`
      : !l.length ? `<div class="empty">${svg(I.check)}<p><b>Rien à traiter</b>Tous les signalements sont classés.</p></div>`
      : `<div class="note" style="padding:0 0 14px">Un contenu signalé par deux comptes différents est déjà
           masqué automatiquement. Ce qui suit attend une décision.</div>
         ${l.map(r => `<div class="rep">
           <div class="rh"><b>${esc(KNAME[r.kind] || r.kind)}</b>
             <i>${esc(RNAME[r.reason] || r.reason)}</i>
             <span>${timeAgo(r.created_at)}</span></div>
           ${r.note ? `<div class="rn">${svg(I.quote)}<p>${esc(r.note)}</p></div>` : ''}
           <div class="rs">${snapHtml(r.snapshot)}</div>
           <div class="rb">
             <button data-modact="clear" data-rid="${r.id}">${svg(I.check)}Rien à signaler</button>
             <button class="warn" data-modact="hide" data-rid="${r.id}">${svg(I.eyeoff)}Masquer</button>
           </div>
         </div>`).join('')}`}
    </div>`;
}

/* ══════════ la console d'administration ══════════
   Un administrateur gère des accès, il ne lit pas les fiches des élèves.
   Cet écran ne montre donc que ce qu'il faut pour reconnaître quelqu'un et
   décider de son rôle : pseudo, adresse, date d'arrivée, nombre de livres.
   Aucun contenu, aucune progression, aucun courrier.

   Le rôle ne se change pas en écrivant dans une table — elle n'a aucune
   politique d'écriture, exprès. Il passe par une fonction qui vérifie
   elle-même qui appelle, et qui refuse qu'on se retire son propre rôle :
   sans cette garde, le dernier administrateur se verrouille dehors et
   plus personne ne peut rendre la main. */
let accounts = null, accOpen = null;
const ROLES = { eleve: 'Élève', prof: 'Professeur',
                ref: 'Référent d’établissement', admin: 'Éditeur' };

async function accountsPull() {
  try { accounts = await api('/rest/v1/rpc/admin_accounts', 'POST', {}) || []; }
  catch (e) { accounts = []; }
  if (view.name === 'admin') { animate = false; render(); }
}
async function setRole(id, role) {
  closeMenu();
  try {
    await api('/rest/v1/rpc/set_role', 'POST', { cible: id, nouveau: role });
    accounts = null; await accountsPull();
    toast(I.check, ROLES[role] + ' · rôle enregistré');
  } catch (e) {
    const m = String((e && e.message) || '');
    toast(I.x, /propre rôle/.test(m) ? 'On ne retire pas son propre rôle'
      : /autoris/.test(m) ? 'Réservé aux administrateurs' : 'Changement impossible');
  }
  render();
}

/* L'éditeur ne gère pas un établissement : il les vend et les tient. Ce
   qu'il regarde n'est donc ni une classe ni un élève, c'est une ligne par
   établissement — combien de comptes ouverts, combien s'en servent
   vraiment, et ce que l'IA coûte. L'écart entre « ouverts » et « venus »
   est la seule chose qui dise si un déploiement a pris ou non, et c'est ce
   qu'il faut lire en premier.

   Pas de coloration, pas d'animation, deux tableaux : c'est un écran qu'on
   ouvre pour décider, pas pour s'y attarder. */
let adm = { orgs: null, etat: null, tab: 'orgs' };

async function admPull() {
  try {
    const [o, e] = await Promise.all([
      api('/rest/v1/rpc/admin_orgs', 'POST', {}),
      api('/rest/v1/rpc/admin_etat', 'POST', {})
    ]);
    adm.orgs = o || []; adm.etat = (e || [])[0] || null;
  } catch (x) { adm.orgs = adm.orgs || []; }
  if (view.name === 'admin') { animate = false; render(); }
}
const euros = c => (Math.round(+c || 0) / 100).toFixed(2).replace('.', ',') + ' €';

function adminView() {
  const l = accounts, o = adm.orgs, e = adm.etat;
  const par = r => (l || []).filter(x => x.role === r);
  const onglet = (k, n) => `<button class="otab ${adm.tab === k ? 'on' : ''}" data-atab="${k}">${n}</button>`;
  const kc = (v, lab, cls) => `<div class="kc ${cls || ''}"><b>${v}</b><span>${lab}</span></div>`;

  const ligneOrg = x => {
    const ouverts = (x.eleves || 0) + (x.profs || 0) + (x.refs || 0);
    const venus = Math.max(0, ouverts - (x.jamais_venus || 0));
    const pris = ouverts ? Math.round(venus / ouverts * 100) : 0;
    return `<div class="rrow">
      <span class="c1"><b>${esc(x.name)}</b><i>${esc(x.ville || '')}${
        x.uai ? ' · ' + esc(x.uai) : ''}</i></span>
      <span class="c2">${x.classes} classes · ${x.eleves} él. · ${x.profs} prof.</span>
      <span class="c3">${venus} / ${ouverts} <em class="rl ${
        pris < 25 ? 'jamais' : pris < 60 ? 'vide' : ''}">${pris} % venus</em></span>
      <span class="c4">${x.actifs7} actifs 7 j · ${x.actifs30} sur 30 j</span>
      <span class="c5">${euros(x.cents_mois)} ce mois${
        +x.cents_total > +x.cents_mois ? ' · ' + euros(x.cents_total) + ' au total' : ''}</span>
    </div>`;
  };
  const ligneCpt = a => `<button class="rrow" data-account="${esc(a.id)}">
    <span class="c1"><b>${esc(a.name || a.handle || a.email)}</b><i>@${esc(a.handle || '')}</i></span>
    <span class="c2">${esc(a.email)}</span>
    <span class="c3"><em class="rl ${esc(a.role)}">${esc(ROLES[a.role] || a.role)}</em></span>
    <span class="c4">${plur(+a.livres, 'livre')}</span>
    <span class="c5">${a.bloque ? 'modère les signalements' : ''}</span></button>`;

  $.innerHTML = `
    <div class="bar"><button class="ic" data-act="settings" aria-label="Retour">${svg(I.back)}</button>
      <h1>Administration</h1></div>
    <div class="page dense">
      ${!l ? `<div class="empty">${svg(I.build)}<p>Chargement…</p></div>`
      : !l.length ? `<div class="empty">${svg(I.lock)}<p><b>Réservé à l’éditeur</b>
          Ce compte n’a pas ce rôle.</p></div>`
      : `${e ? `<div class="kpi six">
           ${kc(e.orgs, 'établissements')}${kc(e.comptes, 'comptes')}
           ${kc(e.hors_etab, 'hors établissement')}${kc(e.actifs7, 'actifs cette semaine')}
           ${kc(euros(e.cents_mois), 'd’IA ce mois')}
           ${kc(e.signalements, 'signalements', e.signalements ? 'ko' : '')}
         </div>` : ''}
         <div class="rtabs">${onglet('orgs', 'Établissements')}${onglet('cpt', 'Comptes')}</div>
         ${adm.tab === 'orgs' ? `
           <div class="note" style="padding:0 0 12px">L’écart entre comptes ouverts et comptes
             venus dit si le déploiement a pris. En dessous de 25 %, l’établissement n’a pas
             distribué le lien — c’est un problème de terrain, pas de produit.</div>
           ${!o ? `<div class="card2"><div class="note">Chargement…</div></div>`
             : !o.length ? `<div class="empty">${svg(I.build)}<p><b>Aucun établissement</b></p></div>`
             : `<div class="rtable">
                 <div class="rrow tete"><span class="c1">Établissement</span>
                   <span class="c2">Effectifs</span><span class="c3">Comptes venus</span>
                   <span class="c4">Usage réel</span><span class="c5">Coût IA</span></div>
                 ${o.map(ligneOrg).join('')}</div>`}
           <div class="note" style="padding:6px 0 0">⚠ Le plafond d’IA est encore global à tous
             les comptes (AI_BUDGET_USD), et non par établissement : un seul lycée actif l’épuise
             et la fonctionnalité s’éteint pour tout le monde. À remplacer avant la première vente.</div>`
         : `<div class="note" style="padding:0 0 12px">L’éditeur gère des accès. Il ne voit ni les
             fiches, ni la progression, ni le courrier de personne.</div>
           ${['admin', 'ref', 'prof', 'eleve'].map(r => par(r).length ? `
             <div class="lbl"><span>${esc(ROLES[r] || r)}${par(r).length > 1 ? 's' : ''}</span>
               <span>${par(r).length}</span></div>
             <div class="rtable">${par(r).map(ligneCpt).join('')}</div>` : '').join('')}`}`}
    </div>`;
}

function accountSheet(w) {
  const a = (accounts || []).find(x => x.id === accOpen);
  if (!a) { menu = null; return; }
  const moi = a.id === auth.uid;
  w.innerHTML = `<div class="scrim" data-mact="close"></div>
    <div class="menu">
      <div class="mhd"><i class="av">${esc(initial(a.handle || a.name || a.email))}</i>
        <span class="mhx"><b>${esc(a.name || a.handle || a.email)}</b>
          <i>${esc(a.email)}${a.handle ? ' · @' + esc(a.handle) : ''}</i></span></div>
      <div class="msep"></div>
      ${Object.entries(ROLES).map(([k, n]) => `
        <button class="mi${a.role === k ? ' on' : ''}" data-setrole="${k}" data-who="${esc(a.id)}"
          ${moi && k !== 'admin' ? 'disabled' : ''}>
          ${svg(a.role === k ? I.check : I.arrow)}${n}
          ${k === 'admin' ? '<span class="tail">instruit les signalements</span>' : ''}</button>`).join('')}
      ${moi ? `<div class="note" style="padding:6px 18px 12px">C’est ton compte : tu ne peux pas
        te retirer ton propre rôle, sinon plus personne ne pourrait rendre la main.</div>` : ''}
    </div>`;
  mountMenu(w);
}

/* ══════════ rôles, classes, devoirs ══════════
   Trois métiers dans la même app, et trois écrans différents. L'élève
   reçoit et travaille ; le professeur distribue et suit ; l'administrateur
   instruit les signalements. Personne ne voit les outils des autres — non
   par discrétion, mais parce qu'une interface qui montre ce qu'on ne peut
   pas faire n'apprend rien à personne.

   Le rôle vient de la base, jamais du client : une valeur gardée ici ne
   ferait qu'afficher des boutons, et la base refuserait de toute façon.
   C'est bien elle qui décide. */
let myRole = 'eleve';
let classes = null;                 // mes classes (tenues ou rejointes)
let classOf = null;                 // celle qu'on regarde

/* ══════════ scolaire ou personnel ══════════
   Folio sert deux publics dans la même app : quelqu'un qui révise pour lui,
   et un élève inscrit par son établissement. Le second n'est pas le premier
   avec moins de boutons — c'est un autre produit. Il n'a ni club, ni
   annuaire ouvert, ni pseudo à choisir : son identité, sa classe et ses
   matières lui sont données, et il ne peut ni les changer ni en sortir.

   `school` répond à la seule question qui commande tout le reste : ce
   compte appartient-il à un établissement ? `null` tant qu'on ne sait pas,
   `false` quand on sait que non — la nuance compte, sinon l'écran s'affiche
   en version personnelle une fraction de seconde avant de se corriger. */
let school = null;                  // { org, classe, niveau, … } | false
let team = null;                    // les professeurs de sa classe
const atSchool = () => !!(school && school.org_id);
const isPupil = () => atSchool() && myRole === 'eleve';

async function schoolPull() {
  try {
    const [r] = await api('/rest/v1/rpc/my_school', 'POST', {}) || [];
    school = r || false;
  } catch (e) { school = false; }
}
async function teamPull() {
  try { team = await api('/rest/v1/rpc/my_class_team', 'POST', {}) || []; }
  catch (e) { team = []; }
  if (view.name === 'classe' || view.name === 'classes') { animate = false; render(); }
}
let roster = null;                  // la liste d'une classe, côté professeur
let workOpen = null, memberOpen = null;
let asgs = null;                    // les devoirs de la classe regardée
const isProf = () => myRole === 'prof' || myRole === 'admin';
const isAdmin = () => myRole === 'admin';

/* Le rôle, les coupures, les classes et les signalements arrivent
   ensemble, et l'écran ne se repeint qu'une fois tout su. Lancés
   séparément, chacun repeignait de son côté : les Réglages pouvaient
   s'afficher avant qu'on sache si le compte est administrateur, et
   l'entrée manquait alors sans aucune raison visible. C'est exactement ce
   qui faisait dire que le compte admin n'avait rien d'admin. */
/* Chaque métier a son point d'arrivée. Un professeur qui ouvre l'app veut
   savoir où en sont ses classes, pas relire sa bibliothèque ; un élève veut
   ses devoirs. On ne le sait qu'après le rôle, donc on attend : rediriger
   après coup ferait clignoter un écran qu'on n'a pas demandé. */
async function accueil() {
  await Promise.all([rolePull(), schoolPull()]);
  if (view.name !== 'home') return;              // l'utilisateur est déjà parti ailleurs
  if (myRole === 'ref' && atSchool()) { refPull(); return go('ref'); }
  if (isProf() && atSchool()) { if (!prof.classes) profPull(); return go('prof'); }
  if (isPupil()) { maClassePull(); return go('maclasse'); }
}

async function cerclePull() {
  await Promise.all([rolePull(), schoolPull(), modCheck(), blocksPull()]);
  await Promise.all([classesPull(), iAmMod ? modPull() : null]);
  animate = false; render();
}
async function rolePull() {
  try { myRole = (await api('/rest/v1/rpc/my_role', 'POST', {})) || 'eleve'; }
  catch (e) { myRole = 'eleve'; }
}
async function classesPull() {
  try {
    /* Deux origines pour une même liste : celles qu'on tient et celles
       qu'on a rejointes. Les règles de lecture rendent déjà les deux. */
    classes = await api('/rest/v1/classes?select=id,name,level,year,code,owner&order=created_at.desc') || [];
  } catch (e) { classes = classes || []; }
  if (/^(classes|classe)$/.test(view.name)) { animate = false; render(); }
}
async function classPull(id) {
  try {
    const [m, a] = await Promise.all([
      api(`/rest/v1/class_members?select=user_id,who,joined_at&class_id=eq.${id}&order=who.asc`),
      api(`/rest/v1/assignments?select=id,name,n,due,created_at&class_id=eq.${id}&order=created_at.desc`)
    ]);
    roster = m || []; asgs = a || [];
  } catch (e) { roster = roster || []; asgs = asgs || []; }
  if (view.name === 'classe') { animate = false; render(); }
}
const classCode = () => Array.from(crypto.getRandomValues(new Uint8Array(6)),
  b => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[b % 31]).join('');

async function makeClass(name, level) {
  try {
    const [c] = await api('/rest/v1/classes', 'POST',
      [{ name: (name || '').trim() || 'Ma classe', level: (level || '').trim(),
         year: scolaire(), code: classCode(), owner: auth.uid }],
      { Prefer: 'return=representation' }) || [];
    closeMenu(); classes = null; await classesPull();
    if (c) { classOf = c.id; roster = null; asgs = null; classPull(c.id); go('classe'); }
    toast(I.check, 'Classe créée · code ' + (c ? c.code : ''));
  } catch (e) { toast(I.x, 'Création impossible'); }
}
/* L'année scolaire bascule en août, pas en janvier. */
function scolaire() {
  const d = new Date(), y = d.getFullYear();
  return d.getMonth() >= 7 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}
async function joinClass(code) {
  try {
    await api('/rest/v1/rpc/join_class', 'POST',
      { join_code: code, who: prefs.name || (me && me.handle) || 'Compte' });
    closeMenu(); classes = null; await classesPull();
    toast(I.check, 'Classe rejointe');
  } catch (e) { toast(I.x, 'Code inconnu'); }
}
async function dropMember(cid, uid2) {
  try {
    await api(`/rest/v1/class_members?class_id=eq.${cid}&user_id=eq.${uid2}`, 'DELETE',
      null, { Prefer: 'return=minimal' });
    roster = (roster || []).filter(m => m.user_id !== uid2);
  } catch (e) { toast(I.x, 'Impossible pour l’instant'); }
  closeMenu(); render();
}
/* Donner un devoir, c'est envoyer une copie du livre : la bibliothèque du
   professeur reste la sienne, et l'élève repart de zéro sur ces cartes —
   la progression de quelqu'un d'autre ne veut rien dire chez lui. */
async function giveWork(d, cid, days) {
  const cards = d.cards.map(c => [plain(c.f), plain(c.b)]);
  const due = new Date(Date.now() + (days || 7) * DAY).toISOString().slice(0, 10);
  try {
    await api('/rest/v1/assignments', 'POST',
      [{ class_id: cid, name: d.name, cards, n: cards.length, due, created_by: auth.uid }],
      { Prefer: 'return=minimal' });
    closeMenu(); asgs = null; classPull(cid);
    toast(I.check, plur(cards.length, 'page') + ' à rendre avant le ' + due.split('-').reverse().slice(0, 2).join('/'));
  } catch (e) { toast(I.x, 'Envoi impossible'); }
}
/* L'élève ajoute le devoir à sa bibliothèque et son avancement remonte —
   fait ou pas fait, et le pourcentage. Jamais le détail carte par carte. */
/* Les cartes d'un devoir gardent un identifiant qui dit d'où elles
   viennent : « a:<devoir>:<rang> ». Sans lui, les révisions de l'élève
   remontent sous un identifiant tiré au hasard chez lui, et plus rien ne
   permet de dire à son professeur quelle carte sa classe rate. Avec lui,
   `prof_cartes` recoud les deux — et ne rend jamais que des comptes,
   jamais qui s'est trompé. */
async function takeWork(a) {
  const cartes = (a.cards || []).map((c, i) => {
    const [f, b] = Array.isArray(c) ? c : [c.f, c.b];
    return { id: `a:${a.id}:${i}`, f, b };
  });
  const d = importPayload({ name: a.name, subject: '', cards: cartes }, true);
  try {
    await api('/rest/v1/assignment_progress', 'POST',
      [{ assignment_id: a.id, user_id: auth.uid, who: prefs.name || (me && me.handle) || 'Compte', pct: 0 }],
      { Prefer: 'resolution=merge-duplicates,return=minimal' });
  } catch (e) {}
  closeMenu();
  if (d) go('deck', d.id);
  toast(I.check, 'Devoir ajouté à ta bibliothèque');
}

/* Ce que le professeur a le droit de voir : combien ont rendu, et le taux
   de réussite moyen. Pas le détail carte par carte, pas les horaires — la
   différence entre suivre une classe et surveiller quelqu'un. */
async function workProgress(id) {
  const box = document.getElementById('wprog'); if (!box) return;
  try {
    const rows = await api('/rest/v1/assignment_progress?select=user_id,who,pct,done_at'
      + '&assignment_id=eq.' + encodeURIComponent(id)) || [];
    const total = (roster || []).length;
    const faits = rows.filter(r => r.done_at || r.pct > 0);
    const moy = faits.length
      ? Math.round(faits.reduce((a, r) => a + (r.pct || 0), 0) / faits.length) : 0;
    box.innerHTML = !total ? 'Aucun élève inscrit pour l’instant.'
      : `<b>${faits.length} / ${total}</b> ${faits.length > 1 ? 'ont commencé' : 'a commencé'}`
        + (faits.length ? ` · ${moy} % de réussite moyenne` : '')
        + (total - faits.length ? `<br>${plur(total - faits.length, 'élève')} n’${
            total - faits.length > 1 ? 'ont' : 'a'} pas encore ouvert.` : '');
  } catch (e) { box.textContent = 'Suivi indisponible.'; }
}

const dueLabel = s => {
  if (!s) return '';
  const j = joursDici(s);
  return j < 0 ? (j === -1 ? 'hier' : `il y a ${-j} jours`)
       : j === 0 ? 'aujourd’hui' : j === 1 ? 'demain' : `dans ${j} jours`;
};

/* ══════════ « Ma classe », côté élève ══════════
   Un seul écran, et rien qui ressemble à de la gestion. Ce qu'il y a à
   faire d'abord — un devoir se rend, il ne se cherche pas —, puis qui lui
   fait cours, puis les camarades qu'il peut ajouter. Aucun code à saisir,
   aucune classe à quitter, aucun bouton qui échouerait s'il le pressait :
   la base refuse déjà tout cela, l'écran n'a pas à le proposer. */
let mates2 = null;                  // ses camarades de classe

async function matesPull() {
  try { mates2 = await api('/rest/v1/rpc/my_classmates', 'POST', {}) || []; }
  catch (e) { mates2 = []; }
  if (view.name === 'classe') { animate = false; render(); }
}
function maClassePull() {
  if (school === null) schoolPull().then(() => { maClassePull(); animate = false; render(); });
  if (school && school.class_id && !asgs) classPull(school.class_id);
  if (!team) teamPull();
  if (!mates2) matesPull();
}

function maClasseView() {
  if (!school || !school.class_id) {
    $.innerHTML = `
      <div class="bar"><button class="ic" data-act="commu" aria-label="Retour">${svg(I.back)}</button>
        <h1>Ma classe</h1></div>
      <div class="page"><div class="empty">${svg(I.school)}<p><b>Aucune classe</b>
        ${school === null ? 'Chargement…'
          : 'Ton établissement ne t’a pas encore inscrit dans une classe. Préviens ton professeur principal.'}</p></div></div>`;
    return;
  }
  const c = school;
  const l = asgs || [];
  /* Les devoirs en retard d'abord : c'est la seule chose qui presse. */
  const retard = l.filter(a => a.due && Date.parse(a.due + 'T12:00:00') < Date.now());
  const avenir = l.filter(a => !retard.includes(a));
  const ligne = a => `<button class="sr flat${a.due && Date.parse(a.due + 'T12:00:00') < Date.now() ? ' tard' : ''}"
      data-work="${esc(a.id)}">${svg(I.card)}
    <span class="ml2"><span class="n">${esc(a.name)}</span>
      <span class="sub">${plur(a.n, 'page')}${a.due ? ' · ' + dueLabel(a.due) : ''}</span></span>
    ${svg(I.arrow)}</button>`;
  const cam = mates2 || [];
  $.innerHTML = `
    <div class="bar"><button class="ic" data-act="commu" aria-label="Retour">${svg(I.back)}</button>
      <h1>${esc(c.classe)}</h1></div>
    <div class="page">
      <div class="ecole">${svg(I.school)}<span><b>${esc(c.org)}</b>
        <i>${esc(c.niveau || '')}${c.filiere ? ' · ' + esc(c.filiere) : ''}${
          c.effectif ? ' · ' + plur(c.effectif, 'élève') : ''}</i></span></div>

      <div class="lbl"><span>Devoirs</span><span>${l.length || ''}</span></div>
      ${!asgs ? `<div class="card2"><div class="note">Chargement…</div></div>`
        : !l.length ? `<div class="empty">${svg(I.card)}<p><b>Rien à faire</b>
            Tes professeurs n’ont pas encore donné de devoir.</p></div>`
        : `${retard.length ? `<div class="slist">${retard.map(ligne).join('')}</div>` : ''}
           ${avenir.length ? `<div class="slist">${avenir.map(ligne).join('')}</div>` : ''}`}

      <div class="lbl"><span>Mes professeurs</span><span>${team ? team.length : ''}</span></div>
      ${!team ? `<div class="card2"><div class="note">Chargement…</div></div>`
        : !team.length ? `<div class="card2"><div class="note">Aucun cours renseigné.</div></div>`
        : `<div class="profs">${team.map(t => `<div class="pf">
            <i class="av sm">${esc(initial(t.teacher))}</i>
            <span class="ml2"><span class="n">${esc(t.subject)}</span>
              <span class="sub">${esc(t.teacher)}${t.principal ? ' · professeur principal' : ''}</span></span>
            </div>`).join('')}</div>`}

      <div class="lbl"><span>Ma classe</span><span>${cam.length || ''}</span></div>
      ${!mates2 ? `<div class="card2"><div class="note">Chargement…</div></div>`
        : !cam.length ? `<div class="card2"><div class="note">Tu es seul inscrit pour l’instant.</div></div>`
        : `<div class="slist">${cam.map(m => `<div class="sr flat">
            <i class="av sm">${esc(initial(m.name))}</i>
            <span class="ml2"><span class="n">${esc(m.name)}</span>
              <span class="sub">@${esc(m.handle || '')}</span></span>
            ${m.lien === 'ok' ? `<button class="camo" data-mate="${esc(m.id)}">${svg(I.arrow)}</button>`
              : m.lien ? `<span class="camw">demandé</span>`
              : `<button class="camadd" data-camadd="${esc(m.id)}" data-camn="${esc(m.handle || '')}"
                   aria-label="Ajouter ${esc(m.name)}">${svg(I.plus)}</button>`}
            </div>`).join('')}</div>`}
    </div>`;
}

/* ══════════ la console du référent d'établissement ══════════
   Le référent n'est pas un professeur avec plus de classes. C'est la
   personne qui, dans le lycée, ouvre les comptes, refait les mots de passe
   oubliés et déplace un élève de la 2nde 3 à la 2nde 1 en octobre. Il
   travaille sur un ordinateur, il connaît son métier, et ce qu'il veut
   c'est voir et corriger vite — pas être accompagné.

   Cet écran est donc écrit comme un outil de gestion, pas comme une app :
   des tableaux denses, des colonnes alignées, la recherche toujours au même
   endroit, aucune animation. On y tient six cents lignes à l'écran et on en
   change une en trois clics. Rien n'y est joli, et ce n'est pas un oubli :
   ce qu'on lui demande, c'est que ça marche.

   Trois onglets, parce qu'il n'y a que trois questions : l'établissement
   (où en est-on ?), les comptes (qui, et comment le corriger ?), les
   classes (qui est où, et qui y enseigne ?). */
let ref = { tab: 'etab', board: null, err: 0,
            gens: null, total: 0, page: 0, q: '', role: '', cls: null, cherche: 0,
            classes: null, open: null, team: null,
            who: null, service: null, form: null, trace: null };
const PAGE_REF = 60;
const ROLENOM = { eleve: 'Élève', prof: 'Professeur', ref: 'Référent', admin: 'Éditeur' };

async function refBoard() {
  try { const [r] = await api('/rest/v1/rpc/ref_dashboard', 'POST', {}) || []; ref.board = r || false; }
  catch (e) { ref.board = false; ref.err = 1; }
  if (view.name === 'ref') { animate = false; render(); }
}
async function refClasses() {
  try { ref.classes = await api('/rest/v1/rpc/ref_classes', 'POST', {}) || []; }
  catch (e) { ref.classes = []; }
  if (view.name === 'ref') { animate = false; render(); }
}
/* La recherche repart toujours de la première page : garder la page 4 en
   changeant le filtre donne un écran vide qu'on ne sait pas expliquer. */
async function refPeople(reset) {
  if (reset) ref.page = 0;
  const n = ++ref.cherche;
  try {
    const rows = await api('/rest/v1/rpc/ref_people', 'POST',
      { q: ref.q.trim(), qrole: ref.role, qclass: ref.cls,
        lim: PAGE_REF, off: ref.page * PAGE_REF }) || [];
    if (n !== ref.cherche) return;                 // une frappe plus récente a gagné
    ref.gens = rows; ref.total = rows.length ? +rows[0].total : 0;
  } catch (e) { if (n === ref.cherche) { ref.gens = []; ref.total = 0; } }
  if (view.name === 'ref') { animate = false; render(); }
}
async function refTeam(cid) {
  try { ref.team = await api('/rest/v1/rpc/ref_class_team', 'POST', { cid }) || []; }
  catch (e) { ref.team = []; }
  if (menu) paintMenu();
}
async function refService(uid) {
  try { ref.service = await api('/rest/v1/rpc/ref_service', 'POST', { uid }) || []; }
  catch (e) { ref.service = []; }
  if (menu) paintMenu();
}
/* Le journal, affiché après coup : il n'a jamais à retarder l'écran, et
   son absence n'empêche rien. On le lit directement — la table est déjà
   fermée par sa politique, et personne ne peut y écrire depuis l'app. */
async function refTrace() {
  const box = document.getElementById('rtrace'); if (!box) return;
  try {
    const rows = await api('/rest/v1/ref_audit?select=acte,cible,created_at,detail'
      + '&order=created_at.desc&limit=12') || [];
    box.innerHTML = !rows.length
      ? 'Aucune modification pour l’instant. Tout ce que tu changeras ici sera inscrit.'
      : `<div class="rjour">${rows.map(r => `<div class="rj">
          <b>${esc(r.acte)}</b>
          <i>${esc(quoiTrace(r.detail))}</i>
          <span>${timeAgo(r.created_at)}</span></div>`).join('')}</div>`;
  } catch (e) { box.textContent = 'Journal indisponible.'; }
}
/* Le détail est du JSON, et le référent n'a pas à lire du JSON. */
function quoiTrace(d) {
  if (!d || typeof d !== 'object') return '';
  if (d.avant && d.apres && typeof d.avant === 'object')
    return `${d.avant.nom || ''} → ${d.apres.nom || d.avant.nom || ''}`;
  if (d.avant || d.apres) return `${d.avant || '—'} → ${d.apres || '—'}`;
  return [d.nom, d.classe, d.matiere, d.adresse, d.role && ROLENOM[d.role]]
    .filter(Boolean).join(' · ');
}

function refPull() {
  if (!ref.board) refBoard();
  if (!ref.classes) refClasses();
  if (!ref.gens) refPeople(true);
}
/* Une seule fonction pour tous les appels d'écriture : chacun renvoie le
   message de la base, qui est déjà écrit pour être lu — « Cette classe
   compte encore 28 élèves. Déplace-les d'abord. » vaut mieux que tout ce
   que le client pourrait inventer. */
async function refDo(rpc, args, bon) {
  try {
    const r = await api('/rest/v1/rpc/' + rpc, 'POST', args);
    ref.board = null; ref.classes = null;
    refBoard(); refClasses(); refPeople(false);
    if (ref.open) refTeam(ref.open);
    if (ref.who) refService(ref.who.id);
    toast(I.check, bon);
    return r;
  } catch (e) {
    const m = String((e && e.message) || '');
    toast(I.x, m.slice(0, 90) || 'Impossible pour l’instant');
    return null;
  }
}

/* Un bouton de la feuille la repeint, et repeindre efface ce qui est tapé.
   On relit donc les champs avant chaque repeinture : sans cela, choisir le
   rôle en dernier effaçait l'adresse, et choisir l'adresse en dernier
   effaçait le rôle — l'un ou l'autre, jamais les deux. */
const lireChamps = map => {
  const o = {};
  for (const [k, id] of Object.entries(map)) {
    const n = document.getElementById(id);
    if (n) o[k] = n.value;            // absent = on garde ce qu'on avait
  }
  return o;
};
const lireNew = () => lireChamps({ mel: 'nmel', nom: 'nnom', pse: 'npse', pw: 'npw' });
const lireClass = () => lireChamps({ nom: 'knom', niv: 'kniv', fil: 'kfil', pre: 'kpre' });

function refView() {
  const b = ref.board;
  const onglet = (k, n) => `<button class="otab ${ref.tab === k ? 'on' : ''}" data-rtab="${k}">${n}</button>`;
  $.innerHTML = `
    <div class="bar"><button class="ic" data-act="home" aria-label="Retour">${svg(I.back)}</button>
      <h1>${b ? esc(b.org) : 'Mon établissement'}</h1></div>
    <div class="page dense">
      <div class="rtabs">${onglet('etab', 'Établissement')}${onglet('gens', 'Comptes')}${onglet('cls', 'Classes')}</div>
      ${ref.tab === 'etab' ? refEtab() : ref.tab === 'gens' ? refGens() : refCls()}
    </div>`;
  if (ref.tab === 'etab') refTrace();
  const q = document.getElementById('rq');
  if (q) {
    q.addEventListener('input', () => { ref.q = q.value; clearTimeout(refView.t);
      refView.t = setTimeout(() => refPeople(true), 220); });
    if (ref.tab === 'gens' && document.activeElement !== q && ref.q) {
      q.focus(); q.setSelectionRange(q.value.length, q.value.length);
    }
  }
}

/* ---------- onglet « Établissement » ---------- */
function refEtab() {
  const b = ref.board;
  if (b === null) return `<div class="empty">${svg(I.build)}<p>Chargement…</p></div>`;
  if (!b) return `<div class="empty">${svg(I.lock)}<p><b>Réservé au référent</b>
    </p></div>`;
  const kc = (n, lab, cls) => `<div class="kc ${cls || ''}"><b>${n}</b><span>${lab}</span></div>`;
  /* Les trois chiffres du bas sont les seuls qui appellent une action. On
     les met à part, et on dit quoi faire — pas seulement combien. */
  const souci = (n, lab, quoi) => !n ? '' : `<div class="rsou">
    <b>${n}</b><span>${lab}</span><i>${quoi}</i></div>`;
  return `
    <div class="rhead">
      <div><b>${esc(b.org)}</b>
        <i>${esc(b.ville || '')}${b.uai ? ' · UAI ' + esc(b.uai) : ''}${
          b.kind ? ' · ' + esc(b.kind) : ''}</i></div>
    </div>
    <div class="kpi six">
      ${kc(b.classes, 'classes')}${kc(b.eleves, 'élèves')}${kc(b.profs, 'professeurs')}
      ${kc(b.services, 'services')}${kc(b.devoirs, 'devoirs donnés')}
      ${kc(b.actifs7, 'ont révisé cette semaine', b.actifs7 ? '' : 'am')}
    </div>
    <div class="lbl"><span>Ce qui demande une décision</span></div>
    ${!b.jamais_venus && !b.sans_classe && !b.classes_vides && !b.sans_pp
      ? `<div class="card2"><div class="note">Rien à reprendre : tous les comptes sont
          rattachés, toutes les classes ont des élèves et un professeur principal.</div></div>`
      : `<div class="rsous">
          ${souci(b.jamais_venus, 'comptes jamais utilisés',
            'Ouverts, mais personne ne s’est connecté. C’est là que le déploiement se joue.')}
          ${souci(b.sans_classe, 'élèves sans classe',
            'Ils ne recevront aucun devoir tant qu’ils ne sont pas rattachés.')}
          ${souci(b.classes_vides, 'classes vides',
            'Créées mais sans aucun élève inscrit.')}
          ${souci(b.sans_pp, 'classes sans professeur principal',
            'Personne n’y est désigné référent pédagogique.')}
        </div>`}
    <div class="lbl"><span>Ouvrir un compte</span></div>
    <div class="duo ghost gros">
      <button data-act="refnew">${svg(I.plus)}Nouveau compte</button>
      <button data-act="refnewclass">${svg(I.plus)}Nouvelle classe</button>
    </div>
    <div class="lbl"><span>Dernières modifications</span></div>
    <div id="rtrace" class="note">Chargement du journal…</div>`;
}

/* ---------- onglet « Comptes » ---------- */
function refGens() {
  const l = ref.gens;
  const pages = Math.ceil(ref.total / PAGE_REF) || 1;
  const filtre = (k, n) => `<button class="p ${ref.role === k ? 'on' : ''}" data-rrole="${k}">${n}</button>`;
  const ligne = g => `<button class="rrow" data-rwho="${esc(g.id)}">
    <span class="c1"><b>${esc(g.name)}</b><i>@${esc(g.handle || '')}</i></span>
    <span class="c2">${esc(g.email)}</span>
    <span class="c3"><em class="rl ${esc(g.role)}">${esc(ROLENOM[g.role] || g.role)}</em></span>
    <span class="c4">${g.classe ? esc(g.classe) : g.matiere ? esc(g.matiere)
      : `<em class="rl vide">sans classe</em>`}</span>
    <span class="c5">${g.jamais ? '<em class="rl jamais">jamais venu</em>'
      : timeAgo(g.derniere)}</span></button>`;
  return `
    <div class="rbar">
      <div class="fld addf"><input id="rq" type="search" placeholder="Nom, pseudo ou adresse"
        autocomplete="off" spellcheck="false" value="${esc(ref.q)}" aria-label="Chercher un compte"></div>
      <div class="pills">${filtre('', 'Tous')}${filtre('eleve', 'Élèves')}${filtre('prof', 'Professeurs')}${
        filtre('ref', 'Référents')}</div>
    </div>
    <div class="rcount">${ref.total ? `<b>${ref.total}</b> compte${ref.total > 1 ? 's' : ''}${
        ref.cls ? ' dans cette classe' : ''}${ref.q ? ' pour « ' + esc(ref.q.trim()) + ' »' : ''}`
      : l ? 'Aucun résultat' : 'Recherche…'}
      ${ref.cls ? `<button class="lnk" data-rclsoff="1">retirer le filtre de classe</button>` : ''}</div>
    ${!l ? `<div class="empty">${svg(I.users)}<p>Chargement…</p></div>`
      : !l.length ? `<div class="empty">${svg(I.search)}<p><b>Aucun résultat</b></p></div>`
      : `<div class="rtable">
          <div class="rrow tete"><span class="c1">Nom</span><span class="c2">Adresse</span>
            <span class="c3">Rôle</span><span class="c4">Classe ou matière</span>
            <span class="c5">Dernière venue</span></div>
          ${l.map(ligne).join('')}
        </div>
        ${pages > 1 ? `<div class="rpage">
          <button ${ref.page ? '' : 'disabled'} data-rpage="${ref.page - 1}">Précédent</button>
          <span>page ${ref.page + 1} sur ${pages}</span>
          <button ${ref.page + 1 < pages ? '' : 'disabled'} data-rpage="${ref.page + 1}">Suivant</button>
        </div>` : ''}`}`;
}

/* ---------- onglet « Classes » ---------- */
function refCls() {
  const l = ref.classes;
  const ligne = c => {
    const plein = c.prevu ? Math.round(c.effectif / c.prevu * 100) : 0;
    return `<button class="rrow" data-rcls="${esc(c.id)}">
      <span class="c1"><b>${esc(c.name)}</b><i>${esc(c.niveau || '')}${
        c.filiere ? ' · ' + esc(c.filiere) : ''}</i></span>
      <span class="c2">${c.effectif}${c.prevu ? ' / ' + c.prevu : ''}${
        plein > 105 ? ' <em class="rl jamais">surchargée</em>' : ''}</span>
      <span class="c3">${c.pp ? esc(c.pp) : '<em class="rl vide">pas de PP</em>'}</span>
      <span class="c4">${plur(c.profs, 'professeur')}</span>
      <span class="c5">${c.actifs7} actif${c.actifs7 > 1 ? 's' : ''} · code ${esc(c.code || '—')}</span>
    </button>`;
  };
  const groupes = [];
  for (const c of l || []) {
    const k = c.cycle || 'autre';
    const g = groupes.find(x => x.k === k);
    (g || (groupes.push({ k, l: [] }), groupes[groupes.length - 1])).l.push(c);
  }
  return `
    <div class="duo ghost"><button data-act="refnewclass">${svg(I.plus)}Créer une classe</button></div>
    ${!l ? `<div class="empty">${svg(I.school)}<p>Chargement…</p></div>`
      : !l.length ? `<div class="empty">${svg(I.school)}<p><b>Aucune classe</b></p></div>`
      : groupes.map(g => `
          <div class="lbl"><span>${esc(CYCLES[g.k] || 'Autres')}</span><span>${g.l.length}</span></div>
          <div class="rtable">
            <div class="rrow tete"><span class="c1">Classe</span><span class="c2">Effectif</span>
              <span class="c3">Professeur principal</span><span class="c4">Équipe</span>
              <span class="c5">Activité</span></div>
            ${g.l.map(ligne).join('')}
          </div>`).join('')}`;
}

/* ══════════ la console du professeur ══════════
   Un professeur de collège tient dix classes, voit trois cents élèves par
   semaine, et n'aime pas les ordinateurs. Tout ce qui suit découle de ces
   trois faits.

   Il ne révise pas, il ne joue pas, il ne fabrique pas de cartes pour
   lui-même : sa bibliothèque personnelle n'a rien à faire ici. Il ne crée
   pas non plus de classe — elles viennent de l'installation dans
   l'établissement, puis du référent d'une année sur l'autre. Lui, il
   enseigne dans celles qu'on lui a données.

   Six gestes, et rien d'autre : regarder ses classes, ouvrir une classe,
   lire la ligne d'un élève, donner du travail, repousser une échéance,
   relancer ceux qui n'ont rien ouvert. Chacun est écrit sur un bouton, en
   toutes lettres. Aucun menu caché, aucun geste à découvrir.

   Écrit pour l'écran large, où un professeur prépare ses cours ; sur
   téléphone les grilles deviennent des colonnes et les tableaux se replient
   en fiches. C'est le même écran, pas une version amoindrie. */

let prof = {
  annee: null, annees: null,            // l'année scolaire regardée
  classes: null, err: 0,
  open: null, tab: 'eleves',            // la classe ouverte, et son onglet
  roster: null, devoirs: null, bilan: null,
  tri: 'retard', q: '',
  eleve: null, fiche: null,             // la fiche d'un élève
  work: null, cartes: null,             // le devoir ouvert, et ce qui bloque
  comp: null,                           // le composeur de devoir
  vue: 'liste', mois: null, agenda: null, jour: null   // le cahier de textes
};

const CYCLES = { college: 'Collège', lycee_gt: 'Lycée général', lycee_techno: 'Lycée technologique',
                 lycee_pro: 'Lycée professionnel', cpge: 'CPGE' };

/* ---------- ce qu'on va chercher ---------- */
async function profPull() {
  try {
    if (!prof.annees) {
      prof.annees = await api('/rest/v1/rpc/prof_annees', 'POST', {}) || [];
      const c = prof.annees.find(a => a.courante) || prof.annees[0];
      if (!prof.annee && c) prof.annee = c.annee;
    }
    prof.classes = await api('/rest/v1/rpc/prof_classes', 'POST',
      { annee: prof.annee }) || [];
    prof.err = 0;
  } catch (e) { prof.classes = prof.classes || []; prof.err = 1; }
  if (/^prof/.test(view.name)) { animate = false; render(); }
}
async function profClassePull(cid) {
  try {
    const [r, d] = await Promise.all([
      api('/rest/v1/rpc/prof_roster', 'POST', { cid }),
      api('/rest/v1/rpc/prof_devoirs', 'POST', { cid })
    ]);
    prof.roster = r || []; prof.devoirs = d || [];
  } catch (e) { prof.roster = prof.roster || []; prof.devoirs = prof.devoirs || []; }
  if (/^prof/.test(view.name)) { animate = false; render(); }
}
async function profFichePull(cid, qui) {
  try { prof.fiche = await api('/rest/v1/rpc/prof_eleve', 'POST', { cid, qui }) || []; }
  catch (e) { prof.fiche = []; }
  if (view.name === 'profeleve') { animate = false; render(); }
}
async function profCartesPull(aid) {
  try { prof.cartes = await api('/rest/v1/rpc/prof_cartes', 'POST', { aid }) || []; }
  catch (e) { prof.cartes = []; }
  if (menu) paintMenu();
}

/* ---------- écrire ---------- */
async function profDo(rpc, args, bon) {
  try {
    const r = await api('/rest/v1/rpc/' + rpc, 'POST', args);
    /* On rafraîchit sans vider : `profClasseView` cherche sa classe dans
       `prof.classes` et repart au tableau de bord quand elle n'y est pas.
       La vider une demi-seconde suffisait donc à éjecter le professeur de
       la classe qu'il regardait, juste après avoir donné son devoir. */
    profPull();
    if (prof.open) profClassePull(prof.open);
    if (bon) toast(I.check, typeof bon === 'function' ? bon(r) : bon);
    return r === null || r === undefined ? true : r;
  } catch (e) {
    toast(I.x, String((e && e.message) || '').slice(0, 90) || 'Impossible pour l’instant');
    return null;
  }
}

/* ---------- petits calculs d'affichage ---------- */
const pcClass = p => p >= 70 ? 'ok' : p >= 45 ? 'am' : 'ko';
/* Les dates voyagent en AAAA-MM-JJ, se lisent en JJ/MM, et se choisissent
   dans un calendrier. Aucun décalage de fuseau : on ne construit jamais de
   Date à partir d'une chaîne courte sans heure. */
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${
  String(d.getDate()).padStart(2, '0')}`;
const dansJours = n => iso(new Date(Date.now() + n * DAY));
const auJour = s => s ? new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) : null;
const joursDici = s => Math.round((auJour(s) - auJour(iso(new Date()))) / DAY);
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet',
              'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const JOURS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const jourFr = s => s ? s.split('-').reverse().slice(0, 2).join('/') : '';
/* Un élève n'a qu'un état à la fois, et c'est le plus grave qui compte. */
function etatEleve(m) {
  if (m.jamais) return { k: 'jamais', t: 'Jamais connecté' };
  if (m.retard) return { k: 'ko', t: m.retard > 1 ? m.retard + ' devoirs en retard' : '1 devoir en retard' };
  if (!m.donnes) return { k: '', t: 'Aucun devoir donné' };
  if (m.rendus === m.donnes) return { k: 'ok', t: 'À jour' };
  return { k: 'am', t: `${m.donnes - m.rendus} en cours` };
}

/* ══════════ le calendrier ══════════
   Deux usages, une seule grille : choisir une date de rendu, et regarder le
   mois pour voir ce qui tombe quand. Les semaines commencent le lundi, et
   les jours passés d'un mois scolaire restent cliquables — on repousse une
   échéance, on la recule aussi.

   `marques` associe une date à ce qu'il y a dessus ; le jour porte alors une
   pastille et son compte. */
function moisGrille(ancre, choisi, marques, prefixe) {
  const a = ancre.getFullYear(), m = ancre.getMonth();
  const premier = new Date(a, m, 1);
  const decal = (premier.getDay() + 6) % 7;           // lundi = 0
  const jours = new Date(a, m + 1, 0).getDate();
  const auj = iso(new Date());
  let cases = '';
  for (let i = 0; i < decal; i++) cases += '<span class="cal-v"></span>';
  for (let d = 1; d <= jours; d++) {
    const k = iso(new Date(a, m, d));
    const mk = marques && marques[k];
    cases += `<button class="cal-j${k === choisi ? ' on' : ''}${k === auj ? ' auj' : ''}${
      k < auj ? ' passe' : ''}${mk ? ' plein' : ''}" data-${prefixe}="${k}">
      <b>${d}</b>${mk ? `<i>${mk.length}</i>` : ''}</button>`;
  }
  return `<div class="cal-t">${JOURS.map(j => `<span>${j}</span>`).join('')}</div>
    <div class="cal-g">${cases}</div>`;
}
function calendrier(ancre, choisi, marques, prefixe, saut) {
  const a = ancre.getFullYear(), m = ancre.getMonth();
  return `<div class="cal">
    <div class="cal-h">
      <button class="cal-f" data-${saut}="${iso(new Date(a, m - 1, 1))}"
        aria-label="Mois précédent">${svg(I.back)}</button>
      <b>${MOIS[m]} ${a}</b>
      <button class="cal-f" data-${saut}="${iso(new Date(a, m + 1, 1))}"
        aria-label="Mois suivant">${svg(I.arrow)}</button>
    </div>
    ${moisGrille(ancre, choisi, marques, prefixe)}
  </div>`;
}

/* ══════════ 1. Mes classes — la page d'accueil du professeur ══════════ */
function profView() {
  const l = prof.classes;
  const som = k => (l || []).reduce((a, c) => a + (c[k] || 0), 0);
  const retard = som('retard'), jamais = som('jamais'), eleves = som('effectif');
  const encours = som('encours'), actifs = som('actifs7');

  const tuile = c => {
    const chaud = c.retard > 0 || c.jamais > 0;
    return `<button class="kls${chaud ? ' chaud' : ''}" data-pclasse="${esc(c.id)}">
      <span class="kn">${esc(c.name)}
        ${c.principal ? '<i class="pp">PP</i>' : ''}
        <em class="keff">${c.effectif}</em></span>
      <span class="ks">${esc(c.niveau || '')}${c.filiere ? ' · ' + esc(c.filiere) : ''}${
        c.matiere ? ' · ' + esc(c.matiere) : ''}</span>
      <span class="kw">
        ${c.retard ? `<em class="ko">${c.retard} en retard</em>` : ''}
        ${c.pas_ouvert ? `<em class="am">${c.pas_ouvert} sans ouvrir</em>` : ''}
        ${c.jamais ? `<em class="gris">${c.jamais} jamais connectés</em>` : ''}
        ${!c.retard && !c.pas_ouvert && !c.jamais && c.devoirs ? '<em class="ok">à jour</em>' : ''}
        ${!c.devoirs ? '<em class="gris">aucun devoir donné</em>' : ''}
      </span>
      ${c.dernier ? `<span class="kd">${svg(I.card)}<b>${esc(c.dernier)}</b>
        <i>${c.dernier_due ? dueLabel(c.dernier_due) : ''}</i></span>` : ''}
      ${c.devoirs ? `<span class="kbar"><i class="${pcClass(c.pct)}"
          style="width:${Math.max(2, c.pct)}%"></i></span>
        <span class="kp">${c.pct} % de réussite au dernier devoir · ${
          plur(c.encours, 'devoir')} en cours</span>` : ''}
    </button>`;
  };

  const groupes = [];
  for (const c of l || []) {
    const k = c.cycle || 'autre';
    const g = groupes.find(x => x.k === k);
    (g || (groupes.push({ k, l: [] }), groupes[groupes.length - 1])).l.push(c);
  }
  const an = prof.annees || [];

  $.innerHTML = `
    <div class="bar">
      <h1>Mes classes</h1>
      ${an.length > 1 ? `<select class="anne" id="pan" aria-label="Année scolaire">
        ${an.map(a => `<option value="${esc(a.annee)}"${a.annee === prof.annee ? ' selected' : ''}
          >${esc(a.annee)}</option>`).join('')}</select>`
        : `<span class="anne fixe">${esc(prof.annee || '')}</span>`}
    </div>
    <div class="page console">
      ${school && school.org ? `<div class="ecole">${svg(I.school)}<span>
        <b>${esc(prefs.name || auth.email)}</b>
        <i>${esc(school.org)}${school.ville ? ' · ' + esc(school.ville) : ''}</i></span></div>` : ''}

      ${!l ? '' : `<div class="kpi cinq">
        <div class="kc"><b>${l.length}</b><span>classes</span></div>
        <div class="kc"><b>${eleves}</b><span>élèves</span></div>
        <div class="kc"><b>${encours}</b><span>devoirs en cours</span></div>
        <div class="kc ${retard ? 'ko' : ''}"><b>${retard}</b><span>élèves en retard</span></div>
        <div class="kc ${jamais ? 'am' : ''}"><b>${jamais}</b><span>jamais connectés</span></div>
      </div>`}

      <div class="duo ghost gros">
        <button data-act="pnew">${svg(I.plus)}Créer et donner un devoir</button>
        ${actifs ? `<button data-act="pbilan">${svg(I.chart)}${actifs} élèves actifs cette semaine</button>` : ''}
      </div>

      ${!l ? `<div class="empty">${svg(I.school)}<p>${prof.err ? 'Liste indisponible' : 'Chargement…'}</p></div>`
        : !l.length ? `<div class="empty">${svg(I.school)}<p><b>Aucune classe cette année</b></p></div>`
        : groupes.map(g => `
            <div class="lbl"><span>${esc(CYCLES[g.k] || 'Autres classes')}</span><span>${g.l.length}</span></div>
            <div class="grille">${g.l.map(tuile).join('')}</div>`).join('')}
    </div>`;
  const sel = document.getElementById('pan');
  if (sel) sel.addEventListener('change', () => {
    prof.annee = sel.value; prof.classes = null; prof.open = null;
    profPull(); animate = false; render();
  });
}

/* ══════════ 2. Une classe ══════════ */
function profClasseView() {
  const c = (prof.classes || []).find(x => x.id === prof.open);
  if (!c) return go('prof');
  const onglet = (k, n, b) => `<button class="otab ${prof.tab === k ? 'on' : ''}" data-ptab="${k}">${n}${
    b ? `<em>${b}</em>` : ''}</button>`;
  $.innerHTML = `
    <div class="bar"><button class="ic" data-act="prof" aria-label="Retour">${svg(I.back)}</button>
      <h1>${esc(c.name)}</h1>
      <span class="anne fixe">${esc(c.annee_scolaire || '')}</span></div>
    <div class="page console">
      <div class="ecole">${svg(I.school)}<span>
        <b>${esc(c.name)}${c.principal ? ' · tu en es professeur principal' : ''}</b>
        <i>${esc(c.niveau || '')}${c.filiere ? ' · ' + esc(c.filiere) : ''}${
          c.matiere ? ' · ' + esc(c.matiere) : ''} · ${plur(c.effectif, 'élève')}</i></span>
        <button class="cbtn" data-act="pcode">${svg(I.key)}Code</button></div>

      <div class="duo ghost gros">
        <button data-act="pnew">${svg(I.plus)}Créer et donner un devoir</button>
        <button data-act="plib">${svg(I.book)}Donner un livre de ma bibliothèque</button>
      </div>

      <div class="rtabs">
        ${onglet('eleves', 'Élèves', c.effectif)}
        ${onglet('devoirs', 'Devoirs', prof.devoirs ? prof.devoirs.filter(d => d.mien).length : '')}
        ${onglet('bilan', 'Bilan', '')}
      </div>
      ${prof.tab === 'devoirs' ? profDevoirs() : prof.tab === 'bilan' ? profBilan(c) : profEleves(c)}
    </div>`;
  const q = document.getElementById('pq');
  if (q) q.addEventListener('input', () => {
    prof.q = q.value;
    const v = prof.q.trim().toLowerCase();
    $.querySelectorAll('.elvs .elv').forEach(n => {
      n.hidden = !!v && !n.textContent.toLowerCase().includes(v);
    });
    const cnt = document.getElementById('pcount');
    if (cnt) cnt.textContent = $.querySelectorAll('.elvs .elv:not([hidden])').length;
  });
}

/* ---------- onglet Élèves ---------- */
function profEleves(c) {
  const r = prof.roster;
  const TRI = { retard: 'Qui décroche', nom: 'Ordre alphabétique',
                note: 'Meilleurs résultats', vu: 'Activité récente' };
  const vus = (r || []).slice().sort((x, y) =>
      prof.tri === 'nom' ? String(x.who).localeCompare(y.who, 'fr')
    : prof.tri === 'note' ? (y.pct - x.pct) || String(x.who).localeCompare(y.who, 'fr')
    : prof.tri === 'vu' ? (y.pages7 - x.pages7) || String(x.who).localeCompare(y.who, 'fr')
    : (y.retard - x.retard) || (y.jamais - x.jamais) || (x.pct - y.pct)
      || String(x.who).localeCompare(y.who, 'fr'));

  const ligne = m => {
    const e = etatEleve(m);
    return `<button class="elv ${e.k}" data-peleve="${esc(m.user_id)}">
      <i class="av sm">${esc(initial(m.who))}</i>
      <span class="en"><b>${esc(m.who)}</b><i>@${esc(m.handle || '')}</i></span>
      <span class="ev"><b>${m.rendus}<em>/${m.donnes}</em></b><i>rendus</i></span>
      <span class="ev"><b class="${m.pct ? pcClass(m.pct) : ''}">${m.pct || '—'}${
        m.pct ? ' %' : ''}</b><i>réussite</i></span>
      <span class="ev"><b>${m.pages7 || '—'}</b><i>pages sur 7 j</i></span>
      <span class="ev"><b>${m.jamais ? '—' : m.vu ? timeAgo(m.vu) : 'jamais'}</b><i>dernier rendu</i></span>
      <span class="etat ${e.k}">${e.t}</span>
      <span class="ebar"><i class="${pcClass(Math.round(m.rendus / (m.donnes || 1) * 100))}"
        style="width:${Math.max(2, Math.round(m.rendus / (m.donnes || 1) * 100))}%"></i></span>
    </button>`;
  };
  return `
    <div class="triq">
      <div class="fld addf"><input id="pq" type="search" placeholder="Chercher un élève"
        autocomplete="off" spellcheck="false" value="${esc(prof.q)}" aria-label="Chercher un élève"></div>
      <div class="pills">${Object.entries(TRI).map(([k, n]) =>
        `<button class="p ${prof.tri === k ? 'on' : ''}" data-ptri="${k}">${n}</button>`).join('')}</div>
    </div>
    <div class="rcount"><b id="pcount">${(r || []).length}</b> élèves ·
      ${(r || []).filter(m => m.retard).length} en retard ·
      ${(r || []).filter(m => m.jamais).length} jamais connectés</div>
    ${!r ? `<div class="card2"></div>`
      : !r.length ? `<div class="empty">${svg(I.users)}<p><b>Aucun élève inscrit</b></p></div>`
      : `<div class="elvs">${vus.map(ligne).join('')}</div>`}`;
}

/* ---------- onglet Devoirs ----------
   Deux façons de regarder la même chose : la liste, pour l'état de chacun,
   et le mois, pour voir ce qui tombe quand — et surtout quel jour on a déjà
   trois devoirs posés sur la même classe. */
function profDevoirs() {
  const l = prof.devoirs;
  if (prof.vue === 'cal') return profMois(l);
  const mien = (l || []).filter(d => d.mien);
  const autres = (l || []).filter(d => !d.mien);
  const ligne = d => {
    const tard = d.due && joursDici(d.due) < 0;
    const pas = Math.max(0, (d.effectif || 0) - (d.ouvert || 0));
    return `<button class="dvr${tard ? ' tard' : ''}" data-pwork="${esc(d.id)}">
      <span class="c1"><b>${esc(d.nom)}</b>
        <i>${plur(d.n, 'page')}${d.matiere ? ' · ' + esc(d.matiere) : ''}${
          d.mien ? '' : ' · ' + esc(d.auteur)}</i></span>
      <span class="an"><b>${d.rendu}</b><i>/ ${d.effectif} rendus</i></span>
      <span class="an ${pas ? 'ko' : ''}"><b>${pas}</b><i>sans ouvrir</i></span>
      <span class="an"><b class="${d.pct ? pcClass(d.pct) : ''}">${d.pct || '—'}</b><i>% juste</i></span>
      <span class="an"><b>${d.due ? jourFr(d.due) : '—'}</b><i>${
        d.due ? dueLabel(d.due) : ''}</i></span>
      ${svg(I.arrow)}</button>`;
  };
  return `${vueBascule()}
    ${!l ? `<div class="card2"></div>`
      : !l.length ? `<div class="empty">${svg(I.card)}<p><b>Aucun devoir</b></p></div>`
      : `${mien.length ? `<div class="lbl"><span>Mes devoirs</span><span>${mien.length}</span></div>
           <div class="dvrs">${mien.map(ligne).join('')}</div>` : ''}
         ${autres.length ? `<div class="lbl"><span>Mes collègues</span><span>${autres.length}</span></div>
           <div class="dvrs">${autres.map(ligne).join('')}</div>` : ''}`}`;
}
const vueBascule = () => `<div class="vbasc">
  <button class="${prof.vue === 'liste' ? 'on' : ''}" data-pvue="liste">${svg(I.rows)}Liste</button>
  <button class="${prof.vue === 'cal' ? 'on' : ''}" data-pvue="cal">${svg(I.cal)}Calendrier</button>
</div>`;

/* Le mois de la classe ouverte. Un jour chargé se voit à sa pastille ;
   cliquer dessus déroule ce qui y tombe. */
function profMois(l) {
  const marques = {};
  for (const d of l || []) if (d.due) (marques[d.due] = marques[d.due] || []).push(d);
  const ancre = auJour(prof.mois || iso(new Date()));
  const jour = prof.jour && marques[prof.jour] ? marques[prof.jour] : null;
  return `${vueBascule()}
    ${calendrier(ancre, prof.jour, marques, 'pjour', 'pmois')}
    ${jour ? `<div class="lbl"><span>${jourLong(prof.jour)}</span><span>${jour.length}</span></div>
      <div class="dvrs">${jour.map(d => `<button class="dvr" data-pwork="${esc(d.id)}">
        <span class="c1"><b>${esc(d.nom)}</b><i>${plur(d.n, 'page')}${
          d.mien ? '' : ' · ' + esc(d.auteur)}</i></span>
        <span class="an"><b>${d.rendu}</b><i>/ ${d.effectif} rendus</i></span>
        <span class="an"><b class="${d.pct ? pcClass(d.pct) : ''}">${d.pct || '—'}</b><i>% juste</i></span>
        ${svg(I.arrow)}</button>`).join('')}</div>` : ''}`;
}
const jourLong = s => {
  const d = auJour(s); if (!d) return '';
  const J = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  return `${J[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]}`;
};

/* ---------- onglet Bilan ----------
   La même classe, mais répartie : combien suivent, combien décrochent,
   combien ne sont jamais venus. Un professeur n'a pas à compter lui-même
   pour savoir s'il doit reprendre le chapitre ou trois élèves. */
function profBilan(c) {
  const r = prof.roster || [];
  if (!prof.roster) return `<div class="card2"></div>`;
  if (!r.length) return `<div class="empty">${svg(I.chart)}<p>Aucun élève inscrit.</p></div>`;
  const n = r.length;
  const paquets = [
    { k: 'ok',     t: 'À jour',            l: r.filter(m => !m.jamais && !m.retard && m.donnes && m.rendus === m.donnes) },
    { k: 'am',     t: 'En cours',          l: r.filter(m => !m.jamais && !m.retard && m.donnes && m.rendus < m.donnes) },
    { k: 'ko',     t: 'En retard',         l: r.filter(m => !m.jamais && m.retard) },
    { k: 'jamais', t: 'Jamais connectés',  l: r.filter(m => m.jamais) }
  ].filter(p => p.l.length);
  /* La réussite par tranches de vingt : une moyenne de classe cache
     toujours deux groupes, et c'est aux deux qu'on enseigne. */
  const notes = r.filter(m => m.pct > 0).map(m => m.pct);
  /* Le « % » est dit une fois dans le titre de la section : répété sous
     chaque colonne, il la faisait déborder et se faire couper. */
  const tranches = [[0, 20], [20, 40], [40, 60], [60, 80], [80, 101]].map(([a, b]) => ({
    t: `${a}–${b === 101 ? 100 : b}`,
    n: notes.filter(x => x >= a && x < b).length, cls: pcClass(a + 10)
  }));
  const hi = Math.max(1, ...tranches.map(t => t.n));
  const moy = notes.length ? Math.round(notes.reduce((a, b) => a + b, 0) / notes.length) : 0;
  const actifs = r.filter(m => m.pages7 > 0);
  const pages = r.reduce((a, m) => a + (m.pages7 || 0), 0);

  return `
    <div class="kpi quatre">
      <div class="kc"><b class="${moy ? pcClass(moy) : ''}">${moy || '—'}${moy ? ' %' : ''}</b>
        <span>réussite moyenne</span></div>
      <div class="kc"><b>${actifs.length}<em>/${n}</em></b><span>ont travaillé cette semaine</span></div>
      <div class="kc"><b>${pages}</b><span>pages révisées sur 7 jours</span></div>
      <div class="kc"><b>${(prof.devoirs || []).filter(d => d.mien).length}</b><span>devoirs donnés</span></div>
    </div>

    <div class="lbl"><span>Où en est la classe</span></div>
    <div class="rep">${paquets.map(p => `<div class="rr ${p.k}">
      <span class="rt2"><b>${p.l.length}</b> ${p.t}</span>
      <span class="rb2"><i style="width:${Math.round(p.l.length / n * 100)}%"></i></span>
      <span class="rn2">${p.l.slice(0, 12).map(m => esc(m.who.split(' ')[0])).join(', ')}${
        p.l.length > 12 ? ` et ${p.l.length - 12} autres` : ''}</span>
    </div>`).join('')}</div>

    <div class="lbl"><span>Répartition des résultats, en % de réussite</span>
      <span>${notes.length} élèves notés</span></div>
    ${!notes.length ? `<div class="card2"></div>`
      : `<div class="histo">${tranches.map(t => `<div class="hb">
          <span class="hv">${t.n || ''}</span>
          <span class="hz"><i class="hc ${t.cls}"
            style="height:${t.n ? Math.max(4, Math.round(t.n / hi * 100)) : 0}%"></i></span>
          <span class="hl">${t.t}</span></div>`).join('')}</div>`}

    <div class="lbl"><span>À reprendre avec eux</span></div>
    ${(() => {
      const urg = r.filter(m => m.jamais || m.retard || (m.pct && m.pct < 45));
      if (!urg.length) return `<div class="card2"></div>`;
      return `<div class="elvs serre">${urg.slice(0, 20).map(m => {
        const e = etatEleve(m);
        return `<button class="elv ${e.k}" data-peleve="${esc(m.user_id)}">
          <i class="av sm">${esc(initial(m.who))}</i>
          <span class="en"><b>${esc(m.who)}</b><i>@${esc(m.handle || '')}</i></span>
          <span class="etat ${e.k}">${e.t}${m.pct && m.pct < 45 ? ` · ${m.pct} % juste` : ''}</span>
        </button>`;
      }).join('')}</div>`;
    })()}
    <div class="note" style="padding:10px 0 0">Le code de la classe est
      <b>${esc(c.code || '—')}</b> : c’est lui que saisissent les élèves qui n’ont jamais ouvert
      l’app.</div>`;
}

/* ══════════ 3. La fiche d'un élève ══════════
   Tout ce que le professeur a le droit de savoir, et rien de plus : ce qui
   a été rendu, quand, et avec quel taux de réussite. Jamais les réponses,
   jamais les horaires de travail, jamais les paquets personnels. La
   différence entre suivre une classe et surveiller quelqu'un. */
function profEleveView() {
  const c = (prof.classes || []).find(x => x.id === prof.open);
  const m = (prof.roster || []).find(x => x.user_id === prof.eleve);
  if (!c || !m) return go('profclasse');
  const f = prof.fiche;
  const e = etatEleve(m);
  const ETAT = { 'rendu': 'ok', 'commencé': 'am', 'non rendu': 'ko', 'pas ouvert': 'gris' };
  $.innerHTML = `
    <div class="bar"><button class="ic" data-act="pback" aria-label="Retour">${svg(I.back)}</button>
      <h1>${esc(m.who)}</h1></div>
    <div class="page console">
      <div class="ecole"><i class="av">${esc(initial(m.who))}</i><span>
        <b>${esc(m.who)} <em class="etat ${e.k}">${e.t}</em></b>
        <i>@${esc(m.handle || '')} · ${esc(c.name)}${c.niveau ? ' · ' + esc(c.niveau) : ''}${
          c.matiere ? ' · ' + esc(c.matiere) : ''}</i></span></div>

      <div class="kpi cinq">
        <div class="kc"><b>${m.rendus}<em>/${m.donnes}</em></b><span>devoirs rendus</span></div>
        <div class="kc"><b class="${m.pct ? pcClass(m.pct) : ''}">${m.pct || '—'}${
          m.pct ? ' %' : ''}</b><span>de réussite</span></div>
        <div class="kc ${m.retard ? 'ko' : ''}"><b>${m.retard}</b><span>en retard</span></div>
        <div class="kc"><b>${m.pages7}</b><span>pages sur 7 jours</span></div>
        <div class="kc"><b>${m.jours7}</b><span>jours travaillés sur 7</span></div>
      </div>

      ${m.jamais ? `<div class="alerte">${svg(I.warn)}<span><b>Ce compte n’a jamais été ouvert.</b>
        Ni retard ni paresse : le lien n’est pas arrivé jusqu’à lui, ou le mot de passe est perdu.
        Le référent de l’établissement peut le refaire en trois clics.</span></div>` : ''}

      <div class="duo ghost">
        <button data-act="pmot">${svg(I.mail2)}Lui envoyer un mot</button>
      </div>

      <div class="lbl"><span>Devoirs de la classe</span><span>${f ? f.length : ''}</span></div>
      ${!f ? `<div class="card2"></div>`
        : !f.length ? `<div class="card2"><div class="note">Aucun devoir dans cette classe.</div></div>`
        : `<div class="dvrs">${f.map(x => `<div class="dvr lect">
            <span class="c1"><b>${esc(x.devoir)}</b>
              <i>${plur(x.n, 'page')}${x.matiere ? ' · ' + esc(x.matiere) : ''}${
                x.mien ? '' : ' · d’un collègue'}</i></span>
            <span class="an"><b class="${x.pct ? pcClass(x.pct) : ''}">${x.pct || '—'}</b>
              <i>% juste</i></span>
            <span class="an"><b>${x.due ? jourFr(x.due) : '—'}</b><i>à rendre</i></span>
            <span class="an"><b>${x.rendu ? timeAgo(x.rendu) : '—'}</b><i>rendu</i></span>
            <span class="etat ${ETAT[x.etat] || ''}">${esc(x.etat)}</span>
          </div>`).join('')}</div>`}
    </div>`;
}

/* ══════════ 4. Le composeur de devoir ══════════
   Créer les cartes là où on s'en sert, sans passer par une bibliothèque
   personnelle. Trois façons d'y arriver, parce que trois professeurs
   différents ne s'y prennent pas pareil : coller une liste depuis un
   traitement de texte, taper une paire à la fois, ou reprendre un livre
   déjà fait.

   Le collage accepte ce qu'on a sous la main — tabulation, point-virgule,
   égal, flèche, tiret — parce qu'exiger un séparateur, c'est renvoyer
   quelqu'un reformater son fichier. */
/* Le devoir se compose dans l'éditeur de livres — le vrai, celui qui sait
   lire une photo de page, un PDF, un export Quizlet, fabriquer les cartes
   à partir d'un cours collé, et poser une image ou un enregistrement sur
   chaque face. Il n'y a donc pas de second éditeur au rabais ici : cette
   feuille ne pose que les deux questions qui restent — à qui, et pour
   quand. Le livre, lui, reste dans la bibliothèque du professeur, prêt à
   resservir l'année suivante. */
function compNeuf(pre) {
  const c = (prof.classes || []).find(x => x.id === prof.open);
  return { nom: '', matiere: (c && c.matiere) || '', due: dansJours(7), mois: null,
           livre: null, cibles: new Set(prof.open ? [prof.open] : []), ...(pre || {}) };
}
/* Les cartes partent entières : recto, verso, image et son. Les médias d'un
   livre de cours sont lisibles par la classe (préfixe « cours/ »). */
const carteNue = c => {
  const o = { f: plain(c.f), b: plain(c.b) };
  for (const k of ['fi', 'bi', 'fa', 'ba', 't', 'g']) if (c[k]) o[k] = c[k];
  return o;
};
function compCartes() {
  const k = prof.comp; if (!k || !k.livre) return [];
  const d = deck(k.livre);
  return d ? d.cards.map(carteNue).filter(c => c.f || c.fi || c.fa) : [];
}
/* Ouvrir la feuille « à qui, pour quand » sur un livre donné. */
function donnerLivre(d) {
  prof.comp = compNeuf({ livre: d.id, nom: d.name,
    matiere: d.subject ? (subj(d.subject) || {}).name || '' : (prof.comp || {}).matiere || '' });
  openMenu('compo');
}

function compSheet(w) {
  const k = prof.comp;
  if (!k) { menu = null; return; }
  const d = k.livre ? deck(k.livre) : null;
  const cartes = compCartes();
  const cls = prof.classes || [];
  const riches = cartes.filter(c => c.fi || c.bi || c.fa || c.ba).length;
  const pret = k.nom.trim() && cartes.length && k.cibles.size;
  w.innerHTML = `<div class="scrim" data-mact="close"></div>
    <div class="menu pv">
      <div class="mhd">${svg(I.share)}<span class="mhx"><b>Donner un devoir</b>
        <i>${d ? esc(d.name) : ''}</i></span></div>
      <div class="mscroll">
        <div class="rform">
          <label>Titre<input id="cnom" value="${esc(k.nom)}" spellcheck="false"></label>
          <label>Matière<input id="cmat" value="${esc(k.matiere)}" spellcheck="false"></label>
        </div>
        <div class="mlbl">Contenu</div>
        <div class="cchif">
          <div><b>${cartes.length}</b><span>cartes</span></div>
          ${riches ? `<div><b>${riches}</b><span>avec image ou son</span></div>` : ''}
          <button class="cedit" data-cedit="1">${svg(I.type)}Modifier le livre</button>
        </div>
        <div class="msep"></div>
        <div class="mlbl">À rendre le ${jourFr(k.due)}</div>
        ${calendrier(auJour(k.mois || k.due), k.due, null, 'cdue2', 'cmois')}
        <div class="msep"></div>
        <div class="mlbl">Classes <em>${k.cibles.size || ''}</em></div>
        <div class="mscroll courte">${cls.map(c => `
          <button class="mi${k.cibles.has(c.id) ? ' on' : ''}" data-ccible="${esc(c.id)}">
            ${svg(k.cibles.has(c.id) ? I.check : I.plus)}<span>${esc(c.name)}</span>
            <span class="tail">${esc(c.niveau || '')} · ${c.effectif} él.</span></button>`).join('')}</div>
      </div>
      <div class="cbar">
        <span>${plur(cartes.length, 'carte')} · ${
          k.cibles.size ? plur(k.cibles.size, 'classe') : 'aucune classe'}</span>
        <button class="cgo" data-mact="cgive" ${pret ? '' : 'disabled'}>Donner</button>
      </div>
    </div>`;
  mountMenu(w);
  const lie = (id, ch) => { const n = document.getElementById(id);
    if (n) n.addEventListener('input', () => prof.comp[ch] = n.value); };
  lie('cnom', 'nom'); lie('cmat', 'matiere');
}

/* Les champs de la feuille avant chaque repeinture : un titre tapé puis
   perdu au premier clic est ce qui fait abandonner un outil. */
function lireComp() {
  const k = prof.comp; if (!k) return;
  for (const [ch, id] of [['nom', 'cnom'], ['matiere', 'cmat']]) {
    const n = document.getElementById(id);
    if (n) k[ch] = n.value;
  }
}

async function compDonner() {
  const k = prof.comp; if (!k) return;
  const cartes = compCartes();
  if (!cartes.length) return toast(I.x, 'Ce livre n’a aucune carte');
  const n = await profDo('prof_give',
    { cids: [...k.cibles], nom: k.nom.trim(), matiere: k.matiere.trim(),
      cartes, due: k.due },
    r => `${plur(cartes.length, 'carte')} à ${plur(r, 'classe')}, à rendre avant le `
      + jourFr(k.due));
  if (n) {
    prof.comp = null; closeMenu();
    /* On revient là où le professeur travaillait : sa classe s'il en
       regardait une, sinon ses classes. Rester sur l'éditeur du livre
       après l'envoi laisse croire que rien n'est parti. */
    go(prof.open ? 'profclasse' : 'prof');
  }
}

/* ---------- la feuille d'un devoir ---------- */
function workSheet(w) {
  const d = (prof.devoirs || []).find(x => x.id === prof.work);
  if (!d) { menu = null; return; }
  const pas = Math.max(0, (d.effectif || 0) - (d.ouvert || 0));
  const ca = prof.cartes;
  w.innerHTML = `<div class="scrim" data-mact="close"></div>
    <div class="menu pv">
      <div class="mhd">${svg(I.card)}<span class="mhx"><b>${esc(d.nom)}</b>
        <i>${plur(d.n, 'page')}${d.matiere ? ' · ' + esc(d.matiere) : ''}${
          d.due ? ' · ' + dueLabel(d.due) : ''}${d.mien ? '' : ' · donné par ' + esc(d.auteur)}</i></span></div>
      <div class="mscroll">
        <div class="fiche">
          <div><b>${d.rendu} / ${d.effectif}</b><span>ont rendu</span></div>
          <div><b>${d.ouvert}</b><span>ont ouvert</span></div>
          <div><b class="${pas ? 'ko' : ''}">${pas}</b><span>n’ont pas ouvert</span></div>
          <div><b class="${d.pct ? pcClass(d.pct) : ''}">${d.pct || '—'}${
            d.pct ? ' %' : ''}</b><span>de réussite</span></div>
        </div>
        ${d.mien ? `
          <div class="msep"></div>
          <div class="mlbl">À rendre le ${jourFr(d.due)}</div>
          ${calendrier(auJour(prof.mois || d.due || iso(new Date())), d.due, null, 'cdue', 'pmois2')}
          ${pas ? `<button class="mi" data-mact="prelance">${svg(I.mail2)}
            <span>Relancer les ${pas} qui n’ont pas ouvert</span>
            <span class="tail">un mot dans leur courrier</span></button>` : ''}
          <button class="mi" data-mact="pdefi">${svg(I.flame)}
            <span>Lancer un défi à la classe</span></button>
          <button class="mi" data-mact="predonner">${svg(I.copy)}
            <span>Redonner à d’autres classes</span></button>
          <div class="msep"></div>` : '<div class="msep"></div>'}

        <div class="mlbl">Ce qui bloque dans ce devoir</div>
        ${!ca ? ``
          : !ca.length ? ``
          : `<div class="mscroll courte">${ca.map(c => `<div class="mi lect">
              <span class="carte"><b>${esc(c.recto)} → ${esc(c.verso)}</b>
                <i>${c.ratees} erreurs sur ${c.vues} passages · ${plur(c.eleves, 'élève')}</i></span>
              </div>`).join('')}</div>`}

        ${d.mien ? `<div class="msep"></div>
          <button class="mi warn" data-mact="pdel">${svg(I.trash)}<span>Retirer ce devoir</span>
            <span class="tail">l’avancement est perdu</span></button>` : ''}
      </div>
    </div>`;
  mountMenu(w);
  if (!ca) profCartesPull(d.id);
}
/* ---------- l'écran des classes ---------- */
function classesView() {
  const l = classes;
  const mine = (l || []).filter(c => c.owner === auth.uid);
  const in_ = (l || []).filter(c => c.owner !== auth.uid);
  const carte = c => `<button class="sr flat" data-classe="${esc(c.id)}">${svg(I.layers)}
    <span class="ml2"><span class="n">${esc(c.name)}</span>
      <span class="sub">${esc(c.level || 'Classe')}${c.year ? ' · ' + esc(c.year) : ''}${
        c.owner === auth.uid ? ' · code ' + esc(c.code) : ''}</span></span>${svg(I.arrow)}</button>`;
  $.innerHTML = `
    <div class="bar"><button class="ic" data-act="home" aria-label="Retour">${svg(I.back)}</button>
      <h1>${isProf() ? 'Mes classes' : 'Ma classe'}</h1></div>
    <div class="page">
      ${isProf() ? `<button class="cta ghost" data-act="newclass">${svg(I.plus)}Créer une classe</button>` : ''}
      <button class="cta ghost" data-act="joinclass">${svg(I.key)}Rejoindre avec un code</button>
      ${!l ? `<div class="empty">${svg(I.layers)}<p>Chargement…</p></div>`
        : !l.length ? `<div class="empty">${svg(I.layers)}<p><b>Aucune classe</b>${
            isProf() ? 'Crée-en une, puis distribue son code à tes élèves.'
                     : 'Demande son code à ton professeur.'}</p></div>`
        : `${mine.length ? `<div class="lbl"><span>Je les tiens</span><span>${mine.length}</span></div>
             <div class="slist">${mine.map(carte).join('')}</div>` : ''}
           ${in_.length ? `<div class="lbl"><span>J’y suis inscrit</span><span>${in_.length}</span></div>
             <div class="slist">${in_.map(carte).join('')}</div>` : ''}`}
    </div>`;
}

function classeView() {
  const c = (classes || []).find(x => x.id === classOf);
  if (!c) return go('classes');
  const owner = c.owner === auth.uid;
  $.innerHTML = `
    <div class="bar"><button class="ic" data-act="classes" aria-label="Retour">${svg(I.back)}</button>
      <h1>${esc(c.name)}</h1>
      </div>
    <div class="page">
      ${owner ? `<div class="ccode">${svg(I.key)}<span>Code de la classe</span><b>${esc(c.code)}</b></div>` : ''}

      <div class="lbl"><span>Devoirs</span><span>${asgs ? asgs.length : ''}</span></div>
      ${owner ? `<button class="cta ghost" data-act="newwork">${svg(I.share)}Donner un devoir</button>` : ''}
      ${!asgs ? `<div class="empty">${svg(I.card)}<p>Chargement…</p></div>`
        : !asgs.length ? `<div class="empty">${svg(I.card)}<p><b>Aucun devoir</b>${
            owner ? 'Choisis un livre et donne-le à la classe.' : 'Rien à faire pour l’instant.'}</p></div>`
        : `<div class="slist">${asgs.map(a => `<button class="sr flat" data-work="${esc(a.id)}">
             ${svg(I.card)}<span class="ml2"><span class="n">${esc(a.name)}</span>
               <span class="sub">${plur(a.n, 'page')}${a.due ? ' · ' + dueLabel(a.due) : ''}</span></span>
             ${svg(I.arrow)}</button>`).join('')}</div>`}

      ${owner ? `<div class="lbl"><span>Élèves</span><span>${roster ? roster.length : ''}</span></div>
        ${!roster ? `<div class="empty">${svg(I.user)}<p>Chargement…</p></div>`
          : !roster.length ? `<div class="empty">${svg(I.user)}<p><b>Personne encore</b>
              Projette le code <b>${esc(c.code)}</b> : trois minutes en début de cours suffisent.</p></div>`
          : `<div class="slist">${roster.map(m => `<button class="sr flat" data-member="${esc(m.user_id)}">
               <i class="av">${esc(initial(m.who))}</i>
               <span class="ml2"><span class="n">${esc(m.who || 'Élève')}</span>
                 <span class="sub">inscrit ${timeAgo(m.joined_at)}</span></span>${svg(I.arrow)}</button>`).join('')}</div>`}` : ''}
    </div>`;
}

/* ══════════ communauté ══════════
   Un centre unique : qui tu es, qui tu connais, les groupes, les défis,
   l'étagère commune et le classement. Le reste de l'app n'a plus à parler
   de « groupe » ici et là — tout ce qui concerne les autres vit ici. */
async function groupsPull() {
  try {
    const rows = await api('/rest/v1/group_members?select=group_id,groups(id,name,code,owner)');
    groups = (rows || []).map(r => r.groups).filter(Boolean);
  } catch (e) { groups = groups || []; }
  if (view.name === 'commu' || view.name === 'groups') { animate = false; render(); }
  if (menu) paintMenu();
}
async function makeGroup(name) {
  const code = Array.from(crypto.getRandomValues(new Uint8Array(5)),
    b => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[b % 31]).join('');
  try {
    const [g] = await api('/rest/v1/groups', 'POST',
      [{ name: (name || '').trim() || 'Mon club', code, owner: auth.uid }],
      { Prefer: 'return=representation' }) || [];
    if (g) await api('/rest/v1/group_members', 'POST', [{ group_id: g.id, user_id: auth.uid }],
      { Prefer: 'return=minimal' });
    closeMenu(); groups = null; groupsPull();
    toast(I.check, 'Club créé · code ' + code);
  } catch (e) { toast(I.x, 'Création impossible'); }
}
async function joinGroup(code) {
  try {
    const [g] = await api('/rest/v1/rpc/join_group', 'POST', { join_code: code }) || [];
    closeMenu(); groups = null; groupsPull();
    toast(I.check, g ? 'Bienvenue dans ' + g.name : 'Club rejoint');
  } catch (e) { toast(I.x, 'Code inconnu'); }
}
async function leaveGroup(id) {
  try {
    await api(`/rest/v1/group_members?group_id=eq.${id}&user_id=eq.${auth.uid}`, 'DELETE',
      null, { Prefer: 'return=minimal' });
  } catch (e) {}
  closeMenu(); groups = null; groupsPull();
}

/* tout ce que l'écran a besoin de savoir, en un seul aller-retour groupé */
function commuPull() {
  if (!me) mePull().then(() => { if (view.name === 'commu') { animate = false; render(); } });
  if (!friends) friendsPull();
  if (!groups && !atSchool()) groupsPull();   // pas de club à l'école
  if (!duels.list) duelsPull();
  if (!lib.list) libPull();
  if (!board.rows) boardPull();
  if (school === null) schoolPull().then(() => { if (view.name === 'commu') { animate = false; render(); } });
}

const initial = s => (String(s || '?').trim()[0] || '?').toUpperCase();

function commuView() {
  const nMates = (mates || []).length, nAsk = (asks || []).length;
  const nGroup = (groups || []).length;
  const toPlay = (duels.list || []).filter(d => !myScore(d.id)).length;
  const nLib = (lib.list || []).length;
  const rows = board.rows || [];
  const mine = rows.findIndex(r => r.uid === auth.uid);
  const MED = ['🥇', '🥈', '🥉'];
  const tile = (act, ic, lab, val, warn) => `<button class="ctile" data-act="${act}">
    <i class="ci">${svg(ic)}${warn ? `<b class="cbdg">${warn}</b>` : ''}</i>
    <span class="cn">${lab}</span><span class="cv">${val}</span></button>`;
  /* Un élève inscrit par son établissement n'a ni pseudo à choisir, ni
     club, ni annuaire ouvert : sa carte affiche sa classe, et ses trois
     tuiles sont Défis, Ma classe, Bibliothèque. Un compte personnel garde
     les quatre d'origine. */
  const eleve = isPupil();
  $.innerHTML = `
    <div class="page" id="page">
      <div class="top"><div class="hero">Le cercle des lecteurs</div></div>
      ${eleve ? `<div class="mecard fixe">
        <i class="av">${esc(initial(me && (me.handle || me.name)))}</i>
        <span class="mex"><b>${me && me.handle ? '@' + esc(me.handle) : esc((me && me.name) || 'Élève')}</b>
          <i>${school.classe ? `<b class="maclasse">${esc(school.classe)}</b> · ${esc(school.org)}`
            : esc(school.org)}</i></span></div>`
      : `<button class="mecard" data-act="handle">
        <i class="av">${esc(initial(me && (me.handle || me.name)))}</i>
        <span class="mex"><b>${me && me.handle ? '@' + esc(me.handle) : 'Choisis ton pseudo'}</b>
          <i>${me && me.handle ? (mine >= 0 ? `${MED[mine] || (mine + 1) + 'ᵉ'} cette semaine · ${plur(+rows[mine].n, 'page')}`
            : 'Pas encore révisé cette semaine')
            : 'C’est ce que tes amis taperont pour t’ajouter'}</i></span>
        ${svg(I.arrow)}</button>`}
      <div class="ctiles${eleve || atSchool() ? ' trois' : ''}">
        ${eleve ? `
          ${tile('duels', I.flame, 'Défis', toPlay ? toPlay + ' à jouer' : '—', toPlay)}
          ${tile('classes', I.school, 'Ma classe', school.effectif ? school.effectif + ' élèves' : '—', nAsk)}
          ${tile('library', I.book, 'Bibliothèque', nLib || '—', 0)}`
        : `
          ${tile('friends', I.user, 'Lecteurs', nMates || '—', nAsk)}
          ${atSchool() ? '' : tile('groups', I.layers, 'Clubs', nGroup || '—', 0)}
          ${tile('duels', I.flame, 'Défis', toPlay ? toPlay + ' à jouer' : '—', toPlay)}
          ${tile('library', I.book, 'Bibliothèque', nLib || '—', 0)}`}
      </div>
      <div class="lbl"><span>Classement de la semaine</span>
        ${rows.length > 3 ? '<button class="lnk" data-act="board">Tout voir</button>' : ''}</div>
      ${!board.rows ? `<div class="card2"><div class="note">${board.err ? 'Indisponible' : 'Chargement…'}</div></div>`
        : !rows.length ? `<div class="card2"><div class="note">Ajoute un lecteur.</div></div>`
        : `<div class="rows">${rows.slice(0, 3).map((x, i) => bdRow(x, i)).join('')}</div>`}
    </div>
    ${tabs('commu')}`;
  bindPager();
}
const bdRow = (x, i) => {
  const MED = ['🥇', '🥈', '🥉'];
  const top = Math.max(1, +((board.rows || [])[0] || {}).n || 1);
  return `<div class="bdr ${x.uid === auth.uid ? 'me' : ''}">
    <span class="bdp">${MED[i] || (i + 1)}</span>
    <span class="bdn"><b>${esc(x.who)}</b>
      <i>${plur(+x.n, 'page')} · ${Math.round(x.ok / (x.n || 1) * 100)} % juste · ${plur(+x.jours, 'jour')}</i>
      <em style="width:${Math.max(4, Math.round(x.n / top * 100))}%"></em></span></div>`;
};

function friendsView() {
  const l = mates || [], a = asks || [];
  $.innerHTML = `
    <div class="bar"><button class="ic" data-act="commu" aria-label="Retour">${svg(I.back)}</button>
      <h1>Lecteurs</h1></div>
    <div class="page">
      <div class="fld addf"><input id="addq" type="search" placeholder="Pseudo d’un lecteur"
        autocomplete="off" autocapitalize="none" spellcheck="false" value="${esc(addQ)}"
        aria-label="Pseudo d’un lecteur"><button class="addgo" data-act="doadd">Ajouter</button></div>
      ${a.length ? `<div class="lbl"><span>Demandes reçues</span><span>${a.length}</span></div>
        <div class="slist">${a.map(f => `<div class="sr flat">
          <i class="av sm">${esc(initial(f.handle || f.name))}</i>
          <span class="n">@${esc(f.handle || '')}</span>
          <button class="fyes" data-yes="${f.id}">${svg(I.check)}</button>
          <button class="fno" data-no="${f.id}">${svg(I.x)}</button></div>`).join('')}</div>` : ''}
      <div class="lbl"><span>Mes lecteurs</span><span>${l.length || ''}</span></div>
      ${!friends ? `<div class="card2"></div>`
        : !l.length ? `<div class="empty">${svg(I.user)}<p><b>Personne pour l’instant</b>Ajoute quelqu’un par son pseudo.</p></div>`
        : `<div class="slist">${l.map(f => `<button class="sr flat" data-mate="${f.id}">
            <i class="av sm">${esc(initial(f.handle || f.name))}</i>
            <span class="ml2"><span class="n">${esc(f.name || '')}</span>
              <span class="sub">@${esc(f.handle || '')}</span></span>${svg(I.arrow)}</button>`).join('')}</div>`}
    </div>`;
  const q = document.getElementById('addq');
  if (q) {
    q.addEventListener('input', () => addQ = q.value);
    q.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); doAdd(); } });
  }
}
async function doAdd() {
  const v = addQ.trim(); if (!v) return;
  if (await askFriend(v)) { addQ = ''; animate = false; render(); }
}

function groupsView() {
  const l = groups || [];
  $.innerHTML = `
    <div class="bar"><button class="ic" data-act="commu" aria-label="Retour">${svg(I.back)}</button>
      <h1>Clubs</h1></div>
    <div class="page">
      <div class="duo ghost">
        <button data-act="newgroup">${svg(I.plus)}Créer</button>
        <button data-act="joingroup">${svg(I.link)}Rejoindre</button>
      </div>
      ${!groups ? `<div class="card2"></div>`
        : !l.length ? `<div class="empty">${svg(I.layers)}<p><b>Aucun club</b>Une classe, un binôme : la même bibliothèque et les mêmes défis pour tous.</p></div>`
        : `<div class="slist">${l.map(g => `<button class="sr flat" data-group="${g.id}">
            ${svg(I.layers)}<span class="ml2"><span class="n">${esc(g.name)}</span>
              <span class="sub">code ${esc(g.code)}</span></span>${svg(I.arrow)}</button>`).join('')}</div>`}
    </div>`;
}
function duelsView() {
  const l = duels.list;
  $.innerHTML = `
    <div class="bar"><button class="ic" data-act="commu" aria-label="Retour">${svg(I.back)}</button>
      <h1>Défis</h1></div>
    <div class="page">
      <button class="cta ghost" data-act="duelnew">${svg(I.flame)}Lancer un défi</button>
      ${!l ? `<div class="card2"><div class="note">${duels.err ? 'Indisponible' : 'Chargement…'}</div></div>`
        : !l.length ? `<div class="empty">${svg(I.flame)}<p><b>Aucun défi</b>Dix questions d’un de tes livres, les mêmes pour tous.</p></div>`
        : `<div class="slist">${l.map(du => {
            const m = myScore(du.id), r = rankOf(du.id);
            const pos = m ? r.findIndex(x => x.user_id === auth.uid) + 1 : 0;
            return `<button class="sr flat" data-duel="${esc(du.id)}">${svg(I.flame)}
              <span class="ml2"><span class="n">${esc(du.name)}</span>
                <span class="sub">${esc(shortWho(du.who) || 'Un ami')} · ${plur(du.total, 'question')}${
                  r.length ? ' · ' + plur(r.length, 'joueur') : ''}</span></span>
              <span class="c">${m ? `<b class="dsc">${m.score}/${du.total}</b> ${pos === 1 ? '🥇' : pos + 'ᵉ'}`
                : '<span class="dnew">à jouer</span>'}</span>${svg(I.arrow)}</button>`;
          }).join('')}</div>`}
    </div>`;
}
function libraryView() {
  const l = lib.list;
  $.innerHTML = `
    <div class="bar"><button class="ic" data-act="commu" aria-label="Retour">${svg(I.back)}</button>
      <h1>Bibliothèque</h1></div>
    <div class="page">
      ${!l ? `<div class="card2"><div class="note">${lib.err ? 'Indisponible' : 'Chargement…'}</div></div>`
        : !l.length ? `<div class="empty">${svg(I.book)}<p><b>Bibliothèque vide</b>Prête un livre depuis son menu Partager.</p></div>`
        : `<div class="slist">${l.map(it => `<button class="sr flat" data-lib="${esc(it.deck_id)}">${svg(I.book)}
            <span class="ml2"><span class="n">${esc(it.name)}</span>
              <span class="sub">${esc(shortWho(it.who) || 'Un ami')}${it.subject ? ' · ' + esc(it.subject) : ''} · ${plur(it.n, 'page')}</span></span>
            <span class="c">${timeAgo(it.updated_at)}</span>${svg(I.arrow)}</button>`).join('')}</div>`}
    </div>`;
}
function boardView() {
  const r = board.rows || [];
  $.innerHTML = `
    <div class="bar"><button class="ic" data-act="commu" aria-label="Retour">${svg(I.back)}</button>
      <h1>Classement</h1></div>
    <div class="page">
      <div class="seg" id="bRange">${Object.entries(BRANGE).map(([k, n]) =>
        `<button class="${board.range === +k ? 'on' : ''}" data-brange="${k}">${n}</button>`).join('')}</div>
      ${!board.rows ? `<div class="card2"><div class="note">${board.err ? 'Indisponible' : 'Chargement…'}</div></div>`
        : !r.length ? `<div class="empty">${svg(I.trophy)}<p><b>Rien sur cette période</b></p></div>`
        : `<div class="rows">${r.map((x, i) => bdRow(x, i)).join('')}</div>
`}
    </div>`;
}

/* ---------- l'écran du groupe ---------- */
const GTABS = { lib: 'Bibliothèque', duel: 'Défis', board: 'Classement' };
const BRANGE = { 7: '7 jours', 30: '30 jours', 365: 'Toujours' };

/* Une seule barre gouverne les trois onglets : ce qu'on lit et ce qu'on
   publie vont au même endroit. Sans club, elle n'a rien à demander et
   ne s'affiche pas. */
function scopeBar() {
  if (!groups || !groups.length) return '';
  return `<div class="pills" id="gScope">
    <button class="p${scope === null ? ' on' : ''}" data-scope="">Mes lecteurs</button>
    ${groups.map(g => `<button class="p${scope === g.id ? ' on' : ''}"
      data-scope="${esc(g.id)}">${esc(g.name)}</button>`).join('')}</div>`;
}
const inScope = x => (x.group_id || null) === scope;

function groupView() {
  $.innerHTML = `
    <div class="bar"><button class="ic" data-act="home" aria-label="Retour">${svg(I.back)}</button>
      <h1>${esc(scopeName())}</h1></div>
    <div class="page">
      ${scopeBar()}
      <div class="seg" id="gTabs">${Object.entries(GTABS).map(([k, n]) =>
        `<button class="${groupTab === k ? 'on' : ''}" data-gtab="${k}">${n}</button>`).join('')}</div>
      ${groupTab === 'lib' ? libPane() : groupTab === 'duel' ? duelPane() : boardPane()}
    </div>`;
}
function libPane() {
  const l = lib.list && lib.list.filter(inScope);
  return !l ? `<div class="empty">${svg(I.book)}<p>${lib.err ? 'Bibliothèque indisponible' : 'Chargement…'}</p></div>`
    : !l.length ? `<div class="empty">${svg(I.book)}<p><b>Étagère vide</b>${
        scope ? 'Personne n’a encore posé de livre dans ce club.' : 'Prête un livre depuis son menu Partager.'}</p></div>`
    : `<div class="slist">${l.map(it => `
        <button class="sr flat" data-lib="${esc(it.deck_id)}">${svg(I.book)}
          <span class="ml2"><span class="n">${esc(it.name)}</span>
            <span class="sub">${esc(shortWho(it.who) || 'Un compte')}${
              it.subject ? ' · ' + esc(it.subject) : ''} · ${plur(it.n, 'page')}</span></span>
          <span class="c">${timeAgo(it.updated_at)}</span>${svg(I.arrow)}</button>`).join('')}</div>`;
}
function duelPane() {
  const l = duels.list && duels.list.filter(inScope);
  const mk = `<button class="cta ghost" data-act="duelnew">${svg(I.flame)}Lancer un défi</button>`;
  if (!l) return `${mk}<div class="empty">${svg(I.flame)}<p>${duels.err ? 'Défis indisponibles' : 'Chargement…'}</p></div>`;
  if (!l.length) return `${mk}<div class="empty">${svg(I.flame)}<p><b>Aucun défi</b>Dix questions, les mêmes pour tous.</p></div>`;
  return `${mk}<div class="slist">${l.map(du => {
    const me = myScore(du.id), r = rankOf(du.id);
    const pos = me ? r.findIndex(s => s.user_id === auth.uid) + 1 : 0;
    return `<button class="sr flat" data-duel="${esc(du.id)}">${svg(I.flame)}
      <span class="ml2"><span class="n">${esc(du.name)}</span>
        <span class="sub">${esc(shortWho(du.who) || 'Un compte')} · ${plur(du.total, 'question')}${
          r.length ? ' · ' + plur(r.length, 'joueur') : ''}</span></span>
      <span class="c">${me ? `<b class="dsc">${me.score}/${du.total}</b> ${pos === 1 ? '🥇' : pos + 'ᵉ'}`
        : '<span class="dnew">à jouer</span>'}</span>${svg(I.arrow)}</button>`;
  }).join('')}</div>`;
}
function boardPane() {
  const r = board.rows;
  const seg = `<div class="seg" id="bRange">${Object.entries(BRANGE).map(([k, n]) =>
    `<button class="${board.range === +k ? 'on' : ''}" data-brange="${k}">${n}</button>`).join('')}</div>`;
  if (!r) return `${seg}<div class="empty">${svg(I.trophy)}<p>${board.err ? 'Classement indisponible' : 'Chargement…'}</p></div>`;
  if (!r.length) return `${seg}<div class="empty">${svg(I.trophy)}<p><b>Personne n’a révisé</b>sur cette période.</p></div>`;
  const top = r[0].n || 1;
  const MED = ['🥇', '🥈', '🥉'];
  return `${seg}<div class="rows">${r.map((x, i) => `
    <div class="bdr ${x.uid === auth.uid ? 'me' : ''}">
      <span class="bdp">${MED[i] || (i + 1)}</span>
      <span class="bdn"><b>${esc(shortWho(x.who) || 'Compte')}</b>
        <i>${plur(+x.n, 'page')} · ${Math.round(x.ok / (x.n || 1) * 100)} % juste · ${plur(+x.jours, 'jour')}</i>
        <em style="width:${Math.max(4, Math.round(x.n / top * 100))}%"></em></span>
    </div>`).join('')}</div>
`;
}
function groupPull() {
  if (!groups) groupsPull();                  // sans eux, la barre de portée n'a rien à proposer
  if (groupTab === 'lib' && !lib.list) libPull();
  if (groupTab === 'duel' && !duels.list) duelsPull();
  if (groupTab === 'board' && !board.rows) boardPull();
}

/* ══════════ statistiques ══════════
   Tout se calcule à partir de la table des révisions : une ligne par
   carte jouée, avec la date, la réussite et le temps passé. Rien n'est
   pré-agrégé côté serveur — à l'échelle de quelques milliers de lignes,
   le navigateur va plus vite que l'aller-retour, et ça évite une vue SQL
   de plus à maintenir. */
const dayKey = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return +d; };
const dayLabel = t => new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

async function statsPull(bg) {
  try {
    const since = new Date(Date.now() - 365 * DAY).toISOString();
    const rows = await api('/rest/v1/reviews?select=deck_id,card_id,mode,rating,correct,ms,created_at'
      + `&created_at=gte.${since}&order=created_at.asc&limit=20000`);
    stats.rows = rows || [];
    stats.err = 0;
  } catch (e) { stats.err = 1; }
  /* Le rafraîchissement de fond ne redessine que si les chiffres ont
     bougé : sinon l'écran sautait toutes les quinze secondes pour rien. */
  const sig = (stats.rows || []).length + ':' + stats.err;
  const same = bg && sig === stats.sig;       // rafraîchissement de fond sans rien de neuf
  stats.sig = sig;
  if (view.name === 'stats' && !same) { animate = false; render(); }
}

/* index texte des cartes, pour nommer celles qui reviennent dans le top */
function cardIndex() {
  const m = new Map();
  for (const d of db.decks) for (const c of d.cards) m.set(c.id, { c, d });
  return m;
}

function computeStats() {
  const all = stats.rows || [];
  const cut = stats.range ? Date.now() - stats.range * DAY : 0;
  const R = all.filter(r => +new Date(r.created_at) >= cut);

  let ok = 0, ms = 0;
  const byDay = new Map(), byCard = new Map(), bySubj = new Map();
  for (const r of R) {
    if (r.correct) ok++;
    ms += r.ms || 0;
    const k = dayKey(r.created_at);
    const d = byDay.get(k) || { n: 0, ok: 0, ms: 0 };
    d.n++; if (r.correct) d.ok++; d.ms += r.ms || 0;
    byDay.set(k, d);
    if (!r.correct) byCard.set(r.card_id, (byCard.get(r.card_id) || 0) + 1);
    const deck = db.decks.find(x => x.id === r.deck_id);
    const sname = deck ? subj(deck.subject).name : 'Autres';
    bySubj.set(sname, (bySubj.get(sname) || 0) + (r.ms || 0));
  }

  /* Rétention : pour chaque carte, l'écart avec sa révision précédente dit
     à quelle distance la mémoire a été sollicitée. On garde trois paliers,
     ceux que tout le monde lit d'un coup d'œil. Calculé sur l'année pleine,
     pas sur la fenêtre choisie : à sept jours il n'y aurait rien à voir. */
  const seen = new Map(), ret = { 1: [0, 0], 7: [0, 0], 30: [0, 0] };
  for (const r of all) {
    const t = +new Date(r.created_at), prev = seen.get(r.card_id);
    if (prev != null) {
      const gap = (t - prev) / DAY;
      const b = gap < 3 ? 1 : gap < 14 ? 7 : gap < 90 ? 30 : 0;
      if (b) { ret[b][1]++; if (r.correct) ret[b][0]++; }
    }
    seen.set(r.card_id, t);
  }

  /* Série de jours : un jour de grâce par semaine entamée, sinon un
     week-end chez les grands-parents efface trois mois d'assiduité. */
  let streak = 0, grace = 0, cur = dayKey(Date.now());
  if (!byDay.has(cur)) cur -= DAY;               // la journée peut n'avoir pas commencé
  for (let k = cur; ; k -= DAY) {
    if (byDay.has(k)) { streak++; continue; }
    if (grace < Math.floor(streak / 7) + (streak ? 1 : 0)) { grace++; continue; }
    break;
  }

  const maxSubj = Math.max(1, ...bySubj.values());
  return {
    n: R.length, ok, ms, byDay, streak,
    per: R.length ? ms / R.length : 0,
    ret,
    subjects: [...bySubj.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ k, v, p: v / maxSubj })),
    worst: [...byCard.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
  };
}

/* Progression d'un paquet : la part des cartes vraiment installées.
   Elle se lit sur les cartes elles-mêmes, pas sur l'historique — c'est
   l'état actuel qui compte, pas le chemin parcouru. */
function deckProgress() {
  return live().map(d => {
    const k = { new: 0, learn: 0, young: 0, mature: 0, susp: 0 };
    d.cards.forEach(c => k[cstate(c)]++);
    const n = d.cards.length || 1;
    return { d, k, n: d.cards.length, pct: Math.round(k.mature / n * 100) };
  }).sort((a, b) => b.pct - a.pct);
}

function statsCSV() {
  const S = computeStats();
  const q = v => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [['section', 'clé', 'valeur'].join(';')];
  lines.push(['résumé', 'cartes revues', S.n].map(q).join(';'));
  lines.push(['résumé', 'réussite %', S.n ? Math.round(S.ok / S.n * 100) : 0].map(q).join(';'));
  lines.push(['résumé', 'temps total (min)', Math.round(S.ms / 60000)].map(q).join(';'));
  lines.push(['résumé', 'secondes par carte', (S.per / 1000).toFixed(1)].map(q).join(';'));
  lines.push(['résumé', 'série de jours', S.streak].map(q).join(';'));
  for (const [k, v] of [...S.byDay.entries()].sort((a, b) => a[0] - b[0]))
    lines.push(['jour', new Date(k).toISOString().slice(0, 10), v.n + ' cartes, ' + v.ok + ' justes'].map(q).join(';'));
  for (const s of S.subjects)
    lines.push(['temps par matière', s.k, Math.round(s.v / 60000) + ' min'].map(q).join(';'));
  for (const [b, [o, t]] of Object.entries(S.ret))
    if (t) lines.push(['rétention', b + ' jour(s)', Math.round(o / t * 100) + ' % sur ' + t].map(q).join(';'));
  const idx = cardIndex();
  for (const [id, fails] of S.worst) {
    const e = idx.get(id);
    lines.push(['page ratée', e ? e.c.f : id, fails + ' échecs'].map(q).join(';'));
  }
  for (const p of deckProgress())
    lines.push(['livre', p.d.name, p.pct + ' % mûres sur ' + p.n].map(q).join(';'));
  return '﻿' + lines.join('\n');       // BOM : Excel ouvre l'UTF-8 correctement
}

async function exportStats() {
  const csv = statsCSV();
  const name = 'cartes-stats-' + new Date().toISOString().slice(0, 10) + '.csv';
  const file = new File([csv], name, { type: 'text/csv' });
  /* Sur iPhone, une ancre à télécharger ne donne rien dans une app
     installée : la feuille de partage est le seul chemin qui aboutit. */
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Journal de lecture Folio' });
      return;
    }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  try {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast(I.check, 'Export téléchargé');
  } catch (e) {
    try { await navigator.clipboard.writeText(csv); toast(I.check, 'Export copié'); }
    catch (x) { toast(I.x, 'Export impossible'); }
  }
}

/* ---------- recherche globale ----------
   Un seul champ pour les paquets et les cartes : on cherche un mot, pas
   un endroit où chercher. Tout se fait en mémoire, la bibliothèque tient
   déjà entière dans le navigateur. */
function findResults(q) {
  const n = norm(q);
  if (!n) return { decks: [], cards: [] };
  const decks = live().filter(d => norm(d.name).includes(n)).slice(0, 12);
  const cards = [];
  for (const d of live()) {
    for (const c of d.cards) {
      if (norm(plain(c.f)).includes(n) || norm(plain(c.b)).includes(n)) cards.push({ c, d });
      if (cards.length >= 60) break;
    }
    if (cards.length >= 60) break;
  }
  return { decks, cards };
}

function findView() {
  $.innerHTML = `
    <div class="bar"><button class="ic" data-act="home" aria-label="Retour">${svg(I.back)}</button>
      <div class="fld"><input id="fq" type="search" placeholder="Chercher un mot, un livre…"
        autocomplete="off" autocapitalize="none" spellcheck="false" enterkeyhint="search"
        value="${esc(findQ)}" aria-label="Recherche"></div></div>
    <div class="page" id="fres"></div>`;
  paintFind();
  bindFind();
function paintFind() {
  const box = document.getElementById('fres'); if (!box) return;
  const r = findResults(findQ);
  box.innerHTML = `
      ${!findQ.trim() ? `<div class="empty">${svg(I.search)}</div>`
        : (!r.decks.length && !r.cards.length) ? `<div class="empty">${svg(I.search)}<p><b>Rien trouvé</b>pour « ${esc(findQ)} »</p></div>`
        : `${r.decks.length ? `<div class="lbl"><span>Livres</span><span>${r.decks.length}</span></div>
          <div class="slist">${r.decks.map(d => `<button class="sr flat" data-go="${d.id}">
            <i class="ldot" style="${sty(subj(d.subject))}"></i>
            <span class="n">${esc(d.name)}</span>
            <span class="c">${d.cards.length}</span>${svg(I.arrow)}</button>`).join('')}</div>` : ''}
        ${r.cards.length ? `<div class="lbl"><span>Pages</span><span>${r.cards.length}</span></div>
          <div class="slist">${r.cards.map(({ c, d }) => `<button class="sr flat" data-go="${d.id}">
            <span class="ml2"><span class="n">${hl(plain(c.f), findQ)}</span>
              <span class="sub">${hl(plain(c.b), findQ)} · ${esc(d.name)}</span></span>
            ${svg(I.arrow)}</button>`).join('')}</div>` : ''}`}`;
}
function bindFind() {
  const f = document.getElementById('fq');
  /* On ne redessine que les résultats. Redessiner l'écran entier
     recréait le champ à chaque lettre : il perdait le curseur et le
     clavier se refermait au milieu du mot. */
  let t = 0;
  f.addEventListener('input', () => {
    findQ = f.value;
    clearTimeout(t);
    t = setTimeout(paintFind, 90);
  });
  if (document.activeElement !== f) setTimeout(() => {
    f.focus(); f.setSelectionRange(f.value.length, f.value.length);
  }, 50);
}
}

/* surligne ce qui a été cherché, sans jamais laisser passer de balise */
function hl(txt, q) {
  const t = String(txt), n = norm(q);
  if (!n) return esc(t);
  const i = norm(t).indexOf(n);
  if (i < 0) return esc(t);
  return esc(t.slice(0, i)) + '<mark>' + esc(t.slice(i, i + q.trim().length)) + '</mark>'
    + esc(t.slice(i + q.trim().length));
}

/* Ce qui serait perdu en quittant maintenant : un exercice court, sans
   reprise possible, et déjà entamé. */
function lostOnLeave() {
  if (quiz && quiz.pool && quiz.i > 0 && quiz.i < quiz.pool.length) return true;
  if (study && study.mode && study.i > 0 && study.i < study.queue.length) return true;
  return false;
}

function statsView() {
  if (!stats.rows) {
    $.innerHTML = `<div class="bar"><button class="ic" data-act="home" aria-label="Retour">${svg(I.back)}</button></div>
      <div class="page"><div class="top"><div class="hero">Journal de lecture</div></div>
      <div class="empty">${svg(I.chart)}<p>${stats.err ? 'Statistiques indisponibles' : 'Chargement…'}</p></div></div>`;
    return;
  }
  const S = computeStats();
  const pct = S.n ? Math.round(S.ok / S.n * 100) : 0;
  const prog = deckProgress();
  const idx = cardIndex();

  /* dix-huit semaines de cases : le passé proche, celui sur lequel on peut
     encore agir. Au-delà, c'est de la décoration. */
  const days = [];
  const end = dayKey(Date.now());
  for (let k = end - 125 * DAY; k <= end; k += DAY) days.push(k);
  const maxDay = Math.max(1, ...[...S.byDay.values()].map(v => v.n));
  const cols = [];
  for (let i = 0; i < days.length; i += 7) cols.push(days.slice(i, i + 7));

  $.innerHTML = `
    <div class="bar"><button class="ic" data-act="home" aria-label="Retour">${svg(I.back)}</button></div>
    <div class="page">
      <div class="top"><div class="hero">Journal de lecture</div></div>
      <div class="seg" id="stRange">
        ${[[7, '7 jours'], [30, '30 jours'], [0, 'Tout']].map(([v, l]) =>
          `<button data-strange="${v}" class="${stats.range === v ? 'on' : ''}">${l}</button>`).join('')}
      </div>

      <div class="tiles st4">
        <div class="st"><b>${S.n}</b><span>pages lues</span></div>
        <div class="st"><b>${pct}%</b><span>de réussite</span></div>
        <div class="st"><b>${Math.round(S.ms / 60000)}</b><span>minutes</span></div>
        <div class="st"><b>${(S.per / 1000).toFixed(1).replace('.', ',')}s</b><span>par page</span></div>
      </div>

      <div class="lbl"><span>Assiduité</span><span>${S.streak ? S.streak + ' jour' + (S.streak > 1 ? 's' : '') + ' d’affilée' : ''}</span></div>
      <div class="card2">
        <div class="heat">${cols.map(col => `<div class="hc">${col.map(k => {
          const v = S.byDay.get(k);
          const lvl = !v ? 0 : v.n >= maxDay * .66 ? 4 : v.n >= maxDay * .33 ? 3 : v.n >= 2 ? 2 : 1;
          return `<i class="l${lvl}" title="${dayLabel(k)}${v ? ' · ' + v.n + ' pages' : ''}"></i>`;
        }).join('')}</div>`).join('')}</div>
        <div class="heatk"><span>${dayLabel(days[0])}</span><span>aujourd’hui</span></div>
      </div>

      <div class="lbl"><span>Ces sept jours</span></div>
      <div class="card2">${weekBars(S)}</div>

      <div class="lbl"><span>Où en sont tes livres</span><span>${prog.length || ''}</span></div>
      <div class="card2">
        ${prog.length ? prog.map(p => `<div class="bkline">
          <span class="bkn">${esc(p.d.name)}<i>${p.k.mature} sue${p.k.mature > 1 ? 's' : ''} sur ${p.n}</i></span>
          <span class="mix sm">${['new', 'learn', 'young', 'mature'].filter(x => p.k[x])
            .map(x => `<i class="${x}" style="flex:${p.k[x]}"></i>`).join('')}</span>
        </div>`).join('') + `<div class="bkkey">${['new', 'learn', 'young', 'mature']
            .map(x => `<span><i class="${x}"></i>${STATE[x]}</span>`).join('')}</div>`
          : '<div class="note">Aucun livre pour l’instant.</div>'}
      </div>

      ${S.subjects.length ? `<div class="lbl"><span>Temps par matière</span></div>
      <div class="card2">
        ${S.subjects.map(x => `<div class="brow"><span class="bl">${esc(x.k)}</span>
          <span class="bt"><i style="width:${Math.round(x.p * 100)}%;background:${
            subjColorByName(x.k)}"></i></span>
          <span class="bv">${x.v >= 60000 ? Math.round(x.v / 60000) + ' min' : Math.round(x.v / 1000) + ' s'}</span></div>`).join('')}
      </div>` : ''}

      ${S.worst.length ? `<div class="lbl"><span>Pages les plus ratées</span><span>${S.worst.length}</span></div>
      <div class="slist">
        ${S.worst.map(([id, fails]) => {
          const e = idx.get(id);
          return `<button class="sr flat wrow" ${e ? `data-go="${e.d.id}"` : ''}>
            <i class="wn">${fails}</i>
            <span class="ml2"><span class="n">${e ? esc(e.c.f) : 'Carte supprimée'}</span>
              <span class="sub">${e ? esc(e.c.b) : ''}</span></span>
            ${e ? svg(I.arrow) : ''}</button>`;
        }).join('')}
      </div>` : ''}

      <button class="lnk" data-act="expstats" style="margin:16px auto 0">${svg(I.down)}Exporter en CSV</button>
    </div>`;
  const seg = document.getElementById('stRange');
  seg.addEventListener('click', e => {
    const b = e.target.closest('[data-strange]'); if (!b) return;
    stats.range = +b.dataset.strange; animate = false; render();
  });
}

/* Les sept derniers jours, en colonnes : on voit d'un coup les jours
   travaillés et les jours sautés, sans avoir à lire un pourcentage. */
/* Les sept derniers jours. Le chiffre vit au-dessus de la barre, dans sa
   propre ligne : il a toujours sa place, même quand la barre est minuscule.
   La barre, elle, occupe le reste de la hauteur, en proportion du meilleur
   jour de la semaine — 96 et 125 ne doivent pas se ressembler. */
function weekBars(S) {
  const out = [];
  const days = [...Array(7)].map((_, i) => {
    const t = Date.now() - (6 - i) * DAY;
    const v = S.byDay.get(dayKey(t));
    return { t, n: v ? v.n : 0 };
  });
  const top = Math.max(1, ...days.map(d => d.n));
  for (const { t, n } of days) {
    const h = n ? Math.max(8, Math.round(n / top * 100)) : 0;
    out.push(`<div class="wd"><b>${n || ''}</b>
      <u><i style="height:${h}%" class="${n ? '' : 'nil'}"></i></u>
      <span>${['D', 'L', 'M', 'M', 'J', 'V', 'S'][new Date(t).getDay()]}</span></div>`);
  }
  return `<div class="week">${out.join('')}</div>`;
}
/* la couleur d'une matière depuis son nom : les statistiques agrègent par
   nom, pas par identifiant */
const subjColorByName = name => {
  const t = db.subjects.find(x => x.name === name);
  return t ? (PALETTE[t.color] || PALETTE.graphite).d : 'var(--soft)';
};

/* ---------- pages d'un PDF ----------
   Une feuille légère, hors du système de menus : elle se referme d'
   elle-même et rend la main au code qui l'a ouverte. Laisser le champ
   vide prend tout le document. */
function askPages(done) {
  document.querySelectorAll('.scrim,.menu').forEach(n => n.remove());
  const w = document.createElement('div');
  w.innerHTML = `<div class="scrim" id="pgx"></div>
    <div class="menu">
      <div class="mi" style="font-weight:750">${svg(I.file)}Quelles pages ?</div>
      <input class="tok" id="pgin" placeholder="Toutes les pages" spellcheck="false"
        autocapitalize="none" inputmode="numeric" enterkeyhint="done">
      <div class="note">Par exemple <b>3-7</b> pour une suite, <b>2, 5, 9</b> pour un choix,
        ou rien du tout pour prendre le document entier.</div>
      <button class="mi" id="pgok" style="justify-content:center;font-weight:700">
        ${svg(I.check)}Lire le PDF</button>
    </div>`;
  mountMenu(w);
  const inp = document.getElementById('pgin');
  const close = () => document.querySelectorAll('.scrim,.menu').forEach(n => n.remove());
  const go2 = () => { const v = inp.value.trim(); close(); done(v); };
  document.getElementById('pgok').onclick = go2;
  document.getElementById('pgx').onclick = close;
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go2(); } });
  setTimeout(() => inp.focus(), 60);
}

/* ---------- menu contextuel ---------- */
function openMenu(kind) { menu = kind; paintMenu(); }
function closeMenu() {
  menu = null;
  document.querySelectorAll('.scrim,.menu').forEach(n => n.remove());
  document.documentElement.classList.remove('sheet-open');
}
/* Une feuille peut porter beaucoup de contenu (les matières, la liste
   des paquets à fusionner…) : plus que l'écran n'en montre d'un coup.
   Elle défile donc sur elle-même — poignée et croix restent fixes en
   tête, toujours à portée, et le reste du texte qui suit prend la place
   qu'il lui faut sans jamais entraîner l'écran de dessous. */
function mountMenu(w) {
  const box = w.querySelector('.menu');
  if (box) {
    /* Une feuille flotte au-dessus de la page, mais la page en dessous
       reste le vrai document qui défile : sans le geler, un doigt posé
       sur la feuille — ou sur le voile autour d'elle, dès qu'il n'y a
       rien à faire défiler à cet endroit précis — continuait de faire
       glisser tout l'écran derrière. */
    document.documentElement.classList.add('sheet-open');
    const body = document.createElement('div');
    body.className = 'mbody';
    while (box.firstChild) body.appendChild(box.firstChild);
    box.insertAdjacentHTML('afterbegin',
      `<div class="mtop"><i class="mgrip"></i><button class="mx" data-mact="close" aria-label="Fermer">${svg(I.x)}</button></div>`);
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.appendChild(body);
    bindSheetDrag(box, body);
  }
  document.body.append(...w.childNodes);
  paintMedia();               // l'aperçu d'image de la feuille d'édition
}
/* Tirer la feuille vers le bas la ferme, comme partout ailleurs sur un
   téléphone. Sans ça, une feuille courte — une explication, un code —
   n'avait aucune réponse au geste : on tirait et il ne se passait rien.
   Le geste ne prend la main que si le contenu est déjà en haut, sinon
   c'est le texte qui doit défiler. */
function bindSheetDrag(box, body) {
  const head = box.querySelector('.mtop');
  let y0 = 0, dy = 0, on = false, lock = 0, t0 = 0, pid = -1, pts = 0;
  /* Un seul doigt, et seulement vers le bas. Sans ces deux gardes, la
     feuille suivait n'importe quel geste — deux doigts la déplaçaient et
     la pinçaient comme une image. */
  const cancel = () => {
    on = false; pid = -1;
    box.style.transition = ''; box.style.transform = '';
    const sc = document.querySelector('.scrim'); if (sc) sc.style.opacity = '';
  };
  const start = e => {
    pts++;
    if (pts > 1) return cancel();
    if (e.pointerType === 'mouse' && e.button) return;
    if (e.target.closest('input,textarea,button,.seg,.rng,.mgrid')) return;
    if (body.scrollTop > 2 && !head.contains(e.target)) return;
    on = true; lock = 0; dy = 0; y0 = e.clientY; t0 = Date.now(); pid = e.pointerId;
    box.style.transition = 'none';
  };
  const move = e => {
    if (!on || e.pointerId !== pid || pts > 1) return;
    dy = e.clientY - y0;
    if (!lock) {
      if (Math.abs(dy) < 7) return;
      /* vers le haut : ce n'est pas une fermeture, on rend la main */
      if (dy < 0) { on = false; box.style.transition = ''; box.style.transform = ''; return; }
      lock = 1;
    }
    box.style.transform = `translateY(${dy.toFixed(1)}px)`;
    const sc = document.querySelector('.scrim');
    if (sc) sc.style.opacity = Math.max(0, 1 - dy / 320);
  };
  const end = () => {
    pts = Math.max(0, pts - 1);
    if (!on) return; on = false; pid = -1;
    box.style.transition = '';
    const v = dy / Math.max(1, Date.now() - t0);
    if (dy > 110 || (v > .55 && dy > 40)) {
      box.style.transform = 'translateY(110%)';
      const sc = document.querySelector('.scrim'); if (sc) sc.style.opacity = 0;
      setTimeout(() => { closeMenu(); render(); }, 220);
      return;
    }
    box.style.transform = '';
    const sc = document.querySelector('.scrim'); if (sc) sc.style.opacity = '';
  };
  box.addEventListener('pointerdown', start);
  box.addEventListener('pointermove', move);
  box.addEventListener('pointerup', end);
  box.addEventListener('pointercancel', () => { pts = Math.max(0, pts - 1); cancel(); });
  box.addEventListener('gesturestart', e => { e.preventDefault(); cancel(); });
}
function paintMenu() {
  document.querySelectorAll('.scrim,.menu').forEach(n => n.remove());
  document.documentElement.classList.remove('sheet-open');
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
    mountMenu(w);
    const sn = document.getElementById('sn');
    sn.addEventListener('input', () => subjName = sn.value);
    sn.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); sn.blur(); } });
    setTimeout(() => { if (!subjName) sn.focus(); }, 60);
    return;
  }
  if (menu === 'install') return installSheet(w);
  if (menu === 'newclass' || menu === 'joinclass') {
    const mk = menu === 'newclass';
    w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu">
        <div class="mhd">${svg(mk ? I.plus : I.key)}<span class="mhx">
          <b>${mk ? 'Créer une classe' : 'Rejoindre une classe'}</b></span></div>
        <input class="tok" id="cn" placeholder="${mk ? 'Nom de la classe — 2nde B' : 'Code de la classe'}"
          autocapitalize="${mk ? 'sentences' : 'characters'}" autocorrect="off" spellcheck="false"
          enterkeyhint="done" maxlength="${mk ? 40 : 8}">
        ${mk ? `<input class="tok" id="cl" placeholder="Niveau — Seconde (facultatif)"
          autocorrect="off" spellcheck="false" maxlength="20">` : ''}
        <button class="mi" data-mact="${mk ? 'doclass' : 'doclassjoin'}"
          style="justify-content:center;font-weight:700">${svg(I.check)}${mk ? 'Créer' : 'Rejoindre'}</button>
      </div>`;
    mountMenu(w);
    setTimeout(() => { const f = document.getElementById('cn'); if (f) f.focus(); }, 60);
    return;
  }
  /* Donner un devoir vit maintenant dans une seule feuille : `compSheet`,
     qui sait aussi bien reprendre un livre de la bibliothèque que le
     fabriquer sur place. Hors établissement, l'ancien envoi direct reste
     la bonne réponse — il n'y a qu'une classe et rien à composer. */
  if (menu === 'compo') return compSheet(w);
  if (menu === 'plivre') {
    const l = live();
    w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu pv">
        <div class="mhd">${svg(I.book)}<span class="mhx"><b>Quel livre ?</b></span></div>
        ${!l.length ? `<div class="mlbl">Ta bibliothèque est vide</div>`
          : `<div class="mscroll">${l.map(d => `<button class="mi" data-plivre="${esc(d.id)}">
              ${svg(I.book)}<span>${esc(d.name)}</span>
              <span class="tail">${plur(d.cards.length, 'page')}</span></button>`).join('')}</div>`}
      </div>`;
    mountMenu(w);
    return;
  }
  if (menu === 'pwork') return workSheet(w);
  if (menu === 'pmot') {
    /* Un mot dans le courrier de l'élève, sans paquet joint. Le seul canal
       que l'app possède : elle n'envoie ni notification ni e-mail, et
       laisser croire le contraire serait pire que ne rien proposer. */
    const m = (prof.roster || []).find(x => x.user_id === prof.eleve);
    if (!m) { menu = null; return; }
    w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu">
        <div class="mhd"><i class="av">${esc(initial(m.who))}</i>
          <span class="mhx"><b>Un mot à ${esc(m.who.split(' ')[0])}</b></span></div>
        <div class="rform"><label>Ton message
          <textarea id="pmt" rows="4" spellcheck="true"
            placeholder="Reprends la série 2, on la refait jeudi."></textarea></label></div>
        <button class="mi" data-mact="pmotgo" style="justify-content:center;font-weight:700">
          ${svg(I.mail2)}Envoyer</button>
      </div>`;
    mountMenu(w);
    setTimeout(() => { const i = document.getElementById('pmt'); if (i) i.focus(); }, 60);
    return;
  }
  if (menu === 'newwork') {
    const l = live();
    w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu">
        <div class="mhd">${svg(I.share)}<span class="mhx"><b>Donner un devoir</b></span></div>
        ${!l.length ? `<div class="note" style="padding:4px 18px 14px">Aucun livre à donner.</div>`
          : `<div class="mscroll">${l.map(d => `<button class="mi" data-give="${esc(d.id)}">
               ${svg(I.book)}<span>${esc(d.name)}</span>
               <span class="tail">${plur(d.cards.length, 'page')}</span></button>`).join('')}</div>`}
      </div>`;
    mountMenu(w);
    return;
  }
  /* ---------- les feuilles du référent ---------- */
  if (menu === 'refwho') {
    const g = ref.who;
    if (!g) { menu = null; return; }
    const f = ref.form || {};
    const eleve = g.role === 'eleve';
    w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu pv">
        <div class="mhd"><i class="av">${esc(initial(g.name))}</i>
          <span class="mhx"><b>${esc(g.name)}</b>
            <i>@${esc(g.handle || '')} · ${esc(ROLENOM[g.role] || g.role)}${
              g.jamais ? ' · jamais venu' : ' · vu ' + timeAgo(g.derniere)}</i></span></div>
        <div class="mscroll">
          <div class="rform">
            <label>Nom<input id="fnom" value="${esc(g.name)}" spellcheck="false"></label>
            <label>Pseudo<input id="fpse" value="${esc(g.handle || '')}" spellcheck="false"
              autocapitalize="none"></label>
            <label>Adresse<input id="fmel" value="${esc(g.email)}" spellcheck="false"
              autocapitalize="none" type="email"></label>
          </div>
          <button class="mi" data-mact="refsave">${svg(I.check)}<span>Enregistrer l’identité</span></button>
          <div class="msep"></div>

          <div class="rform">
            <label>Nouveau mot de passe
              <input id="fpw" value="${esc(f.pw || '')}" spellcheck="false" autocapitalize="none"
                placeholder="dix caractères au moins"></label>
          </div>
          <button class="mi" data-mact="refpw">${svg(I.key)}<span>Refaire le mot de passe</span>
            <span class="tail">à lire à l’intéressé</span></button>
          <div class="msep"></div>

          ${eleve ? `<div class="mlbl">Classe</div>
            <div class="mscroll courte">${(ref.classes || []).map(c => `
              <button class="mi${g.class_id === c.id ? ' on' : ''}" data-rmove="${esc(c.id)}">
                ${svg(g.class_id === c.id ? I.check : I.arrow)}<span>${esc(c.name)}</span>
                <span class="tail">${c.effectif} él.</span></button>`).join('')}</div>
            ${g.class_id ? `<button class="mi warn" data-rmove="">${svg(I.x)}
              <span>Retirer de sa classe</span></button>` : ''}`
          : `<div class="mlbl">Service d’enseignement</div>
            ${!ref.service ? ``
              : !ref.service.length ? ``
              : `<div class="mscroll courte">${ref.service.map(s => `<div class="mi lect">
                  ${svg(I.school)}<span>${esc(s.classe)} · ${esc(s.matiere)}${
                    s.principal ? ' (PP)' : ''}</span>
                  <button class="tail warn" data-rdropt="${esc(s.teaching_id)}">retirer</button>
                  </div>`).join('')}</div>`}`}
          <div class="msep"></div>
          <div class="mlbl">Rôle</div>
          ${['eleve', 'prof'].map(k => `<button class="mi${g.role === k ? ' on' : ''}"
            data-rrolechg="${k}">${svg(g.role === k ? I.check : I.arrow)}${ROLENOM[k]}</button>`).join('')}
        </div>
      </div>`;
    mountMenu(w);
    if (g.role !== 'eleve' && !ref.service) refService(g.id);
    return;
  }
  if (menu === 'refcls') {
    const c = (ref.classes || []).find(x => x.id === ref.open);
    if (!c) { menu = null; return; }
    const f = ref.form || {};
    w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu pv">
        <div class="mhd">${svg(I.school)}<span class="mhx"><b>${esc(c.name)}</b>
          <i>${esc(c.niveau || '')}${c.filiere ? ' · ' + esc(c.filiere) : ''} · ${
            plur(c.effectif, 'élève')} · code ${esc(c.code || '—')}</i></span></div>
        <div class="mscroll">
          <div class="rform">
            <label>Nom<input id="knom" value="${esc(c.name)}" spellcheck="false"></label>
            <label>Niveau<input id="kniv" value="${esc(c.niveau || '')}" spellcheck="false"></label>
            <label>Filière<input id="kfil" value="${esc(c.filiere || '')}" spellcheck="false"></label>
            <label>Effectif prévu<input id="kpre" value="${c.prevu || ''}" inputmode="numeric"></label>
          </div>
          <button class="mi" data-mact="refclssave">${svg(I.check)}<span>Enregistrer</span></button>
          <button class="mi" data-mact="refclsgens">${svg(I.users)}
            <span>Voir ses ${plur(c.effectif, 'élève')}</span></button>
          <div class="msep"></div>

          <div class="mlbl">Équipe pédagogique</div>
          ${!ref.team ? ``
            : !ref.team.length ? ``
            : `<div class="mscroll courte">${ref.team.map(t => `<div class="mi lect">
                ${svg(t.principal ? I.check : I.user)}
                <span>${esc(t.nom)} · ${esc(t.matiere)}${t.principal ? ' (PP)' : ''}</span>
                <button class="tail" data-rpp="${esc(t.teacher)}|${esc(t.matiere)}">PP</button>
                <button class="tail warn" data-rdropt="${esc(t.teaching_id)}">retirer</button>
                </div>`).join('')}</div>`}
          <div class="rform">
            <label>Ajouter un professeur — matière
              <input id="tmat" value="${esc(f.mat || '')}" spellcheck="false"
                placeholder="Mathématiques"></label>
          </div>
          <div class="mscroll courte">${(ref.gens || []).filter(x => x.role === 'prof').map(p => `
            <button class="mi" data-raddt="${esc(p.id)}">${svg(I.plus)}<span>${esc(p.name)}</span>
              <span class="tail">${esc(p.matiere || '')}</span></button>`).join('')
            || ``}</div>
          <div class="msep"></div>
          <button class="mi warn" data-mact="refclsdel">${svg(I.trash)}
            <span>Supprimer la classe</span>
            <span class="tail">${c.effectif ? 'videz-la d’abord' : ''}</span></button>
        </div>
      </div>`;
    mountMenu(w);
    if (!ref.team) refTeam(c.id);
    return;
  }
  if (menu === 'refnew' || menu === 'refnewclass') {
    const cpt = menu === 'refnew';
    const f = ref.form || {};
    w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu pv">
        <div class="mhd">${svg(I.plus)}<span class="mhx">
          <b>${cpt ? 'Ouvrir un compte' : 'Créer une classe'}</b></span></div>
        <div class="mscroll">
          ${cpt ? `<div class="rform">
              <label>Adresse<input id="nmel" value="${esc(f.mel || '')}" type="email"
                autocapitalize="none" spellcheck="false" placeholder="prenom.nom@lycee.fr"></label>
              <label>Nom<input id="nnom" value="${esc(f.nom || '')}" spellcheck="false"></label>
              <label>Pseudo (facultatif)<input id="npse" value="${esc(f.pse || '')}"
                autocapitalize="none" spellcheck="false"></label>
              <label>Mot de passe<input id="npw" value="${esc(f.pw || '')}"
                autocapitalize="none" spellcheck="false" placeholder="dix caractères au moins"></label>
            </div>
            <div class="mlbl">Rôle</div>
            ${['eleve', 'prof'].map(k => `<button class="mi${(f.role || 'eleve') === k ? ' on' : ''}"
              data-rnrole="${k}">${svg((f.role || 'eleve') === k ? I.check : I.arrow)}${ROLENOM[k]}</button>`).join('')}
            ${(f.role || 'eleve') === 'eleve' ? `
              <div class="mlbl">Classe</div>
              <div class="mscroll courte">${(ref.classes || []).map(c => `
                <button class="mi${f.cls === c.id ? ' on' : ''}" data-rncls="${esc(c.id)}">
                  ${svg(f.cls === c.id ? I.check : I.arrow)}<span>${esc(c.name)}</span>
                  <span class="tail">${c.effectif} él.</span></button>`).join('')}</div>` : ''}`
          : `<div class="rform">
              <label>Nom de la classe<input id="knom" value="${esc(f.nom || '')}"
                spellcheck="false" placeholder="2nde 4"></label>
              <label>Niveau<input id="kniv" value="${esc(f.niv || '')}" spellcheck="false"
                placeholder="Seconde"></label>
              <label>Filière (facultatif)<input id="kfil" value="${esc(f.fil || '')}"
                spellcheck="false"></label>
              <label>Effectif prévu<input id="kpre" value="${esc(f.pre || '')}" inputmode="numeric"></label>
            </div>
            <div class="mlbl">Cycle</div>
            ${Object.entries(CYCLES).map(([k, n]) => `<button class="mi${f.cyc === k ? ' on' : ''}"
              data-rncyc="${k}">${svg(f.cyc === k ? I.check : I.arrow)}${n}</button>`).join('')}`}
          <div class="msep"></div>
          <button class="mi" data-mact="${cpt ? 'refdonew' : 'refdonewclass'}"
            style="justify-content:center;font-weight:700">${svg(I.check)}${
              cpt ? 'Ouvrir le compte' : 'Créer la classe'}</button>
        </div>
      </div>`;
    mountMenu(w);
    setTimeout(() => { const i = document.getElementById(cpt ? 'nmel' : 'knom'); if (i) i.focus(); }, 60);
    return;
  }
  if (menu === 'devoir') {
    const a = (asgs || []).find(x => x.id === workOpen);
    if (!a) { menu = null; return; }
    const tard = a.due && Date.parse(a.due + 'T12:00:00') < Date.now();
    w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu">
        <div class="mhd">${svg(I.card)}<span class="mhx"><b>${esc(a.name)}</b>
          <i>${plur(a.n, 'page')}${a.due ? ' · ' + dueLabel(a.due) : ''}</i></span></div>
        <button class="mi" data-mact="takework" style="justify-content:center;font-weight:700">
          ${svg(I.plus)}Ajouter à ma bibliothèque</button>
      </div>`;
    mountMenu(w);
    return;
  }
  if (menu === 'classcode') {
    /* Le code se projette au tableau : il doit être lisible du fond de la
       salle, pas niché dans un coin d'écran. */
    const k = (prof.classes || []).find(x => x.id === prof.open) || {};
    w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu">
        <div class="mhd">${svg(I.key)}<span class="mhx"><b>${esc(k.name || 'Cette classe')}</b></span></div>
        <div class="bigcode">${esc(k.code || '—')}</div>
        <div class="note" style="padding:0 18px 16px;text-align:center">${
          k.jamais ? `${plur(k.jamais, 'élève')} n’${k.jamais > 1 ? 'ont' : 'a'} jamais ouvert l’app.`
                   : 'Tous tes élèves ont déjà ouvert l’app au moins une fois.'}</div>
      </div>`;
    mountMenu(w);
    return;
  }
  if (menu === 'workone') {
    const a = (asgs || []).find(x => x.id === workOpen);
    const c = (classes || []).find(x => x.id === classOf);
    if (!a || !c) { menu = null; return; }
    const owner = c.owner === auth.uid;
    w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu">
        <div class="mhd">${svg(I.card)}<span class="mhx"><b>${esc(a.name)}</b>
          <i>${plur(a.n, 'page')}${a.due ? ' · ' + dueLabel(a.due) : ''}</i></span></div>
        ${owner ? `<div class="note" style="padding:0 18px 10px" id="wprog">Chargement du suivi…</div>
          <button class="mi warn" data-mact="delwork">${svg(I.trash)}<span>Retirer ce devoir</span></button>`
        : `<button class="mi" data-mact="takework" style="justify-content:center;font-weight:700">
             ${svg(I.plus)}Ajouter à ma bibliothèque</button>`}
      </div>`;
    mountMenu(w);
    if (owner) workProgress(a.id);
    return;
  }
  if (menu === 'member') {
    const m = (roster || []).find(x => x.user_id === memberOpen);
    if (!m) { menu = null; return; }
    w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu">
        <div class="mhd"><i class="av">${esc(initial(m.who))}</i>
          <span class="mhx"><b>${esc(m.who || 'Élève')}</b></span></div>
        <button class="mi warn" data-mact="dropmember">${svg(I.x)}<span>Retirer de la classe</span></button>
      </div>`;
    mountMenu(w);
    return;
  }
  if (menu === 'account') return accountSheet(w);
  if (menu === 'report') return reportSheet(w);
  if (menu === 'blocked') return blockedSheet(w);
  if (menu === 'backup') {
    const n = db.decks.length, c = db.decks.reduce((a, x) => a + x.cards.length, 0);
    w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu">
        <button class="mi" data-mact="backup">${svg(I.share)}Sauvegarder
          <span class="tail">${n} · ${c}</span></button>
      </div>`;
    mountMenu(w);
    return;
  }
  if (menu === 'card') {
    const d = deck(view.id), c = d && d.cards.find(x => x.id === cardEdit);
    if (!c) { menu = null; return; }
    const med = (side, kind) => {
      const k = side + (kind === 'img' ? 'i' : 'a');
      const has = c[k];
      return `<button class="mb ${has ? 'on' : ''}" data-mact="med-${k}">
        ${kind === 'img' && has ? mimg('', has) : svg(kind === 'img' ? I.image : I.mic)}
        ${has ? `<i class="rmv" data-mact="del-${k}">${svg(I.x)}</i>` : ''}</button>`;
    };
    w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu">
        <div class="mhd">${svg(I.card)}
          <span class="mhx"><b>${esc(plain(c.f) || 'Carte')}</b>
            <i>${esc(plain(c.b)) || 'verso vide'}</i></span></div>
        ${c.S ? `<div class="mrow"><span class="ml">${svg(I.brain)}Mémoire</span>
          <span class="tail">${memLine(c)}</span></div>
          <div class="mrow"><span class="ml">${svg(I.clock)}Prochain passage</span>
          <span class="tail">${nextIn(c) || '—'}</span></div>` : ''}
        <div class="seg mseg">
          ${[['', 'Basique'], ['tf', 'Vrai / faux']].map(([v, l]) =>
            `<button data-ct="${v}" class="${(c.t || '') === v ? 'on' : ''}">${l}</button>`).join('')}
        </div>
        <div class="mrow">
          <span class="ml">Image et son du recto</span>${med('f', 'img')}${med('f', 'aud')}
        </div>
        <div class="mrow">
          <span class="ml">Image et son du verso</span>${med('b', 'img')}${med('b', 'aud')}
        </div>
        <input class="tok" id="ctags" placeholder="Étiquettes, séparées par des virgules"
          value="${esc((c.g || []).join(', '))}" autocapitalize="none" spellcheck="false">
        ${recorder ? `<button class="mi warn" data-mact="rec-stop"
          style="justify-content:center;font-weight:700">${svg(I.mic)}<span>Arrêter l’enregistrement</span></button>` : ''}
        <button class="mi" data-mact="card-ok"
          style="justify-content:center;font-weight:700">${svg(I.check)}<span>Enregistrer</span></button>
      </div>`;
    mountMenu(w);
    return;
  }
  if (menu === 'deckset') {
    const d = deck(view.id); if (!d) { menu = null; return; }
    const m = metaOf(d);
    w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu">
        <div class="mi" style="font-weight:750">${svg(I.gear)}Réglages du livre</div>
        <div class="mrow col"><span class="ml">${svg(I.target)}Tolérance du quiz</span>
          <div class="seg mseg">
            ${[['strict', 'Stricte'], ['normal', 'Normale'], ['soft', 'Souple']].map(([v, l]) =>
              `<button data-tol="${v}" class="${m.tol === v ? 'on' : ''}">${l}</button>`).join('')}
          </div></div>
        <div class="mrow col"><span class="ml">${svg(I.sound)}Langue du recto</span>
          <div class="seg mseg wrap">
            ${LANGS.map(([v, l]) => `<button data-lgf="${v}" class="${m.langf === v ? 'on' : ''}">${l}</button>`).join('')}
          </div></div>
        <div class="mrow col"><span class="ml">${svg(I.sound)}Langue du verso</span>
          <div class="seg mseg wrap">
            ${LANGS.map(([v, l]) => `<button data-lgb="${v}" class="${m.langb === v ? 'on' : ''}">${l}</button>`).join('')}
          </div></div>
        <div class="mrow col"><span class="ml">${svg(I.clock)}Chrono par question</span>
          <div class="seg mseg">
            ${[[0, 'Aucun'], [5, '5 s'], [10, '10 s'], [20, '20 s']].map(([v, l]) =>
              `<button data-tm="${v}" class="${m.timer === v ? 'on' : ''}">${l}</button>`).join('')}
          </div></div>
      </div>`;
    mountMenu(w);
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
         reste que le balayage : à droite je sais, à gauche je ne sais pas.`,
        `La mémoire ne bouge plus. Une page revue en mode simple garde exactement la
         stabilité et la difficulté qu’elle avait — réviser en mode simple n’apprend rien
         au moteur.`,
        `La barre de maturité et les pastilles d’état ne s’affichent plus.`,
        `Le tri « Urgentes » disparaît : il n’y a plus de date pour trier.`
      ]),
      bloc('Ce qui est conservé', [
        `<b>Rien n’est effacé.</b> Stabilité, difficulté, échéance et historique de
         révisions restent écrits dans chaque page et t’attendent.`,
        `La récitation, l’objectif du jour, le résumé de fin de session, les courbes, les
         matières, les pages mises de côté et les sauvegardes fonctionnent à l’identique.`,
        `Les pages ratées continuent d’être comptées : le tri « Ratées » et les pages
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
        `Le calcul de la prochaine date : le moteur estime pour chaque page ta probabilité
         de t’en souvenir, puis la programme au jour où elle tombe sur ta rétention visée.
         Plus la page est solide, plus il attend ; plus elle résiste, plus il resserre.`
      ]),
      bloc('Où en est ta progression', [
        `Le moteur reprend au point exact où il s’était arrêté${since ? ` il y a ${since} jour${since > 1 ? 's' : ''}` : ''}.
         Aucune donnée n’a été perdue pendant le mode simple.`,
        n ? `<b>${n > 1 ? `${n} pages ont dépassé leur échéance.` : `Une page a dépassé son échéance.`}</b> ${n > per
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
    mountMenu(w);
    return;
  }
  if (menu === 'merge') {
    const d = deck(view.id); if (!d) { menu = null; return; }
    const others = db.decks.filter(x => x.id !== d.id);
    w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu">
        <div class="mi" style="font-weight:750">${svg(I.link)}Fusionner « ${esc(d.name)} » avec</div>
        <div class="mscroll">${others.map(x => `<button class="mi" data-merge="${x.id}">
          <i class="tri" style="--c:${subj(x.subject).c}"></i>${esc(x.name)}
          <span class="tail">${x.cards.length}</span></button>`).join('')}</div>
      </div>`;
    mountMenu(w);
    return;
  }
  if (menu === 'fnr') {
    const d = deck(view.id); if (!d) { menu = null; return; }
    const s = fnrScan(d);
    w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu">
        <div class="mi" style="font-weight:750">${svg(I.search)}Chercher et remplacer</div>
        <div class="frow"><input class="tok" id="fq" placeholder="Chercher" spellcheck="false"
          autocapitalize="none" value="${esc(fnr.q)}">
          <button class="cs ${fnr.cs ? 'on' : ''}" data-mact="fnrcase" title="Respecter la casse">Aa</button></div>
        <input class="tok" id="fr" placeholder="Remplacer par" spellcheck="false"
          autocapitalize="none" value="${esc(fnr.r)}">
        <div class="mrow col"><span class="ml">${svg(I.card)}Où chercher</span>
          <div class="seg mseg">
            ${[['both', 'Les deux'], ['f', 'Recto'], ['b', 'Verso']].map(([v, l]) =>
              `<button data-fside="${v}" class="${fnr.side === v ? 'on' : ''}">${l}</button>`).join('')}
          </div></div>
        <div class="note" id="fnote">${fnrNote(s)}</div>
        <button class="mi" data-mact="dofnr" ${s.hits ? '' : 'disabled'}
          style="justify-content:center;font-weight:700">${svg(I.check)}<span>Remplacer</span></button>
      </div>`;
    mountMenu(w);
    /* on ne repeint jamais la feuille en cours de frappe : cela arracherait
       le curseur du champ. Seuls le compte et le bouton se mettent à jour. */
    const q = document.getElementById('fq'), r = document.getElementById('fr');
    const refresh = () => {
      fnr.q = q.value; fnr.r = r.value;
      const k = fnrScan(d);
      document.getElementById('fnote').innerHTML = fnrNote(k);
      const btn = document.querySelector('[data-mact="dofnr"]');
      k.hits ? btn.removeAttribute('disabled') : btn.setAttribute('disabled', '');
    };
    q.addEventListener('input', refresh); r.addEventListener('input', refresh);
    setTimeout(() => q.focus(), 60);
    return;
  }
  if (menu === 'leave') {
    const n = quiz && quiz.pool ? quiz.pool.length - quiz.i : study.queue.length - study.i;
    w.innerHTML = `<div class="scrim" data-mact="leavestay"></div>
      <div class="menu">
        <div class="mi" style="font-weight:750">${svg(I.warn)}Quitter cet exercice ?</div>
        <div class="note">Il reste ${plur(n, 'question')}. Cet exercice-là ne se reprend pas :
          en sortant maintenant, les réponses déjà données ne comptent pas.</div>
        <button class="mi" data-mact="leavestay" style="justify-content:center;font-weight:700">
          ${svg(I.play)}Continuer</button>
        <button class="mi warn" data-mact="leavego">${svg(I.exit)}<span>Quitter quand même</span></button>
      </div>`;
    mountMenu(w);
    return;
  }
  if (menu === 'sortpick') {
    w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu">
        <div class="mi" style="font-weight:750">${svg(I.sort)}Trier les livres</div>
        ${Object.entries(SORTS).map(([k, l]) => `<button class="mi ${prefs.sort === k ? 'on' : ''}"
          data-sortby="${k}">${l}${prefs.sort === k ? svg(I.check) : ''}</button>`).join('')}
        <div class="msep"></div>
        <button class="mi" data-mact="reorderon">${svg(I.grip)}Réorganiser à la main</button>
      </div>`;
    mountMenu(w);
    return;
  }
  if (menu === 'preview') {
    const d = deck(previewOf); if (!d) { menu = null; return; }
    const due = simpleMode() ? 0 : dueCount(d);
    w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu">
        <div class="mhd">${svg(I.card)}
          <span class="mhx"><b>${esc(d.name)}</b>
            <i>${esc(subj(d.subject).name)} · ${plur(d.cards.length, 'page')}${due ? ' · ' + due + ' à revoir' : ''}</i>
          </span>
        </div>
        <div class="mpick">
          <button class="mg" data-mact="pkshare">${svg(I.share)}<span>Partager</span></button>
          <button class="mg" data-mact="pkfind">${svg(I.search)}<span>Chercher</span></button>
          <button class="mg" data-mact="pindeck">${svg(I.pin)}<span>${d.pinned ? 'Détacher' : 'Épingler'}</span></button>
          <button class="mg" data-mact="pkhide">${svg(d.hidden ? I.eye : I.eyeoff)}<span>${d.hidden ? 'Réafficher' : 'Masquer'}</span></button>
          <button class="mg ${d.cards.length > 3 ? '' : 'off'}" data-mact="pksplit">${svg(I.split)}<span>Scinder</span></button>
          <button class="mg" data-mact="pkset">${svg(I.gear)}<span>Réglages</span></button>
          <button class="mg warn" data-mact="pkdel">${svg(I.trash)}<span>Supprimer</span></button>
        </div>
        <button class="mi" data-mact="openpeek" style="justify-content:center;font-weight:700">
          ${svg(I.play)}Ouvrir le livre</button>
      </div>`;
    mountMenu(w);
    return;
  }
  if (menu === 'sharepick') {
    const d = deck(view.id); if (!d) { menu = null; return; }
    const m = metaOf(d);
    w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu">
        <div class="mi" style="font-weight:750">${svg(I.share)}Partager « ${esc(d.name)} »</div>
        <button class="mi" data-mact="sendfriend">${svg(I.mail)}Prêter à un lecteur<span class="tail">${mates ? mates.length : ''}</span></button>
        <button class="mi" data-mact="rolink">${svg(I.link)}${m.tok ? 'Copier le lien de consultation' : 'Créer un lien de consultation'}</button>
        ${m.tok ? `<button class="mi warn" data-mact="roff">${svg(I.eyeoff)}Révoquer le lien</button>` : ''}
        <div class="msep"></div>
        ${m.pub ? `<button class="mi" data-mact="publish">${svg(I.book)}Mettre à jour sur l’étagère
                     <span class="tail">${esc(scopeName())}</span></button>
                   <button class="mi warn" data-mact="unpublish">${svg(I.x)}Retirer de l’étagère</button>`
          : `<button class="mi" data-mact="publish">${svg(I.book)}Poser sur l’étagère
               <span class="tail">${esc(scopeName())}</span></button>`}
        <button class="mi" data-mact="duelnew2">${svg(I.flame)}Lancer un défi<span class="tail">${Math.min(DUELQ, d.cards.length)}</span></button>
        <div class="msep"></div>
        <button class="mi" data-mact="copylink">${svg(I.down)}Lien hors ligne (tout le livre)</button>
      </div>`;
    mountMenu(w);
    return;
  }
  if (menu === 'handle') {
    w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu">
        <div class="mhd">${svg(I.user)}<span class="mhx"><b>Ton pseudo</b></span></div>
        <div class="fld addf"><span class="at">@</span><input id="hq" type="text"
          placeholder="pseudo" autocapitalize="none" autocomplete="off" spellcheck="false"
          value="${esc((me && me.handle) || '')}" aria-label="Ton pseudo"></div>
        <button class="mi" data-mact="savehandle" style="justify-content:center;font-weight:700">
          ${svg(I.check)}Enregistrer</button>
      </div>`;
    mountMenu(w);
    setTimeout(() => { const i = document.getElementById('hq'); if (i) i.focus(); }, 80);
    return;
  }
  if (menu === 'newgroup' || menu === 'joingroup') {
    const join = menu === 'joingroup';
    w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu">
        <div class="mhd">${svg(I.layers)}<span class="mhx"><b>${join ? 'Rejoindre un club' : 'Créer un club'}</b>
          </span></div>
        <div class="fld addf"><input id="gq" type="text"
          placeholder="${join ? 'Code du club' : 'Nom du club'}" autocomplete="off"
          spellcheck="false" ${join ? 'autocapitalize="characters"' : ''}
          aria-label="${join ? 'Code du club' : 'Nom du club'}"></div>
        <button class="mi" data-mact="${join ? 'dojoin' : 'domake'}" style="justify-content:center;font-weight:700">
          ${svg(join ? I.link : I.plus)}${join ? 'Rejoindre' : 'Créer'}</button>
      </div>`;
    mountMenu(w);
    setTimeout(() => { const i = document.getElementById('gq'); if (i) i.focus(); }, 80);
    return;
  }
  if (menu === 'mate') {
    const f = (mates || []).find(x => x.id === mateOpen);
    if (!f) { menu = null; return; }
    w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu">
        <div class="mhd"><i class="av">${esc(initial(f.handle || f.name))}</i>
          <span class="mhx"><b>${esc(f.name || '')}</b><i>@${esc(f.handle || '')}</i></span></div>
        <button class="mi" data-mact="mateprof">${svg(I.chart)}Son journal de lecture</button>
        <button class="mi" data-mact="matesend">${svg(I.share)}Lui prêter un livre</button>
        <button class="mi warn" data-mact="matedrop">${svg(I.x)}<span>Retirer de mes lecteurs</span></button>
        <div class="msep"></div>
        <button class="mi" data-mact="matereport">${svg(I.warn)}<span>Signaler ce compte</span></button>
        <button class="mi warn" data-mact="mateblock">${svg(I.lock)}<span>Bloquer</span></button>
      </div>`;
    mountMenu(w);
    return;
  }
  if (menu === 'groupitem') {
    const g = (groups || []).find(x => x.id === groupOf);
    if (!g) { menu = null; return; }
    w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu">
        <div class="mhd">${svg(I.layers)}<span class="mhx"><b>${esc(g.name)}</b>
          <i>${g.owner === auth.uid ? 'tu l’as créé' : 'tu en fais partie'}</i></span></div>
        <button class="mi" data-mact="gcode">${svg(I.copy)}Code d’invitation
          <span class="tail">${esc(g.code)}</span></button>
        <button class="mi warn" data-mact="gleave">${svg(I.exit)}<span>${
          g.owner === auth.uid ? 'Supprimer le club' : 'Quitter le club'}</span></button>
      </div>`;
    mountMenu(w);
    return;
  }
  if (menu === 'tuto') return helpSheet(w);
  if (menu === 'help') {
    const h = HELP[helpKey];
    if (!h) { menu = null; return; }
    w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu">
        <div class="mhd">${svg(I.bulb)}<span class="mhx"><b>${esc(h[0])}</b></span></div>
        <div class="note htxt">${esc(h[1]).replace(/\n/g, '<br>')}</div>
      </div>`;
    mountMenu(w);
    return;
  }
  if (menu === 'vers') {
    const d = deck(view.id); if (!d) { menu = null; return; }
    const l = vers.list;
    w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu">
        <div class="mhd">${svg(I.clock)}
          <span class="mhx"><b>Historique de « ${esc(d.name)} »</b>
            <i>les ${VERSN} dernières versions, avant chaque remplacement</i></span></div>
        ${!l ? `<div class="note">${vers.err ? 'Historique indisponible.' : 'Chargement…'}</div>`
          : !l.length ? `<div class="note">Rien encore. Une version est gardée avant chaque
              remplacement, fusion, découpe ou réimport.</div>`
          : `<div class="mscroll">${l.map(v => `<button class="mi" data-vers="${v.id}">
              ${svg(I.redo)}<span class="ml2"><span class="n">${esc(v.why || 'version')}</span>
                <span class="sub">${plur((v.cards || []).length, 'page')} · ${timeAgo(v.created_at)}</span></span>
              </button>`).join('')}</div>`}
      </div>`;
    mountMenu(w);
    return;
  }
  if (menu === 'conflict') {
    const c = conflicts[0];
    if (!c) { menu = null; return; }
    const side = (v, lab, when) => `<div class="cside">
      <b>${lab}</b><i>${plur(v.cards.length, 'page')}${when ? ' · ' + when : ''}</i>
      <span>${esc(v.name)}</span></div>`;
    w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu">
        <div class="mhd">${svg(I.warn)}
          <span class="mhx"><b>Modifié sur un autre appareil</b>
            <i>« ${esc(c.mine.name)} » a changé des deux côtés</i></span></div>
        <div class="note">Rien n’est perdu : tu peux garder les deux.</div>
        <div class="csides">
          ${side(c.mine, 'Ici', null)}
          ${side(c.theirs, 'Ailleurs', c.theirs.at ? timeAgo(c.theirs.at) : null)}
        </div>
        <button class="mi" data-mact="cfboth" style="justify-content:center;font-weight:700">
          ${svg(I.copy)}Garder les deux</button>
        <button class="mi" data-mact="cfmine">${svg(I.down)}Garder celle d’ici</button>
        <button class="mi" data-mact="cftheirs">${svg(I.cloud)}Prendre celle de l’autre appareil</button>
      </div>`;
    mountMenu(w);
    return;
  }
  if (menu === 'libitem') {
    const it = (lib.list || []).find(x => x.deck_id === lib.open);
    if (!it) { menu = null; return; }
    const mine = it.user_id === auth.uid;
    w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu">
        <div class="mhd">${svg(I.book)}
          <span class="mhx"><b>${esc(it.name)}</b>
            <i>${esc(noDetect(shortWho(it.who) || 'Un compte'))}${it.subject ? ' · ' + esc(it.subject) : ''}
              · ${plur(it.n, 'page')} · ${timeAgo(it.updated_at)}</i></span>
        </div>
        <div class="mscroll">${(it.cards || []).slice(0, 60).map(c => `<div class="pr">
          <span class="a">${esc(cf(c))}</span>${svg(I.arrow)}<span class="b">${esc(cb(c))}</span></div>`).join('')}</div>
        <button class="mi" data-mact="libadd" style="justify-content:center;font-weight:700">
          ${svg(I.plus)}Ajouter à ma bibliothèque</button>
        ${mine ? `<button class="mi warn" data-mact="libdrop">${svg(I.trash)}<span>Retirer de l’étagère</span></button>`
          : `<div class="msep"></div>
             <button class="mi" data-mact="libreport">${svg(I.warn)}<span>Signaler ce livre</span></button>
             <button class="mi warn" data-mact="libblock">${svg(I.lock)}<span>Bloquer ce compte</span></button>`}
      </div>`;
    mountMenu(w);
    return;
  }
  if (menu === 'duelitem') {
    const du = (duels.list || []).find(x => x.id === duels.open);
    if (!du) { menu = null; return; }
    const r = rankOf(du.id), me = myScore(du.id), mine = du.owner === auth.uid;
    const MED = ['🥇', '🥈', '🥉'];
    w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu">
        <div class="mhd">${svg(I.flame)}
          <span class="mhx"><b>${esc(du.name)}</b>
            <i>lancé par ${esc(noDetect(shortWho(du.who) || 'un compte'))} · ${plur(du.total, 'question')}
              · ${timeAgo(du.created_at)}</i></span>
        </div>
        <div class="mscroll">${r.length ? r.map((sc, i) => `<div class="bdr ${sc.user_id === auth.uid ? 'me' : ''}">
            <span class="bdp">${MED[i] || (i + 1)}</span>
            <span class="bdn"><b>${esc(shortWho(sc.who) || 'Compte')}</b>
              <i>${sc.score}/${du.total} · ${Math.round(sc.ms / 1000)} s</i></span></div>`).join('')
          : '<div class="note">Personne n’a encore joué.</div>'}</div>
        ${me ? ``
          : `<button class="mi" data-mact="duelgo" style="justify-content:center;font-weight:700">
              ${svg(I.play)}Jouer les ${du.total} questions</button>`}
        ${mine ? `<button class="mi warn" data-mact="dueldrop">${svg(I.trash)}<span>Supprimer le défi</span></button>` : ''}
      </div>`;
    mountMenu(w);
    return;
  }
  if (menu === 'duelnew') {
    const list = db.decks.filter(x => x.cards.length >= 4);
    w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu">
        <div class="mi" style="font-weight:750">${svg(I.flame)}Défier le groupe</div>
        <div class="mscroll">${list.length ? list.map(x => `
          <button class="mi" data-dnew="${esc(x.id)}"><i class="tri" style="--c:${subj(x.subject).d}"></i>
            ${esc(x.name)}<span class="tail">${x.cards.length}</span></button>`).join('')
          : '<div class="note">Il faut un livre d’au moins 4 pages.</div>'}</div>
      </div>`;
    mountMenu(w);
    return;
  }
  if (menu === 'sendfriend') {
    const d = deck(view.id); if (!d) { menu = null; return; }
    /* seuls les lecteurs qui ont accepté : envoyer un livre à quelqu'un
       qui n'a pas encore répondu ne mène nulle part */
    const list = mates || [];
    const chosen = list.find(p => p.id === sendTo);
    w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu">
        <div class="mi" style="font-weight:750">${svg(I.mail)}Envoyer « ${esc(d.name)} » à</div>
        <div class="mscroll">${friends === null
          ? `<div class="mi" style="color:var(--soft)">Chargement…</div>`
          : !list.length ? `<div class="mi" style="color:var(--soft)">Aucun lecteur dans ton cercle pour l’instant.</div>`
          : list.map(p => `<button class="mi ${sendTo === p.id ? 'on' : ''}" data-friend="${p.id}">
              <i class="tri" style="--c:var(--soft)"></i>${esc(p.name || p.email)}
              ${sendTo === p.id ? svg(I.check) : ''}</button>`).join('')}</div>
        ${chosen ? `
          <textarea class="tok msgin" id="mmsg" rows="3" placeholder="Écris un mot à ${
            esc(shortWho(chosen.name || chosen.email))} (facultatif)">${esc(sendMsg)}</textarea>
          <button class="mi" data-mact="sendmail" style="justify-content:center;font-weight:700">
            ${svg(I.share)}Envoyer à ${esc(chosen.name || chosen.email)}</button>` : ''}
      </div>`;
    mountMenu(w);
    const ta = document.getElementById('mmsg');
    if (ta) { ta.addEventListener('input', () => sendMsg = ta.value); setTimeout(() => ta.focus(), 60); }
    return;
  }
  /* Prêter un livre : on part de l'ami, pas du livre. La feuille montre
     toute la bibliothèque personnelle ; le livre choisi part aussitôt
     dans sa boîte aux lettres. */
  if (menu === 'lend') {
    const f = (mates || []).find(x => x.id === mateOpen);
    if (!f) { menu = null; return; }
    const mine = db.decks.filter(x => x.cards.length);
    w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu">
        <div class="mhd"><i class="av">${esc(initial(f.handle || f.name))}</i>
          <span class="mhx"><b>Prêter à ${esc(shortWho(f.name || f.handle))}</b>
            <i>choisis un livre</i></span></div>
        <div class="mscroll">${mine.length
          ? mine.map(x => `<button class="mi" data-lend="${esc(x.id)}">
              <i class="tri" style="--c:${subj(x.subject).d}"></i>${esc(x.name)}
              <span class="tail">${plur(x.cards.length, 'page')}</span></button>`).join('')
          : `<div class="mi" style="color:var(--soft)">Ta bibliothèque est vide.</div>`}</div>
      </div>`;
    mountMenu(w);
    return;
  }
  if (menu === 'mateprof') {
    const f = (mates || []).find(x => x.id === mateOpen);
    if (!f) { menu = null; return; }
    const r = mateProf.row, l = mateProf.lib;
    const pctok = r && +r.n ? Math.round(r.ok / r.n * 100) : 0;
    w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu">
        <div class="mhd"><i class="av">${esc(initial(f.handle || f.name))}</i>
          <span class="mhx"><b>${esc(f.name || '')}</b><i>@${esc(f.handle || '')}</i></span></div>
        <div class="seg" style="margin:0 12px 10px">
          ${[[7, '7 jours'], [30, '30 jours'], [0, 'Tout']].map(([v, lab]) =>
            `<button data-mrange="${v}" class="${mateProf.range === v ? 'on' : ''}">${lab}</button>`).join('')}
        </div>
        ${mateProf.load && !r ? `` : `
          <div class="tiles st4" style="margin:0 12px 12px">
            <div class="st"><b>${r ? +r.n : 0}</b><span>pages lues</span></div>
            <div class="st"><b>${pctok}%</b><span>de réussite</span></div>
            <div class="st"><b>${r ? +r.jours : 0}</b><span>jours de lecture</span></div>
            <div class="st"><b>${l ? l.length : 0}</b><span>livres partagés</span></div>
          </div>`}
        <div class="msep"></div>
        <div class="mi" style="font-weight:750">${svg(I.book)}Ses livres dans la bibliothèque</div>
        <div class="mscroll">${l === null ? ``
          : l.length ? l.map(x => `<div class="mi">
              <i class="tri" style="--c:var(--soft)"></i>${esc(x.name)}
              <span class="tail">${plur(+x.n, 'page')}</span></div>`).join('')
          : `<div class="note">Il n’a rien partagé pour l’instant.</div>`}</div>
      </div>`;
    mountMenu(w);
    return;
  }
  if (menu === 'mailitem') {
    const it = mailbox.list && mailbox.list.find(x => x.id === mailOpen);
    if (!it) { menu = null; return; }
    const n = (it.cards || []).length;
    w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu">
        <div class="mhd">${svg(I.mail)}
          <span class="mhx"><b>${esc(it.deck_name)}</b>
            <i>${esc(noDetect(it.from_name || 'Un ami'))} · ${plur(n, 'page')} · ${timeAgo(it.created_at)}</i>
          </span>
        </div>
        ${it.message ? `<div class="mmsg">${svg(I.quote)}<p>${esc(it.message)}</p></div>` : ''}
        <div class="mscroll">${(it.cards || []).slice(0, 60).map(c => `<div class="pr">
          <span class="a">${esc(c[0])}</span>${svg(I.arrow)}<span class="b">${esc(c[1])}</span></div>`).join('')}</div>
        <button class="mi" data-mact="addmail" style="justify-content:center;font-weight:700">
          ${svg(it.added_at ? I.check : I.plus)}${it.added_at ? 'Déjà dans ma bibliothèque · Ajouter à nouveau' : 'Ajouter à ma bibliothèque'}</button>
        <button class="mi warn" data-mact="delmail">${svg(I.trash)}<span>Supprimer</span></button>
        ${it.from_user && it.from_user !== auth.uid ? `<div class="msep"></div>
          <button class="mi" data-mact="mailreport">${svg(I.warn)}<span>Signaler cet envoi</span></button>
          <button class="mi warn" data-mact="mailblock">${svg(I.lock)}<span>Bloquer l’expéditeur</span></button>` : ''}
      </div>`;
    mountMenu(w);
    return;
  }
  if (menu === 'move') {
    const d = deck(view.id); if (!d || !sel) { menu = null; return; }
    const n = [...sel].filter(i => d.cards.some(c => c.id === i)).length;
    const others = db.decks.filter(x => x.id !== d.id);
    w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu">
        <div class="mi" style="font-weight:750">${svg(I.out)}Déplacer ${n} carte${n > 1 ? 's' : ''} vers</div>
        <div class="mscroll">${others.map(x => `<button class="mi" data-move="${x.id}">
          <i class="tri" style="--c:${subj(x.subject).c}"></i>${esc(x.name)}
          <span class="tail">${x.cards.length}</span></button>`).join('')}</div>
      </div>`;
    mountMenu(w);
    return;
  }
  if (menu === 'split') {
    const d = deck(view.id); if (!d) { menu = null; return; }
    const n = d.cards.length;
    const size = Math.min(Math.max(2, splitSize), n - 1);
    const parts = Math.ceil(n / size), last = n - size * (parts - 1);
    w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu">
        <div class="mi" style="font-weight:750">${svg(I.split)}Scinder « ${esc(d.name)} »</div>
        <div class="mrow col"><span class="ml">${svg(I.card)}Pages par livre
          <b class="tail">${size}</b></span>
          <input class="rng" id="spSize" type="range" min="2" max="${n - 1}" step="1" value="${size}">
        </div>
        <div class="note">${n} pages → <b>${parts} livres</b> de ${size}${
          last !== size ? `, le dernier de ${last}` : ''}. Elles gardent leur ordre
          et leur progression. L’original part à la corbeille, récupérable.</div>
        <button class="mi" data-mact="dosplit" style="justify-content:center;font-weight:700">
          ${svg(I.check)}Scinder en ${parts}</button>
      </div>`;
    mountMenu(w);
    /* on retouche les libellés au lieu de reconstruire le menu : redessiner
       pendant le glissé arracherait le curseur des doigts */
    const r = document.getElementById('spSize');
    const lab = r.closest('.mrow').querySelector('b');
    const note = r.closest('.menu').querySelector('.note');
    const btn = r.closest('.menu').querySelector('[data-mact="dosplit"] ');
    r.addEventListener('input', () => {
      splitSize = +r.value;
      const p = Math.ceil(n / splitSize), lastN = n - splitSize * (p - 1);
      lab.textContent = splitSize;
      note.innerHTML = `${n} pages → <b>${p} livres</b> de ${splitSize}${
        lastN !== splitSize ? `, le dernier de ${lastN}` : ''}. Elles gardent leur ordre
        et leur progression. L’original part à la corbeille, récupérable.`;
      btn.lastChild.textContent = 'Scinder en ' + p;
    });
    return;
  }
  if (menu === 'rename' || menu === 'pwd' || menu === 'delacc') {
    const conf = {
      rename: ['Nom affiché', I.user, 'text', 'Comment on t’appelle', prefs.name || '', 'Enregistrer'],
      pwd: ['Nouveau mot de passe', I.lock, 'password', `Au moins ${PWMIN} caractères`, '', 'Changer'],
      delacc: ['Supprimer le compte', I.trash, null, '', '', 'Tout supprimer']
    }[menu];
    w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu">
        <div class="mi" style="font-weight:750">${svg(conf[1])}${conf[0]}</div>
        ${conf[2] ? `<input class="tok" id="fld" type="${conf[2]}" placeholder="${esc(conf[3])}"
            value="${esc(conf[4])}" autocapitalize="none" autocorrect="off" spellcheck="false">`
          : `<div class="mi" style="font-size:13.5px;color:var(--soft);height:auto;padding:0 16px 12px;
               line-height:1.45">Tes livres, tes matières et ton journal seront effacés définitivement.</div>`}
        <div class="mrr" id="mrr"></div>
        <button class="mi ${menu === 'delacc' ? 'warn' : ''}" data-mact="do-${menu}"
          style="justify-content:center;font-weight:700">${svg(I.check)}<span>${conf[5]}</span></button>
      </div>`;
    mountMenu(w);
    setTimeout(() => { const f = document.getElementById('fld'); if (f) f.focus(); }, 60);
    return;
  }
  const d = deck(view.id); if (!d) return;
  w.innerHTML = `<div class="scrim" data-mact="close"></div>
    <div class="menu">
      <div class="mgrid">
        ${db.subjects.map(x => subj(x.id)).map(s => `<button class="ms ${d.subject === s.id ? 'on' : ''}"
          data-msubj="${s.id}" style="--d:${s.d}"><i></i><span>${esc(s.name)}</span></button>`).join('')}
      </div>
      <div class="msep"></div>
      <button class="mi" data-mact="pindeck">${svg(I.pin)}${d.pinned ? 'Détacher' : 'Épingler en haut'}</button>
      <button class="mi" data-mact="hide">${svg(d.hidden ? I.eye : I.eyeoff)}${d.hidden ? 'Réafficher' : 'Masquer'}</button>
      <button class="mi" data-mact="studyall">${svg(I.play)}Tout revoir<span class="tail">${d.cards.length}</span></button>
      <button class="mi" data-mact="mcq">${svg(I.grid)}QCM</button>
      <button class="mi" data-mact="match">${svg(I.link)}Association</button>
      <button class="mi" data-mact="deckset">${svg(I.gear)}Réglages du livre</button>
      ${d.cards.filter(isLeech).length ? `<button class="mi" data-mact="studyleech">${svg(I.target)}Cartes coriaces<span class="tail">${d.cards.filter(isLeech).length}</span></button>` : ''}
      <div class="msep"></div>
      ${canUndo() ? `<button class="mi" data-mact="undo">${svg(I.redo)}Annuler<span class="tail">${esc(undoLabel())}</span></button>` : ''}
      ${d.cards.length ? `<button class="mi" data-mact="fnropen">${svg(I.search)}Chercher et remplacer</button>` : ''}
      <button class="mi" data-mact="versopen">${svg(I.clock)}Éditions précédentes</button>
      <button class="mi" data-mact="clone">${svg(I.copy)}Dupliquer</button>
      ${db.decks.length > 1 ? `<button class="mi" data-mact="mergeopen">${svg(I.link)}Fusionner avec…</button>` : ''}
      ${d.cards.length > 3 ? `<button class="mi" data-mact="splitopen">${svg(I.split)}Scinder<span class="tail">${d.cards.length}</span></button>` : ''}
      <button class="mi" data-mact="sharepick">${svg(I.share)}Partager</button>
      <button class="mi warn" data-mact="del">${svg(I.trash)}<span>Supprimer</span></button>
    </div>`;
  mountMenu(w);
}
/* Le profil d'un lecteur : ce que le classement sait déjà de lui, sur
   trois périodes, plus les livres qu'il a posés dans la bibliothèque.
   Rien de plus n'est demandé au serveur — le détail de ses révisions ne
   sort pas de son compte. */
let mateProf = { id: null, range: 7, row: null, lib: null, load: 0 };
/* Changer de période relance une requête sans attendre la précédente :
   « Tout » (plus de lignes à agréger côté serveur) peut très bien revenir
   après un « 30 jours » lancé juste ensuite, et écraser l'affichage avec
   des chiffres d'une autre période que celle sélectionnée à l'écran. Un
   jeton par appel règle ça — seule la dernière réponse compte. */
let mateProfSeq = 0;
async function mateProfPull(id) {
  const seq = ++mateProfSeq, range = mateProf.range;
  mateProf.load = 1;
  if (mateProf.id !== id) mateProf = { id, range, row: null, lib: null, load: 1 };
  let row = null, lib = null;
  try {
    const rows = await api('/rest/v1/rpc/leaderboard', 'POST', { days: range }) || [];
    row = rows.find(x => x.uid === id) || { n: 0, ok: 0, jours: 0 };
  } catch (e) {}
  try {
    lib = await api('/rest/v1/library?select=deck_id,name,subject,n,updated_at'
      + `&user_id=eq.${id}&order=updated_at.desc&limit=20`) || [];
  } catch (e) {}
  if (seq !== mateProfSeq) return;        // une demande plus récente est déjà en vol
  if (row) mateProf.row = row;
  if (lib) mateProf.lib = lib;
  mateProf.load = 0;
  if (menu === 'mateprof') paintMenu();
}
let recKey = null;
/* Les feuilles vivent sur `document.body`, hors de `#app` : c'est ce
   gestionnaire-ci qui les sert. Lui aussi n'énumérait que des attributs, et
   tout bouton de feuille portant un `data-` absent de la liste restait
   muet. Il attrape maintenant les boutons, comme celui de la page. */
document.addEventListener('click', async e => {
  const b = e.target.closest('button,[data-mact],[data-msubj],[data-color],[data-tol],[data-lgf],[data-lgb],[data-tm],[data-ct],[data-merge],[data-move],[data-fside],[data-friend],[data-sortby],[data-dnew],[data-vers],[data-copy],[data-chap],[data-lend],[data-mrange],[data-why],[data-unblock],[data-give],[data-setrole]');
  if (!b) return;
  if (feuilleTap(b)) return;
  const d = deck(view.id);
  if (b.dataset.dnew !== undefined) { const t = deck(b.dataset.dnew); if (t) duelMake(t); return; }
  if (b.dataset.copy !== undefined) {
    const url = b.dataset.copy;
    if (navigator.share) navigator.share({ url }).catch(() => {});
    else navigator.clipboard.writeText(url).then(() => toast(I.check, 'Adresse copiée'),
                                                 () => toast(I.x, 'Copie impossible'));
    return;
  }
  if (b.dataset.vers !== undefined) return versRestore(+b.dataset.vers);
  if (b.dataset.chap !== undefined) { closeMenu(); return startTour(b.dataset.chap || null); }
  if (b.dataset.msubj !== undefined) { d.subject = b.dataset.msubj; saveDeck(d); render(); return; }
  if (b.dataset.fside !== undefined) { fnr.side = b.dataset.fside; return paintMenu(); }
  if (b.dataset.friend !== undefined) { sendTo = b.dataset.friend; return paintMenu(); }
  if (b.dataset.mrange !== undefined) {
    mateProf.range = +b.dataset.mrange; mateProf.row = null;
    paintMenu(); return mateProfPull(mateOpen);
  }
  if (b.dataset.lend !== undefined) {
    const bk = deck(b.dataset.lend), f = (mates || []).find(x => x.id === mateOpen);
    if (!bk || !f) return;
    closeMenu();
    return sendDeck(bk, { id: f.id, name: f.name || ('@' + (f.handle || '')) });
  }
  if (b.dataset.sortby !== undefined) {
    prefs.sort = b.dataset.sortby; savePrefs();
    closeMenu(); animate = false; return render();
  }
  if (b.dataset.move !== undefined) {
    const t = deck(b.dataset.move); if (!t || !d || !sel) return;
    const moved = d.cards.filter(c => sel.has(c.id));
    if (!moved.length) return closeMenu();
    pushUndo('Déplacement', [d.id, t.id]);
    d.cards = d.cards.filter(c => !sel.has(c.id));
    t.cards.push(...moved);                       // identifiants et progression conservés
    sel = new Set();
    dirty[d.id] = 1; dirty[t.id] = 1; save(); flush();
    closeMenu(); render();
    return toast(I.out, moved.length + ' carte' + (moved.length > 1 ? 's' : '')
      + ' → ' + t.name, true);
  }
  if (b.dataset.merge !== undefined) {
    const src = deck(b.dataset.merge); if (!src || !d) return;
    const r = mergeDecks(d, src);
    closeMenu(); render();
    return toast(I.link, r.added + ' carte' + (r.added > 1 ? 's' : '') + ' ajoutée'
      + (r.added > 1 ? 's' : '') + (r.skipped ? ' · ' + r.skipped + ' en double ignorée' + (r.skipped > 1 ? 's' : '') : ''), true);
  }
  /* réglages propres au paquet, dans leur feuille */
  if (b.dataset.tol) { setMeta(d, { tol: b.dataset.tol }); return paintMenu(); }
  if (b.dataset.lgf !== undefined) { setMeta(d, { langf: b.dataset.lgf }); return paintMenu(); }
  if (b.dataset.lgb !== undefined) { setMeta(d, { langb: b.dataset.lgb }); return paintMenu(); }
  if (b.dataset.tm !== undefined) { setMeta(d, { timer: +b.dataset.tm }); return paintMenu(); }
  if (b.dataset.ct !== undefined) {
    const c = d && d.cards.find(x => x.id === cardEdit);
    if (c) { if (b.dataset.ct) c.t = b.dataset.ct; else delete c.t; saveDeck(d); }
    return paintMenu();
  }
  const a = b.dataset.mact;
  if (a === 'close') return closeMenu();
  if (b.dataset.why !== undefined) { reportWhy = b.dataset.why; return paintMenu(); }
  if (b.dataset.unblock !== undefined) return unblockUser(b.dataset.unblock);
  if (b.dataset.setrole !== undefined) return setRole(b.dataset.who, b.dataset.setrole);
  if (a === 'rsend') return sendReport();
  if (a === 'rblock') { const r = reportOn; if (r && r.user) return blockUser(r.user, r.label); return; }
  /* Le signalement emporte une copie : ce qu'on voit à l'écran est ce qui
     part, et effacer ensuite ne l'efface pas. */
  if (a === 'libreport' || a === 'libblock') {
    const it = (lib.list || []).find(x => x.deck_id === lib.open); if (!it) return;
    if (a === 'libblock') return blockUser(it.user_id, it.who);
    return openReport('library', it.deck_id, it.user_id, it.name,
      { nom: it.name, qui: it.who, matiere: it.subject, cartes: (it.cards || []).slice(0, 40) });
  }
  if (a === 'mailreport' || a === 'mailblock') {
    const it = mailbox.list && mailbox.list.find(x => x.id === mailOpen); if (!it) return;
    if (a === 'mailblock') return blockUser(it.from_user, it.from_name);
    return openReport('mail', it.id, it.from_user, it.deck_name,
      { nom: it.deck_name, qui: it.from_name, message: it.message, cartes: (it.cards || []).slice(0, 40) });
  }
  if (a === 'matereport' || a === 'mateblock') {
    const f = (mates || []).find(x => x.id === mateOpen); if (!f) return;
    if (a === 'mateblock') return blockUser(f.id, f.name || f.handle);
    return openReport('profile', f.id, f.id, f.name || ('@' + (f.handle || '')),
      { pseudo: f.handle, nom: f.name });
  }
  if (a === 'doclass') {
    const n = (document.getElementById('cn') || {}).value || '';
    const l = (document.getElementById('cl') || {}).value || '';
    return makeClass(n, l);
  }
  if (a === 'doclassjoin') {
    const v = ((document.getElementById('cn') || {}).value || '').trim();
    if (v) return joinClass(v);
    return;
  }
  if (b.dataset.give !== undefined) {
    const d = deck(b.dataset.give);
    if (d && classOf) return giveWork(d, classOf, 7);
    return;
  }
  /* ---- le composeur et la feuille d'un devoir ---- */
  if (a === 'cadd') {
    if (!prof.comp) return;
    lireComp();
    const f = prof.comp.recto.trim(), b = prof.comp.verso.trim();
    if (!f || !b) return toast(I.x, 'Il faut un recto et un verso');
    prof.comp.cartes.push([f, b]);
    prof.comp.recto = ''; prof.comp.verso = '';
    paintMenu();
    setTimeout(() => { const n = document.getElementById('crec'); if (n) n.focus(); }, 40);
    return;
  }
  if (a === 'cgive') return compDonner();
  if (a === 'pdefi') {
    const d = (prof.devoirs || []).find(x => x.id === prof.work);
    if (d) duelClasse(d.id, d.nom);
    return;
  }
  if (a === 'pmotgo') {
    const t = ((document.getElementById('pmt') || {}).value || '').trim();
    if (!t) return toast(I.x, 'Écris ton message');
    const m = (prof.roster || []).find(x => x.user_id === prof.eleve);
    api('/rest/v1/mail', 'POST', [{ from_user: auth.uid, to_user: prof.eleve,
      from_name: prefs.name || (me && me.handle) || 'Compte', deck_name: '', message: t.slice(0, 600), cards: [] }],
      { Prefer: 'return=minimal' })
      .then(() => { closeMenu(); render();
        toast(I.check, 'Mot envoyé à ' + (m ? m.who.split(' ')[0] : 'l’élève')); },
            () => toast(I.x, 'Envoi impossible'));
    return;
  }
  if (a === 'prelance') {
    return profDo('prof_relance', { aid: prof.work, mot: '' },
      r => r ? plur(r, 'élève') + ' relancé' + (r > 1 ? 's' : '') : 'Personne à relancer')
      .then(() => { closeMenu(); render(); });
  }
  if (a === 'predonner') {
    const d = (prof.devoirs || []).find(x => x.id === prof.work);
    if (!d) return;
    /* Redonner, c'est repartir du composeur avec tout de prérempli : le
       professeur n'a plus qu'à cocher les classes. Les cartes viennent du
       devoir lui-même, pas d'une bibliothèque où elles ne sont peut-être
       plus. */
    profCartesDeDevoir(d);
    return;
  }
  if (a === 'pdel') {
    return profDo('prof_del_work', { aid: prof.work }, 'Devoir retiré')
      .then(() => { closeMenu(); render(); });
  }
  /* ---- écritures du référent ---- */
  if (a === 'refsave') {
    if (!ref.who) return;
    const v = id => ((document.getElementById(id) || {}).value || '').trim();
    return refDo('ref_update_account',
      { cible: ref.who.id, nom: v('fnom'), pseudo: v('fpse'), adresse: v('fmel') },
      'Identité enregistrée').then(() => { closeMenu(); render(); });
  }
  if (a === 'refpw') {
    if (!ref.who) return;
    const pw = ((document.getElementById('fpw') || {}).value || '').trim();
    if (pw.length < 10) return toast(I.x, 'Au moins dix caractères');
    return refDo('ref_set_password', { cible: ref.who.id, pw },
      'Mot de passe refait · ' + pw).then(() => { ref.form = {}; paintMenu(); });
  }
  if (a === 'refclssave') {
    const f = lireClass();
    /* Le cycle ne se modifie pas ici — il n'y a pas de champ pour lui — mais
       `ref_save_class` réécrit toute la ligne : le lui taire l'effacerait. */
    const c = (ref.classes || []).find(x => x.id === ref.open) || {};
    return refDo('ref_save_class',
      { cid: ref.open, nom: f.nom, niveau: f.niv, cycle: c.cycle || '', filiere: f.fil,
        prevu: f.pre ? +f.pre : null }, 'Classe enregistrée')
      .then(() => { closeMenu(); render(); });
  }
  if (a === 'refclsdel') {
    return refDo('ref_delete_class', { cid: ref.open }, 'Classe supprimée')
      .then(r => { if (r !== null) { closeMenu(); render(); } });
  }
  if (a === 'refclsgens') {
    ref.cls = ref.open; ref.tab = 'gens'; ref.role = ''; ref.q = '';
    refPeople(true); closeMenu(); animate = false; return render();
  }
  if (a === 'refdonew') {
    const f = { ...(ref.form || {}), ...lireNew() };
    ref.form = f;
    if ((f.pw || '').length < 10) return toast(I.x, 'Au moins dix caractères');
    return refDo('ref_new_account',
      { adresse: f.mel || '', nom: f.nom || '', pseudo: f.pse || '',
        qrole: f.role || 'eleve', cid: (f.role || 'eleve') === 'eleve' ? (f.cls || null) : null,
        pw: f.pw || '' }, 'Compte ouvert · ' + (f.mel || ''))
      .then(r => { if (r) { ref.form = {}; closeMenu(); render(); } });
  }
  if (a === 'refdonewclass') {
    const f = { ...(ref.form || {}), ...lireClass() };
    ref.form = f;
    return refDo('ref_save_class',
      { cid: null, nom: f.nom || '', niveau: f.niv || '', cycle: f.cyc || '',
        filiere: f.fil || '', prevu: f.pre ? +f.pre : null }, 'Classe créée')
      .then(r => { if (r) { ref.form = {}; closeMenu(); render(); } });
  }
  if (a === 'takework') {
    const x = (asgs || []).find(y => y.id === workOpen);
    if (x) return takeWork(x);
    return;
  }
  if (a === 'delwork') {
    const id = workOpen; closeMenu();
    api('/rest/v1/assignments?id=eq.' + encodeURIComponent(id), 'DELETE', null,
      { Prefer: 'return=minimal' })
      .then(() => { asgs = (asgs || []).filter(x => x.id !== id); render(); toast(I.check, 'Devoir retiré'); },
            () => toast(I.x, 'Impossible pour l’instant'));
    return;
  }
  if (a === 'dropmember') { if (classOf && memberOpen) return dropMember(classOf, memberOpen); return; }
  if (a === 'instcopy') return copyLink();
  if (a === 'instgo') return doPrompt();
  if (a === 'instlater') return closeMenu();
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
    } catch (x) { toast(I.x, upErr(x)); }
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
    catch (x) { toast(I.x, upErr(x)); }
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
    if (v.length < PWMIN) { err.textContent = `Au moins ${PWMIN} caractères`; return; }
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
  if (a === 'clone') {
    const n = cloneDeck(d); closeMenu(); go('deck', n.id);
    return toast(I.copy, n.cards.length + ' carte' + (n.cards.length > 1 ? 's' : '') + ' dupliquée' + (n.cards.length > 1 ? 's' : ''), true);
  }
  if (a === 'undo') { closeMenu(); doUndo(); return; }
  if (a === 'fnropen') { fnr.q = ''; fnr.r = ''; return openMenu('fnr'); }
  if (a === 'fnrcase') { fnr.cs = !fnr.cs; return paintMenu(); }
  if (a === 'dofnr') {
    const n = fnrApply(d);
    closeMenu(); render();
    return n ? toast(I.check, n + ' remplacement' + (n > 1 ? 's' : ''), true) : toast(I.x, 'Rien à remplacer');
  }
  if (a === 'mergeopen') return openMenu('merge');
  if (a === 'splitopen') { splitSize = Math.min(splitSize, d.cards.length - 1); return openMenu('split'); }
  if (a === 'dosplit') {
    const made = splitDeck(d, Math.min(Math.max(2, splitSize), d.cards.length - 1));
    closeMenu();
    if (!made) return toast(I.split, 'Rien à scinder');
    go('home');
    return toast(I.split, made.length + ' livres créés', true);
  }
  if (a === 'leavestay') { leaving = null; return closeMenu(); }
  if (a === 'leavego') {
    const act = leaving; leaving = null; closeMenu();
    quiz = null; study = study && study.mode ? null : study;
    const back = act === 'quitquiz' ? (quiz && quiz.id) : act === 'deck' ? view.id : null;
    if (act === 'quitquiz') quiz = null;
    return go(back && deck(back) ? 'deck' : 'home', back && deck(back) ? back : null);
  }
  if (a === 'reorderon') { closeMenu(); reorder = true; prefs.sort = 'manual'; savePrefs(); animate = false; return render(); }
  if (a === 'pindeck') {
    /* la même entrée sert depuis l'aperçu et depuis le menu du paquet :
       c'est la feuille ouverte qui dit de quel paquet on parle */
    const t = (menu === 'preview' ? deck(previewOf) : d) || d; if (!t) return;
    t.pinned = !t.pinned; saveDeck(t);
    closeMenu(); animate = false; render();
    return toast(I.pin, t.pinned ? 'Épinglé en haut' : 'Détaché');
  }
  if (a === 'openpeek') { const id = previewOf; closeMenu(); return go('deck', id); }
  if (a && a.startsWith('pk')) {
    const id = previewOf, t = deck(id); if (!t) return closeMenu();
    closeMenu();
    if (a === 'pkhide') { t.hidden = !t.hidden; saveDeck(t); animate = false; render();
      return toast(t.hidden ? I.eyeoff : I.eye, t.hidden ? 'Masqué' : 'Réaffiché'); }
    if (a === 'pkdel') {
      pushUndo(t.name, [t.id]);
      db.decks = db.decks.filter(x => x.id !== t.id);
      delete dirty[t.id]; gone.push(t.id); save(); flush();
      animate = false; render();
      return toast(I.trash, 'Livre dans la corbeille', true);
    }
    go('deck', id);
    if (a === 'pkshare') { if (!friends) friendsPull(); return openMenu('sharepick'); }
    if (a === 'pkfind') { deckOpen = true; deckQ = ''; animate = false; render();
      return setTimeout(() => { const i = document.getElementById('dq'); if (i) i.focus(); }, 80); }
    if (a === 'pksplit') { if (t.cards.length < 4) return toast(I.x, 'Trop court pour être scindé');
      splitSize = Math.min(splitSize, t.cards.length - 1); return openMenu('split'); }
    if (a === 'pkset') return openMenu('deckset');
    return;
  }
  if (a === 'sharepick') { if (!friends) friendsPull(); return openMenu('sharepick'); }
  if (a === 'rolink') {
    if (!d) return;
    closeMenu();
    try {
      const url = await shareLink(d);
      if (navigator.share) navigator.share({ url }).catch(() => {});
      else await navigator.clipboard.writeText(url);
      toast(I.link, 'Lien de consultation copié');
    } catch (err) { toast(I.x, 'Lien impossible hors ligne'); }
    return;
  }
  if (a === 'roff') { if (!d) return; closeMenu(); await revokeShare(d); return toast(I.check, 'Lien coupé'); }
  if (a === 'publish') { if (d) libPublish(d); return; }
  if (a === 'unpublish') { if (d) libRemove(d); return; }
  if (a === 'duelnew2') { if (d) duelMake(d); return; }
  if (a === 'versopen') { if (!d) return; openMenu('vers'); return versPull(d.id); }
  if (a === 'savehandle') {
    const i = document.getElementById('hq');
    if (await saveHandle(i ? i.value : '')) { closeMenu(); animate = false; render(); }
    return;
  }
  if (a === 'domake') { const i = document.getElementById('gq'); return makeGroup(i ? i.value : ''); }
  if (a === 'dojoin') { const i = document.getElementById('gq'); return joinGroup(i ? i.value : ''); }
  if (a === 'gcode') {
    const g = (groups || []).find(x => x.id === groupOf); if (!g) return;
    const txt = g.code;
    if (navigator.share) navigator.share({ text: `Rejoins « ${g.name} » sur Folio avec le code ${txt}` }).catch(() => {});
    else navigator.clipboard.writeText(txt).then(() => toast(I.check, 'Code copié'), () => {});
    return;
  }
  if (a === 'gleave') { return leaveGroup(groupOf); }
  if (a === 'matedrop') { return dropFriend(mateOpen); }
  if (a === 'matesend') { sendMsg = ''; return openMenu('lend'); }
  if (a === 'mateprof') { mateProfPull(mateOpen); return openMenu('mateprof'); }
  if (a === 'cfmine') return solveConflict('mine');
  if (a === 'cftheirs') return solveConflict('theirs');
  if (a === 'cfboth') return solveConflict('both');
  if (a === 'libadd') { const it = (lib.list || []).find(x => x.deck_id === lib.open); if (it) libAdd(it); return; }
  if (a === 'libdrop') { const it = (lib.list || []).find(x => x.deck_id === lib.open); const t = it && deck(it.deck_id); if (t) libRemove(t); return; }
  if (a === 'duelgo') { const du = (duels.list || []).find(x => x.id === duels.open); if (du) duelStart(du); return; }
  if (a === 'dueldrop') { return duelDrop(duels.open); }
  if (a === 'copylink') {
    closeMenu();
    const url = location.origin + location.pathname + '#i=' +
      enc({ name: d.name, subject: d.subject, cards: d.cards.map(c => [c.f, c.b]) });
    if (navigator.share) navigator.share({ url }).catch(() => {});
    else navigator.clipboard.writeText(url).then(() => toast(I.check, 'Lien copié'));
    return;
  }
  if (a === 'sendfriend') {
    sendTo = null; sendMsg = '';
    if (!friends) friendsPull();
    return openMenu('sendfriend');
  }
  if (a === 'sendmail') {
    const p = (mates || []).find(x => x.id === sendTo); if (!p || !d) return;
    closeMenu();
    return sendDeck(d, p);
  }
  if (a === 'addmail') {
    const it = mailbox.list && mailbox.list.find(x => x.id === mailOpen); if (!it) return;
    return addMail(it);
  }
  if (a === 'delmail') return delMail(mailOpen);
  if (a === 'del') {
    const lab = b.querySelector('span');
    if (b.dataset.arm) {
      pushUndo(d.name, [d.id]);
      db.decks = db.decks.filter(x => x.id !== d.id);
      delete dirty[d.id]; gone.push(d.id); save(); flush();
      closeMenu();
      go('home');
      return toast(I.trash, 'Livre dans la corbeille', true);
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
    /* un ordre demandé par l'appelant (le bouton mélanger) l'emporte sur
       la préférence, dans les deux modes */
    ids = buildQueue(cards, sm
      ? { order: o.order || (prefs.order === 'due' ? 'random' : prefs.order), cap: 0,
          fresh: prefs.fresh, only: o.only === 'leech' ? 'leech' : '' }
      : { ...o, order: o.order || prefs.order, fresh: prefs.fresh,
          cap: o.cap != null ? o.cap : prefs.cap }, Date.now()).map(c => c.id);
  }
  if (!ids.length) { toast(I.check, 'Rien à revoir ici'); return; }
  const dm = id === 'all' ? DEFMETA : metaOf(deck(id));
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
  study = { id, name, langf: dm.langf, langb: dm.langb, mode, pool, rev: !!rev, both: !!o.both, queue: ids, i: 0, again: [], flip: false,
            ok: 0, total: ids.length, t0: Date.now(), tq: Date.now(), tried: {}, missSet: {},
            miss: [], log: [], saved: false, opt: o, simple: sm,
            dirs: Object.fromEntries(ids.map(x => [x, o.both ? Math.random() < .5 : !!rev])) };
  saveResume();
  go('study', id);
}
/* Reprise : l'état de la session survit à la fermeture de l'app */
function saveResume() {
  /* La séance de démonstration ne laisse pas de trace : sans ça, le
     bandeau « Reprendre Italien — les bases » s'affichait sur le vrai
     compte, qui n'a jamais eu ce paquet. */
  if (demo) return;
  try {
    /* QCM et association sont des exercices courts, et leur état porte des
       références de cartes : on ne les met pas en reprise. */
    if (!study || study.mode || study.i >= study.queue.length) localStorage.removeItem('cartes.resume.' + auth.uid);
    else localStorage.setItem('cartes.resume.' + auth.uid, JSON.stringify({ ...study, t: Date.now() }));
  } catch (e) {}
}
function loadResume() {
  if (demo) return null;
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
const cardOf = n => findCard(study.queue[study.i + n])[0];

/* ---------- d'où vient la carte affichée ----------
   En marathon les cartes viennent de paquets différents : la matière, sa
   couleur et les langues des deux faces appartiennent au paquet de la
   carte en cours, pas à la session. Hors marathon, tout le paquet partage
   les mêmes, et on garde ce qui a été figé au démarrage. */
function cardOrigin(c) {
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
  const front = rv ? c.b : c.f, back = rv ? c.f : c.b;
  const fimg = rv ? c.bi : c.fi, bimg = rv ? c.fi : c.bi;
  const faud = rv ? c.ba : c.fa, baud = rv ? c.fa : c.ba;
  const org = cardOrigin(c);
  const frontLang = rv ? org.langb : org.langf, backLang = rv ? org.langf : org.langb;
  /* la pile prend la couleur de la matière de la carte, carte après carte */
  if (org.subj) st.setAttribute('style', sty(org.subj));
  /* Posées sur la fiche et non dedans, la matière et les étiquettes
     restaient en place pendant que la fiche se retournait : elles avaient
     l'air collées par-dessus. Elles appartiennent maintenant à chaque
     face, donc elles tournent avec. */
  const tag = `${org.subj ? `<div class="sbj"><i></i>${esc(org.subj.name)}</div>` : ''}${
    (c.g || []).length ? `<div class="ctags">${c.g.slice(0, 3).map(t =>
      `<i>${esc(t)}</i>`).join('')}</div>` : ''}`;
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
function pickMCQ(k) {
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
function pickMatch(side, id) {
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
function answerTF(said) {
  const c = cardOf(0);
  if (!c || !isTF(c) || study.tf != null) return;
  study.tf = (said === tfTruth(c));
  study.flip = true;
  turnPage(document.getElementById('top'), true);
  paintFoot();
  if (prefs.fast) {
    pendingGrade = study.tf ? 2 : 0;
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
/* Le temps que met la page à tourner. Sans ce verrou, une série de
   touches rapides relançait l'animation à chaque fois et la page
   tournoyait sans fin sans jamais se poser. */
let flipAt = 0;
function toggleFlip() {
  const top = document.getElementById('top'); if (!top) return;
  const now = Date.now();
  if (now - flipAt < 480) return;
  flipAt = now;
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
    try { el.setPointerCapture(pid); } catch (x) {}
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
function fling(dir, v, fx, fy) {
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
  const g = pendingGrade; pendingGrade = null;
  /* À droite je sais, à gauche à revoir : le sens des applications de
     cartes, et celui des deux pastilles qui apparaissent sous le doigt. */
  setTimeout(() => commit(g != null ? g > 0 : dir > 0, g), 250);
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
  const row = {
    client_id: uid(),                       // rejouable sans doublon
    user_id: auth.uid, deck_id: d ? d.id : null, card_id: id,
    mode: study.simple ? 'simple' : (study.mode || 'study'),
    rating: study.simple ? null : r, correct: !!ok, ms: Math.min(ms, 600000), reversed: !!rv
  };
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
           /* qlang lit la question, alang attend/écoute la réponse — la langue
              suit ce qui est vraiment affiché à chaque rôle, pas un côté fixe :
              si le quiz est inversé, question et réponse ont échangé de langue
              avec leur contenu. */
           tol: m.tol, qlang: rev ? m.langb : m.langf, alang: rev ? m.langf : m.langb, timer: m.timer,
           streak: 0, best: 0, hint: 0, hints: 0, opts: null, optsFor: -1 };
  if (o.at) {
    const k = quiz.pool.findIndex(q => norm(plain(q.f)) === o.at);
    if (k > 0) quiz.i = k;
  }
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
  asrRec = listen(quiz.alang, alts => {
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
function quizView() {
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
let comp = { subject: '', cards: [], edit: -1, bulk: false, text: '', dups: false };
let aiBusy = false;
const resetComp = extra => { comp = { subject: '', cards: [], edit: -1, bulk: false,
  text: '', dups: false, ...(extra || {}) }; };

function importView() {
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
      aiBusy = true; gen.classList.add('busy'); gen.disabled = true;
      try {
        const cards = await aiCards(tx.value, t ? t.name : comp.name);
        if (!cards.length) throw new Error('empty');
        tx.value = cards.map(c => c.f + '\t' + c.b).join('\n');
        fit(); up(); toast(I.spark, plur(cards.length, 'page'));
      } catch (x) {
        toast(I.x, AIERR[String(x.message)] || 'IA indisponible');
      }
      aiBusy = false; gen.classList.remove('busy'); up();
    };
    /* Photo et PDF passent par la même passerelle : ils reviennent sous
       forme de texte tabulé dans la zone, donc tout ce qui suit — aperçu,
       doublons, correction à la main — fonctionne à l'identique. */
    const shot = document.getElementById('aishot'), pdf = document.getElementById('aipdf');
    const fshot = document.getElementById('fshot'), fpdf = document.getElementById('fpdf');
    const grab = async (btn, file, pages) => {
      if (aiBusy || !file) return;
      aiBusy = true; btn.classList.add('busy'); [shot, pdf, gen].forEach(x => x.disabled = true);
      try {
        const cards = await aiFromFile(file, t ? t.name : comp.name, pages);
        if (!cards.length) throw new Error('empty');
        const had = tx.value.trim();
        tx.value = (had ? had + '\n' : '') + cards.map(c => c.f + '\t' + c.b).join('\n');
        fit(); up(); toast(I.spark, plur(cards.length, 'page'));
      } catch (x) {
        toast(I.x, AIERR[String(x.message)] || 'IA indisponible');
      }
      aiBusy = false; btn.classList.remove('busy');
      [shot, pdf].forEach(x => x.disabled = false); up();
    };
    /* La galerie peut rendre plusieurs photos d'un coup : chacune passe
       par la passerelle l'une après l'autre, et leurs pages s'ajoutent
       toutes au même texte — choisir dix photos revient à les prendre
       une par une, en une seule fois. */
    const grabShots = async files => {
      if (aiBusy || !files.length) return;
      aiBusy = true; shot.classList.add('busy'); [shot, pdf, gen].forEach(x => x.disabled = true);
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
      aiBusy = false; shot.classList.remove('busy'); [shot, pdf].forEach(x => x.disabled = false);
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

/* ---------- interactions ---------- */
/* Le sélecteur commence par « button », et c'est la correction la plus
   importante de ce fichier. Il n'énumérait que des attributs, un par un :
   tout écran posant un `data-` qui n'était pas dans la liste avait des
   boutons parfaitement muets — pas d'erreur, pas de trace, rien. Les trois
   consoles ont été écrites comme ça, et aucune ne répondait.
   Un bouton est fait pour être pressé : on l'attrape tous, et les branches
   plus bas décident. Celles qui ne reconnaissent rien laissent filer, donc
   les feuilles (qui lisent `data-mact` sur leur propre écouteur) passent
   après sans être gênées. La liste d'attributs reste pour ce qui n'est pas
   un bouton. */

/* ══════════ ce qui se presse dans une feuille ══════════
   Une feuille est montée sur `document.body`, pas dans `#app` : les
   branches écrites pour l'écran ne la voient jamais. Plutôt que d'en tenir
   deux copies — qui divergeront —, on les range ici, et les deux
   gestionnaires appellent la même fonction. Elle rend `true` quand elle a
   traité le clic, et le gestionnaire s'arrête là. */
function feuilleTap(b) {
  const ds = b.dataset;
  const oui = x => (x, true);          // « traité », quoi que la branche rende

  /* ---- le composeur de devoir ---- */
  if (ds.cdue2) {
    if (prof.comp) { lireComp(); prof.comp.due = ds.cdue2; prof.comp.mois = ds.cdue2; }
    return oui(paintMenu());
  }
  if (ds.cmois) {
    if (prof.comp) { lireComp(); prof.comp.mois = ds.cmois; }
    return oui(paintMenu());
  }
  if (ds.ccible) {
    if (!prof.comp) return true;
    lireComp();
    const k = ds.ccible;
    prof.comp.cibles.has(k) ? prof.comp.cibles.delete(k) : prof.comp.cibles.add(k);
    return oui(paintMenu());
  }
  if (ds.plivre) { const d = deck(ds.plivre); if (d) donnerLivre(d); return true; }
  if (ds.cedit) {
    /* On repart dans l'éditeur complet, et on revient ici ensuite : le
       devoir en préparation attend dans `prof.comp`. */
    if (!prof.comp || !prof.comp.livre) return true;
    lireComp(); closeMenu();
    return oui(go('deck', prof.comp.livre));
  }
  if (ds.cdue) {
    profDo('prof_set_due', { aid: prof.work, due: ds.cdue },
      r => 'À rendre le ' + jourFr(r)).then(() => { closeMenu(); render(); });
    return true;
  }
  if (ds.pmois2) { prof.mois = ds.pmois2; return oui(paintMenu()); }

  /* ---- les feuilles du référent ---- */
  if (ds.rmove !== undefined) {
    if (!ref.who) return true;
    const cid = ds.rmove || null;
    refDo('ref_move_student', { cible: ref.who.id, vers: cid },
      cid ? 'Changé de classe' : 'Retiré de sa classe').then(() => { closeMenu(); render(); });
    return true;
  }
  if (ds.rrolechg) {
    if (!ref.who) return true;
    refDo('ref_set_role', { cible: ref.who.id, nouveau: ds.rrolechg }, 'Rôle enregistré')
      .then(() => { closeMenu(); render(); });
    return true;
  }
  if (ds.rdropt) {
    refDo('ref_drop_teaching', { tid: ds.rdropt }, 'Service retiré').then(() => paintMenu());
    return true;
  }
  if (ds.rpp) {
    const [qui, mat] = ds.rpp.split('|');
    refDo('ref_set_teaching', { cid: ref.open, prof: qui, matiere: mat, pp: true },
      'Professeur principal enregistré').then(() => { ref.team = null; refTeam(ref.open); });
    return true;
  }
  if (ds.raddt) {
    const mat = ((document.getElementById('tmat') || {}).value || '').trim();
    if (!mat) return oui(toast(I.x, 'Écris d’abord la matière'));
    ref.form = { ...(ref.form || {}), mat };
    refDo('ref_set_teaching', { cid: ref.open, prof: ds.raddt, matiere: mat, pp: false },
      'Professeur ajouté à l’équipe').then(() => { ref.team = null; refTeam(ref.open); });
    return true;
  }
  if (ds.rnrole) { ref.form = { ...(ref.form || {}), role: ds.rnrole, ...lireNew() }; return oui(paintMenu()); }
  if (ds.rncls) { ref.form = { ...(ref.form || {}), cls: ds.rncls, ...lireNew() }; return oui(paintMenu()); }
  if (ds.rncyc) { ref.form = { ...(ref.form || {}), cyc: ds.rncyc, ...lireClass() }; return oui(paintMenu()); }
  return false;
}

$.addEventListener('click', e => {
  const b = e.target.closest('button,[data-act],[data-go],[data-rm],[data-a],[data-g],[data-q],[data-filt],[data-nsubj],[data-ed],[data-dl],[data-sub],[data-sus],[data-ord],[data-snd],[data-say],[data-tf],[data-card],[data-pick],[data-mt],[data-qp],[data-qsay],[data-trr],[data-trd],[data-pkc],[data-mail],[data-lib],[data-duel],[data-gtab],[data-scope],[data-brange],[data-dpick],[data-help],[data-yes],[data-no],[data-mate],[data-group],[data-legal],[data-modact],[data-classe],[data-work],[data-member],[data-account]');
  if (!b) return;
  const ds = b.dataset;
  if (feuilleTap(b)) return;
  const a0 = ds.act;
  /* Une révision simple se reprend là où elle s'est arrêtée : la quitter
     ne coûte rien. Un quiz, un QCM ou une association, non — vingt
     minutes disparaissent pour de bon. Ce sont les seules qu'on protège,
     sinon la question deviendrait un réflexe qu'on clique sans lire. */
  if (/^(home|quitquiz|deck)$/.test(a0 || '') && lostOnLeave() && !leaving) {
    leaving = a0; return openMenu('leave');
  }
  if (ds.help !== undefined) { helpKey = ds.help; return openMenu('help'); }
  if (ds.modact !== undefined) return modAct(+ds.rid, ds.modact);
  if (ds.account !== undefined) { accOpen = ds.account; return openMenu('account'); }
  if (ds.classe !== undefined) {
    classOf = ds.classe; roster = null; asgs = null; classPull(classOf); return go('classe');
  }
  /* Le même devoir, deux feuilles : celle de l'élève l'ajoute à sa
     bibliothèque, celle du professeur montre le suivi. L'ancienne feuille
     cherchait la classe dans `classes`, que l'élève ne charge plus depuis
     qu'il a son propre écran — elle se refermait sans rien dire. */
  if (ds.work !== undefined) {
    workOpen = ds.work;
    return openMenu(isPupil() ? 'devoir' : 'workone');
  }
  if (ds.member !== undefined) { memberOpen = ds.member; return openMenu('member'); }
  /* On doit pouvoir lire ces textes sans compte : le retour ramène donc
     là d'où l'on venait, y compris l'écran de connexion. */
  if (ds.legal !== undefined) {
    legalTab = ds.legal;
    if (view.name !== 'legal') legalBack = view.name === 'login' ? 'login' : 'settings';
    return go('legal');
  }
  if (ds.yes !== undefined) return answerFriend(ds.yes, true);
  if (ds.no !== undefined) return answerFriend(ds.no, false);
  if (ds.mate !== undefined) { mateOpen = ds.mate; return openMenu('mate'); }
  if (ds.group !== undefined) { groupOf = ds.group; return openMenu('groupitem'); }
  if (ds.mail !== undefined) return openMail(+ds.mail);
  if (ds.dpick !== undefined) return duelPick(+ds.dpick);
  if (ds.lib !== undefined) { lib.open = ds.lib; return openMenu('libitem'); }
  if (ds.duel !== undefined) { duels.open = ds.duel; return openMenu('duelitem'); }
  if (ds.gtab !== undefined) { groupTab = ds.gtab; groupPull(); animate = false; return render(); }
  /* changer de portée, c'est changer de public : le classement se
     recalcule côté base, la bibliothèque et les défis se refiltrent ici */
  if (ds.scope !== undefined) {
    scope = ds.scope || null;
    board.rows = null; animate = false; render();
    return boardPull();
  }
  if (ds.brange !== undefined) { board.range = +ds.brange; board.rows = null; animate = false; render(); return boardPull(); }
  if (ds.pkc !== undefined && sel) {
    /* on ne repeint que la ligne touchée et le décompte : reconstruire la
       liste entière ferait sauter le défilement à chaque coche */
    sel.has(ds.pkc) ? sel.delete(ds.pkc) : sel.add(ds.pkc);
    b.closest('.row').classList.toggle('pk', sel.has(ds.pkc));
    const d = deck(view.id), bar = $.querySelector('.selb');
    if (d && bar) bar.outerHTML = selBar(d);
    return;
  }
  if (ds.trr !== undefined) return trashRestore(ds.trr);
  if (ds.trd !== undefined) {
    /* deux temps : la corbeille est le dernier filet, on ne le troue pas
       sur un doigt qui glisse */
    if (b.dataset.arm) return trashPurge(ds.trd);
    b.dataset.arm = 1; b.classList.add('on'); b.lastChild.textContent = 'Confirmer';
    setTimeout(() => { if (b.isConnected) { delete b.dataset.arm; b.classList.remove('on'); b.lastChild.textContent = 'Supprimer'; } }, 3000);
    return;
  }
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
  /* pendant le rangement, un livre se prend et se pose : il ne s'ouvre pas */
  if (ds.go) { if (reorder) return; return go('deck', ds.go); }
  if (ds.a) return fling(ds.a === 'yes' ? 1 : -1);
  if (ds.g !== undefined) { pendingGrade = +ds.g; return fling(+ds.g > 0 ? 1 : -1); }
  if (ds.rm) { const d = deck(view.id); d.cards = d.cards.filter(c => c.id !== ds.rm); saveDeck(d); return render(); }
  if (ds.sus) {
    const d = deck(view.id), c = d.cards.find(x => x.id === ds.sus);
    c.x = !c.x; saveDeck(d); return render();
  }
  const a = ds.act, d = view.id ? deck(view.id) : null;
  if (ds.card) { cardEdit = ds.card; return openMenu('card'); }
  /* Ajouter un camarade depuis la liste de sa classe : pas de pseudo à
     taper, on appuie sur le plus en face du nom. */
  /* ---- la console du référent ---- */
  if (ds.atab) { adm.tab = ds.atab; animate = false; return render(); }
  if (ds.rtab) { ref.tab = ds.rtab; if (ref.tab === 'gens' && !ref.gens) refPeople(true);
    animate = false; return render(); }
  if (ds.rrole !== undefined) { ref.role = ds.rrole; refPeople(true); animate = false; return render(); }
  if (ds.rpage !== undefined) { ref.page = +ds.rpage; refPeople(false); animate = false; return render(); }
  if (ds.rclsoff) { ref.cls = null; refPeople(true); animate = false; return render(); }
  if (ds.rwho) {
    ref.who = (ref.gens || []).find(x => x.id === ds.rwho) || null;
    ref.service = null; ref.form = {};
    return openMenu('refwho');
  }
  if (ds.rcls) { ref.open = ds.rcls; ref.team = null; ref.form = {}; return openMenu('refcls'); }
  if (ds.pclasse) {
    prof.open = ds.pclasse; prof.tab = 'eleves'; prof.q = '';
    prof.roster = null; prof.devoirs = null;
    profClassePull(prof.open); return go('profclasse');
  }
  if (ds.ptab) { prof.tab = ds.ptab; animate = false; return render(); }
  if (ds.pvue) { prof.vue = ds.pvue; animate = false; return render(); }
  if (ds.pmois) { prof.mois = ds.pmois; animate = false; return render(); }
  if (ds.pjour) { prof.jour = prof.jour === ds.pjour ? null : ds.pjour;
    prof.mois = ds.pjour; animate = false; return render(); }
  if (ds.ptri) { prof.tri = ds.ptri; animate = false; return render(); }
  if (ds.peleve) {
    prof.eleve = ds.peleve; prof.fiche = null;
    profFichePull(prof.open, prof.eleve); return go('profeleve');
  }
  if (ds.pwork) { prof.work = ds.pwork; prof.cartes = null; return openMenu('pwork'); }
  if (ds.camadd) {
    const n = ds.camn;
    askFriend(n).then(ok => { if (ok) { mates2 = null; matesPull(); } })
      .catch(() => toast(I.x, 'Impossible pour l’instant'));
    return;
  }
  if (b.dataset.tf !== undefined) return answerTF(b.dataset.tf === '1');
  if (b.dataset.pick !== undefined) return pickMCQ(+b.dataset.pick);
  if (b.dataset.mt) { const [sd, mid] = b.dataset.mt.split(':'); return pickMatch(sd, mid); }
  /* Deux boutons distincts, donc deux chemins : l'un joue ce qui a été
     enregistré, l'autre fait lire le texte. Chacun sait ce qu'il déclenche
     au lieu de dépendre de ce que la carte contient. */
  if (b.dataset.snd !== undefined || b.dataset.say !== undefined) {
    const dire = b.dataset.say !== undefined;
    const c = cardOf(0); if (!c) return;
    const bk = (dire ? b.dataset.say : b.dataset.snd) === 'b';
    const tf = isTF(c);
    const rv = !tf && (study.dirs ? study.dirs[c.id] : study.rev);
    const useBack = bk !== !!rv;
    const aud = useBack ? c.ba : c.fa, txt = useBack ? c.b : c.f;
    const org = cardOrigin(c);                 // en marathon, la langue du paquet d'origine
    if (dire || !aud) say(txt, useBack ? org.langb : org.langf);
    else play(aud);
    return;
  }
  if (a === 'home' || a === 'tab-home') return go('home');
  if (a === 'tab-commu' || a === 'commu') { commuPull(); return go('commu'); }
  if (a === 'friends') { if (!friends) friendsPull(); return go('friends'); }
  if (a === 'groups') { if (!groups) groupsPull(); return go('groups'); }
  if (a === 'duels') { if (!duels.list) duelsPull(); return go('duels'); }
  if (a === 'library') { if (!lib.list) libPull(); return go('library'); }
  if (a === 'board') { if (!board.rows) boardPull(); return go('board'); }
  if (a === 'doadd') return doAdd();
  /* Le pseudo scolaire vient de l'établissement : la base renverse déjà
     toute tentative de le changer, l'écran n'ouvre donc pas le formulaire. */
  if (a === 'handle') return isPupil() ? toast(I.lock, 'Ton pseudo est celui de ton établissement')
                                       : openMenu('handle');
  if (a === 'newgroup') { addQ = ''; return openMenu('newgroup'); }
  if (a === 'joingroup') { addQ = ''; return openMenu('joingroup'); }
  /* un quiz se lance depuis un paquet : en sortir, c'est y revenir */
  if (a === 'quitquiz') { const id = quiz && quiz.id; quiz = null;
    return deck(id) ? go('deck', id) : go('home'); }
  if (a === 'peek') { peek = !peek; render(); return; }
  if (a === 'marathon') return startStudy('all', false, null, { only: 'due', both: prefs.both });
  if (a === 'retry') {
    if (!pending()) return toast(I.check, 'Tout est enregistré');
    toast(I.cloud, 'Envoi…');
    flush().then(() => { animate = false; render(); if (online && !pending()) toast(I.check, 'À jour'); });
    return;
  }
  if (a === 'mcq' || a === 'match') return startStudy(view.id, false, null, { mode: a });
  /* Partager est posé sur l'écran du livre : sans cette ligne, seul le
     menu « … » le connaissait et le bouton ne faisait rien. */
  if (a === 'sharepick') { if (!friends) friendsPull(); return openMenu('sharepick'); }
  if (a === 'goalinfo' || a === 'stats') { stats.rows = null; statsPull(); return go('stats'); }
  if (a === 'group') { groupPull(); return go('group'); }
  if (a === 'help') return openMenu('tuto');
  if (a === 'install') return openInstall();
  if (a === 'duelnew') return openMenu('duelnew');
  if (a === 'duelquit') { duelRun = null; return go('group'); }
  if (a === 'addshared') {
    const sd = shared && shared.d; if (!sd) return;
    const cards = (sd.cards || []).map(c => [cf(c), cb(c)]);
    const nd = importPayload({ name: sd.name, subject: '', cards }, true);
    shared = null;
    if (nd) go('deck', nd.id); else go('home');
    return toast(I.check, plur(cards.length, 'page') + ' ajoutée' + (cards.length > 1 ? 's' : ''));
  }
  if (a === 'expstats') return exportStats();
  /* Rejoue tout l'historique de révision dans le moteur : chaque fiche
     retrouve la stabilité et la difficulté qu'elle aurait si FSRS l'avait
     suivie depuis sa toute première lecture. */
  if (a === 'replay') {
    toast(I.chart, 'Lecture de ton historique…');
    (async () => {
      try {
        const before = prefs.wAt || 0;
        const n = await fsrsTune(true);
        animate = false; render();
        const tuned = (prefs.wAt || 0) !== before;
        toast(n || tuned ? I.check : I.x,
          !n && !tuned ? 'Pas encore assez d’historique noté'
          : tuned ? 'Moteur réglé sur ton historique' + (n ? ' · ' + plur(n, 'page') + ' à jour' : '')
          : plur(n, 'page') + ' recalculée' + (n > 1 ? 's' : '') + ' sur ton historique');
      } catch (e) { toast(I.x, 'Historique indisponible'); }
    })();
    return;
  }
  if (a === 'find') { findQ = ''; return go('find'); }
  if (a === 'deckfind') {
    deckOpen = !deckOpen;
    if (!deckOpen) deckQ = '';
    animate = false; return render();
  }
  if (a === 'zen') { prefs.zen = !prefs.zen; savePrefs(); animate = false; return render(); }
  if (a === 'sortpick') return openMenu('sortpick');
  if (a === 'listview') { prefs.list = !prefs.list; savePrefs(); animate = false; return render(); }
  if (a === 'reorder') {
    reorder = !reorder;
    if (reorder && prefs.sort !== 'manual') { prefs.sort = 'manual'; savePrefs(); }
    animate = false; return render();
  }
  if (a === 'resume') {
    const r = loadResume(); if (!r) return render();
    study = r; return go('study', r.id);
  }
  if (a === 'settings') return go('settings');
  if (a === 'tolog') return go('login');
  if (a === 'mod') { if (!mods.list) modPull(); return go('mod'); }
  if (a === 'admin') { if (!accounts) accountsPull(); if (!adm.orgs) admPull(); return go('admin'); }
  /* Le bouton vit dans les Réglages, donc il porte data-act : le
     gestionnaire était rangé avec ceux des feuilles, qui lisent data-mact.
     Il n'a jamais été atteint une seule fois. */
  if (a === 'blocked') { blocksPull().then(() => paintMenu()); return openMenu('blocked'); }
  /* Trois publics, trois écrans derrière le même bouton : l'élève n'a
     qu'une classe et n'a pas à traverser une liste d'un seul élément ; le
     professeur en a dix et lui faut une grille ; un compte personnel qui
     s'est fait une classe garde l'écran d'origine. */
  if (a === 'classes') {
    if (isPupil()) { maClassePull(); return go('maclasse'); }
    if (myRole === 'ref' && atSchool()) { refPull(); return go('ref'); }
    if (isProf() && atSchool()) { if (!prof.classes) profPull(); return go('prof'); }
    if (!classes) classesPull(); return go('classes');
  }
  if (a === 'prof') { if (!prof.classes) profPull(); return go('prof'); }
  if (a === 'ref') { refPull(); return go('ref'); }
  if (a === 'refnew') { ref.form = { role: 'eleve' }; return openMenu('refnew'); }
  if (a === 'refnewclass') { ref.form = {}; return openMenu('refnewclass'); }
  if (a === 'pnew') {
    /* Le vrai éditeur : photo d'une page, PDF, export, cours collé,
       image et son sur chaque face. On y entre, on en ressort sur
       « à qui, pour quand ». */
    prof.comp = compNeuf();
    resetComp({ cours: true, pour: 'devoir' });
    return go('import');
  }
  if (a === 'plib') { prof.comp = compNeuf(); return openMenu('plivre'); }
  if (a === 'pretour') {
    /* Retour de l'éditeur vers le devoir en préparation. */
    const d = deck(view.id);
    if (d) return donnerLivre(d);
    return go('prof');
  }
  if (a === 'pbilan') { prof.tab = 'bilan'; if (!prof.open && (prof.classes || []).length) {
      prof.open = prof.classes[0].id; profClassePull(prof.open); }
    return prof.open ? go('profclasse') : undefined; }
  if (a === 'pcode') return openMenu('classcode');
  if (a === 'pback') return go('profclasse');
  if (a === 'pmot') return openMenu('pmot');
  if (a === 'newclass') return openMenu('newclass');
  if (a === 'joinclass') return openMenu('joinclass');
  if (a === 'newwork') return openMenu('newwork');
  if (a === 'backup2') return openMenu('backup');
  if (a === 'undo2') { doUndo(); return; }
  if (a === 'mail') { mailbox.list = null; mailPull(); return go('mail'); }
  if (a === 'trash') { trash.list = null; trashPull(); return go('trash'); }
  /* ---- sélection multiple ---- */
  if (a === 'selmode') { sel = sel ? null : new Set(); return render(); }
  if (a === 'selall') {
    const d = deck(view.id); if (!d) return;
    sel = new Set(sel.size === d.cards.length ? [] : d.cards.map(c => c.id));
    return render();
  }
  if (a === 'selmove') return openMenu('move');
  if (a === 'selsus') {
    const d = deck(view.id); if (!d || !sel.size) return;
    const cs = d.cards.filter(c => sel.has(c.id));
    const on = cs.some(c => !c.x);                   // tout d'un bloc, dans le même sens
    pushUndo('Suspension', [d.id]);
    cs.forEach(c => { if (on) c.x = 1; else delete c.x; });
    saveDeck(d); render();
    return toast(on ? I.eyeoff : I.eye, cs.length + (on ? ' suspendue' : ' réactivée') + (cs.length > 1 ? 's' : ''), true);
  }
  if (a === 'seldel') {
    const d = deck(view.id); if (!d || !sel.size) return;
    const n = d.cards.filter(c => sel.has(c.id)).length;
    pushUndo('Suppression', [d.id]);
    d.cards = d.cards.filter(c => !sel.has(c.id));
    sel = new Set(); saveDeck(d); render();
    return toast(I.trash, n + ' carte' + (n > 1 ? 's' : '') + ' supprimée' + (n > 1 ? 's' : ''), true);
  }
  if (a === 'logout') return logout();
  if (a === 'tglsimple') return openMenu(prefs.simple ? 'engine' : 'simple');
  if (a === 'tglfresh') { prefs.fresh = !prefs.fresh; savePrefs(); return render(); }
  if (a === 'tglboth') { prefs.both = !prefs.both; savePrefs(); return render(); }
  if (a === 'tglfast') { prefs.fast = !prefs.fast; savePrefs(); return render(); }
  if (a === 'tglsound') { prefs.sound = !prefs.sound; savePrefs(); render(); if (prefs.sound) beep(true); return; }
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
  if (a === 'restart') {
    /* Le bouton porte un mélangeur : il mélange, quel que soit l'ordre
       réglé dans les préférences. Avant, il reconstruisait la file avec
       cet ordre — « du paquet », « urgentes » ou « ratées » redonnaient
       exactement la même suite, et le bouton semblait mort.
       Le reste de la session est conservé : le sens, le mode, et le
       filtre (le marathon reste sur les cartes dues). */
    const o = (study && study.opt) || {};
    return startStudy(study ? study.id : view.id, study && study.rev, null,
      study ? { ...o, mode: study.mode, both: study.both, order: 'random' } : { order: 'random' });
  }
  if (a === 'swap') {
    if (!study) return;
    study.rev = !study.rev;
    study.both = false;                       // un sens choisi à la main l'emporte sur le mélange
    if (study.dirs) for (const x of study.queue) study.dirs[x] = study.rev;
    study.flip = false; study.tf = null; study.pick = null; study.opts = null;
    saveResume();
    toast(I.swap, study.rev ? 'Sens inversé' : 'Sens normal');
    const bar = document.querySelector('.bar [data-act="swap"]');
    if (bar) bar.classList.toggle('solid', study.rev);
    return paintQ();
  }
  if (a === 'swapq') {
    if (!quiz) return;
    /* La réponse d'aujourd'hui devient la question de demain : on repart sur
       le même mot plutôt qu'au hasard ailleurs dans le paquet. */
    const cur = quiz.pool[quiz.i];
    const at = cur ? norm(plain(cur.a[0])) : '';
    toast(I.swap, quiz.rev ? 'Sens normal' : 'Sens inversé');
    return startQuiz(quiz.id, null, !quiz.rev, { at });
  }
  if (a === 'anyway') {
    if (quiz.state !== 'bad') return;
    quiz.ok++; quiz.forced++; quiz.bad.pop(); quiz.miss.pop();
    quiz.log[quiz.log.length - 1] = 1;
    return nextQ();
  }
  if (a === 'nextcard') {
    if (!study) return;
    if (study.mode === 'mcq' && study.pick != null) return commit(study.pickOk, study.pickOk ? 2 : 0);
    if (study.tf != null) { pendingGrade = study.tf ? 2 : 0; return fling(study.tf ? 1 : -1); }
    return;
  }
  if (a === 'redostudy') return startStudy(study.id, study.rev, study.miss.map(m => m.id));
  if (ds.qp !== undefined) return pickQuiz(+ds.qp);
  if (ds.qsay !== undefined) return say(quiz.pool[quiz.i].f, quiz.qlang);
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
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z'
      && !/INPUT|TEXTAREA/.test(e.target.tagName) && !e.target.isContentEditable) {
    if (canUndo()) { e.preventDefault(); doUndo(); }
    return;
  }
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
    return fling(pendingGrade > 0 ? 1 : -1);
  }
  if (e.key === 'ArrowLeft') fling(-1);
  else if (e.key === 'ArrowRight') fling(1);
  else if (e.key === ' ') { e.preventDefault(); toggleFlip(); }
});

/* ---------- raccourcis d'ouverture ----------
   « ?go=… » ouvre l'app à un endroit précis : c'est ce que le manifeste
   déclare pour le menu d'appui long sur l'icône. Le paramètre est retiré
   aussitôt, pour que recharger la page ne rejoue pas l'action. */
const GOTO = {
  study: () => { if (!allDue()) { go('home'); return toast(I.check, 'Rien à revoir pour l’instant'); }
                 startStudy('all', false, null, { only: 'due', both: prefs.both }); },
  new: () => { resetComp(); go('import'); },
  mail: () => { mailbox.list = null; mailPull(); go('mail'); },
  commu: () => { commuPull(); go('commu'); },
  stats: () => { stats.rows = null; statsPull(); go('stats'); }
};
function consumeGoto() {
  const q = new URLSearchParams(location.search).get('go');
  if (!q || !GOTO[q]) return false;
  history.replaceState(null, '', location.pathname + location.hash);
  try { GOTO[q](); } catch (e) { go('home'); }
  return true;
}

/* ---------- lien d'injection ---------- */
function consumeHash() {
  if (location.hash.startsWith('#s=')) {
    const tok = location.hash.slice(3).replace(/[^a-z0-9]/gi, '').slice(0, 32);
    history.replaceState(null, '', location.pathname);
    if (tok) { openShared(tok); return true; }
    return false;
  }
  if (!location.hash.startsWith('#i=')) return false;
  try {
    const d = importPayload(dec(location.hash.slice(3)));
    history.replaceState(null, '', location.pathname);
    if (d) { go('deck', d.id); toast(I.check, plur(d.cards.length, 'page')); return true; }
  } catch (e) { history.replaceState(null, '', location.pathname); }
  return false;
}

/* ══════════ ce qui appartient à un compte ══════════
   Changer de compte laissait tout en place : les amis de l'un
   apparaissaient chez l'autre, ses clubs, ses défis, son rôle. Les données
   n'avaient pourtant jamais traversé — la base refusait déjà de les rendre
   — mais l'écran, lui, gardait la dernière réponse reçue et la montrait au
   suivant. Une fuite d'affichage, pas de données, et tout aussi
   inacceptable : on ne peut pas demander à quelqu'un de croire un
   cloisonnement qu'il voit se faire contredire.

   Tout ce qui dépend du compte connecté est donc listé ICI, à un seul
   endroit, et remis à zéro à chaque changement. Une variable ajoutée
   ailleurs et oubliée ici recrée le bug : quand on en déclare une nouvelle
   qui parle du compte, elle vient dans cette liste. */
function resetSession() {
  /* la bibliothèque et ce qui attend d'être envoyé */
  db = { subjects: [], decks: [], hist: {} };
  prefs = { ...DEFPREFS };
  dirty = {}; gone = []; conflicts = []; undos = [];
  trash = { n: 0, list: null, err: 0 };
  vers = { list: null, err: 0, of: null };

  /* le cercle : qui l'on est, qui l'on connaît, ce qu'on partage */
  me = null; friends = null; mates = null; asks = null;
  groups = null; groupOf = null; scope = null; groupTab = 'lib';
  lib = { list: null, err: 0, open: null };
  duels = { list: null, scores: null, err: 0, open: null };
  board = { rows: null, err: 0, range: 7 };
  blocks = null;
  mailbox = { n: 0, list: null, err: 0 };
  mateOpen = null; mateProf = { id: null, range: 7, row: null, lib: null, load: 0 };
  sendTo = null; sendMsg = ''; mailOpen = null; addQ = '';

  /* le rôle et ce qu'il ouvre */
  myRole = 'eleve'; iAmMod = false;
  school = null; team = null; mates2 = null;
  prof = { annee: null, annees: null, classes: null, err: 0,
           open: null, tab: 'eleves', roster: null, devoirs: null, bilan: null,
           tri: 'retard', q: '', eleve: null, fiche: null,
           work: null, cartes: null, comp: null,
           vue: 'liste', mois: null, agenda: null, jour: null };
  adm = { orgs: null, etat: null, tab: 'orgs' };
  ref = { tab: 'etab', board: null, err: 0,
          gens: null, total: 0, page: 0, q: '', role: '', cls: null, cherche: 0,
          classes: null, open: null, team: null,
          who: null, service: null, form: null, trace: null };
  mods = { list: null, err: 0, seen: 0 };
  accounts = null; accOpen = null;
  classes = null; classOf = null; roster = null; asgs = null;
  workOpen = null; memberOpen = null;
  reportOn = null; reportWhy = '';

  /* les écrans en cours */
  view = { name: 'login' }; menu = null; study = null; quiz = null;
  stats = { rows: null, err: 0, range: 30 };
  shared = null; duelRun = null; previewOf = null; leaving = null;
  filter = ''; peek = false; sel = null; reorder = false;
  findQ = ''; deckQ = ''; deckOpen = false; deckShow = DECKPAGE;
  subjEdit = null; cardEdit = null; comp = { subject: '', cards: [], edit: -1, bulk: false, text: '', dups: false };

  /* les images et sons déjà rapatriés : ils appartenaient à l'autre compte,
     et les laisser en mémoire serait garder ouvert ce qu'on vient de fermer */
  for (const u of mediaCache.values()) { try { URL.revokeObjectURL(u); } catch (e) {} }
  mediaCache.clear();
}

function logout() {
  flush();
  const key = cacheKey();
  saveAuth(null);
  if (key) { try { localStorage.removeItem(key); } catch (e) {} }
  resetSession();
  loginMode = 'in';
  animate = true; render();
}

/* ══════════ visite guidée ══════════
   Tout se joue sur un compte de démonstration fabriqué ici même : Léa, ses
   quatre paquets, sa progression. Les paquets de l'utilisateur ne sont
   jamais touchés, et pendant la visite rien ne part vers la base — ni
   écriture, ni lecture. On sauvegarde l'état réel, on le remplace, on le
   remet à la fin, à l'identique.

   Une étape montre une zone, l'explique en deux phrases, et attend : soit
   le bouton Suivant, soit le geste dont elle parle. Chaque étape sait se
   remettre elle-même dans le bon écran, donc rien ne peut se coincer si
   l'utilisateur prend de l'avance ou appuie sur Suivant trop tôt. */

const DEMOSUBJ = [
  { id: 'italien', name: 'Italien', color: 'red', pos: 0 },
  { id: 'droit', name: 'Droit', color: 'pink', pos: 1 },
  { id: 'anglais', name: 'Anglais', color: 'blue', pos: 2 },
  { id: 'geo', name: 'Géographie', color: 'green', pos: 3 }
];
const DEMOCARDS = {
  italien: [['la casa', 'la maison'], ['il cane', 'le chien'], ['il gatto', 'le chat'],
    ['il libro', 'le livre'], ['l’acqua', 'l’eau'], ['il pane', 'le pain'],
    ['il sole', 'le soleil'], ['la luna', 'la lune'], ['il mare', 'la mer'],
    ['la città', 'la ville'], ['il vino', 'le vin'], ['la strada', 'la rue']],
  droit: [['Contrat', 'Accord de volontés créant des obligations'],
    ['Dol', 'Manœuvre trompeuse qui provoque le consentement'],
    ['Cause', 'La raison pour laquelle on s’engage'],
    ['Solidarité', 'Chaque débiteur peut être poursuivi pour le tout'],
    ['Prescription', 'Extinction d’un droit par l’écoulement du temps'],
    ['Novation', 'Remplacement d’une obligation par une autre'],
    ['Subrogation', 'Transfert d’une créance à celui qui a payé'],
    ['Astreinte', 'Somme due par jour de retard'],
    ['Résolution', 'Anéantissement rétroactif du contrat'],
    ['Nullité', 'Sanction d’une condition de formation manquante']],
  anglais: [['to bring', 'brought'], ['to catch', 'caught'], ['to teach', 'taught'],
    ['to seek', 'sought'], ['to buy', 'bought'], ['to think', 'thought'],
    ['to fight', 'fought'], ['to leave', 'left'], ['to feel', 'felt'], ['to keep', 'kept']],
  geo: [['Portugal', 'Lisbonne'], ['Hongrie', 'Budapest'], ['Norvège', 'Oslo'],
    ['Croatie', 'Zagreb'], ['Finlande', 'Helsinki'], ['Irlande', 'Dublin'],
    ['Autriche', 'Vienne'], ['Slovénie', 'Ljubljana']]
};
/* Des états variés, sinon les barres de couleur n'ont rien à montrer :
   quelques cartes dues aujourd'hui, des jeunes, des mûres, une coriace. */
function demoDeck(id, name, subject, pat) {
  const now = Date.now();
  const cards = DEMOCARDS[subject].map(([f, b], i) => {
    const k = pat[i % pat.length];
    const c = { id: id + 'c' + i, f, b };
    if (k === 'new') return c;
    if (k === 'due') return { ...c, n: 2, i: 3, e: 2.4, d: now - 6 * 3600e3 };
    if (k === 'learn') return { ...c, n: 1, i: 1, e: 2.3, d: now + 14 * 3600e3 };
    if (k === 'leech') return { ...c, n: 2, i: 2, e: 1.5, l: 5, d: now - 2 * 3600e3 };
    if (k === 'young') return { ...c, n: 4, i: 9, e: 2.6, d: now + 5 * DAY };
    return { ...c, n: 7, i: 42, e: 2.8, d: now + 28 * DAY };
  });
  return { id, name, subject, hidden: false, pinned: false, pos: 0, meta: {}, rev: 1, cards };
}
function demoDB() {
  const mid = new Date(); mid.setHours(0, 0, 0, 0);
  const decks = [
    demoDeck('dmo1', 'Italien — les bases', 'italien', ['due', 'young', 'due', 'mature', 'learn', 'due']),
    demoDeck('dmo2', 'Droit civil — définitions', 'droit', ['young', 'due', 'leech', 'mature', 'young']),
    demoDeck('dmo3', 'Verbes irréguliers', 'anglais', ['mature', 'mature', 'young', 'due', 'mature']),
    demoDeck('dmo4', 'Capitales d’Europe', 'geo', ['mature', 'mature', 'young', 'mature'])
  ];
  decks[0].meta = { langf: 'it-IT', langb: 'fr-FR' };
  const hist = {};
  for (const d of decks) hist[d.id + ':quiz'] = [{ t: Date.now() - 3 * DAY, p: .62 }, { t: Date.now() - DAY, p: .81 }];
  return { subjects: DEMOSUBJ.map(x => ({ ...x })), decks, hist, today: { d: +mid, n: 14 } };
}

let tour = null, tourSave = null, tourPoll = 0;
let demo = false;                       // pendant la visite : plus rien ne sort de l'appareil

/* ---------- le fil des chapitres ----------
   Chaque étape : où aller (go), quoi montrer (sel), quoi dire, et
   éventuellement le geste qui la fait avancer toute seule (done). */
const nav = (name, id) => () => { closeMenu(); view = { name, id }; };
const CHAPTERS = [
  { id: 'bases', name: 'Ta bibliothèque', icon: 'layers', steps: [
    { go: nav('home'), title: 'Bienvenue',
      text: 'Tout ce que tu vas voir appartient à Léa, un compte d’essai. Tes livres à toi ne bougent pas.' },
    { go: nav('home'), sel: '.grid .tile', title: 'Un livre',
      text: 'Chaque livre porte ses pages. Le signet dit combien sont à lire aujourd’hui.' },
    { go: nav('home'), sel: '.sbar', title: 'Les couleurs',
      text: 'Orange : tu viens de commencer. Vert clair : tu sais depuis peu. Vert foncé : tu sais depuis longtemps.' },
    { go: nav('home'), sel: '.goal', title: 'L’objectif du jour',
      text: 'L’anneau se remplit à chaque carte revue. Tu choisis le nombre dans les réglages.' },
    { go: nav('home'), sel: '.grid .tile', pass: 1, tap: 'Touche le livre', wait: 400,
      done: () => view.name === 'deck', title: 'Entrons dedans',
      text: 'Touche « Italien — les bases ».' }
  ] },
  { id: 'revi', name: 'Lire', icon: 'play', steps: [
    { go: nav('deck', 'dmo1'), sel: '.mixwrap', title: 'Le détail du livre',
      text: 'Les mêmes couleurs, page par page. « Coriaces » : celles que tu rates à chaque fois.' },
    { go: nav('deck', 'dmo1'), sel: '.duo .prim', pass: 1, tap: 'Touche Lire', wait: 500,
      done: () => view.name === 'study', title: 'On y va',
      text: 'Les pages arrivent une par une.' },
    { go: () => { if (view.name !== 'study' || !study) startStudy('dmo1'); study.flip = false; },
      sel: '#top', pass: 1, tap: 'Touche la page', wait: 1100,
      done: () => study && study.flip, title: 'Retourne-la',
      text: 'Tu lis, tu cherches dans ta tête, puis tu touches pour voir le verso.' },
    { go: () => { if (view.name !== 'study' || !study) startStudy('dmo1'); prefs.simple = true; },
      sel: '#top', swipe: 1, pass: 1, lock: 1, tap: 'Balaie vers la droite', wait: 450,
      done: () => study && study.i > 0, title: 'À droite : je sais',
      text: 'À gauche quand c’est à revoir. Les deux pastilles apparaissent sous ton doigt.' },
    { go: () => { prefs.simple = false; if (view.name !== 'study' || !study) startStudy('dmo1'); study.flip = true; },
      sel: '.grades', title: 'Ou tu dis si c’était dur',
      text: 'Plus c’était facile, plus la page mettra de temps à revenir. La date est sous chaque bouton.' },
    { go: nav('home'), sel: '.marathon', title: 'Tout revoir d’un coup',
      text: 'Les pages dues de tous tes livres, dans une seule séance.' }
  ] },
  { id: 'creer', name: 'Écrire un livre', icon: 'plus', steps: [
    { go: nav('home'), sel: '.fab', pass: 1, tap: 'Touche le +', wait: 450,
      done: () => view.name === 'import', title: 'Un nouveau livre',
      text: 'Le bouton rond en bas à droite.' },
    { go: () => { resetComp(); comp.bulk = true; view = { name: 'import' }; menu = null; },
      sel: '#tx', title: 'Colle une liste',
      text: 'Une ligne par page : le mot, une tabulation ou un tiret, la réponse. Le découpage se fait tout seul.' },
    { go: () => { resetComp(); comp.bulk = true; view = { name: 'import' }; menu = null; },
      sel: '.airow', title: 'Ou pars de ton cours',
      text: 'Photo d’une page, PDF, ou texte collé : les pages sont écrites pour toi.' }
  ] },
  { id: 'jeux', name: 'Réciter', icon: 'pen', steps: [
    { go: nav('deck', 'dmo1'), sel: '[data-act="quizdeck"]', pass: 1, tap: 'Touche Récitation', wait: 500,
      done: () => view.name === 'run', title: 'La récitation',
      text: 'Tu écris la réponse au lieu de la reconnaître. C’est plus dur, et ça retient mieux.' },
    { go: () => { if (view.name !== 'run' || !quiz) startQuiz('dmo1'); }, sel: '.arow, .qcard',
      title: 'Tape ta réponse',
      text: 'Les accents et les majuscules sont pardonnés. Tu règles la sévérité paquet par paquet.' },
    { go: nav('deck', 'dmo1'), sel: '[data-act="menu"]', title: 'Et aussi',
      text: 'QCM, association, vrai ou faux : tout est dans ce menu.' }
  ] },
  { id: 'ranger', name: 'Ranger', icon: 'search', steps: [
    { go: nav('deck', 'dmo2'), sel: '[data-act="selmode"]', title: 'Plusieurs pages à la fois',
      text: 'Coche des pages pour les déplacer dans un autre livre, les mettre de côté ou les supprimer ensemble.' },
    { go: nav('home'), sel: '[data-act="find"]', title: 'Retrouver un mot',
      text: 'Cherché dans les titres et dans les deux faces de toutes tes pages.' },
    { go: nav('settings'), sel: '[data-act="trash"]', title: 'Rien ne se perd',
      text: 'Un livre supprimé attend trente jours ici. Et la dernière action reste annulable.' }
  ] },
  { id: 'commu', name: 'Le cercle des lecteurs', icon: 'user', steps: [
    { go: nav('home'), sel: '.tabs button:last-child', pass: 1, tap: 'Touche le deuxième onglet', wait: 450,
      done: () => view.name === 'commu', title: 'Le deuxième onglet',
      text: 'Tout ce qui te relie aux autres est rangé là. Tu peux aussi glisser l’écran vers la gauche.' },
    { go: nav('commu'), sel: '.mecard', title: 'Ton pseudo',
      text: 'C’est ce que tes amis taperont pour t’ajouter. Personne ne voit ton adresse e-mail.' },
    { go: nav('commu'), sel: '.ctiles .ctile:nth-child(1)', title: 'Les lecteurs',
      text: 'Tu entres son pseudo, il accepte, et vous partagez bibliothèque, défis et classement.' },
    { go: nav('commu'), sel: '.ctiles .ctile:nth-child(2)', title: 'Les clubs',
      text: 'Une classe, un binôme. Tu crées, tu donnes le code, et tout le club voit la même bibliothèque.' },
    { go: nav('commu'), sel: '.ctiles .ctile:nth-child(3)', title: 'Les défis',
      text: 'Dix questions tirées d’un livre, les mêmes pour tout le monde, un seul essai chacun.' },
    { go: nav('commu'), sel: '.ctiles .ctile:nth-child(4)', title: 'La bibliothèque',
      text: 'Les livres que tes lecteurs ont prêtés. Tu en copies un chez toi d’un geste.' },
    { go: nav('commu'), sel: '.rows', title: 'Le classement',
      text: 'Le nombre de pages lues par chacun, et rien d’autre : ni tes livres, ni tes erreurs.' }
  ] },
  { id: 'fin', name: 'Pour finir', icon: 'chart', steps: [
    { go: nav('settings'), sel: '[data-act="stats"]', title: 'Ton journal',
      text: 'Pages lues, réussite, régularité : de quoi voir si le rythme tient.' },
    { go: nav('settings'), sel: '[data-act="help"]', title: 'Revoir tout ça',
      text: 'Réglages, puis Aide. Chaque chapitre se rejoue seul, toujours sur le compte d’essai.' }
  ] }
];

function tourSteps(chapId) {
  const list = chapId ? CHAPTERS.filter(c => c.id === chapId) : CHAPTERS;
  return list.flatMap((c, ci) => c.steps.map(s => ({ ...s, chap: c.name, ci, cn: list.length })));
}

function startTour(chapId) {
  if (tour) return;
  const steps = tourSteps(chapId);
  if (!steps.length) return;
  tourSave = { db, prefs, view, study, quiz, filter, peek, groupTab, scope,
               me, mates, asks, friends, groups, duels, lib, board };
  demo = true;
  closeMenu(); selOff();
  db = demoDB();
  prefs = { ...DEFPREFS, name: 'Léa', goal: 40, sound: true, tuto: 1 };
  me = { id: 'demo', handle: 'lea' };
  mates = [{ id: 'f1', handle: 'thibault', name: 'Thibault', status: 'ok', sens: 'envoyee' },
           { id: 'f2', handle: 'ibti', name: 'Ibti', status: 'ok', sens: 'recue' }];
  asks = []; friends = mates.slice();
  groups = [{ id: 'g1', name: 'Prépa D1', code: 'K7PQR', owner: 'demo' }];
  duels = { list: [{ id: 'du1', owner: 'f1', who: 'thibault', name: 'Droit civil',
                     total: 10, cards: [], created_at: new Date(Date.now() - 3600e3).toISOString() }],
            scores: [], err: 0, open: null };
  lib = { list: [{ deck_id: 'lx', user_id: 'f1', who: 'thibault', name: 'Droit civil — définitions',
                   subject: 'Droit', n: 64, cards: [], updated_at: new Date(Date.now() - 2 * DAY).toISOString() }],
          err: 0, open: null };
  board = { rows: [{ uid: 'f1', who: 'Thibault', handle: 'thibault', n: 185, ok: 127, jours: 5 },
                   { uid: auth.uid, who: 'Léa', handle: 'lea', n: 92, ok: 70, jours: 4 },
                   { uid: 'f2', who: 'Ibti', handle: 'ibti', n: 31, ok: 28, jours: 2 }],
            err: 0, range: 7 };
  study = null; quiz = null; filter = ''; peek = false; deckQ = ''; reorder = false;
  tour = { i: 0, steps };
  document.body.classList.add('touring');
  runStep();
}
function runStep() {
  if (!tour) return;
  const s = tour.steps[tour.i];
  if (!s) return endTour(true);
  tour.lock = s.lock || 0;
  try { if (s.go) s.go(); } catch (e) {}
  animate = false; render();
  /* La cible peut être plus bas que l'écran — l'entrée « Aide » est en
     fin de réglages. On l'amène au centre avant de mesurer, sinon le halo
     se pose dans le vide et l'étape ne montre rien. */
  requestAnimationFrame(() => {
    const el = s.sel && document.querySelector(s.sel);
    if (el) {
      const r = el.getBoundingClientRect();
      if (r.top < 70 || r.bottom > innerHeight - 70) el.scrollIntoView({ block: 'center' });
    } else window.scrollTo(0, 0);
    requestAnimationFrame(paintTour);
  });
  clearInterval(tourPoll);
  tourPoll = setInterval(() => {
    if (!tour) return clearInterval(tourPoll);
    paintTour();
    if (s.done && !tour.hold) {
      try {
        if (s.done()) {
          /* on laisse voir le résultat du geste avant d'enchaîner */
          tour.hold = 1;
          setTimeout(() => { if (tour) { tour.hold = 0; nextStep(); } }, s.wait || 250);
        }
      } catch (e) {}
    }
  }, 140);
}
function nextStep() {
  if (!tour) return;
  tour.hold = 0;
  beep(true, true);
  tour.i++;
  runStep();
}
function endTour(done) {
  clearInterval(tourPoll); tourPoll = 0;
  const o = document.getElementById('tour'); if (o) o.remove();
  document.body.classList.remove('touring');
  tour = null;
  const sv = tourSave; tourSave = null;
  demo = false;
  if (sv) {
    db = sv.db; prefs = sv.prefs; view = sv.view; study = sv.study; quiz = sv.quiz;
    filter = sv.filter; peek = sv.peek; groupTab = sv.groupTab; scope = sv.scope;
    me = sv.me; mates = sv.mates; asks = sv.asks; friends = sv.friends;
    groups = sv.groups; duels = sv.duels; lib = sv.lib; board = sv.board;
  }
  closeMenu();
  if (!prefs.tuto) { prefs.tuto = 1; savePrefs(); }
  animate = true; render();
  if (done) toast(I.check, 'Visite terminée');
}

/* ---------- l'habillage ----------
   Un halo qui se déplace d'une zone à l'autre plutôt que d'apparaître et
   disparaître : l'œil suit le mouvement et sait d'où il vient. Le reste de
   l'écran s'assombrit par l'ombre portée de ce même halo — un seul élément
   à animer, donc rien ne saccade. */
function paintTour() {
  if (!tour) return;
  const s = tour.steps[tour.i];
  let o = document.getElementById('tour');
  if (!o) {
    o = document.createElement('div');
    o.id = 'tour'; o.className = 'tour';
    o.innerHTML = '<i class="tspot"></i><i class="tring"></i>' +
      '<i class="tblk t" data-t="1"></i><i class="tblk r" data-t="1"></i>' +
      '<i class="tblk b" data-t="1"></i><i class="tblk l" data-t="1"></i>' +
      '<i class="tblk h" data-t="1"></i><div class="tbub"></div>';
    document.body.appendChild(o);
    o.addEventListener('click', e => {
      const b = e.target.closest('[data-tour]');
      if (!b) return;
      e.stopPropagation();
      if (b.dataset.tour === 'next') nextStep();
      else endTour(false);
    });
  }
  const el = s.sel ? document.querySelector(s.sel) : null;
  const r = el && el.getBoundingClientRect();
  const W = innerWidth, H = innerHeight;
  const spot = o.querySelector('.tspot'), ring = o.querySelector('.tring');
  let box;
  if (r && r.width > 2 && r.height > 2 && r.bottom > 0 && r.top < H) {
    const p = s.pad == null ? 9 : s.pad;
    box = { x: Math.max(4, r.left - p), y: Math.max(4, r.top - p),
            w: Math.min(W - 8, r.width + p * 2), h: r.height + p * 2 };
    spot.style.opacity = 1; ring.style.opacity = 1;
  } else {
    /* pas de cible : le voile couvre tout, le halo se réduit au centre */
    box = { x: W / 2, y: H / 2, w: 0, h: 0 };
    spot.style.opacity = 1; ring.style.opacity = 0;
  }
  for (const n of [spot, ring]) {
    n.style.left = box.x + 'px'; n.style.top = box.y + 'px';
    n.style.width = box.w + 'px'; n.style.height = box.h + 'px';
  }
  /* les quatre volets bloquent tout sauf la zone montrée ; le cinquième
     ferme le trou quand l'étape n'attend aucun geste */
  const set = (k, x, y, w, h) => { const n = o.querySelector('.tblk.' + k);
    n.style.left = x + 'px'; n.style.top = y + 'px';
    n.style.width = Math.max(0, w) + 'px'; n.style.height = Math.max(0, h) + 'px'; };
  set('t', 0, 0, W, box.y);
  set('b', 0, box.y + box.h, W, H - box.y - box.h);
  set('l', 0, box.y, box.x, box.h);
  set('r', box.x + box.w, box.y, W - box.x - box.w, box.h);
  set('h', box.x, box.y, s.pass ? 0 : box.w, s.pass ? 0 : box.h);

  const bub = o.querySelector('.tbub');
  const last = tour.i === tour.steps.length - 1;
  const pct = Math.round((tour.i + 1) / tour.steps.length * 100);
  const html = `<i class="tprog"><b style="width:${pct}%"></b></i>
    <i class="tchap">${esc(s.chap)} · ${tour.i + 1}/${tour.steps.length}
      <b class="tdemo">compte d’essai</b></i>
    <b>${esc(s.title)}</b><p>${esc(s.text)}</p>
    ${s.swipe ? '<i class="tswipe">' + SWIPE + '</i>' : ''}
    <div class="tnav">
      ${s.tap ? `<i class="ttap">${svg(I.pick)}${esc(s.tap)}</i>` : ''}<i></i>
      <button class="tskip" data-tour="skip">Passer</button>
      <button class="tnext" data-tour="next">${last ? 'Terminer' : 'Suivant'}${svg(I.arrow)}</button>
    </div>`;
  if (bub.dataset.k !== String(tour.i)) { bub.dataset.k = String(tour.i); bub.innerHTML = html; }
  /* la bulle se met du côté où il reste de la place */
  const bh = bub.offsetHeight || 190;
  const below = box.y + box.h + 14;
  const above = box.y - bh - 14;
  /* sous la zone si ça tient, sinon au-dessus, sinon collée en bas : une
     carte de révision occupe presque tout l'écran et ne laisse le choix
     qu'entre recouvrir un peu ou sortir de l'écran */
  const top = (!r || box.h === 0) ? Math.round((H - bh) / 2)
    : below + bh < H - 12 ? below
    : above > 12 ? above
    : H - bh - 14;
  bub.style.top = top + 'px';
}

/* ---------- l'aide, chapitre par chapitre ---------- */
function helpSheet(w) {
  w.innerHTML = `<div class="scrim" data-mact="close"></div>
    <div class="menu">
      <div class="mhd">${svg(I.bulb)}<span class="mhx"><b>Aide</b></span></div>
      <button class="mi" data-chap="" style="font-weight:700">${svg(I.play)}Revoir toute la visite
        <span class="tail">${CHAPTERS.reduce((a, c) => a + c.steps.length, 0)} étapes</span></button>
      <div class="msep"></div>
      <div class="mscroll">${CHAPTERS.map(c => `<button class="mi" data-chap="${c.id}">
        ${svg(I[c.icon] || I.bulb)}${esc(c.name)}<span class="tail">${c.steps.length}</span></button>`).join('')}</div>
    </div>`;
  mountMenu(w);
}

/* Premier lancement d'un compte : la visite part toute seule. Elle ne
   coupe jamais un lien de partage ou un raccourci en train de s'ouvrir —
   on est venu pour autre chose, ce serait la pire des interruptions. */
/* La visite guidée apprend à réviser : à retourner une fiche, à la lancer
   à gauche ou à droite, à s'en fabriquer. Un professeur, un référent ou
   l'éditeur ne font rien de tout cela — et elle leur reprenait l'écran
   600 ms après la connexion, en les ramenant sur une bibliothèque vide
   juste après que leur console se soit affichée. Elle ne part donc que
   pour ceux à qui elle s'adresse, et seulement une fois le rôle connu :
   au moment où on l'appelle, on ne le sait pas encore. */
function maybeTour() {
  if (prefs.tuto || tour || location.hash || location.search.includes('go=')) return;
  setTimeout(() => {
    if (tour || prefs.tuto) return;
    if (myRole !== 'eleve') return;
    startTour();
  }, 900);
}

/* ══════════ l'écran d'accueil ══════════
   Une app web n'est vraiment installée que le jour où elle a son icône.
   Avant ça elle n'a ni rappels, ni stockage durable, ni place dans les
   habitudes — et sur iPhone, le geste qui l'installe n'est proposé par
   personne. Ce module s'occupe de ce seul moment, et il compte plus que
   n'importe quelle fonctionnalité de révision : une app pas installée
   n'est pas rouverte.

   Le vrai piège n'est pas iOS. C'est le navigateur intégré d'Instagram,
   de Snapchat, d'un client mail ou d'une appli d'ENT : « Sur l'écran
   d'accueil » n'y figure pas du tout. L'élève cherche, ne trouve pas, et
   abandonne sans savoir pourquoi. C'est le seul cas où l'on parle avant
   d'attendre qu'on nous le demande. */
const INSTKEY = 'folio.install';
const instLoad = () => { try { return JSON.parse(localStorage.getItem(INSTKEY)) || {}; } catch (e) { return {}; } };
const instSave = o => { try { localStorage.setItem(INSTKEY, JSON.stringify(o)); } catch (e) {} };

const UA = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
/* déjà posée sur l'écran d'accueil : plus jamais un mot à ce sujet */
const installed = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches)
  || navigator.standalone === true;
/* iPad récent se présente comme un Mac : le test tactile le rattrape */
const isIOS = () => /iPad|iPhone|iPod/.test(UA)
  || (/Macintosh/.test(UA) && typeof document !== 'undefined' && 'ontouchend' in document);
const isAndroid = () => /Android/.test(UA);
/* Navigateur enfermé dans une autre application. La liste est faite de
   ce qu'on croise réellement dans une classe, pas de l'exhaustivité. */
const inApp = () => /FBAN|FBAV|Instagram|Snapchat|TikTok|Line\/|LinkedInApp|Twitter|Pinterest|GSA\//.test(UA)
  || (isAndroid() && /\bwv\b/.test(UA))
  || (isIOS() && !/Safari/.test(UA) && !/CriOS|FxiOS|EdgiOS/.test(UA));
/* Sur iOS, seul Safari sait ajouter à l'écran d'accueil. Chrome et
   Firefox y sont le même moteur mais sans ce menu. */
const iosOther = () => isIOS() && /CriOS|FxiOS|EdgiOS|OPiOS/.test(UA);

/* L'invite native d'Android n'est donnée qu'une fois, très tôt : on la
   met de côté au lieu de la laisser passer, pour la rejouer au moment
   où elle a du sens pour l'élève. */
let bip = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); bip = e; });
window.addEventListener('appinstalled', () => {
  bip = null;
  instSave({ ...instLoad(), done: 1 });
  closeMenu();
  toast(I.check, 'Folio est sur ton écran d’accueil');
});

function instCtx() {
  if (installed()) return 'done';
  if (inApp()) return 'webview';
  if (iosOther()) return 'iosother';
  if (bip) return 'prompt';
  if (isIOS()) return 'ios';
  if (isAndroid()) return 'android';
  return 'desktop';
}

/* Quand se permettre de demander. Trois règles, et aucune n'est
   négociable : jamais par-dessus autre chose, jamais plus de trois fois,
   jamais deux fois la même semaine. Une invite qu'on subit se referme
   sans être lue, et brûle le geste pour de bon. */
const WEEK = 7 * DAY;
function canAsk() {
  if (installed() || demo || tour) return false;
  if (menu || study || quiz || view.name === 'login') return false;
  const s = instLoad();
  if (s.done) return false;
  if ((s.n || 0) >= 3) return false;
  return !s.at || Date.now() - s.at > WEEK;
}
/* La demande spontanée n'arrive jamais au premier écran : on ne sait pas
   encore ce qu'on installerait. Elle arrive après une séance finie,
   quand l'app vient de servir à quelque chose. */
function maybeAskInstall() {
  if (!canAsk()) return;
  const s = instLoad();
  s.n = (s.n || 0) + 1; s.at = Date.now(); instSave(s);
  setTimeout(() => { if (!menu && !study && !quiz) openMenu('install'); }, 900);
}
/* Ouverture explicite, depuis les Réglages : ni compteur, ni délai —
   c'est demandé, donc c'est montré. */
function openInstall() { openMenu('install'); }

async function copyLink() {
  const url = location.origin + location.pathname;
  try {
    await navigator.clipboard.writeText(url);
    toast(I.check, 'Lien copié');
  } catch (e) {
    toast(I.link, url);
  }
}
async function doPrompt() {
  if (!bip) return;
  const e = bip; bip = null;
  closeMenu();
  try {
    e.prompt();
    const r = await e.userChoice;
    if (r && r.outcome === 'accepted') instSave({ ...instLoad(), done: 1 });
  } catch (x) {}
}

const instep = (n, txt) => `<div class="instep"><i>${n}</i><span>${txt}</span></div>`;
/* Pourquoi on le demande, dit une seule fois et honnêtement : les
   rappels et le hors-ligne complet n'existent qu'une fois installée.
   Une raison vraie convainc mieux qu'une insistance. */
const INSTWHY = 'Une fois posée sur l’écran d’accueil, Folio s’ouvre en un tap, '
  + 'fonctionne entièrement hors ligne et peut te rappeler tes révisions.';

/* Le vrai glyphe de partage d'iOS, dessiné plutôt que décrit : « touche
   le carré avec la flèche » se cherche, l'icône se reconnaît. */
const SVGSHARE = `<svg viewBox="0 0 24 24" class="shg">${I.share}</svg>`;

function installSheet(w) {
  const ctx = instCtx();
  const head = (icon, t, s) => `<div class="mhd">${svg(icon)}<span class="mhx">
    <b>${t}</b><span class="msub">${s}</span></span></div>`;
  let inner = '';

  if (ctx === 'webview') {
    /* Le cas le plus fréquent et le seul vraiment bloquant : on ne
       demande pas d'installer, on explique comment sortir d'ici. */
    inner = head(I.warn, 'Ouvre Folio dans ton navigateur',
        'Tu es dans le navigateur d’une autre application. L’ajout à l’écran d’accueil n’y existe pas.')
      + `<div class="insteps">
          ${instep(1, `Touche le menu ${isIOS() ? '<b>•••</b> en haut à droite' : '<b>⋮</b> en haut à droite'}`)}
          ${instep(2, `Choisis <b>${isIOS() ? 'Ouvrir dans Safari' : 'Ouvrir dans Chrome'}</b>`)}
          ${instep(3, 'Reviens ici : Folio te montrera la suite')}
        </div>
        <button class="mi" data-mact="instcopy" style="justify-content:center;font-weight:700">
          ${svg(I.copy)}Copier le lien</button>`;
  } else if (ctx === 'iosother') {
    inner = head(I.warn, 'Ouvre cette page dans Safari',
        'Sur iPhone et iPad, seul Safari sait ajouter une app à l’écran d’accueil.')
      + `<div class="insteps">
          ${instep(1, 'Copie le lien ci-dessous')}
          ${instep(2, 'Ouvre <b>Safari</b> et colle-le')}
          ${instep(3, 'Folio te montrera la suite')}
        </div>
        <button class="mi" data-mact="instcopy" style="justify-content:center;font-weight:700">
          ${svg(I.copy)}Copier le lien</button>`;
  } else if (ctx === 'prompt') {
    inner = head(I.plus, 'Installer Folio', INSTWHY)
      + `<button class="cta" data-mact="instgo" style="margin:6px 7px 8px;width:calc(100% - 14px)">
          ${svg(I.down)}Installer</button>`;
  } else if (ctx === 'ios') {
    /* Le bouton Partager n'est pas au même endroit selon l'appareil :
       le dire évite la minute passée à chercher en haut sur un iPhone. */
    const where = /iPad/.test(UA) ? 'en haut de l’écran' : 'en bas de l’écran';
    inner = head(I.plus, 'Ajoute Folio à ton écran d’accueil', INSTWHY)
      + `<div class="insteps">
          ${instep(1, `Touche <b class="inshare">${SVGSHARE}</b> Partager, ${where}`)}
          ${instep(2, 'Fais défiler et choisis <b>Sur l’écran d’accueil</b>')}
          ${instep(3, 'Touche <b>Ajouter</b>, puis ouvre Folio par son icône')}
        </div>
        <div class="note">Ferme ensuite cet onglet : c’est par l’icône que Folio gardera tes rappels.</div>`;
  } else if (ctx === 'android') {
    inner = head(I.plus, 'Ajoute Folio à ton écran d’accueil', INSTWHY)
      + `<div class="insteps">
          ${instep(1, 'Touche le menu <b>⋮</b> en haut à droite')}
          ${instep(2, 'Choisis <b>Ajouter à l’écran d’accueil</b>')}
          ${instep(3, 'Confirme, puis ouvre Folio par son icône')}
        </div>`;
  } else {
    inner = head(I.plus, 'Installer Folio', INSTWHY)
      + `<div class="insteps">
          ${instep(1, 'Cherche l’icône d’installation dans la barre d’adresse')}
          ${instep(2, 'Ou, dans le menu du navigateur, <b>Installer Folio</b>')}
        </div>`;
  }

  w.innerHTML = `<div class="scrim" data-mact="close"></div>
    <div class="menu">${inner}
      <div class="msep"></div>
      <button class="mi" data-mact="instlater">${svg(I.x)}Plus tard</button>
    </div>`;
  mountMenu(w);
}

/* ---------- démarrage ---------- */
async function boot() {
  if (!auth) { view = { name: 'login' }; return render(); }
  db = load();
  fsrsMigrate();                         // hors ligne aussi : le moteur a besoin de son état
  if (!consumeHash()) render();          // le cache s'affiche tout de suite
  /* le raccourci attend d'avoir les paquets : « réviser » ne veut rien
     dire tant qu'on ne sait pas ce qui est dû */
  const shortcut = new URLSearchParams(location.search).get('go');
  try {
    if (auth.exp && Date.now() > auth.exp - 60000 && !(await refreshToken())) throw new Error('session');
    await pull();
    setOnline(true);
    if (!(shortcut && consumeGoto())) { render(); accueil(); }
    flush();
    maybeTour();
  } catch (e) {
    if (/JWT|session|401/i.test(String(e.message || e))) { saveAuth(null); view = { name: 'login' }; render(); }
    else setOnline(false);
  }
}
boot();
window.addEventListener('hashchange', consumeHash);
window.addEventListener('online', flush);
document.addEventListener('visibilitychange', () => { if (!document.hidden) flush(); });
/* En développement, pas de service worker : il servirait l'ancien code
   depuis son cache à chaque rechargement. */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!reloaded) { reloaded = true; location.reload(); }
  });
}
