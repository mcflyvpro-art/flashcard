import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { TEXTES } from '../src/routes.js';

/* Les notices que les licences des logiciels libres de Mirandola exigent
   (2026-11-05) : sans elles, distribuer fsrs.wasm et les icônes enfreint
   leurs licences. La liste des bibliothèques Rust est celle de
   « cargo tree -e normal » pour wasm32 (tools/BUILD-FSRS.md). */
const notices = readFileSync('public/licences.txt', 'utf8');
const textes = readFileSync('src/ui/legal-textes.js', 'utf8');
const RUST = ['cfg-if', 'chacha20', 'crossbeam-deque', 'crossbeam-epoch', 'crossbeam-utils', 'either', 'equivalent', 'getrandom',
  'hashbrown', 'indexmap', 'itertools', 'log', 'matrixmultiply', 'ndarray', 'num-complex', 'num-integer', 'num-traits',
  'priority-queue', 'rand', 'rand_core', 'rawpointer', 'rayon', 'rayon-core', 'serde', 'serde_core', 'snafu', 'strum'];

describe('les logiciels libres', () => {
  it('chaque notice exigée est reproduite', () => {
    expect(notices).toContain('Copyright (c) 2023, Open Spaced Repetition');   // fsrs, BSD-3
    expect(notices).toContain('Copyright (c) 2022 Open Spaced Repetition');    // py-fsrs, MIT
    expect(notices).toMatch(/Lucide\s+Contributors/);                         // ISC
    expect(notices).toMatch(/Cole Bemis/);                                     // Feather, MIT
    expect(notices).toMatch(/Neither the name of the copyright holder/);       // la clause 3 de la BSD
  });
  it('chaque bibliothèque Rust du binaire a sa ligne, sa licence et son copyright', () => {
    for (const n of RUST) expect(notices, n).toMatch(new RegExp(`^- ${n} \\d[^\\n]*\\n  Copyright \\S`, 'm'));
    expect(notices).toMatch(/priority-queue 2\.7\.0 : MPL-2\.0/);
    expect(notices).toMatch(/github\.com\/garro95\/priority-queue/);           // MPL : où trouver la source
  });
  it('l’app a ses cinq textes, chacun à son adresse', () => {
    for (const k of Object.keys(TEXTES)) expect(textes, k).toMatch(new RegExp(`\\n  ${k}: \\[`));
    expect(Object.values(TEXTES)).toEqual(['cgu', 'cgv', 'confidentialite', 'mentions', 'logiciels']);
  });
  it('les textes ne promettent rien que l’app ne fasse : la Sauvegarde est dans les Réglages', () => {
    const reglages = readFileSync('src/ui/reglages-corbeille.js', 'utf8');
    expect(textes).toMatch(/Réglages, Sauvegarde/);
    expect(reglages).toMatch(/data-act="backup2"[^\n]*Sauvegarde/);
  });
});
