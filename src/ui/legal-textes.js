// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { esc } from '../core/coeur-sync.js';
import { CONTACT, EDITEUR } from '../editeur.js';
// Lu au niveau module, mais sans risque : ce fichier n'est importé que par
// import(), depuis legalView(), donc bien après l'évaluation de connexion.js.
import { PWMIN } from './connexion.js';

/* ══════════ les trois textes du cadre, chargés à la demande ══════════
   Sortis du démarrage le 2026-10-25 (tools/budget.js n'y laissait plus de
   marge) : on les ouvre rarement, et le service worker les met en cache
   avec le reste, donc ils se lisent toujours hors ligne et avant d'avoir un
   compte. Seuls leurs titres restent dans ui/connexion.js (LEGAL_TITRES),
   pour les liens de l'écran de connexion. Rien d'autre que legalView() ne
   doit importer ce fichier. */
const LEGALV = '12 septembre 2026';

export const LEGAL = {
  cgu: ['Conditions d’utilisation', `
**Ce que Folio est.** Une application de révision : tu écris des fiches,
l’app décide quand te les représenter, et tu peux en prêter à des lecteurs
que tu as toi-même ajoutés. Le service est fourni tel quel, sans garantie
de résultat scolaire.

**Âge minimum : 15 ans.** En France, c’est l’âge à partir duquel on peut
consentir seul au traitement de ses données par un service en ligne.
En dessous, il faut l’accord d’un parent ou du responsable légal : écris à
${CONTACT} avant de créer un compte.

**Ton compte est à toi.** Une adresse e-mail, un mot de passe d’au moins
${PWMIN} caractères, et tu en es responsable. Ne le prête pas : ce qui est
fait depuis ton compte est réputé fait par toi.

**Ce que tu écris t’appartient.** Tes fiches restent tienne. En publiant un
livre sur une étagère ou en le prêtant à un lecteur, tu autorises
seulement les personnes concernées à le lire et à le copier chez elles —
rien de plus, et tu peux le retirer quand tu veux.

**Ce qui n’a pas sa place ici.** Contenu illégal, haineux, sexuel,
harcelant ou qui expose la vie privée d’autrui ; contenu protégé par un
droit d’auteur que tu n’as pas ; usurpation d’identité. Un compte qui s’en
sert ainsi peut être suspendu sans préavis.

**Ce que nous ne faisons pas.** Aucune publicité, aucun traceur, aucune
revente de données, aucun profilage publicitaire. Ce n’est pas une
promesse commerciale : c’est la description du code.

**Interruptions.** Le service peut s’arrêter pour maintenance, ou changer.
Tes données restent exportables. Si Folio devait fermer, tu serais prévenu
avec un délai raisonnable pour les récupérer.

**Droit applicable.** Droit français. En cas de différend, on cherche
d’abord une solution à l’amiable en écrivant à ${CONTACT}.

*Version du ${LEGALV}.*`],

  vie: ['Confidentialité', `
**Qui traite tes données.** ${EDITEUR}, éditeur de Folio, joignable à
${CONTACT}. Lorsque Folio est déployé par un établissement scolaire, c’est
l’établissement qui décide du traitement et nous n’agissons que sur ses
instructions.

**Ce qui est collecté, et pourquoi.**

- *Ton adresse e-mail et ton mot de passe* — pour ouvrir la session et te
  permettre de la récupérer. Le mot de passe n’est jamais lisible, même
  par nous.
- *Ton pseudo et ton nom affiché*, si tu en mets — pour que les lecteurs
  que tu ajoutes sachent qui tu es. Le pseudo sert à t’ajouter sans faire
  circuler d’adresse e-mail.
- *Tes livres et tes fiches*, y compris les images et les sons que tu y
  attaches — c’est le contenu du service.
- *Ton historique de révision* : ce que tu as répondu, quand, juste ou
  faux, en combien de temps — c’est ce qui permet au moteur de choisir
  quand une fiche revient, et de tracer tes courbes.
- *Tes réglages.*
- *Les envois entre lecteurs* : les livres prêtés et le message qui
  accompagne.
- *L’usage de l’IA* : le nombre d’appels et leur coût, pour tenir les
  plafonds de dépense. Le texte de tes cours n’est pas conservé.
- *Un signalement que tu fais ou que tu reçois* : une copie du contenu visé
  est jointe, pour qu’elle reste lisible même si l’original est effacé
  entretemps. Seuls les modérateurs y accèdent, pour instruire la plainte.
- *Qui tu bloques.*

Aucun traceur publicitaire, aucune mesure d’audience, aucun cookie autre
que ce qui est strictement nécessaire à ta session.

**Sur quelle base.** L’exécution du service que tu demandes en créant un
compte. Les fonctions de partage — étagère, défis, classement — ne
s’activent que par ton geste, et tu peux revenir en arrière. En
établissement, la base est la mission d’intérêt public de l’établissement.

**Où vivent ces données.** Dans une base Supabase hébergée en Irlande
(Amazon Web Services, région eu-west-1), dans l’Union européenne. Supabase
Inc. et Amazon sont des sociétés de droit américain : un accès par une
autorité américaine ne peut donc pas être exclu, même si les serveurs sont
européens. L’application elle-même est servie par ⟦hébergeur du site⟧.

**L’intelligence artificielle.** Si tu utilises le bouton de génération de
fiches, le texte ou la photo que tu fournis est envoyé à l’API d’Anthropic,
aux États-Unis, le temps de fabriquer les fiches. Ce texte ne sert pas à
entraîner de modèle. Cette fonction ne part jamais toute seule : elle
n’existe que si tu appuies.

**Combien de temps.** Tes livres restent tant que ton compte existe. Un
livre supprimé part en corbeille et s’efface définitivement au bout de 30
jours, purgés chaque nuit sans qu’il soit besoin de rouvrir l’écran
Corbeille. Les dix dernières versions d’un livre sont conservées. Ton
historique de révision est gardé tant que ton compte vit, puisque c’est
lui qui fait fonctionner le moteur. Un signalement reste le temps de son
instruction, et douze mois après sa clôture — le temps de répondre à une
contestation — puis s’efface. Tout disparaît à la suppression du compte.

**Qui d’autre peut voir.** Personne, par défaut. Un autre compte ne voit
tes fiches que si tu les lui as prêtées, ou si tu les as posées sur une
étagère dont il fait partie. Ce n’est pas qu’une règle d’affichage : la
base elle-même refuse de rendre les lignes d’un autre compte. Les images
et les sons ne quittent jamais ton compte, même quand tu prêtes un livre :
seul le texte des fiches voyage. Si tu es signalé, un modérateur voit la
copie jointe au signalement, rien d’autre de ton compte. En établissement
scolaire, ton professeur voit si tu as ouvert et rendu ses devoirs, jamais
tes réponses ni tes livres personnels ; le référent de l’établissement
peut, lui, corriger ton identité ou refaire ton mot de passe — chacun de
ses gestes sur ton compte est tracé et consultable par l’établissement.

**Tes droits.** Tu peux consulter, corriger, exporter et effacer tes
données. L’export du journal se fait depuis l’écran Journal de lecture ;
la suppression définitive du compte depuis Réglages, et elle est
immédiate. Pour tout le reste, écris à ${CONTACT} ; réponse sous un mois.
Tu peux aussi saisir la CNIL.

**En cas de fuite.** Si des données venaient à être exposées, les
personnes concernées et, le cas échéant, la CNIL seraient prévenues dans
les délais prévus par le règlement.

*Version du ${LEGALV}.*`],

  mentions: ['Mentions légales', `
**Éditeur.** ${EDITEUR}
⟦statut juridique, adresse postale, et numéro SIREN s’il existe⟧
Contact : ${CONTACT}

**Directeur de la publication.** ⟦nom⟧

**Hébergement de l’application.** ⟦hébergeur du site : nom et adresse⟧

**Hébergement des données.** Supabase Inc., infrastructure Amazon Web
Services, région eu-west-1 (Irlande, Union européenne).

**Génération de fiches par IA.** Anthropic PBC (États-Unis), appelée
uniquement lorsque tu le demandes.

**Propriété.** Le nom Folio, son identité visuelle et le code de
l’application appartiennent à l’éditeur. Les fiches écrites par les
utilisateurs restent la propriété de leurs auteurs.

**Signaler un contenu ou un problème.** ${CONTACT}

*Version du ${LEGALV}.*`]
};

