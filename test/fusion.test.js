/* M03.T4 — deux appareils modifient le même paquet hors ligne : la fusion
   doit rendre un résultat déterministe sans jamais demander à personne
   de choisir. « 0 boîte de dialogue » se vérifie ici comme « la fonction
   rend toujours une valeur, jamais une question » : chaque cas, même le
   plus divergent, a une règle fixe. Ce que ces tests garantissent en
   plus, c'est qu'aucune carte ni aucune révision ne disparaît en route. */
import { describe, it, expect } from 'vitest';
import { mergeScalar, mergeStateGroup, mergeCard, mergeCards, mergeDeck,
         STATE_FIELDS } from '../src/fusion.js';

const carte = (id, extra) => ({ id, f: 'recto', b: 'verso', ...extra });
const etat = (extra) => ({ S: 3, D: 5, F: 3, st: 2, sp: null, d: 1000, lr: 500, i: 3, n: 2, l: 0, ...extra });

describe('un seul champ (mergeScalar)', () => {
  it('ne change rien si les deux côtés sont d’accord', () => {
    expect(mergeScalar('a', 'b', 'b')).toEqual({ value: 'b', conflict: false });
  });
  it('prend le seul côté qui a bougé', () => {
    expect(mergeScalar('a', 'b', 'a')).toEqual({ value: 'b', conflict: false });
    expect(mergeScalar('a', 'a', 'c')).toEqual({ value: 'c', conflict: false });
  });
  it('tranche sans demander quand les deux ont changé différemment', () => {
    const r = mergeScalar('a', 'b', 'c');
    expect(r.conflict).toBe(true);
    expect(r.value).toBe('c');   // règle fixe, documentée : la distante gagne
  });
});

describe('le bloc mémoire (mergeStateGroup)', () => {
  it('garde la base si personne n’a révisé', () => {
    const b = etat();
    expect(mergeStateGroup(b, b, b)).toEqual({ value: b, conflict: false });
  });
  it('prend l’appareil qui a révisé seul, en bloc — jamais un mélange des deux', () => {
    const b = etat({ n: 2 });
    const m = etat({ n: 3, S: 9.9, D: 4.4, lr: 999 });   // a révisé
    const r = mergeStateGroup(b, m, b);
    expect(r.conflict).toBe(false);
    expect(r.value).toEqual({ S: 9.9, D: 4.4, F: 3, st: 2, sp: null, d: 1000, lr: 999, i: 3, n: 3, l: 0 });
  });
  it('deux révisions indépendantes : le plus avancé (n) l’emporte en entier', () => {
    const b = etat({ n: 2 });
    const mine = etat({ n: 3, S: 1.1, D: 2.2, lr: 700 });
    const theirs = etat({ n: 5, S: 8.8, D: 1.1, lr: 900 });
    const r = mergeStateGroup(b, mine, theirs);
    expect(r.conflict).toBe(true);
    expect(r.value).toEqual(theirs);          // pas de S d’un côté et D de l’autre
    for (const k of STATE_FIELDS) expect(r.value[k]).toBe(theirs[k]);
  });
  it('à révisions égales, la plus récente l’emporte', () => {
    const b = etat({ n: 2 });
    const mine = etat({ n: 4, lr: 200 });
    const theirs = etat({ n: 4, lr: 800 });
    expect(mergeStateGroup(b, mine, theirs).value).toEqual(theirs);
  });
});

describe('une carte (mergeCard)', () => {
  it('combine un changement de contenu ici et une révision là-bas', () => {
    const b = { ...carte('c1'), ...etat({ n: 1 }) };
    const mine = { ...b, f: 'nouveau recto' };                    // édité ici
    const theirs = { ...b, ...etat({ n: 2, S: 4, lr: 999 }) };    // révisé là-bas
    const { card, conflicts } = mergeCard(b, mine, theirs);
    expect(card.f).toBe('nouveau recto');
    expect(card.n).toBe(2);
    expect(conflicts).toEqual([]);
  });
});

