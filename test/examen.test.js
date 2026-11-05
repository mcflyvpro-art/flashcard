// L'objectif examen (src/examen.js, Mirandola Infini) : le moteur ne change
// que deux réglages, et seulement avant l'examen.
import { describe, it, expect } from 'vitest';
import { compte, dateExamen, joursAvant, reglageExamen, FENETRE, RETENTION_EXAMEN } from '../src/examen.js';
import { dateValable, prevision } from '../src/examen-feuille.js';
import { W6, fsrsR, fsrsStates } from '../src/fsrs.js';

const ANKI = { dr: 0.9, maxIvl: 36500 };
const midi = (a, m, j, h = 12) => new Date(a, m - 1, j, h).getTime();
const DAY = 86400000;

describe('la date', () => {
  it('lit « AAAA-MM-JJ » et refuse le reste', () => {
    expect(dateExamen('2027-06-15')).toBe(new Date(2027, 5, 15).getTime());
    for (const x of ['2027-02-30', '15/06/2027', '', null, 12, '2027-6-15']) expect(dateExamen(x)).toBeNull();
  });
  it('compte les jours au calendrier, quelle que soit l’heure', () => {
    expect(joursAvant('2027-06-15', midi(2027, 6, 14, 23))).toBe(1);
    expect(joursAvant('2027-06-15', midi(2027, 6, 14, 0))).toBe(1);
    expect(joursAvant('2027-06-15', midi(2027, 6, 15, 8))).toBe(0);
    expect(joursAvant('2027-06-15', midi(2027, 6, 20))).toBe(-5);
    expect(joursAvant('2027-04-01', midi(2027, 3, 20))).toBe(12);       // passage à l'heure d'été
  });
  it('se pose de demain à deux ans', () => {
    const now = midi(2027, 1, 10);
    expect(dateValable('2027-01-10', now)).toBe(false);
    expect(dateValable('2027-01-11', now)).toBe(true);
    expect(dateValable('2029-01-10', now)).toBe(false);
  });
  it('se dit en J-n, Demain, Aujourd’hui, puis plus rien', () => {
    expect(compte('2027-06-15', midi(2027, 6, 3))).toBe('J-12');
    expect(compte('2027-06-15', midi(2027, 6, 14))).toBe('Demain');
    expect(compte('2027-06-15', midi(2027, 6, 15))).toBe('Aujourd’hui');
    expect(compte('2027-06-15', midi(2027, 6, 16))).toBe('');
    expect(compte(undefined, midi(2027, 6, 16))).toBe('');
  });
});

describe('le réglage du moteur', () => {
  it('sans Infini, ou sans date, ou passé : celui d’Anki', () => {
    expect(reglageExamen('2027-06-15', midi(2027, 6, 1), ANKI, false)).toBe(ANKI);
    expect(reglageExamen(undefined, midi(2027, 6, 1), ANKI, true)).toBe(ANKI);
    expect(reglageExamen('2027-06-15', midi(2027, 6, 15), ANKI, true)).toBe(ANKI);
    expect(reglageExamen('2027-06-15', midi(2027, 7, 1), ANKI, true)).toBe(ANKI);
  });
  it('loin de l’examen : 90 %, mais rien après la veille', () => {
    expect(reglageExamen('2027-06-15', midi(2027, 3, 1), ANKI, true)).toEqual({ dr: 0.9, maxIvl: 106 - 1 });
  });
  it(`dans les ${FENETRE} derniers jours : ${RETENTION_EXAMEN * 100} %`, () => {
    expect(reglageExamen('2027-06-15', midi(2027, 5, 16), ANKI, true)).toEqual({ dr: 0.95, maxIvl: 29 });
    expect(reglageExamen('2027-06-15', midi(2027, 6, 14), ANKI, true)).toEqual({ dr: 0.95, maxIvl: 1 });
  });
  it('avec FSRS : une page bien sue ne part jamais au-delà de l’examen, et revient plus tôt', () => {
    const now = midi(2027, 6, 1);
    const c = { st: 2, S: 120, D: 4, F: 120, lr: now - 60 * DAY, n: 6, i: 60 };
    const cfg = r => ({ w: W6, dr: r.dr, maxIvl: r.maxIvl, charge: null });
    const libre = fsrsStates(c, now, cfg(ANKI))[2];
    const examen = fsrsStates(c, now, cfg(reglageExamen('2027-06-15', now, ANKI, true)))[2];
    expect(libre.ivl).toBeGreaterThan(14);
    expect(examen.ivl).toBeLessThanOrEqual(13);
    expect(examen.d).toBeLessThan(dateExamen('2027-06-15'));
  });
});

describe('la prévision du jour J', () => {
  const rappel = (c, t) => fsrsR(W6, t, { S: c.S, D: c.D, F: c.F || c.S });
  it('moyenne du rappel le jour J, une page jamais lue comptant pour 0, une page de côté écartée', () => {
    const now = midi(2027, 6, 1);
    const sue = { S: 400, D: 3, lr: now };
    const p = prevision([sue, {}, { x: 1, S: 1, lr: now }], '2027-06-15', now, rappel);
    const r = rappel(sue, 14);
    expect(p).toBe(Math.round((r / 2) * 100));
    expect(prevision([], '2027-06-15', now, rappel)).toBeNull();
    expect(prevision([sue], 'demain', now, rappel)).toBeNull();
  });
});
