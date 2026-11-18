// Le dossier que l'app des magasins embarque (Capacitor, docs/CAPACITOR.md),
// tiré du build web : `npm run build` puis `node tools/natif/web.js` (ou
// `npm run natif`, qui fait tout jusqu'à `cap sync`).
//
// Pourquoi un dossier à part, et pas dist/ tel quel : dist/ est le site ET
// l'app. Sa racine, index.html, est la page d'accueil du site ; l'app est
// app.html. Le WebView de Capacitor ouvre toujours index.html : sans ce
// tri, chaque lancement chargerait la page d'accueil, puis sauterait à
// l'app. Ici, index.html EST l'app (la copie d'app.html), et rien du site
// ne part dans le binaire :
//   - ni ses pages (tarifs, moteur…), ni leurs images (affiches, partages,
//     captures du manifeste), ni le sitemap, robots.txt, llms.txt, la clé
//     IndexNow ;
//   - ni le service worker (l'app est déjà dans le binaire ; un cache
//     par-dessus servirait une version périmée après une mise à jour du
//     magasin — ui/onboarding.js ne l'enregistre d'ailleurs pas sous
//     Capacitor), ni le manifeste d'installation ;
//   - ni les cartes de sources (.map) : 3 Mo que personne ne lit sur un
//     téléphone ;
//   - ni un morceau de dist/assets/ que l'app ne charge jamais (ceux du
//     site) : on suit les références depuis index.html, de fichier en
//     fichier, et seul ce qui est atteint part.
// Le dossier se vérifie lui-même avant de rendre la main : chaque
// /assets/… cité par un fichier gardé doit y être, sinon l'échec est
// bruyant (une app native qui ne démarre pas ne se voit qu'une fois
// publiée).
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIST = join(RACINE, 'dist');
export const SORTIE = join(RACINE, 'dist-natif');

// ce que l'app lit hors de assets/ et qui doit voyager avec elle
const GARDES = [/^icons\//, /^fsrs\.wasm$/, /^licences\.txt$/, /^site\/logo\.svg$/, /^site\/icone\.svg$/, /^ouverture\.svg$/];

/* Les fichiers de assets/ que l'app atteint, depuis son HTML. Un nom de
   fichier haché ne se rencontre que là où il est employé : un morceau qui
   en cite un autre (import, préchargement, url() d'une feuille) le
   contient en toutes lettres. */
export function atteints(html, fichiers, lire) {
  const vus = new Set();
  const file = fichiers.filter(f => html.includes(f));
  while (file.length) {
    const f = file.pop();
    if (vus.has(f)) continue;
    vus.add(f);
    const texte = lire(f);
    for (const g of fichiers) if (!vus.has(g) && texte.includes(g)) file.push(g);
  }
  return vus;
}

/* L'app, devenue la racine : sans le lien du manifeste, qui ne part pas
   (une app des magasins ne s'installe pas une seconde fois). */
export const htmlNatif = app => app.replace(/\s*<link rel="manifest"[^>]*>/, '');

function construire() {
  if (!existsSync(join(DIST, 'app.html'))) throw new Error('dist/app.html manque : lancer `npm run build` d’abord');
  rmSync(SORTIE, { recursive: true, force: true });
  mkdirSync(join(SORTIE, 'assets'), { recursive: true });

  const html = htmlNatif(readFileSync(join(DIST, 'app.html'), 'utf8'));
  writeFileSync(join(SORTIE, 'index.html'), html);

  const actifs = readdirSync(join(DIST, 'assets')).filter(f => !f.endsWith('.map'));
  const gardes = atteints(html, actifs, f => readFileSync(join(DIST, 'assets', f), 'utf8'));
  for (const f of gardes) cpSync(join(DIST, 'assets', f), join(SORTIE, 'assets', f));

  const publics = [];
  const parcourir = d => {
    for (const n of readdirSync(join(DIST, d))) {
      const r = d ? `${d}/${n}` : n;
      if (statSync(join(DIST, r)).isDirectory()) { if (r !== 'assets') parcourir(r); } else publics.push(r);
    }
  };
  parcourir('');
  for (const r of publics.filter(r => GARDES.some(m => m.test(r)))) {
    mkdirSync(dirname(join(SORTIE, r)), { recursive: true });
    cpSync(join(DIST, r), join(SORTIE, r));
  }

  // la preuve : tout /assets/… cité existe, et rien du site ni du service worker n'est parti
  const cites = new Set();
  for (const f of [join(SORTIE, 'index.html'), ...[...gardes].map(g => join(SORTIE, 'assets', g))]) {
    for (const m of readFileSync(f, 'utf8').matchAll(/assets\/([\w.-]+\.(?:js|css|wasm|woff2?|png|svg|jpg))/g)) cites.add(m[1]);
  }
  const manquants = [...cites].filter(c => !existsSync(join(SORTIE, 'assets', c)));
  if (manquants.length) throw new Error('dist-natif : fichiers cités mais absents : ' + manquants.join(', '));
  for (const interdit of ['sw.js', 'manifest.webmanifest', 'app.html', 'tarifs.html', 'sitemap.xml']) {
    if (existsSync(join(SORTIE, interdit))) throw new Error('dist-natif ne doit pas contenir ' + interdit);
  }
  if (!/\/assets\/app-[\w-]+\.js/.test(html)) throw new Error('dist-natif/index.html ne charge pas l’app');

  let brut = 0, compresse = 0, n = 0;
  const peser = d => {
    for (const x of readdirSync(d)) {
      const p = join(d, x);
      if (statSync(p).isDirectory()) peser(p);
      else { const b = readFileSync(p); brut += b.length; compresse += gzipSync(b).length; n++; }
    }
  };
  peser(SORTIE);
  const ecartes = actifs.length - gardes.size;
  console.log(`✓ ${relative(RACINE, SORTIE)}/ : ${n} fichiers, ${(brut / 1024).toFixed(0)} Ko (${(compresse / 1024).toFixed(0)} Ko compressés) ; ${ecartes} morceaux du site écartés, ni service worker, ni cartes de sources`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) construire();
