// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { $ } from '../racine.js';
import { I } from '../icones.js';
import { shuffle } from '../file.js';
import {
  board, cercle, comp, deckOpen, duels, friends, leaving,
  mailbox, mods, online, peek, prefs, quiz,
  reorder, sel, setAnimate, setCardEdit,
  setDeckOpen, setDeckQ, setDuelRun, setFilter, setFindQ,
  setHelpKey, setLeaving, setLegalBack, setLegalTab, setMates2,
  setPeek, setPendingGrade, setQuiz, setReorder, setSel, setShared,
  setStudy, shared, study, trash, view
} from '../data/etat.js';
import { retourPublic } from './routeur.js';
import { allerClasses, gestion, go, render, retourLivre } from './bibliotheque.js';
import { commuPull, doAdd, ouvrirProfil } from './cercle.js';
import { plain, play, say } from './carte-media.js';
import { isPupil } from './classement.js';
import {
  admPull, blocksPull, boardPull, matesPull, modAct,
  modPull, refPull
} from '../core/classement.js';
import { deck, doUndo, flush, pending, plur, pushUndo, saveDeck, sty, subj, uid } from '../core/coeur-sync.js';
import { selBar } from './connexion.js';
import { duelPick } from './defis.js';
import { exportStats, lostOnLeave } from './ecran-groupe.js';
import { statsPull } from '../core/ecran-groupe.js';
import {
  beep, dueCount, importPayload, savePrefs, toast
} from './import-cartes.js';
import { closeMenu, openMenu, paintMenu } from './menus-a.js';
import { logout, openInstall } from './onboarding.js';
import { allerAccueil, donnerLivre } from './prof-porte.js';
import {
  dictate, fail, nextQ, norm, pickQuiz, startQuiz, submit
} from './quiz.js';
import { resetComp } from './creation.js';
import { cb, cf, openSubject } from './reglages-corbeille.js';
import {
  answerFriend, askFriend, friendsPull, mailPull, openMail,
  trashPull, trashPurge, trashRestore
} from '../core/reglages-corbeille.js';
import {
  answerTF, cardOf, cardOrigin, commit, fling, isTF, loadResume, paintQ, pickMCQ, pickMatch,
  saveResume, startStudy
} from './revision.js';



/* Une révision simple se reprend là où elle s'est arrêtée : la quitter
   ne coûte rien. Un quiz, un QCM ou une association, non — vingt
   minutes disparaissent pour de bon. Ce sont les seules qu'on protège,
   sinon la question deviendrait un réflexe qu'on clique sans lire. */
function tapLeavingGuard(a) { setLeaving(a); return openMenu('leave'); }

function tapHelp(a, ds) { setHelpKey(ds.help); return openMenu('help'); }
const tapModact = (a, ds) => modAct(+ds.rid, ds.modact);


/* On doit pouvoir lire ces textes sans compte : le retour ramène donc
   là d'où l'on venait, y compris l'écran de connexion. */
function tapLegal(a, ds) {
  setLegalTab(ds.legal);
  if (view.name !== 'legal') setLegalBack(view.name === 'login' ? 'login' : 'settings');
  return go('legal');
}

const tapYes = (a, ds) => answerFriend(ds.yes, true);
const tapNo = (a, ds) => answerFriend(ds.no, false);
/* toucher un ami ouvre son profil (ses gestes d'ami y sont, en bas) */
const tapMate = (a, ds) => ouvrirProfil(ds.mate);
/* l'identifiant d'une lettre est un nombre dans la base (bigint), une
   chaîne dans la base locale de la démo : `+id` donnait NaN, et la lettre
   ne s'ouvrait pas (2026-10-26) */
const tapMail = (a, ds) => openMail(/^\d+$/.test(ds.mail) ? +ds.mail : ds.mail);
const tapDpick = (a, ds) => duelPick(+ds.dpick);
function tapDuel(a, ds) { duels.open = ds.duel; return openMenu('duelitem'); }

function tapBrange(a, ds) { board.range = +ds.brange; board.rows = null; setAnimate(false); render(); return boardPull(); }

/* on ne repeint que la ligne touchée et le décompte : reconstruire la
   liste entière ferait sauter le défilement à chaque coche */
