import { describe, it, expect } from 'vitest';
import {
  MATIERES, matieresApres, NIVEAUX_PERSO, OBJECTIFS, prenomValide, propositions
} from '../src/bienvenue.js';
import { estAvatar } from '../src/avatar.js';

describe('propositions — six visages', () => {
  it('six avatars valides, chacun sur une couleur', () => {
    const l = propositions('compte-1');
    expect(l).toHaveLength(6);
    for (const p of l) { expect(estAvatar(p.cle)).toBe(true); expect(p.teinte).toBeGreaterThanOrEqual(0); expect(p.teinte).toBeLessThan(12); }
  });
  it('les mêmes pour le même compte et le même tour, d’autres au tour suivant', () => {
    expect(propositions('compte-1', 0)).toEqual(propositions('compte-1', 0));
    expect(propositions('compte-1', 1).map(p => p.cle)).not.toEqual(propositions('compte-1', 0).map(p => p.cle));
  });
});

// le pseudo a sa règle à lui, src/pseudo.js (test/pseudo.test.js)
describe('prénom', () => {
  it('un vrai prénom', () => {
    expect(prenomValide('Léa')).toBe(true);
    expect(prenomValide('Jean-Luc')).toBe(true);
    expect(prenomValide('')).toBe(false);
    expect(prenomValide('42')).toBe(false);
  });
});

describe('matieresApres — les matières cochées remplacent les exemples', () => {
  const couleurs = ['red', 'blue', 'green', 'yellow'];
  const exemples = [{ id: 'italien', name: 'Italien', color: 'red' }, { id: 'anglais', name: 'Anglais', color: 'blue' },
    { id: 'droit', name: 'Droit', color: 'green' }];
  it('garde ce qui est coché (même nom, sans casse), crée le reste, retire les exemples', () => {
    const r = matieresApres(exemples, [], ['anglais', 'Mathématiques'], couleurs);
    expect(r.liste.map(s => s.name)).toEqual(['Anglais', 'Mathématiques']);
    expect(r.liste[0].id).toBe('anglais');
    expect(r.liste[1]).toMatchObject({ id: 'mathematiques', pos: 1 });
    expect(r.retirees.map(s => s.id).sort()).toEqual(['droit', 'italien']);
  });
  it('ne retire jamais une matière qu’un livre emploie', () => {
    const r = matieresApres(exemples, [{ subject: 'droit' }], ['SVT'], couleurs);
    expect(r.liste.map(s => s.name)).toEqual(['SVT', 'Droit']);
    expect(r.retirees.map(s => s.id)).toEqual(['italien', 'anglais']);
  });
  it('deux nouvelles matières n’ont pas la même couleur', () => {
    const r = matieresApres([], [], ['SVT', 'NSI'], couleurs);
    expect(r.liste[0].color).not.toBe(r.liste[1].color);
  });
});

describe('les listes proposées', () => {
  it('un jeu de matières par niveau, quatre objectifs croissants', () => {
    for (const k of Object.keys(NIVEAUX_PERSO)) expect(MATIERES[k].length).toBeGreaterThan(4);
    expect(OBJECTIFS.map(o => o.n)).toEqual([10, 20, 30, 50]);
  });
});
