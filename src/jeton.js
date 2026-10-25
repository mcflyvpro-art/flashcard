/* Les jetons d'identité (2026-10-25) — module pur, testé dans
   test/jeton.test.js. Un jeton, c'est le petit visuel qui représente une
   personne, une classe ou un club partout dans l'app : le même d'un écran à
   l'autre, lisible, et qui ne raconte jamais rien de faux.

   L'ancien sigle de classe abrégeait le nom (« CPGE ECP1 » donnait « CE1 »,
   qu'on lit comme une classe de primaire) : plus aucun texte n'est inventé.
   Une classe ou un club montre un emblème (une icône), une personne ses
   initiales ou l'avatar qu'elle s'est composé ; le nom complet est toujours
   écrit à côté. Chacun choisit dans des listes fermées — jamais de photo
   (des élèves mineurs, rien à modérer), jamais de texte libre — et, tant
   qu'il n'a rien choisi, son identifiant tire un jeton stable.

   La base ne connaît que des clés (`^[a-z]{2,16}$`) et un rang de couleur
   (0–11) : c'est ici qu'ils prennent un sens. Depuis le 2026-10-25, la
   figure d'une personne est un avatar dessiné (src/avatar.js) et non plus un
   émoji ; les anciennes clés donnent un avatar tiré de leur nom. */
import { avatarDeCle } from './avatar.js';

// Douze couleurs sombres et sourdes, distinctes deux à deux : chacune garde un
// contraste d'au moins 4,5:1 avec du blanc (WCAG AA), vérifié par les tests.
export const COULEURS = ['#2F5D8A', '#3F7D55', '#8A3F6B', '#A8483C', '#9A6512', '#3E6E6E',
  '#5E4E8A', '#7A4B34', '#2E7A86', '#6B7A2E', '#B0475F', '#3B4A5C'];

// Emblème d'une classe ou d'un club : clé → nom de l'icône dans src/icones.js.
export const EMBLEMES = {
  livre: 'book', flamme: 'flame', trophee: 'trophy', cible: 'target', cerveau: 'brain',
  etincelle: 'spark', ampoule: 'bulb', fusee: 'rocket', couronne: 'crown', eclair: 'bolt',
  etoile: 'star', chouette: 'owl', globe: 'globe', fiole: 'flask', musique: 'music',
  palette: 'palette', feuille: 'leaf', coeur: 'heart', atome: 'atom', sigma: 'sigma'
};

/* Le même nombre pour le même identifiant, sur tous les appareils : c'est
   ce qui rend un jeton par défaut stable sans rien stocker. */
export function hachage(id) {
  let h = 0x811c9dc5;                                   // FNV-1a, puis un brassage final (murmur3)
  for (const c of String(id || '')) { h ^= c.codePointAt(0); h = Math.imul(h, 0x01000193); }
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return h >>> 0;
}

const rangValide = t => t !== null && t !== '' && Number.isInteger(+t) && +t >= 0 && +t < COULEURS.length;

// rang de couleur choisi s'il est valide, sinon celui que tire l'identifiant
export const rangCouleur = (id, t) => (rangValide(t) ? +t : hachage(id) % COULEURS.length);
export const couleurDe = (id, t) => COULEURS[rangCouleur(id, t)];
export const teinte = t => COULEURS[rangValide(t) ? +t : 0];

export const emblemeValide = k => Object.prototype.hasOwnProperty.call(EMBLEMES, k);
// une clé de figure telle que la base l'accepte (un avatar, ou une figure d'avant)
export const figureValide = k => typeof k === 'string' && /^[a-z]{2,16}$/.test(k);
export const embleme = k => (emblemeValide(k) ? k : 'livre');

// emblème choisi, sinon celui que tire l'identifiant (un autre nombre que la
// couleur, pour que deux classes de même couleur n'aient pas aussi la même icône)
export function emblemeDe(id, k) {
  if (emblemeValide(k)) return k;
  const cles = Object.keys(EMBLEMES);
  return cles[Math.floor(hachage(id) / COULEURS.length) % cles.length];
}

/* Les initiales d'une personne, tirées du nom écrit à côté du jeton : la
   première lettre du premier mot et du dernier (« Léa Martin » → « LM »,
   « Jean de La Fontaine » → « JF », « ines.k » → « IK », « @tom » → « T »).
   Ni chiffre ni symbole en tête de mot : seules les lettres comptent, pour
   qu'un pseudo comme « 2tom » ne fasse pas croire à un rang. */
export function initiales(nom) {
  const mots = String(nom || '').normalize('NFC').split(/[^\p{L}\p{N}]+/u)
    .map(m => m.replace(/^[^\p{L}]+/u, '')).filter(Boolean);
  if (!mots.length) return '?';
  const a = mots[0][0], b = mots.length > 1 ? mots[mots.length - 1][0] : '';
  return (a + b).toLocaleUpperCase('fr');
}

/* Ce qu'il faut pour dessiner le jeton d'une personne : `v` est ce qu'elle a
   choisi ({ figure, teinte }), absent tant qu'on ne le sait pas. Sa figure
   est un avatar (src/avatar.js) ; sans figure, ses initiales. */
export function jetonPersonne(id, nom, v) {
  const f = v && figureValide(v.figure) ? v.figure : null;
  return { couleur: couleurDe(id, v && v.teinte), avatar: avatarDeCle(f), texte: initiales(nom) };
}

// … et celui d'une classe ou d'un club ({ embleme, teinte })
export function jetonGroupe(id, v) {
  return { couleur: couleurDe(id, v && v.teinte), embleme: emblemeDe(id, v && v.embleme) };
}

/* Contraste WCAG entre deux couleurs « #RRGGBB » : de 1 (aucun) à 21. */
export function contraste(a, b) {
  const lum = h => {
    const [r, g, bl] = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255)
      .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const x = lum(a), y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
