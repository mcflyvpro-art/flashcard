# FOLIO-REPRISE-LIENS — tâche en cours (2026-10-25)

Ce fichier décrit **exactement** ce qui reste à faire d'une demande de
l'utilisateur, pour qu'une nouvelle session Claude la reprenne sans rien
redemander. Lire d'abord `CLAUDE.md` (l'architecture, les règles), puis ceci.
Une fois tout fait et vérifié : supprimer ce fichier, retirer la mention
« EN COURS » du bloc ÉTAT de `PROGRESS.md`, mettre `CLAUDE.md` à jour.

Règle de livraison (CLAUDE.md, règle 7) : chaque étape validée
(`npm run check` + parcours e2e verts) part sur la branche de travail **et**
sur `main` (Vercel déploie `main` : c'est là que l'utilisateur teste).
Commits en français : titre court, corps en prose (problème, cause, preuve).

## La demande de l'utilisateur (mot pour mot, résumée)

1. « Ne plus avoir de lien GitHub Pages nulle part, même en partage :
   maintenant c'est folioflashcard.online. »
2. « Les liens (jeux, défis, scan de QR code) m'envoient sur le web, pas sur
   l'app PWA ; je veux qu'ils ouvrent l'app, connecté. » + « Dis-toi que je
   vais passer sur **Capacitor** bientôt. »
3. « Prépare l'environnement : je change de session Claude, je veux qu'elle
   comprenne tout parfaitement. »
4. Safari : feuilles et bulles qui ne s'ouvraient pas — **FAIT** (commit
   `8bd76f3`, voir plus bas).

## Faits établis (ne pas re-chercher)

- **Domaine canonique : `https://www.folioflashcard.online/`.** Sur Vercel
  (projet `flashcard`, équipe `massam-17-s-projects`), l'apex
  `folioflashcard.online` redirige en 308 vers `www`. Il existe aussi l'alias
  `flashcard-roan-chi.vercel.app` (ne PAS le rediriger : quelqu'un qui aurait
  installé l'app depuis cet alias perdrait ses écritures hors ligne pas
  encore envoyées — le stockage local est propre à chaque origine).
- **Cause du problème 2 côté Android** : tous les liens partagés sont
  fabriqués avec `location.origin + location.pathname`. Ouverts depuis
  GitHub Pages ou une préversion Vercel, ils propagent cette adresse ; or une
  PWA installée (WebAPK Android) n'intercepte que les liens de SON origine.
  Un lien sur le domaine canonique s'ouvre dans l'app installée sur Android.
- **iOS** : une PWA d'écran d'accueil n'intercepte JAMAIS un lien (limite
  d'Apple) ; un QR scanné ouvre Safari, dont le stockage est séparé de la
  PWA (pas de session). Seul Capacitor (Universal Links) l'ouvrira dans
  l'app. En attendant : une carte de passage sur l'écran de connexion
  (étape 5 ci-dessous).
- Les liens entrants existants (tous lus dans `location.search`/`hash`) :
  `?carte=` → `consumeCarte()` (`ui/connexion.js`), `#i=` / `#s=` →
  `consumeHash()` (`ui/onboarding.js`), `?go=` → `consumeGoto()`
  (`ui/raccourcis.js`), `?rejoindre=` → `consumeRejoindre()`
  (`ui/eleve-classes.js`), `?defi=` → `consumeDefi(connecte)`
  (`ui/direct-porte.js`), `?club=` → `consumeClub(connecte)`
  (`ui/cercle-feuilles.js`). Sans session, `rejoindre`/`defi`/`club` se
  gardent dans `sessionStorage` (`folio.rejoindre`, `folio.defi`,
  `folio.club`) et sont repris par `accueil()` (`core/classement.js`) après
  la connexion. Ordre au démarrage : `boot()` dans `ui/onboarding.js`.

## Ce qui reste à faire, dans l'ordre

