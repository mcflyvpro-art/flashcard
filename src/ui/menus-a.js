// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { I, svg } from '../icones.js';
import { isLeech } from '../file.js';
import {
  asgs, auth, classOf, classes, db, memberOpen, menu, prof, ref, roster, setMenu,
  setSubjName, subjColor, subjEdit, subjName, view, workOpen
} from '../data/etat.js';
import { render } from './bibliotheque.js';
import { compSheet, initial, workSheet } from './bilan-devoirs.js';
import { paintMedia } from './carte-media.js';
import {
  accountSheet, blockedSheet, dueLabel, reportSheet
} from './classement.js';
import { ROLENOM, refService, refTeam, workProgress } from '../core/classement.js';
import { COLORS, PALETTE, canUndo, deck, esc, live, plur, subj, undoLabel } from '../core/coeur-sync.js';
import { CYCLES } from './etablissement.js';
import {
  paintMenuCard, paintMenuConflict, paintMenuDeckset, paintMenuDuelitem, paintMenuDuelnew,
  paintMenuFnr, paintMenuGroupitem, paintMenuHandle, paintMenuHelp, paintMenuLeave,
  paintMenuLend, paintMenuLibitem, paintMenuMailitem, paintMenuMate, paintMenuMateprof,
  paintMenuMerge, paintMenuMove, paintMenuNewgroup, paintMenuPreview, paintMenuSendfriend,
  paintMenuSharepick, paintMenuSimple, paintMenuSortpick, paintMenuSplit, paintMenuTuto,
  paintMenuVers
} from './menus-b.js';
import { paintMenuRename } from './menus-c.js';
import { installSheet } from './onboarding.js';
import { timeAgo } from './reglages-corbeille.js';

/* ---------- menu contextuel ---------- */
export function openMenu(kind) { setMenu(kind); paintMenu(); }

export function closeMenu() {
  setMenu(null);
  document.querySelectorAll('.scrim,.menu').forEach(n => n.remove());
  document.documentElement.classList.remove('sheet-open');
}

/* Une feuille peut porter beaucoup de contenu (les matières, la liste
   des paquets à fusionner…) : plus que l'écran n'en montre d'un coup.
   Elle défile donc sur elle-même — poignée et croix restent fixes en
   tête, toujours à portée, et le reste du texte qui suit prend la place
   qu'il lui faut sans jamais entraîner l'écran de dessous. */
export function mountMenu(w) {
  const box = w.querySelector('.menu');
  if (box) {
    /* Une feuille flotte au-dessus de la page, mais la page en dessous
       reste le vrai document qui défile : sans le geler, un doigt posé
       sur la feuille — ou sur le voile autour d'elle, dès qu'il n'y a
       rien à faire défiler à cet endroit précis — continuait de faire
       glisser tout l'écran derrière. */
    document.documentElement.classList.add('sheet-open');
    const body = document.createElement('div');
    body.className = 'mbody';
    while (box.firstChild) body.appendChild(box.firstChild);
    box.insertAdjacentHTML('afterbegin',
      `<div class="mtop"><i class="mgrip"></i><button class="mx" data-mact="close" aria-label="Fermer">${svg(I.x)}</button></div>`);
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.appendChild(body);
    bindSheetDrag(box, body);
  }
  document.body.append(...w.childNodes);
  paintMedia();               // l'aperçu d'image de la feuille d'édition
}

/* Tirer la feuille vers le bas la ferme, comme partout ailleurs sur un
   téléphone. Sans ça, une feuille courte — une explication, un code —
   n'avait aucune réponse au geste : on tirait et il ne se passait rien.
   Le geste ne prend la main que si le contenu est déjà en haut, sinon
   c'est le texte qui doit défiler. */
