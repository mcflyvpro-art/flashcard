import { $ } from './racine.js';
import { I, svg } from './icones.js';
import { isLeech } from './file.js';
import {
  DECKPAGE, db, deckOpen, deckQ, deckShow, legalBack, legalTab, loginBusy, loginMode, prof,
  sel, setAnimate, setDb, setDeckQ, setDeckShow, setLoginBusy, setLoginMode, setSel,
  setTyping, typing, view
} from './data/etat.js';
import {
  cardIcon, cardRich, go, mixBar, render
} from './bibliotheque.js';
import {
  MAXB, MAXF, STATE, cstate, nextIn, plain
} from './carte-media.js';
import { accueil } from './classement.js';
import {
  deck, esc, load, plur, pull, pushUndo, resetPassword, saveDeck, signIn, signUp, sty, subj
} from './coeur-sync.js';
import { dueCount, simpleMode } from './import-cartes.js';
import { consumeGoto } from './interactions.js';
import { consumeHash, maybeTour } from './onboarding.js';
import { norm } from './quiz.js';

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
  return `<div class="selb">
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

export function deckView() {
  const d = deck(view.id); if (!d) return go('home');
  const s = subj(d.subject);
  /* Le filtre ne retire jamais de carte : il n'en montre qu'une partie.
     Tant qu'il est posé, la poignée disparaît — réordonner une liste
     filtrée écrirait des positions qui ne veulent rien dire. */
  const nq = norm(deckQ);
  const shown = nq ? d.cards.filter(c => norm(plain(c.f)).includes(nq) || norm(plain(c.b)).includes(nq))
                   : d.cards;
  /* Un paquet de mille cartes, c'est quatre mille champs de saisie à
     construire avant d'afficher quoi que ce soit : plusieurs secondes de
     page blanche sur un téléphone. On en pose une page, le reste arrive
     quand le bas de la liste approche. */
  const part = shown.slice(0, deckShow);
  const rest = shown.length - part.length;
  $.innerHTML = `
    <div class="bar">
      <button class="ic" data-act="home" aria-label="Retour">${svg(I.back)}</button>
      <div style="flex:1"></div>
      <button class="ic" data-act="menu" aria-label="Menu du livre">${svg(I.more)}</button>
    </div>
    <div class="head" style="${sty(s)}">
      <div class="t" id="dn" contenteditable="plaintext-only" spellcheck="false" enterkeyhint="done">${esc(d.name)}</div>
      <div class="s">
        <span>${svg(I.tag)}${esc(s.name)}</span><b></b>
        <span>${svg(I.card)}${plur(d.cards.length, 'page')}</span>
        ${!simpleMode() && dueCount(d) ? `<b></b><span>${svg(I.play)}${dueCount(d)} à revoir</span>` : ''}
        ${d.hidden ? `<b></b><span>${svg(I.eyeoff)}Masqué</span>` : ''}
      </div>
    </div>
    ${prof.comp && prof.comp.livre === d.id ? `<button class="cta read" data-act="pretour">
        ${svg(I.share)}Donner ce devoir</button>`
      : `<button class="cta read" data-act="study">${svg(I.play)}Lire${
          !simpleMode() && dueCount(d) ? ` <b>${dueCount(d)}</b>` : ''}</button>`}
    <div class="acts">
      <button data-act="quizdeck">${svg(I.pen)}Récitation</button>
      <button data-act="mcq">${svg(I.grid)}QCM</button>
      <button data-act="match">${svg(I.link)}Association</button>
      <button data-act="sharepick">${svg(I.share)}Partager</button>
    </div>
    ${simpleMode() ? '' : mixBar(d)}
    <div class="lbl"><span>Pages</span>
      ${d.cards.length > 5 ? `<button class="pick ico ${deckQ ? 'on' : ''}" data-act="deckfind"
        aria-label="Chercher dans ce livre">${svg(I.search)}</button>` : ''}
      ${d.cards.length ? `<button class="pick ${sel ? 'on' : ''}" data-act="selmode">${
        svg(sel ? I.check : I.pick)}${sel ? 'Terminer' : 'Sélectionner'}</button>` : ''}
      <span>${shown.length === d.cards.length ? d.cards.length : shown.length + ' / ' + d.cards.length}</span></div>
    ${deckOpen ? `<div class="fld deckfld"><input id="dq" type="search"
      placeholder="Chercher dans ce livre" autocomplete="off" autocapitalize="none"
      spellcheck="false" value="${esc(deckQ)}" aria-label="Chercher dans ce livre"></div>` : ''}
    <div class="rows ${sel ? 'picking' : ''}">
      ${!shown.length ? `<div class="note" style="padding:14px 4px">Aucune carte ne contient « ${esc(deckQ)} ».</div>` : ''}
      ${part.map((c, i) => `
        <div class="row ${c.x ? 'off' : ''} ${sel && sel.has(c.id) ? 'pk' : ''}" data-id="${c.id}" style="--i:${i}">
          ${sel ? `<button class="ck" data-pkc="${c.id}" aria-label="Sélectionner">${svg(I.check)}</button>`
            : `${nq ? '' : `<button class="grip" aria-label="Déplacer">${svg(I.grip)}</button>`}
              ${simpleMode() ? '' : `<i class="cst ${cstate(c)}" title="${STATE[cstate(c)]}${isLeech(c) ? ' · coriace' : ''}${c.d ? ' · dans ' + nextIn(c) : ''}"></i>`}`}
          <div class="fl">
            <input value="${esc(c.f)}" data-k="f" placeholder="Recto" ${sel ? 'tabindex="-1"' : ''}>
            <input class="b" value="${esc(c.b)}" data-k="b" placeholder="Verso" ${sel ? 'tabindex="-1"' : ''}>
          </div>
          ${sel ? '' : `<button class="x ${cardRich(c) ? 'on' : ''}" data-card="${c.id}"
            title="Type, étiquettes, image, son">${svg(cardIcon(c))}</button>
          <button class="x sus ${c.x ? 'on' : ''}" data-sus="${c.id}"
            title="${c.x ? 'Réactiver' : 'Suspendre'}">${svg(c.x ? I.eyeoff : I.eye)}</button>
          <button class="x" data-rm="${c.id}">${svg(I.x)}</button>`}
        </div>`).join('')}
      ${rest ? `<div class="more" id="more">${plur(rest, 'page')} de plus…</div>` : ''}
      ${sel ? '' : `<div class="duo ghost">
        <button data-act="add">${svg(I.plus)}Page</button>
        <button data-act="paste">${svg(I.down)}Coller</button>
      </div>`}
    </div>
    ${sel ? selBar(d) : ''}`;
  const more = document.getElementById('more');
  if (more) {
    const io2 = new IntersectionObserver(es => {
      if (!es.some(e => e.isIntersecting)) return;
      io2.disconnect();
      setDeckShow(deckShow + DECKPAGE); setAnimate(false); render();
    }, { rootMargin: '400px' });
    io2.observe(more);
  }
  const t = document.getElementById('dn');
  t.addEventListener('blur', () => {
    const v = t.textContent.replace(/\s+/g, ' ').trim();
    if (v !== d.name) { d.name = v || 'Paquet'; saveDeck(d); t.textContent = d.name; }
  });
  t.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); t.blur(); } });
  $.querySelectorAll('.row input').forEach(inp => inp.addEventListener('input', () => {
    const c = d.cards.find(x => x.id === inp.closest('.row').dataset.id);
    if (!c) return;
    c[inp.dataset.k] = inp.value;
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
  if (!nq) bindReorder(d);
  const dq = document.getElementById('dq');
  if (dq) {
    let dt = 0;
    dq.addEventListener('input', () => {
      setDeckQ(dq.value);
      clearTimeout(dt);
      dt = setTimeout(() => {
        /* on garde le champ vivant et on ne refait que la liste : sinon
           le clavier se referme entre deux lettres */
        const keep = document.activeElement === dq && dq.selectionStart;
        setAnimate(false); render();
        const again = document.getElementById('dq');
        if (again && keep != null) { again.focus(); again.setSelectionRange(keep, keep); }
      }, 160);
    });
    if (!deckQ) setTimeout(() => dq.focus(), 50);
  }
}

/* ---------- réordonner par glisser-déposer ----------
   Seule la poignée prend le doigt (touch-action:none) : partout ailleurs
   la page défile normalement. Pendant le glissé rien n'est reconstruit —
   les lignes se décalent par transform, une écriture par image — et
   l'ordre n'est enregistré qu'au lâcher. */
function bindReorder(d) {
  const wrap = $.querySelector('.rows'); if (!wrap || sel) return;
  let g = null;
  const draw = () => {
    g.raf = 0;
    const { row, rows, from, step } = g;
    row.style.transform = `translate3d(0,${g.dy}px,0)`;
    g.to = Math.max(0, Math.min(rows.length - 1, from + Math.round(g.dy / step)));
    rows.forEach((r, i) => {
      if (r === row) return;
      const shift = g.to > from && i > from && i <= g.to ? -step
                  : g.to < from && i >= g.to && i < from ? step : 0;
      r.style.transform = shift ? `translate3d(0,${shift}px,0)` : '';
    });
  };
  wrap.addEventListener('pointerdown', e => {
    const h = e.target.closest('.grip'); if (!h || g) return;
    const rows = [...wrap.querySelectorAll('.row')];
    const row = h.closest('.row'), from = rows.indexOf(row);
    if (from < 0 || rows.length < 2) return;
    g = { row, rows, from, to: from, dy: 0, raf: 0, y0: e.clientY,
          step: rows[1].offsetTop - rows[0].offsetTop, pid: e.pointerId };
    /* le doigt garde la poignée même s'il sort de la liste ; si la capture
       est refusée (doigt déjà relâché), le glissé marche quand même, les
       mouvements étant écoutés sur la liste elle-même */
    try { h.setPointerCapture(e.pointerId); } catch (x) {}
    row.classList.add('drag'); wrap.classList.add('dragging');
    e.preventDefault();
  });
  wrap.addEventListener('pointermove', e => {
    if (!g || e.pointerId !== g.pid) return;
    g.dy = e.clientY - g.y0;
    if (!g.raf) g.raf = requestAnimationFrame(draw);
  });
  const drop = e => {
    if (!g || (e && e.pointerId !== g.pid)) return;
    cancelAnimationFrame(g.raf);
    const { from, to, rows, row } = g;
    rows.forEach(r => r.style.transform = '');
    row.classList.remove('drag'); wrap.classList.remove('dragging');
    g = null;
    if (from === to) return;
    pushUndo('Ordre des cartes', [d.id]);
    d.cards.splice(to, 0, d.cards.splice(from, 1)[0]);
    saveDeck(d); render();
  };
  wrap.addEventListener('pointerup', drop);
  wrap.addEventListener('pointercancel', drop);
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

export function loginView() {
  const up = loginMode === 'up';
  $.innerHTML = `<div class="login">
    <img class="logo" src="icons/icon-192.png" alt="">
    <div class="lt">Folio</div>
    <div class="lsub">Tes cours, reliés en livres.</div>
    <div class="seg lseg" id="lmode">
      <button data-lm="in" class="${up ? '' : 'on'}">Connexion</button>
      <button data-lm="up" class="${up ? 'on' : ''}">Créer un compte</button>
    </div>
    <form class="lf" id="lf" autocomplete="on">
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
    </form>
    <div class="lleg">${Object.entries(LEGAL).map(([k, v]) =>
      `<button data-legal="${k}">${esc(v[0])}</button>`).join('<i>·</i>')}</div>
  </div>`;
  document.getElementById('lmode').onclick = e => {
    const b = e.target.closest('[data-lm]'); if (!b) return;
    setLoginMode(b.dataset.lm); loginView();
  };
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
    if (!em.value.trim() || !pw.value) { err.textContent = 'Renseigne les deux champs'; return; }
    /* Six caractères se cassent hors ligne en quelques secondes. Dix est
       le plancher, et il ne vaut que parce que le même est réglé côté
       Supabase : ce contrôle-ci ne protège que la personne qui se sert du
       formulaire, pas celle qui appelle l'API directement. */
    if (up && pw.value.length < PWMIN) {
      err.textContent = `Mot de passe : ${PWMIN} caractères minimum`; return;
    }
    /* La case n'est pas une formalité : en dessous de 15 ans, le
       consentement d'un parent est requis, et on ne peut pas le recueillir
       ici. Mieux vaut ne pas ouvrir le compte que de faire semblant. */
    const age = document.getElementById('age');
    if (up && age && !age.checked) {
      err.textContent = 'Confirme que tu as 15 ans ou plus'; return;
    }
    setLoginBusy(true); btn.disabled = true; err.textContent = '';
    btn.firstChild.textContent = up ? 'Création…' : 'Connexion…';
    try {
      if (up) {
        const done = await signUp(em.value, pw.value);
        if (!done) {
          err.textContent = 'Compte créé. Confirme l’e-mail reçu, puis connecte-toi.';
          setLoginMode('in'); setLoginBusy(false); loginView();
          return;
        }
      } else await signIn(em.value, pw.value);
      setDb(load());
      await pull();
      /* Un lien de partage ouvert alors qu'on n'était pas connecté attend
         dans l'adresse : c'est maintenant qu'il faut le suivre, sinon on
         atterrit sur l'accueil sans savoir ce qu'on venait voir. */
      if (!consumeHash() && !consumeGoto()) { go('home'); accueil(); }
      maybeTour();
    } catch (x) {
      const m = String(x.message || '');
      err.textContent = /already|exist|registered/i.test(m) ? 'Cette adresse a déjà un compte'
        : /Invalid|credentials|refus/i.test(m) ? 'E-mail ou mot de passe incorrect'
        : up ? 'Inscription impossible' : 'Connexion impossible';
      btn.disabled = false;
      btn.firstChild.textContent = up ? 'Créer le compte' : 'Se connecter';
    }
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
  fast: ['Mode rapide',
    'Une bonne réponse enchaîne toute seule sur la suivante, au quiz comme en QCM et en vrai/faux. ' +
    'Sans lui, la correction reste à l’écran jusqu’à ce que tu appuies sur Suivant.']
};

export const hlp = k => `<button class="hq" data-help="${k}" aria-label="${esc(HELP[k][0])}, explication">?</button>`;
