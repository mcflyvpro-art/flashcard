// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import './journal.css';
import { $ } from '../racine.js';
import { I, svg } from '../icones.js';
import { db, setAnimate, stats } from '../data/etat.js';
import { render } from './bibliotheque.js';
import { fsrsW, plain } from './carte-media.js';
import { hlp } from './connexion.js';
import { toast } from './import-cartes.js';
import { PALETTE, esc } from '../core/coeur-sync.js';
import { journalLocal } from '../core/ecran-groupe.js';
import {
  activite, decaler, evolution, grille, jourDe, jourSemaine, maitrise, nommerLivres, nommerMatieres,
  rassembler, resistantes, rythme, savoir
} from '../journal.js';

/* ══════════ le journal de lecture (morceau chargé à la demande) ══════════
   Ce que tu as fait, à gauche : les chiffres de la période, l'année en
   cases, le rythme, le temps par matière et par livre. Ce que tu sais, à
   droite : l'âge des pages, le rappel estimé, ce qui revient, ce qui tient
   après une pause, l'heure où tu lis, les pages qui résistent. Toutes les
   règles sont dans src/journal.js ; ici on dessine. Une ligne de micro-texte
   par bloc, pas plus — une explication plus longue va dans sa pastille « ? ». */

const PERIODES = [[7, '7 j'], [30, '30 j'], [365, '1 an']];
const ETATS = [['mature', 'Sues'], ['young', 'Relues'], ['learn', 'En cours'], ['new', 'À lire']];
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const LETTRES = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

const nb = n => Math.round(n).toLocaleString('fr-FR');
const pct = x => x == null ? '—' : Math.round(x * 100) + ' %';
function duree(ms) {
  const m = Math.round(ms / 60000);
  if (m < 60) return m + ' min';
  const h = Math.floor(m / 60), r = m % 60;
  return h >= 10 || !r ? h + ' h' : `${h} h ${String(r).padStart(2, '0')}`;
}
const dateCourte = j => { const [, m, d] = j.split('-').map(Number); return `${d} ${MOIS[m - 1]}`; };
const couleurMatiere = c => c ? (PALETTE[c] || PALETTE.graphite).d : 'var(--soft)';
const tete = (titre, micro, aide = '', droite = '') =>
  `<div class="jr-h"><h2>${titre}${aide ? ' ' + hlp(aide) : ''}</h2>${droite}</div>${micro ? `<p class="jr-mt">${micro}</p>` : ''}`;

/* ---------- les chiffres de la période ---------- */
function evol(x) {
  if (x == null || Math.abs(x) < .005) return '';
  const v = Math.round(x * 100);
  return `<em class="${v > 0 ? 'up' : 'down'}" title="Par rapport à la période d’avant">${v > 0 ? '+' : '−'}${Math.abs(v)} %</em>`;
}

function chiffres(a, avant) {
  const tuile = (k, ic, val, nom, e = '') =>
    `<div class="jr-k" data-k="${k}"><i>${svg(ic)}</i><b>${val}</b><span>${nom}</span>${e}</div>`;
  return `<section class="jr-kpi">
    ${tuile('pages', I.book, nb(a.n), 'pages lues', avant ? evol(evolution(a.n, avant.n)) : '')}
    ${tuile('temps', I.clock, duree(a.ms), 'de lecture', avant ? evol(evolution(a.ms, avant.ms)) : '')}
    ${tuile('justes', I.check, pct(a.justesse), 'justes', avant && avant.justesse != null && a.justesse != null
      ? evol(a.justesse - avant.justesse) : '')}
    ${tuile('serie', I.flame, nb(a.serie), a.serie > 1 ? 'jours d’affilée' : 'jour d’affilée')}
  </section>`;
}

