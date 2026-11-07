/* Les e-mails de Supabase Auth, en français et aux couleurs de Mirandola
   (2026-11-02, les treize : six d'authentification, sept alertes de
   sécurité). `node tools/courriels-auth.js` écrit un fichier par modèle
   dans supabase/courriels/, la même mise en page que les e-mails de la
   fonction `prevenir` (supabase/functions/_shared/courriels.js). Chaque
   fichier se colle dans Supabase → Authentication → Emails (onglets
   « Templates » et « Security notifications »), son modèle et son objet
   écrits en tête, en commentaire (docs/COURRIELS.md). Les {{ … }} sont ceux
   de Supabase. Depuis le 2026-11-04, les e-mails qui ouvrent quelque chose
   (confirmation, connexion, changement d'adresse, mot de passe oublié)
   portent aussi le code à 8 chiffres que l'app attend (ui/verif.js,
   ui/securite.js). On tutoie, comme dans l'app ; aucun prénom (le profil n'en a
   pas toujours) : « Bonjour » seul vaut mieux que « Bonjour , ». */
import { writeFileSync } from 'node:fs';
import { bouton, code, encadre, gabarit, liste, para, secours } from '../supabase/functions/_shared/courriels.js';

const L = '{{ .ConfirmationURL }}';
const CONNEXION = 'https://mirandola.fr/connexion';
const PIED_DEMANDE = 'E-mail automatique, envoyé une seule fois à la suite d’une demande faite sur Mirandola.';
const PIED_ALERTE = 'Alerte de sécurité automatique : elle part à chaque changement important sur ton compte.';
const rien = 'Tu n’es pas à l’origine de cette demande&#8239;? Ignore simplement cet e-mail&#8239;: rien ne change sur ton compte.';
const pasToi = suite => encadre(`<b style="color:#1D1C19">C’était toi&#8239;?</b> Rien à faire.<br><b style="color:#1D1C19">Ce n’était pas toi&#8239;?</b> ${suite}`);
// le code de 8 chiffres (réglage « Email OTP length ») : sur iPhone, l'app posée sur l'écran
// d'accueil n'intercepte pas le lien d'un e-mail — le code se tape là où l'on est (ui/verif.js)
const DUREE = para('Le code et le bouton valent une heure, et ne servent qu’une fois.', 14).replace('<p style="', '<p style="font-size:13.5px;color:#6B675F;');
const avecCode = phrase => para(phrase) + code('{{ .Token }}');
const secu = 'Change ton mot de passe tout de suite (« Mot de passe oublié » sur l’écran de connexion) et écris-nous à <a href="mailto:contact@mirandola.fr" style="color:#3E4FA0">contact@mirandola.fr</a>.';

