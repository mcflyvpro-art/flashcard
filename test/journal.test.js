// Le journal de lecture (src/journal.js) : l'activité ne bouge plus quoi
// qu'on fasse de ses livres, la mémoire suit les cartes d'aujourd'hui, une
// matière se reconnaît à son nom, et l'appareil ne compte jamais deux fois
// une révision que la base a déjà.
import { describe, it, expect } from 'vitest';
import {
  PALIERS, palier, rassembler, activite, nommerMatieres, nommerLivres, serie, grille, decaler,
  jourSemaine, savoir, resistantes, etatCarte, restantsApres, ecartJours, cleNom
} from '../src/journal.js';
import { W6 } from '../src/fsrs.js';

const AUJ = '2026-10-25';

/* Ce que la base rend, à partir de lignes `reviews` complètes : le même
   regroupement que la fonction SQL journal() (jour, matière, livre, palier). */
function base(lignes, locaux = []) {
  const g = new Map(), h = new Map(), mat = {}, liv = {};
  for (const r of lignes) {
    const j = r.j, p = palier(r.ecart), k = [j, r.subject || '', r.deck_id, p].join('|');
    const v = g.get(k) || [j, r.subject || '', r.deck_id, p, 0, 0, 0];
    v[4]++; if (r.correct) v[5]++; v[6] += r.ms;
    g.set(k, v);
    const kh = j + '|' + (r.h || 0); h.set(kh, [j, r.h || 0, (h.get(kh) || [0, 0, 0])[2] + 1]);
    if (r.subject_name) mat[r.subject || ''] = r.subject_name;
    if (r.deck_name) liv[r.deck_id] = r.deck_name;
  }
  const ids = new Set(lignes.map(r => r.client_id));
  return {
    jours: [...g.values()], heures: [...h.values()], matieres: mat, livres: liv,
    toujours: { n: lignes.length, ok: lignes.filter(r => r.correct).length, ms: lignes.reduce((a, r) => a + r.ms, 0) },
    connus: locaux.map(r => r.client_id).filter(id => ids.has(id))
  };
}

/* L'app : chaque révision photographie le livre et sa matière du moment. */
function app() {
  const st = { subjects: [{ id: 'droit', name: 'Droit', color: 'pink' }, { id: 'anglais', name: 'Anglais', color: 'graphite' }],
               decks: [], log: [], n: 0 };
  st.livre = (id, name, subject, cartes) => {
    const d = { id, name, subject, cards: cartes.map((c, i) => ({ id: id + ':' + i, f: c, b: c })) };
    st.decks.push(d); return d;
  };
  st.lire = (deckId, j, minutes, justes = true) => {
    const d = st.decks.find(x => x.id === deckId), s = st.subjects.find(x => x.id === d.subject);
    for (const c of d.cards) {
      st.log.push({ client_id: 'r' + st.n++, j, h: 20, deck_id: d.id, card_id: c.id, subject: d.subject,
        subject_name: s ? s.name : null, deck_name: d.name, correct: justes, ms: minutes * 60e3 / d.cards.length,
        ecart: c.vu ? ecartJours(c.vu, j) : -1 });
      c.vu = j; c.n = (c.n || 0) + 1; c.S = 5; c.st = 2; c.i = 25; c.lr = Date.parse(j + 'T20:00:00');
    }
  };
  st.journal = (depuis = null) => {
    const J = rassembler(base(st.log), []);
    const a = activite(J, { depuis, aujourdhui: AUJ });
    return { a, mat: nommerMatieres(a.matieres, st.subjects, J.matieres), liv: nommerLivres(a.livres, st.decks, J.livres) };
  };
  return st;
}

describe('palier : la même règle que width_bucket(ecart, PALIERS) en base', () => {
  it('première lecture, jour même, puis les quatre paliers', () => {
    expect(PALIERS).toEqual([1, 3, 14, 90]);
    expect([null, -1, 0, 1, 2, 3, 13, 14, 89, 90, 400].map(palier)).toEqual([-1, -1, 0, 1, 1, 2, 2, 3, 3, 4, 4]);
  });
});

