import { $ } from '../racine.js';
import { I } from '../icones.js';
import { shuffle } from '../file.js';
import {
  accounts, adm, board, classOf, classes, comp, deckOpen, duels, friends, groups, leaving,
  lib, mailbox, menu, mods, myRole, online, peek, pendingGrade, prefs, prof, quiz, ref,
  reorder, sel, setAccOpen, setAddQ, setAnimate, setAsgs, setCardEdit, setClassOf,
  setDeckOpen, setDeckQ, setDuelRun, setFilter, setFindQ, setGroupOf, setGroupTab,
  setHelpKey, setLeaving, setLegalBack, setLegalTab, setMateOpen, setMates2, setMemberOpen,
  setPeek, setPendingGrade, setQuiz, setReorder, setRoster, setScope, setSel, setShared,
  setStudy, setWorkOpen, shared, stats, study, trash, view
} from '../data/etat.js';
import { allDue, go, render } from './bibliotheque.js';
import {
  commuPull, compNeuf, doAdd, donnerLivre, lireComp
} from './bilan-devoirs.js';
import { groupsPull } from '../core/bilan-devoirs.js';
import { plain, play, say } from './carte-media.js';
import { fsrsTune } from '../core/carte-media.js';
import {
  atSchool, isProf, isPupil, lireClass, lireNew, maClassePull
} from './classement.js';
import {
  accountsPull, admPull, blocksPull, boardPull, classPull, classesPull, matesPull, modAct,
  modPull, refDo, refPeople, refPull, refTeam
} from '../core/classement.js';
import { canUndo, deck, doUndo, flush, pending, plur, pushUndo, saveDeck, sty, subj, uid } from '../core/coeur-sync.js';
import { selBar } from './connexion.js';
import { duelPick } from './defis.js';
import { duelsPull } from '../core/defis.js';
import { exportStats, groupPull, lostOnLeave } from './ecran-groupe.js';
import { statsPull } from '../core/ecran-groupe.js';
import { jourFr } from './etablissement.js';
import {
  profClassePull, profDo, profFichePull, profPull
} from '../core/etablissement.js';
import {
  beep, dueCount, importPayload, savePrefs, toast
} from './import-cartes.js';
import { closeMenu, openMenu, paintMenu } from './menus-a.js';
import { logout, openInstall } from './onboarding.js';
import {
  dictate, fail, nextQ, norm, pickQuiz, resetComp, startQuiz, submit
} from './quiz.js';
import { cb, cf, openSubject } from './reglages-corbeille.js';
import {
  answerFriend, askFriend, friendsPull, libPull, mailPull, openMail,
  trashPull, trashPurge, trashRestore
} from '../core/reglages-corbeille.js';
import {
  answerTF, cardOf, cardOrigin, commit, fling, isTF, loadResume, paintQ, pickMCQ, pickMatch,
  saveResume, startStudy, toggleFlip
} from './revision.js';

/* ══════════ ce qui se presse dans une feuille ══════════
   Une feuille est montée sur `document.body`, pas dans `#app` : les
   branches écrites pour l'écran ne la voient jamais. Plutôt que d'en tenir
   deux copies — qui divergeront —, on les range ici, et les deux
   gestionnaires appellent la même fonction. Elle rend `true` quand elle a
   traité le clic, et le gestionnaire s'arrête là. */
