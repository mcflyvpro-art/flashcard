// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import './direct.css';
import { $ } from '../racine.js';
import { I, svg } from '../icones.js';
import { SITE } from '../adresse.js';
import { direct, view } from '../data/etat.js';
import { go, render } from './bibliotheque.js';
import { esc } from '../core/coeur-sync.js';
import { sallesPull } from '../core/cercle.js';
import { JEUX, cleReponse, ecoule, lienDefi, phase, pinLisible, placeTexte, places, podium, restant } from '../defi.js';
import { qrSvg } from '../qr.js';
import { arreter, avancer, exclure, fermer, repondre, suivie, suivre } from '../core/direct.js';
import { toast } from './import-cartes.js';
import { avatar } from './jeton.js';

/* ══════════ une partie en direct : l'écran ══════════
   Le même écran pour l'hôte et pour les joueurs ; ce qu'il montre dépend
   de `etat.hote` et de la phase. L'hôte est pensé pour être projeté (un
   ordinateur relié au vidéoprojecteur) : le code en très grand, le QR, les
   joueurs qui arrivent, l'énoncé lisible du fond de la salle. Les joueurs
   sont sur leur téléphone : de gros boutons de couleur, un geste par
   question.

   Chaque choix porte une couleur ET une forme (triangle, losange, rond,
   carré) : un élève qui distingue mal les couleurs reconnaît la forme que
   l'hôte montre au tableau. */

const FORMES = [
  '<path d="M12 4.5l8 14H4z" fill="currentColor" stroke="none"/>',
  '<path d="M12 3.5l8.5 8.5-8.5 8.5L3.5 12z" fill="currentColor" stroke="none"/>',
  '<circle cx="12" cy="12" r="8" fill="currentColor" stroke="none"/>',
  '<rect x="4.5" y="4.5" width="15" height="15" rx="1.5" fill="currentColor" stroke="none"/>'
];
const forme = k => `<svg viewBox="0 0 24 24" class="dx-forme" aria-hidden="true">${FORMES[k % 4]}</svg>`;

let raf = 0, armeFermer = 0;

/* ---------- le chrono ----------
   Seuls la barre et le nombre bougent à chaque image : l'écran ne se
   redessine qu'à un vrai changement d'état (core/direct.js). */
function tic() {
  raf = 0;
  if (view.name !== 'direct') return;
  const e = direct.etat, t = Date.now();
  if (e && e.etat === 'question') {
    const ph = phase(e, t, direct.dec), ms = restant(e, t, direct.dec);
    for (const n of document.querySelectorAll('[data-dx-s]')) n.textContent = Math.ceil(ms / 1000);
    for (const n of document.querySelectorAll('[data-dx-barre]')) n.style.transform = `scaleX(${1 - ecoule(e, t, direct.dec)})`;
    const root = document.querySelector('.dx');
    if (root && root.dataset.phase !== ph) root.dataset.phase = ph;
  }
  raf = requestAnimationFrame(tic);
}

function lancerTic() { if (!raf) raf = requestAnimationFrame(tic); }

/* ---------- morceaux communs ---------- */
const sousTitre = e => [JEUX[e.jeu] ? JEUX[e.jeu].nom : '', e.classe || e.club || ''].filter(Boolean).map(esc).join(' · ');

function tete(e, droite = '') {
  return `<header class="dx-tete">
    <button class="dx-x" data-dx="quitter" aria-label="${e && e.hote ? 'Fermer la partie' : 'Quitter'}">${svg(I.x)}</button>
    <div class="dx-titre"><b>${esc(e ? e.titre : 'Partie en direct')}</b>${e ? `<i>${sousTitre(e)}</i>` : ''}</div>
    ${droite}</header>`;
}

const compteur = e => e.etat === 'question' || e.etat === 'correction'
  ? `<div class="dx-num"><b>${e.rang + 1}</b>/${e.total}</div>` : '';

