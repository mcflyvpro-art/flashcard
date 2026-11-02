// Le gabarit des pages du site (2026-11-02, docs/SEO.md). Chaque page
// (index.html, tarifs.html…) n'écrit que ce qui lui est propre ; ce qui est
// commun vit une fois, dans src/site/partiels/, et se pose à la place d'un
// marqueur, au build comme sous `npm run dev` (le greffon Vite plus bas) :
//
//   <!-- @meta -->    titre, description, canonique, Open Graph, Twitter,
//                     données structurées de la page et fil d'Ariane, tirés
//                     de src/site/pages.js (les autres pages que l'accueil)
//   <!-- @icones -->  les icônes (tracés Lucide)
//   <!-- @tete -->    l'en-tête et le menu du téléphone
//   <!-- @pied -->    le pied de page et la fenêtre « J'ai un code »
//   <!-- @tarifs h=h2 -->  les offres, le calculateur de Campus et le
//                     tableau comparatif (l'accueil et /tarifs), son titre
//                     au niveau donné
//
// Et, pour toute page qui a des questions (`.questions details`), la FAQ en
// données structurées, tirée du texte affiché : elle ne peut plus dire autre
// chose que la page. Le sitemap se fabrique ici aussi, depuis la même liste.
// Les tests (test/seo.test.js) lisent les pages rendues par `rendre`.
import { readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAGES, SITE, SOUS_PAGES, adresse } from '../../src/site/pages.js';
import { DEPART, programme, rappel } from '../../src/site/courbes.js';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const partiel = nom => readFileSync(join(RACINE, 'src/site/partiels', nom + '.html'), 'utf8').trim();

/* Les entités qu'écrivent nos pages, et toute entité numérique. */
const NOMMEES = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: '\'', rsquo: '’', laquo: '«', raquo: '»', hellip: '…' };
export function decoder(t) {
  return t.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&([a-z]+);/gi, (m, n) => NOMMEES[n] ?? m);
}
/* Le texte d'un morceau de HTML, comme on le lit : sans balises, espaces resserrés. */
export const texte = h => decoder(h.replace(/<[^>]+>/g, ' ')).replace(/[ \t\n\r]+/g, ' ')
  .replace(/ ([,.)])/g, '$1').trim();
const attr = t => t.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
/* sur une ligne : des octets en moins pour la page, rien en moins pour Google */
const json = o => JSON.stringify(o).replace(/</g, '\\u003c');

/* Les questions d'une page, dans l'ordre : { question, reponse }. */
export function questions(html) {
  return [...html.matchAll(/<details[^>]*>\s*<summary[^>]*>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/g)]
    .map(([, q, r]) => ({ question: texte(q), reponse: texte(r) }));
}

const faq = qs => ({
  '@context': 'https://schema.org', '@type': 'FAQPage',
  mainEntity: qs.map(q => ({ '@type': 'Question', name: q.question, acceptedAnswer: { '@type': 'Answer', text: q.reponse } }))
});

/* Le titre tel qu'on le partage : sans « | Mirandola », que le site dit déjà. */
const titreCourt = p => p.titre.replace(/ \| Mirandola$/, '');

/* La page, son fil d'Ariane et, pour un article, l'article. Google lit le
   tout comme un graphe : la page fait partie du site (WebSite de
   l'accueil), l'organisation la publie. */
function donnees(p) {
  const url = adresse(p), image = SITE + p.image;
  const page = {
    '@type': p.type === 'AboutPage' ? 'AboutPage' : 'WebPage', '@id': url + '#page', url, name: titreCourt(p),
    description: p.description, inLanguage: 'fr-FR', isPartOf: { '@id': SITE + '/#site' },
    about: { '@id': SITE + '/#app' }, breadcrumb: { '@id': url + '#ariane' },
    primaryImageOfPage: { '@type': 'ImageObject', url: image, width: 1200, height: 630 },
    dateModified: p.maj
  };
  const ariane = {
    '@type': 'BreadcrumbList', '@id': url + '#ariane',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Mirandola', item: SITE + '/' },
      { '@type': 'ListItem', position: 2, name: p.nom, item: url }
    ]
  };
  const graphe = [page, ariane];
  if (p.type === 'Article') {
    graphe.push({
      '@type': 'Article', '@id': url + '#article', mainEntityOfPage: { '@id': url + '#page' },
      headline: titreCourt(p), description: p.description, image, inLanguage: 'fr-FR',
      datePublished: p.publie || p.maj, dateModified: p.maj,
      author: { '@id': SITE + '/#organisation' }, publisher: { '@id': SITE + '/#organisation' }
    });
  }
  return { '@context': 'https://schema.org', '@graph': graphe };
}

/* La tête d'une page autre que l'accueil (l'accueil écrit la sienne : son
   aiguillage doit passer avant tout). */
