// « J'ai un code » universel (2026-11-16) : src/codes.js reconnaît chaque code à sa forme.
import { describe, it, expect } from 'vitest';
import { quelCode } from '../src/codes.js';

describe('quelCode — ce qu’on tape', () => {
  it('six chiffres : une partie en direct, écrite « 123 456 »', () => {
    expect(quelCode('123456')).toMatchObject({ genre: 'partie', valeur: '123456', lisible: '123 456', complet: true });
    expect(quelCode('123 4')).toMatchObject({ genre: 'partie', complet: false });
  });
  it('huit signes : un code (établissement, professeur, classe ou club), écrit par quatre', () => {
    expect(quelCode('47hwzka9')).toMatchObject({ genre: 'code', valeur: '47HWZKA9', lisible: '47HW-ZKA9', complet: true, club: false });
    expect(quelCode('47HW')).toMatchObject({ genre: 'code', complet: false });
  });
  it('un code fait de huit chiffres reste un code', () => {
    expect(quelCode('23456789')).toMatchObject({ genre: 'code', complet: true });
  });
  it('dix signes : un paquet, écrit « ABCD-EFGH-JK »', () => {
    expect(quelCode('abcdefghjk')).toMatchObject({ genre: 'paquet', valeur: 'abcdefghjk', lisible: 'ABCD-EFGH-JK', complet: true });
  });
  it('« @pseudo » : un ami, en minuscules', () => {
    expect(quelCode('@SAM')).toMatchObject({ genre: 'ami', valeur: 'sam', lisible: '@sam', complet: true });
    expect(quelCode('@sa')).toMatchObject({ genre: 'ami', complet: false });
    expect(quelCode('@')).toMatchObject({ genre: 'ami', complet: false });
  });
  it('rien : un code vide', () => {
    expect(quelCode('')).toMatchObject({ genre: 'code', valeur: '', complet: false });
  });
});

describe('quelCode — ce qu’on colle', () => {
  it('un lien dit ce qu’il est', () => {
    expect(quelCode('https://mirandola.fr/?club=47hw-zka9')).toMatchObject({ genre: 'code', valeur: '47HWZKA9', club: true, complet: true });
    expect(quelCode('https://mirandola.fr/?defi=123456')).toMatchObject({ genre: 'partie', valeur: '123456', complet: true });
    expect(quelCode('https://mirandola.fr/#s=abcdefghjk')).toMatchObject({ genre: 'paquet', complet: true });
    expect(quelCode('https://mirandola.fr/?rejoindre=K7QM2XRP')).toMatchObject({ genre: 'code', valeur: 'K7QM2XRP', club: false });
    expect(quelCode('https://mirandola.fr/?ami=sam')).toMatchObject({ genre: 'ami', valeur: 'sam', complet: true });
  });
  it('un message entier : le code qu’il porte', () => {
    expect(quelCode('Rejoins « Viva la vida » sur Mirandola : code 47HW-ZKA9, dans Mes amis › Entrer un code'))
      .toMatchObject({ genre: 'code', valeur: '47HWZKA9', complet: true });
    expect(quelCode('Mon paquet : ABCD-EFGH-JK')).toMatchObject({ genre: 'paquet', valeur: 'abcdefghjk', complet: true });
    expect(quelCode('La partie : 123 456 !')).toMatchObject({ genre: 'partie', valeur: '123456', complet: true });
    expect(quelCode('Ajoute-moi : @sam.b')).toMatchObject({ genre: 'ami', valeur: 'sam.b', complet: true });
  });
  it('un message qui porte un lien : le lien l’emporte', () => {
    expect(quelCode('Rejoins mon club : code 47HW-ZKA9 https://mirandola.fr/?club=47HW-ZKA9'))
      .toMatchObject({ genre: 'code', club: true, complet: true });
  });
});
