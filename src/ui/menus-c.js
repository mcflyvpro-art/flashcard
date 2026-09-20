import { I, svg } from '../icones.js';
import {
  asgs, auth, cardEdit, classOf, db, dirty, duels, fnr, friends, gone, groupOf, groups,
  leaving, lib, mailOpen, mailbox, mateOpen, mateProf, mates, memberOpen,
  menu, prefs, previewOf, prof, quiz, recKey, recorder, ref, reportOn, sel, sendTo,
  setAnimate, setAsgs, setDeckOpen, setDeckQ, setLeaving,
  setPendingGrade, setQuiz, setRecKey, setReorder, setReportWhy, setSel, setSendMsg,
  setSendTo, setSplitSize, setStudy, setSubjColor, setView, splitSize, study, subjColor,
  subjEdit, subjName, view, workOpen
} from '../data/etat.js';
import { go, render } from './bibliotheque.js';
import { compDonner, lireComp, profCartesDeDevoir } from './bilan-devoirs.js';
import { joinGroup, leaveGroup, makeGroup } from '../core/bilan-devoirs.js';
import {
  REC, enc, pickFile, recStart, recStop, upErr
} from './carte-media.js';
import { upload } from '../core/carte-media.js';
import { openReport } from './classement.js';
import {
  blockUser, dropMember, giveWork, joinClass, makeClass, refDo, refPeople, sendReport,
  setRole, takeWork, unblockUser
} from '../core/classement.js';
import { lireClass, lireNew } from './classement.js';
import {
  deck, delSubject, doUndo, esc, flush, plur, pushSubject, pushUndo, save, saveDeck,
  setMeta, slugify, solveConflict
} from '../core/coeur-sync.js';
import { PWMIN } from './connexion.js';
import { duelStart } from './defis.js';
import { duelClasse, duelDrop, duelMake } from '../core/defis.js';
import { profDo } from '../core/etablissement.js';
import {
  cloneDeck, fnrApply, mergeDecks, savePrefs, splitDeck, spreadBacklog, toast
} from './import-cartes.js';
import { feuilleTap } from './interactions.js';
import { closeMenu, mountMenu, openMenu, paintMenu } from './menus-a.js';
import { changePassword, deleteAccount, deleteAssignment, mateProfPull, sendMotProf } from '../core/menus-c.js';
import { copyLink, doPrompt, logout, startTour } from './onboarding.js';
import { libAdd, versRestore } from './reglages-corbeille.js';
import {
  addMail, delMail, dropFriend, libRemove
} from '../core/reglages-corbeille.js';
import {
  friendsPull, libPublish, revokeShare, saveHandle, sendDeck, shareLink, versPull
} from '../core/reglages-corbeille.js';
import { startStudy } from './revision.js';

