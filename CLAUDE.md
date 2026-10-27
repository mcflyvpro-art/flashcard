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
  - **Deux pages** (build multi-pages, `vite.config.js`), depuis le 2026-10-26 :
    `index.html` — la **page d'accueil du site**, servie à `/` (B2C et B2B,
    tarifs, SEO ; tout son texte en HTML statique), `src/site/` pour son
    style et son script ; elle ne charge jamais l'app ni n'enregistre le
    service worker. Son premier script, **l'aiguillage**, envoie aussitôt à
    `/app` qui a une session (`localStorage['cartes.auth']`), l'icône
    installée ou l'app native, et tout lien de l'app (`?carte= ?rejoindre=
    ?defi= ?club= ?go=`, `#s= #i=`, retours d'e-mail) : les QR imprimés et
    les liens fabriqués sur `SITE` continuent d'ouvrir l'app. `?site` force
    l'accueil. Son empreinte sha256 est dans la CSP de `vercel.json`
    (`test/site.test.js` le vérifie, avec l'absence de tiret cadratin dans le
    texte affiché et ses teintes : une page, un livre, une matière y prend
    sa teinte du nuancier de l'app par `data-teinte`, recopiée de
    `src/couleurs.js` dans `site.css` — les pages dessinées sont celles de
    l'app, papier de la couverture et signet, et ce qui se compte est en
    azur, depuis le 2026-10-27). Ses images dans `public/site/` (logo, image de partage
    `og.jpg`, affiches des emplacements vidéo, **hors du cache du service
    worker**) : le logo se calcule (`python3 tools/logo.py`, qui réécrit aussi
    son « sprite » dans `index.html`), les affiches, l'image de partage et
    les captures du manifeste (`public/shots/`) se photographient dans la
    démo sans compte, à 10 h du matin (`node tools/affiches.js`, sur un
    `vite preview` au port 4190). **Le même logo est celui de l'app**
    (2026-10-26) : `LOGO` de `src/icones.js` (`<img>` de `/site/logo.svg`,
    que le service worker garde hors ligne) en tête de la barre latérale et
    de la barre du haut (un bouton, `data-vers` : la première page du compte
    — jamais `data-r`, que les parcours ciblent ; au téléphone le logo seul)
    et sur l'écran d'ouverture ; les onglets du téléphone gardent leur titre
    en haut, sans logo (demandé le 2026-10-27) ; les icônes installées (`public/icons/*.png`) se
    photographient depuis `public/site/icone.svg` (`node tools/icones.js`).
    Parcours : `e2e/site.e2e.js`. **Tout est dans `docs/LANDING.md`** (dont
    comment insérer les vidéos).
    `app.html` — l'app (`noindex`) : écran d'ouverture inline, charge
    `/src/app.css` puis `/src/app.js`. Elle est servie à **toutes ses
    adresses** (voir « Adresses » plus bas : la réécriture de `vercel.json`
    vers `app.html`, et le relais `adressesDeLApp` de `vite.config.js` pour
    `npm run dev` et `vite preview`), et à **`/app`** — « l'app, sans plus de
    précision » : le routeur n'y reconnaît rien et la remplace par l'adresse
    de l'écran d'arrivée (`/connexion` sans session, l'espace du rôle
    sinon). Les boutons du site mènent aux adresses du routeur :
    `/inscription`, `/connexion`, `/carte-eleve`, `/essayer`, `/demo/prof`,
    `/demande-demo`, `/mentions/<texte>` ; « J'ai un code » à
    `/app?rejoindre=…` (`?defi=`, `?club=`). Le graphique du moteur de la
    page vient de `src/site/courbes.js` (pur et testé dans
    `test/site.test.js` : courbe d'oubli de FSRS, révision à 90 % ; Ultra en
    plein, Lite en pointillés — sa stabilité surestimée du double, `JUSTE_LITE`
    —, sans révision en dessous), la pile
    qu'on note dans le héros de `essai()` (`src/site/site.js`). **Sortir de
    l'app ramène au site, pas à la connexion** (demandé le 2026-10-26) :
    quitter la démo, se déconnecter (`logout()` attend la fin de `flush()`,
    2,5 s au plus, puis `/`), « Retour » d'un écran public sans écran de
    l'app derrière soi (`retourPublic()` de `ui/routeur.js` : l'entrée
    d'avant si l'app l'a posée, `rang > 0`, sinon `/`) ; l'app installée
    (`installee()` : icône d'écran d'accueil ou Capacitor) n'a pas de site
    et reste sur sa connexion. **Les écrans publics de l'app** (connexion,
    inscription, carte élève, essai, demande de démo, mentions avant la
    connexion) sont habillés comme le site : enveloppe `.pub` et
    `pubTete()` de `ui/connexion.js` (le logo `/site/logo.svg`, qui ramène
    au site, et le retour), la lumière bleu-rose sur `#app:has(> .pub)::before`
    (posée sur `#app`, elle ne repart pas quand on passe de la connexion à
    l'inscription), cartes de verre, titres en serif ; à partir de 900 px,
    la connexion a sa vitrine à gauche. Sans session et hors app installée,
    l'écran d'ouverture ne dure que le temps d'un fondu (`dropBoot`,
    `ui/import-cartes.js`) : on arrive du site.
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
    `cercle.js`, `reglages-corbeille.js` (réglages, corbeille, et la **porte du courrier** : `mailView`/`lettreView` chargent à la demande `courrier.js` + `courrier.css`, préfixe `co-` — la boîte, et la page d'une lettre, vue `lettre` : l'expéditeur et son jeton, la date, le message mis en avant, le livre avec sa matière et ses pages, lisibles avant de l'ajouter ; une lettre sans pages est un **mot** — celui d'un professeur à sa classe, `prof_message_classe` — et se montre comme tel, le nom de la classe et le message, sans livre de « 0 page » ; rien d'autre ne doit importer `ui/courrier.js`), `ecran-groupe.js` (recherche, et la **porte du journal** :
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
    (≥ 900 px) : six onglets — Accueil (les codes élèves et professeurs :
    copier, afficher en grand avec le QR, changer en deux appuis ; la licence ;
    ce qui demande une décision, chaque ligne menant à la liste filtrée),
    Classes (liste à gauche, détail à droite : renommer, équipe et professeur
    principal, élèves et « changer de classe », supprimer une classe vide),
    Élèves et Professeurs (recherche, filtre classe ou « sans classe », fiche :
    nom — le référent seul le corrige —, classe, rôle, mot de passe oublié,
    « Retirer de l'établissement » en deux appuis, `ref_retirer`, qui libère
    la place ; « Ajouter un professeur » ouvre son compte, `ref_new_account`,
    avec un mot de passe provisoire montré une fois, `motDePasseProvisoire`),
    **Licence** (2026-10-26, `ui/ref-licence.js`, dans le morceau : les places
    — une par élève ET par professeur — et le prix convenu, les factures et
    avoirs, chacun à son adresse `/referent/licence/factures/<id>` et
    imprimable, les coordonnées de facturation pour Chorus Pro, le fil des
    échanges avec Folio — « Des places », « Renouveler » préremplissent le
    sujet —, et les documents du contrat : conditions générales de vente,
    contrat de sous-traitance (art. 28 RGPD) avec les sous-traitants, fiche
    pour le registre — `ui/documents-etab.js` + `documents-etab.css`, préfixe
    `dc-`, chargés à la demande), Historique ; et, derrière un lien discret « Des élèves sans adresse e-mail ? »,
    les cartes élève, expliquées, imprimées avec leur QR. Au téléphone :
    les deux codes et la licence seulement. Chaque ouverture repart de
    l'accueil (`refPull` remet `ref.charge` à faux). L'ancienne console en
    feuilles (`refwho`, `refcls`, `refnew`) n'existe plus. De même,
    `ui/classement.js` est la **porte de la console de l'éditeur**
    (2026-10-26) : `adminView` charge à la demande `admin-console.js` +
    `admin-console.css` (préfixe `ed-` — **jamais `ad-`** : les bloqueurs de
    publicité masquent ces classes) et `core/admin.js` ; rien d'autre ne doit
    importer `ui/admin-console.js`. Trois onglets : **Établissements** — le
    suivi, du prospect au client (puces d'étape, recherche, la liste triée
    par ce qui presse : demande neuve, relance due, licence qui finit), et
    la fiche d'un établissement : l'étape (changée sur place), le **prochain
    pas** (`prochainPas` : lancer la démo en un geste, transmettre le code
    référent — un lien `mailto:` au contact avec le message tout écrit, ou
    copier —, passer en licence avec son prix), la licence et son usage, les
    codes élèves/professeurs, la fiche complète (contact, besoins, budget,
    relance, notes, message reçu), effacer un établissement sans comptes ni
    factures, et la **facturation** (2026-10-26, `ui/admin-facturation.js`,
    dans le morceau : ses pièces, « Émettre une facture » avec la ligne de
    licence proposée et l'aperçu des totaux, « Déposée sur Chorus Pro »,
    « Payée », « Annuler par un avoir » ; une pièce a son adresse
    `/admin/factures/<id>` ; ses coordonnées de facturation ; le fil des
    échanges et « Répondre » ; « message » dans la liste tant qu'un
    établissement attend) —, **Comptes** (rôle de chacun, rien de son
    contenu) et **Entreprise** (`/admin/entreprise` : l'identité du vendeur
    que chaque facture photographie — raison sociale et forme, adresse,
    SIRET, immatriculation, TVA, IBAN, régime de TVA, délai de paiement).
    Une facture ou un avoir se dessine par `ui/facture-vue.js` +
    `facture.css` (préfixe `fa-`), la même feuille dans les deux consoles. Les chiffres du
    haut : demandes, relances, démos, clients, élèves, revenu annuel, IA,
    signalements. PC d'abord, utilisable au téléphone (la liste, puis la
    fiche). L'ancien tableau et la feuille `account` n'existent plus. Les
    règles (tri, filtres, bilan, prochain pas, courriel) sont dans
    `src/etablissement.js`. **La barre d'un compte de gestion** (2026-10-26,
    `gestion()` de `bibliotheque.js` : l'éditeur, ou un référent dans son
    établissement) ne porte que ses pages — pour le référent les onglets de
    sa console (Accueil, Classes, Élèves, Professeurs, Licence, Historique ; au
    téléphone, Accueil seulement : `button.pc`), pour l'éditeur
    Établissements, Comptes et Entreprise, puis Signalements (modérateur) et Réglages —,
    jamais Livres, Courrier ni Cercle ; les onglets internes des deux consoles
    sont partis (`refAller`/`admAller` depuis `data-r="ref:…"`/`"adm:…"`).
    L'éditeur arrive sur sa console (`accueil()`), « Retour » ramène un
    compte de gestion à la sienne (`tapHome`), et ses Réglages se réduisent
    à son compte (nom de l'établissement, e-mail, mot de passe), la taille du
    texte, les textes du cadre et « Quitter » (`settingsGestionHtml`).
    `iAmMod` ne vaut vrai que si `is_mod()` rend `true`. **Navigation au téléphone** (2026-10-25) : `balayage.js` fait
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
    l'espace ne repeint jamais une feuille sous les doigts. Une lecture qui
    remplit une feuille déjà ouverte (la fiche d'un élève `fichePull`, « Ce
    qui bloque » d'un devoir `cartesBloquePull`) appelle `repeindre(true)` :
    sans ce drapeau, la feuille ouverte n'est jamais redessinée et ses points
    de chargement restaient pour toujours (corrigé le 2026-10-26).

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
    partout), `blason(classeId)` (un carré arrondi et un emblème) et
    `blasonClub(club)` (un **écusson** et un emblème, `.jt.club` : le masque
    `--ecu` de `app.css` — depuis le 2026-10-27, classe et club ne se
    confondent plus ; jamais un sigle tiré du nom), `medailleHtml(place)` (une
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
    puis la visite guidée ; un élève de classe (`isPupil`) : son pseudo (son
    nom de classe affiché à côté, fixe) puis son visage. Le pseudo suit la
    règle de `src/pseudo.js` pendant la frappe, la base dit s'il est libre
    (`pseudo_libre`), « Continuer » le vérifie avant d'avancer, et il part à
    la fin par `changerPseudo` (« Passer » garde celui donné d'office).
    Tout part à la fin, les préférences par `envoyerPrefs()`
    (`core/reglages-corbeille.js`, sans le délai de `savePrefs` : la visite
    passe aussitôt en démonstration, où plus rien ne part). Marqué fait par
    `prefs.bienvenue`. `maybeTour(pret)` attend la promesse d'`accueil()`
    (rôle et établissement connus) et n'ouvre l'accueil que sur l'écran
    d'arrivée, sans feuille ouverte — un élève qui a déjà touché son devoir
    l'aura à l'ouverture suivante. Les règles dans `src/bienvenue.js`, pur et
    testé (`test/bienvenue.test.js`) ; parcours `e2e/bienvenue.e2e.js`.
    **Le pseudo** (2026-10-27) : tout compte en a un et le change de
    partout — la ligne « Pseudo » des Réglages (les deux, gestion comprise),
    « Mon jeton » du cercle (`data-cc="pseudo"`), l'accueil —, élève de
    classe compris (son nom de classe reste). Une seule feuille, entrée
    `handle` de la table des menus, chargée à la demande par
    `ui/pseudo-porte.js` (`ouvrirPseudo`, `paintMenuPseudo`) :
    `ui/pseudo-feuille.js` + `pseudo.css` (préfixe `ps-`) — rien d'autre ne
    doit importer `ui/pseudo-feuille.js`. La règle pendant la frappe, la
    base pour la place (`pseudoLibre`, 300 ms après la dernière touche, avec
    une variante cliquable si c'est pris), `changerPseudo` pour enregistrer
    (`core/reglages-corbeille.js`, hors de la file : un pseudo se tranche
    contre ceux des autres, au moment même — hors ligne, l'écran le dit).
    L'ancien `saveHandle` (un POST de `profiles` avec `handle`) n'existe
    plus : la base le refuse. Parcours `e2e/pseudo.e2e.js`.
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
    du formulaire de démo, vue `decouvrir`, adresse `/essayer`) : `decouvrirView()` de
    `ui/connexion.js` charge `ui/demo.js` + `demo.css` (préfixe `dm-`) par
    sa porte, `ui/demo-porte.js` (`chargerDemo`, `ouvrirDemo` pour une
    adresse `/demo/<rôle>/…` rechargée : la démo reprend sur cet écran —
    rien d'autre ne doit importer `ui/demo.js`) ; on
    choisit élève (Léa, 2nde B), professeur (Marc) ou référent (Claire) du
    **Lycée Démo Folio** — chacun avec son visage, le même dans la démo et
    sur les trois rôles de la page d'accueil (`visageDemo`, `teinteDemo` de
    `monde.js`) — et la **vraie app** tourne : seul le réseau est
    remplacé. `setDemoEtab(servir)` branche dans `api()`/`apiPage()`
    (`envoyer` de `core/coeur-sync.js`) un `fetch` servi dans l'onglet par la
    **base locale** (`src/base-locale/`, le même Supabase en mémoire que les
    parcours e2e), semée par `src/base-locale/monde.js` (établissement en
    licence — 300 places, 900 € par an, deux factures dont une à régler, un
    échange avec Folio, ses coordonnées de facturation, un vendeur d'exemple
    qui se dit tel —, 4 classes et un groupe, 3 professeurs et leurs services, 20
    élèves qui ont travaillé — devoirs rendus, commencés, en retard —, la
    bibliothèque et dix semaines de journal de Léa, ses amis et une demande,
    son courrier, un historique de référent ; déterministe, identifiants en
    `dece0000-…`). Tout s'écrit donc pour de vrai, dans cette base : ce que
    Marc donne, Léa le reçoit ; ce qu'elle lit, il le voit ; une classe
    créée par Claire existe. Changer de rôle (bandeau `.dm-bandeau`, sous le
    voile des feuilles et caché pendant une révision) est une reconnexion
    sur un autre compte du même lycée (`resetSession`, `pull`, `accueil`).
    Le lycée est rangé en `sessionStorage` (`folio.demo`, aussi à
    `pagehide`) : rafraîchir le retrouve, fermer l'onglet l'efface ; chaque
    visiteur a le sien, rien ne part, mille personnes peuvent essayer en
    même temps. La session ne touche jamais le stockage (`saveAuth`, `save`,
    `saveBases` s'abstiennent en démo — un vrai compte ouvert sur
    l'appareil reste intact) ; « Quitter », « Se déconnecter » et `logout()`
    ramènent au site (`/`), et `effacerDemo()` (`ui/demo-porte.js`, appelé
    par `boot()` hors `/demo/`) efface `folio.demo` et toute clé
    `dece0000-`. **Le geste d'après** (2026-10-27) : le bandeau porte, dans
    la lumière de la marque, ce qui suit la démo selon le rôle (`suite` des
    `ROLES` de `ui/demo.js` : « Créer mon compte » vers `/inscription` pour
    l'élève, « Essayer dans mon établissement » vers `/demande-demo` pour le
    professeur et le référent ; libellé court et « Quitter » en icône au
    téléphone) ; partir par un tel lien (`data-dm="partir"`) efface la démo
    comme « Quitter ». **Ce qui coûte** — l'IA (onglets Fichier, Photo, Cours de
    la création), les images et les sons — est grisé en démo (`.payant`,
    pastille `data-astuce` « Avec Folio+ » au survol et un « + » tracé,
    `data-offre="plus"` : toute l'IA est dans Folio+) ; le toucher ouvre
    une fenêtre qui dit ce que ferait la fonction et mène au compte ou à
    Folio+ (`envie()` de `ui/demo.js`, par `ouvrirEnvie` de
    `ui/demo-porte.js`), et `aiCall`/`upload` refusent d'eux-mêmes (`demo`).
    **La démo d'un élève est Folio gratuit** (`html.en-demo-libre`, posé par
    le bandeau) : ce qui est dans Folio+ selon les tarifs de la page
    d'accueil — QCM et associations d'un livre, images et sons d'une page —
    porte le « + », se grise et ouvre la même fenêtre (`PLUS_SEUL`, écouté
    avant l'app), et la bibliothèque s'arrête à 5 livres à soi : au-delà,
    « Nouveau livre » se grise partout (`html.en-demo-plein`, recalculé à
    chaque rendu) et ouvre « Ta bibliothèque est pleine » ; le journal garde
    série, régularité et rythme, ses autres volets (`data-volet` de
    `ui/journal-ecran.js` : mémoire, pause, heures, matières, livres, pages
    qui résistent) se floutent sous leur titre (`.plus-floute`) et ouvrent
    « Ton journal complet ». **Ce que chaque offre ouvre est écrit une fois,
    dans `src/offres.js`** (pur et testé, `test/offres.test.js` : `MOTEUR`,
    `LIVRES_GRATUITS`, `IA_PAR_MOIS`, `PLUS_SEUL`, `JOURNAL_PLUS`, `permis`,
    `livresPermis`, `voletPermis`) : la démo s'en sert, la vraie app s'en
    servira avec le paiement et les licences de compte (M12) — elle ne bride
    encore rien.
    Preuve : `e2e/demo.e2e.js` (un devoir lu par Léa rendu chez Marc, un mot
    de Marc dans le courrier de Léa, une classe de Claire après un
    rafraîchissement, les onglets payants et leur fenêtre, le bandeau qui
    mène au compte sans rien laisser, aucune requête, rien qui reste après
    « Quitter »), `test/monde-demo.test.js`.

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
  - `src/fsrs.js` — le moteur, pur et testé (`test/fsrs.test.js`). **Réglé comme Anki, sans aucun curseur** (2026-10-25) : rétention visée figée à 90 % (`RETENTION`, `ui/carte-media.js` — `prefs.dr` n'est plus lu), intervalle plafond 36 500 j, paliers 1 min/10 min (rechute 10 min), flou d'Anki, et **l'équilibreur de charge d'Anki** (24.11+, actif par défaut : `equilibrer()`, jusqu'à 90 j, poids (1/n)^2,15 × (1/j)^3, 1 pour un jour vide, nourri par `chargeDes()` de `ui/carte-media.js`) ; les paramètres `w` se réoptimisent seuls (`fsrsAuto`). La page d'accueil annonce deux moteurs (2026-10-27, docs/LANDING.md) : **Memory Engine Lite** pour Folio gratuit (paramètres par défaut, sans équilibreur) et **Memory Engine Ultra** pour Folio+ et Campus (`fsrsAuto` + `equilibrer`) ; l'app ne les distingue pas encore, ce sera avec le paiement. Le mode simple n'est plus proposé : un compte qui l'avait gardé retrouve le moteur au démarrage (`rallumerMoteur`, `ui/menus-c.js`, arriéré étalé) — le code du mode reste pour la visite guidée
  - `src/fusion.js` — fusion à trois versions d'un paquet (M03.T4), pur et testé (`test/fusion.test.js`, `test/concurrence.test.js`). **Branchée dans la synchro depuis le 2026-10-16** (`reconcile()` dans `src/core/coeur-sync.js`, appelée par `flush()` quand le contrôle de `rev` échoue et par `pull()` pour un paquet en attente) : la base commune est la dernière version serveur connue de chaque paquet (`bases` dans `src/data/etat.js`, clé `cartes.bases.<uid>` du stockage local). Serveur inchangé → envoi ; changé avec base → fusion sans rien demander ; changé sans base fiable → la boîte de choix (`raiseConflict`), jamais d'écrasement muet. Ne jamais redonner à un paquet en attente le `rev` du serveur sans passer par `reconcile()` : c'était l'écrasement silencieux corrigé ce jour-là (preuve : `e2e/deux-appareils.e2e.js` échoue sur l'ancien code)
  - `src/file.js` — construction de la file de révision : sélection, quota de cartes neuves, ordre (M01.T3). **Comme Anki** (2026-10-25) : la journée bascule à 4 h (`debutJour`/`finJour`) ; une carte en révision (st 2) est due dès le début de son jour ; une carte neuve est une carte **jamais lue** (`estNeuve` : ni `n`, ni `lr`, ni `S` — une page ratée d'emblée n'est plus « neuve ») ; **20 neuves par jour et par livre** (`neuvesPermises`, comptées sur `c.fl`, l'heure de la première lecture posée par `grade()` et rangée dans `cards.meta`), aucun quota pour un devoir (cartes `a:`), « Lire +20 » pour aller plus loin (`studyplus`), « Tout lire » et les exercices sans quota ; le bouton « Lire » compte `aLire()` ; ordre `ordreAnki` (paliers, puis révisions par jour d'échéance au hasard dans un jour, neuves dans l'ordre du livre réparties parmi elles, `entrelacer`) ; pur et testé (`test/file.test.js`)
  - `src/parseur.js` — parseur de cartes : collage, Quizlet, Anki texte brut, CSV/TSV, JSON (M01.T4), pur et testé (`test/parseur.test.js`)
  - `src/invariants.js` — les 12 invariants qu'une carte doit toujours respecter (S>0, 1≤D≤10, cohérence de l'état FSRS...), pour l'entretien automatique de la bibliothèque (M04.T2) et la contrainte CHECK en base (M04.T3 : 7 contraintes `cards_*` sur `public.cards`, seulement celles que le moteur garantit par construction — une ligne refusée bloquerait la synchro de tout le paquet) — pur et testé (`test/invariants.test.js`). Attention : `n` compte les **réussites**, pas les passages (`grade()`, `fsrsReplayCard()`), donc une carte ratée d'emblée a une mémoire avec n = 0, et l > n est sain
  - `src/reparation.js` — réparation des cartes qui violent ces invariants, regroupées en 8 familles (`scanLibrary`/`repairLibrary`), branchée sur **l'entretien automatique** : `entretienAuto()` (`src/core/reglages-corbeille.js`), une fois par ouverture au calme après `pull()`, sans rien demander ni afficher — plus de bouton « Vérifier ma bibliothèque » depuis le 2026-10-25 ; chargée à la demande, comme `doublons.js` et `sauvegarde.js` (le démarrage n'a pas de marge) — pur et testé (`test/reparation.test.js`). Le pont SM-2 → FSRS (`sm2State`) vit désormais dans `src/fsrs.js`, partagé avec `fsrsSeed()`
  - `src/doublons.js` — déduplication (M04.T4) : même recto ET même verso dans un même paquet, on garde la carte la plus avancée et on additionne les rechutes ; passée par l'entretien automatique, **jamais sur un devoir** (chaque page y compte pour l'avancement) — pur et testé (`test/doublons.test.js`)
  - `src/sauvegarde.js` — export/import intégral de la bibliothèque (M04.T6) : format `folio-bibliotheque` v1, état d'apprentissage compris, sans `rev` ni marques d'écran ; restauré sous les mêmes identifiants sur le même compte, de nouveaux sur un autre (RLS) ; branché sur la feuille Sauvegarde (`backupData`/`backupRestore`, `src/core/reglages-corbeille.js`) — pur et testé (`test/export.test.js`)
  - `src/normaliser.js` — `norm()` (casse, espaces, apostrophes, ponctuation finale), sans aucune dépendance : lue par le noyau (`doublons.js`) et par les écrans (`ui/quiz.js` la réexporte)
  - `src/classe.js` — les règles d'une classe (2026-10-24) : forme d'un code (8 caractères, alphabet sans 0/O/1/I/L), lien `?rejoindre=`, texte de chaque statut d'inscription renvoyé par la base, état d'un élève, tris/recherche (sans accents), synthèses de classe et d'accueil, « à traiter », échéances sans décalage de fuseau, lecture d'une liste d'élèves collée (`lireListeEleves`, « NOM Prénom » ou « Prénom NOM »), nom propre (`nomPropre`), carte de connexion (`emailCarte`, `lienCarte`, `lireCarte`) — pur et testé (`test/classe.test.js`, 45 tests dont 4 fuseaux ; un taux de réussite ne se colore plus selon un seuil, `tonReussite` est parti le 2026-10-27 ; un filtre de la liste d'une classe, `correspond`, retient tout élève qui a ce qu'il dit — un élève jamais connecté qui a un devoir échu est aussi « en retard », comme au tableau de bord : « 2 élèves en retard » ouvrait un filtre vide, corrigé le 2026-10-26), employé par l'espace prof et « Mes classes ». Le sigle de classe et les teintes de classe d'avant sont partis le 2026-10-25 au profit des jetons (`src/jeton.js`)
  - `src/couleurs.js` — **les couleurs de l'app** (2026-10-27), sans dépendance : une couleur fait UN travail. L'**encre** habille ; l'**azur** (`AZUR`, six pas du plus clair au plus foncé, l'azur de la page d'accueil, jetons `--az1` à `--az6`) dit tout ce qui se compte — pages lues, régularité, rythme, mémoire (`MEMOIRE` : à lire sans couleur, puis `--az3`, `--az4`, `--az6`), objectif du jour, bilan d'une séance, classement, avancement d'un devoir, réussite d'une classe ; les **états** (`ETATS`, `--ok` `--ko` `--am`, assez sombres pour un petit texte sur leur propre teinte à 13 %) disent juste ou faux, à jour, en retard, attention, toujours avec une icône ou un mot ; le **nuancier** (`NUANCIER`, 14 teintes de reliure : Rouge, Orange, Moutarde, Olive, Vert, Canard, Ciel, Bleu, Marine, Violet, Prune, Rose, Cuir, Ardoise — `NOMS`) relie une matière, chaque teinte en cinq tons : `d` la reliure (dos, pastille, trait d'un graphique), `c` la couverture (fond d'un livre, papier d'une fiche), `b` son filet, `ci` l'encre sur la couverture (≥ 7:1), `f` la reliure foncée sous un chiffre blanc (≥ 4,5:1) — `sty()` de `core/coeur-sync.js` les pose en `--d --c --b --ci --f`. Les seize clés de la base (`subjects.color`) restent valables : `coral` et `amber`, qui doublaient une voisine, la rejoignent (`ALIAS`, `cleTeinte`) et ne se proposent plus ; `PALETTE` (de coeur-sync) répond à toutes ; `COLORS` donne les quatorze dans l'ordre où une matière nouvelle les reçoit (`SUCCESSION` : bleu, rouge, moutarde, vert, rose, ciel… ; `couleurLibre` de `src/matieres.js` prend la moins employée — dans l'ordre du nuancier, cinq matières créées de suite prenaient cinq voisines), le nuancier s'affiche dans l'ordre des teintes (`TEINTES`, `ui/menus-a.js`). Avant : ambre et jaune, indigo et violet, canard et cyan se confondaient (écart OKLab 2,8 à 4,5) et le vert voulait dire à la fois « juste », « relue », « jours lus », SVT et une classe. Pur et testé (`test/couleurs.test.js` : deux teintes à 10 au moins d'écart OKLab × 100, 5,5 pour un œil daltonien — Machado 2009 —, aucune reliure à moins de 8,5 de l'azur, contrastes, rampe d'azur à pas visibles, et les jetons de `app.css` identiques au module)
  - `src/jeton.js` — les jetons d'identité (2026-10-25) : 12 couleurs (chacune ≥ 4,5:1 avec du blanc, vérifié), 20 emblèmes (classes, clubs), le hachage stable qui tire un jeton par défaut de l'identifiant, les initiales (première lettre du premier et du dernier mot, jamais un chiffre en tête) — pur et testé (`test/jeton.test.js`). Rien n'est inventé à partir du nom : « CPGE ECP1 » donnait « CE1 » avec l'ancien sigle. Les 38 figures en émojis sont parties le 2026-10-25 : une personne a un avatar (`jetonPersonne` rend `avatar`, via `avatarDeCle`)
  - `src/pseudo.js` — les pseudos (2026-10-27) : la règle (`motif` : 3 à 20 caractères, minuscules, chiffres, point, tiret bas, une lettre en tête, une lettre ou un chiffre à la fin, jamais deux signes à la suite ; ni mot réservé — `RESERVES`, `PREFIXES` : « admin », « prof », « folio »… — ni grossier — `MOTS` comptés seuls, `RACINES` partout, chiffres lus comme des lettres), `saisie` (ce que le champ garde : sans accent, l'espace devient un point), `cle` (l'unicité au point et au tiret bas près), `proposer` (le prénom, sinon « lecteur »), `MESSAGES`. **Les listes sont mot pour mot celles de `pseudo_motif` en base** : `test/pseudo.test.js` les compare à la migration — en changer une, c'est changer les deux. Chargé seulement à la demande (la feuille du pseudo, l'accueil, la base locale). Pur et testé
  - `src/avatar.js` — les avatars (2026-10-25) : un visage en SVG composé de sept traits (peau 6, coiffure 10, cheveux 8, yeux 5, bouche 5, accessoire 6, haut 8) sur la couleur du jeton. **Aucune migration** : il s'écrit dans `profiles.figure` déjà là, « av » + une lettre par trait (`ecrireAvatar`/`lireAvatar`, `^av[a-z]{7}$`, que `mon_jeton` et `visuels` acceptent tels quels) ; une ancienne figure (« renard ») donne l'avatar tiré de son nom, le même partout. Listes fermées, ni photo ni texte libre (des mineurs). Pur et testé (`test/avatar.test.js`)
  - `src/defi.js` — les règles d'un défi en direct : jeux (QCM, vrai ou faux, réponse écrite), durées, nombre de questions, fabrication des questions depuis un livre, code à 6 chiffres et lien `?defi=`, statuts de la base, phase et chrono (décalage d'horloge compensé), places et podium — pur et testé (`test/defi.test.js`)
  - `src/journal.js` — le journal de lecture (2026-10-25), deux questions jamais mélangées : **ce que tu as fait** se lit dans le journal des révisions, où chaque ligne garde son contexte du moment (matière, livre, écart) — supprimer, fusionner, scinder, renommer un livre ou changer sa matière ne réécrit jamais le passé ; **ce que tu sais** se lit sur les cartes d'aujourd'hui (`savoir` : âges, maîtrise, rappel estimé FSRS, échéances). Une matière se reconnaît à son NOM (`cleNom`, sans casse ni accents) : un identifiant disparu garde le nom qu'il avait, deux matières du même nom n'en font qu'une. `PALIERS` (écarts 1/3/14/90 j) est passé à la base, qui ne fait que compter ; `rassembler` réunit la réponse de `journal()` et les révisions locales sans double compte (`connus`) ; jours en chaînes « AAAA-MM-JJ » dans le fuseau de l'appareil. `etatCarte` (l'âge d'une carte) y vit ; `cstate` de `ui/carte-media.js` en est l'équivalent historique. Pur et testé (`test/journal.test.js`, dont le scénario « 3 h de droit → changement de matière → fusion → suppression → recréation depuis un partage en anglais »)
  - `src/matieres.js` — une matière qui arrive d'un autre compte (devoir, lien, envoi à un ami) : retrouvée par son nom, créée sinon (identifiant libre, couleur la moins employée) ; sans nom, un identifiant n'est gardé que s'il existe ici (lien de sauvegarde du même compte). Pur et testé (`test/matieres.test.js`)
  - `src/base-locale/` — **un Supabase en mémoire** (2026-10-26, sorti de `e2e/`), servi aux parcours e2e (`e2e/faux-*.js` le réexportent, `brancher` le pose sur `page.route`) et à la démo sans compte (dans le navigateur) : `serveur.js` (`nouveauStore`, `repondre(store, { method, url, headers, body })` → `[statut, corps, en-têtes]` : auth, filtres PostgREST, `order`, `Range`, cloisonnement par `user_id` des tables personnelles et par `to_user` du courrier, `rev` des paquets, `sync_deck_cards`), `classes.js` (classes, devoirs et leur avancement comme le déclencheur `avancement_devoir` — dernière réponse par page, `pct`, rendu, retard —, `prof_eleve`, `prof_cartes`, `prof_message_classe` qui écrit dans le courrier, l'équipe par les services), `etablissement.js` (un seul code, consoles du référent et de l'éditeur, espace prof, une place par élève et par professeur : `placesPrises`/`placesLibres`), `facturation.js` (`licence_tableau`, factures et avoirs numérotés, échanges, `ref_retirer`, `ref_new_account`), `cercle.js`, `journal.js`, `pseudos.js` (2026-10-27 : `pseudo_libre`, `changer_pseudo`, `find_user`, un pseudo d'office à chaque ligne de profil neuve, et un POST ou PATCH de `profiles` qui porte `handle` refusé en 403 `42501` comme en vrai), `monde.js` (le Lycée Démo Folio, chacun avec son pseudo) et `uuid.js` (sans `crypto.randomUUID` hors contexte sûr). Un `store` est un objet sans Set ni Map : il se range en JSON. On émule ce que l'app appelle et lit, jamais la sécurité (elle se prouve en base). Une fonction SQL nouvelle dont un écran a besoin s'y ajoute — sinon, en démo et dans les parcours, l'écran reste vide. ESLint y coupe la seule règle de complexité (on y rejoue des fonctions SQL au plus près de leur texte)
  - `src/facture.js` — la licence d'un établissement, ses factures et ses échanges (2026-10-26) : montants en euros (`euros`, centimes partout), saisie (`enCentimes`), les totaux d'une facture avec la même règle que la base (`totaux` : arrondi par ligne, TVA sur le total HT, franchise de l'art. 293 B sinon), prix d'une place (`prixPlace`), ligne de licence proposée (`lignesLicence`), état d'une pièce (`etatFacture` : à payer, échue, payée, annulée par avoir, avoir ; `resteDu`), ce qu'une facture imprime (`enteteVendeur` — la forme accolée au nom, « EI » obligatoire —, `enteteClient` — SIRET, UAI, code service et bon de commande pour Chorus Pro —, `mentionsLegales` — TVA, échéance, virement, escompte, intérêts moratoires d'un acheteur public, pénalités, indemnité de 40 €), `SUJETS` et `nonLus` des échanges, `siretValide` (Luhn, et la règle de La Poste) — pur et testé (`test/facture.test.js`)
  - `src/offres.js` — ce que chaque offre ouvre (2026-10-27), sans dépendance : Folio gratuit (`gratuit`), Folio+ (`plus`), un compte d'établissement (`campus`) ; le moteur (Lite ou Ultra), 5 livres en gratuit, l'IA par mois, ce qui n'est que dans Folio+, les volets du journal réservés — la seule source de la règle, pour la démo aujourd'hui et le paiement demain — pur et testé (`test/offres.test.js`)
  - `src/club.js` — un club : nom (2–40), devise (≤ 90), code d'invitation lisible et lien `?club=`, classements (places partagées, barre relative, ma ligne), médailles — pur et testé (`test/club.test.js`)
  - `src/qr.js` — encodeur QR sans bibliothèque (octets, niveau M, versions 1–10, `qrSvg()`), pour projeter le code d'une classe et imprimer les cartes de connexion — pur et testé (`test/qr.test.js` ; relu 10/10 par le décodeur d'OpenCV le 2026-10-24). Le SVG porte ses couleurs : `svg.qr{stroke:none}` (sinon le trait que l'app donne à tout SVG grossit les modules)
  - `src/app.css` — ~2 400 lignes ; l'espace professeur a la sienne, `src/ui/prof-espace.css` (~620 lignes, préfixe `pf-`, chargée avec son morceau), la partie en direct aussi (`src/ui/direct.css`, préfixe `dx-`) ; le journal de lecture aussi (`src/ui/journal.css`, préfixe `jr-` : tout en azur — l'activité, la régularité, la mémoire du plus clair « à lire » au plus foncé « sue » —, chaque matière à sa reliure, le rouge pour les pages qui résistent) ; l'écran élève « Mes classes » est dans `app.css` (préfixe `el-`), le cercle aussi (`cc-`, `cl-` pour un club, `dn-` pour « Nouveau défi », `jt` pour les jetons). **Le moins de texte possible** (demandé le 2026-10-25) : des icônes et des chiffres plutôt que des phrases, aucun sous-titre explicatif sous un titre ou une carte, onglets du bas en icônes seules ; une explication vraiment nécessaire va dans une pastille « ? » (`hlp(clé)` et la table `HELP` de `ui/connexion.js`) ou un `title`, jamais en paragraphe sous l'élément. **Charte visuelle (refaite le 2026-10-24)**, sobre et la même partout : jetons dans `:root` (`--bg` #F6F5F1, `--bg2`, `--ink` #1D1C19, `--ink2`, `--soft`, `--card` blanc, `--hair`/`--line` pour les filets, `--edge` = filet intérieur de 1 px, `--ring` = halo gris du focus) ; titres de page dans la serif de la page d'accueil (`.hero`, `.bar h1`, le titre d'un livre, l'accueil du professeur : `--serif`, Charter avant Palatino — décidé le 2026-10-26, une seule voix du site à l'app), tout le reste en sans-serif, surfaces blanches cernées d'un filet, ombres à peine visibles. **Une couleur, un travail** (2026-10-27, `src/couleurs.js`) : l'azur compte, les états jugent, le nuancier relie une matière, l'encre habille — un chiffre reste à l'encre, la couleur va à la marque à côté (barre, pastille, icône). **Un livre a une reliure et une couverture** : sur l'étagère, en liste et en tête de sa page, le dos plein de sa matière (11 px, le léger dégradé d'une toile tendue), la couverture teintée (`--c`) cernée de son filet (`--b`), le nom de la matière en petites capitales quand plusieurs se côtoient (`.mixte`), le nombre à lire en chiffre blanc sur la reliure foncée (`--f`) ; chaque page de la liste garde un liseré de 4 px de sa reliure ; la fiche qu'on lit est une page de ce livre : le papier de la couverture, le nom de la matière en tête (`.sbj`, sur chaque face, marathon compris) et le grand signet de la reliure (le petit d'avant, sur une fiche blanche, ne se reconnaissait pas) — le QCM aussi. La pastille d'une matière choisie (filtre, création) prend sa couverture. **La forme dit ce que c'est** : un rond et un visage pour une personne, un carré arrondi pour une classe (ses repères dans les listes aussi : jamais un rond, réservé à la pastille d'une matière), un écusson pour un club. Les interrupteurs et les choix cochés sont à l'encre, jamais au vert. **Aucun contour noir** : `:focus` n'a pas d'outline, `:focus-visible` un trait gris clair (clavier seulement), les champs n'en ont pas du tout — c'est leur cadre qui s'éclaire (`:focus-within` + `--ring`). Sur ordinateur (≥ 900 px) : barre latérale de 236 px (entrées groupées en haut, Réglages et compte en bas), contenu centré à 1 120 px (1 240 ≥ 1 500 px) ; **gabarit unique** (2026-10-25) : toutes les pages de premier niveau (Livres, Journal, Ma classe, Cercle des lecteurs, Courrier, Réglages) ont la même largeur et leur titre au même endroit (`.top`, 52 px de haut) — plus de colonne étroite centrée, c'est le contenu qui se range en colonnes (Réglages en deux colonnes de sections `.rg`, Ma classe « à faire » | « mes classes » `.el-grille`, Courrier et Corbeille en grille, Journal en tableau de bord) ; **les feuilles ne sont plus des tiroirs de téléphone** : `placerSurPC()` (`ui/menus-a.js`) accroche une feuille légère — une bulle « ? », une liste d'actions comme le menu d'un livre — sous le bouton qui l'a ouverte (`.menu.pop`, elle défile si elle est longue, jamais sous la barre latérale), et fait d'un formulaire une boîte de dialogue (`.menu.dlg`, sans poignée ni geste de glisser) — jamais une fiche en tiroir (`.pf-tiroir`), un tableau, une grande feuille (`.large`) ni un calendrier (`.pf-cal`), qui s'accrochait en petit menu coupé sous sa ligne ; mises en page à deux colonnes (livre, création, bilan) ; **le livre sur PC tient dans l'écran** (2026-10-25) : seule la liste des pages défile (`.rows` défile seule, `minmax(0,1fr)` en dernière rangée de la grille — sans ce plancher la page entière défilait de nouveau), sa position est gardée quand le livre se repeint (`retenirListe`/`rendreListe`, `ui/connexion.js`) et « Plus… » s'y observe (`root` de l'IntersectionObserver) ; **la recherche dans un livre ne repeint que la liste** (`repeindrePages`, jamais `render()` pendant la frappe : le clavier d'iPhone sautait) et son champ est `flex:none` (dans la colonne flex de la page, `.fld` s'étirait sur tout l'écran) ; une barre qui ne porte qu'un retour à l'accueil est masquée, la barre latérale y mène déjà. Plus de mode zen (retiré le 2026-10-25). **Le mouvement (2026-10-25) : ne s'anime que ce qui ARRIVE, une seule fois** — l'app redessine en `innerHTML`, et un nœud neuf rejouait son entrée : un jour choisi dans le calendrier d'un devoir, une case cochée, dix appuis sur le même onglet relançaient la page, la feuille, la barre du bas. `src/ui/mouvement.js` (sans autre import que la racine) : `entreeEcran()`, appelée par `render()`, ne pose `.fade` qu'à un vrai changement d'écran (`view.name:id`) et l'ôte après 560 ms ; un redessin pendant l'entrée la prolonge au même point (`--retard`, délai négatif), redemander l'écran où l'on est ne rejoue rien. Un élément qui apparaît au milieu d'un écran porte une clé `data-k` (barre du bas, bouton flottant, barre de sélection `.selb`/`.pf-bulk`, onglet d'une classe `.pf-corps`, onglet de création `.cr-panel`, page ajoutée `.dc`, question d'un quiz `.qz`, bilan `.rev`, joueur d'une partie `.dx-chip`, étape d'une partie `.dx`) : un observateur lui donne `.neuf` — et donc son animation — seulement si aucun élément de même clé n'était à l'écran. **Toute nouvelle animation d'entrée s'écrit sous `.fade` ou `.neuf`, jamais nue.** La glissière des onglets glisse depuis là où on la voyait, une barre de progression (`avancer()`) depuis sa largeur d'avant (elle repartait de 0 à chaque réponse), le chrono d'un quiz ne repart plus à zéro sur un redessin, l'entrée allumée de la barre latérale change sur place. Les feuilles (`menus-a.js`, `poser`) : redessinées, elles gardent leur point d'entrée, leur défilement et le champ actif ; leur hauteur glisse, une autre étape (`data-etape`) fond le contenu ; à la fermeture (`sortirFeuilles`) elles repartent par où elles sont venues (animations web, depuis leur position du moment) en `.sort` — `inert`, `aria-hidden`, sans identifiants, sans gestes —, et une feuille qui s'ouvre retire aussitôt les sortantes ; le voile ignore un tap dans les 350 ms qui suivent l'ouverture (`vientDOuvrir`, un double appui refermait la feuille). Un toast identique déjà affiché reste en place, un autre change de texte sans rejouer son entrée. Durées : 0,2 à 0,4 s, six pixels, courbe `--e` (entrées), `--ios` (feuilles), `--out` (sorties), échelonnement plafonné à 11 éléments ; mouvement réduit : ni entrée ni boucle. Preuve : `e2e/animations.e2e.js` (aucune animation d'entrée en cours après chaque geste, défilement de la feuille gardé ; échoue sur l'ancien code)
  - `src/sw.js` — modèle du service worker ; `vite.config.js` le fabrique au build. Il met en cache `/app` (la coquille de l'app, sous l'adresse qu'on navigue) et `/`, jamais les `.map` ni `public/site/` (sauf `site/logo.svg`, le logo de l'app elle-même : barre, onglets, ouverture, écrans publics) ; hors ligne, une navigation sans copie retombe sur `/app`. Hors ligne, il cherche dans le cache avec `ignoreVary` : le serveur répond `Vary: Origin` et un morceau chargé à la demande, demandé comme module avec un en-tête `Origin`, ne retrouvait pas sa copie d'installation (il ne s'ouvrait jamais hors ligne avant le 2026-10-25)
  - `public/` — fsrs.wasm, manifeste, icônes
  - `e2e/` — parcours de bout en bout Playwright (M07), nommés `*.e2e.js` pour que vitest ne les ramasse pas ; `playwright.config.js` construit puis sert le build de production (`vite preview`, port 4173), téléphone 390 px ; les parcours ouvrent l'app par `goto('./app')` (la racine est la page d'accueil du site ; le routeur remplace `/app` par l'adresse de l'écran). Première fois sur une machine : `npx playwright install chromium` (session Claude dans le cloud : rien à installer, le Chromium est déjà là — `tools/pw-local.config.js`, voir « Commandes utiles »). Les parcours parlent à un **faux Supabase en mémoire** (la base locale de `src/base-locale/`, que `e2e/faux-supabase.js` branche par `page.route` ; `e2e/faux-*.js` en réexportent les modules) : jamais à la vraie base, faute de préproduction (M13.T4) — il émule seulement ce que l'app emploie (auth, filtres PostgREST, `Range`, `rev` des paquets, `sync_deck_cards`, un cloisonnement par `user_id` des tables personnelles pour que deux comptes ne voient pas les livres l'un de l'autre) ; les fonctions des classes sont rejouées dans `e2e/faux-classes.js` (créer une classe, comptes à carte, salle d'attente, devoirs ; `faireProfesseur(store, email, nom)` pose le rôle), le journal (déclencheur `contexte_revision` et fonction `journal()`) dans `e2e/faux-journal.js`, celles du cercle dans `e2e/faux-cercle.js` (amis, classement, clubs, salles en direct avec le même calcul des points, jetons ; `store.lectureMs` raccourcit les 3 s de lecture ; `semerCompte`, `semerPseudo`, `semerAmis`, `semerLectures`, `semerClub`, `semerJeton`) ; la RLS et le SQL se testent en base. `e2e/animations.e2e.js` compte les animations d'entrée en cours (`document.getAnimations()`) après chaque geste. Un compte sans rôle déclaré reçoit de `my_role` une réponse vide (la vraie dit « eleve ») : la visite guidée ne s'invite pas dans les parcours. `store.online = false` simule une coupure ; deux pages sur le même store = deux appareils du même compte, deux **contextes** (`browser.newContext`) = deux personnes. Gestes communs dans `e2e/aide.js`. Les captures de référence de `captures.e2e.js` (comparées seulement sur Mac) ont été retirées avec la refonte visuelle du 2026-10-24 : le premier `npx playwright test captures` lancé sur un Mac les réécrit (il échoue une fois en signalant les images manquantes) ; les regarder, puis les committer
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
- **Adresses** (2026-10-26) : chaque écran a son chemin, rangé dans l'espace de son métier — `/connexion`, `/inscription`, `/carte-eleve`, `/essayer`, `/demande-demo`, `/mentions/<texte>` avant la connexion ; `/eleve/…`, `/prof/…`, `/referent/…`, `/admin/…` ensuite ; `/demo/<rôle>/…` pour la démo sans compte. `src/routes.js` (pur et testé, `test/routes.test.js`) traduit un écran `{ name, id, sous }` en chemin et l'inverse (`ROUTES`, `chemin`, `lireChemin`, `aRouvrir` : une révision, un quiz, une partie ne se reprennent pas depuis une adresse, on rouvre leur livre ou le cercle). `src/ui/routeur.js` s'en sert : `synchroniser()`, appelé à la fin de `render()`, donne à l'adresse le chemin de l'écran (une entrée d'historique par changement d'écran ; un écran « de passage » — création, révision, quiz, accueil, partie — est remplacé par le suivant ; revenir à l'écran d'avant recule dans l'historique au lieu d'empiler une copie, `pile`/`rang` dans `history.state`) ; `popstate` rouvre l'écran de l'adresse (`OUVRIR`, une fonction par écran) ; au démarrage, `cibleDepart()` lit l'adresse avant tout, `accueil()` ne mène pas à l'arrivée du rôle si elle désigne autre chose (`cibleEnAttente()`), et `armer()` l'ouvre une fois le rôle connu — **le routeur ne touche à rien tant qu'il n'est pas armé** (le cache affiché au démarrage ne doit pas écraser l'adresse qu'on suit), et il n'arme qu'une fois l'écran demandé ouvert (un morceau à la demande, l'espace professeur, se fait attendre). Sans session, une adresse d'espace attend la connexion en `sessionStorage` (`folio.cible`). Une adresse d'un autre espace ne garde qu'un écran précis (un livre, un profil) ; sinon l'arrivée du compte. Les onglets d'une classe de professeur (`prof.tab`), de la console du référent (`ref.tab`, `ref.open` — une classe, ou une facture sous Licence —, posés à la première ouverture par `ref.cible`) et de l'éditeur (`adm.tab`, `adm.open`, `adm.fid` pour une pièce) font partie du chemin (`refAller`, `admAller`, `allerClasse`, `allerAgenda` par leurs portes). **Tout nouvel écran s'ajoute à `ROUTES` et à `OUVRIR`**, sinon il n'a pas d'adresse (l'adresse ne bouge pas). Les ressources se demandent par un chemin absolu (`/icons/…`, `BASE_URL + 'fsrs.wasm'`) : un chemin relatif casserait sous `/prof/classes/…`. Vercel sert `app.html` à toute adresse qui n'est pas un fichier (`rewrites` de `vercel.json`, sauf `/assets/`, `/icons/` et `/site/`) — la racine `/` reste la page d'accueil du site, le fichier `index.html` passant avant la réécriture ; `npm run dev` et `vite preview` font de même (relais `adressesDeLApp`, `vite.config.js`) ; le service worker range toute navigation de l'app sous « app », la page d'accueil sous « / ». Preuve : `e2e/adresses.e2e.js`.
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
  - **Pseudos** (`20261027090000`) : **tout compte a un pseudo** (`profiles.handle` non nul), donné d'office à la création de sa ligne de profil par le déclencheur `profiles_pseudo` (`pseudo_neuf` : le prénom, sinon « lecteur », et des chiffres s'il est pris ; un pseudo hors de la règle ou pris à l'insertion est remplacé, jamais refusé — `prof_creer_eleves`, `ref_new_account`, `rejoindre` passent sans y penser). La règle `pseudo_motif` (contrainte `profiles_pseudo_regle`), l'unicité sur `cle_pseudo(handle)` (index `profiles_pseudo_unique` : « lea.martin » = « lea_martin »). **L'API brute n'écrit plus le pseudo** (droits par colonne : `insert (id, email, name, figure, teinte)`, `update (… , updated_at)`) : il ne se change que par `changer_pseudo(p)` (jsonb : `ok`, un verdict de la règle, `meme`, `pris`, `trop` avec `jusqua` — deux changements par semaine), `pseudo_libre(p)` dit ce qu'il en est pendant la frappe (avec `suggestion` si c'est pris) ; un pseudo quitté reste 30 jours à son ancien titulaire (`pseudo_journal`, RLS : chacun lit le sien, aucune écriture ; purgé à 60 jours par `purge-pseudos-quotidienne`). `lock_identite_scolaire` ne verrouille plus que le nom et l'adresse d'un élève d'établissement : son pseudo a sa porte. `find_user` cherche au point et au tiret bas près. `pseudo_pris`, `pseudo_neuf`, `profiles_pseudo` sont internes.
  - **Jetons d'identité** (`20261025111500`, correctif `20261025113100`) : `profiles.figure`/`teinte` et `classes.embleme`/`teinte` (clés `^[a-z]{2,16}$`, rang 0–11, contraintes CHECK). Une seule porte de lecture, `visuels(personnes, classes)` (200 et 100 au plus), qui ne rend un choix qu'à qui partage quelque chose (amis même en demande, club, classe — camarades, professeurs, salle d'attente —, partie en direct, référent de l'établissement) ; `mon_jeton(cle, rang)` pour soi (un élève à carte aussi : son nom reste verrouillé) ; `prof_jeton_classe(cid, cle, rang)` pour qui gère la classe. `voit_personne`/`voit_classe` sont internes : **révoquer aussi `authenticated`** (les privilèges par défaut de Supabase le lui donnent, révoquer PUBLIC et anon n'y touche pas).
  - **Journal des révisions** (`20261025170855`) : chaque ligne de `reviews` porte sa photographie — `subject`, `subject_name`, `deck_name`, `ecart` (jours depuis la lecture précédente de la page, -1 la première fois) — et son `created_at` est l'heure de la lecture, envoyée par l'app (hors ligne compris), pas celle de l'envoi. Le déclencheur `contexte_revision` complète ce qu'une app ancienne n'envoie pas (depuis le paquet et le journal), sans jamais remplacer ce que l'app a dit, et ramène une date future à maintenant. **Ne jamais réécrire ces colonnes après coup.** Les statistiques passent par `journal(p_depuis, p_tz, p_bornes, p_locaux)` (security invoker, jsonb : `jours` regroupés par jour/matière/livre/palier, `heures`, `matieres` et `livres` = noms du moment, `toujours`, `connus`). `shared_deck` rend aussi `subject_name`, `mail.subject_name` voyage avec un livre envoyé : c'est le nom qui voyage, jamais l'identifiant.
  - **Profil d'un lecteur** (`20261025200000`) : `profil_lecteur(u, p_tz)` (jsonb) — statut `ok` (soi, ami accepté, membre d'un même club : décomptes et noms de matières, jamais un livre ni une carte), `prive` (quelqu'un qu'on voit déjà par `voit_personne` — camarade, professeur, joueur, demande en attente : nom, pseudo, ancienneté, clubs en commun, pas de chiffres), `inconnu` (personne d'autre, ou un blocage dans un sens ou l'autre).
  - **Page d'une classe, côté élève** (`20261025210000`) : `eleve_classe(cid)` (jsonb) — `inscrit` (un élève de la classe : nom, niveau, établissement, date d'entrée, `peut_quitter`, `profs` avec leur matière et le principal, `eleves` sous leur nom de classe avec le lien d'amitié de chacun, jamais un compte bloqué, jamais le code), `attente` (salle d'attente : nom de la classe seulement), `inconnue` (personne d'autre, ou classe archivée).
  - **Établissements : un seul code** (`20261025233000` puis `20261026001000` ; les parcours en clair dans **`docs/PARCOURS.md`**, à lire avant d'y toucher) : un élève entre avec UN code — celui de son établissement (`org_codes.eleve`) ou de son professeur particulier (`codes_profs`) — et `rejoindre(code, prénom, nom, classe)` le fait entrer **aussitôt**, sans validation (la sécurité est dans le code : 8 caractères, 10 faux/h tous codes confondus dans `class_join_attempts`, changeable à tout moment) ; `code_apercu(code)` dit d'abord ce que c'est et rend la liste des classes à choisir (statut `choisir` si l'élève n'en a pas pris une alors qu'il y en a). Plus de code par classe pour un élève (les anciens codes de classe marchent encore, `class_preview`, mais l'app ne les montre plus). Dans un établissement, un élève a **une** classe (`classes.genre = 'classe'`, la même pour tous ses camarades) et des **groupes** (`'groupe'`) que forment les professeurs en sélectionnant des élèves (`prof_groupe`, `prof_eleves_etab`) ; un professeur choisit ses classes (`prof_classes_etab`, `prof_enseigner`) ; `ref_move_student` ne touche que la classe, jamais les groupes. Le code professeur fait entrer un professeur, le code référent (usage unique, 30 j) un référent — et pose les **classes d'exemple** d'une démo (`orgs.exemples`, `poser_exemples`). Un professeur particulier (rôle prof sans établissement) a son code (`prof_mon_code`) ; son premier élève lui crée « Mes élèves » ; `prof_ajouter_eleve` range un élève dans une autre de ses classes ; un élève d'un lycée peut aussi suivre un professeur particulier. Le nom « Prénom NOM » est figé à l'entrée : seul le référent le corrige (`ref_update_account`). Licence : `orgs.offre` (`demo` | `etablissement`), `places`, `licence_fin` (`etab_verdict` : `licence`, `plein`…). Les codes vivent dans `org_codes` et `codes_profs`, **tables sans aucune politique** (tout membre lit sa ligne `orgs`). Côté vente, pour l'éditeur seul : `org_suivi` (étape prospect/démo/client/pause/perdu, contact, besoins, budget, prix, notes, relance ; **sans aucune politique**, lu par `admin_orgs`), `admin_etab_enregistrer(org, fiche jsonb)` (le formulaire), `admin_lancer_demo(org, places, jours, exemples)`, `admin_licence`, `admin_code_ref`, `admin_supprimer_etab` (seulement sans comptes : le contact part avec), et **`demander_demo(...)`, ouverte à `anon`** — la seule avec `shared_deck` —, freinée en base (20 demandes/h en tout, une par adresse et par jour).
  - **Espace professeur, un seul code** (`20261026030000`) : `prof_classes` rend aussi `genre` ; dans un établissement, `prof_creer_classe` crée un **groupe** (une app ancienne ne glisse plus une classe de plus dans la liste que voient les élèves) ; `prof_code_etab()` donne au professeur le code élèves de son établissement, pour le projeter (le code professeurs et le code référent restent au référent).
  - **Codes renouvelés seuls** (`20261026110000`) : un code élèves ou professeurs fait entrer sans validation, il ne doit pas traîner. `org_codes.rythme` (`semaine` par défaut — décidé le 2026-10-26 —, `mois`, `trimestre` ; jamais « jamais »), `eleve_au`/`prof_au` (date du code) ; la tâche pg_cron `renouveler-codes-quotidien` (02:53 UTC) appelle `renouveler_codes()` (interne, aucun droit pour `authenticated`), qui tire un code neuf pour chaque code échu et l'écrit au journal du référent (`ref_audit`, « code renouvelé », sans auteur) ; ceux qui sont entrés restent. `ref_codes()` rend aussi `rythme`, `eleve_jusqua`, `prof_jusqua` ; `ref_nouveau_code` repart d'une période pleine ; `ref_rythme(p)` pour le référent seul. La console montre « Nouveau code le … » sous chaque code et le rythme en dessous (`RYTHMES`, `renouvellement`, `changeLe` de `src/etablissement.js`). Le code référent n'est pas concerné (usage unique, 30 j).
  - **Licence, factures, échanges** (`20261026130000`, décidé le 2026-10-26 : « même licence peu importe ») : **une place par élève ET par professeur** (le référent n'en prend pas) — `etab_places_prises`/`etab_libres` (internes), le même plafond pour le code professeurs (`etab_verdict`), le compte qu'ouvre le référent (`ref_new_account`, plus d'adresse au journal) et les cartes élève (`prof_creer_eleves`) ; `ref_retirer(cible)` sort quelqu'un de l'établissement (ses classes et groupes d'ici, ses services ; les groupes qu'un professeur avait formés sont archivés ; le compte et ses livres restent) et libère sa place. **Factures** : `vendeur` (une ligne, l'éditeur : `admin_vendeur`, `admin_vendeur_enregistrer`), `org_facturation` (les coordonnées du client : `facturation_enregistrer(fiche, org)`, le référent pour le sien, l'éditeur pour n'importe lequel), `factures` (facture ou avoir, totaux en centimes calculés par `admin_facturer(org, lignes, debut, fin, objet)`, TVA selon le régime du vendeur, photographie du vendeur et du client à l'émission ; **inaltérables** — déclencheur `factures_inalterables` : ni modification ni suppression, seules `deposee_le` et `payee_le` bougent par `admin_facture_dates` ; une erreur se corrige par `admin_avoir`, un seul par facture), numérotée sans trou par série et par année (`facture_compteurs`, `numero_suivant` interne : F-AAAA-0001, A-AAAA-0001) ; un établissement facturé ne s'efface plus (`admin_supprimer_etab`, conservation dix ans). `licence_tableau(org)` rend tout au référent (places, prix convenu de `org_suivi` — le seul chiffre du suivi qu'il voit —, coordonnées, pièces sans leurs lignes, échanges, vendeur sans IBAN), `facture(fid)` une pièce entière ; `licence_org` (interne) dit de quel établissement on parle. **Échanges** : `org_echanges` (de `etab` ou `folio`, sujet `places`/`renouvellement`/`facture`/`question`), `ref_ecrire` (20 par jour), `admin_repondre` (répondre, c'est avoir lu), `echanges_lus`, `admin_echanges_attente`. Tables à RLS, lecture par le référent de l'établissement et l'éditeur, aucune écriture directe. À l'appliquer, le seul établissement réel n'avait aucun compte : personne ne s'est retrouvé « plein ».
  - **Console du référent** (`20261026020000`) : `ref_personnes(q, qrole, qclass, sans_classe, lim, off)` rend **une ligne par personne** (sa classe de rattachement, jamais un groupe ; filtre sur une classe ou un groupe ; les élèves sans classe ; recherche sans casse ni accent ; `carte` pour un compte à carte ; `total` pour la pagination) — `ref_people` reste pour les anciennes apps installées. Les cartes élève du référent passent par `prof_creer_eleves` (`class_manager` l'admet sur une classe de son établissement).
  - **Tests SQL** : `supabase/tests/*.sql`, à lancer tels quels (MCP `execute_sql`) — tout se passe dans une transaction annulée, avec des comptes jetables et le vrai rôle `authenticated` (RLS et droits réels). `execute_sql` ne rend que le résultat de la **dernière** instruction (le `rollback`, donc rien) : pour lire le bilan, remplacer le `select … from zz_res` final et le `rollback` par un `do $$ begin raise exception 'RESULTATS %', (select … from public.zz_res); end $$;` — l'erreur porte le bilan et annule tout. `classes_securisees.sql` (56 cas), `identite_eleve.sql` (23 cas), `defis_direct.sql` (44 cas), `jetons.sql` (23 cas), `journal.sql` (18 cas), `profil.sql` (19 cas), `classe_eleve.sql` (12 cas), `etablissement.sql` (72 cas : du prospect au client, les quatre codes et leur renouvellement, classes et groupes, la liste du référent, l'espace professeur, licence, anon) `licence.sql` (51 cas : une place par professeur, retirer, coordonnées, factures — totaux, numérotation, photographie, inaltérables, avoirs —, échanges, qui lit quoi) et `pseudos.sql` (27 cas : un pseudo pour tous, la règle et l'unicité même en base, l'API brute refusée, `pseudo_libre` dans l'ordre de la règle, deux changements par semaine, la réserve de 30 jours, l'élève d'établissement, `find_user`, le journal, le référent, les droits).
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
  `id`/`scope` à `/` et `start_url` à `/app` (depuis le 2026-10-26 : la racine
  est la page d'accueil du site), `launch_handler` (`navigate-existing`) et
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
npm run budget                       # au démarrage JS ≤ 120 Ko, CSS ≤ 25 Ko ; chargés à la demande (prof, direct, journal, courrier, profil, classe, consoles du référent et de l'éditeur, demande de démo, sauvegarde, entretien… cumulés) JS ≤ 68, CSS ≤ 27 ; la démo sans compte à part (fichiers `demo-…`, base locale comprise) JS ≤ 30, CSS ≤ 3 ; les consoles du référent et de l'éditeur à part (fichiers `ref-…`, `admin-…`, `facture-…`, `documents-…`) JS ≤ 30, CSS ≤ 8 ; la page d'accueil du site (HTML + CSS + JS) ≤ 48 (gzip, tools/budget.js, M08.T2) — sur dist/, après un build
npm run typecheck                    # tsc --noEmit, vérification douce sur src/core/ (M06.T8)
npm run e2e                          # parcours de bout en bout (Playwright, e2e/*.e2e.js) sur le build servi par vite preview (M07)
grep -n -- "---------- " src/ui/*.js # table des matières des écrans
python3 tools/logo.py                # le logo (public/site/, public/favicon.svg, sprite de index.html)
node tools/affiches.js               # affiches du site, image de partage, captures du manifeste, depuis la démo (vite preview --port 4190 d'abord)
node tools/icones.js                 # icônes de l'app installée (public/icons/), depuis public/site/icone.svg
bash tools/academie/installer.sh     # la Folio Academy, une fois : Python à part (.academie/), voix de repli Kokoro sans clé
node tools/academie/tourner.js tout  # les trois vidéos de formation, filmées dans la démo (.academie/sortie/) ; --rep pour répéter
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

**La Folio Academy** (2026-10-27, `tools/academie/README.md`) : trois vidéos de
formation courtes (élève, professeur, référent : l'essentiel, le reste en
« À découvrir »), filmées dans la démo sans compte — un scénario par vidéo dans
`tools/academie/formations/`, à reprendre quand un écran change (`--rep` dit
où il casse). La voix : Gemini TTS si `GEMINI_API_KEY` (clé gratuite
Google AI Studio, à ranger dans les variables de l'environnement, jamais
dans le dépôt ; `generativelanguage.googleapis.com` est joignable),
Google Cloud Chirp 3 HD si `GOOGLE_TTS_API_KEY`, Kokoro hors ligne sinon.
Tout ce qui est lourd (Python, modèles, images, vidéos) vit dans `.academie/`,
ignoré par git. `fetch` de Node refuse le port 4190 (« port interdit » de la
norme Fetch) : `tourner.js` passe par `node:http`.

Comptes de test : `supabase/comptes_test.sql` (admin, prof, élève, et le référent du « Lycée d'essai Folio », créé par le vrai chemin : fiche et démo par l'éditeur, puis le code référent).
