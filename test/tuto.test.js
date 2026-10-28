import { describe, it, expect } from 'vitest';
import {
  CONNU, SCENARIOS, aideSelon, debutDe, ecransDe, etapes, exemple, finDe, quelRole, textes, tient
} from '../src/tuto.js';

const ids = (role, d) => etapes(role, d).map(e => e.id);
const TOUT = Object.entries(SCENARIOS).flatMap(([role, l]) => l.map(e => [role, e]));

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

describe('un élève : ses livres, une page lue, créer, son journal, sa classe, ses amis, son courrier', () => {
  it('dans cet ordre, pour un élève de classe qui a des livres', () => {
    const l = ids('classe', { livres: true });
    expect(l).toEqual(['debut', 'ouvrir', 'lire', 'retourner', 'noter', 'retenue', 'creer-livre', 'methodes', 'plein',
      'journal', 'journal-vu', 'classe', 'devoirs', 'cercle', 'amis', 'courrier', 'courrier-vu', 'fin']);
  });
  it('un compte neuf crée d’abord son premier livre, puis le lit', () => {
    const l = ids('perso', { livres: false });
    expect(l.slice(0, 4)).toEqual(['debut', 'nouveau', 'page', 'creer']);
    expect(l.indexOf('lire')).toBeGreaterThan(l.indexOf('creer'));
    expect(l).not.toContain('ouvrir');
    expect(l).not.toContain('creer-livre');            // il vient d'en créer un
  });
  it('un particulier ne voit la classe que s’il suit un professeur', () => {
    expect(ids('perso', { classe: true })).toEqual(expect.arrayContaining(['classe', 'devoirs']));
    expect(ids('perso', {})).not.toContain('classe');
  });
  it('la lecture se garde : retourner et noter ramènent à « Lis-le » si la lecture se perd', () => {
    const l = SCENARIOS.classe;
    for (const id of ['retourner', 'noter']) expect(l.find(e => e.id === id).reprise).toBe('lire');
  });
});

describe('le professeur, pas à pas', () => {
  it('avec des classes et des livres : du tableau de bord au courrier, un vrai devoir donné', () => {
    const l = ids('prof', { classes: true, etab: true, bande: true, livres: true });
    expect(l).toEqual(['debut', 'code', 'tableau', 'traiter', 'classe', 'suivi', 'eleve', 'fiche', 'devoirs',
      'donner', 'livre', 'donne', 'bilan', 'direct', 'agenda', 'livres', 'courrier', 'fin']);
  });
  it('sans livre : on montre où donner un devoir, sans ouvrir la feuille', () => {
    const l = ids('prof', { classes: true, livres: false });
    expect(l).toContain('donner-vu');
    expect(l).not.toEqual(expect.arrayContaining(['donner', 'livre', 'donne']));
  });
  it('sans classe : les choisir (établissement), ou la créer (particulier)', () => {
    expect(ids('prof', { classes: false, etab: true })).toEqual(expect.arrayContaining(['choisir', 'cocher']));
    expect(ids('prof', { classes: false, etab: true })).not.toContain('code');   // pas de bandeau sans classe dans un établissement
    expect(ids('prof', { classes: false, etab: false, bande: true })).toEqual(expect.arrayContaining(['code', 'creer', 'nommer', 'inviter']));
  });
  it('choisir le livre d’un devoir ne permet que de choisir un livre', () => {
    const livre = SCENARIOS.prof.find(e => e.id === 'livre');
    expect(livre.permis).toEqual(['#pflivres [data-pf="livre"]']);
    expect(livre.permis.join()).not.toMatch(/livre-neuf/);
    expect(livre.reprise).toBe('donner');
  });
  it('un vrai devoir, une vraie classe ne s’imposent pas : « Plus tard »', () => {
    for (const id of ['cocher', 'nommer', 'livre', 'donne']) expect(SCENARIOS.prof.find(e => e.id === id).passable, id).toBe(1);
  });
});

describe('le référent', () => {
  it('les onglets de la console sur ordinateur, la licence au téléphone', () => {
    expect(ids('ref', { pc: true })).toEqual(['debut', 'codes', 'licence-vue', 'classes', 'eleves', 'profs', 'licence', 'historique', 'fin']);
    expect(ids('ref', { pc: false })).toEqual(['debut', 'codes', 'licence-tel', 'fin']);
  });
});

