// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { $ } from '../racine.js';
import { I, svg } from '../icones.js';
import { parseText } from '../parseur.js';
import { aiBusy, comp, db, demoEtab, ia, offre, prefs, setAiBusy, setComp, tuto, view } from '../data/etat.js';
import { go, render } from './bibliotheque.js';
import { donnerLivre } from './prof-porte.js';
import { MAXB, MAXF, markDups, markOver } from './carte-media.js';
import { deck, esc, plur, saveDeck, sty, subj, uid } from '../core/coeur-sync.js';
import { askPages } from './ecran-groupe.js';
import { AIERR, addDeck, aiFromFile, toast } from './import-cartes.js';
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
   une liste, puis compléter à la main). Photo, fichier et IA rendent du texte
   tabulé dans la zone de vérification : aperçu, doublons et correction à la
   main y fonctionnent à l'identique, avant que rien n'entre dans le livre. */
export const resetComp = extra => { setComp({ subject: '', cards: [], edit: -1, mode: 'ecrire',
  text: '', dups: false, ...(extra || {}) }); };

const MODES = [
  { id: 'ecrire', icon: 'pen', nom: 'Écrire', aide: 'Page par page, au clavier. Entrée passe au verso, puis ajoute la page.' },
  { id: 'coller', icon: 'rows', nom: 'Coller', aide: 'Une page par ligne : le mot, puis une tabulation, un tiret ou « = », puis la réponse.' },
  { id: 'fichier', icon: 'file', nom: 'Fichier', aide: 'Un PDF de cours, ou un tableau : CSV, texte, export Anki ou Quizlet.' },
  { id: 'photo', icon: 'image', nom: 'Photo', aide: 'Une ou plusieurs pages de cours, prises sur le moment ou choisies dans la galerie.' },
  { id: 'ia', icon: 'spark', nom: 'Prompt', aide: 'Colle ton cours ou dis ce que tu veux : l’IA écrit les pages, puis les retouche à ta demande.' }
];

/* Les pages en attente dans la zone de vérification : « Créer » les prend
   aussi, pour qu'un livre collé d'un coup n'exige pas deux boutons. */
let enAttente = null;

function titre(t) {
  return t ? esc(t.name) : comp.pour === 'devoir' ? 'Nouveau devoir' : 'Nouveau livre';
}

function identiteHtml() {
  const mats = db.subjects.map(x => subj(x.id));
  return `<section class="cr-id">
      <input id="nm" class="cr-titre" placeholder="${comp.pour === 'devoir' ? 'Titre du devoir' : 'Titre du livre'}"
        aria-label="Titre" spellcheck="false" enterkeyhint="next" value="${esc(comp.name || '')}">
      ${mats.length ? `<div class="cr-mat" role="group" aria-label="Matière">
        <button class="p ${comp.subject ? '' : 'on'}" data-nsubj="">Sans matière</button>
        ${mats.map(s => `<button class="p ${comp.subject === s.id ? 'on' : ''}" data-nsubj="${s.id}"
          style="${sty(s)}"><i></i>${esc(s.name)}</button>`).join('')}
      </div>` : ''}
    </section>`;
}

/* Toute l'IA (cours, photo, PDF) est dans Mirandola+ (décidé le 2026-10-27) :
   avec Mirandola gratuit, et dans la démo sans compte, ces onglets sont grisés,
   le disent au survol (`data-astuce`, app.css) et d'un « + » (`data-offre`) ;
   les toucher dit ce qu'ils feraient et comment les avoir — l'écran Mirandola+,
   ou la fenêtre de la démo (`envie`, ui/bridage.js). */
const PAYANTS = new Set(['fichier', 'photo', 'ia']);
const payant = id => PAYANTS.has(id) && (!!demoEtab || bride(id));
export const ASTUCE_PAYANT = 'Avec Mirandola+';

/* L'IA du mois (2026-10-29, src/ia-mois.js) : sur chaque façon de créer qui
   passe par l'IA, ce qui reste ce mois-ci, en pastille ; un compte Campus à
   qui sa licence n'accorde rien voit ces onglets grisés, et pourquoi. */
const etatOnglet = id => (PAYANTS.has(id) && !payant(id) ? etatIA(ia, offre) : null);
const ferme = id => { const e = etatOnglet(id); return e && e.cle === 'ferme' ? e.texte : ''; };

