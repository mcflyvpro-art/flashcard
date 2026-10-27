/* ══════════ le tuto de première connexion (2026-10-27) ══════════
   Un guide court qui fait faire : à chaque étape, un geste sur le vrai
   écran ou un mot à lire, un titre et une phrase au plus. Il présente l'app
   pas à pas, dans l'ordre où on la découvre : à un élève ses livres, une
   flashcard lue et notée, comment créer, son journal, sa classe, ses amis,
   son courrier ; à un professeur son tableau de bord, une classe, un élève,
   un devoir donné, le bilan, l'agenda ; à un référent ses codes et sa
   console. La fin présente Folio+ (Folio Campus pour un professeur ou un
   référent de la démo).

   Il s'adapte au rôle, à ce que le compte a déjà (des livres, des classes)
   et à l'écran (téléphone, ordinateur). Ce module dit QUOI : les scénarios,
   leurs étapes, ce qui en retire, les cartes du début et de la fin, les
   pages d'exemple ; ui/tuto.js le joue (le voile, le trou, la garde des
   appuis). Pur, sans dépendance, testé dans test/tuto.test.js.

   Une étape :
     id       unique dans son scénario ;
     si       drapeaux qui doivent tenir au départ (« !x » : ne pas tenir),
              lus une fois, quand le tuto commence ;
     tant     ce qui doit tenir pendant l'étape (une feuille ouverte, des
              pages à lire, des classes) : faux d'emblée, l'étape ne se joue
              pas ; perdu en route, on revient à `reprise` ;
     ecran    l'écran (ou les écrans) où elle se passe — { pc, tel } s'il
              dépend de l'appareil ; « ref:accueil » : un onglet précis. Le
              tuto y mène, et y ramène si l'on en sort (le retour du
              navigateur) ;
     reprise  l'étape où revenir si l'écran ou la feuille se perdent et que
              le tuto ne sait pas y ramener (une lecture ne se rouvre pas
              d'une adresse : on revient à « Lis-le ») ;
     cible    ce qu'on montre, l'anneau autour (le premier visible gagne,
              ordinateur ou téléphone ; `union` : tous ceux du même
              sélecteur) ;
     trou     ce qui reste éclairé, s'il est plus large que la cible (une
              feuille entière, un formulaire) ;
     permis   ce qu'on peut toucher (par défaut, pour un geste, la cible
              montrée et elle seule ; pour un mot, rien) : tout le reste est
              retenu, rien ne fait sauter une étape ;
     sauf     ce qui, dans ce qu'on peut toucher, reste retenu (la case à
              cocher d'une ligne d'élève : on ouvre sa fiche, on ne le
              sélectionne pas) ;
     glisse   ce qui se glisse au doigt (la page d'une lecture) ;
     clavier  les touches qui marchent aussi (les raccourcis d'une lecture) ;
     geste    1 : l'étape attend un geste ; sinon, un mot et « Suivant » ;
     attend   ce qui finit l'étape (un écran, une page retournée…) ;
     saisie   1 : un formulaire à remplir ;
     voile    'leger' : ce qui est autour se lit encore (la réponse) ;
     centre   1 : un mot au milieu de l'écran, sans rien montrer ;
     passable 1 : « Plus tard » (sur un vrai compte : donner un vrai devoir à
              une vraie classe, créer une vraie classe, ne s'impose pas) ;
     ferme    1 : « Suivant » referme la feuille ouverte ;
     bouton   un bouton de plus dans la bulle (« exemple ») ;
     carte    une carte au centre : « debut », ou la fin (`finDe`). */

/* ---------- ce qu'on vise ---------- */
const ONGLET = k => [`#rail nav [data-r="${k}"]`, `nav.tabs [data-act="tab-${k}"]`];
const NOUVEAU = ['.fab[data-act="new"]', '.newbtn[data-act="new"]'];
/* un livre qui a des pages à lire aujourd'hui d'abord : la lecture qui suit en a besoin */
const LIVRE = ['.grid .tile:has(.due)', '.rows.lst .brow:has(.ldue) .lmain', '.grid .tile', '.rows.lst .brow .lmain'];
const JOURNAL = ['#rail nav [data-r="stats"]', '.top .goal'];
const COURRIER = ['#rail nav [data-r="mail"]', '.top .icmail'];
const FEUILLE = ['.menu:not(.sort)'];
const SAISIE = ['#nm', '[data-nsubj]', '#cf', '#cb', '#cadd'];
/* au téléphone, les onglets du bas ne sont que sur ces trois écrans */
const ONGLETS_TEL = ['home', 'classes', 'commu'];
/* sur un téléphone, les onglets n'ont que leur icône */
const ICONE = 'Touche l’onglet qui s’allume';
const ICONEZ = 'Touchez l’icône qui s’allume';

