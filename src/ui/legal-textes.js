// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { esc } from '../core/coeur-sync.js';
import { CONTACT, EDITEUR } from '../editeur.js';
import { ENTREPRISE, HEBERGEUR } from '../entreprise.js';
import { euros, FORMULES } from '../abonnement.js';
import { IA_PAR_MOIS, IA_PROF_PAR_MOIS, LIVRES_GRATUITS } from '../offres.js';
// Lu au niveau module, mais sans risque : ce fichier n'est importé que par
// import(), depuis legalView(), donc bien après l'évaluation de connexion.js.
import { PWMIN } from './connexion.js';

/* ══════════ les textes du cadre, chargés à la demande ══════════
   Sortis du démarrage le 2026-10-25 : on les ouvre rarement, et le service
   worker les met en cache avec le reste, donc ils se lisent toujours hors
   ligne et avant d'avoir un compte. Seuls leurs titres restent dans
   ui/connexion.js (LEGAL_TITRES), pour les liens. Rien d'autre que
   legalView() ne doit importer ce fichier.

   Réécrits le 2026-11-05 (demandé : « le légal, en entier, parfait ») :
   les conditions d'utilisation (DSA : signalement, modération motivée,
   point de contact ; l'IA dite comme telle ; les mineurs), les conditions
   de vente de Mirandola+ (les prix lus dans FORMULES, la reconduction, la
   résiliation en trois clics, la rétractation et son formulaire, la
   garantie de conformité, la médiation), la confidentialité (chaque
   donnée, sa raison, sa durée, chaque destinataire), les mentions légales
   (LCEN) et les logiciels libres (les notices que leurs licences exigent).
   Les prix et les quotas viennent des modules qui les appliquent : le texte
   ne peut pas dire autre chose que l'app. */
const LEGALV = '5 novembre 2026';
const E = ENTREPRISE;
const mois = FORMULES.mensuel, an = FORMULES.annuel;

