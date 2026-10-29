import { describe, expect, it } from 'vitest';
import { PAR_GENERATION_DEFAUT, coutIA, eurosDe, parGeneration } from '../src/cout-ia.js';

describe('ce que coûte l’IA d’une licence', () => {
  it('le coût moyen mesuré, sinon notre estimation', () => {
    expect(parGeneration(0.84)).toBe(0.84);
    expect(parGeneration(null)).toBe(PAR_GENERATION_DEFAUT);
    expect(parGeneration(0)).toBe(PAR_GENERATION_DEFAUT);
  });
  it('un professeur particulier et ses élèves : toutes les générations accordées, au mois et à l’an', () => {
    const c = coutIA({ profs: 1, eleves: 12, iaProf: 400, iaEleve: 30, moyenne: 0.8 });
    expect(c.generations).toBe(400 + 12 * 30);
    expect(c.cents).toBe(Math.round(760 * 0.8));
    expect(c.centsAn).toBe(c.cents * 12);
    expect(c.estime).toBe(false);
  });
  it('rien d’accordé, rien à payer ; des saisies vides ou fausses comptent pour zéro', () => {
    expect(coutIA({ profs: 3, iaProf: 0 }).cents).toBe(0);
    expect(coutIA({ profs: 'x', eleves: -4, iaProf: 10, iaEleve: 10 }).generations).toBe(0);
    expect(coutIA().estime).toBe(true);
  });
  it('en euros, à la française', () => {
    expect(eurosDe(608)).toBe('6,08 €');
    expect(eurosDe(0.4)).toBe('0,00 €');
  });
});