/* ---------- l'élève : un livre, une page lue, créer, son journal, sa classe, ses amis, son courrier ---------- */
const creation = [
  /* sans livre, le premier se crée pour de bon : il faut bien quelque chose à lire */
  { id: 'nouveau', si: ['!livres'], ecran: 'home', cible: NOUVEAU, geste: 1, attend: { vue: 'import' },
    titre: 'Ton premier livre', texte: 'Un livre, ce sont des pages : la question, puis la réponse.', aide: 'Touche « Nouveau livre »' },
  { id: 'page', si: ['!livres'], ecran: 'import', reprise: 'nouveau', cible: ['#comp'], trou: ['.cr-main'], permis: SAISIE,
    geste: 1, saisie: 1, attend: { pages: 1 }, bouton: 'exemple',
    titre: 'Écris ta première page', texte: 'Un titre, la question au recto, la réponse au verso.', aide: 'Puis « Ajouter la page »' },
  { id: 'creer', si: ['!livres'], ecran: 'import', reprise: 'nouveau', cible: ['#ok'], geste: 1, attend: { vue: 'deck' },
    titre: 'Crée-le', texte: 'Tu ajouteras des pages quand tu voudras.', aide: 'Touche « Créer le livre »' }
];

const ouvrir = texte => ({ id: 'ouvrir', si: ['livres'], ecran: 'home', cible: LIVRE, geste: 1, attend: { vue: 'deck' },
  titre: 'Tes livres', texte, aide: 'Touche le livre qui s’allume' });

const lecture = [
  { id: 'lire', tant: 'aLire', ecran: 'deck', cible: ['.cta.read'], geste: 1, attend: { vue: 'study' },
    titre: 'Lis-le', texte: 'Chaque page est une flashcard. Celles du jour arrivent une à une.', aide: 'Touche « Lire »' },
  { id: 'retourner', ecran: 'study', reprise: 'lire', cible: ['#top'], glisse: ['#top'], clavier: [' ', 'ArrowLeft', 'ArrowRight'],
    geste: 1, attend: { retournee: 1 },
    titre: 'Retourne la page', texte: 'Cherche la réponse dans ta tête, puis retourne-la.', aide: 'Touche la page' },
  { id: 'noter', ecran: 'study', reprise: 'lire', cible: ['.grades'], permis: ['.grades', '#top'], glisse: ['#top'],
    clavier: ['1', '2', '3', '4', ' ', 'ArrowLeft', 'ArrowRight'], geste: 1, voile: 'leger', attend: { notee: 1 },
    titre: 'Dis si tu savais', texte: 'Facile : elle reviendra tard. Dur : bientôt.', aide: 'Choisis une réponse' },
  { id: 'retenue', ecran: 'study', centre: 1,
    titre: 'Folio s’en souvient', texte: 'Il te rendra chaque page juste avant que tu l’oublies.' }
];

/* avec des livres : comment on en crée (dans la démo d'un élève, une bibliothèque pleine se dit seulement) */
const fabrique = [
  { id: 'creer-livre', si: ['livres'], tant: 'creable', ecran: 'home', cible: NOUVEAU, geste: 1, attend: { vue: 'import' },
    titre: 'Crée tes livres', texte: 'Tes cours deviennent des flashcards.', aide: 'Touche « Nouveau livre »' },
  { id: 'methodes', si: ['livres'], tant: 'creable', ecran: 'import', reprise: 'creer-livre', cible: ['.cr-tabs'],
    titre: 'Cinq façons', texte: 'Écris, colle, un PDF, une photo, ton cours : l’IA fait les pages.' },
  { id: 'plein', si: ['livres'], tant: '!creable', ecran: 'home', cible: NOUVEAU,
    titre: 'Crée tes livres', texte: 'Écris, colle, une photo, un PDF : l’IA en fait des pages.' }
];