function bindSheetDrag(box, body) {
  const head = box.querySelector('.mtop');
  let y0 = 0, dy = 0, on = false, lock = 0, t0 = 0, pid = -1, pts = 0;
  /* Un seul doigt, et seulement vers le bas. Sans ces deux gardes, la
     feuille suivait n'importe quel geste — deux doigts la déplaçaient et
     la pinçaient comme une image. */
  const cancel = () => {
    on = false; pid = -1;
    box.style.transition = ''; box.style.transform = '';
    const sc = document.querySelector('.scrim'); if (sc) sc.style.opacity = '';
  };
  const start = e => {
    pts++;
    if (pts > 1) return cancel();
    if (e.pointerType === 'mouse' && e.button) return;
    if (e.target.closest('input,textarea,button,.seg,.rng,.mgrid')) return;
    if (body.scrollTop > 2 && !head.contains(e.target)) return;
    on = true; lock = 0; dy = 0; y0 = e.clientY; t0 = Date.now(); pid = e.pointerId;
    box.style.transition = 'none';
  };
  const move = e => {
    if (!on || e.pointerId !== pid || pts > 1) return;
    dy = e.clientY - y0;
    if (!lock) {
      if (Math.abs(dy) < 7) return;
      /* vers le haut : ce n'est pas une fermeture, on rend la main */
      if (dy < 0) { on = false; box.style.transition = ''; box.style.transform = ''; return; }
      lock = 1;
    }
    box.style.transform = `translateY(${dy.toFixed(1)}px)`;
    const sc = document.querySelector('.scrim');
    if (sc) sc.style.opacity = Math.max(0, 1 - dy / 320);
  };
  const end = () => {
    pts = Math.max(0, pts - 1);
    if (!on) return; on = false; pid = -1;
    box.style.transition = '';
    const v = dy / Math.max(1, Date.now() - t0);
    if (dy > 110 || (v > .55 && dy > 40)) {
      box.style.transform = 'translateY(110%)';
      const sc = document.querySelector('.scrim'); if (sc) sc.style.opacity = 0;
      setTimeout(() => { closeMenu(); render(); }, 220);
      return;
    }
    box.style.transform = '';
    const sc = document.querySelector('.scrim'); if (sc) sc.style.opacity = '';
  };
  box.addEventListener('pointerdown', start);
  box.addEventListener('pointermove', move);
  box.addEventListener('pointerup', end);
  box.addEventListener('pointercancel', () => { pts = Math.max(0, pts - 1); cancel(); });
  box.addEventListener('gesturestart', e => { e.preventDefault(); cancel(); });
}

/* Table de correspondance construite à l'appel, jamais au niveau module :
   plusieurs feuilles listées ici viennent de menus-b.js et menus-c.js, qui
   importent eux-mêmes depuis ce fichier (cycle inévitable, voir CLAUDE.md) —
   un objet au niveau module capturerait ces imports avant qu'ils soient
   initialisés. */
function menuPainter(m) {
  return {
    subject: paintMenuSubject,
    install: paintMenuInstall,
    newclass: paintMenuNewclass, joinclass: paintMenuNewclass,
    /* Donner un devoir vit maintenant dans une seule feuille : `compSheet`,
       qui sait aussi bien reprendre un livre de la bibliothèque que le
       fabriquer sur place. Hors établissement, l'ancien envoi direct reste
       la bonne réponse — il n'y a qu'une classe et rien à composer. */
    compo: paintMenuCompo,
    plivre: paintMenuPlivre,
    pwork: paintMenuPwork,
    pmot: paintMenuPmot,
    newwork: paintMenuNewwork,
    /* ---------- les feuilles du référent ---------- */
    refwho: paintMenuRefwho,
    refcls: paintMenuRefcls,
    refnew: paintMenuRefnew, refnewclass: paintMenuRefnew,
    devoir: paintMenuDevoir,
    classcode: paintMenuClasscode,
    workone: paintMenuWorkone,
    member: paintMenuMember,
    account: paintMenuAccount,
    report: paintMenuReport,
    blocked: paintMenuBlocked,
    backup: paintMenuBackup,
    card: paintMenuCard,
    deckset: paintMenuDeckset,
    simple: paintMenuSimple, engine: paintMenuSimple,
    merge: paintMenuMerge,
    fnr: paintMenuFnr,
    leave: paintMenuLeave,
    sortpick: paintMenuSortpick,
    preview: paintMenuPreview,
    sharepick: paintMenuSharepick,
    handle: paintMenuHandle,
    newgroup: paintMenuNewgroup, joingroup: paintMenuNewgroup,
    mate: paintMenuMate,
    groupitem: paintMenuGroupitem,
    tuto: paintMenuTuto,
    help: paintMenuHelp,
    vers: paintMenuVers,
    conflict: paintMenuConflict,
    libitem: paintMenuLibitem,
    duelitem: paintMenuDuelitem,
    duelnew: paintMenuDuelnew,
    sendfriend: paintMenuSendfriend,
    /* Prêter un livre : on part de l'ami, pas du livre. La feuille montre
       toute la bibliothèque personnelle ; le livre choisi part aussitôt
       dans sa boîte aux lettres. */
    lend: paintMenuLend,
    mateprof: paintMenuMateprof,
    mailitem: paintMenuMailitem,
    move: paintMenuMove,
    split: paintMenuSplit,
    rename: paintMenuRename, pwd: paintMenuRename, delacc: paintMenuRename
  }[m];
}