/* Les crochets propres à ces textes (hébergeur, statut, directeur de la
   publication) : signalés dès qu'ils sont ouverts. Ceux d'EDITEUR et de
   CONTACT le sont dès le démarrage, dans ui/connexion.js. */
if (/⟦/.test(Object.values(LEGAL).map(v => v[1]).join(''))) {
  console.error('Folio : mentions légales incomplètes — des ⟦placeholders⟧ sont encore servis '
    + 'aux utilisateurs. Voir LEGAL dans src/ui/legal-textes.js.');
}

/* Le rendu : gras, italique, listes et paragraphes. Cinq lignes plutôt
   qu'une bibliothèque, pour la même raison que le reste de l'app. */
export function legalHtml(src) {
  return src.trim().split(/\n\s*\n/).map(b => {
    const t = b.trim();
    const fmt = s => esc(s).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
                           .replace(/\*([^*]+)\*/g, '<i>$1</i>');
    if (/^- /.test(t)) {
      return `<ul>${t.split(/\n(?=- )/).map(li =>
        `<li>${fmt(li.replace(/^- /, '').replace(/\n\s+/g, ' '))}</li>`).join('')}</ul>`;
    }
    return `<p>${fmt(t.replace(/\n/g, ' '))}</p>`;
  }).join('');
}