const journal = [
  /* depuis la bibliothèque : la lecture d'avant se referme (sur ordinateur aussi, où la barre latérale y mènerait de partout) */
  { id: 'journal', ecran: 'home', cible: JOURNAL, geste: 1, attend: { vue: 'stats' },
    titre: 'Ton journal', texte: 'Ce que tu as lu, et ce que tu sais vraiment.',
    aide: { pc: 'Touche « Journal »', tel: 'Touche l’anneau du jour' } },
  { id: 'journal-vu', ecran: 'stats', reprise: 'journal', cible: ['.jr-kpi'],
    titre: 'Tes progrès', texte: 'Tes pages, ton temps, tes réussites, ta série.' }
];

const classe = si => [
  { id: 'classe', si, ecran: { tel: ONGLETS_TEL }, cible: ONGLET('classes'), geste: 1, attend: { vue: 'classes' },
    titre: 'Ta classe', texte: 'Tes devoirs, tes profs, tes camarades.', aide: { pc: 'Touche « Mes classes »', tel: ICONE } },
  { id: 'devoirs', si, ecran: 'classes', reprise: 'classe', cible: ['.el-grille > div:first-child'],
    titre: 'Tes devoirs', texte: 'Ton prof te les donne ; il voit où tu en es.' }
];

const cercle = (titre, amis) => [
  { id: 'cercle', ecran: { tel: ONGLETS_TEL }, cible: ONGLET('commu'), geste: 1, attend: { vue: 'commu' },
    titre: 'Le cercle', texte: 'Tes amis, tes défis, tes clubs.', aide: { pc: 'Touche « Cercle des lecteurs »', tel: ICONE } },
  { id: 'amis', ecran: 'commu', reprise: 'cercle', cible: ['.cc-carte:has(> .cc-amis)'], titre, texte: amis }
];

const courrier = (texte, vu) => [
  { id: 'courrier', ecran: { tel: 'home' }, cible: COURRIER, geste: 1, attend: { vue: 'mail' },
    titre: 'Ton courrier', texte, aide: { pc: 'Touche « Courrier »', tel: 'Touche l’enveloppe' } },
  { id: 'courrier-vu', ecran: 'mail', reprise: 'courrier', cible: ['.co-boite', '#app .empty'], titre: 'Ta boîte', texte: vu }
];

