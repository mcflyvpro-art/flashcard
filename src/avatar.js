/* Les avatars (2026-10-25, élargis le 2026-10-29) — module pur, sans aucune
   dépendance, testé dans test/avatar.test.js. Un visage dessiné, composé de
   quatorze traits que chacun choisit un à un (peau, coiffure, cheveux, yeux,
   bouche, chapeau, couleur du haut, sourcils, barbe, détails du visage,
   tenue, couleur des yeux, lunettes, bijoux) sur le fond de sa couleur de
   jeton. Il remplace les émojis : un émoji s'affiche différemment d'un
   téléphone à l'autre, et ne se personnalise pas. Assez de choix pour que
   chacun s'y retrouve, quelles que soient sa peau, ses cheveux, sa culture
   ou son genre : quatorze teintes de peau, des cheveux crépus, des locks,
   des nattes collées, un hijab, un turban, une barbe, des lunettes, un
   appareil auditif — et rien n'est réservé à un genre.

   Rien n'est stocké de plus en base : un avatar s'écrit dans la clé
   `profiles.figure` déjà là (`^[a-z]{2,16}$`), « av » suivi d'une lettre par
   trait — 7 lettres jusqu'au 2026-10-29, 14 au plus depuis (la contrainte
   n'en laisse pas une de plus). Les lettres de fin qui valent « a » (le
   choix par défaut) ne s'écrivent pas : un avatar d'avant garde sa clé et
   son dessin, au pixel près. mon_jeton() et visuels() transportent la clé
   telle quelle. Les anciennes figures (« renard », « hibou »…) donnent un
   avatar tiré de leur nom : le même partout, jusqu'à ce que la personne en
   choisisse un. Jamais de photo, jamais de texte libre : des listes fermées.

   Ajouter un choix : toujours à la FIN de sa liste (une clé rangée en base
   désigne un rang), puis le placer où il faut dans AFFICHE. */

/* [teinte, ombre] — les six premières sont celles d'avant */
const PEAUX = [['#FCE0CC', '#EFC2A6'], ['#F5C9A6', '#E2AB85'], ['#E3A97F', '#CB8E63'],
  ['#C98B5E', '#AF7347'], ['#9E6743', '#855234'], ['#6B4430', '#553323'],
  ['#FFEDE3', '#F3D2C1'], ['#F7D2C0', '#E8B39C'], ['#EFCFA8', '#DDB386'], ['#E6B88E', '#CF9C6F'],
  ['#CDA47A', '#B4895E'], ['#B97B52', '#9E643F'], ['#874F33', '#6E3E27'], ['#4E3125', '#3C251B']];
const CHEVEUX = ['#24201D', '#4B2F20', '#7B5131', '#DDAA52', '#BD5A2C', '#BDB7B0', '#4C6FD8', '#E58FB3',
  '#ECE7E0', '#8E3B1F', '#EADBB0', '#A86B3C', '#8463C9', '#4E9A72', '#C2384A', '#D8C3A5', '#6E2335', '#283A63'];
const HAUTS = ['#F1ECE1', '#34343E', '#E2A53B', '#5B8DEF', '#E86B5C', '#4FA37A', '#9D80DB', '#F0B3C4',
  '#2F3E66', '#8A2F45', '#7C7A4A', '#1F1F24', '#FAFAF7', '#8FC3E8', '#F2D04B', '#EE8A3C'];
const IRIS = ['#2A2421', '#5B3A26', '#7D5A2C', '#3F7350', '#3B67A8', '#6B7480'];
const ENCRE = '#2A2421', LEVRE = '#8C3B33', OR = '#E3B342', ARGENT = '#C9CDD3';

/* L'ordre des traits dans la clé, et le nom de chaque choix (pour les
   lecteurs d'écran et les tests). Les sept premiers sont ceux d'avant. */
