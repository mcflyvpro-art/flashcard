/* Les avatars (src/avatar.js) : la clé que la base garde, et le dessin
   qu'elle donne — toujours le même, jamais invalide. */
import { describe, it, expect } from 'vitest';
import { ORDRE, TRAITS, avatarDe, avatarDeCle, avatarSvg, ecrireAvatar, estAvatar, lireAvatar } from '../src/avatar.js';

const exemple = { peau: 1, coiffure: 2, cheveux: 0, yeux: 4, bouche: 3, accessoire: 0, haut: 1 };

describe('avatar : la clé', () => {
  it('s’écrit « av » + une lettre par trait, et passe la contrainte de la base', () => {
    const k = ecrireAvatar(exemple);
    expect(k).toBe('avbcaedab');
    expect(k).toMatch(/^[a-z]{2,16}$/);
    expect(estAvatar(k)).toBe(true);
  });
  it('se relit à l’identique, pour chaque valeur de chaque trait', () => {
    for (const t of ORDRE) {
      for (let v = 0; v < TRAITS[t].length; v++) {
        const a = { ...exemple, [t]: v };
        expect(lireAvatar(ecrireAvatar(a))).toEqual(a);
      }
    }
  });
  it('une valeur hors de la liste revient dedans', () => {
    const a = lireAvatar(ecrireAvatar({ ...exemple, coiffure: 99, peau: -1 }));
    expect(a.coiffure).toBeLessThan(TRAITS.coiffure.length);
    expect(a.peau).toBeGreaterThanOrEqual(0);
  });
  it('ni une figure d’avant, ni n’importe quoi n’est lu comme un avatar', () => {
    for (const k of ['renard', 'alien', 'avion', 'av', 'avbcaedabz', 'AVBCAEDAB', '', null, 42]) expect(lireAvatar(k)).toBeNull();
  });
});

describe('avatar : stable sans rien stocker', () => {
  it('la même graine donne le même avatar', () => {
    expect(avatarDe('u1')).toEqual(avatarDe('u1'));
    expect(avatarDeCle('renard')).toEqual(avatarDeCle('renard'));
    expect(avatarDeCle(null)).toBeNull();
  });
  it('des graines différentes varient les avatars', () => {
    const cles = new Set(Array.from({ length: 50 }, (_, i) => ecrireAvatar(avatarDe('u' + i))));
    expect(cles.size).toBeGreaterThan(40);
  });
});

describe('avatar : le dessin', () => {
  it('chaque valeur de chaque trait donne un SVG bien formé, sans texte libre', () => {
    for (const t of ORDRE) {
      for (let v = 0; v < TRAITS[t].length; v++) {
        const s = avatarSvg({ ...exemple, [t]: v });
        expect(s.startsWith('<svg class="visage"')).toBe(true);
        expect(s.endsWith('</svg>')).toBe(true);
        expect(s).not.toMatch(/undefined|NaN|null/);
        expect((s.match(/</g) || []).length).toBe((s.match(/>/g) || []).length);
      }
    }
  });
  it('deux traits différents ne dessinent pas la même chose', () => {
    for (const t of ORDRE) {
      const vus = new Set(TRAITS[t].map((_, v) => avatarSvg({ ...exemple, [t]: v })));
      expect(vus.size).toBe(TRAITS[t].length);
    }
  });
  it('un titre en fait une image nommée, sinon décorative', () => {
    expect(avatarSvg(exemple, 'Mon avatar')).toContain('role="img" aria-label="Mon avatar"');
    expect(avatarSvg(exemple)).toContain('aria-hidden="true"');
  });
});
