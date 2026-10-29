// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { CREE, messageConnexion, RENVOYE } from '../connexion-erreurs.js';
import { renvoyerConfirmation } from '../core/confirmation.js';

/* ══════════ un refus de l'écran de connexion (2026-10-29) ══════════
   Chargé par ui/connexion.js au premier refus de Supabase Auth (le démarrage
   n'a pas de marge) : le vrai motif (src/connexion-erreurs.js), et, pour une
   adresse pas encore confirmée, « Renvoyer l'e-mail » (core/confirmation.js).
   `err` : la ligne d'erreur du formulaire ; `.lok` la passe au vert. */

// un compte créé qui attend la confirmation de son adresse
export function direCree(err) {
  if (!err) return;
  err.textContent = CREE;
  err.classList.add('lok');
}

export function direRefus(x, inscription, err, email) {
  const r = messageConnexion(x, inscription);
  err.textContent = r.texte;
  err.classList.remove('lok');
  if (!r.renvoyer) return;
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'lnk lrenv'; b.textContent = 'Renvoyer l’e-mail';
  b.onclick = async () => {
    b.disabled = true;
    try {
      await renvoyerConfirmation(email);
      err.textContent = RENVOYE;
      err.classList.add('lok');
    } catch (y) { direRefus(y, true, err, email); }
  };
  err.append(' ', b);
}