function meta(p) {
  const url = adresse(p), image = SITE + p.image, court = titreCourt(p);
  const type = p.type === 'Article' ? 'article' : 'website';
  return `<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${p.titre}</title>
<meta name="description" content="${attr(p.description)}">
<link rel="canonical" href="${url}">
<link rel="alternate" hreflang="fr" href="${url}">
<link rel="alternate" hreflang="x-default" href="${url}">
<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">
<meta name="theme-color" content="#F6F5F1">
<meta name="color-scheme" content="light">
<meta name="application-name" content="Mirandola">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon-48.png" sizes="48x48" type="image/png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/manifest.webmanifest">
<meta property="og:type" content="${type}">
<meta property="og:site_name" content="Mirandola">
<meta property="og:locale" content="fr_FR">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${attr(court)}">
<meta property="og:description" content="${attr(p.description)}">
<meta property="og:image" content="${image}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${attr(p.imageAlt)}">
${type === 'article' ? `<meta property="article:modified_time" content="${p.maj}">\n` : ''}<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${attr(court)}">
<meta name="twitter:description" content="${attr(p.description)}">
<meta name="twitter:image" content="${image}">
<meta name="twitter:image:alt" content="${attr(p.imageAlt)}">
<script type="application/ld+json">
${json(donnees(p))}
</script>
<link rel="stylesheet" href="/src/site/site.css">
<link rel="stylesheet" href="/src/site/pages.css">
<script type="module" src="/src/site/page.js"></script>`;
}

/* Le lien de la page où l'on est porte aria-current : le lecteur d'écran
   le dit, la feuille de style le marque. */
const ici = (h, p) => p.chemin === '/' ? h
  : h.replaceAll(`<a href="${p.chemin}">`, `<a href="${p.chemin}" aria-current="page">`);

/* Le fil d'Ariane qu'on voit (le même que celui des données structurées). */
const ariane = p => `<nav class="ariane" aria-label="Fil d’Ariane"><ol><li><a href="/">Mirandola</a></li>`
  + `<li><span aria-current="page">${p.nom}</span></li></ol></nav>`;

/* La courbe de l'oubli d'une page, sans révision et avec, dessinée au build
   depuis le modèle du graphique de l'accueil (src/site/courbes.js : la
   courbe d'oubli de FSRS, une révision quand le rappel tombe à 90 %). Le
   temps est droit, sur deux mois : on y voit les révisions s'espacer. */
export function courbeOubli() {
  const S0 = DEPART[1], T = 64, x = t => (60 + 920 * t / T).toFixed(1), y = r => (20 + 360 * (1 - r)).toFixed(1);
  let sans = `M${x(0)} ${y(1)}`;
  for (let i = 1; i <= 128; i++) sans += `L${x(i / 2)} ${y(rappel(i / 2, S0))}`;
  const prog = programme(S0).filter(d => d.debut < T);
  let avec = `M${x(0)} ${y(1)}`;
  prog.forEach(({ debut, S }, k) => {
    const fin = Math.min(prog[k + 1]?.debut ?? T, T);
    if (debut > 0) avec += `L${x(debut)} ${y(1)}`;
    for (let i = 1; i <= 40; i++) { const t = debut + (fin - debut) * i / 40; avec += `L${x(t)} ${y(rappel(t - debut, S))}`; }
  });
  const reprises = prog.slice(1).map(d => `<g class="co-rev"><line x1="${x(d.debut)}" y1="${y(0.9)}" x2="${x(d.debut)}" y2="${y(1)}"/>`
    + `<circle cx="${x(d.debut)}" cy="${y(1)}" r="7"/><text x="${x(d.debut)}" y="414">J+${Math.round(d.debut)}</text></g>`).join('');
  const j = prog.slice(1).map(d => Math.round(d.debut));
  const jours = j.slice(0, -1).join(', ') + ' puis ' + j[j.length - 1] + ' jours';
  const reperes = [[1, '100 %'], [0.9, '90 %'], [0.5, '50 %'], [0, '0 %']]
    .map(([r, t]) => `<line class="${r === 0.9 ? 'co-seuil' : 'co-grille'}" x1="60" x2="980" y1="${y(r)}" y2="${y(r)}"/><text class="co-y" x="48" y="${(+y(r) + 5).toFixed(1)}">${t}</text>`).join('');
  return `<svg class="co-svg" viewBox="0 0 1000 440" role="img" aria-labelledby="co-t co-d">
<title id="co-t">Ce qu’il reste d’une page en mémoire pendant deux mois</title>
<desc id="co-d">Sans révision, le souvenir passe sous 50 % en moins de trois semaines. Avec la répétition espacée, chaque révision le ramène à 100 % quand il touche 90 %, et la suivante vient de plus en plus tard : au bout de ${jours}.</desc>
<defs><linearGradient id="co-g" x1="0" x2="1"><stop offset="0" stop-color="#5A76D0"/><stop offset=".55" stop-color="#9A78CF"/><stop offset="1" stop-color="#D7648D"/></linearGradient></defs>
${reperes}<path class="co-sans" d="${sans}"/><path class="co-avec" d="${avec}"/>${reprises}
<text class="co-x" x="60" y="436">Aujourd’hui</text><text class="co-x" x="${x(30.4)}" y="436">1 mois</text><text class="co-x" x="${x(60.8)}" y="436">2 mois</text>
</svg>`;
}

