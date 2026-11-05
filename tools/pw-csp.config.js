// Toute la suite des parcours sous la CSP de vercel.json APPLIQUÉE (M10.T5) :
// `vite preview` la sert (cspStricte de vite.config.js) et range chaque
// violation dans le fichier nommé par CSP_STRICTE.
// Lancer : CSP_STRICTE=/chemin/csp.ndjson CI=1 npx playwright test -c tools/pw-csp.config.js
// puis : le fichier doit rester vide (0 violation).
import local from './pw-local.config.js';

if (!process.env.CSP_STRICTE) throw new Error('CSP_STRICTE : le fichier où ranger les violations');
const port = 4176;

export default {
  ...local,
  use: { ...local.use, baseURL: `http://localhost:${port}/` },
  webServer: { ...local.webServer, url: `http://localhost:${port}/`, reuseExistingServer: false,
    command: `npm run build && npx vite preview --port ${port} --strictPort` },
  projects: local.projects.map(p => ({ ...p, use: { ...p.use, baseURL: `http://localhost:${port}/` } }))
};
