/* ══════════ ce que dit l'écran de connexion quand Supabase Auth refuse (2026-10-29) ══════════
   Sans dépendance, chargé à la demande par ui/connexion.js au premier refus
   (le démarrage n'a pas de marge). Avant, tout refus se lisait « Inscription
   impossible » ou « Connexion impossible » : un élève dont l'adresse
   attendait sa confirmation, ou que la limite d'e-mails du projet bloquait,
   ne savait ni pourquoi ni quoi faire.

   On lit d'abord le code d'erreur de Supabase Auth (`error_code`, posé sur
   l'erreur par core/coeur-sync.js), puis le message, que les versions plus
   anciennes renvoient seul. L'ordre compte : « Invalid » commence aussi bien
   une adresse mal écrite qu'un mauvais mot de passe. */

const REGLES = [
  { codes: ['email_not_confirmed'], motif: /not confirmed/i, renvoyer: true,
    texte: 'Ton adresse n’est pas encore confirmée : ouvre le lien reçu par e-mail (regarde aussi les indésirables).' },
  { codes: ['over_email_send_rate_limit', 'email_address_not_authorized'], motif: /email rate limit|not authorized/i,
    texte: 'L’e-mail de confirmation ne peut pas partir pour l’instant. Réessaie dans un moment.' },
  { codes: ['over_request_rate_limit'], motif: /security purposes|rate limit|too many/i,
    texte: 'Trop d’essais d’affilée : patiente un instant, puis réessaie.' },
  { codes: ['user_already_exists', 'email_exists'], motif: /already|registered/i,
    texte: 'Cette adresse a déjà un compte : connecte-toi.' },
  { codes: ['email_address_invalid', 'validation_failed'], motif: /valid email|invalid format|validate email/i,
    texte: 'Cette adresse e-mail n’est pas valide.' },
  { codes: ['weak_password'], motif: /password should|weak password|at least/i,
    texte: 'Mot de passe trop faible : choisis-en un plus long.' },
  { codes: ['invalid_credentials'], motif: /invalid login|credentials|refus/i,
    texte: 'E-mail ou mot de passe incorrect.' },
  { codes: ['signup_disabled', 'email_provider_disabled'], motif: /signups not allowed|disabled/i,
    texte: 'Les inscriptions par e-mail sont fermées pour l’instant.' },
  { codes: [], motif: /failed to fetch|networkerror|load failed|network/i,
    texte: 'Pas de réseau : vérifie ta connexion.' }
];

/* `{ texte, renvoyer }` : ce qu'on affiche, et s'il faut proposer de renvoyer
   l'e-mail de confirmation. */
export function messageConnexion(erreur, inscription) {
  const code = String((erreur && erreur.code) || ''), m = String((erreur && erreur.message) || '');
  const r = REGLES.find(x => x.codes.includes(code)) || REGLES.find(x => x.motif.test(m));
  if (r) return { texte: r.texte, renvoyer: !!r.renvoyer };
  return { texte: inscription ? 'Inscription impossible pour l’instant.' : 'Connexion impossible pour l’instant.', renvoyer: false };
}

/* Après une inscription quand le projet demande de confirmer l'adresse. */
export const CREE = 'Compte créé : ouvre le lien reçu par e-mail (regarde aussi les indésirables), puis connecte-toi.';

/* Après « Renvoyer l'e-mail ». */
export const RENVOYE = 'E-mail renvoyé : ouvre le lien qu’il contient, puis connecte-toi.';
