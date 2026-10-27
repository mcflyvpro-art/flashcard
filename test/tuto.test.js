import { describe, it, expect } from 'vitest';
import { SCENARIOS, aideSelon, debutDe, etapes, exemple, finDe, quelRole, textes, tient } from '../src/tuto.js';

const ids = (role, d) => etapes(role, d).map(e => e.id);

describe('quelRole — à chacun son scénario', () => {
  it('élève particulier, élève de classe, professeur, référent', () => {
    expect(quelRole({ role: 'eleve' })).toBe('perso');
    expect(quelRole({ role: 'eleve', eleveDeClasse: true })).toBe('classe');
    expect(quelRole({ role: 'prof', prof: true })).toBe('prof');
    expect(quelRole({ role: 'ref', referent: true })).toBe('ref');
  });
  it('l’éditeur n’en a pas, un référent sans établissement non plus', () => {
    expect(quelRole({ role: 'admin', prof: true })).toBe(null);
    expect(quelRole({ role: 'ref', referent: false })).toBe(null);
  });
  it('un compte sans rôle déclaré est un élève particulier', () => {
    expect(quelRole({ role: '' })).toBe('perso');
  });
});

describe('tient — les drapeaux de départ', () => {
  it('« x » et « !x »', () => {
    expect(tient(['livres'], { livres: true })).toBe(true);
    expect(tient(['!livres'], { livres: true })).toBe(false);
    expect(tient(['!classes', 'etab'], { etab: true })).toBe(true);
    expect(tient(undefined, {})).toBe(true);
  });
});

describe('les scénarios s’adaptent', () => {
  it('un compte neuf crée son premier livre, puis le lit', () => {
    const l = ids('perso', { livres: false });
    expect(l.slice(0, 4)).toEqual(['debut', 'nouveau', 'page', 'creer']);
    expect(l).toContain('lire');
    expect(l).not.toContain('ouvrir');
    expect(l.at(-1)).toBe('fin');
  });
  it('un compte qui a déjà des livres en ouvre un', () => {
    const l = ids('perso', { livres: true });
    expect(l).toContain('ouvrir');
    expect(l).not.toContain('nouveau');
  });
  it('un particulier qui suit un professeur voit sa classe', () => {
    expect(ids('perso', { classe: true })).toContain('classe');
    expect(ids('perso', {})).not.toContain('classe');
  });
  it('un élève de classe ouvre son devoir, sinon voit où ils arriveront', () => {
    const avec = ids('classe', { devoir: true, surClasses: true });
    expect(avec).toEqual(expect.arrayContaining(['devoir', 'lire', 'retourner', 'noter']));
    expect(avec).not.toContain('classe');            // il y est déjà
    const sans = ids('classe', { devoir: false });
    expect(sans).toContain('rien');
    expect(sans).not.toContain('lire');
    expect(sans).toContain('classe');
  });
  it('un professeur sans classe la choisit (établissement) ou la crée (particulier)', () => {
    expect(ids('prof', { classes: false, etab: true })).toEqual(expect.arrayContaining(['choisir', 'cocher']));
    expect(ids('prof', { classes: false, etab: true })).not.toContain('code');   // pas de bandeau sans classe dans un établissement
    expect(ids('prof', { bande: true })).toContain('code');
    expect(ids('prof', { classes: false, etab: false })).toEqual(expect.arrayContaining(['creer', 'nommer']));
    const avec = ids('prof', { classes: true, etab: true });
    expect(avec).toEqual(expect.arrayContaining(['donner', 'donne', 'classe', 'bilan', 'direct']));
    expect(avec).not.toContain('choisir');
  });
  it('le référent : les onglets de la console sur ordinateur, la licence au téléphone', () => {
    expect(ids('ref', { pc: true })).toEqual(['debut', 'codes', 'classes', 'eleves', 'licence', 'fin']);
    expect(ids('ref', { pc: false })).toEqual(['debut', 'codes', 'licence-tel', 'fin']);
  });
  it('court : douze étapes au plus, cartes comprises', () => {
    for (const role of Object.keys(SCENARIOS)) {
      for (const d of [{}, { livres: true, devoir: true, classes: true, etab: true, pc: true, classe: true }]) {
        expect(etapes(role, d).length, role).toBeLessThanOrEqual(12);
      }
    }
  });
});

