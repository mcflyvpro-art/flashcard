import { defineConfig, loadEnv } from 'vite';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';

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
         ligne n'en a pas besoin. */
      const statics = walk(pub).map(p => abs(relative(pub, p)))
        .filter(p => !p.startsWith(base + 'shots/') && !p.startsWith(base + 'site/'));
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
      const code = readFileSync('src/sw.js', 'utf8')
        .replace('__BUILD__', hash.digest('hex').slice(0, 12))
        .replace('__BASE__', base)
        .replace('__SHELL__', JSON.stringify(shell));
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
   modules de Vite et ce qui n'est pas une page passent tels quels. */
function adressesDeLApp() {
  const relais = (req, res, next) => {
    const i = req.url.search(/[?#]/);
    const chemin = i < 0 ? req.url : req.url.slice(0, i), reste = i < 0 ? '' : req.url.slice(i);
    const page = req.method === 'GET' && (req.headers.accept || '').includes('text/html');
    if (page && chemin !== '/' && !/\.[a-z0-9]+$/i.test(chemin)
      && !/^\/(assets|icons|site|src|node_modules|@)/.test(chemin)) req.url = '/app.html' + reste;
    next();
  };
  return {
    name: 'folio-adresses',
    configureServer(s) { s.middlewares.use(relais); },
    configurePreviewServer(s) { s.middlewares.use(relais); }
  };
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
    plugins: [serviceWorker(base), adressesDeLApp()],
    /* Deux pages : la page d'accueil du site (index.html, servie à `/`) et
       l'app (app.html, servie à `/app`). docs/LANDING.md. */
    build: { target: 'es2022', sourcemap: true, rollupOptions: { input: { site: 'index.html', app: 'app.html' } } },
    server: { port: 5173 }
  };
});