describe('chaque étape tient debout', () => {
  it('ids uniques ; une carte au début et à la fin ; un titre partout ailleurs', () => {
    for (const [role, l] of Object.entries(SCENARIOS)) {
      expect(new Set(l.map(e => e.id)).size, role).toBe(l.length);
      expect(l[0].carte, role).toBe('debut');
      expect(l.at(-1).carte, role).toBe('fin');
      for (const e of l.filter(x => !x.carte)) expect(e.titre, `${role}/${e.id}`).toBeTruthy();
    }
  });
  it('un geste a une cible et une fin ; un mot a une cible, sauf au centre', () => {
    for (const [role, e] of TOUT.filter(([, x]) => !x.carte)) {
      const k = `${role}/${e.id}`;
      if (e.geste) expect(e.attend, k).toBeTruthy();
      if (!e.centre) expect(e.cible && e.cible.length, k).toBeTruthy();
      if (e.centre) expect(e.geste, k).toBeFalsy();
    }
  });
  it('le moteur sait lire tout ce qu’écrit un scénario', () => {
    for (const [role, e] of TOUT) {
      const k = `${role}/${e.id}`;
      for (const a of Object.keys(e.attend || {})) expect(CONNU.attend, k).toContain(a);
      if (e.tant) expect(CONNU.tant, k).toContain(e.tant.replace(/^!/, ''));
      if (e.bouton) expect(CONNU.bouton, k).toContain(e.bouton);
      for (const pc of [true, false]) for (const s of ecransDe(e, pc) || []) expect(CONNU.ecran, k).toContain(s);
    }
  });
  it('une reprise mène à une étape d’avant, du même scénario', () => {
    for (const [role, l] of Object.entries(SCENARIOS)) {
      l.forEach((e, i) => {
        if (!e.reprise) return;
        const j = l.findIndex(x => x.id === e.reprise);
        expect(j, `${role}/${e.id}`).toBeGreaterThanOrEqual(0);
        expect(j, `${role}/${e.id}`).toBeLessThan(i);
      });
    }
  });
  it('ce qui se glisse et les touches d’une lecture ne servent qu’à la lecture', () => {
    for (const [role, e] of TOUT) {
      if (e.glisse || e.clavier) expect(ecransDe(e, true), `${role}/${e.id}`).toEqual(['study']);
    }
  });
  it('« Plus tard » seulement là où l’on remplit une feuille', () => {
    for (const [role, e] of TOUT.filter(([, x]) => x.passable)) expect(e.tant, `${role}/${e.id}`).toBe('feuille');
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
  it('court mais complet : vingt étapes au plus, cartes comprises', () => {
    for (const role of Object.keys(SCENARIOS)) {
      for (const d of [{}, { livres: true, classes: true, etab: true, bande: true, pc: true, classe: true }]) {
        expect(etapes(role, d).length, role).toBeLessThanOrEqual(20);
      }
    }
  });
});

describe('ecransDe — où se passe une étape', () => {
  it('un écran, plusieurs, ou selon l’appareil', () => {
    expect(ecransDe({ ecran: 'home' }, true)).toEqual(['home']);
    expect(ecransDe({ ecran: ['profclasse', 'prof'] }, false)).toEqual(['profclasse', 'prof']);
    expect(ecransDe({ ecran: { tel: 'home' } }, true)).toBe(null);           // sur ordinateur, la barre latérale y mène de partout
    expect(ecransDe({ ecran: { tel: 'home' } }, false)).toEqual(['home']);
    expect(ecransDe({}, false)).toBe(null);
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
  it('un élève finit sur Mirandola+, un prof de la démo sur Mirandola Campus, un établissement client sur « tout est prêt »', () => {
    expect(finDe('perso').cle).toBe('plus');
    expect(finDe('classe', { demo: true }).cle).toBe('plus');
    expect(finDe('classe', { demo: true }).actions[0]).toMatchObject({ href: '/inscription', partir: 1 });
    expect(finDe('perso').actions[0].href).toBe('tarifs');
    expect(finDe('perso', { aPlus: true }).cle).toBe('pret');            // Mirandola+ offert ou payé, Campus : rien à lui vendre
    expect(finDe('classe', { aPlus: true, demo: true }).cle).toBe('plus');   // la démo essaie Mirandola gratuit
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

describe('aideSelon — au doigt ou à la souris, au téléphone ou sur ordinateur', () => {
  it('« Touche » devient « Clique sur », « Touchez » « Cliquez sur »', () => {
    expect(aideSelon('Touche « Lire »', true)).toBe('Clique sur « Lire »');
    expect(aideSelon('Touchez une classe', true)).toBe('Cliquez sur une classe');
    expect(aideSelon('Puis touchez « Donner »', true)).toBe('Puis cliquez sur « Donner »');
    expect(aideSelon('Touche la page', false)).toBe('Touche la page');
    expect(aideSelon('Choisis une réponse', true)).toBe('Choisis une réponse');
    expect(aideSelon(undefined, true)).toBe('');
  });
  it('au téléphone, l’onglet n’a que son icône', () => {
    const a = { pc: 'Touche « Journal »', tel: 'Touche l’anneau du jour' };
    expect(aideSelon(a, false, false)).toBe('Touche l’anneau du jour');
    expect(aideSelon(a, true, true)).toBe('Clique sur « Journal »');
  });
  it('un professeur ou un référent est vouvoyé', () => {
    for (const r of ['prof', 'ref']) {
      for (const e of SCENARIOS[r]) {
        for (const a of e.aide && typeof e.aide === 'object' ? [e.aide.pc, e.aide.tel] : [e.aide]) {
          if (a && /^(Puis )?[Tt]ouch/.test(a)) expect(a, `${r}/${e.id}`).toMatch(/^(Puis )?[Tt]ouchez/);
        }
      }
    }
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