function paintMenuDeck(w) {
  const d = deck(view.id); if (!d) return;
  w.innerHTML = `<div class="scrim" data-mact="close"></div>
    <div class="menu">
      <div class="mgrid">
        ${db.subjects.map(x => subj(x.id)).map(s => `<button class="ms ${d.subject === s.id ? 'on' : ''}"
          data-msubj="${s.id}" style="--d:${s.d}"><i></i><span>${esc(s.name)}</span></button>`).join('')}
      </div>
      <div class="msep"></div>
      <button class="mi" data-mact="pindeck">${svg(I.pin)}${d.pinned ? 'Détacher' : 'Épingler en haut'}</button>
      <button class="mi" data-mact="hide">${svg(d.hidden ? I.eye : I.eyeoff)}${d.hidden ? 'Réafficher' : 'Masquer'}</button>
      <button class="mi" data-mact="studyall">${svg(I.play)}Tout revoir<span class="tail">${d.cards.length}</span></button>
      <button class="mi" data-mact="mcq">${svg(I.grid)}QCM</button>
      <button class="mi" data-mact="match">${svg(I.link)}Association</button>
      <button class="mi" data-mact="deckset">${svg(I.gear)}Réglages du livre</button>
      ${d.cards.filter(isLeech).length ? `<button class="mi" data-mact="studyleech">${svg(I.target)}Cartes coriaces<span class="tail">${d.cards.filter(isLeech).length}</span></button>` : ''}
      <div class="msep"></div>
      ${canUndo() ? `<button class="mi" data-mact="undo">${svg(I.redo)}Annuler<span class="tail">${esc(undoLabel())}</span></button>` : ''}
      ${d.cards.length ? `<button class="mi" data-mact="fnropen">${svg(I.search)}Chercher et remplacer</button>` : ''}
      <button class="mi" data-mact="versopen">${svg(I.clock)}Éditions précédentes</button>
      <button class="mi" data-mact="clone">${svg(I.copy)}Dupliquer</button>
      ${db.decks.length > 1 ? `<button class="mi" data-mact="mergeopen">${svg(I.link)}Fusionner avec…</button>` : ''}
      ${d.cards.length > 3 ? `<button class="mi" data-mact="splitopen">${svg(I.split)}Scinder<span class="tail">${d.cards.length}</span></button>` : ''}
      <button class="mi" data-mact="sharepick">${svg(I.share)}Partager</button>
      <button class="mi warn" data-mact="del">${svg(I.trash)}<span>Supprimer</span></button>
    </div>`;
  mountMenu(w);
}

export function paintMenu() {
  document.querySelectorAll('.scrim,.menu').forEach(n => n.remove());
  document.documentElement.classList.remove('sheet-open');
  const w = document.createElement('div');
  const painter = menuPainter(menu);
  if (painter) return painter(w);
  return paintMenuDeck(w);
}