const reseau = () => direct.err >= 2 ? `<div class="dx-reseau">${svg(I.cloud)}Connexion perdue</div>` : '';

function choixHtml(e, cliquable, mien) {
  const c = (e.question && e.question.choix) || [];
  if (e.jeu === 'vf') {
    return `<div class="dx-prop"><b>${esc(c[0] || '')}</b></div>
      <div class="dx-choix deux">${['Vrai', 'Faux'].map((t, k) => `<button class="dx-c vf${k}${mien === k ? ' mien' : ''}" ${cliquable ? `data-dx="choix" data-id="${k}"` : 'tabindex="-1"'}>
        ${svg(k ? I.x : I.check)}<span>${t}</span></button>`).join('')}</div>`;
  }
  return `<div class="dx-choix${c.length > 2 ? '' : ' deux'}">${c.map((t, k) => `<button class="dx-c c${k}${mien === k ? ' mien' : ''}"
    ${cliquable ? `data-dx="choix" data-id="${k}"` : 'tabindex="-1"'}>${forme(k)}<span>${esc(t)}</span></button>`).join('')}</div>`;
}

function barre() { return `<div class="dx-temps"><em data-dx-barre></em></div>`; }

function topHtml(top, n = 5) {
  return `<ol class="dx-top">${places(top || []).slice(0, n).map(r => `<li class="${r.moi ? 'moi' : ''}">
    <span class="dx-pl">${r.place}</span><b>${esc(r.nom)}</b><em>${r.score}</em></li>`).join('')}</ol>`;
}

function podiumHtml(top) {
  const p = podium(top || []);
  const ordre = [[p[1], 2], [p[0], 1], [p[2], 3]].filter(([r]) => r);
  return `<div class="dx-podium" style="--n:${ordre.length}">${ordre.map(([r, m]) => `<div class="dx-marche m${m}">
      <b>${esc(r.nom)}</b><em>${r.score} pts</em><div class="dx-socle"><span>${r.place}</span></div></div>`).join('')}</div>`;
}

/* ══════════ l'hôte ══════════ */
function hoteAttente(e) {
  const l = e.liste || [];
  const lien = lienDefi(SITE, e.pin);
  return `${tete(e)}
    <div class="dx-lobby">
      <section class="dx-entrer">
        <p class="dx-k">${svg(I.hash)}<b>Cercle → Entrer un code</b></p>
        <div class="dx-pin">${esc(pinLisible(e.pin))}</div>
        <div class="dx-qr">${qrSvg(lien, 'Rejoindre la partie')}</div>
      </section>
      <section class="dx-salle">
        <div class="dx-n">${svg(I.users)}<b>${e.joueurs}</b></div>
        ${l.length ? `<div class="dx-chips">${l.map(p => `<button class="dx-chip" data-dx="exclure" data-id="${esc(p.id)}" data-k="dxj:${esc(p.id)}"
            title="Retirer ${esc(p.nom)}">${avatar(p.id, p.nom, 'xs')}${esc(p.nom)}${svg(I.x)}</button>`).join('')}</div>`
          : `<p class="dx-attente"><span></span><span></span><span></span></p>`}
      </section>
    </div>
    <footer class="dx-pied"><span></span>
      <button class="cta" data-dx="avancer" ${e.joueurs && !direct.envoi ? '' : 'disabled'}>Lancer la partie${svg(I.play)}</button></footer>`;
}

function hoteQuestion(e) {
  return `${tete(e, `<div class="dx-repondu" title="Réponses reçues">${svg(I.check)}<b>${e.repondu}</b>/${e.joueurs}</div>`)}
    <div class="dx-scene">
      ${compteur(e)}
      <h2 class="dx-enonce">${esc(e.question.enonce)}</h2>
      <div class="dx-lecture"><span data-dx-s>3</span></div>
      <div class="dx-jeu">${e.jeu === 'ecrit' ? `<p class="dx-ecrit-h">${svg(I.pen)}</p>` : choixHtml(e, false)}
        <div class="dx-chrono"><span data-dx-s></span></div>${barre()}</div>
    </div>
    <footer class="dx-pied"><span></span><button class="cc-btn" data-dx="avancer" ${direct.envoi ? 'disabled' : ''}>${svg(I.skip)}Passer</button></footer>`;
}

