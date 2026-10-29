import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/* Les fonctions que l'app appelle depuis le navigateur (2026-10-29) : la
   réponse au contrôle préalable (OPTIONS) doit autoriser chaque en-tête que
   l'app envoie — api() et aiCall posent « apikey » à côté d'« authorization »
   et de « content-type ». La fonction ai ne l'autorisait pas : le navigateur
   n'envoyait jamais la demande, et l'app disait « IA indisponible » à tous. */
const APPELEES = ['ai', 'paiement', 'magasins'];
const ENVOYES = ['authorization', 'apikey', 'content-type'];

describe('les fonctions appelées par le navigateur', () => {
  for (const nom of APPELEES) {
    it(`${nom} autorise les en-têtes de l’app`, () => {
      const src = readFileSync(`supabase/functions/${nom}/index.ts`, 'utf8');
      const m = src.match(/"Access-Control-Allow-Headers":\s*"([^"]+)"/);
      expect(m, nom).toBeTruthy();
      const permis = m[1].split(',').map(x => x.trim().toLowerCase());
      for (const h of ENVOYES) expect(permis, `${nom} : ${h}`).toContain(h);
    });
  }
  it('l’app envoie bien ces en-têtes-là, et pas d’autres', () => {
    const src = readFileSync('src/ui/import-cartes.js', 'utf8');
    const appel = src.slice(src.indexOf("fetch(SB.url + '/functions/v1/ai'"));
    const entetes = appel.slice(0, appel.indexOf('body:')).match(/headers:\s*\{([^}]*)\}/)[1];
    const noms = [...entetes.matchAll(/'?([A-Za-z-]+)'?\s*:/g)].map(x => x[1].toLowerCase());
    expect(noms.sort()).toEqual([...ENVOYES].sort());
  });
});