/* ---------- l'année en cases ---------- */
function annee(a, tous, auj) {
  const cols = grille(tous, auj, 53);
  // le nom d'un mois au-dessus de sa première colonne entière
  const mois = cols.map((c, i) => {
    const m = +c[0].j.slice(5, 7);
    return i > 0 && m !== +cols[i - 1][0].j.slice(5, 7) ? `<span style="grid-column:${i + 1}/span 3">${MOIS[m - 1]}</span>` : '';
  }).join('');
  return `<section class="jr-c jr-an">
    ${tete('Régularité', 'Chaque case est un jour', '', `<span class="jr-chip">${svg(I.cal)}${a.actifs} j actifs</span>`)}
    <div class="jr-heat" id="jrHeat"><div class="jr-mois">${mois}</div>
      <div class="jr-cases">${cols.map(c => `<div class="hc">${c.map(x =>
        `<i class="n${x.niveau}" title="${dateCourte(x.j)} · ${x.n} page${x.n > 1 ? 's' : ''}"></i>`).join('')}</div>`).join('')}</div></div>
    <div class="jr-pied"><span>${a.record.n ? `Record : <b>${nb(a.record.n)}</b> pages, le ${dateCourte(a.record.j)}` : ''}</span>
      <span class="jr-ech" aria-hidden="true">${[0, 1, 2, 3, 4].map(n => `<i class="n${n}"></i>`).join('')}</span></div>
  </section>`;
}

/* ---------- le rythme ---------- */
function rythmeHtml(a, tous, auj, per) {
  const b = rythme(tous, auj, per), max = Math.max(1, ...b.map(x => x.n));
  const nom = x => per > 31 ? `semaine du ${dateCourte(x.j)}` : dateCourte(x.j);
  const etiquette = (x, i) => per === 7 ? LETTRES[jourSemaine(x.j)]
    : per === 30 ? (i % 5 === 4 || i === b.length - 1 ? +x.j.slice(8) : '')
    : (i > 0 && x.j.slice(5, 7) !== b[i - 1].j.slice(5, 7) ? MOIS[+x.j.slice(5, 7) - 1].slice(0, 1).toUpperCase() : '');
  return `<section class="jr-c">
    ${tete('Rythme', per > 31 ? 'Pages lues par semaine' : 'Pages lues par jour', '',
      `<span class="jr-chip">${nb(a.parJourActif)} / jour actif</span>`)}
    <div class="jr-bars p${per}">${b.map((x, i) => `<div class="jr-b${i === b.length - 1 ? ' auj' : ''}${x.n ? '' : ' nul'}"
      title="${nom(x)} · ${x.n} page${x.n > 1 ? 's' : ''}${x.ms ? ' · ' + duree(x.ms) : ''}">
      <u><i style="height:${x.n ? Math.max(4, Math.round(x.n / max * 100)) : 0}%"></i></u><span>${etiquette(x, i)}</span></div>`).join('')}</div>
  </section>`;
}

/* ---------- ce que tu sais ---------- */
function anneau(k) {
  const tot = k.new + k.learn + k.young + k.mature;
  if (!tot) return `<div class="jr-anneau vide"><b>0</b><span>page</span></div>`;
  let pos = 0;
  const arcs = ETATS.map(([e]) => {
    const part = k[e] / tot * 100;
    if (!part) return '';
    const vis = Math.max(.01, part - (part < 100 ? 1.2 : 0));     // un filet clair entre deux âges
    const a = `<circle class="${e}" r="15.915" cx="18" cy="18" pathLength="100" stroke-dasharray="${vis.toFixed(2)} ${(100 - vis).toFixed(2)}" stroke-dashoffset="${(-pos).toFixed(2)}"></circle>`;
    pos += part;
    return a;
  }).join('');
  return `<div class="jr-anneau"><svg viewBox="0 0 36 36" aria-hidden="true"><circle class="fond" r="15.915" cx="18" cy="18"></circle>${arcs}</svg>
    <div><b>${pct(maitrise(k))}</b><span>sues</span></div></div>`;
}

