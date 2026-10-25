// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { $ } from '../racine.js';
import { I, svg } from '../icones.js';
import { isLeech } from '../file.js';
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
   Trois textes, lisibles sans compte et hors ligne. Ils vivent dans le
   code plutôt que sur un site à part pour deux raisons : il faut pouvoir
   les lire AVANT de créer un compte — un consentement donné sans avoir pu
   lire n'en est pas un — et l'app doit rester entière hors réseau.

   Les passages entre ⟦crochets⟧ demandent une information que seul
   l'éditeur possède. Tant qu'ils sont là, ces textes ne sont pas
   opposables : ils sont une ossature juste, pas un document signé. Faire
   relire le contrat de sous-traitance par un juriste avant tout
   établissement — pas ces trois pages-ci, qui tiennent debout seules. */
const EDITEUR = '⟦nom ou raison sociale de l’éditeur⟧';

const CONTACT = '⟦adresse de contact⟧';

const LEGALV = '12 septembre 2026';

const LEGAL = {
  cgu: ['Conditions d’utilisation', `
**Ce que Folio est.** Une application de révision : tu écris des fiches,
l’app décide quand te les représenter, et tu peux en prêter à des lecteurs
que tu as toi-même ajoutés. Le service est fourni tel quel, sans garantie
de résultat scolaire.

**Âge minimum : 15 ans.** En France, c’est l’âge à partir duquel on peut
consentir seul au traitement de ses données par un service en ligne.
En dessous, il faut l’accord d’un parent ou du responsable légal : écris à
${CONTACT} avant de créer un compte.

**Ton compte est à toi.** Une adresse e-mail, un mot de passe d’au moins
${PWMIN} caractères, et tu en es responsable. Ne le prête pas : ce qui est
fait depuis ton compte est réputé fait par toi.

**Ce que tu écris t’appartient.** Tes fiches restent tienne. En publiant un
livre sur une étagère ou en le prêtant à un lecteur, tu autorises
seulement les personnes concernées à le lire et à le copier chez elles —
rien de plus, et tu peux le retirer quand tu veux.

**Ce qui n’a pas sa place ici.** Contenu illégal, haineux, sexuel,
harcelant ou qui expose la vie privée d’autrui ; contenu protégé par un
droit d’auteur que tu n’as pas ; usurpation d’identité. Un compte qui s’en
sert ainsi peut être suspendu sans préavis.

**Ce que nous ne faisons pas.** Aucune publicité, aucun traceur, aucune
revente de données, aucun profilage publicitaire. Ce n’est pas une
promesse commerciale : c’est la description du code.

**Interruptions.** Le service peut s’arrêter pour maintenance, ou changer.
Tes données restent exportables. Si Folio devait fermer, tu serais prévenu
avec un délai raisonnable pour les récupérer.

**Droit applicable.** Droit français. En cas de différend, on cherche
d’abord une solution à l’amiable en écrivant à ${CONTACT}.

*Version du ${LEGALV}.*`],

  vie: ['Confidentialité', `
**Qui traite tes données.** ${EDITEUR}, éditeur de Folio, joignable à
${CONTACT}. Lorsque Folio est déployé par un établissement scolaire, c’est
l’établissement qui décide du traitement et nous n’agissons que sur ses
instructions.

**Ce qui est collecté, et pourquoi.**

- *Ton adresse e-mail et ton mot de passe* — pour ouvrir la session et te
  permettre de la récupérer. Le mot de passe n’est jamais lisible, même
  par nous.
- *Ton pseudo et ton nom affiché*, si tu en mets — pour que les lecteurs
  que tu ajoutes sachent qui tu es. Le pseudo sert à t’ajouter sans faire
  circuler d’adresse e-mail.
- *Tes livres et tes fiches*, y compris les images et les sons que tu y
  attaches — c’est le contenu du service.
- *Ton historique de révision* : ce que tu as répondu, quand, juste ou
  faux, en combien de temps — c’est ce qui permet au moteur de choisir
  quand une fiche revient, et de tracer tes courbes.
- *Tes réglages.*
- *Les envois entre lecteurs* : les livres prêtés et le message qui
  accompagne.
- *L’usage de l’IA* : le nombre d’appels et leur coût, pour tenir les
  plafonds de dépense. Le texte de tes cours n’est pas conservé.
- *Un signalement que tu fais ou que tu reçois* : une copie du contenu visé
  est jointe, pour qu’elle reste lisible même si l’original est effacé
  entretemps. Seuls les modérateurs y accèdent, pour instruire la plainte.
- *Qui tu bloques.*

Aucun traceur publicitaire, aucune mesure d’audience, aucun cookie autre
que ce qui est strictement nécessaire à ta session.

**Sur quelle base.** L’exécution du service que tu demandes en créant un
compte. Les fonctions de partage — étagère, défis, classement — ne
s’activent que par ton geste, et tu peux revenir en arrière. En
établissement, la base est la mission d’intérêt public de l’établissement.

**Où vivent ces données.** Dans une base Supabase hébergée en Irlande
(Amazon Web Services, région eu-west-1), dans l’Union européenne. Supabase
Inc. et Amazon sont des sociétés de droit américain : un accès par une
autorité américaine ne peut donc pas être exclu, même si les serveurs sont
européens. L’application elle-même est servie par ⟦hébergeur du site⟧.

**L’intelligence artificielle.** Si tu utilises le bouton de génération de
fiches, le texte ou la photo que tu fournis est envoyé à l’API d’Anthropic,
aux États-Unis, le temps de fabriquer les fiches. Ce texte ne sert pas à
entraîner de modèle. Cette fonction ne part jamais toute seule : elle
n’existe que si tu appuies.

**Combien de temps.** Tes livres restent tant que ton compte existe. Un
livre supprimé part en corbeille et s’efface définitivement au bout de 30
jours, purgés chaque nuit sans qu’il soit besoin de rouvrir l’écran
Corbeille. Les dix dernières versions d’un livre sont conservées. Ton
historique de révision est gardé tant que ton compte vit, puisque c’est
lui qui fait fonctionner le moteur. Un signalement reste le temps de son
instruction, et douze mois après sa clôture — le temps de répondre à une
contestation — puis s’efface. Tout disparaît à la suppression du compte.

**Qui d’autre peut voir.** Personne, par défaut. Un autre compte ne voit
tes fiches que si tu les lui as prêtées, ou si tu les as posées sur une
étagère dont il fait partie. Ce n’est pas qu’une règle d’affichage : la
base elle-même refuse de rendre les lignes d’un autre compte. Les images
et les sons ne quittent jamais ton compte, même quand tu prêtes un livre :
seul le texte des fiches voyage. Si tu es signalé, un modérateur voit la
copie jointe au signalement, rien d’autre de ton compte. En établissement
scolaire, ton professeur voit si tu as ouvert et rendu ses devoirs, jamais
tes réponses ni tes livres personnels ; le référent de l’établissement
peut, lui, corriger ton identité ou refaire ton mot de passe — chacun de
ses gestes sur ton compte est tracé et consultable par l’établissement.

**Tes droits.** Tu peux consulter, corriger, exporter et effacer tes
données. L’export du journal se fait depuis l’écran Journal de lecture ;
la suppression définitive du compte depuis Réglages, et elle est
immédiate. Pour tout le reste, écris à ${CONTACT} ; réponse sous un mois.
Tu peux aussi saisir la CNIL.

**En cas de fuite.** Si des données venaient à être exposées, les
personnes concernées et, le cas échéant, la CNIL seraient prévenues dans
les délais prévus par le règlement.

*Version du ${LEGALV}.*`],

  mentions: ['Mentions légales', `
**Éditeur.** ${EDITEUR}
⟦statut juridique, adresse postale, et numéro SIREN s’il existe⟧
Contact : ${CONTACT}

**Directeur de la publication.** ⟦nom⟧

**Hébergement de l’application.** ⟦hébergeur du site : nom et adresse⟧

**Hébergement des données.** Supabase Inc., infrastructure Amazon Web
Services, région eu-west-1 (Irlande, Union européenne).

**Génération de fiches par IA.** Anthropic PBC (États-Unis), appelée
uniquement lorsque tu le demandes.

**Propriété.** Le nom Folio, son identité visuelle et le code de
l’application appartiennent à l’éditeur. Les fiches écrites par les
utilisateurs restent la propriété de leurs auteurs.

**Signaler un contenu ou un problème.** ${CONTACT}

*Version du ${LEGALV}.*`]
};