/* ---------- le professeur : pas à pas, dans un espace qui est grand ---------- */
const DONNER = ['.pf-corps [data-pf="donner"]', '.pf-cha [data-pf="donner"]'];
const AGENDA = ['.pf-nav [data-pf="agenda"]', '.pf-mnav [data-pf="agenda"]'];
const professeur = [
  { id: 'debut', carte: 'debut' },
  { id: 'code', si: ['bande'], ecran: 'prof', cible: ['.pf-codeband'],
    titre: 'Le code élèves', texte: 'Vos élèves entrent avec. Projetez-le en classe.' },
  /* sans classe : les choisir (établissement), ou la créer (professeur particulier) */
  { id: 'choisir', si: ['!classes', 'etab'], ecran: 'prof', cible: ['.pf-vide [data-pf="choisir"]', '[data-pf="choisir"]'],
    geste: 1, attend: { feuille: 'pf' }, titre: 'Vos classes', texte: 'Choisissez celles où vous enseignez.',
    aide: 'Touchez « Choisir mes classes »' },
  { id: 'cocher', si: ['!classes', 'etab'], tant: 'feuille', reprise: 'choisir', cible: ['#pfcl'], trou: FEUILLE,
    permis: ['.menu:not(.sort) .pf-fl', '#pfcl [data-pf="enseigner"]', '[data-pf="fermer"]'], geste: 1, saisie: 1,
    attend: { classes: 1, sansFeuille: 1 }, passable: 1,
    titre: 'Ajoutez vos classes', texte: 'Votre matière, puis « Ajouter » sur chacune.', aide: 'Puis touchez « Terminé »' },
  { id: 'creer', si: ['!classes', '!etab'], ecran: 'prof', cible: ['.pf-vide [data-pf="creer"]', '[data-pf="creer"]'],
    geste: 1, attend: { feuille: 'pf' }, titre: 'Votre classe', texte: 'Créez-la : vos élèves y entreront avec votre code.',
    aide: 'Touchez « Créer une classe »' },
  { id: 'nommer', si: ['!classes', '!etab'], tant: 'feuille', reprise: 'creer', cible: ['.menu:not(.sort) .pf-form'], trou: FEUILLE,
    permis: ['.menu:not(.sort) .pf-form', '[data-pf="creer-go"]'], geste: 1, saisie: 1, attend: { classes: 1 }, passable: 1,
    titre: 'Nommez-la', texte: 'Son nom suffit, le reste est facultatif.', aide: 'Puis « Créer la classe »' },
  { id: 'inviter', si: ['!classes', '!etab'], tant: 'feuille', cible: FEUILLE, ferme: 1,
    titre: 'Ajoutez vos élèves', texte: 'Ils tapent votre code dans Folio, et ils sont là.' },
  /* le tableau de bord, puis une classe : ses élèves, un devoir donné, son bilan */
  { id: 'tableau', tant: 'classes', ecran: 'prof', cible: ['.pf-main > .pf-kpis'],
    titre: 'Votre tableau de bord', texte: 'Vos élèves, leurs retards, les devoirs en cours.' },
  { id: 'traiter', tant: 'classes', ecran: 'prof', cible: ['.pf-2 > .pf-panel:first-child'],
    titre: 'À traiter', texte: 'Ce qui demande votre attention, en un appui.' },
  { id: 'classe', tant: 'classes', ecran: 'prof', cible: ['.pf-grid .pf-kc[data-pf="classe"]'], geste: 1, attend: { vue: 'profclasse' },
    titre: 'Une classe', texte: 'Ouvrez-la : tout s’y trouve.', aide: 'Touchez la classe qui s’allume' },
  { id: 'suivi', tant: 'classes', ecran: 'profclasse', reprise: 'classe', cible: ['.pf-main > .pf-kpis'],
    titre: 'Son suivi', texte: 'Réussite, devoirs rendus, retards : la classe d’un coup d’œil.' },
  { id: 'eleve', tant: 'eleves', ecran: 'profclasse', reprise: 'classe', cible: ['.pf-corps [data-pf="eleve"]'],
    permis: ['.pf-corps [data-pf="eleve"]'], sauf: ['.pf-cb'], geste: 1, attend: { feuille: 'pf' },
    titre: 'Ses élèves', texte: 'Chacun a sa fiche.', aide: 'Touchez un élève' },
  { id: 'fiche', tant: 'feuille', reprise: 'eleve', cible: FEUILLE, ferme: 1,
    titre: 'Sa fiche', texte: 'Ses devoirs, ses pages lues, ce qui lui résiste.' },
  { id: 'devoirs', tant: 'classes', ecran: 'profclasse', reprise: 'classe', cible: ['[data-pf="onglet"][data-v="devoirs"]'],
    geste: 1, attend: { onglet: 'devoirs' }, titre: 'Ses devoirs', texte: 'Ce que vous avez donné, et qui l’a rendu.',
    aide: 'Touchez « Devoirs »' },
  /* donner un devoir : choisir un livre, puis donner ; « Créer un nouveau livre » attendra la fin du tuto */
  { id: 'donner', si: ['livres'], tant: 'classes', ecran: 'profclasse', reprise: 'classe', cible: DONNER, geste: 1,
    attend: { feuille: 'pf' }, titre: 'Donner un devoir', texte: 'Un livre, une classe, une date.', aide: 'Touchez « Donner un devoir »' },
  { id: 'livre', si: ['livres'], tant: 'feuille', reprise: 'donner', cible: ['#pflivres'], trou: FEUILLE,
    permis: ['#pflivres [data-pf="livre"]'], geste: 1, attend: { details: 1 }, passable: 1,
    titre: 'Le livre', texte: 'Celui que la classe lira.', aide: 'Touchez un livre' },
  { id: 'donne', si: ['livres'], tant: 'feuille', reprise: 'donner', cible: ['[data-pf="donner-go"]'], trou: FEUILLE,
    permis: ['[data-pf="donner-go"]', '[data-pf="cible"]', '[data-pf="due"]', '[data-pf="f-mois"]', '.menu:not(.sort) .pf-fl'],
    geste: 1, attend: { donne: 1 }, passable: 1,
    titre: 'C’est prêt', texte: 'Cette classe, dans une semaine : changez si besoin.', aide: 'Puis touchez « Donner »' },
  { id: 'donner-vu', si: ['!livres'], tant: 'classes', ecran: 'profclasse', reprise: 'classe', cible: DONNER,
    titre: 'Donner un devoir', texte: 'Un livre de votre bibliothèque, une classe, une date.' },
  { id: 'bilan', tant: 'classes', ecran: 'profclasse', reprise: 'classe', cible: ['[data-pf="onglet"][data-v="bilan"]'],
    geste: 1, attend: { onglet: 'bilan' }, titre: 'Le bilan', texte: 'Qui décroche, ce qui bloque la classe.', aide: 'Touchez « Bilan »' },
  { id: 'direct', tant: 'classes', ecran: 'profclasse', reprise: 'classe', cible: ['.pf-cha [data-pf="direct"]'],
    titre: 'Défi en direct', texte: 'La classe joue sur téléphone, comme un quiz.' },
  { id: 'agenda', tant: 'classes', ecran: ['profclasse', 'prof'], cible: AGENDA, geste: 1, attend: { vue: 'profagenda' },
    titre: 'L’agenda', texte: 'Tous vos devoirs, jour par jour.', aide: 'Touchez « Agenda »' },
  /* et ce qu'il partage avec tous : ses livres, son courrier */
  { id: 'livres', cible: ONGLET('home'), geste: 1, attend: { vue: 'home' },
    titre: 'Vos livres', texte: 'Ceux que vous donnez en devoir : créez-les ici.', aide: { pc: 'Touchez « Livres »', tel: ICONEZ } },
  { id: 'courrier', cible: ONGLET('mail'), geste: 1, attend: { vue: 'mail' },
    titre: 'Le courrier', texte: 'Les livres et les mots que l’on vous envoie.', aide: { pc: 'Touchez « Courrier »', tel: ICONEZ } },
  { id: 'fin', carte: 'fin' }
];