function memoire(sv) {
  const k = sv.total, jours = ['auj.', 'dem.', ...[2, 3, 4, 5, 6].map(i => LETTRES[jourSemaine(decaler(jourDe(Date.now()), i))])];
  const max = Math.max(1, ...sv.aRevoir);
  return `<section class="jr-c">
    ${tete('Mémoire', 'Ce que tu sais aujourd’hui')}
    <div class="jr-mem">${anneau(k)}
      <ul class="jr-leg">${ETATS.map(([e, nom]) => `<li><i class="${e}"></i>${nom}<b>${nb(k[e])}</b></li>`).join('')}
        ${k.susp ? `<li><i class="susp"></i>De côté<b>${nb(k.susp)}</b></li>` : ''}</ul></div>
    <div class="jr-duo">
      <div class="jr-rappel"><b>${pct(sv.retenue)}</b><span>rappel estimé ${hlp('jRappel')}</span></div>
      <div class="jr-due" title="Pages qui reviennent ces sept jours">
        ${sv.aRevoir.map((n, i) => `<div class="${i ? '' : 'auj'}" title="${n} page${n > 1 ? 's' : ''}"><b>${n || ''}</b>
          <u><i style="height:${n ? Math.max(6, Math.round(n / max * 100)) : 0}%"></i></u><span>${jours[i]}</span></div>`).join('')}
      </div>
    </div>
  </section>`;
}

function fidelite(a) {
  if (!a.paliers.some(p => p.n)) return '';
  return `<section class="jr-c">
    ${tete('Après une pause', 'Réponses justes selon le temps écoulé', 'jFidele', `<span class="jr-chip">${pct(a.rappel)}</span>`)}
    ${a.paliers.map(p => `<div class="jr-row" title="${p.ok} sur ${p.n}">
      <span class="jr-rl">${p.nom}</span><span class="jr-rb">${p.n ? `<i style="width:${Math.round(p.pct * 100)}%"></i>` : ''}</span>
      <b>${p.n ? pct(p.pct) : '—'}</b></div>`).join('')}
  </section>`;
}

function heures(a) {
  if (a.heure == null) return '';
  const max = Math.max(1, ...a.heures);
  return `<section class="jr-c">
    ${tete('Heure de lecture', `Surtout vers ${a.heure} h`)}
    <div class="jr-h24">${a.heures.map((n, h) => `<i class="${h === a.heure ? 'jr-pic' : ''}" style="height:${n ? Math.max(6, Math.round(n / max * 100)) : 0}%"
      title="${h} h · ${n} page${n > 1 ? 's' : ''}"></i>`).join('')}</div>
    <div class="jr-axe24"><span>0 h</span><span>6 h</span><span>12 h</span><span>18 h</span><span>24 h</span></div>
  </section>`;
}

/* ---------- le temps par matière, par livre ---------- */
function matieres(a, J, sv) {
  const l = nommerMatieres(a.matieres, db.subjects, J.matieres);
  if (!l.length) return '';
  const max = Math.max(1, ...l.map(m => m.ms));
  return `<section class="jr-c">
    ${tete('Matières', 'Temps de lecture sur la période', 'jMatieres')}
    ${l.map(m => {
      const k = m.actuelle ? sv.parMatiere.get(m.cle) : null;
      return `<div class="jr-mat${m.actuelle || !m.cle ? '' : ' passee'}">
        <i class="jr-pt" style="background:${couleurMatiere(m.couleur)}"></i>
        <span class="jr-mn">${esc(m.nom)}${k ? `<small>${nb(k.mature)} sues sur ${nb(k.new + k.learn + k.young + k.mature)}</small>` : ''}</span>
        <span class="jr-mb"><i style="width:${Math.max(2, Math.round(m.ms / max * 100))}%;background:${couleurMatiere(m.couleur)}"></i></span>
        <b>${duree(m.ms)}</b></div>`;
    }).join('')}
  </section>`;
}