export function paintMenuRename(w) {
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

function clickDnew(a, b) { const t = deck(b.dataset.dnew); if (t) duelMake(t); }

function clickCopy(a, b) {
  const url = b.dataset.copy;
  if (navigator.share) navigator.share({ url }).catch(() => {});
  else navigator.clipboard.writeText(url).then(() => toast(I.check, 'Adresse copiée'),
                                               () => toast(I.x, 'Copie impossible'));
}

const clickVers = (a, b) => versRestore(+b.dataset.vers);
function clickChap(a, b) { closeMenu(); return startTour(b.dataset.chap || null); }
function clickMsubj(a, b, d) { d.subject = b.dataset.msubj; saveDeck(d); render(); }
function clickFside(a, b) { fnr.side = b.dataset.fside; return paintMenu(); }
function clickFriendPick(a, b) { setSendTo(b.dataset.friend); return paintMenu(); }

function clickMrange(a, b) {
  mateProf.range = +b.dataset.mrange; mateProf.row = null;
  paintMenu(); return mateProfPull(mateOpen);
}

function clickLend(a, b) {
  const bk = deck(b.dataset.lend), f = (mates || []).find(x => x.id === mateOpen);
  if (!bk || !f) return;
  closeMenu();
  return sendDeck(bk, { id: f.id, name: f.name || ('@' + (f.handle || '')) });
}

function clickSortby(a, b) {
  prefs.sort = b.dataset.sortby; savePrefs();
  closeMenu(); setAnimate(false); return render();
}

function clickMove(a, b, d) {
  const t = deck(b.dataset.move); if (!t || !d || !sel) return;
  const moved = d.cards.filter(c => sel.has(c.id));
  if (!moved.length) return closeMenu();
  pushUndo('Déplacement', [d.id, t.id]);
  d.cards = d.cards.filter(c => !sel.has(c.id));
  t.cards.push(...moved);                       // identifiants et progression conservés
  setSel(new Set());
  dirty[d.id] = 1; dirty[t.id] = 1; save(); flush();
  closeMenu(); render();
  return toast(I.out, moved.length + ' carte' + (moved.length > 1 ? 's' : '')
    + ' → ' + t.name, true);
}

function clickMerge(a, b, d) {
  const src = deck(b.dataset.merge); if (!src || !d) return;
  const r = mergeDecks(d, src);
  closeMenu(); render();
  return toast(I.link, r.added + ' carte' + (r.added > 1 ? 's' : '') + ' ajoutée'
    + (r.added > 1 ? 's' : '') + (r.skipped ? ' · ' + r.skipped + ' en double ignorée' + (r.skipped > 1 ? 's' : '') : ''), true);
}

/* réglages propres au paquet, dans leur feuille */
function clickTol(a, b, d) { setMeta(d, { tol: b.dataset.tol }); return paintMenu(); }
function clickLgf(a, b, d) { setMeta(d, { langf: b.dataset.lgf }); return paintMenu(); }
function clickLgb(a, b, d) { setMeta(d, { langb: b.dataset.lgb }); return paintMenu(); }
function clickTm(a, b, d) { setMeta(d, { timer: +b.dataset.tm }); return paintMenu(); }

function clickCt(a, b, d) {
  const c = d && d.cards.find(x => x.id === cardEdit);
  if (c) { if (b.dataset.ct) c.t = b.dataset.ct; else delete c.t; saveDeck(d); }
  return paintMenu();
}

const clickClose = () => closeMenu();
function clickWhy(a, b) { setReportWhy(b.dataset.why); return paintMenu(); }
const clickUnblock = (a, b) => unblockUser(b.dataset.unblock);
const clickSetrole = (a, b) => setRole(b.dataset.who, b.dataset.setrole);
const clickRsend = () => sendReport();
function clickRblock() { const r = reportOn; if (r && r.user) return blockUser(r.user, r.label); }

/* Le signalement emporte une copie : ce qu'on voit à l'écran est ce qui
   part, et effacer ensuite ne l'efface pas. */
function clickLibReportBlock(a) {
  const it = (lib.list || []).find(x => x.deck_id === lib.open); if (!it) return;
  if (a === 'libblock') return blockUser(it.user_id, it.who);
  return openReport('library', it.deck_id, it.user_id, it.name,
    { nom: it.name, qui: it.who, matiere: it.subject, cartes: (it.cards || []).slice(0, 40) });
}

function clickMailReportBlock(a) {
  const it = mailbox.list && mailbox.list.find(x => x.id === mailOpen); if (!it) return;
  if (a === 'mailblock') return blockUser(it.from_user, it.from_name);
  return openReport('mail', it.id, it.from_user, it.deck_name,
    { nom: it.deck_name, qui: it.from_name, message: it.message, cartes: (it.cards || []).slice(0, 40) });
}

function clickMateReportBlock(a) {
  const f = (mates || []).find(x => x.id === mateOpen); if (!f) return;
  if (a === 'mateblock') return blockUser(f.id, f.name || f.handle);
  return openReport('profile', f.id, f.id, f.name || ('@' + (f.handle || '')),
    { pseudo: f.handle, nom: f.name });
}

function clickDoClass() {
  const n = (document.getElementById('cn') || {}).value || '';
  const l = (document.getElementById('cl') || {}).value || '';
  return makeClass(n, l);
}

function clickDoClassJoin() {
  const v = ((document.getElementById('cn') || {}).value || '').trim();
  if (v) return joinClass(v);
}

function clickGive(a, b) {
  const d = deck(b.dataset.give);
  if (d && classOf) return giveWork(d, classOf, 7);
}

/* ---- le composeur et la feuille d'un devoir ---- */
function clickCadd() {
  if (!prof.comp) return;
  lireComp();
  const f = prof.comp.recto.trim(), b = prof.comp.verso.trim();
  if (!f || !b) return toast(I.x, 'Il faut un recto et un verso');
  prof.comp.cartes.push([f, b]);
  prof.comp.recto = ''; prof.comp.verso = '';
  paintMenu();
  setTimeout(() => { const n = document.getElementById('crec'); if (n) n.focus(); }, 40);
}

const clickCgive = () => compDonner();

function clickPdefi() {
  const d = (prof.devoirs || []).find(x => x.id === prof.work);
  if (d) duelClasse(d.id, d.nom);
}

function clickPmotgo() {
  const t = ((document.getElementById('pmt') || {}).value || '').trim();
  if (!t) return toast(I.x, 'Écris ton message');
  const m = (prof.roster || []).find(x => x.user_id === prof.eleve);
  sendMotProf(prof.eleve, t)
    .then(() => { closeMenu(); render();
      toast(I.check, 'Mot envoyé à ' + (m ? m.who.split(' ')[0] : 'l’élève')); },
          () => toast(I.x, 'Envoi impossible'));
}

function clickPrelance() {
  return profDo('prof_relance', { aid: prof.work, mot: '' },
    r => r ? plur(r, 'élève') + ' relancé' + (r > 1 ? 's' : '') : 'Personne à relancer')
    .then(() => { closeMenu(); render(); });
}

function clickPredonner() {
  const d = (prof.devoirs || []).find(x => x.id === prof.work);
  if (!d) return;
  /* Redonner, c'est repartir du composeur avec tout de prérempli : le
     professeur n'a plus qu'à cocher les classes. Les cartes viennent du
     devoir lui-même, pas d'une bibliothèque où elles ne sont peut-être
     plus. */
  profCartesDeDevoir(d);
}

function clickPdel() {
  return profDo('prof_del_work', { aid: prof.work }, 'Devoir retiré')
    .then(() => { closeMenu(); render(); });
}

/* ---- écritures du référent ---- */
function clickRefsave() {
  if (!ref.who) return;
  const v = id => ((document.getElementById(id) || {}).value || '').trim();
  return refDo('ref_update_account',
    { cible: ref.who.id, nom: v('fnom'), pseudo: v('fpse'), adresse: v('fmel') },
    'Identité enregistrée').then(() => { closeMenu(); render(); });
}

function clickRefpw() {
  if (!ref.who) return;
  const pw = ((document.getElementById('fpw') || {}).value || '').trim();
  if (pw.length < 10) return toast(I.x, 'Au moins dix caractères');
  return refDo('ref_set_password', { cible: ref.who.id, pw },
    'Mot de passe refait · ' + pw).then(() => { ref.form = {}; paintMenu(); });
}

function clickRefclssave() {
  const f = lireClass();
  /* Le cycle ne se modifie pas ici — il n'y a pas de champ pour lui — mais
     `ref_save_class` réécrit toute la ligne : le lui taire l'effacerait. */
  const c = (ref.classes || []).find(x => x.id === ref.open) || {};
  return refDo('ref_save_class',
    { cid: ref.open, nom: f.nom, niveau: f.niv, cycle: c.cycle || '', filiere: f.fil,
      prevu: f.pre ? +f.pre : null }, 'Classe enregistrée')
    .then(() => { closeMenu(); render(); });
}

function clickRefclsdel() {
  return refDo('ref_delete_class', { cid: ref.open }, 'Classe supprimée')
    .then(r => { if (r !== null) { closeMenu(); render(); } });
}

function clickRefclsgens() {
  ref.cls = ref.open; ref.tab = 'gens'; ref.role = ''; ref.q = '';
  refPeople(true); closeMenu(); setAnimate(false); return render();
}

function clickRefdonew() {
  const f = { ...(ref.form || {}), ...lireNew() };
  ref.form = f;
  if ((f.pw || '').length < 10) return toast(I.x, 'Au moins dix caractères');
  return refDo('ref_new_account',
    { adresse: f.mel || '', nom: f.nom || '', pseudo: f.pse || '',
      qrole: f.role || 'eleve', cid: (f.role || 'eleve') === 'eleve' ? (f.cls || null) : null,
      pw: f.pw || '' }, 'Compte ouvert · ' + (f.mel || ''))
    .then(r => { if (r) { ref.form = {}; closeMenu(); render(); } });
}

function clickRefdonewclass() {
  const f = { ...(ref.form || {}), ...lireClass() };
  ref.form = f;
  return refDo('ref_save_class',
    { cid: null, nom: f.nom || '', niveau: f.niv || '', cycle: f.cyc || '',
      filiere: f.fil || '', prevu: f.pre ? +f.pre : null }, 'Classe créée')
    .then(r => { if (r) { ref.form = {}; closeMenu(); render(); } });
}

function clickTakework() {
  const x = (asgs || []).find(y => y.id === workOpen);
  if (x) return takeWork(x);
}

function clickDelwork() {
  const id = workOpen; closeMenu();
  deleteAssignment(id)
    .then(() => { setAsgs((asgs || []).filter(x => x.id !== id)); render(); toast(I.check, 'Devoir retiré'); },
          () => toast(I.x, 'Impossible pour l’instant'));
}

function clickDropmember() { if (classOf && memberOpen) return dropMember(classOf, memberOpen); }
const clickInstcopy = () => copyLink();
const clickInstgo = () => doPrompt();

function clickCardOk() {
  const d = deck(view.id), c = d && d.cards.find(x => x.id === cardEdit);
  const t = document.getElementById('ctags');
  if (c && t) {
    const tags = t.value.split(',').map(x => x.trim()).filter(Boolean).slice(0, 6);
    if (tags.length) c.g = tags; else delete c.g;
    saveDeck(d);
  }
  closeMenu(); return render();
}

function clickDelField(a) {
  const d = deck(view.id), c = d && d.cards.find(x => x.id === cardEdit);
  if (c) { delete c[a.slice(4)]; saveDeck(d); }
  return paintMenu();
}

async function clickRecStop() {
  const key = recKey; setRecKey(null);
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

async function clickMedField(a) {
  const key = a.slice(4);
  const d = deck(view.id), c = d && d.cards.find(x => x.id === cardEdit);
  if (!c) return;
  if (key.endsWith('a') && REC && !recorder) {
    try { await recStart(); setRecKey(key); return paintMenu(); }
    catch (x) { /* micro refusé : on retombe sur le choix de fichier */ }
  }
  const f = await pickFile(key.endsWith('i') ? 'image/*' : 'audio/*');
  if (!f) return;
  toast(I.share, 'Envoi…');
  try { c[key] = await upload(f); saveDeck(d); toast(I.check); }
  catch (x) { toast(I.x, upErr(x)); }
  return paintMenu();
}

function clickDoRename() {
  prefs.name = document.getElementById('fld').value.trim(); savePrefs();
  closeMenu(); render(); toast(I.check, 'Nom enregistré');
}

function clickDoPwd() {
  const v = document.getElementById('fld').value, err = document.getElementById('mrr');
  if (v.length < PWMIN) { err.textContent = `Au moins ${PWMIN} caractères`; return; }
  err.textContent = 'Envoi…';
  changePassword(v)
    .then(() => { closeMenu(); toast(I.check, 'Mot de passe changé'); })
    .catch(() => { err.textContent = 'Changement impossible'; });
}

function clickDoDelacc(a, b) {
  const lab = b.querySelector('span'), err = document.getElementById('mrr');
  if (!b.dataset.arm) {
    b.dataset.arm = 1; lab.textContent = 'Confirmer la suppression';
    setTimeout(() => { if (b.isConnected) { delete b.dataset.arm; lab.textContent = 'Tout supprimer'; } }, 3000);
    return;
  }
  err.textContent = 'Suppression…';
  deleteAccount()
    .then(() => { closeMenu(); logout(); })
    .catch(() => { err.textContent = 'Suppression impossible'; });
}

function clickColor(a, b) { setSubjColor(b.dataset.color); return paintMenu(); }

function clickStudyAll(a) {
  closeMenu();
  return startStudy(view.id, false, null, a === 'studyleech' ? { only: 'leech' } : {});
}

function clickQuickMode(a) {
  closeMenu();
  return startStudy(view.id, false, null, { mode: a });
}

function clickSubjok() {
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

function clickSubjdel(a, b) {
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

function clickBackup() {
  closeMenu();
  const url = location.origin + location.pathname + '#i=' + enc(db.decks.map(x =>
    ({ key: x.key || x.id, name: x.name, subject: x.subject, cards: x.cards.map(c => [c.f, c.b]) })));
  if (navigator.share) navigator.share({ url }).catch(() => {});
  else navigator.clipboard.writeText(url).then(() => toast(I.check, 'Sauvegarde copiée'));
}

function clickHide(a, b, d) { d.hidden = !d.hidden; saveDeck(d); closeMenu(); render(); toast(d.hidden ? I.eyeoff : I.eye); }

function clickClone(a, b, d) {
  const n = cloneDeck(d); closeMenu(); go('deck', n.id);
  return toast(I.copy, n.cards.length + ' carte' + (n.cards.length > 1 ? 's' : '') + ' dupliquée' + (n.cards.length > 1 ? 's' : ''), true);
}

const clickUndo = () => { closeMenu(); doUndo(); };
const clickFnropen = () => { fnr.q = ''; fnr.r = ''; return openMenu('fnr'); };
const clickFnrcase = () => { fnr.cs = !fnr.cs; return paintMenu(); };

function clickDofnr(a, b, d) {
  const n = fnrApply(d);
  closeMenu(); render();
  return n ? toast(I.check, n + ' remplacement' + (n > 1 ? 's' : ''), true) : toast(I.x, 'Rien à remplacer');
}

const clickMergeopen = () => openMenu('merge');
function clickSplitopen(a, b, d) { setSplitSize(Math.min(splitSize, d.cards.length - 1)); return openMenu('split'); }

function clickDosplit(a, b, d) {
  const made = splitDeck(d, Math.min(Math.max(2, splitSize), d.cards.length - 1));
  closeMenu();
  if (!made) return toast(I.split, 'Rien à scinder');
  go('home');
  return toast(I.split, made.length + ' livres créés', true);
}

const clickLeavestay = () => { setLeaving(null); return closeMenu(); };

function clickLeavego() {
  const act = leaving; setLeaving(null); closeMenu();
  setQuiz(null); setStudy(study && study.mode ? null : study);
  const back = act === 'quitquiz' ? (quiz && quiz.id) : act === 'deck' ? view.id : null;
  if (act === 'quitquiz') setQuiz(null);
  return go(back && deck(back) ? 'deck' : 'home', back && deck(back) ? back : null);
}

const clickReorderon = () => { closeMenu(); setReorder(true); prefs.sort = 'manual'; savePrefs(); setAnimate(false); return render(); };

function clickPindeck(a, b, d) {
  /* la même entrée sert depuis l'aperçu et depuis le menu du paquet :
     c'est la feuille ouverte qui dit de quel paquet on parle */
  const t = (menu === 'preview' ? deck(previewOf) : d) || d; if (!t) return;
  t.pinned = !t.pinned; saveDeck(t);
  closeMenu(); setAnimate(false); render();
  return toast(I.pin, t.pinned ? 'Épinglé en haut' : 'Détaché');
}

const clickOpenpeek = () => { const id = previewOf; closeMenu(); return go('deck', id); };

function clickPkHide(t) {
  t.hidden = !t.hidden; saveDeck(t); setAnimate(false); render();
  return toast(t.hidden ? I.eyeoff : I.eye, t.hidden ? 'Masqué' : 'Réaffiché');
}

function clickPkDel(t) {
  pushUndo(t.name, [t.id]);
  db.decks = db.decks.filter(x => x.id !== t.id);
  delete dirty[t.id]; gone.push(t.id); save(); flush();
  setAnimate(false); render();
  return toast(I.trash, 'Livre dans la corbeille', true);
}

function clickPkShare() { if (!friends) friendsPull(); return openMenu('sharepick'); }

function clickPkFind() {
  setDeckOpen(true); setDeckQ(''); setAnimate(false); render();
  return setTimeout(() => { const i = document.getElementById('dq'); if (i) i.focus(); }, 80);
}

function clickPkSplit(t) {
  if (t.cards.length < 4) return toast(I.x, 'Trop court pour être scindé');
  setSplitSize(Math.min(splitSize, t.cards.length - 1)); return openMenu('split');
}

function clickPkPrefix(a) {
  const id = previewOf, t = deck(id); if (!t) return closeMenu();
  closeMenu();
  if (a === 'pkhide') return clickPkHide(t);
  if (a === 'pkdel') return clickPkDel(t);
  go('deck', id);
  if (a === 'pkshare') return clickPkShare();
  if (a === 'pkfind') return clickPkFind();
  if (a === 'pksplit') return clickPkSplit(t);
  if (a === 'pkset') return openMenu('deckset');
}

async function clickRolink(a, b, d) {
  if (!d) return;
  closeMenu();
  try {
    const url = await shareLink(d);
    if (navigator.share) navigator.share({ url }).catch(() => {});
    else await navigator.clipboard.writeText(url);
    toast(I.link, 'Lien de consultation copié');
  } catch (err) { toast(I.x, 'Lien impossible hors ligne'); }
}

async function clickRoff(a, b, d) { if (!d) return; closeMenu(); await revokeShare(d); return toast(I.check, 'Lien coupé'); }
function clickPublish(a, b, d) { if (d) libPublish(d); }
function clickUnpublish(a, b, d) { if (d) libRemove(d); }
function clickDuelnew2(a, b, d) { if (d) duelMake(d); }
function clickVersopen(a, b, d) { if (!d) return; openMenu('vers'); return versPull(d.id); }

async function clickSavehandle() {
  const i = document.getElementById('hq');
  if (await saveHandle(i ? i.value : '')) { closeMenu(); setAnimate(false); render(); }
}

const clickDomake = () => { const i = document.getElementById('gq'); return makeGroup(i ? i.value : ''); };
const clickDojoin = () => { const i = document.getElementById('gq'); return joinGroup(i ? i.value : ''); };

function clickGcode() {
  const g = (groups || []).find(x => x.id === groupOf); if (!g) return;
  const txt = g.code;
  if (navigator.share) navigator.share({ text: `Rejoins « ${g.name} » sur Folio avec le code ${txt}` }).catch(() => {});
  else navigator.clipboard.writeText(txt).then(() => toast(I.check, 'Code copié'), () => {});
}

const clickGleave = () => leaveGroup(groupOf);
const clickMatedrop = () => dropFriend(mateOpen);
const clickMatesend = () => { setSendMsg(''); return openMenu('lend'); };
const clickMateprof = () => { mateProfPull(mateOpen); return openMenu('mateprof'); };
const clickCfmine = () => solveConflict('mine');
const clickCftheirs = () => solveConflict('theirs');
const clickCfboth = () => solveConflict('both');
function clickLibadd() { const it = (lib.list || []).find(x => x.deck_id === lib.open); if (it) libAdd(it); }

function clickLibdrop() {
  const it = (lib.list || []).find(x => x.deck_id === lib.open); const t = it && deck(it.deck_id);
  if (t) libRemove(t);
}

function clickDuelgo() { const du = (duels.list || []).find(x => x.id === duels.open); if (du) duelStart(du); }
const clickDueldrop = () => duelDrop(duels.open);

function clickCopylink(a, b, d) {
  closeMenu();
  const url = location.origin + location.pathname + '#i=' +
    enc({ name: d.name, subject: d.subject, cards: d.cards.map(c => [c.f, c.b]) });
  if (navigator.share) navigator.share({ url }).catch(() => {});
  else navigator.clipboard.writeText(url).then(() => toast(I.check, 'Lien copié'));
}

function clickSendfriend() {
  setSendTo(null); setSendMsg('');
  if (!friends) friendsPull();
  return openMenu('sendfriend');
}

function clickSendmail(a, b, d) {
  const p = (mates || []).find(x => x.id === sendTo); if (!p || !d) return;
  closeMenu();
  return sendDeck(d, p);
}

function clickAddmail() {
  const it = mailbox.list && mailbox.list.find(x => x.id === mailOpen); if (!it) return;
  return addMail(it);
}

const clickDelmail = () => delMail(mailOpen);

function clickDel(a, b, d) {
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

/* Table de dispatch : chaque bouton de feuille porte un attribut `data-*`
   (le plus souvent `data-mact`) qui dit ce qu'il fait. On la parcourt dans
   l'ordre où ces cas étaient déclarés dans la longue chaîne de `if` qu'elle
   remplace (complexité cyclomatique oblige, M06.T6) — l'ordre ne change
   rien en pratique puisqu'un bouton ne porte jamais deux attributs de la
   liste à la fois, mais autant rester fidèle. */
const CLICK_RULES = [
  [(a, b) => b.dataset.dnew !== undefined, clickDnew],
  [(a, b) => b.dataset.copy !== undefined, clickCopy],
  [(a, b) => b.dataset.vers !== undefined, clickVers],
  [(a, b) => b.dataset.chap !== undefined, clickChap],
  [(a, b) => b.dataset.msubj !== undefined, clickMsubj],
  [(a, b) => b.dataset.fside !== undefined, clickFside],
  [(a, b) => b.dataset.friend !== undefined, clickFriendPick],
  [(a, b) => b.dataset.mrange !== undefined, clickMrange],
  [(a, b) => b.dataset.lend !== undefined, clickLend],
  [(a, b) => b.dataset.sortby !== undefined, clickSortby],
  [(a, b) => b.dataset.move !== undefined, clickMove],
  [(a, b) => b.dataset.merge !== undefined, clickMerge],
  [(a, b) => !!b.dataset.tol, clickTol],
  [(a, b) => b.dataset.lgf !== undefined, clickLgf],
  [(a, b) => b.dataset.lgb !== undefined, clickLgb],
  [(a, b) => b.dataset.tm !== undefined, clickTm],
  [(a, b) => b.dataset.ct !== undefined, clickCt],
  [a => a === 'close', clickClose],
  [(a, b) => b.dataset.why !== undefined, clickWhy],
  [(a, b) => b.dataset.unblock !== undefined, clickUnblock],
  [(a, b) => b.dataset.setrole !== undefined, clickSetrole],
  [a => a === 'rsend', clickRsend],
  [a => a === 'rblock', clickRblock],
  [a => a === 'libreport' || a === 'libblock', clickLibReportBlock],
  [a => a === 'mailreport' || a === 'mailblock', clickMailReportBlock],
  [a => a === 'matereport' || a === 'mateblock', clickMateReportBlock],
  [a => a === 'doclass', clickDoClass],
  [a => a === 'doclassjoin', clickDoClassJoin],
  [(a, b) => b.dataset.give !== undefined, clickGive],
  [a => a === 'cadd', clickCadd],
  [a => a === 'cgive', clickCgive],
  [a => a === 'pdefi', clickPdefi],
  [a => a === 'pmotgo', clickPmotgo],
  [a => a === 'prelance', clickPrelance],
  [a => a === 'predonner', clickPredonner],
  [a => a === 'pdel', clickPdel],
  [a => a === 'refsave', clickRefsave],
  [a => a === 'refpw', clickRefpw],
  [a => a === 'refclssave', clickRefclssave],
  [a => a === 'refclsdel', clickRefclsdel],
  [a => a === 'refclsgens', clickRefclsgens],
  [a => a === 'refdonew', clickRefdonew],
  [a => a === 'refdonewclass', clickRefdonewclass],
  [a => a === 'takework', clickTakework],
  [a => a === 'delwork', clickDelwork],
  [a => a === 'dropmember', clickDropmember],
  [a => a === 'instcopy', clickInstcopy],
  [a => a === 'instgo', clickInstgo],
  [a => a === 'instlater', clickClose],
  [a => a === 'card-ok', clickCardOk],
  [a => a && a.startsWith('del-'), clickDelField],
  [a => a === 'rec-stop', clickRecStop],
  [a => a && a.startsWith('med-'), clickMedField],
  [a => a === 'deckset', () => { closeMenu(); return openMenu('deckset'); }],
  [a => a === 'do-simple', () => setSimple(true)],
  [a => a === 'do-engine', () => setSimple(false)],
  [a => a === 'do-rename', clickDoRename],
  [a => a === 'do-pwd', clickDoPwd],
  [a => a === 'do-delacc', clickDoDelacc],
  [(a, b) => !!b.dataset.color, clickColor],
  [a => a === 'studyall' || a === 'studyleech', clickStudyAll],
  [a => a === 'mcq' || a === 'match', clickQuickMode],
  [a => a === 'subjok', clickSubjok],
  [a => a === 'subjdel', clickSubjdel],
  [a => a === 'backup', clickBackup],
  [a => a === 'hide', clickHide],
  [a => a === 'clone', clickClone],
  [a => a === 'undo', clickUndo],
  [a => a === 'fnropen', clickFnropen],
  [a => a === 'fnrcase', clickFnrcase],
  [a => a === 'dofnr', clickDofnr],
  [a => a === 'mergeopen', clickMergeopen],
  [a => a === 'splitopen', clickSplitopen],
  [a => a === 'dosplit', clickDosplit],
  [a => a === 'leavestay', clickLeavestay],
  [a => a === 'leavego', clickLeavego],
  [a => a === 'reorderon', clickReorderon],
  [a => a === 'pindeck', clickPindeck],
  [a => a === 'openpeek', clickOpenpeek],
  [a => a && a.startsWith('pk'), clickPkPrefix],
  [a => a === 'sharepick', clickPkShare],
  [a => a === 'rolink', clickRolink],
  [a => a === 'roff', clickRoff],
  [a => a === 'publish', clickPublish],
  [a => a === 'unpublish', clickUnpublish],
  [a => a === 'duelnew2', clickDuelnew2],
  [a => a === 'versopen', clickVersopen],
  [a => a === 'savehandle', clickSavehandle],
  [a => a === 'domake', clickDomake],
  [a => a === 'dojoin', clickDojoin],
  [a => a === 'gcode', clickGcode],
  [a => a === 'gleave', clickGleave],
  [a => a === 'matedrop', clickMatedrop],
  [a => a === 'matesend', clickMatesend],
  [a => a === 'mateprof', clickMateprof],
  [a => a === 'cfmine', clickCfmine],
  [a => a === 'cftheirs', clickCftheirs],
  [a => a === 'cfboth', clickCfboth],
  [a => a === 'libadd', clickLibadd],
  [a => a === 'libdrop', clickLibdrop],
  [a => a === 'duelgo', clickDuelgo],
  [a => a === 'dueldrop', clickDueldrop],
  [a => a === 'copylink', clickCopylink],
  [a => a === 'sendfriend', clickSendfriend],
  [a => a === 'sendmail', clickSendmail],
  [a => a === 'addmail', clickAddmail],
  [a => a === 'delmail', clickDelmail],
  [a => a === 'del', clickDel]
];

/* Les feuilles vivent sur `document.body`, hors de `#app` : c'est ce
   gestionnaire-ci qui les sert. Lui aussi n'énumérait que des attributs, et
   tout bouton de feuille portant un `data-` absent de la liste restait
   muet. Il attrape maintenant les boutons, comme celui de la page. */
document.addEventListener('click', async e => {
  const b = e.target.closest('button,[data-mact],[data-msubj],[data-color],[data-tol],[data-lgf],[data-lgb],[data-tm],[data-ct],[data-merge],[data-move],[data-fside],[data-friend],[data-sortby],[data-dnew],[data-vers],[data-copy],[data-chap],[data-lend],[data-mrange],[data-why],[data-unblock],[data-give],[data-setrole]');
  if (!b) return;
  if (feuilleTap(b)) return;
  const a = b.dataset.mact;
  const d = deck(view.id);
  for (const [test, run] of CLICK_RULES) {
    if (test(a, b)) return run(a, b, d);
  }
});

/* Bascule du moteur. Une seule porte d'entrée, pour que rien ne traverse
   la frontière : la file en cours, la note en attente et la reprise
   sauvegardée appartiennent au mode qui les a créées. */
function setSimple(on) {
  closeMenu();
  setStudy(null); setPendingGrade(null);
  try { localStorage.removeItem('cartes.resume.' + auth.uid); } catch (e) { /* stockage indisponible : rien à nettoyer alors */ }
  const days = (!on && prefs.simple) ? spreadBacklog() : 0;   // rallumage : on étale l'arriéré
  prefs.simple = !!on;
  prefs.simpleAt = on ? Date.now() : 0;
  save(); savePrefs();
  if (view.name === 'study') setView({ name: 'home' });
  render();
  toast(on ? I.swap : I.brain, on ? 'Mode simple'
    : days > 1 ? `Moteur rallumé · rattrapage sur ${days} jours` : 'Moteur rallumé');
}