function repartition(e) {
  const c = e.correction, r = c.repartition || [], max = Math.max(1, ...r);
  if (e.jeu === 'ecrit') return `<div class="dx-sol">${svg(I.check)}<b>${esc(c.reponse)}</b></div>
    <p class="dx-k">${svg(I.check)}${c.justes}/${e.repondu}</p>`;
  const noms = e.jeu === 'vf' ? ['Vrai', 'Faux'] : (e.question.choix || []);
  return `${e.jeu === 'vf' ? `<div class="dx-prop"><b>${esc((e.question.choix || [])[0] || '')}</b></div>` : ''}
    <div class="dx-barres">${noms.map((t, k) => `<div class="dx-b ${e.jeu === 'vf' ? 'vf' + k : 'c' + k}${k === c.bonne ? ' bonne' : ''}">
      <div class="dx-b-h"><em style="height:${Math.round(r[k] / max * 100)}%"></em></div>
      <b>${r[k] || 0}</b><span>${e.jeu === 'vf' ? svg(k ? I.x : I.check) : forme(k)}${esc(t)}${k === c.bonne ? svg(I.check) : ''}</span></div>`).join('')}</div>`;
}

function hoteCorrection(e) {
  const derniere = e.rang + 1 >= e.total;
  return `${tete(e)}
    <div class="dx-scene corr">
      ${compteur(e)}
      <h2 class="dx-enonce petit">${esc(e.question.enonce)}</h2>
      <div class="dx-corr"><div class="dx-rep">${repartition(e)}</div>
        <aside class="dx-cl"><h3>${svg(I.podium)}</h3>${topHtml(e.top)}</aside></div>
    </div>
    <footer class="dx-pied"><span class="dx-bilan">${svg(I.check)}<b>${e.correction.justes}</b>/${e.repondu}</span>
      <button class="cta" data-dx="avancer" ${direct.envoi ? 'disabled' : ''}>${derniere ? 'Voir le podium' : 'Question suivante'}${svg(I.arrow)}</button></footer>`;
}

function hoteFini(e) {
  return `${tete(e)}
    <div class="dx-scene fin">
      <h2 class="dx-bravo">${svg(I.trophy)}</h2>
      ${e.top && e.top.length ? podiumHtml(e.top) : `<p class="dx-k">${svg(I.users)}0</p>`}
      ${(e.top || []).length > 3 ? `<div class="dx-reste">${topHtml(e.top, 100)}</div>` : ''}
    </div>
    <footer class="dx-pied"><button class="cc-btn" data-dx="rejouer">${svg(I.redo)}Rejouer</button>
      <button class="cta" data-dx="terminer">Terminer${svg(I.check)}</button></footer>`;
}

/* ══════════ un joueur ══════════ */
function joueurAttente(e) {
  const l = (e.liste || []).filter(p => !p.moi);
  return `${tete(e)}
    <div class="dx-j dx-j-attente">
      <div class="dx-ok">${svg(I.check)}</div>
      <p class="dx-moi">${esc(e.moi ? e.moi.nom : '')}</p>
      <p class="dx-attente"><span></span><span></span><span></span></p>
      ${l.length ? `<div class="dx-chips petit">${l.map(p => `<span class="dx-chip" data-k="dxj:${esc(p.id || p.nom)}">${esc(p.nom)}</span>`).join('')}</div>` : ''}
    </div>`;
}

