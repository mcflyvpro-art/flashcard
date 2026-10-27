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

/* Les couleurs de la page sont celles de l'app : une matière a la même
   reliure et la même couverture sur le site et dans l'app (src/couleurs.js,
   la nouvelle charte du 2026-10-27). */
describe('les teintes de la page', async () => {
  const { NUANCIER } = await import('../src/couleurs.js');
  const css = readFileSync('src/site/site.css', 'utf8');
  const js = readFileSync('src/site/site.js', 'utf8');

  it('chaque teinte de site.css est celle du nuancier de l’app', () => {
    const regles = [...css.matchAll(/\[data-teinte="([a-z]+)"\]\{([^}]*)\}/g)];
    expect(regles.map(r => r[1]).sort()).toEqual(Object.keys(NUANCIER).sort());
    for (const [, cle, corps] of regles) {
      const v = Object.fromEntries(corps.split(';').filter(Boolean).map(x => x.split(':').map(y => y.trim())));
      for (const k of ['d', 'c', 'b', 'ci']) expect(v['--' + k], `${cle} ${k}`).toBe(NUANCIER[cle][k]);
    }
  });

  it('la page et sa pile n’emploient que des teintes du nuancier', () => {
    const page = [...html.matchAll(/data-teinte="([a-z]+)"/g)].map(m => m[1]);
    const pile = [...js.matchAll(/^\s*\['[^']+', '([a-z]+)', /gm)].map(m => m[1]);
    expect(page.length).toBeGreaterThan(20);
    expect(pile.length).toBeGreaterThan(4);
    for (const t of [...page, ...pile]) expect(Object.keys(NUANCIER)).toContain(t);
  });
});

/* Le graphique du moteur (src/site/courbes.js) : ce qu'il affiche doit
   rester vrai pour le modèle qu'il prétend montrer. */
describe('le graphique du moteur', async () => {
  const { AN, DEPART, courbes, duree, programme, rappel, versT, versX } = await import('../src/site/courbes.js');
  const c = courbes();

  it('la courbe d’oubli vaut 90 % quand t = S', () => {
    for (const S of [0.5, 3, 40]) expect(rappel(S, S)).toBeCloseTo(0.9, 10);
  });

  it('avec Folio, chaque fiche reste au-dessus de 90 % toute l’année', () => {
    for (let i = 0; i <= 4000; i++) expect(c.lire(i / 4000).avec).toBeGreaterThanOrEqual(0.9 - 1e-9);
  });

  it('sans révision, il en reste moins de 20 % au bout d’un an, et la moitié s’en va dans le mois', () => {
    expect(c.lire(1).sans).toBeLessThan(0.2);
    expect(c.lire(versX(30.4)).sans).toBeLessThan(0.55);
    for (let i = 1; i <= 100; i++) expect(c.lire(i / 100).sans).toBeLessThan(c.lire((i - 1) / 100).sans);
  });

  it('les révisions s’espacent, et chacune tombe dans l’année', () => {
    for (const S of DEPART) {
      const p = programme(S);
      const ecarts = p.slice(1).map((d, i) => d.debut - p[i].debut);
      for (let i = 1; i < ecarts.length; i++) expect(ecarts[i]).toBeGreaterThan(ecarts[i - 1]);
      expect(p[p.length - 1].debut).toBeLessThanOrEqual(AN);
    }
    expect(c.revisions.length).toBe(DEPART.reduce((n, S) => n + programme(S).length - 1, 0));
  });

  it('le temps en racine carrée va et revient', () => {
    for (const t of [0, 1, 30, 365]) expect(versT(versX(t))).toBeCloseTo(t, 9);
  });

  it('dit le temps comme on le dit', () => {
    expect(duree(0)).toBe('Aujourd’hui');
    expect(duree(1)).toBe('1 jour');
    expect(duree(4)).toBe('4 jours');
    expect(duree(14)).toBe('2 semaines');
    expect(duree(91)).toBe('3 mois');
    expect(duree(365)).toBe('1 an');
  });
});
