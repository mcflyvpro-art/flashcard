// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { I, svg } from '../icones.js';
import { SITE } from '../adresse.js';
import {
  auth, cardEdit, db, dirty, duels, fnr, friends, gone,
  leaving, mailOpen, mailbox, mateOpen, mateProf, mates,
  menu, prefs, previewOf, quiz, recKey, recorder, reportOn, sel, sendTo,
  setAnimate, setDeckOpen, setDeckQ, setLeaving,
  setPendingGrade, setQuiz, setRecKey, setReorder, setReportWhy, setSel, setSendMsg,
  setSendTo, setSplitSize, setStudy, setSubjColor, splitSize, study, demo, subjColor,
  subjEdit, subjName, view
} from '../data/etat.js';
import { go, render } from './bibliotheque.js';
import {
  REC, enc, pickFile, recStart, recStop, upErr
} from './carte-media.js';
import { upload } from '../core/carte-media.js';
import { openReport } from './classement.js';
import {
  blockUser, sendReport, unblockUser
} from '../core/classement.js';
import { trouverParNom } from '../matieres.js';
import {
  deck, delSubject, doUndo, esc, flush, plur, pushSubject, pushUndo, save, saveDeck,
  setMeta, slugify, solveConflict, subj
} from '../core/coeur-sync.js';
import { PWMIN } from './connexion.js';
import { duelStart } from './defis.js';
import { duelDrop } from '../core/defis.js';
import { ouvrirDefi } from './defi-nouveau.js';
import {
  cloneDeck, fnrApply, mergeDecks, savePrefs, splitDeck, spreadBacklog, toast
} from './import-cartes.js';
import { closeMenu, mountMenu, openMenu, paintMenu, vientDOuvrir } from './menus-a.js';
import { changePassword, deleteAccount, mateProfPull } from '../core/menus-c.js';
import { copyLink, doPrompt, logout, startTour } from './onboarding.js';
import { versRestore } from './reglages-corbeille.js';
import {
  addMail, backupData, backupRestore, delMail, dropFriend, lireSauvegarde
} from '../core/reglages-corbeille.js';
import {
  friendsPull, revokeShare, sendDeck, shareLink, versPull
} from '../core/reglages-corbeille.js';
import { startStudy } from './revision.js';

/* Fermer la feuille de partage sans choisir rejette la promesse (AbortError) :
   c'est un « non merci », pas une erreur à remonter. */
const partager = o => navigator.share(o).catch(() => {});

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

function clickCopy(a, b) {
  const url = b.dataset.copy;
  if (navigator.share) partager({ url });
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

const clickClose = (a, b) => { if (!(b.classList.contains('scrim') && vientDOuvrir())) closeMenu(); };
function clickWhy(a, b) { setReportWhy(b.dataset.why); return paintMenu(); }
const clickUnblock = (a, b) => unblockUser(b.dataset.unblock);
const clickRsend = () => sendReport();
function clickRblock() { const r = reportOn; if (r && r.user) return blockUser(r.user, r.label); }

/* Le signalement emporte une copie : ce qu'on voit à l'écran est ce qui
   part, et effacer ensuite ne l'efface pas. */
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
  return startStudy(view.id, false, null, a === 'studyleech' ? { only: 'leech' } : { tout: true });
}

function clickQuickMode(a) {
  closeMenu();
  return startStudy(view.id, false, null, { mode: a });
}

/* Deux matières du même nom (à la casse et aux accents près) seraient deux
   pastilles identiques dans la bibliothèque, et une seule dans le journal :
   on n'en crée pas une seconde, on ne renomme pas l'une comme l'autre. */
function clickSubjok() {
  const name = (document.getElementById('sn').value || subjName).trim();
  if (!name) return;
  const meme = trouverParNom(db.subjects, name);
  if (meme && meme.id !== subjEdit) {
    if (subjEdit) return toast(I.x, '« ' + meme.name + ' » existe déjà');
    closeMenu(); return render();
  }
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
  const url = SITE + '#i=' + enc(db.decks.map(x =>
    ({ key: x.key || x.id, name: x.name, subject: x.subject, sn: x.subject ? subj(x.subject).name : '', cards: x.cards.map(c => [c.f, c.b]) })));
  if (navigator.share) partager({ url });
  else navigator.clipboard.writeText(url).then(() => toast(I.check, 'Sauvegarde copiée'));
}

/* M04.T6 : le fichier complet, état d'apprentissage compris — le lien
   ci-dessus ne garde que recto et verso. */
async function clickBackupFile() {
  closeMenu();
  const blob = new Blob([JSON.stringify(await backupData())], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'folio-bibliotheque-' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast(I.check, 'Bibliothèque exportée');
}

function clickBackupRestore() {
  closeMenu();
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'application/json,.json';
  inp.onchange = async () => {
    const f = inp.files && inp.files[0]; if (!f) return;
    let txt;
    try { txt = await f.text(); } catch (e) { return toast(I.x, 'Fichier illisible'); }
    const r = await lireSauvegarde(txt);
    if (!r.ok) return toast(I.x, r.error);
    const done = await backupRestore(r.data);
    toast(I.check, plur(done.decks.length, 'paquet') + ' restauré' + (done.decks.length > 1 ? 's' : ''), true);
  };
  inp.click();
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
    if (navigator.share) partager({ url });
    else await navigator.clipboard.writeText(url);
    toast(I.link, 'Lien de consultation copié');
  } catch (err) { toast(I.x, 'Lien impossible hors ligne'); }
}

