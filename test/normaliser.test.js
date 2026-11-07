// norm() (src/normaliser.js) : la réponse tapée comparée à la page, dans un
// quiz, et les doublons d'un livre. Ce que les tests de mutation
// (2026-11-07) ont montré non gardé : chaque étape, une à une.
import { describe, expect, it } from 'vitest';
import { norm } from '../src/normaliser.js';

describe('norm', () => {
  it('sans blancs autour, en minuscules', () => { expect(norm('  Bonjour  ')).toBe('bonjour'); });
  it('les blancs du milieu ramenés à un seul espace', () => { expect(norm('a  \t b')).toBe('a b'); });
  it('toute la ponctuation de fin retirée, même collée, même après un espace', () => {
    expect(norm('Quoi ?!')).toBe('quoi');
    expect(norm('Vraiment...')).toBe('vraiment');
  });
  it('les apostrophes typographiques valent l’apostrophe droite', () => { expect(norm('l’été')).toBe(norm("l'été")); });
});