### 1. Une seule adresse pour tout lien qui sort de l'app
Créer `src/adresse.js` (fichier sans aucune dépendance, comme `racine.js`) :
`export const SITE = 'https://www.folioflashcard.online/';` avec un
commentaire qui dit pourquoi (GitHub Pages, préversions, et
`capacitor://localhost` dans Capacitor). Remplacer chaque base fabriquée à
partir de `location` par `SITE` :
- `src/ui/onboarding.js` — `copyLink()` (`location.origin + location.pathname`)
- `src/ui/menus-c.js` — `clickBackup` et `clickCopylink` (`… + '#i='`)
- `src/ui/cercle-feuilles.js` — deux `lienClub(location.origin + location.pathname, …)`
- `src/ui/direct-ecran.js` — `lienDefi(location.origin + location.pathname, …)`
- `src/ui/prof-feuilles.js` — `baseApp()` (lien et QR « rejoindre », cartes de connexion)
- `src/core/reglages-corbeille.js` — lien de partage `#s=`
Vérifier ensuite : `grep -rn "location.origin" src` ne doit plus servir à
fabriquer un lien (les `history.replaceState(…, location.pathname…)`
restent : c'est de la navigation locale). Les parcours e2e fabriquent leurs
propres liens (`./?rejoindre=`, `./?carte=`) : ils ne cassent pas.

### 2. Le manifeste : que l'app installée prenne les liens
`public/manifest.webmanifest` : `"id": "/"`, `"start_url": "/"`,
`"scope": "/"` (au lieu de `"."`, même sens à la racine), plus
`"launch_handler": { "client_mode": ["navigate-existing", "auto"] }` et
`"handle_links": "preferred"` (Chrome/Android, bureau). Les raccourcis
`./?go=…` restent valides.

### 3. Fin de GitHub Pages
- Remplacer `.github/workflows/pages.yml` par un déploiement qui ne publie
  plus l'app mais une **redirection** : `index.html` et `404.html` qui
  envoient vers `https://www.folioflashcard.online/` en gardant `search` et
  `hash` (et en retirant le préfixe `/flashcard/`), plus un `sw.js` qui se
  désinscrit et vide ses caches (`self.registration.unregister()`), pour
  les téléphones qui avaient l'ancienne version en cache. Pas de build Vite.
- `vite.config.js` : retirer la logique `GITHUB_PAGES` / `base` `/flashcard/`
  (garder `base: '/'`) ; `import.meta.env.BASE_URL` dans `ui/onboarding.js`
  vaut alors toujours `/`.
- `CLAUDE.md`, section « Hébergement » : réécrire (une seule cible, Vercel ;
  Pages ne fait plus que rediriger ; les réglages Pages/Variables à la main
  ne concernent plus que la CI). Dire à l'utilisateur qu'il peut, s'il veut,
  désactiver Pages dans Settings → Pages une fois les anciens liens oubliés.

### 4. Une seule porte pour un lien entrant (prêt pour Capacitor)
Créer `src/ui/liens-entrants.js` avec `traiterLienEntrant(url)` :
`history.replaceState` vers `search` + `hash` de l'URL reçue, puis les
mêmes consommateurs que `boot()`/`accueil()` dans le même ordre (carte,
puis sans session : `consumeRejoindre()` + `consumeDefi(false)` +
`consumeClub(false)` et rester sur la connexion ; avec session : hash, go,
rejoindre, `consumeDefi(true)`, `consumeClub(true)`). L'employer dans
`boot()` pour l'adresse de départ (sans changer le comportement), et le
documenter comme LE point d'entrée de `App.addListener('appUrlOpen', e =>
traiterLienEntrant(e.url))` de Capacitor. Ajouter au démarrage sans
session `consumeDefi(false)` et `consumeClub(false)` (aujourd'hui seul
`consumeRejoindre()` est appelé : le code reste dans l'adresse, ça marche,
mais il vaut mieux le ranger en `sessionStorage` comme les autres).

### 5. iOS en attendant Capacitor : la carte de passage
Sur l'écran de connexion (`loginView`, `ui/connexion.js`), quand l'app
tourne dans un navigateur (pas `display-mode: standalone`, pas
`navigator.standalone`) et qu'un code attend (`folio.defi`, `folio.club`,
`folio.rejoindre`) : une petite carte avec l'icône, le code en gros et un
bouton « Copier » — « Dans l'app : Entrer un code » (défi), « J'ai un
code » (club), « Classe → Rejoindre » (classe). Le moins de texte possible
(règle de CLAUDE.md : icônes et chiffres). Un parcours e2e la vérifie.

### 6. Préparer Capacitor (documentation, pas d'installation)
Écrire `docs/CAPACITOR.md` : `appId` à choisir (ex.
`online.folioflashcard.app`), `webDir: 'dist'`, `base: '/'` ; liens
universels iOS (`/.well-known/apple-app-site-association`, servi en
`application/json` — prévoir l'en-tête dans `vercel.json`) et App Links
Android (`/.well-known/assetlinks.json`, empreinte SHA-256 de la clé de
signature) — **ne pas publier ces fichiers avec de faux identifiants**,
seulement le gabarit dans la doc ; `appUrlOpen` → `traiterLienEntrant` ;
ne pas enregistrer le service worker sous Capacitor (`window.Capacitor`) ;
le stockage local reste (WKWebView), envisager `@capacitor/preferences`
pour la session ; URL de redirection Supabase Auth (mot de passe oublié)
sur `SITE` ; zones sûres déjà gérées (`env(safe-area-inset-*)`). Ajouter
une ligne dans `CLAUDE.md` qui pointe vers ce fichier.

### 7. L'environnement des sessions Claude
- Utiliser le skill **`session-start-hook`** pour poser un hook de démarrage
  (`.claude/settings.json`) qui fait `npm ci` si `node_modules` manque, afin
  que lint, tests et build tournent d'emblée dans une session cloud.
- Le Chromium de la machine cloud est préinstallé (`/opt/pw-browsers/chromium`)
  et la version de Playwright du projet ne le trouve pas toute seule :
  versionner la configuration de secours (aujourd'hui exclue par
  `.git/info/exclude`) en `tools/pw-local.config.js`, ou la recréer :
  ```js
  import base from '../playwright.config.js';
  export default { ...base, projects: base.projects.map(p => ({ ...p,
    use: { ...p.use, launchOptions: { executablePath: '/opt/pw-browsers/chromium' } } })) };
  ```
  Lancer : `CI=1 npx playwright test -c tools/pw-local.config.js`.
- Safari (WebKit) se teste ainsi, sans toucher au Chromium :
  `export PLAYWRIGHT_BROWSERS_PATH=<scratchpad>/pw && npx playwright install webkit && npx playwright install-deps webkit`,
  puis une config avec `devices['Desktop Safari']` / `devices['iPhone 13']`
  et **`serviceWorkers: 'block'`** (sous WebKit le service worker capte les
  requêtes avant `page.route` : le faux Supabase ne verrait rien).
- Les scripts de revue visuelle `e2e/zz-*.e2e.js` ne sont pas versionnés
  (captures dans `SHOTS=dossier` ; sans `SHOTS`, ils écrivent dans un
  dossier `undefined/` ou `zz-…/` — ne jamais les committer).
- Mettre tout cela dans `CLAUDE.md` (section « Commandes utiles » et
  « e2e »), pas seulement ici.

## Déjà fait dans cette session (pour mémoire)

`4362b96` balayage natif + retour d'un livre ; `b3be1a1` statistiques
(journal par contexte, fonction `journal()`, migration `20261025170855`,
`supabase/tests/journal.sql` 18/18) et journal refait ; `e234537` design PC
(gabarit unique, menus accrochés, dialogues) ; `8bd76f3` Safari (feuilles).
CI et Vercel verts jusqu'à `900ae6e` ; vérifier ceux d'après.