export const SCENARIOS = {
  /* l'élève qui révise pour lui (B2C) */
  perso: [
    { id: 'debut', carte: 'debut' },
    ...creation,
    ouvrir('Chacun sa matière ; chaque page, une flashcard.'),
    ...lecture,
    ...fabrique,
    ...journal,
    ...classe(['classe']),
    ...cercle('Tes amis', 'Ajoute-les par leur pseudo, puis défie-les.'),
    ...courrier('Les livres que tes amis te prêtent.', 'Ouvre une lettre : tu vois le livre avant de l’ajouter.'),
    { id: 'fin', carte: 'fin' }
  ],

  /* l'élève de classe (B2B, et Léa dans la démo) */
  classe: [
    { id: 'debut', carte: 'debut' },
    ...creation,
    ouvrir('Tes devoirs y arrivent ; chaque page, une flashcard.'),
    ...lecture,
    ...fabrique,
    ...journal,
    ...classe(undefined),
    ...cercle('Tes camarades', 'Ta classe et tes amis : défie-les.'),
    ...courrier('Les mots de ton prof, les livres qu’on te prête.', 'Ouvre une lettre : un mot, ou un livre à ajouter.'),
    { id: 'fin', carte: 'fin' }
  ],

  prof: professeur,

  /* le référent : les codes, puis sa console, onglet par onglet (au téléphone, les codes et la licence) */
  ref: [
    { id: 'debut', carte: 'debut' },
    { id: 'codes', ecran: 'ref:accueil', cible: ['.rf-codes', '.rf-tel .rf-code'], union: 1,
      titre: 'Vos deux codes', texte: 'Élèves et profs entrent avec. Ils se renouvellent seuls.' },
    { id: 'licence-vue', si: ['pc'], ecran: 'ref:accueil', cible: ['.rf-cote .rf-licence'],
      titre: 'Votre licence', texte: 'Vos places, et jusqu’à quand.' },
    { id: 'classes', si: ['pc'], cible: ONGLET('ref:classes'), geste: 1, attend: { ref: 'classes' },
      titre: 'Les classes', texte: 'Créez-les, nommez le prof principal.', aide: 'Touchez « Classes »' },
    { id: 'eleves', si: ['pc'], cible: ONGLET('ref:eleves'), geste: 1, attend: { ref: 'eleves' },
      titre: 'Les élèves', texte: 'Un nom à corriger, un élève à changer de classe.', aide: 'Touchez « Élèves »' },
    { id: 'profs', si: ['pc'], cible: ONGLET('ref:profs'), geste: 1, attend: { ref: 'profs' },
      titre: 'Les professeurs', texte: 'Leurs classes, leurs services, un compte à ouvrir.', aide: 'Touchez « Professeurs »' },
    { id: 'licence', si: ['pc'], cible: ONGLET('ref:licence'), geste: 1, attend: { ref: 'licence' },
      titre: 'La licence', texte: 'Places, factures, et un fil avec Folio.', aide: 'Touchez « Licence »' },
    { id: 'historique', si: ['pc'], cible: ONGLET('ref:journal'), geste: 1, attend: { ref: 'journal' },
      titre: 'L’historique', texte: 'Qui a fait quoi, et quand.', aide: 'Touchez « Historique »' },
    { id: 'licence-tel', si: ['!pc'], ecran: 'ref:accueil', cible: ['.rf-tel .rf-licence'],
      titre: 'La licence', texte: 'Vos places. Le reste se gère sur ordinateur.' },
    { id: 'fin', carte: 'fin' }
  ]
};

