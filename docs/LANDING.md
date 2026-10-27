# La page d'accueil publique — fichier de reprise

> **Nouveau Claude qui reprend ce chantier :** lis ce fichier en entier (il
> est fait pour ça), puis `git log --oneline -15` sur la branche, puis va à
> **« Où on en est »** et fais la première case non cochée. Coche au fur et à
> mesure, **commit + push après chaque case** (le conteneur peut disparaître
> à tout moment) : c'est ce fichier qui permet à la session suivante de
> reprendre sans rien relire d'autre. Branches de travail :
> `claude/landing-page-seo-i6vu41` (tours 1 à 3), puis
> `claude/funny-ramanujan-2wpbxi` (tour 4) ; chaque fois `main` ensuite,
> règle 7 de CLAUDE.md, une fois `npm run check` et les e2e verts. Les tours
> commencent à « Où on en est » ; le dernier non coché est le travail en
> cours.

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
| Le logo dans l'app (tour 3) | le logo vectoriel du site partout : barre latérale, barre du haut (au téléphone le logo seul), écran d'ouverture ; les onglets du téléphone gardent leur titre en haut, sans logo (demandé le 2026-10-27) ; icônes installées refaites depuis `public/site/icone.svg` | l'app installée et le site ont enfin la même marque |
| Les titres de l'app (tour 3) | la serif du site pour les titres de page (`.hero`, `.bar h1`, le titre d'un livre), le reste en sans-serif ; un signet de la couleur de la matière sur la fiche lue | une seule voix du site à l'app ; l'espace prof était seul en serif |
| Le vocabulaire (tour 4) | « un livre de flashcards », des **pages** avec la question au **recto** et la réponse au **verso** ; jamais « fiche » (`test/site.test.js` le refuse) | une fiche de révision est un résumé écrit : le mot trompait ; « flashcards » dit ce que c'est, le livre reste la langue de l'app (et un *folio* est une feuille) |
| Folio Campus (tour 4) | une marque (le logo sur son carré de papier, une toque en écusson, « Folio *Campus* »), seule en tête du bloc (l'étiquette « Pour les établissements scolaires » retirée le 2026-10-27, à la demande) ; « Dix minutes pour ouvrir Folio à tous vos élèves et professeurs » | le bloc ne disait pas qu'il s'adressait à un établissement, ni que les dix minutes étaient celles du déploiement |
| Les deux moteurs (2026-10-27) | **Memory Engine Lite** (Folio gratuit) : la répétition espacée avec les réglages par défaut, pour tout le monde. **Memory Engine Ultra** (Folio+ et Campus, « le meilleur moteur au monde » de la page) : il se règle sur la mémoire de chacun (réoptimisation des paramètres, `fsrsAuto`) et étale la charge (l'équilibreur, `equilibrer`). Section du moteur : deux cartes sous le graphique, qui montre Ultra ; tarifs, tableau (« Moteur de révision »), FAQ | « un moteur un peu moins fort en gratuit, avec des noms très tech (« Ultimate engine »), pour pousser à la conversion » ; la différence est réelle (des réglages personnels contre ceux par défaut), sans rien promettre de faux. À brancher dans l'app avec le paiement : en gratuit, ni `fsrsAuto` ni équilibreur |
| La démo élève, 5 livres (2026-10-27) | Léa a 4 livres à elle (les devoirs ne comptent pas) : on peut en créer un ; à 5, « Nouveau livre » se grise partout (bouton rond du téléphone compris) et ouvre la fenêtre « Ta bibliothèque est pleine » (`html.en-demo-plein`, recalculé à chaque rendu par `ui/demo.js`) | « la démo bloque à 5 livres max, puis grise Nouveau livre » |
| Écrans publics de l'app (2026-10-27) | la vitrine de la connexion (et de l'inscription, de la carte élève) montre des pages de livre comme l'app (couverture, filet, matière, signet ; teintes du nuancier par `sty(PALETTE[…])`), la demande de démo porte la marque Folio Campus de la page d'accueil (`.dd-marque`) | « /essayer et /connexion à la nouvelle colorimétrie, n'oublier rien » |
| Folio et Folio+ (2026-10-27, après le tour 4) | Folio gratuit : le Memory Engine Lite, **5 livres** (écrire, coller, importer), hors ligne et synchro, défis, clubs, amis. Folio+ : **toute l'IA** (cours, photo, PDF, 50 par mois), les livres sans limite, **QCM et associations**, **images et sons**, les nouveautés. La récitation reste gratuite. Dans la démo d'un élève, ce qui est Folio+ se grise (« + » tracé, fenêtre « ce que ça ferait ») ; la vraie app ne bride rien encore | « je veux vraiment des contraintes sur Folio, et être obligé de passer à Folio+ » ; le bridage dans l'app viendra avec le paiement |
| Le journal et le graphique (2026-10-27) | Le graphique du moteur trace **les deux moteurs** : Ultra en plein (96 % à un an), Lite en pointillés (69 % à un an, des creux vers 60 % : réglé le 2026-10-27 pour que l'écart se voie — l'app devra brider Lite d'autant avec le paiement, sinon le graphique promet plus que vrai), sans révision dessous (16 %) ; deux cartes courtes (« La version allégée d’Ultra » / « Le meilleur moteur de révision espacée au monde… entraîné sur des centaines de millions de révisions »). Le journal de Folio gratuit garde la série, la régularité et le rythme ; mémoire, pause, heures, matières, livres et pages qui résistent se floutent sous « Avec Folio+ » dans la démo d'un élève. Le tableau comparatif les reprend un par un sous l'intertitre « Tes statistiques » (série, régularité et rythme pour tous ; les six autres en Folio+ et Campus), et l'offre Folio+ dit « Toutes tes stats ». La règle de chaque offre vit dans `src/offres.js` | « mets aussi le moteur Lite avec de moins bonnes stats », « floute certaines stats, sauvegarde pour quand on codera l'achat et les licences » ; « des milliers de paramètres » n'est pas écrit : FSRS en a une vingtaine, entraînés sur des centaines de millions de révisions — c'est ça qui est vrai |
| Sur tous tes écrans (2026-10-27) | Une section `#telecharger` entre les tarifs et la FAQ : une carte par appareil (iPhone et iPad, Android, Mac, Windows), le geste d'installation par le navigateur, l'appareil qu'on tient en premier et « Installer Folio » en un clic quand le navigateur le permet ; le lien d'un magasin apparaît seul une fois l'app publiée (`MAGASINS`, `src/plateformes.js`). Une question de FAQ (« Folio existe-t-il en application ? »), un lien « Télécharger » au pied de page. « Passer à Folio+ » mènera à l'écran Folio+ de l'app la vente ouverte (`data-vente-an`/`data-vente-mois`, docs/VENTE.md) | « payer sur le site, et télécharger sur App Store, Play Store, Mac, Windows » ; aucun magasin n'est encore promis sur la page : seulement ce qui marche aujourd'hui |
| Appels à l'action (tour 4) | « Commencer gratuitement » (héros, après les tuiles, appel final), « Équiper mon établissement » en fin de Campus, l'inscription toujours dans l'en-tête du téléphone ; dans la démo, le geste d'après selon le rôle ; rien de faux (ni compte à rebours, ni « le plus choisi », ni avis inventés) | pousser à l'achat et à la démo sans site toxique |
| Les couleurs de l'app (2026-10-27, hors tour) | une couleur, un travail (`src/couleurs.js`) : l'**azur** de la page d'accueil dit tout ce qui se compte (journal, profil, classement, espace prof), les états jugent, un **nuancier de 14 reliures** relie une matière ; un livre a un dos plein et une couverture teintée, la fiche lue le papier de son livre, le nom de sa matière et un grand signet ; une classe a un carré, un club un écusson | « des couleurs dans tous les sens », des livres « trop blancs », un signet « pas assez reconnaissable » : les liserés de gauche du tour 3 sont devenus des dos de reliure. Les affiches du site sont à rephotographier (`node tools/affiches.js`) |

## Architecture de la page (fichiers)

- `index.html` — la page : tout le texte en HTML statique (les moteurs le
  lisent sans JS), métadonnées (titre, description, canonique, Open Graph,
  Twitter), données structurées JSON-LD (Organization, WebSite,
  SoftwareApplication avec ses offres, FAQPage), l'aiguillage en ligne,
  le logo en « sprite » (entre `<!-- logo:debut -->` et `<!-- logo:fin -->`,
  réécrit par `tools/logo.py`) et les icônes (tracés Lucide). Sections, dans
  l'ordre : en-tête collant · héros (la pile qui se pose, le titre mot par
  mot, un portable qui se redresse au défilement, un téléphone, des pages
  qui flottent et se retournent, et **la pile qu'on note** : Encore et
  Difficile l'envoient à gauche, Correct et Facile à droite, les suivantes
  avancent, « Revient dans 4 jours » ; elle se joue seule tant qu'on n'y
  touche pas) · matières qui défilent · le moteur (« au monde », sans
  sous-titre, un an de mémoire de cinq pages avec et sans Folio, une tête de lecture
  qu'on promène, les deux chiffres dans la légende) · « Du cours au
  concours » (six tuiles animées, l'IA dans la première) · Folio Campus
  (fond sombre : trois scènes animées, « Deux codes », « Chacun entre »,
  « Tout se suit », puis les trois rôles, élève, professeur, référent de
  l'établissement, chacun son écran sur l'ordinateur, le même au téléphone
  posé contre lui pour l'élève et le professeur, et « Essayer cet
  espace ») · tarifs
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
  et `src/defi.js`, jamais réécrites). Aucun appel à la base. Les rôles
  de Campus montrent leur écran sur l'ordinateur et le même au téléphone
  posé contre lui (`#tel-campus`, ses écrans portent `data-onglet` = le
  panneau de leur rôle) ; un rôle sans écran de téléphone (le référent)
  range le téléphone (`.range`).
- `src/site/courbes.js` — le modèle du graphique, pur et testé
  (`test/site.test.js`) : courbe d'oubli de FSRS, révision quand le rappel
  tombe à 90 %, temps en racine carrée ; site.js en tire les tracés.
- `public/site/` — `logo.svg`, `icone.svg`, `og.jpg` (partage 1200×630),
  `affiches/{pc,mobile,eleve,prof,referent,eleve-mobile,prof-mobile}.webp` (16 à 52 Ko) et leurs variantes
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
node tools/affiches.js og       # l'image de partage seule (son texte et sa page sont dans le script)
node tools/affiches.js prof-mobile eleve-mobile   # quelques affiches, par leur nom (ni captures du manifeste, ni image de partage)
npm run build                   # les fichiers de public/ ne sont copiés qu'au build
```

### Insérer les vidéos (pour l'utilisateur, plus tard)

Chaque emplacement est un `<div class="ecran" data-ecran="pc|mobile|eleve|prof|referent|eleve-mobile|prof-mobile">`
dans `index.html`, qui contient l'affiche (`<img class="affiche">`) et un
`<video class="video" data-src="">`. Pour en remplir un : déposer
`public/site/videos/<nom>.mp4` (H.264, **muette**, 8 à 15 s, faite pour
tourner en boucle, ≤ 2 Mo ; 1440×900 pour un ordinateur, 780×1688 pour un
téléphone, comme les affiches), puis écrire son chemin dans le `data-src`
du `<video>` correspondant (`data-src="/site/videos/pc.mp4"`). site.js la
charge quand elle arrive à l'écran, la joue, la met en pause hors écran, et
l'affiche reste dessous tant qu'elle n'a pas démarré. Rien d'autre à
toucher. Les sept : `pc` (héros, ordinateur : une séance de révision),
`mobile` (héros, téléphone : la bibliothèque), `eleve`, `prof` et
`referent` (Folio Campus, l'ordinateur de chaque rôle), `eleve-mobile` et
`prof-mobile` (Folio Campus, le téléphone posé contre l'ordinateur : les
devoirs à faire de l'élève, le tableau de bord du professeur).

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
- [x] T2.13 Vérifs (check, e2e, Lighthouse, captures, préversion Vercel), docs, push branche + `main`.

Fait le 2026-10-26 au soir : `npm run check` vert, e2e 69 parcours verts
(un intermittent dans `espace-prof.e2e.js`, la feuille « J'ai un code »
d'un élève, rattrapé par la reprise de Playwright : 12 sur 12 sur `main`,
34 sur 36 sur la branche, aucun lien trouvé avec ce tour), Lighthouse
**100 / 100 / 100 / 100** au téléphone et sur ordinateur (le filtre
`drop-shadow` posé sur la pile animée coûtait 2 points : retiré), captures
à 390, 768, 1024 et 1440 px relues ; la préversion Vercel vérifiée dans un
vrai navigateur, CSP comprise (la pile, le graphique, « Retour » de
`/essayer` vers le site, `/connexion`), toutes les adresses de l'app en
200, le logo dans le cache du service worker.

## Tour 3 : les visuels de l'app (2026-10-26, nuit)

La demande : « refaire les visuels de l'app aussi, de toutes les apps
(prof, élève, référent, admin), pour mieux incruster le logo et réparer les
petites erreurs visuelles ; un visuel parfait, pro et mature ; puis changer
les visuels de la page d'accueil avec les nouveaux écrans ». Capture jointe :
la ligne d'un défi dans le Cercle des lecteurs, dont le bouton « Jouer »
(rond rose, triangle rouge, « Jouer » dessous) déborde de sa ligne.

- [x] T3.1 L'état des lieux : chaque écran des quatre rôles, à 390 et 1440 px, relu ; la liste des défauts ci-dessous.
- [x] T3.2 Le logo dans l'app : la barre latérale, les en-têtes du téléphone, l'écran d'ouverture, les icônes installées.
- [x] T3.3 La charte affinée, la même partout (typographie, espacements, cartes, boutons), dans le budget de poids : titres de page dans la serif du site (Charter avant Palatino), signet de la matière sur la fiche lue, fond de l'ouverture et du manifeste = celui de l'app (#F6F5F1) ; CSS au démarrage 23,6/25 Ko.
- [x] T3.4 Les défauts corrigés, un par un (dont le bouton « Jouer » d'un défi : marge rendue ET triangle dimensionné, il n'avait pas de taille). Les liserés de gauche (livre, ligne, classe) restent : ce sont ceux des fiches de la page d'accueil ; seul le bandeau du haut de la fiche lue est devenu un signet.
- [x] T3.5 Les affiches de la page d'accueil et l'image de partage refaites avec les nouveaux écrans (et les captures du manifeste, `public/shots/`, qui montraient encore « Mes paquets »). `tools/affiches.js` photographie à 10 h (horloge de Playwright), la souris écartée ; l'affiche élève montre la page de sa classe, celle de l'ordinateur une fiche de « La cellule ».
- [x] T3.6 Vérifs (check, e2e, Lighthouse, captures), docs, push branche + `main` : 431 tests, e2e 69/69 (trois parcours attendaient « Bonjour, Marc » et échouaient chaque soir : ils acceptent « Bonsoir »), Lighthouse 100×4 (téléphone et ordinateur).

Défauts relevés (T3.1), sur 79 captures (`e2e/zz-visuels.e2e.js`, non
versionné : élève, professeur et référent dans la démo, l'éditeur sur la
base locale ; `SHOTS=dossier ROLES=eleve,prof,ref,admin`) :

Partout
1. Le logo : la barre latérale, la barre du haut (professeur, référent,
   éditeur) et leur version téléphone portent l'ancienne icône PNG
   (`/icons/icon-192.png`) ; l'élève au téléphone n'a aucun logo ; les
   icônes installées (`public/icons/`) sont l'ancienne image.
2. Deux voix : la page d'accueil et les écrans publics titrent en serif,
   l'app en sans-serif, sauf l'espace professeur (« Bonsoir, Marc »,
   « 2nde B », « Agenda » en serif).
3. Les liserés de couleur (haut de la page lue, gauche d'un livre, d'une
   page en création, d'une classe) sont des bordures sur un coin arrondi :
   ils s'amincissent en croissant aux coins.

Élève
4. Cercle : la ligne d'un défi n'a plus de marge intérieure (le sélecteur
   `.cc-defi,` se retrouve collé au `.cc-qui` d'après un commentaire) :
   « Jouer » est coupé par le bord arrondi de la liste (la capture).
5. Classement (Cercle, Amis) : le nom centré au-dessus de la barre, les
   infos à gauche ; la colonne des chiffres bouge d'une ligne à l'autre.
6. Camarades : « Ajouter » en texte nu à côté des visages.
7. Profil d'un lecteur : un filet vide en tête de la carte « Signaler /
   Bloquer » ; la barre latérale allume « Mes classes » (`railOn` :
   `profil` commence par `prof`).
8. Courrier : toucher une lettre de la démo ne l'ouvre pas
   (`openMail(+id)` donne NaN sur un identifiant de la base locale).
9. Téléphone, démo : le bandeau « Démo » cache le bouton « + » des livres.
10. Journal au téléphone : la grille de régularité coupée net à gauche
    (« in » pour « juin »).
11. Mes classes : « Léa MARTIN » collé au titre « À faire ».
12. Démo : des titres avec un tiret cadratin (« Espagnol — vocabulaire »,
    « Irregular verbs — série 1 »…), repris par les affiches du site ; et
    aucun défi dans le Cercle de Léa.

Professeur
13. Sous chaque élève d'une classe, un « @ » seul (pas de pseudo).
14. Devoirs d'une classe : « 4pas ouvert », l'espace manque.
15. Agenda : les pastilles coupées net, sans points de suspension ; la
    semaine du tableau de bord réduit un devoir à cinq lettres.
16. Téléphone : les chiffres du tableau de bord et d'une classe débordent à
    droite (« Jam… », « Réussite moyenn ») ; les filtres de la liste coupés
    (« À j… »).
17. Téléphone, Livres : courrier et réglages en double (barre du haut et
    en-tête de la page).

Référent
18. Classes : « groupe · » suivi de rien.

Éditeur
19. Téléphone : les chiffres du haut débordent (le quatrième coupé), le
    titre et « Établissement » se serrent sur une ligne.

## Tour 4 : la page suit la nouvelle charte (2026-10-27)

La demande : « une session a changé la colorimétrie de l'app ; reprends la
page d'accueil pour tout faire correspondre (nouvelles captures, nouvelles
couleurs des pages…) ». Et, point par point :
- élever « Il apprend comment tu oublies, fiche par fiche, et te repose
  chacune juste avant que tu la perdes » ;
- « L'IA transforme ton cours en fiches » : **pas « fiches », c'est
  trompeur** (en français, une fiche de révision est un résumé écrit) ;
  garder le champ lexical de l'app (le livre) tout en faisant comprendre que
  ce sont des flashcards ;
- « Folio Campus · établissements » : l'élever, et **montrer que ce bloc est
  B2B**, destiné aux établissements (un logo Folio Campus, par exemple) ;
- « Cartes élève sans e-mail » (capture jointe : la tuile à l'icône QR rose)
  n'est pas clair : une autre fonction, claire, sans technique ;
- « Prêt en dix minutes, sans rien installer » : on doit comprendre que
  c'est **le déploiement dans l'établissement** qui est rapide ;
- « Gratuit pour réviser. Folio+ pour aller plus vite. » : le **« + » en
  arc-en-ciel**, comme « tout. » dans le titre du héros ;
- **les appels à l'action en avant, sans site toxique** : pousser à l'achat
  (Folio+) ou à la démo (établissements), et une démo qui donne envie de
  payer.

Le vocabulaire retenu : **« un livre de flashcards »**, dont chaque
**page** a la question au **recto** et la réponse au **verso** — recto et
verso sont des mots du livre (un *folio* est une feuille, numérotée au
recto), « flashcards » dit tout de suite ce que c'est. « Fiche » ne
s'écrit plus nulle part sur la page.

- [x] T4.1 La charte de l'app sur la page : chaque fiche dessinée (héros, pile qu'on note, tuiles, appel final) devient une **page de son livre** (le papier de la couverture `c`, son filet `b`, la matière en petites capitales et la pastille de sa reliure `d`, le grand signet) ; les matières qui défilent sont de petits livres (dos et couverture) ; les teintes viennent du nuancier (`src/couleurs.js`) ; ce qui se compte est en azur (calendrier du journal, avancement d'un devoir, podium) ; les états en `--ok`/`--ko`/`--am` ; les boutons de note comme dans l'app (papier blanc, mot en couleur, délai dessous) ; les affiches et l'image de partage vérifiées, refaites si besoin. **Fait** : quatorze règles `[data-teinte=…]` dans `site.css` (vérifiées contre `src/couleurs.js` par `test/site.test.js`), le signet partagé (`--sw`, `--sr`), la couleur d'un visage en `--j` (plus en `--c`, qui est désormais la couverture), les médailles de l'app sur le podium (chiffre à l'encre : en blanc sur l'or, 2,3:1), le papier de la page `#F6F5F1` comme l'app, la serif de l'app (Charter avant Palatino). Les affiches datent d'après le changement de couleurs (d078484) : gardées ; l'image de partage se refait avec les nouveaux textes (T4.2).
- [x] T4.2 Le vocabulaire : « livre de flashcards », « page », « recto/verso » partout (chapeau, `description`, Open Graph, Twitter, JSON-LD, FAQ, `aria-label`, légende du graphique, tarifs, tableau). **Fait** : chapeau « L’IA fait de ton cours un livre de flashcards. Folio te repose chaque page juste avant que tu l’oublies. » ; la tuile de l'import dit ce qu'est une page (« Une question au recto de chaque page, la réponse au verso. ») ; une question de plus en tête de la FAQ, « C’est quoi, un livre de flashcards ? » (et dans le JSON-LD, qui doit rester identique à la FAQ visible) ; l'image de partage refaite (`node tools/affiches.js og`, nouvelle option) avec ce texte et une page d'histoire dessinée comme dans l'app. `test/site.test.js` refuse désormais « fiche » dans le texte affiché.
- [x] T4.3 La phrase du moteur, élevée : « Il apprend ta mémoire, page après page, et te rend chacune au moment où elle allait s’effacer. » (« juste avant » reste la promesse du héros ; ici, ce que fait le moteur, sans surpromettre un « instant précis »). Retirée au tour 5 (T5.2) : le titre seul.
- [x] T4.4 Folio Campus : la marque (logo + « Campus » dans la lumière de la marque) et une étiquette « Pour les établissements » ; « Déployé dans tout votre établissement en dix minutes » ; « Cartes élève sans e-mail » remplacée par une fonction claire (tuile, offre, tableau) ; un appel à la démo en fin de bloc. **Fait** : la marque (`.campus-marque` : le logo sur son carré de papier, une toque en écusson dans la lumière de la marque, « Folio *Campus* »), la même en petit sur l'offre des tarifs ; l'étiquette « Pour les établissements scolaires », posée puis retirée à la demande (la marque seule, plus d'air dessous) ; « Dix minutes pour ouvrir Folio à tous vos élèves et professeurs, sans rien installer. » ; « Les points faibles de la classe, repérés » (le « Ce qui bloque » d'un devoir dans l'espace professeur : ce que la classe rate le plus, sans nom d'élève) dans les atouts et le tableau, « Mise en place accompagnée » dans l'offre ; en fin de bloc « Équiper mon établissement » (vers `/demande-demo` ; un autre nom que « Demander une démo », que le parcours e2e cherche seul dans `#campus`) et le prix en une ligne ; la FAQ dit aussi les dix minutes.
- [x] T4.5 Le « + » de Folio+ dans le dégradé de « tout. » (titre des tarifs, offre, tableau). **Fait** : `.plus`, en biais et en sans-serif épaisse (sur le trait fin du « + » de la serif, le dégradé ne montrait que son violet) ; la version claire sur l'offre sombre.
- [x] T4.6 Les appels à l'action : un seul geste principal par écran, honnête (« Commencer gratuitement », « Demander une démo »), rien de faux (ni compte à rebours, ni « le plus choisi »), le téléphone garde toujours un bouton d'inscription en vue. **Fait** : « Commencer gratuitement » dans le héros, après les six tuiles (`.relance`, avec « Voir Folio+ ») et dans l'appel final (où « Essayer sans compte » devient le second bouton, « J'ai un code » passe en lien) ; au téléphone, l'en-tête collant garde « Créer un compte » et « Se connecter » passe dans le menu (sous 360 px, le logo seul) ; « Équiper mon établissement » en fin de bloc Campus (T4.4).
- [x] T4.7 La démo donne envie de payer : son bandeau propose le geste suivant selon le rôle (créer un compte, demander une démo pour son établissement), une fonction grisée dit ce qu'elle ferait et comment l'avoir ; dans le budget du morceau de la démo. **Fait** : le bandeau porte « Créer mon compte » (élève) ou « Essayer dans mon établissement » (professeur, référent, vers `/demande-demo`), dans le dégradé de la marque, la seule couleur du bandeau ; au téléphone, libellé court, « Quitter » en icône, « Prof » dans le choix du rôle, « Recommencer » caché sous 380 px. Toucher Cours, Photo ou Fichier ouvre une fenêtre (« L’IA écrit le livre pour toi », « Ton cahier en photo, et c’est un livre », « Ton PDF devient un livre ») : ce que ça ferait, l'offre qui l'ouvre (3 cours par mois gratuits, 50 avec Folio+ ; photo et PDF avec Folio+, dès 2,50 € par mois), « Créer mon compte », « Voir Folio+ », « Continuer la démo ». Un « + » dessiné sur Photo et Fichier. Partir par ces liens efface la démo comme « Quitter ». Morceau de la démo : JS 26,7/30 Ko, CSS 1,6/3 Ko.
- [x] T4.8 Vérifs (check, e2e, Lighthouse, captures 390 et 1440 px), docs, `main` fusionnée, push branche + `main`. **Fait** : `main` fusionnée (les pseudos ; au téléphone les onglets sans la ligne du logo, d'où **les affiches refaites**, `node tools/affiches.js` ; la médaille de l'app redessinée, reprise sur le podium) ; `npm run check` vert (459 tests ; page 42,2/48 Ko ; démo JS 27,4/30, CSS 1,7/3) ; e2e 70 verts + 1 intermittent, `e2e/pseudo.e2e.js` (arrivé avec `main` : 1 échec sur 6 répétitions sur la branche comme sur `main` seule, sans rapport avec ce tour) ; Lighthouse sur ordinateur 100 / 100 / 100 / 100, au téléphone accessibilité, bonnes pratiques et SEO 100, performance 90 à 97 dans ce conteneur (la page d'avant le tour mesurée au même moment : 93 à 98 ; le temps de blocage varie d'un passage à l'autre avec la charge de la machine) ; les boutons de note ont pour nom leur texte (« Encore 10 min » : l'audit « label in name » échouait avec l'ancien `aria-label`) ; captures à 320, 390 et 1440 px relues (les pages de l'appel final, au téléphone, gardent la place de leur signet).

## Tour 5 : Campus au téléphone aussi (2026-10-27, soir)

La demande : « dans l'animation campus sur la projection élève/prof on voit
le PC avec l'app comme actuellement mais aussi un téléphone avec l'app bien
intégré, nickel, avec les deux visions pour montrer que mobile aussi ; aussi
enlève "Il apprend ta mémoire…", pas de sous-titre, recadre, et c'est tout ».

- [x] T5.1 Folio Campus : à côté de l'ordinateur, un téléphone avec l'app, pour l'élève et le professeur. **Fait** : `#tel-campus` (le cadre du téléphone du héros) posé contre le coin de l'ordinateur, légèrement incliné, dans une `.campus-appareils` ; il change d'écran avec l'onglet (`data-onglet`, site.js), monte un temps après l'ordinateur quand le bloc arrive, et se range pour le référent (sa console est faite pour l'ordinateur ; au téléphone, elle n'a que ses codes et sa licence). Deux affiches neuves photographiées dans la démo, avec la barre d'état d'un iPhone : `eleve-mobile` (« Mes classes » : les devoirs à faire, ses classes) et `prof-mobile` (le tableau de bord ; la barre du haut, fixe, descend sous l'heure). Au téléphone, l'ordinateur reste centré et le téléphone déborde à droite. `tools/affiches.js` prend des noms d'affiches et marque les tutos de la démo comme vus (depuis le tuto v2, il s'invitait sur les affiches) ; la Folio Academy aussi (`tools/academie/moteur.js`). Parcours : `e2e/site.e2e.js` (le téléphone suit l'onglet, rangé pour le référent).
- [x] T5.2 Le moteur sans sous-titre : la phrase de T4.3 retirée ; le surtitre se coupe en deux lignes égales au téléphone (« Memory Engine Ultra · » / « le moteur de Folio+ »), le titre mène droit au graphique.
- [x] T5.3 Vérifs (check, e2e, captures 390 et 1440 px), docs, push branche + `main`. **Fait** : `npm run check` vert (page 46,1/48 Ko) ; `e2e/site.e2e.js` 9/9 ; suite complète 81 verts et 3 repassés au second essai (deux parcours du tuto et un de la démo, sans rapport avec la page : verts seuls, 6/6 en quatre fils parallèles pour le particulier ; ce conteneur mettait 6,8 min au lieu de 2 à 3) ; captures à 390 et 1440 px relues pour les trois rôles et le moteur ; l'entrée de la Folio Academy dans la démo vérifiée (élève puis professeur, aucun tuto ne s'ouvre).

## Ce qui reste à décider (l'utilisateur)

- **Les prix** affichés sont une proposition : Folio+ 4,99 €/mois ou
  29,99 €/an ; Campus 3 € HT/élève/an (300 € minimum, déjà dans
  PARCOURS.md). Ils vivent dans `index.html` (cartes `.offre`, attributs
  `data-an`/`data-mois`, tableau) **et** dans le JSON-LD du `<head>`.
- **La répartition Folio / Folio+** du tableau (IA, 5 livres, QCM et
  associations, images et sons ; Campus : l'IA pour les profs) n'est **pas
  encore appliquée** dans l'app ni côté serveur (M12.T2/T3) : seule la démo
  d'un élève la montre. Aujourd'hui tout compte a les mêmes droits et les
  mêmes quotas d'IA (`supabase/functions/ai`).
- **Le paiement** n'existe pas (M12) : « Passer à Folio+ » mène à la création
  de compte.
- **Le nom « Folio Campus »** pour l'offre établissement.
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
