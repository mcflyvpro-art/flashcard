/* Le rapporteur d'erreurs (2026-11-07, M05.T1, M05.T4) : ce qui casse sur
   l'appareil d'un utilisateur arrive dans la base, anonyme (les règles et
   le nettoyage dans src/erreurs.js, la table et ses bornes dans la
   migration erreurs_du_client).

   Premier module importé par app.js, et sans autre dépendance que deux
   modules purs : il est évalué avant tous les autres, donc une exception
   levée pendant le chargement d'un écran le trouve déjà à l'écoute (une
   erreur d'évaluation de module remonte à window comme une autre). Il ne
   passe pas par api() exprès : le rapporteur doit marcher même quand le
   cœur de l'app est cassé, et il n'envoie jamais la session — la base ne
   doit pas pouvoir relier une erreur à un compte. Sa propre petite file
   (20 au plus, dans le stockage de l'appareil) garde ce qui n'a pas pu
   partir, hors ligne compris (règle 5), et part au retour du réseau.

   Ce qu'il écoute : une exception non rattrapée, une promesse rejetée que
   personne n'attend, une violation de la CSP (appliquée depuis le
   2026-11-05 : un script ou une image bloqués se verront). Ce qu'il
   mesure : le temps jusqu'au premier écran utile (le premier contenu posé
   dans #app), et une ouverture bloquée — rien dans #app au bout de 15 s.
   La démo n'envoie rien : elle promet de ne jamais parler à la base. */
import { aIgnorer, MAX_PAR_PAGE, navigateurDe, rapport } from '../erreurs.js';
import { plateforme } from '../plateformes.js';

const URL_SB = import.meta.env.VITE_SUPABASE_URL;
const CLE = import.meta.env.VITE_SUPABASE_ANON_KEY;
const BUILD = import.meta.env.VITE_BUILD || 'dev';   // posé par vite.config.js (define)
const FILE = 'folio.erreurs';
const GARDE = 20;
const BLOQUE_MS = 15000;

const vues = new Set();
let partis = 0;

const enDemo = () => /^\/(essayer|demo)(\/|$)/.test(location.pathname);
const installee = () => {
  try { return !!(/** @type {any} */ (navigator).standalone || matchMedia('(display-mode: standalone)').matches); } catch { return false; }
};
const natif = () => {
  const c = /** @type {any} */ (window).Capacitor;
  return c && c.getPlatform ? c.getPlatform() : null;
};
const contexte = () => ({
  ecran: document.getElementById('app')?.dataset.view || '',
  build: BUILD,
  plateforme: plateforme({ ua: navigator.userAgent, touches: navigator.maxTouchPoints || 0, capacitor: natif() }).os,
  navigateur: navigateurDe(navigator.userAgent),
  installee: installee()
});

function lireFile() {
  try { const l = JSON.parse(localStorage.getItem(FILE) || '[]'); return Array.isArray(l) ? l : []; } catch { return []; }
}
function ecrireFile(l) {
  /* stockage plein ou interdit (navigation privée) : on perd le rapport,
     jamais l'app — rien ici ne doit pouvoir lever à son tour */
  try { if (l.length) localStorage.setItem(FILE, JSON.stringify(l.slice(-GARDE))); else localStorage.removeItem(FILE); } catch { /* voir plus haut */ }
}

function poster(r) {
  return fetch(URL_SB + '/rest/v1/rpc/signaler', {
    method: 'POST', keepalive: true,
    headers: { apikey: CLE, Authorization: 'Bearer ' + CLE, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p: r })
  }).then(res => { if (!res.ok) throw new Error(String(res.status)); });
}

function envoyer(r) {
  if (!URL_SB || !CLE || enDemo()) return;
  poster(r).catch(() => ecrireFile([...lireFile(), r]));   // hors ligne : il repartira
}

/* Ce qui attendait part, au retour du réseau ou à l'ouverture suivante. */
function vider() {
  const l = lireFile();
  if (!l.length || !navigator.onLine || enDemo()) return;
  ecrireFile([]);
  for (const r of l) poster(r).catch(() => ecrireFile([...lireFile(), r]));
}

export function noterErreur(type, message, pile = '', source = '') {
  /* jamais une erreur du rapporteur lui-même : il se tairait plutôt */
  try {
    if (partis >= MAX_PAR_PAGE || aIgnorer(message, source)) return;
    const r = rapport({ type, message, pile, ...contexte() });
    if (vues.has(r.empreinte)) return;
    vues.add(r.empreinte);
    partis++;
    envoyer(r);
  } catch { /* voir plus haut */ }
}

addEventListener('error', e => {
  /* sans capture, seules les erreurs d'exécution arrivent ici (une image
     qui ne charge pas ne remonte pas jusqu'à window) */
  noterErreur('erreur', e.message || String(e.error), e.error?.stack || '', e.filename || '');
});
addEventListener('unhandledrejection', e => {
  const r = e.reason;
  noterErreur('promesse', r?.message || String(r), r?.stack || '', '');
});
addEventListener('securitypolicyviolation', e => {
  noterErreur('csp', `${e.effectiveDirective || e.violatedDirective} ${e.blockedURI || ''}`, '', e.sourceFile || '');
});
addEventListener('online', vider);

/* Le premier écran utile : le premier contenu posé dans #app. Une ouverture
   compte une fois ; rien au bout de 15 s, c'est une ouverture bloquée. */
function surveillerOuverture() {
  const app = document.getElementById('app');
  if (!app || enDemo()) return;
  const fini = ms => {
    obs.disconnect();
    clearTimeout(minuterie);
    envoyer(rapport({ type: 'demarrage', message: '', ms, ...contexte() }));
  };
  const obs = new MutationObserver(() => { if (app.firstChild) fini(performance.now()); });
  const minuterie = setTimeout(() => {
    obs.disconnect();
    if (!app.firstChild) noterErreur('bloque', 'ouverture bloquée : rien dans #app au bout de 15 s');
  }, BLOQUE_MS);
  if (app.firstChild) fini(performance.now()); else obs.observe(app, { childList: true });
}

surveillerOuverture();
setTimeout(vider, 4000);   // pas pendant l'ouverture : elle a mieux à faire du réseau
