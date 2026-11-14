# Les documents pour vendre et faire tourner Mirandola

Écrit le 2026-11-14 (demandé : « tout ce qui me manque pour vendre : factures,
devis, modèles, la totale »). Ce fichier dit, pour chaque pièce : **où elle
est**, **qui la produit**, et **ce qu'il te reste à faire à la main**. Les
modèles qui n'existent pas dans l'app sont en bas, prêts à copier.

Ce qui ne dépend que de toi (l'entreprise, Stripe en vrai, les secrets) est
dans `docs/ENTREPRISE.md`, `docs/VENTE.md` et `docs/FIABILITE.md`. Rien ici ne
remplace un expert-comptable ni un avocat : les modèles sont des bases
sérieuses, à faire relire une fois avant ton premier gros contrat.

## 1. La carte : chaque document, où il vit

| Document | Où | Qui le produit |
|---|---|---|
| **Devis** (D-AAAA-NNNN) | Console de l'éditeur → fiche d'un établissement → « Faire un devis » | Toi, en 30 secondes ; numéroté et figé par la base |
| **Accord du client** (« bon pour accord ») | Console du référent → Licence → le devis → « Accepter le devis » ; ou le devis signé, ou son bon de commande | Le client en ligne, ou toi (« Accepté ») quand il arrive par courrier |
| **Facture** (F-AAAA-NNNN) | Devis accepté → « Ouvrir la licence et facturer » ; ou « Émettre une facture » dans la fiche | Un geste ; totaux, TVA, mentions et numéro par la base |
| **Avoir** (A-AAAA-NNNN) | Une facture → « Annuler par un avoir » | Un geste (une facture émise ne se modifie jamais) |
| **Conditions générales de vente Campus** | Console du référent → Licence → Documents | Écrites, imprimables, au nom de l'établissement |
| **Contrat de sous-traitance RGPD** (art. 28) | Console du référent → Licence → Documents | Écrit, avec la liste des sous-traitants |
| **Fiche pour le registre de l'établissement** | Console du référent → Licence → Documents | Écrite |
| **Conditions de vente Mirandola+ / Infini** | `mirandola.fr/mentions/cgv` | Écrites (prix lus dans le code : elles ne peuvent pas dire autre chose que l'app) |
| **Conditions d'utilisation, confidentialité, mentions légales, logiciels libres** | `mirandola.fr/mentions/…` | Écrites ; les ⟦crochets⟧ se remplissent à l'immatriculation |
| **Factures et reçus des abonnés** (B2C) | Stripe : envoyés par e-mail, retrouvés dans « Carte et factures » de l'app | Stripe, automatiquement (réglage au § 3) |
| **E-mails de compte** (confirmation, code, mot de passe, alertes) | `supabase/courriels/` | Écrits, en français, aux couleurs de Mirandola |
| **Accusé d'une demande de démo ou d'espace professeur** | Fonction `prevenir` | Automatique (Brevo) |
| **Relances de paiement, messages types, livre des recettes, procédures RGPD** | Ce fichier, § 5 à § 8 | Modèles à copier |

## 2. Vendre à un établissement, du premier contact à l'argent

Tout se passe dans la console de l'éditeur, onglet **Établissements**. Les
étapes sont dans l'ordre ; chacune a son bouton.

1. **La demande arrive** (formulaire « Demander une démo » du site) : elle est
   en tête de liste, étape Prospect, et tu reçois l'alerte par e-mail.
2. **Lancer la démo** : « Lancer » dans la fiche (places, durée, classes
   d'exemple). Le code référent se transmet par le bouton « Écrire à … »
   (message tout écrit) ; modèle de réponse au § 6.1.
3. **Faire le devis** : « Faire un devis ». Les places proposent la ligne de
   licence au prix de la grille (`src/tarifs.js` : 5 € HT la place jusqu'à
   100, 3,50 € jusqu'à 500, 2,50 € jusqu'à 1 500, 2 € au-delà, 100 € HT
   minimum) ; tu changes le prix si tu as convenu autre chose, tu ajoutes une
   ligne (formation, accompagnement). La période proposée est l'année
   scolaire. « Émettre le devis » : il est numéroté, figé, valable 30 jours.
4. **L'envoyer** : « Imprimer ou PDF » (enregistre le PDF), puis « Écrire au
   contact » (le message est écrit, joins le PDF). Si l'établissement a déjà
   son référent (démo lancée), il le voit aussi dans sa console, onglet
   Licence.
5. **L'accord** : trois chemins, tous valables.
   - Le référent clique **« Accepter le devis »** (son nom, sa fonction, son
     numéro de bon de commande) : tu vois « message » sur la ligne de
     l'établissement.
   - Il te renvoie le devis signé (« Bon pour accord », date, signature,
     cachet) : tu notes « Accepté » avec le nom du signataire.
   - Un établissement public t'envoie son **bon de commande** : note
     « Accepté » avec son numéro d'engagement. Garde le bon de commande.
6. **Ouvrir la licence et facturer** : un bouton, deux appuis. La licence
   s'ouvre (places, date de fin, prix convenu), la facture est émise avec les
   lignes du devis et le bon de commande. Il faut les **coordonnées de
   facturation** du client (dans sa fiche, ou remplies par le référent) : la
   base refuse sans elles, et rien ne bouge.
7. **Déposer la facture** :
   - établissement **public** (collège, lycée public, université) : sur
     **Chorus Pro** (portail de l'État), avec le SIRET du client, son code
     service et le numéro d'engagement ; puis « Déposée sur Chorus Pro » dans
     l'app. Check-list au § 6.4.
   - établissement **privé** : par e-mail, le PDF en pièce jointe.
8. **Le paiement** : à réception du virement, « Payée ». En retard : les trois
   relances du § 5. Une erreur sur la facture : « Annuler par un avoir », puis
   une nouvelle facture.
9. **Le renouvellement** : la console te montre les licences qui finissent ;
   refais un devis deux mois avant (les places en cours reprennent le prix
   convenu). Modèle de message au § 6.3.

Un professeur particulier ne passe pas par là : sa demande arrive dans
**Comptes**, tu ouvres son compte et sa licence, et tu lui adresses une
facture hors de l'app (modèle de facture simple : les mêmes mentions que
celles qu'imprime l'app — vendeur, client, numéro dans la même suite F,
date, désignation, prix HT, mention de TVA, échéance, pénalités). **Limite
connue** : les factures et les devis de l'app sont rattachés à un
établissement ; pour facturer un professeur particulier depuis l'app, crée-le
comme un établissement (« Établissement » → son nom, genre « autre »), fais
son devis et sa facture là, sans lancer de démo.

## 3. Vendre à un particulier (Mirandola+, Infini) : tout est automatique

- Le client paie par Stripe depuis l'app ; l'abonnement, l'essai de 7 jours,
  le code de lancement, la résiliation et le changement de formule passent
  par Stripe (`docs/VENTE.md`).
- **Les factures** : Stripe en émet une à chaque prélèvement. Pour qu'elles
  soient conformes et envoyées seules, une fois, dans le tableau de bord
  Stripe :
  1. *Paramètres → Informations publiques* : nom, adresse, e-mail de contact.
  2. *Paramètres → Facturation → Factures* : préfixe de numérotation, pied de
     page avec ta mention de TVA (« TVA non applicable, art. 293 B du CGI »
     tant que tu es en franchise), SIRET dans les informations légales.
  3. *Paramètres → E-mails des clients* : cocher l'envoi des factures et des
     reçus payés, et le rappel avant renouvellement d'un abonnement annuel.
- **Le rappel de renouvellement** d'un abonnement annuel est une obligation
  (code de la consommation) : vérifie qu'il est bien coché ci-dessus.
- **La rétractation** : 14 jours ; le client qui a demandé le démarrage
  immédiat (la case de l'écran de paiement) et qui se rétracte se rembourse
  depuis Stripe (*Paiements → Rembourser*). Modèle de réponse au § 6.5.

## 4. Ce que tu dois tenir à jour toi-même

- **Le livre des recettes** (obligatoire pour un micro-entrepreneur) : une
  ligne par encaissement, dans l'ordre des dates. Modèle au § 7. Deux
  sources : les factures Campus marquées « Payée » dans l'app, et l'export
  mensuel des paiements de Stripe (*Rapports → Solde → Exporter*).
- **Les déclarations de chiffre d'affaires** à l'URSSAF (au mois ou au
  trimestre) : le total encaissé de la période, depuis le livre des recettes.
- **Les factures reçues** (Supabase, Vercel, Anthropic, Stripe, Brevo, OVH) :
  à garder dix ans, dans un dossier par année.
- **Les seuils** : franchise de TVA, guichet OSS si tu vends à des
  particuliers d'autres pays de l'Union, facture électronique : tout est dans
  `docs/ENTREPRISE.md`, avec les dates.
- **Le registre des traitements** et les procédures du § 8.
- **Conservation** : factures, avoirs, devis acceptés, bons de commande,
  contrats — dix ans. L'app ne supprime jamais une facture ni un
  établissement facturé.

## 5. Modèles : les relances de paiement

À envoyer depuis ton adresse professionnelle, la facture en pièce jointe.
Remplace ce qui est entre crochets.

### 5.1 Rappel amiable (5 jours après l'échéance)

> Objet : Facture [F-AAAA-NNNN] · rappel
>
> Bonjour [Madame, Monsieur …],
>
> Sauf erreur de notre part, la facture [F-AAAA-NNNN] du [date], d'un montant
> de [montant] €, arrivée à échéance le [date], n'est pas encore réglée. Vous
> la trouverez ci-jointe.
>
> Si le règlement est en cours, merci de ne pas tenir compte de ce message.
> Sinon, pouvez-vous m'indiquer la date de paiement prévue ?
>
> Bien cordialement,
> [Prénom Nom], Mirandola

### 5.2 Relance (20 jours après l'échéance)

> Objet : Facture [F-AAAA-NNNN] · relance
>
> Bonjour [Madame, Monsieur …],
>
> Malgré notre rappel du [date], la facture [F-AAAA-NNNN] de [montant] €,
> échue le [date], reste impayée.
>
> Je vous remercie de procéder à son règlement sous huit jours, par virement
> sur le compte indiqué sur la facture. Si un élément bloque son traitement
> (numéro d'engagement, code service, dépôt sur Chorus Pro), dites-le-moi :
> je le corrige aussitôt.
>
> Bien cordialement,
> [Prénom Nom], Mirandola

### 5.3 Mise en demeure (45 jours après l'échéance, en recommandé)

> Objet : Mise en demeure de payer · facture [F-AAAA-NNNN]
>
> [Madame, Monsieur …],
>
> La facture [F-AAAA-NNNN] du [date], d'un montant de [montant] €, échue le
> [date], demeure impayée malgré nos relances des [date] et [date].
>
> Par la présente, je vous mets en demeure de régler cette somme dans un
> délai de huit jours à compter de la réception de ce courrier. À défaut, les
> pénalités de retard et l'indemnité forfaitaire de 40 € pour frais de
> recouvrement prévues sur la facture seront dues, et je me réserve le droit
> de suspendre la licence et d'engager toute procédure utile.
>
> Je vous prie d'agréer, [Madame, Monsieur], l'expression de mes salutations
> distinguées.
>
> [Prénom Nom], Mirandola · [SIRET]

Pour un établissement public, le délai de paiement est de 30 jours et les
intérêts moratoires courent de plein droit ; une relance au service
gestionnaire (5.2) suffit presque toujours — le retard vient le plus souvent
d'un numéro d'engagement manquant sur Chorus Pro.

## 6. Modèles : les messages de vente

### 6.1 Réponse à une demande de démo

> Objet : Votre démo de Mirandola Campus
>
> Bonjour [Madame, Monsieur …],
>
> Merci pour votre demande. Votre espace de démonstration est ouvert pour
> [30] jours, avec [N] places et des classes d'exemple.
>
> Pour y entrer : créez votre compte sur mirandola.fr, puis « J'ai un code »,
> et saisissez votre code référent : [XXXX-XXXX] (valable une fois, 30
> jours). Vous y trouverez le code à donner aux professeurs et celui des
> élèves.
>
> Je vous propose un échange de vingt minutes pour vous montrer l'espace
> professeur et répondre à vos questions : quel créneau vous conviendrait ?
>
> Bien cordialement,
> [Prénom Nom], Mirandola

(La console écrit ce message pour toi : bouton « Écrire à … » de la fiche.)

### 6.2 Envoi du devis

Écrit par la console (« Écrire au contact » sur le devis ouvert) : le numéro,
le montant hors taxes, les places, la validité, et comment l'accepter.

### 6.3 Renouvellement (deux mois avant la fin)

> Objet : Votre licence Mirandola Campus se termine le [date]
>
> Bonjour [Madame, Monsieur …],
>
> La licence de [établissement] arrive à son terme le [date]. Cette année,
> [N] élèves et [N] professeurs s'en sont servis.
>
> Vous trouverez ci-joint le devis [D-AAAA-NNNN] pour l'année [AAAA-AAAA],
> aux mêmes conditions. Vous pouvez l'accepter en ligne, onglet Licence, ou
> m'adresser votre bon de commande. Les comptes, les classes et le travail de
> chacun sont conservés.
>
> Bien cordialement,
> [Prénom Nom], Mirandola

### 6.4 Avant de déposer sur Chorus Pro : la check-list

- le **SIRET** de l'établissement (quatorze chiffres) : c'est lui qui désigne
  le destinataire ;
- son **code service**, s'il en exige un (le gestionnaire le sait) ;
- son **numéro d'engagement** (le bon de commande), s'il en exige un ;
- la facture en PDF (« Imprimer ou PDF »), dont le numéro, la date et les
  montants sont ceux que tu saisis sur le portail ;
- ton IBAN sur la facture (rempli une fois dans **Entreprise**).

À la première commande, l'agent comptable peut te demander : un RIB, un avis
de situation au répertoire SIRENE (gratuit, sur le site de l'INSEE), et, pour
un marché de plus de 5 000 € HT, une attestation de vigilance de l'URSSAF.

### 6.5 Rétractation d'un abonné

> Objet : Votre rétractation
>
> Bonjour,
>
> Nous avons bien reçu votre demande de rétractation du [date] pour votre
> abonnement [Mirandola+ / Mirandola Infini]. Il est résilié, et vous êtes
> remboursé de [montant] € sur le moyen de paiement utilisé, sous quatorze
> jours au plus. Vos paquets restent à vous, dans Mirandola gratuit.
>
> Bien cordialement,
> Mirandola

## 7. Modèle : le livre des recettes

Un tableur, une ligne par encaissement, jamais effacée ni réécrite.

| Date d'encaissement | Référence | Client | Nature | Montant encaissé | Mode |
|---|---|---|---|---|---|
| 2026-12-02 | F-2026-0001 | Lycée Albert Camus | Licence Mirandola Campus, 300 places | 1 200,00 € | Virement |
| 2026-12-31 | Stripe, décembre 2026 (export joint) | Particuliers | Abonnements Mirandola+ et Infini | 412,31 € | Carte (Stripe) |

Pour les abonnements, une ligne par mois avec l'export de Stripe en pièce
jointe suffit, à condition de garder l'export (il détaille chaque paiement).
Le montant est ce que le client a payé, avant les frais de Stripe : les frais
ne se déduisent pas du chiffre d'affaires d'une micro-entreprise.

## 8. Modèles : les procédures RGPD

Mirandola traite des données d'élèves, dont des mineurs. Pour un particulier,
tu es **responsable du traitement** ; pour un établissement, tu es son
**sous-traitant** (le contrat est dans sa console).

### 8.1 Une demande d'exercice de droits (accès, effacement, portabilité)

1. Accuser réception sous 48 h ; répondre sous **un mois**.
2. Vérifier que la demande vient du titulaire (réponse à l'adresse du compte).
3. Accès et portabilité : l'utilisateur les a déjà dans l'app (Réglages →
   Mes données → Sauvegarde). Effacement : Réglages → supprimer mon compte ;
   ou, sur sa demande écrite, console de l'éditeur → Comptes → Supprimer.
4. Un élève d'établissement : transmettre la demande **à l'établissement**,
   qui décide (tu es son sous-traitant), et l'aider à l'exécuter.
5. Noter la demande et sa date de réponse dans un registre des demandes.

> Bonjour,
>
> Nous avons bien reçu votre demande du [date]. [Votre compte et toutes ses
> données ont été supprimés le [date]. / Vous trouverez vos données dans
> l'application : Réglages, Mes données, Sauvegarde.] Les sauvegardes
> chiffrées qui contiendraient encore ces données sont détruites sous 30
> jours.
>
> Vous pouvez saisir la CNIL si vous estimez que vos droits ne sont pas
> respectés.

### 8.2 Une violation de données (fuite, accès non autorisé, perte)

1. **Contenir** : couper l'accès en cause (suspendre un compte depuis la
   console, changer une clé — `supabase/REGLAGES.md`), garder les journaux.
2. **Évaluer** : quelles données, combien de personnes, des mineurs ?
3. **Notifier la CNIL sous 72 heures** si la violation présente un risque
   pour les personnes (téléservice de la CNIL) ; documenter dans tous les cas.
4. **Prévenir les établissements concernés sans délai** : c'est une
   obligation de ton contrat de sous-traitance, et c'est eux qui notifient
   pour leurs élèves.
5. **Informer les personnes** si le risque est élevé, en termes clairs : ce
   qui s'est passé, ce qui est touché, ce qu'elles doivent faire.
6. **Tenir le registre des violations** : date, nature, effets, mesures.

### 8.3 Le registre des traitements de l'éditeur

Une fiche par traitement : *comptes et révision* (B2C), *abonnements et
facturation*, *service aux établissements* (en sous-traitance), *statistiques
d'erreurs anonymes*, *prospection des établissements*. Pour chacune : la
finalité, la base légale, les données, les personnes, les destinataires
(Supabase, Vercel, Anthropic, Stripe, Brevo, Google), la durée, les mesures
de sécurité. La page de confidentialité de l'app contient déjà tout le
contenu : le registre en est la mise en tableau.

## 9. Ce qui reste hors de l'app, en clair

- Facturer un professeur particulier sans passer par une fiche
  d'établissement (§ 2, dernière remarque).
- Une relance de paiement envoyée d'un bouton (les modèles du § 5 se copient).
- Le livre des recettes exporté d'un clic (le § 7 se tient à la main ; les
  factures Campus sont peu nombreuses, Stripe exporte les siennes).
- La signature électronique qualifiée d'un devis : l'accord en ligne du
  référent (nom, fonction, date, bon de commande, journalisé) et le devis
  signé suffisent pour une commande de ce montant.
