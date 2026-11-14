import { describe, expect, it } from 'vitest';
import {
  courrielDevis, etatDevis, gestesEditeur, ligneLicence, mentionsDevis, perime, periodeScolaire, peutRepondre, porteeDevis, VALIDITE
} from '../src/devis.js';
import { prixCampus } from '../src/tarifs.js';
import { totaux } from '../src/facture.js';

const devis = (plus = {}) => ({ numero: 'D-2026-0001', statut: 'envoye', valable_jusqua: '2026-12-14', total_ht: 120000,
  places: 300, periode_debut: '2026-11-14', periode_fin: '2027-08-31', vendeur: { delai_jours: 30 }, ...plus });

describe('la période proposée', () => {
  it('d’aujourd’hui à la fin de l’année scolaire', () => {
    expect(periodeScolaire(new Date(2026, 10, 14))).toEqual({ debut: '2026-11-14', fin: '2027-08-31' });
    expect(periodeScolaire(new Date(2027, 1, 3))).toEqual({ debut: '2027-02-03', fin: '2027-08-31' });
  });
  it('à moins de trois mois de la fin : l’année suivante, de septembre à août', () => {
    expect(periodeScolaire(new Date(2027, 5, 20))).toEqual({ debut: '2027-09-01', fin: '2028-08-31' });
    expect(periodeScolaire(new Date(2027, 7, 31))).toEqual({ debut: '2027-09-01', fin: '2028-08-31' });
  });
  it('en septembre, l’année qui commence', () => {
    expect(periodeScolaire(new Date(2026, 8, 2))).toEqual({ debut: '2026-09-02', fin: '2027-08-31' });
  });
});

describe('la ligne de licence proposée', () => {
  it('au prix de la grille quand rien n’est convenu', () => {
    const l = ligneLicence({ places: 300, debut: '2026-09-01', fin: '2027-08-31' });
    expect(l.prix_ht).toBe(prixCampus(300));
    expect(l.quantite).toBe(1);
    expect(l.libelle).toBe('Licence Mirandola Campus, 300 places (élèves, professeurs et référents), du 01/09/2026 au 31/08/2027');
  });
  it('au prix convenu s’il y en a un, en centimes', () => {
    expect(ligneLicence({ places: 300, prix: 900 }).prix_ht).toBe(90000);
  });
  it('le minimum de la grille pour un petit groupe, et le singulier', () => {
    expect(ligneLicence({ places: 1 }).prix_ht).toBe(10000);
    expect(ligneLicence({ places: 1 }).libelle).toContain('1 place (');
  });
  it('ses totaux suivent la règle d’une facture', () => {
    const t = totaux([ligneLicence({ places: 300 })], 'normal', 20);
    expect(t.ht).toBe(prixCampus(300));
    expect(t.ttc).toBe(t.ht + t.tva);
  });
});

describe('l’état d’un devis', () => {
  it('envoyé et valable', () => {
    expect(etatDevis(devis(), '2026-11-20')).toEqual({ k: 'attente', t: 'Valable jusqu’au 14/12/2026' });
    expect(peutRepondre(devis(), '2026-12-14')).toBe(true);          // le dernier jour compte
  });
  it('expiré : plus de réponse en ligne', () => {
    expect(perime(devis(), '2026-12-15')).toBe(true);
    expect(etatDevis(devis(), '2026-12-15')).toEqual({ k: 'retard', t: 'Expiré le 14/12/2026' });
    expect(peutRepondre(devis(), '2026-12-15')).toBe(false);
  });
  it('accepté, puis facturé', () => {
    const a = devis({ statut: 'accepte', repondu_le: '2026-11-21T09:12:00Z' });
    expect(etatDevis(a, '2027-01-01')).toEqual({ k: 'payee', t: 'Accepté le 21/11/2026' });      // un accord ne périme pas
    expect(etatDevis({ ...a, facture_id: 'f', facture_numero: 'F-2026-0003' }).t).toBe('Accepté · facture F-2026-0003');
    expect(peutRepondre(a, '2026-11-22')).toBe(false);
  });
  it('refusé', () => {
    expect(etatDevis(devis({ statut: 'refuse' }), '2026-11-20')).toEqual({ k: 'annulee', t: 'Refusé' });
  });
});

