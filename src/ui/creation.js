// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { $ } from '../racine.js';
import { I, svg } from '../icones.js';
import { parseText } from '../parseur.js';
import { comp, db, demoEtab, ia, offre, prefs, setComp, tuto, view } from '../data/etat.js';
import { go, render } from './bibliotheque.js';
import { donnerLivre } from './prof-porte.js';
import { MAXB, MAXF, markDups, markOver } from './carte-media.js';
import { deck, esc, plur, saveDeck, sty, subj, uid } from '../core/coeur-sync.js';
import { addDeck, toast } from './import-cartes.js';
import { bride, envie } from './bridage.js';
import { etatIA } from '../ia-mois.js';
import { iaPull } from '../core/abonnement.js';

/* ---------- création / import ----------
   Un seul écran pour toutes les façons de remplir un livre. Il y en avait
   deux — le composeur page par page, et une zone « coller » cachée derrière
   un bouton d'en-tête où vivaient aussi la photo, le fichier et l'IA —, et
   personne ne trouvait la seconde. Les méthodes sont maintenant des onglets
   côte à côte : on en choisit une, seule celle-là s'affiche, et les pages
   s'accumulent dans la même liste quelle que soit la méthode (on peut coller
   une liste, puis compléter à la main). Un collage ou un fichier texte passe
   par la zone de vérification : aperçu, doublons et correction à la main,
   avant que rien n'entre dans le paquet.
   L'IA n'est plus une méthode parmi d'autres (2026-11-07, demandé : « elle
   aide le user en toute circonstance, pour n'importe quoi ») : une barre
   sous chaque façon de créer (ui/prompt-ia.js). Les photos et le PDF y
   attendent avec la consigne qu'on veut ; sans rien, elle crée ou retouche
   la liste. */
export const resetComp = extra => { setComp({ subject: '', cards: [], edit: -1, mode: 'ecrire',
  text: '', dups: false, ...(extra || {}) }); };

const MODES = [
  { id: 'ecrire', icon: 'pen', nom: 'Écrire', aide: 'Carte par carte, au clavier. Entrée passe au verso, puis ajoute la carte.' },
  { id: 'coller', icon: 'rows', nom: 'Coller', aide: 'Une carte par ligne : le mot, puis une tabulation, un tiret ou « = », puis la réponse.' },
  { id: 'fichier', icon: 'file', nom: 'Fichier', aide: 'Un PDF de cours pour l’IA, ou un tableau : CSV, texte, export Anki ou Quizlet.' },
  { id: 'photo', icon: 'image', nom: 'Photo', aide: 'Une ou plusieurs pages de cours, prises sur le moment ou choisies dans la galerie.' }
];

/* Les pages en attente dans la zone de vérification : « Créer » les prend
   aussi, pour qu'un livre collé d'un coup n'exige pas deux boutons. */
let enAttente = null;

function titre(t) {
  return t ? esc(t.name) : comp.pour === 'devoir' ? 'Nouveau devoir' : 'Nouveau paquet';
}

function identiteHtml() {
  const mats = db.subjects.map(x => subj(x.id));
  return `<section class="cr-id">
      <input id="nm" class="cr-titre" placeholder="${comp.pour === 'devoir' ? 'Titre du devoir' : 'Titre du paquet'}"
        aria-label="Titre" spellcheck="false" enterkeyhint="next" value="${esc(comp.name || '')}">
      ${mats.length ? `<div class="cr-mat" role="group" aria-label="Matière">
        <button class="p ${comp.subject ? '' : 'on'}" data-nsubj="">Sans matière</button>
        ${mats.map(s => `<button class="p ${comp.subject === s.id ? 'on' : ''}" data-nsubj="${s.id}"
          style="${sty(s)}"><i></i>${esc(s.name)}</button>`).join('')}
      </div>` : ''}
    </section>`;
}

