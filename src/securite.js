/* ══════════ les règles de la sécurité du compte (2026-11-02) ══════════
   Sans dépendance, pur et testé (test/securite.test.js) ; chargé à la
   demande avec les écrans des codes (ui/verif.js) et de la sécurité
   (ui/securite.js). Ce que dit un refus de Supabase Auth, la forme d'un
   code, une adresse sans doute mal tapée. */

// les codes que l'app attend : celui des e-mails (réglage « Email OTP length »
// du projet, 8 chiffres) et celui d'une application d'authentification (6)
export const CODE_EMAIL = 8;
export const CODE_TOTP = 6;

// ce que le champ garde : des chiffres, pas plus qu'il n'en faut
export const chiffres = (s, n) => String(s || '').replace(/\D/g, '').slice(0, n);

/* La clé secrète d'un facteur TOTP, par groupes de quatre, pour la recopier
   à la main dans une application qui ne lit pas le QR code. */
export const groupes = s => String(s || '').replace(/\s/g, '').replace(/(.{4})(?=.)/g, '$1 ');

/* Les secondes à attendre, quand Supabase les dit (« you can only request
   this after 47 seconds »). */
export function attente(erreur) {
  const m = /after (\d+) second/i.exec(String((erreur && erreur.message) || ''));
  return m ? +m[1] : 0;
}

const MESSAGES = [
  // avant les codes reçus par e-mail : « Invalid TOTP » contient « otp »
  [['mfa_verification_failed'], /invalid totp/i, 'Code faux : regarde ton application, il change toutes les 30 secondes.'],
  [['otp_expired', 'otp_invalid'], /expired|invalid.*(token|otp)|token.*invalid/i, 'Code faux ou expiré : vérifie-le, ou demandes-en un autre.'],
  [['reauthentication_not_valid'], /reauthentication/i, 'Code faux ou expiré : vérifie-le, ou demandes-en un autre.'],
  [['mfa_challenge_expired'], /challenge.*expired/i, 'Code expiré : tape celui qui s’affiche maintenant.'],
  [['insufficient_aal'], /aal2/i, 'Confirme d’abord avec le code de ton application d’authentification.'],
  [['too_many_enrolled_mfa_factors'], /maximum number/i, 'Trop d’applications reliées : retires-en une d’abord.'],
  [['same_password'], /different from the old/i, 'C’est déjà ton mot de passe : choisis-en un autre.'],
  [['weak_password'], /password should|weak/i, 'Mot de passe trop faible : allonge-le.'],
  [['email_exists', 'user_already_exists'], /already (been )?registered|already exists/i, 'Cette adresse a déjà un compte.'],
  [['email_address_invalid', 'validation_failed'], /valid email|invalid format/i, 'Cette adresse e-mail n’est pas valide.'],
  [['over_email_send_rate_limit'], /email rate limit/i, 'Trop d’e-mails d’affilée : réessaie dans un moment.'],
  [['over_request_rate_limit'], /rate limit|too many/i, 'Trop d’essais d’affilée : patiente une minute.'],
  [[], /failed to fetch|networkerror|load failed|network/i, 'Pas de réseau : vérifie ta connexion.']
];

/* Ce qu'on affiche pour un refus. Le code d'erreur d'abord, le message
   ensuite (les versions plus anciennes de Supabase Auth n'ont que lui). */
export function messageSecurite(erreur) {
  const s = attente(erreur);
  if (s) return `Patiente encore ${s} s avant d’en redemander un.`;
  const code = String((erreur && erreur.code) || ''), m = String((erreur && erreur.message) || '');
  const r = MESSAGES.find(x => x[0].includes(code)) || MESSAGES.find(x => x[1].test(m));
  return r ? r[2] : 'Impossible pour l’instant : réessaie dans un moment.';
}

/* ---------- une adresse sans doute mal tapée ----------
   Une faute de frappe dans le domaine fait un compte qui ne recevra jamais
   son code. On propose la bonne orthographe des messageries courantes en
   France quand le domaine tapé en est à une ou deux lettres près ; jamais on
   ne la remplace sans le dire. */
const DOMAINES = ['gmail.com', 'hotmail.com', 'hotmail.fr', 'outlook.com', 'outlook.fr', 'live.fr', 'live.com',
  'yahoo.com', 'yahoo.fr', 'icloud.com', 'me.com', 'orange.fr', 'wanadoo.fr', 'free.fr', 'sfr.fr', 'laposte.net',
  'protonmail.com', 'proton.me', 'gmx.fr', 'neuf.fr', 'bbox.fr', 'aol.com', 'msn.com',
  // de vraies messageries, proches des précédentes : jamais « corrigées »
  'mail.com', 'ymail.com', 'gmx.com', 'gmx.de', 'pm.me', 'hotmail.be', 'hotmail.ch', 'live.be', 'outlook.be',
  'yahoo.be', 'skynet.be', 'bluewin.ch', 'videotron.ca', 'club-internet.fr', 'numericable.fr', 'aliceadsl.fr'];
const CONNUS_FAUX = { 'gmail.fr': 'gmail.com', 'gmail.co': 'gmail.com', 'icloud.fr': 'icloud.com' };

function distance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

export function suggestion(email) {
  const e = String(email || '').trim().toLowerCase(), at = e.lastIndexOf('@');
  if (at < 1) return '';
  const nom = e.slice(0, at), dom = e.slice(at + 1);
  if (!dom || DOMAINES.includes(dom)) return '';
  if (CONNUS_FAUX[dom]) return nom + '@' + CONNUS_FAUX[dom];
  let mieux = '', d = 3;
  for (const x of DOMAINES) {
    const k = distance(dom, x);
    if (k < d) { d = k; mieux = x; }
  }
  // deux lettres d'écart seulement pour un domaine assez long : « free.fr » et « sfr.fr » se ressemblent
  return mieux && (d === 1 || (d === 2 && dom.length >= 8)) ? nom + '@' + mieux : '';
}

/* Ce que doit valoir l'adresse avant qu'on l'envoie. */
export const adresseValide = s => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(s || '').trim());
