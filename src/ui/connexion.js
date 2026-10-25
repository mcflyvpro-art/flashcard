// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { $ } from '../racine.js';
import { I, svg } from '../icones.js';
import { estNeuve, isLeech } from '../file.js';
import {
  auth, db, deckOpen, DECKPAGE, deckQ, deckShow, dirty, legalBack, legalTab, loginBusy, loginMode,
  prof, sel, setAnimate, setDb, setDeckQ, setDeckShow, setLoginBusy, setLoginMode, setSel,
  setTyping, typing, view
} from '../data/etat.js';
import {
  cardIcon, cardRich, go, mixBar, render
} from './bibliotheque.js';
import {
  MAXB, MAXF, STATE, cstate, nextIn, plain
} from './carte-media.js';
import { codeComplet, emailCarte, formatCode, lireCarte, normCode, normIdentifiant } from '../classe.js';
import { accueil } from '../core/classement.js';
import {
  deck, esc, load, pending, plur, pull, resetPassword, saveDeck, signIn, signUp, sty, subj
} from '../core/coeur-sync.js';
import { dueCount, simpleMode, toast } from './import-cartes.js';
import { consumeGoto } from './raccourcis.js';
import { consumeHash, logout, maybeTour } from './onboarding.js';
import { norm } from './quiz.js';
import { cartePassage, lierPassage } from './passage.js';
import { bindReorder } from './reordonner.js';
import { CONTACT, EDITEUR } from '../editeur.js';

/* ---------- sélection multiple ----------
   `sel` est nul hors du mode ; sinon c'est l'ensemble des cartes cochées.
   La barre du bas ne propose que ce qui a du sens : rien de grisé, rien
   qui ne réponde pas. */
export const selOff = () => { setSel(null); };

export function selBar(d) {
  const ids = [...sel].filter(i => d.cards.some(c => c.id === i));
  const n = ids.length;
  const all = n === d.cards.length;
  const anyOn = ids.some(i => !d.cards.find(c => c.id === i).x);
  return `<div class="selb" data-k="selb">
    <button class="sbl" data-act="selall">${svg(all ? I.x : I.check)}${all ? 'Aucune' : 'Tout'}</button>
    <span class="sbn">${n ? n + ' carte' + (n > 1 ? 's' : '') : 'Aucune carte'}</span>
    <div class="sba">
      <button class="x" data-act="selmove" ${n && db.decks.length > 1 ? '' : 'disabled'}
        title="Déplacer vers un autre livre">${svg(I.out)}</button>
      <button class="x" data-act="selsus" ${n ? '' : 'disabled'}
        title="${anyOn ? 'Suspendre' : 'Réactiver'}">${svg(anyOn ? I.eyeoff : I.eye)}</button>
      <button class="x warn" data-act="seldel" ${n ? '' : 'disabled'}
        title="Supprimer">${svg(I.trash)}</button>
    </div>
  </div>`;
}

function ctaButton(d) {
  if (prof.comp && prof.comp.livre === d.id) {
    return `<button class="cta read" data-act="pretour">
        ${svg(I.share)}Donner ce devoir</button>`;
  }
  const due = !simpleMode() && dueCount(d);
  /* rien de dû, mais des pages neuves au-delà du quota du jour : « +20 » */
  if (!due && !simpleMode() && d.cards.some(c => !c.x && estNeuve(c))) {
    return `<button class="cta read" data-act="studyplus">${svg(I.play)}Lire <b>+20</b></button>`;
  }
  return `<button class="cta read" data-act="study">${svg(I.play)}Lire${due ? ` <b>${due}</b>` : ''}</button>`;
}

function deckHeadMeta(d) {
  return d.hidden ? `<span>${svg(I.eyeoff)}Masqué</span>` : '';
}

function findButton(d) {
  if (d.cards.length <= 5) return '';
  return `<button class="pick ico ${deckQ ? 'on' : ''}" data-act="deckfind"
        aria-label="Chercher dans ce livre">${svg(I.search)}</button>`;
}

function selectButton(d) {
  if (!d.cards.length) return '';
  return `<button class="pick ico ${sel ? 'on' : ''}" data-act="selmode" aria-label="${sel ? 'Terminer la sélection' : 'Sélectionner'}"
        title="${sel ? 'Terminer' : 'Sélectionner'}">${svg(sel ? I.check : I.pick)}</button>`;
}

