// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { esc } from '../core/coeur-sync.js';

/* ══════════ des tuiles nommées (2026-11-18) ══════════
   Demandé : « ces micro-infos ne sont pas claires et chargent l'écran ».
   Sous un titre, une seule information, dite en mots ; le détail d'une
   fiche se range ici : une valeur en gros, son nom dessous — jamais une
   icône seule devant un chiffre, jamais quatre informations enfilées par
   des points. `l` : [[valeur, nom], …] ; une entrée vide est sautée. */
export const tuiles = (l, cls = '') => `<div class="tuiles${cls ? ' ' + cls : ''}">${l.filter(Boolean).map(([v, nom]) =>
  `<span><b>${esc(String(v))}</b><i>${esc(nom)}</i></span>`).join('')}</div>`;

/* Un nombre lisible : 1671 → « 1 671 », comme on l'écrit en français. */
export const nombre = n => Number(n || 0).toLocaleString('fr-FR');