function paintMenuSubject(w) {
  const t = db.subjects.find(x => x.id === subjEdit) || { id: '', name: '', color: 'graphite' };
    w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu">
        <input class="tok" id="sn" placeholder="Nom de la matière" spellcheck="false"
          enterkeyhint="done" value="${esc(subjName)}">
        <div class="swatch">${COLORS.map(k => `<button class="sw2 ${k === subjColor ? 'on' : ''}"
          data-color="${k}" style="background:${PALETTE[k].c};--dd:${PALETTE[k].d}"></button>`).join('')}</div>
        <div class="msep"></div>
        ${t.id ? `<button class="mi warn" data-mact="subjdel">${svg(I.trash)}<span>Supprimer</span></button>` : ''}
        <button class="mi" data-mact="subjok" style="justify-content:center;font-weight:700">
          ${svg(I.check)}${t.id ? 'Enregistrer' : 'Créer'}</button>
      </div>`;
    mountMenu(w);
    const sn = document.getElementById('sn');
    sn.addEventListener('input', () => setSubjName(sn.value));
    sn.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); sn.blur(); } });
    setTimeout(() => { if (!subjName) sn.focus(); }, 60);
    return;
}

function paintMenuInstall(w) {
  return installSheet(w);
}

function paintMenuNewclass(w) {
  const mk = menu === 'newclass';
    w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu">
        <div class="mhd">${svg(mk ? I.plus : I.key)}<span class="mhx">
          <b>${mk ? 'Créer une classe' : 'Rejoindre une classe'}</b></span></div>
        <input class="tok" id="cn" placeholder="${mk ? 'Nom de la classe — 2nde B' : 'Code de la classe'}"
          autocapitalize="${mk ? 'sentences' : 'characters'}" autocorrect="off" spellcheck="false"
          enterkeyhint="done" maxlength="${mk ? 40 : 8}">
        ${mk ? `<input class="tok" id="cl" placeholder="Niveau — Seconde (facultatif)"
          autocorrect="off" spellcheck="false" maxlength="20">` : ''}
        <button class="mi" data-mact="${mk ? 'doclass' : 'doclassjoin'}"
          style="justify-content:center;font-weight:700">${svg(I.check)}${mk ? 'Créer' : 'Rejoindre'}</button>
      </div>`;
    mountMenu(w);
    setTimeout(() => { const f = document.getElementById('cn'); if (f) f.focus(); }, 60);
    return;
}

function paintMenuCompo(w) {
  return compSheet(w);
}

function paintMenuPlivre(w) {
  const l = live();
    w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu pv">
        <div class="mhd">${svg(I.book)}<span class="mhx"><b>Quel livre ?</b></span></div>
        ${!l.length ? `<div class="mlbl">Ta bibliothèque est vide</div>`
          : `<div class="mscroll">${l.map(d => `<button class="mi" data-plivre="${esc(d.id)}">
              ${svg(I.book)}<span>${esc(d.name)}</span>
              <span class="tail">${plur(d.cards.length, 'page')}</span></button>`).join('')}</div>`}
      </div>`;
    mountMenu(w);
    return;
}

function paintMenuPwork(w) {
  return workSheet(w);
}

function paintMenuPmot(w) {
  const m = (prof.roster || []).find(x => x.user_id === prof.eleve);
    if (!m) { setMenu(null); return; }
    w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu">
        <div class="mhd"><i class="av">${esc(initial(m.who))}</i>
          <span class="mhx"><b>Un mot à ${esc(m.who.split(' ')[0])}</b></span></div>
        <div class="rform"><label>Ton message
          <textarea id="pmt" rows="4" spellcheck="true"
            placeholder="Reprends la série 2, on la refait jeudi."></textarea></label></div>
        <button class="mi" data-mact="pmotgo" style="justify-content:center;font-weight:700">
          ${svg(I.mail2)}Envoyer</button>
      </div>`;
    mountMenu(w);
    setTimeout(() => { const i = document.getElementById('pmt'); if (i) i.focus(); }, 60);
    return;
}

