/* ══════════ le tuto de première connexion (2026-10-27) ══════════
   Un guide court qui fait faire : à chaque étape, un geste sur le vrai
   écran (créer un livre, le lire, retourner une page, ouvrir un devoir,
   donner un devoir…), un titre et une phrase au plus, et la fin sur
   Folio+ — Folio Campus pour un professeur ou un référent de la démo.

   Il s'adapte au rôle (élève particulier, élève de classe, professeur,
   référent), à ce que le compte a déjà (des livres, un devoir, des
   classes) et à l'écran (téléphone, ordinateur). Ce module dit QUOI : les
   scénarios, leurs étapes, ce qui en retire, les cartes du début et de la
   fin, les pages d'exemple ; ui/tuto.js le joue (le spot, la bulle, les
   gestes). Pur, sans dépendance, testé dans test/tuto.test.js.

   Une étape :
     id       unique dans son scénario ;
     si       drapeaux qui doivent tenir au départ (« !x » : ne pas tenir),
              lus une fois, quand le tuto commence — un livre créé pendant
              le tuto ne fait pas reparaître « Ouvre un livre » ;
     tant     drapeau qui doit tenir au moment de l'étape (une feuille
              ouverte, le bilan à l'écran) ; sur une feuille ouverte, on y
              travaille (cocher, nommer, choisir) : elle reste à portée de main ;
     ecran    l'écran où elle se passe : le moteur y mène s'il faut ;
     cible    sélecteurs, le premier visible gagne (ordinateur, téléphone) ;
     geste    1 : on attend que la personne touche la cible ;
     attend   ce qui finit l'étape (un écran, une page retournée…) ;
     libre    1 : ni voile ni blocage, une petite bulle seulement ;
     ferme    1 : « Suivant » referme la feuille ouverte ;
     bouton   un bouton de plus dans la bulle (« exemple ») ;
     saisie   1 : un formulaire à remplir (pas un simple appui) ;
     voile    'leger' : on voit ce qui est autour (la réponse d'une page) ;
     carte    une carte au centre : « debut », ou la fin (`finDe`). */

/* ---------- ce qu'on vise ---------- */
const ONGLET = k => [`#rail nav [data-r="${k}"]`, `nav.tabs [data-act="tab-${k}"]`];
const NOUVEAU = ['.fab[data-act="new"]', '.newbtn[data-act="new"]'];
const LIVRE = ['.grid .tile', '.rows.lst .brow .lmain'];
const LIRE = ['.cta.read'];
const PAGE = ['#top'];
const NOTES = ['.grades'];
const FIN_LECTURE = ['.rev .b .prim'];
const FEUILLE = ['.menu:not(.sort)'];

/* ---------- les gestes de la lecture, communs aux élèves ---------- */
const lecture = (si, notee) => [
  { id: 'lire', si, tant: 'aLire', ecran: 'deck', cible: LIRE, geste: 1, attend: { vue: 'study' },
    titre: 'Lis-le', texte: 'Les pages du jour arrivent une à une.', aide: 'Touche « Lire »' },
  { id: 'retourner', si, ecran: 'study', cible: PAGE, geste: 1, attend: { retournee: 1 },
    titre: 'Retourne la page', texte: 'Cherche la réponse dans ta tête, puis retourne-la.', aide: 'Touche la page' },
  { id: 'noter', si, ecran: 'study', cible: NOTES, geste: 1, attend: { notee: 1 }, voile: 'leger',
    titre: 'Dis si tu savais', texte: notee, aide: 'Choisis une réponse' },
  { id: 'finir', si, ecran: 'study', libre: 1, attend: { fini: 1 },
    titre: 'Continue', texte: 'Finis tes pages, ou passe à la suite.' },
  { id: 'bilan', si, tant: 'bilan', ecran: 'study', cible: FIN_LECTURE, geste: 1, attend: { vue: 'deck' },
    titre: 'Bravo', texte: 'Chaque page lue remplit ton objectif du jour.', aide: 'Touche « Fin »' }
];

