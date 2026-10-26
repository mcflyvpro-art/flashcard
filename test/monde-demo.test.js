import { describe, it, expect } from 'vitest';
import { URL } from 'node:url';
import { nouveauStore, repondre } from '../src/base-locale/serveur.js';
import { COMPTES, ETAB, PREFIXE, semerMonde } from '../src/base-locale/monde.js';

/* La base locale interrogée comme l'app le fait : une requête, son jeton. */
function client(store, uid) {
  const req = (method, path, body) => {
    const [status, json] = repondre(store, { method, url: new URL('https://demo.supabase.co' + path),
      headers: { authorization: `Bearer tok-${uid}-demo` }, body: body || null });
    expect(status).toBeLessThan(400);
    return json;
  };
  return { rpc: (f, b) => req('POST', '/rest/v1/rpc/' + f, b || {}), get: p => req('GET', '/rest/v1/' + p), post: (p, b) => req('POST', '/rest/v1/' + p, b) };
}

const monde = () => semerMonde(nouveauStore());

describe('le Lycée Démo Folio', () => {
  it('Claire : sa licence (une place par élève et par professeur), deux factures, un échange, un professeur ajouté puis retiré', () => {
    const store = monde(), claire = client(store, COMPTES.ref);
    const l = claire.rpc('licence_tableau');
    expect(l).toMatchObject({ offre: 'etablissement', places: 300, prises: 23, eleves: 20, profs: 3, prix: 900 });
    expect(l.factures.map(f => f.numero.slice(-4))).toEqual(['0002', '0001']);
    expect(l.factures[0]).not.toHaveProperty('lignes');
    expect(claire.rpc('facture', { fid: l.factures[1].id }).lignes[0].total_ht).toBe(75000);
    expect(l.echanges.filter(e => e.de === 'folio' && !e.lu)).toHaveLength(1);
    const anne = claire.rpc('ref_new_account', { adresse: 'anne.leroy@demo.folio.invalid', nom: 'Anne LEROY', pseudo: '', qrole: 'prof',
      cid: null, pw: 'abcd-efgh-jkmn' });
    expect(claire.rpc('licence_tableau').prises).toBe(24);
    claire.rpc('ref_retirer', { cible: anne });
    expect(claire.rpc('licence_tableau').prises).toBe(23);
    claire.rpc('ref_ecrire', { sujet: 'renouvellement', message: 'Nous renouvelons pour l’an prochain.' });
    expect(claire.rpc('licence_tableau').echanges).toHaveLength(4);
  });

  it('le même monde à chaque fois, sous des identifiants qu’on sait effacer', () => {
    const a = monde(), b = monde();
    expect(a.users.map(u => u.id)).toEqual(b.users.map(u => u.id));
    expect(a.users.every(u => u.id.startsWith(PREFIXE))).toBe(true);
    expect(a.tables.reviews.length).toBe(b.tables.reviews.length);
    expect(() => JSON.parse(JSON.stringify(a))).not.toThrow();          // rangé tel quel en sessionStorage
  });

  it('Léa : ses classes, ses devoirs (un rendu, un commencé, un à faire), sa bibliothèque, son journal', () => {
    const lea = client(monde(), COMPTES.eleve);
    expect(lea.rpc('my_role')).toBe('eleve');
    expect(lea.rpc('eleve_classes').map(c => c.nom).sort()).toEqual(['2nde B', 'Spé maths']);
    const d = lea.rpc('eleve_devoirs');
    expect(d.find(x => x.nom === 'Vocabulaire : la ville').etat).toBe('rendu');
    expect(d.find(x => x.nom === 'Irregular verbs, série 1').etat).toBe('commence');
    expect(d.find(x => x.nom === 'Fonctions affines').etat).toBe('a_faire');
    expect(lea.get('decks?select=id,name&deleted_at=is.null')).toHaveLength(4);
    const j = lea.rpc('journal', { p_depuis: new Date(Date.now() - 35 * 864e5).toISOString(), p_tz: 'Europe/Paris', p_bornes: [1, 3, 14, 90] });
    expect(j.jours.length).toBeGreaterThan(20);
    expect(lea.rpc('eleve_classe', { cid: d[0].class_id }).profs.length).toBeGreaterThan(0);
  });

  it('Léa : des amis classés, une demande, pas de club (élève de classe), trois lettres', () => {
    const lea = client(monde(), COMPTES.eleve);
    const amis = lea.rpc('my_friends');
    expect(amis.filter(f => f.status === 'ok')).toHaveLength(3);
    expect(amis.filter(f => f.status === 'pending' && f.sens === 'recue')).toHaveLength(1);
    expect(lea.rpc('leaderboard', { days: 7 }).length).toBeGreaterThanOrEqual(4);
    expect(lea.rpc('mes_clubs')).toEqual([]);
    const lettres = lea.get('mail?select=id,from_name,read_at&order=created_at.desc');
    expect(lettres).toHaveLength(3);
    expect(lettres[0].from_name).toBe('Tom GIRARD');                     // la plus récente d'abord
  });

  it('Marc : ses classes et son groupe, des retards, une fiche d’élève, ce qui bloque', () => {
    const store = monde(), marc = client(store, COMPTES.prof);
    const cl = marc.rpc('prof_classes');
    expect(cl.map(c => c.name).sort()).toEqual(['1re B', '2nde B', 'Spé maths']);
    const b = cl.find(c => c.name === '2nde B');
    expect(b.principal).toBe(true);
    expect(b.retard).toBeGreaterThan(0);
    expect(b.jamais).toBe(2);
    const fiche = marc.rpc('prof_eleve', { cid: b.id, qui: COMPTES.eleve });
    expect(fiche.map(x => x.etat).sort()).toEqual(['commencé', 'pas ouvert', 'rendu']);
    const ville = marc.rpc('prof_devoirs', { cid: b.id }).find(x => x.nom === 'Vocabulaire : la ville');
    expect(marc.rpc('prof_cartes', { aid: ville.id }).length).toBeGreaterThan(0);
    expect(marc.rpc('prof_equipe', { cid: b.id }).map(x => x.nom).sort()).toEqual(['Marc DURAND', 'Sophie BERNARD']);
    expect(marc.rpc('prof_code_etab')).toBe(ETAB.codeEleves);
  });

  it('un mot de Marc à la 2nde B arrive dans le courrier de Léa', () => {
    const store = monde(), marc = client(store, COMPTES.prof), lea = client(store, COMPTES.eleve);
    const b = marc.rpc('prof_classes').find(c => c.name === '2nde B');
    expect(marc.rpc('prof_message_classe', { cid: b.id, mot: 'Contrôle vendredi' })).toBe(11);
    expect(lea.get('mail?select=message').map(x => x.message)).toContain('Contrôle vendredi');
  });

  it('Claire : les codes, la licence de démo, vingt élèves, trois professeurs, une classe créée', () => {
    const claire = client(monde(), COMPTES.ref);
    expect(claire.rpc('ref_codes')).toMatchObject({ eleve: ETAB.codeEleves, prof: ETAB.codeProfs, offre: 'etablissement', eleves: 20, profs: 3 });
    expect(claire.rpc('ref_personnes', { qrole: 'eleve', lim: 60, off: 0 })).toHaveLength(20);
    const c = claire.rpc('ref_codes');                                   // renouvelés il y a trois jours, chaque semaine
    expect(c.rythme).toBe('semaine');
    expect(Date.parse(c.eleve_jusqua) - Date.now()).toBeGreaterThan(3.9 * 864e5);
    claire.rpc('ref_rythme', { p: 'mois' });
    expect(Date.parse(claire.rpc('ref_codes').prof_jusqua) - Date.now()).toBeGreaterThan(26 * 864e5);
    claire.rpc('ref_save_class', { nom: '2nde C', niveau: '2nde' });
    expect(claire.rpc('ref_classes').map(c => c.name)).toContain('2nde C');
  });
});
