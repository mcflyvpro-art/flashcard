// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { $ } from '../racine.js';

/* ══════════ le mouvement ══════════
   L'app redessine ses écrans en entier (`$.innerHTML = …`) : un nœud neuf
   rejoue son animation d'entrée, même s'il montre exactement ce qui était
   déjà là. Un jour choisi dans un calendrier, une classe cochée, dix
   appuis sur le même onglet relançaient ainsi l'entrée de toute la page,
   de la feuille, de la barre du bas. Règle de toute l'app, depuis le
   2026-10-25 : ne s'anime que ce qui ARRIVE sous les yeux, une seule fois.

   - L'entrée d'un écran (`.fade` sur la racine) ne joue qu'à un vrai
     changement d'écran ; un redessin pendant qu'elle joue la prolonge au
     même point (délai négatif, `--retard`), il ne la recommence pas et ne
     la coupe pas net.
   - Un élément qui peut apparaître au milieu d'un écran (la barre d'une
     sélection, un joueur qui entre dans la salle, l'onglet choisi d'une
     création) porte une clé `data-k` : il reçoit `.neuf` — et donc son
     animation — seulement si aucun élément de même clé n'était à l'écran.
     Les feuilles ont leur propre mécanique (menus-a.js), les toasts aussi.

   Ce module n'importe que la racine : il ne doit jamais entrer dans un
   cycle d'imports (voir CLAUDE.md). */

const RALENTI = matchMedia('(prefers-reduced-motion: reduce)');
export const sansMouvement = () => RALENTI.matches;

/* ---------- les éléments à clé ----------
   Un observateur plutôt qu'un appel après render() : bien des morceaux
   d'écran se redessinent sans lui (la carte suivante d'une révision, le
   pied d'une page, une partie en direct). Il passe en microtâche, avant
   que la page ne soit peinte : l'élément neuf n'est jamais vu immobile. */
let cles = new Set();

function passer() {
  const ici = new Set();
  for (const n of document.querySelectorAll('[data-k]')) {
    const k = n.dataset.k;
    if (!cles.has(k) && !ici.has(k)) n.classList.add('neuf');
    ici.add(k);
  }
  cles = ici;
}

const element = l => { for (const n of l) if (n.nodeType === 1) return true; return false; };
new MutationObserver(recs => {
  // un chiffre qui change (le chrono d'une partie, à chaque image) ne touche que du texte
  if (recs.some(r => element(r.addedNodes) || element(r.removedNodes))) passer();
}).observe(document.body, { childList: true, subtree: true });

/* ---------- l'entrée d'un écran ----------
   FENETRE couvre l'entrée la plus longue, échelonnement compris (app.css :
   0,3 s + 11 × 16 ms). Passé ce délai, `.fade` s'en va : un morceau d'écran
   redessiné ensuite, hors render(), ne rejoue rien. */
const FENETRE = 560;
let debut = -1e9, minuterie = 0;

/* `etat` : 'arrivee' (un autre écran, qu'on anime), 'calme' (un autre
   écran, déjà vu glisser sous le doigt : rien ne doit bouger) ou
   'redessin' (le même écran). */
export function entreeEcran(etat) {
  const t = performance.now();
  if (etat === 'arrivee') debut = RALENTI.matches ? -1e9 : t;
  if (etat === 'calme') debut = -1e9;
  const age = t - debut;
  clearTimeout(minuterie);
  if (age >= FENETRE) { $.classList.remove('fade'); $.style.removeProperty('--retard'); return; }
  $.style.setProperty('--retard', -Math.round(age) + 'ms');
  $.classList.add('fade');
  minuterie = setTimeout(() => { $.classList.remove('fade'); $.style.removeProperty('--retard'); }, FENETRE - age);
}

/* ---------- la glissière des onglets ----------
   La barre du bas est redessinée avec l'écran : sa glissière apparaissait
   d'un coup sous le nouvel onglet. Elle part maintenant de là où on la
   voyait (après un balayage, elle y est déjà : rien ne bouge). */
export const glissiereAvant = () => {
  const sl = $.querySelector('.tabs .sl');
  return sl && sl.isConnected ? new DOMMatrixReadOnly(getComputedStyle(sl).transform).m41 : null;
};

export function glisserOnglet(avant) {
  const sl = $.querySelector('.tabs .sl');
  if (!sl || avant === null || RALENTI.matches) return;
  const cible = sl.style.transform;
  if (Math.abs(new DOMMatrixReadOnly(getComputedStyle(sl).transform).m41 - avant) < 1) return;
  sl.style.transition = 'none';
  sl.style.transform = `translateX(${avant}px)`;
  void sl.offsetWidth;
  sl.style.transition = '';
  sl.style.transform = cible;
}

/* ---------- une barre de progression ----------
   Redessinée à chaque question avec une largeur de 0 %, elle repartait du
   début puis courait jusqu'à sa valeur : à chaque réponse, toute la barre
   rejouait la séance. Elle part maintenant de la largeur qu'on voyait.
   `cle` distingue une séance d'une autre (une nouvelle repart de zéro). */
const barres = new Map();

export function avancer(cle, n, pct) {
  if (!n) return;
  const avant = barres.has(cle) ? barres.get(cle) : 0;
  barres.set(cle, pct);
  if (barres.size > 20) barres.delete(barres.keys().next().value);
  n.style.transition = 'none';
  n.style.width = avant + '%';
  void n.offsetWidth;
  n.style.transition = '';
  n.style.width = pct + '%';
}
