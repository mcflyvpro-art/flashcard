/* M04.T1 — les invariants de carte (src/invariants.js) : ce que doit
   toujours être vrai d'une carte pour que le moteur et la file de
   révision puissent lui faire confiance. Chaque règle a son cas sain et
   son cas violé — 12 règles, comme la cible de PROGRESS.md. */
import { describe, it, expect } from 'vitest';
import { S_MIN, S_MAX, D_MIN, D_MAX } from '../src/fsrs.js';
import { CARD_INVARIANTS, cardIssues } from '../src/invariants.js';

const carte = (extra = {}) => ({ id: 'a1', f: 'recto', b: 'verso', ...extra });

describe('12 invariants, ni plus ni moins', () => {
  it('exactement 12 règles, chacune avec un code unique', () => {
    expect(CARD_INVARIANTS).toHaveLength(12);
    const codes = CARD_INVARIANTS.map(i => i.code);
    expect(new Set(codes).size).toBe(12);
  });
});

describe('cardIssues — carte saine', () => {
  it('une carte neuve, jamais révisée, ne porte aucune anomalie', () => {
    expect(cardIssues(carte())).toEqual([]);
  });
  it('une carte en apprentissage, cohérente, ne porte aucune anomalie', () => {
    expect(cardIssues(carte({ st: 1, sp: 0, n: 0, l: 0 }))).toEqual([]);
  });
  it('une carte en révision avec mémoire complète ne porte aucune anomalie', () => {
    expect(cardIssues(carte({
      st: 2, S: 5, D: 4, F: 5, lr: 1000, d: 2000, n: 3, l: 1
    }))).toEqual([]);
  });
});

describe('id', () => {
  it('rejette une fiche sans identifiant', () => {
    const c = carte(); delete c.id;
    expect(cardIssues(c)).toContain('id');
  });
  it('rejette un identifiant vide', () => {
    expect(cardIssues(carte({ id: '' }))).toContain('id');
  });
});

describe('front / back', () => {
  it('rejette un recto vide ou absent', () => {
    expect(cardIssues(carte({ f: '' }))).toContain('front');
    expect(cardIssues(carte({ f: '   ' }))).toContain('front');
  });
  it('rejette un verso vide ou absent', () => {
    expect(cardIssues(carte({ b: '' }))).toContain('back');
  });
});

describe('state', () => {
  it('accepte 1, 2, 3 et l’absence (fiche neuve)', () => {
    for (const st of [1, 2, 3, undefined]) {
      expect(cardIssues(carte({ st }))).not.toContain('state');
    }
  });
  it('rejette un état hors 1, 2, 3', () => {
    expect(cardIssues(carte({ st: 4 }))).toContain('state');
    expect(cardIssues(carte({ st: 0 }))).toContain('state');
  });
});

describe('stability (S)', () => {
  it('accepte les bornes du moteur', () => {
    expect(cardIssues(carte({ n: 1, D: 5, S: S_MIN }))).not.toContain('stability');
    expect(cardIssues(carte({ n: 1, D: 5, S: S_MAX }))).not.toContain('stability');
  });
  it('rejette une stabilité hors bornes ou nulle', () => {
    expect(cardIssues(carte({ S: 0 }))).toContain('stability');
    expect(cardIssues(carte({ S: -1 }))).toContain('stability');
    expect(cardIssues(carte({ S: S_MAX + 1 }))).toContain('stability');
  });
});

describe('difficulty (D)', () => {
  it('accepte les bornes 1 et 10', () => {
    expect(cardIssues(carte({ n: 1, S: 5, D: D_MIN }))).not.toContain('difficulty');
    expect(cardIssues(carte({ n: 1, S: 5, D: D_MAX }))).not.toContain('difficulty');
  });
  it('rejette une difficulté hors [1, 10]', () => {
    expect(cardIssues(carte({ D: 0 }))).toContain('difficulty');
    expect(cardIssues(carte({ D: 11 }))).toContain('difficulty');
  });
});

describe('trace (F)', () => {
  it('rejette une seconde trace hors des bornes de stabilité', () => {
    expect(cardIssues(carte({ F: -1 }))).toContain('trace');
    expect(cardIssues(carte({ F: S_MAX + 1 }))).toContain('trace');
  });
});

describe('reviewed-has-memory', () => {
  it('rejette une fiche révisée sans stabilité ni difficulté (fsrsSeed pas encore passé)', () => {
    expect(cardIssues(carte({ n: 5 }))).toContain('reviewed-has-memory');
  });
  it('accepte une fiche révisée avec sa mémoire complète', () => {
    expect(cardIssues(carte({ n: 5, S: 3, D: 4 }))).not.toContain('reviewed-has-memory');
  });
});

describe('new-has-no-memory', () => {
  it('rejette une fiche jamais révisée qui garde une stabilité orpheline', () => {
    expect(cardIssues(carte({ n: 0, S: 3 }))).toContain('new-has-no-memory');
  });
  it('rejette une fiche jamais révisée qui garde une dernière révision orpheline', () => {
    expect(cardIssues(carte({ n: 0, lr: 1000 }))).toContain('new-has-no-memory');
  });
  it('accepte une fiche neuve sans aucune trace de mémoire', () => {
    expect(cardIssues(carte({ n: 0 }))).not.toContain('new-has-no-memory');
  });
});

describe('due-after-review', () => {
  it('accepte une échéance dans le passé (carte en retard)', () => {
    expect(cardIssues(carte({ lr: 5000, d: 1000 + 5000 }))).not.toContain('due-after-review');
  });
  it('rejette une échéance antérieure à la dernière révision', () => {
    expect(cardIssues(carte({ lr: 5000, d: 1000 }))).toContain('due-after-review');
  });
});

describe('step-coherent', () => {
  it('exige un palier entier ≥ 0 pendant apprentissage ou rechute', () => {
    expect(cardIssues(carte({ st: 1, sp: 0 }))).not.toContain('step-coherent');
    expect(cardIssues(carte({ st: 3, sp: -1 }))).toContain('step-coherent');
    expect(cardIssues(carte({ st: 1 }))).toContain('step-coherent');
  });
  it('interdit un palier posé pendant la révision', () => {
    expect(cardIssues(carte({ st: 2, sp: 0, S: 5, D: 4, n: 1 }))).toContain('step-coherent');
    expect(cardIssues(carte({ st: 2, S: 5, D: 4, n: 1 }))).not.toContain('step-coherent');
  });
});

describe('counts', () => {
  it('rejette des compteurs négatifs ou non entiers', () => {
    expect(cardIssues(carte({ n: -1 }))).toContain('counts');
    expect(cardIssues(carte({ n: 1.5 }))).toContain('counts');
    expect(cardIssues(carte({ l: -1 }))).toContain('counts');
  });
  it('rejette plus de rechutes que de révisions', () => {
    expect(cardIssues(carte({ n: 2, l: 3 }))).toContain('counts');
  });
  it('accepte des rechutes égales aux révisions', () => {
    expect(cardIssues(carte({ n: 3, l: 3, S: 1, D: 1 }))).not.toContain('counts');
  });
});