function livres(a, J, sv) {
  const temps = new Map(nommerLivres(a.livres, db.decks, J.livres).map(l => [l.id, l]));
  const actuels = sv.parLivre.map(p => ({ ...p, t: temps.get(p.id) }));
  const partis = [...temps.values()].filter(l => !l.existe);
  const l = [...actuels.sort((x, y) => ((y.t || {}).ms || 0) - ((x.t || {}).ms || 0) || y.pct - x.pct), ...partis];
  if (!l.length) return '';
  const montres = stats.tousLivres ? l : l.slice(0, 6);
  return `<section class="jr-c">
    ${tete('Livres', 'Ce que tu en sais, le temps passé')}
    ${montres.map(p => p.k ? `<button class="jr-livre" data-go="${esc(p.id)}">
        <span class="jr-ln">${esc(p.nom)}</span>
        <span class="jr-mix">${ETATS.slice().reverse().filter(([e]) => p.k[e]).map(([e]) => `<i class="${e}" style="flex:${p.k[e]}"></i>`).join('')}</span>
        <span class="jr-lv"><b>${pct(p.pct)}</b>${p.t ? `<small>${duree(p.t.ms)}</small>` : ''}</span></button>`
      : `<div class="jr-livre parti" title="Livre supprimé ou fusionné : son temps reste au journal">
        <span class="jr-ln">${svg(I.trash)}${esc(p.nom)}</span><span class="jr-mix"></span>
        <span class="jr-lv"><small>${duree(p.ms)}</small></span></div>`).join('')}
    ${l.length > 6 ? `<button class="jr-plus" data-jr="livres">${stats.tousLivres ? 'Moins' : '+ ' + (l.length - 6)}</button>` : ''}
  </section>`;
}

function resistent() {
  const l = resistantes(db.decks, 6);
  if (!l.length) return '';
  return `<section class="jr-c">
    ${tete('Pages qui résistent', 'Les plus souvent oubliées')}
    ${l.map(({ c, d, l: n }) => `<button class="jr-res" data-go="${esc(d.id)}">
      <i title="${n} oubli${n > 1 ? 's' : ''}">${n}</i>
      <span><b>${esc(plain(c.f))}</b><small>${esc(plain(c.b))}</small></span>${svg(I.arrow)}</button>`).join('')}
  </section>`;
}

function depuisToujours(J) {
  const t = J.toujours;
  if (!t || !t.n) return '';
  const d = t.depuis ? new Date(t.depuis) : null;
  return `<p class="jr-tout">${svg(I.star)}${d ? `Depuis le ${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()} · ` : ''}${nb(t.n)} pages · ${duree(t.ms)}</p>`;
}

/* ---------- l'écran ---------- */
function entete() {
  const per = PERIODES.some(p => p[0] === stats.range) ? stats.range : 30;
  return `<div class="top"><div class="hero">Journal</div>
      ${stats.err && stats.rep ? `<span class="jr-hl" title="Hors ligne : les derniers chiffres reçus">${svg(I.cloud)}</span>` : ''}
      <div class="seg jr-per" id="stRange">${PERIODES.map(([v, l]) =>
        `<button data-strange="${v}" class="${per === v ? 'on' : ''}">${l}</button>`).join('')}</div>
      <button class="ic" data-act="expstats" aria-label="Exporter en CSV" title="Exporter en CSV">${svg(I.down)}</button></div>`;
}

export function journalEcran() {
  const st = journalLocal();
  const per = PERIODES.some(p => p[0] === stats.range) ? stats.range : 30;
  const auj = jourDe(Date.now()), depuis = decaler(auj, -(per - 1));
  const J = rassembler(st.rep, st.locaux);
  const barre = `<div class="bar"><button class="ic" data-act="home" aria-label="Retour">${svg(I.back)}</button></div>`;
  if (!st.rep && !st.locaux.length) {
    $.innerHTML = `${barre}<div class="page jr">${entete()}
      ${stats.err ? `<div class="empty">${svg(I.cloud)}<p>Journal indisponible hors ligne</p></div>` : '<div class="jr-attente"><i></i><i></i><i></i></div>'}</div>`;
    return lier();
  }
  const a = activite(J, { depuis, aujourdhui: auj });
  const avant = per < 365 ? activite(J, { depuis: decaler(depuis, -per), jusqua: depuis, aujourdhui: auj }) : null;
  const sv = savoir(db.decks, { maintenant: Date.now(), w: fsrsW() });
  const tous = activite(J, { aujourdhui: auj }).jours;          // la grille et le rythme d'un an débordent la période
  $.innerHTML = `${barre}
    <div class="page jr">
      ${entete()}
      ${J.toujours.n ? chiffres(a, avant) : `<div class="empty">${svg(I.book)}<p>Aucune page lue pour l’instant</p></div>`}
      ${J.toujours.n ? annee(a, tous, auj) : ''}
      <div class="jr-g">
        <div class="jr-col">${J.toujours.n ? rythmeHtml(a, tous, auj, per) + matieres(a, J, sv) : ''}${livres(a, J, sv)}</div>
        <div class="jr-col">${memoire(sv)}${fidelite(a)}${heures(a)}${resistent()}</div>
      </div>
      ${depuisToujours(J)}
    </div>`;
  lier();
}

