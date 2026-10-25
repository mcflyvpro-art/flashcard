/* Les règles d'un défi (src/defi.js) : questions fabriquées depuis un livre,
   au format exact qu'accepte salle_ouvrir, codes de salle, chrono corrigé
   de l'horloge du téléphone, podium à égalité. */
import { describe, it, expect } from 'vitest';
import {
  JEUX, cleReponse, decalage, ecoule, fabriquerQuestions, jouable, lienDefi, messageSalle, pagesJouables,
  phase, pinComplet, pinDepuisTexte, pinLisible, placeTexte, places, podium, reponsesAdmises, restant, signature
} from '../src/defi.js';

const graine = s => () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
const LIVRE = [['bonjour', 'buongiorno'], ['merci', 'grazie'], ['la gare', 'la stazione'],
  ['le train', 'il treno'], ['la place', 'la piazza'], ['  ', 'vide'], ['sans verso', '']]
  .map(([f, b]) => ({ f, b }));

describe('les questions d’un livre', () => {
  it('écarte les pages sans recto ou sans verso', () => {
    expect(pagesJouables(LIVRE)).toHaveLength(5);
  });
  it('QCM : 4 choix différents, le bon est à son rang, au format de la base', () => {
    const q = fabriquerQuestions(LIVRE, 'qcm', 5, graine(7));
    expect(q).toHaveLength(5);
    for (const x of q) {
      expect(x.c).toHaveLength(4);
      expect(new Set(x.c.map(cleReponse)).size).toBe(4);
      expect(x.c[x.b]).toBe(x.r);
      expect(Object.keys(x).sort()).toEqual(['b', 'c', 'e', 'r']);
    }
    expect(new Set(q.map(x => x.e)).size).toBe(5);       // jamais deux fois la même page
  });
  it('QCM sur un petit livre : autant de choix qu’il y a de réponses', () => {
    const q = fabriquerQuestions(LIVRE.slice(0, 2), 'qcm', 10, graine(3));
    expect(q).toHaveLength(2);
    for (const x of q) { expect(x.c).toHaveLength(2); expect(x.c[x.b]).toBe(x.r); }
  });
  it('vrai ou faux : une proposition, 0 si elle est juste, 1 sinon', () => {
    const q = fabriquerQuestions(LIVRE, 'vf', 40, graine(11));
    expect(q).toHaveLength(5);
    for (const x of q) {
      expect(x.c).toHaveLength(1);
      expect(x.b === 0 ? x.c[0] === x.r : x.c[0] !== x.r).toBe(true);
    }
    const tout = fabriquerQuestions(Array.from({ length: 40 }, (_, k) => ({ f: 'q' + k, b: 'r' + k })), 'vf', 40, graine(5));
    const vrais = tout.filter(x => x.b === 0).length;
    expect(vrais).toBeGreaterThan(8);                       // à peu près moitié-moitié
    expect(vrais).toBeLessThan(32);
  });
  it('vrai ou faux sur une seule réponse possible : toujours vrai, jamais une fausse inventée', () => {
    const q = fabriquerQuestions([{ f: 'a', b: 'x' }, { f: 'b', b: 'X' }], 'vf', 2, graine(2));
    expect(q.every(x => x.b === 0)).toBe(true);
  });
  it('réponse écrite : les clés admises, sans accents ni ponctuation', () => {
    const [q] = fabriquerQuestions([{ f: 'élève', b: 'Élève, écolier' }], 'ecrit', 1, graine(1));
    expect(q).toEqual({ e: 'élève', a: ['eleve ecolier', 'eleve', 'ecolier'], r: 'Élève, écolier' });
    expect(q.a).toContain(cleReponse(' ELEVE !'));
  });
  it('coupe les textes trop longs pour la base, sans couper la salle', () => {
    const [q] = fabriquerQuestions([{ f: 'x'.repeat(900), b: 'y'.repeat(500) }], 'ecrit', 1, graine(9));
    expect(q.e.length).toBe(400);
    expect(q.r.length).toBe(200);
    expect(q.e.endsWith('…')).toBe(true);
    for (const c of pagesJouables([{ f: 'x'.repeat(900), b: 'y'.repeat(500) }, { f: 'a', b: 'b' }])) {
      expect(c.f.length).toBeLessThanOrEqual(400);
      expect(c.b.length).toBeLessThanOrEqual(200);
    }
  });
  it('dit si un livre est jouable', () => {
    expect(jouable(LIVRE, 'qcm')).toBe(true);
    expect(jouable([{ f: 'a', b: 'x' }], 'qcm')).toBe(false);
    expect(jouable([{ f: 'a', b: 'x' }], 'ecrit')).toBe(true);
    expect(jouable([], 'ecrit')).toBe(false);
  });
  it('variantes : la réponse entière et ses parties', () => {
    expect(reponsesAdmises('chat / matou')).toEqual(['chat matou', 'chat', 'matou']);
    expect(reponsesAdmises('Paris')).toEqual(['paris']);
    expect(Object.keys(JEUX)).toEqual(['qcm', 'vf', 'ecrit']);
  });
});

