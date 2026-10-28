// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { I, svg } from '../icones.js';
import { DAY } from '../fsrs.js';
import {
  DECKPAGE, DEFPREFS, auth, bip, cercleNeuf, defiNeuf, demoEtab, directNeuf,
  mediaCache, menu, quiz,
  setAccounts, setAddQ, setAdm, setAnimate, setAsks, setBip, setBlocks, setBoard,
  setCardEdit, setCercle, setComp, setCompte, setConflicts, setDb, setDeckOpen, setDeckQ, setDefi, setDirect,
  setDeckShow, setDirty, setDuelRun, setDuels, setEleve, setFilter, setFindQ, setFriends,
  setGone, setIAmMod, setLeaving, setLoginMode,
  setMailOpen, setMailbox, setMateOpen, setMateProf, setMates, setMates2, setMe,
  setMenu, setMods, setMyRole, setOffre, setPeek, setPlus, setPrefs, setPreviewOf, setProf,
  setQuiz, setRef, setReorder, setReportOn, setReportWhy, setSchool,
  setSel, setSendMsg, setSendTo, setShared, setStats, setStudy, setSubjEdit,
  setTrash, setUndos, setVers, setView,
  admNeuf, eleveNeuf, plusNeuf, profNeuf, refNeuf, study, tuto, view
} from '../data/etat.js';
import { go, render } from './bibliotheque.js';
import { dec, fsrsMigrate } from './carte-media.js';
import { accueil } from '../core/classement.js';
import { cacheKey, flush, load, plur, pull, refreshToken, save, saveAuth, setOnline } from '../core/coeur-sync.js';
import { lienAvantSession } from './liens-entrants.js';
import { armer, armerSansSession, cibleDepart, desarmer, installee } from './routeur.js';
import { effacerDemo, ouvrirDemo } from './demo-porte.js';
import { importPayload, toast } from './import-cartes.js';
import { consumeGoto } from './raccourcis.js';
import { closeMenu, mountMenu, openMenu } from './menus-a.js';
import { openShared } from '../core/reglages-corbeille.js';
import { oublierVisuels } from '../core/visuels.js';
import { offreLocale } from '../core/abonnement.js';
import { arreterTuto, maybeTuto } from './tuto-porte.js';

