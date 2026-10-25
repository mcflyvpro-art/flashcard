// Les parcours e2e sur une machine où le Chromium est déjà installé hors de
// Playwright (sessions Claude dans le cloud : /opt/pw-browsers/chromium) —
// la version de Playwright du projet ne l'y trouverait pas toute seule.
// Lancer : CI=1 npx playwright test -c tools/pw-local.config.js
import { fileURLToPath } from 'node:url';
import base from '../playwright.config.js';

const racine = fileURLToPath(new URL('..', import.meta.url));

const chromium = process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium';

export default {
  ...base,
  testDir: racine + 'e2e',
  // le serveur se lance depuis le dossier de la config : le ramener à la racine
  webServer: { ...base.webServer, cwd: racine },
  projects: base.projects.map(p => ({
    ...p,
    use: { ...p.use, launchOptions: { executablePath: chromium } }
  }))
};