/* Toute l'IA est dans Mirandola+ (décidé le 2026-10-27) : avec Mirandola
   gratuit, et dans la démo sans compte, la barre de l'IA et les onglets qui
   ne vont qu'avec elle (Photo, Fichier) sont grisés, le disent au survol
   (`data-astuce`, app.css) et d'un « + » (`data-offre`) ; les toucher dit ce
   qu'ils feraient et comment les avoir — l'écran Mirandola+, ou la fenêtre
   de la démo (`envie`, ui/bridage.js). */
const PAYANTS = new Set(['fichier', 'photo']);
const iaPayante = () => !!demoEtab || bride('ia');
const payant = id => PAYANTS.has(id) && iaPayante();
export const ASTUCE_PAYANT = 'Avec Mirandola+';

/* L'IA du mois (2026-10-29, src/ia-mois.js) : ce qui reste, en pastille sur
   la barre de l'IA ; un compte Campus à qui sa licence n'accorde rien voit
   la barre et ces onglets grisés, et pourquoi. */
const etatDuMois = () => (iaPayante() ? null : etatIA(ia, offre));
const fermeIA = () => { const e = etatDuMois(); return e && e.cle === 'ferme' ? e.texte : ''; };
const ferme = id => (PAYANTS.has(id) ? fermeIA() : '');

function ongletHtml(m, mode) {
  const f = !payant(m.id) && ferme(m.id);
  const attrs = payant(m.id) ? `aria-disabled="true" data-astuce="${ASTUCE_PAYANT}" data-offre="plus"`
    : f ? `aria-disabled="true" data-astuce="${esc(f)}"` : `title="${m.aide}"`;
  return `<button role="tab" class="${m.id === mode ? 'on' : ''}${payant(m.id) ? ' payant' : ''}${f ? ' payant ferme' : ''}"
      data-cmode="${m.id}" aria-selected="${m.id === mode}" ${attrs}>${svg(I[m.icon])}<span>${m.nom}</span></button>`;
}

const ongletsHtml = mode => `<div class="cr-tabs" role="tablist" aria-label="Façon de créer les cartes">
    ${MODES.map(m => ongletHtml(m, mode)).join('')}
  </div>`;

/* Les onglets et la barre de l'IA se repeignent seuls, sur place, quand
   mon_ia répond. Jamais tout l'écran (on tape peut-être). */
function peindreOnglets() {
  const v = document.querySelector('.cr-tabs');
  if (!v || view.name !== 'import') return;
  v.outerHTML = ongletsHtml(modeDe());
  lierOnglets();
  majIA(true);
}
// un mode d'avant (l'onglet « Prompt », parti le 2026-11-07) retombe sur « Écrire »
const modeDe = () => (MODES.some(m => m.id === comp.mode) ? comp.mode : 'ecrire');

function lierOnglets() {
  $.querySelectorAll('[data-cmode]').forEach(b => b.onclick = () => {
    if (payant(b.dataset.cmode) && !ferme(b.dataset.cmode)) return envie(b.dataset.cmode);
    if (ferme(b.dataset.cmode)) return toast(I.x, ferme(b.dataset.cmode));
    if (b.dataset.cmode === comp.mode) return;
    comp.mode = b.dataset.cmode; comp.edit = -1; render();
  });
}

function ecrireHtml(s) {
  const ed = comp.edit >= 0;
  return `<div class="cr-comp" id="comp" style="${sty(s)}">
      <label class="cr-f"><span>Recto</span>
        <input id="cf" class="cf" placeholder="La question, le mot" enterkeyhint="next" spellcheck="false"></label>
      <label class="cr-f"><span>Verso</span>
        <input id="cb" class="cb" placeholder="La réponse" enterkeyhint="done" spellcheck="false"></label>
      <button class="cr-add" id="cadd">${svg(ed ? I.check : I.plus)}<span>${ed ? 'Enregistrer la carte' : 'Ajouter la carte'}</span></button>
    </div>`;
}

/* La zone de dépôt : un vrai bouton (le sélecteur de fichiers du système),
   et sur ordinateur on peut aussi y glisser le fichier depuis le bureau. */
const depotHtml = (id, icon, nom, sous) => `<button class="cr-drop" id="${id}">
    <i>${svg(icon)}</i><b>${nom}</b><span>${sous}</span></button>`;

