/* ══════════ le Lycée Démo Mirandola (2026-10-26) ══════════
   Le monde de la démo sans compte, posé dans une base locale neuve
   (serveur.js) : un établissement en démo, ses classes et un groupe, trois
   professeurs et leurs services, vingt élèves qui ont déjà travaillé — des
   devoirs rendus, commencés, en retard —, la bibliothèque et cinq semaines
   de lecture de Léa, ses amis, ses clubs, son courrier. Le visiteur y entre
   comme Léa (élève), Marc (professeur) ou Claire (référente) et tout marche
   comme sur un vrai compte : ce qu'il fait s'écrit dans cette base, en
   mémoire, et seulement là.

   Déterministe (une graine) et sans date figée : tout se place par rapport
   à aujourd'hui, pour qu'un devoir soit toujours « à rendre mercredi ». Les
   identifiants commencent tous par `dece0000-` : ui/demo.js efface en
   partant ce que l'app a pu ranger sous eux dans le stockage local. */
import { uuid } from './uuid.js';
import { modele } from './classes.js';
import { etab } from './etablissement.js';
import { ecrireAvatar } from '../avatar.js';
import { pseudoNeuf } from './pseudos.js';

export const PREFIXE = 'dece0000-';
const ID = n => `${PREFIXE}0000-4000-8000-${String(n).padStart(12, '0')}`;
export const COMPTES = { eleve: ID(1), prof: ID(2), ref: ID(3) };

export const ETAB = { nom: 'Lycée Démo Mirandola', ville: 'Nîmes', codeEleves: 'DEMXPK47', codeProfs: 'PRFQWT58' };

/* Le visage de la personne n° n (traits de src/avatar.js, à normaliser par
   ecrireAvatar) et sa couleur de jeton : les mêmes dans la démo, sur sa
   porte d'entrée (« Essayer Mirandola », ui/demo.js) et, pour Léa, Marc et
   Claire, sur la page d'accueil du site (les trois rôles de Mirandola Campus).
   Les autres se tirent de leur numéro. */
const VEDETTES = {
  1: [{ peau: 1, coiffure: 7, cheveux: 2, yeux: 4, bouche: 0, accessoire: 0, haut: 7 }, 10],
  2: [{ peau: 3, coiffure: 1, cheveux: 0, yeux: 0, bouche: 0, accessoire: 2, haut: 1 }, 0],
  3: [{ peau: 0, coiffure: 6, cheveux: 4, yeux: 2, bouche: 2, accessoire: 1, haut: 6 }, 6]
};
export const visageDemo = n => (VEDETTES[n] ? VEDETTES[n][0]
  : { peau: n * 5, coiffure: n * 7, cheveux: n * 3, yeux: n, bouche: n * 2, accessoire: n % 4 ? 0 : n, haut: n * 3 });
export const teinteDemo = n => (VEDETTES[n] ? VEDETTES[n][1] : n % 12);

const JOUR = 864e5;
const iso = t => new Date(t).toISOString();
const dansJours = n => iso(Date.now() + n * JOUR).slice(0, 10);