// [fichier, modèle de Supabase, objet, titre, aperçu, corps, pied]
const MODELES = [
  ['confirmation', 'Confirm sign up', 'Confirme ton adresse e-mail pour Mirandola', 'Bienvenue sur Mirandola',
    'Ton code pour confirmer ton adresse et ouvrir ton compte.',
    para('Bonjour,', 0) + para('Il ne reste qu’une étape&#8239;: confirmer que cette adresse est bien la tienne.')
      + avecCode('Tape ce code dans Mirandola, ton compte s’ouvre aussitôt&#8239;:')
      + para('Ou touche le bouton&#8239;:', 18) + bouton(L, 'Confirmer mon adresse') + DUREE
      + liste(['Tes cours deviennent des paquets de flashcards, écrits par toi ou par l’IA.',
        'Le Memory Engine te repose chaque page juste avant que tu l’oublies.',
        'Hors ligne, sur ton téléphone comme sur ton ordinateur.'])
      + secours(L) + encadre(rien), PIED_DEMANDE],
  ['invitation', 'Invite user', 'Ton compte Mirandola t’attend', 'On t’a ouvert un compte',
    'Accepte l’invitation et choisis ton mot de passe.',
    para('Bonjour,', 0) + para('Un compte Mirandola a été créé pour <b style="color:#1D1C19">{{ .Email }}</b>. Accepte l’invitation pour choisir ton mot de passe et retrouver tes paquets.')
      + bouton(L, 'Accepter l’invitation') + secours(L)
      + encadre('Tu ne t’attendais pas à cette invitation&#8239;? Ignore cet e-mail, ou écris-nous à <a href="mailto:contact@mirandola.fr" style="color:#3E4FA0">contact@mirandola.fr</a>.'), PIED_DEMANDE],
  ['lien-magique', 'Magic link', 'Ton code de connexion à Mirandola', 'Te connecter en un clic',
    'Ton code pour ouvrir Mirandola, sans mot de passe.',
    para('Bonjour,', 0) + avecCode('Tape ce code dans Mirandola pour te connecter, sans mot de passe&#8239;:')
      + para('Ou touche le bouton&#8239;:', 18) + bouton(L, 'Ouvrir Mirandola') + DUREE + secours(L) + encadre(rien), PIED_DEMANDE],
  ['changement-adresse', 'Change email address', 'Confirme ta nouvelle adresse e-mail', 'Confirme ta nouvelle adresse',
    'Ton code pour confirmer le changement d’adresse.',
    para('Bonjour,', 0) + para('Tu as demandé à remplacer <b style="color:#1D1C19">{{ .Email }}</b> par <b style="color:#1D1C19">{{ .NewEmail }}</b> pour te connecter à Mirandola. Un code part à chacune des deux adresses&#8239;: rien ne change avant le second.')
      + avecCode('Tape celui-ci dans Mirandola (Réglages, Sécurité du compte)&#8239;:')
      + para('Ou touche le bouton&#8239;:', 18) + bouton(L, 'Confirmer le changement') + DUREE + secours(L)
      + encadre('Tu n’as pas demandé ce changement&#8239;? Ignore cet e-mail et, par prudence, change ton mot de passe.'), PIED_DEMANDE],
  ['mot-de-passe', 'Reset password', 'Réinitialise ton mot de passe Mirandola', 'Choisis un nouveau mot de passe',
    'Ton code pour choisir un nouveau mot de passe.',
    para('Bonjour,', 0) + para('Une demande de réinitialisation a été faite pour le compte <b style="color:#1D1C19">{{ .Email }}</b>.')
      + avecCode('Tape ce code dans Mirandola pour choisir un nouveau mot de passe&#8239;:')
      + para('Ou touche le bouton&#8239;:', 18) + bouton(L, 'Choisir mon mot de passe') + DUREE + secours(L)
      + encadre('Tu n’es pas à l’origine de cette demande&#8239;? Ignore cet e-mail&#8239;: ton mot de passe actuel reste valable.'), PIED_DEMANDE],
  ['code-verification', 'Reauthentication', 'Ton code de vérification Mirandola', 'Ton code de vérification',
    'Ton code pour confirmer que c’est bien toi.',
    para('Bonjour,', 0) + para('Pour confirmer qu’il s’agit bien de toi, saisis ce code dans Mirandola&#8239;:')
      + code('{{ .Token }}') + para('Il vaut une heure et ne sert qu’une fois.', 10)
      + encadre('<b style="color:#1D1C19">Ne le communique à personne.</b> L’équipe Mirandola ne te le demandera jamais. Tu n’as rien demandé&#8239;? Change ton mot de passe par prudence.'), PIED_DEMANDE],

  ['alerte-mot-de-passe', 'Password changed (Security notifications)', 'Ton mot de passe Mirandola a été modifié', 'Mot de passe modifié',
    'Le mot de passe de ton compte vient de changer.',
    para('Bonjour,', 0) + para('Le mot de passe du compte <b style="color:#1D1C19">{{ .Email }}</b> vient d’être modifié.')
      + pasToi(secu) + bouton(CONNEXION, 'Sécuriser mon compte'), PIED_ALERTE],
  ['alerte-adresse', 'Email address changed (Security notifications)', 'L’adresse e-mail de ton compte Mirandola a changé', 'Adresse e-mail modifiée',
    'Ton compte se connecte désormais avec une autre adresse.',
    para('Bonjour,', 0) + para('L’adresse de connexion de ton compte Mirandola est passée de <b style="color:#1D1C19">{{ .OldEmail }}</b> à <b style="color:#1D1C19">{{ .Email }}</b>.')
      + pasToi('Écris-nous tout de suite à <a href="mailto:contact@mirandola.fr" style="color:#3E4FA0">contact@mirandola.fr</a> depuis cette adresse&#8239;: nous t’aiderons à récupérer ton compte.'), PIED_ALERTE],
  ['alerte-telephone', 'Phone number changed (Security notifications)', 'Le numéro de ton compte Mirandola a changé', 'Numéro modifié',
    'Le numéro de téléphone de ton compte vient de changer.',
    para('Bonjour,', 0) + para('Le numéro de téléphone de ton compte <b style="color:#1D1C19">{{ .Email }}</b> est passé de <b style="color:#1D1C19">{{ .OldPhone }}</b> à <b style="color:#1D1C19">{{ .Phone }}</b>.')
      + pasToi(secu) + bouton(CONNEXION, 'Sécuriser mon compte'), PIED_ALERTE],
  ['alerte-connexion-ajoutee', 'Sign-in method linked (Security notifications)', 'Nouvelle méthode de connexion sur ton compte Mirandola', 'Nouvelle méthode de connexion',
    'Une nouvelle façon de te connecter vient d’être ajoutée.',
    para('Bonjour,', 0) + para('La connexion avec <b style="color:#1D1C19">{{ .Provider }}</b> vient d’être ajoutée à ton compte <b style="color:#1D1C19">{{ .Email }}</b>. Tu peux désormais t’en servir pour ouvrir Mirandola.')
      + pasToi(secu) + bouton(CONNEXION, 'Sécuriser mon compte'), PIED_ALERTE],
  ['alerte-connexion-retiree', 'Sign-in method removed (Security notifications)', 'Une méthode de connexion a été retirée de ton compte Mirandola', 'Méthode de connexion retirée',
    'Une façon de te connecter vient d’être retirée.',
    para('Bonjour,', 0) + para('La connexion avec <b style="color:#1D1C19">{{ .Provider }}</b> a été retirée de ton compte <b style="color:#1D1C19">{{ .Email }}</b>. Tes autres moyens de connexion restent valables.')
      + pasToi(secu) + bouton(CONNEXION, 'Sécuriser mon compte'), PIED_ALERTE],
  ['alerte-verification-ajoutee', 'Verification method added (Security notifications)', 'Vérification en deux étapes ajoutée à ton compte Mirandola', 'Vérification en deux étapes ajoutée',
    'Ton compte est mieux protégé.',
    para('Bonjour,', 0) + para('Une méthode de vérification en deux étapes (<b style="color:#1D1C19">{{ .FactorType }}</b>) a été ajoutée à ton compte <b style="color:#1D1C19">{{ .Email }}</b>. Elle te sera demandée à la connexion.')
      + pasToi(secu) + bouton(CONNEXION, 'Sécuriser mon compte'), PIED_ALERTE],
  ['alerte-verification-retiree', 'Verification method removed (Security notifications)', 'Vérification en deux étapes retirée de ton compte Mirandola', 'Vérification en deux étapes retirée',
    'Une protection de ton compte vient d’être retirée.',
    para('Bonjour,', 0) + para('La méthode de vérification en deux étapes (<b style="color:#1D1C19">{{ .FactorType }}</b>) a été retirée de ton compte <b style="color:#1D1C19">{{ .Email }}</b>.')
      + pasToi(secu) + bouton(CONNEXION, 'Sécuriser mon compte'), PIED_ALERTE]
];

for (const [nom, modele, objet, titre, apercu, corps, pied] of MODELES) {
  writeFileSync(new URL(`../supabase/courriels/${nom}.html`, import.meta.url),
    `<!-- Supabase : ${modele} · Objet : ${objet} -->\n` + gabarit(titre, corps, { pied, apercu }) + '\n');
}
console.log(MODELES.length + ' modèles écrits dans supabase/courriels/');