function joueurQuestion(e) {
  const m = e.moi || {};
  if (m.repondu || direct.choix != null) {
    return `${tete(e, compteur(e))}
      <div class="dx-j dx-j-envoye">${barre()}
        <div class="dx-ok petit">${svg(I.check)}</div>
        <p class="dx-k">${svg(I.users)}${e.repondu}/${e.joueurs}</p></div>`;
  }
  const jeu = e.jeu === 'ecrit'
    ? `<form class="dx-ecrit" id="dxecrit" autocomplete="off"><input id="dxtx" value="${esc(direct.texte)}" placeholder="Ta réponse"
        autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="send" maxlength="200" aria-label="Ta réponse">
        <button class="cta" data-dx="ecrit">Valider</button></form>`
    : choixHtml(e, true, direct.choix);
  return `${tete(e, compteur(e))}
    <div class="dx-j dx-j-q">${barre()}
      <h2 class="dx-enonce">${esc(e.question.enonce)}</h2>
      <div class="dx-lecture"><span data-dx-s>3</span></div>
      <div class="dx-jeu">${jeu}<div class="dx-chrono petit"><span data-dx-s></span></div></div>
    </div>`;
}

function joueurCorrection(e) {
  const m = e.moi || {}, d = m.derniere, c = e.correction;
  const ton = d ? (d.juste ? 'juste' : 'faux') : 'tard';
  const titre = d ? (d.juste ? 'Juste !' : 'Raté') : 'Trop tard';
  const bonne = e.jeu === 'vf' ? (c.bonne === 0 ? 'Vrai' : 'Faux') + ' — ' + c.reponse : c.reponse;
  return `${tete(e, compteur(e))}
    <div class="dx-j dx-verdict ${ton}">
      <div class="dx-v-ic">${svg(d && d.juste ? I.check : I.x)}</div>
      <h2>${titre}</h2>
      ${d && d.juste ? `<p class="dx-pts">+${d.points}</p>${m.serie > 1 ? `<p class="dx-serie">${svg(I.flame)}${m.serie} d’affilée</p>` : ''}`
        : `<p class="dx-sol-j">${svg(I.check)}<b>${esc(bonne)}</b></p>`}
      <div class="dx-score"><span><b>${m.score}</b>pts</span><span><b>${placeTexte(m.place)}</b>/ ${e.joueurs}</span></div>
    </div>`;
}

function joueurFini(e) {
  const m = e.moi || {};
  return `${tete(e)}
    <div class="dx-j dx-j-fin">
      <h2 class="dx-bravo">${svg(I.trophy)}${m.place === 1 ? 'Tu gagnes !' : `Tu termines ${placeTexte(m.place)}`}</h2>
      <p class="dx-k"><b>${m.score}</b> pts · ${svg(I.check)}${m.justes || 0}/${e.total}</p>
      ${e.top && e.top.length ? podiumHtml(e.top) : ''}
      <button class="cta" data-dx="terminer">Terminer</button>
    </div>`;
}

function absent(e) {
  return `${tete(null)}<div class="dx-j"><div class="dx-v-ic">${svg(I.x)}</div>
    <h2>${e.etat === 'exclu' ? 'L’hôte t’a retiré de la partie' : 'Cette partie n’existe plus'}</h2>
    <button class="cta" data-dx="terminer">Retour au cercle</button></div>`;
}

/* ══════════ l'écran ══════════ */
const ECRANS = {
  hote: { attente: hoteAttente, question: hoteQuestion, correction: hoteCorrection, fini: hoteFini },
  joueur: { attente: joueurAttente, question: joueurQuestion, correction: joueurCorrection, fini: joueurFini }
};

function corpsEcran(e) {
  if (!e) return `${tete(null)}<div class="dx-j"><div class="cc-load"></div></div>`;
  if (e.etat === 'absent' || e.etat === 'exclu') return absent(e);
  return (ECRANS[e.hote ? 'hote' : 'joueur'][e.etat] || absent)(e);
}

