// Les parcours e2e sous Safari (WebKit), à côté du Chromium habituel.
// Le WebKit se télécharge à part, dans un dossier à soi, pour ne pas
// toucher au Chromium préinstallé de la machine :
//   export PLAYWRIGHT_BROWSERS_PATH=<scratchpad>/pw
//   npx playwright install webkit && npx playwright install-deps webkit
//   CI=1 npx playwright test -c tools/pw-webkit.config.js
import { fileURLToPath } from 'node:url';
import { devices } from '@playwright/test';
import base from '../playwright.config.js';

const racine = fileURLToPath(new URL('..', import.meta.url));

/* Sous WebKit, le service worker capte les requêtes avant page.route : le
   faux Supabase des parcours ne verrait plus rien passer. */
const sansSW = { serviceWorkers: 'block' };

export default {
  ...base,
  testDir: racine + 'e2e',
  webServer: { ...base.webServer, cwd: racine },
  projects: [
    { name: 'iphone', use: { ...devices['iPhone 13'], ...sansSW } },
    { name: 'safari', use: { ...devices['Desktop Safari'], ...sansSW } }
  ]
};
