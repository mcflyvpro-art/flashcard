import { I, SWIPE, svg } from './icones.js';
import { DAY } from './fsrs.js';
import {
  DECKPAGE, DEFPREFS, asks, auth, bip, board, comp, db, demo, duels, filter, friends,
  groupTab, groups, lib, mates, me, menu, myRole, peek, prefs, quiz, scope, setAccOpen,
  setAccounts, setAddQ, setAdm, setAnimate, setAsgs, setAsks, setBip, setBlocks, setBoard,
  setCardEdit, setClassOf, setClasses, setComp, setConflicts, setDb, setDeckOpen, setDeckQ,
  setDeckShow, setDemo, setDirty, setDuelRun, setDuels, setFilter, setFindQ, setFriends,
  setGone, setGroupOf, setGroupTab, setGroups, setIAmMod, setLeaving, setLib, setLoginMode,
  setMailOpen, setMailbox, setMateOpen, setMateProf, setMates, setMates2, setMe,
  setMemberOpen, setMenu, setMods, setMyRole, setPeek, setPrefs, setPreviewOf, setProf,
  setQuiz, setRef, setReorder, setReportOn, setReportWhy, setRoster, setSchool, setScope,
  setSel, setSendMsg, setSendTo, setShared, setStats, setStudy, setSubjEdit, setTeam,
  setTour, setTourPoll, setTourSave, setTrash, setUndos, setVers, setView, setWorkOpen,
  study, tour, tourPoll, tourSave, view
} from './data/etat.js';
import { go, render } from './bibliotheque.js';
import { dec, fsrsMigrate, mediaCache } from './carte-media.js';
import { accueil } from './classement.js';
import { cacheKey, esc, flush, load, plur, pull, refreshToken, saveAuth, setOnline } from './coeur-sync.js';
import { selOff } from './connexion.js';
import { beep, importPayload, savePrefs, toast } from './import-cartes.js';
import { consumeGoto } from './interactions.js';
import { closeMenu, mountMenu, openMenu } from './menus-a.js';
import { resetComp, startQuiz } from './quiz.js';
import { openShared } from './reglages-corbeille.js';
import { startStudy } from './revision.js';

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
  /* la bibliothèque et ce qui attend d'être envoyé */
  setDb({ subjects: [], decks: [], hist: {} });
  setPrefs({ ...DEFPREFS });
  setDirty({}); setGone([]); setConflicts([]); setUndos([]);
  setTrash({ n: 0, list: null, err: 0 });
  setVers({ list: null, err: 0, of: null });

  /* le cercle : qui l'on est, qui l'on connaît, ce qu'on partage */
  setMe(null); setFriends(null); setMates(null); setAsks(null);
  setGroups(null); setGroupOf(null); setScope(null); setGroupTab('lib');
  setLib({ list: null, err: 0, open: null });
  setDuels({ list: null, scores: null, err: 0, open: null });
  setBoard({ rows: null, err: 0, range: 7 });
  setBlocks(null);
  setMailbox({ n: 0, list: null, err: 0 });
  setMateOpen(null); setMateProf({ id: null, range: 7, row: null, lib: null, load: 0 });
  setSendTo(null); setSendMsg(''); setMailOpen(null); setAddQ('');

  /* le rôle et ce qu'il ouvre */
  setMyRole('eleve'); setIAmMod(false);
  setSchool(null); setTeam(null); setMates2(null);
  setProf({ annee: null, annees: null, classes: null, err: 0,
           open: null, tab: 'eleves', roster: null, devoirs: null, bilan: null,
           tri: 'retard', q: '', eleve: null, fiche: null,
           work: null, cartes: null, comp: null,
           vue: 'liste', mois: null, agenda: null, jour: null });
  setAdm({ orgs: null, etat: null, tab: 'orgs' });
  setRef({ tab: 'etab', board: null, err: 0,
          gens: null, total: 0, page: 0, q: '', role: '', cls: null, cherche: 0,
          classes: null, open: null, team: null,
          who: null, service: null, form: null, trace: null });
  setMods({ list: null, err: 0, seen: 0 });
  setAccounts(null); setAccOpen(null);
  setClasses(null); setClassOf(null); setRoster(null); setAsgs(null);
  setWorkOpen(null); setMemberOpen(null);
  setReportOn(null); setReportWhy('');

  /* les écrans en cours */
  setView({ name: 'login' }); setMenu(null); setStudy(null); setQuiz(null);
  setStats({ rows: null, err: 0, range: 30 });
  setShared(null); setDuelRun(null); setPreviewOf(null); setLeaving(null);
  setFilter(''); setPeek(false); setSel(null); setReorder(false);
  setFindQ(''); setDeckQ(''); setDeckOpen(false); setDeckShow(DECKPAGE);
  setSubjEdit(null); setCardEdit(null); setComp({ subject: '', cards: [], edit: -1, bulk: false, text: '', dups: false });

  /* les images et sons déjà rapatriés : ils appartenaient à l'autre compte,
     et les laisser en mémoire serait garder ouvert ce qu'on vient de fermer */
  for (const u of mediaCache.values()) { try { URL.revokeObjectURL(u); } catch (e) {} }
  mediaCache.clear();
}

export function logout() {
  flush();
  const key = cacheKey();
  saveAuth(null);
  if (key) { try { localStorage.removeItem(key); } catch (e) {} }
  resetSession();
  setLoginMode('in');
  setAnimate(true); render();
}

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

/* ---------- le fil des chapitres ----------
   Chaque étape : où aller (go), quoi montrer (sel), quoi dire, et
   éventuellement le geste qui la fait avancer toute seule (done). */
