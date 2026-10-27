// Ce que chaque offre ouvre (src/offres.js) : la règle que la démo applique
// déjà et que la vraie app appliquera avec le paiement.
import { describe, expect, it } from 'vitest';
import { IA_PAR_MOIS, LIVRES_GRATUITS, MOTEUR, OFFRES, livresPermis, permis, voletPermis } from '../src/offres.js';

describe('les offres', () => {
  it('Folio gratuit : Lite, 5 livres, sans IA ni exercices ni images', () => {
    expect(MOTEUR.gratuit).toBe('lite');
    expect(livresPermis('gratuit', LIVRES_GRATUITS - 1)).toBe(true);
    expect(livresPermis('gratuit', LIVRES_GRATUITS)).toBe(false);
    for (const f of ['ia', 'photo', 'fichier', 'exercices', 'media', 'journal']) expect(permis('gratuit', f)).toBe(false);
    expect(permis('gratuit', 'recitation')).toBe(true);
    expect(IA_PAR_MOIS.gratuit).toBe(0);
    expect(voletPermis('gratuit', 'memoire')).toBe(false);
    expect(voletPermis('gratuit', 'regularite')).toBe(true);
  });

  it('Folio+ et Campus : Ultra et tout le reste', () => {
    for (const o of ['plus', 'campus']) {
      expect(MOTEUR[o]).toBe('ultra');
      expect(livresPermis(o, 500)).toBe(true);
      for (const f of ['ia', 'photo', 'exercices', 'media', 'journal']) expect(permis(o, f)).toBe(true);
      expect(voletPermis(o, 'memoire')).toBe(true);
      expect(IA_PAR_MOIS[o]).toBe(50);
    }
    expect(OFFRES).toEqual(['gratuit', 'plus', 'campus']);
  });
});
