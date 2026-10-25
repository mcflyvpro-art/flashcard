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
      // les captures du manifeste ne servent qu'à l'installation : pas de cache
      const statics = walk(pub).map(p => abs(relative(pub, p))).filter(p => !p.startsWith(base + 'shots/'));
      const built = Object.keys(bundle).map(abs);
      const shell = [base, abs('index.html'), ...built, ...statics].filter(f => f !== abs('sw.js'));
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
    plugins: [serviceWorker(base)],
    build: { target: 'es2022', sourcemap: true },
    server: { port: 5173 }
  };
});