/* Ce que le moteur sait lire : un scénario qui écrirait autre chose aurait
   une étape qui ne finit jamais (test/tuto.test.js y veille). */
export const CONNU = {
  attend: ['vue', 'pages', 'feuille', 'sansFeuille', 'onglet', 'ref', 'retournee', 'notee', 'classes', 'details', 'donne'],
  tant: ['aLire', 'creable', 'feuille', 'classes', 'eleves'],
  ecran: ['home', 'import', 'deck', 'study', 'stats', 'classes', 'commu', 'mail', 'prof', 'profclasse', 'ref:accueil'],
  bouton: ['exemple']
};

/* Le scénario de qui : `null` pour qui n'en a pas (l'éditeur). */
/** @param {{ role?: any, eleveDeClasse?: boolean, prof?: boolean, referent?: boolean }} [qui] */
export function quelRole({ role, eleveDeClasse, prof, referent } = {}) {
  if (role === 'admin') return null;
  if (prof) return 'prof';
  if (role === 'ref') return referent ? 'ref' : null;
  if (role === 'eleve' || !role) return eleveDeClasse ? 'classe' : 'perso';
  return null;
}

/* « livres » tient si drapeaux.livres est vrai ; « !livres » s'il est faux. */
export function tient(cond, drapeaux = {}) {
  const l = cond == null ? [] : [].concat(cond);
  return l.every(c => (c.startsWith('!') ? !drapeaux[c.slice(1)] : !!drapeaux[c]));
}

/* Les étapes d'un scénario pour ces drapeaux de départ. */
export function etapes(role, drapeaux = {}) {
  return (SCENARIOS[role] || []).filter(e => tient(e.si, drapeaux));
}

/* Les écrans d'une étape, sur cet appareil : `null` si n'importe lequel convient. */
/** @param {{ ecran?: any }} e @param {boolean} [pc] @returns {string[] | null} */
export function ecransDe(e, pc) {
  let x = e && e.ecran;
  if (x && typeof x === 'object' && !Array.isArray(x)) x = pc ? x.pc : x.tel;
  return x == null ? null : [].concat(x);
}

/* « Touche » au doigt, « Clique sur » à la souris ; une aide peut dire
   autre chose sur ordinateur et au téléphone ({ pc, tel }) : au téléphone,
   les onglets n'ont que leur icône. */
/** @param {any} aide @param {boolean} [souris] @param {boolean} [pc] */
export function aideSelon(aide, souris, pc) {
  const a = aide && typeof aide === 'object' ? (pc ? aide.pc : aide.tel) : aide;
  if (!a || !souris) return a || '';
  return a.replace(/^Touchez\b/, 'Cliquez sur').replace(/^Touche\b/, 'Clique sur')
    .replace(/^Puis touchez\b/, 'Puis cliquez sur').replace(/^Puis touche\b/, 'Puis clique sur');
}

/* ---------- les cartes du début et de la fin ---------- */
const prenom = p => String(p || '').trim().split(/\s+/)[0];

/* Ce que dit la carte du début : à qui l'on parle (dans la démo, le rôle
   qu'on vient de prendre), et le temps que ça prend. */
const DEBUTS = {
  perso: [p => (p ? `Bienvenue, ${p}` : 'Bienvenue sur Folio'), 'Deux minutes pour faire le tour de Folio.'],
  classe: [p => (p ? `Bienvenue, ${p}` : 'Bienvenue'), 'Deux minutes pour faire le tour de Folio.'],
  prof: [p => (p ? `Bonjour, ${p}` : 'Bonjour'), 'Deux minutes pour faire le tour de votre espace.'],
  ref: [p => (p ? `Bonjour, ${p}` : 'Bonjour'), 'Une minute pour faire le tour de votre console.']
};
const DEBUTS_DEMO = {
  classe: [(p, c) => `Tu es ${p || 'Léa'}${c ? `, en ${c}` : ''}`, 'Deux minutes pour voir Folio côté élève.'],
  prof: [p => `Vous êtes ${p || 'Marc'}, professeur`, 'Deux minutes pour voir Folio côté professeur.'],
  ref: [p => `Vous êtes ${p || 'Claire'}, référente`, 'Une minute pour voir Folio côté établissement.']
};

