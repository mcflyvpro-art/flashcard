// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import {
  adm, auth, cercle, demoEtab, friends, legalTab, loginMode, mods, myRole, prof, ref, setFindQ,
  setLegalBack, setLegalTab, setLoginMode, trash, view
} from '../data/etat.js';
import { ARRIVEE, aRouvrir, chemin, lireChemin } from '../routes.js';
import { deck } from '../core/coeur-sync.js';
import { modPull } from '../core/classement.js';
import { statsPull } from '../core/ecran-groupe.js';
import { eleveClassesPull } from '../core/eleve-classes.js';
import { friendsPull, mailPull, openMail, trashPull } from '../core/reglages-corbeille.js';
import { allerClasses, go } from './bibliotheque.js';
import { commuPull, ouvrirProfil } from './cercle.js';
import { clubPull } from './club.js';
import { resetComp } from './creation.js';
import { ouvrirClasse as ouvrirClasseEleve } from './eleve-classes.js';
import { refAller } from './etablissement.js';
import { admAller } from './classement.js';
import { allerAccueil, allerAgenda, allerClasse } from './prof-porte.js';
import { ouvrirPlus } from './plus-porte.js';

/* ══════════ l'adresse suit l'écran, l'écran suit l'adresse (2026-10-26) ══════════
   src/routes.js traduit un écran en chemin et l'inverse ; ici on s'en sert.

   À chaque rendu (`synchroniser`, appelé par render()), l'adresse prend le
   chemin de l'écran affiché : une nouvelle entrée d'historique quand on
   change d'écran, rien quand on reste sur le même. Le bouton retour du
   navigateur (popstate) rouvre l'écran de l'adresse. Au démarrage, on lit
   l'adresse AVANT tout (`cibleDepart`) ; elle est rouverte une fois le rôle
   connu (`armer`, après accueil()) — l'espace d'un professeur ne se devine
   pas tant que la base n'a pas répondu. Tant que le routeur n'est pas armé,
   il ne touche à rien : la page affichée depuis le cache au démarrage ne
   doit pas réécrire l'adresse qu'on est justement en train de suivre.

   Sans session, une adresse d'espace (/prof/classes/…) attend la connexion
   en sessionStorage : on y arrive une fois connecté, comme sur Pronote. */
const CIBLE = 'folio.cible';
let arme = false, remplacer = false, cible = null;

/* Notre place dans l'historique : `rang` est rangé dans history.state de
   chaque entrée, `pile` garde les chemins de celles qu'on a créées depuis
   l'ouverture. Elle sert au « Retour » de l'app : revenir à l'écran
   d'avant, c'est reculer dans l'historique, pas empiler une copie — sinon
   le bouton retour du navigateur repasserait par chaque écran deux fois. */
let rang = (history.state && history.state.folio) || 0, enRetour = false;
const pile = [];

/* Un écran de passage (la création d'un livre, une révision, un quiz,
   l'accueil d'un compte, une partie) cède sa place à celui qui le suit :
   après « Créer », le retour mène à la bibliothèque, pas au formulaire. */
const PASSAGE = /^(import|study|run|bienvenue|duel|direct|defi|shared)$/;
const dePassage = p => { const e = lireChemin(p || ''); return !!(e && PASSAGE.test(e.name)); };

function lireCibleRangee() {
  try { return JSON.parse(sessionStorage.getItem(CIBLE) || 'null'); }
  catch (e) { return null; }           // stockage refusé (navigation privée) : on arrivera sur l'accueil
}
function rangerCible(c) {
  try { if (c) sessionStorage.setItem(CIBLE, JSON.stringify(c)); else sessionStorage.removeItem(CIBLE); }
  catch (e) { /* stockage refusé : la cible est simplement oubliée */ }
}

/* L'écran affiché, avec ce que son adresse doit dire de plus (le mode du
   formulaire de connexion, l'onglet d'une classe, d'une console). */
function ecranActuel() {
  const v = view;
  if (v.name === 'login') return { name: 'login', id: loginMode };
  if (v.name === 'legal') return { name: 'legal', id: legalTab };
  if (v.name === 'profclasse') return { name: v.name, id: prof.open, sous: prof.tab };
  if (v.name === 'ref') return { name: v.name, sous: ref.tab, id: ['classes', 'licence'].includes(ref.tab) ? ref.open : null };
  if (v.name === 'admin') {
    if (adm.tab === 'entreprise') return { name: v.name, sous: 'entreprise' };
    if (adm.fid) return { name: v.name, sous: 'facture', id: adm.fid };
    const id = adm.tab === 'comptes' ? adm.copen : adm.open !== 'nouveau' ? adm.open : null;
    return { name: v.name, sous: adm.tab, id };
  }
  return { name: v.name, id: v.id };
}