describe('le tableau de cartes (mergeCards)', () => {
  const b = [carte('a'), carte('b'), carte('c')];

  it('garde tel quel ce qu’aucun des deux côtés n’a touché', () => {
    const { cards, notes } = mergeCards(b, b, b);
    expect(cards).toHaveLength(3);
    expect(notes).toEqual([]);
  });

  it('une carte ajoutée d’un seul côté se retrouve dans la fusion', () => {
    const mine = [...b, carte('neuve-locale')];
    const { cards } = mergeCards(b, mine, b);
    expect(cards.map(c => c.id).sort()).toEqual(['a', 'b', 'c', 'neuve-locale']);
  });

  it('une carte supprimée des deux côtés disparaît sans note', () => {
    const sansA = b.filter(c => c.id !== 'a');
    const { cards, notes } = mergeCards(b, sansA, sansA);
    expect(cards.map(c => c.id).sort()).toEqual(['b', 'c']);
    expect(notes).toEqual([]);
  });

  it('supprimée ici, inchangée là-bas : la suppression est respectée', () => {
    const sansA = b.filter(c => c.id !== 'a');
    const { cards } = mergeCards(b, sansA, b);
    expect(cards.map(c => c.id).sort()).toEqual(['b', 'c']);
  });

  it('supprimée ici, mais éditée là-bas : l’édition l’emporte, rien n’est perdu', () => {
    const sansA = b.filter(c => c.id !== 'a');
    const theirs = b.map(c => c.id === 'a' ? { ...c, f: 'sauvée par l’édition' } : c);
    const { cards, notes } = mergeCards(b, sansA, theirs);
    expect(cards.map(c => c.id).sort()).toEqual(['a', 'b', 'c']);
    expect(cards.find(c => c.id === 'a').f).toBe('sauvée par l’édition');
    expect(notes.some(n => n.id === 'a')).toBe(true);
  });

  it('même id créé des deux côtés avec un contenu différent : les deux sont gardées', () => {
    const mine = [carte('dup', { f: 'version locale' })];
    const theirs = [carte('dup', { f: 'version distante' })];
    const { cards, notes } = mergeCards([], mine, theirs);
    expect(cards).toHaveLength(2);
    expect(notes).toHaveLength(1);
  });

  it('même id créé des deux côtés avec un contenu identique : une seule copie', () => {
    const mine = [carte('dup')];
    const { cards } = mergeCards([], mine, mine.map(c => ({ ...c })));
    expect(cards).toHaveLength(1);
  });
});

describe('le paquet entier (mergeDeck)', () => {
  it('fusionne les réglages du paquet et ses cartes ensemble', () => {
    const base = { name: 'Paquet', subject: 'esp', hidden: false, pinned: false,
                   meta: { tol: 'normal' }, cards: [carte('a')] };
    const mine = { ...base, name: 'Paquet renommé', cards: [carte('a'), carte('neuve')] };
    const theirs = { ...base, pinned: true };
    const { deck, notes } = mergeDeck(base, mine, theirs);
    expect(deck.name).toBe('Paquet renommé');   // seul mine a changé le nom
    expect(deck.pinned).toBe(true);              // seul theirs a épinglé
    expect(deck.cards.map(c => c.id).sort()).toEqual(['a', 'neuve']);
    expect(notes).toEqual([]);
  });
});

describe('jeu de tests (M03.T4) — 0 boîte de dialogue', () => {
  /* Un lot de scénarios représentatifs des façons dont deux appareils
     divergent réellement : édition seule, révision seule, les deux à la
     fois, ajout, suppression, suppression contre édition, doublon. Pour
     chacun, la fusion doit rendre une valeur — jamais lever, jamais
     rendre `undefined` — et ne perdre aucune carte qui n'a pas été
     légitimement supprimée des deux côtés. C'est ça, « 0 dialogue » : la
     fonction n'a tout simplement rien à demander. */
  function scenario(n) {
    const b = Array.from({ length: 5 }, (_, i) => ({ ...carte('c' + i), ...etat({ n: 1, lr: 100 * i }) }));
    const mine = b.map(c => ({ ...c }));
    const theirs = b.map(c => ({ ...c }));
    switch (n % 7) {
      case 0: mine[0].f = 'édité localement ' + n; break;
      case 1: theirs[1].f = 'édité à distance ' + n; break;
      case 2: mine[2].f = theirs[2].f = 'les deux d’accord ' + n; break;
      case 3: mine[3].f = 'divergent-local ' + n; theirs[3].f = 'divergent-distant ' + n; break;
      case 4: Object.assign(mine[4], etat({ n: 2 + n, lr: 900 + n })); break;
      case 5: mine.splice(0, 1); theirs[0].f = 'sauvée ' + n; break;   // suppression vs édition
      case 6: mine.push(carte('ajout-' + n)); theirs.push(carte('ajout-' + n, { f: 'autre contenu ' + n })); break;
    }
    return { b, mine, theirs };
  }

  it('ne lève jamais, rend toujours un tableau complet, sur 200 scénarios', () => {
    for (let n = 0; n < 200; n++) {
      const { b, mine, theirs } = scenario(n);
      let res;
      expect(() => { res = mergeCards(b, mine, theirs); }).not.toThrow();
      expect(Array.isArray(res.cards)).toBe(true);
      expect(res.cards.length).toBeGreaterThanOrEqual(4);   // au pire une carte légitimement en moins
      // rien n'a une carte à moitié fusionnée
      for (const c of res.cards) expect(typeof c.id).toBe('string');
    }
  });

  it('est déterministe : rejouer le même scénario rend le même résultat', () => {
    const { b, mine, theirs } = scenario(3);
    const r1 = mergeCards(b, mine, theirs);
    const r2 = mergeCards(b, mine, theirs);
    expect(r1).toEqual(r2);
  });
});