function tapPkc(a, ds, b) {
  sel.has(ds.pkc) ? sel.delete(ds.pkc) : sel.add(ds.pkc);
  b.closest('.row').classList.toggle('pk', sel.has(ds.pkc));
  const d = deck(view.id), bar = $.querySelector('.selb');
  if (d && bar) bar.outerHTML = selBar(d);
}

const tapTrr = (a, ds) => trashRestore(ds.trr);

/* deux temps : la corbeille est le dernier filet, on ne le troue pas
   sur un doigt qui glisse */
function tapTrd(a, ds, b) {
  if (b.dataset.arm) return trashPurge(ds.trd);
  b.dataset.arm = 1; b.classList.add('on'); b.lastChild.textContent = 'Confirmer';
  setTimeout(() => { if (b.isConnected) { delete b.dataset.arm; b.classList.remove('on'); b.lastChild.textContent = 'Supprimer'; } }, 3000);
}

function tapDl(a, ds) {
  const i = +ds.dl;
  comp.cards.splice(i, 1);
  if (comp.edit === i) comp.edit = -1; else if (comp.edit > i) comp.edit--;
  return render();
}

function tapEd(a, ds) { comp.edit = +ds.ed; return render(); }
function tapFilt(a, ds) { setFilter(ds.filt); render(); }

function tapNsubj(a, ds) {
  comp.subject = ds.nsubj;
  $.querySelectorAll('[data-nsubj]').forEach(x => x.classList.toggle('on', x.dataset.nsubj === comp.subject));
  const c = document.getElementById('comp');
  if (c) c.setAttribute('style', sty(subj(comp.subject)));
}

const tapSub = (a, ds) => openSubject(ds.sub || null);

/* pendant le rangement, un livre se prend et se pose : il ne s'ouvre pas */
function tapGo(a, ds) { if (reorder) return; return go('deck', ds.go); }

const tapDsA = (a, ds) => fling(ds.a === 'yes' ? 1 : -1);
function tapDsG(a, ds) { setPendingGrade(+ds.g); return fling(+ds.g > 0 ? 1 : -1); }
function tapRm(a, ds) { const d = deck(view.id); d.cards = d.cards.filter(c => c.id !== ds.rm); saveDeck(d); return render(); }

function tapSus(a, ds) {
  const d = deck(view.id), c = d.cards.find(x => x.id === ds.sus);
  c.x = !c.x; saveDeck(d); return render();
}

function tapCard(a, ds) { setCardEdit(ds.card); return openMenu('card'); }

/* ---- la console du référent ---- */

function tapCamadd(a, ds) {
  const n = ds.camn;
  askFriend(n).then(ok => { if (ok) { setMates2(null); matesPull(); } })
    .catch(() => toast(I.x, 'Impossible pour l’instant'));
}

const tapTf = (a, ds, b) => answerTF(b.dataset.tf === '1');
const tapPick = (a, ds, b) => pickMCQ(+b.dataset.pick);
function tapMt(a, ds, b) { const [sd, mid] = b.dataset.mt.split(':'); return pickMatch(sd, mid); }

/* Deux boutons distincts, donc deux chemins : l'un joue ce qui a été
   enregistré, l'autre fait lire le texte. Chacun sait ce qu'il déclenche
   au lieu de dépendre de ce que la carte contient. */
function tapSndSay(a, ds, b) {
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
}

// un compte de gestion n'a pas de bibliothèque : son « accueil », c'est sa console
const tapHome = () => (gestion() ? allerClasses() : go('home'));
// le « Retour » d'un livre : là d'où on l'a ouvert (« Ma classe » pour un devoir)
const tapDeckback = () => { const o = retourLivre(); return o.name === 'classes' ? allerClasses() : go(o.name, o.id); };
const tapCommu = () => { commuPull(); return go('commu'); };
const tapFriends = () => { if (!friends) friendsPull(); return go('friends'); };
const tapFriendsBoard = () => { if (!board.rows) boardPull(); return tapFriends(); };
const tapDoadd = () => doAdd();

/* Le pseudo scolaire vient de l'établissement : la base renverse déjà
   toute tentative de le changer, l'écran n'ouvre donc pas le formulaire. */
const tapHandle = () => isPupil() ? toast(I.lock, 'Ton pseudo est celui de ton établissement')
                                   : openMenu('handle');


