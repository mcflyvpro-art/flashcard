/* Ce que le moteur doit tenir, quoi qu'on lui donne. Les propriétés
   testées ici ne sont pas des détails d'affichage : ce sont les promesses
   qu'un élève constate à l'écran, et qu'un bug rend absurdes. */
import { describe, it, expect } from 'vitest';
import { W6, W7, DAY, fsrsPlan, fsrsStates, fsrsR, fsrsIvl, fsrsInit, isV7,
         f7bisect, f7curve, f6next, f6shortS, dayNo, fsrsReplayCard } from '../src/fsrs.js';

const CFG = { w: W6, dr: 0.9, maxIvl: 36500 };
const NOW = Date.UTC(2026, 8, 17, 9, 0, 0);

/* Un échantillon large de fiches plausibles : neuves, en apprentissage,
   en révision depuis un jour comme depuis trois ans. */
function fiches() {
  const out = [{ id: 'neuve' }];
  let n = 0;
  for (const S of [0.4, 1, 2.5, 7, 21, 60, 180, 365, 1200]) {
    for (const D of [1, 2.5, 5, 7.5, 10]) {
      for (const st of [1, 2, 3]) {
        for (const depuis of [0, 1, 3, 10, 400]) {
          out.push({ id: 'c' + (n++), S, D, F: S, st, sp: st === 2 ? null : 0,
                     i: Math.round(S), n: 3, lr: NOW - depuis * DAY });
        }
      }
    }
  }
  return out;
}

describe('ordre des quatre boutons', () => {
  it('une note plus haute ne ramène jamais la fiche plus tôt', () => {
    const fautes = [];
    for (const c of fiches()) {
      const s = fsrsStates(c, NOW, CFG);
      for (let g = 1; g < 4; g++) {
        if (s[g].d < s[g - 1].d) {
          fautes.push(`${c.id} : note ${g - 1} → ${Math.round((s[g - 1].d - NOW) / DAY)} j, `
            + `note ${g} → ${Math.round((s[g].d - NOW) / DAY)} j`);
        }
      }
    }
    expect(fautes).toEqual([]);
  });

  /* Le cas exact rapporté : « difficile 3 j, facile 1 j ». Avant la passe
     d'ordonnancement, le flou tirait indépendamment pour chaque note. */
  it('sans la passe d’ordonnancement, le flou peut inverser deux notes', () => {
    let inversions = 0;
    for (const c of fiches()) {
      const brut = [0, 1, 2, 3].map(g => fsrsPlan(c, g, NOW, CFG, true));
      for (let g = 1; g < 4; g++) {
        if (brut[g].st === 2 && brut[g - 1].st === 2 && brut[g].ivl < brut[g - 1].ivl) inversions++;
      }
    }
    expect(inversions).toBeGreaterThan(0);        // le bug existait bien
  });
});

describe('bornes', () => {
  it('un intervalle de révision vaut au moins un jour et jamais plus que le plafond', () => {
    const cfg = { ...CFG, maxIvl: 180 };
    for (const c of fiches()) {
      for (const s of fsrsStates(c, NOW, cfg)) {
        if (s.st !== 2) continue;
        expect(s.ivl).toBeGreaterThanOrEqual(1);
        expect(s.ivl).toBeLessThanOrEqual(180);
      }
    }
  });

  it('l’échéance est toujours dans le futur', () => {
    for (const c of fiches()) {
      for (const s of fsrsStates(c, NOW, CFG)) expect(s.d).toBeGreaterThan(NOW);
    }
  });

  it('la mémoire reste dans les bornes du modèle', () => {
    for (const c of fiches()) {
      for (const s of fsrsStates(c, NOW, CFG)) {
        expect(s.S).toBeGreaterThan(0);
        expect(Number.isFinite(s.S)).toBe(true);
        expect(s.D).toBeGreaterThanOrEqual(1);
        expect(s.D).toBeLessThanOrEqual(10);
      }
    }
  });
});