const countLabel = (shown, d) => shown.length === d.cards.length ? d.cards.length : shown.length + ' / ' + d.cards.length;

function searchField() {
  if (!deckOpen) return '';
  return `<div class="fld deckfld"><input id="dq" type="search"
      placeholder="Chercher dans ce livre" autocomplete="off" autocapitalize="none"
      spellcheck="false" value="${esc(deckQ)}" aria-label="Chercher dans ce livre"></div>`;
}

function rowStateIcon(c) {
  if (simpleMode()) return '';
  return `<i class="cst ${cstate(c)}" title="${STATE[cstate(c)]}${isLeech(c) ? ' · coriace' : ''}${c.d ? ' · dans ' + nextIn(c) : ''}"></i>`;
}

function rowLeftDecor(c, nq) {
  if (sel) return `<button class="ck" data-pkc="${c.id}" aria-label="Sélectionner">${svg(I.check)}</button>`;
  const grip = nq ? '' : `<button class="grip" aria-label="Déplacer">${svg(I.grip)}</button>`;
  return grip + rowStateIcon(c);
}

function rowActions(c) {
  if (sel) return '';
  return `<button class="x ${cardRich(c) ? 'on' : ''}" data-card="${c.id}"
            title="Type, étiquettes, image, son">${svg(cardIcon(c))}</button>
          <button class="x sus ${c.x ? 'on' : ''}" data-sus="${c.id}"
            title="${c.x ? 'Réactiver' : 'Suspendre'}">${svg(c.x ? I.eyeoff : I.eye)}</button>
          <button class="x" data-rm="${c.id}">${svg(I.x)}</button>`;
}

function cardRow(c, i, nq) {
  return `
      <div class="row ${c.x ? 'off' : ''} ${sel && sel.has(c.id) ? 'pk' : ''}" data-id="${c.id}" style="--i:${i}">
        ${rowLeftDecor(c, nq)}
        <div class="fl">
          <input value="${esc(c.f)}" data-k="f" placeholder="Recto" ${sel ? 'tabindex="-1"' : ''}>
          <input class="b" value="${esc(c.b)}" data-k="b" placeholder="Verso" ${sel ? 'tabindex="-1"' : ''}>
        </div>
        ${rowActions(c)}
      </div>`;
}

/* Sur ordinateur, c'est la liste qui défile, pas la page (app.css) : elle
   devient la racine de l'observation, sinon la marge d'avance de 400 px ne
   jouerait qu'une fois « Plus… » déjà visible. */
const listeDefile = rows => rows && getComputedStyle(rows).overflowY === 'auto';

function bindInfiniteScroll() {
  const more = document.getElementById('more');
  if (!more) return;
  const rows = more.closest('.rows');
  const io2 = new IntersectionObserver(es => {
    if (!es.some(e => e.isIntersecting)) return;
    io2.disconnect();
    setDeckShow(deckShow + DECKPAGE); setAnimate(false); render();
  }, { root: listeDefile(rows) ? rows : null, rootMargin: '400px' });
  io2.observe(more);
}

/* Repeindre le livre (une page suspendue, une page ajoutée, la suite de la
   liste) reconstruit la liste : sur ordinateur, elle repartait en haut. On
   garde sa position tant qu'on reste sur le même livre. */
let listeVue = { id: null, top: 0 };
function retenirListe(id) {
  const rows = $.dataset.view === 'deck' && $.querySelector('.rows');
  listeVue = { id: rows ? listeVue.id : null, top: rows ? rows.scrollTop : 0 };
  if (listeVue.id !== id) listeVue = { id, top: 0 };
}
function rendreListe() {
  const rows = $.querySelector('.rows');
  if (rows && listeVue.top) rows.scrollTop = listeVue.top;
}

function bindDeckName(d) {
  const t = document.getElementById('dn');
  t.addEventListener('blur', () => {
    const v = t.textContent.replace(/\s+/g, ' ').trim();
    if (v !== d.name) { d.name = v || 'Paquet'; saveDeck(d); t.textContent = d.name; }
  });
  t.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); t.blur(); } });
}

