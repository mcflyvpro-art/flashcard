// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { esc } from '../core/coeur-sync.js';
import { CONTACT, EDITEUR } from '../editeur.js';
import { dateFr, euros } from '../facture.js';
import './documents-etab.css';

/* ══════════ les documents du contrat d'un établissement (2026-10-26) ══════════
   Chargés à la demande depuis l'onglet Licence du référent
   (ui/ref-licence.js) : les conditions générales de vente, le contrat de
   sous-traitance que demande l'article 28 du RGPD (l'établissement est
   responsable du traitement, Mirandola sous-traitant) avec ses sous-traitants
   ultérieurs, et la fiche que le délégué à la protection des données de
   l'établissement reporte dans son registre. Les parties sont remplies avec
   ce que la base connaît (licence_tableau : le vendeur, l'établissement, ses
   coordonnées de facturation) ; ce qu'elle ne connaît pas reste entre
   ⟦crochets⟧, comme dans src/editeur.js. À faire relire par un juriste avant
   la première vente (docs/PARCOURS.md, § 6) : ce sont des textes justes et
   complets sur le fond, pas un avis juridique. */

const nomVendeur = v => (v && v.raison_sociale ? `${v.raison_sociale}${v.forme ? ` (${v.forme})` : ''}` : EDITEUR);
const adresseVendeur = v => (v && v.adresse ? `${v.adresse}, ${v.code_postal || ''} ${v.ville || ''}`.trim() : '⟦adresse de l’éditeur⟧');
const siretVendeur = v => (v && v.siret ? `SIRET ${v.siret}` : '⟦SIRET⟧');
const contactVendeur = v => (v && v.email) || CONTACT;
const nomEtab = l => (l.facturation && l.facturation.nom) || l.org || '⟦établissement⟧';

const parties = l => `<p class="dc-parties"><b>Entre</b> ${esc(nomEtab(l))}, ci-après « l’établissement »,
  <br><b>et</b> ${esc(nomVendeur(l.vendeur))}, ${esc(adresseVendeur(l.vendeur))}, ${esc(siretVendeur(l.vendeur))},
  ci-après « Mirandola ».</p>`;

const art = (titre, ...paras) => `<h3>${titre}</h3>${paras.map(p => `<p>${p}</p>`).join('')}`;

function cgv(l) {
  const prix = l.prix ? `${euros(l.prix * 100)} hors taxes par année scolaire` : 'le prix convenu au devis ou au bon de commande';
  return `<h2>Conditions générales de vente — licence établissement</h2>${parties(l)}
    ${art('1. Objet', 'Mirandola met à la disposition des élèves et des professeurs de l’établissement son application de révision '
      + '(livres de pages à apprendre, révision espacée, devoirs, suivi de classe, défis), pour la durée de la licence.')}
    ${art('2. Commande', 'La licence est commandée par devis accepté ou bon de commande. Le nombre de places, la période et le prix '
      + 'figurent sur la facture. Pour un acheteur public, la commande vaut marché public de faible montant.')}
    ${art('3. Places', `Une place est prise par chaque élève et chaque professeur qui a un compte dans l’établissement ; le référent `
      + `n’en prend pas. Licence actuelle : ${l.places ?? '⟦nombre de places⟧'} places${l.licence_fin ? `, jusqu’au ${dateFr(l.licence_fin)}` : ''}. `
      + 'Une place se libère quand le référent retire le compte de l’établissement. Quand toutes les places sont prises, les codes '
      + 'd’accès ne font plus entrer personne ; des places supplémentaires se commandent à tout moment.')}
    ${art('4. Prix', `${prix}. Le régime de TVA applicable est indiqué sur chaque facture.`)}
    ${art('5. Facturation et paiement', 'Mirandola émet une facture à la commande. Pour un acheteur public, elle est déposée sur Chorus Pro '
      + '(art. L2192-1 du code de la commande publique) ; le code service et le numéro d’engagement que l’établissement indique dans '
      + 'ses coordonnées de facturation y figurent. Le paiement se fait par virement à l’échéance indiquée. Tout retard ouvre droit '
      + 'aux intérêts moratoires et à l’indemnité forfaitaire de 40 € prévus par la loi.')}
    ${art('6. Durée et fin', 'La licence prend fin à la date indiquée, sans reconduction tacite. À son terme, les codes d’accès ne font '
      + 'plus entrer personne ; les comptes et leurs données restent, jusqu’à leur retrait par l’établissement ou leur suppression '
      + 'par leur titulaire. L’établissement peut demander à tout moment l’export ou la suppression des données de ses élèves.')}
    ${art('7. Données personnelles', 'L’établissement est responsable du traitement des données de ses élèves et de ses professeurs ; '
      + 'Mirandola agit comme sous-traitant, dans les conditions du contrat de sous-traitance joint (art. 28 du RGPD).')}
    ${art('8. Service', 'Mirandola est hébergé et entretenu par l’éditeur, qui s’engage à mettre en œuvre les moyens raisonnables pour en '
      + 'assurer la disponibilité et la sécurité (obligation de moyens). Les interruptions pour maintenance sont aussi brèves que possible.')}
    ${art('9. Sécurité des accès', 'Les codes élèves et professeurs se renouvellent seuls, chaque semaine par défaut ; le référent peut '
      + 'les changer à tout moment. Chaque geste du référent est inscrit à l’historique de sa console.')}
    ${art('10. Droit applicable', 'Le contrat est soumis au droit français. Pour un acheteur public, les litiges relèvent du tribunal '
      + 'administratif compétent ; sinon, des tribunaux du ressort du siège de Mirandola.')}
    <p class="dc-pied">Contact : ${esc(contactVendeur(l.vendeur))}</p>`;
}

