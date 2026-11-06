import { describe, expect, it } from 'vitest';
import { codeLivre, estCodeLivre, lienLivre, tokComplet, tokDepuisTexte } from '../src/livre-code.js';

describe('le code d’un livre partagé', () => {
  it('se lit par paquets de quatre, en capitales', () => {
    expect(codeLivre('abcdefghjk')).toBe('ABCD-EFGH-JK');
    expect(codeLivre('abcd')).toBe('ABCD');
    expect(codeLivre('')).toBe('');
  });

  it('revient au jeton de la base, quelle que soit la façon de le donner', () => {
    expect(tokDepuisTexte('ABCD-EFGH-JK')).toBe('abcdefghjk');
    expect(tokDepuisTexte(' abcd efgh jk ')).toBe('abcdefghjk');
    expect(tokDepuisTexte('https://mirandola.fr/#s=abcdefghjk')).toBe('abcdefghjk');
    expect(tokDepuisTexte('https://mirandola.fr/app?livre=ABCD-EFGH-JK')).toBe('abcdefghjk');
    expect(tokDepuisTexte('« Capitales » sur Mirandola\nCode : ABCD-EFGH-JK')).toBe('abcdefghjk');
    expect(tokDepuisTexte('« Capitales »\nCode : ABCD-EFGH-JK\nhttps://mirandola.fr/#s=abcdefghjk')).toBe('abcdefghjk');
    expect(tokDepuisTexte('abcdefghjkmnpq')).toHaveLength(10);
  });

  it('n’est complet qu’avec dix signes de l’alphabet sans ambiguïté', () => {
    expect(tokComplet('abcdefghjk')).toBe(true);
    expect(tokComplet('abcdefghj')).toBe(false);
    expect(tokComplet('abcdefghjo')).toBe(false);          // ni O, ni 0, ni 1, ni I, ni L
    expect(tokComplet('abcdefghj1')).toBe(false);
    expect(tokComplet(null)).toBe(false);
  });

  it('se distingue des autres codes que reçoit « J’ai un code »', () => {
    expect(estCodeLivre('ABCD-EFGH-JK')).toBe(true);
    expect(estCodeLivre('ABCD-EFGH-J')).toBe(true);        // le neuvième signe suffit
    expect(estCodeLivre('ABCD-EFGH')).toBe(false);         // établissement, professeur, club
    expect(estCodeLivre('123 456')).toBe(false);           // une partie
    expect(estCodeLivre('https://mirandola.fr/#s=abcd')).toBe(true);
    expect(estCodeLivre('https://mirandola.fr/?rejoindre=ABCDEFGH')).toBe(false);
  });

  it('a son lien, qui porte le jeton dans le fragment (jamais envoyé au serveur)', () => {
    expect(lienLivre('https://mirandola.fr/', 'ABCD-EFGH-JK')).toBe('https://mirandola.fr/#s=abcdefghjk');
    expect(lienLivre('https://mirandola.fr/?x=1#y', 'abcdefghjk')).toBe('https://mirandola.fr/#s=abcdefghjk');
  });
});