const PLACE = {
  coller: 'chat = gatto&#10;chien = cane&#10;maison = casa&#10;&#10;ou ton cours, pour l’IA',
  fichier: ''
};

/* Photo : la zone de dépôt seule — les photos vont attendre dans la barre de
   l'IA. Fichier : un PDF y va aussi ; un fichier texte (CSV, Anki,
   Quizlet) se lit ici et passe par la zone de vérification. */
function lotHtml(mode) {
  if (mode === 'photo') return `${depotHtml('aishot', I.image, 'Prendre ou choisir des photos', '8 au plus')}
    <!-- Sans « capture », le sélecteur propose l'appareil photo ET la
         galerie (Photos sur iPhone, Galerie/Fichiers sur Android),
         et « multiple » permet d'en choisir plusieurs d'un coup. Avec
         « capture », les deux systèmes sautaient tout droit à
         l'appareil photo, sans jamais montrer la pellicule. -->
    <input type="file" id="fshot" accept="image/*" multiple hidden>`;
  const vide = !comp.text.trim() && mode === 'fichier';
  return `
    ${mode === 'fichier' ? depotHtml('aipdf', I.file, 'Choisir un fichier', 'PDF · CSV · Anki · Quizlet') : ''}
    <div class="cr-lot" id="lot" ${vide ? 'hidden' : ''}>
      ${mode === 'fichier' ? '<div class="cr-sous">À vérifier avant d’ajouter</div>' : ''}
      <div class="cr-ta"><textarea id="tx" placeholder="${PLACE[mode]}" aria-label="Cartes à ajouter"
        autocapitalize="off" autocorrect="off" spellcheck="false">${esc(comp.text)}</textarea></div>

      <div class="prev" id="prev"></div>
      <button class="pbtn cr-bulk" id="bulkadd" disabled>${svg(I.plus)}<span>Ajouter</span></button>
    </div>
    ${mode === 'fichier' ? '<input type="file" id="fpdf" accept=".pdf,.txt,.csv,.tsv,.apkg,application/pdf,text/plain,text/csv" hidden>' : ''}`;
}

function okLabel(t) {
  return t ? 'Ajouter au paquet' : comp.pour === 'devoir' ? 'Continuer' : 'Créer le paquet';
}

/* Recevoir le livre de quelqu'un, par son code (src/livre-code.js) : une
   façon d'avoir un nouveau livre, à côté de l'écrire. */
const boutonCode = t => (t || comp.pour === 'devoir' ? ''
  : `<button class="pbtn cr-code" data-ce="ouvrir">${svg(I.key)}J’ai un code</button>`);

export function importView() {
  const t = view.id ? deck(view.id) : null;
  const s = subj(t ? t.subject : comp.subject);
  if (comp.edit >= 0) comp.mode = 'ecrire';
  const mode = comp.mode = modeDe();
  enAttente = null;
  $.innerHTML = `
    <div class="bar">
      <button class="ic" data-act="${t ? 'deck' : comp.pour === 'devoir' ? 'prof' : 'home'}"
        aria-label="Retour">${svg(I.back)}</button>
      <h1>${titre(t)}</h1>
      ${boutonCode(t)}
    </div>
    <div class="crea">
      <div class="cr-main">
        ${t ? '' : identiteHtml()}
        ${ongletsHtml(mode)}
        <section class="cr-panel" role="tabpanel" data-k="cr:${mode}">
          ${mode === 'ecrire' ? ecrireHtml(s) : lotHtml(mode)}
        </section>
        <section class="pi" id="pi" aria-label="Demande à l’IA"></section>
      </div>
      <aside class="cr-pages">
        <div class="lbl"><span>Cartes</span><span id="cn">${comp.cards.length}</span></div>
        <div class="dlist" id="dlist"></div>
        <button class="cta cr-ok" id="ok" disabled>${okLabel(t)}${svg(I.check)}</button>
      </aside>
    </div>`;

  const nm = document.getElementById('nm');
  if (nm) { nm.addEventListener('input', () => comp.name = nm.value); nm.addEventListener('focus', () => { comp.champ = 'nm'; }); }
  lierOnglets();
  if (mode === 'ecrire') bindEcrire(nm);
  else if (mode === 'photo') bindDepots();
  else bindLot(t, mode);
  monterPrompt(t);
  paintDraft();
  bindOk(t);
  /* l'IA du mois, relue à chaque arrivée sur l'écran (au plus une fois par
     minute) : un paiement ou un Mirandola+ offert entre-temps s'y voit aussitôt */
  relireIA();
}
let iaLue = 0;
function relireIA() {
  if (demoEtab || (ia && Date.now() - iaLue < 60000)) return;
  iaLue = Date.now();
  iaPull().then(peindreOnglets);
}

