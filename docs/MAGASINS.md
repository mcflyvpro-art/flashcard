# Mirandola sur l'App Store et Google Play

Tout ce qu'il reste à faire **à la main** pour publier l'app native
(2026-11-16). Le code, les projets iOS et Android, les icônes, les images
des fiches et la compilation sont prêts dans le dépôt (`docs/CAPACITOR.md`
dit comment ils sont faits). Ce fichier suit l'ordre où on le fait.

L'app web et l'app de l'écran d'accueil ne changent pas : l'app native est
une troisième façon d'ouvrir le même Mirandola, sur le même compte.

## 0. Les identifiants, une fois pour toutes

| Quoi | Valeur |
|---|---|
| Identifiant de l'app (iOS « Bundle ID », Android « package ») | `fr.mirandola.app` |
| Nom affiché sous l'icône | Mirandola |
| Version | `1.0.0` ; le numéro de build suit le numéro de la compilation de GitHub (`MIRANDOLA_VERSION_CODE` = `run_number`) |
| Domaine des liens | `mirandola.fr` (et `www.`) |
| Produits Apple | `mirandola_plus_annuel`, `mirandola_plus_mensuel`, `mirandola_infini_annuel`, `mirandola_infini_mensuel` |
| Abonnements Google | `mirandola_plus` et `mirandola_infini`, chacun avec deux offres de base, `annuel` et `mensuel` |
| Droit RevenueCat (« entitlement ») | `plus` (les quatre produits) |

**Pourquoi ces noms** : l'app et la fonction `magasins` reconnaissent la
formule au nom du produit (`paquetDe` de `src/magasin.js`,
`formuleDuProduit` de `supabase/functions/_shared/abonnement.js`) : le mot
« infini » fait Mirandola Infini, « annuel » ou « mensuel » la période. Un
produit Infini mal nommé serait vendu… et lu comme Mirandola+.

## 1. Les comptes (une fois)

**D'abord l'entreprise** (`docs/ENTREPRISE.md`) : vendre dans un magasin,
c'est vendre, et les fiches affichent qui vend. Une micro-entreprise (une
entreprise individuelle) n'est pas une « organisation » pour Apple ni, en
pratique, pour Google : les deux comptes s'ouvrent **à ton nom**, et c'est
« Samuel François » qui s'affiche comme vendeur. Le nom « Mirandola » comme
vendeur, et un compte Google sans la règle des 12 testeurs, viendront avec la
SASU (numéro D-U-N-S à son nom, gratuit, une semaine environ ; Apple convertit
un compte individuel en organisation sur demande).

**Ce qui s'affiche en public (corrigé le 2026-11-17)** : pour vendre dans
l'Union européenne, Apple publie sur la fiche une **adresse** (ou une boîte
postale), un **téléphone** et une **adresse e-mail** (le règlement sur les
services numériques, « trader status ») ; Google affiche aussi des
coordonnées pour une app payante. Une domiciliation (10 à 30 € par mois) et
un numéro à part évitent d'y mettre son domicile et son portable.

1. **Apple Developer Program** : 99 $ par an, en « Individual » (souvent
   validé dans la journée). Puis, dans App Store Connect, l'accord **« Paid
   Apps »** (banque, fiscalité) — sans lui, aucun abonnement ne se vend —,
   le statut de commerçant (ci-dessus) et la demande du **Small Business
   Program** (15 % de commission au lieu de 30 %).