export const SCENARIOS = {
  /* l'élève qui révise pour lui (B2C) : créer, lire, le cercle */
  perso: [
    { id: 'debut', carte: 'debut' },
    { id: 'nouveau', si: ['!livres'], ecran: 'home', cible: NOUVEAU, geste: 1, attend: { vue: 'import' },
      titre: 'Ton premier livre', texte: 'Un livre, ce sont des pages : la question, puis la réponse.', aide: 'Touche « Nouveau livre »' },
    { id: 'page', si: ['!livres'], ecran: 'import', cible: ['.cr-main', '#comp'], geste: 1, saisie: 1, attend: { pages: 1 },
      bouton: 'exemple',
      titre: 'Écris ta première page', texte: 'Un titre, la question au recto, la réponse au verso.', aide: 'Puis « Ajouter la page »' },
    { id: 'creer', si: ['!livres'], ecran: 'import', cible: ['#ok'], geste: 1, attend: { vue: 'deck' },
      titre: 'Crée-le', texte: 'Tu ajouteras des pages quand tu voudras.', aide: 'Touche « Créer le livre »' },
    { id: 'ouvrir', si: ['livres'], ecran: 'home', cible: LIVRE, geste: 1, attend: { vue: 'deck' },
      titre: 'Ouvre un livre', texte: 'Tes livres, chacun avec sa matière.', aide: 'Touche un livre' },
    ...lecture(undefined, 'Facile, elle reviendra tard. Dur, bientôt.'),
    { id: 'classe', si: ['classe'], ecran: 'home', cible: ONGLET('classes'),
      titre: 'Ta classe', texte: 'Les devoirs de ton prof arrivent ici.' },
    { id: 'cercle', ecran: 'home', cible: ONGLET('commu'), geste: 1, attend: { vue: 'commu' },
      titre: 'Le cercle', texte: 'Défie tes amis, rejoins un club.', aide: 'Touche « Cercle des lecteurs »' },
    { id: 'fin', carte: 'fin' }
  ],

  /* l'élève de classe (B2B, et Léa dans la démo) : son devoir, ses livres, le cercle */
  classe: [
    { id: 'debut', carte: 'debut' },
    { id: 'classe', si: ['!surClasses'], ecran: 'home', cible: ONGLET('classes'), geste: 1, attend: { vue: 'classes' },
      titre: 'Ta classe', texte: 'Tes devoirs, tes profs, tes camarades.', aide: 'Touche « Classe »' },
    { id: 'devoir', si: ['devoir'], ecran: 'classes', cible: ['.el-list [data-el="devoir"]'], geste: 1, attend: { vue: 'deck' },
      titre: 'Ton devoir', texte: 'Ton prof te l’a donné. Ouvre-le.', aide: 'Touche le devoir' },
    { id: 'rien', si: ['!devoir'], ecran: 'classes', cible: ['.el-grille > div:first-child', '.el-page .el-h2'],
      titre: 'Tes devoirs', texte: 'Ils arriveront ici, avec leur date.' },
    ...lecture(['devoir'], 'Ton prof voit où tu en es.'),
    { id: 'livres', ecran: 'home', cible: NOUVEAU,
      titre: 'Tes livres à toi', texte: 'Ton devoir y est rangé. Crée aussi les tiens.' },
    { id: 'cercle', ecran: 'home', cible: ONGLET('commu'), geste: 1, attend: { vue: 'commu' },
      titre: 'Le cercle', texte: 'Défie ta classe et tes amis.', aide: 'Touche « Cercle des lecteurs »' },
    { id: 'fin', carte: 'fin' }
  ],

  /* le professeur : son code, un devoir, une classe et son bilan */
  prof: [
    { id: 'debut', carte: 'debut' },
    { id: 'code', si: ['bande'], ecran: 'prof', cible: ['.pf-codeband'],
      titre: 'Le code élèves', texte: 'Vos élèves entrent avec. Projetez-le en classe.' },
    { id: 'choisir', si: ['!classes', 'etab'], ecran: 'prof', cible: ['.pf-vide [data-pf="choisir"]', '[data-pf="choisir"]'],
      geste: 1, attend: { feuille: 'pf' },
      titre: 'Vos classes', texte: 'Choisissez celles où vous enseignez.', aide: 'Touchez « Choisir mes classes »' },
    { id: 'creer', si: ['!classes', '!etab'], ecran: 'prof', cible: ['[data-pf="creer"]'], geste: 1, attend: { feuille: 'pf' },
      titre: 'Votre classe', texte: 'Créez-la, puis donnez votre code.', aide: 'Touchez « Créer une classe »' },
    { id: 'cocher', si: ['!classes', 'etab'], tant: 'feuille', cible: FEUILLE, ferme: 1,
      titre: 'Cochez vos classes', texte: 'Elles arrivent sur votre tableau de bord.' },
    { id: 'nommer', si: ['!classes', '!etab'], tant: 'feuille', cible: FEUILLE, ferme: 1,
      titre: 'Nommez-la', texte: 'Puis donnez votre code à vos élèves.' },
    { id: 'donner', si: ['classes'], ecran: 'prof', cible: ['.pf-ha [data-pf="donner"]', '[data-pf="donner"]'],
      geste: 1, attend: { feuille: 'pf' },
      titre: 'Donner un devoir', texte: 'Un livre, une classe, une date.', aide: 'Touchez « Donner un devoir »' },
    { id: 'donne', si: ['classes'], tant: 'feuille', cible: FEUILLE, ferme: 1,
      titre: 'Choisissez, c’est donné', texte: 'Vos élèves le reçoivent aussitôt, et vous suivez qui l’a lu.' },
    { id: 'classe', si: ['classes'], ecran: 'prof', cible: ['.pf-grid .pf-kc[data-pf="classe"]', '.pf-nav [data-pf="classe"]'],
      geste: 1, attend: { vue: 'profclasse' },
      titre: 'Une classe', texte: 'Ses élèves, ses devoirs, son bilan.', aide: 'Touchez une classe' },
    { id: 'bilan', si: ['classes'], ecran: 'profclasse', cible: ['[data-pf="onglet"][data-v="bilan"]'],
      geste: 1, attend: { onglet: 'bilan' },
      titre: 'Le bilan', texte: 'Qui décroche, qui est à reprendre.', aide: 'Touchez « Bilan »' },
    { id: 'direct', si: ['classes'], ecran: 'profclasse', cible: ['[data-pf="direct"]'],
      titre: 'Défi en direct', texte: 'La classe joue sur téléphone, comme un quiz.' },
    { id: 'fin', carte: 'fin' }
  ],

  /* le référent : les codes, les classes, les élèves, la licence */
  ref: [
    { id: 'debut', carte: 'debut' },
    { id: 'codes', ecran: 'ref', cible: ['.rf-codes', '.rf-tel .rf-code'],
      titre: 'Vos deux codes', texte: 'Élèves et profs entrent avec. Ils se renouvellent seuls.' },
    { id: 'classes', si: ['pc'], ecran: 'ref', cible: ONGLET('ref:classes'), geste: 1, attend: { ref: 'classes' },
      titre: 'Les classes', texte: 'Créez-les, nommez le prof principal.', aide: 'Touchez « Classes »' },
    { id: 'eleves', si: ['pc'], ecran: 'ref', cible: ONGLET('ref:eleves'), geste: 1, attend: { ref: 'eleves' },
      titre: 'Les élèves', texte: 'Un nom à corriger, un élève à changer de classe.', aide: 'Touchez « Élèves »' },
    { id: 'licence', si: ['pc'], ecran: 'ref', cible: ONGLET('ref:licence'), geste: 1, attend: { ref: 'licence' },
      titre: 'La licence', texte: 'Places, factures, et un fil avec Folio.', aide: 'Touchez « Licence »' },
    { id: 'licence-tel', si: ['!pc'], ecran: 'ref', cible: ['.rf-licence'],
      titre: 'La licence', texte: 'Vos places. Le reste se gère sur ordinateur.' },
    { id: 'fin', carte: 'fin' }
  ]
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

/* ---------- les cartes du début et de la fin ---------- */
const prenom = p => String(p || '').trim().split(/\s+/)[0];

/* Ce que dit la carte du début : à qui l'on parle (dans la démo, le rôle
   qu'on vient de prendre), et la minute que ça prend. */
const DEBUTS = {
  perso: [p => (p ? `Bienvenue, ${p}` : 'Bienvenue sur Folio'), 'Une minute pour prendre Folio en main.'],
  classe: [p => (p ? `Bienvenue, ${p}` : 'Bienvenue'), 'Une minute pour voir tes devoirs et ta classe.'],
  prof: [p => (p ? `Bonjour, ${p}` : 'Bonjour'), 'Une minute pour voir votre espace.'],
  ref: [p => (p ? `Bonjour, ${p}` : 'Bonjour'), 'Une minute pour voir votre console.']
};
const DEBUTS_DEMO = {
  classe: [(p, c) => `Tu es ${p || 'Léa'}${c ? `, en ${c}` : ''}`, 'Une minute pour voir Folio côté élève.'],
  prof: [p => `Vous êtes ${p || 'Marc'}, professeur`, 'Une minute pour voir Folio côté professeur.'],
  ref: [p => `Vous êtes ${p || 'Claire'}, référente`, 'Une minute pour voir Folio côté établissement.']
};

function quiEst(role, p, demo, classe) {
  const [titre, texte] = (demo && DEBUTS_DEMO[role]) || DEBUTS[role] || DEBUTS.perso;
  return { titre: titre(p, classe), texte };
}

export function debutDe(role, ctx = {}) {
  const demo = !!ctx.demo, vous = role === 'prof' || role === 'ref';
  /* « Passer » marque le tuto comme vu : il ne revient plus de lui-même, et
     le message dit où le retrouver (le bandeau dans la démo, les Réglages sinon) */
  const passe = demo ? (vous ? 'Revoyez le tuto depuis le bandeau' : 'Revois le tuto depuis le bandeau')
    : vous ? 'Le tuto vous attend dans les Réglages' : 'Le tuto t’attend dans les Réglages';
  return { ...quiEst(role, prenom(ctx.prenom), demo, ctx.classe), oui: 'C’est parti', non: 'Passer', passe };
}

/* « Touche » au doigt, « Clique sur » à la souris. */
export function aideSelon(aide, souris) {
  if (!aide || !souris) return aide || '';
  return aide.replace(/^Touchez\b/, 'Cliquez sur').replace(/^Touche\b/, 'Clique sur');
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

/* ---------- une page d'exemple, pour « laisse-moi faire » ----------
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
    for (const e of liste) if (!e.carte) l.push({ role, id: e.id, titre: e.titre, texte: e.texte, aide: e.aide });
  }
  return l;
}