describe('trois heures de droit, quoi qu’on fasse du livre ensuite', () => {
  const minutes = st => Math.round(st.journal().mat.reduce((a, m) => a + m.ms, 0) / 60e3);
  const droit = st => { const m = st.journal().mat.find(x => x.nom === 'Droit'); return m ? Math.round(m.ms / 60e3) : 0; };

  it('changer la matière du livre ne réécrit pas le passé ; la suite va dans la nouvelle', () => {
    const st = app();
    st.livre('L1', 'Contrats', 'droit', ['a', 'b', 'c']);
    st.lire('L1', '2026-10-20', 180);
    st.decks[0].subject = 'anglais';
    expect(droit(st)).toBe(180);
    st.lire('L1', '2026-10-21', 30);
    expect(droit(st)).toBe(180);
    expect(st.journal().mat.find(x => x.nom === 'Anglais').ms / 60e3).toBeCloseTo(30);
    expect(minutes(st)).toBe(210);
  });

  it('fusionner, supprimer, recréer depuis un partage avec une autre matière : rien ne bouge', () => {
    const st = app();
    st.livre('L1', 'Contrats', 'droit', ['a', 'b']);
    st.livre('L2', 'Obligations', 'droit', ['c', 'd']);
    st.lire('L1', '2026-10-18', 120);
    st.lire('L2', '2026-10-19', 60);
    const avant = st.journal();
    // fusion : les cartes de L2 rejoignent L1 sous de nouveaux identifiants, L2 disparaît
    st.decks[0].cards.push(...st.decks[1].cards.map(c => ({ ...c, id: 'copie-' + c.id })));
    st.decks.splice(1, 1);
    expect(st.journal().a.n).toBe(avant.a.n);
    expect(droit(st)).toBe(180);
    // suppression de tout, puis le même livre revient d'un partage, en Anglais
    st.decks.length = 0;
    expect(droit(st)).toBe(180);
    expect(st.journal().liv.map(l => [l.nom, l.existe])).toEqual([['Contrats', false], ['Obligations', false]]);
    st.livre('L3', 'Contrats', 'anglais', ['a', 'b']);
    expect(droit(st)).toBe(180);
    st.lire('L3', '2026-10-24', 20);
    expect(droit(st)).toBe(180);
    expect(minutes(st)).toBe(200);
  });

  it('une matière renommée reste la même ; supprimée, elle garde son nom du moment', () => {
    const st = app();
    st.livre('L1', 'Contrats', 'droit', ['a']);
    st.lire('L1', '2026-10-20', 60);
    st.subjects[0].name = 'Droit civil';
    expect(st.journal().mat.map(m => m.nom)).toEqual(['Droit civil']);
    st.subjects.splice(0, 1);
    st.decks[0].subject = '';
    const m = st.journal().mat[0];
    expect([m.nom, m.actuelle, m.couleur]).toEqual(['Droit', false, null]);
  });

  it('deux matières du même nom (casse, accents) n’en font qu’une, aux couleurs de celle qui existe', () => {
    const subjects = [{ id: 'eco-2', name: 'éco', color: 'green' }];
    const par = new Map([['eco', { n: 2, ok: 1, ms: 1000 }], ['eco-2', { n: 3, ok: 3, ms: 2000 }], ['', { n: 1, ok: 0, ms: 10 }]]);
    const l = nommerMatieres(par, subjects, { eco: 'Éco' });
    expect(l).toEqual([
      { cle: 'eco-2', nom: 'éco', couleur: 'green', actuelle: true, n: 5, ok: 4, ms: 3000 },
      { cle: '', nom: 'Sans matière', couleur: null, actuelle: false, n: 1, ok: 0, ms: 10 }
    ]);
    expect(cleNom('  Éco ')).toBe(cleNom('eco'));
  });
});

