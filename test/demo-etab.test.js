import { describe, it, expect } from 'vitest';
import { ELEVES, ETAB, journalDemo, reponseDemo } from '../src/demo-etab.js';
import { codeComplet } from '../src/classe.js';

const auj = new Date(2026, 9, 26, 12);

describe('reponseDemo — le lycée fictif répond aux lectures', () => {
  it('chacun son rôle, le même établissement', () => {
    expect(reponseDemo('eleve', 'my_role')).toBe('eleve');
    expect(reponseDemo('ref', 'my_role')).toBe('ref');
    expect(reponseDemo('prof', 'my_school', {}, auj)[0].org).toBe(ETAB.nom);
  });
  it('les codes de la démo ont la forme des vrais', () => {
    expect(codeComplet(ETAB.codeEleves)).toBe(true);
    expect(codeComplet(ETAB.codeProfs)).toBe(true);
  });
  it('l’élève : sa classe, son groupe, ses devoirs, et des pages à lire', () => {
    const c = reponseDemo('eleve', 'eleve_classes', {}, auj);
    expect(c.map(x => x.genre)).toEqual(['classe', 'groupe']);
    const d = reponseDemo('eleve', 'eleve_devoirs', {}, auj);
    expect(d.length).toBeGreaterThanOrEqual(3);
    const [o] = reponseDemo('eleve', 'eleve_ouvrir_devoir', { aid: d[0].id }, auj);
    expect(o.cartes.length).toBeGreaterThan(2);
    expect(reponseDemo('eleve', 'eleve_classe', { cid: 'demo-2b' }, auj).eleves.some(e => e.moi)).toBe(true);
  });
  it('le professeur : ses classes et son groupe, leurs élèves, le code de l’établissement', () => {
    const l = reponseDemo('prof', 'prof_classes', {}, auj);
    expect(l.map(c => c.name).sort()).toEqual(['1re B', '2nde B', 'Spé maths']);
    expect(l.find(c => c.name === 'Spé maths').genre).toBe('groupe');
    expect(reponseDemo('prof', 'prof_roster', { cid: 'demo-2b' }, auj).length).toBe(ELEVES.filter(e => e.classe === 'demo-2b').length);
    expect(reponseDemo('prof', 'prof_code_etab')).toBe(ETAB.codeEleves);
    expect(reponseDemo('prof', 'prof_eleves_etab', { q: 'lea' }, auj).map(e => e.nom)).toEqual(['Léa MARTIN']);
  });
  it('le référent : codes, licence de démo, tableau, liste paginée et filtrée', () => {
    const c = reponseDemo('ref', 'ref_codes', {}, auj);
    expect(c).toMatchObject({ eleve: ETAB.codeEleves, offre: 'demo', eleves: ELEVES.length });
    const p = reponseDemo('ref', 'ref_personnes', { qrole: 'eleve', lim: 5, off: 0 }, auj);
    expect(p).toHaveLength(5);
    expect(p[0].total).toBe(ELEVES.length);
    expect(reponseDemo('ref', 'ref_personnes', { qclass: 'demo-spe' }, auj).every(g => g.role === 'eleve')).toBe(true);
    expect(journalDemo(auj)).toHaveLength(3);
  });
  it('une écriture ne rend rien ; une lecture sans objet, une liste vide', () => {
    expect(reponseDemo('ref', 'ref_save_class', { nom: 'X' })).toBeUndefined();
    expect(reponseDemo('prof', 'prof_give', {})).toBeUndefined();
    expect(reponseDemo('eleve', 'visuels', {})).toEqual([]);
    expect(reponseDemo('eleve', 'journal', {})).toBeNull();
  });
});
