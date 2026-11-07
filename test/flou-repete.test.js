// Un flou d'arrière-plan (backdrop-filter) ne se répète pas (2026-11-07).
// Sur la page Academy, la pastille « Bientôt » de chacune des 33 cartes
// portait un blur(6px) : sous WebKit, la mémoire montait sans fin — plus de
// 2 Go en quelques secondes, page affichée sans rien toucher, JavaScript
// coupé — de quoi faire tomber Safari sur un iPhone. Un flou posé une fois
// (l'en-tête, une feuille) ne coûte rien ; multiplié dans une liste, si.
// La règle : sur chaque page du site, un sélecteur qui floute ne touche
// pas plus de 8 éléments.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PAGES } from '../src/site/pages.js';
import { rendreFichier } from '../tools/site/gabarit.js';

const PLAFOND = 8;
const feuilles = ['src/site/site.css', 'src/site/pages.css',
  ...readdirSync('src/site/pages').filter(f => f.endsWith('.css')).map(f => join('src/site/pages', f))];

/* les classes que touche un sélecteur qui floute (la dernière de chaque
   sélecteur composé, sans pseudo-élément ::backdrop d'une boîte de dialogue) */
function classesFloues(css) {
  const out = new Set();
  for (const m of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!/backdrop-filter\s*:\s*(?!none)/.test(m[2])) continue;
    for (const sel of m[1].split(',')) {
      if (/::backdrop/.test(sel)) continue;
      const k = sel.trim().split(/[\s>+~]+/).pop().match(/\.([\w-]+)/g);
      if (k) out.add(k[k.length - 1].slice(1));
    }
  }
  return out;
}

describe('le flou d’arrière-plan', () => {
  const floues = new Set(feuilles.flatMap(f => [...classesFloues(readFileSync(f, 'utf8'))]));
  it('les feuilles du site en ont, et la règle les voit', () => {
    expect(floues.size).toBeGreaterThan(0);
  });
  for (const p of PAGES) {
    it(`${p.chemin} : aucun sélecteur flou sur plus de ${PLAFOND} éléments`, () => {
      const html = rendreFichier(p.fichier);
      for (const k of floues) {
        const n = [...html.matchAll(/class="([^"]*)"/g)].filter(m => m[1].split(/\s+/).includes(k)).length;
        expect(n, `.${k} floute ${n} éléments`).toBeLessThanOrEqual(PLAFOND);
      }
    });
  }
});
