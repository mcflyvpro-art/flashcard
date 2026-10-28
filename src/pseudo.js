/* ══════════ les pseudos (2026-10-27) ══════════
   Tout compte a un pseudo, attribué d'office à sa création et qu'il change
   quand il veut, dans les règles ci-dessous — les mêmes, mot pour mot, que
   la base (`pseudo_motif`, migration 20261027090000) : l'écran prévient
   pendant la frappe, la base tranche. Ce que seule la base sait vérifier :
   qu'aucun autre compte ne l'a déjà (au point et au tiret bas près :
   « lea.martin » et « lea_martin » sont le même pseudo), qu'un pseudo
   quitté reste à son ancien titulaire 30 jours, et deux changements par
   semaine au plus. Un élève d'établissement garde « Prénom NOM » comme nom
   dans sa classe ; son pseudo sert ailleurs (amis, défis).
   Pur, sans dépendance, testé dans test/pseudo.test.js. */

export const MIN = 3, MAX = 20;

/* Ce qui imite l'équipe ou un rôle : réservé quand c'est un mot du pseudo
   (« lea.admin », « mirandola_officiel »), ou son début pour ces quatre-là
   (« folio » reste : c'était le nom, jusqu'au 2026-10-28). */
export const RESERVES = ['admin', 'administrateur', 'administratrice', 'administration', 'moderateur', 'moderatrice',
  'moderation', 'modo', 'folio', 'mirandola', 'support', 'staff', 'equipe', 'team', 'officiel', 'officielle', 'official', 'system',
  'systeme', 'root', 'anthropic', 'claude', 'prof', 'professeur', 'professeure', 'referent', 'referente', 'editeur',
  'proviseur', 'proviseure', 'principal', 'principale', 'directeur', 'directrice', 'securite', 'security', 'aide',
  'help', 'contact', 'service', 'null', 'undefined', 'anonyme', 'inconnu', 'utilisateur', 'compte', 'eleve',
  'enseignant', 'enseignante', 'cpe', 'bot'];
export const PREFIXES = ['folio', 'mirandola', 'admin', 'moderat'];

/* Ce qui ne se dit pas, surtout entre élèves. Deux listes, pour ne pas
   refuser « calcul » à cause de « cul » : les MOTS ne comptent que seuls
   (un mot du pseudo, entre points, tirets bas ou chiffres), les RACINES
   partout dans le pseudo — on n'y met que ce qu'aucun mot honnête ne
   contient. Les chiffres qui imitent des lettres (0, 1, 3, 4, 5, 7) sont
   lus comme ces lettres. */
export const MOTS = ['con', 'conne', 'cons', 'cul', 'culs', 'pute', 'putes', 'bite', 'bites', 'nique', 'niquer',
  'ntm', 'tg', 'pd', 'pede', 'pedes', 'pedo', 'chatte', 'zizi', 'sexe', 'sex', 'viol', 'nazi', 'nazis', 'negre',
  'negro', 'dick', 'cock', 'cunt', 'fag', 'rape', 'porc', 'gouine', 'tapette', 'suce', 'sucer', 'kys', 'tepu'];
export const RACINES = ['connard', 'connasse', 'salope', 'salaud', 'encule', 'batard', 'putain', 'merde', 'fdp',
  'couille', 'branlette', 'branleur', 'penis', 'vagin', 'porn', 'xxx', 'fuck', 'shit', 'bitch', 'nigger', 'nigga',
  'whore', 'slut', 'hitler', 'pedophile', 'violeur', 'suicide', 'terroris', 'pucelle'];

const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't' };
const lire = h => h.replace(/[013457]/g, c => LEET[c]);

/* Ce que le champ garde de la frappe : minuscules, sans accents, un espace
   devient un point, le reste disparaît — 20 caractères au plus. */
export const saisie = v => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/\s+/g, '.').replace(/[^a-z0-9._]/g, '').slice(0, MAX);

/* La clé d'unicité : sans les points ni les tirets bas. */
export const cle = h => String(h || '').toLowerCase().replace(/[._]/g, '');

/* Le verdict de la règle, dans cet ordre (le même que la base) : 'ok', ou
   ce qui ne va pas. */
export function motif(h) {
  h = String(h == null ? '' : h);
  if (h.length < MIN) return 'court';
  if (h.length > MAX) return 'long';
  if (!/^[a-z0-9._]+$/.test(h)) return 'caracteres';
  if (!/^[a-z]/.test(h)) return 'debut';
  if (/[._]$/.test(h)) return 'fin';
  if (/[._]{2}/.test(h)) return 'double';
  const s = lire(h), mots = s.split(/[^a-z]+/).filter(Boolean);
  if (mots.some(m => RESERVES.includes(m)) || PREFIXES.some(p => s.startsWith(p))) return 'reserve';
  if (mots.some(m => MOTS.includes(m))) return 'interdit';
  const serre = s.replace(/[._]/g, '');
  if (RACINES.some(r => serre.includes(r))) return 'interdit';
  return 'ok';
}

export const valide = h => motif(h) === 'ok';

/* Ce que l'écran dit de chaque verdict, ceux de la règle et ceux que seule
   la base rend (`pris`, `meme`, `trop`, et `hors_ligne` côté app). */
export const MESSAGES = {
  court: `Au moins ${MIN} caractères`,
  long: `${MAX} caractères au plus`,
  caracteres: 'Lettres, chiffres, point ou tiret bas',
  debut: 'Commence par une lettre',
  fin: 'Finis par une lettre ou un chiffre',
  double: 'Pas deux signes à la suite',
  reserve: 'Ce pseudo est réservé',
  interdit: 'Ce pseudo n’est pas permis',
  pris: 'Ce pseudo est déjà pris',
  meme: 'C’est déjà ton pseudo',
  trop: 'Deux changements par semaine au plus',
  hors_ligne: 'Il faut être en ligne pour changer de pseudo'
};
export const message = statut => MESSAGES[statut] || 'Pseudo impossible pour l’instant';

/* Un pseudo à proposer : le premier mot du prénom passé à la règle,
   « lecteur » s'il ne la passe pas — jamais l'adresse, qui dit souvent nom
   et prénom. Quatorze caractères au plus, comme `pseudo_neuf` en base, qui
   y ajoute des chiffres s'il est déjà pris (`pseudo_libre` rend cette
   variante libre). */
export function proposer(prenom) {
  const p = String(prenom || '').trim().split(/\s+/)[0].normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9._]/g, '').replace(/^[^a-z]+/, '').replace(/[._]{2,}/g, '.').slice(0, 14).replace(/[._]+$/, '');
  return valide(p) ? p : 'lecteur';
}