function ongletHtml(m, mode) {
  const e = etatOnglet(m.id), f = e && e.cle === 'ferme';
  const attrs = payant(m.id) ? `aria-disabled="true" data-astuce="${ASTUCE_PAYANT}" data-offre="plus"`
    : f ? `aria-disabled="true" data-astuce="${esc(e.texte)}"` : `title="${m.aide}"`;
  const pin = e && e.reste != null ? `<i class="cr-reste${e.reste ? '' : ' vide'}" style="--p:${e.pc}" title="${esc(e.titre)}">${e.reste}</i>` : '';
  return `<button role="tab" class="${m.id === mode ? 'on' : ''}${payant(m.id) ? ' payant' : ''}${f ? ' payant ferme' : ''}"
      data-cmode="${m.id}" aria-selected="${m.id === mode}" ${attrs}>${svg(I[m.icon])}<span>${m.nom}</span>${pin}</button>`;
}

const ongletsHtml = mode => `<div class="cr-tabs" role="tablist" aria-label="Façon de créer les pages">
    ${MODES.map(m => ongletHtml(m, mode)).join('')}
  </div>`;

/* Les onglets se repeignent seuls, sur place : quand mon_ia répond, après
   chaque génération. Jamais tout l'écran (on tape peut-être). */
function peindreOnglets() {
  const v = document.querySelector('.cr-tabs');
  if (!v || view.name !== 'import') return;
  v.outerHTML = ongletsHtml(comp.mode || 'ecrire');
  lierOnglets();
}

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
      <button class="cr-add" id="cadd">${svg(ed ? I.check : I.plus)}<span>${ed ? 'Enregistrer la page' : 'Ajouter la page'}</span></button>
    </div>`;
}

/* La zone de dépôt : un vrai bouton (le sélecteur de fichiers du système),
   et sur ordinateur on peut aussi y glisser le fichier depuis le bureau. */
const depotHtml = (id, icon, nom, sous) => `<button class="cr-drop" id="${id}">
    <i>${svg(icon)}</i><b>${nom}</b><span>${sous}</span></button>`;

const PLACE = {
  coller: 'chat = gatto&#10;chien = cane&#10;maison = casa',
  fichier: '', photo: ''
};

function lotHtml(mode) {
  const vide = !comp.text.trim() && (mode === 'fichier' || mode === 'photo');
  return `
    ${mode === 'fichier' ? depotHtml('aipdf', I.file, 'Choisir un fichier', 'PDF · CSV · Anki · Quizlet') : ''}
    ${mode === 'photo' ? depotHtml('aishot', I.image, 'Prendre ou choisir des photos', '') : ''}
    <div class="cr-lot" id="lot" ${vide ? 'hidden' : ''}>
      ${mode === 'fichier' || mode === 'photo' ? '<div class="cr-sous">À vérifier avant d’ajouter</div>' : ''}
      <div class="cr-ta"><textarea id="tx" placeholder="${PLACE[mode]}" aria-label="Pages à ajouter"
        autocapitalize="off" autocorrect="off" spellcheck="false">${esc(comp.text)}</textarea></div>

      <div class="prev" id="prev"></div>
      <button class="pbtn cr-bulk" id="bulkadd" disabled>${svg(I.plus)}<span>Ajouter</span></button>
    </div>
    <!-- Sans « capture », le sélecteur propose l'appareil photo ET la
         galerie (Photos sur iPhone, Galerie/Fichiers sur Android),
         et « multiple » permet d'en choisir plusieurs d'un coup. Avec
         « capture », les deux systèmes sautaient tout droit à
         l'appareil photo, sans jamais montrer la pellicule. -->
    <input type="file" id="fshot" accept="image/*" multiple hidden>
    <input type="file" id="fpdf" accept=".pdf,.txt,.csv,.tsv,.apkg,application/pdf,text/plain,text/csv" hidden>`;
}

function okLabel(t) {
  return t ? 'Ajouter au livre' : comp.pour === 'devoir' ? 'Continuer' : 'Créer le livre';
}

export function importView() {
  const t = view.id ? deck(view.id) : null;
  const s = subj(t ? t.subject : comp.subject);
  if (comp.edit >= 0) comp.mode = 'ecrire';
  const mode = comp.mode || 'ecrire';
  enAttente = null;
  $.innerHTML = `
    <div class="bar">
      <button class="ic" data-act="${t ? 'deck' : comp.pour === 'devoir' ? 'prof' : 'home'}"
        aria-label="Retour">${svg(I.back)}</button>
      <h1>${titre(t)}</h1>
    </div>
    <div class="crea">
      <div class="cr-main">
        ${t ? '' : identiteHtml()}
        ${ongletsHtml(mode)}
        <section class="cr-panel" role="tabpanel" data-k="cr:${mode}">
          ${mode === 'ecrire' ? ecrireHtml(s) : mode === 'ia' ? '<div class="pi" id="pi"></div>' : lotHtml(mode)}
        </section>
      </div>
      <aside class="cr-pages">
        <div class="lbl"><span>Pages</span><span id="cn">${comp.cards.length}</span></div>
        <div class="dlist" id="dlist"></div>
        <button class="cta cr-ok" id="ok" disabled>${okLabel(t)}${svg(I.check)}</button>
      </aside>
    </div>`;

  const nm = document.getElementById('nm');
  if (nm) { nm.addEventListener('input', () => comp.name = nm.value); nm.addEventListener('focus', () => { comp.champ = 'nm'; }); }
  lierOnglets();
  if (mode === 'ecrire') bindEcrire(nm);
  else if (mode === 'ia') monterPrompt(t);
  else bindLot(t, mode);
  paintDraft();
  bindOk(t);
  if (!ia && !demoEtab) iaPull().then(peindreOnglets);
}

/* Ce que l'IA sait du livre : son titre, sa matière, et la classe de qui
   l'écrit (prefs.niveau, prefs.annee, posés par l'accueil) — « 10 pages sur
   la Révolution » ne s'écrit pas pareil en 4e et en prépa. */
const NIVEAUX = { college: 'collège', lycee: 'lycée', sup: 'études supérieures' };
function contexte(t) {
  const m = db.subjects.find(x => x.id === (t ? t.subject : comp.subject));
  const classe = prefs.annee ? `${prefs.annee}${NIVEAUX[prefs.niveau] ? ` (${NIVEAUX[prefs.niveau]})` : ''}` : NIVEAUX[prefs.niveau] || '';
  return [(t ? t.name : comp.name) || '', m ? 'matière : ' + m.name : '', classe ? 'classe : ' + classe : '']
    .filter(Boolean).join(' · ');
}

/* Le Prompt (2026-10-29) : une conversation avec l'IA, chargée à la demande
   (ui/prompt-ia.js). Ses pages en attente comptent pour « Créer », et
   « Ajouter » les verse ici, sans doublon du livre ni de la liste. */
function monterPrompt(t) {
  const n = document.getElementById('pi');
  import('./prompt-ia.js').then(m => {
    if (!n.isConnected) return;
    m.monter(n, {
      livre: () => contexte(t),
      ferme: () => ferme('ia'),
      attendre: f => { enAttente = f; paintDraft(); },
      onglets: peindreOnglets,
      ajouter: cartes => {
        const tri = cartes.map(c => ({ f: c.f, b: c.b }));
        markDups(tri, { cards: (t ? t.cards : []).concat(comp.cards) }); markOver(tri);
        const keep = tri.filter(c => !c.dup && !c.big).map(c => ({ f: c.f, b: c.b }));
        comp.cards.push(...keep); paintDraft();
        return { n: keep.length, ecartes: tri.length - keep.length };
      }
    });
  }).catch(() => { n.innerHTML = `<p class="cr-vide">${svg(I.cloud)}Le Prompt revient avec le réseau.</p>`; });
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
  const ou = comp.champ && document.getElementById(comp.champ);
  setTimeout(() => {
    // pendant le tuto, pas de clavier qui s'ouvre de lui-même : il cachait ce que le tuto montre
    if (enSaisie() || tuto) return;
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
    document.getElementById('cadd').innerHTML = svg(I.plus) + '<span>Ajouter la page</span>';
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
        : c.dup ? `<i class="dpi" title="${c.dup === 'deck' ? 'Déjà dans le livre' : 'En double dans le texte'}">${svg(I.copy)}</i>` : ''}
    </div>`).join('');
}

