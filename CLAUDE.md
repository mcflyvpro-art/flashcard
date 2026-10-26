# Folio — consignes pour Claude

Folio est une PWA de révision (flashcards + moteur FSRS d'Anki) vendue en
**B2C** (élèves, étudiants) et en **B2B** (licences établissement : élèves,
professeurs, référents, éditeurs — modèle « à la Pronote »). Tout ce qui est
écrit ici doit tenir quand un lycée entier se connecte le même matin.

Langue : **français** partout — code commenté, messages de commit, réponses.

## Chantier en cours : la page d'accueil publique

**`docs/LANDING.md` est son fichier de reprise** (demande, décisions, cases
à cocher, pièges) : une session qui reprend ce chantier le lit en entier
et fait la première case non cochée, puis commit + push après chaque case.

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
    `ui/jeton.js`, `ui/balayage.js`, `ui/mouvement.js`, `ui/reordonner.js` (le glisser-déposer des pages d'un livre, sorti de `connexion.js` qui touchait les 800 lignes), `ui/liens-entrants.js` (**la porte de
    tout lien entrant** : `lienAvantSession()` au démarrage — carte élève,
    puis sans session les codes `?rejoindre=`/`?defi=`/`?club=` rangés en
    `sessionStorage` (`folio.rejoindre`, `folio.defi`, `folio.club`) —,
    `lienApresRole()` depuis `accueil()`, et `traiterLienEntrant(url)` pour un
    lien reçu app ouverte : c'est là que se branche `appUrlOpen` de Capacitor ;
    ne jamais ajouter un consommateur de lien ailleurs), `ui/passage.js` (la
    **carte de passage** de l'écran de connexion : dans un navigateur — pas
    l'app installée —, si un de ces trois codes attend, le code en gros, un
    bouton « Copier » et où le coller dans l'app ; c'est ce qu'a un iPhone, où
    une PWA n'intercepte jamais un lien, en attendant Capacitor), et trois morceaux chargés à la demande, l'espace professeur,
    l'écran d'une partie en direct et le journal de lecture — voir plus bas).
  - `src/core/` — réseau et mutation d'état, **jamais de DOM ni de gabarit
    HTML** (M06.T4, preuve : `grep -rc "api(" src/ui/*.js` → 0 partout, sauf
    l'envoi des préférences dans `ui/import-cartes.js`, plus ancien, à sortir).
    `coeur-sync.js` (~775 lignes — `api()`, auth, sync, undo, palette) et quinze
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
    `ecran-groupe.js` (le journal de lecture : `statsPull` lit la fonction
    `journal()` de la base — jamais `reviews` ligne à ligne, PostgREST n'en
    rend que 1 000 —, `noterLocale`/`oublierLocale` gardent les révisions de
    l'appareil tant que la base ne les a pas confirmées (`connus`), le tout
    par compte dans `folio.journal.<uid>`), `matieres.js` (`matiereLocale` :
    la matière d'un livre venu d'ailleurs, retrouvée par son nom ou créée),
    `reglages-corbeille.js` (corbeille, amis,
    courrier, versions), `menus-c.js` (les quelques écritures posées
    à même le gestionnaire de clics), `carte-media.js` (upload média + rejeu
    FSRS depuis l'historique serveur), `espace-prof.js` (toutes les fonctions
    `prof_*` de l'espace professeur : lectures, `ecrire()` qui refuse hors
    ligne — une décision de gestion se prend contre l'état réel de la classe —,
    `repeindre()` qui ne repeint jamais sous les doigts de qui tape) et
    `eleve-classes.js` (« Mes classes » : `class_preview`/`class_join`,
    devoirs, `mon_compte`, `messageErreur`) et `referent.js` (la console du
    référent : toutes les fonctions `ref_*`, `refAgir()` qui refuse hors ligne
    et relit ce qui a bougé, `refProfsPull` à part de la recherche — chargé
    avec la console), `admin.js` (la console de l'éditeur : `admin_*` et
    `set_role`, `admAgir()` qui refuse hors ligne et relit le suivi — chargé
    avec elle) et `demande.js` (`demanderDemo`, la seule écriture sans
    compte). L'ancien `core/etablissement.js`
    (console prof d'avant le 2026-10-24) n'existe plus.
  - `src/ui/` — les 18 écrans (rendu, DOM, `$.innerHTML`, menus, événements),
    même noms de fichier que leur pendant `core/` quand les deux existent
    (`ui/classement.js` ↔ `core/classement.js`, etc.) : `bibliotheque.js`,
    `carte-media.js`, `import-cartes.js`, `connexion.js`,
    `defis.js`, `classement.js`, `etablissement.js`,
    `cercle.js`, `reglages-corbeille.js` (réglages, corbeille, et la **porte du courrier** : `mailView`/`lettreView` chargent à la demande `courrier.js` + `courrier.css`, préfixe `co-` — la boîte, et la page d'une lettre, vue `lettre` : l'expéditeur et son jeton, la date, le message mis en avant, le livre avec sa matière et ses pages, lisibles avant de l'ajouter ; rien d'autre ne doit importer `ui/courrier.js`), `ecran-groupe.js` (recherche, et la **porte du journal** :
    `statsView`/`exportStats` chargent à la demande `journal-ecran.js` +
    `journal.css`, préfixe `jr-` — rien d'autre ne doit importer
    `ui/journal-ecran.js`), `menus-a.js`, `menus-b.js`,
    `menus-c.js`, `revision.js`, `quiz.js`, `interactions.js`,
    `raccourcis.js` (raccourcis clavier pendant une révision, et les
    raccourcis d'ouverture `?go=…` — extrait d'`interactions.js` sur M06.T6,
    qui frôlait la limite de lignes une fois ses tables de dispatch posées),
    `onboarding.js`. `ui/etablissement.js` n'est plus que la **porte de la
    console du référent** (2026-10-26) : `refView` charge à la demande
    `ref-console.js` + `ref-console.css` (préfixe `rf-`) et `core/referent.js`
    — rien d'autre ne doit importer `ui/ref-console.js`. Faite pour l'ordinateur
    (≥ 900 px) : cinq onglets — Accueil (les codes élèves et professeurs :
    copier, afficher en grand avec le QR, changer en deux appuis ; la licence ;
    ce qui demande une décision, chaque ligne menant à la liste filtrée),
    Classes (liste à gauche, détail à droite : renommer, équipe et professeur
    principal, élèves et « changer de classe », supprimer une classe vide),
    Élèves et Professeurs (recherche, filtre classe ou « sans classe », fiche :
    nom — le référent seul le corrige —, classe, rôle, mot de passe oublié),
    Journal ; et, derrière un lien discret « Des élèves sans adresse e-mail ? »,
    les cartes élève, expliquées, imprimées avec leur QR. Au téléphone :
    les deux codes et la licence seulement. Chaque ouverture repart de
    l'accueil (`refPull` remet `ref.charge` à faux). L'ancienne console en
    feuilles (`refwho`, `refcls`, `refnew`) n'existe plus. De même,
    `ui/classement.js` est la **porte de la console de l'éditeur**
    (2026-10-26) : `adminView` charge à la demande `admin-console.js` +
    `admin-console.css` (préfixe `ed-` — **jamais `ad-`** : les bloqueurs de
    publicité masquent ces classes) et `core/admin.js` ; rien d'autre ne doit
    importer `ui/admin-console.js`. Deux onglets : **Établissements** — le
    suivi, du prospect au client (puces d'étape, recherche, la liste triée
    par ce qui presse : demande neuve, relance due, licence qui finit), et
    la fiche d'un établissement : l'étape (changée sur place), le **prochain
    pas** (`prochainPas` : lancer la démo en un geste, transmettre le code
    référent — un lien `mailto:` au contact avec le message tout écrit, ou
    copier —, passer en licence avec son prix), la licence et son usage, les
    codes élèves/professeurs, la fiche complète (contact, besoins, budget,
    relance, notes, message reçu), effacer un établissement sans comptes —
    et **Comptes** (rôle de chacun, rien de son contenu). Les chiffres du
    haut : demandes, relances, démos, clients, élèves, revenu annuel, IA,
    signalements. PC d'abord, utilisable au téléphone (la liste, puis la
    fiche). L'ancien tableau et la feuille `account` n'existent plus. Les
    règles (tri, filtres, bilan, prochain pas, courriel) sont dans
    `src/etablissement.js`. **Navigation au téléphone** (2026-10-25) : `balayage.js` fait
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
    QR `?rejoindre=CODE`, repris par `accueil()` une fois le rôle connu ; et la
    **porte de la page d'une classe** : toucher sa classe — `ouvrirClasse(id)`,
    vue `classe` — charge à la demande `classe-eleve.js` + `classe-eleve.css`,
    préfixe `ec-` : nom, établissement, effectif, matières, date d'entrée, les
    devoirs et défis de cette classe, ses professeurs, ses élèves (un camarade
    ouvre son profil), « Quitter la classe » ; rien d'autre ne doit importer
    `ui/classe-eleve.js` — l'ancienne feuille `el` n'existe plus) et
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
    retombe dans le démarrage. **Au modèle « un seul code »** (2026-10-26,
    `ui/prof-etab.js`, dans le morceau) : le code que le professeur donne est
    en bandeau en tête de l'accueil (`codeBande` : celui de l'établissement
    par `prof_code_etab`, ou le sien par `prof_mon_code`, changé en deux
    appuis) ; « Ajouter des élèves » montre ce code, son QR et « Choisir
    « la classe » » (les cartes élève derrière un lien discret « Des élèves
    sans adresse e-mail ? ») ; le mode tableau projette ce code et la liste
    des élèves qui arrivent (relue toutes les 6 s). Dans un établissement :
    « Mes classes » (`choisir`, `prof_enseigner`) et « Nouveau groupe »
    (`groupe`, chercher et cocher des élèves de l'établissement,
    `prof_groupe`, recomposé par « Élèves du groupe ») remplacent « Nouvelle
    classe » ; « Ne plus enseigner dans cette classe » dans ses réglages.
    Professeur particulier : « Nouvelle classe », et ranger un élève d'une
    autre de ses classes (`ajouter`, `prof_ajouter_eleve`). Plus de code
    par classe à l'écran, ni d'interrupteurs d'inscription (seules restent
    les places d'une classe de professeur particulier). Ces feuilles se
    lisent dans `FEUILLES_ETAB`, consulté **dans** `paintMenuProf`, jamais
    au niveau du module (`prof-etab.js` importe `prof-feuilles.js`) ; une
    liste qui arrive pendant la frappe se pose sur place (`surPlace`), car
    l'espace ne repeint jamais une feuille sous les doigts.

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
    cercle : onglet **Classe** à part, **seulement pour qui en a une**
    (`aUneClasse()` de `bibliotheque.js` — élève entré avec un code dans un
    établissement ou chez un professeur particulier, élève à carte,
    professeur) : un particulier n'en a pas (docs/PARCOURS.md). **« J'ai un
    code »** (`ui/code-entree.js`, feuille `code` de la table des menus, un
    seul écouteur `[data-ce]`, `ouvrirCode(code)`) est la seule porte
    d'entrée : le code (établissement — élève, professeur, référent — ou
    professeur particulier), puis le prénom, le nom et la classe à choisir,
    et l'on est dedans ; ouverte depuis les Réglages (« J'ai un code »),
    « Ma classe » et les liens `?rejoindre=` (`consumeRejoindre`) ; un ancien
    code de classe continue dans « Ma classe » (`versClasse`), un code
    d'équipe chez `rejoindreCollegue`. Dans les parcours, un compte sans rôle
    déclaré n'est pas « eleve » (le faux `my_role` répond vide) :
    `faireEleve(store, email)` de `e2e/faux-classes.js` le déclare, et un
    `prefs` `{ tuto: 1 }` écarte la visite guidée ; un établissement se sème
    avec `semerEtablissement(store, { nom, classes })` de
    `e2e/faux-etablissement.js` (codes, licence, classes ; il rejoue aussi
    `code_apercu`, `rejoindre`, `my_school`, `prof_mon_code` et toutes les
    `ref_*` de la console, services dans `store.et.services`, journal dans la
    table `ref_audit` ; une exception d'une fausse fonction revient en 400 avec
    son message, comme la vraie base) — parcours dans `e2e/referent.e2e.js` ;
    les `admin_*`, `set_role` et `demander_demo` (sans compte, comme la
    vraie) aussi, parcours dans `e2e/editeur.e2e.js` ; et les fonctions de
    l'espace professeur au modèle « un seul code » (`prof_code_etab`,
    `prof_classes_etab`, `prof_enseigner`, `prof_eleves_etab`, `prof_groupe`,
    `prof_ajouter_eleve`), parcours dans `e2e/prof-code.e2e.js` et
    `e2e/espace-prof.e2e.js`.
    **Le profil d'un lecteur** (2026-10-25) : toucher un ami, une ligne de
    classement (`rangLigne`, `data-lecteur`), une demande d'ami ou un membre
    de club ouvre son profil (vue `profil`, `ouvrirProfil(id, { club })` de
    `cercle.js`, qui charge à la demande `profil.js` + `profil.css`, préfixe
    `lp-` — rien d'autre ne doit importer `ui/profil.js`) : son jeton, son
    nom, son pseudo, depuis quand il lit, ami ou non, les clubs en commun ;
    et, pour soi, un ami ou un membre d'un même club, ses chiffres (série et
    record, pages sur 7 et 30 jours, justes, cinq semaines en calendrier, ses
    trois matières, son heure, ses livres) ; les gestes d'ami (défier, prêter,
    retirer), « Retirer du club » pour le chef, signaler, bloquer.
    **Une partie en direct** (façon Kahoot) : `direct-porte.js` (au
    démarrage : `ouvrirDirect`, `consumeDefi()` pour `?defi=PIN`) charge à la
    demande `direct-ecran.js` + `direct.css` (hôte projeté : code, QR,
    joueurs, énoncé, répartition, podium ; joueur au téléphone : quatre gros
    boutons couleur + forme). **Rien d'autre ne doit importer
    `ui/direct-ecran.js`** — passer par `direct-porte.js`.
    **Les jetons d'identité** : `jeton.js` dessine le visage de chacun, le
    même sur tous les écrans — `avatar(id, ident, taille)` (un rond : les
    initiales ou l'avatar dessiné, `.jt.vis` + `svg.visage` — jamais `.av`,
    classe plus ancienne des pastilles d'initiales ; `ident` = le pseudo s'il
    y en a un, sinon le nom, pour qu'une personne ait les mêmes initiales
    partout), `blason(classeId)` et `blasonClub(club)` (un carré arrondi et
    un emblème — jamais un sigle tiré du nom), `medailleHtml(place)` (une
    médaille dessinée pour les trois premiers d'un classement), plus les
    grilles de choix (`grilleTrait` : chaque valeur d'un trait dessinée sur
    l'avatar en cours). **Plus un seul émoji dans l'app** (2026-10-25) : un
    émoji change d'un téléphone à l'autre et ne se personnalise pas ; les
    icônes viennent de `src/icones.js` (dont les 20 emblèmes, tracés de
    Lucide, licence ISC), les visages de `src/avatar.js`. L'éditeur
    (« Mon jeton », `cercle-feuilles.js`) : au hasard, initiales, puis un
    onglet par trait et le fond (la couleur du jeton).

    Aucun fichier, `core/` ou `ui/`, ne dépasse 800 lignes (les plus gros :
    `core/coeur-sync.js` 789, `onboarding.js` 773, `revision.js` 733).
    **L'accueil d'un nouveau compte** (2026-10-26) : vue `bienvenue` (sans
    barre latérale), chargée à la demande par `ui/bienvenue-porte.js`
    (`bienvenueView`, `ouvrirBienvenue(mode, apres)`) — `ui/bienvenue.js` +
    `bienvenue.css`, préfixe `bv-` ; rien d'autre ne doit importer
    `ui/bienvenue.js`. Un particulier : « Je révise pour moi » / « J'ai un
    code », prénom et pseudo, visage parmi six (`propositions`), niveau et
    matières (`matieresApres` : les cochées remplacent les matières
    d'exemple, jamais une qu'un livre emploie), objectif de pages par jour,
    puis la visite guidée ; un élève de classe (`isPupil`) : son visage
    seulement. Tout part à la fin, les préférences par `envoyerPrefs()`
    (`core/reglages-corbeille.js`, sans le délai de `savePrefs` : la visite
    passe aussitôt en démonstration, où plus rien ne part). Marqué fait par
    `prefs.bienvenue`. `maybeTour(pret)` attend la promesse d'`accueil()`
    (rôle et établissement connus) et n'ouvre l'accueil que sur l'écran
    d'arrivée, sans feuille ouverte — un élève qui a déjà touché son devoir
    l'aura à l'ouverture suivante. Les règles dans `src/bienvenue.js`, pur et
    testé (`test/bienvenue.test.js`) ; parcours `e2e/bienvenue.e2e.js`.
    **Les textes du cadre** (conditions, confidentialité, mentions) sont
    chargés à la demande par `legalView()` (`ui/connexion.js`, qui ne garde
    que leurs titres, `LEGAL_TITRES`) depuis `ui/legal-textes.js` ; l'éditeur
    et son contact, encore entre ⟦crochets⟧, vivent dans `src/editeur.js`
    (sans dépendance), vérifiés dès le démarrage. **« Demander une démo »**
    (lien discret de l'écran de connexion, vue `demande`, sans compte) :
    `demandeView()` de `ui/connexion.js` charge `ui/demande-demo.js` +
    `demande-demo.css` (préfixe `dd-`) ; la demande arrive chez l'éditeur,
    étape Prospect (`messageDemande` dit la réponse de la base en clair).
    **« Essayer sans compte »** (2026-10-26, lien de l'écran de connexion et
    du formulaire de démo, vue `decouvrir`) : `decouvrirView()` de
    `ui/connexion.js` charge `ui/demo.js` + `demo.css` (préfixe `dm-`) ; on
    choisit élève, professeur ou référent du **Lycée Démo Folio**
    (`src/demo-etab.js`) et l'app s'ouvre sur ses **vrais écrans** : une
    session en mémoire seulement (jamais `saveAuth`), `demo` levé (ni cache,
    ni `flush`), et `setDemoEtab(...)` branche le lycée fictif en tête
    d'`api()` — chaque `rpc` est servie par `reponseDemo`, une écriture lève
    « Démo : rien n'est enregistré » (que chaque écran montre déjà comme un
    refus), le reste des lectures rend `[]`. Un bandeau (`.dm-bandeau`) change
    de rôle et « Quitter » (comme « Se déconnecter », intercepté) recharge la
    page et efface les caches écrits sous `demo-*`. Aucune requête ne part :
    `e2e/demo.e2e.js` le compte.

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
  - `src/data/etat.js` — tout l'état mutable de l'app (`db`,
    `view`, `study`, `animate`, `mediaCache`..., et `demoEtab`, le lycée fictif qui répond à `api()` pendant « Essayer sans compte »), une liaison vive ES
    (`export let`) par variable et un « setter » générique par variable pour
    la réaffectation (`setDb`, `setView`...) — lire ses champs reste direct (`db.decks.push`),
    seule une réaffectation complète passe par le setter (M06.T3/M06.T4)
  - `src/fsrs.js` — le moteur, pur et testé (`test/fsrs.test.js`). **Réglé comme Anki, sans aucun curseur** (2026-10-25) : rétention visée figée à 90 % (`RETENTION`, `ui/carte-media.js` — `prefs.dr` n'est plus lu), intervalle plafond 36 500 j, paliers 1 min/10 min (rechute 10 min), flou d'Anki, et **l'équilibreur de charge d'Anki** (24.11+, actif par défaut : `equilibrer()`, jusqu'à 90 j, poids (1/n)^2,15 × (1/j)^3, 1 pour un jour vide, nourri par `chargeDes()` de `ui/carte-media.js`) ; les paramètres `w` se réoptimisent seuls (`fsrsAuto`). Le mode simple n'est plus proposé : un compte qui l'avait gardé retrouve le moteur au démarrage (`rallumerMoteur`, `ui/menus-c.js`, arriéré étalé) — le code du mode reste pour la visite guidée
  - `src/fusion.js` — fusion à trois versions d'un paquet (M03.T4), pur et testé (`test/fusion.test.js`, `test/concurrence.test.js`). **Branchée dans la synchro depuis le 2026-10-16** (`reconcile()` dans `src/core/coeur-sync.js`, appelée par `flush()` quand le contrôle de `rev` échoue et par `pull()` pour un paquet en attente) : la base commune est la dernière version serveur connue de chaque paquet (`bases` dans `src/data/etat.js`, clé `cartes.bases.<uid>` du stockage local). Serveur inchangé → envoi ; changé avec base → fusion sans rien demander ; changé sans base fiable → la boîte de choix (`raiseConflict`), jamais d'écrasement muet. Ne jamais redonner à un paquet en attente le `rev` du serveur sans passer par `reconcile()` : c'était l'écrasement silencieux corrigé ce jour-là (preuve : `e2e/deux-appareils.e2e.js` échoue sur l'ancien code)
  - `src/file.js` — construction de la file de révision : sélection, quota de cartes neuves, ordre (M01.T3). **Comme Anki** (2026-10-25) : la journée bascule à 4 h (`debutJour`/`finJour`) ; une carte en révision (st 2) est due dès le début de son jour ; une carte neuve est une carte **jamais lue** (`estNeuve` : ni `n`, ni `lr`, ni `S` — une page ratée d'emblée n'est plus « neuve ») ; **20 neuves par jour et par livre** (`neuvesPermises`, comptées sur `c.fl`, l'heure de la première lecture posée par `grade()` et rangée dans `cards.meta`), aucun quota pour un devoir (cartes `a:`), « Lire +20 » pour aller plus loin (`studyplus`), « Tout lire » et les exercices sans quota ; le bouton « Lire » compte `aLire()` ; ordre `ordreAnki` (paliers, puis révisions par jour d'échéance au hasard dans un jour, neuves dans l'ordre du livre réparties parmi elles, `entrelacer`) ; pur et testé (`test/file.test.js`)
  - `src/parseur.js` — parseur de cartes : collage, Quizlet, Anki texte brut, CSV/TSV, JSON (M01.T4), pur et testé (`test/parseur.test.js`)
  - `src/invariants.js` — les 12 invariants qu'une carte doit toujours respecter (S>0, 1≤D≤10, cohérence de l'état FSRS...), pour l'entretien automatique de la bibliothèque (M04.T2) et la contrainte CHECK en base (M04.T3 : 7 contraintes `cards_*` sur `public.cards`, seulement celles que le moteur garantit par construction — une ligne refusée bloquerait la synchro de tout le paquet) — pur et testé (`test/invariants.test.js`). Attention : `n` compte les **réussites**, pas les passages (`grade()`, `fsrsReplayCard()`), donc une carte ratée d'emblée a une mémoire avec n = 0, et l > n est sain
  - `src/reparation.js` — réparation des cartes qui violent ces invariants, regroupées en 8 familles (`scanLibrary`/`repairLibrary`), branchée sur **l'entretien automatique** : `entretienAuto()` (`src/core/reglages-corbeille.js`), une fois par ouverture au calme après `pull()`, sans rien demander ni afficher — plus de bouton « Vérifier ma bibliothèque » depuis le 2026-10-25 ; chargée à la demande, comme `doublons.js` et `sauvegarde.js` (le démarrage n'a pas de marge) — pur et testé (`test/reparation.test.js`). Le pont SM-2 → FSRS (`sm2State`) vit désormais dans `src/fsrs.js`, partagé avec `fsrsSeed()`
  - `src/doublons.js` — déduplication (M04.T4) : même recto ET même verso dans un même paquet, on garde la carte la plus avancée et on additionne les rechutes ; passée par l'entretien automatique, **jamais sur un devoir** (chaque page y compte pour l'avancement) — pur et testé (`test/doublons.test.js`)
  - `src/sauvegarde.js` — export/import intégral de la bibliothèque (M04.T6) : format `folio-bibliotheque` v1, état d'apprentissage compris, sans `rev` ni marques d'écran ; restauré sous les mêmes identifiants sur le même compte, de nouveaux sur un autre (RLS) ; branché sur la feuille Sauvegarde (`backupData`/`backupRestore`, `src/core/reglages-corbeille.js`) — pur et testé (`test/export.test.js`)
  - `src/normaliser.js` — `norm()` (casse, espaces, apostrophes, ponctuation finale), sans aucune dépendance : lue par le noyau (`doublons.js`) et par les écrans (`ui/quiz.js` la réexporte)
  - `src/classe.js` — les règles d'une classe (2026-10-24) : forme d'un code (8 caractères, alphabet sans 0/O/1/I/L), lien `?rejoindre=`, texte de chaque statut d'inscription renvoyé par la base, état d'un élève, tris/recherche (sans accents), synthèses de classe et d'accueil, « à traiter », échéances sans décalage de fuseau, lecture d'une liste d'élèves collée (`lireListeEleves`, « NOM Prénom » ou « Prénom NOM »), nom propre (`nomPropre`), carte de connexion (`emailCarte`, `lienCarte`, `lireCarte`) — pur et testé (`test/classe.test.js`, 45 tests dont 4 fuseaux), employé par l'espace prof et « Mes classes ». Le sigle de classe et les teintes de classe d'avant sont partis le 2026-10-25 au profit des jetons (`src/jeton.js`)
  - `src/jeton.js` — les jetons d'identité (2026-10-25) : 12 couleurs (chacune ≥ 4,5:1 avec du blanc, vérifié), 20 emblèmes (classes, clubs), le hachage stable qui tire un jeton par défaut de l'identifiant, les initiales (première lettre du premier et du dernier mot, jamais un chiffre en tête) — pur et testé (`test/jeton.test.js`). Rien n'est inventé à partir du nom : « CPGE ECP1 » donnait « CE1 » avec l'ancien sigle. Les 38 figures en émojis sont parties le 2026-10-25 : une personne a un avatar (`jetonPersonne` rend `avatar`, via `avatarDeCle`)
  - `src/avatar.js` — les avatars (2026-10-25) : un visage en SVG composé de sept traits (peau 6, coiffure 10, cheveux 8, yeux 5, bouche 5, accessoire 6, haut 8) sur la couleur du jeton. **Aucune migration** : il s'écrit dans `profiles.figure` déjà là, « av » + une lettre par trait (`ecrireAvatar`/`lireAvatar`, `^av[a-z]{7}$`, que `mon_jeton` et `visuels` acceptent tels quels) ; une ancienne figure (« renard ») donne l'avatar tiré de son nom, le même partout. Listes fermées, ni photo ni texte libre (des mineurs). Pur et testé (`test/avatar.test.js`)
  - `src/defi.js` — les règles d'un défi en direct : jeux (QCM, vrai ou faux, réponse écrite), durées, nombre de questions, fabrication des questions depuis un livre, code à 6 chiffres et lien `?defi=`, statuts de la base, phase et chrono (décalage d'horloge compensé), places et podium — pur et testé (`test/defi.test.js`)
  - `src/journal.js` — le journal de lecture (2026-10-25), deux questions jamais mélangées : **ce que tu as fait** se lit dans le journal des révisions, où chaque ligne garde son contexte du moment (matière, livre, écart) — supprimer, fusionner, scinder, renommer un livre ou changer sa matière ne réécrit jamais le passé ; **ce que tu sais** se lit sur les cartes d'aujourd'hui (`savoir` : âges, maîtrise, rappel estimé FSRS, échéances). Une matière se reconnaît à son NOM (`cleNom`, sans casse ni accents) : un identifiant disparu garde le nom qu'il avait, deux matières du même nom n'en font qu'une. `PALIERS` (écarts 1/3/14/90 j) est passé à la base, qui ne fait que compter ; `rassembler` réunit la réponse de `journal()` et les révisions locales sans double compte (`connus`) ; jours en chaînes « AAAA-MM-JJ » dans le fuseau de l'appareil. `etatCarte` (l'âge d'une carte) y vit ; `cstate` de `ui/carte-media.js` en est l'équivalent historique. Pur et testé (`test/journal.test.js`, dont le scénario « 3 h de droit → changement de matière → fusion → suppression → recréation depuis un partage en anglais »)
  - `src/matieres.js` — une matière qui arrive d'un autre compte (devoir, lien, envoi à un ami) : retrouvée par son nom, créée sinon (identifiant libre, couleur la moins employée) ; sans nom, un identifiant n'est gardé que s'il existe ici (lien de sauvegarde du même compte). Pur et testé (`test/matieres.test.js`)
  - `src/demo-etab.js` — le Lycée Démo Folio de « Essayer sans compte » (2026-10-26) : 5 classes et groupes, 3 professeurs et leurs services, 20 élèves, des devoirs avec leurs pages ; `reponseDemo(rôle, fonction, args)` rend ce que la vraie fonction rendrait à ce rôle (`undefined` pour une écriture, vide pour le social) et `journalDemo()` le journal du référent. Pur et testé (`test/demo-etab.test.js`). Toute fonction que la démo doit servir s'y ajoute — sinon l'écran reste vide, sans erreur
  - `src/club.js` — un club : nom (2–40), devise (≤ 90), code d'invitation lisible et lien `?club=`, classements (places partagées, barre relative, ma ligne), médailles — pur et testé (`test/club.test.js`)
  - `src/qr.js` — encodeur QR sans bibliothèque (octets, niveau M, versions 1–10, `qrSvg()`), pour projeter le code d'une classe et imprimer les cartes de connexion — pur et testé (`test/qr.test.js` ; relu 10/10 par le décodeur d'OpenCV le 2026-10-24). Le SVG porte ses couleurs : `svg.qr{stroke:none}` (sinon le trait que l'app donne à tout SVG grossit les modules)
  - `src/app.css` — ~2 400 lignes ; l'espace professeur a la sienne, `src/ui/prof-espace.css` (~620 lignes, préfixe `pf-`, chargée avec son morceau), la partie en direct aussi (`src/ui/direct.css`, préfixe `dx-`) ; le journal de lecture aussi (`src/ui/journal.css`, préfixe `jr-` : l'activité à l'encre, la mémoire en une seule rampe de vert du plus clair « à lire » au plus foncé « sue », chaque matière à sa couleur) ; l'écran élève « Mes classes » est dans `app.css` (préfixe `el-`), le cercle aussi (`cc-`, `cl-` pour un club, `dn-` pour « Nouveau défi », `jt` pour les jetons). **Le moins de texte possible** (demandé le 2026-10-25) : des icônes et des chiffres plutôt que des phrases, aucun sous-titre explicatif sous un titre ou une carte, onglets du bas en icônes seules ; une explication vraiment nécessaire va dans une pastille « ? » (`hlp(clé)` et la table `HELP` de `ui/connexion.js`) ou un `title`, jamais en paragraphe sous l'élément. **Charte visuelle (refaite le 2026-10-24)**, sobre et la même partout : jetons dans `:root` (`--bg` #F6F5F1, `--bg2`, `--ink` #1D1C19, `--ink2`, `--soft`, `--card` blanc, `--hair`/`--line` pour les filets, `--edge` = filet intérieur de 1 px, `--ring` = halo gris du focus) ; titres en sans-serif (le serif reste réservé au texte des pages lues), surfaces blanches cernées d'un filet, ombres à peine visibles ; la couleur d'une matière (`--d`) ne vit plus qu'en liseré, pastille ou badge, jamais en aplat de carte. **Aucun contour noir** : `:focus` n'a pas d'outline, `:focus-visible` un trait gris clair (clavier seulement), les champs n'en ont pas du tout — c'est leur cadre qui s'éclaire (`:focus-within` + `--ring`). Sur ordinateur (≥ 900 px) : barre latérale de 236 px (entrées groupées en haut, Réglages et compte en bas), contenu centré à 1 120 px (1 240 ≥ 1 500 px) ; **gabarit unique** (2026-10-25) : toutes les pages de premier niveau (Livres, Journal, Ma classe, Cercle des lecteurs, Courrier, Réglages) ont la même largeur et leur titre au même endroit (`.top`, 52 px de haut) — plus de colonne étroite centrée, c'est le contenu qui se range en colonnes (Réglages en deux colonnes de sections `.rg`, Ma classe « à faire » | « mes classes » `.el-grille`, Courrier et Corbeille en grille, Journal en tableau de bord) ; **les feuilles ne sont plus des tiroirs de téléphone** : `placerSurPC()` (`ui/menus-a.js`) accroche une feuille légère — une bulle « ? », une liste d'actions comme le menu d'un livre — sous le bouton qui l'a ouverte (`.menu.pop`, elle défile si elle est longue, jamais sous la barre latérale), et fait d'un formulaire une boîte de dialogue (`.menu.dlg`, sans poignée ni geste de glisser) — jamais une fiche en tiroir (`.pf-tiroir`), un tableau, une grande feuille (`.large`) ni un calendrier (`.pf-cal`), qui s'accrochait en petit menu coupé sous sa ligne ; mises en page à deux colonnes (livre, création, bilan) ; **le livre sur PC tient dans l'écran** (2026-10-25) : seule la liste des pages défile (`.rows` défile seule, `minmax(0,1fr)` en dernière rangée de la grille — sans ce plancher la page entière défilait de nouveau), sa position est gardée quand le livre se repeint (`retenirListe`/`rendreListe`, `ui/connexion.js`) et « Plus… » s'y observe (`root` de l'IntersectionObserver) ; **la recherche dans un livre ne repeint que la liste** (`repeindrePages`, jamais `render()` pendant la frappe : le clavier d'iPhone sautait) et son champ est `flex:none` (dans la colonne flex de la page, `.fld` s'étirait sur tout l'écran) ; une barre qui ne porte qu'un retour à l'accueil est masquée, la barre latérale y mène déjà. Plus de mode zen (retiré le 2026-10-25). **Le mouvement (2026-10-25) : ne s'anime que ce qui ARRIVE, une seule fois** — l'app redessine en `innerHTML`, et un nœud neuf rejouait son entrée : un jour choisi dans le calendrier d'un devoir, une case cochée, dix appuis sur le même onglet relançaient la page, la feuille, la barre du bas. `src/ui/mouvement.js` (sans autre import que la racine) : `entreeEcran()`, appelée par `render()`, ne pose `.fade` qu'à un vrai changement d'écran (`view.name:id`) et l'ôte après 560 ms ; un redessin pendant l'entrée la prolonge au même point (`--retard`, délai négatif), redemander l'écran où l'on est ne rejoue rien. Un élément qui apparaît au milieu d'un écran porte une clé `data-k` (barre du bas, bouton flottant, barre de sélection `.selb`/`.pf-bulk`, onglet d'une classe `.pf-corps`, onglet de création `.cr-panel`, page ajoutée `.dc`, question d'un quiz `.qz`, bilan `.rev`, joueur d'une partie `.dx-chip`, étape d'une partie `.dx`) : un observateur lui donne `.neuf` — et donc son animation — seulement si aucun élément de même clé n'était à l'écran. **Toute nouvelle animation d'entrée s'écrit sous `.fade` ou `.neuf`, jamais nue.** La glissière des onglets glisse depuis là où on la voyait, une barre de progression (`avancer()`) depuis sa largeur d'avant (elle repartait de 0 à chaque réponse), le chrono d'un quiz ne repart plus à zéro sur un redessin, l'entrée allumée de la barre latérale change sur place. Les feuilles (`menus-a.js`, `poser`) : redessinées, elles gardent leur point d'entrée, leur défilement et le champ actif ; leur hauteur glisse, une autre étape (`data-etape`) fond le contenu ; à la fermeture (`sortirFeuilles`) elles repartent par où elles sont venues (animations web, depuis leur position du moment) en `.sort` — `inert`, `aria-hidden`, sans identifiants, sans gestes —, et une feuille qui s'ouvre retire aussitôt les sortantes ; le voile ignore un tap dans les 350 ms qui suivent l'ouverture (`vientDOuvrir`, un double appui refermait la feuille). Un toast identique déjà affiché reste en place, un autre change de texte sans rejouer son entrée. Durées : 0,2 à 0,4 s, six pixels, courbe `--e` (entrées), `--ios` (feuilles), `--out` (sorties), échelonnement plafonné à 11 éléments ; mouvement réduit : ni entrée ni boucle. Preuve : `e2e/animations.e2e.js` (aucune animation d'entrée en cours après chaque geste, défilement de la feuille gardé ; échoue sur l'ancien code)
  - `src/sw.js` — modèle du service worker ; `vite.config.js` le fabrique au build. Hors ligne, il cherche dans le cache avec `ignoreVary` : le serveur répond `Vary: Origin` et un morceau chargé à la demande, demandé comme module avec un en-tête `Origin`, ne retrouvait pas sa copie d'installation (il ne s'ouvrait jamais hors ligne avant le 2026-10-25)
  - `public/` — fsrs.wasm, manifeste, icônes
  - `e2e/` — parcours de bout en bout Playwright (M07), nommés `*.e2e.js` pour que vitest ne les ramasse pas ; `playwright.config.js` construit puis sert le build de production (`vite preview`, port 4173), téléphone 390 px. Première fois sur une machine : `npx playwright install chromium` (session Claude dans le cloud : rien à installer, le Chromium est déjà là — `tools/pw-local.config.js`, voir « Commandes utiles »). Les parcours parlent à un **faux Supabase en mémoire** (`e2e/faux-supabase.js`, branché par `page.route`) : jamais à la vraie base, faute de préproduction (M13.T4) — il émule seulement ce que l'app emploie (auth, filtres PostgREST, `Range`, `rev` des paquets, `sync_deck_cards`, un cloisonnement par `user_id` des tables personnelles pour que deux comptes ne voient pas les livres l'un de l'autre) ; les fonctions des classes sont rejouées dans `e2e/faux-classes.js` (créer une classe, comptes à carte, salle d'attente, devoirs ; `faireProfesseur(store, email, nom)` pose le rôle), le journal (déclencheur `contexte_revision` et fonction `journal()`) dans `e2e/faux-journal.js`, celles du cercle dans `e2e/faux-cercle.js` (amis, classement, clubs, salles en direct avec le même calcul des points, jetons ; `store.lectureMs` raccourcit les 3 s de lecture ; `semerCompte`, `semerPseudo`, `semerAmis`, `semerLectures`, `semerClub`, `semerJeton`) ; la RLS et le SQL se testent en base. `e2e/animations.e2e.js` compte les animations d'entrée en cours (`document.getAnimations()`) après chaque geste. Un compte sans rôle déclaré reçoit de `my_role` une réponse vide (la vraie dit « eleve ») : la visite guidée ne s'invite pas dans les parcours. `store.online = false` simule une coupure ; deux pages sur le même store = deux appareils du même compte, deux **contextes** (`browser.newContext`) = deux personnes. Gestes communs dans `e2e/aide.js`. Les captures de référence de `captures.e2e.js` (comparées seulement sur Mac) ont été retirées avec la refonte visuelle du 2026-10-24 : le premier `npx playwright test captures` lancé sur un Mac les réécrit (il échoue une fois en signalant les images manquantes) ; les regarder, puis les committer
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
  - **Fonctions `security definer`** : Postgres accorde `execute` à PUBLIC (donc à `anon`) à toute fonction créée — retirer `anon` seul ne sert à rien. Depuis `20261024122609`, les privilèges par défaut ne le font plus, mais chaque nouvelle fonction écrit quand même `revoke all ... from public, anon; grant execute ... to authenticated;` (rien pour les fonctions internes, ni pour une fonction de déclencheur : un déclencheur s'exécute sans ce droit — `20261024213744` l'a retiré aux deux qui l'avaient encore). Seules `shared_deck` et `demander_demo` (le formulaire « Demander une démo », freiné en base) restent ouvertes à `anon`.
  - **Rejoindre une classe** (`20261024113815`, matrice des droits en tête du fichier) : uniquement par `class_preview(code)` / `class_join(code)` (l'ancienne `join_class` y renvoie). Elles **renvoient un statut au lieu de lever** quand l'essai doit être compté (une exception annulerait la ligne de `class_join_attempts`, et la limite de 10 codes faux/h ne verrait rien). Frontière d'établissement, salle d'attente (`class_requests`), exclusion (`class_bans`), places, durée, code changeable : tout est vérifié en base. L'élève ne lit plus la ligne `classes` (donc jamais le code).
  - **Avancement des devoirs** : calculé par le déclencheur `avancement_devoir` sur `reviews` (cartes `a:<devoir>:<rang>`), jamais écrit par l'app (plus aucune politique d'écriture sur `assignment_progress`).
  - **Comptes à carte** (`20261024125435`) : un professeur crée les comptes de ses élèves depuis une liste (`prof_creer_eleves`, 60 par appel, homonymes signalés) ; chacun a un identifiant `prenom.nom` (e-mail technique `identifiant@eleves.folio.invalid`, jamais affiché) et un code secret de 8 caractères qui est son mot de passe GoTrue, montré une seule fois (jamais stocké en clair ; `prof_nouvelles_cartes` en refait un et déconnecte l'ancien). Table `comptes_geres` (RLS : chacun ne lit que sa ligne). Le nom « Prénom NOM » d'un élève à carte ou d'établissement est **verrouillé en base** (déclencheur `lock_identite_scolaire`) : seul son professeur le corrige (`prof_nommer_eleve`). Un compte personnel qui rejoint une classe donne son vrai prénom et son nom (`class_join(code, prénom, nom)`, statut `nom` sinon). `mon_compte()` dit à l'app si le compte est géré.
  - **Clubs et parties en direct** (`20261024232855`, `20261024233015`) : un club se crée, se rejoint (code, 10 faux/h, 100 membres) et se gère par fonctions (`club_creer`, `join_group`, `club_membres`, `club_nouveau_code`, `mes_clubs`) ; un élève de classe n'en crée ni n'en rejoint. Une partie : `salle_ouvrir`, `salle_rejoindre` (statuts : ok, format, inconnu, trop, classe, club, exclu…), `salle_etat` (jsonb : ce que chacun a le droit de voir — jamais la bonne réponse avant la correction), `salle_repondre` (points calculés en base : 500 à 1 000 selon la vitesse depuis que CE joueur a vu les choix, + 50 par bonne réponse d'affilée), `salle_avancer` (idempotent, double clic sans effet), `salle_exclure`, `salle_fermer`, `salles_ouvertes`, `salles_terminees` ; purge quotidienne (`purge-salles-quotidienne`). Nom d'un joueur : « Prénom NOM » dans une salle de sa classe, « Prénom N. » pour un élève ailleurs, le pseudo sinon.
  - **Jetons d'identité** (`20261025111500`, correctif `20261025113100`) : `profiles.figure`/`teinte` et `classes.embleme`/`teinte` (clés `^[a-z]{2,16}$`, rang 0–11, contraintes CHECK). Une seule porte de lecture, `visuels(personnes, classes)` (200 et 100 au plus), qui ne rend un choix qu'à qui partage quelque chose (amis même en demande, club, classe — camarades, professeurs, salle d'attente —, partie en direct, référent de l'établissement) ; `mon_jeton(cle, rang)` pour soi (un élève à carte aussi : son nom reste verrouillé) ; `prof_jeton_classe(cid, cle, rang)` pour qui gère la classe. `voit_personne`/`voit_classe` sont internes : **révoquer aussi `authenticated`** (les privilèges par défaut de Supabase le lui donnent, révoquer PUBLIC et anon n'y touche pas).
  - **Journal des révisions** (`20261025170855`) : chaque ligne de `reviews` porte sa photographie — `subject`, `subject_name`, `deck_name`, `ecart` (jours depuis la lecture précédente de la page, -1 la première fois) — et son `created_at` est l'heure de la lecture, envoyée par l'app (hors ligne compris), pas celle de l'envoi. Le déclencheur `contexte_revision` complète ce qu'une app ancienne n'envoie pas (depuis le paquet et le journal), sans jamais remplacer ce que l'app a dit, et ramène une date future à maintenant. **Ne jamais réécrire ces colonnes après coup.** Les statistiques passent par `journal(p_depuis, p_tz, p_bornes, p_locaux)` (security invoker, jsonb : `jours` regroupés par jour/matière/livre/palier, `heures`, `matieres` et `livres` = noms du moment, `toujours`, `connus`). `shared_deck` rend aussi `subject_name`, `mail.subject_name` voyage avec un livre envoyé : c'est le nom qui voyage, jamais l'identifiant.
  - **Profil d'un lecteur** (`20261025200000`) : `profil_lecteur(u, p_tz)` (jsonb) — statut `ok` (soi, ami accepté, membre d'un même club : décomptes et noms de matières, jamais un livre ni une carte), `prive` (quelqu'un qu'on voit déjà par `voit_personne` — camarade, professeur, joueur, demande en attente : nom, pseudo, ancienneté, clubs en commun, pas de chiffres), `inconnu` (personne d'autre, ou un blocage dans un sens ou l'autre).
  - **Page d'une classe, côté élève** (`20261025210000`) : `eleve_classe(cid)` (jsonb) — `inscrit` (un élève de la classe : nom, niveau, établissement, date d'entrée, `peut_quitter`, `profs` avec leur matière et le principal, `eleves` sous leur nom de classe avec le lien d'amitié de chacun, jamais un compte bloqué, jamais le code), `attente` (salle d'attente : nom de la classe seulement), `inconnue` (personne d'autre, ou classe archivée).
  - **Établissements : un seul code** (`20261025233000` puis `20261026001000` ; les parcours en clair dans **`docs/PARCOURS.md`**, à lire avant d'y toucher) : un élève entre avec UN code — celui de son établissement (`org_codes.eleve`) ou de son professeur particulier (`codes_profs`) — et `rejoindre(code, prénom, nom, classe)` le fait entrer **aussitôt**, sans validation (la sécurité est dans le code : 8 caractères, 10 faux/h tous codes confondus dans `class_join_attempts`, changeable à tout moment) ; `code_apercu(code)` dit d'abord ce que c'est et rend la liste des classes à choisir (statut `choisir` si l'élève n'en a pas pris une alors qu'il y en a). Plus de code par classe pour un élève (les anciens codes de classe marchent encore, `class_preview`, mais l'app ne les montre plus). Dans un établissement, un élève a **une** classe (`classes.genre = 'classe'`, la même pour tous ses camarades) et des **groupes** (`'groupe'`) que forment les professeurs en sélectionnant des élèves (`prof_groupe`, `prof_eleves_etab`) ; un professeur choisit ses classes (`prof_classes_etab`, `prof_enseigner`) ; `ref_move_student` ne touche que la classe, jamais les groupes. Le code professeur fait entrer un professeur, le code référent (usage unique, 30 j) un référent — et pose les **classes d'exemple** d'une démo (`orgs.exemples`, `poser_exemples`). Un professeur particulier (rôle prof sans établissement) a son code (`prof_mon_code`) ; son premier élève lui crée « Mes élèves » ; `prof_ajouter_eleve` range un élève dans une autre de ses classes ; un élève d'un lycée peut aussi suivre un professeur particulier. Le nom « Prénom NOM » est figé à l'entrée : seul le référent le corrige (`ref_update_account`). Licence : `orgs.offre` (`demo` | `etablissement`), `places`, `licence_fin` (`etab_verdict` : `licence`, `plein`…). Les codes vivent dans `org_codes` et `codes_profs`, **tables sans aucune politique** (tout membre lit sa ligne `orgs`). Côté vente, pour l'éditeur seul : `org_suivi` (étape prospect/démo/client/pause/perdu, contact, besoins, budget, prix, notes, relance ; **sans aucune politique**, lu par `admin_orgs`), `admin_etab_enregistrer(org, fiche jsonb)` (le formulaire), `admin_lancer_demo(org, places, jours, exemples)`, `admin_licence`, `admin_code_ref`, `admin_supprimer_etab` (seulement sans comptes : le contact part avec), et **`demander_demo(...)`, ouverte à `anon`** — la seule avec `shared_deck` —, freinée en base (20 demandes/h en tout, une par adresse et par jour).
  - **Espace professeur, un seul code** (`20261026030000`) : `prof_classes` rend aussi `genre` ; dans un établissement, `prof_creer_classe` crée un **groupe** (une app ancienne ne glisse plus une classe de plus dans la liste que voient les élèves) ; `prof_code_etab()` donne au professeur le code élèves de son établissement, pour le projeter (le code professeurs et le code référent restent au référent).
  - **Console du référent** (`20261026020000`) : `ref_personnes(q, qrole, qclass, sans_classe, lim, off)` rend **une ligne par personne** (sa classe de rattachement, jamais un groupe ; filtre sur une classe ou un groupe ; les élèves sans classe ; recherche sans casse ni accent ; `carte` pour un compte à carte ; `total` pour la pagination) — `ref_people` reste pour les anciennes apps installées. Les cartes élève du référent passent par `prof_creer_eleves` (`class_manager` l'admet sur une classe de son établissement).
  - **Tests SQL** : `supabase/tests/*.sql`, à lancer tels quels (MCP `execute_sql`) — tout se passe dans une transaction annulée, avec des comptes jetables et le vrai rôle `authenticated` (RLS et droits réels). `execute_sql` ne rend que le résultat de la **dernière** instruction (le `rollback`, donc rien) : pour lire le bilan, remplacer le `select … from zz_res` final et le `rollback` par un `do $$ begin raise exception 'RESULTATS %', (select … from public.zz_res); end $$;` — l'erreur porte le bilan et annule tout. `classes_securisees.sql` (56 cas), `identite_eleve.sql` (22 cas), `defis_direct.sql` (44 cas), `jetons.sql` (23 cas), `journal.sql` (18 cas), `profil.sql` (19 cas), `classe_eleve.sql` (12 cas) et `etablissement.sql` (64 cas : du prospect au client, les quatre codes, classes et groupes, la liste du référent, l'espace professeur, licence, anon).
- Réglages non-SQL (auth, storage, secrets, pg_cron) : `supabase/REGLAGES.md`, à tenir à jour.
- **Hébergement : une seule cible, Vercel, un seul domaine :
  `https://www.folioflashcard.online/`** (projet Vercel `flashcard`, équipe
  `massam-17-s-projects` ; l'apex `folioflashcard.online` redirige en 308 vers
  `www` ; l'alias `flashcard-roan-chi.vercel.app` reste servi, ne PAS le
  rediriger : qui y aurait installé l'app perdrait ses écritures pas encore
  envoyées, le stockage local étant propre à chaque origine). Vercel déploie
  `main`. **Tout lien qui sort de l'app** (partage, QR, invitation, carte de
  connexion) se fabrique sur `SITE` (`src/adresse.js`, sans dépendance),
  jamais sur `location.origin` : une préversion ou Capacitor
  (`capacitor://localhost`) propageraient sinon leur adresse, et une PWA
  installée n'intercepte que les liens de son origine. Le manifeste déclare
  `id`/`start_url`/`scope` à `/`, `launch_handler` (`navigate-existing`) et
  `handle_links: preferred`. L'app est servie à la racine (`base: '/'` dans
  `vite.config.js`, propagé au service worker par le marqueur `__BASE__` de
  `src/sw.js` et à son enregistrement par `import.meta.env.BASE_URL` dans
  `src/ui/onboarding.js` — ne jamais y coder un chemin en dur).
  **GitHub Pages ne publie plus l'app** (depuis le 2026-10-25) :
  `.github/workflows/pages.yml` (sans build) y dépose `tools/pages-redirection/`
  — `index.html` et `404.html` (identiques) qui renvoient vers `SITE` en
  gardant `?…` et `#…`, et un `sw.js` qui vide les caches et désinscrit
  l'ancien service worker des téléphones qui l'avaient. **Sauf ouverts
  depuis une icône d'écran d'accueil installée sur l'ancienne adresse**
  (`navigator.standalone` ou `display-mode: standalone`) : une app installée
  ne change pas d'origine — sur iPhone la redirection l'ouvrait dans Safari,
  sans session (« le PWA est cassé », 2026-10-25) — ; la page montre alors
  la nouvelle adresse, « Ouvrir Folio » et comment réinstaller l'app depuis
  elle (Safari : Partager → Sur l'écran d'accueil ; Chrome : Installer
  l'application), puis supprimer l'ancienne icône. Les journaux le
  confirment : l'origine `mcflyvpro-art.github.io` parlait encore à la base
  jusqu'à la redirection (domaine du `referer` dans `edge_logs`, jamais
  autre chose). On pourra désactiver Pages (Settings →
  Pages) une fois les anciens liens oubliés. Le contrôle qualité `ci.yml` a
  deux jobs : `check` (lint, tests, build) et `e2e` (les parcours Playwright,
  ~2 min 20, M07.T7) ; il lit `vars.VITE_SUPABASE_URL` /
  `vars.VITE_SUPABASE_ANON_KEY` (Settings → Secrets and variables → Actions →
  onglet **Variables**, pas Secrets : la clé anon est publique par nature),
  mêmes valeurs que `.env.local`.
- **Capacitor (à venir, pas installé)** : tout ce qui est prêt et tout ce qui
  reste (`appId`, `webDir: 'dist'`, liens universels iOS et App Links
  Android, `appUrlOpen` → `traiterLienEntrant`, session, Supabase Auth) est
  dans `docs/CAPACITOR.md` — le lire avant d'y toucher. Le service worker ne
  s'enregistre pas sous Capacitor (`window.Capacitor`, `ui/onboarding.js`).

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
npm run budget                       # au démarrage JS ≤ 120 Ko, CSS ≤ 25 Ko ; chargés à la demande (prof, direct, journal, courrier, profil, classe, consoles du référent et de l'éditeur, demande de démo, démo sans compte, sauvegarde, entretien… cumulés) JS ≤ 68, CSS ≤ 27 (gzip, tools/budget.js, M08.T2) — sur dist/, après un build
npm run typecheck                    # tsc --noEmit, vérification douce sur src/core/ (M06.T8)
npm run e2e                          # parcours de bout en bout (Playwright, e2e/*.e2e.js) sur le build servi par vite preview (M07)
grep -n -- "---------- " src/ui/*.js # table des matières des écrans
supabase db diff / supabase migration new <nom>   # si la CLI est installée
CI=1 npx playwright test -c tools/pw-local.config.js   # e2e dans une session cloud (Chromium préinstallé, /opt/pw-browsers/chromium)
CI=1 npx playwright test -c tools/pw-webkit.config.js  # e2e sous Safari (WebKit, iPhone 13 + Safari bureau) — installation en tête du fichier
```

**Environnement d'une session Claude dans le cloud.** Le hook
`.claude/hooks/session-start.sh` (déclaré dans `.claude/settings.json`, ne
tourne que si `CLAUDE_CODE_REMOTE=true`) fait `npm ci` si `node_modules`
manque et pose `.env.local` s'il manque (adresse du projet et clé anon,
publiques par nature) : lint, tests, build et e2e tournent d'emblée. La
version de Playwright du projet ne trouve pas seule le Chromium de la
machine : `tools/pw-local.config.js` le lui donne (`PW_CHROMIUM` pour un
autre chemin) et lance le serveur depuis la racine. **Safari (WebKit)** se
teste sans toucher au Chromium : `export PLAYWRIGHT_BROWSERS_PATH=<scratchpad>/pw`,
`npx playwright install webkit && npx playwright install-deps webkit`, puis
`tools/pw-webkit.config.js`, qui bloque le service worker
(`serviceWorkers: 'block'` : sous WebKit il capte les requêtes avant
`page.route`, le faux Supabase ne verrait rien) — le 2026-10-25, la
politique réseau de la session refusait l'hôte de téléchargement
(`playwright.download.prss.microsoft.com`) : à autoriser dans les réglages
réseau de l'environnement pour s'en servir. Les scripts de revue visuelle
`e2e/zz-*.e2e.js` (captures dans `SHOTS=dossier`) ne sont jamais versionnés
(`.gitignore`) ; sans `SHOTS`, ils écrivent dans `undefined/` ou `zz-…/`.

Comptes de test : `supabase/comptes_test.sql` (admin, prof, élève, et le référent du « Lycée d'essai Folio », créé par le vrai chemin : fiche et démo par l'éditeur, puis le code référent).
