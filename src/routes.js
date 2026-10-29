/* ══════════ les adresses de l'app (2026-10-26) ══════════
   Jusqu'ici tout vivait à « / » : on changeait d'écran, de compte, de rôle
   sans que l'adresse bouge — rafraîchir ramenait à l'accueil, le bouton
   retour du navigateur sortait de l'app, un lien vers une classe ou un livre
   ne pouvait pas se donner. Chaque écran a maintenant son adresse, rangée
   dans l'espace de son métier, comme le font Pronote ou Quizlet :

     /connexion, /inscription, /essayer, /demande-demo,
     /mentions/<texte>                              avant la connexion
     /eleve/…  /prof/…  /referent/…  /admin/…       un espace par rôle
     /demo/<rôle>/…                                 la démo sans compte

   Ce module ne fait que traduire, dans les deux sens, un écran
   { name, id, sous } en chemin : sans dépendance, pur et testé
   (test/routes.test.js). Qui ouvre quoi, et ce qu'un compte a le droit
   d'ouvrir, c'est ui/routeur.js. */

// le rôle (myRole) → le mot de son espace dans l'adresse
export const ESPACES = { eleve: 'eleve', prof: 'prof', ref: 'referent', admin: 'admin' };
const ROLE_DE = { eleve: 'eleve', prof: 'prof', referent: 'ref', admin: 'admin' };

/* Avant la connexion. `login` porte le mode du formulaire dans son id. */
const MODES = { in: 'connexion', up: 'inscription' };
const PUBLICS = { demande: 'demande-demo', decouvrir: 'essayer' };
export const TEXTES = ['cgu', 'confidentialite', 'mentions'];

/* Dans un espace : l'écran, son motif (`:id` = un identifiant), puis, au
   besoin, le sous-écran qu'il désigne (un onglet), l'écran à rouvrir à sa
   place après un rechargement (une révision en cours ne se reprend pas
   depuis une adresse : on rouvre son livre) et les espaces où il existe. */
/** @typedef {{ name: string, motif: string, sous?: string, repli?: string, espaces?: string[] }} Route */
/** @type {(name: string, motif: string, o?: { sous?: string, repli?: string, espaces?: string[] }) => Route} */
const R = (name, motif, o = {}) => ({ name, motif, ...o });
const PROF = ['prof'], REF = ['ref'], ADMIN = ['admin'];
export const ROUTES = [
  R('home', 'livres'),
  R('import', 'livres/nouveau'),
  R('deck', 'livres/:id'),
  R('study', 'livres/:id/lecture', { repli: 'deck' }),
  R('import', 'livres/:id/ajouter'),
  R('run', 'quiz', { repli: 'home' }),
  R('stats', 'journal'),
  R('mail', 'courrier'),
  R('lettre', 'courrier/:id'),
  R('find', 'recherche'),
  R('settings', 'reglages'),
  R('trash', 'reglages/corbeille'),
  R('mod', 'moderation'),
  R('plus', 'mirandola-plus', { espaces: ['eleve', 'prof'] }),
  R('plus', 'folio-plus', { espaces: ['eleve', 'prof'] }),         // l'adresse d'avant le 2026-10-28 : se lit encore, ne s'écrit plus
  R('shared', 'partage', { repli: 'home' }),
  R('bienvenue', 'bienvenue', { repli: 'home' }),
  R('classes', 'classe', { espaces: ['eleve'] }),
  R('classe', 'classe/:id', { espaces: ['eleve'] }),
  R('commu', 'cercle'),
  R('friends', 'cercle/amis'),
  R('defi', 'cercle/nouveau-defi', { repli: 'commu' }),
  R('direct', 'cercle/direct', { repli: 'commu' }),
  R('duel', 'cercle/a-son-rythme', { repli: 'commu' }),
  R('club', 'cercle/clubs/:id'),
  R('profil', 'lecteurs/:id'),
  R('prof', '', { espaces: PROF }),
  R('profagenda', 'agenda', { espaces: PROF }),
  R('profclasse', 'classes/:id', { sous: 'eleves', espaces: PROF }),
  R('profclasse', 'classes/:id/devoirs', { sous: 'devoirs', espaces: PROF }),
  R('profclasse', 'classes/:id/bilan', { sous: 'bilan', espaces: PROF }),
  R('profclasse', 'classes/:id/reglages', { sous: 'reglages', espaces: PROF }),
  R('profclasse', 'classes/:id/demandes', { sous: 'demandes', espaces: PROF }),
  R('ref', '', { sous: 'accueil', espaces: REF }),
  R('ref', 'classes', { sous: 'classes', espaces: REF }),
  R('ref', 'classes/:id', { sous: 'classes', espaces: REF }),
  R('ref', 'eleves', { sous: 'eleves', espaces: REF }),
  R('ref', 'professeurs', { sous: 'profs', espaces: REF }),
  R('ref', 'licence', { sous: 'licence', espaces: REF }),
  R('ref', 'licence/factures/:id', { sous: 'licence', espaces: REF }),
  R('ref', 'historique', { sous: 'journal', espaces: REF }),
  R('ref', 'eleves/comptes', { sous: 'lot', espaces: REF }),
  R('admin', '', { sous: 'suivi', espaces: ADMIN }),
  R('admin', 'etablissements/:id', { sous: 'suivi', espaces: ADMIN }),
  R('admin', 'comptes', { sous: 'comptes', espaces: ADMIN }),
  R('admin', 'comptes/:id', { sous: 'comptes', espaces: ADMIN }),
  R('admin', 'entreprise', { sous: 'entreprise', espaces: ADMIN }),
  R('admin', 'factures/:id', { sous: 'facture', espaces: ADMIN })
];