export const TRAITS = {
  peau: ['très claire', 'claire', 'mate', 'hâlée', 'brune', 'foncée',
    'porcelaine', 'rosée', 'sable', 'dorée', 'olive', 'cuivrée', 'acajou', 'ébène'],
  coiffure: ['rasée', 'courte', 'mèche', 'bouclée', 'longue', 'carré', 'chignon', 'queue', 'afro', 'tresses',
    'sans cheveux', 'locks', 'nattes collées', 'macarons', 'tresses longues', 'frange', 'ondulée', 'crépue courte',
    'couettes', 'raie de côté', 'hijab', 'turban'],
  cheveux: ['noirs', 'bruns', 'châtains', 'blonds', 'roux', 'gris', 'bleus', 'roses',
    'blancs', 'auburn', 'blond platine', 'caramel', 'violets', 'verts', 'rouges', 'beiges', 'bordeaux', 'marine'],
  yeux: ['points', 'ronds', 'rieurs', 'clin d’œil', 'cils', 'amande', 'grands', 'mi-clos', 'regard de côté', 'bridés'],
  bouche: ['sourire', 'rire', 'calme', 'surprise', 'malice', 'grand sourire', 'langue', 'dents', 'moue', 'lèvres pleines'],
  /* « accessoire » est devenu le chapeau : les lunettes (1, 2) et les boucles
     (5) d'avant ont leur trait à elles (`normaliser`) */
  accessoire: ['aucun', 'lunettes rondes', 'lunettes carrées', 'casquette', 'bandeau', 'boucles d’oreilles',
    'bonnet', 'serre-tête', 'nœud', 'casque audio', 'bob', 'fleurs'],
  haut: ['crème', 'anthracite', 'moutarde', 'bleu', 'corail', 'vert', 'lilas', 'rose',
    'marine', 'bordeaux', 'kaki', 'noir', 'blanc', 'ciel', 'jaune', 'orange'],
  sourcils: ['arqués', 'droits', 'épais', 'fins', 'hauts', 'décidés'],
  barbe: ['aucune', 'de trois jours', 'courte', 'longue', 'moustache', 'bouc', 'collier'],
  details: ['joues roses', 'aucun', 'taches de rousseur', 'grain de beauté', 'vitiligo', 'fossettes', 'rousseur et joues'],
  tenue: ['t-shirt', 'sweat à capuche', 'col roulé', 'chemise', 'col en V', 'salopette', 'veste', 'rayé', 'polo'],
  iris: ['noirs', 'bruns', 'noisette', 'verts', 'bleus', 'gris'],
  lunettes: ['aucunes', 'rondes', 'carrées', 'de soleil', 'œil-de-chat', 'fines', 'dorées'],
  bijoux: ['aucun', 'puces dorées', 'puces argent', 'créoles', 'piercing au nez', 'bindi', 'appareil auditif']
};
export const ORDRE = Object.keys(TRAITS);
const ANCIENS = 7;                    // les traits d'avant le 2026-10-29 : une clé a au moins leurs lettres
const LETTRES = 'abcdefghijklmnopqrstuvwxyz';

/* L'ordre où l'on présente les choix (une clé garde les rangs de TRAITS) :
   les peaux de la plus claire à la plus foncée, les couleurs naturelles
   avant les autres ; les lunettes et les boucles d'avant ne sont plus des
   chapeaux. */
export const AFFICHE = {
  peau: [6, 0, 7, 1, 8, 9, 2, 10, 3, 11, 4, 12, 5, 13],
  coiffure: [10, 0, 1, 19, 2, 15, 3, 17, 8, 11, 12, 9, 14, 13, 18, 6, 7, 5, 16, 4, 20, 21],
  cheveux: [0, 1, 2, 11, 9, 4, 3, 10, 5, 8, 6, 17, 12, 7, 14, 16, 13, 15],
  accessoire: [0, 3, 10, 6, 4, 7, 8, 9, 11],
  haut: [0, 12, 1, 11, 8, 3, 13, 5, 10, 2, 14, 15, 4, 9, 6, 7]
};
export const choixDe = t => AFFICHE[t] || TRAITS[t].map((_, i) => i);

/* Les onglets d'un éditeur, dans l'ordre où l'on compose un visage. */
export const ONGLETS = [['peau', 'Peau'], ['coiffure', 'Coiffure'], ['cheveux', 'Cheveux'], ['sourcils', 'Sourcils'],
  ['yeux', 'Yeux'], ['iris', 'Iris'], ['bouche', 'Bouche'], ['barbe', 'Barbe'], ['details', 'Visage'],
  ['lunettes', 'Lunettes'], ['bijoux', 'Bijoux'], ['accessoire', 'Chapeau'], ['tenue', 'Tenue'], ['haut', 'Couleur']];

/* Les traits qui sont une couleur : on les choisit sur une pastille. */
export const TEINTES_TRAIT = { peau: PEAUX.map(p => p[0]), cheveux: CHEVEUX, haut: HAUTS, iris: IRIS };

/* Un hijab, un turban couvrent les cheveux : leur couleur est celle du tissu. */
export const couvert = a => a.coiffure === 20 || a.coiffure === 21;
export const nomOnglet = (k, a) => (k === 'cheveux' && a && couvert(a) ? (a.coiffure === 20 ? 'Hijab' : 'Turban') : (ONGLETS.find(o => o[0] === k) || [k, k])[1]);

/* Ce qui ne se voit que de près se choisit sur le visage agrandi. */
export const DE_PRES = new Set(['yeux', 'sourcils', 'bouche', 'barbe', 'details', 'lunettes', 'bijoux']);

export const estAvatar = k => typeof k === 'string' && /^av[a-z]{7,14}$/.test(k);

const borne = (t, v) => { const n = TRAITS[t].length; return (((v | 0) % n) + n) % n; };

