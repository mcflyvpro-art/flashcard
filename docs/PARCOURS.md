# Parcours, rôles et vente de Mirandola

Revu le 2026-10-26 (« un seul code »), puis le 2026-10-29 (le professeur
particulier en licence, sa salle d'attente, les comptes ouverts par
l'éditeur et le référent ; la carte élève n'existe plus). Ce document dit
**qui arrive comment, qui gère quoi, où**. S'il diverge de l'app, c'est lui qu'on
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
- **Un professeur particulier** a un compte que Mirandola lui ouvre, avec
  une **licence** (X places d'élèves, l'IA du mois) et **un code** : ses
  élèves créent leur propre compte, tapent le code et passent dans sa
  **salle d'attente** ; il vérifie le prénom et le nom, et les accepte (ou
  les refuse : la place revient).

Plus jamais de code par classe : une classe a dix matières, dix codes
seraient ingérables.

---

## 2. Les rôles

| Rôle | Comment on le devient | Ce qu'il a |
|---|---|---|
| **Particulier** | s'inscrire | ses livres, le cercle, le journal |
| **Élève d'établissement** | le **code élève** de l'établissement + sa classe | « Ma classe » : devoirs, défis, ses professeurs ; son nom est figé |
| **Élève d'un prof particulier** | son propre compte, puis le **code du professeur** + une de ses classes : **salle d'attente**, puis accepté | « Ma classe », Mirandola Campus dès la salle d'attente ; il reste un compte personnel |
| **Professeur d'établissement** | le **code professeur** de l'établissement | l'espace professeur : il **choisit ses classes** dans la liste, forme des **groupes** en sélectionnant des élèves |
| **Professeur particulier** | Mirandola ouvre son compte (Administration → Comptes → « Compte ») avec sa licence ; mot de passe provisoire à changer à la première connexion | son code, ses classes, sa salle d'attente, ses places (et en commander) |
| **Référent** | le **code référent** que Mirandola lui envoie (une seule fois, 30 jours) | la console de l'établissement ; il ouvre aussi les comptes de ses professeurs et de ses élèves (adresse + mot de passe provisoire) |
| **Éditeur** | toi | la console d'administration |

Un élève appartient à **un** établissement, et à **une** classe dedans (la
même pour tous ses camarades) ; il peut en plus être dans des **groupes**
(spécialités, options) et chez des **professeurs particuliers**.

**Le nom « Prénom NOM » est figé à l'entrée** : seul le référent le corrige
(chez un professeur particulier, lui).