describe('ce que l’éditeur peut en faire', () => {
  it('envoyé : noter la réponse', () => {
    expect(gestesEditeur(devis())).toEqual({ noter: true, rouvrir: false, facturer: false, licence: true });
  });
  it('accepté : facturer, et ouvrir la licence s’il dit ses places et sa fin', () => {
    expect(gestesEditeur(devis({ statut: 'accepte' }))).toMatchObject({ facturer: true, rouvrir: true, licence: true });
    expect(gestesEditeur(devis({ statut: 'accepte', places: null })).licence).toBe(false);
    expect(gestesEditeur(devis({ statut: 'accepte', periode_fin: null })).licence).toBe(false);
  });
  it('facturé : plus rien ne bouge', () => {
    expect(gestesEditeur(devis({ statut: 'accepte', facture_id: 'f' }))).toMatchObject({ noter: false, rouvrir: false, facturer: false });
  });
  it('refusé : il peut le rouvrir', () => {
    expect(gestesEditeur(devis({ statut: 'refuse' }))).toMatchObject({ rouvrir: true, facturer: false });
  });
});

describe('ce qu’un devis imprime', () => {
  it('sa validité, le règlement, la place par compte, les pénalités', () => {
    const m = mentionsDevis(devis({ mention_tva: 'TVA non applicable, art. 293 B du CGI', vendeur: { delai_jours: 45, iban: 'FR76 1234' } }));
    expect(m[0]).toBe('TVA non applicable, art. 293 B du CGI');
    expect(m[1]).toBe('Devis gratuit, valable jusqu’au 14/12/2026.');
    expect(m[2]).toContain('à 45 jours');
    expect(m[2]).toContain('IBAN FR76 1234');
    expect(m.join(' ')).toContain('Chorus Pro');
    expect(m.join(' ')).toContain('40 €');
  });
  it('assujetti : pas de mention de franchise, trente jours d’office', () => {
    const m = mentionsDevis(devis({ mention_tva: '', vendeur: {} }));
    expect(m[0]).toMatch(/^Devis gratuit/);
    expect(m[1]).toContain('à 30 jours');
    expect(m[1]).not.toContain('IBAN');
  });
  it('la période et les places sous l’objet', () => {
    expect(porteeDevis(devis())).toBe('Période : du 14/11/2026 au 31/08/2027 · 300 places');
    expect(porteeDevis(devis({ periode_debut: null, places: 1 }))).toBe('Période : jusqu’au 31/08/2027 · 1 place');
    expect(porteeDevis({})).toBe('');
  });
});

describe('le message qui l’accompagne', () => {
  it('dit le montant, les places, la validité, et comment accepter en ligne', () => {
    const c = courrielDevis({ devis: devis(), etab: 'Lycée Camus', contact: 'Madame Curie', enLigne: true, signature: 'Sam, Mirandola' });
    expect(c.sujet).toBe('Devis D-2026-0001 · Mirandola Campus · Lycée Camus');
    expect(c.corps).toContain('Bonjour Madame Curie,');
    expect(c.corps).toMatch(/1\s200,00\s€ hors taxes pour 300 places, jusqu’au 31\/08\/2027/);
    expect(c.corps).toContain('valable jusqu’au 14/12/2026');
    expect(c.corps).toContain('onglet Licence');
    expect(c.corps.trim().endsWith('Sam, Mirandola')).toBe(true);
  });
  it('sans référent : le devis signé ou le bon de commande', () => {
    const c = courrielDevis({ devis: devis({ places: null, periode_fin: null }) });
    expect(c.sujet).toBe('Devis D-2026-0001 · Mirandola Campus');
    expect(c.corps).toContain('Bonjour,');
    expect(c.corps).not.toContain('onglet Licence');
    expect(c.corps).toContain('bon de commande');
  });
  it('aucun tiret cadratin, comme partout', () => {
    expect(courrielDevis({ devis: devis() }).corps).not.toContain('—');
    expect(mentionsDevis(devis()).join(' ')).not.toContain('—');
    expect(ligneLicence({ places: 3 }).libelle).not.toContain('—');
  });
});

it('trente jours d’office', () => expect(VALIDITE).toBe(30));
