// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { messageConnexion } from '../connexion-erreurs.js';
import { suggestion } from '../securite.js';
import { ouvrirVerif } from './mdp-porte.js';

/* ══════════ un refus de l'écran de connexion (2026-10-29) ══════════
   Chargé par ui/connexion.js au premier refus de Supabase Auth (le démarrage
   n'a pas de marge) : le vrai motif (src/connexion-erreurs.js), et, pour une
   adresse pas encore confirmée, « Saisir mon code » — l'écran des codes
   (ui/verif.js, 2026-11-02), qui renvoie aussi l'e-mail.
   `err` : la ligne d'erreur du formulaire. */

export function direRefus(x, inscription, err, email) {
  const r = messageConnexion(x, inscription);
  err.textContent = r.texte;
  err.classList.remove('lok');
  if (!r.renvoyer) return;
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'lnk lrenv'; b.textContent = 'Saisir mon code';
  b.onclick = () => ouvrirVerif('inscription', email);
  err.append(' ', b);
}

/* Avant de créer un compte (2026-11-02) : une adresse sans doute mal tapée
   (« gmial.com ») ne recevrait jamais son code. On propose la bonne
   orthographe, une fois ; rien n'est remplacé sans qu'on le choisisse, et
   « Créer le compte » une seconde fois passe outre. Rend true quand
   l'inscription doit attendre. */
export function adresseDouteuse(em, err) {
  const v = em.value.trim(), s = suggestion(v);
  if (!s || em.dataset.vu === v) return false;
  em.dataset.vu = v;
  err.classList.remove('lok');
  err.textContent = 'Tu voulais dire ';
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'lnk lrenv'; b.textContent = s + ' ?';
  b.onclick = () => { em.value = s; em.dataset.vu = s; err.textContent = ''; em.focus(); };
  err.append(b);
  return true;
}
