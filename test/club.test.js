/* L'identité d'un club et les classements du cercle (src/club.js). */
import { describe, it, expect } from 'vitest';
import {
  classement, codeClubDepuisTexte, codeClubLisible, deviseValide, lienClub, medaille, nomClubValide, pourcent, rangTexte
} from '../src/club.js';

describe('un club', () => {
  it('un nom de 2 à 40 caractères, une devise de 90 au plus', () => {
    expect(nomClubValide(' a ')).toBe(false);
    expect(nomClubValide('Les Hiboux')).toBe(true);
    expect(nomClubValide('x'.repeat(41))).toBe(false);
    expect(deviseValide('x'.repeat(90))).toBe(true);
    expect(deviseValide('x'.repeat(91))).toBe(false);
  });
  it('le code se lit par paquets de 4 et se retrouve dans un lien', () => {
    expect(codeClubLisible('j2pjncn4')).toBe('J2PJ-NCN4');
    expect(codeClubDepuisTexte('https://folio.app/?club=J2PJ-NCN4')).toBe('J2PJNCN4');
    expect(lienClub('https://folio.app/x?y=1', 'j2pj ncn4')).toBe('https://folio.app/x?club=J2PJNCN4');
  });
});

describe('un classement', () => {
  const rows = [{ uid: 'b', n: 40 }, { uid: 'a', n: 120 }, { uid: 'c', n: 40 }, { uid: 'd', n: 0 }];
  it('trie, partage les places à égalité, repère qui regarde', () => {
    const l = classement(rows, 'n', 'c');
    expect(l.map(r => r.uid)).toEqual(['a', 'b', 'c', 'd']);
    expect(l.map(r => r.place)).toEqual([1, 2, 2, 4]);
    expect(l.find(r => r.moi).uid).toBe('c');
    expect(l.map(r => r.part)).toEqual([100, 33, 33, 0]);
  });
  it('médailles, pourcentages et rang en toutes lettres', () => {
    expect(medaille(1)).toBe('🥇');
    expect(medaille(4)).toBe('');
    expect(pourcent(3, 4)).toBe(75);
    expect(pourcent(0, 0)).toBe(0);
    expect(rangTexte(1, 12)).toBe('1er sur 12');
    expect(rangTexte(3, 12)).toBe('3e sur 12');
  });
});