**Un compte ouvert par quelqu'un d'autre** (l'éditeur, le référent) a un
**mot de passe provisoire**, montré une seule fois à qui l'a ouvert, avec
le message tout écrit à envoyer : à la première connexion, l'app ne montre
que « Choisis ton mot de passe » ; ensuite seulement son espace et son tuto.
**Plus de carte élève** (2026-10-28) : chaque élève a une adresse e-mail —
personnelle, de l'établissement, peu importe.

---

## 3. Le particulier (B2C)

1. Il s'inscrit (e-mail, mot de passe, « j'ai 15 ans ou plus »).
2. L'accueil en quelques écrans, chacun passable (« Passer » en haut) :
   « Je révise pour moi » ou « **J'ai un code** » ; son prénom et un pseudo
   (proposé depuis le prénom, vérifié pendant la frappe : la règle, puis la
   base dit s'il est libre) ; **son visage, composé trait par trait** (rien
   au hasard : peau, coiffure — hijab et turban compris —, cheveux,
   sourcils, yeux, barbe, lunettes, bijoux, chapeau, tenue, fond…) ; **son
   niveau puis son année** (ou sa filière) ; **ses matières : celles de son
   année déjà cochées**, d'autres à côté, et les siennes qu'il écrit à la
   main (elles remplacent les matières d'exemple) ; un objectif de pages par
   jour. Un titre par écran, sans phrase dessous (2026-10-29). Puis **le
   tuto** (§ 3 bis).
   « J'ai un code » s'ouvre par-dessus l'accueil : entré, il reprend en élève
   de sa classe. Chez un professeur particulier, il passe d'abord en salle
   d'attente (« Demande envoyée ») : Mirandola Campus s'ouvre tout de suite,
   son tuto finit sur « Tout est prêt », pas sur Mirandola+. Refusé, il
   retombe en Mirandola gratuit et un mot de son professeur lui dit de
   vérifier son prénom et son nom, puis de recommencer. Un élève entré par son établissement : son
   lycée et sa classe pour l'accueillir, son pseudo (son nom de classe,
   « Prénom NOM », s'affiche à côté, fixe), son visage, puis son tuto.
   **Les pseudos** (2026-10-27) : tout compte en a un, donné d'office par la
   base (le prénom, sinon « lecteur », et des chiffres s'il est pris) ; 3 à
   20 caractères, minuscules, chiffres, point, tiret bas, une lettre en tête,
   ni mot réservé (« admin », « prof », « folio »…) ni grossier ; unique au
   point et au tiret bas près ; deux changements par semaine ; un pseudo
   quitté reste 30 jours à son ancien titulaire. Il se change dans les
   Réglages (ligne « Pseudo ») ou « Mon jeton » du cercle, pour tous les
   comptes. Un élève de classe garde « Prénom NOM » en classe ; son pseudo
   sert ailleurs (amis, défis hors de sa classe).
3. Il arrive sur ses **Livres**. Barre : Livres, Cercle — pas de Classe.
4. Le jour où on lui donne un code : **Réglages → J'ai un code**. « Classe »
   apparaît dès qu'il est entré.

### 3 bis. Le tuto de première connexion (2026-10-27)

Un guide qui **fait faire**, sur le vrai écran et le vrai compte : un trou
de lumière sur ce qu'il faut toucher, une bulle d'une phrase. Il présente
l'app pas à pas, dans l'ordre où on la découvre. Rien ne le contourne :
seul ce que l'étape montre répond (un appui à côté, la croix d'une
feuille, « Créer un nouveau livre » pendant qu'on choisit un livre ne font
rien), et le retour du navigateur ramène à l'étape. On le quitte par la
croix, « Passer » ou Échap ; il se rejoue des Réglages (« Revoir le tuto »).

- **L'élève** (particulier, ou d'une classe), à la fin de son accueil : ses
  livres (ou le premier qu'il crée : le tuto l'écrit sous ses yeux, sans
  ouvrir le clavier — le titre, « 1789 » au recto, « Prise de la Bastille »
  au verso, puis deux pages de plus, tirées de l'histoire s'il l'a choisie
  ou d'une autre de ses matières) ; une flashcard qu'il lit, retourne et note ;
  comment créer un livre (les cinq façons) ; son journal ; sa classe et ses
  devoirs, s'il en a une ; ses amis (ses camarades) ; son courrier. La fin
  présente **Mirandola+** (« Découvrir Mirandola+ » ouvre les tarifs), sur
  ses Livres : « Terminer » l'y laisse.
- **Le professeur**, à sa première connexion, pas à pas dans un espace qui
  est grand : son code ; sans classe, il choisit les siennes (établissement)
  ou crée la sienne (particulier) ; son tableau de bord, « À traiter », une
  classe, son suivi, un élève et sa fiche, les devoirs, un devoir qu'il
  donne pour de vrai (le livre, puis « Donner » ; « Plus tard » s'il ne
  veut pas encore), le bilan, le défi en direct, l'agenda, ses livres, son
  courrier. « Tout est prêt ».
- **Le référent** : ses deux codes, sa licence, puis sur ordinateur les
  onglets Classes, Élèves, Professeurs, Licence, Historique (au téléphone,
  les codes et la licence). « Tout est prêt ».
- **L'éditeur** : rien.

Au téléphone la bulle prend toute la largeur, sous ou sur ce qu'on montre ;
sur ordinateur elle se pose à côté, et dit « Clique sur » plutôt que
« Touche ».

**Au téléphone** (2026-10-28) : Mirandola ne s'ouvre que depuis l'écran
d'accueil. Dans le navigateur, la porte d'installation montre le geste
(Partager, Sur l'écran d'accueil ; sur Android, « Installer Mirandola » en un
geste), puis on ouvre Mirandola par son icône et l'on s'y connecte. Pas de
magasin : Capacitor reste en réserve.

**Payer** : Mirandola+ se paie par Stripe, dans le navigateur de l'ordinateur
comme dans l'app posée sur l'écran d'accueil (docs/VENTE.md). Ce que
chaque offre ouvre est dans `src/offres.js`.

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
de connexion et sous le formulaire de démo) : le **Lycée Démo Mirandola**,
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
« Quitter » ramène au site — pour montrer Mirandola en rendez-vous, ou se faire
une idée. La première fois qu'on prend un rôle, **son tuto** se joue (entrer
en élève puis passer en professeur donne l'un puis l'autre ; revenir à
l'élève ne le rejoue pas) ; « Tuto », dans le bandeau, le rejoue ;
il finit sur Mirandola+ pour l'élève (« Créer mon compte ») et sur Mirandola Campus
pour le professeur et le référent (« Essayer dans mon établissement »).

### 4.3 Licence

