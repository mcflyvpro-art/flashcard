/* Les avatars (2026-10-25) — module pur, sans aucune dépendance, testé dans
   test/avatar.test.js. Un visage dessiné, composé de sept traits que chacun
   choisit (peau, coiffure, couleur des cheveux, yeux, bouche, accessoire,
   haut) sur le fond de sa couleur de jeton. Il remplace les émojis : un
   émoji s'affiche différemment d'un téléphone à l'autre, et ne se
   personnalise pas.

   Rien n'est stocké de plus en base : un avatar s'écrit dans la clé
   `profiles.figure` déjà là (`^[a-z]{2,16}$`), « av » suivi d'une lettre par
   trait (« avbcaedab ») — mon_jeton() et visuels() la transportent telle
   quelle. Les anciennes figures (« renard », « hibou »…) donnent un avatar
   tiré de leur nom : le même partout, jusqu'à ce que la personne en choisisse
   un. Jamais de photo, jamais de texte libre : des listes fermées. */

const PEAUX = [['#FCE0CC', '#EFC2A6'], ['#F5C9A6', '#E2AB85'], ['#E3A97F', '#CB8E63'],
  ['#C98B5E', '#AF7347'], ['#9E6743', '#855234'], ['#6B4430', '#553323']];
const CHEVEUX = ['#24201D', '#4B2F20', '#7B5131', '#DDAA52', '#BD5A2C', '#BDB7B0', '#4C6FD8', '#E58FB3'];
const HAUTS = ['#F1ECE1', '#34343E', '#E2A53B', '#5B8DEF', '#E86B5C', '#4FA37A', '#9D80DB', '#F0B3C4'];
const ENCRE = '#2A2421', LEVRE = '#8C3B33';

/* L'ordre des traits dans la clé, et le nom de chaque choix (pour les
   lecteurs d'écran et les tests). */
export const TRAITS = {
  peau: ['très claire', 'claire', 'mate', 'hâlée', 'brune', 'foncée'],
  coiffure: ['rasée', 'courte', 'mèche', 'bouclée', 'longue', 'carré', 'chignon', 'queue', 'afro', 'tresses'],
  cheveux: ['noirs', 'bruns', 'châtains', 'blonds', 'roux', 'gris', 'bleus', 'roses'],
  yeux: ['points', 'ronds', 'rieurs', 'clin d’œil', 'cils'],
  bouche: ['sourire', 'rire', 'calme', 'surprise', 'malice'],
  accessoire: ['aucun', 'lunettes rondes', 'lunettes carrées', 'casquette', 'bandeau', 'boucles d’oreilles'],
  haut: ['crème', 'anthracite', 'moutarde', 'bleu', 'corail', 'vert', 'lilas', 'rose']
};
export const ORDRE = Object.keys(TRAITS);
const LETTRES = 'abcdefghijklmnopqrstuvwxyz';

export const estAvatar = k => typeof k === 'string' && /^av[a-z]{7}$/.test(k);

export function ecrireAvatar(a) {
  return 'av' + ORDRE.map(t => LETTRES[((a[t] | 0) % TRAITS[t].length + TRAITS[t].length) % TRAITS[t].length]).join('');
}

export function lireAvatar(k) {
  if (!estAvatar(k)) return null;
  return Object.fromEntries(ORDRE.map((t, i) => [t, LETTRES.indexOf(k[i + 2]) % TRAITS[t].length]));
}

/* Le même avatar pour la même graine, sur tous les appareils (FNV-1a). */
export function avatarDe(graine) {
  let h = 0x811c9dc5;
  for (const c of String(graine || '')) { h ^= c.codePointAt(0); h = Math.imul(h, 0x01000193); }
  const a = {};
  for (const t of ORDRE) { a[t] = (h >>> 0) % TRAITS[t].length; h = Math.imul(h ^ (h >>> 13), 0x5bd1e995); }
  return a;
}

