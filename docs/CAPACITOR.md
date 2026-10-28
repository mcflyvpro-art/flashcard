# Mirandola sous Capacitor — ce qui est prêt, ce qui reste à faire

Capacitor n'est **pas installé** : ce fichier dit comment l'ajouter sans rien
casser, et ce que le code a déjà préparé. À relire avec `CLAUDE.md`
(architecture, hébergement) avant de commencer.

## Pourquoi Capacitor

Sur iPhone, une PWA d'écran d'accueil n'intercepte **jamais** un lien
(limite d'Apple) : un QR de partie, de club ou de classe scanné ouvre Safari,
dont le stockage est séparé de l'app — pas de session. En attendant, l'écran
de connexion montre une **carte de passage** (`src/ui/passage.js`) : le code
en gros, un bouton « Copier » et où le coller dans l'app. Avec Capacitor, les
liens universels (iOS) et App Links (Android) ouvriront l'app elle-même,
connectée.

## Ce qui est déjà prêt dans le code

- **Une seule adresse pour les liens qui sortent** : `SITE`
  (`src/adresse.js`, `https://mirandola.fr/`). Sous Capacitor,
  `location` vaut `capacitor://localhost` (iOS) ou `https://localhost`
  (Android) : aucun lien partagé n'est fabriqué à partir de `location`.
- **Une seule porte pour les liens qui entrent** :
  `traiterLienEntrant(url)` (`src/ui/liens-entrants.js`). Elle pose le
  `search` et le `hash` de l'URL reçue, puis rejoue les mêmes consommateurs
  que le démarrage (carte élève, livre partagé, raccourci, classe, partie,
  club), dans le même ordre.
- **Le service worker ne s'enregistre pas sous Capacitor**
  (`window.Capacitor`, `src/ui/onboarding.js`) : l'app est déjà embarquée
  dans le binaire, un cache par-dessus ne ferait que servir une version
  périmée après une mise à jour du magasin.
- **`base: '/'`** (`vite.config.js`) : le WebView sert `dist/` depuis sa
  racine, comme Vercel.
- **Zones sûres** : `env(safe-area-inset-*)` est déjà employé partout
  (`src/app.css`) ; poser `viewport-fit=cover` reste fait dans `app.html`.
- **L'app est `app.html`, pas `index.html`** (depuis le 2026-10-26 :
  `index.html` est la page d'accueil du site, docs/LANDING.md). Le WebView
  ouvre `index.html` par défaut ; son aiguillage voit `window.Capacitor` et
  passe aussitôt à `/app.html` (le serveur local de Capacitor ne connaît
  pas les adresses sans extension). Mieux, le jour venu : copier
  `dist/app.html` sur `index.html` dans le dossier servi au WebView (étape
  de build dédiée), pour ne jamais charger la page d'accueil dans l'app.

## Installation (le jour venu)

```sh
npm i @capacitor/core @capacitor/app
npm i -D @capacitor/cli
npx cap init Mirandola fr.mirandola.app --web-dir dist
npm i @capacitor/ios @capacitor/android
npx cap add ios && npx cap add android
npm run build && npx cap sync
```

`capacitor.config.json` :

```json
{
  "appId": "fr.mirandola.app",
  "appName": "Mirandola",
  "webDir": "dist",
  "server": { "androidScheme": "https" }
}
```

L'`appId` est un choix définitif (il identifie l'app dans les magasins) :
`fr.mirandola.app` suit le domaine à l'envers.

Ces paquets sont des **dépendances à l'exécution** : la règle « pas de
bibliothèque externe sans accord explicite » s'applique — l'accord est à
demander au moment de les installer.

### Brancher les liens entrants

Dans `src/app.js` (ou un petit module chargé seulement sous Capacitor) :

```js
import { App } from '@capacitor/app';
import { traiterLienEntrant } from './ui/liens-entrants.js';

if (window.Capacitor) App.addListener('appUrlOpen', e => traiterLienEntrant(e.url));
```

Au lancement à froid par un lien, Capacitor fournit aussi l'URL par
`App.getLaunchUrl()` : l'appeler une fois au démarrage et la passer à
`traiterLienEntrant` si elle existe.

## Payer, dans l'app des magasins

**Mirandola+ s'y achète par l'achat intégré d'Apple ou de Google**, au travers
de RevenueCat. Ce sont leurs règles : jamais Stripe dans l'app (le détail et
la mise en place sont dans docs/VENTE.md, § 2).

Le code est prêt :