function paintMenuNewwork(w) {
  const l = live();
    w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu">
        <div class="mhd">${svg(I.share)}<span class="mhx"><b>Donner un devoir</b></span></div>
        ${!l.length ? `<div class="note" style="padding:4px 18px 14px">Aucun livre à donner.</div>`
          : `<div class="mscroll">${l.map(d => `<button class="mi" data-give="${esc(d.id)}">
               ${svg(I.book)}<span>${esc(d.name)}</span>
               <span class="tail">${plur(d.cards.length, 'page')}</span></button>`).join('')}</div>`}
      </div>`;
    mountMenu(w);
    return;
}

function paintMenuRefwho(w) {
  const g = ref.who;
    if (!g) { setMenu(null); return; }
    const f = ref.form || {};
    const eleve = g.role === 'eleve';
    w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu pv">
        <div class="mhd"><i class="av">${esc(initial(g.name))}</i>
          <span class="mhx"><b>${esc(g.name)}</b>
            <i>@${esc(g.handle || '')} · ${esc(ROLENOM[g.role] || g.role)}${
              g.jamais ? ' · jamais venu' : ' · vu ' + timeAgo(g.derniere)}</i></span></div>
        <div class="mscroll">
          <div class="rform">
            <label>Nom<input id="fnom" value="${esc(g.name)}" spellcheck="false"></label>
            <label>Pseudo<input id="fpse" value="${esc(g.handle || '')}" spellcheck="false"
              autocapitalize="none"></label>
            <label>Adresse<input id="fmel" value="${esc(g.email)}" spellcheck="false"
              autocapitalize="none" type="email"></label>
          </div>
          <button class="mi" data-mact="refsave">${svg(I.check)}<span>Enregistrer l’identité</span></button>
          <div class="msep"></div>

          <div class="rform">
            <label>Nouveau mot de passe
              <input id="fpw" value="${esc(f.pw || '')}" spellcheck="false" autocapitalize="none"
                placeholder="dix caractères au moins"></label>
          </div>
          <button class="mi" data-mact="refpw">${svg(I.key)}<span>Refaire le mot de passe</span>
            <span class="tail">à lire à l’intéressé</span></button>
          <div class="msep"></div>

          ${eleve ? `<div class="mlbl">Classe</div>
            <div class="mscroll courte">${(ref.classes || []).map(c => `
              <button class="mi${g.class_id === c.id ? ' on' : ''}" data-rmove="${esc(c.id)}">
                ${svg(g.class_id === c.id ? I.check : I.arrow)}<span>${esc(c.name)}</span>
                <span class="tail">${c.effectif} él.</span></button>`).join('')}</div>
            ${g.class_id ? `<button class="mi warn" data-rmove="">${svg(I.x)}
              <span>Retirer de sa classe</span></button>` : ''}`
          : `<div class="mlbl">Service d’enseignement</div>
            ${!ref.service ? ``
              : !ref.service.length ? ``
              : `<div class="mscroll courte">${ref.service.map(s => `<div class="mi lect">
                  ${svg(I.school)}<span>${esc(s.classe)} · ${esc(s.matiere)}${
                    s.principal ? ' (PP)' : ''}</span>
                  <button class="tail warn" data-rdropt="${esc(s.teaching_id)}">retirer</button>
                  </div>`).join('')}</div>`}`}
          <div class="msep"></div>
          <div class="mlbl">Rôle</div>
          ${['eleve', 'prof'].map(k => `<button class="mi${g.role === k ? ' on' : ''}"
            data-rrolechg="${k}">${svg(g.role === k ? I.check : I.arrow)}${ROLENOM[k]}</button>`).join('')}
        </div>
      </div>`;
    mountMenu(w);
    if (g.role !== 'eleve' && !ref.service) refService(g.id);
    return;
}

function equipePedagogiqueHtml(team) {
  if (!team || !team.length) return ``;
  return `<div class="mscroll courte">${team.map(t => `<div class="mi lect">
      ${svg(t.principal ? I.check : I.user)}
      <span>${esc(t.nom)} · ${esc(t.matiere)}${t.principal ? ' (PP)' : ''}</span>
      <button class="tail" data-rpp="${esc(t.teacher)}|${esc(t.matiere)}">PP</button>
      <button class="tail warn" data-rdropt="${esc(t.teaching_id)}">retirer</button>
      </div>`).join('')}</div>`;
}

function profsAAjouterHtml(gens) {
  return (gens || []).filter(x => x.role === 'prof').map(p => `
    <button class="mi" data-raddt="${esc(p.id)}">${svg(I.plus)}<span>${esc(p.name)}</span>
      <span class="tail">${esc(p.matiere || '')}</span></button>`).join('');
}

