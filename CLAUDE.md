# Folio — consignes pour Claude

Folio est une PWA de révision (flashcards + moteur FSRS d'Anki) vendue en
**B2C** (élèves, étudiants) et en **B2B** (licences établissement : élèves,
professeurs, référents, éditeurs — modèle « à la Pronote »). Tout ce qui est
écrit ici doit tenir quand un lycée entier se connecte le même matin.

Langue : **français** partout — code commenté, messages de commit, réponses.

## Où on en est : PROGRESS.md

`PROGRESS.md` est la mémoire du projet. Il tient l'état de 148 tâches
chiffrées, réparties en 26 missions et 3 phases.

**Protocole, à suivre à la lettre — il est fait pour coûter le moins de
lecture possible :**

```sh
sed -n '1,20p' PROGRESS.md            # où on en est (20 lignes suffisent)
grep -A20 '^## M03' PROGRESS.md       # le détail d'une mission
grep -n '^- \[ \].*\[P0\]' PROGRESS.md  # ce qui reste avant le lancement
```

Ne jamais relire le fichier entier. Mettre à jour = changer `[ ]` en `[x]`
sur la ligne concernée, puis réécrire le bloc ÉTAT (CURSEUR, FAIT, DERNIER).

Une tâche ne se coche que si **sa preuve tourne au vert**. La preuve est
écrite sur la ligne : une commande, un chiffre, un rapport. Pas « ça a
l'air de marcher ».

## Architecture réelle (à ne pas supposer autrement)

- **Build Vite, sans framework ni dépendance à l'exécution.**
  - `index.html` — écran d'ouverture inline, charge `/src/app.css` puis `/src/app.js`
  - `src/app.js` — **point d'entrée seulement** (27 lignes) : importe
    `src/core/coeur-sync.js` puis les 18 modules de `src/ui/`, chacun pour
    ses effets de bord (les autres modules y arrivent par leurs imports :
    `ui/creation.js`, `ui/eleve-classes.js`, `ui/prof-porte.js`, `ui/club.js`,
    `ui/cercle-feuilles.js`, `ui/defi-nouveau.js`, `ui/direct-porte.js`,
    `ui/jeton.js`, `ui/balayage.js`, et deux morceaux chargés à la demande, l'espace professeur
    et l'écran d'une partie en direct — voir plus bas).
  - `src/core/` — réseau et mutation d'état, **jamais de DOM ni de gabarit
    HTML** (M06.T4, preuve : `grep -rc "api(" src/ui/*.js` → 0 partout, sauf
    l'envoi des préférences dans `ui/import-cartes.js`, plus ancien, à sortir).
    `coeur-sync.js` (768 lignes — `api()`, auth, sync, undo, palette) et onze
    modules, un par domaine : `classement.js` (rôle, établissement, accueil
    selon le métier), `defis.js` (les défis « à son rythme »), `cercle.js`
    (clubs et salles en direct : lire, créer, rejoindre, inviter — tout par
    des fonctions de la base, jamais `groups`/`group_members` à la main ;
    refuse hors ligne), `direct.js` (la boucle d'une partie en direct :
    `salle_etat` relu chaque seconde, réponses, avancer — chargé avec l'écran
    de la partie), `visuels.js` (les jetons d'identité : cache local
    `folio.visuels.<uid>`, `visuels()` demandé une fois par session et par
    identifiant, regroupé par écran ; la réponse ne repeint que les jetons
    concernés, `surVisuels()` prévient qui en dépend),
    `ecran-groupe.js` (`statsPull`), `reglages-corbeille.js` (corbeille, amis,
    courrier, versions), `menus-c.js` (les quelques écritures posées
    à même le gestionnaire de clics), `carte-media.js` (upload média + rejeu
    FSRS depuis l'historique serveur), `espace-prof.js` (toutes les fonctions
    `prof_*` de l'espace professeur : lectures, `ecrire()` qui refuse hors
    ligne — une décision de gestion se prend contre l'état réel de la classe —,
    `repeindre()` qui ne repeint jamais sous les doigts de qui tape) et
    `eleve-classes.js` (« Mes classes » : `class_preview`/`class_join`,
    devoirs, `mon_compte`, `messageErreur`). L'ancien `core/etablissement.js`
    (console prof d'avant le 2026-10-24) n'existe plus.
  - `src/ui/` — les 18 écrans (rendu, DOM, `$.innerHTML`, menus, événements),
    même noms de fichier que leur pendant `core/` quand les deux existent
    (`ui/classement.js` ↔ `core/classement.js`, etc.) : `bibliotheque.js`,
    `carte-media.js`, `import-cartes.js`, `connexion.js`,
    `reglages-corbeille.js`, `defis.js`, `classement.js`, `etablissement.js`,
    `cercle.js`, `ecran-groupe.js`, `menus-a.js`, `menus-b.js`,
    `menus-c.js`, `revision.js`, `quiz.js`, `interactions.js`,
    `raccourcis.js` (raccourcis clavier pendant une révision, et les
    raccourcis d'ouverture `?go=…` — extrait d'`interactions.js` sur M06.T6,
    qui frôlait la limite de lignes une fois ses tables de dispatch posées),
    `onboarding.js`. `ui/etablissement.js` ne porte plus que la console du
    référent. **Navigation au téléphone** (2026-10-25) : `balayage.js` fait
    glisser d'un onglet à l'autre (Livres ↔ Classe ↔ Cercle des lecteurs,
    l'ordre de `ordreOnglets()` dans `bibliotheque.js`, le même que la barre)
    comme une app native — la voisine est rendue par sa vraie fonction d'écran
    (`vueOnglet(k)`, dont on intercepte le `$.innerHTML = …` : la page en cours
    ne quitte jamais le document) dans une couche fixe `.balai`, à sa position
    de défilement (`defilementDe`), puis `allerOnglet(k)` l'ouvre sans fondu.
    Souris ou fenêtre ≥ 900 px : rien ne glisse. Le « Retour » d'un livre
    ramène là d'où on l'a ouvert (`retourLivre()`, posé par `go('deck', …)`
    depuis l'accueil, la classe, le cercle, le journal, le courrier ou la
    recherche). Plus, depuis le 2026-10-24 : `creation.js` (l'**écran unique de
    création** d'un livre, sorti de `quiz.js` : titre et matière, puis les
    méthodes en onglets — Écrire, Coller, Fichier, Photo, Cours (l'IA),
    `comp.mode` — dont seule la choisie s'affiche, et une liste de pages
    commune à toutes ; photo, fichier et IA versent du texte tabulé dans une
    zone de vérification avant l'ajout, « Créer » prend aussi les pages en
    attente, un doublon se cherche dans le livre et dans la liste en cours ;
    « Coller » d'un livre ouvre l'onglet Coller : `resetComp({ mode: 'coller' })`),
    `eleve-classes.js` (l'écran élève
    « Mes classes », téléphone d'abord ; `consumeRejoindre()` pour les liens et
    QR `?rejoindre=CODE`, repris par `accueil()` une fois le rôle connu) et
    l'**espace professeur**, PC et téléphone : `prof-accueil.js` (tableau de
    bord, agenda, barre latérale ≥ 1100 px), `prof-classe.js` (une classe, 5
    onglets), `prof-feuilles.js` (toutes ses feuilles, une seule entrée `pf`
    dans la table de `menus-a.js`, laquelle dans `prof.feuille`),
    `prof-actions.js` (un seul écouteur `[data-pf]` sur le document ; chaque
    action reçoit `(data-id, data-v, bouton)`) et leur feuille de style
    `prof-espace.css`. Ces cinq-là forment un **morceau chargé à la demande**
    (`import()` dans `ui/prof-porte.js`, point d'entrée `ui/prof-espace.js`) :
    un élève ne les télécharge jamais, le service worker les met en cache
    avec le reste. **Rien d'autre ne doit importer `ui/prof-*.js`
    directement** — passer par `prof-porte.js` (`allerAccueil`, `donnerLivre`,
    `rejoindreCollegue`, les trois vues, `paintMenuProf`), sinon le morceau
    retombe dans le démarrage.

    **Le cercle** (refait le 2026-10-24) : des amis, des clubs, des défis —
    rien d'autre. `cercle.js` (l’écran « Cercle des lecteurs » : moi et mon jeton, « Lancer
    un défi », « Entrer un code », ce qui se joue en direct, les défis, mes
    clubs ; à côté le classement des amis et les amis ; et la page « Amis »),
    `club.js` (la page d'un club : bannière à son emblème et sa couleur,
    défis, classement de la semaine, membres ; trois onglets sur téléphone,
    tout d'un coup sur PC), `cercle-feuilles.js` (toutes ses feuilles — code
    d'une partie, créer/personnaliser/rejoindre/inviter un club, un membre,
    « Mon jeton » — une seule entrée `cc` dans la table des menus, laquelle
    dans `cercle.feuille`, un seul écouteur `[data-cc]` ; `consumeClub()` pour
    `?club=CODE`), `defi-nouveau.js` (« Nouveau défi » : avec qui — un club,
    une classe pour un prof, les amis, une salle ouverte —, quel livre,
    comment : en direct ou à son rythme). « Mes classes » n'est plus dans le
    cercle : onglet **Classe** à part, seulement pour qui en a une
    (`aUneClasse()` de `bibliotheque.js` — élève à carte ou d'établissement,
    professeur, ou compte personnel admis ou en attente dans une classe).
    **Une partie en direct** (façon Kahoot) : `direct-porte.js` (au
    démarrage : `ouvrirDirect`, `consumeDefi()` pour `?defi=PIN`) charge à la
    demande `direct-ecran.js` + `direct.css` (hôte projeté : code, QR,
    joueurs, énoncé, répartition, podium ; joueur au téléphone : quatre gros
    boutons couleur + forme). **Rien d'autre ne doit importer
    `ui/direct-ecran.js`** — passer par `direct-porte.js`.
    **Les jetons d'identité** : `jeton.js` dessine le visage de chacun, le
    même sur tous les écrans — `avatar(id, ident, taille)` (un rond : les
    initiales ou la figure choisie ; `ident` = le pseudo s'il y en a un,
    sinon le nom, pour qu'une personne ait les mêmes initiales partout),
    `blason(classeId)` et `blasonClub(club)` (un carré arrondi et un
    emblème — jamais un sigle tiré du nom), plus les grilles de choix.

    Aucun fichier, `core/` ou `ui/`, ne dépasse 800 lignes (les plus gros :
    `onboarding.js` 770, `core/coeur-sync.js` 768, `connexion.js` 744).

    Historique de la découpe (M06.T3 puis M06.T4) : la coupe en 18 modules
    a d'abord suivi les anciennes sections `/* ---------- nom ---------- */`
    (qui existent toujours dans chaque fichier — `grep -n -- "---------- " src/ui/*.js`
    avant d'éditer), sauf `paintMenu` (menu contextuel), qui à elle seule
    faisait 957 lignes : décomposée en 46 fonctions (`paintMenuSubject`,
    `paintMenuCard`...) réparties sur `menus-a/b/c.js`. La séparation
    core/ui qui a suivi était surtout une **relocalisation**, pas une
    réécriture : dans presque tous les écrans mixtes, les fonctions réseau
    (`xPull`, `xMake`...) étaient déjà des déclarations distinctes des
    fonctions de rendu (`xView`, `xSheet`) — il a suffi de les déplacer et
    de réécrire les imports, fichier par fichier, en revérifiant `npm run
    check` à chaque étape.
  - Chaque module (`core/` ou `ui/`) importe explicitement ce dont il a
    besoin des autres et de `src/data/etat.js` — aucune variable globale
    implicite entre modules, et rien n'empêche `core/` d'importer `ui/`
    (ex. `core/classement.js` appelle `render()` depuis `ui/bibliotheque.js`)
    ni l'inverse : la règle stricte est à sens unique, dans `src/ui/` on
    n'appelle jamais `api()`/`apiPage()`/`apiAll()` directement.
  - `src/icones.js`, `src/racine.js` — deux constantes sans la moindre
    dépendance (`I`/`svg`/`SWIPE`, `$`), sorties à part exprès, hors de
    `core/` et `ui/` : le graphe d'imports entre les modules ci-dessus a des
    cycles (deux écrans qui s'invoquent l'un l'autre, ou un écran `ui/` et
    son pendant `core/`), inévitables vu combien de choses se répondent
    dans cette app — mais une valeur utilisée par un module au niveau
    module (pas dans une fonction) doit venir d'un fichier qui ne peut
    jamais faire partie d'un cycle, sinon ES la trouve pas encore
    initialisée (`Cannot access '…' before initialization`, ou pire, une
    exception silencieusement avalée par un `try/catch` qui l'entoure —
    vu trois fois entre M06.T3 et M06.T4, la troisième ayant fait
    échouer `loadAuth()` à chaque démarrage sans jamais planter). Le même
    raisonnement vaut pour tout nouvel « utilitaire sans dépendance » :
    il va dans un fichier à lui, jamais dans un module qui a lui-même des
    imports — et toute constante lue par une fonction doit être déclarée
    avant le premier appel à cette fonction dans le fichier, pas seulement
    avant son usage syntaxique.
  - `src/data/etat.js` — tout l'état mutable de l'app (106 variables : `db`,
    `view`, `study`, `animate`, `mediaCache`...), une liaison vive ES
    (`export let`) par variable et un « setter » générique par variable pour
    la réaffectation (`setDb`, `setView`...) — lire ses champs reste direct (`db.decks.push`),
    seule une réaffectation complète passe par le setter (M06.T3/M06.T4)
  - `src/fsrs.js` — le moteur, pur et testé (`test/fsrs.test.js`)
  - `src/fusion.js` — fusion à trois versions d'un paquet (M03.T4), pur et testé (`test/fusion.test.js`, `test/concurrence.test.js`). **Branchée dans la synchro depuis le 2026-10-16** (`reconcile()` dans `src/core/coeur-sync.js`, appelée par `flush()` quand le contrôle de `rev` échoue et par `pull()` pour un paquet en attente) : la base commune est la dernière version serveur connue de chaque paquet (`bases` dans `src/data/etat.js`, clé `cartes.bases.<uid>` du stockage local). Serveur inchangé → envoi ; changé avec base → fusion sans rien demander ; changé sans base fiable → la boîte de choix (`raiseConflict`), jamais d'écrasement muet. Ne jamais redonner à un paquet en attente le `rev` du serveur sans passer par `reconcile()` : c'était l'écrasement silencieux corrigé ce jour-là (preuve : `e2e/deux-appareils.e2e.js` échoue sur l'ancien code)
  - `src/file.js` — construction de la file de révision : sélection, quota de cartes neuves, ordre (M01.T3), pur et testé (`test/file.test.js`)
  - `src/parseur.js` — parseur de cartes : collage, Quizlet, Anki texte brut, CSV/TSV, JSON (M01.T4), pur et testé (`test/parseur.test.js`)
  - `src/invariants.js` — les 12 invariants qu'une carte doit toujours respecter (S>0, 1≤D≤10, cohérence de l'état FSRS...), pour l'écran « Vérifier ma bibliothèque » (M04.T2) et la contrainte CHECK en base (M04.T3 : 7 contraintes `cards_*` sur `public.cards`, seulement celles que le moteur garantit par construction — une ligne refusée bloquerait la synchro de tout le paquet) — pur et testé (`test/invariants.test.js`). Attention : `n` compte les **réussites**, pas les passages (`grade()`, `fsrsReplayCard()`), donc une carte ratée d'emblée a une mémoire avec n = 0, et l > n est sain
  - `src/reparation.js` — réparation des cartes qui violent ces invariants, regroupées en 8 familles (`scanLibrary`/`repairLibrary`), branchée sur Réglages → « Vérifier ma bibliothèque » par `verifScan`/`verifRepair` (`src/core/reglages-corbeille.js`) — pur et testé (`test/reparation.test.js`). Le pont SM-2 → FSRS (`sm2State`) vit désormais dans `src/fsrs.js`, partagé avec `fsrsSeed()`
  - `src/doublons.js` — déduplication (M04.T4) : même recto ET même verso dans un même paquet, on garde la carte la plus avancée et on additionne les rechutes ; branchée sur « Vérifier ma bibliothèque » — pur et testé (`test/doublons.test.js`)
  - `src/sauvegarde.js` — export/import intégral de la bibliothèque (M04.T6) : format `folio-bibliotheque` v1, état d'apprentissage compris, sans `rev` ni marques d'écran ; restauré sous les mêmes identifiants sur le même compte, de nouveaux sur un autre (RLS) ; branché sur la feuille Sauvegarde (`backupData`/`backupRestore`, `src/core/reglages-corbeille.js`) — pur et testé (`test/export.test.js`)
  - `src/normaliser.js` — `norm()` (casse, espaces, apostrophes, ponctuation finale), sans aucune dépendance : lue par le noyau (`doublons.js`) et par les écrans (`ui/quiz.js` la réexporte)
  - `src/classe.js` — les règles d'une classe (2026-10-24) : forme d'un code (8 caractères, alphabet sans 0/O/1/I/L), lien `?rejoindre=`, texte de chaque statut d'inscription renvoyé par la base, état d'un élève, tris/recherche (sans accents), synthèses de classe et d'accueil, « à traiter », échéances sans décalage de fuseau, lecture d'une liste d'élèves collée (`lireListeEleves`, « NOM Prénom » ou « Prénom NOM »), nom propre (`nomPropre`), carte de connexion (`emailCarte`, `lienCarte`, `lireCarte`) — pur et testé (`test/classe.test.js`, 45 tests dont 4 fuseaux), employé par l'espace prof et « Mes classes ». Le sigle de classe et les teintes de classe d'avant sont partis le 2026-10-25 au profit des jetons (`src/jeton.js`)
  - `src/jeton.js` — les jetons d'identité (2026-10-25) : 12 couleurs (chacune ≥ 4,5:1 avec du blanc, vérifié), 20 emblèmes (classes, clubs), 38 figures (émojis, pour les personnes), le hachage stable qui tire un jeton par défaut de l'identifiant, les initiales (première lettre du premier et du dernier mot, jamais un chiffre en tête) — pur et testé (`test/jeton.test.js`). Rien n'est inventé à partir du nom : « CPGE ECP1 » donnait « CE1 » avec l'ancien sigle
  - `src/defi.js` — les règles d'un défi en direct : jeux (QCM, vrai ou faux, réponse écrite), durées, nombre de questions, fabrication des questions depuis un livre, code à 6 chiffres et lien `?defi=`, statuts de la base, phase et chrono (décalage d'horloge compensé), places et podium — pur et testé (`test/defi.test.js`)
  - `src/club.js` — un club : nom (2–40), devise (≤ 90), code d'invitation lisible et lien `?club=`, classements (places partagées, barre relative, ma ligne), médailles — pur et testé (`test/club.test.js`)
  - `src/qr.js` — encodeur QR sans bibliothèque (octets, niveau M, versions 1–10, `qrSvg()`), pour projeter le code d'une classe et imprimer les cartes de connexion — pur et testé (`test/qr.test.js` ; relu 10/10 par le décodeur d'OpenCV le 2026-10-24). Le SVG porte ses couleurs : `svg.qr{stroke:none}` (sinon le trait que l'app donne à tout SVG grossit les modules)
  - `src/app.css` — ~2 400 lignes ; l'espace professeur a la sienne, `src/ui/prof-espace.css` (~620 lignes, préfixe `pf-`, chargée avec son morceau), la partie en direct aussi (`src/ui/direct.css`, préfixe `dx-`) ; l'écran élève « Mes classes » est dans `app.css` (préfixe `el-`), le cercle aussi (`cc-`, `cl-` pour un club, `dn-` pour « Nouveau défi », `jt` pour les jetons). **Le moins de texte possible** (demandé le 2026-10-25) : des icônes et des chiffres plutôt que des phrases, aucun sous-titre explicatif sous un titre ou une carte, onglets du bas en icônes seules ; une explication vraiment nécessaire va dans une pastille « ? » (`hlp(clé)` et la table `HELP` de `ui/connexion.js`) ou un `title`, jamais en paragraphe sous l'élément. **Charte visuelle (refaite le 2026-10-24)**, sobre et la même partout : jetons dans `:root` (`--bg` #F6F5F1, `--bg2`, `--ink` #1D1C19, `--ink2`, `--soft`, `--card` blanc, `--hair`/`--line` pour les filets, `--edge` = filet intérieur de 1 px, `--ring` = halo gris du focus) ; titres en sans-serif (le serif reste réservé au texte des pages lues), surfaces blanches cernées d'un filet, ombres à peine visibles ; la couleur d'une matière (`--d`) ne vit plus qu'en liseré, pastille ou badge, jamais en aplat de carte. **Aucun contour noir** : `:focus` n'a pas d'outline, `:focus-visible` un trait gris clair (clavier seulement), les champs n'en ont pas du tout — c'est leur cadre qui s'éclaire (`:focus-within` + `--ring`). Sur ordinateur (≥ 900 px) : barre latérale de 236 px (entrées groupées en haut, Réglages et compte en bas), contenu centré à 1 120 px (1 240 ≥ 1 500 px), feuilles en boîtes de dialogue centrées, mises en page à deux colonnes (livre, création, bilan) ; une barre qui ne porte qu'un retour à l'accueil est masquée, la barre latérale y mène déjà. Plus de mode zen (retiré le 2026-10-25)
  - `src/sw.js` — modèle du service worker ; `vite.config.js` le fabrique au build
  - `public/` — fsrs.wasm, manifeste, icônes
  - `e2e/` — parcours de bout en bout Playwright (M07), nommés `*.e2e.js` pour que vitest ne les ramasse pas ; `playwright.config.js` construit puis sert le build de production (`vite preview`, port 4173), téléphone 390 px. Première fois sur une machine : `npx playwright install chromium`. Les parcours parlent à un **faux Supabase en mémoire** (`e2e/faux-supabase.js`, branché par `page.route`) : jamais à la vraie base, faute de préproduction (M13.T4) — il émule seulement ce que l'app emploie (auth, filtres PostgREST, `Range`, `rev` des paquets, `sync_deck_cards`, un cloisonnement par `user_id` des tables personnelles pour que deux comptes ne voient pas les livres l'un de l'autre) ; les fonctions des classes sont rejouées dans `e2e/faux-classes.js` (créer une classe, comptes à carte, salle d'attente, devoirs ; `faireProfesseur(store, email, nom)` pose le rôle), celles du cercle dans `e2e/faux-cercle.js` (amis, classement, clubs, salles en direct avec le même calcul des points, jetons ; `store.lectureMs` raccourcit les 3 s de lecture ; `semerCompte`, `semerPseudo`, `semerAmis`, `semerLectures`, `semerClub`, `semerJeton`) ; la RLS et le SQL se testent en base. Un compte sans rôle déclaré reçoit de `my_role` une réponse vide (la vraie dit « eleve ») : la visite guidée ne s'invite pas dans les parcours. `store.online = false` simule une coupure ; deux pages sur le même store = deux appareils du même compte, deux **contextes** (`browser.newContext`) = deux personnes. Gestes communs dans `e2e/aide.js`. Les captures de référence de `captures.e2e.js` (comparées seulement sur Mac) ont été retirées avec la refonte visuelle du 2026-10-24 : le premier `npx playwright test captures` lancé sur un Mac les réécrit (il échoue une fois en signalant les images manquantes) ; les regarder, puis les committer
  - `fsrs.wasm` — crate Rust `fsrs` 6.6.2 compilé (recette : `tools/BUILD-FSRS.md`). Ne jamais réécrire les formules à la main.
- **Vérification de types, en douceur** (`tsconfig.json`, M06.T8) : `tsc`
  relit le JS existant (`allowJs` + `checkJs`) sans qu'on ait besoin de
  migrer quoi que ce soit vers `.ts`, en mode permissif (`strict: false`) —
  seuls `src/core/`, `src/data/etat.js`, `src/icones.js` et `src/racine.js`
  sont dans `include`. Chaque écran de `src/ui/` porte en première ligne
  un `// @ts-nocheck` : sans lui, `tsc` les suivrait quand même (un
  fichier importé par un fichier vérifié entre dans le programme même
  hors `include`) et noierait le vrai signal (accès DOM non typés,
  `.dataset`, `.value`...) sous des centaines d'erreurs qui n'intéressent
  pas cette passe. Annoter un type qui ne se déduit pas de lui-même se
  fait en JSDoc (`/** @type {...} */`), jamais en réécrivant le fichier
  en `.ts`. Preuve : `npm run typecheck`.
- **Rendu** : état global dans `src/data/etat.js` (voir plus haut), `render()` (dans `src/ui/bibliotheque.js`) reconstruit l'écran depuis `view`. **C'est `<body>` qui défile, pas la fenêtre** (`html{overflow:hidden}`, contre le rebond iOS) : `window.scrollTo` n'y fait rien. `render()` replace lui-même le défilement à chaque changement d'écran (`placerDefilement()` : en haut, sauf le retour sur l'accueil ou le cercle, qui retrouvent leur position) — ne pas rajouter de `scrollTo` ailleurs, lire et écrire `document.body.scrollTop`. Le démarrage (`boot()`, dans `src/ui/onboarding.js`) est différé d'un micro-tick (`queueMicrotask`) exprès : appelé au fil de l'évaluation des modules, il pouvait tomber sur un module pas encore lié à cause des cycles ci-dessus.
- **Backend : Supabase** (projet `qqbzefpdeinlynjtarqr`, eu-west-1), appelé en `fetch` brut via `api(path, method, body)` — pas de SDK `supabase-js`.
  - Auth : `signIn` / `signUp` / `refreshToken` (un seul rafraîchissement à la fois — ne pas casser ce verrou). L'écran de connexion a trois portes : e-mail, création de compte, **« Carte élève »** (identifiant + code → `signIn(emailCarte(id), code)`) ; le QR imprimé sur la carte ouvre `?carte=identifiant-CODE`, consommé par `consumeCarte()` (`ui/connexion.js`) au tout début de `boot()` — il ne ferme un autre compte ouvert que si celui-ci n'a plus rien à envoyer, et retire le code de l'adresse. Un élève de classe (`isPupil()`) ne reçoit pas la visite guidée : il arrive sur ses devoirs.
  - Données : PostgREST (`/rest/v1/...`), RLS stricte `user_id = auth.uid()` + rôles établissement.
  - Cache local `localStorage`, écritures en file (`dirty`, `gone`) rejouées par `flush()`.
  - Edge Function unique : `supabase/functions/ai/index.ts` (Anthropic, quotas dans `ai_usage`).
- **Schéma** : uniquement par migrations dans `supabase/migrations/` (horodatage `YYYYMMDDHHMMSS_nom_en_francais.sql`). Jamais de changement de schéma à la main dans le tableau de bord.
  - **Fonctions `security definer`** : Postgres accorde `execute` à PUBLIC (donc à `anon`) à toute fonction créée — retirer `anon` seul ne sert à rien. Depuis `20261024122609`, les privilèges par défaut ne le font plus, mais chaque nouvelle fonction écrit quand même `revoke all ... from public, anon; grant execute ... to authenticated;` (rien pour les fonctions internes, ni pour une fonction de déclencheur : un déclencheur s'exécute sans ce droit — `20261024213744` l'a retiré aux deux qui l'avaient encore). Seule `shared_deck` reste ouverte à `anon`.
  - **Rejoindre une classe** (`20261024113815`, matrice des droits en tête du fichier) : uniquement par `class_preview(code)` / `class_join(code)` (l'ancienne `join_class` y renvoie). Elles **renvoient un statut au lieu de lever** quand l'essai doit être compté (une exception annulerait la ligne de `class_join_attempts`, et la limite de 10 codes faux/h ne verrait rien). Frontière d'établissement, salle d'attente (`class_requests`), exclusion (`class_bans`), places, durée, code changeable : tout est vérifié en base. L'élève ne lit plus la ligne `classes` (donc jamais le code).
  - **Avancement des devoirs** : calculé par le déclencheur `avancement_devoir` sur `reviews` (cartes `a:<devoir>:<rang>`), jamais écrit par l'app (plus aucune politique d'écriture sur `assignment_progress`).
  - **Comptes à carte** (`20261024125435`) : un professeur crée les comptes de ses élèves depuis une liste (`prof_creer_eleves`, 60 par appel, homonymes signalés) ; chacun a un identifiant `prenom.nom` (e-mail technique `identifiant@eleves.folio.invalid`, jamais affiché) et un code secret de 8 caractères qui est son mot de passe GoTrue, montré une seule fois (jamais stocké en clair ; `prof_nouvelles_cartes` en refait un et déconnecte l'ancien). Table `comptes_geres` (RLS : chacun ne lit que sa ligne). Le nom « Prénom NOM » d'un élève à carte ou d'établissement est **verrouillé en base** (déclencheur `lock_identite_scolaire`) : seul son professeur le corrige (`prof_nommer_eleve`). Un compte personnel qui rejoint une classe donne son vrai prénom et son nom (`class_join(code, prénom, nom)`, statut `nom` sinon). `mon_compte()` dit à l'app si le compte est géré.
  - **Clubs et parties en direct** (`20261024232855`, `20261024233015`) : un club se crée, se rejoint (code, 10 faux/h, 100 membres) et se gère par fonctions (`club_creer`, `join_group`, `club_membres`, `club_nouveau_code`, `mes_clubs`) ; un élève de classe n'en crée ni n'en rejoint. Une partie : `salle_ouvrir`, `salle_rejoindre` (statuts : ok, format, inconnu, trop, classe, club, exclu…), `salle_etat` (jsonb : ce que chacun a le droit de voir — jamais la bonne réponse avant la correction), `salle_repondre` (points calculés en base : 500 à 1 000 selon la vitesse depuis que CE joueur a vu les choix, + 50 par bonne réponse d'affilée), `salle_avancer` (idempotent, double clic sans effet), `salle_exclure`, `salle_fermer`, `salles_ouvertes`, `salles_terminees` ; purge quotidienne (`purge-salles-quotidienne`). Nom d'un joueur : « Prénom NOM » dans une salle de sa classe, « Prénom N. » pour un élève ailleurs, le pseudo sinon.
  - **Jetons d'identité** (`20261025111500`, correctif `20261025113100`) : `profiles.figure`/`teinte` et `classes.embleme`/`teinte` (clés `^[a-z]{2,16}$`, rang 0–11, contraintes CHECK). Une seule porte de lecture, `visuels(personnes, classes)` (200 et 100 au plus), qui ne rend un choix qu'à qui partage quelque chose (amis même en demande, club, classe — camarades, professeurs, salle d'attente —, partie en direct, référent de l'établissement) ; `mon_jeton(cle, rang)` pour soi (un élève à carte aussi : son nom reste verrouillé) ; `prof_jeton_classe(cid, cle, rang)` pour qui gère la classe. `voit_personne`/`voit_classe` sont internes : **révoquer aussi `authenticated`** (les privilèges par défaut de Supabase le lui donnent, révoquer PUBLIC et anon n'y touche pas).
  - **Tests SQL** : `supabase/tests/*.sql`, à lancer tels quels (MCP `execute_sql`) — tout se passe dans une transaction annulée, avec des comptes jetables et le vrai rôle `authenticated` (RLS et droits réels). `classes_securisees.sql` (56 cas), `identite_eleve.sql` (22 cas), `defis_direct.sql` (44 cas) et `jetons.sql` (23 cas).
- Réglages non-SQL (auth, storage, secrets, pg_cron) : `supabase/REGLAGES.md`, à tenir à jour.
- **Hébergement : deux cibles, un seul build.** Vercel est l'hébergement réel
  (domaine racine). GitHub Pages (`.github/workflows/pages.yml`, indépendant
  du contrôle qualité `ci.yml` — qui a deux jobs : `check` (lint, tests, build) et `e2e` (les parcours Playwright, ~2 min 20, M07.T7) — un avertissement de lint n'empêche pas de
  voir l'app tourner) sert à tester depuis GitHub, à l'URL
  `https://mcflyvpro-art.github.io/flashcard/` — un dépôt de projet, donc
  sous un sous-dossier, pas à la racine du domaine comme Vercel. `vite.config.js`
  pose le bon `base` (`/flashcard/` seulement quand la variable d'environnement
  `GITHUB_PAGES=true`, posée uniquement par ce workflow) et le propage au
  service worker (`src/sw.js`, marqueur `__BASE__`) et à l'enregistrement
  du service worker (`import.meta.env.BASE_URL` dans `src/ui/onboarding.js`) — ne
  jamais réintroduire un chemin `/xxx` codé en dur dans ces deux endroits.
  Réglage à faire une fois, à la main, dans le dépôt GitHub : Settings →
  Pages → Source → **GitHub Actions** (pas « Deploy from a branch »).
  Deuxième réglage, oublié à la création du workflow et qui a fait échouer
  chaque déploiement Pages en silence jusqu'au 2026-09-20 (`vite build`
  refuse de partir sans `VITE_SUPABASE_URL`) : `ci.yml` et `pages.yml` lisent
  `vars.VITE_SUPABASE_URL` / `vars.VITE_SUPABASE_ANON_KEY` — à poser une fois
  dans Settings → Secrets and variables → Actions → onglet **Variables**
  (pas Secrets : la clé anon est publique par nature, voir plus haut).
  Mêmes valeurs que `.env.local`.

## Règles non négociables

0. **Ces deux fichiers se mettent à jour dans le même commit que le
   changement, jamais « plus tard ».** Un dépôt qui se décrit faux est pire
   qu'un dépôt qui ne se décrit pas : on agit sur ce qu'il raconte.
   - `CLAUDE.md` dès que bouge l'architecture, l'infrastructure, une
     commande, le schéma, un service externe, une clé ou une règle de
     travail. C'est le fichier qui coûte le plus cher à laisser périmer :
     c'est lui qu'on lit en premier, à chaque session.
   - `PROGRESS.md` dès qu'une tâche avance : la case, puis le bloc ÉTAT.
   Un commit qui change l'infra sans toucher CLAUDE.md est un commit
   incomplet — le relire avant de valider.

1. **Ne jamais écrire de règle métier hors du noyau.** Le calcul vit dans un module pur et testé ; l'interface affiche, la couche données transporte.
2. **Toute table nouvelle a la RLS activée et des politiques** dans la même migration. Après une migration, lancer les advisors Supabase (sécurité + performance) via MCP.
3. **Aucun secret dans le dépôt.** Seule la clé `anon` vit dans `src/core/coeur-sync.js`. Clés privées → secrets Edge Functions.
4. **Données d'élèves mineurs (RGPD)** : minimisation, pas de donnée perso dans les logs, purge programmée respectée (`20260917090000_purge_corbeille_programmee.sql`).
5. **Hors ligne d'abord** : toute écriture doit survivre à une coupure réseau (passer par la file, pas un `fetch` direct qui se perd).
6. Ne pas « corriger » en silence : un `catch (e) {}` vide doit être justifié par un commentaire, sinon remonter l'erreur (toast ou journal).
7. **Tout travail validé part aussi sur `main`** (décidé le 2026-10-24) :
   Vercel déploie `main` en production et c'est là que l'utilisateur teste.
   Une fois `npm run check` et les parcours e2e verts, pousser sur la branche
   de travail **et** sur `main`, à chaque fois — jamais seulement sur la branche.

## Style de code

- Suivre le style existant : fonctions courtes, noms français, commentaires qui expliquent **pourquoi** (pas quoi), en prose.
- Pas d'ajout de bibliothèque externe sans accord explicite (l'app doit démarrer hors ligne).
- Messages de commit : titre court en français, puis un corps en prose qui explique le problème, la cause et la preuve de la correction.

## Déboguer un bug — méthode attendue

1. **Reproduire d'abord** (navigateur via `/run` ou Chrome, écran étroit ~390 px). Pas de correctif sans reproduction ou sans preuve lue dans les logs.
2. Côté serveur, lire avant de toucher : MCP Supabase `query_logs` (requêtes ci-dessous) et `get_advisors`.
   Le journal unifié se lit en SQL ClickHouse, fenêtre de 24 h au plus
   (passer `iso_timestamp_start`/`iso_timestamp_end` pour une autre). Sources :
   `edge_logs` (toutes les requêtes HTTP), `postgres_logs`, `postgrest_logs`,
   `auth_logs`, `function_edge_logs` (fonction `ai`) — `select distinct source
   from logs` pour la liste du moment. **Ne jamais sélectionner** d'IP, de
   ville, de navigateur ni de `request.sb.jwt.authorization.payload.subject`
   (identifiant de compte) : des élèves mineurs, et rien de tout ça n'aide à
   trouver un bug (règle 4). M05.T3 :
   ```sql
   -- erreurs HTTP par route
   select log_attributes['response.status_code'] as statut, log_attributes['request.method'] as methode,
          log_attributes['request.path'] as route, count(*) as n, max(timestamp) as dernier
   from logs where source = 'edge_logs' and toInt32OrZero(log_attributes['response.status_code']) >= 400
   group by statut, methode, route order by n desc limit 20
   -- erreurs Postgres par code SQLSTATE (42501 = RLS, 23514 = CHECK de M04.T3...)
   select log_attributes['parsed.error_severity'] as gravite, log_attributes['parsed.sql_state_code'] as sqlstate,
          substring(event_message, 1, 120) as message, count(*) as n, max(timestamp) as dernier
   from logs where source = 'postgres_logs' and log_attributes['parsed.error_severity'] in ('ERROR','FATAL','PANIC')
   group by gravite, sqlstate, message order by n desc limit 20
   ```
3. Distinguer **limite d'offre gratuite** vs **bug de code** :
   - Supabase Free : pause après 7 j d'inactivité, 500 Mo de base, 50 000 MAU, pas de sauvegarde, pool de connexions réduit, Edge Functions 150 s max. Erreurs typiques d'offre : `503`, `timeout`, `too many connections`, projet en pause.
   - Tout le reste (`401` en boucle, `42501` RLS, `PGRST…`, données écrasées entre appareils, écran blanc) = **bug de code** jusqu'à preuve du contraire.
4. Trouver la cause racine, corriger, puis vérifier dans le navigateur et relancer les advisors.

## Commandes utiles

```sh
npm run dev                          # serveur local (http://localhost:5173)
npm test                             # tests du noyau
npx vitest run --coverage            # couverture du noyau (fsrs/fusion/file/parseur), cible ≥ 90 % lignes
npm run check                        # lint + tests + build + budget de poids, comme la CI
npm run budget                       # au démarrage JS ≤ 120 Ko, CSS ≤ 25 Ko ; chargés à la demande JS ≤ 30, CSS ≤ 12 (gzip, tools/budget.js, M08.T2) — sur dist/, après un build
npm run typecheck                    # tsc --noEmit, vérification douce sur src/core/ (M06.T8)
npm run e2e                          # parcours de bout en bout (Playwright, e2e/*.e2e.js) sur le build servi par vite preview (M07)
grep -n -- "---------- " src/ui/*.js # table des matières des écrans
supabase db diff / supabase migration new <nom>   # si la CLI est installée
```

Comptes de test : `supabase/comptes_test.sql` (admin, prof, élève).
