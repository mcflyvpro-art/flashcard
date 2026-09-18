/* ══════════ état ══════════
   Tout l'état mutable de l'app vivait, jusqu'ici, en `let` éparpillés
   dans app.js — jamais rassemblés, jamais listés : impossible de savoir,
   sans grep, ce qui est de l'état partagé. Il vit maintenant ici, un
   seul endroit (M06.T3/M06.T4).

   Chaque variable est exportée par une liaison vive ES (`export let`) :
   n'importe quel module qui l'importe (`import { db } from
   './data/etat.js'`) lit toujours sa valeur courante, sans rien à
   refaire pour ça. Mais une liaison importée ne peut pas être
   réassignée depuis l'extérieur — d'où un « setter » générique par
   variable (`setDb`, `setView`...) : la seule façon, hors de ce
   fichier, de remplacer une valeur plutôt que de modifier ses champs en
   place (`db.decks.push(x)` reste direct, aucun setter n'est requis
   pour ça — seule une réaffectation complète du nom passe par le
   setter). Chaque setter rend la valeur qu'il vient d'assigner, comme
   une affectation JS normale, pour rester la même chose à l'usage que
   l'ancien `x = y`.

   Pas de règle métier ici, seulement des boîtes et leurs poignées :
   le contenu de chaque variable reste décidé par qui l'utilise.
   `auth` démarre à `null` : sa vraie valeur initiale vient de
   `loadAuth()`, qui lit le localStorage — un effet de bord qui reste
   dans app.js, juste après l'import de ce module. */

export let auth = null;

export let db = { subjects: [], decks: [], hist: {} };

export let view = { name: 'home' };

export let filter = '';

export let peek = false;

export let study = null, quiz = null, menu = null, typing = 0, pendingGrade = null;

export let dirty = {}, gone = [], online = true;

export let outbox = [];          // révisions et séances en attente d'envoi

export let trash = { n: 0, list: null, err: 0 };

export let splitSize = 12;

/* boîte de réception : n = non lus (toujours à jour), list = plein détail
   (chargé seulement à l'ouverture de l'écran, comme la corbeille) */
export let mailbox = { n: 0, list: null, err: 0 };

export let stats = { rows: null, err: 0, range: 30 };

export let reorder = false;          // l'accueil est en cours de réorganisation

export let previewOf = null;         // paquet dont on regarde l'aperçu

export let findQ = '';               // recherche globale

export let deckQ = '';               // recherche à l'intérieur d'un paquet

export let deckOpen = false;         // son champ est-il déployé

export const DECKPAGE = 80;          // cartes posées d'un coup dans la liste

export let deckShow = DECKPAGE;

export let leaving = null;           // action de sortie en attente de confirmation

export let friends = null;          // annuaire des autres comptes, pour choisir un destinataire

export let sendTo = null;           // destinataire choisi dans la feuille d'envoi

export let mailOpen = null;         // id de l'e-mail affiché dans sa feuille de détail

export let sendMsg = '';            // message en cours de frappe dans la feuille d'envoi

export let lib = { list: null, err: 0, open: null };      // l'étagère commune du groupe

export let duels = { list: null, scores: null, err: 0, open: null };

export let board = { rows: null, err: 0, range: 7 };

export let shared = null;            // paquet ouvert par un lien de consultation

export let duelRun = null;           // défi en cours de partie

export let groupTab = 'lib';         // onglet courant de la bibliothèque du groupe

/* Où l'on regarde, et donc où l'on publie. null = mes lecteurs (les amis
   acceptés), sinon l'identifiant d'un club. La base sait déjà cloisonner
   — library.group_id et duels.group_id existent, et leurs règles de
   lecture s'appuient dessus — mais rien ne les renseignait : tout partait
   donc avec group_id nul, c'est-à-dire à tous les amis, sans qu'on ait
   jamais eu le choix. */
export let scope = null;

export let mates = null, asks = null;   // amis acceptés, demandes reçues

export let me = null;                   // mon profil public : pseudo

