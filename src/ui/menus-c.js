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

/* Les feuilles vivent sur `document.body`, hors de `#app` : c'est ce
   gestionnaire-ci qui les sert. Lui aussi n'énumérait que des attributs, et
   tout bouton de feuille portant un `data-` absent de la liste restait
   muet. Il attrape maintenant les boutons, comme celui de la page. */
document.addEventListener('click', async e => {
  const b = e.target.closest('button,[data-mact],[data-msubj],[data-color],[data-tol],[data-lgf],[data-lgb],[data-tm],[data-ct],[data-merge],[data-move],[data-fside],[data-friend],[data-sortby],[data-dnew],[data-vers],[data-copy],[data-chap],[data-lend],[data-mrange],[data-why],[data-unblock],[data-give],[data-setrole]');
  if (!b) return;
  if (feuilleTap(b)) return;
  const d = deck(view.id);
  if (b.dataset.dnew !== undefined) { const t = deck(b.dataset.dnew); if (t) duelMake(t); return; }
  if (b.dataset.copy !== undefined) {
    const url = b.dataset.copy;
    if (navigator.share) navigator.share({ url }).catch(() => {});
    else navigator.clipboard.writeText(url).then(() => toast(I.check, 'Adresse copiée'),
                                                 () => toast(I.x, 'Copie impossible'));
    return;
  }
  if (b.dataset.vers !== undefined) return versRestore(+b.dataset.vers);
  if (b.dataset.chap !== undefined) { closeMenu(); return startTour(b.dataset.chap || null); }
  if (b.dataset.msubj !== undefined) { d.subject = b.dataset.msubj; saveDeck(d); render(); return; }
  if (b.dataset.fside !== undefined) { fnr.side = b.dataset.fside; return paintMenu(); }
  if (b.dataset.friend !== undefined) { setSendTo(b.dataset.friend); return paintMenu(); }
  if (b.dataset.mrange !== undefined) {
    mateProf.range = +b.dataset.mrange; mateProf.row = null;
    paintMenu(); return mateProfPull(mateOpen);
  }
  if (b.dataset.lend !== undefined) {
    const bk = deck(b.dataset.lend), f = (mates || []).find(x => x.id === mateOpen);
    if (!bk || !f) return;
    closeMenu();
    return sendDeck(bk, { id: f.id, name: f.name || ('@' + (f.handle || '')) });
  }
  if (b.dataset.sortby !== undefined) {
    prefs.sort = b.dataset.sortby; savePrefs();
    closeMenu(); setAnimate(false); return render();
  }
  if (b.dataset.move !== undefined) {
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
  if (b.dataset.merge !== undefined) {
    const src = deck(b.dataset.merge); if (!src || !d) return;
    const r = mergeDecks(d, src);
    closeMenu(); render();
    return toast(I.link, r.added + ' carte' + (r.added > 1 ? 's' : '') + ' ajoutée'
      + (r.added > 1 ? 's' : '') + (r.skipped ? ' · ' + r.skipped + ' en double ignorée' + (r.skipped > 1 ? 's' : '') : ''), true);
  }
  /* réglages propres au paquet, dans leur feuille */
  if (b.dataset.tol) { setMeta(d, { tol: b.dataset.tol }); return paintMenu(); }
  if (b.dataset.lgf !== undefined) { setMeta(d, { langf: b.dataset.lgf }); return paintMenu(); }
  if (b.dataset.lgb !== undefined) { setMeta(d, { langb: b.dataset.lgb }); return paintMenu(); }
  if (b.dataset.tm !== undefined) { setMeta(d, { timer: +b.dataset.tm }); return paintMenu(); }
  if (b.dataset.ct !== undefined) {
    const c = d && d.cards.find(x => x.id === cardEdit);
    if (c) { if (b.dataset.ct) c.t = b.dataset.ct; else delete c.t; saveDeck(d); }
    return paintMenu();
  }
  const a = b.dataset.mact;
  if (a === 'close') return closeMenu();
  if (b.dataset.why !== undefined) { setReportWhy(b.dataset.why); return paintMenu(); }
  if (b.dataset.unblock !== undefined) return unblockUser(b.dataset.unblock);
  if (b.dataset.setrole !== undefined) return setRole(b.dataset.who, b.dataset.setrole);
  if (a === 'rsend') return sendReport();
  if (a === 'rblock') { const r = reportOn; if (r && r.user) return blockUser(r.user, r.label); return; }
  /* Le signalement emporte une copie : ce qu'on voit à l'écran est ce qui
     part, et effacer ensuite ne l'efface pas. */
  if (a === 'libreport' || a === 'libblock') {
    const it = (lib.list || []).find(x => x.deck_id === lib.open); if (!it) return;
    if (a === 'libblock') return blockUser(it.user_id, it.who);
    return openReport('library', it.deck_id, it.user_id, it.name,
      { nom: it.name, qui: it.who, matiere: it.subject, cartes: (it.cards || []).slice(0, 40) });
  }
  if (a === 'mailreport' || a === 'mailblock') {
    const it = mailbox.list && mailbox.list.find(x => x.id === mailOpen); if (!it) return;
    if (a === 'mailblock') return blockUser(it.from_user, it.from_name);
    return openReport('mail', it.id, it.from_user, it.deck_name,
      { nom: it.deck_name, qui: it.from_name, message: it.message, cartes: (it.cards || []).slice(0, 40) });
  }
  if (a === 'matereport' || a === 'mateblock') {
    const f = (mates || []).find(x => x.id === mateOpen); if (!f) return;
    if (a === 'mateblock') return blockUser(f.id, f.name || f.handle);
    return openReport('profile', f.id, f.id, f.name || ('@' + (f.handle || '')),
      { pseudo: f.handle, nom: f.name });
  }
  if (a === 'doclass') {
    const n = (document.getElementById('cn') || {}).value || '';
    const l = (document.getElementById('cl') || {}).value || '';
    return makeClass(n, l);
  }
  if (a === 'doclassjoin') {
    const v = ((document.getElementById('cn') || {}).value || '').trim();
    if (v) return joinClass(v);
    return;
  }
  if (b.dataset.give !== undefined) {
    const d = deck(b.dataset.give);
    if (d && classOf) return giveWork(d, classOf, 7);
    return;
  }
  /* ---- le composeur et la feuille d'un devoir ---- */
  if (a === 'cadd') {
    if (!prof.comp) return;
    lireComp();
    const f = prof.comp.recto.trim(), b = prof.comp.verso.trim();
    if (!f || !b) return toast(I.x, 'Il faut un recto et un verso');
    prof.comp.cartes.push([f, b]);
    prof.comp.recto = ''; prof.comp.verso = '';
    paintMenu();
    setTimeout(() => { const n = document.getElementById('crec'); if (n) n.focus(); }, 40);
    return;
  }
  if (a === 'cgive') return compDonner();
  if (a === 'pdefi') {
    const d = (prof.devoirs || []).find(x => x.id === prof.work);
    if (d) duelClasse(d.id, d.nom);
    return;
  }
  if (a === 'pmotgo') {
    const t = ((document.getElementById('pmt') || {}).value || '').trim();
    if (!t) return toast(I.x, 'Écris ton message');
    const m = (prof.roster || []).find(x => x.user_id === prof.eleve);
    sendMotProf(prof.eleve, t)
      .then(() => { closeMenu(); render();
        toast(I.check, 'Mot envoyé à ' + (m ? m.who.split(' ')[0] : 'l’élève')); },
            () => toast(I.x, 'Envoi impossible'));
    return;
  }
  if (a === 'prelance') {
    return profDo('prof_relance', { aid: prof.work, mot: '' },
      r => r ? plur(r, 'élève') + ' relancé' + (r > 1 ? 's' : '') : 'Personne à relancer')
      .then(() => { closeMenu(); render(); });
  }
  if (a === 'predonner') {
    const d = (prof.devoirs || []).find(x => x.id === prof.work);
    if (!d) return;
    /* Redonner, c'est repartir du composeur avec tout de prérempli : le
       professeur n'a plus qu'à cocher les classes. Les cartes viennent du
       devoir lui-même, pas d'une bibliothèque où elles ne sont peut-être
       plus. */
    profCartesDeDevoir(d);
    return;
  }
  if (a === 'pdel') {
    return profDo('prof_del_work', { aid: prof.work }, 'Devoir retiré')
      .then(() => { closeMenu(); render(); });
  }
  /* ---- écritures du référent ---- */
  if (a === 'refsave') {
    if (!ref.who) return;
    const v = id => ((document.getElementById(id) || {}).value || '').trim();
    return refDo('ref_update_account',
      { cible: ref.who.id, nom: v('fnom'), pseudo: v('fpse'), adresse: v('fmel') },
      'Identité enregistrée').then(() => { closeMenu(); render(); });
  }
  if (a === 'refpw') {
    if (!ref.who) return;
    const pw = ((document.getElementById('fpw') || {}).value || '').trim();
    if (pw.length < 10) return toast(I.x, 'Au moins dix caractères');
    return refDo('ref_set_password', { cible: ref.who.id, pw },
      'Mot de passe refait · ' + pw).then(() => { ref.form = {}; paintMenu(); });
  }
  if (a === 'refclssave') {
    const f = lireClass();
    /* Le cycle ne se modifie pas ici — il n'y a pas de champ pour lui — mais
       `ref_save_class` réécrit toute la ligne : le lui taire l'effacerait. */
    const c = (ref.classes || []).find(x => x.id === ref.open) || {};
    return refDo('ref_save_class',
      { cid: ref.open, nom: f.nom, niveau: f.niv, cycle: c.cycle || '', filiere: f.fil,
        prevu: f.pre ? +f.pre : null }, 'Classe enregistrée')
      .then(() => { closeMenu(); render(); });
  }
  if (a === 'refclsdel') {
    return refDo('ref_delete_class', { cid: ref.open }, 'Classe supprimée')
      .then(r => { if (r !== null) { closeMenu(); render(); } });
  }
  if (a === 'refclsgens') {
    ref.cls = ref.open; ref.tab = 'gens'; ref.role = ''; ref.q = '';
    refPeople(true); closeMenu(); setAnimate(false); return render();
  }
  if (a === 'refdonew') {
    const f = { ...(ref.form || {}), ...lireNew() };
    ref.form = f;
    if ((f.pw || '').length < 10) return toast(I.x, 'Au moins dix caractères');
    return refDo('ref_new_account',
      { adresse: f.mel || '', nom: f.nom || '', pseudo: f.pse || '',
        qrole: f.role || 'eleve', cid: (f.role || 'eleve') === 'eleve' ? (f.cls || null) : null,
        pw: f.pw || '' }, 'Compte ouvert · ' + (f.mel || ''))
      .then(r => { if (r) { ref.form = {}; closeMenu(); render(); } });
  }
  if (a === 'refdonewclass') {
    const f = { ...(ref.form || {}), ...lireClass() };
    ref.form = f;
    return refDo('ref_save_class',
      { cid: null, nom: f.nom || '', niveau: f.niv || '', cycle: f.cyc || '',
        filiere: f.fil || '', prevu: f.pre ? +f.pre : null }, 'Classe créée')
      .then(r => { if (r) { ref.form = {}; closeMenu(); render(); } });
  }
  if (a === 'takework') {
    const x = (asgs || []).find(y => y.id === workOpen);
    if (x) return takeWork(x);
    return;
  }
  if (a === 'delwork') {
    const id = workOpen; closeMenu();
    deleteAssignment(id)
      .then(() => { setAsgs((asgs || []).filter(x => x.id !== id)); render(); toast(I.check, 'Devoir retiré'); },
            () => toast(I.x, 'Impossible pour l’instant'));
    return;
  }
  if (a === 'dropmember') { if (classOf && memberOpen) return dropMember(classOf, memberOpen); return; }
  if (a === 'instcopy') return copyLink();
  if (a === 'instgo') return doPrompt();
  if (a === 'instlater') return closeMenu();
  if (a === 'card-ok') {
    const d = deck(view.id), c = d && d.cards.find(x => x.id === cardEdit);
    const t = document.getElementById('ctags');
    if (c && t) {
      const tags = t.value.split(',').map(x => x.trim()).filter(Boolean).slice(0, 6);
      if (tags.length) c.g = tags; else delete c.g;
      saveDeck(d);
    }
    closeMenu(); return render();
  }
  if (a && a.startsWith('del-')) {
    const d = deck(view.id), c = d && d.cards.find(x => x.id === cardEdit);
    if (c) { delete c[a.slice(4)]; saveDeck(d); }
    return paintMenu();
  }
  if (a === 'rec-stop') {
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
  if (a && a.startsWith('med-')) {
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
  if (a === 'deckset') { closeMenu(); return openMenu('deckset'); }
  if (a === 'do-simple') return setSimple(true);
  if (a === 'do-engine') return setSimple(false);
  if (a === 'do-rename') {
    prefs.name = document.getElementById('fld').value.trim(); savePrefs();
    closeMenu(); render(); toast(I.check, 'Nom enregistré'); return;
  }
  if (a === 'do-pwd') {
    const v = document.getElementById('fld').value, err = document.getElementById('mrr');
    if (v.length < PWMIN) { err.textContent = `Au moins ${PWMIN} caractères`; return; }
    err.textContent = 'Envoi…';
    changePassword(v)
      .then(() => { closeMenu(); toast(I.check, 'Mot de passe changé'); })
      .catch(() => { err.textContent = 'Changement impossible'; });
    return;
  }
  if (a === 'do-delacc') {
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
    return;
  }
  if (b.dataset.color) { setSubjColor(b.dataset.color); return paintMenu(); }
  if (a === 'studyall' || a === 'studyleech') {
    closeMenu();
    return startStudy(view.id, false, null, a === 'studyleech' ? { only: 'leech' } : {});
  }
  if (a === 'mcq' || a === 'match') {
    closeMenu();
    return startStudy(view.id, false, null, { mode: a });
  }
  if (a === 'subjok') {
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
  if (a === 'subjdel') {
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
  if (a === 'backup') {
    closeMenu();
    const url = location.origin + location.pathname + '#i=' + enc(db.decks.map(x =>
      ({ key: x.key || x.id, name: x.name, subject: x.subject, cards: x.cards.map(c => [c.f, c.b]) })));
    if (navigator.share) navigator.share({ url }).catch(() => {});
    else navigator.clipboard.writeText(url).then(() => toast(I.check, 'Sauvegarde copiée'));
    return;
  }
  if (a === 'hide') { d.hidden = !d.hidden; saveDeck(d); closeMenu(); render(); toast(d.hidden ? I.eyeoff : I.eye); return; }
  if (a === 'clone') {
    const n = cloneDeck(d); closeMenu(); go('deck', n.id);
    return toast(I.copy, n.cards.length + ' carte' + (n.cards.length > 1 ? 's' : '') + ' dupliquée' + (n.cards.length > 1 ? 's' : ''), true);
  }
  if (a === 'undo') { closeMenu(); doUndo(); return; }
  if (a === 'fnropen') { fnr.q = ''; fnr.r = ''; return openMenu('fnr'); }
  if (a === 'fnrcase') { fnr.cs = !fnr.cs; return paintMenu(); }
  if (a === 'dofnr') {
    const n = fnrApply(d);
    closeMenu(); render();
    return n ? toast(I.check, n + ' remplacement' + (n > 1 ? 's' : ''), true) : toast(I.x, 'Rien à remplacer');
  }
  if (a === 'mergeopen') return openMenu('merge');
  if (a === 'splitopen') { setSplitSize(Math.min(splitSize, d.cards.length - 1)); return openMenu('split'); }
  if (a === 'dosplit') {
    const made = splitDeck(d, Math.min(Math.max(2, splitSize), d.cards.length - 1));
    closeMenu();
    if (!made) return toast(I.split, 'Rien à scinder');
    go('home');
    return toast(I.split, made.length + ' livres créés', true);
  }
  if (a === 'leavestay') { setLeaving(null); return closeMenu(); }
  if (a === 'leavego') {
    const act = leaving; setLeaving(null); closeMenu();
    setQuiz(null); setStudy(study && study.mode ? null : study);
    const back = act === 'quitquiz' ? (quiz && quiz.id) : act === 'deck' ? view.id : null;
    if (act === 'quitquiz') setQuiz(null);
    return go(back && deck(back) ? 'deck' : 'home', back && deck(back) ? back : null);
  }
  if (a === 'reorderon') { closeMenu(); setReorder(true); prefs.sort = 'manual'; savePrefs(); setAnimate(false); return render(); }
  if (a === 'pindeck') {
    /* la même entrée sert depuis l'aperçu et depuis le menu du paquet :
       c'est la feuille ouverte qui dit de quel paquet on parle */
    const t = (menu === 'preview' ? deck(previewOf) : d) || d; if (!t) return;
    t.pinned = !t.pinned; saveDeck(t);
    closeMenu(); setAnimate(false); render();
    return toast(I.pin, t.pinned ? 'Épinglé en haut' : 'Détaché');
  }
  if (a === 'openpeek') { const id = previewOf; closeMenu(); return go('deck', id); }
  if (a && a.startsWith('pk')) {
    const id = previewOf, t = deck(id); if (!t) return closeMenu();
    closeMenu();
    if (a === 'pkhide') { t.hidden = !t.hidden; saveDeck(t); setAnimate(false); render();
      return toast(t.hidden ? I.eyeoff : I.eye, t.hidden ? 'Masqué' : 'Réaffiché'); }
    if (a === 'pkdel') {
      pushUndo(t.name, [t.id]);
      db.decks = db.decks.filter(x => x.id !== t.id);
      delete dirty[t.id]; gone.push(t.id); save(); flush();
      setAnimate(false); render();
      return toast(I.trash, 'Livre dans la corbeille', true);
    }
    go('deck', id);
    if (a === 'pkshare') { if (!friends) friendsPull(); return openMenu('sharepick'); }
    if (a === 'pkfind') { setDeckOpen(true); setDeckQ(''); setAnimate(false); render();
      return setTimeout(() => { const i = document.getElementById('dq'); if (i) i.focus(); }, 80); }
    if (a === 'pksplit') { if (t.cards.length < 4) return toast(I.x, 'Trop court pour être scindé');
      setSplitSize(Math.min(splitSize, t.cards.length - 1)); return openMenu('split'); }
    if (a === 'pkset') return openMenu('deckset');
    return;
  }
  if (a === 'sharepick') { if (!friends) friendsPull(); return openMenu('sharepick'); }
  if (a === 'rolink') {
    if (!d) return;
    closeMenu();
    try {
      const url = await shareLink(d);
      if (navigator.share) navigator.share({ url }).catch(() => {});
      else await navigator.clipboard.writeText(url);
      toast(I.link, 'Lien de consultation copié');
    } catch (err) { toast(I.x, 'Lien impossible hors ligne'); }
    return;
  }
  if (a === 'roff') { if (!d) return; closeMenu(); await revokeShare(d); return toast(I.check, 'Lien coupé'); }
  if (a === 'publish') { if (d) libPublish(d); return; }
  if (a === 'unpublish') { if (d) libRemove(d); return; }
  if (a === 'duelnew2') { if (d) duelMake(d); return; }
  if (a === 'versopen') { if (!d) return; openMenu('vers'); return versPull(d.id); }
  if (a === 'savehandle') {
    const i = document.getElementById('hq');
    if (await saveHandle(i ? i.value : '')) { closeMenu(); setAnimate(false); render(); }
    return;
  }
  if (a === 'domake') { const i = document.getElementById('gq'); return makeGroup(i ? i.value : ''); }
  if (a === 'dojoin') { const i = document.getElementById('gq'); return joinGroup(i ? i.value : ''); }
  if (a === 'gcode') {
    const g = (groups || []).find(x => x.id === groupOf); if (!g) return;
    const txt = g.code;
    if (navigator.share) navigator.share({ text: `Rejoins « ${g.name} » sur Folio avec le code ${txt}` }).catch(() => {});
    else navigator.clipboard.writeText(txt).then(() => toast(I.check, 'Code copié'), () => {});
    return;
  }
  if (a === 'gleave') { return leaveGroup(groupOf); }
  if (a === 'matedrop') { return dropFriend(mateOpen); }
  if (a === 'matesend') { setSendMsg(''); return openMenu('lend'); }
  if (a === 'mateprof') { mateProfPull(mateOpen); return openMenu('mateprof'); }
  if (a === 'cfmine') return solveConflict('mine');
  if (a === 'cftheirs') return solveConflict('theirs');
  if (a === 'cfboth') return solveConflict('both');
  if (a === 'libadd') { const it = (lib.list || []).find(x => x.deck_id === lib.open); if (it) libAdd(it); return; }
  if (a === 'libdrop') { const it = (lib.list || []).find(x => x.deck_id === lib.open); const t = it && deck(it.deck_id); if (t) libRemove(t); return; }
  if (a === 'duelgo') { const du = (duels.list || []).find(x => x.id === duels.open); if (du) duelStart(du); return; }
  if (a === 'dueldrop') { return duelDrop(duels.open); }
  if (a === 'copylink') {
    closeMenu();
    const url = location.origin + location.pathname + '#i=' +
      enc({ name: d.name, subject: d.subject, cards: d.cards.map(c => [c.f, c.b]) });
    if (navigator.share) navigator.share({ url }).catch(() => {});
    else navigator.clipboard.writeText(url).then(() => toast(I.check, 'Lien copié'));
    return;
  }
  if (a === 'sendfriend') {
    setSendTo(null); setSendMsg('');
    if (!friends) friendsPull();
    return openMenu('sendfriend');
  }
  if (a === 'sendmail') {
    const p = (mates || []).find(x => x.id === sendTo); if (!p || !d) return;
    closeMenu();
    return sendDeck(d, p);
  }
  if (a === 'addmail') {
    const it = mailbox.list && mailbox.list.find(x => x.id === mailOpen); if (!it) return;
    return addMail(it);
  }
  if (a === 'delmail') return delMail(mailOpen);
  if (a === 'del') {
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
});

/* Bascule du moteur. Une seule porte d'entrée, pour que rien ne traverse
   la frontière : la file en cours, la note en attente et la reprise
   sauvegardée appartiennent au mode qui les a créées. */
function setSimple(on) {
  closeMenu();
  setStudy(null); setPendingGrade(null);
  try { localStorage.removeItem('cartes.resume.' + auth.uid); } catch (e) {}
  const days = (!on && prefs.simple) ? spreadBacklog() : 0;   // rallumage : on étale l'arriéré
  prefs.simple = !!on;
  prefs.simpleAt = on ? Date.now() : 0;
  save(); savePrefs();
  if (view.name === 'study') setView({ name: 'home' });
  render();
  toast(on ? I.swap : I.brain, on ? 'Mode simple'
    : days > 1 ? `Moteur rallumé · rattrapage sur ${days} jours` : 'Moteur rallumé');
}