function bindCardInputs(d) {
  $.querySelectorAll('.row input').forEach(inp => inp.addEventListener('input', () => {
    const c = d.cards.find(x => x.id === inp.closest('.row').dataset.id);
    if (!c) return;
    c[inp.dataset.k] = inp.value;
    /* marqué « à envoyer » dès la première lettre : l'enregistrement, lui,
       attend la fin de la frappe (700 ms) — mais si l'app est fermée ou
       passe en arrière-plan avant, onboarding.js écrit tout de suite (voir
       `visibilitychange`), et le paquet doit déjà se savoir en attente. */
    dirty[d.id] = 1;
    /* On n'empêche pas d'écrire — perdre ce qu'on vient de taper serait
       pire que tout — mais on le signale, et le compte restant apparaît
       quand on approche de la limite. */
    const max = inp.dataset.k === 'f' ? MAXF : MAXB;
    const len = plain(inp.value).length;
    inp.classList.toggle('over', len > max);
    let tag = inp.parentElement.querySelector('.lim');
    if (len > max * .8) {
      if (!tag) { tag = document.createElement('i'); tag.className = 'lim'; inp.parentElement.appendChild(tag); }
      tag.textContent = (max - len) + '';
      tag.classList.toggle('ko', len > max);
    } else if (tag) tag.remove();
    clearTimeout(typing); setTyping(setTimeout(() => saveDeck(d), 700));
  }));
  // quitter le champ enregistre tout de suite, sans attendre la fin du délai
  $.querySelectorAll('.row input').forEach(inp => inp.addEventListener('change', () => {
    clearTimeout(typing); saveDeck(d);
  }));
}

/* Le filtre ne retire jamais de carte : il n'en montre qu'une partie. */
const pagesMontrees = (d, nq) => nq
  ? d.cards.filter(c => norm(plain(c.f)).includes(nq) || norm(plain(c.b)).includes(nq))
  : d.cards;

/* La liste des pages, seule : c'est elle, et elle seule, que la recherche
   repeint. Un paquet de mille cartes, c'est quatre mille champs de saisie à
   construire avant d'afficher quoi que ce soit : plusieurs secondes de
   page blanche sur un téléphone. On en pose une page, le reste arrive
   quand le bas de la liste approche. */
function rowsHtml(shown, nq) {
  const part = shown.slice(0, deckShow), rest = shown.length - part.length;
  return `<div class="rows ${sel ? 'picking' : ''}">
      ${!shown.length ? `<div class="note" style="padding:14px 4px">Aucune carte ne contient « ${esc(deckQ)} ».</div>` : ''}
      ${part.map((c, i) => cardRow(c, i, nq)).join('')}
      ${rest ? `<div class="more" id="more">${plur(rest, 'page')} de plus…</div>` : ''}
      ${sel ? '' : `<div class="duo ghost">
        <button data-act="add">${svg(I.plus)}Page</button>
        <button data-act="paste">${svg(I.down)}Coller</button>
      </div>`}
    </div>`;
}

function bindRows(d, nq) {
  bindInfiniteScroll();
  bindCardInputs(d);
  if (!nq) bindReorder(d);
}

/* Pendant la frappe, rien d'autre que la liste et le compteur ne bouge :
   reconstruire toute la page à chaque lettre refermait le clavier sur
   iPhone, et faisait sauter l'écran (le champ, recréé, reprenait le focus
   en faisant défiler la page jusqu'à lui). La liste est remplacée d'un
   bloc (pas seulement son contenu) : ses écouteurs de glisser-déposer
   partent avec elle au lieu de s'empiler. */
function repeindrePages(d) {
  const rows = $.querySelector('.rows'); if (!rows) return;
  const nq = norm(deckQ), shown = pagesMontrees(d, nq);
  rows.outerHTML = rowsHtml(shown, nq);
  const n = document.getElementById('dcount'); if (n) n.textContent = countLabel(shown, d);
  const b = $.querySelector('[data-act="deckfind"]'); if (b) b.classList.toggle('on', !!deckQ);
  bindRows(d, nq);
}

function bindDeckSearchField(d) {
  const dq = document.getElementById('dq');
  if (!dq) return;
  let dt = 0;
  dq.addEventListener('input', () => {
    setDeckQ(dq.value);
    clearTimeout(dt);
    dt = setTimeout(() => repeindrePages(d), 120);
  });
  /* « Entrée » ferme le clavier : la liste filtrée reste, lisible en entier */
  dq.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); dq.blur(); } });
  /* tout de suite, dans le geste même : iOS n'ouvre le clavier que là */
  if (!deckQ) dq.focus({ preventScroll: true });
}