2. **Google Play Console** : 25 $ une fois, compte **personnel** (pièce
   d'identité vérifiée, quelques jours). Un compte personnel créé après le
   13 novembre 2023 doit faire tester l'app par **12 personnes pendant
   14 jours d'affilée** (test fermé) avant de demander la publication :
   prévoir 12 comptes Google d'amis, de proches ou d'élèves volontaires
   (majeurs ou avec l'accord d'un parent) qui gardent l'app installée deux
   semaines. Puis le **profil de paiement** (pour vendre) ; la commission
   est de 15 % sur les abonnements.
3. **RevenueCat** : gratuit jusqu'à 2 500 $ de revenu par mois. Il vérifie
   les achats auprès d'Apple et de Google et prévient la base.

## 2. Apple

1. **Certificates, Identifiers & Profiles → Identifiers** : créer l'App ID
   `fr.mirandola.app` avec les capacités **Associated Domains** et
   **In-App Purchase**. (« Sign in with Apple » n'est pas utile : l'app
   native ne propose aucune connexion par un tiers, la règle 4.8 ne
   s'applique pas.)
2. **App Store Connect → Apps → +** : nouvelle app, iOS, nom
   « Mirandola : flashcards et IA », langue principale Français, Bundle ID
   `fr.mirandola.app`, SKU `mirandola`.
3. **Abonnements** : un groupe « Mirandola » ; dedans, du plus haut au plus
   bas niveau (l'ordre des niveaux permet de monter et descendre au prorata) :
   - niveau 1 : `mirandola_infini_annuel` (79,99 €), `mirandola_infini_mensuel` (9,99 €) ;
   - niveau 2 : `mirandola_plus_annuel` (44,99 €), `mirandola_plus_mensuel` (5,99 €).

   Les prix sont ceux de `FORMULES` (`src/abonnement.js`) ; Apple propose
   ses paliers, prendre le plus proche (l'app affiche le prix que dit
   Apple, jamais celui du site). **L'essai de 7 jours** : une « offre de
   lancement » gratuite d'une semaine sur les deux produits Mirandola+
   seulement (pas d'essai pour Infini, décidé le 2026-11-08). Le code
   `LANCEMENT` du site n'existe pas dans les magasins (l'app ne le montre
   pas en mode magasin).
4. **Clé d'achats intégrés** (Users and Access → Integrations → In-App
   Purchase) : la télécharger, puis la donner à RevenueCat.
5. **La compilation envoyée par GitHub** (facultatif, mais c'est le plus
   simple sans Mac) : Users and Access → Integrations → **App Store Connect
   API** → une clé « App Manager ». Poser dans GitHub (Settings → Secrets and
   variables → Actions → **Secrets**) :
   - `APPLE_TEAM_ID` (10 signes, Membership details),
   - `APP_STORE_CONNECT_KEY_ID`, `APP_STORE_CONNECT_ISSUER_ID`,
   - `APP_STORE_CONNECT_KEY_P8` (le contenu du fichier `.p8`, en entier).

   Puis Actions → **App des magasins** → *Run workflow*, case
   **« publier »** cochée : la compilation part sur TestFlight (Xcode signe
   lui-même avec la clé d'API ; aucun certificat à gérer).

## 3. Google

1. **Créer l'app** : nom « Mirandola : flashcards et IA », langue Français,
   app, gratuite (avec achats intégrés).
2. **La clé de téléversement** (une fois, sur une machine à soi, et à garder
   précieusement avec ses mots de passe) :

   ```sh
   keytool -genkeypair -v -keystore mirandola-televersement.jks -alias mirandola \
     -keyalg RSA -keysize 4096 -validity 10000
   base64 -w0 mirandola-televersement.jks   # sur Mac : base64 -i …
   ```

   Secrets GitHub : `ANDROID_KEYSTORE_BASE64` (la sortie de `base64`),
   `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` (`mirandola`),
   `ANDROID_KEY_PASSWORD`. Google signe l'app distribuée avec sa propre clé
   (Play App Signing) : la nôtre ne sert qu'à prouver qui téléverse.
3. **Le premier envoi** : Actions → App des magasins → la dernière
   compilation → l'artefact **android-publication** (`app-release.aab`), à
   déposer dans *Tester → Tests internes* (tests internes : jusqu'à 100
   personnes, sans examen). Les suivants peuvent partir de la même façon.
4. **Abonnements** (Monétiser → Abonnements ; ils ne se créent qu'après un
   premier envoi d'un `.aab` qui contient la facturation) :
   `mirandola_plus` (offres de base `annuel`, `mensuel`, renouvellement
   automatique) avec une offre d'essai gratuit de 7 jours pour les nouveaux
   clients ; `mirandola_infini` (`annuel`, `mensuel`, sans essai).
5. **Un compte de service** pour RevenueCat (Google Cloud → IAM → compte de
   service, puis Play Console → Utilisateurs et autorisations : « Voir les
   données financières », « Gérer les commandes et abonnements »). La
   marche à suivre exacte est dans la documentation de RevenueCat (« Google
   Play service credentials »).

## 4. RevenueCat et la base

1. Un projet, une app **App Store** (Bundle ID, clé d'achats intégrés) et une
   app **Play Store** (package, compte de service).
2. **Produits** : importer les quatre de chaque magasin. **Droit** `plus`
   qui les reçoit tous. **Offre** (« offering ») `default`, courante, avec
   quatre paquets : `$rc_annual` → Mirandola+ annuel, `$rc_monthly` →
   Mirandola+ mensuel, et deux paquets personnalisés `infini_annuel`,
   `infini_mensuel`. (L'app reconnaît aussi un paquet à son nom de produit :
   l'important est que chaque produit Infini dise « infini ».)
3. **Les clés publiques** de l'app (`appl_…`, `goog_…`) dans `REVENUECAT`
   (`src/abonnement.js`) : publiques par nature, comme la clé anon. Tant
   qu'elles sont vides, l'écran Mirandola+ de l'app native répond « Le
   paiement ouvre bientôt » au lieu de vendre.
4. **La clé secrète** (`sk_…`, API v1) dans le secret `RC_SECRET` de
   Supabase (Edge Functions → Secrets), jamais dans le dépôt.
5. **Le webhook** : URL
   `https://qqbzefpdeinlynjtarqr.supabase.co/functions/v1/magasins`,
   en-tête d'autorisation : `Bearer ` suivi de 40 signes au hasard, recopié
   tel quel dans le secret `RC_WEBHOOK_AUTH`.
6. **Redéployer la fonction `magasins`** (avec `_shared/abonnement.js`, qui
   reconnaît Infini depuis le 2026-11-16) :
   `npx supabase functions deploy magasins --project-ref qqbzefpdeinlynjtarqr --use-api --no-verify-jwt --yes`,
   puis `node tools/paiement/essai.js`.

## 5. Les liens qui ouvrent l'app

Un lien `https://mirandola.fr/…` (une classe, un défi, un club, un e-mail)
ouvre l'app installée au lieu du navigateur. Il faut les vrais identifiants,
**pas avant** : un fichier faux fait échouer la vérification, qu'Apple et
Google gardent en cache.

```sh
node tools/natif/liens.js --equipe ABCDE12345 --empreinte AA:BB:…:FF
```

- `--equipe` : l'identifiant d'équipe Apple ;
- `--empreinte` : l'empreinte SHA-256 de **la clé de signature de Google**
  (Play Console → Tester et publier → Intégrité de l'app → *Signature de
  l'application*), et, en plus, celle de la clé de téléversement si l'on
  veut que les APK de test l'ouvrent aussi (`--empreinte` se répète).

Le script écrit `public/.well-known/apple-app-site-association` et
`assetlinks.json` et ajoute l'en-tête `application/json` à `vercel.json`.
Committer, pousser sur `main`, vérifier :
`curl -sI https://mirandola.fr/.well-known/apple-app-site-association`.
Les chemins qui ouvrent l'app sont ceux de `CHEMINS_APP` (`src/natif.js`) :
le site (`/tarifs`, `/moteur`…) reste dans le navigateur.

## 6. Les fiches

Tout est prêt dans `marque/magasins/` :

- `app-store-icone-1024.png`, `google-play-icone-512.png`,
  `google-play-banniere-1024x500.png` (refaits par
  `node tools/natif/ressources.js`) ;
- `captures/iphone/` (1320 × 2868, la taille 6,9 pouces qu'Apple exige),
  `captures/ipad/` (2064 × 2752, 13 pouces : l'app tourne aussi sur iPad),
  `captures/android/` (1080 × 1920) : cinq écrans de la démo, un titre
  dessus (`node tools/natif/captures.js`, sur le build : il lance lui-même
  `vite preview`).

Les textes (longueurs vérifiées) :

| Champ | Texte |
|---|---|
| Nom (30 au plus) | Mirandola : flashcards et IA |
| Sous-titre Apple (30) | Révise moins, retiens tout |
| Mots-clés Apple (100, sans espace après les virgules) | `révision,mémoriser,répétition espacée,fiches,flashcard,bac,brevet,prépa,quiz,cours,examen,FSRS` |
| Description courte Google (80) | Flashcards, IA et répétition espacée : révise moins, retiens tout. |
| Catégorie | Éducation |
| Site, assistance | `https://mirandola.fr/`, `mailto:contact@mirandola.fr` |
| Confidentialité | `https://mirandola.fr/mentions/confidentialite` |
| Conditions (Apple : « EULA » personnalisée, ou lien dans la description) | `https://mirandola.fr/mentions/cgu` et `…/mentions/cgv` |
| Suppression du compte (Google l'exige) | `https://mirandola.fr/mentions/confidentialite` (Réglages → Supprimer le compte, dans l'app et sur le web) |

Jamais le nom d'une autre app dans les mots-clés (règle 2.3.7 d'Apple).

Description longue (Apple et Google) :

> Mirandola transforme tes cours en flashcards et te dit chaque jour quoi
> réviser pour ne plus rien oublier.
>
> • Crée tes paquets en écrivant, en collant un texte, depuis un PDF ou une
> photo de ton cahier : l'IA en fait des cartes.
> • Révise au bon moment : le moteur FSRS calcule pour chaque carte le jour
> où tu allais l'oublier.
> • Entraîne-toi en QCM, en vrai ou faux, à l'écrit, en défi avec tes amis
> ou en partie en direct avec ta classe.
> • Avec Mirandola Infini : l'objectif examen et l'examen blanc corrigé par
> l'IA, copie manuscrite comprise.
> • Tes statistiques, ta série, tes matières, hors ligne aussi.
>
> Pour les établissements, Mirandola Campus réunit élèves, professeurs et
> référents (sur devis : mirandola.fr/etablissements).
>
> Mirandola est gratuit. Mirandola+ et Mirandola Infini s'abonnent dans
> l'app, au mois ou à l'année, renouvelés automatiquement sauf résiliation
> au moins 24 heures avant la fin de la période, dans les réglages de ton
> compte Apple ou Google. Conditions : mirandola.fr/mentions/cgu et
> mirandola.fr/mentions/cgv.

## 7. Les questionnaires

**Confidentialité Apple (« App Privacy »)** et **Sécurité des données
Google** — ce que dit `ios/App/App/PrivacyInfo.xcprivacy`, à recopier :

- *Aucun suivi* (« tracking ») : ni publicité, ni courtier de données.
- Liées au compte, pour le fonctionnement de l'app : adresse e-mail, nom,
  identifiant du compte, photos (celles qu'on envoie à l'IA ou qu'on met sur
  une carte), audio (les sons d'une carte), messages (entre amis, d'un
  professeur), autre contenu (les cartes), interactions (les révisions),
  historique d'achats.
- Non liées au compte : rapports de plantage et performances (le rapporteur
  d'erreurs, anonyme : `docs/FIABILITE.md`).
- Google : chiffrées en transit, oui ; suppression possible, oui (dans
  l'app) ; rien n'est vendu ni partagé à des fins publicitaires.

**Classification par âge** : l'app permet d'échanger des messages et de
rejoindre des clubs (contenu entre utilisateurs, avec signalement et
blocage : règle 1.2 d'Apple), sans accès libre au web, sans contenu adulte.
**Public cible Google — une décision à prendre** : déclarer des moins de
13 ans (des collégiens de 6e) fait entrer l'app dans le programme
« Familles » de Google (règles plus strictes sur les SDK et l'IA) ;
déclarer « 13 ans et plus » est le plus simple, les conditions
d'utilisation disant déjà qu'avant 15 ans il faut l'accord d'un parent.

**Notes pour l'examen d'Apple** (App Review Information) : donner un compte
de test (un compte élève de `supabase/comptes_test.sql`, avec ses livres),
dire que « Essayer sans compte » ouvre une démo complète sans inscription,
que la connexion Google n'est pas proposée dans l'app, que les comptes
d'établissement (Mirandola Campus) sont vendus aux établissements hors de
l'app (règle 3.1.3(c)), et que « Supprimer le compte » est dans les
Réglages.

**Le refus le plus probable chez Apple : la règle 4.2** (« fonctionnalité
minimale ») vise les apps qui ne sont qu'un site dans une coque. Les notes
doivent dire ce que l'app fait en propre : elle marche hors ligne (le moteur
de révision tourne sur le téléphone), partage et enregistre des fichiers,
ouvre les liens de classe et de défi, vend par l'achat intégré. Un refus
arrive avec sa raison ; on répond dans App Store Connect, sans tout
renvoyer.

## 8. Essayer avant de publier

- **Android, tout de suite** : chaque poussée qui touche l'app lance
  *App des magasins* sur GitHub ; l'artefact **android-test** contient un
  APK de débogage à installer sur un téléphone (autoriser les sources
  inconnues). Sans clé RevenueCat, tout marche sauf l'achat.
- **iPhone** : TestFlight (section 2, point 5), ou, sur un Mac,
  `npm run natif && npx cap open ios` puis ▶ dans Xcode.
- **Les achats** : comptes de test « Sandbox » d'Apple, testeurs de licence
  de Google (Play Console → Paramètres → Test de licence) ; un abonnement de
  test se renouvelle en quelques minutes.
- **Ce que vérifie le dépôt** : `test/natif.test.js` (identifiants,
  permissions, textes d'autorisation d'iOS, manifeste de confidentialité,
  liens, prix des magasins) et `e2e/natif.e2e.js` (le vrai pont de
  Capacitor simulé : liens entrants, bouton retour, partage, presse-papiers,
  vibreur ; et rien de natif dans le navigateur).

## 9. Chaque mise à jour

1. `main` à jour et vert ; l'app native embarque le build du moment.
2. Changer `MIRANDOLA_VERSION_NAME` (Android, variable de l'environnement ou
   `gradle.properties`) et `MARKETING_VERSION` (`ios/App/App.xcodeproj`)
   pour une version visible ; le numéro de build monte seul.
3. *Run workflow* avec « publier » (TestFlight), et l'`.aab` dans la console
   Google.
4. **Avant chaque soumission, relire les règles** (elles changent chaque
   année) : developer.apple.com/app-store/review/guidelines (3.1.1, 3.1.2,
   4.8, 5.1.1) et les règles de paiement et de données de Google Play.
   Depuis le 28 avril 2026, Apple n'accepte que des compilations faites avec
   Xcode 26 et le SDK d'iOS 26 : le workflow prend le Xcode le plus récent
   de la machine de GitHub.

## 10. Une fois publiée : le site mène aux magasins

Les liens n'existent qu'après la publication (Apple donne un numéro, du
genre `apps.apple.com/fr/app/mirandola/id1234567890` ; Google
`play.google.com/store/apps/details?id=fr.mirandola.app`). Ce jour-là :

1. `MAGASINS` de `src/plateformes.js` reçoit les deux adresses : la porte
   d'installation d'un téléphone mène alors au magasin au lieu de l'écran
   d'accueil (déjà écrit, `installer`). À décider : garder l'app de l'écran
   d'accueil en second choix, ou n'offrir que le magasin.
2. Le site : les badges officiels (« Télécharger dans l'App Store »,
   « Disponible sur Google Play », pris chez Apple et Google, jamais
   redessinés, de la même hauteur) dans le héros, les tarifs et le pied ;
   copiés dans `public/site/` (la CSP refuse une image d'ailleurs) ; un lien
   unique `mirandola.fr/telecharger` qui envoie un iPhone vers l'App Store,
   un Android vers Google Play, un ordinateur vers `/app` ; la FAQ et
   `test/site.test.js` (qui refuse aujourd'hui « App Store » et « Google
   Play ») mis à jour ensemble.
3. Dans Safari, la bannière d'Apple (`<meta name="apple-itunes-app"
   content="app-id=…, app-argument=…">`) propose l'app en haut de chaque page
   du site, ou l'ouvre si elle est installée.
4. Le manifeste ajoute l'app Google Play à `related_applications` (à côté
   de la `webapp` déjà là), sans `prefer_related_applications` : Chrome
   saurait qu'elle existe sans cesser de proposer l'app web.
