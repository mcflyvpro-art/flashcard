/* Retoucher un paquet entier par l'IA (src/retouche.js) : une carte gardée
   ou corrigée reste la même carte — son identifiant, son état
   d'apprentissage, ses médias —, une neuve part de zéro, une retirée s'en va. */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  MAX_RETOUCHE, aChange, appliquer, bilanTexte, maxRetouche, pourIA, ressemblance, retouchable
} from '../src/retouche.js';

const carte = (id, f, b, plus = {}) => ({ id, f, b, S: 12.5, D: 4.2, st: 2, d: 1800000000000, n: 3, l: 1, ...plus });
const PAQUET = [
  carte('c1', 'Paris', 'Capitale de la France'),
  carte('c2', 'Rome', 'Capitale de l’Itlaie', { fi: 'media/rome.jpg' }),
  carte('c3', 'Berlin', 'Capitale de l’Allemagne', { x: 1 }),
  carte('c4', 'Madrid', 'Capitale de l’Espagne')
];
let n = 0;
const neuf = () => 'n' + (++n);

describe('remettre la liste de l’IA dans le paquet', () => {
  it('une carte inchangée reste la même carte, objet compris', () => {
    const r = appliquer(PAQUET, pourIA(PAQUET), neuf);
    expect(r.cartes).toHaveLength(4);
    r.cartes.forEach((c, i) => expect(c).toBe(PAQUET[i]));
    expect(r.bilan).toEqual({ gardees: 4, modifiees: 0, ajoutees: 0, retirees: 0 });
    expect(aChange(r.bilan)).toBe(false);
    expect(bilanTexte(r.bilan)).toBe('Rien n’a changé');
  });

  it('une faute corrigée au verso garde l’identifiant, l’état, l’image ; la casse et les accents ne comptent pas', () => {
    const rendues = pourIA(PAQUET).map(c => (c.f === 'Rome' ? { f: 'Rome', b: 'Capitale de l’Italie' } : c));
    rendues[0] = { f: 'PARIS', b: 'Capitale de la France' };
    const r = appliquer(PAQUET, rendues, neuf);
    const rome = r.cartes.find(c => c.f === 'Rome');
    expect(rome).toMatchObject({ id: 'c2', S: 12.5, D: 4.2, st: 2, fi: 'media/rome.jpg', b: 'Capitale de l’Italie' });
    expect(r.cartes[0].id).toBe('c1');
    expect(r.bilan.modifiees).toBe(2);              // « PARIS » : le texte a changé, la carte reste
  });

  it('un recto reformulé (même verso), une carte réécrite de près : l’état suit', () => {
    const rendues = [
      { f: 'La ville de Paris', b: 'Capitale de la France' },
      { f: 'Rome', b: 'Capitale de l’Itlaie' },
      { f: 'Berlin', b: 'La capitale de l’Allemagne.' },
      { f: 'Madrid', b: 'Capitale de l’Espagne' }
    ];
    const r = appliquer(PAQUET, rendues, neuf);
    expect(r.cartes.map(c => c.id)).toEqual(['c1', 'c2', 'c3', 'c4']);
    expect(r.cartes[2].x).toBe(1);                  // la suspension reste
    expect(r.bilan).toMatchObject({ modifiees: 2, gardees: 2, ajoutees: 0, retirees: 0 });
  });

  it('inverser recto et verso : des cartes neuves (une autre question), les anciennes retirées', () => {
    const r = appliquer(PAQUET, pourIA(PAQUET).map(c => ({ f: c.b, b: c.f })), neuf);
    expect(r.bilan.ajoutees + r.bilan.modifiees).toBe(4);
    expect(r.cartes.every(c => !['Paris', 'Rome', 'Berlin', 'Madrid'].includes(c.f))).toBe(true);
  });

  it('ajouter, retirer, réordonner : l’ordre est celui de l’IA', () => {
    const rendues = [
      { f: 'Madrid', b: 'Capitale de l’Espagne' },
      { f: 'Paris', b: 'Capitale de la France' },
      { f: 'Lisbonne', b: 'Capitale du Portugal' }
    ];
    const r = appliquer(PAQUET, rendues, neuf);
    expect(r.cartes.map(c => c.id)).toEqual(['c4', 'c1', expect.stringMatching(/^n\d+$/)]);
    expect(r.cartes[2]).toEqual({ f: 'Lisbonne', b: 'Capitale du Portugal', id: r.cartes[2].id });
    expect(r.bilan).toEqual({ gardees: 2, modifiees: 0, ajoutees: 1, retirees: 2 });
    expect(bilanTexte(r.bilan)).toBe('1 ajoutée · 2 retirées');
  });

  it('deux cartes identiques ne prennent jamais la même ancienne ; les vides sont écartées', () => {
    const r = appliquer([carte('a', 'chat', 'cat')], [{ f: 'chat', b: 'cat' }, { f: 'chat', b: 'cat' }, { f: ' ', b: '' }], neuf);
    expect(r.cartes).toHaveLength(2);
    expect(r.cartes[0].id).toBe('a');
    expect(r.cartes[1].id).not.toBe('a');
  });

  it('la ressemblance : 1 pour égal, 0 pour rien de commun, entre les deux sinon', () => {
    expect(ressemblance('Capitale', 'capitale')).toBe(1);
    expect(ressemblance('abc', 'xyz')).toBe(0);
    const s = ressemblance('Capitale de l’Itlaie', 'Capitale de l’Italie');
    expect(s).toBeGreaterThan(0.7);
    expect(s).toBeLessThan(1);
  });
});

describe('ce qui se retouche', () => {
  it('un devoir, jamais ; au-delà de la limite de la fonction, non, en le disant', () => {
    expect(retouchable([{ id: 'a:d1:0', f: 'x', b: 'y' }], 'plus')).toEqual({ ok: false, raison: 'devoir' });
    const cent = Array.from({ length: 121 }, (_, i) => ({ id: 'c' + i, f: 'r' + i, b: 'v' + i }));
    expect(retouchable(cent, 'plus')).toEqual({ ok: false, raison: 'trop', max: 120 });
    expect(retouchable(cent, 'infini')).toEqual({ ok: true });
    expect(retouchable([], 'plus')).toEqual({ ok: true });      // un paquet vide : l'IA peut le remplir
  });

  it('les limites sont celles de la fonction ai', () => {
    const src = readFileSync('supabase/functions/ai/index.ts', 'utf8');
    expect(+src.match(/const MAX_CARDS = (\d+);/)[1]).toBe(MAX_RETOUCHE.plus);
    expect(+src.match(/const INFINI = \{[^}]*cartes: (\d+)/)[1]).toBe(MAX_RETOUCHE.infini);
    expect(maxRetouche('campus')).toBe(120);
  });
});