/** La page d'un fichier (index.html, tarifs.html…), ou undefined. */
export const pageDe = fichier => PAGES.find(p => p.fichier === basename(fichier));

/** Le HTML d'une page, ses marqueurs remplacés. */
export function rendre(html, p) {
  const accueil = p.chemin === '/';
  const v = {
    logo: accueil ? '<svg class="marque-livres" aria-hidden="true"><use href="#logo"/></svg>'
      : '<img class="marque-livres" src="/site/logo.svg" alt="" width="34" height="36">',
    marque: accueil ? 'Mirandola, retour en haut de l’accueil' : 'Mirandola, l’accueil'
  };
  /* Ce qui se calcule au lieu de se lire dans un morceau. */
  const calcules = { meta: () => accueil ? '' : meta(p), ariane: () => ariane(p), courbe: courbeOubli };
  /* `<!-- @tarifs h=h1 -->` : le morceau tarifs.html, où {{h}} vaut h1 ; un
     morceau peut en poser un autre (tarifs.html pose le calculateur). */
  const marqueurs = (t, prof = 0) => t.replace(/<!-- @([\w-]+)((?: \w+=\S+)*) -->/g, (_, nom, args) => {
    if (calcules[nom]) return calcules[nom]();
    if (prof > 3) throw new Error(`${p.fichier} : le morceau ${nom} se pose lui-même`);
    const vars = { ...v, ...Object.fromEntries([...args.matchAll(/(\w+)=(\S+)/g)].map(m => [m[1], m[2]])) };
    const corps = partiel(nom).replace(/\{\{(\w+)\}\}/g, (_, k) => {
      if (!(k in vars)) throw new Error(`${p.fichier} : {{${k}}} sans valeur dans le morceau ${nom}`);
      return vars[k];
    });
    return ici(marqueurs(corps, prof + 1), p);
  });
  let h = marqueurs(html);
  const qs = questions(h);
  if (qs.length) h = h.replace('</head>', () => `<script type="application/ld+json">\n${json(faq(qs))}\n</script>\n</head>`);
  return h;
}

/** Une page du site par son fichier, rendue : ce que sert le build. */
export const rendreFichier = fichier => rendre(readFileSync(join(RACINE, fichier), 'utf8'), pageDe(fichier));

/** Le sitemap : chaque page, sa date, et son image de partage. */
export function sitemap() {
  const url = p => `  <url>
    <loc>${adresse(p)}</loc>
    <lastmod>${p.maj}</lastmod>
    <image:image><image:loc>${SITE + p.image}</image:loc></image:image>
  </url>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${PAGES.map(url).join('\n')}
</urlset>
`;
}

/** llms.txt : le site en quelques lignes, pour les assistants qui cherchent
 *  sur le web (ChatGPT, Perplexity, Claude…) — la convention de llmstxt.org.
 *  Tiré de la même liste que le sitemap : il ne peut pas dire autre chose. */
export function llms() {
  const accueil = PAGES[0];
  return `# Mirandola

> ${accueil.description}

Mirandola est une application de révision en français (PWA, sur téléphone et
ordinateur, hors ligne) : l'IA fait d'un cours, d'une photo ou d'un PDF un
livre de flashcards, et le moteur de répétition espacée FSRS repose chaque
page juste avant l'oubli. Trois offres : Mirandola (gratuit), Mirandola+
(abonnement) et Mirandola Campus (licence d'établissement scolaire). Le nom
vient de Pic de la Mirandole ; l'app n'a pas de lien avec la ville
italienne de Mirandola.

## Pages

${PAGES.map(p => `- [${p.nom}](${adresse(p)}) : ${p.description}`).join('\n')}

## Essayer

- [Essayer sans compte](${SITE}/essayer) : la démo, dans un lycée fictif
- [Créer un compte](${SITE}/inscription)
- [Demander une démo pour un établissement](${SITE}/demande-demo)
`;
}

/** Le greffon Vite : les pages comme entrées, leurs marqueurs remplacés, le sitemap écrit. */
export function pagesDuSite() {
  return {
    name: 'mirandola-pages-du-site',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        const p = pageDe(ctx.filename);
        return p ? rendre(html, p) : html;
      }
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemap() });
      this.emitFile({ type: 'asset', fileName: 'llms.txt', source: llms() });
    }
  };
}

/** Les entrées du build : l'app et chaque page du site. */
export const entrees = () => Object.fromEntries([['app', 'app.html'],
  ...PAGES.map(p => [p.chemin === '/' ? 'site' : 'page-' + p.chemin.slice(1), p.fichier])]);

/** L'adresse d'une page sous `npm run dev` et `vite preview` : /tarifs → /tarifs.html. */
export const fichierDe = chemin => SOUS_PAGES.find(p => p.chemin === chemin)?.fichier;