function paintMenuRefcls(w) {
  const c = (ref.classes || []).find(x => x.id === ref.open);
    if (!c) { setMenu(null); return; }
    const f = ref.form || {};
    const filiere = c.filiere ? ' · ' + esc(c.filiere) : '';
    w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu pv">
        <div class="mhd">${svg(I.school)}<span class="mhx"><b>${esc(c.name)}</b>
          <i>${esc(c.niveau || '')}${filiere} · ${
            plur(c.effectif, 'élève')} · code ${esc(c.code || '—')}</i></span></div>
        <div class="mscroll">
          <div class="rform">
            <label>Nom<input id="knom" value="${esc(c.name)}" spellcheck="false"></label>
            <label>Niveau<input id="kniv" value="${esc(c.niveau || '')}" spellcheck="false"></label>
            <label>Filière<input id="kfil" value="${esc(c.filiere || '')}" spellcheck="false"></label>
            <label>Effectif prévu<input id="kpre" value="${c.prevu || ''}" inputmode="numeric"></label>
          </div>
          <button class="mi" data-mact="refclssave">${svg(I.check)}<span>Enregistrer</span></button>
          <button class="mi" data-mact="refclsgens">${svg(I.users)}
            <span>Voir ses ${plur(c.effectif, 'élève')}</span></button>
          <div class="msep"></div>

          <div class="mlbl">Équipe pédagogique</div>
          ${equipePedagogiqueHtml(ref.team)}
          <div class="rform">
            <label>Ajouter un professeur — matière
              <input id="tmat" value="${esc(f.mat || '')}" spellcheck="false"
                placeholder="Mathématiques"></label>
          </div>
          <div class="mscroll courte">${profsAAjouterHtml(ref.gens)}</div>
          <div class="msep"></div>
          <button class="mi warn" data-mact="refclsdel">${svg(I.trash)}
            <span>Supprimer la classe</span>
            <span class="tail">${c.effectif ? 'videz-la d’abord' : ''}</span></button>
        </div>
      </div>`;
    mountMenu(w);
    if (!ref.team) refTeam(c.id);
    return;
}

function formNouveauCompte(f) {
  return `<div class="rform">
      <label>Adresse<input id="nmel" value="${esc(f.mel || '')}" type="email"
        autocapitalize="none" spellcheck="false" placeholder="prenom.nom@lycee.fr"></label>
      <label>Nom<input id="nnom" value="${esc(f.nom || '')}" spellcheck="false"></label>
      <label>Pseudo (facultatif)<input id="npse" value="${esc(f.pse || '')}"
        autocapitalize="none" spellcheck="false"></label>
      <label>Mot de passe<input id="npw" value="${esc(f.pw || '')}"
        autocapitalize="none" spellcheck="false" placeholder="dix caractères au moins"></label>
    </div>
    <div class="mlbl">Rôle</div>
    ${['eleve', 'prof'].map(k => `<button class="mi${(f.role || 'eleve') === k ? ' on' : ''}"
      data-rnrole="${k}">${svg((f.role || 'eleve') === k ? I.check : I.arrow)}${ROLENOM[k]}</button>`).join('')}
    ${(f.role || 'eleve') === 'eleve' ? `
      <div class="mlbl">Classe</div>
      <div class="mscroll courte">${(ref.classes || []).map(c => `
        <button class="mi${f.cls === c.id ? ' on' : ''}" data-rncls="${esc(c.id)}">
          ${svg(f.cls === c.id ? I.check : I.arrow)}<span>${esc(c.name)}</span>
          <span class="tail">${c.effectif} él.</span></button>`).join('')}</div>` : ''}`;
}

function formNouvelleClasse(f) {
  return `<div class="rform">
      <label>Nom de la classe<input id="knom" value="${esc(f.nom || '')}"
        spellcheck="false" placeholder="2nde 4"></label>
      <label>Niveau<input id="kniv" value="${esc(f.niv || '')}" spellcheck="false"
        placeholder="Seconde"></label>
      <label>Filière (facultatif)<input id="kfil" value="${esc(f.fil || '')}"
        spellcheck="false"></label>
      <label>Effectif prévu<input id="kpre" value="${esc(f.pre || '')}" inputmode="numeric"></label>
    </div>
    <div class="mlbl">Cycle</div>
    ${Object.entries(CYCLES).map(([k, n]) => `<button class="mi${f.cyc === k ? ' on' : ''}"
      data-rncyc="${k}">${svg(f.cyc === k ? I.check : I.arrow)}${n}</button>`).join('')}`;
}

function paintMenuRefnew(w) {
  const cpt = menu === 'refnew';
    const f = ref.form || {};
    w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu pv">
        <div class="mhd">${svg(I.plus)}<span class="mhx">
          <b>${cpt ? 'Ouvrir un compte' : 'Créer une classe'}</b></span></div>
        <div class="mscroll">
          ${cpt ? formNouveauCompte(f) : formNouvelleClasse(f)}
          <div class="msep"></div>
          <button class="mi" data-mact="${cpt ? 'refdonew' : 'refdonewclass'}"
            style="justify-content:center;font-weight:700">${svg(I.check)}${
              cpt ? 'Ouvrir le compte' : 'Créer la classe'}</button>
        </div>
      </div>`;
    mountMenu(w);
    setTimeout(() => { const i = document.getElementById(cpt ? 'nmel' : 'knom'); if (i) i.focus(); }, 60);
    return;
}

