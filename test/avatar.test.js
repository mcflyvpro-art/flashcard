/* Les avatars (src/avatar.js) : la clé que la base garde, et le dessin
   qu'elle donne — toujours le même, jamais invalide. */
import { describe, it, expect } from 'vitest';
import {
  AFFICHE, NEUTRE, ONGLETS, ORDRE, TRAITS, auHasard, avatarDe, avatarDeCle, avatarSvg, choixDe, ecrireAvatar, estAvatar,
  lireAvatar, normaliser
} from '../src/avatar.js';

const exemple = normaliser({ peau: 1, coiffure: 2, cheveux: 0, yeux: 4, bouche: 3, accessoire: 0, haut: 1 });

describe('avatar : la clé', () => {
  it('s’écrit « av » + une lettre par trait, et passe la contrainte de la base', () => {
    const k = ecrireAvatar(exemple);
    expect(k).toBe('avbcaedab');
    expect(k).toMatch(/^[a-z]{2,16}$/);
    expect(estAvatar(k)).toBe(true);
  });
  it('se relit à l’identique, pour chaque choix de chaque trait', () => {
    for (const t of ORDRE) {
      for (const v of choixDe(t)) {
        const a = { ...exemple, [t]: v };
        expect(lireAvatar(ecrireAvatar(a))).toEqual(a);
      }
    }
  });
  it('quatorze traits au plus : jamais plus de 16 caractères, la limite de la base', () => {
    expect(ORDRE.length).toBe(14);
    const tout = Object.fromEntries(ORDRE.map(t => [t, choixDe(t).at(-1)]));
    expect(ecrireAvatar(tout)).toMatch(/^av[a-z]{14}$/);
    for (let i = 0; i < 200; i++) expect(ecrireAvatar(auHasard())).toMatch(/^[a-z]{2,16}$/);
    for (const t of ORDRE) expect(TRAITS[t].length, t).toBeLessThanOrEqual(26);
  });
  it('un avatar d’avant garde sa clé : les lettres de fin par défaut ne s’écrivent pas', () => {
    for (const k of ['avbcaedab', 'avbdfbdef', 'avdcheeec']) expect(ecrireAvatar(lireAvatar(k))).toBe(k);
    expect(ecrireAvatar(NEUTRE)).toMatch(/^av[a-z]{7}$/);
  });
  it('les lunettes et les boucles d’avant passent à leur trait, au même dessin', () => {
    const ancien = lireAvatar('avcbhaacg');                                   // « lunettes carrées » en accessoire
    expect(ancien).toMatchObject({ accessoire: 0, lunettes: 2 });
    expect(ecrireAvatar(ancien)).toBe('avcbhaaagaaaaac');
    expect(avatarSvg(ancien)).toBe(avatarSvg({ ...ancien, accessoire: 2, lunettes: 0 }));
    expect(normaliser({ ...exemple, accessoire: 5 })).toMatchObject({ accessoire: 0, bijoux: 1 });
    // un bonnet ET des lunettes ET des créoles
    const a = normaliser({ ...exemple, accessoire: 6, lunettes: 1, bijoux: 3 });
    expect(lireAvatar(ecrireAvatar(a))).toMatchObject({ accessoire: 6, lunettes: 1, bijoux: 3 });
  });
  it('une valeur hors de la liste revient dedans', () => {
    const a = lireAvatar(ecrireAvatar({ ...exemple, coiffure: 99, peau: -1 }));
    expect(a.coiffure).toBeLessThan(TRAITS.coiffure.length);
    expect(a.peau).toBeGreaterThanOrEqual(0);
  });
  it('ni une figure d’avant, ni n’importe quoi n’est lu comme un avatar', () => {
    for (const k of ['renard', 'alien', 'avion', 'av', 'avbcaed', 'avbcaedabzzzzzzzz', 'AVBCAEDAB', '', null, 42]) expect(lireAvatar(k)).toBeNull();
  });
});

describe('avatar : stable sans rien stocker', () => {
  it('la même graine donne le même avatar, le même qu’avant le 2026-10-29', () => {
    expect(avatarDe('u1')).toEqual(avatarDe('u1'));
    expect(ecrireAvatar(avatarDeCle('renard'))).toBe('avbdfbdef');
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
  it('chaque trait a son onglet ; ce qu’on présente est une permutation de ce qui existe, moins ce qui a migré', () => {
    expect(ONGLETS.map(o => o[0]).sort()).toEqual([...ORDRE].sort());
    for (const [t, l] of Object.entries(AFFICHE)) {
      expect(new Set(l).size, t).toBe(l.length);
      for (const v of l) expect(v, t).toBeLessThan(TRAITS[t].length);
    }
    expect(choixDe('accessoire')).not.toEqual(expect.arrayContaining([1]));
    expect(choixDe('peau')).toHaveLength(TRAITS.peau.length);
  });
  it('des peaux, des cheveux, des tenues pour tout le monde', () => {
    expect(TRAITS.peau.length).toBeGreaterThanOrEqual(14);
    expect(TRAITS.coiffure).toEqual(expect.arrayContaining(['afro', 'locks', 'nattes collées', 'hijab', 'turban', 'sans cheveux']));
    expect(TRAITS.bijoux).toContain('appareil auditif');
    expect(TRAITS.barbe.length).toBeGreaterThan(4);
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
