// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { I, svg } from '../icones.js';
import { $ } from '../racine.js';
import { online, view } from '../data/etat.js';
import { deck, esc, sty, subj } from '../core/coeur-sync.js';
import { composer, corriger, examensPull, garder, historiqueDe } from '../core/examen.js';
import { iaPull } from '../core/abonnement.js';
import { MAX_PHOTOS, MAX_REPONSE, noteLisible, questionsPossibles, tendance } from '../examen-blanc.js';
import { go, render } from './bibliotheque.js';
import { AIERR, toast } from './import-cartes.js';
import { examensOfferts } from './examen-porte.js';
import { ouvrirPlus } from './plus-porte.js';
import { startStudy } from './revision.js';
import './examen-blanc.css';

/* ══════════ l'examen blanc (Mirandola Infini, 2026-11-06) ══════════
   Chargé à la demande par ui/examen-porte.js (vue `examen`) : rien d'autre
   ne doit importer ce fichier. Cinq temps sur un même écran — choisir,
   l'IA compose, la copie, l'IA corrige, le résultat. La copie se fait au
   clavier, ou sur papier : on écrit à la main, on photographie ses pages
   (huit au plus), l'IA lit l'écriture. Le résultat ne commente pas ce qui
   est juste ; il corrige et conseille ce qui ne l'est pas, et propose de
   revoir aussitôt les pages en cause. Un examen en cours reste là si l'on
   s'en va et qu'on revient au même livre (tant que l'app est ouverte). */

const neuf = id => ({ id, etape: 'choix', n: 0, mode: 'clavier', sujet: null, envoyees: null, reponses: [],
  photos: [], apercus: [], resultat: null, erreur: '' });
let e = neuf(null);

export function preparer(id) {
  if (e.id !== id || e.etape === 'resultat' || e.etape === 'erreur') { liberer(); e = neuf(id); }
  examensPull(id).then(() => { if (view.name === 'examen' && e.etape === 'choix') render(); });
  // ce qui reste d'examens offerts (2026-11-08) : relu à chaque ouverture
  iaPull().then(() => { if (view.name === 'examen' && e.etape === 'choix') render(); });
}

/* L'examen offert (2026-11-08) : 1 en Mirandola gratuit, 2 en Mirandola+ ;
   ce qui en reste se dit au-dessus du bouton, et, tout pris, Infini. */
function offert() {
  const n = examensOfferts();
  if (n == null || n === Infinity) return '';
  if (!n) return `<div class="eb-offert fini">${svg(I.target)}<p>Tes examens blancs offerts sont faits</p>
      <button class="eb-infini" data-eb="infini">Passer à Infini</button></div>`;
  return `<p class="eb-offert">${svg(I.spark)}<span>Examen blanc offert · il t’en reste <b>${n}</b></span></p>`;
}

function liberer() { for (const u of e.apercus) URL.revokeObjectURL(u); }

const barre = titre => `<div class="bar"><button class="ic" data-eb="retour" aria-label="Retour">${svg(I.back)}</button>
  <h1>${esc(titre)}</h1></div>`;

/* ---------- choisir ---------- */
function courbe(xs) {
  if (xs.length < 2) return '';
  const w = 120, h = 34, pas = w / (xs.length - 1);
  const pts = xs.map((v, i) => `${(i * pas).toFixed(1)},${(h - (v / 20) * h).toFixed(1)}`).join(' ');
  return `<svg class="eb-courbe" viewBox="-3 -3 ${w + 6} ${h + 6}" aria-hidden="true"><polyline points="${pts}"/></svg>`;
}

function historique(d) {
  const t = tendance((historiqueDe(d.id) || []));
  if (!t) return '';
  const fleche = t.ecart == null || t.ecart === 0 ? '' : `<i class="${t.ecart > 0 ? 'mieux' : 'moins'}">${t.ecart > 0 ? '+' : ''}${noteLisible(t.ecart)}</i>`;
  return `<div class="eb-histo" title="${t.nombre} examen${t.nombre > 1 ? 's' : ''} · meilleure note ${noteLisible(t.meilleure)}">
      <div><b>${noteLisible(t.derniere)}</b><span>/20</span>${fleche}</div>
      ${courbe(t.courbe)}
    </div>`;
}