- `plateforme()` (`src/plateformes.js`) lit `window.Capacitor.getPlatform()`,
  et `vente()` répond alors « magasin ».
- L'écran Mirandola+ propose « Passer à Mirandola+ » et « Restaurer mes achats ». Il
  ne mentionne ni Stripe ni le site. Un abonnement se gère là où il a été pris
  (`gestion()`, `src/abonnement.js`) :
  - Apple : les réglages de l'iPhone ;
  - Google : Google Play ;
  - Stripe : « se gère sur mirandola.fr, depuis un ordinateur », sans
    lien.
- `versMagasin()` et `restaurerAchats()` (`src/core/abonnement.js`)
  appellent le greffon `@revenuecat/purchases-capacitor` sous
  `Capacitor.Plugins.Purchases` : il n'y a rien à importer dans l'app web.
  - `configure` se fait avec la clé publique de `REVENUECAT`
    (`src/abonnement.js`), et `logIn` avec l'identifiant Mirandola du compte.
  - Ensuite viennent `getOfferings` (`current.annual`, `current.monthly`),
    puis `purchasePackage`.
  - Enfin, la fonction `magasins` relit l'abonné et écrit l'abonnement.
- Sans clé, ou sans produits dans les magasins : « Le paiement ouvre
  bientôt ». Le parcours e2e « dans l'app des magasins » le vérifie.

À l'installation : `npm install @revenuecat/purchases-capacitor`, puis
`npx cap sync`, et poser les deux clés publiques dans `REVENUECAT`.

Une fois l'app publiée, son lien va dans `MAGASINS` (`src/plateformes.js`).
La porte d'installation (`ui/pwa.js`, 2026-10-28), qui montre aujourd'hui à
un téléphone comment poser Mirandola sur son écran d'accueil, mène alors à la
fiche du magasin. Depuis le 2026-10-28, Capacitor est en réserve : le
téléphone passe par l'app web installée (CLAUDE.md, « La porte
d'installation »).

## Liens universels (iOS) et App Links (Android)

Deux fichiers à servir depuis `https://mirandola.fr/.well-known/`.
**Ne pas les publier avant d'avoir les vrais identifiants** : un fichier faux
fait échouer la vérification d'Apple ou de Google, qui la met en cache.

`public/.well-known/apple-app-site-association` (sans extension) :

```json
{
  "applinks": {
    "details": [
      { "appIDs": ["<TEAM_ID>.fr.mirandola.app"], "components": [ { "/": "/*" } ] }
    ]
  }
}
```

`<TEAM_ID>` : l'identifiant d'équipe du compte Apple Developer. Dans Xcode,
ajouter la capacité *Associated Domains* avec
`applinks:mirandola.fr`.

`public/.well-known/assetlinks.json` :

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "fr.mirandola.app",
    "sha256_cert_fingerprints": ["<EMPREINTE SHA-256 DE LA CLÉ DE SIGNATURE>"]
  }
}]
```

L'empreinte : `keytool -list -v -keystore <clé>.jks` (ou, si Google signe
l'app, la console Play → Intégrité de l'app). Dans
`android/app/src/main/AndroidManifest.xml`, un `intent-filter` avec
`android:autoVerify="true"`, `https`, `mirandola.fr`.

Apple exige `Content-Type: application/json` pour un fichier sans extension :
ajouter dans `vercel.json`, au même moment que le fichier,

```json
{ "source": "/.well-known/apple-app-site-association",
  "headers": [{ "key": "Content-Type", "value": "application/json" }] }
```

## Session et stockage

- Le stockage local (`localStorage`) reste disponible dans le WebView
  (WKWebView sur iOS) : la file hors ligne, le cache des livres et la session
  continuent de marcher tels quels.
- iOS peut vider le stockage d'un WebView sous forte pression mémoire. Pour
  la session seulement (`cartes.auth`), envisager `@capacitor/preferences`
  (stockage natif) le jour venu ; le reste se reconstruit depuis la base.

## Supabase Auth

- Le lien « Mot de passe oublié » renvoie vers la *Site URL* du projet
  (Supabase → Authentication → URL Configuration) : elle doit valoir
  `https://mirandola.fr/`, et ce domaine figurer dans les
  *Redirect URLs*. Ouvert sur le téléphone, ce lien ouvrira l'app grâce aux
  liens universels.
- Aucune URL `capacitor://` n'est à déclarer : l'app n'emploie pas de
  connexion OAuth par redirection.