/* Les lunettes et les boucles d'avant (des « accessoires ») passent à leur
   trait : le dessin ne change pas, et l'on peut porter un bonnet ET des
   lunettes. */
export function normaliser(a) {
  const n = Object.fromEntries(ORDRE.map(t => [t, borne(t, a[t])]));
  if ((n.accessoire === 1 || n.accessoire === 2) && !n.lunettes) n.lunettes = n.accessoire;
  if (n.accessoire === 5 && !n.bijoux) n.bijoux = 1;
  if ([1, 2, 5].includes(n.accessoire)) n.accessoire = 0;
  return n;
}

export function ecrireAvatar(a) {
  const n = normaliser(a);
  let k = ORDRE.map(t => LETTRES[n[t]]).join('');
  while (k.length > ANCIENS && k.endsWith('a')) k = k.slice(0, -1);
  return 'av' + k;
}

export function lireAvatar(k) {
  if (!estAvatar(k)) return null;
  return normaliser(Object.fromEntries(ORDRE.map((t, i) => [t, Math.max(0, LETTRES.indexOf(k[i + 2] || 'a'))])));
}

/* Le même avatar pour la même graine, sur tous les appareils (FNV-1a). Il
   ne tire que parmi les choix d'avant le 2026-10-29 : un visage tiré d'une
   ancienne figure, ou d'un identifiant, ne change pas. */
const AVANT = { peau: 6, coiffure: 10, cheveux: 8, yeux: 5, bouche: 5, accessoire: 6, haut: 8 };
export function avatarDe(graine) {
  let h = 0x811c9dc5;
  for (const c of String(graine || '')) { h ^= c.codePointAt(0); h = Math.imul(h, 0x01000193); }
  const a = {};
  for (const t of ORDRE) {
    a[t] = AVANT[t] ? (h >>> 0) % AVANT[t] : 0;
    if (AVANT[t]) h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
  }
  return normaliser(a);
}

/* L'avatar d'une clé de figure : le sien s'il en a choisi un, celui que tire
   le nom d'une ancienne figure sinon, rien sans figure. */
export const avatarDeCle = k => (!k ? null : lireAvatar(k) || avatarDe('figure:' + k));

/* « Au hasard » (Mon jeton) : parmi tous les choix qu'on présente. */
export const auHasard = (r = Math.random) => normaliser(Object.fromEntries(ORDRE.map(t => {
  const l = choixDe(t); return [t, l[Math.floor(r() * l.length)]];
})));

/* Un visage de départ, le même pour tous : on le compose ensuite trait par trait. */
export const NEUTRE = normaliser({ peau: 2, coiffure: 1, cheveux: 1 });