function paintMenuDevoir(w) {
  const a = (asgs || []).find(x => x.id === workOpen);
    if (!a) { setMenu(null); return; }
    w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu">
        <div class="mhd">${svg(I.card)}<span class="mhx"><b>${esc(a.name)}</b>
          <i>${plur(a.n, 'page')}${a.due ? ' · ' + dueLabel(a.due) : ''}</i></span></div>
        <button class="mi" data-mact="takework" style="justify-content:center;font-weight:700">
          ${svg(I.plus)}Ajouter à ma bibliothèque</button>
      </div>`;
    mountMenu(w);
    return;
}

function paintMenuClasscode(w) {
  const k = (prof.classes || []).find(x => x.id === prof.open) || {};
    w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu">
        <div class="mhd">${svg(I.key)}<span class="mhx"><b>${esc(k.name || 'Cette classe')}</b></span></div>
        <div class="bigcode">${esc(k.code || '—')}</div>
        <div class="note" style="padding:0 18px 16px;text-align:center">${
          k.jamais ? `${plur(k.jamais, 'élève')} n’${k.jamais > 1 ? 'ont' : 'a'} jamais ouvert l’app.`
                   : 'Tous tes élèves ont déjà ouvert l’app au moins une fois.'}</div>
      </div>`;
    mountMenu(w);
    return;
}

function paintMenuWorkone(w) {
  const a = (asgs || []).find(x => x.id === workOpen);
    const c = (classes || []).find(x => x.id === classOf);
    if (!a || !c) { setMenu(null); return; }
    const owner = c.owner === auth.uid;
    w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu">
        <div class="mhd">${svg(I.card)}<span class="mhx"><b>${esc(a.name)}</b>
          <i>${plur(a.n, 'page')}${a.due ? ' · ' + dueLabel(a.due) : ''}</i></span></div>
        ${owner ? `<div class="note" style="padding:0 18px 10px" id="wprog">Chargement du suivi…</div>
          <button class="mi warn" data-mact="delwork">${svg(I.trash)}<span>Retirer ce devoir</span></button>`
        : `<button class="mi" data-mact="takework" style="justify-content:center;font-weight:700">
             ${svg(I.plus)}Ajouter à ma bibliothèque</button>`}
      </div>`;
    mountMenu(w);
    if (owner) workProgress(a.id);
    return;
}

function paintMenuMember(w) {
  const m = (roster || []).find(x => x.user_id === memberOpen);
    if (!m) { setMenu(null); return; }
    w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu">
        <div class="mhd"><i class="av">${esc(initial(m.who))}</i>
          <span class="mhx"><b>${esc(m.who || 'Élève')}</b></span></div>
        <button class="mi warn" data-mact="dropmember">${svg(I.x)}<span>Retirer de la classe</span></button>
      </div>`;
    mountMenu(w);
    return;
}

function paintMenuAccount(w) {
  return accountSheet(w);
}

function paintMenuReport(w) {
  return reportSheet(w);
}

function paintMenuBlocked(w) {
  return blockedSheet(w);
}

function paintMenuBackup(w) {
  const n = db.decks.length, c = db.decks.reduce((a, x) => a + x.cards.length, 0);
    w.innerHTML = `<div class="scrim" data-mact="close"></div>
      <div class="menu">
        <button class="mi" data-mact="backup">${svg(I.share)}Sauvegarder
          <span class="tail">${n} · ${c}</span></button>
      </div>`;
    mountMenu(w);
    return;
}