export let groups = null, groupOf = null;  // mes groupes, et celui qu'on regarde

export let addQ = '';                   // pseudo en cours de frappe

export let mateOpen = null;             // ami dont on regarde la fiche

export let undos = [];

export const DEFPREFS = { goal: 30, cap: 20, order: 'random', fresh: true, sound: false,
                   font: 1, tol: 'normal', name: '', simple: false, simpleAt: 0, fast: false,
                   sort: 'manual', list: false, zen: false,
                   /* FSRS : rétention visée, paramètres du modèle, intervalle
                      plafond. `w` vide = les paramètres par défaut du moteur. */
                   dr: 0.9, w: null, maxIvl: 36500, wAt: 0, wN: 0 };

export let prefs = { ...DEFPREFS };

export let prefsTimer = 0;

/* Supabase fait tourner le jeton de rafraîchissement : chaque échange en
   rend un neuf et invalide l'ancien. Deux appels partis en même temps —
   ce qui arrive dès qu'on revient sur l'app et que trois requêtes
   redémarrent ensemble — se battaient donc pour le même jeton, et le
   perdant déconnectait le compte. Un seul échange à la fois, tout le
   monde attend le même. */
export let refreshing = null;

export let conflicts = [];

/* pousse tout ce qui est en attente ; garde la file si le réseau manque */
export let flushTimer = 0;

export let flushing = false;

export let recorder = null, recChunks = [];

export let player = null;

/* Un passage complet : on relit l'historique, on en tire les paramètres,
   puis on refait la mémoire de chaque fiche avec eux. Anki appelle ça
   « optimiser » puis « recalculer la mémoire » ; ici c'est un seul geste. */
export let optRunning = 0;

export let fnr = { q: '', r: '', side: 'both', cs: false };

export let actx = null;

export let tt;

export let animate = true;

export let booted = 0;

export let liveT = 0, liveAt = 0, liveSoon = 0;

export let pageDir = 0;

export let pagerEnd = null;

export let sel = null;

export let legalTab = 'cgu';

export let legalBack = 'settings';        // d'où l'on vient : connexion ou réglages

export let loginBusy = false, loginMode = 'in';

export let helpKey = null;

export let subjEdit = null, subjColor = 'graphite', subjName = '';

export let cardEdit = null;

export let vers = { list: null, err: 0, of: null };

/* ══════════ signaler, bloquer ══════════
   Des mineurs, du contenu écrit librement, et jusqu'ici aucun moyen de
   dire « ça ne va pas » ni de couper le contact. C'était le dernier vrai
   trou du volet protection : le reste du cloisonnement tenait déjà, celui-ci
   n'existait pas du tout.

   Deux gestes distincts, volontairement. Bloquer est immédiat, personnel
   et réversible : je ne veux plus rien recevoir de cette personne, et la
   coupure vaut dans les deux sens — un blocage à sens unique laisserait
   celui qu'on fuit continuer de vous lire. Signaler ne coupe rien mais
   laisse une trace instruite ailleurs, avec une copie du contenu :
   sans elle, il suffirait d'effacer pour rendre la plainte incompréhensible. */
export let blocks = null;                 // liste des comptes que j'ai bloqués

export let reportOn = null;               // { kind, id, user, label, snapshot }

export let reportWhy = '';

/* ══════════ la console de modération ══════════
   Elle n'apparaît que pour les comptes inscrits dans la table des
   modérateurs. Ce qu'elle montre, ce sont les signalements — qui portent
   chacun leur copie du contenu — et rien d'autre : un modérateur n'obtient
   aucun accès aux bibliothèques ni au courrier. C'est précisément à ça que
   sert la copie jointe, et c'est ce qui permet de juger sans ouvrir la vie
   privée de tout le monde à quelqu'un.

   Deux réponses seulement. Masquer, quand le contenu n'a pas sa place ;
   rien à signaler, qui rend visible ce que le compteur avait retiré. Une
   suspension de compte ne se décide pas depuis un téléphone à minuit :
   elle reste un geste manuel, tracé ailleurs. */