export function feuilleTap(b) {
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
    setLeaving(a0); return openMenu('leave');
  }
  if (ds.help !== undefined) { setHelpKey(ds.help); return openMenu('help'); }
  if (ds.modact !== undefined) return modAct(+ds.rid, ds.modact);
  if (ds.account !== undefined) { setAccOpen(ds.account); return openMenu('account'); }
  if (ds.classe !== undefined) {
    setClassOf(ds.classe); setRoster(null); setAsgs(null); classPull(classOf); return go('classe');
  }
  /* Le même devoir, deux feuilles : celle de l'élève l'ajoute à sa
     bibliothèque, celle du professeur montre le suivi. L'ancienne feuille
     cherchait la classe dans `classes`, que l'élève ne charge plus depuis
     qu'il a son propre écran — elle se refermait sans rien dire. */
  if (ds.work !== undefined) {
    setWorkOpen(ds.work);
    return openMenu(isPupil() ? 'devoir' : 'workone');
  }
  if (ds.member !== undefined) { setMemberOpen(ds.member); return openMenu('member'); }
  /* On doit pouvoir lire ces textes sans compte : le retour ramène donc
     là d'où l'on venait, y compris l'écran de connexion. */
  if (ds.legal !== undefined) {
    setLegalTab(ds.legal);
    if (view.name !== 'legal') setLegalBack(view.name === 'login' ? 'login' : 'settings');
    return go('legal');
  }
  if (ds.yes !== undefined) return answerFriend(ds.yes, true);
  if (ds.no !== undefined) return answerFriend(ds.no, false);
  if (ds.mate !== undefined) { setMateOpen(ds.mate); return openMenu('mate'); }
  if (ds.group !== undefined) { setGroupOf(ds.group); return openMenu('groupitem'); }
  if (ds.mail !== undefined) return openMail(+ds.mail);
  if (ds.dpick !== undefined) return duelPick(+ds.dpick);
  if (ds.lib !== undefined) { lib.open = ds.lib; return openMenu('libitem'); }
  if (ds.duel !== undefined) { duels.open = ds.duel; return openMenu('duelitem'); }
  if (ds.gtab !== undefined) { setGroupTab(ds.gtab); groupPull(); setAnimate(false); return render(); }
  /* changer de portée, c'est changer de public : le classement se
     recalcule côté base, la bibliothèque et les défis se refiltrent ici */
  if (ds.scope !== undefined) {
    setScope(ds.scope || null);
    board.rows = null; setAnimate(false); render();
    return boardPull();
  }
  if (ds.brange !== undefined) { board.range = +ds.brange; board.rows = null; setAnimate(false); render(); return boardPull(); }
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
  if (ds.filt !== undefined) { setFilter(ds.filt); render(); return; }
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
  if (ds.g !== undefined) { setPendingGrade(+ds.g); return fling(+ds.g > 0 ? 1 : -1); }
  if (ds.rm) { const d = deck(view.id); d.cards = d.cards.filter(c => c.id !== ds.rm); saveDeck(d); return render(); }
  if (ds.sus) {
    const d = deck(view.id), c = d.cards.find(x => x.id === ds.sus);
    c.x = !c.x; saveDeck(d); return render();
  }
  const a = ds.act, d = view.id ? deck(view.id) : null;
  if (ds.card) { setCardEdit(ds.card); return openMenu('card'); }
  /* Ajouter un camarade depuis la liste de sa classe : pas de pseudo à
     taper, on appuie sur le plus en face du nom. */
  /* ---- la console du référent ---- */
  if (ds.atab) { adm.tab = ds.atab; setAnimate(false); return render(); }
  if (ds.rtab) { ref.tab = ds.rtab; if (ref.tab === 'gens' && !ref.gens) refPeople(true);
    setAnimate(false); return render(); }
  if (ds.rrole !== undefined) { ref.role = ds.rrole; refPeople(true); setAnimate(false); return render(); }
  if (ds.rpage !== undefined) { ref.page = +ds.rpage; refPeople(false); setAnimate(false); return render(); }
  if (ds.rclsoff) { ref.cls = null; refPeople(true); setAnimate(false); return render(); }
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
  if (ds.ptab) { prof.tab = ds.ptab; setAnimate(false); return render(); }
  if (ds.pvue) { prof.vue = ds.pvue; setAnimate(false); return render(); }
  if (ds.pmois) { prof.mois = ds.pmois; setAnimate(false); return render(); }
  if (ds.pjour) { prof.jour = prof.jour === ds.pjour ? null : ds.pjour;
    prof.mois = ds.pjour; setAnimate(false); return render(); }
  if (ds.ptri) { prof.tri = ds.ptri; setAnimate(false); return render(); }
  if (ds.peleve) {
    prof.eleve = ds.peleve; prof.fiche = null;
    profFichePull(prof.open, prof.eleve); return go('profeleve');
  }
  if (ds.pwork) { prof.work = ds.pwork; prof.cartes = null; return openMenu('pwork'); }
  if (ds.camadd) {
    const n = ds.camn;
    askFriend(n).then(ok => { if (ok) { setMates2(null); matesPull(); } })
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
  if (a === 'newgroup') { setAddQ(''); return openMenu('newgroup'); }
  if (a === 'joingroup') { setAddQ(''); return openMenu('joingroup'); }
  /* un quiz se lance depuis un paquet : en sortir, c'est y revenir */
  if (a === 'quitquiz') { const id = quiz && quiz.id; setQuiz(null);
    return deck(id) ? go('deck', id) : go('home'); }
  if (a === 'peek') { setPeek(!peek); render(); return; }
  if (a === 'marathon') return startStudy('all', false, null, { only: 'due', both: prefs.both });
  if (a === 'retry') {
    if (!pending()) return toast(I.check, 'Tout est enregistré');
    toast(I.cloud, 'Envoi…');
    flush().then(() => { setAnimate(false); render(); if (online && !pending()) toast(I.check, 'À jour'); });
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
  if (a === 'duelquit') { setDuelRun(null); return go('group'); }
  if (a === 'addshared') {
    const sd = shared && shared.d; if (!sd) return;
    const cards = (sd.cards || []).map(c => [cf(c), cb(c)]);
    const nd = importPayload({ name: sd.name, subject: '', cards }, true);
    setShared(null);
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
        setAnimate(false); render();
        const tuned = (prefs.wAt || 0) !== before;
        toast(n || tuned ? I.check : I.x,
          !n && !tuned ? 'Pas encore assez d’historique noté'
          : tuned ? 'Moteur réglé sur ton historique' + (n ? ' · ' + plur(n, 'page') + ' à jour' : '')
          : plur(n, 'page') + ' recalculée' + (n > 1 ? 's' : '') + ' sur ton historique');
      } catch (e) { toast(I.x, 'Historique indisponible'); }
    })();
    return;
  }
  if (a === 'find') { setFindQ(''); return go('find'); }
  if (a === 'deckfind') {
    setDeckOpen(!deckOpen);
    if (!deckOpen) setDeckQ('');
    setAnimate(false); return render();
  }
  if (a === 'zen') { prefs.zen = !prefs.zen; savePrefs(); setAnimate(false); return render(); }
  if (a === 'sortpick') return openMenu('sortpick');
  if (a === 'listview') { prefs.list = !prefs.list; savePrefs(); setAnimate(false); return render(); }
  if (a === 'reorder') {
    setReorder(!reorder);
    if (reorder && prefs.sort !== 'manual') { prefs.sort = 'manual'; savePrefs(); }
    setAnimate(false); return render();
  }
  if (a === 'resume') {
    const r = loadResume(); if (!r) return render();
    setStudy(r); return go('study', r.id);
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
  if (a === 'selmode') { setSel(sel ? null : new Set()); return render(); }
  if (a === 'selall') {
    const d = deck(view.id); if (!d) return;
    setSel(new Set(sel.size === d.cards.length ? [] : d.cards.map(c => c.id)));
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
    setSel(new Set()); saveDeck(d); render();
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
    if (study.tf != null) { setPendingGrade(study.tf ? 2 : 0); return fling(study.tf ? 1 : -1); }
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
    setPendingGrade(+e.key - 1);
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

export function consumeGoto() {
  const q = new URLSearchParams(location.search).get('go');
  if (!q || !GOTO[q]) return false;
  history.replaceState(null, '', location.pathname + location.hash);
  try { GOTO[q](); } catch (e) { go('home'); }
  return true;
}