/* ---------- le dessin (viewBox 100 × 100, recadré en rond par l'écran) ---------- */
const f = (d, c) => `<path d="${d}" fill="${c}"/>`;
const t = (d, c, w = 2) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const rond = (x, y, r, c) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`;
const sym = (fn) => fn(1) + fn(-1);                 // le même trait des deux côtés du visage
const mx = (s, x) => 50 + (x - 50) * s;               // x, côté gauche (s = 1) ou miroir à droite (s = -1)

/* une coiffure : [derrière la tête, devant] ; `null` : dessinée à part */
const COURTE = 'M30 45C27 28 38 20 51 20S73 28 70 45C69 39 66 35 62 33C55 36 44 36 36 34C33 37 31 40 30 45Z';
const RAIE = 'M30 46C29 28 39 21 50 21S71 28 70 46C67 36 58 30 50 30S33 36 30 46Z';
const CALOTTE = 'M31.5 44C31 30 39 24 50 24S69 30 68.5 44C66 37 60 33 50 33S34 37 31.5 44Z';
const COIFFURES = [
  ['', CALOTTE],
  ['', COURTE],
  ['', 'M30 46C27 27 40 19 52 20S73 30 70 46C68 38 64 33 58 31C50 38 40 40 32 40C31 42 30.5 44 30 46Z'],
  ['', null],
  ['M29 44C27 24 39 17 50 17S73 24 71 44L73 80C65 84 35 84 27 80Z', RAIE],
  ['M28 46C26 25 39 18 50 18S74 25 72 46L72 62C66 66 34 66 28 62Z', 'M31 41C31 26 40 21 50 21S69 26 69 41C62 38 38 38 31 41Z'],
  ['', 'M31 45C30 29 39 23 50 23S70 29 69 45C66 36 59 32 50 32S34 36 31 45Z'],
  ['M65 29C80 33 83 52 77 67C75 57 71 47 63 41Z', COURTE],
  ['', 'M31 41C33 30 41 26 50 26S67 30 69 41C62 36 38 36 31 41Z'],
  ['', RAIE],
  ['', ''],
  ['', null],
  ['', null],
  ['', CALOTTE],
  ['M28 46C26 25 39 18 50 18S74 25 72 46L74 82C66 86 34 86 26 82Z', RAIE],
  ['M29 46C27 26 39 18 50 18S73 26 71 46L71 66C65 70 35 70 29 66Z',
    'M30.5 44C29 27 39 20 50 20S71 27 69.5 44C69.2 41 68.8 39 68.2 37.6H31.8C31.2 39 30.8 41 30.5 44Z'],
  ['M28 46C25 26 38 18 50 18S75 26 72 46C74 52 71 56 73 62C74 67 69 70 66 68H34C31 70 26 67 27 62C29 56 26 52 28 46Z', RAIE],
  ['', null],
  ['', RAIE],
  ['', 'M30 45C28 28 38 20 50 20S72 26 70 45C68 37 63 32 55 31C47 31 39 34 33 33C31 37 30.5 41 30 45Z'],
  ['M25.5 47C25.5 27 36.5 17.5 50 17.5S74.5 27 74.5 47C74.5 60 70 68 64 72H36C30 68 25.5 60 25.5 47Z',
    'M31.2 47C30.5 31 39 24.6 50 24.6S69.5 31 68.8 47C67 37.5 60 32.6 50 32.6S33 37.5 31.2 47Z'],
  ['', null]
];

function derriere(a, c) {
  switch (a.coiffure) {
    case 3: return '';
    case 6: return rond(50, 19, 9, c);
    case 8: return rond(50, 40, 27, c);
    case 9: return `<rect x="24.5" y="42" width="8.5" height="36" rx="4.2" fill="${c}"/><rect x="67" y="42" width="8.5" height="36" rx="4.2" fill="${c}"/>`
      + `<rect x="24" y="70" width="9.5" height="3" rx="1.5" fill="${HAUTS[(a.haut + 3) % 8]}"/>`
      + `<rect x="66.5" y="70" width="9.5" height="3" rx="1.5" fill="${HAUTS[(a.haut + 3) % 8]}"/>`;
    case 11: return [26.5, 31.5, 68.5, 73.5].map((x, i) => `<rect x="${x - 3}" y="${i % 3 ? 36 : 42}" width="6" height="${i % 3 ? 44 : 36}" rx="3" fill="${c}"/>`).join('');
    case 13: return rond(35, 23, 8.5, c) + rond(65, 23, 8.5, c);
    case 14: return f(COIFFURES[14][0], c) + t('M33 50V80M38.5 52V82M61.5 52V82M67 50V80', 'rgba(0,0,0,.16)', 1.2);
    case 18: return rond(25, 52, 7.5, c) + rond(75, 52, 7.5, c)
      + `<rect x="27.5" y="47" width="3" height="9" rx="1.5" fill="${HAUTS[(a.haut + 3) % 8]}"/>`
      + `<rect x="69.5" y="47" width="3" height="9" rx="1.5" fill="${HAUTS[(a.haut + 3) % 8]}"/>`;
    default: return COIFFURES[a.coiffure][0] ? f(COIFFURES[a.coiffure][0], c) : '';
  }
}

function devant(a, c) {
  switch (a.coiffure) {
    case 3: return [[33, 37, 7.5], [40, 28.5, 8.5], [50, 25.5, 9], [60, 28.5, 8.5], [67, 37, 7.5], [31, 45, 5], [69, 45, 5]]
      .map(([x, y, r]) => rond(x, y, r, c)).join('');
    case 11: return f(COURTE, c) + [36, 43, 50, 57, 64].map((x, i) => `<rect x="${x - 2.8}" y="${23 + Math.abs(i - 2) * 2}" width="5.6" height="15" rx="2.8" fill="${c}"/>`).join('')
      + t('M33 34V44M67 34V44', c, 5.4);
    case 12: return f(CALOTTE, c) + t('M38 27.5Q37 34 34 40M44 25Q43.5 31 42 34.5M50 24.5V33M56 25Q56.5 31 58 34.5M62 27.5Q63 34 66 40', 'rgba(255,255,255,.2)', 1.1);
    case 17: return f('M31 43C30 29 39 22.5 50 22.5S70 29 69 43C66 35.5 59 32.5 50 32.5S34 35.5 31 43Z', c)
      + [[32.5, 37], [36, 30.5], [42, 26], [50, 24], [58, 26], [64, 30.5], [67.5, 37]].map(([x, y]) => rond(x, y, 3.6, c)).join('');
    case 21: return f('M29 41C28 24 38 14.5 50 14.5S72 24 71 41C66 34.5 58 31.5 50 31.5S34 34.5 29 41Z', c)
      + t('M32.5 31Q50 21 67.5 31M31 36.5Q50 26.5 69 36.5', 'rgba(0,0,0,.16)', 1.3) + f('M46.5 31.5L50 25L53.5 31.5Z', 'rgba(0,0,0,.14)');
    default: return COIFFURES[a.coiffure][1] ? f(COIFFURES[a.coiffure][1], c) : '';
  }
}

/* ce qui reste visible des cheveux (sourcils, barbe) : sous un hijab ou un
   turban, dont la couleur est celle du tissu, un brun naturel */
function poils(a, c) {
  if (couvert(a)) return '#3A2A20';
  return { 5: '#8E877F', 8: '#B9B2A8', 10: '#C9B98A' }[a.cheveux] || c;
}

function sourcils(a, c) {
  switch (a.sourcils) {
    case 1: return t('M40.6 41H46.4M53.6 41H59.4', c, 1.8);
    case 2: return t('M40.4 41Q43.5 39.2 46.6 41M53.4 41Q56.5 39.2 59.6 41', c, 3);
    case 3: return t('M40.6 41Q43.5 39.8 46.4 41M53.6 41Q56.5 39.8 59.4 41', c, 1.1);
    case 4: return t('M40.4 39.6Q43.5 37.8 46.6 39.6M53.4 39.6Q56.5 37.8 59.6 39.6', c, 1.8);
    case 5: return t('M40.6 40L46.4 41.6M53.6 41.6L59.4 40', c, 2.2);
    default: return t('M40.4 41Q43.5 39.4 46.6 41M53.4 41Q56.5 39.4 59.6 41', c, 1.8);
  }
}

function yeux(a) {
  const k = IRIS[a.iris] || ENCRE;
  const pt = (x) => rond(x, 47, 2.3, k);
  const arc = (x) => t(`M${x - 3} 48Q${x} 44.6 ${x + 3} 48`, ENCRE, 2);
  const blanc = (x, rx, ry, dx = .3, r = 2, hx = 1) => `<ellipse cx="${x}" cy="47" rx="${rx}" ry="${ry}" fill="#fff"/>${rond(x + dx, 47.4, r, k)}${rond(x + hx, 46.4, .7, '#fff')}`;
  switch (a.yeux) {
    case 1: return [43.5, 56.5].map(x => blanc(x, 3.4, 3.7)).join('');
    case 2: return arc(43.5) + arc(56.5);
    case 3: return pt(43.5) + arc(56.5);
    case 4: return pt(43.5) + pt(56.5) + t('M40.6 45.2L39.4 44M46.4 45.2L47.6 44M53.6 45.2L52.4 44M59.4 45.2L60.6 44', ENCRE, 1.3);
    case 5: return [43.5, 56.5].map(x => `<path d="M${x - 3.6} 47Q${x} 43.6 ${x + 3.6} 47Q${x} 49.8 ${x - 3.6} 47Z" fill="#fff"/>${rond(x, 47, 1.7, k)}`).join('');
    case 6: return [43.5, 56.5].map(x => blanc(x, 4.1, 4.5, .3, 2.5, 1.2)).join('');
    case 7: return [43.5, 56.5].map(x => `<path d="M${x - 3} 46.6A3 2.6 0 0 0 ${x + 3} 46.6Z" fill="${k}"/>` + t(`M${x - 3.3} 46.6H${x + 3.3}`, ENCRE, 1.4)).join('');
    case 8: return [43.5, 56.5].map(x => blanc(x, 3.4, 3.7, -1.2, 2, -.6)).join('');
    case 9: return [43.5, 56.5].map(x => t(`M${x - 3.2} 46.4Q${x} 45.2 ${x + 3.2} 46.4`, ENCRE, 1.5) + rond(x, 47.6, 1.6, k)).join('');
    default: return pt(43.5) + pt(56.5);
  }
}

const JOUES = rond(38.6, 53.2, 3, 'rgba(232,110,110,.22)') + rond(61.4, 53.2, 3, 'rgba(232,110,110,.22)');
const ROUSSEUR = c => [[37.4, 51.4], [39.8, 52.6], [38.2, 54.2], [41, 50.8]].map(([x, y]) => sym(s => rond(mx(s, x), y, .55, c))).join('');

function details(a, peau, ombre) {
  switch (a.details) {
    case 1: return '';
    case 2: return ROUSSEUR(ombre);
    case 3: return rond(59.5, 56, .9, ombre);
    case 4: return `<path d="M39 41.5C41.5 39 46.5 39.4 47.5 42.6C47.6 45.6 44.6 46.2 42.6 49.6C40.4 49 37.6 45.4 39 41.5Z" fill="${clair(peau)}"/>`
      + `<path d="M52 62.6C54.8 61 58.6 61.2 60.4 59.2C61 61.8 58 64.6 54.2 64.8Z" fill="${clair(peau)}"/>`;
    case 5: return JOUES + t('M43.2 57.4Q43 58.4 43.8 58.8M56.8 57.4Q57 58.4 56.2 58.8', ombre, 1);
    case 6: return JOUES + ROUSSEUR(ombre);
    default: return JOUES;
  }
}

/* une tache de vitiligo : la peau, en plus clair */
function clair(hex) {
  const n = parseInt(hex.slice(1), 16), m = v => Math.round(v + (255 - v) * .42);
  return '#' + [n >> 16, (n >> 8) & 255, n & 255].map(v => m(v).toString(16).padStart(2, '0')).join('');
}

function barbe(a, c) {
  const MOUST = 'M44.5 54.6C46.5 52.6 49 53 50 54C51 53 53.5 52.6 55.5 54.6C53.5 55.8 51.5 55.4 50 54.9C48.5 55.4 46.5 55.8 44.5 54.6Z';
  const COURTE_B = 'M32.5 47C32 58 39 66.5 50 66.5S68 58 67.5 47C66 55 61 60 56 59.6C54 58.2 46 58.2 44 59.6C39 60 34 55 32.5 47Z';
  switch (a.barbe) {
    case 1: return `<path d="${COURTE_B}" fill="${c}" fill-opacity=".32"/>` + `<path d="${MOUST}" fill="${c}" fill-opacity=".32"/>`;
    case 2: return f(COURTE_B, c) + f(MOUST, c);
    case 3: return f('M32.5 47C32 63 40 76.5 50 77.5S68 63 67.5 47C66 55 61 60 56 59.6C54 58.2 46 58.2 44 59.6C39 60 34 55 32.5 47Z', c) + f(MOUST, c);
    case 4: return f(MOUST, c);
    case 5: return f('M45 59.8C45 64 47 66.6 50 66.6S55 64 55 59.8C53 60.8 47 60.8 45 59.8Z', c) + f(MOUST, c);
    case 6: return t('M33 49C34.6 59.6 41 65.8 50 65.8S65.4 59.6 67 49', c, 3);
    default: return '';
  }
}

function bouche(a) {
  switch (a.bouche) {
    case 1: return f('M44 55Q50 63.5 56 55Z', LEVRE) + f('M45.4 55.5H54.6L54.1 57Q50 58.2 45.9 57Z', '#fff');
    case 2: return t('M46 57H54', LEVRE, 2);
    case 3: return `<ellipse cx="50" cy="57.2" rx="2.4" ry="2.9" fill="${LEVRE}"/>`;
    case 4: return t('M45 57Q51 59.6 55.2 55', LEVRE, 2);
    case 5: return f('M42.5 54.6Q50 65 57.5 54.6Z', LEVRE) + f('M44 55.1H56L55.3 56.9Q50 58.4 44.7 56.9Z', '#fff');
    case 6: return f('M44 55Q50 63.5 56 55Z', LEVRE) + f('M47 58.6Q50 63.2 53 58.6Q50 57.6 47 58.6Z', '#E07A7A');
    case 7: return `<path d="M44.6 55.6Q50 60.6 55.4 55.6Z" fill="#fff" stroke="${LEVRE}" stroke-width="1.4" stroke-linejoin="round"/>`;
    case 8: return t('M47.4 57.6Q50 55.6 52.6 57.6', LEVRE, 2);
    case 9: return f('M44.4 55.6Q47.4 54 50 55.2Q52.6 54 55.6 55.6Q53.6 60.6 50 60.6Q46.4 60.6 44.4 55.6Z', '#A4504A')
      + t('M44.8 55.8Q50 57.4 55.2 55.8', '#6E2A26', 1);
    default: return t('M45 56Q50 60.4 55 56', LEVRE, 2);
  }
}

function bijoux(a) {
  switch (a.bijoux) {
    case 1: return rond(32.5, 52.6, 1.9, OR) + rond(67.5, 52.6, 1.9, OR);
    case 2: return rond(32.5, 52.6, 1.9, ARGENT) + rond(67.5, 52.6, 1.9, ARGENT);
    case 3: return sym(s => `<circle cx="${mx(s, 32.6)}" cy="54.6" r="2.7" fill="none" stroke="${OR}" stroke-width="1.2"/>`);
    case 4: return rond(52.4, 51.4, .9, OR);
    case 5: return rond(50, 37.4, 1.3, '#C0392B');
    case 6: return `<path d="M27.6 43.6Q25.2 47 27.2 51.2" fill="none" stroke="#5B8DEF" stroke-width="2.4" stroke-linecap="round"/>`;
    default: return '';
  }
}

function lunettes(a) {
  const cadre = (x, c, w, fond = 'rgba(255,255,255,.18)') => `<circle cx="${x}" cy="47" r="5.6" fill="${fond}" stroke="${c}" stroke-width="${w}"/>`;
  switch (a.lunettes) {
    case 1: return [43.5, 56.5].map(x => cadre(x, ENCRE, 1.7)).join('') + t('M49 46.6Q50 45.8 51 46.6', ENCRE, 1.6);
    case 2: return [37.6, 50.6].map(x => `<rect x="${x}" y="42.6" width="11.8" height="9" rx="2.4" fill="rgba(255,255,255,.18)" stroke="${ENCRE}" stroke-width="1.7"/>`).join('')
      + t('M49.4 46.4H50.6', ENCRE, 1.6);
    case 3: return [37.2, 51].map(x => `<rect x="${x}" y="42.8" width="11.8" height="8.4" rx="3.4" fill="#26242C" stroke="${ENCRE}" stroke-width="1.4"/>`).join('')
      + t('M49 45.6H51', ENCRE, 1.6) + t('M39.4 44.6L42 44.2', 'rgba(255,255,255,.5)', 1);
    case 4: return sym(s => `<path d="M${mx(s, 37.2)} 43.2Q${mx(s, 43.5)} 41.6 ${mx(s, 49)} 44.4Q${mx(s, 48.4)} 51 ${mx(s, 43.4)} 51Q${mx(s, 38.4)} 50.6 ${mx(s, 37.2)} 43.2Z" fill="rgba(255,255,255,.18)" stroke="${ENCRE}" stroke-width="1.7" stroke-linejoin="round"/>`)
      + t('M49 45.2Q50 44.4 51 45.2', ENCRE, 1.6);
    case 5: return [43.5, 56.5].map(x => `<ellipse cx="${x}" cy="47" rx="5.4" ry="4.4" fill="none" stroke="${ENCRE}" stroke-width="1"/>`).join('')
      + t('M48.9 46.6H51.1', ENCRE, 1);
    case 6: return [43.5, 56.5].map(x => cadre(x, '#C9A33C', 1.5)).join('') + t('M49 46.6Q50 45.8 51 46.6', '#C9A33C', 1.4);
    default: return '';
  }
}

function accessoire(a, haut) {
  switch (a.accessoire) {
    case 1: case 2: return lunettes({ lunettes: a.accessoire });
    case 3: return f('M29 38C29 23 39 16.5 50 16.5S71 23 71 38Z', haut) + f('M48 35.5C60 33.5 75 35 81 39.5C71 41.5 59 41 48 40Z', haut)
      + t('M29.5 38H70.5', 'rgba(0,0,0,.18)', 1.4);
    case 4: return f('M30.5 36.5C38 31 62 31 69.5 36.5V41C62 35.5 38 35.5 30.5 41Z', haut);
    case 5: return bijoux({ bijoux: 1 });
    case 6: return f('M29.4 37C29.4 22 39 15.6 50 15.6S70.6 22 70.6 37Z', haut) + `<rect x="28.4" y="33.4" width="43.2" height="6.4" rx="3.2" fill="${haut}"/>`
      + t('M29.4 36.6H70.6', 'rgba(0,0,0,.14)', 1.2) + rond(50, 14.6, 4, haut);
    case 7: return t('M31.4 38Q50 21 68.6 38', haut, 2.6);
    case 8: return `<path d="M58 27L64 23.4V31.6Z" fill="${haut}"/><path d="M70 27L64 23.4V31.6Z" fill="${haut}"/>` + rond(64, 27.4, 1.9, haut);
    case 9: return t('M29.4 46C29 26 38 17.4 50 17.4S71 26 70.6 46', '#2B2B33', 3)
      + `<rect x="25.6" y="41" width="7" height="12.4" rx="3.4" fill="#2B2B33"/><rect x="67.4" y="41" width="7" height="12.4" rx="3.4" fill="#2B2B33"/>`;
    case 10: return f('M30.6 34C31.4 22 40 17.4 50 17.4S68.6 22 69.4 34Z', haut) + f('M23.6 36.4C30 31.2 70 31.2 76.4 36.4C70 40 30 40 23.6 36.4Z', haut)
      + t('M30.4 33.6H69.6', 'rgba(0,0,0,.16)', 1.2);
    case 11: return [[33, 33.6, '#F4A3BC'], [39.4, 27.6, '#F6D365'], [46, 24.6, '#F4A3BC'], [54, 24.6, '#9DD3A8'], [60.6, 27.6, '#F4A3BC'], [67, 33.6, '#F6D365']]
      .map(([x, y, c]) => rond(x, y, 3.3, c) + rond(x, y, 1.1, '#fff')).join('');
    default: return '';
  }
}

/* le haut : le t-shirt d'avant, ou une autre tenue de la même couleur ; ce
   qui passe devant le cou (un col) se dessine après lui */
const CORPS = 'M14 100C16 80 31 72 50 72S84 80 86 100Z';
function corps(a, haut) {
  if (a.tenue === 1) return f('M30 76C28 66 38 61 50 61S72 66 70 76Z', ombreDe(haut)) + f(CORPS, haut);
  if (a.tenue === 6) return f(CORPS, '#F4F1EA') + sym(s => f(`M${mx(s, 14)} 100C${mx(s, 16)} 80 ${mx(s, 31)} 72 ${mx(s, 44)} 72.6L${mx(s, 49)} 100Z`, haut));
  return f(CORPS, haut);
}

function col(a, haut, ombre) {
  switch (a.tenue) {
    case 1: return t('M45.4 76V83M54.6 76V83', '#F4F1EA', 1.2) + rond(45.4, 83.4, .9, '#F4F1EA') + rond(54.6, 83.4, .9, '#F4F1EA');
    case 2: return `<rect x="41.6" y="62" width="16.8" height="13" rx="4" fill="${haut}"/>` + t('M42.6 66.6H57.4M42.6 70.4H57.4', 'rgba(0,0,0,.12)', 1);
    case 3: return sym(s => f(`M${mx(s, 50)} 76.6L${mx(s, 41.4)} 71.4L${mx(s, 43.4)} 79.6Z`, '#fff')) + t('M50 80V86', 'rgba(0,0,0,.18)', 1);
    case 4: return f('M43 72.2L50 82.4L57 72.2Q50 77.5 43 72.2Z', ombre);
    case 5: return `<rect x="38" y="80" width="24" height="10" rx="2" fill="#4E6E9E"/>` + sym(s => `<rect x="${mx(s, 36.4) - (s < 0 ? 4 : 0)}" y="74" width="4" height="12" rx="2" fill="#4E6E9E"/>`)
      + rond(40.6, 81.6, 1, '#E3B342') + rond(59.4, 81.6, 1, '#E3B342');
    case 6: return sym(s => t(`M${mx(s, 44)} 72.6L${mx(s, 47.6)} 86`, 'rgba(0,0,0,.18)', 1.1));
    case 7: return t('M24.6 78.6H39.6M60.4 78.6H75.4M18.6 84H81.4', 'rgba(255,255,255,.45)', 2.4);
    case 8: return sym(s => f(`M${mx(s, 50)} 75.6L${mx(s, 42)} 71L${mx(s, 41.4)} 76.6Z`, ombreDe(haut))) + rond(50, 79.6, .9, ombreDe(haut)) + rond(50, 83, .9, ombreDe(haut));
    default: return '';
  }
}

/* l'ombre d'un tissu : sa couleur, un peu plus sombre */
function ombreDe(hex) {
  const n = parseInt(hex.slice(1), 16), m = v => Math.round(v * .8);
  return '#' + [n >> 16, (n >> 8) & 255, n & 255].map(v => m(v).toString(16).padStart(2, '0')).join('');
}

/* le hijab drape les épaules, par-dessus le haut ; deux plis le disent tissu */
const PLIS = 'M30.6 66.4Q38 76 50 77.2M69.4 66.4Q62 76 50 77.2M27.4 52Q28 61 32.6 66M72.6 52Q72 61 67.4 66';
const DRAPE = 'M31 62C35.4 70.6 42.4 74.6 50 74.6S64.6 70.6 69 62C74.6 66.4 79.4 72.6 81.4 80C72 86.4 28 86.4 18.6 80C20.6 72.6 25.4 66.4 31 62Z';

/* `cadre` : « visage » recadre sur les yeux et la bouche (un choix qui ne se
   voit que de près). */
export function avatarSvg(a, titre = '', cadre = '') {
  const [peau, ombre] = PEAUX[a.peau] || PEAUX[0];
  const cheveux = CHEVEUX[a.cheveux] || CHEVEUX[0], haut = HAUTS[a.haut] || HAUTS[0], hijab = a.coiffure === 20;
  return `<svg class="visage" viewBox="${cadre === 'visage' ? '27 27 46 46' : '12 10 76 76'}"${titre ? ` role="img" aria-label="${titre}"` : ' aria-hidden="true"'}>`
    + derriere(a, cheveux)
    + corps(a, haut)
    + f('M43 60V72Q50 77.5 57 72V60Z', ombre)
    + col(a, haut, ombre)
    + (hijab ? f(DRAPE, cheveux) + t(PLIS, 'rgba(0,0,0,.13)', 1.2) : rond(32.5, 47, 4.2, peau) + rond(67.5, 47, 4.2, peau))
    + `<ellipse cx="50" cy="45" rx="18" ry="20" fill="${peau}"/>`
    + devant(a, cheveux)
    + sourcils(a, poils(a, cheveux))
    + yeux(a)
    + t('M48.8 51.6Q50 52.7 51.2 51.6', ombre, 1.6)
    + details(a, peau, ombre)
    + barbe(a, poils(a, cheveux))
    + bouche(a)
    + bijoux(a)
    + lunettes(a)
    + accessoire(a, haut)
    + '</svg>';
}