export let iAmMod = false;

export let mods = { list: null, err: 0, seen: 0 };

/* ══════════ la console d'administration ══════════
   Un administrateur gère des accès, il ne lit pas les fiches des élèves.
   Cet écran ne montre donc que ce qu'il faut pour reconnaître quelqu'un et
   décider de son rôle : pseudo, adresse, date d'arrivée, nombre de livres.
   Aucun contenu, aucune progression, aucun courrier.

   Le rôle ne se change pas en écrivant dans une table — elle n'a aucune
   politique d'écriture, exprès. Il passe par une fonction qui vérifie
   elle-même qui appelle, et qui refuse qu'on se retire son propre rôle :
   sans cette garde, le dernier administrateur se verrouille dehors et
   plus personne ne peut rendre la main. */
export let accounts = null, accOpen = null;

/* L'éditeur ne gère pas un établissement : il les vend et les tient. Ce
   qu'il regarde n'est donc ni une classe ni un élève, c'est une ligne par
   établissement — combien de comptes ouverts, combien s'en servent
   vraiment, et ce que l'IA coûte. L'écart entre « ouverts » et « venus »
   est la seule chose qui dise si un déploiement a pris ou non, et c'est ce
   qu'il faut lire en premier.

   Pas de coloration, pas d'animation, deux tableaux : c'est un écran qu'on
   ouvre pour décider, pas pour s'y attarder. */
export let adm = { orgs: null, etat: null, tab: 'orgs' };

/* ══════════ rôles, classes, devoirs ══════════
   Trois métiers dans la même app, et trois écrans différents. L'élève
   reçoit et travaille ; le professeur distribue et suit ; l'administrateur
   instruit les signalements. Personne ne voit les outils des autres — non
   par discrétion, mais parce qu'une interface qui montre ce qu'on ne peut
   pas faire n'apprend rien à personne.

   Le rôle vient de la base, jamais du client : une valeur gardée ici ne
   ferait qu'afficher des boutons, et la base refuserait de toute façon.
   C'est bien elle qui décide. */
export let myRole = 'eleve';

export let classes = null;                 // mes classes (tenues ou rejointes)

export let classOf = null;                 // celle qu'on regarde

/* ══════════ scolaire ou personnel ══════════
   Folio sert deux publics dans la même app : quelqu'un qui révise pour lui,
   et un élève inscrit par son établissement. Le second n'est pas le premier
   avec moins de boutons — c'est un autre produit. Il n'a ni club, ni
   annuaire ouvert, ni pseudo à choisir : son identité, sa classe et ses
   matières lui sont données, et il ne peut ni les changer ni en sortir.

   `school` répond à la seule question qui commande tout le reste : ce
   compte appartient-il à un établissement ? `null` tant qu'on ne sait pas,
   `false` quand on sait que non — la nuance compte, sinon l'écran s'affiche
   en version personnelle une fraction de seconde avant de se corriger. */
export let school = null;                  // { org, classe, niveau, … } | false

export let team = null;                    // les professeurs de sa classe

export let roster = null;                  // la liste d'une classe, côté professeur

export let workOpen = null, memberOpen = null;

export let asgs = null;                    // les devoirs de la classe regardée

/* ══════════ « Ma classe », côté élève ══════════
   Un seul écran, et rien qui ressemble à de la gestion. Ce qu'il y a à
   faire d'abord — un devoir se rend, il ne se cherche pas —, puis qui lui
   fait cours, puis les camarades qu'il peut ajouter. Aucun code à saisir,
   aucune classe à quitter, aucun bouton qui échouerait s'il le pressait :
   la base refuse déjà tout cela, l'écran n'a pas à le proposer. */
export let mates2 = null;                  // ses camarades de classe