const nav = (name, id) => () => { closeMenu(); setView({ name, id }); };

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
    { go: () => { resetComp(); comp.bulk = true; setView({ name: 'import' }); setMenu(null); },
      sel: '#tx', title: 'Colle une liste',
      text: 'Une ligne par page : le mot, une tabulation ou un tiret, la réponse. Le découpage se fait tout seul.' },
    { go: () => { resetComp(); comp.bulk = true; setView({ name: 'import' }); setMenu(null); },
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

export function startTour(chapId) {
  if (tour) return;
  const steps = tourSteps(chapId);
  if (!steps.length) return;
  setTourSave({ db, prefs, view, study, quiz, filter, peek, groupTab, scope,
               me, mates, asks, friends, groups, duels, lib, board });
  setDemo(true);
  closeMenu(); selOff();
  setDb(demoDB());
  setPrefs({ ...DEFPREFS, name: 'Léa', goal: 40, sound: true, tuto: 1 });
  setMe({ id: 'demo', handle: 'lea' });
  setMates([{ id: 'f1', handle: 'thibault', name: 'Thibault', status: 'ok', sens: 'envoyee' },
           { id: 'f2', handle: 'ibti', name: 'Ibti', status: 'ok', sens: 'recue' }]);
  setAsks([]); setFriends(mates.slice());
  setGroups([{ id: 'g1', name: 'Prépa D1', code: 'K7PQR', owner: 'demo' }]);
  setDuels({ list: [{ id: 'du1', owner: 'f1', who: 'thibault', name: 'Droit civil',
                     total: 10, cards: [], created_at: new Date(Date.now() - 3600e3).toISOString() }],
            scores: [], err: 0, open: null });
  setLib({ list: [{ deck_id: 'lx', user_id: 'f1', who: 'thibault', name: 'Droit civil — définitions',
                   subject: 'Droit', n: 64, cards: [], updated_at: new Date(Date.now() - 2 * DAY).toISOString() }],
          err: 0, open: null });
  setBoard({ rows: [{ uid: 'f1', who: 'Thibault', handle: 'thibault', n: 185, ok: 127, jours: 5 },
                   { uid: auth.uid, who: 'Léa', handle: 'lea', n: 92, ok: 70, jours: 4 },
                   { uid: 'f2', who: 'Ibti', handle: 'ibti', n: 31, ok: 28, jours: 2 }],
            err: 0, range: 7 });
  setStudy(null); setQuiz(null); setFilter(''); setPeek(false); setDeckQ(''); setReorder(false);
  setTour({ i: 0, steps });
  document.body.classList.add('touring');
  runStep();
}

function runStep() {
  if (!tour) return;
  const s = tour.steps[tour.i];
  if (!s) return endTour(true);
  tour.lock = s.lock || 0;
  try { if (s.go) s.go(); } catch (e) {}
  setAnimate(false); render();
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
  setTourPoll(setInterval(() => {
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
  }, 140));
}

function nextStep() {
  if (!tour) return;
  tour.hold = 0;
  beep(true, true);
  tour.i++;
  runStep();
}

function endTour(done) {
  clearInterval(tourPoll); setTourPoll(0);
  const o = document.getElementById('tour'); if (o) o.remove();
  document.body.classList.remove('touring');
  setTour(null);
  const sv = tourSave; setTourSave(null);
  setDemo(false);
  if (sv) {
    setDb(sv.db); setPrefs(sv.prefs); setView(sv.view); setStudy(sv.study); setQuiz(sv.quiz);
    setFilter(sv.filter); setPeek(sv.peek); setGroupTab(sv.groupTab); setScope(sv.scope);
    setMe(sv.me); setMates(sv.mates); setAsks(sv.asks); setFriends(sv.friends);
    setGroups(sv.groups); setDuels(sv.duels); setLib(sv.lib); setBoard(sv.board);
  }
  closeMenu();
  if (!prefs.tuto) { prefs.tuto = 1; savePrefs(); }
  setAnimate(true); render();
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
export function helpSheet(w) {
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
export function maybeTour() {
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
export const installed = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches)
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

window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); setBip(e); });

window.addEventListener('appinstalled', () => {
  setBip(null);
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
export function maybeAskInstall() {
  if (!canAsk()) return;
  const s = instLoad();
  s.n = (s.n || 0) + 1; s.at = Date.now(); instSave(s);
  setTimeout(() => { if (!menu && !study && !quiz) openMenu('install'); }, 900);
}

/* Ouverture explicite, depuis les Réglages : ni compteur, ni délai —
   c'est demandé, donc c'est montré. */
export function openInstall() { openMenu('install'); }

export async function copyLink() {
  const url = location.origin + location.pathname;
  try {
    await navigator.clipboard.writeText(url);
    toast(I.check, 'Lien copié');
  } catch (e) {
    toast(I.link, url);
  }
}

export async function doPrompt() {
  if (!bip) return;
  const e = bip; setBip(null);
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

export function installSheet(w) {
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
  if (!auth) { setView({ name: 'login' }); return render(); }
  setDb(load());
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
    if (!(shortcut && consumeGoto())) { render(); accueil(); }
    flush();
    maybeTour();
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

document.addEventListener('visibilitychange', () => { if (!document.hidden) flush(); });

/* En développement, pas de service worker : il servirait l'ancien code
   depuis son cache à chaque rechargement. */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js').catch(() => {});
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!reloaded) { reloaded = true; location.reload(); }
  });
}
