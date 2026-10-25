// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { I, svg } from '../icones.js';
import { visuels } from '../data/etat.js';
import { esc } from '../core/coeur-sync.js';
import { voir } from '../core/visuels.js';
import { COULEURS, EMBLEMES, embleme, jetonGroupe, jetonPersonne } from '../jeton.js';
import { TRAITS, avatarSvg } from '../avatar.js';
import { medaille } from '../club.js';

/* ══════════ les jetons : un seul dessin, partout ══════════
   Une personne : un rond, ses initiales ou son avatar (src/avatar.js). Une classe ou un
   club : un carré arrondi et son emblème — la forme dit d'un coup d'œil
   s'il s'agit de quelqu'un ou d'un groupe. Même fonction sur tous les
   écrans (cercle, club, espace prof, « Mes classes », partie en direct,
   fiches) : un élève a le même visage partout. Tailles : xs 24, sm 30,
   (défaut) 40, lg 54, xl 84 px. */

const TAILLE = /^(xs|sm|lg|xl)$/;

function personneHtml(id, nom, v, taille) {
  const j = jetonPersonne(id, nom, v && { figure: v.cle, teinte: v.teinte });
  return `<i class="jt${taille ? ' ' + taille : ''}${j.avatar ? ' vis' : ''}" data-jt="p:${esc(id || '')}"
    data-nom="${esc(nom || '')}" style="--k:${j.couleur}" aria-hidden="true">${j.avatar ? avatarSvg(j.avatar) : esc(j.texte)}</i>`;
}

function groupeHtml(id, v, taille, k) {
  const j = jetonGroupe(id, v && { embleme: v.cle, teinte: v.teinte });
  return `<i class="jt groupe${taille ? ' ' + taille : ''}"${k ? ` data-jt="${esc(k)}"` : ''}
    style="--k:${j.couleur}" aria-hidden="true">${svg(I[EMBLEMES[j.embleme]])}</i>`;
}

// le jeton d'une personne (`nom` : celui qu'on écrit à côté)
export const avatar = (id, nom, taille = '') => personneHtml(id, nom, voir('p', id), taille);

// celui d'une classe : son emblème choisi par qui la gère, sinon tiré de son identifiant
export const blason = (cid, taille = '') => groupeHtml(cid, voir('c', cid), taille, 'c:' + cid);

// celui d'un club : mes_clubs() rend déjà l'emblème et la teinte
export const blasonClub = (g, taille = '') => groupeHtml(g.id, { cle: g.embleme, teinte: g.teinte }, taille);

// la couleur d'une classe, pour ce qui se teinte à côté de son blason
export function couleurClasse(cid) {
  const v = voir('c', cid);
  return jetonGroupe(cid, v && { teinte: v.teinte }).couleur;
}

// l'icône seule d'un emblème (dans un conteneur déjà coloré)
export const iconeEmbleme = k => svg(I[EMBLEMES[embleme(k)]] || I.book);

/* Un choix vient d'arriver : on remplace chaque jeton concerné à sa place,
   sans redessiner l'écran. */
export function repeindreJetons(cles) {
  for (const k of cles) {
    for (const n of document.querySelectorAll(`[data-jt="${CSS.escape(k)}"]`)) {
      const taille = [...n.classList].find(c => TAILLE.test(c)) || '';
      const id = k.slice(2), v = visuels[k];
      n.outerHTML = k[0] === 'p' ? personneHtml(id, n.dataset.nom, v, taille) : groupeHtml(id, v, taille, k);
    }
  }
}

/* Une médaille dessinée pour les trois premiers d'un classement (or, argent,
   bronze), le rang en chiffre sinon — plus d'émoji, qui changeait d'un
   téléphone à l'autre. */
export const medailleHtml = p => (medaille(p)
  ? `<span class="med m${p}" role="img" aria-label="${p === 1 ? '1er' : p + 'e'}">${svg(I.medaille)}<b>${p}</b></span>` : String(p));

/* ---------- l'avatar : un aperçu par choix ----------
   Chaque trait se choisit en voyant le visage qu'il donnerait : la grille
   d'un trait dessine l'avatar en cours avec chacune des valeurs. */
export function grilleTrait(a, trait, teinteK, attr, choisi = true) {
  return `<div class="jt-grille av-grille">${TRAITS[trait].map((nom, k) => {
    const on = choisi && a[trait] === k;
    return `<button class="jt-choix av-choix${on ? ' on' : ''}" ${attr}="${trait}:${k}" aria-label="${esc(nom)}" aria-pressed="${on}">
      <i class="jt vis" style="--k:${teinteK}">${avatarSvg({ ...a, [trait]: k })}</i></button>`;
  }).join('')}</div>`;
}

/* ---------- les grilles de choix (emblème d'une classe ou d'un club, couleurs) ---------- */

export const grilleEmblemes = (sel, attr) => `<div class="jt-grille">${Object.keys(EMBLEMES).map(k =>
  `<button class="jt-choix emb${sel === k ? ' on' : ''}" ${attr}="${k}" aria-label="${k}">${iconeEmbleme(k)}</button>`).join('')}</div>`;

export const grilleCouleurs = (sel, attr) => `<div class="jt-couleurs">${COULEURS.map((c, i) =>
  `<button class="jt-couleur${+sel === i && sel != null ? ' on' : ''}" ${attr}="${i}" style="--k:${c}" aria-label="Couleur ${i + 1}"></button>`).join('')}</div>`;
