import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ALIAS, AZUR, ETATS, MEMOIRE, NOMS, NUANCIER, PALETTE, SANS, SUCCESSION, TEINTES, cleTeinte, teintesMatiere
} from '../src/couleurs.js';
import { contraste } from '../src/jeton.js';

/* L'écart entre deux couleurs tel que l'œil le voit : distance dans
   l'espace OKLab, × 100 (Björn Ottosson, 2020). Sous 10, deux pastilles
   côte à côte se confondent ; c'est ce qui arrivait à ambre et jaune (2,8). */
const lineaire = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255)
  .map(c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
function oklab([r, g, b]) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
// vision d'un œil deutéranope ou protanope (Machado, Oliveira, Fernandes 2009, sévérité 1)
const MACHADO = {
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]]
};
const voir = (h, m) => { const v = lineaire(h); return m ? m.map(r => Math.min(1, Math.max(0, r[0] * v[0] + r[1] * v[1] + r[2] * v[2]))) : v; };
const ecart = (a, b, m) => { const x = oklab(voir(a, m)), y = oklab(voir(b, m)); return 100 * Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };
const ecartDalto = (a, b) => Math.min(ecart(a, b, MACHADO.protan), ecart(a, b, MACHADO.deutan));
const clarte = h => oklab(lineaire(h))[0];
const paires = l => l.flatMap((a, i) => l.slice(i + 1).map(b => [a, b]));

describe('le nuancier des matières', () => {
  it('quatorze teintes, chacune nommée, toutes les clés de la base reconnues', () => {
    expect(TEINTES).toHaveLength(14);
    expect(Object.keys(NOMS)).toEqual(TEINTES);
    // les seize clés d'avant restent valables : aucun livre ne perd sa couleur
    const avant = ['red', 'coral', 'orange', 'amber', 'yellow', 'lime', 'green', 'teal', 'cyan', 'blue',
      'indigo', 'violet', 'purple', 'pink', 'sand', 'graphite'];
    for (const k of avant) expect(PALETTE[k]).toBeDefined();
    expect(Object.keys(PALETTE).sort()).toEqual(avant.sort());
  });

  it('deux teintes ne se confondent jamais, même pour un œil daltonien', () => {
    for (const [a, b] of paires(TEINTES)) {
      expect(ecart(NUANCIER[a].d, NUANCIER[b].d), `${a} / ${b}`).toBeGreaterThanOrEqual(10);
      expect(ecartDalto(NUANCIER[a].d, NUANCIER[b].d), `${a} / ${b} (daltonien)`).toBeGreaterThanOrEqual(5.5);
    }
  });

  it('aucune reliure ne se prend pour l’azur des données', () => {
    for (const k of TEINTES) for (const a of [AZUR[3], AZUR[4]]) {
      expect(ecart(NUANCIER[k].d, a), `${k} / ${a}`).toBeGreaterThanOrEqual(8.5);
    }
  });

  it('chaque teinte se lit : encre sur la couverture, chiffre blanc sur la reliure foncée', () => {
    for (const t of [...Object.values(NUANCIER), SANS]) {
      expect(contraste(t.ci, t.c)).toBeGreaterThanOrEqual(7);
      expect(contraste(t.f, '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
      // la couverture reste du papier : claire, plus claire que son filet, lui-même plus clair que la reliure
      expect(clarte(t.c)).toBeGreaterThan(0.93);
      expect(clarte(t.c)).toBeGreaterThan(clarte(t.b));
      expect(clarte(t.b)).toBeGreaterThan(clarte(t.d));
    }
  });

  it('une matière nouvelle reçoit d’abord des teintes bien éloignées', () => {
    expect([...SUCCESSION].sort()).toEqual([...TEINTES].sort());
    for (const [a, b] of paires(SUCCESSION.slice(0, 6))) {
      expect(ecart(NUANCIER[a].d, NUANCIER[b].d), `${a} / ${b}`).toBeGreaterThanOrEqual(12);
      expect(ecartDalto(NUANCIER[a].d, NUANCIER[b].d), `${a} / ${b} (daltonien)`).toBeGreaterThanOrEqual(6);
    }
  });

  it('une ancienne clé rejoint sa voisine, une inconnue l’ardoise', () => {
    expect(ALIAS).toEqual({ coral: 'orange', amber: 'yellow' });
    expect(teintesMatiere('coral')).toBe(NUANCIER.orange);
    expect(teintesMatiere('amber')).toBe(NUANCIER.yellow);
    expect(teintesMatiere('red')).toBe(NUANCIER.red);
    expect(cleTeinte('coral')).toBe('orange');
    expect(cleTeinte('fuchsia')).toBe('graphite');
    expect(cleTeinte(undefined)).toBe('graphite');
    for (const a of Object.keys(ALIAS)) expect(TEINTES).not.toContain(a);
  });
});

describe('l’azur des données', () => {
  it('une seule teinte, du plus clair au plus foncé, à pas visibles', () => {
    const L = AZUR.map(clarte);
    for (let i = 1; i < L.length; i++) expect(L[i - 1] - L[i]).toBeGreaterThanOrEqual(0.06);
    const teinte = h => { const [, a, b] = oklab(lineaire(h)); return Math.atan2(b, a) * 180 / Math.PI; };
    const hs = AZUR.map(teinte);
    expect(Math.max(...hs) - Math.min(...hs)).toBeLessThan(4);
  });

  it('la mémoire, de « en cours » à « sue », se voit sur le papier et se suit à la clarté', () => {
    const pas = [MEMOIRE.learn, MEMOIRE.young, MEMOIRE.mature].map(i => AZUR[i]);
    expect(contraste(pas[0], '#FFFFFF')).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < pas.length; i++) expect(clarte(pas[i - 1]) - clarte(pas[i])).toBeGreaterThanOrEqual(0.1);
    // un texte en azur foncé reste lisible, même sur sa piste
    expect(contraste(AZUR[5], AZUR[0])).toBeGreaterThanOrEqual(7);
    expect(contraste(AZUR[4], '#FFFFFF')).toBeGreaterThanOrEqual(7);
  });
});

describe('les jetons de app.css', () => {
  const css = readFileSync('src/app.css', 'utf8');
  const racine = css.slice(css.indexOf(':root{'), css.indexOf('}', css.indexOf(':root{')));
  const jeton = n => (racine.match(new RegExp(`--${n}:\\s*(#[0-9A-Fa-f]{6})`)) || [])[1];

  it('reprennent l’azur et les états du module, sans en dévier', () => {
    AZUR.forEach((h, i) => expect(jeton('az' + (i + 1))?.toUpperCase()).toBe(h));
    for (const [k, h] of Object.entries(ETATS)) expect(jeton(k)?.toUpperCase()).toBe(h);
  });

  it('les états se lisent en texte, sur le papier comme sur leur propre teinte', () => {
    const teinte = (h, p) => '#' + [1, 3, 5].map(i => Math.round(parseInt(h.slice(i, i + 2), 16) * p + 255 * (1 - p))
      .toString(16).padStart(2, '0')).join('');
    for (const h of Object.values(ETATS)) {
      expect(contraste(h, '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
      expect(contraste(h, teinte(h, 0.13))).toBeGreaterThanOrEqual(4.5);
    }
  });
});
