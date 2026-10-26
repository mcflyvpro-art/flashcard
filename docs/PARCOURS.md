# Parcours, rôles et vente de Folio

Revu le 2026-10-26 (« un seul code »). Ce document dit **qui arrive
comment, qui gère quoi, où**. S'il diverge de l'app, c'est lui qu'on
corrige dans le même commit (CLAUDE.md, règle 0).

---

## 1. En trois phrases

- **Un particulier** s'inscrit et révise. Il ne voit rien d'une école :
  pas d'onglet « Classe ».
- **Un élève d'établissement** a **un code**. Il le tape, donne son prénom
  et son nom, choisit sa classe dans la liste : il est dedans. Personne n'a
  rien à valider ; la sécurité est dans le code (8 caractères au hasard,
  10 essais faux par heure, **renouvelé seul chaque semaine** — ou chaque
  mois, chaque trimestre, au choix du référent —, changeable à tout moment ;
  ceux qui sont entrés restent).
- **Un professeur particulier** a lui aussi **un code** : ses élèves le
  tapent, choisissent une de ses classes, c'est fait.

Plus jamais de code par classe : une classe a dix matières, dix codes
seraient ingérables.

---

## 2. Les rôles

| Rôle | Comment on le devient | Ce qu'il a |
|---|---|---|
| **Particulier** | s'inscrire | ses livres, le cercle, le journal |
| **Élève d'établissement** | le **code élève** de l'établissement + sa classe | « Ma classe » : devoirs, défis, ses professeurs ; son nom est figé |
| **Élève d'un prof particulier** | le **code du professeur** + une de ses classes | « Ma classe » ; il reste un compte personnel |
| **Professeur d'établissement** | le **code professeur** de l'établissement | l'espace professeur : il **choisit ses classes** dans la liste, forme des **groupes** en sélectionnant des élèves |
| **Professeur particulier** | sur demande à Folio (rôle donné depuis la console) | son code, ses classes, ses élèves |
| **Référent** | le **code référent** que Folio lui envoie (une seule fois, 30 jours) | la console de l'établissement |
| **Éditeur** | toi | la console d'administration |

Un élève appartient à **un** établissement, et à **une** classe dedans (la
même pour tous ses camarades) ; il peut en plus être dans des **groupes**
(spécialités, options) et chez des **professeurs particuliers**.

**Le nom « Prénom NOM » est figé à l'entrée** : seul le référent le corrige.

---

## 3. Le particulier (B2C)

