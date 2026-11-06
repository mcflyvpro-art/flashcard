// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { I, svg } from '../icones.js';
import { menu, view } from '../data/etat.js';
import { deck, esc, setMeta } from '../core/coeur-sync.js';
import { fsrsR } from '../fsrs.js';
import { fsrsW } from './carte-media.js';
import { mountMenu, paintMenu } from './menus-a.js';
import { render } from './bibliotheque.js';
import { ouvrirExamenBlanc } from './examen-porte.js';
import { questionsPossibles } from '../examen-blanc.js';
import { compte, dateExamen, joursAvant, FENETRE, RETENTION_EXAMEN } from '../examen.js';
import { dateValable, prevision } from '../examen-feuille.js';
import './examen.css';

/* ══════════ l'objectif examen d'un livre (Mirandola Infini, 2026-11-05) ══════════
   Chargé à la demande par ui/examen-porte.js : rien d'autre ne doit
   importer ce fichier. La date vit dans `deck.meta.examen` (synchronisée
   avec le livre) ; ce qu'elle change au moteur est dans src/examen.js.

   La feuille dit trois choses, sans phrase : combien de jours restent, ce
   qu'on saurait le jour J si l'on s'arrêtait là (la prévision de FSRS), et
   ce que fait le moteur (95 % visés dans les 30 derniers jours, rien ne
   part au-delà du jour J). Changer la date ou la retirer, rien d'autre. */

const s = { modif: false };
const iso = t => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const lisible = x => new Date(dateExamen(x)).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const DAY = 86400000;

export function preparer() { s.modif = false; }

function choixHtml(d, ex) {
  const now = Date.now();
  const min = iso(now + DAY), max = iso(now + 730 * DAY);
  return `<form class="ex-f" id="exf">
      <label class="ex-date">${svg(I.cal)}<input type="date" id="exd" required min="${min}" max="${max}"
        value="${ex && dateValable(ex, now) ? ex : ''}" aria-label="Date de l’examen"></label>
      <button class="cta" id="exok" type="submit">${ex ? 'Changer' : 'Fixer la date'}</button>
    </form>`;
}

function etatHtml(d, ex) {
  const now = Date.now(), j = joursAvant(ex, now);
  const p = prevision(d.cards, ex, now, (c, t) => fsrsR(fsrsW(), t, { S: c.S, D: c.D || 5, F: c.F || c.S }));
  const dedans = j <= FENETRE;
  return `<div class="ex-j">
      <b>${esc(compte(ex, now))}</b>
      <span>${esc(lisible(ex))}</span>
    </div>
    ${p == null ? '' : `<div class="ex-prev" title="Ce que tu saurais le jour J sans relire d’ici là">
      <span>Le jour J</span><i style="--p:${p}%"></i><b>${p} %</b></div>`}
    <div class="ex-faits">
      <span class="${dedans ? 'on' : ''}">${svg(I.target)}${Math.round(RETENTION_EXAMEN * 100)} %${dedans ? '' : ` dès J-${FENETRE}`}</span>
      <span class="on">${svg(I.clock)}Rien après le jour J</span>
    </div>
    ${s.modif ? choixHtml(d, ex) : `<div class="ex-gestes">
      <button class="mi" data-ex="modif">${svg(I.pen)}Changer la date</button>
      <button class="mi warn" data-ex="retirer">${svg(I.x)}Retirer l’objectif</button>
    </div>`}`;
}

export function peindre(w) {
  const d = deck(view.id);
  if (!d) return;
  const ex = d.meta && d.meta.examen;
  const vivant = ex && joursAvant(ex, Date.now()) >= 0;
  w.innerHTML = `<div class="scrim" data-mact="close"></div>
    <div class="menu ex" data-etape="${vivant ? (s.modif ? 'modif' : 'etat') : 'choix'}">
      <div class="mhd">${svg(I.target)}<span class="mhx"><b>Objectif examen</b><i>${esc(d.name)}</i></span></div>
      ${vivant ? etatHtml(d, ex) : choixHtml(d, null)}
      ${questionsPossibles(d.cards).length ? `<div class="ex-blanc"><button class="mi" data-ex="blanc">${svg(I.pen)}Examen blanc
        <span class="tail">${svg(I.arrow)}</span></button></div>` : ''}
    </div>`;
  mountMenu(w);
}

function poser(valeur) {
  const d = deck(view.id);
  if (!d) return;
  const meta = { ...(d.meta || {}) };
  if (valeur) meta.examen = valeur; else delete meta.examen;
  d.meta = meta;
  setMeta(d, {});
  s.modif = false;
  render();
  paintMenu();
}

document.addEventListener('click', ev => {
  const b = ev.target.closest('[data-ex]');
  if (!b || menu !== 'examen') return;
  if (b.dataset.ex === 'modif') { s.modif = true; paintMenu(); }
  else if (b.dataset.ex === 'blanc') ouvrirExamenBlanc(view.id);
  else if (b.dataset.ex === 'retirer') poser(null);
});

document.addEventListener('submit', ev => {
  if (ev.target.id !== 'exf' || menu !== 'examen') return;
  ev.preventDefault();
  const v = document.getElementById('exd').value;
  if (dateValable(v, Date.now())) poser(v);
});