export function deckView() {
  const d = deck(view.id); if (!d) return go('home');
  const s = subj(d.subject);
  /* Le filtre ne retire jamais de carte : il n'en montre qu'une partie.
     Tant qu'il est posé, la poignée disparaît — réordonner une liste
     filtrée écrirait des positions qui ne veulent rien dire. */
  const nq = norm(deckQ);
  const shown = pagesMontrees(d, nq);
  retenirListe(d.id);
  $.innerHTML = `
    <div class="bar">
      <button class="ic" data-act="deckback" aria-label="Retour">${svg(I.back)}</button>
      <div style="flex:1"></div>
      <button class="ic" data-act="menu" aria-label="Menu du livre">${svg(I.more)}</button>
    </div>
    <div class="head" style="${sty(s)}">
      <div class="t" id="dn" contenteditable="plaintext-only" spellcheck="false" enterkeyhint="done">${esc(d.name)}</div>
      <div class="s">
        ${d.subject ? `<span>${svg(I.tag)}${esc(s.name)}</span>` : ''}
        ${deckHeadMeta(d)}
      </div>
    </div>
    ${ctaButton(d)}
    <div class="acts">
      <button data-act="quizdeck">${svg(I.pen)}Récitation</button>
      <button data-act="mcq">${svg(I.grid)}QCM</button>
      <button data-act="match">${svg(I.link)}Association</button>
      <button data-act="sharepick">${svg(I.share)}Partager</button>
    </div>
    ${simpleMode() ? '' : mixBar(d)}
    <div class="lbl"><span>Pages</span>
      ${findButton(d)}
      ${selectButton(d)}
      <span id="dcount">${countLabel(shown, d)}</span></div>
    ${searchField()}
    ${rowsHtml(shown, nq)}
    ${sel ? selBar(d) : ''}`;
  bindDeckName(d);
  bindRows(d, nq);
  rendreListe();
  bindDeckSearchField(d);
}

/* ---------- connexion ---------- */
export const PWMIN = 10;

/* ══════════ le cadre : mentions, confidentialité, conditions ══════════
   Les textes et ce qui les remplit : src/editeur.js, ui/legal-textes.js. */

export const LEGAL_TITRES = { cgu: 'Conditions d’utilisation', vie: 'Confidentialité', mentions: 'Mentions légales' };

/* Tant qu'un ⟦crochet⟧ traîne dans l'identité ou le contact de l'éditeur,
   l'app ne dit pas qui traite les données ni comment le joindre — exigé dès
   la collecte par l'art. 13.1.a et .b du RGPD (et par la LCEN pour les
   mentions légales). Le commentaire au-dessus d'EDITEUR/CONTACT prévenait
   déjà ; ce signal-ci reste visible en production, dès le démarrage, tant
   que le remplacement n'est pas fait (les autres crochets des textes sont
   signalés à leur ouverture, ui/legal-textes.js). */
if (/⟦/.test(EDITEUR + CONTACT)) {
  console.error('Folio : mentions légales incomplètes — des ⟦placeholders⟧ sont encore '
    + 'servis aux utilisateurs (identité/coordonnées du responsable de traitement, art. 13 RGPD). '
    + 'Voir EDITEUR et CONTACT dans src/editeur.js.');
}

/* Les textes eux-mêmes se chargent à l'ouverture (ui/legal-textes.js). */
let textes = null;
export function legalView() {
  const titre = LEGAL_TITRES[legalTab];
  const barre = `<div class="bar"><button class="ic" data-act="${legalBack === 'login' ? 'tolog' : 'settings'}"
        aria-label="Retour">${svg(I.back)}</button><h1>${esc(titre)}</h1></div>`;
  const onglets = `<div class="pills" id="lgTabs">${Object.entries(LEGAL_TITRES).map(([k, t]) =>
        `<button class="p${legalTab === k ? ' on' : ''}" data-legal="${k}">${esc(t)}</button>`).join('')}</div>`;
  if (!textes) {
    $.innerHTML = `${barre}<div class="page">${onglets}<div class="legal"><p>Chargement…</p></div></div>`;
    import('./legal-textes.js').then(m => { textes = m; if (view.name === 'legal') render(); })
      .catch(() => toast(I.x, 'Ce texte n’a pas pu s’ouvrir : vérifie ta connexion'));
    return;
  }
  $.innerHTML = `${barre}
    <div class="page">
      ${onglets}
      <div class="legal">${textes.legalHtml(textes.LEGAL[legalTab][1])}</div>
    </div>`;
}

