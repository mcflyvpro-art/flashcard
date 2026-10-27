// Une matière qui arrive d'un autre compte (src/matieres.js) : retrouvée par
// son nom, créée sinon, jamais confondue par identifiant.
import { describe, it, expect } from 'vitest';
import { choisirMatiere, couleurLibre, idLibre, slug, trouverParNom } from '../src/matieres.js';

const COULEURS = ['red', 'orange', 'green', 'pink'];
const mes = [
  { id: 'droit', name: 'Allemand', color: 'red' },        // un « droit » renommé : l'identifiant ment
  { id: 'eco', name: 'Éco', color: 'green' }
];

describe('choisirMatiere', () => {
  it('retrouve la sienne par le nom, sans casse ni accents', () => {
    expect(choisirMatiere(mes, { nom: 'eco' }, COULEURS)).toEqual({ id: 'eco', creer: null });
    expect(choisirMatiere(mes, { nom: '  ÉCO ' }, COULEURS)).toEqual({ id: 'eco', creer: null });
  });
  it('ne se fie jamais à l’identifiant d’un autre compte quand le nom voyage', () => {
    const r = choisirMatiere(mes, { nom: 'Droit', id: 'droit' }, COULEURS);
    expect(r.id).toBe('droit-2');
    expect(r.creer).toEqual({ id: 'droit-2', name: 'Droit', color: 'orange', pos: 2 });
  });
  it('crée celle qu’on n’a pas : un devoir de Géographie arrive en Géographie', () => {
    expect(choisirMatiere(mes, { nom: 'Géographie' }, COULEURS).creer).toMatchObject({ id: 'geographie', name: 'Géographie' });
  });
  it('sans nom : un identifiant connu est gardé (sauvegarde du même compte), sinon sans matière', () => {
    expect(choisirMatiere(mes, { id: 'eco' }, COULEURS)).toEqual({ id: 'eco', creer: null });
    expect(choisirMatiere(mes, { id: 'histoire' }, COULEURS)).toEqual({ id: '', creer: null });
    expect(choisirMatiere(mes, {}, COULEURS)).toEqual({ id: '', creer: null });
    expect(choisirMatiere(mes, null, COULEURS)).toEqual({ id: '', creer: null });
  });
  it('un nom trop long est coupé à 60 signes, comme en base', () => {
    expect(choisirMatiere([], { nom: 'x'.repeat(80) }, COULEURS).creer.name).toHaveLength(60);
  });
});

describe('les briques', () => {
  it('slug, identifiant libre, couleur la moins employée', () => {
    expect(slug('Sciences éco & sociales')).toBe('sciences-eco-sociales');
    expect(slug('!!!')).toBe('matiere');
    expect(idLibre([{ id: 'eco' }, { id: 'eco-2' }], 'Éco')).toBe('eco-3');
    expect(couleurLibre(mes, COULEURS)).toBe('orange');
    expect(couleurLibre([], COULEURS)).toBe('red');
    // une ancienne clé (corail) compte pour la teinte qui l'a remplacée (orange)
    expect(couleurLibre([{ color: 'coral' }], ['orange', 'blue'])).toBe('blue');
    expect(trouverParNom(mes, '')).toBe(null);
  });
});
