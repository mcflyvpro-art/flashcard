import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/* « Tout est mirandola.fr » (2026-10-29) : l'ancien domaine renvoie tout vers
   mirandola.fr (vercel.json), sauf sw.js, que l'app installée là-bas redemande
   encore et qui s'y retire (src/sw.js). Les deux listes de domaines doivent
   rester les mêmes : un domaine redirigé dont le service worker ne se retire
   pas laisse son app tourner sur sa copie en cache, pour toujours. */
const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'));
const sw = readFileSync('src/sw.js', 'utf8');
const anciens = vercel.redirects.filter(r => (r.has || []).some(h => h.type === 'host'));
const hotes = anciens.map(r => r.has.find(h => h.type === 'host').value);

describe('l’ancien domaine', () => {
  it('chaque hôte ancien part vers mirandola.fr, en gardant le chemin, pour de bon', () => {
    expect(hotes).toEqual(expect.arrayContaining(['www.folioflashcard.online', 'folioflashcard.online']));
    for (const r of anciens) {
      expect(r.destination).toBe('https://mirandola.fr/:chemin*');
      expect(r.permanent).toBe(true);
    }
  });
  it('sauf sw.js, qui s’y retire : les mêmes hôtes dans le service worker', () => {
    const re = new RegExp('^' + anciens[0].source.replace('/:chemin', '/').replace(/\\\\/g, '\\') + '$');
    expect(re.test('/sw.js')).toBe(false);
    expect(re.test('/app')).toBe(true);
    expect(re.test('/')).toBe(true);
    const liste = sw.match(/const ANCIEN = \[([^\]]*)\]/)[1];
    expect(liste.match(/'[^']+'/g).map(s => s.slice(1, -1)).sort()).toEqual([...hotes].sort());
  });
  it('plus aucun lien vers l’ancien domaine dans l’app ni le site', () => {
    for (const f of ['src/adresse.js', 'index.html', 'app.html', 'public/manifest.webmanifest']) {
      expect(readFileSync(f, 'utf8'), f).not.toMatch(/folioflashcard/);
    }
  });
});