/* Ce que l'IA sait du livre : son titre, sa matière, et la classe de qui
   l'écrit (prefs.niveau, prefs.annee, posés par l'accueil) — « 10 pages sur
   la Révolution » ne s'écrit pas pareil en 4e et en prépa. */
const NIVEAUX = { college: 'collège', lycee: 'lycée', sup: 'études supérieures' };
// ce que l'IA sait du paquet (la retouche d'un paquet entier s'en sert aussi, ui/retouche.js)
export function contexte(t) {
  const m = db.subjects.find(x => x.id === (t ? t.subject : comp.subject));
  const classe = prefs.annee ? `${prefs.annee}${NIVEAUX[prefs.niveau] ? ` (${NIVEAUX[prefs.niveau]})` : ''}` : NIVEAUX[prefs.niveau] || '';
  return [(t ? t.name : comp.name) || '', m ? 'matière : ' + m.name : '', classe ? 'classe : ' + classe : '']
    .filter(Boolean).join(' · ');
}

/* La barre de l'IA (2026-11-07), chargée à la demande (ui/prompt-ia.js),
   sous chaque façon de créer. Ce qu'elle rend va droit dans la liste : sans
   doublon du paquet ni de la liste, sans carte trop longue. */
let ia$ = null;                        // le module, une fois chargé
const majIA = tout => { if (ia$) ia$.repeindre(tout); };
const joindreIA = fichiers => (ia$ ? ia$.joindre(fichiers) : import('./prompt-ia.js').then(m => m.joindre(fichiers)));

function trierIA(cartes, avec) {
  const tri = cartes.map(c => ({ f: c.f, b: c.b }));
  markDups(tri, { cards: avec }); markOver(tri);
  return { keep: tri.filter(c => !c.dup && !c.big).map(c => ({ f: c.f, b: c.b })),
    dup: tri.filter(c => c.dup && !c.big).length, big: tri.filter(c => c.big).length };
}

function monterPrompt(t) {
  const n = document.getElementById('pi');
  import('./prompt-ia.js').then(m => {
    ia$ = m;
    if (!n.isConnected) return;
    m.monter(n, {
      contexte: () => contexte(t),
      etat: etatDuMois,
      bloque: () => (iaPayante() ? { cle: 'plus' } : fermeIA() ? { cle: 'ferme', texte: fermeIA() } : null),
      debloquer: () => (iaPayante() ? envie('ia') : toast(I.x, fermeIA())),
      texte: () => (comp.mode === 'coller' || comp.mode === 'fichier' ? (comp.text || '').trim() : ''),
      viderTexte: () => {
        comp.text = '';
        const tx = document.getElementById('tx');
        if (tx) { tx.value = ''; tx.dispatchEvent(new Event('input')); }
      },
      liste: () => comp.cards,
      ajouter: cartes => {
        const r = trierIA(cartes, (t ? t.cards : []).concat(comp.cards));
        comp.cards.push(...r.keep); paintDraft();
        return { n: r.keep.length, dup: r.dup, big: r.big };
      },
      // la liste entière, telle que l'IA la rend : seules les cartes trop longues restent dehors
      remplacer: cartes => {
        const tri = cartes.map(c => ({ f: c.f, b: c.b })); markOver(tri);
        comp.cards = tri.filter(c => !c.big).map(c => ({ f: c.f, b: c.b })); comp.edit = -1;
        paintDraft();
        return tri.filter(c => c.big).length;
      }
    });
  }).catch(() => { n.innerHTML = `<p class="cr-vide">${svg(I.cloud)}L’IA revient avec le réseau.</p>`; });
}

