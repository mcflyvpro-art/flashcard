import { describe, it, expect } from 'vitest';
import {
  bilanSuppression, compterFiltres, FILTRES, filtrerComptes, finSuspension, plat, sansFin, SUSPENSIONS, TRIS, trierComptes
} from '../src/comptes.js';

const T = Date.parse('2026-11-05T12:00:00Z');
const jour = n => new Date(T - n * 864e5).toISOString();
const COMPTES = [
  { id: 'a', name: 'Élodie MARTIN', email: 'elodie@ex.fr', role: 'eleve', cree: jour(100), vu: jour(1), revise: jour(2),
    revisions: 400, livres: 3, offre: 'plus', confirme: true, suspendu: null, etablissement: null },
  { id: 'b', name: 'Paul Durand', email: 'paul@ex.fr', role: 'prof', cree: jour(10), vu: null, revise: null,
    revisions: 0, livres: 0, offre: 'gratuit', confirme: false, suspendu: null, etablissement: 'Lycée Zola' },
  { id: 'c', name: '', handle: 'zoe', email: 'zoe@ex.fr', role: 'eleve', cree: jour(50), vu: jour(40), revise: jour(45),
    revisions: 30, livres: 7, offre: 'campus', confirme: true, suspendu: jour(-7), etablissement: 'Lycée Zola' },
  { id: 'd', name: 'Ana', email: 'ana@ex.fr', role: 'admin', cree: jour(200), vu: jour(0), revise: null,
    revisions: 0, livres: 1, offre: 'gratuit', confirme: true, suspendu: null, etablissement: null }
];
const ids = l => l.map(a => a.id).join('');

describe('trierComptes', () => {
  it('chaque tri a un nom', () => {
    for (const k of Object.keys(TRIS)) expect(TRIS[k].length).toBeGreaterThan(2);
  });
  it('par date de création, dans les deux sens', () => {
    expect(ids(trierComptes(COMPTES, 'recent'))).toBe('bcad');
    expect(ids(trierComptes(COMPTES, 'ancien'))).toBe('dacb');
  });
  it('dernière connexion : jamais connecté en dernier', () => {
    expect(ids(trierComptes(COMPTES, 'vu'))).toBe('dacb');
  });
  it('dernière révision, révisions, livres', () => {
    expect(ids(trierComptes(COMPTES, 'revise'))).toBe('acbd');
    expect(ids(trierComptes(COMPTES, 'revisions'))).toBe('acbd');
    expect(ids(trierComptes(COMPTES, 'livres'))).toBe('cadb');
  });
  it('par nom, sans accent, le pseudo à défaut du nom', () => {
    expect(ids(trierComptes(COMPTES, 'nom'))).toBe('dabc');
  });
  it('un tri inconnu retombe sur « plus récents », la liste d’origine ne bouge pas', () => {
    const avant = ids(COMPTES);
    expect(ids(trierComptes(COMPTES, 'n-importe'))).toBe('bcad');
    expect(ids(COMPTES)).toBe(avant);
  });
  it('un compte d’une app ancienne (sans vu ni révisions) se trie quand même', () => {
    const vieux = [{ id: 'x', cree: jour(3) }, { id: 'y', cree: jour(1) }];
    expect(ids(trierComptes(vieux, 'revise'))).toBe('yx');
    expect(trierComptes(null)).toEqual([]);
  });
});

describe('filtrerComptes', () => {
  it('chaque filtre', () => {
    const f = filtre => ids(filtrerComptes(COMPTES, { filtre }, T));
    expect(f('tous')).toBe('abcd');
    expect(f('gratuit')).toBe('bd');
    expect(f('plus')).toBe('a');
    expect(f('campus')).toBe('c');
    expect(f('actifs')).toBe('a');
    expect(f('jamais')).toBe('b');
    expect(f('attente')).toBe('b');
    expect(f('suspendus')).toBe('c');
  });
  it('un compte sans le champ n’est pas « jamais connecté » ni « à confirmer »', () => {
    expect(filtrerComptes([{ id: 'x' }], { filtre: 'jamais' })).toEqual([]);
    expect(filtrerComptes([{ id: 'x' }], { filtre: 'attente' })).toEqual([]);
  });
  it('le rôle et la recherche, sans casse ni accent, l’établissement compris', () => {
    expect(ids(filtrerComptes(COMPTES, { role: 'eleve' }))).toBe('ac');
    expect(ids(filtrerComptes(COMPTES, { q: 'ELODIE' }))).toBe('a');
    expect(ids(filtrerComptes(COMPTES, { q: 'zola' }))).toBe('bc');
    expect(ids(filtrerComptes(COMPTES, { q: 'zoe' }))).toBe('c');
    expect(ids(filtrerComptes(COMPTES, { role: 'prof', q: 'zola', filtre: 'attente' }, T))).toBe('b');
  });
  it('compterFiltres : une puce = ce qu’elle montrerait', () => {
    const n = compterFiltres(COMPTES, { role: 'eleve' }, T);
    expect(Object.keys(n)).toEqual(Object.keys(FILTRES));
    expect(n).toMatchObject({ tous: 2, plus: 1, campus: 1, gratuit: 0, suspendus: 1 });
  });
  it('plat', () => {
    expect(plat('Élève Œ')).toBe('eleve œ');
    expect(plat(null)).toBe('');
  });
});

describe('suspendre', () => {
  it('une durée en jours, ou sans fin', () => {
    expect(Object.keys(SUSPENSIONS)).toEqual(['0', '1', '7', '30']);
    expect(finSuspension(7, T)).toBe(new Date(T + 7 * 864e5).toISOString());
    expect(sansFin(finSuspension(0, T))).toBe(true);
    expect(sansFin(finSuspension(30, T))).toBe(false);
    expect(sansFin(null)).toBe(false);
  });
});

describe('bilanSuppression', () => {
  it('compte ce qui est parti, garde le premier refus', () => {
    expect(bilanSuppression([{ ok: true }, { ok: false, motif: 'Son abonnement…' }, { ok: false, motif: 'autre' }]))
      .toEqual({ ok: 1, ko: 2, motif: 'Son abonnement…' });
    expect(bilanSuppression([{ ok: true }])).toEqual({ ok: 1, ko: 0, motif: '' });
  });
});