export const LEGAL = {
  cgu: ['Conditions d’utilisation', `
**1. Ce que Mirandola est.** Une application de révision : tu ranges ce que tu
dois apprendre en livres de pages (des flashcards), et le moteur de
répétition espacée décide quand te les représenter. Autour : la création de
pages par l’intelligence artificielle, les classes et les devoirs d’un
professeur, les clubs, les défis et le courrier entre lecteurs. Elle est
éditée par ${EDITEUR} (voir les Mentions légales).

**2. Ces conditions.** Créer un compte, ou utiliser Mirandola sans compte
dans la démo, vaut acceptation de ces conditions. Si elles changent de façon
importante, tu en es prévenu dans l’app ou par e-mail au moins 30 jours
avant ; tu peux alors supprimer ton compte si tu n’es pas d’accord.

**3. Les offres.** *Mirandola gratuit* : sans paiement, jusqu’à
${LIVRES_GRATUITS} livres à toi. *Mirandola+* : un abonnement payant, régi en plus
par les Conditions de vente. *Mirandola Campus* : l’accès qu’un
établissement ou un professeur particulier ouvre à ses élèves, régi par
son contrat avec l’éditeur.

**4. Âge.** À partir de 15 ans, tu peux utiliser Mirandola seul. Avant 15
ans, il faut l’accord d’un parent ou du responsable légal (article 45 de la
loi Informatique et Libertés) : il peut nous écrire à ${CONTACT} pour toute
question, et faire valoir tes droits à ta place. Dans une classe, c’est
l’établissement ou le professeur qui t’ouvre l’accès. Un abonnement payant
se prend par un majeur, ou avec l’accord d’un parent.

**5. Ton compte.** Une adresse e-mail que tu confirmes et un mot de passe
d’au moins ${PWMIN} caractères, ou ton compte Google. Tu peux ajouter la
vérification en deux étapes. Garde tes accès pour toi : ce qui est fait
depuis ton compte est réputé fait par toi. Ton pseudo est visible des
lecteurs avec qui tu partages quelque chose ; il ne doit tromper personne
sur ton identité ni blesser qui que ce soit.

**6. Ce que tu écris t’appartient.** Tes livres, tes pages, tes images et
tes sons restent les tiens. Tu nous autorises seulement à les héberger, les
copier entre tes appareils et les montrer aux personnes avec qui tu choisis
de les partager (un ami à qui tu prêtes un livre, un club, une classe, un
lien de partage), le temps qu’ils sont en ligne. Tu peux les retirer quand
tu veux. Tu garantis avoir le droit d’y mettre ce que tu y mets.

**7. L’intelligence artificielle.** Dans Mirandola+ et Campus, une IA peut
écrire des pages à partir d’un cours, d’une photo ou d’un document, et te
répondre quand tu lui demandes de les retoucher : tu échanges alors avec une
machine, pas avec une personne. Ce qu’elle écrit peut être inexact : relis
avant d’apprendre. N’y envoie ni données personnelles d’autres personnes,
ni informations sensibles, ni document que tu n’as pas le droit d’utiliser.
L’usage est plafonné chaque mois, pour que le service reste soutenable.

**8. Ce qui n’a pas sa place ici.** Contenu illégal, haineux,
discriminatoire, violent, pornographique ou sexualisant un mineur ;
harcèlement ; atteinte à la vie privée ou à l’image d’autrui ; contenu
protégé par un droit que tu n’as pas ; usurpation d’identité ; publicité ou
démarchage ; tentative de contourner les limites de son offre, de se
connecter au compte d’un autre, d’extraire massivement des données ou de
perturber le service.

**9. Signaler, et ce que nous faisons.** Un contenu, un profil ou un club se
signalent depuis l’app (« Signaler »), ou par e-mail à ${CONTACT} en disant
où il se trouve et pourquoi il te paraît illicite. Chaque signalement est lu
par une personne. Selon ce qui est en jeu, nous pouvons retirer un contenu,
le rendre invisible, suspendre un compte pour un temps ou le supprimer.
Sauf urgence ou interdiction légale, la personne concernée reçoit la raison
de la décision et peut la contester en écrivant à ${CONTACT} ; elle garde le
droit de saisir le juge. Le point de contact des utilisateurs et des
autorités, au sens du règlement européen sur les services numériques, est
${CONTACT}, en français ou en anglais.

**10. Le service.** Mirandola fonctionne aussi hors ligne et se synchronise
quand le réseau revient. Nous faisons le nécessaire pour qu’il soit
disponible et sûr, sans pouvoir garantir l’absence d’interruption, ni un
résultat scolaire. Il peut évoluer ; une fonction payante qui disparaîtrait
pendant un abonnement ouvre droit à un remboursement au prorata.

**11. Responsabilité.** Nous répondons de nos fautes dans les conditions de
la loi. Rien dans ces conditions ne réduit les droits que la loi te donne
comme consommateur.

**12. La fin.** Tu peux supprimer ton compte à tout moment, depuis
Réglages : tout ce qui est à toi est alors effacé. Si tu enfreins ces
conditions, ton compte peut être suspendu ou supprimé, avec sa raison
(article 9). Si Mirandola devait fermer, tu serais prévenu au moins 60
jours avant, avec le moyen d’exporter tes livres.

**13. Propriété.** Le nom Mirandola, son logo, ses textes et son code
appartiennent à l’éditeur. Mirandola s’appuie aussi sur des logiciels
libres, chacun sous sa licence (voir Logiciels libres).

**14. Droit applicable.** Droit français. En cas de désaccord, écris d’abord
à ${CONTACT} ; un consommateur peut ensuite saisir gratuitement le médiateur
de la consommation (voir les Conditions de vente) ou le tribunal de son
domicile.

*Version du ${LEGALV}.*`],

  cgv: ['Conditions de vente', `
**1. Le vendeur, l’acheteur.** Ces conditions régissent la vente de
l’abonnement Mirandola+ par ${EDITEUR} (voir les Mentions légales) à une
personne qui l’achète pour elle-même, sur mirandola.fr ou dans l’app. Elles
complètent les Conditions d’utilisation. Un établissement ou un professeur
qui achète Mirandola Campus signe un contrat à part.

**2. Ce que Mirandola+ ouvre.** Le Memory Engine Ultra (le moteur qui se
règle sur ta mémoire) ; des livres sans limite ; la création de pages par
l’IA à partir d’un cours, d’une photo ou d’un document, jusqu’à
${IA_PAR_MOIS.plus} générations par mois (${IA_PROF_PAR_MOIS} pour un professeur) ;
les QCM et les associations ; les images et les sons sur les pages ; toutes
les statistiques du journal.

**3. Les prix.** Toutes taxes comprises :

- *Mirandola+ au mois* : ${euros(mois.prix)} par mois, sans engagement.
- *Mirandola+ à l’année* : ${euros(an.prix)} par an, payé en une fois, soit
  ${euros(an.mois)} par mois ou ${an.remise} % de moins que douze mois au mois
  (${euros(an.sans)}).

Le prix payé est celui affiché au moment de la commande. S’il change, tu en
es prévenu au moins 30 jours avant ta prochaine échéance ; le nouveau prix ne
s’applique qu’à partir d’elle, et tu peux résilier avant.

**4. La commande.** Tu choisis ta formule dans l’écran Mirandola+, tu
acceptes ces conditions, puis tu paies sur la page sécurisée de Stripe.
Mirandola+ s’ouvre dès le paiement accepté ; la confirmation de ta commande
et ta facture t’arrivent par e-mail.

**5. Le paiement.** Par carte, à chaque début de période. Le paiement est
traité par Stripe Payments Europe ; nous ne voyons jamais ton numéro de
carte. Si un prélèvement échoue, Stripe réessaie pendant quelques jours ;
s’il échoue encore, ton compte repasse à Mirandola gratuit, sans rien perdre
de tes livres. Dans l’app d’un magasin (App Store, Google Play), le paiement
et le remboursement suivent aussi les conditions du magasin.

**6. Durée et renouvellement.** La formule au mois se renouvelle chaque mois,
la formule à l’année chaque année, jusqu’à ce que tu résilies. Pour la
formule à l’année, nous te rappelons par e-mail, entre trois mois et un mois
avant l’échéance, la date du renouvellement et comment l’arrêter (article
L215-1 du code de la consommation). Sans ce rappel, tu peux résilier à tout
moment après le renouvellement et tu es remboursé des mois qui restent.

**7. Résilier.** Dans Réglages, puis Mirandola+, puis « Résilier
l’abonnement », en quelques gestes et sans justification (article L215-1-1).
La résiliation prend effet à la fin de la période déjà payée : Mirandola+
reste ouvert jusque-là, rien n’est plus prélevé ensuite. Un abonnement pris
dans l’app d’un magasin se résilie dans les réglages du magasin.

**8. Rétractation.** Tu as 14 jours après ta souscription pour te rétracter,
sans donner de raison (article L221-18). Comme Mirandola+ s’ouvre tout de
suite, tu demandes expressément, en commandant, qu’il commence avant la fin
de ce délai : si tu te rétractes, tu es remboursé du prix payé moins la part
qui correspond aux jours déjà écoulés (article L221-25). Pour te rétracter,
écris à ${CONTACT}, par exemple avec ce modèle : « À l’attention de
${EDITEUR}, ${E.adresse}, ${CONTACT} : je vous notifie par la présente ma
rétractation du contrat portant sur l’abonnement Mirandola+, souscrit le …,
au nom de …, avec l’adresse e-mail de mon compte …, le … (date). » Le
remboursement arrive sous 14 jours, sur le moyen de paiement utilisé.

**9. Garantie de conformité.** Mirandola+ doit être conforme à ce que
décrivent ces conditions pendant toute la durée de ton abonnement (articles
L224-25-12 et suivants du code de la consommation). S’il ne l’est pas, écris
à ${CONTACT} : nous le remettons en conformité sans frais dans un délai
raisonnable ; à défaut, tu obtiens une réduction du prix ou la fin du
contrat avec remboursement de la période non conforme.

**10. Une réclamation, la médiation.** Écris d’abord à ${CONTACT} : réponse
sous 15 jours. Si ta réclamation écrite n’a pas abouti, tu peux saisir
gratuitement le médiateur de la consommation, dans l’année qui suit :
${E.mediateur}.

**11. Données personnelles.** Voir Confidentialité.

**12. Droit applicable.** Droit français. Tu peux saisir le tribunal du lieu
où tu habitais au moment de la commande.

*Version du ${LEGALV}.*`],

  vie: ['Confidentialité', `
**Qui est responsable.** ${EDITEUR}, éditeur de Mirandola (voir les Mentions
légales), joignable à ${CONTACT}. Quand un établissement scolaire ouvre
Mirandola à ses élèves, c’est lui qui décide de ce qui relève de la classe :
il est responsable de ce traitement, et nous agissons sur ses instructions,
par un contrat de sous-traitance.

**Ce que nous recueillons, pourquoi, et combien de temps.**

- *Ton compte* : adresse e-mail, mot de passe (enregistré chiffré, jamais
  lisible, même par nous), pseudo, nom affiché, visage dessiné (des traits
  choisis dans des listes, jamais une photo), niveau, année et matières si
  tu les donnes, réglages. Pour ouvrir ton compte et te servir. Tant que
  le compte existe. Un compte créé et jamais confirmé s’efface au bout de
  7 jours.
- *La sécurité* : la clé de ta vérification en deux étapes si tu l’actives,
  les codes envoyés par e-mail (valables une heure), et les journaux
  techniques de nos hébergeurs (adresse IP, date, page demandée), gardés
  quelques jours. Pour protéger ton compte et le service.
- *Tes livres et ton historique* : tes pages, images et sons ; chacune de
  tes révisions (la page, ta réponse, juste ou faux, en combien de temps,
  quand). C’est ce qui fait choisir au moteur quand une page revient, et
  tracer ton journal. Tant que le compte existe ; un livre supprimé part en
  corbeille et s’efface au bout de 30 jours ; les dix dernières versions
  d’un livre sont gardées.
- *Ce que tu partages* : amis, clubs, défis, parties en direct, courrier,
  classements. Seulement quand tu le fais. Une partie en direct s’efface le
  lendemain ; le reste, tant que tu le gardes.
- *Ta classe* : si tu rejoins un établissement ou un professeur, ton nom
  « Prénom NOM », ta classe, tes devoirs et leur avancement.
- *L’abonnement* : ta formule, son état, ses dates et son montant. Le paiement
  lui-même est chez Stripe, qui garde tes coordonnées de paiement. Les
  factures sont conservées dix ans (obligation comptable).
- *L’IA* : le nombre de générations et leur coût, pour tenir les plafonds.
  Le texte, la photo ou le document que tu envoies ne sont pas gardés par
  Mirandola.
- *Un signalement* : son motif et une copie du contenu visé, lue seulement
  par la personne qui l’instruit. Gardé le temps de l’instruction et douze
  mois après sa clôture.
- *Une demande de démo* (établissements) : le nom, la fonction et les
  coordonnées de la personne qui écrit. Trois ans après le dernier échange.

**Sur quelle base.** L’exécution du service que tu demandes (ton compte,
tes livres, l’abonnement) ; ton choix, pour ce que tu partages et pour l’IA,
qui ne part jamais seule ; notre intérêt légitime pour la sécurité et pour
répondre à une demande de démo ; nos obligations légales (factures) ; et,
dans un établissement public, sa mission d’intérêt public.

**Sur ton appareil.** Mirandola garde sur ton appareil ce qui lui permet de
marcher, même hors ligne : ta session, une copie de tes livres et de ce qui
attend d’être envoyé, tes réglages, ton offre, les codes d’une classe ou
d’une partie que tu as ouverts avant de te connecter (une heure au plus).
Aucun cookie, aucun traceur, aucune mesure d’audience, aucune publicité :
rien qui demande ton consentement.

**Qui d’autre y a accès.** Personne par défaut : un autre compte ne voit
que ce que tu partages avec lui, et c’est la base elle-même qui refuse le
reste. Ce que voient les autres :

- tes amis et les membres de tes clubs : ton pseudo, ton visage, tes
  chiffres de lecture (jamais tes livres ni tes réponses) ;
- ton professeur : ton avancement et tes réussites sur ses devoirs, et les
  pages de ses devoirs qui te résistent, jamais tes livres personnels ;
- le référent de ton établissement : ton nom, ta classe ; il peut corriger
  ton identité ou te donner un mot de passe provisoire, et chacun de ses
  gestes est tracé ;
- l’éditeur : de quoi gérer les comptes (adresse, rôle, dates, nombres de
  livres et de révisions), jamais le contenu de tes livres.

**Nos prestataires**, qui n’agissent que sur nos instructions :

- *Supabase* (base de données, connexion, fichiers), serveurs en Irlande ;
- *Vercel* (diffusion du site et de l’app), réseau mondial ;
- *Anthropic* (l’IA), aux États-Unis, seulement quand tu t’en sers ; il
  n’entraîne pas ses modèles sur ces données ;
- *Stripe* (paiement), en Irlande, seulement si tu t’abonnes ;
- *Brevo* (envoi des e-mails : codes, alertes, accusés), en France ;
- *Google*, seulement si tu te connectes avec ton compte Google ; *Apple* ou
  *Google Play*, seulement si tu t’abonnes depuis leur magasin.

Plusieurs sont des sociétés américaines : leurs transferts de données sont
encadrés par les clauses contractuelles types de la Commission européenne
ou par le cadre de protection des données UE–États-Unis ; un accès par une
autorité américaine ne peut pas être exclu.

**Ta sécurité.** Connexion chiffrée, mots de passe chiffrés, données
cloisonnées par compte et par établissement dans la base, vérification en
deux étapes au choix, alerte par e-mail quand ton mot de passe, ton adresse
ou ta sécurité changent.

**Tes droits.** Accès, rectification, effacement, portabilité, opposition,
limitation, et directives sur ce que deviennent tes données après ton décès.
Dans l’app : corriger ton profil dans Réglages, exporter ta bibliothèque
(Réglages, Sauvegarde) et ton journal, supprimer ton compte (Réglages), ce
qui efface tout aussitôt. Pour le reste, écris à ${CONTACT} : réponse sous
un mois. Avant 15 ans, un parent peut exercer ces droits pour toi. Tu peux
aussi saisir la CNIL (cnil.fr, 3 place de Fontenoy, 75007 Paris).

**En cas de fuite.** Si des données venaient à être exposées, la CNIL et les
personnes concernées seraient prévenues dans les délais du règlement.

*Version du ${LEGALV}.*`],

  mentions: ['Mentions légales', `
**Éditeur.** ${EDITEUR}, ${E.forme}. Siège : ${E.adresse}.
Immatriculation : ${E.immatriculation}. TVA : ${E.tva}.
Contact : ${CONTACT}.

**Directeur de la publication.** ${E.directeur}.

**Hébergement du site et de l’application.** ${HEBERGEUR}.

**Hébergement des données.** Supabase Inc., sur l’infrastructure d’Amazon
Web Services, région eu-west-1 (Irlande, Union européenne).

**Signaler un contenu illicite.** Depuis l’app (« Signaler »), ou à
${CONTACT}, en indiquant où se trouve le contenu, pourquoi il te paraît
illicite, et ton nom et ton adresse e-mail (sauf pour un contenu
pédopornographique, qui se signale aussi sur internet-signalement.gouv.fr).
C’est aussi notre point de contact au sens du règlement européen sur les
services numériques, en français ou en anglais.

**Médiateur de la consommation.** ${E.mediateur}.

**Propriété.** Le nom Mirandola, son logo, ses textes, ses images et son code
appartiennent à l’éditeur ; toute reproduction demande son accord. Les
pages écrites par les utilisateurs restent à leurs auteurs. Les logiciels
libres que Mirandola utilise restent sous leur licence (voir Logiciels
libres). Anki est une marque d’Ankitects Pty Ltd, Quizlet une marque de
Quizlet Inc. ; Mirandola n’est lié ni à l’une ni à l’autre.

*Version du ${LEGALV}.*`],

  logiciels: ['Logiciels libres', `
Mirandola s’appuie sur des logiciels libres. Leurs auteurs ne sont pas liés
à Mirandola et ne le recommandent pas ; leurs licences demandent que leurs
notices soient reproduites, les voici.

**FSRS (crate fsrs 6.6.2)** — l’optimiseur du moteur, compilé dans
fsrs.wasm, et le modèle de mémoire porté dans le moteur de Mirandola.
github.com/open-spaced-repetition/fsrs-rs, licence BSD à trois clauses.

Copyright (c) 2023, Open Spaced Repetition

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

- Redistributions of source code must retain the above copyright notice,
  this list of conditions and the following disclaimer.
- Redistributions in binary form must reproduce the above copyright notice,
  this list of conditions and the following disclaimer in the documentation
  and/or other materials provided with the distribution.
- Neither the name of the copyright holder nor the names of its contributors
  may be used to endorse or promote products derived from this software
  without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
POSSIBILITY OF SUCH DAMAGE.

fsrs.wasm contient aussi les bibliothèques Rust dont dépend fsrs, sous
licence MIT ou Apache 2.0, et priority-queue, sous licence MPL 2.0 (son code
source : crates.io/crates/priority-queue) ; leur liste et leurs notices sont
sur mirandola.fr/licences.txt.

**py-fsrs** — la machine d’états du moteur (paliers, rechute, flou), portée
en JavaScript. github.com/open-spaced-repetition/py-fsrs, licence MIT.

Copyright (c) 2022 Open Spaced Repetition

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

**Lucide** — des icônes de l’app. lucide.dev, licence ISC.

Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part
of Feather (MIT). All other copyright (c) for Lucide are held by Lucide
Contributors 2022.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY
SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION
OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN
CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

**Feather** — les icônes de Lucide qui en viennent. feathericons.com,
licence MIT. Copyright (c) 2013-present Cole Bemis. Sa notice est celle de
la licence MIT reproduite plus haut, ce nom à la place.

*Version du ${LEGALV}.*`]
};

/* Les crochets de l'identité de l'éditeur (src/editeur.js) : signalés dès
   qu'un texte s'ouvre. Ceux d'EDITEUR et de CONTACT le sont dès le
   démarrage, dans ui/connexion.js. */
if (/⟦/.test(Object.values(LEGAL).map(v => v[1]).join(''))) {
  console.error('Mirandola : mentions légales incomplètes — des ⟦placeholders⟧ sont encore servis '
    + 'aux utilisateurs. Voir src/editeur.js et src/entreprise.js.');
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