/* ══════════ la console du référent d'établissement ══════════
   Le référent n'est pas un professeur avec plus de classes. C'est la
   personne qui, dans le lycée, ouvre les comptes, refait les mots de passe
   oubliés et déplace un élève de la 2nde 3 à la 2nde 1 en octobre. Il
   travaille sur un ordinateur, il connaît son métier, et ce qu'il veut
   c'est voir et corriger vite — pas être accompagné.

   Cet écran est donc écrit comme un outil de gestion, pas comme une app :
   des tableaux denses, des colonnes alignées, la recherche toujours au même
   endroit, aucune animation. On y tient six cents lignes à l'écran et on en
   change une en trois clics. Rien n'y est joli, et ce n'est pas un oubli :
   ce qu'on lui demande, c'est que ça marche.

   Trois onglets, parce qu'il n'y a que trois questions : l'établissement
   (où en est-on ?), les comptes (qui, et comment le corriger ?), les
   classes (qui est où, et qui y enseigne ?). */
export let ref = { tab: 'etab', board: null, err: 0,
            gens: null, total: 0, page: 0, q: '', role: '', cls: null, cherche: 0,
            classes: null, open: null, team: null,
            who: null, service: null, form: null, trace: null };

export let prof = {
  annee: null, annees: null,            // l'année scolaire regardée
  classes: null, err: 0,
  open: null, tab: 'eleves',            // la classe ouverte, et son onglet
  roster: null, devoirs: null, bilan: null,
  tri: 'retard', q: '',
  eleve: null, fiche: null,             // la fiche d'un élève
  work: null, cartes: null,             // le devoir ouvert, et ce qui bloque
  comp: null,                           // le composeur de devoir
  vue: 'liste', mois: null, agenda: null, jour: null   // le cahier de textes
};

/* Le profil d'un lecteur : ce que le classement sait déjà de lui, sur
   trois périodes, plus les livres qu'il a posés dans la bibliothèque.
   Rien de plus n'est demandé au serveur — le détail de ses révisions ne
   sort pas de son compte. */
export let mateProf = { id: null, range: 7, row: null, lib: null, load: 0 };

/* Changer de période relance une requête sans attendre la précédente :
   « Tout » (plus de lignes à agréger côté serveur) peut très bien revenir
   après un « 30 jours » lancé juste ensuite, et écraser l'affichage avec
   des chiffres d'une autre période que celle sélectionnée à l'écran. Un
   jeton par appel règle ça — seule la dernière réponse compte. */
export let mateProfSeq = 0;

export let recKey = null;

/* Le temps que met la page à tourner. Sans ce verrou, une série de
   touches rapides relançait l'animation à chaque fois et la page
   tournoyait sans fin sans jamais se poser. */
export let flipAt = 0;

export let asrOn = false, asrRec = null;

export let quizTick = 0;

export let comp = { subject: '', cards: [], edit: -1, bulk: false, text: '', dups: false };

export let aiBusy = false;

export let tour = null, tourSave = null, tourPoll = 0;

export let demo = false;                       // pendant la visite : plus rien ne sort de l'appareil

/* L'invite native d'Android n'est donnée qu'une fois, très tôt : on la
   met de côté au lieu de la laisser passer, pour la rejouer au moment
   où elle a du sens pour l'élève. */
export let bip = null;