/* L'écran peut se redessiner pendant qu'on tape (une relecture de fond qui
   arrive, 2026-10-28) : le recto et le verso en cours sont gardés dans
   `comp` et remis, et le focus revient au champ où l'on était. Le focus
   posé à l'ouverture (60 ms plus tard, le temps que l'écran se pose) ne
   prend jamais un champ à qui y tape déjà : il envoyait la touche Entrée
   du verso au recto, et la page ne s'ajoutait pas. */
const enSaisie = () => {
  const a = document.activeElement;
  return !!(a && a.isConnected && /^(INPUT|TEXTAREA)$/.test(a.tagName) && a.closest('#app'));
};

function bindEcrire(nm) {
  const cf = document.getElementById('cf'), cb = document.getElementById('cb');
  if (comp.edit >= 0) { cf.value = comp.cards[comp.edit].f; cb.value = comp.cards[comp.edit].b; }
  else { cf.value = comp.f || ''; cb.value = comp.b || ''; }
  setTimeout(() => {
    // pendant le tuto, pas de clavier qui s'ouvre de lui-même : il cachait ce que le tuto montre
    if (enSaisie() || tuto) return;
    // cherché maintenant : la barre de l'IA (#pimsg) se pose après l'écran
    const ou = comp.champ && document.getElementById(comp.champ);
    (ou || (comp.cards.length || comp.edit >= 0 || (nm && nm.value) ? cf : (nm || cf))).focus();
  }, 60);
  for (const c of [cf, cb]) {
    c.addEventListener('input', () => { comp[c.id === 'cf' ? 'f' : 'b'] = c.value; });
    c.addEventListener('focus', () => { comp.champ = c.id; });
  }
  const addCard = () => {
    const f = cf.value.trim(), b = cb.value.trim();
    if (!f && !b) return;
    if (comp.edit >= 0) { comp.cards[comp.edit] = { f, b }; comp.edit = -1; }
    else comp.cards.push({ f, b });
    cf.value = ''; cb.value = ''; comp.f = ''; comp.b = ''; cf.focus();
    document.getElementById('cadd').innerHTML = svg(I.plus) + '<span>Ajouter la carte</span>';
    paintDraft();
  };
  cf.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); cb.focus(); } });
  cb.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addCard(); } });
  document.getElementById('cadd').onclick = addCard;
}

/* Ce que la zone de vérification ajouterait : les doublons écartés sauf
   demande contraire, et toujours les pages trop longues. Un doublon se
   cherche dans le livre ET dans la liste en cours : toutes les méthodes la
   remplissent, une page écrite à la main puis recollée compte deux fois. */
function trier(text, t) {
  const cards = parseText(text);
  const dup = markDups(cards, { cards: (t ? t.cards : []).concat(comp.cards) });
  const big = markOver(cards);
  const keep = cards.filter(c => !c.big && (comp.dups || !c.dup)).map(c => ({ f: c.f, b: c.b }));
  return { cards, dup, big, keep };
}

