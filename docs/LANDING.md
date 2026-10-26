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
| Où vit l'app | `app.html`, servie à **`/app`** (`cleanUrls` de Vercel) — **sans barre finale** | les URL relatives de l'app (`icons/icon-192.png`) restent justes |
| Utilisateurs existants | **aiguillage** en tête du `<head>` de la page d'accueil (script en ligne, avant tout) : session dans `localStorage['cartes.auth']`, app installée (`display-mode: standalone` / `navigator.standalone`), ou lien de l'app (`?carte= ?rejoindre= ?defi= ?club= ?go=`, `#s= #i=`, retours d'e-mail `#access_token` / `#error`) → `location.replace('/app' + search + hash)` | les icônes installées (start_url `/` sur iPhone, jamais mis à jour), les QR imprimés (`/?carte=`), les liens partagés : tout continue d'ouvrir l'app |
| Service worker | met en cache `/app` (la coquille de l'app) et `/` ; hors ligne, une navigation retombe sur `/app` | une app installée doit s'ouvrir hors ligne |
| Manifeste | `start_url: /app`, `id: /` inchangé, `scope: /` inchangé, raccourcis en `/app?go=…` | l'identité de l'app installée ne change pas |
| Liens fabriqués sur `SITE` | inchangés (`/?rejoindre=…` etc.) | l'aiguillage les fait suivre ; rien d'imprimé ne casse |
| Portes de l'écran de connexion | `?go=inscription`, `?go=carte`, `?go=essai` (essayer sans compte), `?go=demo` (demander une démo), `?go=cgu|vie|mentions` — sans session seulement, consommées par la porte des liens (`ui/liens-entrants.js` → `ui/raccourcis.js`) | les boutons de la page d'accueil ouvrent l'app au bon endroit |
| Polices | celles du système (le `--serif` de l'app pour les grands titres) | zéro requête externe, zéro traceur (M11.T6), cohérent avec l'app |
| Nom B2B | **Folio Campus** | court, va du collège à la prépa et à la fac |
| Prix B2C (proposition, **à valider par l'utilisateur**) | Folio : 0 € · **Folio+ : 4,99 €/mois ou 29,99 €/an** (2,50 €/mois, −50 %) | annuel nettement plus avantageux, sous la barre des 30 € |
| Prix B2B | **3 € HT par élève et par an, 300 € HT minimum**, démo gratuite 30 jours | déjà fixé dans `docs/PARCOURS.md` § 4.3 |
| Paiement | **pas encore branché** (M12 : achats Apple/Google via Capacitor) : « Folio+ » mène à la création de compte | ne rien promettre qui ne marche pas |

## Architecture de la page (fichiers)

- `index.html` — la page, tout le contenu en HTML statique (lu par les
  moteurs sans JS), métadonnées, JSON-LD, aiguillage en ligne.
- `src/site/site.css` — sa feuille de style (préfixe aucun : la page n'a
  pas l'app.css), `src/site/site.js` — ses animations, la bascule
  mensuel/annuel, la fenêtre « J'ai un code », le chargement des vidéos.
- `public/site/` — logo, image de partage (og 1200×630), affiches des
  vidéos ; **les vidéos iront dans `public/site/videos/`** (voir plus bas).
- `public/robots.txt`, `public/sitemap.xml`, `public/favicon.svg`.
- `app.html` — l'ancien `index.html` de l'app, inchangé à part
  `noindex`.

### Insérer les vidéos (pour l'utilisateur, plus tard)

Chaque emplacement est un `<video data-video="…">` dans `index.html`. Pour
en remplir un : déposer `public/site/videos/<nom>.mp4` (H.264, muet, 8–15 s,
en boucle, ≤ 2 Mo ; 1280×800 pour un PC, 390×844 pour un téléphone), puis
mettre le chemin dans l'attribut `data-src` du `<video>` correspondant. Les
noms prévus : `pc` (élève sur ordinateur), `mobile` (élève au téléphone),
`prof` (espace professeur, ordinateur), `referent` (console du référent,
ordinateur). Tant que `data-src` est vide, l'affiche (`poster`) s'affiche.

## Où on en est

- [x] 1. Fichier de reprise (celui-ci), pointé depuis CLAUDE.md et PROGRESS.md
- [x] 2. Logo SVG propre (`public/site/logo.svg` + `public/favicon.svg`), vérifié en image à 16, 32, 180, 512 px ; supprimer `Vectorized SVG.svg` et `public/icons/test svg` (779 Ko mis en cache par le service worker chez tout le monde !)
- [ ] 3. Bascule de l'app vers `/app` : `index.html` → `app.html`, vite multi-pages, `tools/budget.js` (démarrage lu dans `app.html`, plus une ligne « site »), service worker, manifeste, `vercel.json` (en-têtes, `app.html`), e2e (`goto('./')` → `goto('./app')`), portes `?go=` sans session
- [ ] 4. La page : structure HTML + SEO (titre, description, canonique, Open Graph, JSON-LD Organization/WebSite/SoftwareApplication/FAQPage, robots, sitemap)
- [ ] 5. La page : style et animations (héros, moteur, fonctions, vidéos, Campus, tarifs + tableau, FAQ, appel final, pied de page), mouvement réduit respecté
- [ ] 6. Les boutons branchés sur l'app (se connecter, créer un compte, j'ai un code, démo, demander une démo) + test e2e `e2e/site.e2e.js`
- [ ] 7. Affiches des emplacements vidéo : captures de l'app réelle en mode démo (élève téléphone et PC, professeur, référent)
- [ ] 8. Image de partage `public/site/og.png` (1200×630)
- [ ] 9. Textes passés au humanizer (aucun « — » ni « – » visible : `grep -c '—\|–'` sur le texte rendu = 0)
- [ ] 10. Vérifs : `npm run check`, e2e complets, Lighthouse (SEO 100, perf ≥ 90), écran 390 px et 1440 px
- [ ] 11. CLAUDE.md (architecture : `/` = site, `/app` = app) et PROGRESS.md à jour, push branche + `main`

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
  pas une navigation).
- La CSP est en *Report-Only* : un script en ligne y est signalé, pas bloqué
  (l'empreinte sha256 de l'aiguillage y est ajoutée, vérifiée par un test).