1. Il s'inscrit (e-mail, mot de passe, « j'ai 15 ans ou plus »).
2. L'accueil en quelques écrans, chacun passable (« Passer » en haut) :
   « Je révise pour moi » ou « **J'ai un code** » ; son prénom et un pseudo
   (proposé depuis le prénom) ; son visage parmi six (« D'autres ») ; son
   niveau et ses matières (elles remplacent les matières d'exemple) ; un
   objectif de pages par jour. Puis la visite guidée.
   Un élève entré par son établissement ou avec une carte : seulement son
   visage, puis ses classes.
3. Il arrive sur ses **Livres**. Barre : Livres, Cercle — pas de Classe.
4. Le jour où on lui donne un code : **Réglages → J'ai un code**. « Classe »
   apparaît dès qu'il est entré.

**Payer** : pas de Stripe. L'app sera publiée sur l'App Store et Google
Play (Capacitor) ; un abonnement s'y vend par l'achat intégré d'Apple et de
Google, qui gèrent paiement, factures et résiliation. Ce qui est gratuit et
ce qui sera payant reste à décider avec toi au moment de Capacitor.

---

## 4. L'établissement (B2B), de la prospection au déploiement

### 4.1 Prospection

- Un établissement **demande une démo** (formulaire sans compte : nom de
  l'établissement, ville, contact, fonction, e-mail, nombre d'élèves,
  message), depuis le lien « Un établissement ? Demander une démo » de
  l'écran de connexion. La demande arrive dans ta console, étape
  **Prospect**, en tête de liste et comptée dans « demandes ».
- Ou tu crées toi-même la fiche après un salon, un appel : **Nouvel
  établissement**.
- Sur la fiche : contact, besoins (devoirs, révision autonome, IA, défis…),
  budget, élèves estimés, prix convenu, notes, date de relance.

### 4.2 Démo

**Lancer la démo**, en un geste : licence de 30 jours pour 60 élèves (à
régler), des **classes d'exemple** (2nde A, 1re B, Tle C), et un **code
référent** à envoyer au contact — « Écrire à … » ouvre ta messagerie avec
le message tout écrit (le code, la marche à suivre, sa date de fin). Étape :
**Démo**.

Le référent tape son code : il est référent, les classes d'exemple sont là,
il trouve dans sa console le code élève et le code professeur à distribuer
à une classe pilote. Tout est réel : rien à refaire en passant en licence.

Il y a aussi une **démo sans compte** (« Essayer sans compte », sur l'écran
de connexion et sous le formulaire de démo) : le **Lycée Démo Folio**,
établissement fictif, où l'on entre comme élève (Léa MARTIN, 2nde B et le
groupe Spé maths, trois devoirs), professeur (Marc DURAND, ses classes, son
groupe, le code de l'établissement) ou référent (Claire ROUX, les codes, la
licence et ses factures, les classes, les élèves, les professeurs, le journal). C'est
la vraie app, au téléphone comme sur ordinateur, et tout s'y fait : donner
un devoir, le lire en tant qu'élève, écrire à la classe, créer une classe,
regarder son journal ou le classement des amis. Rien n'est créé en base,
rien ne part : chaque visiteur a son lycée à lui, dans son onglet
(rafraîchir le garde, fermer l'onglet l'efface). Ce qui coûte — l'IA, les
photos, les fichiers, les images et les sons — est grisé et le dit. Un
bandeau change de rôle en un geste (ce que Marc donne, Léa le reçoit),
« Quitter » ramène à la connexion — pour montrer Folio en rendez-vous, ou se
faire une idée.

### 4.3 Licence

**Passer en licence** : nombre de places, date de fin, prix annuel. Étape :
**Client**. Proposition de prix : 3 € HT par place et par an, 300 € HT
minimum. **Une place par élève ET par professeur** (décidé le 2026-10-26 :
« même licence peu importe ») ; le référent n'en prend pas. Un établissement
public paie sur bon de commande et reçoit ses factures par **Chorus Pro**
(obligatoire pour le secteur public). Le contrat comprend des **conditions
générales de vente** et un **contrat de sous-traitance** RGPD (art. 28) :
l'établissement est responsable du traitement, Folio sous-traitant ; le
référent les lit et les imprime dans son onglet Licence, avec la fiche à
reporter dans le registre des traitements de son établissement.

- **Places** : un élève ou un professeur entré prend une place — par le
  code, par un compte que le référent ouvre lui-même (« Ajouter un
  professeur »), par une carte élève ; licence pleine → le code dit
  « l'établissement n'a plus de place » ; le référent le voit et sait quoi
  faire : demander des places (onglet Licence → « Des places ») ou retirer
  les comptes partis.
- **D'une année à l'autre** : un élève qui quitte le lycée, un professeur
  muté — le référent le **retire de l'établissement** (sa fiche → « Retirer
  de l'établissement ») : sa place se libère ; son compte et ses livres
  restent, à lui.
- **Factures** : tu les émets depuis la fiche de l'établissement
  (Facturation → « Émettre une facture » : la ligne de la licence est
  proposée à son prix). Elles sont numérotées sans trou (F-2026-0001…),
  portent toutes les mentions obligatoires et ne se modifient plus jamais :
  une erreur se corrige par un **avoir** (A-2026-0001…). Tu marques
  « Déposée sur Chorus Pro » puis « Payée ». Le référent voit chacune dans
  son onglet Licence, avec ce qui reste à régler, et l'imprime ou la garde
  en PDF.
- **Échanges** : le référent t'écrit depuis son onglet Licence (des places,
  le renouvellement, une facture, une question) ; tu vois « message » dans ta
  liste et tu réponds dans la fiche.