const SOUS_TRAITANTS = [
  ['Supabase Inc.', 'Base de données, authentification, stockage des fichiers', 'Union européenne (Irlande, région eu-west-1)'],
  ['Vercel Inc.', 'Diffusion de l’application (fichiers du site, journaux techniques)', 'Réseau mondial ; États-Unis — clauses contractuelles types'],
  ['Anthropic PBC', 'Génération de pages par l’IA, seulement quand un utilisateur s’en sert', 'États-Unis — clauses contractuelles types']
];

function dpa(l) {
  return `<h2>Contrat de sous-traitance — article 28 du RGPD</h2>${parties(l)}
    ${art('1. Objet et durée', 'Mirandola traite, pour le compte de l’établissement, les données nécessaires pour fournir son application '
      + 'aux élèves et aux professeurs, pendant la durée de la licence.')}
    ${art('2. Nature et finalités', 'Créer et gérer les comptes ; permettre la révision, les devoirs, le suivi pédagogique et les défis ; '
      + 'assurer la sécurité du service. Aucune publicité, aucune revente, aucun profilage commercial.')}
    ${art('3. Données et personnes concernées', 'Élèves, dont des mineurs, professeurs et référent. Identité scolaire (prénom, nom, '
      + 'classe), identifiant de connexion (adresse e-mail ou identifiant de carte élève), contenus créés, réponses et dates de '
      + 'révision, devoirs. Ni donnée sensible, ni photographie de personne, ni géolocalisation.')}
    ${art('4. Obligations de Mirandola', 'Mirandola ne traite les données que sur instruction documentée de l’établissement ; garantit la '
      + 'confidentialité de ses personnels autorisés ; met en œuvre les mesures de sécurité de l’article 32 (chiffrement en transit, '
      + 'cloisonnement des données par compte et par établissement en base, droits par rôle, historique des actes du référent, '
      + 'renouvellement des codes d’accès) ; aide l’établissement à répondre aux demandes d’exercice des droits et à réaliser une '
      + 'analyse d’impact si elle est nécessaire ; notifie toute violation de données dans les meilleurs délais, et au plus tard '
      + '48 heures après en avoir pris connaissance ; met à disposition les informations nécessaires pour démontrer le respect du '
      + 'présent contrat et permettre des audits.')}
    ${art('5. Sous-traitants ultérieurs', 'L’établissement autorise le recours aux sous-traitants ci-dessous. Mirandola l’informe de tout '
      + 'changement envisagé, ce qui lui donne la possibilité de s’y opposer.')}
    <table class="dc-table"><thead><tr><th>Sous-traitant</th><th>Rôle</th><th>Lieu, garanties</th></tr></thead>
      <tbody>${SOUS_TRAITANTS.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>
    ${art('6. Fin du contrat', 'Au terme de la licence, et au choix de l’établissement, Mirandola supprime les données ou les lui restitue '
      + '(export), puis détruit les copies existantes, sauf obligation légale de conservation (les factures, dix ans).')}
    ${art('7. Coordonnées', `Mirandola : ${esc(contactVendeur(l.vendeur))}. Délégué à la protection des données de l’établissement : `
      + '⟦à compléter par l’établissement⟧.')}`;
}

function registre(l) {
  const lignes = [
    ['Traitement', 'Application de révision Mirandola'],
    ['Responsable', nomEtab(l)],
    ['Sous-traitant', nomVendeur(l.vendeur)],
    ['Finalités', 'Révision, devoirs, suivi pédagogique, défis en classe'],
    ['Base légale', 'Mission d’intérêt public (art. 6.1.e du RGPD) pour un établissement public ; intérêt légitime ou contrat sinon'],
    ['Personnes', 'Élèves (dont mineurs), professeurs, référent'],
    ['Données', 'Prénom, nom, classe, identifiant de connexion, contenus, réponses et dates de révision, devoirs'],
    ['Destinataires', 'Les professeurs de la classe, le référent de l’établissement, Mirandola et ses sous-traitants (contrat de sous-traitance)'],
    ['Transferts', 'Base de données dans l’Union européenne ; diffusion et IA : États-Unis, clauses contractuelles types'],
    ['Conservation', 'Tant que le compte est dans l’établissement ; un livre supprimé est effacé au bout de 30 jours, une partie '
      + 'en direct le lendemain ; les factures dix ans'],
    ['Sécurité', 'Chiffrement en transit, cloisonnement par compte et par établissement, droits par rôle, historique du référent, '
      + 'codes renouvelés chaque semaine']
  ];
  return `<h2>Fiche pour le registre des traitements</h2>
    <table class="dc-table dc-fiche"><tbody>${lignes.map(([k, v]) => `<tr><th>${k}</th><td>${esc(v)}</td></tr>`).join('')}</tbody></table>`;
}

const TEXTES = { cgv, dpa, registre };

export function documentHtml(k, licence) {
  const f = TEXTES[k] || cgv;
  return `<article class="dc-doc">${f(licence || {})}</article>`;
}