/* L'écran d'arrivée d'un espace, quand l'adresse n'en dit pas plus. */
export const ARRIVEE = { eleve: { name: 'home' }, prof: { name: 'prof' }, ref: { name: 'ref', sous: 'accueil' },
  admin: { name: 'admin', sous: 'suivi' } };

const permis = (r, role) => !r.espaces || r.espaces.includes(role);

function trouver(e, role) {
  const avecId = e.id != null && e.id !== '';
  return ROUTES.find(r => r.name === e.name && permis(r, role) && r.motif.includes(':id') === avecId
    && (!r.sous || r.sous === (e.sous || ROUTES.find(x => x.name === e.name && x.sous).sous)));
}

/* Un écran → son chemin. `role` : myRole (eleve, prof, ref, admin) ou rien
   sans session ; `demo` : vrai dans la démo sans compte. Rend null pour un
   écran qui n'a pas d'adresse dans cet espace : l'appelant laisse alors
   l'adresse telle quelle. */
export function chemin(e, role, demo = false) {
  if (!e || !e.name) return null;
  if (!role) {
    if (e.name === 'login') return '/' + (MODES[e.id] || MODES.in);
    if (PUBLICS[e.name]) return '/' + PUBLICS[e.name];
    if (e.name === 'legal') return '/mentions/' + (TEXTES.includes(e.id) ? e.id : TEXTES[0]);
    return null;
  }
  const espace = ESPACES[role];
  if (!espace) return null;
  const r = trouver(e, role);
  if (!r) return null;
  const suite = r.motif.replace(':id', encodeURIComponent(String(e.id)));
  return (demo ? '/demo/' : '/') + espace + (suite ? '/' + suite : '');
}

function lireMotif(motif, parts) {
  const m = motif ? motif.split('/') : [];
  if (m.length !== parts.length) return null;
  let id = null;
  for (let i = 0; i < m.length; i++) {
    if (m[i] === ':id') { id = parts[i]; continue; }
    if (m[i] !== parts[i]) return null;
  }
  return { id };
}

const decoder = s => { try { return decodeURIComponent(s); } catch (e) { return null; } };   // une adresse abîmée : rien

/* Un chemin → l'écran qu'il désigne : { role, demo, name, id, sous, repli }
   (role et demo absents avant la connexion), ou null si le chemin ne veut
   rien dire. « / » rend { racine: true } : l'appelant choisit l'arrivée. */
function lirePublic(parts) {
  const [p0] = parts;
  const mode = Object.keys(MODES).find(k => MODES[k] === p0);
  if (mode && parts.length === 1) return { name: 'login', id: mode };
  const pub = Object.keys(PUBLICS).find(k => PUBLICS[k] === p0);
  if (pub && parts.length === 1) return { name: pub };
  if (p0 === 'mentions' && parts.length <= 2) return { name: 'legal', id: TEXTES.includes(parts[1]) ? parts[1] : TEXTES[0] };
  return null;
}

export function lireChemin(chemin) {
  const parts = String(chemin || '/').split('?')[0].split('/').filter(Boolean).map(decoder);
  if (parts.some(p => p == null)) return null;
  if (!parts.length) return { racine: true };
  const pub = lirePublic(parts);
  if (pub) return pub;
  const [p0] = parts;
  const demo = p0 === 'demo';
  const role = ROLE_DE[demo ? parts[1] : p0];
  if (!role) return null;
  const reste = parts.slice(demo ? 2 : 1);
  if (!reste.length) return { role, demo, ...ARRIVEE[role] };
  for (const r of ROUTES) {
    if (!permis(r, role)) continue;
    const m = lireMotif(r.motif, reste);
    if (!m) continue;
    const e = { role, demo, name: r.name, id: m.id };
    if (r.sous) e.sous = r.sous;
    if (r.repli) e.repli = r.repli;
    return e;
  }
  return null;
}

/* L'écran à rouvrir pour une adresse lue : lui-même, ou son repli (une
   révision → son livre, une partie en direct → le cercle). */
export function aRouvrir(e) {
  if (!e || !e.repli) return e;
  const garde = e.repli === 'deck' ? e.id : null;
  return { role: e.role, demo: e.demo, name: e.repli, id: garde };
}