function quiEst(role, p, demo, classe) {
  const [titre, texte] = (demo && DEBUTS_DEMO[role]) || DEBUTS[role] || DEBUTS.perso;
  return { titre: titre(p, classe), texte };
}

/** @param {string} role @param {{ demo?: boolean, prenom?: string, classe?: string }} [ctx] */
export function debutDe(role, ctx = {}) {
  const demo = !!ctx.demo, vous = role === 'prof' || role === 'ref';
  /* « Passer » marque le tuto comme vu : il ne revient plus de lui-même, et
     le message dit où le retrouver (le bandeau dans la démo, les Réglages sinon) */
  const passe = demo ? (vous ? 'Revoyez le tuto depuis le bandeau' : 'Revois le tuto depuis le bandeau')
    : vous ? 'Le tuto vous attend dans les Réglages' : 'Le tuto t’attend dans les Réglages';
  return { ...quiEst(role, prenom(ctx.prenom), demo, ctx.classe), oui: 'C’est parti', non: 'Passer', passe };
}

/* Ce que Folio+ ajoute (la page d'accueil, #tarifs), en quatre lignes. */
const PLUS = [['spark', 'Ton cours, une photo ou un PDF : l’IA en fait des pages'],
  ['layers', 'Des livres sans limite'], ['grid', 'QCM et associations'], ['image', 'Images et sons sur tes pages']];

/* La fin : Folio+ pour un élève ; Folio Campus pour un professeur ou un
   référent de la démo ; « tout est prêt » pour un professeur ou un
   référent d'un établissement qui a déjà sa licence. Un lien `href` est
   un chemin du site (`tarifs` : la page des tarifs, hors de l'app) ;
   `partir` : il quitte la démo (ui/demo.js l'efface comme « Quitter »). */
/** @param {string} role @param {{ demo?: boolean }} [o] */
export function finDe(role, { demo } = {}) {
  const eleve = role === 'perso' || role === 'classe';
  if (eleve && demo) {
    return { cle: 'plus', titre: 'Folio+', sous: 'Pour aller plus loin', points: PLUS,
      actions: [{ t: 'Créer mon compte', href: '/inscription', partir: 1, pri: 1 },
        { t: 'Voir Folio+', href: '/#tarifs', partir: 1 }, { t: 'Continuer la démo', fin: 1 }],
      note: 'Revois ce tuto depuis le bandeau, en bas.' };
  }
  if (eleve) {
    return { cle: 'plus', titre: 'Folio+', sous: 'Pour aller plus loin', points: PLUS,
      actions: [{ t: 'Découvrir Folio+', href: 'tarifs', pri: 1 }, { t: 'Terminer', fin: 1 }],
      note: 'Revois ce tuto dans les Réglages.' };
  }
  if (demo) {
    return { cle: 'campus', titre: 'Folio Campus', sous: 'Pour tout votre établissement',
      points: [['users', 'Espace professeur et devoirs suivis'], ['build', 'Console du référent'],
        ['spark', 'Mise en place accompagnée'], ['cal', 'Démo gratuite de 30 jours']],
      actions: [{ t: 'Essayer dans mon établissement', href: '/demande-demo', partir: 1, pri: 1 },
        { t: 'Continuer la démo', fin: 1 }],
      note: 'Revoyez ce tuto depuis le bandeau, en bas.' };
  }
  return { cle: 'pret', titre: 'Tout est prêt', sous: role === 'ref' ? 'Votre établissement est en place' : 'Vos classes vous attendent',
    points: role === 'ref'
      ? [['key', 'Deux codes qui changent seuls'], ['school', 'Les classes et les comptes'], ['money', 'La licence et les factures']]
      : [['key', 'Votre code, projeté en classe'], ['card', 'Des devoirs suivis page par page'], ['bolt', 'Des défis en direct']],
    actions: [{ t: 'Commencer', fin: 1, pri: 1 }],
    note: 'Revoyez ce tuto dans les Réglages.' };
}

/* ---------- une page d'exemple, pour « Remplir pour moi » ----------
   Trois pages tirées de la première matière choisie à l'accueil, sinon
   des capitales : de quoi lire tout de suite, et un livre qu'on garde ou
   qu'on supprime. La matière se reconnaît à son nom, sans casse ni accent. */