/* un quiz se lance depuis un paquet : en sortir, c'est y revenir */
function tapQuitquiz() {
  const id = quiz && quiz.id; setQuiz(null);
  return deck(id) ? go('deck', id) : go('home');
}

const tapPeek = () => { setPeek(!peek); render(); };
const tapMarathon = () => startStudy('all', false, null, { only: 'due', both: prefs.both });

function tapRetry() {
  if (!pending()) return toast(I.check, 'Tout est enregistré');
  toast(I.cloud, 'Envoi…');
  flush().then(() => { setAnimate(false); render(); if (online && !pending()) toast(I.check, 'À jour'); });
}

const tapMcqMatch = a => startStudy(view.id, false, null, { mode: a });

/* Partager est posé sur l'écran du livre : sans cette ligne, seul le
   menu « … » le connaissait et le bouton ne faisait rien. */
const tapSharepick = () => { if (!friends) friendsPull(); return openMenu('sharepick'); };
const tapStats = () => { statsPull(); return go('stats'); };
const tapHelpTuto = () => openMenu('tuto');
const tapInstall = () => openInstall();
/* quitter un défi à son rythme : revenir d'où on l'avait ouvert */
const tapDuelquit = () => { setDuelRun(null); const r = cercle.retour || { name: 'commu' }; return go(r.name, r.id); };

function tapAddshared() {
  const sd = shared && shared.d; if (!sd) return;
  const cards = (sd.cards || []).map(c => [cf(c), cb(c)]);
  const nd = importPayload({ name: sd.name, subjectName: sd.subject_name, cards }, true);
  setShared(null);
  if (nd) go('deck', nd.id); else go('home');
  return toast(I.check, plur(cards.length, 'page') + ' ajoutée' + (cards.length > 1 ? 's' : ''));
}

const tapExpstats = () => exportStats();

const tapFind = () => { setFindQ(''); return go('find'); };

function tapDeckfind() {
  setDeckOpen(!deckOpen);
  if (!deckOpen) setDeckQ('');
  setAnimate(false); return render();
}

const tapSortpick = () => openMenu('sortpick');
const tapListview = () => { prefs.list = !prefs.list; savePrefs(); setAnimate(false); return render(); };

function tapReorder() {
  setReorder(!reorder);
  if (reorder && prefs.sort !== 'manual') { prefs.sort = 'manual'; savePrefs(); }
  setAnimate(false); return render();
}

function tapResume() {
  const r = loadResume(); if (!r) return render();
  setStudy(r); return go('study', r.id);
}

const tapSettings = () => go('settings');
const tapTolog = () => retourPublic();          // l'écran d'avant, ou le site (routeur.js)
const tapDemande = () => go('demande');
const tapDecouvrir = () => go('decouvrir');
const tapMod = () => { if (!mods.list) modPull(); return go('mod'); };
const tapAdmin = () => { admPull(); return go('admin'); };

/* Le bouton vit dans les Réglages, donc il porte data-act : le
   gestionnaire était rangé avec ceux des feuilles, qui lisent data-mact.
   Il n'a jamais été atteint une seule fois. */
const tapBlocked = () => { blocksPull().then(() => paintMenu()); return openMenu('blocked'); };

/* Trois publics, trois écrans derrière le même bouton : le référent gère
   son établissement, le professeur ses classes, l'élève — scolaire ou
   non — ses devoirs et les classes qu'il a rejointes. */
const tapClasses = () => allerClasses();

const tapRef = () => { refPull(); return go('ref'); };

/* Retour de l'éditeur vers le devoir en préparation. */
function tapPretour() {
  const d = deck(view.id);
  if (d) return donnerLivre(d);
  return allerAccueil();
}

const tapBackup2 = () => openMenu('backup');
const tapUndo2 = () => { doUndo(); };
const tapMailScreen = () => { mailbox.list = null; mailPull(); return go('mail'); };
const tapTrash = () => { trash.list = null; trashPull(); return go('trash'); };

/* ---- sélection multiple ---- */
const tapSelmode = () => { setSel(sel ? null : new Set()); return render(); };

function tapSelall() {
  const d = deck(view.id); if (!d) return;
  setSel(new Set(sel.size === d.cards.length ? [] : d.cards.map(c => c.id)));
  return render();
}