/* Tout compte sans métier d'établissement lit et révise : l'espace élève. */
export const roleAdresse = () => (auth ? (['prof', 'ref', 'admin'].includes(myRole) ? myRole : 'eleve') : null);

export function cheminActuel() {
  return chemin(ecranActuel(), roleAdresse(), !!demoEtab);
}

/* Appelé à la fin de chaque render(). */
export function synchroniser() {
  if (!arme || enRetour) return;
  const p = cheminActuel();
  if (!p || p === location.pathname) { remplacer = false; return; }
  if (remplacer || dePassage(location.pathname)) {
    history.replaceState({ folio: rang }, '', p + (remplacer ? location.search + location.hash : ''));
    pile[rang] = p;
  } else if (rang > 0 && pile[rang - 1] === p) {
    enRetour = true;                   // l'écran d'avant : on recule, popstate confirmera
    history.back();
  } else {
    /* ce qui reste dans l'adresse (?…, #…) a déjà été lu par les liens
       entrants : un nouvel écran repart d'une adresse propre */
    rang += 1; pile.length = rang; pile[rang] = p;
    history.pushState({ folio: rang }, '', p);
  }
  remplacer = false;
}

/* ---------- rouvrir un écran depuis son adresse ---------- */
const OUVRIR = {
  home: () => go('home'),
  deck: id => (deck(id) ? go('deck', id) : go('home')),
  import: id => { resetComp(); go('import', id && deck(id) ? id : null); },
  stats: () => { statsPull(); go('stats'); },
  mail: () => { mailPull(); go('mail'); },
  lettre: id => { go('lettre', id); mailPull().then(() => { if (view.name === 'lettre' && view.id === id) openMail(id); }); },
  find: () => { setFindQ(''); go('find'); },
  settings: () => go('settings'),
  plus: () => ouvrirPlus(),
  trash: () => { trash.list = null; trashPull(); go('trash'); },
  mod: () => { if (!mods.list) modPull(); go('mod'); },
  classes: () => allerClasses(),
  classe: id => { eleveClassesPull(); ouvrirClasseEleve(id); },
  commu: () => { commuPull(); go('commu'); },
  friends: () => { if (!friends) friendsPull(); go('friends'); },
  club: id => { commuPull(); cercle.onglet = 'defis'; clubPull(id); go('club', id); },
  profil: id => ouvrirProfil(id),
  prof: () => allerAccueil(),
  profagenda: () => allerAgenda(),
  profclasse: (id, sous) => allerClasse(id, sous),
  ref: (id, sous) => refAller(sous, id),
  admin: (id, sous) => admAller(sous, id),
  login: id => { setLoginMode(id || 'in'); go('login'); },
  legal: id => { setLegalTab(id); setLegalBack('login'); go('legal'); },
  demande: () => go('demande'),
  decouvrir: () => go('decouvrir')
};

/* Rend la promesse de l'ouverture quand elle attend un morceau chargé à la
   demande (l'espace professeur) : l'adresse attend alors l'écran. */
function ouvrir(e) {
  const r = aRouvrir(e);
  const f = OUVRIR[r.name];
  return f ? f(r.id, r.sous) : go(r.name, r.id);
}

/* Ouvrir, puis seulement armer : tant que l'écran demandé n'est pas là,
   l'écran du moment (l'accueil, affiché depuis le cache) ne doit pas
   prendre l'adresse — elle serait perdue pour le retour du navigateur. */
function ouvrirPuisArmer(e) {
  arme = false;
  const fin = () => { arme = true; remplacer = true; synchroniser(); };
  Promise.resolve(e ? ouvrir(e) : null).then(fin, fin);
}

/* L'écran d'une adresse lue a-t-il sa place pour ce compte ? Un professeur
   qui ouvre /eleve/livres/… (un lien recopié d'ailleurs) retrouve ce livre
   dans son espace ; une adresse d'un autre espace qui ne désigne rien de
   précis (une liste, un accueil — un compte devenu professeur qui
   recharge sa page) mène à son arrivée à lui. */
