// Les parcours e2e sur une machine où le Chromium est déjà installé hors de
// Playwright (sessions Claude dans le cloud : /opt/pw-browsers/chromium) —
// la version de Playwright du projet ne l'y trouverait pas toute seule.
// Lancer : CI=1 npx playwright test -c tools/pw-local.config.js
// PW_PORT=4174 : un autre port, pour faire tourner deux arbres de travail
// en même temps (chacun construit son propre dist/).
import { fileURLToPath } from 'node:url';
import base from '../playwright.config.js';

const racine = fileURLToPath(new URL('..', import.meta.url));

const chromium = process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium';
const port = process.env.PW_PORT;

export default {
  ...base,
  testDir: racine + 'e2e',
  use: port ? { ...base.use, baseURL: `http://localhost:${port}/` } : base.use,
  // le serveur se lance depuis le dossier de la config : le ramener à la racine
  webServer: port
    ? { ...base.webServer, cwd: racine, url: `http://localhost:${port}/`,
        command: `npm run build && npx vite preview --port ${port} --strictPort` }
    : { ...base.webServer, cwd: racine },
  projects: base.projects.map(p => ({
    ...p,
    use: { ...p.use, launchOptions: { executablePath: chromium } }
  }))
};
