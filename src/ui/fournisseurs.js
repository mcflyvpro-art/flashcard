// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { lienFournisseur } from '../core/connexion-externe.js';

/* ══════════ « Continuer avec Google », « Continuer avec Apple » (2026-10-29) ══════════
   Chargé par ui/connexion.js seulement quand le projet a allumé un de ces
   fournisseurs : ni les boutons ni leurs marques ne pèsent sur le démarrage.
   Le retour (la session dans l'adresse) se lit dans ui/liens-entrants.js. */

const NOMS_FOURNISSEURS = { google: 'Google', apple: 'Apple' };
// les marques des fournisseurs, comme leurs règles l'exigent sur un bouton de connexion
const MARQUES = {
  google: '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>',
  apple: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16.37 12.6c-.02-2.2 1.8-3.26 1.88-3.31-1.02-1.5-2.62-1.7-3.19-1.72-1.36-.14-2.65.8-3.34.8-.69 0-1.75-.78-2.88-.76-1.48.02-2.85.86-3.61 2.19-1.54 2.67-.39 6.62 1.11 8.79.73 1.06 1.6 2.25 2.75 2.21 1.1-.04 1.52-.71 2.85-.71 1.33 0 1.71.71 2.88.69 1.19-.02 1.94-1.08 2.66-2.15.84-1.23 1.19-2.42 1.21-2.48-.03-.01-2.31-.89-2.32-3.55zM14.18 6.13c.61-.74 1.02-1.76.91-2.78-.88.04-1.94.59-2.57 1.32-.56.65-1.06 1.69-.93 2.69.98.08 1.98-.5 2.59-1.23z"/></svg>'
};
/* Les boutons des fournisseurs allumés (`a` : { google: true… }) dans `n`. Créer un
   compte par eux vaut les mêmes conditions que le formulaire. */
export function peindre(n, a) {
  const l = Object.keys(NOMS_FOURNISSEURS).filter(k => a[k]);
  if (!l.length) return;
  n.hidden = false;
  n.innerHTML = `${l.map(k => `<button class="lext-b ${k}" type="button" data-fournisseur="${k}">${MARQUES[k]}
      Continuer avec ${NOMS_FOURNISSEURS[k]}</button>`).join('')}
    <p class="lext-n">En continuant, tu confirmes avoir 15 ans ou plus et accepter les conditions d’utilisation.</p>`;
  n.onclick = e => {
    const b = e.target.closest('[data-fournisseur]'); if (!b) return;
    location.assign(lienFournisseur(b.dataset.fournisseur, location.origin + '/app'));
  };
}
