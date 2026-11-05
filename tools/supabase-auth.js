/* Les réglages d'Authentication du projet Supabase, posés d'un coup
   (2026-11-05) : ce que docs/COURRIELS.md fait faire à la main dans le
   tableau de bord, par l'API de gestion de Supabase
   (`PATCH /v1/projects/<ref>/config/auth`).

     node tools/supabase-auth.js                 # montre ce qui changerait, ne touche à rien
     node tools/supabase-auth.js --appliquer     # le pose
     node tools/supabase-auth.js --appliquer --confirmation
                                                 # … et rallume « Confirm email » (après l'essai
                                                 # d'envoi, étape 6 de docs/COURRIELS.md)

   Lit dans l'environnement, jamais dans le dépôt :
   - SUPABASE_ACCESS_TOKEN : une clé d'accès (supabase.com → Access Tokens) ;
   - BREVO_SMTP_KEY et BREVO_SMTP_LOGIN : la clé SMTP de Brevo et son
     identifiant (`…@smtp-brevo.com`) ; sans eux, le SMTP n'est pas touché.
   N'écrit jamais une valeur secrète à l'écran.

   Rien de ce qui existe ne casse : un compte déjà confirmé le reste (ceux
   qui ont une adresse fictive se connectent comme avant), un mot de passe
   plus court que 10 caractères reste valable (la longueur ne se vérifie
   qu'au changement), la vérification en deux étapes reste au choix. */
import { readFileSync } from 'node:fs';

const REF = 'qqbzefpdeinlynjtarqr';
const API = `https://api.supabase.com/v1/projects/${REF}/config/auth`;
const SITE = 'https://mirandola.fr';
const appliquer = process.argv.includes('--appliquer');
const confirmation = process.argv.includes('--confirmation');

// fichier de supabase/courriels/ → [modèle de l'API, alerte à allumer (true/false) ou rien]
const MODELES = {
  confirmation: ['confirmation'],
  invitation: ['invite'],
  'lien-magique': ['magic_link'],
  'changement-adresse': ['email_change'],
  'mot-de-passe': ['recovery'],
  'code-verification': ['reauthentication'],
  'alerte-mot-de-passe': ['password_changed_notification', 'password_changed', true],
  'alerte-adresse': ['email_changed_notification', 'email_changed', true],
  'alerte-connexion-ajoutee': ['identity_linked_notification', 'identity_linked', true],
  'alerte-verification-ajoutee': ['mfa_factor_enrolled_notification', 'mfa_factor_enrolled', true],
  'alerte-verification-retiree': ['mfa_factor_unenrolled_notification', 'mfa_factor_unenrolled', true],
  // l'app n'a ni téléphone, ni de quoi délier Google : modèles posés, alertes éteintes
  'alerte-telephone': ['phone_changed_notification', 'phone_changed', false],
  'alerte-connexion-retiree': ['identity_unlinked_notification', 'identity_unlinked', false]
};

function modeles() {
  const r = {};
  for (const [fichier, [cle, alerte, allumee]] of Object.entries(MODELES)) {
    const brut = readFileSync(new URL(`../supabase/courriels/${fichier}.html`, import.meta.url), 'utf8');
    const objet = /Objet : (.+?) -->/.exec(brut.split('\n')[0]);
    if (!objet) throw new Error(`${fichier}.html : objet introuvable en première ligne`);
    r[`mailer_subjects_${cle}`] = objet[1].trim();
    r[`mailer_templates_${cle}_content`] = brut.split('\n').slice(1).join('\n').trim();
    if (alerte) r[`mailer_notifications_${alerte}_enabled`] = allumee;
  }
  return r;
}

function voulu(actuel) {
  const v = {
    ...modeles(),
    site_url: SITE,
    mailer_secure_email_change_enabled: true,               // un code à l'ancienne adresse aussi
    security_update_password_require_reauthentication: true, // au-delà de 24 h, le code « Reauthentication »
    password_min_length: 10,                                 // PWMIN de l'app
    mailer_otp_exp: 3600,                                    // « une heure », disent les e-mails
    mailer_otp_length: 8,                                    // CODE_EMAIL de l'app
    mfa_totp_enroll_enabled: true,
    mfa_totp_verify_enabled: true
  };
  // les adresses de retour : celles qui y sont restent, mirandola.fr s'ajoute
  const liste = String(actuel.uri_allow_list || '').split(',').map(s => s.trim()).filter(Boolean);
  for (const u of [`${SITE}/**`]) if (!liste.includes(u)) liste.push(u);
  v.uri_allow_list = liste.join(',');
  const { BREVO_SMTP_KEY: cle, BREVO_SMTP_LOGIN: login } = process.env;
  if (cle && login) {
    Object.assign(v, { smtp_admin_email: 'noreply@mirandola.fr', smtp_sender_name: 'Mirandola',
      smtp_host: 'smtp-relay.brevo.com', smtp_port: '587', smtp_user: login, smtp_pass: cle,
      smtp_max_frequency: 60, rate_limit_email_sent: 100 });
  } else {
    console.log('SMTP : BREVO_SMTP_KEY et BREVO_SMTP_LOGIN manquent, le SMTP n’est pas touché.');
  }
  if (confirmation) v.mailer_autoconfirm = false;            // « Confirm email » allumé
  return v;
}

const SECRETS = new Set(['smtp_pass']);
const montrer = (k, x) => (SECRETS.has(k) ? '••••' : typeof x === 'string' && x.length > 70 ? `(${x.length} caractères)` : JSON.stringify(x));

async function main() {
  const jeton = process.env.SUPABASE_ACCESS_TOKEN;
  if (!jeton) { console.error('SUPABASE_ACCESS_TOKEN manque : rien n’est fait.'); process.exit(1); }
  const h = { Authorization: 'Bearer ' + jeton, 'Content-Type': 'application/json' };
  const r = await fetch(API, { headers: h });
  if (!r.ok) { console.error(`Lecture refusée (${r.status}) : la clé est-elle valable pour ce compte ?`); process.exit(1); }
  const actuel = await r.json();
  const v = voulu(actuel);
  const diff = Object.fromEntries(Object.entries(v).filter(([k, x]) => (SECRETS.has(k) ? true : actuel[k] !== x)));
  if (!Object.keys(diff).length) { console.log('Tout est déjà en place.'); return; }
  for (const [k, x] of Object.entries(diff)) console.log(`${k} : ${montrer(k, actuel[k])} → ${montrer(k, x)}`);
  if (!appliquer) { console.log(`\n${Object.keys(diff).length} réglages à poser. Relancer avec --appliquer.`); return; }
  const p = await fetch(API, { method: 'PATCH', headers: h, body: JSON.stringify(diff) });
  if (!p.ok) { console.error(`Refusé (${p.status}) : ${(await p.text()).slice(0, 400)}`); process.exit(1); }
  console.log(`\n${Object.keys(diff).length} réglages posés.`);
}

main();