async function clickRoff(a, b, d) { if (!d) return; closeMenu(); await revokeShare(d); return toast(I.check, 'Lien coupé'); }
/* « Lancer un défi » depuis un livre : l'écran du défi, ce livre déjà choisi. */
function clickDuelnew2(a, b, d) { if (!d) return; closeMenu(); ouvrirDefi({ livre: d.id, retour: { name: 'deck', id: d.id } }); }
const clickMatedefi = () => { closeMenu(); ouvrirDefi({ ou: 'amis', mode: 'rythme', retour: { name: view.name, id: view.id } }); };
function clickVersopen(a, b, d) { if (!d) return; openMenu('vers'); return versPull(d.id); }

const clickMatedrop = () => dropFriend(mateOpen);
const clickMatesend = () => { setSendMsg(''); return openMenu('lend'); };
const clickMateprof = () => { mateProfPull(mateOpen); return openMenu('mateprof'); };
const clickCfmine = () => solveConflict('mine');
const clickCftheirs = () => solveConflict('theirs');
const clickCfboth = () => solveConflict('both');
function clickDuelgo() { const du = (duels.list || []).find(x => x.id === duels.open); if (du) duelStart(du); }
const clickDueldrop = () => duelDrop(duels.open);

function clickCopylink(a, b, d) {
  closeMenu();
  const url = SITE + '#i=' +
    enc({ name: d.name, subject: d.subject, sn: d.subject ? subj(d.subject).name : '', cards: d.cards.map(c => [c.f, c.b]) });
  if (navigator.share) partager({ url });
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
  [a => a === 'rsend', clickRsend],
  [a => a === 'rblock', clickRblock],
  [a => a === 'mailreport' || a === 'mailblock', clickMailReportBlock],
  [a => a === 'matereport' || a === 'mateblock', clickMateReportBlock],
  [a => a === 'instcopy', clickInstcopy],
  [a => a === 'instgo', clickInstgo],
  [a => a === 'instlater', clickClose],
  [a => a === 'card-ok', clickCardOk],
  [a => a && a.startsWith('del-'), clickDelField],
  [a => a === 'rec-stop', clickRecStop],
  [a => a && a.startsWith('med-'), clickMedField],
  [a => a === 'deckset', () => { closeMenu(); return openMenu('deckset'); }],
  [a => a === 'do-rename', clickDoRename],
  [a => a === 'do-pwd', clickDoPwd],
  [a => a === 'do-delacc', clickDoDelacc],
  [(a, b) => !!b.dataset.color, clickColor],
  [a => a === 'studyall' || a === 'studyleech', clickStudyAll],
  [a => a === 'mcq' || a === 'match', clickQuickMode],
  [a => a === 'subjok', clickSubjok],
  [a => a === 'subjdel', clickSubjdel],
  [a => a === 'backup', clickBackup],
  [a => a === 'backup-file', clickBackupFile],
  [a => a === 'backup-restore', clickBackupRestore],
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
  [a => a === 'duelnew2', clickDuelnew2],
  [a => a === 'versopen', clickVersopen],
  [a => a === 'matedrop', clickMatedrop],
  [a => a === 'matesend', clickMatesend],
  [a => a === 'matedefi', clickMatedefi],
  [a => a === 'mateprof', clickMateprof],
  [a => a === 'cfmine', clickCfmine],
  [a => a === 'cftheirs', clickCftheirs],
  [a => a === 'cfboth', clickCfboth],
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
  const b = e.target.closest('button,[data-mact],[data-msubj],[data-color],[data-tol],[data-lgf],[data-lgb],[data-tm],[data-ct],[data-merge],[data-move],[data-fside],[data-friend],[data-sortby],[data-vers],[data-copy],[data-chap],[data-lend],[data-mrange],[data-why],[data-unblock]');
  if (!b) return;
  const a = b.dataset.mact;
  const d = deck(view.id);
  for (const [test, run] of CLICK_RULES) {
    if (test(a, b)) return run(a, b, d);
  }
});

/* Le mode simple n'est plus proposé (2026-10-25) : la révision est figée
   sur le moteur, réglé comme Anki. Un compte qui l'avait gardé allumé
   retrouve le moteur au démarrage, une fois : l'arriéré est étalé sur ses
   prochains jours, la reprise sauvegardée (qui appartenait à l'autre mode)
   part. Jamais pendant une séance : pas de bascule à chaud. */
export function rallumerMoteur() {
  if (!prefs.simple || study || demo) return;
  setPendingGrade(null);
  try { localStorage.removeItem('cartes.resume.' + auth.uid); } catch (e) { /* stockage indisponible : rien à nettoyer alors */ }
  const days = spreadBacklog();
  prefs.simple = false;
  prefs.simpleAt = 0;
  save(); savePrefs();
  if (days > 1) toast(I.brain, `Moteur rallumé · rattrapage sur ${days} jours`);
}
