# Mirandola sous Capacitor — l'app native iPhone, iPad et Android

Installée le 2026-11-16 (demandé : « une app parfaite pour les magasins, tu
casses rien, je peux encore utiliser le PWA »). Ce fichier dit comment elle
est faite ; **ce qu'il reste à faire à la main pour la publier est dans
`docs/MAGASINS.md`**.

## Le principe : la même app, rien de changé pour le web

L'app native est **le build de l'app web** (`app.html` et ses morceaux),
servi depuis le téléphone par Capacitor 8 dans un WebView (WKWebView sur
iOS, le WebView de Chrome sur Android). Elle parle à la même base, avec le
même compte, la même file hors ligne.

- **Rien de natif n'entre dans l'app web.** `src/app.js` ne charge
  `src/ui/natif.js` que si le vrai pont de Capacitor est là
  (`window.androidBridge` ou `window.webkit.messageHandlers.bridge`) ; ce
  morceau et les greffons sont dans des fichiers `natif-…` (`nomDuMorceau`
  de `vite.config.js`), que le site, l'app web et l'app de l'écran d'accueil
  ne téléchargent jamais. Preuve : `e2e/natif.e2e.js` (« sans le vrai pont,
  rien ») ; le démarrage n'a pas grossi (la vente est partie dans
  `core/vente.js`, chargé avec l'écran Mirandola+).
- **Le service worker ne s'enregistre pas** sous Capacitor (l'app est déjà
  sur le téléphone), la porte d'installation ne s'ouvre pas et « Installer
  Mirandola » ne se propose pas (`installee()` de `ui/routeur.js`, que
  `installed` de `ui/onboarding.js` reprend).
- **Sortir de l'app** (se déconnecter, quitter la démo) reste dans l'app :
  `installee()` n'a pas de site derrière elle.

## Ce qui est dans le dépôt

