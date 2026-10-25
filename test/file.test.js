/* M01.T3 — la file de révision (src/file.js) : sélection (suspendues,
   dues, coriaces), quota de cartes neuves, ordre (mélange ou trié), et
   limite finale. `now` et `rand` sont toujours fournis explicitement, ce
   qui rend le mélange et les échéances vérifiables sans horloge réelle. */
import { describe, it, expect } from 'vitest';
import { isDue, isLeech, shuffle, buildQueue } from '../src/file.js';

/* même graine → même suite, comme test/concurrence.test.js */
function mulberry32(graine) {
  let s = graine | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NOW = Date.UTC(2026, 8, 18, 9, 0, 0);
const DAY = 864e5;
const carte = (id, extra) => ({ id, f: 'recto', b: 'verso', ...extra });

describe('isDue', () => {
  it('due si l’échéance est passée', () => {
    expect(isDue(carte('a', { d: NOW - DAY }), NOW)).toBe(true);
  });
  it('pas due si l’échéance est dans le futur', () => {
    expect(isDue(carte('a', { d: NOW + DAY }), NOW)).toBe(false);
  });
  it('due si jamais vue (pas d’échéance)', () => {
    expect(isDue(carte('a'), NOW)).toBe(true);
  });
  it('jamais due si suspendue, même en retard', () => {
    expect(isDue(carte('a', { d: NOW - DAY, x: 1 }), NOW)).toBe(false);
  });
});

describe('isLeech', () => {
  it('pas coriace en dessous de huit rechutes', () => {
    expect(isLeech(carte('a', { l: 7 }))).toBe(false);
  });
  it('coriace à partir de huit rechutes', () => {
    expect(isLeech(carte('a', { l: 8 }))).toBe(true);
  });
  it('pas coriace sans champ l (jamais raté)', () => {
    expect(isLeech(carte('a'))).toBe(false);
  });
});

describe('shuffle', () => {
  it('garde le même multi-ensemble de cartes', () => {
    const a = [1, 2, 3, 4, 5];
    const r = shuffle([...a], mulberry32(1));
    expect(r.slice().sort()).toEqual(a);
  });
  it('est déterministe à graine égale', () => {
    const a = shuffle([1, 2, 3, 4, 5, 6, 7, 8], mulberry32(42));
    const b = shuffle([1, 2, 3, 4, 5, 6, 7, 8], mulberry32(42));
    expect(a).toEqual(b);
  });
  it('mute et retourne le même tableau', () => {
    const a = [1, 2, 3];
    const r = shuffle(a, mulberry32(1));
    expect(r).toBe(a);
  });
});

describe('buildQueue — sélection', () => {
  it('exclut les cartes suspendues par défaut', () => {
    const cards = [carte('a'), carte('b', { x: 1 })];
    const ids = buildQueue(cards, {}, NOW).map(c => c.id);
    expect(ids).toEqual(['a']);
  });
  it('garde les suspendues avec opts.susp', () => {
    const cards = [carte('a'), carte('b', { x: 1 })];
    const ids = buildQueue(cards, { susp: true }, NOW).map(c => c.id).sort();
    expect(ids).toEqual(['a', 'b']);
  });
  it('only: due ne garde que les cartes en retard ou jamais vues', () => {
    const cards = [carte('a', { d: NOW - DAY, n: 1 }), carte('b', { d: NOW + DAY, n: 1 }), carte('c')];
    const ids = buildQueue(cards, { only: 'due' }, NOW).map(c => c.id).sort();
    expect(ids).toEqual(['a', 'c']);
  });
  it('only: leech ne garde que les cartes coriaces', () => {
    const cards = [carte('a', { l: 8 }), carte('b', { l: 1 })];
    const ids = buildQueue(cards, { only: 'leech' }, NOW).map(c => c.id);
    expect(ids).toEqual(['a']);
  });
});

describe('buildQueue — quotas', () => {
  it('cap plafonne les cartes neuves', () => {
    const cards = [carte('n1'), carte('n2'), carte('n3')];
    const ids = buildQueue(cards, { cap: 2, order: 'deck' }, NOW).map(c => c.id);
    expect(ids).toEqual(['n1', 'n2']);
  });
  it('cap ne touche pas aux cartes déjà vues', () => {
    const cards = [carte('n1'), carte('n2'), carte('v1', { n: 3 }), carte('v2', { n: 5 })];
    const ids = buildQueue(cards, { cap: 1, order: 'deck' }, NOW).map(c => c.id);
    expect(ids).toEqual(['n1', 'v1', 'v2']);
  });
  it('cap absent ou à 0 : aucun plafond', () => {
    const cards = [carte('n1'), carte('n2'), carte('n3')];
    const ids = buildQueue(cards, { order: 'deck' }, NOW).map(c => c.id);
    expect(ids).toEqual(['n1', 'n2', 'n3']);
  });
  it('cap plus grand que le nombre de neuves disponibles : pas de crash, tout est gardé', () => {
    const cards = [carte('n1'), carte('n2')];
    const ids = buildQueue(cards, { cap: 50, order: 'deck' }, NOW).map(c => c.id);
    expect(ids).toEqual(['n1', 'n2']);
  });
});

describe('buildQueue — ordre', () => {
  const cards = [
    carte('n1'), carte('n2'),
    carte('v1', { n: 3, l: 1, d: NOW + 2 * DAY }),
    carte('v2', { n: 5, l: 9, d: NOW - 3 * DAY }),
    carte('v3', { n: 2, l: 4, d: NOW - DAY }),
  ];
  it('deck : ordre d’origine, neuves puis déjà-vues', () => {
    const ids = buildQueue(cards, { order: 'deck' }, NOW).map(c => c.id);
    expect(ids).toEqual(['n1', 'n2', 'v1', 'v2', 'v3']);
  });
  it('worst : les plus coriaces (l) d’abord parmi neuves+vues', () => {
    const ids = buildQueue(cards, { order: 'worst' }, NOW).map(c => c.id);
    expect(ids).toEqual(['v2', 'v3', 'v1', 'n1', 'n2']);
  });
  it('due : d croissant (les neuves sans échéance, à 0, passent en premier)', () => {
    const ids = buildQueue(cards, { order: 'due' }, NOW).map(c => c.id);
    expect(ids).toEqual(['n1', 'n2', 'v2', 'v3', 'v1']);
  });
  it('fresh : mélange les neuves et les déjà-vues séparément, sans les entrelacer', () => {
    const ids = buildQueue(cards, { fresh: true }, NOW, mulberry32(7)).map(c => c.id);
    const iNeuve = ids.map(id => id.startsWith('n')).lastIndexOf(true);
    const iVue = ids.map(id => id.startsWith('v')).indexOf(true);
    expect(iNeuve).toBeLessThan(iVue);
    expect(ids.filter(id => id.startsWith('n')).sort()).toEqual(['n1', 'n2']);
    expect(ids.filter(id => id.startsWith('v')).sort()).toEqual(['v1', 'v2', 'v3']);
  });
  it('par défaut, le mélange peut entrelacer neuves et déjà-vues', () => {
    const ids = buildQueue(cards, {}, NOW, mulberry32(3)).map(c => c.id);
    expect(ids.slice().sort()).toEqual(['n1', 'n2', 'v1', 'v2', 'v3']);
    expect(ids).not.toEqual(['n1', 'n2', 'v1', 'v2', 'v3']);   // graine choisie pour entrelacer
  });
});

describe('buildQueue — limite finale', () => {
  it('limit tronque la file rendue', () => {
    const cards = [carte('n1'), carte('n2'), carte('n3')];
    const ids = buildQueue(cards, { order: 'deck', limit: 2 }, NOW).map(c => c.id);
    expect(ids).toEqual(['n1', 'n2']);
  });
  it('limit absent ou à 0 : pas de troncature', () => {
    const cards = [carte('n1'), carte('n2'), carte('n3')];
    const ids = buildQueue(cards, { order: 'deck' }, NOW).map(c => c.id);
    expect(ids).toHaveLength(3);
  });
});

describe('buildQueue — pureté', () => {
  it('ne modifie jamais le tableau reçu', () => {
    const cards = [carte('n1'), carte('v1', { n: 2, l: 9 })];
    const avant = JSON.parse(JSON.stringify(cards));
    buildQueue(cards, { order: 'worst', cap: 1 }, NOW, mulberry32(1));
    expect(cards).toEqual(avant);
  });
  it('rend les mêmes objets carte, pas des copies', () => {
    const c1 = carte('n1');
    const ids = buildQueue([c1], {}, NOW);
    expect(ids[0]).toBe(c1);
  });
});

/* 2026-10-25 : la file suit les réglages d'Anki — journée qui bascule à 4 h,
   20 pages neuves par jour et par livre, l'ordre « échéance puis hasard »,
   les neuves réparties parmi les révisions. */
import { aLire, debutJour, entrelacer, estNeuve, finJour, garderNeuves, neuvesPermises, ordreAnki } from '../src/file.js';

const local = (j, h, m = 0) => new Date(2026, 9, j, h, m).getTime();   // octobre 2026, heure de l'appareil

describe('la journée d’Anki', () => {
  it('bascule à 4 h, pas à minuit', () => {
    expect(debutJour(local(25, 10))).toBe(local(25, 4));
    expect(debutJour(local(26, 1, 30))).toBe(local(25, 4));      // après minuit : encore la veille
    expect(finJour(local(25, 23))).toBe(local(26, 4));
  });
  it('une carte en révision est due dès le début de son jour', () => {
    const c = carte('a', { st: 2, d: local(25, 20) });
    expect(isDue(c, local(25, 8))).toBe(true);                    // prévue à 20 h, lisible dès le matin
    expect(isDue(c, local(25, 3))).toBe(false);                   // avant 4 h : c'est encore la veille
  });
  it('un palier d’apprentissage attend son heure', () => {
    expect(isDue(carte('a', { st: 1, d: local(25, 8, 10) }), local(25, 8))).toBe(false);
  });
});

describe('estNeuve', () => {
  it('jamais lue', () => expect(estNeuve(carte('a'))).toBe(true));
  it('ratée à la première lecture : en apprentissage, plus neuve', () => {
    expect(estNeuve(carte('a', { n: 0, lr: NOW, S: 0.2, st: 1 }))).toBe(false);
  });
});

describe('le quota de pages neuves', () => {
  const t = local(25, 18);
  const neuves = k => Array.from({ length: k }, (_, i) => carte('n' + i));
  it('20 par jour, entamé par les premières lectures du jour', () => {
    const lues = Array.from({ length: 5 }, (_, i) => carte('l' + i, { fl: local(25, 9), lr: local(25, 9), S: 1, st: 1 }));
    const hier = carte('h', { fl: local(24, 9), lr: local(24, 9), S: 1, st: 2 });
    expect(neuvesPermises([...neuves(30), ...lues, hier], t)).toBe(15);
  });
  it('jamais négatif', () => {
    const lues = Array.from({ length: 25 }, (_, i) => carte('l' + i, { fl: local(25, 9) }));
    expect(neuvesPermises(lues, t)).toBe(0);
  });
  it('un devoir n’en a pas', () => {
    expect(neuvesPermises(Array.from({ length: 50 }, (_, i) => carte('a:dv:' + i)), t)).toBe(Infinity);
  });
  it('garderNeuves : les premières de chaque paquet, le reste passe', () => {
    const l = [carte('x1', { _d: 'A' }), carte('x2', { _d: 'A' }), carte('v', { _d: 'A', n: 2, lr: 1, S: 3 }),
      carte('y1', { _d: 'B' }), carte('x3', { _d: 'A' })];
    const r = garderNeuves(l, k => (k === 'A' ? 1 : 5), c => c._d).map(c => c.id);
    expect(r).toEqual(['x1', 'v', 'y1']);
  });
  it('aLire : les dues déjà vues, plus les neuves dans la limite du jour', () => {
    const vues = Array.from({ length: 7 }, (_, i) => carte('v' + i, { n: 1, lr: 1, S: 2, st: 2, d: t - DAY }));
    expect(aLire([...neuves(214), ...vues], t)).toBe(27);
  });
});

describe('l’ordre d’Anki', () => {
  it('les paliers d’abord, puis les révisions par jour d’échéance', () => {
    const r1 = carte('r1', { st: 2, n: 1, lr: 1, S: 2, d: local(23, 9) });
    const r2 = carte('r2', { st: 2, n: 1, lr: 1, S: 2, d: local(20, 9) });
    const p = carte('p', { st: 1, n: 0, lr: 1, S: 1, d: local(25, 7) });
    expect(ordreAnki([], [r1, p, r2], mulberry32(1)).map(c => c.id)).toEqual(['p', 'r2', 'r1']);
  });
  it('les neuves, dans l’ordre du livre, réparties parmi les révisions', () => {
    const a = ['a', 'b', 'c', 'd', 'e', 'f'], b = ['1', '2', '3'];
    const r = entrelacer(a, b);
    expect(r).toHaveLength(9);
    expect(r.filter(x => b.includes(x))).toEqual(b);
    expect(r.indexOf('1')).toBeGreaterThan(0);
    expect(r.indexOf('3')).toBeLessThan(8);
  });
  it('buildQueue order anki : rien de perdu', () => {
    const cards = [...Array.from({ length: 4 }, (_, i) => carte('n' + i)),
      ...Array.from({ length: 6 }, (_, i) => carte('r' + i, { st: 2, n: 1, lr: 1, S: 2, d: NOW - i * DAY }))];
    const q = buildQueue(cards, { order: 'anki', only: 'due' }, NOW, mulberry32(3));
    expect(new Set(q.map(c => c.id)).size).toBe(10);
  });
});
