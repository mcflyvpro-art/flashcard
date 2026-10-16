/* M04.T2 — réparation de bibliothèque (src/reparation.js) : preuve sur
   une base corrompue fabriquée, une carte par famille (plus une carte
   saine témoin), puis vérification qu'il ne reste plus aucune anomalie
   après repairLibrary(). */
import { describe, it, expect } from 'vitest';
import { W6, S_MIN, S_MAX, D_MIN, D_MAX } from '../src/fsrs.js';
import { cardIssues } from '../src/invariants.js';
import {
  ANOMALY_FAMILIES, scanCard, scanLibrary, repairCard, repairLibrary
} from '../src/reparation.js';

const CFG = { w: W6 };
const NOW = Date.UTC(2026, 8, 20, 9, 0, 0);
let nextId = 0;
const makeId = () => 'reparee-' + (++nextId);

const carte = (extra = {}) => ({ id: 'c1', f: 'recto', b: 'verso', ...extra });

describe('8 familles, ni plus ni moins', () => {
  it('exactement 8 familles, chacune avec un code unique', () => {
    expect(ANOMALY_FAMILIES).toHaveLength(8);
    expect(new Set(ANOMALY_FAMILIES.map(f => f.code)).size).toBe(8);
  });
});

/* Une carte fabriquée par famille — sans id pour bien voir la famille
   « structure » sans dépendre d'une valeur d'identifiant particulière. */
const CASSEES = {
  structure_id: () => { const c = carte(); delete c.id; return c; },
  structure_contenu: () => carte({ f: '' }),
  state: () => carte({ st: 7 }),
  bornes: () => carte({ n: 1, S: -1, D: 99, F: -5 }),
  memoire_orpheline_revisee: () => carte({ n: 4, i: 12, d: NOW }),
  memoire_orpheline_neuve: () => carte({ n: 0, S: 5, D: 4, lr: NOW - 1000 }),
  echeance_anterieure: () => carte({ n: 1, S: 5, D: 4, lr: NOW, d: NOW - 1000 }),
  palier_incoherent: () => carte({ st: 2, sp: 3, n: 1, S: 5, D: 4 }),
  compteurs: () => carte({ n: -3, l: 9 })
};

describe('scanCard — chaque carte fabriquée porte bien sa famille', () => {
  it('structure (id manquant)', () => {
    expect(scanCard(CASSEES.structure_id())).toEqual(['structure']);
  });
  it('structure (contenu manquant)', () => {
    expect(scanCard(CASSEES.structure_contenu())).toEqual(['structure']);
  });
  it('state', () => {
    expect(scanCard(CASSEES.state())).toEqual(['state']);
  });
  it('hors-bornes', () => {
    expect(scanCard(CASSEES.bornes())).toEqual(['hors-bornes']);
  });
  it('memoire-orpheline-revisee', () => {
    expect(scanCard(CASSEES.memoire_orpheline_revisee())).toEqual(['memoire-orpheline-revisee']);
  });
  it('memoire-orpheline-neuve', () => {
    expect(scanCard(CASSEES.memoire_orpheline_neuve())).toEqual(['memoire-orpheline-neuve']);
  });
  it('echeance-anterieure', () => {
    expect(scanCard(CASSEES.echeance_anterieure())).toEqual(['echeance-anterieure']);
  });
  it('palier-incoherent', () => {
    expect(scanCard(CASSEES.palier_incoherent())).toEqual(['palier-incoherent']);
  });
  it('compteurs', () => {
    expect(scanCard(CASSEES.compteurs())).toEqual(['compteurs']);
  });
  it('une carte saine ne porte aucune famille', () => {
    expect(scanCard(carte())).toEqual([]);
  });
});