| Fichier | Rôle |
|---|---|
| `capacitor.config.json` | `fr.mirandola.app`, `webDir: dist-natif`, Android en `https://localhost`, fond papier `#F6F5F1`, écran de lancement sans image, barres du système claires (`SystemBars`, encarts en CSS : `env(safe-area-inset-*)` comme l'app installée) |
| `tools/natif/web.js` | fabrique `dist-natif/` depuis `dist/` : `app.html` devenu `index.html` (sans manifeste), **seulement** les fichiers que l'app peut atteindre (le site, ses pages et ses images restent dehors), sans `.map` ; il vérifie ce qu'il écrit |
| `ios/` | le projet Xcode (Swift Package Manager, pas de CocoaPods) : `Info.plist` en français (textes des autorisations — appareil photo, micro, photos, dictée —, chiffrement exempté, apparence claire), `PrivacyInfo.xcprivacy`, `App.entitlements` (liens universels), écran de lancement uni, icônes, schéma partagé, `ExportOptions.plist` |
| `android/` | le projet Gradle : manifeste (App Links `autoVerify` sur les chemins de `CHEMINS_APP`, sauvegarde coupée, pas de HTTP en clair, permissions au plus juste — internet, micro), thème clair papier, écran de lancement d'Android 12 uni, icône adaptative, signature de publication lue dans l'environnement ou `keystore.properties` (jamais committé) |
| `src/natif.js` | pur et testé : les chemins qui ouvrent l'app (`CHEMINS_APP`, `lienDeLApp`) et les fichiers d'association (`associationApple`, `associationAndroid`) |
| `src/magasin.js` | pur et testé : le paquet RevenueCat d'une formule (`paquetDe`), son prix et son essai tels que le magasin les dit |
| `src/core/vente.js` | le paiement : Stripe dans un navigateur, l'achat intégré dans l'app (RevenueCat), « Restaurer mes achats » |
| `src/ui/natif.js` | ce que le téléphone ajoute (ci-dessous) |
| `tools/natif/ressources.js` | les sources des icônes (`marque/natif/`) et les images des fiches (`marque/magasins/`) |
| `tools/natif/captures.js` | les captures des fiches, depuis la démo |
| `tools/natif/liens.js` | écrit les fichiers des liens universels et des App Links, le jour où l'on a les identifiants |
| `.github/workflows/natif.yml` | compile les deux apps à chaque poussée qui les touche (et vérifie que rien de généré n'a été oublié) ; publie sur TestFlight sur demande |

## Ce que fait `src/ui/natif.js`

- **Lancement** : l'écran de lancement s'efface dès que l'app a peint
  (deux images), en fondu ; les barres du système en clair.
- **Liens entrants** : un lien `https://mirandola.fr/…` reçu par l'app
  (`appUrlOpen`, et `getLaunchUrl` au démarrage à froid sous Android) passe
  par `traiterLienEntrant` (`ui/liens-entrants.js`), une fois le routeur
  armé ; un lien d'un autre domaine ou du site (`/tarifs`) est ignoré.
- **Bouton retour d'Android** : ferme la boîte ou la feuille ouverte, sinon
  revient à l'écran d'avant, sinon met l'app en arrière-plan (jamais
  pendant le tuto).
- **Mise en arrière-plan** : la bibliothèque est rangée (`save`) ; au
  retour, ce qui attend part (`flush`) — la synchro au retour de
  `ui/synchro-ecran.js` fait le reste.
- **Ce que le WebView n'a pas**, rendu par les greffons : `navigator.share`
  (fichiers compris : le PDF d'un paquet, une sauvegarde), le
  téléchargement d'un fichier (`a[download]` d'un blob → la feuille de
  partage), le presse-papiers, le vibreur ; sous Android, le choix « Prendre
  une photo / Choisir dans la galerie » avant la photo d'un cours.
- **La connexion Google n'est pas proposée** dans l'app (elle passerait par
  le navigateur et perdrait la session ; et Apple exigerait alors « Se
  connecter avec Apple », règle 4.8). Les codes à 8 chiffres font le reste.

## La vente dans l'app

Dans l'app native, l'écran Mirandola+ vend par le magasin (`vente()` de
`src/plateformes.js`) : les prix sont ceux que dit le magasin
(`prixMagasin`), l'essai est celui du magasin, ni Stripe, ni code
`LANCEMENT`, ni prix du site ; le renouvellement automatique est dit en
toutes lettres sous le bouton, avec les conditions et la confidentialité
(règle 3.1.2 d'Apple). Un achat Infini achète bien Infini (`paquetDe`), et
la fonction `magasins` l'écrit comme tel (`formuleDuProduit`).
Mirandola Campus ne s'achète pas dans l'app.

## Commandes

```sh
npm run natif                 # build, dist-natif/, puis cap sync (copie dans ios/ et android/)
npx cap open ios              # sur un Mac : Xcode, puis ▶
npx cap open android          # Android Studio, puis ▶
cd android && ./gradlew assembleDebug    # un APK de test, sans Android Studio (JDK 21)
node tools/natif/ressources.js           # les sources des icônes et les images des fiches
node /chemin/@capacitor/assets/bin/capacitor-assets generate --assetPath marque/natif \
  --iconBackgroundColor '#F6F5F1' --ios --android   # les icônes (outil pris à part, pas une dépendance)
node tools/natif/captures.js             # les captures des fiches (sur un build à jour)
```

Après un changement de l'app web, rien à faire pour le web ; pour l'app
native, `npm run natif` (la CI le fait et refuse un projet natif pas à jour :
`git diff --exit-code` après la synchro).

## Versions

Capacitor 8.6 ; iOS 15 et plus, iPhone et iPad ; Android 7 (API 24) et
plus, compilé pour l'API 36. Les compilations d'Apple se font avec le Xcode
le plus récent de la machine de GitHub (Xcode 26 et le SDK d'iOS 26 sont
exigés depuis le 28 avril 2026).

## Limites connues

- `window.print()` ne fait rien dans le WebView d'Android : le PDF d'un
  paquet passe par la feuille de partage, qui sait imprimer ; une facture
  ou une liste de comptes des consoles s'imprime depuis l'ordinateur.
- `Package.resolved` (les versions exactes des paquets Swift) n'est pas
  committé : Xcode le refait.
- iOS peut, sous forte pression de stockage, vider les données d'un WebView :
  la session se reperdrait (on se reconnecte) ; le reste se relit depuis la
  base. À surveiller ; `@capacitor/preferences` rangerait la session hors du
  WebView si cela arrivait.
- Le lien « mot de passe oublié » d'un e-mail ouvre l'app grâce aux liens
  universels une fois `tools/natif/liens.js` passé ; d'ici là, les codes à
  8 chiffres suffisent (c'est ce que l'app demande).