- **Fin de licence** : les codes ne font plus entrer personne. Rien n'est
  supprimé.
- Un prospect ou une démo jamais ouverte s'efface (son contact avec) ; un
  établissement qui a des comptes passe « en pause » ou « perdu ».

### 4.4 Déploiement

1. Le référent crée ses classes (ou garde les classes d'exemple renommées).
2. Il donne le **code professeur** en salle des profs : chaque professeur
   entre, puis choisit ses classes.
3. Il donne le **code élève** (affiche avec QR, ENT, en classe) : chaque
   élève entre et choisit sa classe.
4. Il corrige ce qui doit l'être : un nom, un élève dans la mauvaise classe.

**Les cartes élève** (comptes créés depuis une liste, sans e-mail, QR
imprimé) restent possibles mais **cachées** : c'est le cas très particulier
d'élèves qui n'ont pas d'e-mail (jeunes collégiens). Le référent les trouve
dans un recoin de sa console, avec l'explication.

---

## 5. Qui gère quoi, et où

| Je veux… | Qui | Où |
|---|---|---|
| voir tous les établissements, où ils en sont | toi | Administration → Établissements |
| créer une fiche, noter un besoin, une relance | toi | idem → Nouvel établissement / la fiche |
| lancer une démo, passer en licence | toi | la fiche |
| renvoyer un code référent | toi | la fiche |
| distribuer, changer le code élève ou professeur, choisir son rythme | référent | Mon établissement → Accueil |
| voir sa licence, ses factures, écrire à Folio, lire le contrat | référent | Mon établissement → Licence |
| ajouter un professeur, retirer un compte parti | référent | Mon établissement → Professeurs / Élèves |
| émettre une facture, un avoir, répondre à un établissement | toi | la fiche → Facturation |
| ton identité de vendeur (SIRET, TVA, IBAN) | toi | Administration → Entreprise |
| créer, renommer une classe | référent | Mon établissement → Classes |
| corriger un nom, changer un élève de classe | référent | Mon établissement → Élèves |
| choisir ses classes, former un groupe | professeur | son espace |
| donner son code à ses élèves | professeur particulier | son espace |
| entrer dans son établissement ou chez son professeur | élève | Réglages → J'ai un code, ou au premier écran |

**Respect** : l'éditeur ne voit jamais le contenu d'un élève (ni ses
fiches, ni ses réponses, ni son courrier) — des comptages, des dates, des
coûts. Le suivi commercial (budget, notes) n'est lisible que par toi.

---

## 6. Ce qui reste de ton côté

- **Mentions légales** : remplacer les ⟦crochets⟧ (éditeur, contact,
  hébergeur) — `src/editeur.js` et `src/ui/legal-textes.js`.
- **Prix B2B** : 3 € HT par place et par an est une proposition.
- **Ton entreprise** (Administration → Entreprise) : raison sociale et
  forme (« EI » pour un entrepreneur individuel), adresse, SIRET,
  immatriculation, IBAN. Sans elle, aucune facture ne part.
- **La TVA** : un établissement public ne récupère pas la TVA ; en
  **franchise en base** (art. 293 B du CGI, le régime d'une
  micro-entreprise sous son plafond de chiffre d'affaires), tes factures sont
  hors TVA et ton prix est le plus bas possible pour eux. C'est le statut
  le plus intéressant pour commencer ; au-delà du plafond, passe en
  « Assujetti » (20 %). À valider avec un comptable : les plafonds bougent.
- **Chorus Pro** : crée ton compte fournisseur (chorus-pro.gouv.fr) et
  dépose-y chaque facture d'un établissement public (le PDF imprimé depuis
  la pièce) ; la facturation électronique entre entreprises deviendra
  obligatoire pour les petites entreprises en septembre 2027.
- **Conditions générales de vente et contrat de sous-traitance** : à faire
  relire par un juriste avant la première vente.
- **Offre payante B2C** : à décider au moment de Capacitor (achats
  intégrés Apple et Google).
