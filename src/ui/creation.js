// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { $ } from '../racine.js';
import { I, svg } from '../icones.js';
import { parseText } from '../parseur.js';
import { aiBusy, comp, db, demoEtab, setAiBusy, setComp, view } from '../data/etat.js';
import { go, render } from './bibliotheque.js';
import { donnerLivre } from './prof-porte.js';
import { MAXB, MAXF, markDups, markOver } from './carte-media.js';
import { deck, esc, plur, saveDeck, sty, subj, uid } from '../core/coeur-sync.js';
import { askPages } from './ecran-groupe.js';
import { AIERR, addDeck, aiCards, aiFromFile, toast } from './import-cartes.js';
import { ouvrirEnvie } from './demo-porte.js';

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
  { id: 'ia', icon: 'spark', nom: 'Cours', aide: 'Colle un passage de ton cours : les questions et leurs réponses sont écrites pour toi.' }
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

/* Ce qui coûte (l'IA lit les photos, les PDF et le cours) n'existe qu'avec
   un compte : dans la démo sans compte, ces onglets sont grisés et le
   disent au survol (`data-astuce`, app.css) ; les toucher ouvre la
   fenêtre de la démo qui dit ce qu'ils feraient et comment les avoir
   (`ouvrirEnvie`, ui/demo.js). Le cours par l'IA est dans le compte
   gratuit (3 par mois) ; la photo et le PDF, dans Folio+ (`data-offre`). */
const PAYANTS = new Set(['fichier', 'photo', 'ia']);
const payant = id => !!demoEtab && PAYANTS.has(id);
export const ASTUCE_PAYANT = 'Avec un compte Folio';
const astuce = id => (id === 'ia' ? ASTUCE_PAYANT : 'Avec Folio+');

const ongletsHtml = mode => `<div class="cr-tabs" role="tablist" aria-label="Façon de créer les pages">
    ${MODES.map(m => `<button role="tab" class="${m.id === mode ? 'on' : ''}${payant(m.id) ? ' payant' : ''}" data-cmode="${m.id}"
      aria-selected="${m.id === mode}" ${payant(m.id) ? `aria-disabled="true" data-astuce="${astuce(m.id)}"${
        m.id === 'ia' ? '' : ' data-offre="plus"'}` : `title="${m.aide}"`}>${
      svg(I[m.icon])}<span>${m.nom}</span></button>`).join('')}
  </div>`;

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
  ia: 'Colle ici un passage de ton cours, quelques phrases au moins…',
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
      ${mode === 'ia' ? `<button class="pbtn cr-ia" id="aigen">${svg(I.spark)}Écrire les pages</button>` : ''}
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
          ${mode === 'ecrire' ? ecrireHtml(s) : lotHtml(mode)}
        </section>
      </div>
      <aside class="cr-pages">
        <div class="lbl"><span>Pages</span><span id="cn">${comp.cards.length}</span></div>
        <div class="dlist" id="dlist"></div>
        <button class="cta cr-ok" id="ok" disabled>${okLabel(t)}${svg(I.check)}</button>
      </aside>
    </div>`;

  const nm = document.getElementById('nm');
  if (nm) nm.addEventListener('input', () => comp.name = nm.value);
  $.querySelectorAll('[data-cmode]').forEach(b => b.onclick = () => {
    if (payant(b.dataset.cmode)) return ouvrirEnvie(b.dataset.cmode);
    if (b.dataset.cmode === comp.mode) return;
    comp.mode = b.dataset.cmode; comp.edit = -1; render();
  });
  if (mode === 'ecrire') bindEcrire(nm);
  else bindLot(t, mode);
  paintDraft();
  bindOk(t);
}

function bindEcrire(nm) {
  const cf = document.getElementById('cf'), cb = document.getElementById('cb');
  if (comp.edit >= 0) { cf.value = comp.cards[comp.edit].f; cb.value = comp.cards[comp.edit].b; }
  setTimeout(() => (comp.cards.length || comp.edit >= 0 || (nm && nm.value) ? cf : (nm || cf)).focus(), 60);
  const addCard = () => {
    const f = cf.value.trim(), b = cb.value.trim();
    if (!f && !b) return;
    if (comp.edit >= 0) { comp.cards[comp.edit] = { f, b }; comp.edit = -1; }
    else comp.cards.push({ f, b });
    cf.value = ''; cb.value = ''; cf.focus();
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
        add = document.getElementById('bulkadd'), gen = document.getElementById('aigen'),
        lot = document.getElementById('lot');
  const nomLivre = () => t ? t.name : comp.name;
  const up = () => {
    comp.text = tx.value;
    const tri = trier(tx.value, t);
    add.disabled = !tri.keep.length;
    add.lastChild.textContent = tri.keep.length ? `Ajouter ${plur(tri.keep.length, 'page')}` : 'Ajouter';
    if (gen) gen.disabled = aiBusy || tx.value.trim().length < 40;
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
  if (mode === 'coller' || mode === 'ia') setTimeout(() => tx.focus(), 60);

  add.onclick = () => {
    const { keep, dup, big } = trier(tx.value, t);
    if (!keep.length) return;
    comp.cards.push(...keep); comp.text = '';
    render();
    toast(I.check, plur(keep.length, 'page')
      + (!comp.dups && dup.total ? ` · ${dup.total} doublon${dup.total > 1 ? 's' : ''} écarté${dup.total > 1 ? 's' : ''}` : '')
      + (big ? ` · ${big} trop longue${big > 1 ? 's' : ''}` : ''));
  };
  if (gen) gen.onclick = async () => {
    if (aiBusy || gen.disabled) return;
    setAiBusy(true); gen.classList.add('busy'); gen.disabled = true;
    try {
      const cards = await aiCards(tx.value, nomLivre());
      if (!cards.length) throw new Error('empty');
      verser(cards, true); toast(I.spark, plur(cards.length, 'page'));
    } catch (x) {
      toast(I.x, AIERR[String(x.message)] || 'IA indisponible');
    }
    setAiBusy(false); gen.classList.remove('busy'); up();
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
    occupe(shot, false);
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
    occupe(pdf, false);
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
