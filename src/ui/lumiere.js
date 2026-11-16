// @ts-nocheck
/* ══════════ la matière des abonnés, sans jamais sauter (2026-11-16) ══════════
   Demandé : « quand je passe d'une page à l'autre, l'animation recommence sa
   saccade ; quand j'appuie en boucle sur la même page, elle ne doit pas se
   réinitialiser ». L'app redessine en innerHTML : un bouton redessiné est un
   nœud neuf, et son animation CSS repartait de son début — la lave d'Infini,
   l'or de Mirandola+, le liseré d'un jeton sautaient à chaque écran, à chaque
   appui sur l'onglet où l'on est déjà.
   Chaque animation de la matière est donc calée sur l'horloge murale : son
   départ est l'origine de l'époque (startTime = −timeOrigin), sa phase celle
   de Date.now(). Un nœud neuf reprend exactement là où en était celui qu'il
   remplace, et même d'un rechargement à l'autre. L'observateur passe en
   microtâche, avant que la page ne soit peinte : le nœud neuf n'est jamais vu
   à sa phase de départ. Le décalage propre à un élément (animation-delay)
   reste le sien : les icônes d'une liste gardent leur ondulation.
   Chargé avec la feuille de la matière, pour un abonné (ui/bridage.js) et
   l'écran Mirandola+ (ui/plus.js) seulement. */
import './lumiere-abonne.css';

const MATIERE = /^(lave|lueur|lisere|fp-tour)/;

export function caler() {
  const depart = -performance.timeOrigin;
  for (const a of document.getAnimations()) {
    if (a.startTime !== depart && MATIERE.test(a.animationName)) a.startTime = depart;
  }
}

// un chiffre qui change (un chrono, à chaque image) ne touche que du texte : rien à caler
const element = l => { for (const n of l) if (n.nodeType === 1) return true; return false; };
new MutationObserver(recs => { if (recs.some(r => element(r.addedNodes))) caler(); })
  .observe(document.body, { childList: true, subtree: true });
caler();