/* Six caractères se cassent hors ligne en quelques secondes. Dix est
   le plancher, et il ne vaut que parce que le même est réglé côté
   Supabase : ce contrôle-ci ne protège que la personne qui se sert du
   formulaire, pas celle qui appelle l'API directement.
   La case n'est pas une formalité : en dessous de 15 ans, le
   consentement d'un parent est requis, et on ne peut pas le recueillir
   ici. Mieux vaut ne pas ouvrir le compte que de faire semblant. */
function validateLoginForm(up, em, pw, err) {
  if (!em.value.trim() || !pw.value) { err.textContent = 'Renseigne les deux champs'; return false; }
  if (up && pw.value.length < PWMIN) {
    err.textContent = `Mot de passe : ${PWMIN} caractères minimum`; return false;
  }
  const age = document.getElementById('age');
  if (up && age && !age.checked) {
    err.textContent = 'Confirme que tu as 15 ans ou plus'; return false;
  }
  return true;
}

/* Rend true quand l'inscription vient de s'arrêter net (compte créé mais
   e-mail à confirmer) : la vue a déjà été repeinte, l'appelant n'a plus
   rien à faire. */
async function submitSignUp(em, pw, err) {
  const done = await signUp(em.value, pw.value);
  if (done) return false;
  err.textContent = 'Compte créé. Confirme l’e-mail reçu, puis connecte-toi.';
  setLoginMode('in'); setLoginBusy(false); loginView();
  return true;
}

function loginErrorMessage(x, up) {
  const m = String(x.message || '');
  if (/already|exist|registered/i.test(m)) return 'Cette adresse a déjà un compte';
  if (/Invalid|credentials|refus/i.test(m)) return 'E-mail ou mot de passe incorrect';
  return up ? 'Inscription impossible' : 'Connexion impossible';
}

/* Ce qui suit toute connexion réussie, quelle qu'en soit la porte. */
async function apresConnexion() {
  setDb(load());
  await pull();
  /* Un lien de partage ouvert alors qu'on n'était pas connecté attend
     dans l'adresse : c'est maintenant qu'il faut le suivre, sinon on
     atterrit sur l'accueil sans savoir ce qu'on venait voir. Un code de
     classe en attente (« ?rejoindre= ») est repris par accueil(). */
  if (!consumeHash() && !consumeGoto()) { go('home'); accueil(); }
  maybeTour();
}

async function doLogin(up, em, pw, err, btn) {
  try {
    if (up) {
      if (await submitSignUp(em, pw, err)) return;
    } else await signIn(em.value, pw.value);
    await apresConnexion();
  } catch (x) {
    err.textContent = loginErrorMessage(x, up);
    btn.disabled = false;
    btn.firstChild.textContent = up ? 'Créer le compte' : 'Se connecter';
  }
}

/* ---------- la carte élève ----------
   Un élève dont le professeur a créé le compte n'a ni e-mail ni mot de
   passe choisi : il a une carte, avec un identifiant (« prenom.nom ») et
   un code de huit caractères — ou le QR code de la même carte, qui
   connecte d'un geste. Son nom, « Prénom NOM », vient de la liste de la
   classe et ne se change pas de son côté (la base le verrouille). */
let carteInit = { identifiant: '', err: '' };

const carteMessage = x => (/Invalid|credentials|refus/i.test(String(x && x.message))
  ? 'Identifiant ou code incorrect' : 'Connexion impossible : vérifie le réseau');

async function connecterCarte(identifiant, code) {
  await signIn(emailCarte(identifiant), normCode(code));
  carteInit = { identifiant: '', err: '' };
  await apresConnexion();
}

