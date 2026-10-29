import { describe, it, expect } from 'vitest';
import {
  COULEURS, EMBLEMES, contraste, couleurDe, embleme, emblemeDe, emblemeValide, figureValide,
  hachage, initiales, jetonGroupe, jetonPersonne, rangCouleur, teinte
} from '../src/jeton.js';
import { I } from '../src/icones.js';

describe('jetons : les listes fermées', () => {
  it('douze couleurs distinctes, toutes lisibles en blanc (WCAG AA)', () => {
    expect(COULEURS).toHaveLength(12);
    expect(new Set(COULEURS).size).toBe(12);
    for (const c of COULEURS) {
      expect(c).toMatch(/^#[0-9A-F]{6}$/);
      expect(contraste(c, '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('chaque clé passe la contrainte de la base et chaque emblème a son icône', () => {
    for (const k of Object.keys(EMBLEMES)) expect(k).toMatch(/^[a-z]{2,16}$/);
    for (const icone of Object.values(EMBLEMES)) expect(I[icone]).toBeTruthy();
  });

  it('refuse toute clé inconnue, même héritée', () => {
    expect(emblemeValide('livre')).toBe(true);
    expect(emblemeValide('toString')).toBe(false);
    expect(figureValide('avbcaedab')).toBe(true);           // un avatar
    expect(figureValide('renard')).toBe(true);              // une figure d'avant les avatars
    expect(figureValide('<img>')).toBe(false);
    expect(figureValide('Pas Une Clé')).toBe(false);
    expect(embleme('licorne')).toBe('livre');
  });
});

describe('jetons : stables sans rien stocker', () => {
  const id = '6f1c2a54-9b0e-4d7a-a1f3-2c8e5b7d9a10';
  it('le même identifiant donne toujours la même couleur et le même emblème', () => {
    expect(hachage(id)).toBe(hachage(id));
    expect(couleurDe(id)).toBe(couleurDe(id));
    expect(emblemeDe(id)).toBe(emblemeDe(id));
    expect(COULEURS).toContain(couleurDe(id));
    expect(emblemeValide(emblemeDe(id))).toBe(true);
  });

  it('le choix de chacun l’emporte, un choix invalide est ignoré', () => {
    expect(couleurDe(id, 3)).toBe(COULEURS[3]);
    expect(couleurDe(id, '5')).toBe(COULEURS[5]);
    for (const t of [12, -1, 2.5, null, '', 'x', undefined]) expect(rangCouleur(id, t)).toBe(hachage(id) % 12);
    expect(emblemeDe(id, 'globe')).toBe('globe');
    expect(emblemeDe(id, 'inconnu')).toBe(emblemeDe(id));
    expect(teinte(40)).toBe(COULEURS[0]);
    expect(teinte('3')).toBe(COULEURS[3]);
  });

  it('des identifiants différents se répartissent sur toute la palette', () => {
    const vus = new Set(), embs = new Set();
    for (let k = 0; k < 400; k++) { vus.add(couleurDe('id-' + k)); embs.add(emblemeDe('id-' + k)); }
    expect(vus.size).toBe(12);
    expect(embs.size).toBe(Object.keys(EMBLEMES).length);
  });
});

describe('jetons : des initiales qui ne trompent pas', () => {
  it('première lettre du premier et du dernier mot', () => {
    expect(initiales('Léa Martin')).toBe('LM');
    expect(initiales('Jean de La Fontaine')).toBe('JF');
    expect(initiales('MARTIN Léa')).toBe('ML');
    expect(initiales('ines.k')).toBe('IK');
    expect(initiales('@tom')).toBe('T');
    expect(initiales('élodie')).toBe('É');
    expect(initiales('Zoé L.')).toBe('ZL');
  });

  it('ni chiffre ni symbole en tête : rien qui ressemble à un rang ou une classe', () => {
    expect(initiales('2tom')).toBe('T');
    expect(initiales('CE1')).toBe('C');
    expect(initiales('Léa 2')).toBe('L');
    expect(initiales('')).toBe('?');
    expect(initiales('---')).toBe('?');
    expect(initiales(null)).toBe('?');
    expect(initiales('🦊')).toBe('?');
  });
});

describe('jetons : ce qu’on dessine', () => {
  it('une personne : son avatar si elle en a composé un, sinon ses initiales', () => {
    expect(jetonPersonne('u1', 'Léa Martin')).toEqual({ couleur: couleurDe('u1'), avatar: null, texte: 'LM' });
    const j = jetonPersonne('u1', 'Léa Martin', { figure: 'avbcaedab', teinte: 2 });
    expect(j.couleur).toBe(COULEURS[2]);
    expect(j.avatar).toMatchObject({ peau: 1, coiffure: 2, cheveux: 0, yeux: 4, bouche: 3, accessoire: 0, haut: 1, lunettes: 0 });
    // une figure d'avant les avatars (un émoji) devient un avatar tiré de son nom, le même partout
    expect(jetonPersonne('u1', 'Léa', { figure: 'renard' }).avatar).toEqual(jetonPersonne('u9', 'Zoé', { figure: 'renard' }).avatar);
    expect(jetonPersonne('u1', 'Léa', { figure: 'piège', teinte: 99 }).avatar).toBeNull();
  });

  it('une classe ou un club : un emblème, jamais un sigle tiré du nom', () => {
    const j = jetonGroupe('c1', { embleme: 'atome', teinte: 4 });
    expect(j).toEqual({ couleur: COULEURS[4], embleme: 'atome' });
    expect(Object.keys(jetonGroupe('c1'))).toEqual(['couleur', 'embleme']);
  });

  it('calcule le contraste comme le WCAG', () => {
    expect(contraste('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contraste('#777777', '#777777')).toBeCloseTo(1, 5);
  });
});
