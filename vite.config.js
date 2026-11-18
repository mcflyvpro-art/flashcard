import { defineConfig, loadEnv } from 'vite';
import { appendFileSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { join, relative } from 'node:path';
import { entrees, fichierDe, pagesDuSite } from './tools/site/gabarit.js';
import { SOUS_PAGES } from './src/site/pages.js';

/* Fabrique sw.js à partir de src/sw.js : empreinte du build et liste des
   fichiers à mettre en cache pour le hors-ligne.
   `base` (le chemin de base Vite, toujours terminé par `/`) est préfixé à
   chaque entrée. Il vaut `/` depuis la fin de GitHub Pages (qui servait
   l'app sous `/flashcard/`) ; on le garde en paramètre pour qu'une
   publication sous un sous-dossier reste possible sans rien casser. */
function serviceWorker(base) {
  return {
    name: 'folio-service-worker',
    apply: 'build',
    generateBundle(_, bundle) {
      const pub = 'public';
      const walk = d => readdirSync(d).flatMap(f => {
        const p = join(d, f);
        return statSync(p).isDirectory() ? walk(p) : [p];
      });
      const abs = p => base + p.replace(/^\//, '');
      /* Ni les captures du manifeste (elles ne servent qu'à l'installation),
         ni les images et vidéos de la page d'accueil (site/) : l'app hors
         ligne n'en a pas besoin — sauf le logo, que ses écrans publics
         (connexion, essai, demande de démo) affichent aussi hors ligne. */
      const statics = walk(pub).map(p => abs(relative(pub, p)))
        .filter(p => !p.startsWith(base + 'shots/') && (!p.startsWith(base + 'site/') || p === base + 'site/logo.svg'));
      /* Ni les cartes de source (.map : plus d'un Mo, que personne ne lit
         hors ligne), ni les pages HTML sous leur nom de fichier, ni le
         morceau vide qu'une page sans script laisse dans le paquet : il
         n'est pas écrit sur le disque, et un seul 404 fait échouer
         l'installation entière. */
      const built = Object.entries(bundle)
        .filter(([n, f]) => !/\.(map|html)$/.test(n) && !(f.type === 'chunk' && !f.code.trim()))
        .map(([n]) => abs(n));
      /* Les deux pages sous les adresses qu'on navigue : l'app à « app »
         (Vercel la sert sans l'extension — `cleanUrls` — et une réponse
         redirigée ne peut pas servir une navigation), la page d'accueil à
         la racine, par où passe encore une icône installée avant /app. */
      const shell = [abs('app'), base, ...built, ...statics].filter(f => f !== abs('sw.js'));
      const hash = createHash('sha256');
      for (const f of Object.values(bundle)) hash.update(f.code ?? f.source ?? '');
      /* Les autres pages du site (src/site/pages.js) : le service worker ne
         touche pas à leurs navigations — sans cela, /tarifs, rangé sous
         « app », prenait la place de l'app hors ligne. La page d'un lien
         partagé (/code) non plus. */
      const code = readFileSync('src/sw.js', 'utf8')
        .replace('__BUILD__', hash.digest('hex').slice(0, 12))
        .replace('__BASE__', base)
        .replace('__SHELL__', JSON.stringify(shell))
        .replace('__PAGES__', JSON.stringify([...SOUS_PAGES.map(p => abs(p.chemin)), abs('/code')]));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: code });
    }
  };
}

/* Chaque écran de l'app a son adresse (/connexion, /eleve/livres… —
   src/routes.js) et toutes servent app.html ; la racine reste la page
   d'accueil du site. Vercel le fait par la réécriture de vercel.json ; ce
   relais fait de même pour `npm run dev` et `vite preview` (les parcours
   e2e), avant le repli de Vite, qui servirait index.html — la page
   d'accueil — à toute adresse inconnue. Un fichier (une extension), les
   modules de Vite et ce qui n'est pas une page passent tels quels. Les
   autres pages du site (/tarifs, /etablissements… src/site/pages.js) ont
   leur fichier, comme sur Vercel (`cleanUrls`) : /tarifs sert tarifs.html. */
