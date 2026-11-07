// L'ouverture de l'app (app.html) : son écran de secours est un script en
// ligne, et la CSP appliquée de vercel.json (2026-11-05) bloque tout script
// en ligne dont l'empreinte n'y est pas — un secours bloqué ne secourrait
// personne. Le build le garde tel quel (vérifié au build par
// e2e/demarrage.e2e.js, servi sous la vraie CSP par tools/pw-csp.config.js).
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

const html = readFileSync('app.html', 'utf8');
const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'));
const csp = vercel.headers.flatMap(h => h.headers).find(h => h.key === 'Content-Security-Policy').value;
const enLigne = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);

describe('app.html', () => {
  it('chaque script en ligne a son empreinte dans la CSP', () => {
    expect(enLigne.length).toBe(1);
    for (const code of enLigne) {
      const h = createHash('sha256').update(code).digest('base64');
      expect(csp, 'empreinte à reporter dans vercel.json').toContain(`'sha256-${h}'`);
    }
  });
  it('le secours ne touche jamais au stockage de l’appareil (les livres y sont)', () => {
    expect(enLigne[0]).not.toMatch(/localStorage|sessionStorage|indexedDB/);
    expect(enLigne[0]).toMatch(/serviceWorker/);
    expect(enLigne[0]).toMatch(/caches\.delete/);
  });
  it('le rapporteur d’erreurs est le premier module de l’app', () => {
    const app = readFileSync('src/app.js', 'utf8');
    const imports = [...app.matchAll(/^import '([^']+)';/gm)].map(m => m[1]);
    expect(imports[0]).toBe('./core/rapport-erreurs.js');
  });
});