describe('repairCard — répare chaque famille sans laisser d’anomalie', () => {
  it('structure : id manquant → identifiant posé, carte gardée', () => {
    const c = CASSEES.structure_id();
    const r = repairCard(c, CFG, makeId, NOW);
    expect(r.drop).toBe(false);
    expect(r.families).toEqual(['structure']);
    expect(c.id).toBeTruthy();
    expect(cardIssues(c)).toEqual([]);
  });

  it('structure : contenu manquant → carte retirée', () => {
    const c = CASSEES.structure_contenu();
    const r = repairCard(c, CFG, makeId, NOW);
    expect(r.drop).toBe(true);
    expect(r.families).toEqual(['structure']);
  });

  it('state : état invalide → réinitialisé (neuve)', () => {
    const c = CASSEES.state();
    const r = repairCard(c, CFG, makeId, NOW);
    expect(r.families).toContain('state');
    expect(cardIssues(c)).toEqual([]);
    expect(c.st).toBeUndefined();
  });

  it('hors-bornes : S/D/F ramenés dans les bornes du moteur', () => {
    const c = CASSEES.bornes();
    const r = repairCard(c, CFG, makeId, NOW);
    expect(r.families).toContain('hors-bornes');
    expect(c.S).toBeGreaterThanOrEqual(S_MIN);
    expect(c.S).toBeLessThanOrEqual(S_MAX);
    expect(c.D).toBeGreaterThanOrEqual(D_MIN);
    expect(c.D).toBeLessThanOrEqual(D_MAX);
    expect(cardIssues(c)).toEqual([]);
  });

  it('memoire-orpheline-revisee : fiche révisée sans mémoire, migrée', () => {
    const c = CASSEES.memoire_orpheline_revisee();
    const r = repairCard(c, CFG, makeId, NOW);
    expect(r.families).toContain('memoire-orpheline-revisee');
    expect(c.S).toBeDefined();
    expect(c.D).toBeDefined();
    expect(cardIssues(c)).toEqual([]);
  });

  it('memoire-orpheline-revisee : même sans intervalle connu (i absent), migrée quand même', () => {
    const c = carte({ n: 2 });
    const r = repairCard(c, CFG, makeId, NOW);
    expect(r.families).toContain('memoire-orpheline-revisee');
    expect(cardIssues(c)).toEqual([]);
  });

  it('memoire-orpheline-neuve : compteur relevé plutôt que mémoire effacée', () => {
    const c = CASSEES.memoire_orpheline_neuve();
    const avantS = c.S, avantD = c.D;
    const r = repairCard(c, CFG, makeId, NOW);
    expect(r.families).toContain('memoire-orpheline-neuve');
    expect(c.S).toBe(avantS);
    expect(c.D).toBe(avantD);
    expect(c.n).toBeGreaterThan(0);
    expect(cardIssues(c)).toEqual([]);
  });

  it('echeance-anterieure : échéance ramenée à la dernière révision', () => {
    const c = CASSEES.echeance_anterieure();
    const r = repairCard(c, CFG, makeId, NOW);
    expect(r.families).toContain('echeance-anterieure');
    expect(c.d).toBe(c.lr);
    expect(cardIssues(c)).toEqual([]);
  });

  it('palier-incoherent : palier retiré en révision', () => {
    const c = CASSEES.palier_incoherent();
    const r = repairCard(c, CFG, makeId, NOW);
    expect(r.families).toContain('palier-incoherent');
    expect(c.sp).toBeUndefined();
    expect(cardIssues(c)).toEqual([]);
  });

  it('compteurs : négatifs et incohérents corrigés', () => {
    const c = CASSEES.compteurs();
    const r = repairCard(c, CFG, makeId, NOW);
    expect(r.families).toContain('compteurs');
    expect(c.n).toBeGreaterThanOrEqual(0);
    expect(c.l).toBeLessThanOrEqual(c.n);
    expect(cardIssues(c)).toEqual([]);
  });

  it('une carte saine ne bouge pas', () => {
    const c = carte();
    const r = repairCard(c, CFG, makeId, NOW);
    expect(r.families).toEqual([]);
    expect(r.drop).toBe(false);
  });
});

describe('repairLibrary — base corrompue fabriquée, toutes familles à la fois', () => {
  const fabriqueBase = () => [
    {
      id: 'd1',
      cards: [
        CASSEES.structure_id(), CASSEES.structure_contenu(), CASSEES.state(),
        CASSEES.bornes(), CASSEES.memoire_orpheline_revisee()
      ]
    },
    {
      id: 'd2',
      cards: [
        CASSEES.memoire_orpheline_neuve(), CASSEES.echeance_anterieure(),
        CASSEES.palier_incoherent(), CASSEES.compteurs(), carte({ id: 'saine' })
      ]
    }
  ];

  it('détecte les 8 familles sur la base corrompue (scanLibrary)', () => {
    const { tally, cards } = scanLibrary(fabriqueBase());
    for (const f of ANOMALY_FAMILIES) expect(tally[f.code]).toBeGreaterThan(0);
    expect(cards).toBe(9);            // toutes sauf la carte saine
  });

  it('répare tout : plus aucune anomalie, la carte vide a disparu, la saine est intacte', () => {
    const decks = fabriqueBase();
    const { tally, dropped, touched } = repairLibrary(decks, CFG, makeId, NOW);

    for (const f of ANOMALY_FAMILIES) expect(tally[f.code]).toBeGreaterThan(0);
    expect(dropped).toBe(1);          // seule structure_contenu est retirée
    expect(touched.map(d => d.id).sort()).toEqual(['d1', 'd2']);

    const { tally: apres, cards } = scanLibrary(decks);
    for (const f of ANOMALY_FAMILIES) expect(apres[f.code]).toBe(0);
    expect(cards).toBe(0);

    const toutesLesCartes = decks.flatMap(d => d.cards);
    expect(toutesLesCartes).toHaveLength(9);   // 10 fabriquées - 1 retirée
    expect(toutesLesCartes.find(c => c.id === 'saine')).toEqual(carte({ id: 'saine' }));
    for (const c of toutesLesCartes) expect(cardIssues(c)).toEqual([]);
  });

  it('une bibliothèque déjà saine ne change rien', () => {
    const decks = [{ id: 'd1', cards: [carte({ id: 'x1' }), carte({ id: 'x2' })] }];
    const { tally, dropped, touched } = repairLibrary(decks, CFG, makeId, NOW);
    for (const f of ANOMALY_FAMILIES) expect(tally[f.code]).toBe(0);
    expect(dropped).toBe(0);
    expect(touched).toEqual([]);
  });
});