const tapSelmove = () => openMenu('move');

function tapSelsus() {
  const d = deck(view.id); if (!d || !sel.size) return;
  const cs = d.cards.filter(c => sel.has(c.id));
  const on = cs.some(c => !c.x);                   // tout d'un bloc, dans le même sens
  pushUndo('Suspension', [d.id]);
  cs.forEach(c => { if (on) c.x = 1; else delete c.x; });
  saveDeck(d); render();
  return toast(on ? I.eyeoff : I.eye, cs.length + (on ? ' suspendue' : ' réactivée') + (cs.length > 1 ? 's' : ''), true);
}

function tapSeldel() {
  const d = deck(view.id); if (!d || !sel.size) return;
  const n = d.cards.filter(c => sel.has(c.id)).length;
  pushUndo('Suppression', [d.id]);
  d.cards = d.cards.filter(c => !sel.has(c.id));
  setSel(new Set()); saveDeck(d); render();
  return toast(I.trash, n + ' carte' + (n > 1 ? 's' : '') + ' supprimée' + (n > 1 ? 's' : ''), true);
}

const tapLogout = () => logout();
const tapTglboth = () => { prefs.both = !prefs.both; savePrefs(); return render(); };
const tapTglfast = () => { prefs.fast = !prefs.fast; savePrefs(); return render(); };
const tapTglsound = () => { prefs.sound = !prefs.sound; savePrefs(); render(); if (prefs.sound) beep(true); };
const tapRename = () => openMenu('rename');
const tapChpwd = () => openMenu('pwd');
const tapDelacc = () => openMenu('delacc');
const tapPuball = () => openMenu('backup');
const tapNew = () => { resetComp(); return go('import'); };
const tapPaste = () => { resetComp({ mode: 'coller' }); return go('import', view.name === 'deck' ? view.id : null); };

function tapDeckAction() {
  const t = (study && study.id) || view.id;
  return t === 'all' ? go('home') : go('deck', t);
}

const tapMenu = () => openMenu('deck');

function tapStudy() {
  const d = deck(view.id);
  return startStudy(view.id, false, null, { only: dueCount(d) ? 'due' : null, both: prefs.both });
}

/* le quota du jour est atteint et des pages neuves attendent : vingt de plus */
const tapStudyplus = () => startStudy(view.id, false, null, { only: 'due', plus: 20, both: prefs.both });
const tapStudyall = () => { closeMenu(); return startStudy(view.id, false, null, { tout: true }); };
const tapStudyleech = () => { closeMenu(); return startStudy(view.id, false, null, { only: 'leech' }); };
const tapQuizdeck = () => startQuiz(view.id);

/* Le bouton porte un mélangeur : il mélange, quel que soit l'ordre
   réglé dans les préférences. Avant, il reconstruisait la file avec
   cet ordre — « du paquet », « urgentes » ou « ratées » redonnaient
   exactement la même suite, et le bouton semblait mort.
   Le reste de la session est conservé : le sens, le mode, et le
   filtre (le marathon reste sur les cartes dues). */
function tapRestart() {
  const o = (study && study.opt) || {};
  return startStudy(study ? study.id : view.id, study && study.rev, null,
    study ? { ...o, mode: study.mode, both: study.both, order: 'random' } : { order: 'random' });
}

