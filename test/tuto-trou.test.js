import { describe, it, expect } from 'vitest';
import { chemin, doux, forme, mix, placePc, placeTel, resserre } from '../src/tuto-trou.js';

const boite = (left, top, right, bottom) => ({ left, top, right, bottom });

describe('forme — la boîte de ce qu’on montre, rognée à l’écran, et ses coins', () => {
  it('ses coins, jamais plus que la moitié du plus petit côté', () => {
    expect(forme(boite(10, 20, 110, 60), 390, 844, [16, 16, 16, 16])).toEqual({ x: 10, y: 20, w: 100, h: 40, r: [16, 16, 16, 16] });
    expect(forme(boite(0, 0, 100, 40), 390, 844, [99, 99, 0, 0]).r).toEqual([20, 20, 0, 0]);
  });
  it('un coin en pourcentage (négatif) : 50 % fait un rond', () => {
    expect(forme(boite(0, 0, 48, 48), 390, 844, [-50, -50, -50, -50]).r).toEqual([24, 24, 24, 24]);
  });
  it('rognée aux bords : une feuille qui sort de l’écran, une cible hors champ', () => {
    expect(forme(boite(-10, 700, 400, 900), 390, 844)).toMatchObject({ x: 0, y: 700, w: 390, h: 144 });
    expect(forme(boite(0, 900, 100, 950), 390, 844)).toMatchObject({ w: 100, h: 0 });
  });
});

describe('chemin — le voile percé du trou', () => {
  it('sans trou, tout l’écran ; avec, un second contour (evenodd)', () => {
    expect(chemin(390, 844, null)).toBe('M0 0H390V844H0Z');
    expect(chemin(390, 844, { x: 0, y: 0, w: 0, h: 0, r: [0, 0, 0, 0] })).toBe('M0 0H390V844H0Z');
    const d = chemin(390, 844, { x: 10, y: 20, w: 100, h: 40, r: [8, 8, 8, 8] });
    expect(d.match(/M/g)).toHaveLength(2);
    expect(d).toContain('M18 20H102A8 8 0 0 1 110 28');
  });
});

describe('le glissement', () => {
  it('doux : de 0 à 1, posé à l’arrivée, borné', () => {
    expect(doux(0)).toBe(0);
    expect(doux(1)).toBe(1);
    expect(doux(2)).toBe(1);
    expect(doux(.5)).toBeGreaterThan(.5);
  });
  it('mix et resserre : un trou s’ouvre depuis son centre', () => {
    const f = { x: 100, y: 100, w: 100, h: 50, r: [10, 10, 10, 10] };
    const d = resserre(f, .5);
    expect(d).toEqual({ x: 125, y: 112.5, w: 50, h: 25, r: [5, 5, 5, 5] });
    expect(mix(d, f, 1)).toEqual(f);
    expect(mix(d, f, 0)).toEqual(d);
  });
});

describe('la bulle', () => {
  const anneau = (y, h) => ({ x: 16, y, w: 358, h, r: [0, 0, 0, 0] });
  it('au téléphone, sous le trou s’il y a la place, dessus sinon', () => {
    expect(placeTel(anneau(100, 200), anneau(100, 200), 120, 844, '')).toEqual({ y: 312, cote: 'bas' });
    expect(placeTel(anneau(600, 200), anneau(600, 200), 120, 844, '')).toEqual({ y: 468, cote: 'haut' });
  });
  it('un trou qui grandit ne la fait pas sauter de l’autre côté (des pages qui s’ajoutent)', () => {
    const r = placeTel(anneau(60, 664), anneau(480, 244), 110, 844, 'bas');
    expect(r.cote).toBe('bas');
    expect(r.y).toBe(844 - 110 - 12);
  });
  it('mais elle ne cache pas ce qu’il faut toucher : elle change alors de côté', () => {
    expect(placeTel(anneau(60, 760), anneau(60, 760), 110, 844, 'bas').cote).not.toBe('bas');
  });
  it('sur ordinateur, sous le trou, puis dessus, puis à côté ; dans le coin au pire', () => {
    expect(placePc({ x: 400, y: 100, w: 200, h: 60 }, 340, 150, 1360, 900)).toEqual([330, 174]);
    expect(placePc({ x: 400, y: 700, w: 200, h: 180 }, 340, 150, 1360, 900)).toEqual([330, 536]);
    expect(placePc({ x: 0, y: 0, w: 1360, h: 900 }, 340, 150, 1360, 900)).toEqual([996, 726]);
  });
});