/* ---------- lien d'injection ---------- */
export function consumeHash() {
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
export function resetSession() {
  arreterTuto();                         // un tuto commencé appartenait au compte d'avant

  /* la bibliothèque et ce qui attend d'être envoyé */
  setDb({ subjects: [], decks: [], hist: {} });
  setPrefs({ ...DEFPREFS });
  setDirty({}); setGone([]); setConflicts([]); setUndos([]);
  setTrash({ n: 0, list: null, err: 0 });
  setVers({ list: null, err: 0, of: null });

  /* le cercle : qui l'on est, qui l'on connaît, ce qu'on partage */
  setMe(null); setFriends(null); setMates(null); setAsks(null);
  setCercle(cercleNeuf()); setDefi(defiNeuf()); setDirect(directNeuf());
  oublierVisuels();
  setDuels({ list: null, scores: null, err: 0, open: null });
  setBoard({ rows: null, err: 0, range: 7 });
  setBlocks(null);
  setMailbox({ n: 0, list: null, err: 0 });
  setMateOpen(null); setMateProf({ id: null, range: 7, row: null, load: 0 });
  setSendTo(null); setSendMsg(''); setMailOpen(null); setAddQ('');

  /* le rôle et ce qu'il ouvre */
  setMyRole('eleve'); setIAmMod(false);
  setSchool(null); setCompte(null); setMates2(null);
  setOffre(null); setPlus(plusNeuf());
  setProf(profNeuf()); setEleve(eleveNeuf());
  setAdm(admNeuf());
  setRef(refNeuf());
  setMods({ list: null, err: 0, seen: 0 });
  setAccounts(null);
  setReportOn(null); setReportWhy('');

  /* les écrans en cours */
  setView({ name: 'login' }); setMenu(null); setStudy(null); setQuiz(null);
  setStats({ rep: null, locaux: [], uid: null, err: 0, range: 30, sig: '' });
  setShared(null); setDuelRun(null); setPreviewOf(null); setLeaving(null);
  setFilter(''); setPeek(false); setSel(null); setReorder(false);
  setFindQ(''); setDeckQ(''); setDeckOpen(false); setDeckShow(DECKPAGE);
  setSubjEdit(null); setCardEdit(null); setComp({ subject: '', cards: [], edit: -1, mode: 'ecrire', text: '', dups: false });

  /* les images et sons déjà rapatriés : ils appartenaient à l'autre compte,
     et les laisser en mémoire serait garder ouvert ce qu'on vient de fermer */
  for (const u of mediaCache.values()) { try { URL.revokeObjectURL(u); } catch (e) { /* déjà révoquée : sans conséquence */ } }
  mediaCache.clear();
}

export function logout() {
  // dans la démo sans compte, se déconnecter c'est la quitter (ui/demo.js) : rien ne doit rester branché
  if (demoEtab) { try { sessionStorage.removeItem('folio.demo'); } catch (e) { /* rien à effacer */ } return location.replace('/'); }
  const envoi = flush();
  const key = cacheKey();
  saveAuth(null);
  if (key) { try { localStorage.removeItem(key); } catch (e) { /* stockage indisponible : la déconnexion continue sans ce nettoyage */ } }
  resetSession();
  setLoginMode('in');
  setAnimate(true); render();
  /* puis le site (routeur.js, installee) ; ce qui partait encore finit
     d'abord : une requête coupée en vol par le changement de page serait
     perdue, et on n'attend jamais plus de deux secondes et demie */
  if (installee()) return;
  const partir = () => location.replace('/');
  Promise.race([envoi, new Promise(r => setTimeout(r, 2500))]).then(partir, partir);
}

/* ══════════ installer Folio sur l'ordinateur ══════════
   Une app web n'est vraiment installée que le jour où elle a son icône :
   avant, ni stockage durable, ni rappels, ni place dans les habitudes.
   Sur un téléphone, c'est la porte d'installation qui s'en charge — l'app
   ne s'y ouvre pas autrement (ui/pwa-porte.js, 2026-10-28). Ce module ne
   s'occupe plus que de l'ordinateur : l'invite du navigateur (Chrome,
   Edge), ou le chemin de son menu. */
const INSTKEY = 'folio.install';

export const instLoad = () => { try { return JSON.parse(localStorage.getItem(INSTKEY)) || {}; } catch (e) { return {}; } };

const instSave = o => { try { localStorage.setItem(INSTKEY, JSON.stringify(o)); } catch (e) { /* stockage indisponible : la prochaine relance proposera l'install à nouveau, sans gravité */ } };

/* déjà posée sur l'écran d'accueil ou dans le Dock : plus jamais un mot à ce sujet */
export const installed = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches)
  || navigator.standalone === true;

window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); setBip(e); });

window.addEventListener('appinstalled', () => {
  setBip(null);
  instSave({ ...instLoad(), done: 1 });
  closeMenu();
  toast(I.check, 'Folio est installé');
});

/* Quand se permettre de demander. Trois règles, et aucune n'est
   négociable : jamais par-dessus autre chose, jamais plus de trois fois,
   jamais deux fois la même semaine. Une invite qu'on subit se referme
   sans être lue, et brûle le geste pour de bon. */
const WEEK = 7 * DAY;

function canAsk() {
  if (installed() || demoEtab || tuto) return false;
  if (menu || study || quiz || view.name === 'login') return false;
  const s = instLoad();
  if (s.done) return false;
  if ((s.n || 0) >= 3) return false;
  return !s.at || Date.now() - s.at > WEEK;
}

/* La demande spontanée n'arrive jamais au premier écran : on ne sait pas
   encore ce qu'on installerait. Elle arrive après une séance finie,
   quand l'app vient de servir à quelque chose. */