function adressesDeLApp() {
  const relais = (req, res, next) => {
    const i = req.url.search(/[?#]/);
    const chemin = i < 0 ? req.url : req.url.slice(0, i), reste = i < 0 ? '' : req.url.slice(i);
    const page = req.method === 'GET' && (req.headers.accept || '').includes('text/html');
    const fichier = page && fichierDe(chemin);
    if (fichier) req.url = '/' + fichier + reste;
    else if (page && chemin !== '/' && !/\.[a-z0-9]+$/i.test(chemin)
      && !/^\/(assets|icons|site|src|node_modules|@)/.test(chemin)) req.url = '/app.html' + reste;
    next();
  };
  return {
    name: 'folio-adresses',
    configureServer(s) { s.middlewares.use(relais); },
    configurePreviewServer(s) { s.middlewares.use(relais); }
  };
}

/* Le site emploie quelques règles de l'app : le moteur (src/fsrs.js, pour la
   page /moteur), la forme d'un code de classe et d'un code de partie
   (src/classe.js, src/defi.js, pour « J'ai un code »). Importées telles
   quelles, elles devenaient des morceaux partagés entre l'app et le site :
   l'app chargeait le moteur à part au démarrage (0,3 Ko de trop, le
   2026-11-04), et chaque page du site téléchargeait tout src/classe.js et
   tout src/defi.js — 5,4 Ko pour quatre fonctions (relevé le 2026-11-18).
   Le site reçoit donc sa propre copie de chaque module de l'app qu'il
   importe, et des modules que ceux-là importent : le même fichier, sous un
   autre nom (« …?site »), que seuls src/site/ et ces copies voient — le
   build n'en garde que ce que le site appelle. Le code source garde ses
   imports ordinaires : Node (le gabarit du build) et les tests les lisent
   tels quels. */
const DU_SITE = /[\\/]src[\\/]site[\\/]/;
function copiesDuSite() {
  return {
    name: 'copies-du-site',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (!importer || !/^\.\.?\//.test(source) || !/\.js$/.test(source)) return null;
      const copie = importer.endsWith('?site');
      if (!copie && !(DU_SITE.test(importer) && !importer.includes('?'))) return null;
      const r = await this.resolve(source, copie ? importer.slice(0, -5) : importer, { ...options, skipSelf: true });
      if (!r || r.external || DU_SITE.test(r.id) || !/[\\/]src[\\/].*\.js$/.test(r.id)) return null;
      return r.id + '?site';
    },
    load(id) { return id.endsWith('?site') ? readFileSync(id.slice(0, -5), 'utf8') : null; }
  };
}

/* La CSP de vercel.json, APPLIQUÉE par `vite preview` quand CSP_STRICTE
   nomme un fichier (tools/pw-csp.config.js, M10.T5) : toute la suite des
   parcours tourne alors sous la vraie politique, et chaque violation —
   n'importe quelle page, n'importe quel test — arrive par `report-uri`
   dans ce fichier. Sans la variable, rien ne change. */
function cspStricte() {
  const fichier = process.env.CSP_STRICTE;
  if (!fichier) return null;
  const v = JSON.parse(readFileSync('vercel.json', 'utf8'));
  const h = v.headers.flatMap(x => x.headers).find(x => /^Content-Security-Policy/.test(x.key));
  return {
    name: 'csp-stricte',
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/__csp' && req.method === 'POST') {
          let corps = '';
          req.on('data', c => { corps += c; });
          req.on('end', () => { appendFileSync(fichier, corps + '\n'); res.statusCode = 204; res.end(); });
          return;
        }
        res.setHeader('Content-Security-Policy', h.value + '; report-uri /__csp');
        next();
      });
    }
  };
}

function identifiantDuBuild() {
  const vercel = process.env.VERCEL_GIT_COMMIT_SHA;
  if (vercel) return vercel.slice(0, 12);
  try { return execSync('git rev-parse --short=12 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return 'dev'; }
}

/* Les morceaux de l'app des magasins (Capacitor, docs/CAPACITOR.md) :
   src/ui/natif.js et les greffons, que seul le vrai pont d'iOS ou d'Android
   charge — jamais un navigateur. Préfixés « natif- », pour que le budget de
   poids (tools/budget.js) les compte à part et que personne ne les croie
   chargés sur le web. Tous les autres gardent le nom par défaut de Vite. */
const NATIF = /node_modules[\\/](@capacitor|@revenuecat)[\\/]|[\\/]src[\\/](ui[\\/])?natif\.js$/;
function nomDuMorceau(c) {
  const natif = c.moduleIds.length > 0 && c.moduleIds.every(id => NATIF.test(id.replace(/\0/g, '')));
  return 'assets/' + (natif && !c.name.startsWith('natif') ? 'natif-' : '') + '[name]-[hash].js';
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  /* Sans ces deux valeurs, l'app se construirait quand même et
     afficherait un écran de connexion qui ne mène nulle part. Mieux vaut
     un build qui échoue et dit pourquoi. */
  for (const k of ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']) {
    if (!env[k]) throw new Error(`${k} manquant : copier .env.example en .env.local (ou le définir dans Vercel)`);
  }
  /* L'app est servie à la racine de son domaine, et nulle part ailleurs :
     GitHub Pages (sous /flashcard/) ne fait plus que rediriger
     (tools/pages-redirection/), et Capacitor sert lui aussi depuis la
     racine de son WebView. */
  const base = '/';
  return {
    base,
    /* L'identifiant du build, que le rapporteur d'erreurs joint à chaque
       rapport (src/core/rapport-erreurs.js) : savoir qu'une erreur est
       née avec telle mise en ligne. Le commit que Vercel construit, sinon
       celui du dépôt local. */
    define: { 'import.meta.env.VITE_BUILD': JSON.stringify(identifiantDuBuild()) },
    plugins: [pagesDuSite(), copiesDuSite(), serviceWorker(base), adressesDeLApp(), cspStricte()].filter(Boolean),
    /* Les pages du site (index.html, servie à `/`, et une par sujet :
       tarifs.html à `/tarifs`… src/site/pages.js, docs/SEO.md) et l'app
       (app.html, servie à `/app`). docs/LANDING.md. */
    build: { target: 'es2022', sourcemap: true, rollupOptions: { input: entrees(), output: { chunkFileNames: nomDuMorceau } } },
    server: { port: 5173 }
  };
});