function apercuHtml({ cards, dup, big }) {
  return (big ? `<div class="dupb warn">
      <span>${big} carte${big > 1 ? 's' : ''} trop longue${big > 1 ? 's' : ''} — recto ${MAXF}
        caractères, verso ${MAXB}</span>
      <button class="dupt" disabled>Écartée${big > 1 ? 's' : ''}</button>
    </div>` : '')
    + (dup.total ? `<div class="dupb">
      <span>${dup.total} doublon${dup.total > 1 ? 's' : ''}${
        dup.already ? ` · ${dup.already} déjà dans le paquet` : ''}${
        dup.inside ? ` · ${dup.inside} en double dans le texte` : ''}</span>
      <button class="dupt ${comp.dups ? 'on' : ''}" id="dupt">${
        comp.dups ? 'Les ajouter quand même' : 'Ignorés'}</button>
    </div>` : '')
    + cards.slice(0, 40).map(c => `<div class="pr ${(c.dup && !comp.dups) || c.big ? 'dup' : ''}">
      <span class="a">${esc(c.f.slice(0, 120))}</span>${svg(I.arrow)}<span class="b">${esc(c.b.slice(0, 120))}</span>
      ${c.big ? `<i class="dpi" title="${c.big === 'f' ? 'Recto' : 'Verso'} trop long">${svg(I.warn)}</i>`
        : c.dup ? `<i class="dpi" title="${c.dup === 'deck' ? 'Déjà dans le paquet' : 'En double dans le texte'}">${svg(I.copy)}</i>` : ''}
    </div>`).join('');
}

function bindLot(t, mode) {
  const tx = document.getElementById('tx'), prev = document.getElementById('prev'),
        add = document.getElementById('bulkadd'), lot = document.getElementById('lot');
  const up = () => {
    comp.text = tx.value;
    const tri = trier(tx.value, t);
    add.disabled = !tri.keep.length;
    add.lastChild.textContent = tri.keep.length ? `Ajouter ${plur(tri.keep.length, 'carte')}` : 'Ajouter';
    prev.innerHTML = apercuHtml(tri);
    const dt = document.getElementById('dupt');
    if (dt) dt.onclick = () => { comp.dups = !comp.dups; up(); };
    const ok = document.getElementById('ok');
    if (ok) ok.disabled = !comp.cards.length && !tri.keep.length;
  };
  enAttente = () => trier(tx.value, t).keep;
  const fit = () => { tx.style.height = 'auto'; tx.style.height = Math.min(tx.scrollHeight + 2, innerHeight * .4) + 'px'; };
  /* Ce que rend une photo, un fichier ou l'IA s'ajoute au texte déjà là :
     dix photos l'une après l'autre remplissent la même zone. */
  const verser = (cards, remplacer) => {
    const had = remplacer ? '' : tx.value.trim();
    tx.value = (had ? had + '\n' : '') + cards.map(c => c.f + '\t' + c.b).join('\n');
    lot.hidden = false; fit(); up();
  };
  tx.addEventListener('input', () => { fit(); up(); majIA(); });
  if (!lot.hidden) { fit(); up(); }
  if (mode === 'coller') setTimeout(() => { if (!enSaisie() && !tuto) (comp.champ === 'pimsg' && document.getElementById('pimsg') || tx).focus(); }, 60);

  add.onclick = () => {
    const { keep, dup, big } = trier(tx.value, t);
    if (!keep.length) return;
    comp.cards.push(...keep); comp.text = '';
    render();
    toast(I.check, plur(keep.length, 'carte')
      + (!comp.dups && dup.total ? ` · ${dup.total} doublon${dup.total > 1 ? 's' : ''} écarté${dup.total > 1 ? 's' : ''}` : '')
      + (big ? ` · ${big} trop longue${big > 1 ? 's' : ''}` : ''));
  };
  if (mode === 'fichier') bindDepots(verser);
}

/* Photos et PDF vont attendre dans la barre de l'IA, avec la consigne
   qu'on voudra lui donner. La galerie peut rendre plusieurs photos d'un
   coup ; sur ordinateur, on les glisse aussi depuis le bureau. */
