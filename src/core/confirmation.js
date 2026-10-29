import { SB } from './coeur-sync.js';

/* « Renvoyer l'e-mail » (2026-10-29) : l'adresse d'un compte créé n'est pas
   encore confirmée, le lien s'est perdu ou a expiré. Supabase Auth renvoie
   l'e-mail de confirmation (`POST /auth/v1/resend`), sous les mêmes limites
   que l'inscription. Chargé à la demande par ui/connexion.js, comme les
   messages d'erreur (src/connexion-erreurs.js). */
export async function renvoyerConfirmation(email) {
  const r = await fetch(SB.url + '/auth/v1/resend', {
    method: 'POST', headers: { apikey: SB.key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'signup', email: String(email || '').trim().toLowerCase() })
  });
  if (r.ok) return;
  const j = await r.json().catch(() => ({}));
  throw Object.assign(new Error(j.msg || j.error_description || j.message || 'Envoi impossible'), { code: j.error_code });
}