function tapSwap() {
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

function tapSwapq() {
  if (!quiz) return;
  /* La réponse d'aujourd'hui devient la question de demain : on repart sur
     le même mot plutôt qu'au hasard ailleurs dans le paquet. */
  const cur = quiz.pool[quiz.i];
  const at = cur ? norm(plain(cur.a[0])) : '';
  toast(I.swap, quiz.rev ? 'Sens normal' : 'Sens inversé');
  return startQuiz(quiz.id, null, !quiz.rev, { at });
}

function tapAnyway() {
  if (quiz.state !== 'bad') return;
  quiz.ok++; quiz.forced++; quiz.bad.pop(); quiz.miss.pop();
  quiz.log[quiz.log.length - 1] = 1;
  return nextQ();
}

function tapNextcard() {
  if (!study) return;
  if (study.mode === 'mcq' && study.pick != null) return commit(study.pickOk, study.pickOk ? 2 : 0);
  if (study.tf != null) { setPendingGrade(study.tf ? 2 : 0); return fling(study.tf ? 1 : -1); }
}

const tapRedostudy = () => startStudy(study.id, study.rev, study.miss.map(m => m.id));
const tapQp = (a, ds) => pickQuiz(+ds.qp);
const tapQsay = () => say(quiz.pool[quiz.i].f, quiz.qlang);

function tapHint() {
  if (quiz.state !== 'ask') return;
  if (!quiz.hint) quiz.hints++;
  quiz.hint++; return render();
}

const tapIdk = () => { if (quiz.state === 'ask') fail(); };

function tapQcm2() {
  if (quiz.answers.length < 2) return;
  quiz.mode = quiz.mode === 'qcm' ? '' : 'qcm';
  quiz.opts = null; quiz.optsFor = -1;
  return render();
}

const tapAsr = () => dictate();
const tapSend = () => submit();
const tapNext = () => nextQ();
const tapRequiz = () => startQuiz(quiz.id, null, quiz.rev);
const tapRedo = () => startQuiz(quiz.id, shuffle(quiz.bad.slice()), quiz.rev);

function tapAdd() {
  const d = deck(view.id);
  d.cards.push({ id: uid(), f: '', b: '' }); saveDeck(d); render();
  const i = $.querySelector('.rows .row:last-of-type input'); if (i) i.focus();
}

/* Table de dispatch pour le clic « écran » (celui monté sur `#app`, à
   distinguer de celui des feuilles, dans `menus-c.js`). Même principe et
   même raison (M06.T6) : chaque test lit `ds.*` (l'attribut
   `data-*` du bouton) ou compare `a` (`ds.act`), dans l'ordre où ces cas
   étaient déclarés dans la chaîne de `if` qu'elle remplace. */
const CLICK_RULES = [
  [a => /^(home|quitquiz|deck)$/.test(a || '') && lostOnLeave() && !leaving, tapLeavingGuard],
  [(a, ds) => ds.help !== undefined, tapHelp],
  [(a, ds) => ds.modact !== undefined, tapModact],
  [(a, ds) => ds.legal !== undefined, tapLegal],
  [(a, ds) => ds.yes !== undefined, tapYes],
  [(a, ds) => ds.no !== undefined, tapNo],
  [(a, ds) => ds.mate !== undefined, tapMate],
  [(a, ds) => ds.mail !== undefined, tapMail],
  [(a, ds) => ds.dpick !== undefined, tapDpick],
  [(a, ds) => ds.duel !== undefined, tapDuel],
  [(a, ds) => ds.brange !== undefined, tapBrange],
  [(a, ds) => ds.pkc !== undefined && sel, tapPkc],
  [(a, ds) => ds.trr !== undefined, tapTrr],
  [(a, ds) => ds.trd !== undefined, tapTrd],
  [(a, ds) => ds.dl !== undefined, tapDl],
  [(a, ds) => ds.ed !== undefined, tapEd],
  [(a, ds) => ds.filt !== undefined, tapFilt],
  [(a, ds) => ds.nsubj !== undefined, tapNsubj],
  [(a, ds) => ds.sub !== undefined, tapSub],
  [(a, ds) => ds.go, tapGo],
  [(a, ds) => ds.a, tapDsA],
  [(a, ds) => ds.g !== undefined, tapDsG],
  [(a, ds) => ds.rm, tapRm],
  [(a, ds) => ds.sus, tapSus],
  [(a, ds) => ds.card, tapCard],
  [(a, ds) => ds.camadd, tapCamadd],
  [(a, ds, b) => b.dataset.tf !== undefined, tapTf],
  [(a, ds, b) => b.dataset.pick !== undefined, tapPick],
  [(a, ds, b) => b.dataset.mt, tapMt],
  [(a, ds, b) => b.dataset.snd !== undefined || b.dataset.say !== undefined, tapSndSay],
  [a => a === 'home' || a === 'tab-home', tapHome],
  [a => a === 'deckback', tapDeckback],
  [a => a === 'tab-commu' || a === 'commu', tapCommu],
  [a => a === 'friends', tapFriendsBoard],
  [a => a === 'doadd', tapDoadd],
  [a => a === 'handle', tapHandle],
  [a => a === 'quitquiz', tapQuitquiz],
  [a => a === 'peek', tapPeek],
  [a => a === 'marathon', tapMarathon],
  [a => a === 'retry', tapRetry],
  [a => a === 'mcq' || a === 'match', tapMcqMatch],
  [a => a === 'sharepick', tapSharepick],
  [a => a === 'goalinfo' || a === 'stats', tapStats],
  [a => a === 'help', tapHelpTuto],
  [a => a === 'install', tapInstall],
  [a => a === 'duelquit', tapDuelquit],
  [a => a === 'addshared', tapAddshared],
  [a => a === 'expstats', tapExpstats],
  [a => a === 'find', tapFind],
  [a => a === 'deckfind', tapDeckfind],
  [a => a === 'sortpick', tapSortpick],
  [a => a === 'listview', tapListview],
  [a => a === 'reorder', tapReorder],
  [a => a === 'resume', tapResume],
  [a => a === 'settings', tapSettings],
  [a => a === 'tolog', tapTolog],
  [a => a === 'demande', tapDemande],
  [a => a === 'decouvrir', tapDecouvrir],
  [a => a === 'mod', tapMod],
  [a => a === 'admin', tapAdmin],
  [a => a === 'blocked', tapBlocked],
  [a => a === 'classes' || a === 'tab-classes', tapClasses],
  [a => a === 'ref', tapRef],
  [a => a === 'pretour', tapPretour],
  [a => a === 'backup2', tapBackup2],
  [a => a === 'undo2', tapUndo2],
  [a => a === 'mail', tapMailScreen],
  [a => a === 'trash', tapTrash],
  [a => a === 'selmode', tapSelmode],
  [a => a === 'selall', tapSelall],
  [a => a === 'selmove', tapSelmove],
  [a => a === 'selsus', tapSelsus],
  [a => a === 'seldel', tapSeldel],
  [a => a === 'logout', tapLogout],
  [a => a === 'tglboth', tapTglboth],
  [a => a === 'tglfast', tapTglfast],
  [a => a === 'tglsound', tapTglsound],
  [a => a === 'rename', tapRename],
  [a => a === 'chpwd', tapChpwd],
  [a => a === 'delacc', tapDelacc],
  [a => a === 'puball', tapPuball],
  [a => a === 'new', tapNew],
  [a => a === 'paste', tapPaste],
  [a => a === 'deck', tapDeckAction],
  [a => a === 'menu', tapMenu],
  [a => a === 'study', tapStudy],
  [a => a === 'studyplus', tapStudyplus],
  [a => a === 'studyall', tapStudyall],
  [a => a === 'studyleech', tapStudyleech],
  [a => a === 'quizdeck', tapQuizdeck],
  [a => a === 'restart', tapRestart],
  [a => a === 'swap', tapSwap],
  [a => a === 'swapq', tapSwapq],
  [a => a === 'anyway', tapAnyway],
  [a => a === 'nextcard', tapNextcard],
  [a => a === 'redostudy', tapRedostudy],
  [(a, ds) => ds.qp !== undefined, tapQp],
  [(a, ds) => ds.qsay !== undefined, tapQsay],
  [a => a === 'hint', tapHint],
  [a => a === 'idk', tapIdk],
  [a => a === 'qcm2', tapQcm2],
  [a => a === 'asr', tapAsr],
  [a => a === 'send', tapSend],
  [a => a === 'next', tapNext],
  [a => a === 'requiz', tapRequiz],
  [a => a === 'redo', tapRedo],
  [a => a === 'add', tapAdd]
];

$.addEventListener('click', e => {
  const b = e.target.closest('button,[data-act],[data-go],[data-rm],[data-a],[data-g],[data-q],[data-filt],[data-nsubj],[data-ed],[data-dl],[data-sub],[data-sus],[data-ord],[data-snd],[data-say],[data-tf],[data-card],[data-pick],[data-mt],[data-qp],[data-qsay],[data-trr],[data-trd],[data-pkc],[data-mail],[data-duel],[data-brange],[data-dpick],[data-help],[data-yes],[data-no],[data-mate],[data-legal],[data-modact]');
  if (!b) return;
  const ds = b.dataset;
  const a = ds.act;
  for (const [test, run] of CLICK_RULES) {
    if (test(a, ds, b)) return run(a, ds, b);
  }
});
