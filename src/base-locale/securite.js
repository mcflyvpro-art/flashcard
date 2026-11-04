// La sécurité du compte dans la base locale (2026-11-02), pour les parcours
// seulement : e2e/faux-supabase.js passe ici avant serveur.js. La démo sans
// compte ne s'en sert jamais (ni code, ni mot de passe, ni facteur) : elle
// n'en charge pas le poids.
import { uuid as randomUUID } from './uuid.js';
import { courriel, jeton, limite, userOf } from './serveur.js';
import { mdpChoisi } from './licences.js';
/* ══════════ la sécurité du compte (2026-11-02) ══════════
   Ce que l'écran des codes (ui/verif.js) et « Sécurité du compte »
   (ui/securite.js) demandent à Supabase Auth : vérifier un code reçu par
   e-mail, en envoyer un (connexion, oubli, réauthentification), la
   vérification en deux étapes (facteurs TOTP : le code valable est
   `store.totp`, « 123456 » d'office). Rend null pour un autre chemin. */
const faux = (statut, code, msg) => [statut, { error_code: code, msg }];

function verifier(store, body) {
  const user = store.users.find(u => u.email === body.email || (u.changement && u.changement.email === body.email));
  const codes = (user && user.codes) || {};
  if (!user) return faux(403, 'otp_expired', 'Token has expired or is invalid');
  if (body.type === 'email_change' && user.changement) {
    const cle = body.email === user.changement.email ? 'nouvelle' : 'ancienne';
    if (body.token !== codes[cle]) return faux(403, 'otp_expired', 'Token has expired or is invalid');
    user.changement.faits[cle] = true;
    if (!user.changement.faits.nouvelle || !user.changement.faits.ancienne) {
      return [200, { msg: 'Confirmation link accepted. Please proceed to confirm link sent to the other email', code: 200 }];
    }
    user.email = user.changement.email; delete user.changement;
    return [200, jeton(user)];
  }
  const attendu = body.type === 'signup' ? codes.signup : codes.connexion;
  if (!attendu || body.token !== attendu) return faux(403, 'otp_expired', 'Token has expired or is invalid');
  if (body.type === 'signup') user.confirme = true;
  user.codes = { ...codes, signup: null, connexion: null };
  return [200, jeton(user)];
}

// un code de connexion (« magic link », oubli) pour un compte qui existe
function codeConnexion(store, type, email) {
  const user = store.users.find(u => u.email === email);
  if (!user) return type === 'recovery' ? [200, {}] : faux(422, 'otp_disabled', 'Signups not allowed for otp');
  const code = courriel(store, type, email);
  if (!code) return limite();
  user.codes = { ...user.codes, connexion: code };
  return [200, {}];
}

function facteurs(store, path, body, req) {
  const user = userOf(store, req);
  if (!user) return [401, { msg: 'Invalid token' }];
  user.facteurs = user.facteurs || [];
  const m = /\/factors\/([0-9a-f-]{36})(\/challenge|\/verify)?$/.exec(path);
  if (!m && req.method === 'POST') {
    if (user.facteurs.some(f => f.friendly_name === body.friendly_name)) return faux(422, 'mfa_factor_name_conflict', 'A factor with the friendly name already exists');
    const f = { id: randomUUID(), status: 'unverified', friendly_name: body.friendly_name };
    user.facteurs.push(f);
    const secret = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
    return [200, { id: f.id, type: 'totp', friendly_name: f.friendly_name,
      totp: { secret, qr_code: '', uri: `otpauth://totp/Mirandola:${encodeURIComponent(user.email)}?secret=${secret}&issuer=Mirandola` } }];
  }
  const f = m && user.facteurs.find(x => x.id === m[1]);
  if (!f) return faux(404, 'mfa_factor_not_found', 'Factor not found');
  if (m[2] === '/challenge') return [200, { id: randomUUID(), type: 'totp', expires_at: 0 }];
  if (m[2] === '/verify') {
    if (body.code !== (store.totp || '123456')) return faux(422, 'mfa_verification_failed', 'Invalid TOTP code entered');
    f.status = 'verified';
    return [200, jeton(user, 'aal2')];
  }
  if (req.method === 'DELETE') {
    if (f.status === 'verified' && aalOf(req) !== 'aal2') return faux(422, 'insufficient_aal', 'AAL2 required to unenroll verified factor');
    user.facteurs = user.facteurs.filter(x => x !== f);
    return [200, { id: f.id }];
  }
  return [404, {}];
}

const aalOf = req => {
  try { return JSON.parse(atob((req.headers.authorization || '').split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).aal; }
  catch (e) { return 'aal1'; }
};

/* PUT /user : le mot de passe (« Secure password change » : `store.reauth`
   joue une session de plus de 24 h, qui demande le code envoyé par e-mail),
   l'adresse (« Secure email change » : un code à chacune des deux). */
function majCompte(store, body, req) {
  const user = userOf(store, req);
  if (!user) return [401, { msg: 'JWT expired' }];
  if (body.password) {
    if (String(body.password).length < 6) return faux(422, 'weak_password', 'Password should be at least 6 characters.');
    if (body.password === user.password) return faux(422, 'same_password', 'New password should be different from the old password.');
    if (store.reauth && !body.nonce) return faux(400, 'reauthentication_needed', 'Password update requires reauthentication');
    if (store.reauth && body.nonce !== (user.codes || {}).reauth) return faux(400, 'reauthentication_not_valid', 'Requires reauthentication');
    user.password = body.password;
    mdpChoisi(store, user.id);
  }
  if (body.email) {
    if (store.users.some(u => u.email === body.email && u !== user)) return faux(422, 'email_exists', 'A user with this email address has already been registered');
    user.changement = { email: body.email, faits: {} };
    user.codes = { ...user.codes, nouvelle: courriel(store, 'email_change', body.email), ancienne: courriel(store, 'email_change', user.email) };
  }
  return [200, { id: user.id, email: user.email }];
}

function authSecurite(store, path, url, body, req) {
  if (path.endsWith('/user') && req.method === 'PUT') return majCompte(store, body, req);
  if (/\/factors(\/|$)/.test(path)) return facteurs(store, path, body, req);    // avant /verify : /factors/<id>/verify
  if (path.endsWith('/verify')) return verifier(store, body);
  if (path.endsWith('/otp')) return codeConnexion(store, 'magiclink', body.email);
  if (path.endsWith('/recover')) return codeConnexion(store, 'recovery', body.email);
  if (path.endsWith('/reauthenticate')) {
    const user = userOf(store, req);
    if (!user) return [401, { msg: 'Invalid token' }];
    user.codes = { ...user.codes, reauth: courriel(store, 'reauthentication', user.email) };
    return [200, {}];
  }
  return null;
}

export function repondreSecurite(store, { method, url, headers, body }) {
  const path = url.pathname;
  if (!path.startsWith('/auth/v1/')) return null;
  return authSecurite(store, path, url, body || {}, { method, headers });
}
