import { api, keepSession, refreshToken, SB } from './coeur-sync.js';

/* ══════════ la sécurité du compte, côté réseau (2026-11-02) ══════════
   Tout ce que Supabase Auth sait faire par code, et que l'app emploie
   désormais : confirmer son adresse à l'inscription, retrouver l'accès par
   « mot de passe oublié », se connecter par un code reçu par e-mail, changer
   de mot de passe (avec le code de réauthentification quand la session date
   de plus de 24 h) et d'adresse (un code à chacune des deux adresses), la
   vérification en deux étapes (une application d'authentification, TOTP).

   Pourquoi des codes, et pas seulement les liens des e-mails : sur iPhone,
   l'app posée sur l'écran d'accueil n'intercepte jamais un lien — celui de
   l'e-mail s'ouvre dans Safari, qui ne partage pas son stockage avec elle, et
   la session s'ouvrait du mauvais côté. Un code se tape là où l'on est. Les
   liens restent valables (ui/liens-entrants.js les reçoit).

   Chargé à la demande, avec les écrans qui s'en servent (ui/verif.js,
   ui/securite.js) : le démarrage n'a pas de marge. Aucune règle ici, que du
   transport ; les messages en clair sont dans src/securite.js. */

const net = s => String(s || '').trim().toLowerCase();

// une erreur de Supabase Auth, avec son code (`error_code`) : l'écran en tire le motif
const refus = (j, statut) => Object.assign(new Error(j.msg || j.error_description || j.message || 'Refus'),
  { code: j.error_code || '', status: statut });

/* Sans session : inscription, oubli, connexion par code. */
async function publique(chemin, body) {
  const r = await fetch(SB.url + '/auth/v1' + chemin, {
    method: 'POST', headers: { apikey: SB.key, 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw refus(j, r.status);
  return j;
}

/* Avec la session : api() renouvelle le jeton au besoin ; son erreur porte
   le corps de la réponse en texte, qu'on relit pour retrouver le code. */
async function privee(chemin, method = 'GET', body) {
  try { return await api('/auth/v1' + chemin, method, body); }
  catch (e) {
    let j;
    try { j = JSON.parse(e.message) || {}; } catch (x) { j = { msg: e.message }; }   // pas du JSON : une panne réseau
    throw refus(j, e.status);
  }
}

/* Un code reçu par e-mail. `type` : « signup » (confirmer son adresse),
   « recovery » (mot de passe oublié), « email » (se connecter par code),
   « email_change » (une des deux adresses d'un changement). Rend « session »
   quand une session s'ouvre, « moitie » quand un changement d'adresse attend
   encore le code de l'autre adresse. */
export async function verifierCode(type, email, code) {
  const j = await publique('/verify', { type, email: net(email), token: String(code || '').replace(/\D/g, '') });
  if (j.access_token) { keepSession(j); return 'session'; }
  return 'moitie';
}

/* Un code de connexion, pour un compte qui existe déjà (jamais une
   inscription par ce chemin : elle passe par les conditions d'utilisation).
   Une adresse inconnue répond comme les autres, pour ne pas dire qui a un
   compte ; seules les limites d'envoi remontent. */
export async function codeConnexion(email) {
  try { await publique('/otp', { email: net(email), create_user: false }); }
  catch (e) { if (e.status === 429 || /rate|security purposes/i.test(e.message)) throw e; }
}

export const renvoyerCode = (type, email) => publique('/resend', { type, email: net(email) });
export const codeOubli = email => publique('/recover', { email: net(email) });

/* ---------- avec la session ---------- */
export const moi = () => privee('/user');

/* Changer de mot de passe. Sans `nonce`, Supabase peut répondre
   `reauthentication_needed` (réglage « Secure password change », session de
   plus de 24 h) : codeReauth() envoie alors le code, et l'on recommence avec. */
export const changerMdp = (password, nonce) => privee('/user', 'PUT', nonce ? { password, nonce } : { password });
export const codeReauth = () => privee('/reauthenticate');

/* Changer d'adresse : Supabase envoie un code à la nouvelle, et à l'ancienne
   quand « Secure email change » est allumé ; rien ne change avant. */
export const changerAdresse = email => privee('/user', 'PUT', { email: net(email) });

/* ---------- la vérification en deux étapes (TOTP) ---------- */
export async function facteurs() {
  const u = await moi();
  return (u && u.factors || []).filter(f => f.factor_type === 'totp');
}

/* Un nouveau facteur, en attente de son premier code. Ceux qu'on avait
   commencés sans les finir partent d'abord : Supabase refuse deux facteurs
   du même nom, et un facteur jamais validé ne protège rien. */
export async function commencerTotp() {
  for (const f of await facteurs()) if (f.status !== 'verified') await privee('/factors/' + f.id, 'DELETE');
  return privee('/factors', 'POST', { factor_type: 'totp', friendly_name: 'Mirandola', issuer: 'Mirandola' });
}

/* Un code de l'application d'authentification : la session passe au
   deuxième niveau (aal2), à l'activation comme à la connexion. */
export async function validerTotp(id, code) {
  const c = await privee(`/factors/${id}/challenge`, 'POST', {});
  const s = await privee(`/factors/${id}/verify`, 'POST', { challenge_id: c.id, code: String(code || '').replace(/\D/g, '') });
  keepSession(s);
}

/* Retirer un facteur (il faut une session aal2 : Supabase le vérifie), puis
   renouveler la session tout de suite, qui redescend d'elle-même. */
export async function retirerTotp(id) {
  await privee('/factors/' + id, 'DELETE');
  await refreshToken();
}
