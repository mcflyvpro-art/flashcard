// La page d'accueil du site (index.html, servie à la racine ; l'app est à
// /app — docs/LANDING.md). Trois choses qu'on casse sans le voir : la CSP
// (un script en ligne dont l'empreinte n'est plus dans vercel.json), l'ordre
// du <head> (l'aiguillage doit passer avant tout affichage), et le texte
// (aucun tiret cadratin ni demi-cadratin à l'écran, demandé le 2026-10-26).
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

const html = readFileSync('index.html', 'utf8');
const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'));
const csp = vercel.headers.flatMap(h => h.headers)
  .find(h => /^Content-Security-Policy/.test(h.key)).value;
const scripts = [...html.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/g)]
  .map(m => ({ attrs: m[1] || '', code: m[2] }));

/* Le texte qu'un visiteur lit : la page sans ses scripts (sauf les données
   structurées, que Google affiche), ses styles et ses commentaires, plus
   les attributs lus (titre, description, alt, title, aria-label). */
function texteVisible(h) {
  const attrs = [...h.matchAll(/\s(?:alt|title|aria-label|content|placeholder)="([^"]*)"/g)].map(m => m[1]);
  const jsonld = scripts.filter(s => /application\/ld\+json/.test(s.attrs)).map(s => s.code);
  const corps = h.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]+>/g, ' ');
  return [corps, ...attrs, ...jsonld].join('\n');
}

describe('page d’accueil', () => {
  it('chaque script en ligne a son empreinte dans la CSP', () => {
    const enLigne = scripts.filter(s => !/\ssrc=/.test(s.attrs) && !/application\/ld\+json/.test(s.attrs));
    expect(enLigne.length).toBeGreaterThan(0);
    for (const s of enLigne) {
      const h = createHash('sha256').update(s.code).digest('base64');
      expect(csp, 'empreinte à reporter dans vercel.json').toContain(`'sha256-${h}'`);
    }
  });

  it('l’aiguillage est le premier script, avant toute feuille de style', () => {
    const tete = html.slice(0, html.indexOf('</head>'));
    const i = tete.indexOf('<script>');
    expect(i).toBeGreaterThan(-1);
    expect(tete.indexOf('<script')).toBe(i);
    expect(tete.slice(0, i)).not.toMatch(/<link[^>]+stylesheet|<style/);
    expect(scripts[0].code).toContain("location");
    expect(scripts[0].code).toContain("'cartes.auth'");
  });

  it('aucun tiret cadratin ni demi-cadratin dans le texte affiché', () => {
    const t = texteVisible(html);
    const fautes = t.split('\n').filter(l => /[—–]/.test(l)).map(l => l.trim());
    expect(fautes).toEqual([]);
  });

  it('les données structurées se lisent', () => {
    for (const s of scripts.filter(x => /application\/ld\+json/.test(x.attrs))) {
      expect(() => JSON.parse(s.code)).not.toThrow();
    }
  });
});
