/* Les e-mails de Supabase Auth, en français et aux couleurs de Mirandola
   (2026-11-02) : `node tools/courriels-auth.js` écrit un fichier par
   modèle dans supabase/courriels/, la même mise en page que les e-mails de
   la fonction `prevenir` (supabase/functions/_shared/courriels.js). Chaque
   fichier se colle dans Supabase → Authentication → Emails → Templates, son
   objet en tête (docs/COURRIELS.md). Les {{ … }} sont ceux de Supabase. */
import { writeFileSync } from 'node:fs';
import { gabarit } from '../supabase/functions/_shared/courriels.js';

const bouton = (lien, texte) => `<p style="margin:22px 0 0"><a href="${lien}" style="display:inline-block;padding:13px 22px;border-radius:99px;background:#1D1C19;color:#FFFFFF;text-decoration:none;font-weight:700">${texte}</a></p>`;
const secours = lien => `<p style="margin:18px 0 0;font-size:12.5px;color:#6B675F">Le bouton ne marche pas&#8239;? Copie ce lien dans ton navigateur&#8239;:<br><a href="${lien}" style="color:#3E4FA0;word-break:break-all">${lien}</a></p>`;
const rien = '<p style="margin:18px 0 0;font-size:13px;color:#6B675F">Tu n’as rien demandé&#8239;? Ignore cet e-mail, rien ne changera.</p>';
const L = '{{ .ConfirmationURL }}';

const MODELES = {
  confirmation: ['Confirme ton adresse pour Mirandola', 'Bienvenue sur Mirandola',
    `<p style="margin:0">Il ne reste qu’à confirmer ton adresse pour ouvrir ton compte.</p>${bouton(L, 'Confirmer mon adresse')}${secours(L)}${rien}`],
  'mot-de-passe': ['Ton nouveau mot de passe Mirandola', 'Choisis un nouveau mot de passe',
    `<p style="margin:0">Quelqu’un (toi, sans doute) a demandé à changer le mot de passe du compte {{ .Email }}. Le lien vaut une heure.</p>${bouton(L, 'Choisir mon mot de passe')}${secours(L)}${rien}`],
  'changement-adresse': ['Confirme ta nouvelle adresse Mirandola', 'Ta nouvelle adresse',
    `<p style="margin:0">Ton compte Mirandola passe de {{ .Email }} à <b>{{ .NewEmail }}</b>. Confirme pour que le changement se fasse.</p>${bouton(L, 'Confirmer le changement')}${secours(L)}${rien}`],
  'lien-magique': ['Ton lien de connexion à Mirandola', 'Te connecter',
    `<p style="margin:0">Touche le bouton pour ouvrir Mirandola, sans mot de passe. Le lien ne sert qu’une fois.</p>${bouton(L, 'Ouvrir Mirandola')}${secours(L)}${rien}`],
  invitation: ['Ton compte Mirandola t’attend', 'On t’a ouvert un compte',
    `<p style="margin:0">Un compte Mirandola a été ouvert pour {{ .Email }}. Touche le bouton pour choisir ton mot de passe.</p>${bouton(L, 'Ouvrir mon compte')}${secours(L)}`],
  'code-verification': ['Ton code Mirandola', 'Ton code',
    `<p style="margin:0">Voici ton code&#8239;:</p><p style="margin:14px 0 0;font-size:30px;font-weight:800;letter-spacing:6px">{{ .Token }}</p>${rien}`]
};

for (const [nom, [objet, titre, corps]] of Object.entries(MODELES)) {
  writeFileSync(new URL(`../supabase/courriels/${nom}.html`, import.meta.url),
    `<!-- Objet : ${objet} -->\n` + gabarit(titre, corps, 'Mirandola · mirandola.fr · Cet e-mail est envoyé une fois, à ta demande.') + '\n');
}
console.log(Object.keys(MODELES).length + ' modèles écrits dans supabase/courriels/');
