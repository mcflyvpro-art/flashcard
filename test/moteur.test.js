/* La page du moteur (/moteur) avance des chiffres précis : chacun doit être
   ce que rend le moteur de l'app (src/fsrs.js), pas ce qu'on a cru recopier.
   On relit le HTML de la page et on recalcule. */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as M from '../src/site/moteur-calc.js';
import { W6, fsrsInit } from '../src/fsrs.js';

const html = readFileSync('moteur.html', 'utf8');
const fr = (v, d) => v.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }).replace(/\u202f/g, ' ');
const texte = html.replace(/&nbsp;/g, ' ').replace(/\u00a0|\u202f/g, ' ');

describe('la courbe d’oubli', () => {
  it('passe par 90 % au bout de S jours, quelle que soit la stabilité', () => {
    for (const S of [0.3, 1, 10, 365]) expect(M.rappel(S, S)).toBeCloseTo(0.9, 10);
  });
  it('a le facteur f annoncé', () => {
    expect(M.F).toBeCloseTo(Math.pow(0.9, -1 / W6[20]) - 1, 12);
    expect(texte).toContain(fr(M.F, 4));
    expect(texte).toContain('0,1542');
  });
  it('oublie moins vite qu’une exponentielle, passé S', () => {
    for (const t of [20, 40]) expect(M.rappel(t, 10)).toBeGreaterThan(M.exponentielle(t, 10));
    expect(M.rappel(5, 10)).toBeLessThan(M.exponentielle(5, 10));
  });
  it('le laboratoire s’ouvre sur ce que dit son texte', () => {
    const s = +html.match(/id="labo-s"[^>]*value="(\d+)"/)[1], t = +html.match(/id="labo-t"[^>]*value="(\d+)"/)[1];
    const S = Math.pow(10, -0.5 + 3 * s / 100), T = 4 * S * t / 100;
    expect(S).toBeCloseTo(10, 6);
    expect(texte).toContain(`${Math.round(T)} jours · R = ${fr(M.rappel(T, S) * 100, 1)} %`);
  });
});

describe('le bon jour', () => {
  it('vaut exactement S à 90 %', () => expect(M.facteur(0.9)).toBeCloseTo(1, 10));
  it('la table des rétentions dit ce que calcule le moteur', () => {
    for (const r of [80, 85, 90, 95, 97]) expect(texte).toContain(`${r} %</td><td>${fr(M.facteur(r / 100), 2)} × S`);
  });
});

describe('la première lecture', () => {
  it('S₀ et D₀ de chaque note', () => {
    const lignes = ['Encore', 'Difficile', 'Correct', 'Facile'];
    lignes.forEach((nom, i) => {
      const S0 = fsrsInit(W6, i + 1).S, D0 = W6[4] - Math.exp(W6[5] * i) + 1;
      expect(texte).toMatch(new RegExp(`${nom}</td><td>${fr(S0, 2)} jours?</td><td>${D0 >= 1 ? fr(D0, 2) : '1 \\(' + fr(D0, 2).replace('-', '−')}`));
    });
    expect(M.difficulteDepart(4)).toBeLessThan(1);
    expect(fsrsInit(W6, 4).D).toBe(1);
  });
  it('les pas de la difficulté', () => {
    expect(texte).toContain(`« Difficile » ajoute ${fr(W6[6], 2)}`);
    expect(texte).toContain(`« Encore » ${fr(2 * W6[6], 2)}`);
  });
});

describe('après une bonne réponse', () => {
  it('relire plus tard rapporte plus, une page facile gagne plus', () => {
    const R = [0.98, 0.9, 0.7, 0.5];
    for (const D of [2, 5, 8]) {
      const g = R.map(r => M.gain(D, 10, r));
      for (let i = 1; i < g.length; i++) expect(g[i]).toBeGreaterThan(g[i - 1]);
    }
    expect(M.gain(2, 10, 0.9)).toBeGreaterThan(M.gain(8, 10, 0.9));
  });
  it('h et b sont ceux du moteur', () => {
    expect(texte).toContain(`= ${fr(W6[15], 2)} si « Difficile »`);
    expect(texte).toContain(`= ${fr(W6[16], 2)} si « Facile »`);
  });
});

describe('une page, un an', () => {
  it('« Correct » à chaque fois : la phrase écrite au build', () => {
    const sim = M.simuler(M.SCENARIOS.correct.notes);
    expect(sim.lectures.map(l => l.jour)).toEqual([0, 2, 13, 59, 222]);
    expect(sim.prochaine).toBe(720);
  });
  it('chaque révision tombe quand le rappel touche 90 %', () => {
    for (const k of Object.keys(M.SCENARIOS)) {
      const sim = M.simuler(M.SCENARIOS[k].notes);
      sim.lectures.slice(1).forEach(l => expect(Math.abs(l.R - 0.9)).toBeLessThan(0.02));
      expect(sim.lectures.at(-1).jour).toBeLessThanOrEqual(365);
    }
  });
  it('un oubli fait chuter la stabilité sans la remettre à zéro', () => {
    const sim = M.simuler(M.SCENARIOS.oubli.notes), k = sim.lectures.findIndex(l => l.note === 1);
    expect(sim.lectures[k].S).toBeLessThan(sim.lectures[k - 1].S);
    expect(sim.lectures[k].S).toBeGreaterThan(M.simuler([1]).lectures[0].S);
  });
  it('« Facile » espace plus, « Difficile » moins', () => {
    const n = k => M.simuler(M.SCENARIOS[k].notes).lectures.length;
    expect(n('facile')).toBeLessThan(n('correct'));
    expect(n('difficile')).toBeGreaterThan(n('correct'));
  });
});

describe('les 21 paramètres', () => {
  it('chacun a son rôle, et la table les écrit tous', () => {
    expect(M.ROLES).toHaveLength(21);
    expect(W6).toHaveLength(21);
    const table = M.tableParametres();
    expect(table.match(/<tr /g)).toHaveLength(21);
    W6.forEach(v => expect(table).toContain(v.toLocaleString('fr-FR', { maximumFractionDigits: 4 })));
  });
});

describe('le banc d’essai', () => {
  it('FSRS-6 en tête sur les deux mesures, et les chiffres du héros', () => {
    for (const cle of ['rmse', 'logloss']) {
      const meilleur = [...M.BANC].sort((a, b) => a[cle] - b[cle])[0];
      expect(meilleur.nom).toBe('FSRS-6');
      expect(M.barresBanc(cle).match(/<li/g)).toHaveLength(M.BANC.length);
    }
    expect(texte).toContain(fr(M.BANC[0].logloss, 4));
  });
});

describe('les dessins', () => {
  it('aucun nombre perdu dans un tracé', () => {
    const tout = [M.svgFamille(), M.svgCourbe(10, true, 15.2), M.svgCourbe(0.3, true, 0), M.svgGain(),
      M.svgSimulation(M.simuler(M.SCENARIOS.oubli.notes)), M.barresBanc('logloss')].join('');
    expect(tout).not.toMatch(/NaN|Infinity|undefined/);
  });
});