function carteHtml() {
  return `<form class="lf" id="lf" autocomplete="on">
      <div class="lrow">${svg(I.user)}
        <input id="cid" placeholder="Identifiant" aria-label="Identifiant" value="${esc(carteInit.identifiant)}"
          autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="next"></div>
      <div class="lrow">${svg(I.key)}
        <input id="ccode" class="lcode" placeholder="Code" aria-label="Code" maxlength="9"
          autocomplete="current-password" autocapitalize="characters" autocorrect="off" spellcheck="false" enterkeyhint="go"></div>
      <div class="lerr" id="le">${esc(carteInit.err)}</div>
      <button class="cta" id="go" type="submit">Se connecter${svg(I.arrow)}</button>
      <p class="lnote">${svg(I.key)}<span>L’identifiant et le code sont sur la carte remise par ton professeur.
        Avec l’appareil photo, vise le QR code de la carte : tu entres directement.</span></p>
    </form>`;
}

function bindCarte() {
  const id = document.getElementById('cid'), code = document.getElementById('ccode'),
        err = document.getElementById('le'), btn = document.getElementById('go');
  code.oninput = () => {
    const v = formatCode(code.value);
    if (v !== code.value) code.value = v;
  };
  document.getElementById('lf').onsubmit = async e => {
    e.preventDefault();
    if (loginBusy) return;
    if (!normIdentifiant(id.value)) { err.textContent = 'Écris ton identifiant'; id.focus(); return; }
    if (!codeComplet(code.value)) { err.textContent = 'Le code a huit caractères, sans 0, O, 1, I ni L'; code.focus(); return; }
    setLoginBusy(true); btn.disabled = true; err.textContent = '';
    btn.firstChild.textContent = 'Connexion…';
    try { await connecterCarte(id.value, code.value); }
    catch (x) {
      err.textContent = carteMessage(x);
      btn.disabled = false; btn.firstChild.textContent = 'Se connecter';
    }
    setLoginBusy(false);
  };
  setTimeout(() => (id.value ? code : id).focus(), 80);
}

/* « ?carte=identifiant-CODE » : le QR code imprimé sur la carte. Rend
   `true` si une session vient de s'ouvrir (le démarrage continue alors
   normalement). Un autre compte déjà ouvert sur l'appareil n'est fermé que
   s'il n'a plus rien à envoyer : sinon ses changements seraient perdus. */
export async function consumeCarte() {
  const p = new URLSearchParams(location.search);
  if (!p.has('carte')) return false;
  const c = lireCarte(location.search);
  p.delete('carte');
  history.replaceState(null, '', location.pathname + (p.toString() ? '?' + p : '') + location.hash);
  if (!c) return false;
  if (auth && auth.email === emailCarte(c.identifiant)) return false;     // déjà ce compte
  if (auth && pending()) {
    toast(I.x, 'Un autre compte est ouvert ici et n’a pas fini d’envoyer ses changements');
    return false;
  }
  if (auth) logout();
  try {
    await signIn(emailCarte(c.identifiant), c.code);
    return true;
  } catch (x) {
    carteInit = { identifiant: c.identifiant, err: carteMessage(x) };
    setLoginMode('carte');
    return false;
  }
}