/* L'avatar d'une clé de figure : le sien s'il en a choisi un, celui que tire
   le nom d'une ancienne figure sinon, rien sans figure. */
export const avatarDeCle = k => (!k ? null : lireAvatar(k) || avatarDe('figure:' + k));

/* ---------- le dessin (viewBox 100 × 100, recadré en rond par l'écran) ---------- */
const f = (d, c) => `<path d="${d}" fill="${c}"/>`;
const t = (d, c, w = 2) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const rond = (x, y, r, c) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`;

// [derrière la tête, devant] pour chaque coiffure
const COIFFURES = [
  ['', 'M31.5 44C31 30 39 24 50 24S69 30 68.5 44C66 37 60 33 50 33S34 37 31.5 44Z'],
  ['', 'M30 45C27 28 38 20 51 20S73 28 70 45C69 39 66 35 62 33C55 36 44 36 36 34C33 37 31 40 30 45Z'],
  ['', 'M30 46C27 27 40 19 52 20S73 30 70 46C68 38 64 33 58 31C50 38 40 40 32 40C31 42 30.5 44 30 46Z'],
  ['', null],
  ['M29 44C27 24 39 17 50 17S73 24 71 44L73 80C65 84 35 84 27 80Z', 'M30 46C29 28 39 21 50 21S71 28 70 46C67 36 58 30 50 30S33 36 30 46Z'],
  ['M28 46C26 25 39 18 50 18S74 25 72 46L72 62C66 66 34 66 28 62Z', 'M31 41C31 26 40 21 50 21S69 26 69 41C62 38 38 38 31 41Z'],
  ['', 'M31 45C30 29 39 23 50 23S70 29 69 45C66 36 59 32 50 32S34 36 31 45Z'],
  ['M65 29C80 33 83 52 77 67C75 57 71 47 63 41Z', 'M30 45C27 28 38 20 51 20S73 28 70 45C69 39 66 35 62 33C55 36 44 36 36 34C33 37 31 40 30 45Z'],
  ['', 'M31 41C33 30 41 26 50 26S67 30 69 41C62 36 38 36 31 41Z'],
  ['', 'M30 46C29 28 39 21 50 21S71 28 70 46C67 36 58 30 50 30S33 36 30 46Z']
];

function derriere(a, c) {
  if (a.coiffure === 3) return '';
  if (a.coiffure === 6) return rond(50, 19, 9, c);
  if (a.coiffure === 8) return rond(50, 40, 27, c);
  if (a.coiffure === 9) {
    return `<rect x="24.5" y="42" width="8.5" height="36" rx="4.2" fill="${c}"/><rect x="67" y="42" width="8.5" height="36" rx="4.2" fill="${c}"/>`
      + `<rect x="24" y="70" width="9.5" height="3" rx="1.5" fill="${HAUTS[(a.haut + 3) % HAUTS.length]}"/>`
      + `<rect x="66.5" y="70" width="9.5" height="3" rx="1.5" fill="${HAUTS[(a.haut + 3) % HAUTS.length]}"/>`;
  }
  return COIFFURES[a.coiffure][0] ? f(COIFFURES[a.coiffure][0], c) : '';
}

function devant(a, c) {
  if (a.coiffure === 3) {
    return [[33, 37, 7.5], [40, 28.5, 8.5], [50, 25.5, 9], [60, 28.5, 8.5], [67, 37, 7.5], [31, 45, 5], [69, 45, 5]]
      .map(([x, y, r]) => rond(x, y, r, c)).join('');
  }
  return f(COIFFURES[a.coiffure][1], c);
}

function yeux(a) {
  const pt = (x) => rond(x, 47, 2.3, ENCRE);
  const arc = (x) => t(`M${x - 3} 48Q${x} 44.6 ${x + 3} 48`, ENCRE, 2);
  switch (a.yeux) {
    case 1: return [43.5, 56.5].map(x => `<ellipse cx="${x}" cy="47" rx="3.4" ry="3.7" fill="#fff"/>${rond(x + .3, 47.4, 2, ENCRE)}${rond(x + 1, 46.4, .7, '#fff')}`).join('');
    case 2: return arc(43.5) + arc(56.5);
    case 3: return pt(43.5) + arc(56.5);
    case 4: return pt(43.5) + pt(56.5) + t('M40.6 45.2L39.4 44M46.4 45.2L47.6 44M53.6 45.2L52.4 44M59.4 45.2L60.6 44', ENCRE, 1.3);
    default: return pt(43.5) + pt(56.5);
  }
}

function bouche(a) {
  switch (a.bouche) {
    case 1: return f('M44 55Q50 63.5 56 55Z', LEVRE) + f('M45.4 55.5H54.6L54.1 57Q50 58.2 45.9 57Z', '#fff');
    case 2: return t('M46 57H54', LEVRE, 2);
    case 3: return `<ellipse cx="50" cy="57.2" rx="2.4" ry="2.9" fill="${LEVRE}"/>`;
    case 4: return t('M45 57Q51 59.6 55.2 55', LEVRE, 2);
    default: return t('M45 56Q50 60.4 55 56', LEVRE, 2);
  }
}

function accessoire(a, haut) {
  switch (a.accessoire) {
    case 1: return [43.5, 56.5].map(x => `<circle cx="${x}" cy="47" r="5.6" fill="rgba(255,255,255,.18)" stroke="${ENCRE}" stroke-width="1.7"/>`).join('')
      + t('M49 46.6Q50 45.8 51 46.6', ENCRE, 1.6);
    case 2: return [37.6, 50.6].map(x => `<rect x="${x}" y="42.6" width="11.8" height="9" rx="2.4" fill="rgba(255,255,255,.18)" stroke="${ENCRE}" stroke-width="1.7"/>`).join('')
      + t('M49.4 46.4H50.6', ENCRE, 1.6);
    case 3: return f('M29 38C29 23 39 16.5 50 16.5S71 23 71 38Z', haut) + f('M48 35.5C60 33.5 75 35 81 39.5C71 41.5 59 41 48 40Z', haut)
      + t('M29.5 38H70.5', 'rgba(0,0,0,.18)', 1.4);
    case 4: return f('M30.5 36.5C38 31 62 31 69.5 36.5V41C62 35.5 38 35.5 30.5 41Z', haut);
    case 5: return rond(32.5, 52.6, 1.9, '#E3B342') + rond(67.5, 52.6, 1.9, '#E3B342');
    default: return '';
  }
}

export function avatarSvg(a, titre = '') {
  const [peau, ombre] = PEAUX[a.peau] || PEAUX[0];
  const cheveux = CHEVEUX[a.cheveux] || CHEVEUX[0], haut = HAUTS[a.haut] || HAUTS[0];
  return `<svg class="visage" viewBox="12 10 76 76"${titre ? ` role="img" aria-label="${titre}"` : ' aria-hidden="true"'}>`
    + derriere(a, cheveux)
    + f('M14 100C16 80 31 72 50 72S84 80 86 100Z', haut)
    + f('M43 60V72Q50 77.5 57 72V60Z', ombre)
    + rond(32.5, 47, 4.2, peau) + rond(67.5, 47, 4.2, peau)
    + `<ellipse cx="50" cy="45" rx="18" ry="20" fill="${peau}"/>`
    + devant(a, cheveux)
    + t('M40.4 41Q43.5 39.4 46.6 41M53.4 41Q56.5 39.4 59.6 41', a.cheveux === 5 ? '#8E877F' : cheveux, 1.8)
    + yeux(a)
    + t('M48.8 51.6Q50 52.7 51.2 51.6', ombre, 1.6)
    + rond(38.6, 53.2, 3, 'rgba(232,110,110,.22)') + rond(61.4, 53.2, 3, 'rgba(232,110,110,.22)')
    + bouche(a)
    + accessoire(a, haut)
    + '</svg>';
}