function bindDepots(verser) {
  const shot = document.getElementById('aishot'), pdf = document.getElementById('aipdf');
  const fshot = document.getElementById('fshot'), fpdf = document.getElementById('fpdf');
  /* Un fichier texte (export « notes en texte brut » d'Anki, export
     Quizlet, CSV d'un tableur) se lit ici même : pas de réseau, pas
     d'IA, pas d'attente — l'analyseur reconnaît le séparateur seul.
     Seul le PDF a besoin de l'IA. */
  const fichier = async f => {
    if (!f) return;
    const nm = f.name.toLowerCase();
    if (nm.endsWith('.apkg')) return toast(I.x, 'Exporte en texte depuis Anki');
    if (f.type === 'application/pdf' || nm.endsWith('.pdf')) return joindreIA([f]);
    let txt;
    try { txt = await f.text(); } catch (x) { return toast(I.x, 'Fichier illisible'); }
    const found = parseText(txt);
    if (!found.length) return toast(I.x, 'Aucune carte reconnue : demande à l’IA');
    verser(found); toast(I.check, plur(found.length, 'carte'));
  };
  const photos = fs => { const im = fs.filter(f => f.type.startsWith('image/')); if (im.length) joindreIA(im); };
  if (shot) { shot.onclick = () => fshot.click(); deposer(shot, photos); }
  if (pdf) { pdf.onclick = () => fpdf.click(); deposer(pdf, fs => fichier(fs[0])); }
  if (fshot) fshot.onchange = () => { const files = [...fshot.files]; fshot.value = ''; photos(files); };
  if (fpdf) fpdf.onchange = () => { const f = fpdf.files[0]; fpdf.value = ''; fichier(f); };
}

function deposer(zone, prendre) {
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('over'));
  zone.addEventListener('drop', e => {
    e.preventDefault(); zone.classList.remove('over');
    const fs = [...(e.dataTransfer ? e.dataTransfer.files : [])];
    if (fs.length) prendre(fs);
  });
}

function bindOk(t) {
  document.getElementById('ok').onclick = () => {
    const cards = comp.cards.concat(enAttente ? enAttente() : []);
    if (!cards.length) return;
    const pour = comp.pour;
    if (t) {
      t.cards.push(...cards.map(c => ({ ...c, id: uid() })));
      saveDeck(t); resetComp(); go('deck', t.id);
    } else {
      const d = addDeck(comp.name, cards, comp.subject);
      if (comp.cours) { d.cours = true; saveDeck(d); }
      resetComp();
      /* Un livre composé pour une classe enchaîne directement sur « à qui,
         et pour quand » : c'est le même geste, il n'a pas à le rouvrir. */
      if (pour === 'devoir') { donnerLivre(d); return; }
      go('deck', d.id);
    }
    toast(I.check, plur(cards.length, 'carte'));
  };
}

/* Pour le tuto, qui écrit la première page sous les yeux (ui/tuto.js) :
   la matière choisie et une page ajoutée se posent sur place, sans
   redessiner l'écran — un rendu redonne le focus au recto, et le clavier
   du téléphone s'ouvrirait sur ce qu'il faut voir. */
export function poserMatiere(id) {
  comp.subject = id || '';
  $.querySelectorAll('[data-nsubj]').forEach(x => x.classList.toggle('on', x.dataset.nsubj === comp.subject));
  const c = document.getElementById('comp');
  if (c) c.setAttribute('style', sty(subj(comp.subject)));
}

export function poserPage(f, b) {
  comp.cards.push({ f, b });
  comp.f = ''; comp.b = '';
  for (const id of ['cf', 'cb']) { const n = document.getElementById(id); if (n) n.value = ''; }
  paintDraft();
}

function paintDraft() {
  const l = document.getElementById('dlist'); if (!l) return;
  l.innerHTML = comp.cards.length ? comp.cards.map((c, i) => `<div class="dc ${i === comp.edit ? 'on' : ''}" data-ed="${i}" data-k="dc:${esc(c.f)}|${esc(c.b)}">
      <div class="tx"><b>${esc(c.f) || '—'}</b><span>${esc(c.b) || '—'}</span></div>
      <button class="x" data-dl="${i}" aria-label="Retirer la carte">${svg(I.x)}</button>
    </div>`).reverse().join('')
    : '<div class="cr-vide">Les cartes ajoutées s’affichent ici, quelle que soit la méthode.</div>';
  const n = document.getElementById('cn'); if (n) n.textContent = comp.cards.length;
  const ok = document.getElementById('ok');
  if (ok) ok.disabled = !comp.cards.length && !(enAttente && enAttente().length);
  majIA();
}
