// Le référencement du site (2026-11-02, docs/SEO.md) : ce que Google lit de
// chaque page, vérifié page par page, tel que le build la sert. C'est le
// garde-fou des retouches : on peut refaire le look d'une page autant qu'on
// veut, mais pas lui retirer son titre, sa canonique, son h1 unique, ses
// données structurées, ses liens ou ses prix justes sans que ce test le dise.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PAGES, SITE, SOUS_PAGES, adresse } from '../src/site/pages.js';
import { decoder, llms, questions, rendreFichier, sitemap, texte } from '../tools/site/gabarit.js';
import { lireChemin } from '../src/routes.js';
import { FORMULES } from '../src/abonnement.js';

const rendues = PAGES.map(p => ({ p, h: rendreFichier(p.fichier) }));
const plat = s => s.replace(/&nbsp;|&#8239;|\u00a0|\u202f/g, ' ').replace(/\s+/g, ' ');
const meta = (h, attr, nom) => decoder(h.match(new RegExp(`<meta ${attr}="${nom}" content="([^"]*)"`))?.[1] ?? '');
const jsonld = h => [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]));
const noeuds = h => jsonld(h).flatMap(d => d['@graph'] || [d]);
/* Le texte qu'on lit : le corps sans scripts, styles ni commentaires, plus
   les attributs lus à voix haute ou affichés par Google. */
const lu = h => {
  const attrs = [...h.matchAll(/\s(?:alt|title|aria-label|content|placeholder)="([^"]*)"/g)].map(m => m[1]);
  return [texte(h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/g, ' ')), ...attrs,
    ...jsonld(h).map(d => JSON.stringify(d))].join('\n');
};

describe('la liste des pages', () => {
  it('une adresse et un fichier par page, chacun présent', () => {
    expect(new Set(PAGES.map(p => p.chemin)).size).toBe(PAGES.length);
    expect(new Set(PAGES.map(p => p.fichier)).size).toBe(PAGES.length);
    for (const p of PAGES) expect(existsSync(p.fichier), p.fichier).toBe(true);
    expect(PAGES[0].chemin).toBe('/');
  });

  it('aucune adresse ne croise celles de l’app', () => {
    for (const p of SOUS_PAGES) {
      expect(p.chemin).toMatch(/^\/[a-z0-9-]+$/);
      expect(lireChemin(p.chemin), p.chemin).toBeNull();
      expect(['/app', '/demo', '/eleve', '/prof', '/referent', '/admin', '/mentions']).not.toContain(p.chemin);
    }
  });

  it('chaque image de partage existe, en 1200 × 630', () => {
    for (const p of PAGES) expect(existsSync('public' + p.image), p.image).toBe(true);
  });

  it('les dates du sitemap sont de vraies dates, jamais dans le futur', () => {
    for (const p of PAGES) {
      expect(p.maj).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(new Date(p.maj).getTime()).toBeLessThanOrEqual(Date.now());
    }
  });
});