function pourCeCompte(e) {
  const role = roleAdresse();
  if (!e || e.racine || !e.role || !role) return null;
  if (e.role === role) return e;
  if (!e.id) return null;
  const ici = chemin({ name: e.name, id: e.id, sous: e.sous }, role);
  return ici ? { ...e, role } : null;
}

/* ---------- le démarrage ---------- */
/* Lu tout au début de boot() : ce que demande l'adresse. Une adresse de
   la démo est rendue telle quelle (ui/onboarding.js l'ouvre sans session). */
export function cibleDepart() {
  const e = lireChemin(location.pathname);
  if (e && e.demo) return e;
  if (auth) { cible = (e && e.role ? e : null) || lireCibleRangee(); rangerCible(null); return cible; }
  if (e && e.role) rangerCible(e);    // sans session : attendre la connexion
  return e;
}

/* accueil() demande s'il doit mener à l'écran d'arrivée du rôle : non, si
   l'adresse en désigne un autre (on y ira tout de suite, sans détour). */
export function cibleEnAttente() {
  const c = pourCeCompte(cible || lireCibleRangee());
  if (!c) return false;
  const a = ARRIVEE[c.role];
  return !(a && a.name === c.name && (a.sous || null) === (c.sous || null) && !c.id);
}

/* Le rôle est connu : on rouvre l'écran de l'adresse (s'il y en a un et que
   rien d'autre — un lien de classe, de partie — n'est passé devant), puis
   l'adresse suit l'écran. Sans session : la connexion, à son adresse. */
export function armer(suivreCible = true) {
  const c = pourCeCompte(cible || lireCibleRangee());
  cible = null; rangerCible(null);
  ouvrirPuisArmer(suivreCible && c && !c.racine ? c : null);
}

/* La démo (ui/demo.js) entre directement sur son écran, rôle déjà posé :
   l'écran de l'adresse rechargée, ou rien — celui que la démo vient
   d'ouvrir donne alors son adresse. */
export function armerSur(e) {
  cible = null;
  ouvrirPuisArmer(e);
}

/* Avant une connexion ou un changement de compte : l'adresse se tait le
   temps que le rôle soit connu. */
export function desarmer() { arme = false; }

// la porte d'installation (ui/pwa-porte.js) : tant que rien n'est armé, l'adresse dit encore où l'on va
export const estArme = () => arme;

/* ---------- vers le site ----------
   L'app vit à côté de la page d'accueil du site (index.html, à la racine).
   Quitter la démo, se déconnecter, revenir d'un écran public ouvert depuis
   le site ramènent au site : la connexion, c'est quand on veut se
   connecter (demandé le 2026-10-26). L'app installée (icône d'écran
   d'accueil, Capacitor) n'a pas de site : elle reste sur sa connexion. */
export const installee = () => !!(window.Capacitor || navigator.standalone
  || (window.matchMedia && matchMedia('(display-mode: standalone)').matches));

/* « Retour » d'un écran public (essai, demande de démo, mentions) : l'écran
   d'avant s'il est dans l'app (rang > 0 : une entrée que l'app a posée), le
   site sinon. */
// un écran de l'app derrière soi, dans l'historique (l'écran Mirandola+ s'ouvre de partout)
export const aDerriere = () => rang > 0;

export function retourPublic() {
  if (rang > 0) return history.back();
  if (installee()) return go('login');
  location.assign('/');
}

/* Sans session : l'écran public de l'adresse (connexion, inscription,
   carte, mentions, démo, demande de démo), puis l'adresse suit. */
export function armerSansSession(e) {
  arme = true;
  remplacer = true;
  if (e && !e.role && !e.racine && e.name && !(e.name === 'login' && (e.id || 'in') === loginMode)) ouvrir(e);
  synchroniser();
}

/* Le retour (ou l'avance) du navigateur. */
window.addEventListener('popstate', ev => {
  rang = (ev.state && ev.state.folio) || 0;
  if (enRetour) { enRetour = false; return; }   // le « Retour » de l'app : l'écran est déjà là
  const e = lireChemin(location.pathname);
  if (!!(e && e.demo) !== !!demoEtab) return location.reload();   // entrer dans la démo ou en sortir : tout repart de zéro
  if (!arme) return;
  remplacer = true;
  if (!auth) {
    if (e && !e.role && !e.racine) return ouvrir(e);
    return OUVRIR.login(loginMode);
  }
  const c = pourCeCompte(e);
  if (c) ouvrir(c); else synchroniser();       // une adresse sans objet pour ce compte : on remet la sienne
});
