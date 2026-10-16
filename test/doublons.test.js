/* M04.T4 — déduplication (src/doublons.js) : 0 doublon après passage,
   sans jamais perdre la carte qui a le plus appris. */
import { describe, it, expect } from 'vitest';
import { countDuplicates, dedupeDeck, dedupeLibrary, dupKey, duplicateGroups } from '../src/doublons.js';
import { cardIssues } from '../src/invariants.js';

const carte = (id, f, b, extra = {}) => ({ id, f, b, ...extra });

describe('ce qui est un doublon', () => {
  it('même recto et même verso, à la casse, aux espaces et à la ponctuation finale près', () => {
    expect(dupKey(carte('a', 'Bonjour ?', 'Hello')))
      .toBe(dupKey(carte('b', '  bonjour', 'hello.')));
    expect(dupKey(carte('a', 'l’arbre', 'tree'))).toBe(dupKey(carte('b', "l'arbre", 'tree')));
  });
  it('même recto mais verso différent : deux sens d’un mot, pas un doublon', () => {
    expect(duplicateGroups([carte('a', 'bank', 'banque'), carte('b', 'bank', 'rive')])).toEqual([]);
  });
  it('entre deux paquets : pas un doublon (le même mot dans deux matières est voulu)', () => {
    const decks = [{ id: 'd1', cards: [carte('a', 'x', 'y')] }, { id: 'd2', cards: [carte('b', 'x', 'y')] }];
    expect(countDuplicates(decks)).toBe(0);
  });
});

describe('laquelle on garde', () => {
  it('la plus avancée (plus de réussites), même si elle vient après', () => {
    const d = { cards: [carte('neuve', 'q', 'r'), carte('apprise', 'q', 'r', { n: 4, S: 12, D: 5, lr: 1000 })] };
    expect(dedupeDeck(d)).toBe(1);
    expect(d.cards.map(c => c.id)).toEqual(['apprise']);
  });
  it('à réussites égales, la révision la plus récente', () => {
    const d = { cards: [carte('vieille', 'q', 'r', { n: 2, lr: 1000, S: 3, D: 5 }), carte('recente', 'q', 'r', { n: 2, lr: 9000, S: 3, D: 5 })] };
    dedupeDeck(d);
    expect(d.cards.map(c => c.id)).toEqual(['recente']);
  });
  it('à égalité parfaite, la première du paquet (résultat déterministe)', () => {
    const d = { cards: [carte('a', 'q', 'r'), carte('b', 'q', 'r'), carte('c', 'q', 'r')] };
    expect(dedupeDeck(d)).toBe(2);
    expect(d.cards.map(c => c.id)).toEqual(['a']);
  });
  it('les rechutes des doublons s’additionnent sur la carte gardée, sa mémoire ne bouge pas', () => {
    const gardee = carte('g', 'q', 'r', { n: 5, l: 2, S: 20, D: 4, F: 20, st: 2, lr: 5000, d: 9000 });
    const d = { cards: [gardee, carte('x', 'q', 'r', { n: 1, l: 3, S: 1, D: 8, lr: 100 })] };
    dedupeDeck(d);
    expect(d.cards).toEqual([{ ...gardee, l: 5 }]);
    expect(cardIssues(d.cards[0])).toEqual([]);
  });
  it('l’ordre du paquet est conservé pour les cartes restantes', () => {
    const d = { cards: [carte('1', 'a', 'a'), carte('2', 'b', 'b'), carte('3', 'a', 'a'), carte('4', 'c', 'c')] };
    dedupeDeck(d);
    expect(d.cards.map(c => c.id)).toEqual(['1', '2', '4']);
  });
});

describe('0 doublon après passage', () => {
  /* Une bibliothèque fabriquée : 3 paquets, 200 cartes, ~40 % de doublons
     tirés au hasard (graine fixe), sous des graphies variées. */
  function fabrique() {
    let s = 7;
    const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
    const graphies = [x => x, x => x.toUpperCase(), x => '  ' + x + ' ', x => x + ' ?'];
    return ['d1', 'd2', 'd3'].map(id => {
      const cards = [];
      for (let i = 0; i < 200; i++) {
        const k = rnd() < 0.4 && cards.length ? Math.floor(rnd() * cards.length) : null;
        const base = k == null ? { f: 'recto ' + id + i, b: 'verso ' + i } : { f: cards[k].f.trim(), b: cards[k].b };
        const g = graphies[Math.floor(rnd() * graphies.length)];
        cards.push(carte(id + '-' + i, g(base.f), base.b, rnd() < 0.5 ? { n: Math.floor(rnd() * 5) } : {}));
      }
      return { id, cards };
    });
  }

  it('il y en avait, il n’y en a plus, et une seule carte par contenu distinct', () => {
    const decks = fabrique();
    const avant = countDuplicates(decks);
    const distincts = decks.map(d => new Set(d.cards.map(dupKey)).size);
    expect(avant).toBeGreaterThan(100);
    const r = dedupeLibrary(decks);
    expect(r.removed).toBe(avant);
    expect(r.touched.length).toBe(3);
    expect(countDuplicates(decks)).toBe(0);
    expect(decks.map(d => d.cards.length)).toEqual(distincts);
  });

  it('un second passage ne change plus rien', () => {
    const decks = fabrique();
    dedupeLibrary(decks);
    const fige = JSON.stringify(decks);
    expect(dedupeLibrary(decks)).toEqual({ removed: 0, touched: [] });
    expect(JSON.stringify(decks)).toBe(fige);
  });
});