describe('chaque étape tient debout', () => {
  it('un geste a une cible et une fin ; une étape sans carte a un titre', () => {
    for (const [role, l] of Object.entries(SCENARIOS)) {
      expect(new Set(l.map(e => e.id)).size, role).toBe(l.length);
      expect(l[0].carte, role).toBe('debut');
      expect(l.at(-1).carte, role).toBe('fin');
      for (const e of l.filter(x => !x.carte)) {
        expect(e.titre, `${role}/${e.id}`).toBeTruthy();
        if (e.geste) { expect(e.cible && e.cible.length, `${role}/${e.id}`).toBeTruthy(); expect(e.attend, `${role}/${e.id}`).toBeTruthy(); }
        if (e.libre) expect(e.attend, `${role}/${e.id}`).toBeTruthy();
      }
    }
  });
  it('sans trop de texte : un titre court, une phrase, pas de tiret cadratin', () => {
    for (const t of textes()) {
      const k = `${t.role}/${t.id}`;
      expect(t.titre.length, k).toBeLessThanOrEqual(28);
      expect((t.texte || '').length, k).toBeLessThanOrEqual(72);
      expect((t.aide || '').length, k).toBeLessThanOrEqual(32);
      expect(`${t.titre} ${t.texte} ${t.aide || ''}`, k).not.toMatch(/—/);
    }
  });
});

describe('les cartes du début et de la fin', () => {
  it('le début dit à qui l’on parle, dans la démo aussi', () => {
    expect(debutDe('perso', { prenom: 'Léa Martin' }).titre).toBe('Bienvenue, Léa');
    expect(debutDe('classe', { demo: true, prenom: 'Léa', classe: '2nde B' }).titre).toBe('Tu es Léa, en 2nde B');
    expect(debutDe('prof', { demo: true, prenom: 'Marc' }).titre).toMatch(/^Vous êtes Marc/);
    expect(debutDe('ref', {}).non).toBe('Passer');
    expect(debutDe('ref', {}).passe).toMatch(/Réglages/);
    expect(debutDe('classe', { demo: true }).passe).toMatch(/bandeau/);
  });
  it('un élève finit sur Folio+, un prof de la démo sur Folio Campus, un établissement client sur « tout est prêt »', () => {
    expect(finDe('perso').cle).toBe('plus');
    expect(finDe('classe', { demo: true }).cle).toBe('plus');
    expect(finDe('classe', { demo: true }).actions[0]).toMatchObject({ href: '/inscription', partir: 1 });
    expect(finDe('perso').actions[0].href).toBe('tarifs');
    expect(finDe('prof', { demo: true }).cle).toBe('campus');
    expect(finDe('ref', { demo: true }).actions[0].href).toBe('/demande-demo');
    expect(finDe('prof').cle).toBe('pret');
    expect(finDe('ref').cle).toBe('pret');
  });
  it('chaque fin a une façon de finir', () => {
    for (const r of ['perso', 'classe', 'prof', 'ref']) for (const demo of [false, true]) {
      expect(finDe(r, { demo }).actions.some(a => a.fin || a.href), `${r}/${demo}`).toBe(true);
    }
  });
});

describe('aideSelon — au doigt ou à la souris', () => {
  it('« Touche » devient « Clique sur », « Touchez » « Cliquez sur »', () => {
    expect(aideSelon('Touche « Lire »', true)).toBe('Clique sur « Lire »');
    expect(aideSelon('Touchez une classe', true)).toBe('Cliquez sur une classe');
    expect(aideSelon('Touche la page', false)).toBe('Touche la page');
    expect(aideSelon('Choisis une réponse', true)).toBe('Choisis une réponse');
    expect(aideSelon(undefined, true)).toBe('');
  });
  it('un professeur ou un référent est vouvoyé', () => {
    for (const r of ['prof', 'ref']) for (const e of SCENARIOS[r]) if (e.aide) expect(e.aide, `${r}/${e.id}`).toMatch(/^Touchez/);
  });
});

describe('exemple — trois pages tirées de la matière', () => {
  it('reconnue à son nom, sans casse ni accent', () => {
    expect(exemple('Anglais').titre).toBe('Verbes irréguliers');
    expect(exemple('Histoire-géo').titre).toBe('Capitales d’Europe');
    expect(exemple('Histoire').titre).toBe('Dates d’histoire');
    expect(exemple('Mathématiques').pages[0]).toEqual({ f: 'Aire d’un disque', b: 'π × r²' });
    expect(exemple('PHILOSOPHIE').titre).toBe('Philosophes');
  });
  it('des capitales sinon', () => {
    expect(exemple('').titre).toBe('Capitales d’Europe');
    expect(exemple('Astrophysique quantique').titre).toBe('Physique-chimie');
    expect(exemple('Cuisine').titre).toBe('Capitales d’Europe');
  });
  it('toujours trois pages, recto et verso remplis', () => {
    for (const m of ['Anglais', 'Droit', 'SVT', 'NSI', 'Code de la route', 'Économie', 'Médecine', 'Lettres', 'x']) {
      const e = exemple(m);
      expect(e.pages).toHaveLength(3);
      for (const p of e.pages) { expect(p.f).toBeTruthy(); expect(p.b).toBeTruthy(); }
    }
  });
});