// la réponse écrite garde sa saisie et son curseur à travers un redessin
function brancherEcrit(actif, ph) {
  const tx = document.getElementById('dxtx'), f = document.getElementById('dxecrit');
  if (tx) {
    tx.addEventListener('input', () => { direct.texte = tx.value; });
    if (actif || ph === 'reponse') { tx.focus(); tx.setSelectionRange(tx.value.length, tx.value.length); }
  }
  if (f) f.onsubmit = ev => { ev.preventDefault(); envoyerTexte(); };
}

export function directEcran() {
  if (!direct.id) return go('commu');
  if (!suivie()) suivre(() => { if (view.name === 'direct') render(); });
  const e = direct.etat;
  const actif = !!document.activeElement && document.activeElement.id === 'dxtx';
  const ph = e ? phase(e, Date.now(), direct.dec) : 'absent';
  /* la clé change avec l'étape de la partie (attente, question n, correction n…) :
     ce qui arrive avec elle s'anime une fois, pas à chaque réponse qui tombe */
  $.innerHTML = `<div class="dx ${e && e.hote ? 'hote' : 'joueur'}" data-etat="${e ? e.etat : ''}" data-phase="${ph}"
    data-k="dx:${e ? e.etat + ':' + e.rang : ''}">${
    reseau()}${corpsEcran(e)}</div>`;
  brancherEcrit(actif, ph);
  lancerTic();
}

/* ---------- les gestes ---------- */
async function envoyerChoix(k) {
  if (direct.choix != null) return;
  direct.choix = +k; render();
  const r = await repondre(+k, null);
  if (r === 'ferme') { direct.choix = null; toast(I.clock, 'Trop tard pour cette question'); render(); }
}

async function envoyerTexte() {
  const t = cleReponse(direct.texte);
  if (!t || direct.choix != null) return;
  direct.choix = -1; render();
  const r = await repondre(null, t);
  if (r === 'ferme') { direct.choix = null; toast(I.clock, 'Trop tard pour cette question'); render(); }
  else direct.texte = '';
}

function sortir() {
  arreter();
  if (raf) { cancelAnimationFrame(raf); raf = 0; }
  sallesPull();
  const r = direct.retour;
  return r && r.name !== 'direct' && r.name !== 'login' ? go(r.name, r.id) : go('commu');
}

const ACTIONS = {
  avancer: async () => {
    const r = await avancer();
    if (r === 'vide') toast(I.users, 'Personne n’est encore entré');
  },
  choix: k => envoyerChoix(k),
  ecrit: () => envoyerTexte(),
  exclure: async id => { await exclure(id); toast(I.check, 'Joueur retiré'); },
  quitter: async (id, b) => {
    const e = direct.etat;
    if (!e || !e.hote || e.etat === 'fini') return sortir();
    if (Date.now() - armeFermer > 3000) {
      armeFermer = Date.now(); b.classList.add('arme'); toast(I.warn, 'Touche encore pour fermer la partie pour tous');
      return;
    }
    await fermer().catch(() => toast(I.x, 'Fermeture impossible'));
    sortir();
  },
  terminer: async () => {
    const e = direct.etat;
    if (e && e.hote && e.etat !== 'fini') await fermer().catch(() => {});   // déjà fermée : rien à faire
    sortir();
  },
  rejouer: () => { arreter(); return go('defi'); }
};

document.addEventListener('click', e => {
  const b = e.target.closest('[data-dx]');
  if (!b || b.disabled) return;
  const f = ACTIONS[b.dataset.dx];
  if (!f) return;
  e.preventDefault();
  f(b.dataset.id, b);
});

// au clavier, pendant une question : 1 à 4 répondent (l'hôte n'a rien à taper)
document.addEventListener('keydown', e => {
  if (view.name !== 'direct' || !direct.etat || direct.etat.hote || e.target.tagName === 'INPUT') return;
  const k = '1234'.indexOf(e.key);
  if (k < 0 || direct.etat.etat !== 'question' || direct.etat.jeu === 'ecrit') return;
  if (document.querySelector(`[data-dx="choix"][data-id="${k}"]`)) envoyerChoix(k);
});
