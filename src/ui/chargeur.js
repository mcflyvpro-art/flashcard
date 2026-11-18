/* ══════════ le chargeur (2026-11-18) ══════════
   Demandé : « le lazy charge est moche et archaïque ; rends-le fun,
   magnifique, animé, incroyable ». Il y avait sept façons de dire qu'on
   attend : une icône grise figée, « Chargement… », trois points, des blocs
   gris qui luisaient. Il n'en reste qu'une, partout où l'app attend — un
   morceau qui arrive, une liste que la base n'a pas encore rendue : trois
   flashcards qui se battent, chacune vient devant, se retourne en l'air et
   repart derrière, dans la matière de l'offre (le bleu-rose de la marque,
   l'or de Mirandola+). Il ne paraît qu'au bout de 200 ms (app.css,
   `chg-in`) : un écran prêt plus tôt ne le montre jamais.

   Sans aucune dépendance : il se pose dans n'importe quel gabarit, même
   pendant que le reste de l'app finit de s'évaluer (voir les cycles
   d'imports, CLAUDE.md). `mini` pour une liste dans un écran déjà là. */
export const chargeur = (mini = false) =>
  `<div class="chg${mini ? ' mini' : ''}" role="status" aria-label="Chargement"><i></i><i></i><i></i></div>`;