function bindLot(t, mode) {
  const tx = document.getElementById('tx'), prev = document.getElementById('prev'),
        add = document.getElementById('bulkadd'), lot = document.getElementById('lot');
  const nomLivre = () => t ? t.name : comp.name;
  const up = () => {
    comp.text = tx.value;
    const tri = trier(tx.value, t);
    add.disabled = !tri.keep.length;
    add.lastChild.textContent = tri.keep.length ? `Ajouter ${plur(tri.keep.length, 'page')}` : 'Ajouter';
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
  tx.addEventListener('input', () => { fit(); up(); });
  if (!lot.hidden) { fit(); up(); }
  if (mode === 'coller') setTimeout(() => { if (!enSaisie() && !tuto) tx.focus(); }, 60);

  add.onclick = () => {
    const { keep, dup, big } = trier(tx.value, t);
    if (!keep.length) return;
    comp.cards.push(...keep); comp.text = '';
    render();
    toast(I.check, plur(keep.length, 'page')
      + (!comp.dups && dup.total ? ` · ${dup.total} doublon${dup.total > 1 ? 's' : ''} écarté${dup.total > 1 ? 's' : ''}` : '')
      + (big ? ` · ${big} trop longue${big > 1 ? 's' : ''}` : ''));
  };
  bindDepots(t, nomLivre, verser);
}

/* Photo et PDF passent par la même passerelle. La galerie peut rendre
   plusieurs photos d'un coup : chacune y passe l'une après l'autre. */
function bindDepots(t, nomLivre, verser) {
  const shot = document.getElementById('aishot'), pdf = document.getElementById('aipdf');
  const fshot = document.getElementById('fshot'), fpdf = document.getElementById('fpdf');
  const occupe = (btn, oui) => { setAiBusy(oui); if (btn) { btn.classList.toggle('busy', oui); btn.disabled = oui; } };
  const photos = async files => {
    if (aiBusy || !files.length) return;
    occupe(shot, true);
    let total = 0, fail = 0, lastMsg = '';
    for (const file of files) {
      try {
        const cards = await aiFromFile(file, nomLivre());
        if (!cards.length) throw new Error('empty');
        verser(cards); total += cards.length;
      } catch (x) {
        fail++; lastMsg = AIERR[String(x.message)] || 'IA indisponible';
      }
    }
    occupe(shot, false); peindreOnglets();
    if (total) toast(I.spark, plur(total, 'page') + (fail ? ` · ${fail} photo${fail > 1 ? 's' : ''} en échec` : ''));
    else toast(I.x, lastMsg);
  };
  const viaPdf = async (f, pages) => {
    if (aiBusy) return;
    occupe(pdf, true);
    try {
      const cards = await aiFromFile(f, nomLivre(), pages);
      if (!cards.length) throw new Error('empty');
      verser(cards); toast(I.spark, plur(cards.length, 'page'));
    } catch (x) {
      toast(I.x, AIERR[String(x.message)] || 'IA indisponible');
    }
    occupe(pdf, false); peindreOnglets();
  };
  /* Un fichier texte (export « notes en texte brut » d'Anki, export
     Quizlet, CSV d'un tableur) se lit ici même : pas de réseau, pas
     d'IA, pas d'attente — l'analyseur reconnaît le séparateur seul.
     Seul le PDF a besoin de la passerelle. */
  const fichier = async f => {
    if (!f) return;
    const nm = f.name.toLowerCase();
    if (nm.endsWith('.apkg')) return toast(I.x, 'Exporte en texte depuis Anki');
    if (f.type === 'application/pdf' || nm.endsWith('.pdf')) return askPages(p => viaPdf(f, p));
    let txt;
    try { txt = await f.text(); } catch (x) { return toast(I.x, 'Fichier illisible'); }
    const found = parseText(txt);
    if (!found.length) return toast(I.x, 'Aucune carte reconnue');
    verser(found); toast(I.check, plur(found.length, 'page'));
  };
  if (shot) { shot.onclick = () => { if (!aiBusy) fshot.click(); }; deposer(shot, fs => photos(fs.filter(f => f.type.startsWith('image/')))); }
  if (pdf) { pdf.onclick = () => { if (!aiBusy) fpdf.click(); }; deposer(pdf, fs => fichier(fs[0])); }
  fshot.onchange = () => { const files = [...fshot.files]; fshot.value = ''; photos(files); };
  fpdf.onchange = () => { const f = fpdf.files[0]; fpdf.value = ''; fichier(f); };
}

function deposer(zone, prendre) {
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('over'));
  zone.addEventListener('drop', e => {
    e.preventDefault(); zone.classList.remove('over');
    const fs = [...(e.dataTransfer ? e.dataTransfer.files : [])];
    if (fs.length && !aiBusy) prendre(fs);
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
    toast(I.check, plur(cards.length, 'page'));
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
      <button class="x" data-dl="${i}" aria-label="Retirer la page">${svg(I.x)}</button>
    </div>`).reverse().join('')
    : '<div class="cr-vide">Les pages ajoutées s’affichent ici, quelle que soit la méthode.</div>';
  const n = document.getElementById('cn'); if (n) n.textContent = comp.cards.length;
  const ok = document.getElementById('ok');
  if (ok) ok.disabled = !comp.cards.length && !(enAttente && enAttente().length);
}