/** @type {Array<[RegExp, string, string[][]]>} */
const EXEMPLES = [
  [/anglais|english/, 'Verbes irréguliers', [['to go', 'went'], ['to see', 'saw'], ['to take', 'took']]],
  [/espagnol/, 'Vocabulaire espagnol', [['la casa', 'la maison'], ['el perro', 'le chien'], ['la playa', 'la plage']]],
  [/allemand/, 'Vocabulaire allemand', [['das Haus', 'la maison'], ['der Hund', 'le chien'], ['die Schule', 'l’école']]],
  [/italien/, 'Vocabulaire italien', [['la casa', 'la maison'], ['il cane', 'le chien'], ['la scuola', 'l’école']]],
  [/geo/, 'Capitales d’Europe', [['Portugal', 'Lisbonne'], ['Hongrie', 'Budapest'], ['Norvège', 'Oslo']]],
  [/histoire|hggsp/, 'Dates d’histoire', [['1789', 'Prise de la Bastille'], ['1848', 'Abolition de l’esclavage en France'],
    ['1944', 'Débarquement en Normandie']]],
  [/math/, 'Formules de maths', [['Aire d’un disque', 'π × r²'], ['Dérivée de x²', '2x'], ['(a + b)²', 'a² + 2ab + b²']]],
  [/physique|chimie/, 'Physique-chimie', [['Formule de l’eau', 'H₂O'], ['Unité de la force', 'le newton (N)'],
    ['Vitesse de la lumière', '300 000 km/s']]],
  [/svt|biologie|sciences/, 'Le vivant', [['Organite de la photosynthèse', 'le chloroplaste'],
    ['Support de l’information génétique', 'l’ADN'], ['Chromosomes d’une cellule humaine', '46']]],
  [/philo/, 'Philosophes', [['« Je pense, donc je suis »', 'Descartes'], ['« Connais-toi toi-même »', 'Socrate'],
    ['« L’homme est un loup pour l’homme »', 'Hobbes']]],
  [/francais|lettres|hlp/, 'Figures de style', [['Comparaison sans outil', 'la métaphore'], ['Exagération', 'l’hyperbole'],
    ['Répétition en début de vers', 'l’anaphore']]],
  [/droit/, 'Droit civil', [['Contrat', 'Accord de volontés qui crée des obligations'],
    ['Dol', 'Manœuvre qui trompe pour obtenir le consentement'], ['Prescription', 'Extinction d’un droit par le temps']]],
  [/medecine|anatomie|sante/, 'Anatomie', [['Os de la cuisse', 'le fémur'], ['Os chez l’adulte', '206'],
    ['Valve du cœur gauche', 'la mitrale']]],
  [/econom|ses|gestion/, 'Économie', [['PIB', 'Produit intérieur brut'], ['Inflation', 'Hausse générale des prix'],
    ['Taux directeur', 'Taux fixé par la banque centrale']]],
  [/informatique|nsi/, 'Informatique', [['1 octet', '8 bits'], ['Base 2', 'le binaire'], ['HTML', 'Le langage des pages web']]],
  [/code de la route|route/, 'Code de la route', [['Panneau triangulaire', 'Danger'], ['Feu orange fixe', 'S’arrêter, sauf danger'],
    ['Distance de sécurité', 'Deux secondes au moins']]]
];
/** @type {[string, string[][]]} */
const DEFAUT = ['Capitales d’Europe', [['Portugal', 'Lisbonne'], ['Hongrie', 'Budapest'], ['Norvège', 'Oslo']]];

const cleMatiere = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function exemple(matiere) {
  const k = cleMatiere(matiere);
  const trouve = k ? EXEMPLES.find(([re]) => re.test(k)) : null;
  const [titre, pages] = trouve ? [trouve[1], trouve[2]] : DEFAUT;
  return { titre, pages: pages.map(([f, b]) => ({ f, b })) };
}

/* Les textes qu'on montre, pour qu'un test veille à ce qu'ils restent courts. */
export function textes() {
  const l = [];
  for (const [role, liste] of Object.entries(SCENARIOS)) {
    for (const e of liste) {
      if (e.carte) continue;
      const aides = e.aide && typeof e.aide === 'object' ? [e.aide.pc, e.aide.tel] : [e.aide];
      for (const aide of aides) l.push({ role, id: e.id, titre: e.titre, texte: e.texte, aide });
    }
  }
  return l;
}