describe('ce que l’appareil sait déjà, sans double compte', () => {
  const loc = (id, j) => ({ client_id: id, created_at: j + 'T10:00:00', deck_id: 'L', subject: 'droit', correct: true, ms: 1000, ecart: -1 });

  it('une révision que la base a déjà n’est comptée qu’une fois', () => {
    const serveur = [{ client_id: 'a', j: '2026-10-25', deck_id: 'L', subject: 'droit', correct: true, ms: 1000, ecart: -1 }];
    const locaux = [loc('a', '2026-10-25'), loc('b', '2026-10-25')];
    const J = rassembler(base(serveur, locaux), locaux);
    const a = activite(J, { aujourdhui: AUJ });
    expect(a.n).toBe(2);
    expect(J.toujours.n).toBe(2);
    expect(restantsApres(locaux, ['a']).map(r => r.client_id)).toEqual(['b']);
  });

  it('hors ligne : la révision d’hier soir compte pour hier, pas pour le jour de l’envoi', () => {
    const J = rassembler({}, [loc('x', '2026-10-24')]);
    expect([...activite(J, { aujourdhui: AUJ }).jours.keys()]).toEqual(['2026-10-24']);
  });
});

describe('activité d’une période', () => {
  const J = rassembler({ jours: [
    ['2026-10-01', 'droit', 'L', -1, 10, 6, 60000],
    ['2026-10-24', 'droit', 'L', 0, 4, 2, 8000],
    ['2026-10-24', 'droit', 'L', 2, 10, 9, 30000],
    ['2026-10-25', 'anglais', 'M', 4, 5, 4, 10000]
  ], heures: [['2026-10-24', 21, 14], ['2026-10-25', 8, 5], ['2026-10-01', 21, 10]] }, []);

  it('les sept derniers jours seulement', () => {
    const a = activite(J, { depuis: decaler(AUJ, -6), aujourdhui: AUJ });
    expect([a.n, a.ok, a.ms]).toEqual([19, 15, 48000]);
    expect(a.decouvertes).toBe(0);
    expect(a.repetees).toBe(4);
    expect(a.rappel).toBeCloseTo(13 / 15);
    expect(a.paliers.map(p => p.n)).toEqual([0, 10, 0, 5]);
    expect(a.heure).toBe(21);
    expect(a.actifs).toBe(2);
    expect(a.serie).toBe(2);
    expect(a.record).toEqual({ j: '2026-10-24', n: 14 });
  });

  it('tout : la première lecture compte comme découverte, pas dans le rappel', () => {
    const a = activite(J, { aujourdhui: AUJ });
    expect(a.n).toBe(29);
    expect(a.decouvertes).toBe(10);
    expect(a.justesse).toBeCloseTo(21 / 29);
  });
});

describe('la série', () => {
  const jours = l => new Set(l);
  it('aujourd’hui pas encore commencé : la série court jusqu’à hier', () => {
    expect(serie(jours(['2026-10-24', '2026-10-23']), AUJ)).toBe(2);
  });
  it('un jour de grâce par semaine entamée', () => {
    const l = [];
    for (let k = 0; k < 10; k++) if (k !== 3) l.push(decaler(AUJ, -k));
    expect(serie(jours(l), AUJ)).toBe(9);
    expect(serie(jours([]), AUJ)).toBe(0);
  });
});

describe('les jours, sans fuseau ni changement d’heure', () => {
  it('décaler traverse le changement d’heure et les mois', () => {
    expect(decaler('2026-10-24', 2)).toBe('2026-10-26');
    expect(decaler('2026-03-01', -1)).toBe('2026-02-28');
    expect(ecartJours('2026-10-20', '2026-10-25')).toBe(5);
    expect(jourSemaine('2026-10-26')).toBe(0);           // un lundi
  });
  it('la grille finit aujourd’hui, commence un lundi, cinq niveaux', () => {
    const g = grille(new Map([[AUJ, { n: 8 }], ['2026-10-20', { n: 1 }]]), AUJ, 3);
    expect(g).toHaveLength(3);
    expect(jourSemaine(g[0][0].j)).toBe(0);
    expect(g[2][g[2].length - 1]).toEqual({ j: AUJ, n: 8, niveau: 4 });
    expect(g.flat().find(x => x.j === '2026-10-20').niveau).toBe(1);
  });
});