function choix(d) {
  const opts = questionsPossibles(d.cards);
  if (!opts.length) return `<div class="empty">${svg(I.book)}<p>Il faut au moins 5 cartes</p></div>`;
  if (!opts.includes(e.n)) e.n = opts[0];
  const seg = (k, v, l, ic) => `<button role="radio" aria-checked="${e[k] === v}" class="${e[k] === v ? 'on' : ''}" data-eb="${k}" data-v="${v}">${ic ? svg(ic) : ''}${l}</button>`;
  return `${historique(d)}
    <div class="eb-choix">
      ${opts.length > 1 ? `<div class="seg eb-seg" role="radiogroup" aria-label="Nombre de questions">${opts.map(n => seg('n', n, n + ' questions')).join('')}</div>` : ''}
      <div class="seg eb-seg" role="radiogroup" aria-label="Copie">${seg('mode', 'clavier', 'Au clavier', I.type)}${seg('mode', 'photo', 'Sur papier', I.pen)}</div>
      ${offert()}
      <button class="cta" data-eb="composer" ${online && examensOfferts() !== 0 ? '' : 'disabled'}>${svg(I.spark)}Composer le sujet</button>
    </div>`;
}

/* ---------- la copie ---------- */
function copieClavier() {
  return `<ol class="eb-qs">${e.sujet.map((q, i) => `<li class="eb-q">
      <p>${esc(q.q)}</p>
      <textarea data-ebr="${i}" rows="2" maxlength="${MAX_REPONSE}" aria-label="Réponse ${i + 1}">${esc(e.reponses[i] || '')}</textarea>
    </li>`).join('')}</ol>`;
}

function copiePapier() {
  const plein = e.photos.length >= MAX_PHOTOS;
  return `<ol class="eb-qs eb-papier">${e.sujet.map(q => `<li class="eb-q"><p>${esc(q.q)}</p></li>`).join('')}</ol>
    <div class="eb-photos">
      ${e.apercus.map((u, i) => `<figure><img src="${u}" alt="Carte ${i + 1} de ta copie">
        <button class="ic" data-eb="sans" data-v="${i}" aria-label="Retirer la carte ${i + 1}">${svg(I.x)}</button></figure>`).join('')}
      ${plein ? '' : `<label class="eb-ajout">${svg(I.image)}<span>${e.photos.length ? 'Une page de plus' : 'Photographier ma copie'}</span>
        <input type="file" accept="image/*" capture="environment" multiple data-eb-photo hidden></label>`}
    </div>`;
}

function copie() {
  const pret = e.mode === 'photo' ? e.photos.length > 0 : e.reponses.some(r => r && r.trim());
  return `${e.mode === 'photo' ? copiePapier() : copieClavier()}
    <div class="eb-rendre"><button class="cta" data-eb="rendre" ${pret && online ? '' : 'disabled'}>${svg(I.check)}Rendre ma copie</button></div>`;
}

/* ---------- le résultat ---------- */
function ligne(q, i) {
  if (q.ok) return `<li class="eb-r ok"><i>${svg(I.check)}</i><p>${esc(q.q)}</p></li>`;
  return `<li class="eb-r ko"><i>${svg(I.x)}</i><div>
      <p>${esc(q.q)}</p>
      <dl>
        <dt>Ta réponse</dt>${q.lu ? `<dd class="lu">${esc(q.lu)}${q.points ? ` <em>${noteLisible(q.points)}/${q.sur}</em>` : ''}</dd>`
          : '<dd class="vide">Pas de réponse</dd>'}
        <dt>Correction</dt><dd>${esc(q.correction)}</dd>
        ${q.conseil ? `<dt class="eb-conseil">${svg(I.bulb)}Conseil</dt><dd>${esc(q.conseil)}</dd>` : ''}
      </dl></div></li>`;
}

function resultat() {
  const r = e.resultat, n = r.questions.length;
  return `<div class="eb-note">
      <div><b>${noteLisible(r.note)}</b><span>/20</span></div>
      <p>${r.justes}/${n} juste${r.justes > 1 ? 's' : ''}</p>
    </div>
    ${r.bilan ? `<blockquote class="eb-bilan">${esc(r.bilan)}</blockquote>` : ''}
    <ol class="eb-rs">${r.questions.map(ligne).join('')}</ol>
    <div class="eb-fin">
      ${r.revoir.length ? `<button class="cta" data-eb="revoir">${svg(I.play)}Revoir ${r.revoir.length} carte${r.revoir.length > 1 ? 's' : ''}</button>` : ''}
      <button class="eb-terminer" data-eb="retour">Terminer</button>
    </div>`;
}

