// Ce que chaque offre ouvre (src/offres.js) : la règle que la démo applique
// déjà et que la vraie app appliquera avec le paiement.
import { describe, expect, it } from 'vitest';
import { IA_PAR_MOIS, IA_PROF_PAR_MOIS, LIVRES_GRATUITS, MOTEUR, OFFRES, iaParMois, livresPermis, permis, voletPermis } from '../src/offres.js';

describe('les offres', () => {
  it('Mirandola gratuit : Lite, 5 livres, sans IA ni exercices ni images', () => {
    expect(MOTEUR.gratuit).toBe('lite');
    expect(livresPermis('gratuit', LIVRES_GRATUITS - 1)).toBe(true);
    expect(livresPermis('gratuit', LIVRES_GRATUITS)).toBe(false);
    for (const f of ['ia', 'photo', 'fichier', 'exercices', 'media', 'journal']) expect(permis('gratuit', f)).toBe(false);
    expect(permis('gratuit', 'recitation')).toBe(true);
    expect(IA_PAR_MOIS.gratuit).toBe(0);
    expect(voletPermis('gratuit', 'memoire')).toBe(false);
    expect(voletPermis('gratuit', 'regularite')).toBe(true);
  });

  it('Mirandola+ et Campus : Ultra et tout le reste', () => {
    for (const o of ['plus', 'campus']) {
      expect(MOTEUR[o]).toBe('ultra');
      expect(livresPermis(o, 500)).toBe(true);
      for (const f of ['ia', 'photo', 'exercices', 'media', 'journal']) expect(permis(o, f)).toBe(true);
      expect(voletPermis(o, 'memoire')).toBe(true);
      expect(IA_PAR_MOIS[o]).toBe(30);
      expect(iaParMois(o, true)).toBe(IA_PROF_PAR_MOIS);
    }
    expect(OFFRES).toEqual(['gratuit', 'plus', 'campus']);
  });

  it('un professeur prépare pour toute une classe : l’IA sans compter, mais jamais en gratuit', () => {
    expect(IA_PROF_PAR_MOIS).toBeGreaterThan(IA_PAR_MOIS.plus * 10);
    expect(iaParMois('gratuit', true)).toBe(0);
    expect(iaParMois('plus', false)).toBe(30);
  });
});
