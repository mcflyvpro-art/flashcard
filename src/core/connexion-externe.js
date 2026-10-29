import { SB, keepSession } from './coeur-sync.js';

/* ══════════ se connecter par Google, ou un lien reçu par e-mail (2026-10-29) ══════════
   Supabase Auth en « flux implicite » : la page de Google ou le lien d'un
   e-mail (« mot de passe oublié », confirmation d'adresse) renvoie à l'app
   avec la session dans l'adresse — `#access_token=…&refresh_token=…&type=…`.
   On la reprend au tout début du démarrage (ui/liens-entrants.js), on lit le
   compte qu'elle ouvre (`GET /auth/v1/user`), puis elle passe par
   keepSession comme une connexion ordinaire ; l'adresse est nettoyée aussitôt.

   Le bouton ne se montre que pour un fournisseur ALLUMÉ dans le projet
   (`GET /auth/v1/settings`, `external`) : tant qu'il ne l'est pas, rien ne
   change à l'écran (docs/CONNEXION.md dit comment allumer Google). */

/* Les fournisseurs allumés ({ google: true… }), ou {} si on ne
   sait pas (hors ligne, projet injoignable) : alors on n'en montre aucun. */
export async function fournisseurs() {
  try {
    const r = await fetch(SB.url + '/auth/v1/settings', { headers: { apikey: SB.key } });
    if (!r.ok) return {};
    const j = await r.json();
    return (j && j.external) || {};
  } catch (e) { return {}; }       // hors ligne : la connexion par e-mail reste là
}

/* L'adresse de retour : celle de cette app (son origine), jamais SITE — une
   app installée sur une autre adresse n'y retrouverait pas sa session. */
export const lienFournisseur = (p, retour) =>
  `${SB.url}/auth/v1/authorize?provider=${encodeURIComponent(p)}&redirect_to=${encodeURIComponent(retour)}`;

/* Ce que porte l'adresse : une session, une erreur, ou rien. */
export function lireRetour(hash) {
  const p = new URLSearchParams(String(hash || '').replace(/^#/, ''));
  if (p.get('access_token')) {
    return { access_token: p.get('access_token'), refresh_token: p.get('refresh_token') || '',
      expires_in: +p.get('expires_in') || 3600, type: p.get('type') || '' };
  }
  if (p.get('error') || p.get('error_code')) return { erreur: p.get('error_description') || p.get('error_code') || p.get('error') };
  return null;
}

/* Ouvre la session portée par l'adresse. Rend son `type` (« recovery » pour
   un lien « mot de passe oublié », « signup », « magiclink »…, vide pour un
   fournisseur), ou lève si le jeton ne vaut rien. */
export async function sessionDepuisRetour(r) {
  const u = await fetch(SB.url + '/auth/v1/user', { headers: { apikey: SB.key, Authorization: 'Bearer ' + r.access_token } });
  const j = await u.json().catch(() => ({}));
  if (!u.ok || !j.id) throw new Error(j.msg || j.error_description || 'Lien expiré');
  keepSession({ access_token: r.access_token, refresh_token: r.refresh_token, expires_in: r.expires_in,
    user: { id: j.id, email: j.email } });
  return r.type;
}