export function loginView() {
  const up = loginMode === 'up', carte = loginMode === 'carte';
  $.innerHTML = `<div class="login">
    <img class="logo" src="icons/icon-192.png" alt="">
    <div class="lt">Folio</div>
    <div class="lsub">Tes cours, reliés en livres.</div>
    ${cartePassage()}
    <div class="seg lseg" id="lmode">
      <button data-lm="in" class="${up || carte ? '' : 'on'}">Connexion</button>
      <button data-lm="up" class="${up ? 'on' : ''}">Créer un compte</button>
      <button data-lm="carte" class="${carte ? 'on' : ''}">Carte élève</button>
    </div>
    ${carte ? carteHtml() : `<form class="lf" id="lf" autocomplete="on">
      <div class="lrow">${svg(I.mail)}
        <input id="em" type="email" placeholder="Adresse e-mail" autocomplete="username"
          autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="next"></div>
      <div class="lrow">${svg(I.lock)}
        <input id="pw" type="password" placeholder="Mot de passe" autocomplete="current-password"
          autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="go">
        <button type="button" class="peek" id="pk">${svg(I.eye)}</button></div>
      <div class="lerr" id="le"></div>
      ${up ? `<label class="lage"><input type="checkbox" id="age">
        <span>J’ai 15 ans ou plus, et j’accepte les conditions d’utilisation.</span></label>` : ''}
      <button class="cta" id="go" type="submit">${up ? 'Créer le compte' : 'Se connecter'}${svg(I.arrow)}</button>
      ${up ? '' : `<button class="lnk" id="forgot" type="button">Mot de passe oublié</button>`}
    </form>`}
    <div class="lleg">${Object.entries(LEGAL_TITRES).map(([k, t]) =>
      `<button data-legal="${k}">${esc(t)}</button>`).join('<i>·</i>')}</div>
  </div>`;
  document.getElementById('lmode').onclick = e => {
    const b = e.target.closest('[data-lm]'); if (!b) return;
    setLoginMode(b.dataset.lm); loginView();
  };
  lierPassage();
  if (carte) return bindCarte();
  const em = document.getElementById('em'), pw = document.getElementById('pw'),
        err = document.getElementById('le'), btn = document.getElementById('go');
  document.getElementById('pk').onclick = () => {
    const on = pw.type === 'password';
    pw.type = on ? 'text' : 'password';
    document.getElementById('pk').innerHTML = svg(on ? I.eyeoff : I.eye);
    pw.focus();
  };
  const fg = document.getElementById('forgot');
  if (fg) fg.onclick = async () => {
    if (!em.value.trim()) { err.textContent = 'Renseigne ton adresse d’abord'; em.focus(); return; }
    err.textContent = 'Envoi…';
    try { await resetPassword(em.value); err.textContent = 'Lien envoyé à ' + em.value.trim(); }
    catch (x) { err.textContent = 'Envoi impossible'; }
  };
  document.getElementById('lf').onsubmit = async e => {
    e.preventDefault();
    if (loginBusy) return;
    if (!validateLoginForm(up, em, pw, err)) return;
    setLoginBusy(true); btn.disabled = true; err.textContent = '';
    btn.firstChild.textContent = up ? 'Création…' : 'Connexion…';
    await doLogin(up, em, pw, err, btn);
    setLoginBusy(false);
  };
  setTimeout(() => em.focus(), 80);
}

/* ---------- petites explications ----------
   Les paragraphes posés sous chaque réglage se lisaient comme une notice
   et noyaient les réglages eux-mêmes. Ne reste qu'une pastille « ? », et
   seulement là où le nom ne suffit pas : ce que « rapide » enchaîne, ce
   que le journal mesure.
   Tout ce qui se devine au premier coup d'œil n'a pas de pastille. */
export const HELP = {
  classement: ['Classement',
    'Les pages lues par toi et tes amis : ces sept derniers jours, ces trente derniers jours ou depuis toujours.'],
  classementClub: ['Classement du club', 'Les pages lues par chaque membre ces sept derniers jours.'],
  modes: ['En direct ou à son rythme',
    'En direct : tout le monde joue en même temps avec un code à six chiffres, et voit le classement après chaque question.' +
    '\n\nÀ son rythme : un QCM de dix questions, les mêmes pour tous. Chacun le joue quand il veut, une seule fois.'],
  jMatieres: ['Temps par matière',
    'Chaque minute reste dans la matière où tu l’as passée. Changer la matière d’un livre, le fusionner ou le ' +
    'supprimer ne réécrit pas le passé : seules les lectures suivantes vont ailleurs.'],
  jRappel: ['Rappel estimé',
    'La chance, d’après le moteur, que tu te souviennes en ce moment d’une page déjà lue. Elle baisse chaque jour ' +
    'sans lecture et remonte à chaque révision.'],
  jFidele: ['Après une pause',
    'Tes réponses justes quand tu reviens sur une page après quelques jours, quelques semaines ou quelques mois : ' +
    'c’est là qu’on voit ce qui tient vraiment.'],
  fast: ['Mode rapide',
    'Une bonne réponse enchaîne toute seule sur la suivante, au quiz comme en QCM et en vrai/faux. ' +
    'Sans lui, la correction reste à l’écran jusqu’à ce que tu appuies sur Suivant.']
};

export const hlp = k => `<button class="hq" data-help="${k}" aria-label="${esc(HELP[k][0])}, explication">?</button>`;
