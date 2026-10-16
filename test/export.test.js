/* M04.T6 — export puis import de toute la bibliothèque (src/sauvegarde.js) :
   l'état d'arrivée doit être identique au bit près à celui de départ. */
import { describe, it, expect } from 'vitest';
import { W6, fsrsReplayCard } from '../src/fsrs.js';
import { FORMAT, VERSION, exportLibrary, readBackup, restoreLibrary } from '../src/sauvegarde.js';

const NOW = Date.UTC(2026, 9, 16, 10);
const ME = 'compte-a';

/* Une bibliothèque réaliste : matières, réglages de paquet, cartes neuves,
   en apprentissage (palier), en révision (états produits par le vrai
   moteur), suspendues, avec des flottants à pleine précision. */
function bibliotheque() {
  let s = 11;
  const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
  const decks = [];
  for (let k = 0; k < 4; k++) {
    const cards = [];
    for (let i = 0; i < 150; i++) {
      const c = { id: `c${k}-${i}`, f: `recto ${k}.${i} — « ${'é'.repeat(i % 3)} »`, b: `verso ${i}\nligne 2` };
      const r = rnd();
      if (r < 0.5) {
        const notes = Array.from({ length: 1 + Math.floor(rnd() * 8) }, () => Math.floor(rnd() * 4));
        const log = notes.map((rating, j) => ({ rating, created_at: new Date(NOW - (40 - j * 3) * 864e5).toISOString() }));
        Object.assign(c, fsrsReplayCard(log, { w: W6, dr: 0.9, maxIvl: 36500 }));
        c.d = c.lr + c.i * 864e5;
        delete c.sp;
      } else if (r < 0.7) {
        Object.assign(c, { st: 1, sp: 1, S: 0.2123456789012345, D: 6.987654321, F: 0.2123456789012345, lr: NOW - 6e5, d: NOW + 6e5, n: 0, l: 0 });
      }
      if (rnd() < 0.05) c.x = 1;
      cards.push(c);
    }
    decks.push({ id: `deck-${k}`, name: `Paquet ${k}`, subject: k % 2 ? 'maths' : 'svt', hidden: k === 3, pinned: k === 0,
                 pos: -1700000000 + k, meta: { tol: 'strict', langf: 'fr-FR', langb: 'en-GB', timer: 20 }, rev: 7 + k, cards });
  }
  return {
    subjects: [{ id: 'maths', name: 'Mathématiques', color: 'bleu', pos: 0 }, { id: 'svt', name: 'SVT', color: 'vert', pos: 1 }],
    decks, hist: {}
  };
}

const sans = (decks, ...cles) => decks.map(d => { const o = { ...d }; for (const k of cles) delete o[k]; return o; });
const sansRev = decks => sans(decks, 'rev');
const fichier = (db, owner = ME) => JSON.stringify(exportLibrary(db, owner, NOW));

describe('le fichier', () => {
  it('porte son format, sa version, son compte et sa date', () => {
    const f = JSON.parse(fichier(bibliotheque()));
    expect(f.format).toBe(FORMAT);
    expect(f.version).toBe(VERSION);
    expect(f.owner).toBe(ME);
    expect(f.exported_at).toBe('2026-10-16T10:00:00.000Z');
  });
  it('ne contient ni le rev de concurrence ni les marques d’écran', () => {
    const db = bibliotheque();
    db.decks[0].cards[0].dup = 'deck'; db.decks[0].cards[1].big = 'f';
    const f = JSON.parse(fichier(db));
    expect(f.decks.some(d => 'rev' in d)).toBe(false);
    expect(f.decks[0].cards[0].dup).toBeUndefined();
    expect(f.decks[0].cards[1].big).toBeUndefined();
  });
  it('l’export ne touche pas à la bibliothèque', () => {
    const db = bibliotheque(), avant = JSON.stringify(db);
    fichier(db);
    expect(JSON.stringify(db)).toBe(avant);
  });
});

describe('export puis import = état identique au bit près', () => {
  it('dans une bibliothèque vide, sur le même compte', () => {
    const src = bibliotheque();
    const lu = readBackup(fichier(src));
    expect(lu.ok).toBe(true);
    const dst = { subjects: [], decks: [], hist: {} };
    const r = restoreLibrary(dst, lu.data, ME, () => { throw new Error('aucun identifiant neuf attendu'); });
    expect(r).toMatchObject({ added: 4, replaced: 0, foreign: false });
    expect(JSON.stringify(dst.subjects)).toBe(JSON.stringify(src.subjects));
    expect(JSON.stringify(dst.decks)).toBe(JSON.stringify(sansRev(src.decks)));
    // chaque flottant revient à l'identique, pas seulement « à peu près »
    const S = d => d.decks.flatMap(x => x.cards).map(c => c.S);
    expect(S(dst)).toEqual(S(src));
  });

  it('par-dessus une bibliothèque modifiée depuis : chaque paquet revient à l’état du fichier, son rev local gardé', () => {
    const src = bibliotheque();
    const f = fichier(src);
    const db = JSON.parse(JSON.stringify(src));
    db.decks[1].cards[3].S = 999; db.decks[1].cards.pop(); db.decks[2].name = 'renommé'; db.decks[0].rev = 42;
    const r = restoreLibrary(db, readBackup(f).data, ME, () => 'x');
    expect(r).toMatchObject({ added: 0, replaced: 4 });
    expect(JSON.stringify(sansRev(db.decks))).toBe(JSON.stringify(sansRev(src.decks)));
    expect(db.decks[0].rev).toBe(42);
  });

  it('exporter à nouveau ce qu’on vient d’importer redonne le même fichier', () => {
    const f1 = fichier(bibliotheque());
    const db = { subjects: [], decks: [], hist: {} };
    restoreLibrary(db, readBackup(f1).data, ME, () => 'x');
    expect(fichier(db)).toBe(f1);
  });
});

describe('le fichier d’un autre compte', () => {
  it('reçoit de nouveaux identifiants de paquet, contenu et apprentissage intacts', () => {
    const src = bibliotheque();
    let n = 0;
    const db = { subjects: [], decks: [], hist: {} };
    const r = restoreLibrary(db, readBackup(fichier(src, 'compte-b')).data, ME, () => 'neuf-' + n++);
    expect(r.foreign).toBe(true);
    expect(db.decks.map(d => d.id)).toEqual(['neuf-0', 'neuf-1', 'neuf-2', 'neuf-3']);
    expect(JSON.stringify(sans(db.decks, 'id', 'rev'))).toBe(JSON.stringify(sans(src.decks, 'id', 'rev')));
  });
});

describe('un fichier qui n’en est pas un', () => {
  it.each([
    ['pas du JSON', 'coucou', 'illisible'],
    ['autre format', JSON.stringify({ format: 'anki' }), 'pas une sauvegarde'],
    ['version future', JSON.stringify({ format: FORMAT, version: 99, subjects: [], decks: [] }), 'Version'],
    ['paquets absents', JSON.stringify({ format: FORMAT, version: VERSION, subjects: [] }), 'incomplète'],
    ['paquet sans cartes', JSON.stringify({ format: FORMAT, version: VERSION, subjects: [], decks: [{ id: 'a' }] }), 'mal formé'],
    ['carte nulle', JSON.stringify({ format: FORMAT, version: VERSION, subjects: [], decks: [{ id: 'a', cards: [null] }] }), 'Carte']
  ])('%s → refusé avec un message lisible', (_, txt, msg) => {
    const r = readBackup(txt);
    expect(r.ok).toBe(false);
    expect(r.error).toContain(msg);
  });
});