/* mulberry32 : le même monde à chaque fois */
function hasard(graine) {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- les gens ---------- */
const PROFS = [
  [2, 'Marc', 'DURAND', 'Mathématiques'],
  [4, 'Sophie', 'BERNARD', 'Anglais'],
  [5, 'Julien', 'PETIT', 'Histoire-géographie']
];
const CLASSES = [[101, '2nde A', '2nde'], [102, '2nde B', '2nde'], [103, '1re B', '1re'], [104, 'Tle C', 'Tle']];
const GROUPE = [105, 'Spé maths'];
// [n, prénom, NOM, classe, pseudo, jamais venu]
const ELEVES = [
  [1, 'Léa', 'MARTIN', 102, 'lea_m'],
  [6, 'Hugo', 'LEROY', 101, 'hugo.l'], [7, 'Chloé', 'MOREAU', 101, 'chloe'], [8, 'Nathan', 'SIMON', 101, 'nath'],
  [9, 'Manon', 'LAURENT', 101, 'manon_l'],
  [10, 'Tom', 'GIRARD', 102, 'tomg'], [11, 'Inès', 'BONNET', 102, 'ines.b'], [12, 'Lucas', 'FAURE', 102, 'lucasf'],
  [13, 'Jade', 'ROUSSEAU', 102, 'jade'], [14, 'Louis', 'MERCIER', 102, 'louis_m'], [15, 'Emma', 'BLANC', 102, 'emma.b'],
  [16, 'Noah', 'GUERIN', 102, 'noah'], [17, 'Zoé', 'BOYER', 102, 'zoe_b'], [18, 'Adam', 'GARNIER', 102, '', true],
  [19, 'Lina', 'CHEVALIER', 102, '', true],
  [20, 'Raphaël', 'FRANÇOIS', 103, 'raph'], [21, 'Sarah', 'LEGRAND', 103, 'sarah.l'], [22, 'Gabriel', 'GAUTHIER', 103, '', true],
  [23, 'Alice', 'PERRIN', 104, 'alice_p'], [24, 'Arthur', 'ROBIN', 104, 'arthur']
];
const SPE = [1, 11, 12, 20, 21];
const nomComplet = (p, n) => `${p} ${n}`;

/* ---------- les devoirs ---------- */
const C = l => l.map(([f, b]) => ({ f, b }));
const DEVOIRS = [
  { n: 201, classe: 102, prof: 2, nom: 'Fonctions affines', matiere: 'Mathématiques', due: 2, donne: -3, cartes: C([
    ['Forme d’une fonction affine', 'f(x) = ax + b'], ['Que représente a ?', 'Le coefficient directeur (la pente)'],
    ['Que représente b ?', 'L’ordonnée à l’origine'], ['f(x) = 2x + 3 : f(0) ?', '3'],
    ['Si a > 0, la fonction est…', 'Croissante'], ['Pente de la droite passant par (0 ; 1) et (2 ; 5)', '2']]) },
  { n: 202, classe: 102, prof: 4, nom: 'Irregular verbs, série 1', matiere: 'Anglais', due: 5, donne: -2, cartes: C([
    ['to be', 'was / were, been'], ['to go', 'went, gone'], ['to see', 'saw, seen'], ['to take', 'took, taken'],
    ['to write', 'wrote, written'], ['to buy', 'bought, bought'], ['to think', 'thought, thought'], ['to begin', 'began, begun']]) },
  { n: 203, classe: 102, prof: 4, nom: 'Vocabulaire : la ville', matiere: 'Anglais', due: -2, donne: -9, cartes: C([
    ['la mairie', 'the town hall'], ['le carrefour', 'the crossroads'], ['la gare', 'the train station'],
    ['le trottoir', 'the pavement'], ['la bibliothèque', 'the library'], ['le quartier', 'the neighbourhood']]) },
  { n: 204, classe: 103, prof: 2, nom: 'Second degré', matiere: 'Mathématiques', due: 9, donne: -1, cartes: C([
    ['Forme développée', 'ax² + bx + c'], ['Discriminant', 'Δ = b² − 4ac'], ['Si Δ < 0', 'Pas de racine réelle'],
    ['Si Δ = 0', 'Une racine double : −b / 2a'], ['Sommet de la parabole', 'x = −b / 2a'], ['Forme canonique', 'a(x − α)² + β']]) },
  { n: 205, classe: 105, prof: 2, nom: 'Suites arithmétiques', matiere: 'Mathématiques', due: -1, donne: -6, cartes: C([
    ['Définition', 'uₙ₊₁ = uₙ + r'], ['Terme général', 'uₙ = u₀ + n·r'], ['Somme des n premiers termes', 'n × (premier + dernier) / 2'],
    ['u₀ = 3, r = 2 : u₅ ?', '13'], ['Sens de variation si r > 0', 'Croissante']]) },
  { n: 206, classe: 103, prof: 5, nom: 'La Révolution française', matiere: 'Histoire-géographie', due: 4, donne: -2, cartes: C([
    ['Prise de la Bastille', '14 juillet 1789'], ['Abolition des privilèges', 'Nuit du 4 août 1789'],
    ['Déclaration des droits de l’homme', '26 août 1789'], ['Proclamation de la République', '21 septembre 1792'],
    ['Exécution de Louis XVI', '21 janvier 1793'], ['Coup d’État de Bonaparte', '18 brumaire an VIII (1799)']]) },
  { n: 207, classe: 104, prof: 5, nom: 'La guerre froide', matiere: 'Histoire-géographie', due: 3, donne: -4, cartes: C([
    ['Doctrine Truman', '1947'], ['Blocus de Berlin', '1948-1949'], ['Construction du mur de Berlin', '1961'],
    ['Crise de Cuba', 'Octobre 1962'], ['Chute du mur', '9 novembre 1989'], ['Fin de l’URSS', 'Décembre 1991']]) },
  { n: 208, classe: 101, prof: 4, nom: 'Present perfect', matiere: 'Anglais', due: 6, donne: -1, cartes: C([
    ['Formation', 'have / has + participe passé'], ['I ___ (live) here since 2020', 'have lived'],
    ['Avec for', 'une durée (for two years)'], ['Avec since', 'un point de départ (since Monday)'], ['ever / never', 'expérience de vie']]) }
];

/* Combien chacun a fait d'un devoir : 1 = rendu, 0.5 = commencé, 0 = rien. */
function travail(rand, eleve, devoir) {
  if (eleve === 1) return { 201: 0, 202: 0.5, 203: 1, 205: 1 }[devoir] ?? 0;
  const r = rand();
  return r < 0.55 ? 1 : r < 0.8 ? 0.5 : 0;
}

/* ---------- la bibliothèque de Léa ---------- */
const MATIERES = [['maths', 'Mathématiques', 'blue'], ['anglais', 'Anglais', 'red'], ['histoire', 'Histoire-géographie', 'amber'],
  ['svt', 'SVT', 'green'], ['espagnol', 'Espagnol', 'coral']];
const LIVRES = [
  { n: 301, nom: 'Vocabulaire espagnol', matiere: 'espagnol', cartes: [['la casa', 'la maison'], ['el perro', 'le chien'],
    ['la ciudad', 'la ville'], ['el libro', 'le livre'], ['la playa', 'la plage'], ['el tiempo', 'le temps'], ['la semana', 'la semaine'],
    ['el trabajo', 'le travail'], ['la calle', 'la rue'], ['el agua', 'l’eau'], ['la noche', 'la nuit'], ['el viaje', 'le voyage']] },
  { n: 302, nom: 'Dates d’histoire', matiere: 'histoire', cartes: [['Chute de Rome', '476'], ['Sacre de Charlemagne', '800'],
    ['Découverte de l’Amérique', '1492'], ['Révolution française', '1789'], ['Fin de la Première Guerre mondiale', '1918'],
    ['Fin de la Seconde Guerre mondiale', '1945'], ['Traité de Rome', '1957'], ['Premier pas sur la Lune', '1969'],
    ['Chute du mur de Berlin', '1989'], ['Euro en pièces et billets', '2002']] },
  { n: 303, nom: 'La cellule', matiere: 'svt', cartes: [['Unité du vivant', 'La cellule'], ['Contient l’ADN', 'Le noyau'],
    ['Produit l’énergie', 'La mitochondrie'], ['Photosynthèse', 'Le chloroplaste'], ['Enveloppe de la cellule', 'La membrane plasmique'],
    ['Cellule sans noyau', 'Procaryote'], ['Cellule avec noyau', 'Eucaryote'], ['Division cellulaire', 'La mitose']] },
  { n: 304, nom: 'Phrasal verbs', matiere: 'anglais', cartes: [['to give up', 'abandonner'], ['to look after', 's’occuper de'],
    ['to find out', 'découvrir'], ['to turn down', 'refuser'], ['to get on with', 's’entendre avec'], ['to put off', 'remettre à plus tard'],
    ['to carry on', 'continuer'], ['to run out of', 'manquer de']] }
];
const LIVRES_MARC = [
  { n: 311, nom: 'Fonctions : le cours', matiere: 'maths', cartes: [['Image de x', 'f(x)'], ['Antécédent de y', 'x tel que f(x) = y'],
    ['Ensemble de définition', 'Les x pour lesquels f(x) existe'], ['Fonction carré', 'x ↦ x²'], ['Fonction inverse', 'x ↦ 1/x']] },
  { n: 312, nom: 'Vocabulaire des probabilités', matiere: 'maths', cartes: [['Univers', 'L’ensemble des issues'],
    ['Événement certain', 'Probabilité 1'], ['Événement impossible', 'Probabilité 0'], ['Événements incompatibles', 'P(A ∩ B) = 0']] }
];

const tab = (store, n) => (store.tables[n] = store.tables[n] || []);

function semerLivre(store, uid, l, rand, pos) {
  const deckId = ID(l.n), now = Date.now();
  tab(store, 'decks').push({ id: deckId, user_id: uid, name: l.nom, subject: l.matiere, hidden: false, pos, pinned: false,
    meta: {}, rev: 1, deleted_at: null, cards: [], created_at: iso(now - 40 * JOUR) });
  l.cartes.forEach(([f, b], k) => {
    const c = { deck_id: deckId, id: 'c' + (k + 1), user_id: uid, front: f, back: b, meta: {} };
    const r = rand();
    if (r < 0.25) Object.assign(c, { reviews_count: 0, lapses: 0 });                      // jamais lue
    else {
      const i = r < 0.6 ? 1 + Math.floor(rand() * 3) : 4 + Math.floor(rand() * 20);
      const du = r < 0.5 ? now - rand() * JOUR : now + (1 + Math.floor(rand() * i)) * JOUR;   // une partie à lire aujourd'hui
      Object.assign(c, { state: 2, step: null, stability: i, difficulty: 4 + rand() * 3, trace2: i, due: Math.round(du),
        last_review: Math.round(du - i * JOUR), interval_days: i, reviews_count: 2 + Math.floor(rand() * 5),
        lapses: rand() < 0.2 ? 1 : 0, meta: { fl: now - 30 * JOUR } });
    }
    tab(store, 'cards').push(c);
  });
  return deckId;
}

/* Dix semaines de lecture de Léa (plus denses les cinq dernières) : des soirs
   surtout, une série en cours. */
function semerJournal(store, uid, rand) {
  const livres = LIVRES.map(l => ({ id: ID(l.n), nom: l.nom, matiere: l.matiere, n: l.cartes.length }));
  const nomMat = Object.fromEntries(MATIERES.map(([id, nom]) => [id, nom]));
  for (let j = 69; j >= 0; j--) {
    if (j > 6 && rand() < (j > 34 ? 0.45 : 0.3)) continue;   // la dernière semaine sans trou : une série de 7 jours
    const n = (j > 34 ? 4 : 6) + Math.floor(rand() * (j > 34 ? 18 : 26)), heure = rand() < 0.75 ? 17 + Math.floor(rand() * 5) : 7 + Math.floor(rand() * 2);
    for (let k = 0; k < n; k++) {
      const l = livres[Math.floor(rand() * livres.length)];
      const t = new Date(Date.now() - j * JOUR); t.setHours(heure, Math.floor(rand() * 60), Math.floor(rand() * 60), 0);
      if (t.getTime() > Date.now()) t.setTime(Date.now() - (k + 1) * 60e3);
      tab(store, 'reviews').push({ id: uuid(), user_id: uid, deck_id: l.id, card_id: 'c' + (1 + Math.floor(rand() * l.n)),
        correct: rand() < 0.82, ms: 2500 + Math.floor(rand() * 9000), subject: l.matiere, subject_name: nomMat[l.matiere],
        deck_name: l.nom, ecart: Math.floor(rand() * 20) - 1, created_at: t.toISOString() });
    }
  }
}

/* Des pages lues par d'autres cette semaine : le classement des amis, celui des clubs. */
function semerLectures(store, uid, n, rand) {
  for (let k = 0; k < n; k++) {
    tab(store, 'reviews').push({ id: uuid(), user_id: uid, deck_id: ID(399), card_id: 'x' + k, correct: rand() < 0.8,
      ms: 4000, subject_name: 'Révisions', deck_name: 'Révisions', ecart: 2, created_at: iso(Date.now() - rand() * 6.5 * JOUR) });
  }
}

/* ---------- tout le monde ---------- */
export function semerMonde(store, graine = 2026) {
  const rand = hasard(graine), m = modele(store), et = etab(store), now = Date.now();
  const org = { id: ID(900), nom: ETAB.nom, ville: ETAB.ville, kind: 'lycee', uai: '0301234K', offre: 'etablissement', places: 300,
    fin: finAnnee(now), exemples: false, codes: { eleve: ETAB.codeEleves, prof: ETAB.codeProfs, ref: null, refFin: null,
      eleveAu: iso(now - 3 * JOUR), profAu: iso(now - 3 * JOUR) }, rythme: 'semaine',
    suivi: { statut: 'client', source: 'editeur', contact_nom: 'Claire ROUX', contact_fonction: 'Proviseure adjointe',
      contact_email: '', contact_tel: '', eleves_estimes: 280, budget_euros: null, prix_euros: 1200, besoins: [], message: '',
      notes: '', relance: null }, cree: iso(now - 20 * JOUR) };
  et.orgs.push(org);
  const profils = tab(store, 'profiles'), jetons = store.jetons = store.jetons || {};
  const personne = (n, prenom, nom, role, pseudo) => {
    const id = ID(n);
    store.users.push({ id, email: `${(pseudo || prenom).toLowerCase()}@demo.mirandola.invalid`, password: uuid() });
    m.roles[id] = role; m.noms[id] = nomComplet(prenom, nom); et.membres[id] = org.id;
    profils.push({ id, email: '', handle: pseudo || pseudoNeuf(store, prenom, id), name: nomComplet(prenom, nom) });   // un pseudo pour tous
    jetons['p:' + id] = { cle: ecrireAvatar(visageDemo(n)), teinte: teinteDemo(n) };
    tab(store, 'prefs').push({ id, user_id: id, data: { tuto: 1, bienvenue: 1, name: prenom, goal: 30 } });
    return id;
  };
  personne(3, 'Claire', 'ROUX', 'ref', null);
  for (const [n, p, nom] of PROFS) personne(n, p, nom, 'prof', null);

  for (const [n, nom, niveau] of CLASSES) {
    m.classes.push({ id: ID(n), name: nom, niveau, matiere: '', code: '', owner: COMPTES.ref, ouvert: true, validation: false,
      places: 40, fin: null, archivee: false, org: org.id, genre: 'classe' });
  }
  m.classes.push({ id: ID(GROUPE[0]), name: GROUPE[1], niveau: '', matiere: 'Mathématiques', code: '', owner: COMPTES.prof,
    ouvert: false, validation: false, places: 300, fin: null, archivee: false, org: org.id, genre: 'groupe' });
  jetons['c:' + ID(101)] = { cle: 'feuille', teinte: 5 }; jetons['c:' + ID(102)] = { cle: 'globe', teinte: 2 };
  jetons['c:' + ID(103)] = { cle: 'atome', teinte: 0 }; jetons['c:' + ID(104)] = { cle: 'etoile', teinte: 8 };
  jetons['c:' + ID(105)] = { cle: 'sigma', teinte: 1 };

  et.services = [[102, 2, true], [103, 2, false], [101, 4, false], [102, 4, false], [103, 5, true], [104, 5, true]]
    .map(([c, p, pp]) => ({ id: uuid(), cid: ID(c), prof: ID(p), matiere: PROFS.find(x => x[0] === p)[3], pp }));
  et.services.push({ id: uuid(), cid: ID(105), prof: ID(2), matiere: 'Mathématiques', pp: false });

  for (const [n, p, nom, classe, pseudo, jamais] of ELEVES) {
    const id = personne(n, p, nom, 'eleve', pseudo);
    const vu = jamais ? null : iso(now - (n === 1 ? 0 : rand() * 3 * JOUR));
    m.membres.push({ cid: ID(classe), uid: id, depuis: iso(now - 50 * JOUR), vu });
    if (SPE.includes(Number(n))) m.membres.push({ cid: ID(105), uid: id, depuis: iso(now - 30 * JOUR), vu });
  }

  /* les devoirs, et ce que chacun en a fait */
  for (const d of DEVOIRS) {
    const id = ID(d.n), membres = m.membres.filter(x => x.cid === ID(d.classe));
    m.devoirs.push({ id, cid: ID(d.classe), nom: d.nom, matiere: d.matiere, cartes: d.cartes, due: dansJours(d.due),
      donne: iso(now + d.donne * JOUR), auteur: ID(d.prof), ouverts: [] });
    const dev = m.devoirs[m.devoirs.length - 1];
    for (const x of membres) {
      if (!x.vu) continue;
      const part = travail(rand, +x.uid.slice(-12), d.n);
      if (!part) continue;
      dev.ouverts.push(x.uid);
      const n = Math.max(1, Math.round(d.cartes.length * part));
      for (let k = 0; k < n; k++) {
        tab(store, 'reviews').push({ id: uuid(), user_id: x.uid, deck_id: ID(d.n + 1000), card_id: `a:${id}:${k}`,
          correct: rand() < (k % 3 ? 0.85 : 0.5), ms: 5000, subject_name: d.matiere, deck_name: d.nom, ecart: -1,
          created_at: iso(now + (d.donne + 1 + rand()) * JOUR) });
      }
    }
  }

  /* la bibliothèque et le journal de Léa, deux livres de Marc */
  const lea = COMPTES.eleve;
  MATIERES.forEach(([id, name, color], pos) => tab(store, 'subjects').push({ id, user_id: lea, name, color, pos }));
  LIVRES.forEach((l, i) => semerLivre(store, lea, l, rand, i));
  semerJournal(store, lea, rand);
  tab(store, 'subjects').push({ id: 'maths', user_id: COMPTES.prof, name: 'Mathématiques', color: 'blue', pos: 0 });
  LIVRES_MARC.forEach((l, i) => semerLivre(store, COMPTES.prof, l, rand, i));

  /* ses amis, une demande, les clubs */
  const amis = tab(store, 'friends');
  for (const n of [10, 11, 6]) amis.push({ id: uuid(), user_id: lea, friend_id: ID(n), status: 'ok' });
  amis.push({ id: uuid(), user_id: ID(16), friend_id: lea, status: 'pending' });
  amis.push({ id: uuid(), user_id: ID(10), friend_id: ID(11), status: 'ok' });
  for (const [n, pages] of [[10, 120], [11, 165], [6, 70], [12, 95], [20, 140], [13, 40], [17, 55]]) semerLectures(store, ID(n), pages, rand);
  const club = (n, nom, chef, membres, embleme, teinte, devise) => {
    tab(store, 'groups').push({ id: ID(n), name: nom, code: 'CLUB' + String(n).slice(-2) + 'XY', owner: ID(chef), embleme, teinte, devise,
      created_at: iso(now - 15 * JOUR) });
    for (const u of [chef, ...membres]) tab(store, 'group_members').push({ id: uuid(), group_id: ID(n), user_id: ID(u), joined_at: iso(now - 14 * JOUR) });
  };
  // les clubs sont fermés aux élèves de classe (un élève de classe n'en crée ni n'en rejoint) : ceux du lycée vivent entre anciens
  club(401, 'Les matheux', 23, [24], 'sigma', 1, 'Une page par jour, pas une de moins');

  /* deux défis entre amis : celui de Tom, que Léa n'a pas encore joué ;
     celui d'Inès, joué par les trois (Léa deuxième) */
  const defi = (n, de, nom, cartes, il, scores) => {
    tab(store, 'duels').push({ id: ID(n), owner: ID(de), who: m.noms[ID(de)].split(' ')[0], name: nom, total: cartes.length,
      cards: cartes, group_id: null, class_id: null, created_at: iso(now - il * JOUR) });
    for (const [u, score, s] of scores) tab(store, 'duel_scores').push({ id: uuid(), duel_id: ID(n), user_id: u === 'lea' ? lea : ID(u),
      who: u === 'lea' ? 'Léa' : m.noms[ID(u)].split(' ')[0], score, ms: s * 1000 });
  };
  defi(601, 10, 'Capitales d’Europe', [['France', 'Paris'], ['Espagne', 'Madrid'], ['Italie', 'Rome'], ['Allemagne', 'Berlin'],
    ['Portugal', 'Lisbonne'], ['Belgique', 'Bruxelles'], ['Pologne', 'Varsovie'], ['Grèce', 'Athènes']], 0.3, [[10, 7, 64]]);
  defi(602, 11, 'Les grandes dates', [['Chute de Rome', '476'], ['Sacre de Charlemagne', '800'], ['Découverte de l’Amérique', '1492'],
    ['Révolution française', '1789'], ['Fin de la Première Guerre mondiale', '1918'], ['Fin de la Seconde Guerre mondiale', '1945'],
    ['Premier pas sur la Lune', '1969'], ['Chute du mur de Berlin', '1989']], 3, [[11, 8, 51], ['lea', 7, 58], [10, 6, 73]]);

  /* le courrier de Léa */
  const lettre = (n, de, message, livre, matiere, cartes, il, lu) => tab(store, 'mail').push({ id: ID(n), user_id: ID(de),
    from_user: ID(de), to_user: lea, from_name: m.noms[ID(de)], deck_name: livre, subject_name: matiere, message,
    cards: cartes, created_at: iso(now - il * JOUR), read_at: lu ? iso(now - il * JOUR + 3600e3) : null, added_at: null });
  lettre(501, 10, 'Pour le contrôle de jeudi, je t’ai fait les capitales !', 'Capitales d’Europe', 'Géographie',
    [['France', 'Paris'], ['Espagne', 'Madrid'], ['Italie', 'Rome'], ['Allemagne', 'Berlin'], ['Portugal', 'Lisbonne'],
      ['Belgique', 'Bruxelles'], ['Pologne', 'Varsovie'], ['Grèce', 'Athènes']], 0.6, false);
  lettre(502, 2, 'Pensez à finir les fonctions affines avant mercredi. Bon courage !', '2nde B', null, [], 2, true);
  lettre(503, 11, 'Ma fiche sur les suites, si ça peut t’aider', 'Les suites, la fiche d’Inès', 'Mathématiques',
    [['Suite arithmétique', 'uₙ₊₁ = uₙ + r'], ['Suite géométrique', 'uₙ₊₁ = q·uₙ'], ['Raison', 'r (ou q)']], 4, true);

  /* l'historique du référent */
  const trace = (il, acte, detail) => tab(store, 'ref_audit').push({ acte, cible: null, detail, created_at: iso(now - il * JOUR) });
  trace(12, 'classe créée', { nom: 'Tle C' });
  trace(9, 'professeur entré avec le code', { nom: 'Julien PETIT' });
  trace(10, 'code renouvelé', { role: 'eleve', rythme: 'semaine' });
  trace(10, 'code renouvelé', { role: 'prof', rythme: 'semaine' });
  trace(3, 'code renouvelé', { role: 'eleve', rythme: 'semaine' });
  trace(3, 'code renouvelé', { role: 'prof', rythme: 'semaine' });
  trace(3, 'élève déplacé', { avant: '2nde A', apres: '2nde B' });
  semerLicence(store, et, org, now, trace);
  return store;
}

/* ---------- la licence : un client, deux factures, un échange ---------- */
/* Le 31 août qui suit : la fin de l'année scolaire. */
function finAnnee(now) {
  const d = new Date(now);
  return `${d.getFullYear() + (d.getMonth() >= 6 ? 1 : 0)}-08-31`;
}

/* Le vendeur de la démo est un exemple, et le dit : ce ne sont pas les vraies
   coordonnées de l'éditeur (qu'il remplit dans sa console). */
const VENDEUR = { raison_sociale: 'Mirandola', forme: 'EI', adresse: '1 rue des Exemples', code_postal: '30000', ville: 'Nîmes',
  siret: '98765432100015', immatriculation: 'Document de démonstration', tva_intracom: '', iban: '', bic: '',
  email: 'contact@demo.mirandola.invalid', regime_tva: 'franchise', taux_tva: 20, delai_jours: 30 };

function semerLicence(store, et, org, now, trace) {
  const jour = n => iso(now - n * JOUR).slice(0, 10), an = new Date(now).getFullYear();
  org.facturation = { nom: 'Lycée Démo Mirandola', adresse: '12 avenue Jean-Jaurès', code_postal: '30900', ville: 'Nîmes',
    siret: '19301234500016', service: 'MIR-LYC', engagement: 'BC-' + an + '-0412', email: 'intendance@demo.mirandola.invalid' };
  et.vendeur = { ...VENDEUR };
  const client = { ...org.facturation, uai: org.uai };
  const piece = (n, il, objet, lignes, paye) => {
    const ht = lignes.reduce((a, [, q, pu]) => a + q * pu, 0);
    return { id: ID(n), org_id: org.id, numero: `F-${an}-${String(n - 800).padStart(4, '0')}`, genre: 'facture', origine: null,
      emise_le: jour(il), echeance: jour(il - 30), periode_debut: jour(il), periode_fin: org.fin, objet,
      lignes: lignes.map(([libelle, quantite, prix_ht]) => ({ libelle, quantite, prix_ht, total_ht: quantite * prix_ht })),
      total_ht: ht, tva: 0, total_ttc: ht, taux_tva: 0, mention_tva: 'TVA non applicable, art. 293 B du CGI',
      vendeur: { ...VENDEUR }, client, engagement: org.facturation.engagement, deposee_le: jour(il - 1), payee_le: paye ? jour(paye) : null };
  };
  et.factures = [
    piece(801, 55, 'Licence annuelle', [['Licence Mirandola — 250 places (élèves et professeurs)', 1, 102500]], 28),
    piece(802, 6, 'Places supplémentaires', [['50 places supplémentaires', 50, 350]], null)
  ];
  et.compteurs = { ['F' + an]: 2 };
  const msg = (id, il, de, sujet, message, lu) => ({ id, org_id: org.id, de, auteur: de === 'etab' ? COMPTES.ref : null, sujet, message,
    cree: iso(now - il * JOUR), lu: lu ? iso(now - (il - 0.5) * JOUR) : null });
  et.echanges = [
    msg(1, 8, 'etab', 'places', 'Bonjour, une classe de plus ouvre après les vacances : pouvez-vous ajouter 50 places ?', true),
    msg(2, 7, 'folio', 'places', 'C’est fait : 50 places de plus dès aujourd’hui. La facture suit, à déposer sur Chorus Pro.', true),
    msg(3, 6, 'folio', 'facture', `Voici la facture F-${an}-0002 (175 € HT), à régler sous trente jours.`, false)
  ];
  trace(55, 'facture émise', { numero: `F-${an}-0001` });
  trace(6, 'facture émise', { numero: `F-${an}-0002` });
}
