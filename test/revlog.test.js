/* Le journal des révisions (`reviews`) est la source de vérité ; l'état
   stocké sur une fiche n'est qu'un cache qu'on doit pouvoir reconstruire
   en le rejouant. Ces tests vérifient que le rejeu (src/fsrs.js) fait
   exactement ce que ferait le moteur appliqué note après note, et que ça
   tient la charge : M03.T2 exige moins de 500 ms pour 10 000 révisions. */
import { describe, it, expect } from 'vitest';
import { W6, DAY, cl, fsrsInit, fsrsStep, fsrsIvl, dayNo,
         fsrsReplayCard, fsrsReplayAll } from '../src/fsrs.js';

const CFG = { w: W6, dr: 0.9, maxIvl: 36500 };
const DAY0 = Date.UTC(2026, 0, 1, 9, 0, 0);
const MIN_SPACING = 6e4; // une minute : les cartes d'un même lot ne tombent pas pile à la même seconde

const logOf = entries => entries.map(([rating, jours]) =>
  ({ rating, created_at: DAY0 + jours * DAY }));

describe('rejeu d’une fiche', () => {
  it('reconstruit le même état que le moteur appliqué pas à pas', () => {
    const log = logOf([[2, 0], [2, 1], [3, 5], [1, 12], [2, 13]]);
    const got = fsrsReplayCard(log, CFG);

    // Oracle indépendant : on refait le pas à pas à la main avec les
    // primitives déjà testées dans fsrs.test.js.
    let m = null, last = 0, lapses = 0, reps = 0;
    for (const row of log) {
      const g = cl(row.rating + 1, 1, 4);
      const t = row.created_at;
      const dt = m ? Math.max(0, dayNo(t) - dayNo(last)) : 0;
      m = m ? fsrsStep(CFG.w, m, dt, g) : fsrsInit(CFG.w, g);
      if (g === 1 && reps) lapses++;
      if (g > 1) reps++;
      last = t;
    }

    expect(got.S).toBeCloseTo(m.S, 9);
    expect(got.D).toBeCloseTo(m.D, 9);
    expect(got.F).toBeCloseTo(m.F, 9);
    expect(got.lr).toBe(last);
    expect(got.n).toBe(reps);
    expect(got.l).toBe(lapses);
    expect(got.st).toBe(2);
    expect(got.sp).toBeNull();
    const ivl = Math.min(Math.max(Math.round(fsrsIvl(CFG.w, m, CFG.dr)), 1), CFG.maxIvl);
    expect(got.i).toBe(ivl);
  });

  it('compte une rechute dès qu’« encore » suit une note qui comptait déjà', () => {
    const log = logOf([[2, 0], [0, 1], [2, 5]]);
    expect(fsrsReplayCard(log, CFG).l).toBe(1);
  });

  it('ignore les notes nulles : QCM, association et récitation ne notent pas la mémoire', () => {
    const log = [
      { rating: null, created_at: DAY0 },
      { rating: 2, created_at: DAY0 + DAY },
    ];
    expect(fsrsReplayCard(log, CFG).n).toBe(1);
  });

  it('rend null si aucune note ne compte', () => {
    expect(fsrsReplayCard([], CFG)).toBeNull();
    expect(fsrsReplayCard([{ rating: null, created_at: DAY0 }], CFG)).toBeNull();
  });

  it('l’ordre des lignes ne change rien : le rejeu trie par date', () => {
    const enOrdre = logOf([[2, 0], [2, 1], [3, 5]]);
    const brouillon = [enOrdre[2], enOrdre[0], enOrdre[1]];
    expect(fsrsReplayCard(brouillon, CFG)).toEqual(fsrsReplayCard(enOrdre, CFG));
  });
});

describe('rejeu de tout un journal', () => {
  it('sépare les fiches, et laisse de côté celles sans note valable', () => {
    const rows = [
      { card_id: 'a', rating: 2, created_at: DAY0 },
      { card_id: 'a', rating: 3, created_at: DAY0 + 3 * DAY },
      { card_id: 'b', rating: 1, created_at: DAY0 },
      { card_id: 'c', rating: null, created_at: DAY0 },
    ];
    const out = fsrsReplayAll(rows, CFG);
    expect([...out.keys()].sort()).toEqual(['a', 'b']);
    expect(out.get('a').n).toBe(2);
    expect(out.get('b').n).toBe(1);
    expect(out.has('c')).toBe(false);
  });

  it('rend un résultat vide sur un journal vide', () => {
    expect(fsrsReplayAll([], CFG).size).toBe(0);
    expect(fsrsReplayAll(undefined, CFG).size).toBe(0);
  });
});

describe('performance (M03.T2)', () => {
  it('recalcule 10 000 révisions en moins de 500 ms', () => {
    const N = 10000, CARDS = 800;
    const rows = [];
    for (let i = 0; i < N; i++) {
      rows.push({
        card_id: 'c' + (i % CARDS),
        rating: i % 4,
        created_at: DAY0 + Math.floor(i / CARDS) * DAY + (i % CARDS) * MIN_SPACING,
      });
    }
    const t0 = Date.now();
    const out = fsrsReplayAll(rows, CFG);
    const ms = Date.now() - t0;
    expect(out.size).toBeGreaterThan(0);
    expect(ms).toBeLessThan(500);
  });
});
