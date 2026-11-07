// @ts-nocheck
/* L'onglet Santé de la console de l'éditeur (2026-11-07, M05.T1) : ce que
   les appareils ont remonté (src/core/rapport-erreurs.js), lu par
   admin_vigie et admin_erreurs — les chiffres de 24 h (ouvertures, erreurs,
   ouvertures bloquées, temps jusqu'au premier écran) et les erreurs des 7
   derniers jours, la plus fréquente d'abord : son texte, sa pile, où et
   sur quoi. Rien d'un utilisateur : la base n'en a pas. C'est ici qu'on lit
   le détail d'un ticket « vigie » de GitHub, qui ne porte que l'empreinte. */
import { adm } from '../data/etat.js';
import { esc, plur } from '../core/coeur-sync.js';
import { admSantePull } from '../core/admin.js';
import { I, svg } from '../icones.js';
import { CASES_MS, p75, tauxErreur } from '../erreurs.js';
import { timeAgo } from './reglages-corbeille.js';

const TYPES = { erreur: 'Erreur', promesse: 'Promesse', csp: 'CSP', bloque: 'Bloquée' };
const kc = (n, l, ton = '') => `<div class="ed-kc ${ton}"><b>${n}</b><span>${l}</span></div>`;
const cles = o => Object.entries(o || {}).sort((a, b) => b[1] - a[1])
  .map(([k, v]) => `<span class="ed-sante-k">${esc(k)} <i>${v}</i></span>`).join('');

function ligne(e) {
  return `<details class="ed-sante-e">
      <summary><span class="ed-sante-t ${e.type}">${TYPES[e.type] || esc(e.type)}</span>
        <b>${esc(e.message || '(sans message)')}</b>
        <span class="ed-sante-n">${e.n}×</span>
        <span class="ed-sante-d">${timeAgo(e.derniere)}</span></summary>
      <div class="ed-sante-c">
        <p><code>${esc(e.empreinte)}</code> · ${plur(e.jours_vus, 'jour')} · depuis ${timeAgo(e.premiere)}</p>
        <p>${cles(e.ecrans)}</p><p>${cles(e.navigateurs)}</p><p>${cles(e.builds)}</p>
        ${e.pile ? `<pre>${esc(e.pile)}</pre>` : ''}
      </div>
    </details>`;
}

export function vueSante() {
  const s = adm.sante;
  if (!s) { admSantePull(); return '<div class="ed-sante"><p class="ed-rien">…</p></div>'; }
  if (s.err) return `<div class="ed-sante"><p class="ed-rien">${svg(I.warn)} La base ne répond pas.</p></div>`;
  const j = (s.vigie && s.vigie.jour) || { demarrages: 0, erreurs: 0, bloques: 0, cases: [] };
  const taux = tauxErreur(j.erreurs, j.demarrages);
  const p = p75(j.cases || []);
  const duree = p == null ? '–' : p === Infinity ? `> ${CASES_MS.at(-1) / 1000} s` : `≤ ${p / 1000} s`;
  return `<div class="ed-sante">
      <div class="ed-chiffres">
        ${kc(j.demarrages, 'ouvertures 24 h')}
        ${kc(j.erreurs, 'erreurs 24 h', j.erreurs ? 'chaud' : '')}
        ${kc(taux == null ? '–' : taux + ' %', 'taux', taux > 1 ? 'chaud' : '')}
        ${kc(j.bloques, 'bloquées', j.bloques ? 'chaud' : '')}
        ${kc(duree, 'premier écran (p75)')}
      </div>
      ${(s.vigie && s.vigie.raisons || []).map(r => `<p class="ed-sante-alerte">${svg(I.warn)} ${esc(r)}</p>`).join('')}
      <div class="ed-sante-liste">
        ${s.erreurs.length ? s.erreurs.map(ligne).join('') : `<p class="ed-rien">${svg(I.check)} Aucune erreur remontée en 7 jours.</p>`}
      </div>
      <button class="ed-b" data-adm="sante-relire">${svg(I.refresh)}<span>Relire</span></button>
    </div>`;
}

export const ACTIONS_SANTE = { 'sante-relire': () => { adm.sante = null; admSantePull(); } };
