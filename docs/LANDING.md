# La page d'accueil publique — fichier de reprise

> **Nouveau Claude qui reprend ce chantier :** lis ce fichier en entier (il
> est fait pour ça), puis `git log --oneline -15` sur la branche, puis va à
> **« Où on en est »** et fais la première case non cochée. Coche au fur et à
> mesure, **commit + push après chaque case** (le conteneur peut disparaître
> à tout moment) : c'est ce fichier qui permet à la session suivante de
> reprendre sans rien relire d'autre. Branche de travail :
> `claude/landing-page-seo-i6vu41` (puis `main`, règle 7 de CLAUDE.md, une
> fois `npm run check` et les e2e verts).

## La demande (2026-10-26, résumée fidèlement)

Une page d'accueil (« landing ») **ultra optimisée SEO, ultra belle**, qui
présente l'app en **B2C** (élèves, étudiants) et en **B2B** (établissements).

- Le texte passé au **skill humanizer** partout : peu de texte, naturel,
  **aucun tiret cadratin/demi-cadratin (— –) dans le texte visible**, pas de
  tics d'IA (règle de trois, « non seulement… mais », formules creuses).
- **Très visuel, tout animé**, « en mettre plein la vue ».
- **Emplacements pour des vidéos** de l'app : PC, MOBILE, PROFESSEUR,
  RÉFÉRENT. **Ne pas faire les vidéos** : seulement l'endroit où les
  insérer (cadres d'appareils, affiche en attendant).
- Le **logo** : la version SVG fournie (`Vectorized SVG.svg`, copie dans
  `public/icons/test svg`, 779 Ko, tracé automatique) est moche, pas droite,
  mal détourée → en faire **un vrai SVG propre** (pile de trois livres :
  crème avec étiquette sombre en haut, gris au milieu, presque noir en bas,
  vue de trois quarts — modèle : `public/icons/icon-512.png`).
- Boutons : **Se connecter**, **Créer un compte**, **J'ai un code**
  (« Vous avez un code ? »), **Démo** (essayer sans compte), et pour les
  établissements **Demander une démo**.
- **Tarifs** : Folio (gratuit), **Folio+** (mensuel / annuel, bascule),
  l'offre établissement (nom à trouver, mieux que « Folio Établissement »)
  et **un tableau comparatif qui donne envie d'acheter**.
- Mettre en avant : **le meilleur moteur de révision, éprouvé en prépa**,
  **sans parler de technique** (ni FSRS, ni algorithme, ni Anki).

## Décisions prises

| Sujet | Décision | Pourquoi |
|---|---|---|
| Où vit la page | `index.html` = la page d'accueil, servie à `/` | le SEO se joue sur la racine du domaine |
| Où vit l'app | `app.html`, servie à **toutes ses adresses** (le routeur de `src/routes.js` : `/connexion`, `/eleve/…`, `/prof/…`, `/demo/<rôle>`… ; réécriture de `vercel.json` vers `app.html`, relais `adressesDeLApp` de `vite.config.js` en local) et à **`/app`**, que le routeur remplace par l'adresse de l'écran d'arrivée | la racine `/` reste au site : le fichier `index.html` passe avant la réécriture |
| Utilisateurs existants | **aiguillage** en tête du `<head>` de la page d'accueil (script en ligne, avant tout) : session dans `localStorage['cartes.auth']`, app installée (`display-mode: standalone` / `navigator.standalone`), ou lien de l'app (`?carte= ?rejoindre= ?defi= ?club= ?go=`, `#s= #i=`, retours d'e-mail `#access_token` / `#error`) → `location.replace('/app' + search + hash)` | les icônes installées (start_url `/` sur iPhone, jamais mis à jour), les QR imprimés (`/?carte=`), les liens partagés : tout continue d'ouvrir l'app |
| Service worker | met en cache `/app` (la coquille de l'app) et `/` ; une navigation de l'app se range sous « app » (une seule copie pour toutes les adresses), la page d'accueil sous « / » ; hors ligne, une navigation sans copie retombe sur l'app | une app installée doit s'ouvrir hors ligne, à n'importe quelle adresse |
| Manifeste | `start_url: /app`, `id: /` inchangé, `scope: /` inchangé, raccourcis en `/app?go=…` | l'identité de l'app installée ne change pas |
| Liens fabriqués sur `SITE` | inchangés (`/?rejoindre=…` etc.) | l'aiguillage les fait suivre ; rien d'imprimé ne casse |
| Boutons du site | les adresses du routeur : `/inscription`, `/connexion`, `/carte-eleve`, `/essayer`, `/demo/prof` (« Essayer en professeur »), `/demande-demo`, `/mentions/<cgu|confidentialite|mentions>` ; « J'ai un code » → `/app?rejoindre=` (ou `?defi=`, `?club=`) | un écran = une adresse ; rien à ajouter à l'app (les portes `?go=` d'un premier jet ont été retirées à la fusion avec le routeur) |
| Polices | celles du système (le `--serif` de l'app pour les grands titres) | zéro requête externe, zéro traceur (M11.T6), cohérent avec l'app |
| Nom B2B | **Folio Campus** | court, va du collège à la prépa et à la fac |
| Prix B2C (proposition, **à valider par l'utilisateur**) | Folio : 0 € · **Folio+ : 4,99 €/mois ou 29,99 €/an** (2,50 €/mois, −50 %) | annuel nettement plus avantageux, sous la barre des 30 € |
| Prix B2B | **3 € HT par élève et par an, 300 € HT minimum**, démo gratuite 30 jours | déjà fixé dans `docs/PARCOURS.md` § 4.3 |
| Paiement | **pas encore branché** (M12 : achats Apple/Google via Capacitor) : « Folio+ » mène à la création de compte | ne rien promettre qui ne marche pas |

## Architecture de la page (fichiers)

- `index.html` — la page : tout le texte en HTML statique (les moteurs le
  lisent sans JS), métadonnées (titre, description, canonique, Open Graph,
  Twitter), données structurées JSON-LD (Organization, WebSite,
  SoftwareApplication avec ses offres, FAQPage), l'aiguillage en ligne,
  le logo en « sprite » (entre `<!-- logo:debut -->` et `<!-- logo:fin -->`,
  réécrit par `tools/logo.py`) et les icônes (tracés Lucide). Sections, dans
  l'ordre : en-tête collant · héros (la pile qui se pose, le titre mot par
  mot, un portable qui se redresse au défilement, un téléphone, des fiches
  qui flottent et se retournent) · matières qui défilent · le moteur
  (courbe « sans Folio / avec Folio » qui se dessine) · « Du cours au
  concours » (six tuiles animées) · Folio Campus (fond sombre : un code qui
  distribue des élèves vers des classes, portable à onglets
  Professeur/Référent) · tarifs (bascule mensuel/annuel, trois offres,
  tableau comparatif) · questions (FAQ) · appel final · pied de page ·
  fenêtre « J'ai un code ».
- `src/site/site.css` — son style (aucun préfixe : la page n'a pas
  `app.css`). Règles : n'animer que `transform`/`opacity` ; une apparition
  au défilement = classe `.rv` (site.js pose `.vu` ; sans site.js tout
  apparaît au bout de 3 s) ; ce qui tourne en boucle s'arrête hors écran
  (`.dort`) ; « mouvement réduit » coupe toutes les animations.
- `src/site/site.js` — ce qui bouge et répond : apparitions, en-tête,
  inclinaison du portable (`--p`), calendrier du journal, vidéos (chargées
  et jouées seulement à l'écran), onglets Campus, bascule des tarifs,
  fenêtre « J'ai un code » (règles des codes importées de `src/classe.js`
  et `src/defi.js`, jamais réécrites). Aucun appel à la base.
- `public/site/` — `logo.svg`, `icone.svg`, `og.jpg` (partage 1200×630),
  `affiches/{pc,mobile,prof,referent}.webp` (19 à 51 Ko) et leurs variantes
  `-petit.webp` (moitié de la taille, 10 à 20 Ko, servies aux petits écrans par `srcset`). **Exclu du cache
  du service worker** (l'app hors ligne n'en a pas besoin).
- `public/robots.txt`, `public/sitemap.xml`, `public/favicon.svg`.
- `app.html` — l'app (l'ancien `index.html`), `noindex`.
- `tools/logo.py` (le logo), `tools/affiches.js` (affiches + image de
  partage, depuis la démo sans compte), `test/site.test.js` (CSP, ordre du
  `<head>`, aucun tiret long, JSON-LD valide), `e2e/site.e2e.js` (6
  parcours : page au téléphone, boutons → bonnes adresses et bons écrans,
  « J'ai un code » classe et partie, aiguillage lien et session, `?site`).

### Refaire les affiches et l'image de partage

```sh
npm run build && npx vite preview --port 4190 --strictPort &
node tools/affiches.js          # réécrit public/site/affiches/*.webp et public/site/og.jpg
npm run build                   # les fichiers de public/ ne sont copiés qu'au build
```

### Insérer les vidéos (pour l'utilisateur, plus tard)

Chaque emplacement est un `<div class="ecran" data-ecran="pc|mobile|prof|referent">`
dans `index.html`, qui contient l'affiche (`<img class="affiche">`) et un
`<video class="video" data-src="">`. Pour en remplir un : déposer
`public/site/videos/<nom>.mp4` (H.264, **muette**, 8 à 15 s, faite pour
tourner en boucle, ≤ 2 Mo ; 1440×900 pour un ordinateur, 780×1688 pour un
téléphone, comme les affiches), puis écrire son chemin dans le `data-src`
du `<video>` correspondant (`data-src="/site/videos/pc.mp4"`). site.js la
charge quand elle arrive à l'écran, la joue, la met en pause hors écran, et
l'affiche reste dessous tant qu'elle n'a pas démarré. Rien d'autre à
toucher. Les quatre : `pc` (héros, ordinateur : une séance de révision),
`mobile` (héros, téléphone : la bibliothèque), `prof` et `referent`
(Folio Campus, onglets).

## Où on en est

- [x] 1. Fichier de reprise (celui-ci), pointé depuis CLAUDE.md et PROGRESS.md
- [x] 2. Logo SVG propre (`public/site/logo.svg` + `public/favicon.svg`), vérifié en image à 16, 32, 180, 512 px ; supprimer `Vectorized SVG.svg` et `public/icons/test svg` (779 Ko mis en cache par le service worker chez tout le monde !)
- [x] 3. Bascule de l'app vers `/app` : `index.html` → `app.html`, vite multi-pages, `tools/budget.js` (démarrage lu dans `app.html`, plus une ligne « site »), service worker, manifeste, `vercel.json` (en-têtes, `app.html`), e2e (`goto('./')` → `goto('./app')`), portes `?go=` sans session
- [x] 4. La page : structure HTML + SEO (titre, description, canonique, Open Graph, JSON-LD Organization/WebSite/SoftwareApplication/FAQPage, robots, sitemap)
- [x] 5. La page : style et animations (héros, moteur, fonctions, vidéos, Campus, tarifs + tableau, FAQ, appel final, pied de page), mouvement réduit respecté
- [x] 6. Les boutons branchés sur l'app (se connecter, créer un compte, j'ai un code, démo, demander une démo) + test e2e `e2e/site.e2e.js`
- [x] 7. Affiches des emplacements vidéo : captures de l'app réelle en mode démo (élève téléphone et PC, professeur, référent)
- [x] 8. Image de partage `public/site/og.jpg` (1200×630, 76 Ko)
- [x] 9. Textes passés au humanizer (aucun « — » ni « – » visible : vérifié par `test/site.test.js`)
- [x] 10. Vérifs : `npm run check` vert, e2e complets 60/60, Lighthouse **100 / 100 / 100 / 100** (performance, accessibilité, bonnes pratiques, SEO) au téléphone (FCP 1,1 s, LCP 1,4 s, CLS 0) comme sur ordinateur, écrans 390 px et 1440 px relus en capture, routage vérifié sur la préversion Vercel (`/`, `/app`, `/app/`, `sw.js`, CSP)
- [x] 11. CLAUDE.md et PROGRESS.md à jour ; `main` fusionnée deux fois pendant le chantier (le routeur à adresses et la démo sur base locale, puis les codes renouvelés) ; routage vérifié sur la préversion Vercel, adresse par adresse, puis poussé sur `main` (00a5228)

## Ce qui reste à décider (l'utilisateur)

- **Les prix** affichés sont une proposition : Folio+ 4,99 €/mois ou
  29,99 €/an ; Campus 3 € HT/élève/an (300 € minimum, déjà dans
  PARCOURS.md). Ils vivent dans `index.html` (cartes `.offre`, attributs
  `data-an`/`data-mois`, tableau) **et** dans le JSON-LD du `<head>`.
- **Les quotas IA** du tableau (Folio : 3 cours par mois ; Folio+ : 50 ; Campus :
  pour les profs) ne sont **pas encore appliqués** côté serveur (M12.T2/T3) ;
  aujourd'hui tout compte a les mêmes quotas (`supabase/functions/ai`).
- **Le paiement** n'existe pas (M12) : « Passer à Folio+ » mène à la création
  de compte.
- **Le nom « Folio Campus »** pour l'offre établissement.
- **Les icônes PNG de l'app** (`public/icons/`) viennent encore de l'ancienne
  image ; les refaire depuis `public/site/icone.svg` change l'icône installée
  chez tout le monde.
- **Les vidéos** : à déposer (voir plus haut). Elles peuvent aussi se
  tourner automatiquement dans la démo (Playwright sait filmer une page,
  `recordVideo`, ffmpeg est déjà sur la machine) si l'utilisateur le veut.
- En option : régler l'« URL du site » de Supabase Auth sur `/app` (les liens
  des e-mails de connexion passent déjà par l'aiguillage, rien ne casse).

## Le logo

`tools/logo.py` le **calcule** (pas de détourage) : trois volumes projetés,
dos en demi-cylindre, couverture en « C » à la queue, pages en retrait.
Régler une valeur en tête du fichier (angles `EX`/`EY`, `W L T`, `PLAT`,
`DOS`, couleurs `COULEURS`) puis `python3 tools/logo.py` réécrit
`public/site/logo.svg` (la marque), `public/site/icone.svg` (sur son carré)
et `public/favicon.svg` (pile qui remplit le carré, sans feuillets). Chaque
livre est un `<g class="livre livre-clair|gris|noir">` et l'étiquette a la
classe `etiquette` : la page d'accueil les anime (la pile se pose livre par
livre). Les icônes PNG de l'app (`public/icons/`) **n'ont pas été
changées** : `tools/make_icons.py` part encore de l'ancienne image ; les
refaire depuis `icone.svg` est une décision à prendre avec l'utilisateur.

## Pièges connus

- Ne **jamais** enregistrer le service worker depuis la page d'accueil : seul
  l'app le fait (sinon il servirait la page à la place de l'app ou l'inverse).
- L'aiguillage doit rester **le premier script du `<head>`**, sans dépendance,
  et ne jamais jeter (tout en `try`).
- `vercel.json` a `cleanUrls: true` : `/app.html` redirige (308) vers `/app` ;
  mettre en cache `/app`, jamais `/app.html` (une réponse redirigée ne sert
  pas une navigation). **Et une réécriture doit viser `/app`, jamais
  `/app.html`** : avec `cleanUrls`, Vercel range le fichier sous `/app`, et
  la destination `/app.html` (comme `/index.html` avant elle) ne trouve
  rien — toutes les adresses de l'app répondaient 404 (vérifié sur la
  préversion le 2026-10-26 ; la production l'avait déjà, depuis l'arrivée
  du routeur). `vite preview` ne le voit pas : vérifier sur une préversion
  (`curl` avec le lien de partage de Vercel) à chaque changement de
  `vercel.json`.
- `main` bouge pendant qu'on travaille (d'autres sessions y poussent) :
  `git fetch origin main` et fusionner avant de pousser, jamais forcer.
- La CSP est en *Report-Only* : un script en ligne y est signalé, pas bloqué
  (l'empreinte sha256 de l'aiguillage y est ajoutée, vérifiée par un test).