describe('stabilité du calcul', () => {
  it('deux appels sur la même fiche donnent le même résultat', () => {
    for (const c of fiches()) {
      expect(fsrsStates(c, NOW, CFG).map(s => s.d))
        .toEqual(fsrsStates(c, NOW, CFG).map(s => s.d));
    }
  });

  it('le calcul ne modifie pas la fiche qu’on lui donne', () => {
    const c = { id: 'x', S: 10, D: 5, F: 10, st: 2, i: 10, n: 4, lr: NOW - 10 * DAY };
    const copie = JSON.parse(JSON.stringify(c));
    fsrsStates(c, NOW, CFG);
    expect(c).toEqual(copie);
  });
});

describe('apprentissage', () => {
  it('une fiche neuve notée « encore » revient dans la minute, pas dans la journée', () => {
    const s = fsrsStates({ id: 'n' }, NOW, CFG);
    expect(s[0].d - NOW).toBeLessThan(DAY);
    expect(s[0].st).toBe(1);
  });

  it('une fiche neuve notée « facile » sort de l’apprentissage', () => {
    const s = fsrsStates({ id: 'n' }, NOW, CFG);
    expect(s[3].st).toBe(2);
    expect(s[3].ivl).toBeGreaterThanOrEqual(1);
  });

  it('« encore » sur une fiche sue la fait retomber en rechute, pas à zéro', () => {
    const c = { id: 'm', S: 100, D: 5, F: 100, st: 2, i: 90, n: 12, lr: NOW - 90 * DAY };
    const s = fsrsStates(c, NOW, CFG);
    expect(s[0].st).toBe(3);
    expect(s[0].S).toBeLessThan(c.S);       // la stabilité baisse
    expect(s[0].S).toBeGreaterThan(0);      // mais le passé n'est pas effacé
  });
});

describe('conformité au moteur d’Anki', () => {
  /* DEFAULT_PARAMETERS du crate fsrs 6.6.2, la version qu'Anki épingle.
     Si cette liste bouge sans qu'on l'ait décidé, l'app ne tourne plus sur
     le moteur d'Anki. */
  it('les 21 paramètres par défaut sont ceux du crate', () => {
    expect(W6).toEqual([0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001,
      1.8722, 0.1666, 0.796, 1.4835, 0.0614, 0.2629, 1.6483, 0.6014, 1.8729, 0.5425,
      0.0912, 0.0658, 0.1542]);
  });

  it('la courbe d’oubli part de 1 et décroît', () => {
    const m = { S: 10, D: 5, F: 10 };
    expect(fsrsR(W6, 0, m)).toBeCloseTo(1, 6);
    let av = 1;
    for (const t of [1, 2, 5, 10, 20, 50, 200]) {
      const r = fsrsR(W6, t, m);
      expect(r).toBeLessThan(av);
      av = r;
    }
  });

  it('à la rétention visée, l’intervalle vaut la stabilité', () => {
    const m = fsrsInit(W6, 3);
    const t = fsrsIvl(W6, m, 0.9);
    expect(fsrsR(W6, t, m)).toBeCloseTo(0.9, 3);
  });

  it('viser une rétention plus haute rapproche l’échéance', () => {
    const m = { S: 50, D: 5, F: 50 };
    expect(fsrsIvl(W6, m, 0.95)).toBeLessThan(fsrsIvl(W6, m, 0.85));
  });
});

/* FSRS-7 (34 paramètres, model_v7.rs) n'est branché nulle part dans
   l'app aujourd'hui — Anki, et donc W6, reste la seule version en usage
   (voir le bandeau de src/fsrs.js). Le portage reste néanmoins dans le
   noyau, sélectionné par `isV7` sur la seule longueur de `w` : mêmes
   propriétés que FSRS-6, vérifiées ici pour qu'il ne se dégrade pas en
   silence si l'amont le publie un jour. */
