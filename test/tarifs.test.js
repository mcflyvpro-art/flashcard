// Le prix d'une licence d'établissement (src/tarifs.js) : dégressif par tranches.
import { describe, expect, it } from 'vitest';
import { MINIMUM, PLACES_DU_MINIMUM, TRANCHES, detailCampus, eurosHT, parPlace, prixCampus } from '../src/tarifs.js';

describe('la licence Campus', () => {
  it('un petit groupe paie le minimum : un professeur particulier et ses quinze élèves', () => {
    expect(prixCampus(16)).toBe(MINIMUM);
    expect(PLACES_DU_MINIMUM).toBe(20);
    expect(prixCampus(20)).toBe(MINIMUM);
    expect(prixCampus(21)).toBe(10500);
  });
  it('chaque place au prix de sa tranche', () => {
    expect(prixCampus(100)).toBe(50000);
    expect(prixCampus(300)).toBe(50000 + 200 * 350);
    expect(prixCampus(1080)).toBe(50000 + 400 * 350 + 580 * 250);
    expect(prixCampus(2000)).toBe(50000 + 400 * 350 + 1000 * 250 + 500 * 200);
    expect(detailCampus(120)).toEqual([{ places: 100, prix: 500, total: 50000 }, { places: 20, prix: 350, total: 7000 }]);
  });
  it('une place de plus ne fait jamais baisser la facture, et le prix moyen ne monte jamais', () => {
    for (let n = 1; n < 2600; n++) {
      expect(prixCampus(n + 1)).toBeGreaterThanOrEqual(prixCampus(n));
      if (n > PLACES_DU_MINIMUM) expect(parPlace(n + 1)).toBeLessThanOrEqual(parPlace(n) + 1);
    }
  });
  it('des tranches dans l’ordre, de moins en moins chères', () => {
    TRANCHES.slice(1).forEach((t, i) => {
      expect(t.jusqua).toBeGreaterThan(TRANCHES[i].jusqua);
      expect(t.prix).toBeLessThan(TRANCHES[i].prix);
    });
  });
  it('rien pour aucune place, et une saisie quelconque ne casse rien', () => {
    expect(prixCampus(0)).toBe(0);
    expect(prixCampus('abc')).toBe(0);
    expect(prixCampus(-5)).toBe(0);
    expect(parPlace(0)).toBe(0);
  });
  it('les prix s’écrivent à la française, sans se couper', () => {
    expect(eurosHT(335000)).toBe('3 350 €');
    expect(eurosHT(350)).toBe('3,50 €');
    expect(eurosHT(10000)).toBe('100 €');
  });
});