/* Tant qu'un ⟦crochet⟧ traîne dans ces trois textes, l'app ne dit pas qui
   traite les données ni comment le joindre — exigé dès la collecte par
   l'art. 13.1.a et .b du RGPD (et par la LCEN pour les mentions légales).
   Le commentaire au-dessus d'EDITEUR/CONTACT prévenait déjà ; ce signal-ci
   reste visible en production tant que le remplacement n'est pas fait. */
if (/⟦/.test(EDITEUR + CONTACT + Object.values(LEGAL).map(v => v[1]).join(''))) {
  console.error('Folio : mentions légales incomplètes — des ⟦placeholders⟧ sont encore '
    + 'servis aux utilisateurs (identité/coordonnées du responsable de traitement, art. 13 RGPD). '
    + 'Voir EDITEUR, CONTACT et LEGAL.mentions dans app.js.');
}

/* Le rendu : gras, italique, listes et paragraphes. Cinq lignes plutôt
   qu'une bibliothèque, pour la même raison que le reste de l'app. */
function legalHtml(src) {
  return src.trim().split(/\n\s*\n/).map(b => {
    const t = b.trim();
    const fmt = s => esc(s).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
                           .replace(/\*([^*]+)\*/g, '<i>$1</i>');
    if (/^- /.test(t)) {
      return `<ul>${t.split(/\n(?=- )/).map(li =>
        `<li>${fmt(li.replace(/^- /, '').replace(/\n\s+/g, ' '))}</li>`).join('')}</ul>`;
    }
    return `<p>${fmt(t.replace(/\n/g, ' '))}</p>`;
  }).join('');
}

