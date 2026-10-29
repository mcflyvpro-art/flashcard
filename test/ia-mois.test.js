import { describe, expect, it } from 'vitest';
import { compter, etatIA, messageFerme } from '../src/ia-mois.js';

describe('l’IA du mois sur les onglets de la création', () => {
  it('Mirandola gratuit : l’IA est dans Mirandola+, quoi qu’en dise le compte', () => {
    expect(etatIA({ fait: 0, quota: 0 }, { offre: 'gratuit' }).cle).toBe('plus');
  });
  it('rien de lu : ni pastille ni fermeture (la fonction ai tranchera)', () => {
    expect(etatIA(null, { offre: 'campus' }).cle).toBe('inconnu');
    expect(etatIA({ fait: null, quota: null }, null).cle).toBe('inconnu');
  });
  it('une licence Campus qui n’accorde rien : fermé, et par qui', () => {
    const e = etatIA({ fait: 0, quota: 0 }, { offre: 'campus', etablissement: 'Lycée Camus' });
    expect(e).toEqual({ cle: 'ferme', texte: 'Ton établissement n’a pas ouvert l’IA à ton compte' });
    expect(messageFerme({ offre: 'campus', professeur: 'Lucie Mira' })).toBe('Ton professeur n’a pas ouvert l’IA à ton compte');
  });
  it('le reste du mois, et sa part', () => {
    const e = etatIA({ fait: 3, quota: 30 }, { offre: 'plus' });
    expect(e).toMatchObject({ cle: 'ouvert', reste: 27, quota: 30, pc: 90 });
    expect(e.titre).toBe('27 générations d’IA restent ce mois-ci, sur 30');
    expect(etatIA({ fait: 29, quota: 30 }, { offre: 'plus' }).titre).toBe('1 génération d’IA reste ce mois-ci, sur 30');
  });
  it('tout est pris : épuisé jusqu’au 1er ; jamais un reste négatif', () => {
    const e = etatIA({ fait: 34, quota: 30 }, { offre: 'campus' });
    expect(e).toMatchObject({ cle: 'epuise', reste: 0, pc: 0 });
  });
  it('chaque génération met le compte à jour', () => {
    expect(compter({ fait: 3, quota: 30 }, { fait: 4, quota: 30 })).toEqual({ fait: 4, quota: 30 });
    expect(compter({ fait: 3, quota: 30 }, { fait: 4, quota: null })).toEqual({ fait: 4, quota: 30 });
    expect(compter({ fait: 3, quota: 30 }, null)).toEqual({ fait: 3, quota: 30 });
  });
});