describe('ce que tu sais : les cartes d’aujourd’hui', () => {
  const now = Date.parse('2026-10-25T12:00:00');
  const decks = [
    { id: 'L', name: 'Contrats', subject: 'droit', cards: [
      { id: 1 },                                                            // à lire
      { id: 2, n: 1, S: 2, st: 1, i: 0, lr: now - 3600e3, d: now - 1, l: 2, D: 7 },  // en cours, à revoir
      { id: 3, n: 4, S: 30, st: 2, i: 30, lr: now - 10 * 864e5, d: now + 20 * 864e5 },  // sue
      { id: 4, n: 2, S: 5, st: 2, i: 5, lr: now - 2 * 864e5, d: now + 1.2 * 864e5, l: 1, D: 9 },  // relue, demain
      { id: 5, x: 1, n: 3, S: 9, st: 2, i: 9 }                              // de côté
    ] }
  ];
  it('les âges, la maîtrise, le rappel estimé, les échéances', () => {
    const s = savoir(decks, { maintenant: now, w: W6 });
    expect(s.total).toEqual({ new: 1, learn: 1, young: 1, mature: 1, susp: 1 });
    expect(s.pct).toBeCloseTo(1 / 4);
    expect(s.aRevoir.slice(0, 3)).toEqual([1, 1, 0]);
    expect(s.retenue).toBeGreaterThan(.8);
    expect(s.retenue).toBeLessThan(1);
    expect(s.parMatiere.get('droit').mature).toBe(1);
  });
  it('une carte supprimée n’est plus sue ; une fusion emporte l’état des cartes', () => {
    const copie = [{ ...decks[0], cards: decks[0].cards.filter(c => c.id !== 3).map(c => ({ ...c, id: 'c' + c.id })) }];
    expect(savoir(copie, { maintenant: now, w: W6 }).total.mature).toBe(0);
    expect(savoir(copie, { maintenant: now, w: W6 }).total.young).toBe(1);
  });
  it('les pages qui résistent : les plus oubliées, jamais une carte de côté', () => {
    expect(resistantes(decks).map(r => r.c.id)).toEqual([2, 4]);
    expect(etatCarte({ x: 1, n: 9, S: 9 })).toBe('susp');
  });
});

describe('comparer et rythmer', () => {
  it('l’écart avec la période précédente, rien quand elle était vide', async () => {
    const { evolution } = await import('../src/journal.js');
    expect(evolution(120, 100)).toBeCloseTo(.2);
    expect(evolution(80, 100)).toBeCloseTo(-.2);
    expect(evolution(5, 0)).toBe(null);
  });
  it('la période précédente s’arrête la veille du premier jour', () => {
    const J = rassembler({ jours: [['2026-10-18', '', 'L', -1, 3, 3, 0], ['2026-10-19', '', 'L', -1, 5, 5, 0]] }, []);
    const a = activite(J, { depuis: '2026-10-12', jusqua: '2026-10-19', aujourdhui: AUJ });
    expect(a.n).toBe(3);
  });
  it('un bâton par jour sur 7 jours, par semaine sur un an', async () => {
    const { rythme } = await import('../src/journal.js');
    const jours = new Map([[AUJ, { n: 4, ms: 10 }], ['2026-10-19', { n: 2, ms: 5 }], ['2026-10-20', { n: 1, ms: 1 }]]);
    const r7 = rythme(jours, AUJ, 7);
    expect(r7.map(b => b.n)).toEqual([2, 1, 0, 0, 0, 0, 4]);
    expect(r7[6].j).toBe(AUJ);
    const an = rythme(jours, AUJ, 365);
    expect(an).toHaveLength(52);
    expect(jourSemaine(an[0].j)).toBe(0);
    expect(an[51]).toEqual({ j: '2026-10-19', n: 7, ms: 16 });
  });
});
