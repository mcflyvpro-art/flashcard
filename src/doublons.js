/* ══════════ doublons ══════════
   M04.T4 : deux cartes d'un même paquet dont le recto ET le verso se
   lisent pareil (`norm`, src/normaliser.js — casse, espaces, ponctuation
   finale mis de côté) sont la même carte écrite deux fois : on révise deux
   fois la même chose, et les statistiques comptent double.
   Pas entre deux paquets : le même mot en anglais et en espagnol, ou la
   même définition en SVT et en physique, c'est voulu. Pas non plus sur le
   recto seul : deux sens d'un même mot ont le même recto et deux versos
   (c'est le cas que markDups, à l'import, signale sans jeter).

   Laquelle garder : celle qui a le plus appris — plus de réussites (`n`),
   puis la révision la plus récente (`lr`), puis celle qui a une mémoire,
   puis la première du paquet. On ne fusionne pas les états FSRS de deux
   cartes : il n'existe pas de mémoire « moyenne » qui ait un sens pour le
   moteur. Les rechutes (`l`), elles, s'additionnent — c'est un compteur
   d'erreurs réelles, qui sert au tri « ratées ».

   Pur : ni DOM, ni réseau. Testé dans test/doublons.test.js. */
import { norm } from './normaliser.js';

export const dupKey = c => norm(c.f || '') + '\u0000' + norm(c.b || '');

/* Rend vrai si `a` a plus appris que `b` (voir le bandeau). */
function ahead(a, b) {
  if ((a.n || 0) !== (b.n || 0)) return (a.n || 0) > (b.n || 0);
  if ((a.lr || 0) !== (b.lr || 0)) return (a.lr || 0) > (b.lr || 0);
  return a.S != null && b.S == null;
}

/* Les groupes de doublons d'un paquet, chacun dans l'ordre du paquet —
   sans rien modifier, pour l'état des lieux. */
export function duplicateGroups(cards) {
  const by = new Map();
  for (const c of cards) {
    const k = dupKey(c);
    if (!by.has(k)) by.set(k, []);
    by.get(k).push(c);
  }
  return [...by.values()].filter(g => g.length > 1);
}

/* Combien de cartes un passage retirerait, sur toute la bibliothèque. */
export function countDuplicates(decks) {
  let n = 0;
  for (const d of decks) for (const g of duplicateGroups(d.cards)) n += g.length - 1;
  return n;
}

/* Dédoublonne un paquet en place : garde une carte par groupe (la plus
   avancée), additionne les rechutes, garde l'ordre du paquet. Rend le
   nombre de cartes retirées. */
export function dedupeDeck(d) {
  let removed = 0;
  const gone = new Set();
  for (const g of duplicateGroups(d.cards)) {
    let keep = g[0];
    for (const c of g) if (ahead(c, keep)) keep = c;
    const lapses = g.reduce((s, c) => s + (c.l || 0), 0);
    if (lapses) keep.l = lapses;
    for (const c of g) if (c !== keep) { gone.add(c); removed++; }
  }
  if (removed) d.cards = d.cards.filter(c => !gone.has(c));
  return removed;
}

/* Toute la bibliothèque : rend le total retiré et les paquets touchés —
   à l'appelant de les sauvegarder (même partage des rôles que
   src/reparation.js : ce module ne connaît ni saveDeck ni la file). */
export function dedupeLibrary(decks) {
  let removed = 0;
  const touched = [];
  for (const d of decks) {
    const r = dedupeDeck(d);
    if (r) { removed += r; touched.push(d); }
  }
  return { removed, touched };
}
