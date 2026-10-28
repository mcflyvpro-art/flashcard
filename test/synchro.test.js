// La synchro légère entre appareils (src/synchro.js) : ce qui a bougé ailleurs.
import { describe, expect, it } from 'vitest';
import { ecarts, fusionnerMatieres, rangerLivres, signatureMatieres } from '../src/synchro.js';

const L = (id, rev, pos = 0) => ({ id, rev, pos, cards: [] });

describe('ce que l’autre appareil a changé', () => {
  it('rien n’a bougé : rien à relire', () => {
    expect(ecarts([{ id: 'a', rev: 3 }], [L('a', 3)])).toEqual({ changes: [], partis: [] });
  });
  it('une autre révision, ou un livre créé là-bas : à relire', () => {
    expect(ecarts([{ id: 'a', rev: 4 }, { id: 'b', rev: 1 }], [L('a', 3)]).changes).toEqual(['a', 'b']);
  });
  it('un livre supprimé là-bas : parti', () => {
    expect(ecarts([], [L('a', 3)]).partis).toEqual(['a']);
  });
  it('un livre créé ici, pas encore envoyé (sans révision) : jamais parti', () => {
    expect(ecarts([], [L('neuf', 0)]).partis).toEqual([]);
  });
  it('un livre qui attend d’être envoyé reste à soi : ni relu ni retiré', () => {
    expect(ecarts([{ id: 'a', rev: 9 }], [L('a', 3), L('b', 2)], { a: 1, b: 1 })).toEqual({ changes: [], partis: [] });
  });
});

describe('les matières et l’étagère', () => {
  it('les matières se comparent sans l’ordre d’arrivée', () => {
    const m = [{ id: 'x', name: 'Maths', color: 'blue', pos: 0 }, { id: 'y', name: 'SVT', color: 'green', pos: 1 }];
    expect(signatureMatieres(m)).toBe(signatureMatieres([m[1], m[0]]));
    expect(signatureMatieres(m)).not.toBe(signatureMatieres([{ ...m[0], name: 'Mathématiques' }, m[1]]));
  });
  it('l’étagère suit la position de la base, sans bouger les égalités', () => {
    expect(rangerLivres([L('c', 1, 2), L('a', 1, 0), L('b', 1, 0)]).map(d => d.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('les matières relues', () => {
  it('le serveur fait foi, sauf une matière créée ici dont un livre se sert', () => {
    const serveur = [{ id: 'm', name: 'Maths', color: 'blue', pos: 0, user_id: 'u' }];
    const locales = [{ id: 'm', name: 'Math', color: 'blue', pos: 0 }, { id: 'h', name: 'Histoire', color: 'red', pos: 1 },
      { id: 'x', name: 'Vide', color: 'olive', pos: 2 }];
    const { matieres, aRenvoyer } = fusionnerMatieres(serveur, locales, [{ id: 'd', subject: 'h' }]);
    expect(matieres.map(s => s.name)).toEqual(['Maths', 'Histoire']);
    expect(aRenvoyer.map(s => s.id)).toEqual(['h']);
    expect(matieres[0]).not.toHaveProperty('user_id');
  });
});
