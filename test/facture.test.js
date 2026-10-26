import { describe, it, expect } from 'vitest';
import {
  dateFr, enCentimes, enteteClient, enteteVendeur, etatFacture, euros, lignesLicence, MENTION_FRANCHISE, mentionsLegales,
  nonLus, prixPlace, resteDu, siretValide, SUJETS, totaux
} from '../src/facture.js';

const plat = s => s.replace(/\s/g, ' ');

describe('les montants', () => {
  it('des centimes en euros, à la française', () => {
    expect(plat(euros(123456))).toBe('1 234,56 €');
    expect(plat(euros(-32814))).toBe('-328,14 €');
    expect(plat(euros(0))).toBe('0,00 €');
  });
  it('une saisie en euros devient des centimes ; une saisie illisible, rien', () => {
    expect(enCentimes('3')).toBe(300);
    expect(enCentimes('2,50 €')).toBe(250);
    expect(enCentimes('1 200')).toBe(120000);
    expect(enCentimes('3,456')).toBe(null);
    expect(enCentimes('trois')).toBe(null);
  });
  it('une date à la française', () => {
    expect(dateFr('2026-10-28')).toBe('28/10/2026');
    expect(dateFr(null)).toBe('');
  });
});

describe('totaux — la même règle que admin_facturer', () => {
  const l = [{ libelle: 'Places', quantite: 50, prix_ht: 300 }, { libelle: 'Formation', quantite: 1, prix_ht: 12345 }];
  it('régime normal : TVA à 20 % sur le total HT, arrondie au centime', () => {
    expect(totaux(l, 'normal', 20)).toMatchObject({ ht: 27345, tva: 5469, ttc: 32814, taux: 20, mention: '' });
  });
  it('franchise en base : pas de TVA, la mention de l’article 293 B', () => {
    expect(totaux(l)).toMatchObject({ ht: 27345, tva: 0, ttc: 27345, taux: 0, mention: MENTION_FRANCHISE });
  });
  it('chaque ligne a son total', () => {
    expect(totaux(l).lignes.map(x => x.total_ht)).toEqual([15000, 12345]);
  });
});

describe('la licence', () => {
  it('le prix d’une place : la part du prix annuel', () => {
    expect(prixPlace(900, 300)).toBe(300);
    expect(prixPlace(null, 300)).toBe(null);
  });
  it('la ligne proposée pour facturer une licence', () => {
    expect(lignesLicence({ places: 300, prix: 900, debut: '2026-09-01', fin: '2027-08-31' })).toEqual([{
      libelle: 'Licence Folio — 300 places (élèves et professeurs), du 01/09/2026 au 31/08/2027', quantite: 1, prix_ht: 90000 }]);
  });
});

describe('etatFacture — où en est une pièce', () => {
  const auj = '2026-10-26';
  const f = { id: 'f1', genre: 'facture', echeance: '2026-11-25', total_ttc: 90000 };
  it('à payer, échue, payée', () => {
    expect(etatFacture(f, [f], auj)).toEqual({ k: 'attente', t: 'À payer avant le 25/11/2026' });
    expect(etatFacture({ ...f, echeance: '2026-10-01' }, [], auj).k).toBe('retard');
    expect(etatFacture({ ...f, echeance: '2026-10-01', payee_le: '2026-10-20' }, [], auj)).toEqual({ k: 'payee', t: 'Payée le 20/10/2026' });
  });
  it('un avoir annule sa facture, et n’est lui-même qu’un avoir', () => {
    const a = { id: 'a1', genre: 'avoir', origine: 'f1', total_ttc: -90000 };
    expect(etatFacture(f, [f, a], auj).k).toBe('annulee');
    expect(etatFacture(a, [f, a], auj).k).toBe('avoir');
  });
  it('le reste dû : ni les payées, ni les annulées, ni les avoirs', () => {
    const l = [f, { id: 'f2', genre: 'facture', echeance: '2026-09-01', total_ttc: 1000 },
      { id: 'f3', genre: 'facture', echeance: '2026-09-01', total_ttc: 500, payee_le: '2026-09-10' },
      { id: 'f4', genre: 'facture', echeance: '2026-09-01', total_ttc: 700 }, { id: 'a4', genre: 'avoir', origine: 'f4', total_ttc: -700 }];
    expect(resteDu(l, auj)).toBe(91000);
  });
});

describe('ce qu’une facture imprime', () => {
  const v = { raison_sociale: 'Folio', forme: 'EI', adresse: '1 rue des Livres', code_postal: '30000', ville: 'Nîmes',
    siret: '91234567800011', immatriculation: 'RCS Nîmes 912 345 678', iban: 'FR7612345', bic: 'AGRIFRPP' };
  it('le vendeur : la forme accolée au nom (EI obligatoire), son SIRET, son immatriculation', () => {
    expect(enteteVendeur(v)).toEqual(['Folio (EI)', '1 rue des Livres', '30000 Nîmes', 'SIRET 91234567800011', 'RCS Nîmes 912 345 678']);
  });
  it('le client : SIRET, UAI, code service et bon de commande pour Chorus Pro', () => {
    expect(enteteClient({ nom: 'Lycée Camus', adresse: '51 av. Kennedy', code_postal: '30000', ville: 'Nîmes', siret: '19300001500012',
      uai: '0300021K', service: 'FOLIO', engagement: 'BC-118' })).toEqual(['Lycée Camus', '51 av. Kennedy', '30000 Nîmes',
      'SIRET 19300001500012', 'UAI 0300021K', 'Code service (Chorus Pro) FOLIO', 'Bon de commande BC-118']);
  });
  it('les mentions : TVA, échéance, virement, escompte, pénalités et les 40 €', () => {
    const m = mentionsLegales({ genre: 'facture', mention_tva: MENTION_FRANCHISE, echeance: '2026-11-25', vendeur: v });
    expect(m[0]).toBe(MENTION_FRANCHISE);
    expect(m).toContain('Échéance : 25/11/2026.');
    expect(m).toContain('Règlement par virement : IBAN FR7612345, BIC AGRIFRPP.');
    expect(m).toContain('Pas d’escompte pour paiement anticipé.');
    expect(m.join(' ')).toMatch(/R2192-31.*L441-10.*40 €/);
  });
  it('un avoir n’a pas d’échéance', () => {
    expect(mentionsLegales({ genre: 'avoir', vendeur: {} }).some(x => x.startsWith('Échéance'))).toBe(false);
  });
});

describe('les échanges', () => {
  it('quatre sujets', () => {
    expect(Object.keys(SUJETS)).toEqual(['places', 'renouvellement', 'facture', 'question']);
  });
  it('ce que l’autre a écrit et qu’on n’a pas lu', () => {
    const l = [{ de: 'etab', lu: null }, { de: 'folio', lu: null }, { de: 'folio', lu: '2026-10-26' }];
    expect(nonLus(l, 'etab')).toBe(1);
    expect(nonLus(l, 'folio')).toBe(1);
  });
});

describe('siretValide — quatorze chiffres et la clé de Luhn', () => {
  it('un SIRET juste, un faux, un trop court', () => {
    expect(siretValide('912 345 678 00011')).toBe(true);
    expect(siretValide('91234567800012')).toBe(false);
    expect(siretValide('9123456780001')).toBe(false);
  });
  it('La Poste a sa règle à elle', () => {
    expect(siretValide('35600000000015')).toBe(true);
    expect(siretValide('35600000000016')).toBe(false);
  });
});