const attente = texte => `<div class="eb-attente"><i class="eb-spin"></i><p>${texte}</p></div>`;

export function ecran() {
  const d = deck(view.id);
  if (!d) return go('home');
  if (e.id !== d.id) preparer(d.id);
  const corps = e.etape === 'choix' ? choix(d)
    : e.etape === 'prepa' ? attente('L’IA compose ton sujet')
    : e.etape === 'copie' ? copie()
    : e.etape === 'correction' ? attente(e.mode === 'photo' ? 'L’IA lit et corrige ta copie' : 'L’IA corrige ta copie')
    : e.etape === 'resultat' ? resultat()
    : `<div class="empty">${svg(I.warn)}<p>${esc(e.erreur)}</p><button class="cta" data-eb="reessayer">Réessayer</button></div>`;
  $.innerHTML = `${barre(e.etape === 'resultat' ? 'Résultat' : 'Examen blanc')}
    <div class="page eb" data-etape="${e.etape}" style="${sty(subj(d.subject))}">
      <div class="eb-tete"><span>${esc(d.name)}</span>${e.etape === 'copie' ? `<i>${e.sujet.length} questions</i>` : e.etape === 'choix' ? `<i>${e.n} questions</i>` : ''}</div>
      ${corps}
    </div>`;
}

/* ---------- les gestes ---------- */
const message = x => AIERR[String(x && x.message)] || 'IA indisponible : réessaie dans un instant';

async function etape(fn, attenteEtape, repli) {
  const id = e.id;
  e.etape = attenteEtape; e.erreur = ''; render();
  try { await fn(); }
  catch (x) {
    if (e.id !== id) return;
    // les examens offerts sont faits : le choix le dit, et mène à Infini
    e.etape = String(x && x.message) === 'infini' ? 'choix' : repli; e.erreur = message(x);
    if (e.etape !== 'erreur') toast(I.x, e.erreur);
  }
  if (e.id === id && view.name === 'examen') render();
}

const GESTES = {
  retour: () => go('deck', e.id),
  n: b => { e.n = +b.dataset.v; render(); },
  mode: b => { e.mode = b.dataset.v; render(); },
  composer: () => etape(async () => {
    const d = deck(e.id);
    try {
      const s = await composer(d, e.n);
      Object.assign(e, { sujet: s.sujet, envoyees: s.envoyees, reponses: [], etape: 'copie' });
    } finally { iaPull().then(() => { if (view.name === 'examen' && e.etape === 'choix') render(); }); }
  }, 'prepa', 'erreur'),
  infini: () => ouvrirPlus({ niveau: 'infini', raison: 'examen' }),
  sans: b => {
    const i = +b.dataset.v;
    URL.revokeObjectURL(e.apercus[i]);
    e.photos.splice(i, 1); e.apercus.splice(i, 1); render();
  },
  rendre: () => etape(async () => {
    const d = deck(e.id);
    const r = await corriger(d, e.sujet, e.envoyees, e.mode === 'photo' ? { photos: e.photos } : { reponses: e.reponses });
    e.resultat = r; e.etape = 'resultat';
    garder(d, r, e.mode);
    liberer(); e.photos = []; e.apercus = [];
  }, 'correction', 'copie'),
  revoir: () => startStudy(e.id, false, e.resultat.revoir),
  reessayer: () => { e.etape = e.sujet ? 'copie' : 'choix'; render(); }
};

document.addEventListener('click', ev => {
  const b = ev.target.closest('[data-eb]');
  if (!b || b.disabled || view.name !== 'examen') return;
  const f = GESTES[b.dataset.eb];
  if (f) f(b);
});

// une réponse tapée survit aux rendus ; le bouton s'allume sans tout redessiner
document.addEventListener('input', ev => {
  const t = ev.target;
  if (view.name !== 'examen' || !t.dataset || t.dataset.ebr == null) return;
  e.reponses[+t.dataset.ebr] = t.value;
  const b = document.querySelector('[data-eb="rendre"]');
  if (b) b.disabled = !online || !e.reponses.some(r => r && r.trim());
});

document.addEventListener('change', ev => {
  const t = ev.target;
  if (view.name !== 'examen' || !t.matches || !t.matches('[data-eb-photo]')) return;
  const neuves = [...(t.files || [])].filter(f => /^image\//.test(f.type)).slice(0, MAX_PHOTOS - e.photos.length);
  for (const f of neuves) { e.photos.push(f); e.apercus.push(URL.createObjectURL(f)); }
  render();
});