export function maybeAskInstall() {
  if (!canAsk()) return;
  const s = instLoad();
  s.n = (s.n || 0) + 1; s.at = Date.now(); instSave(s);
  setTimeout(() => { if (!menu && !study && !quiz) openMenu('install'); }, 900);
}

/* Ouverture explicite, depuis les Réglages ou l'écran Folio+ : ni
   compteur, ni délai — c'est demandé, donc c'est montré. */
export function openInstall() { openMenu('install'); }

export async function doPrompt() {
  if (!bip) return;
  const e = bip; setBip(null);
  closeMenu();
  try {
    e.prompt();
    const r = await e.userChoice;
    if (r && r.outcome === 'accepted') instSave({ ...instLoad(), done: 1 });
  } catch (x) { /* invite refusée ou déjà consommée par le navigateur : rien à faire de plus */ }
}

/* L'app installée, ouverte sans session pour la première fois : l'écran de
   connexion le dit (ui/connexion.js), jusqu'à la première connexion. */
export const premiereOuverture = () => !auth && installee() && !instLoad().connecte;
export const noterConnexion = () => { if (installee() && !instLoad().connecte) instSave({ ...instLoad(), connecte: 1 }); };

const instep = (n, txt) => `<div class="instep"><i>${n}</i><span>${txt}</span></div>`;

/* Pourquoi on le demande, dit une seule fois et honnêtement : les
   rappels et le hors-ligne complet n'existent qu'une fois installée.
   Une raison vraie convainc mieux qu'une insistance. */
const INSTWHY = 'Installée, Folio s’ouvre en un clic, dans sa fenêtre, '
  + 'et fonctionne entièrement hors ligne.';

/* Safari sur Mac n'a pas d'invite : « Ajouter au Dock », dans le menu Fichier. */
const SAFARI_MAC = /Macintosh/.test(navigator.userAgent || '') && !/Chrome|Edg\//.test(navigator.userAgent || '');

export function installSheet(w) {
  const head = (icon, t, s) => `<div class="mhd">${svg(icon)}<span class="mhx">
    <b>${t}</b><span class="msub">${s}</span></span></div>`;
  const inner = installed() ? head(I.check, 'Folio est installé', 'Ouvre-le depuis ton Dock, ta barre des tâches ou tes applications.')
    : bip ? head(I.plus, 'Installer Folio', INSTWHY)
      + `<button class="cta" data-mact="instgo" style="margin:6px 7px 8px;width:calc(100% - 14px)">
          ${svg(I.down)}Installer</button>`
      : head(I.plus, 'Installer Folio', INSTWHY) + `<div class="insteps">${SAFARI_MAC
        ? instep(1, 'Dans le menu <b>Fichier</b>, choisis <b>Ajouter au Dock</b>')
        : instep(1, 'Clique sur l’icône d’installation, à droite de la barre d’adresse')
          + instep(2, 'Ou, dans le menu du navigateur, <b>Installer Folio</b>')}</div>`;
  w.innerHTML = `<div class="scrim" data-mact="close"></div>
    <div class="menu">${inner}
      <div class="msep"></div>
      <button class="mi" data-mact="instlater">${svg(I.x)}Plus tard</button>
    </div>`;
  mountMenu(w);
}