export function legalView() {
  const [title, body] = LEGAL[legalTab];
  $.innerHTML = `
    <div class="bar"><button class="ic" data-act="${legalBack === 'login' ? 'tolog' : 'settings'}"
        aria-label="Retour">${svg(I.back)}</button><h1>${esc(title)}</h1></div>
    <div class="page">
      <div class="pills" id="lgTabs">${Object.entries(LEGAL).map(([k, v]) =>
        `<button class="p${legalTab === k ? ' on' : ''}" data-legal="${k}">${esc(v[0])}</button>`).join('')}</div>
      <div class="legal">${legalHtml(body)}</div>
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
    <div class="lleg">${Object.entries(LEGAL).map(([k, v]) =>
      `<button data-legal="${k}">${esc(v[0])}</button>`).join('<i>·</i>')}</div>
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
   seulement là où le nom ne suffit pas : ce qu'on perd en éteignant le
   moteur, ce que « ratées » veut dire, ce que « rapide » enchaîne.
   Tout ce qui se devine au premier coup d'œil n'a pas de pastille. */
export const HELP = {
  classement: ['Classement',
    'Les pages lues par toi et tes amis : ces sept derniers jours, ces trente derniers jours ou depuis toujours.'],
  classementClub: ['Classement du club', 'Les pages lues par chaque membre ces sept derniers jours.'],
  modes: ['En direct ou à son rythme',
    'En direct : tout le monde joue en même temps avec un code à six chiffres, et voit le classement après chaque question.' +
    '\n\nÀ son rythme : un QCM de dix questions, les mêmes pour tous. Chacun le joue quand il veut, une seule fois.'],
  simple: ['Mode simple',
    'Le moteur estime, pour chaque page, le jour où tu serais sur le point de l’oublier, et te ' +
    'la redonne juste avant.\n\nL’éteindre rend l’app manuelle — les pages défilent dans ' +
    'l’ordre choisi, tu balaies à droite si tu sais, à gauche sinon. Ta progression reste ' +
    'enregistrée et repart où elle en était dès que tu le rallumes.'],
  dr: ['Rétention visée',
    'La part de tes pages que tu veux encore savoir au moment où elles reviennent.\n\n' +
    'À 90 %, une page sur dix t’échappe au retour : c’est le réglage conseillé, celui qui ' +
    'demande le moins de révisions pour ce que tu retiens.\n\nViser plus haut fait revenir ' +
    'les pages plus souvent et coûte beaucoup plus de travail pour peu de mémoire en plus. ' +
    'Viser plus bas allège les journées mais laisse filer davantage.'],
  order: ['Ordre des cartes',
    'Aléatoire : mélangées à chaque séance.\nDu livre : l’ordre dans lequel tu les as écrites.\n' +
    'Ratées : celles que tu manques le plus souvent d’abord.\nUrgentes : les plus en retard d’abord.'],
  tune: ['Régler le moteur sur moi',
    'Les réglages d’origine décrivent une mémoire moyenne. Le moteur peut apprendre la ' +
    'tienne sur tes révisions passées : à quelle vitesse tu oublies, ce qui te résiste, ce ' +
    'qui tient tout seul.\n\nIl le fait de lui-même dès que tu as assez d’historique, et ' +
    'recommence de temps en temps. Ce bouton force le calcul tout de suite.'],
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