describe.each(rendues.map(x => [x.p.chemin, x]))('la page %s', (_, { p, h }) => {
  it('son titre et sa description tiennent dans ce que Google affiche', () => {
    expect(h.match(/<title>/g)).toHaveLength(1);
    expect(decoder(h.match(/<title>([^<]*)<\/title>/)[1])).toBe(p.titre);
    expect(p.titre.length, p.titre).toBeLessThanOrEqual(60);
    expect(p.titre).toMatch(/Mirandola/);
    expect(meta(h, 'name', 'description')).toBe(p.description);
    expect(p.description.length, p.description).toBeGreaterThanOrEqual(110);
    expect(p.description.length, p.description).toBeLessThanOrEqual(160);
  });

  it('une canonique, son adresse partout, et elle se laisse lire', () => {
    expect(h.match(/rel="canonical"/g)).toHaveLength(1);
    expect(h).toContain(`<link rel="canonical" href="${adresse(p)}">`);
    expect(meta(h, 'property', 'og:url')).toBe(adresse(p));
    expect(meta(h, 'property', 'og:image')).toBe(SITE + p.image);
    expect(meta(h, 'name', 'twitter:card')).toBe('summary_large_image');
    expect(meta(h, 'name', 'robots')).toMatch(/^index,follow/);
    expect(h).toContain('<html lang="fr">');
  });

  it('un seul titre principal, et tous les marqueurs posés', () => {
    expect(h.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(h).not.toMatch(/<!-- @|\{\{/);
  });

  it('ses données structurées se lisent et suivent la page', () => {
    const n = noeuds(h);
    expect(n.length).toBeGreaterThan(0);
    const qs = questions(h);
    const faq = n.find(x => x['@type'] === 'FAQPage');
    if (qs.length) {
      expect(faq.mainEntity.map(q => q.name)).toEqual(qs.map(q => q.question));
      expect(faq.mainEntity.map(q => q.acceptedAnswer.text)).toEqual(qs.map(q => q.reponse));
    } else expect(faq).toBeUndefined();
    if (p.chemin === '/') {
      expect(n.map(x => x['@type'])).toEqual(expect.arrayContaining(['Organization', 'WebSite', 'SoftwareApplication']));
      return;
    }
    const ariane = n.find(x => x['@type'] === 'BreadcrumbList');
    expect(ariane.itemListElement.map(i => i.item)).toEqual([SITE + '/', adresse(p)]);
    expect(ariane.itemListElement[1].name).toBe(p.nom);
    expect(h).toContain(`<span aria-current="page">${p.nom}</span>`);       // le même fil d'Ariane, visible
    const page = n.find(x => x['@id'] === adresse(p) + '#page' && x.isPartOf);
    expect(page.isPartOf['@id']).toBe(SITE + '/#site');
    if (p.type === 'Article') expect(n.find(x => x['@type'] === 'Article').headline).toBeTruthy();
  });

  it('aucun tiret long, aucune « fiche » dans ce qu’on lit', () => {
    const t = lu(h).split('\n');
    expect(t.filter(l => /[—–]/.test(l))).toEqual([]);
    expect(t.filter(l => /\bfiches?\b/i.test(l))).toEqual([]);
  });

  it('chaque image a son texte et ses dimensions', () => {
    for (const [img] of h.matchAll(/<img\s[^>]*>/g)) {
      expect(img, img).toMatch(/\salt="/);
      expect(img, img).toMatch(/\swidth="\d+"/);
      expect(img, img).toMatch(/\sheight="\d+"/);
    }
  });

  it('chaque lien mène quelque part', () => {
    const ids = new Set([...h.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
    const accueil = rendues[0].h;
    for (const [, href] of h.matchAll(/<a\s[^>]*href="([^"]+)"/g)) {
      if (/^https?:|^mailto:/.test(href)) continue;
      if (href.startsWith('#')) { expect(ids.has(href.slice(1)), href).toBe(true); continue; }
      const [chemin, ancre] = href.split('#'), sans = chemin.split('?')[0];
      if (sans === '/') { if (ancre) expect(accueil, href).toContain(`id="${ancre}"`); continue; }
      const page = PAGES.find(x => x.chemin === sans);
      const fichier = existsSync('public' + sans) && !sans.endsWith('/');
      const app = sans === '/app' || lireChemin(sans) !== null;
      expect(page || fichier || app, href).toBeTruthy();
    }
  });

  it('les prix écrits sont ceux de l’app et de Stripe ; Campus est sur devis', () => {
    // en centimes : ceux des formules, et 0 ; aucun prix d'établissement (2026-11-05)
    const justes = new Set([0, ...Object.values(FORMULES).flatMap(f => [f.prix, f.mois, f.sans])].filter(x => x != null));
    expect(plat(texte(h)), p.chemin).not.toMatch(/€ HT/);
    const centimes = n => Math.round(Number(n.replace(/ /g, '').replace(',', '.')) * 100);
    for (const [, n] of plat(texte(h)).matchAll(/(?<![\d,])(\d{1,3}(?: \d{3})*(?:,\d+)?) €/g)) {
      expect(justes.has(centimes(n.trim())), `${n} € sur ${p.chemin}`).toBe(true);
    }
  });
});

describe('ce que le site donne aux robots', () => {
  const plan = sitemap();
  it('le sitemap liste chaque page, et elles seules', () => {
    expect([...plan.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1])).toEqual(PAGES.map(adresse));
    expect(plan).not.toMatch(/\/app|\/connexion|\/essayer/);
  });
  it('robots.txt laisse tout lire et donne le sitemap', () => {
    const r = readFileSync('public/robots.txt', 'utf8');
    expect(r).toMatch(/^Allow: \/$/m);
    expect(r).not.toMatch(/^Disallow: \/\S/m);
    expect(r).toContain(`Sitemap: ${SITE}/sitemap.xml`);
  });
  it('llms.txt nomme chaque page', () => {
    const l = llms();
    for (const p of PAGES) expect(l).toContain(adresse(p));
  });
  it('la clé IndexNow est en ligne, sous son propre nom', () => {
    const cles = readdirSync('public').filter(f => /^[0-9a-f]{32}\.txt$/.test(f));
    expect(cles).toHaveLength(1);
    expect(readFileSync('public/' + cles[0], 'utf8').trim()).toBe(cles[0].slice(0, -4));
  });
  it('le favicon est à la racine, comme le cherchent les robots', () => {
    for (const f of ['favicon.ico', 'favicon.svg', 'favicon-48.png', 'apple-touch-icon.png']) expect(existsSync('public/' + f), f).toBe(true);
  });
  it('vercel.json ramène /tarifs/ à /tarifs, pour chaque page', () => {
    const v = JSON.parse(readFileSync('vercel.json', 'utf8'));
    const r = v.redirects.find(x => x.source.startsWith('/:page('));
    const noms = r.source.match(/\(([^)]+)\)/)[1].split('|').sort();
    expect(noms).toEqual(SOUS_PAGES.map(p => p.chemin.slice(1)).sort());
    expect(r.destination).toBe('/:page');
  });
  it('le service worker laisse passer les pages du site', () => {
    const sw = readFileSync('src/sw.js', 'utf8');
    expect(sw).toContain('const PAGES = __PAGES__;');
    expect(sw).toMatch(/PAGES\.includes\(/);
  });
});
