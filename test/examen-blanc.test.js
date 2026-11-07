// L'examen blanc (src/examen-blanc.js, Mirandola Infini) : ce qui se décide
// sans l'IA, et ce qu'on vérifie de ce qu'elle rend.
import { describe, it, expect } from 'vitest';
import {
  questionsPossibles, pagesPourSujet, lireSujet, lireCorrection, surVingt, noteLisible,
  ligneExamen, tendance, MAX_ENVOI
} from '../src/examen-blanc.js';

const page = (id, extra = {}) => ({ id, f: 'recto ' + id, b: 'verso ' + id, ...extra });
const livre = n => Array.from({ length: n }, (_, k) => page('q' + k));

describe('le sujet', () => {
  it('pas d’examen sous 5 pages ; 10 ou 20 questions selon le livre', () => {
    expect(questionsPossibles(livre(4))).toEqual([]);
    expect(questionsPossibles(livre(7))).toEqual([7]);
    expect(questionsPossibles(livre(12))).toEqual([10]);
    expect(questionsPossibles(livre(40))).toEqual([10, 20]);
    expect(questionsPossibles([...livre(4), page('x', { x: 1 }), { id: 'v', f: 'a', b: '' }])).toEqual([]);
  });
  it('les pages qui résistent d’abord, au plus 300, numérotées', () => {
    const cartes = [page('sue', { S: 200 }), page('ratee', { l: 4, S: 2 }), page('neuve'), page('cote', { x: 1 })];
    const p = pagesPourSujet(cartes);
    expect(p.map(x => x.id)).toEqual(['ratee', 'neuve', 'sue']);
    expect(p.map(x => x.i)).toEqual([0, 1, 2]);
    expect(pagesPourSujet(livre(400))).toHaveLength(MAX_ENVOI);
  });
  it('lit le sujet de l’IA sans la croire : questions vides et renvois hors liste écartés', () => {
    const env = pagesPourSujet(livre(6));
    const s = lireSujet({ questions: [
      { q: ' Date de la prise  de la Bastille ? ', attendu: '1789', pages: [0, 0, 9, -1, '2'] },
      { q: '', attendu: 'x', pages: [1] },
      { q: 'Sans réponse', attendu: '' },
      { q: 'Trois', attendu: 'c', pages: 'n' }
    ] }, env, 10);
    expect(s).toEqual([
      { q: 'Date de la prise de la Bastille ?', attendu: '1789', pages: [0, 2] },
      { q: 'Trois', attendu: 'c', pages: [] }
    ]);
    expect(lireSujet(null, env, 10)).toEqual([]);
    expect(lireSujet({ questions: Array(30).fill({ q: 'a', attendu: 'b' }) }, env, 10)).toHaveLength(10);
  });
});

describe('la correction', () => {
  const env = pagesPourSujet(livre(6));
  const sujet = [
    { q: 'Q1', attendu: 'A1', pages: [0] },
    { q: 'Q2', attendu: 'A2', pages: [1, 2] },
    { q: 'Q3', attendu: 'A3', pages: [2] },
    { q: 'Q4', attendu: 'A4', pages: [3] }
  ];
  it('ne commente pas ce qui est juste, corrige et conseille ce qui ne l’est pas', () => {
    const r = lireCorrection({ bilan: 'Revois la chronologie.', questions: [
      { ok: true, points: 1, sur: 1, lu: 'A1', correction: 'bravo', conseil: 'continue' },
      { ok: false, points: 0, sur: 1, lu: 'B', correction: 'C’est A2.', conseil: 'Relis la page 2.' },
      { ok: false, points: 1, sur: 2, lu: 'à moitié', correction: '', conseil: '' }
    ] }, sujet, env);
    expect(r.questions[0]).toMatchObject({ ok: true, correction: '', conseil: '' });
    expect(r.questions[1]).toMatchObject({ ok: false, correction: 'C’est A2.', conseil: 'Relis la page 2.' });
    expect(r.questions[2]).toMatchObject({ ok: false, points: 1, sur: 2, correction: 'A3' });   // la réponse attendue, à défaut
    expect(r.questions[3]).toMatchObject({ ok: false, points: 0, sur: 1, lu: '', conseil: '' });  // oubliée par l'IA : faux, sans conseil inventé
    expect(r.justes).toBe(1);
    expect(r.points).toBe(2); expect(r.sur).toBe(5);
    expect(r.note).toBe(8);
    expect(r.revoir).toEqual(['q1', 'q2', 'q3']);
    expect(r.bilan).toBe('Revois la chronologie.');
  });
  it('borne les points à leur barème, et « juste » demande tous les points', () => {
    const r = lireCorrection({ questions: [
      { ok: true, points: 9, sur: 2 }, { ok: true, points: 0.5, sur: 1 }, { ok: false, points: -3, sur: 40 }, { points: 0.74, sur: 1 }
    ] }, sujet, env);
    expect(r.questions.map(q => [q.points, q.sur, q.ok])).toEqual([[2, 2, true], [0.5, 1, false], [0, 4, false], [0.5, 1, false]]);
  });
  it('la note au demi-point, à la française', () => {
    expect(surVingt(13, 17)).toBe(15.5);
    expect(surVingt(0, 0)).toBe(0);
    expect(noteLisible(15.5)).toBe('15,5');
  });
});

describe('ce qu’on garde, et la tendance', () => {
  it('une ligne sans photo, avec le détail en texte', () => {
    const r = lireCorrection({ questions: [{ ok: true, points: 1, sur: 1, lu: 'A1' }] }, [{ q: 'Q1', attendu: 'A1', pages: [] }], []);
    const l = ligneExamen('d1', r, 'photo', Date.UTC(2027, 0, 2));
    expect(l).toEqual({ deck_id: 'd1', created_at: '2027-01-02T00:00:00.000Z', note: 20, questions: 1, justes: 1, copie: 'photo',
      detail: { questions: r.questions, bilan: '', revoir: [] } });
    expect(ligneExamen('d1', r, 'n’importe', 0).copie).toBe('clavier');
  });
  it('la dernière note, l’écart, la meilleure, la courbe dans l’ordre du temps', () => {
    const t = tendance([
      { created_at: '2027-01-01', note: 9 }, { created_at: '2027-01-08', note: 12.5 }, { created_at: '2027-01-03', note: 11 }
    ]);
    expect(t).toEqual({ derniere: 12.5, ecart: 1.5, meilleure: 12.5, nombre: 3, courbe: [9, 11, 12.5] });
    expect(tendance([])).toBeNull();
    expect(tendance([{ created_at: 'x', note: 10 }]).ecart).toBeNull();
  });
});