describe('FSRS-7 (34 paramètres)', () => {
  const CFG7 = { w: W7, dr: 0.9, maxIvl: 36500 };

  it('sélectionné par la longueur de w, pas par un réglage explicite', () => {
    expect(isV7(W7)).toBe(true);
    expect(isV7(W6)).toBe(false);
  });

  it('une note plus haute ne ramène jamais la fiche plus tôt', () => {
    const fautes = [];
    for (const c of fiches()) {
      const s = fsrsStates(c, NOW, CFG7);
      for (let g = 1; g < 4; g++) {
        if (s[g].d < s[g - 1].d) fautes.push(c.id);
      }
    }
    expect(fautes).toEqual([]);
  });

  it('un intervalle de révision vaut au moins un jour et jamais plus que le plafond', () => {
    const cfg = { ...CFG7, maxIvl: 180 };
    for (const c of fiches()) {
      for (const s of fsrsStates(c, NOW, cfg)) {
        if (s.st !== 2) continue;
        expect(s.ivl).toBeGreaterThanOrEqual(1);
        expect(s.ivl).toBeLessThanOrEqual(180);
      }
    }
  });

  it('l’échéance est toujours dans le futur, et la mémoire reste dans les bornes du modèle', () => {
    for (const c of fiches()) {
      for (const s of fsrsStates(c, NOW, CFG7)) {
        expect(s.d).toBeGreaterThan(NOW);
        expect(s.S).toBeGreaterThan(0);
        expect(Number.isFinite(s.S)).toBe(true);
        expect(s.F).toBeGreaterThan(0);
        expect(Number.isFinite(s.F)).toBe(true);
        expect(s.D).toBeGreaterThanOrEqual(1);
        expect(s.D).toBeLessThanOrEqual(10);
      }
    }
  });

  it('deux appels sur la même fiche donnent le même résultat, sans la modifier', () => {
    const c = { id: 'x', S: 10, D: 5, F: 8, st: 2, i: 10, n: 4, lr: NOW - 10 * DAY };
    const copie = JSON.parse(JSON.stringify(c));
    expect(fsrsStates(c, NOW, CFG7).map(s => s.d))
      .toEqual(fsrsStates(c, NOW, CFG7).map(s => s.d));
    expect(c).toEqual(copie);
  });

  it('une fiche neuve notée « facile » sort de l’apprentissage', () => {
    const s = fsrsStates({ id: 'n' }, NOW, CFG7);
    expect(s[3].st).toBe(2);
    expect(s[3].ivl).toBeGreaterThanOrEqual(1);
  });

  it('« encore » sur une fiche sue la fait retomber en rechute, pas à zéro', () => {
    const c = { id: 'm', S: 100, D: 5, F: 80, st: 2, i: 90, n: 12, lr: NOW - 90 * DAY };
    const s = fsrsStates(c, NOW, CFG7);
    expect(s[0].st).toBe(3);
    expect(s[0].S).toBeLessThan(c.S);
    expect(s[0].S).toBeGreaterThan(0);
  });

  it('la courbe à deux traces part de 1 et décroît', () => {
    const m = { S: 10, D: 5, F: 8 };
    expect(f7curve(W7, 0, m)).toBeCloseTo(1, 4);
    let av = 1;
    for (const t of [1, 2, 5, 10, 20, 50, 200]) {
      const r = f7curve(W7, t, m);
      expect(r).toBeLessThan(av);
      av = r;
    }
  });

  it('à la rétention visée, la courbe retombe sur la rétention demandée', () => {
    const m = fsrsInit(W7, 3);
    const t = fsrsIvl(W7, m, 0.9);
    expect(f7curve(W7, t, m)).toBeCloseTo(0.9, 2);
  });

  it('f7bisect retrouve seul le même intervalle que la résolution par défaut (repli direct)', () => {
    const m = { S: 20, D: 5, F: 15 };
    const t = f7bisect(W7, m, 0.9);
    expect(f7curve(W7, t, m)).toBeCloseTo(0.9, 2);
  });
});

/* L'équilibreur de charge d'Anki (24.11+) : dans la fourchette du flou, le
   jour vide l'emporte, et l'aperçu reste ce qui sera appliqué. */
import { equilibrer, fuzzBornes, EQUILIBRE_MAX } from '../src/fsrs.js';

