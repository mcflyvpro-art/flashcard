/* ══════════ invariants de carte ══════════
   Ce que doit toujours être vrai d'une carte, pour que le moteur FSRS
   (src/fsrs.js) et la file de révision (src/file.js) puissent lui faire
   confiance sans vérification défensive éparpillée partout où une carte
   est lue. M04 : cette liste sert à la fois de documentation exécutable
   (elle dit noir sur blanc ce qu'est une carte saine), à l'écran
   « Vérifier ma bibliothèque » (M04.T2, qui détecte et répare) et à la
   contrainte CHECK posée en base (M04.T3, sur les champs qu'une requête
   SQL peut voir).

   Une carte réelle peut violer ces règles : une fiche d'avant FSRS n'a
   pas encore de stabilité tant que `fsrsSeed()` (src/ui/carte-media.js)
   ne l'a pas migrée, un import malformé peut arriver sans recto. C'est
   attendu — le rôle de ce module est de les détecter, pas de prétendre
   qu'elles n'existent pas.

   `null` et `undefined` comptent tous deux pour « absent » (`== null`),
   comme partout ailleurs dans le noyau (`fsrsPlan`, `isDue`...) : une
   valeur remise à zéro par `delete c.sp` et une valeur jamais posée
   doivent être traitées pareil.

   Pur : ni DOM, ni réseau, ni almanach — une carte en argument, un
   verdict en retour. Testé dans test/invariants.test.js (M04.T1). */
import { S_MIN, S_MAX, D_MIN, D_MAX } from './fsrs.js';

const absent = v => v == null;
const numberIn = (v, lo, hi) => typeof v === 'number' && v >= lo && v <= hi;
const nonNegInt = v => Number.isInteger(v) && v >= 0;

/* Chaque règle porte un code court (repris tel quel par l'écran de
   réparation et par les tests) et un intitulé en français qui explique
   ce qui ne va pas, pour un futur rapport lisible sans traduire les
   codes. */
export const CARD_INVARIANTS = [
  { code: 'id', label: 'a un identifiant',
    test: c => typeof c.id === 'string' && c.id.length > 0 },

  { code: 'front', label: 'a un recto',
    test: c => typeof c.f === 'string' && c.f.trim().length > 0 },

  { code: 'back', label: 'a un verso',
    test: c => typeof c.b === 'string' && c.b.trim().length > 0 },

  { code: 'state', label: 'état d’apprentissage valide (1, 2, 3, ou absent si neuve)',
    test: c => absent(c.st) || c.st === 1 || c.st === 2 || c.st === 3 },

  { code: 'stability', label: `stabilité entre ${S_MIN} et ${S_MAX} jours`,
    test: c => absent(c.S) || numberIn(c.S, S_MIN, S_MAX) },

  { code: 'difficulty', label: `difficulté entre ${D_MIN} et ${D_MAX}`,
    test: c => absent(c.D) || numberIn(c.D, D_MIN, D_MAX) },

  /* F (seconde trace, M06 FSRS-7) vit dans les mêmes bornes que S : c'est
     une stabilité elle aussi, juste tenue par une courbe d'oubli séparée. */
  { code: 'trace', label: `seconde trace mémoire entre ${S_MIN} et ${S_MAX}`,
    test: c => absent(c.F) || numberIn(c.F, S_MIN, S_MAX) },

  /* fsrsSeed() (src/ui/carte-media.js) migre justement ce cas : une
     fiche d'avant FSRS porte un compteur de révisions sans mémoire
     encore calculée. Une vraie fiche FSRS ne devrait jamais s'y trouver. */
  { code: 'reviewed-has-memory', label: 'une fiche déjà révisée porte sa stabilité et sa difficulté',
    test: c => !(c.n > 0) || (!absent(c.S) && !absent(c.D)) },

  { code: 'new-has-no-memory', label: 'une fiche jamais révisée ne porte ni mémoire ni dernière révision',
    test: c => (c.n > 0) || (absent(c.S) && absent(c.D) && absent(c.lr)) },

  /* L'échéance peut être dans le passé (une carte en retard n'a rien
     d'anormal) — ce qui ne doit jamais arriver, c'est qu'elle précède la
     révision qui l'a posée. */
  { code: 'due-after-review', label: 'l’échéance ne précède jamais la dernière révision',
    test: c => absent(c.d) || absent(c.lr) || c.d >= c.lr },

  /* sp (palier en cours) n'a de sens que pendant apprentissage ou
     rechute (st 1 ou 3) ; une fiche en révision (st 2) n'en porte plus,
     voir fsrsPlan() et fsrsSeed() qui le suppriment explicitement. */
  { code: 'step-coherent', label: 'le palier d’apprentissage n’existe que pendant apprentissage ou rechute',
    test: c => (c.st === 1 || c.st === 3) ? (Number.isInteger(c.sp) && c.sp >= 0) : absent(c.sp) },

  /* Une rechute est elle-même comptée comme une révision (M03.T2, le
     journal) : il ne peut donc jamais y en avoir plus que de révisions. */
  { code: 'counts', label: 'révisions et rechutes sont des entiers positifs, rechutes ≤ révisions',
    test: c => nonNegInt(c.n || 0) && nonNegInt(c.l || 0) && (c.l || 0) <= (c.n || 0) }
];

/* Les codes des règles violées par une carte, dans l'ordre de la liste
   ci-dessus — un tableau vide veut dire une carte saine. */
export function cardIssues(c) {
  return CARD_INVARIANTS.filter(inv => !inv.test(c)).map(inv => inv.code);
}
