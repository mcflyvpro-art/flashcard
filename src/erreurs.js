/* Ce que l'app dit d'une erreur qu'un utilisateur rencontre (2026-11-07,
   M05.T1) — sans dépendance, pur et testé (test/erreurs.test.js).

   Avant, une erreur sur le téléphone d'un élève n'arrivait nulle part :
   personne ne savait qu'elle existait. Désormais elle part, anonyme, dans
   la table erreurs_client (la fonction signaler de la base). Des élèves
   mineurs : rien de ce qui part ne doit pouvoir désigner quelqu'un. Ni
   compte, ni adresse IP (la base ne les lit pas), et le texte de
   l'erreur lui-même passe par `nettoyer` — une adresse, un jeton, un
   identifiant, un nombre long, la requête d'une adresse web y sont
   remplacés avant de partir. La base refait le même nettoyage : un client
   ne se croit jamais sur parole. */

export const TYPES = ['erreur', 'promesse', 'csp', 'bloque', 'demarrage'];
export const MAX_MESSAGE = 300;
export const MAX_PILE = 1500;
/* Par page ouverte : au-delà, une boucle d'erreurs n'apprendrait rien de
   plus et ne ferait que charger le réseau du téléphone. */
export const MAX_PAR_PAGE = 10;

/** @type {Array<[RegExp, string]>} */
const REMPLACEMENTS = [
  [/eyJ[\w-]{6,}\.[\w-]{6,}(\.[\w-]+)?/g, '<jeton>'],                  // un jeton JWT
  [/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '<courriel>'],
  [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '<id>'],
  [/(https?:\/\/[^\s?#'"()]+)[?#][^\s'"()]*/g, '$1'],                    // la requête et le fragment d'une adresse
  [/\b[0-9a-f]{16,}\b/gi, '<hex>'],
  [/\b(sk|pk|rk|whsec|xkeysib)[-_][\w-]{8,}/g, '<cle>'],
  [/\d{6,}/g, '<n>']
];

/* Le texte d'une erreur, sans rien qui désigne quelqu'un, borné. */
export function nettoyer(texte, max = MAX_MESSAGE) {
  let t = String(texte ?? '').replace(/\s+/g, ' ').trim();
  for (const [motif, par] of REMPLACEMENTS) t = t.replace(motif, par);
  return t.length > max ? t.slice(0, max - 1) + '…' : t;
}

/* Une ligne de pile ramenée à « fonction (fichier:ligne:colonne) » : le
   nom du fichier sans son chemin ni son adresse (un morceau du build,
   `app-3f2a.js`, se reconnaît par son nom). */
function ligneDePile(l) {
  const m = l.match(/^\s*(?:at\s+)?(?:(.*?)\s*[@(]\s*)?(?:[a-z-]+:\/\/[^/]*)?([^\s()@]*?)([^/\s()@]+):(\d+):(\d+)\)?\s*$/i);
  if (!m) return null;
  const fn = nettoyer((m[1] || '').replace(/^async\s+/, ''), 80);
  /* le nom du fichier se nettoie (une adresse de page peut finir par un
     identifiant) ; la ligne et la colonne, jamais : dans un fichier
     minifié, la colonne a souvent six chiffres et dit tout */
  return (fn ? fn + ' ' : '') + nettoyer(m[3], 80) + ':' + m[4] + ':' + m[5];
}

/* La pile d'une erreur : douze lignes au plus, celles d'une extension du
   navigateur retirées (rien à corriger chez nous). */
export function pileCourte(pile, max = MAX_PILE) {
  const t = String(pile ?? '').split('\n')
    .filter(l => !/(chrome|moz|safari(-web)?)-extension:\/\//.test(l))
    .map(ligneDePile).filter(Boolean).slice(0, 12).join('\n');
  return t.length > max ? t.slice(0, max - 1) + '…' : t;
}

/* L'empreinte d'une erreur : la même erreur, d'un téléphone à l'autre et
   d'un jour à l'autre, tombe sur la même ligne de la base (on compte, on
   ne recopie pas). Le message sans ses chiffres, et les fichiers et
   fonctions des trois premières lignes de pile sans leurs numéros (qui
   bougent à chaque build). FNV-1a sur 32 bits : il ne s'agit que de
   regrouper. */
export function empreinte(type, message, pile = '') {
  const tete = String(pile).split('\n').slice(0, 3)
    .map(l => l.replace(/:\d+:\d+$/, '').replace(/-[\w]{6,}\.js/, '.js')).join('|');
  const cle = type + '|' + String(message).replace(/\d+/g, '#') + '|' + tete;
  let h = 0x811c9dc5;
  for (let i = 0; i < cle.length; i++) { h ^= cle.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return type.slice(0, 1) + h.toString(16).padStart(8, '0');
}

/* Ce qui n'est pas une erreur de Mirandola : une extension du navigateur,
   le message vide d'un script d'une autre origine, la boucle bénigne de
   ResizeObserver, une requête coupée (hors ligne, l'app le sait et le
   dit déjà ; la file réessaie). Un morceau du build qui ne se charge plus
   après une mise à jour, lui, se garde : c'est un vrai défaut. */
export function aIgnorer(message, source = '') {
  const m = String(message || '');
  if (/(chrome|moz|safari(-web)?)-extension:\/\//.test(source + ' ' + m)) return true;
  if (/^Script error\.?$/i.test(m.trim())) return true;
  if (/ResizeObserver loop/i.test(m)) return true;
  if (/^(TypeError: )?(Failed to fetch|Load failed|NetworkError when attempting to fetch resource\.?|The network connection was lost\.?)$/i.test(m.trim())) return true;
  if (/^(AbortError|The operation was aborted|The user aborted a request|Share canceled)/i.test(m.trim())) return true;
  return false;
}

/* Le navigateur en deux mots et une version majeure : de quoi savoir
   qu'un défaut ne touche que Safari 18, rien de plus fin (la signature
   complète du navigateur ne part jamais). */
export function navigateurDe(ua = '') {
  const s = String(ua);
  const v = re => { const m = s.match(re); return m ? ' ' + m[1] : ''; };
  if (/SamsungBrowser/.test(s)) return 'samsung' + v(/SamsungBrowser\/(\d+)/);
  if (/Edg(A|iOS)?\//.test(s)) return 'edge' + v(/Edg(?:A|iOS)?\/(\d+)/);
  if (/Firefox|FxiOS/.test(s)) return 'firefox' + v(/(?:Firefox|FxiOS)\/(\d+)/);
  if (/CriOS/.test(s)) return 'chrome-ios' + v(/CriOS\/(\d+)/);
  if (/Chrome\//.test(s)) return 'chrome' + v(/Chrome\/(\d+)/);
  if (/Safari\//.test(s) || /iPhone|iPad|Macintosh/.test(s)) return 'safari' + v(/Version\/(\d+)/);
  return 'autre';
}

/* L'écran où l'on était : le nom de la vue, jamais l'adresse (elle porte
   des identifiants de livre, de classe, de facture). */
export const ecranDe = vue => String(vue || '').replace(/[^a-z0-9-]/gi, '').slice(0, 40) || 'inconnu';

/* Une erreur prête à partir : tout ce qui part est ici. */
export function rapport({ type, message, pile = '', ecran = '', build = '', plateforme = '', navigateur = '', installee = false, ms = null }) {
  const msg = nettoyer(message);
  const p = pileCourte(pile);
  /* le type rangé est aussi celui de l'empreinte : un type inconnu devenu
     « erreur » gardait sinon son empreinte à lui, et la même erreur tombait
     dans deux lignes (trouvé par test/proprietes.test.js) */
  const t = TYPES.includes(type) ? type : 'erreur';
  return {
    type: t,
    empreinte: empreinte(t, msg, p),
    message: msg,
    pile: p,
    ecran: ecranDe(ecran),
    build: String(build).slice(0, 40),
    plateforme: String(plateforme).slice(0, 20),
    navigateur: String(navigateur).slice(0, 30),
    installee: !!installee,
    ms: Number.isFinite(ms) ? Math.max(0, Math.round(ms)) : null
  };
}

/* Le temps de démarrage d'une ouverture rangé dans l'une des six cases
   que la base additionne par heure (le p75 se lit sur leurs totaux). */
export const CASES_MS = [1000, 2000, 3000, 5000, 10000];
export const caseMs = ms => { const i = CASES_MS.findIndex(b => ms < b); return i < 0 ? CASES_MS.length : i; };

/* Le p75 lu sur les six cases : la borne haute de la case où tombe le
   75e centile (une estimation par excès, c'est voulu). */
export function p75(cases) {
  const tot = cases.reduce((a, b) => a + b, 0);
  if (!tot) return null;
  let cumul = 0;
  for (let i = 0; i < cases.length; i++) {
    cumul += cases[i];
    if (cumul >= tot * 0.75) return i < CASES_MS.length ? CASES_MS[i] : Infinity;
  }
  return Infinity;
}

/* Le taux d'erreur d'une période : des erreurs par ouverture, en pour cent
   arrondi au dixième ; rien à dire sans ouverture. */
export const tauxErreur = (erreurs, ouvertures) => (ouvertures > 0 ? Math.round(1000 * erreurs / ouvertures) / 10 : null);
