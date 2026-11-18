/* M04.T6 — export puis import de toute la bibliothèque (src/sauvegarde.js) :
   l'état d'arrivée doit être identique au bit près à celui de départ. */
import { describe, it, expect } from 'vitest';
import { W6, fsrsReplayCard } from '../src/fsrs.js';
import { BORNES, FORMAT, VERSION, exportLibrary, mediaGarde, planRestauration, readBackup, restoreLibrary } from '../src/sauvegarde.js';

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

/* 2026-11-18 : un fichier est lu comme s'il venait de n'importe qui (« évite
   les douilles d'abonnement en exportant et en réintégrant »). */
const fichierDe = (decks, owner = ME, subjects = []) => ({ format: FORMAT, version: VERSION, owner, subjects, decks });
const paquet = (id, cards = [{ id: id + '-1', f: 'a', b: 'b' }]) => ({ id, name: 'P ' + id, subject: '', cards });

describe('ce que l’offre garde', () => {
  it('Mirandola gratuit : seulement ce qui tient, dans l’ordre du fichier, et ce qui reste est compté', () => {
    const db = { subjects: [], decks: [], hist: {} };
    let n = 0;
    const r = restoreLibrary(db, fichierDe(['a', 'b', 'c', 'd'].map(x => paquet(x))), ME, () => 'neuf-' + n++, 2);
    expect(db.decks.map(d => d.id)).toEqual(['a', 'b']);
    expect(r).toMatchObject({ added: 2, refuses: 2 });
  });

  it('remettre ses propres paquets à l’état du fichier ne prend aucune place', () => {
    const db = { subjects: [], decks: [paquet('a'), paquet('b')], hist: {} };
    const plan = planRestauration(db, fichierDe([paquet('a'), paquet('b'), paquet('c')]), ME, 0);
    expect(plan.garder.map(d => d.id)).toEqual(['a', 'b']);
    expect(plan.refuses.map(d => d.id)).toEqual(['c']);
  });

  it('le fichier d’un autre compte ne remplace rien : chaque paquet prend une place', () => {
    const db = { subjects: [], decks: [paquet('a')], hist: {} };
    const plan = planRestauration(db, fichierDe([paquet('a')], 'compte-b'), ME, 0);
    expect(plan.refuses).toHaveLength(1);
  });

  it('un fichier sans compte écrit est d’ailleurs : de nouveaux identifiants', () => {
    const db = { subjects: [], decks: [], hist: {} };
    const r = restoreLibrary(db, fichierDe([paquet('a')], null), ME, () => 'neuf');
    expect(r.foreign).toBe(true);
    expect(db.decks[0].id).toBe('neuf');
  });

  it('un « devoir » écrit à la main compte comme un paquet à soi en Mirandola gratuit', () => {
    const faux = paquet('x', [{ id: 'a:faux:0', f: 'q', b: 'r' }, { id: 'a:faux:1', f: 'q2', b: 'r2' }]);
    let n = 0;
    const db = { subjects: [], decks: [], hist: {} };
    restoreLibrary(db, fichierDe([faux]), ME, () => 'id-' + n++, 5);
    expect(db.decks[0].cards.map(c => c.id)).toEqual(['id-0', 'id-1']);
    // sans borne (Mirandola+), rien ne change : un devoir reste un devoir
    const db2 = { subjects: [], decks: [], hist: {} };
    restoreLibrary(db2, fichierDe([faux]), ME, () => 'z');
    expect(db2.decks[0].cards[0].id).toBe('a:faux:0');
  });
});

describe('une carte écrite à la main', () => {
  it('garde les images et les sons de son compte et des cours, pas les autres', () => {
    expect(mediaGarde(ME + '/abc.jpg', ME)).toBe(true);
    expect(mediaGarde('cours/prof-1/abc.jpg', ME)).toBe(true);
    expect(mediaGarde('https://qqbz.supabase.co/storage/v1/object/public/media/' + ME + '/v.webm', ME)).toBe(true);
    for (const v of ['data:image/png;base64,AAAA', 'blob:https://x/1', 'https://ailleurs.fr/i.png', 'javascript:alert(1)',
      'compte-b/abc.jpg', ME + '/../compte-b/x.jpg', '/etc/x', 42, ''])
      expect(mediaGarde(v, ME)).toBe(false);
  });

  it('arrive avec un recto et un verso en texte, sans média étranger, bornée', () => {
    const db = { subjects: [], decks: [], hist: {} };
    const c = { id: 'c1', f: 12, b: null, fi: 'data:image/png;base64,AAAA', bi: ME + '/ok.jpg', S: 3 };
    restoreLibrary(db, fichierDe([paquet('p', [c, { f: 'x'.repeat(30000), b: 'y' }])]), ME, () => 'neuf');
    const [a, b] = db.decks[0].cards;
    expect(a).toEqual({ id: 'c1', f: '12', b: '', bi: ME + '/ok.jpg', S: 3 });
    expect(b.f).toHaveLength(BORNES.texte);
    expect(b.id).toBe('neuf');
  });

  it('un fichier trop grand est refusé avant d’être lu en entier', () => {
    const decks = Array.from({ length: BORNES.paquets + 1 }, (_, i) => paquet('p' + i));
    const r = readBackup(JSON.stringify(fichierDe(decks)));
    expect(r.ok).toBe(false);
    expect(r.error).toContain('trop grande');
  });
});