describe('équilibreur de charge', () => {
  it('un jour vide pèse 1, un jour chargé presque rien', () => {
    const charge = j => (j === 9 ? 0 : 40);
    for (const rnd of [0.01, 0.2, 0.5, 0.8, 0.99]) expect(equilibrer(7, 11, charge, rnd)).toBe(9);
  });
  it('à charge égale, le tirage reste dans la fourchette', () => {
    const [lo, hi] = fuzzBornes(10, 36500);
    for (let k = 0; k < 50; k++) {
      const j = equilibrer(lo, hi, () => 3, k / 50);
      expect(j).toBeGreaterThanOrEqual(lo);
      expect(j).toBeLessThanOrEqual(hi);
    }
  });
  it('les quatre boutons disent ce qui sera appliqué, et restent ordonnés', () => {
    const c = { id: 'eq', st: 2, S: 12, D: 5, F: 12, lr: NOW - 12 * DAY, n: 4, i: 12, d: NOW };
    const cfg = { ...CFG, charge: j => (j % 3 ? 25 : 2) };
    const a = fsrsStates(c, NOW, cfg), b = fsrsStates(c, NOW, cfg);
    expect(a.map(x => x.ivl)).toEqual(b.map(x => x.ivl));
    for (let g = 2; g < 4; g++) if (a[g - 1].st === 2) expect(a[g].ivl).toBeGreaterThan(a[g - 1].ivl);
  });
  it('au-delà de 90 jours, le flou ordinaire', () => {
    const c = { id: 'loin', st: 2, S: 400, D: 5, F: 400, lr: NOW - 300 * DAY, n: 9, i: 300, d: NOW };
    const sans = fsrsPlan(c, 2, NOW, CFG, true), avec = fsrsPlan(c, 2, NOW, { ...CFG, charge: () => 99 }, true);
    expect(sans.ivl).toBeGreaterThan(EQUILIBRE_MAX);
    expect(avec.ivl).toBe(sans.ivl);
  });
});

/* Anki compte l'écart entre deux lectures en jours de calendrier, avec un
   jour qui change à 4 h. Mirandola comptait des fenêtres de 24 h en notant :
   lue à 22 h puis à 8 h le lendemain, une page passait par la formule de
   court terme (0 jour) au lieu de celle de long terme (1 jour). */
describe('les jours écoulés, comptés comme Anki', () => {
  const local = (j, h, m = 0) => new Date(2026, 9, j, h, m).getTime();
  const c = lr => ({ id: 'j', st: 2, S: 5, D: 5, F: 5, n: 3, i: 5, lr, d: lr + 5 * DAY });
  it('22 h puis 8 h le lendemain : un jour, la formule de long terme', () => {
    expect(dayNo(local(26, 8)) - dayNo(local(25, 22))).toBe(1);
    const p = fsrsPlan(c(local(25, 22)), 2, local(26, 8), CFG, false);
    expect(p.S).toBeCloseTo(f6next(W6, { S: 5, D: 5, F: 5 }, 1, 3).S, 9);
  });
  it('23 h puis 3 h : encore le même jour, la formule de court terme', () => {
    expect(dayNo(local(26, 3)) - dayNo(local(25, 23))).toBe(0);
    const p = fsrsPlan(c(local(25, 23)), 2, local(26, 3), CFG, false);
    expect(p.S).toBeCloseTo(f6shortS(W6, 5, 3), 9);
  });
  it('3 h puis 5 h : la bascule passe entre les deux', () => {
    expect(dayNo(local(26, 5)) - dayNo(local(26, 3))).toBe(1);
  });
  it('un changement d’heure ne décale aucun jour', () => {
    // la nuit du 25 octobre 2026 en Europe, et n'importe quel fuseau sinon
    for (let j = 20; j < 31; j++) expect(dayNo(local(j + 1, 12)) - dayNo(local(j, 12))).toBe(1);
  });
  it('rejouer le journal compte comme noter', () => {
    const log = [{ rating: 2, created_at: local(24, 20) }, { rating: 2, created_at: local(25, 22) },
      { rating: 2, created_at: local(26, 8) }];
    const rejoue = fsrsReplayCard(log, CFG);
    let m = fsrsInit(W6, 3);
    m = f6next(W6, m, 1, 3);
    m = f6next(W6, m, 1, 3);
    expect(rejoue.S).toBeCloseTo(m.S, 9);
  });
});