**Passer en licence** : nombre de places, date de fin, prix annuel. Étape :
**Client**. Prix (2026-10-28) : de 5 à 2 € HT par place et par an, dégressif par tranches (`src/tarifs.js`), 100 € HT
minimum. **Une place par compte : élève, professeur ET référent** (décidé le
2026-10-26 pour les deux premiers, le 2026-10-28 pour le référent).
**L'IA** : un nombre de générations par mois et par professeur, et par
élève (400 et 30 d'office), réglé dans la fiche (tuile « IA par mois ») ; la
console dit aussitôt ce que cela peut coûter au plus (le coût moyen d'une
génération, mesuré sur 90 jours, fois tout ce qui est accordé). Un établissement
public paie sur bon de commande et reçoit ses factures par **Chorus Pro**
(obligatoire pour le secteur public). Le contrat comprend des **conditions
générales de vente** et un **contrat de sous-traitance** RGPD (art. 28) :
l'établissement est responsable du traitement, Mirandola sous-traitant ; le
référent les lit et les imprime dans son onglet Licence, avec la fiche à
reporter dans le registre des traitements de son établissement.

- **Places** : un élève, un professeur ou un référent entré prend une
  place — par le code, ou par un compte que le référent ouvre lui-même
  (« Ajouter un professeur », « Ajouter des élèves ») ; licence pleine → le code dit
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
2. Les professeurs : le **code professeur** en salle des profs (chacun entre,
   puis choisit ses classes), ou leur compte ouvert par le référent
   (« Ajouter un professeur » : adresse et mot de passe provisoire).
3. Les élèves : le **code élève** (affiche avec QR, ENT, en classe : chacun
   entre et choisit sa classe), ou leurs comptes ouverts d'un coup par le
   référent — Élèves → « Ajouter des élèves » : une classe, puis une ligne
   par élève (« MARTIN Alice ; alice.martin@lycee.fr », copiée d'un tableur
   ou de Pronote). Chacun reçoit un mot de passe provisoire (la liste se
   copie pour un tableur ou s'imprime, une seule fois) et arrive directement
   dans sa classe ; il change son mot de passe à sa première connexion.
4. Il corrige ce qui doit l'être : un nom, un élève dans la mauvaise classe.

### 4.5 Le professeur particulier (2026-10-29)

1. **Tu ouvres son compte** : Administration → Comptes → « Compte » →
   Professeur particulier, son prénom, son nom, son adresse ; un mot de
   passe provisoire est proposé. Sa **licence** dans le même formulaire :
   places d'élèves (30 d'office), IA du professeur et par élève par mois,
   fin (vide : sans fin) ; le coût de l'IA au plus et le prix de la grille
   se calculent pendant la saisie. « Ouvrir le compte » : l'adresse et le
   mot de passe s'affichent une fois, avec « Écrire à … » (le message tout
   écrit dans ta messagerie) ou « Copier le message ».
2. **Il se connecte** sur mirandola.fr (au téléphone, Mirandola lui montre
   d'abord comment l'installer), choisit son mot de passe, puis son tuto.
3. **Il crée sa classe** et donne son **code** (en tête de son accueil,
   avec ses places : « 3/30 élèves · 1 en attente · 26 libres » ; « Ajouter
   des élèves » montre le QR).
4. **Ses élèves** ouvrent mirandola.fr (le QR y mène ; au téléphone,
   l'installation d'abord), **créent leur propre compte**, et, à leur
   accueil, « J'ai un code » : le code, leur prénom et leur nom, sa classe.
   Ils sont en **salle d'attente** : une place est réservée, Mirandola Campus
   est déjà ouvert ; l'élève attend sur son accueil (« En attente de … »,
   « Annuler ma demande »). Un code tapé sur le site avant d'avoir un compte
   l'attend une heure : connecté, l'accueil s'ouvre sur le prénom, le nom et
   la classe.
5. **Il accepte** dans la classe → onglet **Demandes** (« Accepter », « Tout
   accepter ») — il voit l'élève arriver sans recharger (« Un élève attend
   votre validation ») : l'élève est dans la classe, la place reste prise,
   et son accueil continue de lui-même (pseudo, visage), puis le tuto de la
   classe, sans Mirandola+ à la fin. Un nom faux ou inconnu : **Refuser** —
   la place revient, l'élève revient au choix « Je révise pour moi / J'ai un
   code », retombe en Mirandola gratuit et reçoit un mot (« vérifie ton
   prénom et ton nom, puis entre de nouveau son code »). Bloquer l'empêche
   de redemander.
6. **Plus de place** : le code dit « Ton professeur n'a plus de place ». Il
   touche ses places → « Commander des places » (combien, un mot) : tu vois
   « places demandées » en haut de ta console et dans sa fiche, où la
   licence se change en un geste (la demande est alors traitée).

---

## 5. Qui gère quoi, et où

| Je veux… | Qui | Où |
|---|---|---|
| voir tous les établissements, où ils en sont | toi | Administration → Établissements |
| créer une fiche, noter un besoin, une relance | toi | idem → Nouvel établissement / la fiche |
| lancer une démo, passer en licence | toi | la fiche |
| renvoyer un code référent | toi | la fiche |
| ouvrir le compte d'un professeur particulier, sa licence, un mot de passe oublié | toi | Administration → Comptes → « Compte » / sa fiche |
| régler l'IA d'un établissement (par professeur, par élève) | toi | la fiche → IA par mois |
| voir ses places, en commander, accepter ou refuser un élève | professeur particulier | son espace (bandeau du code, onglet Demandes d'une classe) |
| distribuer, changer le code élève ou professeur, choisir son rythme | référent | Mon établissement → Accueil |
| voir sa licence, ses factures, écrire à Mirandola, lire le contrat | référent | Mon établissement → Licence |
| ajouter un professeur, ouvrir les comptes des élèves, retirer un compte parti | référent | Mon établissement → Professeurs / Élèves |
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
- **Prix B2B** : la grille dégressive de `src/tarifs.js` (2026-10-28).
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
