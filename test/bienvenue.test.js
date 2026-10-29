import { describe, it, expect } from 'vitest';
import {
  ANNEES, ajouterMatiere, anneeRequise, matieresApres, NIVEAUX_PERSO, nomMatiere, OBJECTIFS, prenomValide, proposees
} from '../src/bienvenue.js';

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

describe('les matières du niveau, cochées d’office', () => {
  it('le niveau dit, on propose ses matières déjà cochées, et d’autres à côté', () => {
    const t = proposees('lycee', 'terminale');
    expect(t.cochees).toContain('Philosophie');
    expect(proposees('lycee', 'seconde').cochees).not.toContain('Philosophie');   // la philosophie n'est qu'en Terminale
    expect(t.autres).toEqual(expect.arrayContaining(['Mathématiques', 'SES']));
    expect(t.autres.some(m => t.cochees.includes(m))).toBe(false);
  });
  it('chaque année, chaque filière a ses matières ; « Autre » n’en coche aucune', () => {
    for (const [n, annees] of Object.entries(ANNEES)) {
      expect(anneeRequise(n)).toBe(true);
      for (const a of Object.keys(annees)) expect(proposees(n, a).cochees.length, `${n}/${a}`).toBeGreaterThan(2);
    }
    expect(anneeRequise('autre')).toBe(false);
    expect(proposees('autre').cochees).toEqual([]);
    expect(proposees('autre').autres.length).toBeGreaterThan(4);
  });
  it('sans année connue, rien d’office', () => {
    expect(proposees('lycee', '')).toEqual({ cochees: [], autres: [] });
    expect(proposees('college', 'terminale')).toEqual({ cochees: [], autres: [] });
    expect(Object.keys(NIVEAUX_PERSO)).toEqual(['college', 'lycee', 'sup', 'autre']);
  });
  it('quatre objectifs croissants', () => {
    expect(OBJECTIFS.map(o => o.n)).toEqual([10, 20, 30, 50]);
  });
});

describe('une matière écrite à la main', () => {
  it('nettoyée : espaces, majuscule', () => {
    expect(nomMatiere('  droit   du travail ')).toBe('Droit du travail');
    expect(nomMatiere('c++')).toBe('C++');
    expect(nomMatiere('Histoire (L1)')).toBe('Histoire (L1)');
  });
  it('refusée si elle ne ressemble pas à une matière', () => {
    for (const v of ['', 'a', '42', '<script>', 'x'.repeat(41), '😀😀']) expect(nomMatiere(v), v).toBeNull();
  });
  it('une proposée se coche, une nouvelle s’ajoute', () => {
    expect(ajouterMatiere('philosophie', ['Philosophie', 'SES'])).toEqual({ nom: 'Philosophie', nouvelle: false });
    expect(ajouterMatiere('ses', ['Philosophie', 'SES'])).toEqual({ nom: 'SES', nouvelle: false });
    expect(ajouterMatiere('Latin', ['SES'])).toEqual({ nom: 'Latin', nouvelle: true });
    expect(ajouterMatiere('!', ['SES'])).toBeNull();
  });
});