describe('le code d’une salle', () => {
  it('se tape avec ou sans espace, se lit en deux paquets', () => {
    expect(pinDepuisTexte('482 913')).toBe('482913');
    expect(pinLisible('482913')).toBe('482 913');
    expect(pinComplet('48291')).toBe(false);
    expect(pinComplet(' 482-913 ')).toBe(true);
  });
  it('se retrouve dans un lien collé, et fait un lien propre', () => {
    expect(pinDepuisTexte('https://folio.app/?defi=482913')).toBe('482913');
    expect(lienDefi('https://x.github.io/flashcard/?go=stats#a', '482 913'))
      .toBe('https://x.github.io/flashcard/?defi=482913');
  });
  it('chaque refus de la base a sa phrase', () => {
    expect(messageSalle('inconnu')).toMatch(/Aucune salle/);
    expect(messageSalle('ok')).toBeNull();
    expect(messageSalle('nimporte')).toMatch(/Impossible/);
  });
});

describe('le chrono d’une question', () => {
  const t0 = Date.parse('2026-10-24T10:00:00Z');
  const e = { etat: 'question', debut: '2026-10-24T10:00:03Z', fin: '2026-10-24T10:00:23Z' };
  it('corrige un téléphone en retard de 2 s sur la base', () => {
    const d = decalage('2026-10-24T10:00:02Z', t0);
    expect(d).toBe(2000);
    expect(phase(e, t0, d)).toBe('lecture');
    expect(restant(e, t0, d)).toBe(1000);                  // 1 s de lecture
    expect(phase(e, t0 + 1500, d)).toBe('reponse');
    expect(restant(e, t0 + 1500, d)).toBe(19500);
    expect(ecoule(e, t0 + 11000, d)).toBeCloseTo(0.5);
    expect(ecoule(e, t0 + 60000, d)).toBe(1);
  });
  it('hors question, rien ne s’écoule', () => {
    expect(phase({ etat: 'attente' }, t0, 0)).toBe('attente');
    expect(restant({ etat: 'correction' }, t0, 0)).toBe(0);
    expect(phase(null)).toBe('absent');
  });
});

describe('le podium', () => {
  it('égalité : même place, la suivante est sautée', () => {
    const l = places([{ nom: 'a', score: 900 }, { nom: 'b', score: 900 }, { nom: 'c', score: 500 }]);
    expect(l.map(x => x.place)).toEqual([1, 1, 3]);
    expect(placeTexte(1)).toBe('1er');
    expect(placeTexte(3)).toBe('3e');
  });
  it('trois marches au plus', () => {
    expect(podium([{ score: 5 }, { score: 4 }, { score: 3 }, { score: 2 }])).toHaveLength(3);
  });
  it('la signature ignore le temps qui passe, pas une réponse de plus', () => {
    const a = { etat: 'question', rang: 0, joueurs: 3, repondu: 1, maintenant: 'x' };
    expect(signature({ ...a, maintenant: 'y' })).toBe(signature(a));
    expect(signature({ ...a, repondu: 2 })).not.toBe(signature(a));
  });
});
