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
| Couleur de la marque (tour 2) | une lumière **bleu pervenche → lilas → rose** (`--azur` #5A76D0, `--lilas` #9A78CF, `--rose` #D7648D), en halos qui dérivent et en filets, jamais en aplat ; un mot par titre en dégradé foncé (« tout. », « au monde. ») ; plus de vert ailleurs que pour « inclus » et « synchronisé » | demandé le 2026-10-26 : « moins bleu, bleu-rose léger, vraiment professionnel », la même logique en haut et dans l'encadré final |
| Sortir de l'app | quitter la démo, se déconnecter, « Retour » d'un écran public ouvert depuis le site → **le site** (`/`) ; `/connexion` seulement quand on veut se connecter. L'app installée (icône, Capacitor) reste sur sa connexion | demandé le 2026-10-26 ; `installee()` et `retourPublic()` de `src/ui/routeur.js` |
| Écrans publics de l'app | connexion (et inscription, carte élève), essai, demande de démo, mentions avant la connexion : habillés comme le site (`.pub`, la lumière sur `#app:has(> .pub)::before`, le logo `/site/logo.svg` qui ramène au site, titres en serif, cartes de verre) ; à partir de 900 px, la connexion a sa vitrine à gauche | « une cohérence, magnifique » ; le logo est le seul fichier de `site/` que le service worker garde (hors ligne) |
| L'ouverture de l'app | sans session et hors app installée, l'écran d'ouverture ne dure que le temps d'un fondu (450 ms) au lieu de 3 s | on arrive du site, qui vient de montrer la marque ; il n'y a ni compte ni livres à attendre |
| « Le meilleur moteur de révision au monde » | écrit tel quel (demandé) ; le graphique repose sur la courbe d'oubli de FSRS et une révision à 90 %, comme le moteur de l'app | l'allégation s'appuie sur FSRS, en tête des comparatifs publics d'algorithmes de répétition espacée ; à garder défendable si on la conteste |

## Architecture de la page (fichiers)

- `index.html` — la page : tout le texte en HTML statique (les moteurs le
  lisent sans JS), métadonnées (titre, description, canonique, Open Graph,
  Twitter), données structurées JSON-LD (Organization, WebSite,
  SoftwareApplication avec ses offres, FAQPage), l'aiguillage en ligne,
  le logo en « sprite » (entre `<!-- logo:debut -->` et `<!-- logo:fin -->`,
  réécrit par `tools/logo.py`) et les icônes (tracés Lucide). Sections, dans
  l'ordre : en-tête collant · héros (la pile qui se pose, le titre mot par
  mot, un portable qui se redresse au défilement, un téléphone, des fiches
  qui flottent et se retournent, et **la pile qu'on note** : Encore et
  Difficile l'envoient à gauche, Correct et Facile à droite, les suivantes
  avancent, « Revient dans 4 jours » ; elle se joue seule tant qu'on n'y
  touche pas) · matières qui défilent · le moteur (« au monde », une phrase,
  un an de mémoire de cinq fiches avec et sans Folio, une tête de lecture
  qu'on promène, les deux chiffres dans la légende) · « Du cours au
  concours » (six tuiles animées, l'IA dans la première) · Folio Campus
  (fond sombre : trois scènes animées, « Deux codes », « Chacun entre »,
  « Tout se suit », puis les trois rôles, élève, professeur, référent de
  l'établissement, chacun son écran et « Essayer cet espace ») · tarifs
  (bascule mensuel/annuel, trois offres, tableau comparatif) · questions
  (FAQ) · appel final · pied de page · fenêtre « J'ai un code ».
- `src/site/site.css` — son style (aucun préfixe : la page n'a pas
  `app.css`). Règles : n'animer que `transform`/`opacity` ; une apparition
  au défilement = classe `.rv` (site.js pose `.vu` ; sans site.js tout
  apparaît au bout de 3 s) ; ce qui tourne en boucle s'arrête hors écran
  (`.dort`) ; « mouvement réduit » coupe toutes les animations.
- `src/site/site.js` — ce qui bouge et répond : apparitions, en-tête,
  inclinaison du portable (`--p`), la pile du héros (`essai()`), le
  graphique du moteur (`moteur()`), calendrier du journal, vidéos (chargées
  et jouées seulement à l'écran), rôles de Campus, bascule des tarifs,
  fenêtre « J'ai un code » (règles des codes importées de `src/classe.js`
  et `src/defi.js`, jamais réécrites). Aucun appel à la base.
- `src/site/courbes.js` — le modèle du graphique, pur et testé
  (`test/site.test.js`) : courbe d'oubli de FSRS, révision quand le rappel
  tombe à 90 %, temps en racine carrée ; site.js en tire les tracés.
- `public/site/` — `logo.svg`, `icone.svg`, `og.jpg` (partage 1200×630),
  `affiches/{pc,mobile,eleve,prof,referent}.webp` (16 à 52 Ko) et leurs variantes
  `-petit.webp` (moitié de la taille, 7 à 21 Ko, servies aux petits écrans par `srcset`). **Exclu du cache
  du service worker** (l'app hors ligne n'en a pas besoin), sauf `logo.svg`,
  que les écrans publics de l'app affichent.
- `public/robots.txt`, `public/sitemap.xml`, `public/favicon.svg`.
- `app.html` — l'app (l'ancien `index.html`), `noindex`.
- `tools/logo.py` (le logo), `tools/affiches.js` (affiches + image de
  partage, depuis la démo sans compte), `test/site.test.js` (CSP, ordre du
  `<head>`, aucun tiret long, JSON-LD valide, le modèle du graphique),
  `e2e/site.e2e.js` (9 parcours : page au téléphone, boutons → bonnes
  adresses et bons écrans, « J'ai un code » classe et partie, aiguillage
  lien et session, `?site`, la pile qu'on note, les rôles de Campus,
  « Retour » qui ramène au site).

### Refaire les affiches et l'image de partage

```sh
npm run build && npx vite preview --port 4190 --strictPort &
node tools/affiches.js          # réécrit public/site/affiches/*.webp et public/site/og.jpg
npm run build                   # les fichiers de public/ ne sont copiés qu'au build
```

### Insérer les vidéos (pour l'utilisateur, plus tard)

Chaque emplacement est un `<div class="ecran" data-ecran="pc|mobile|eleve|prof|referent">`
dans `index.html`, qui contient l'affiche (`<img class="affiche">`) et un
`<video class="video" data-src="">`. Pour en remplir un : déposer
`public/site/videos/<nom>.mp4` (H.264, **muette**, 8 à 15 s, faite pour
tourner en boucle, ≤ 2 Mo ; 1440×900 pour un ordinateur, 780×1688 pour un
téléphone, comme les affiches), puis écrire son chemin dans le `data-src`
du `<video>` correspondant (`data-src="/site/videos/pc.mp4"`). site.js la
charge quand elle arrive à l'écran, la joue, la met en pause hors écran, et
l'affiche reste dessous tant qu'elle n'a pas démarré. Rien d'autre à
toucher. Les cinq : `pc` (héros, ordinateur : une séance de révision),
`mobile` (héros, téléphone : la bibliothèque), `eleve`, `prof` et
`referent` (Folio Campus, un par rôle).

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

## Tour 2 : les retours de l'utilisateur (2026-10-26, soir)

Mot pour mot résumés ; une case par retour, cochée seulement une fois vue
en capture (390 et 1440 px) et les tests verts.

- [x] T2.1 Fiches flottantes : tout le texte rentre (recto et verso de même taille, la plus grande des deux) ; aucune ne déborde, nulle part.
- [x] T2.2 « Ton cours devient un livre » : **ni Quizlet ni Anki écrits** (ni dans le tableau, ni dans la FAQ) ; ajouter **IA**, et mettre en avant que Folio est **boosté à l'IA**.
- [x] T2.3 **« Testé et validé en prépa »** au lieu d'« Éprouvé » (page, titre, image de partage, JSON-LD).
- [x] T2.4 Le haut : fond organique **plus marqué**, **moins bleu, un bleu-rose léger**, très professionnel, pour que le logo ressorte ; le fond organique, qu'il adore, un peu **accentué** partout.
- [x] T2.5 Héros : les boutons **Encore / Difficile / Correct / Facile jouables** — la fiche part à gauche (Encore, Difficile) ou à droite (Correct, Facile), les suivantes roulent ; une petite flèche « Clique pour tester ».
- [x] T2.6 Héros **au téléphone : rien de rogné**.
- [x] T2.7 Le moteur : **« Le meilleur moteur de révision au monde »**, une **micro-explication**, **sans les chiffres 9/10 et 4** ; un graphique **bien plus impressionnant**, qui montre la force du moteur.
- [x] T2.8 Défis : **« Entre amis, en classe, en club »** (pas seulement la classe).
- [x] T2.9 Folio Campus : **la facilité** (arrivée, création, gestion) **en animations**, sans explication technique ; **les trois rôles clairs** (élève, professeur, **référent de l'établissement**) sans gros texte.
- [x] T2.10 L'encadré noir final en **bleu-rose** comme le haut (plus de vert).
- [x] T2.11 Quitter la démo, revenir d'une page publique, se déconnecter : **retour à la page d'accueil** ; `/connexion` seulement quand on veut se connecter.
- [x] T2.12 **/connexion** (et /inscription, /carte-eleve), **/essayer**, **/demande-demo** refaites dans le style du site, « magnifiques ».
- [ ] T2.13 Vérifs (check, e2e, Lighthouse, captures, préversion Vercel), docs, push branche + `main`.

Où en est T2.13 (2026-10-26 au soir) : `npm run check` vert, e2e 69
parcours verts (un intermittent dans `espace-prof.e2e.js`, la feuille
« J'ai un code » d'un élève, rattrapé par la reprise de Playwright : 12 sur
12 sur `main`, 34 sur 36 sur la branche, aucun lien trouvé avec ce tour),
Lighthouse **100 / 100 / 100 / 100** au téléphone et sur ordinateur (le
filtre `drop-shadow` posé sur la pile animée coûtait 2 points : retiré),
captures à 390, 768, 1024 et 1440 px relues. Restent : la préversion
Vercel, puis `main`.

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