function lier() {
  const seg = document.getElementById('stRange');
  if (seg) seg.addEventListener('click', e => {
    const b = e.target.closest('[data-strange]'); if (!b) return;
    stats.range = +b.dataset.strange; setAnimate(false); render();
  });
  const plus = $.querySelector('[data-jr="livres"]');
  if (plus) plus.addEventListener('click', () => { stats.tousLivres = !stats.tousLivres; setAnimate(false); render(); });
  // sur téléphone l'année défile : on la montre par sa fin, aujourd'hui
  const h = document.getElementById('jrHeat');
  if (h) h.scrollLeft = h.scrollWidth;
}

/* ---------- l'export ---------- */
function csv() {
  const st = journalLocal(), auj = jourDe(Date.now());
  const J = rassembler(st.rep, st.locaux), a = activite(J, { aujourdhui: auj });
  const sv = savoir(db.decks, { maintenant: Date.now(), w: fsrsW() });
  const q = v => `"${String(v).replace(/"/g, '""')}"`;
  const L = [['section', 'clé', 'valeur']];
  L.push(['résumé', 'pages lues', a.n], ['résumé', 'réponses justes %', a.justesse == null ? '' : Math.round(a.justesse * 100)],
    ['résumé', 'temps (min)', Math.round(a.ms / 60000)], ['résumé', 'série de jours', a.serie],
    ['résumé', 'rappel estimé %', sv.retenue == null ? '' : Math.round(sv.retenue * 100)]);
  for (const [j, v] of [...a.jours.entries()].sort()) L.push(['jour', j, `${v.n} pages, ${v.ok} justes, ${Math.round(v.ms / 60000)} min`]);
  for (const m of nommerMatieres(a.matieres, db.subjects, J.matieres)) L.push(['matière', m.nom, Math.round(m.ms / 60000) + ' min']);
  for (const l of nommerLivres(a.livres, db.decks, J.livres)) L.push(['livre (temps)', l.nom + (l.existe ? '' : ' (supprimé)'), Math.round(l.ms / 60000) + ' min']);
  for (const p of sv.parLivre) L.push(['livre (maîtrise)', p.nom, `${Math.round(p.pct * 100)} % sues sur ${p.n}`]);
  for (const p of a.paliers) if (p.n) L.push(['après une pause', p.nom, `${Math.round(p.pct * 100)} % sur ${p.n}`]);
  return '﻿' + L.map(r => r.map(q).join(';')).join('\n');       // BOM : Excel ouvre l'UTF-8 correctement
}

export async function exporterJournal() {
  const name = 'folio-journal-' + new Date().toISOString().slice(0, 10) + '.csv';
  const texte = csv(), file = new File([texte], name, { type: 'text/csv' });
  /* Sur iPhone, une ancre à télécharger ne donne rien dans une app
     installée : la feuille de partage est le seul chemin qui aboutit. */
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Journal de lecture Folio' });
      return;
    }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  try {
    const url = URL.createObjectURL(file), a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast(I.check, 'Export téléchargé');
  } catch (e) {
    try { await navigator.clipboard.writeText(texte); toast(I.check, 'Export copié'); }
    catch (x) { toast(I.x, 'Export impossible'); }
  }
}