export const setAuth = v => auth = v;
export const setDb = v => db = v;
export const setView = v => view = v;
export const setFilter = v => filter = v;
export const setPeek = v => peek = v;
export const setStudy = v => study = v;
export const setQuiz = v => quiz = v;
export const setMenu = v => menu = v;
export const setTyping = v => typing = v;
export const setPendingGrade = v => pendingGrade = v;
export const setDirty = v => dirty = v;
export const setGone = v => gone = v;
export const setOutbox = v => outbox = v;
export const setTrash = v => trash = v;
export const setSplitSize = v => splitSize = v;
export const setMailbox = v => mailbox = v;
export const setStats = v => stats = v;
export const setReorder = v => reorder = v;
export const setPreviewOf = v => previewOf = v;
export const setFindQ = v => findQ = v;
export const setDeckQ = v => deckQ = v;
export const setDeckOpen = v => deckOpen = v;
export const setDeckShow = v => deckShow = v;
export const setLeaving = v => leaving = v;
export const setFriends = v => friends = v;
export const setSendTo = v => sendTo = v;
export const setMailOpen = v => mailOpen = v;
export const setSendMsg = v => sendMsg = v;
export const setLib = v => lib = v;
export const setDuels = v => duels = v;
export const setBoard = v => board = v;
export const setShared = v => shared = v;
export const setDuelRun = v => duelRun = v;
export const setGroupTab = v => groupTab = v;
export const setScope = v => scope = v;
export const setMates = v => mates = v;
export const setAsks = v => asks = v;
export const setMe = v => me = v;
export const setGroups = v => groups = v;
export const setGroupOf = v => groupOf = v;
export const setAddQ = v => addQ = v;
export const setMateOpen = v => mateOpen = v;
export const setUndos = v => undos = v;
export const setPrefs = v => prefs = v;
export const setPrefsTimer = v => prefsTimer = v;
export const setRefreshing = v => refreshing = v;
export const setConflicts = v => conflicts = v;
export const setFlushTimer = v => flushTimer = v;
export const setFlushing = v => flushing = v;
export const setRecorder = v => recorder = v;
export const setRecChunks = v => recChunks = v;
export const setPlayer = v => player = v;
export const setOptRunning = v => optRunning = v;
export const setFnr = v => fnr = v;
export const setActx = v => actx = v;
export const setTt = v => tt = v;
export const setAnimate = v => animate = v;
export const setBooted = v => booted = v;
export const setLiveT = v => liveT = v;
export const setLiveAt = v => liveAt = v;
export const setLiveSoon = v => liveSoon = v;
export const setPageDir = v => pageDir = v;
export const setPagerEnd = v => pagerEnd = v;
export const setSel = v => sel = v;
export const setLegalTab = v => legalTab = v;
export const setLegalBack = v => legalBack = v;
export const setLoginBusy = v => loginBusy = v;
export const setLoginMode = v => loginMode = v;
export const setHelpKey = v => helpKey = v;
export const setSubjEdit = v => subjEdit = v;
export const setSubjColor = v => subjColor = v;
export const setSubjName = v => subjName = v;
export const setCardEdit = v => cardEdit = v;
export const setVers = v => vers = v;
export const setBlocks = v => blocks = v;
export const setReportOn = v => reportOn = v;
export const setReportWhy = v => reportWhy = v;
export const setIAmMod = v => iAmMod = v;
export const setMods = v => mods = v;
export const setAccounts = v => accounts = v;
export const setAccOpen = v => accOpen = v;
export const setAdm = v => adm = v;
export const setMyRole = v => myRole = v;
export const setClasses = v => classes = v;
export const setClassOf = v => classOf = v;
export const setSchool = v => school = v;
export const setTeam = v => team = v;
export const setRoster = v => roster = v;
export const setWorkOpen = v => workOpen = v;
export const setMemberOpen = v => memberOpen = v;
export const setAsgs = v => asgs = v;
export const setMates2 = v => mates2 = v;
export const setRef = v => ref = v;
export const setProf = v => prof = v;
export const setMateProf = v => mateProf = v;
export const setMateProfSeq = v => mateProfSeq = v;
export const setRecKey = v => recKey = v;
export const setFlipAt = v => flipAt = v;
export const setAsrOn = v => asrOn = v;
export const setAsrRec = v => asrRec = v;
export const setQuizTick = v => quizTick = v;
export const setComp = v => comp = v;
export const setAiBusy = v => aiBusy = v;
export const setTour = v => tour = v;
export const setTourSave = v => tourSave = v;
export const setTourPoll = v => tourPoll = v;
export const setDemo = v => demo = v;
export const setBip = v => bip = v;
/* `online` a déjà un « setter » avec un vrai sens : `setOnline` (app.js) fait
   plus qu'assigner, il met aussi à jour la pastille hors-ligne. Celui-ci
   n'est que la poignée brute sur la variable, appelée uniquement par
   setOnline lui-même. */
export const setOnlineState = v => online = v;
