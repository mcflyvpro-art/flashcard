import { describe, it, expect } from 'vitest';
import { ROUTES, aRouvrir, chemin, lireChemin } from '../src/routes.js';

describe('chemin — un écran, son adresse', () => {
  it('avant la connexion : connexion, inscription, carte, démo, mentions', () => {
    expect(chemin({ name: 'login', id: 'in' })).toBe('/connexion');
    expect(chemin({ name: 'login', id: 'up' })).toBe('/inscription');
    expect(chemin({ name: 'login', id: 'carte' })).toBe('/carte-eleve');
    expect(chemin({ name: 'decouvrir' })).toBe('/essayer');
    expect(chemin({ name: 'demande' })).toBe('/demande-demo');
    expect(chemin({ name: 'legal', id: 'confidentialite' })).toBe('/mentions/confidentialite');
    expect(chemin({ name: 'home' })).toBeNull();                 // sans session, pas d'espace
  });
  it('chaque rôle a son espace', () => {
    expect(chemin({ name: 'home' }, 'eleve')).toBe('/eleve/livres');
    expect(chemin({ name: 'deck', id: 'a b' }, 'eleve')).toBe('/eleve/livres/a%20b');
    expect(chemin({ name: 'home' }, 'prof')).toBe('/prof/livres');
    expect(chemin({ name: 'prof' }, 'prof')).toBe('/prof');
    expect(chemin({ name: 'profclasse', id: 'c1', sous: 'devoirs' }, 'prof')).toBe('/prof/classes/c1/devoirs');
    expect(chemin({ name: 'profclasse', id: 'c1' }, 'prof')).toBe('/prof/classes/c1');
    expect(chemin({ name: 'ref', sous: 'accueil' }, 'ref')).toBe('/referent');
    expect(chemin({ name: 'ref', sous: 'classes', id: 'k' }, 'ref')).toBe('/referent/classes/k');
    expect(chemin({ name: 'ref', sous: 'profs' }, 'ref')).toBe('/referent/professeurs');
    expect(chemin({ name: 'admin', sous: 'suivi', id: 'o' }, 'admin')).toBe('/admin/etablissements/o');
    expect(chemin({ name: 'ref', sous: 'licence' }, 'ref')).toBe('/referent/licence');
    expect(chemin({ name: 'ref', sous: 'licence', id: 'f1' }, 'ref')).toBe('/referent/licence/factures/f1');
    expect(chemin({ name: 'admin', sous: 'entreprise' }, 'admin')).toBe('/admin/entreprise');
    expect(chemin({ name: 'admin', sous: 'facture', id: 'f1' }, 'admin')).toBe('/admin/factures/f1');
    expect(chemin({ name: 'settings' }, 'admin')).toBe('/admin/reglages');
  });
  it('un écran d’un autre métier n’a pas d’adresse ici', () => {
    expect(chemin({ name: 'prof' }, 'eleve')).toBeNull();
    expect(chemin({ name: 'ref', sous: 'classes' }, 'prof')).toBeNull();
    expect(chemin({ name: 'classes' }, 'prof')).toBeNull();
  });
  it('Mirandola+ : pour qui révise, pas pour qui gère un établissement', () => {
    expect(chemin({ name: 'plus' }, 'eleve')).toBe('/eleve/mirandola-plus');
    expect(chemin({ name: 'plus' }, 'prof')).toBe('/prof/mirandola-plus');
    expect(chemin({ name: 'plus' }, 'ref')).toBeNull();
    expect(chemin({ name: 'plus' }, 'admin')).toBeNull();
    expect(lireChemin('/eleve/mirandola-plus')).toMatchObject({ role: 'eleve', name: 'plus' });
    expect(lireChemin('/eleve/folio-plus')).toMatchObject({ role: 'eleve', name: 'plus' });   // l'adresse d'avant
  });
  it('la démo a ses propres adresses', () => {
    expect(chemin({ name: 'prof' }, 'prof', true)).toBe('/demo/prof');
    expect(chemin({ name: 'classes' }, 'eleve', true)).toBe('/demo/eleve/classe');
  });
});

describe('lireChemin — une adresse, son écran', () => {
  it('relit tout ce que chemin écrit, pour chaque route', () => {
    const roles = { prof: 'prof', ref: 'ref', admin: 'admin' };
    for (const r of ROUTES) {
      const role = r.espaces ? roles[r.espaces[0]] || r.espaces[0] : 'eleve';
      const e = { name: r.name, id: r.motif.includes(':id') ? 'x-1' : null, sous: r.sous };
      for (const demo of [false, true]) {
        const lu = lireChemin(chemin(e, role, demo));
        expect(lu).toMatchObject({ role, demo, name: r.name });
        expect(lu.id || null).toBe(e.id);
        if (r.sous) expect(lu.sous).toBe(r.sous);
      }
    }
  });
  it('la racine, un espace nu, l’inconnu', () => {
    expect(lireChemin('/')).toEqual({ racine: true });
    expect(lireChemin('/prof')).toMatchObject({ role: 'prof', name: 'prof' });
    expect(lireChemin('/referent')).toMatchObject({ role: 'ref', name: 'ref', sous: 'accueil' });
    expect(lireChemin('/referent/licence/factures/f1')).toMatchObject({ role: 'ref', name: 'ref', sous: 'licence', id: 'f1' });
    expect(lireChemin('/admin/factures/f1')).toMatchObject({ role: 'admin', name: 'admin', sous: 'facture', id: 'f1' });
    expect(lireChemin('/eleve')).toMatchObject({ role: 'eleve', name: 'home' });
    expect(lireChemin('/demo/referent/classes')).toMatchObject({ role: 'ref', demo: true, sous: 'classes' });
    expect(lireChemin('/nimporte/quoi')).toBeNull();
    expect(lireChemin('/eleve/agenda')).toBeNull();           // l'agenda est au professeur
    expect(lireChemin('/eleve/livres/%E0%A4%A')).toBeNull();   // adresse abîmée
    expect(lireChemin('/connexion?x=1')).toEqual({ name: 'login', id: 'in' });
  });
  it('ce qui ne se reprend pas se rouvre à sa place', () => {
    expect(aRouvrir(lireChemin('/eleve/livres/d1/lecture'))).toMatchObject({ name: 'deck', id: 'd1' });
    expect(aRouvrir(lireChemin('/eleve/cercle/direct'))).toMatchObject({ name: 'commu', id: null });
    expect(aRouvrir(lireChemin('/eleve/livres/d1'))).toMatchObject({ name: 'deck', id: 'd1' });
  });
});
