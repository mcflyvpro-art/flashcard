import { describe, it, expect } from 'vitest';
import { etatLicence, messageEtab, ROLES_CODE, uaiValide } from '../src/etablissement.js';

describe('messageEtab — la réponse de la base, en clair', () => {
  it('chaque statut connu a un titre et un ton', () => {
    for (const s of ['ok', 'attente', 'admis', 'deja', 'autre', 'gere', 'role', 'demande', 'plein', 'licence',
      'complet', 'nom', 'classe', 'inconnu', 'trop', 'connexion']) {
      const m = messageEtab(s);
      expect(m.titre.length).toBeGreaterThan(5);
      expect(['ok', 'ko', 'attente']).toContain(m.ton);
    }
  });
  it('un statut inconnu ne laisse jamais un écran vide', () => {
    expect(messageEtab('n-importe-quoi')).toEqual({ ton: 'ko', titre: 'Impossible pour l’instant', texte: 'Réessaie dans un moment.' });
  });
  it('un professeur attend le référent, un élève son établissement', () => {
    expect(messageEtab('attente', 'prof').texte).toMatch(/espace professeur/);
    expect(messageEtab('attente', 'eleve').texte).toMatch(/établissement/);
  });
  it('trois rôles nommés', () => {
    expect(Object.keys(ROLES_CODE)).toEqual(['eleve', 'prof', 'ref']);
  });
});

describe('etatLicence — où en est la licence', () => {
  const auj = '2026-10-25';
  it('places prises sur places achetées, date au format français', () => {
    const l = etatLicence({ offre: 'etablissement', places: 400, eleves: 312, licence_fin: '2027-08-31' }, auj);
    expect(l).toMatchObject({ k: 'ok', places: '312 / 400', libre: 88, fin: '31/08/2027', offre: 'Licence', pc: 78 });
  });
  it('pleine dès que les élèves atteignent les places', () => {
    expect(etatLicence({ places: 60, eleves: 60, licence_fin: '2027-01-01' }, auj).k).toBe('pleine');
  });
  it('bientôt finie à 30 jours ou moins, échue la veille', () => {
    expect(etatLicence({ places: 60, eleves: 3, licence_fin: '2026-11-24', offre: 'essai' }, auj)).toMatchObject({ k: 'bientot', jours: 30, offre: 'Essai' });
    expect(etatLicence({ places: 60, eleves: 3, licence_fin: '2026-10-24' }, auj)).toMatchObject({ k: 'echue', jours: -1 });
  });
  it('échue passe avant pleine : c’est ce qu’il faut régler d’abord', () => {
    expect(etatLicence({ places: 2, eleves: 2, licence_fin: '2026-01-01' }, auj).k).toBe('echue');
  });
  it('sans plafond ni fin : un simple décompte', () => {
    expect(etatLicence({ places: null, eleves: 1, licence_fin: null }, auj)).toMatchObject({ k: 'ok', places: '1 élève', fin: 'sans fin', libre: null });
  });
});

describe('uaiValide — le numéro d’un établissement', () => {
  it('sept chiffres et une lettre, casse et espaces ignorés', () => {
    expect(uaiValide('0300021K')).toBe(true);
    expect(uaiValide(' 0300021k ')).toBe(true);
    expect(uaiValide('300021K')).toBe(false);
    expect(uaiValide('03000210')).toBe(false);
    expect(uaiValide('')).toBe(false);
  });
});