/* ---------- démarrage ---------- */
export async function boot() {
  /* Le QR d'une carte élève ouvre la session avant tout le reste ; un code
     de classe, de partie ou de club arrivé sans session attend la
     connexion (liens-entrants.js, la porte de tout lien entrant). */
  const adresse = cibleDepart();          // l'écran que demande l'adresse (ui/routeur.js)
  if (adresse && adresse.demo) return ouvrirDemo(adresse);
  effacerDemo();
  if (!(await lienAvantSession())) { setView({ name: 'login' }); render(); return armerSansSession(cibleDepart()); }
  desarmer();
  noterConnexion();
  setDb(load());
  offreLocale();                         // Folio gratuit ou Folio+ dès le premier écran, hors ligne aussi
  fsrsMigrate();                         // hors ligne aussi : le moteur a besoin de son état
  if (!consumeHash()) render();          // le cache s'affiche tout de suite
  /* le raccourci attend d'avoir les paquets : « réviser » ne veut rien
     dire tant qu'on ne sait pas ce qui est dû */
  const shortcut = new URLSearchParams(location.search).get('go');
  /* Le jeton d'accès expire au bout d'une heure (réglage Supabase par
     défaut) : rouvrir l'app après une coupure plus longue que ça passe
     forcément par ici. `refreshToken()` sait déjà distinguer un vrai refus
     du serveur (jeton révoqué : elle efface la session elle-même, via
     `sessionLost`) d'une panne réseau au réveil du téléphone (fréquente :
     le JS démarre avant que le wifi ne soit reconnecté) — dans ce
     deuxième cas elle renvoie `false` sans rien effacer. Avant, tout
     `false` ici valait déconnexion, quelle qu'en soit la cause : c'est ce
     qui faisait sortir l'utilisateur à chaque réouverture de l'app malgré
     un jeton de renouvellement encore valide. On se fie donc à l'état de
     `auth` après coup plutôt qu'à un message d'erreur générique. */
  if (auth.exp && Date.now() > auth.exp - 60000) {
    const ok = await refreshToken();
    if (!ok) {
      if (!auth) return;             // sessionLost() a déjà tout géré : vue de connexion, message
      setOnline(false);              // jeton pas renouvelé faute de réseau ; la session reste en place
      return;
    }
  }
  try {
    await pull();
    setOnline(true);
    let pret = null;
    if (!(shortcut && consumeGoto())) { render(); pret = accueil(); }
    Promise.resolve(pret).then(r => armer(!!pret && r !== 'lien'), () => armer(false));
    flush();
    maybeTuto(pret);
  } catch (e) {
    if (/JWT|401/i.test(String(e.message || e))) { saveAuth(null); setView({ name: 'login' }); render(); }
    else setOnline(false);
  }
}

/* Différé d'un micro-tick : depuis la découpe en modules (M06.T3), le
   graphe d'imports a des cycles (deux écrans qui s'appellent l'un
   l'autre importent l'un de l'autre) — inévitable vu combien de choses
   se répondent dans cette app. Un cycle laisse certains modules pas
   encore tout à fait prêts tant que le graphe entier n'a pas fini de se
   lier ; appeler boot() en même temps que ce fichier s'évalue pouvait
   tomber en plein dedans (« Cannot access… before initialization » sur
   une constante d'un autre module). Après un micro-tick, le graphe est
   entièrement lié, quel que soit l'ordre dans lequel les imports l'ont
   parcouru. */
queueMicrotask(boot);

window.addEventListener('hashchange', consumeHash);

window.addEventListener('online', flush);

/* En arrière-plan, un téléphone peut tuer l'app sans prévenir : ce qui
   n'était qu'en mémoire (une page en cours de frappe, M07.T4) est écrit
   tout de suite, avec sa place dans la file. */
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); else flush(); });

/* En développement, pas de service worker : il servirait l'ancien code
   depuis son cache à chaque rechargement. Sous Capacitor non plus : l'app
   est embarquée dans le binaire, un cache par-dessus servirait une version
   périmée après une mise à jour du magasin (docs/CAPACITOR.md). */
if (import.meta.env.PROD && 'serviceWorker' in navigator && !window.Capacitor) {
  navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js')
    .catch(e => console.warn('Folio : service worker non enregistré, pas de hors-ligne', e && e.message));
  /* Recharger seulement si un service worker tenait déjà la page : c'est
     alors une mise à jour. À la toute première visite il n'y en a aucun,
     le nouveau prend la main (clients.claim) et `controllerchange` part
     aussi — recharger là effaçait ce qu'on tapait dans le formulaire de
     connexion et faisait charger l'app deux fois (vu le 2026-10-16). */
  let reloaded = !navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!reloaded) { reloaded = true; location.reload(); }
  });
}
