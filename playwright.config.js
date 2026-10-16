// M07 : les parcours de bout en bout, sur le build de production servi en
// local (`vite preview`) — c'est lui qui part chez les élèves, service
// worker compris, pas le serveur de développement. Les fichiers s'appellent
// `*.e2e.js` exprès : vitest ramasse par défaut tout `*.spec.js`/`*.test.js`,
// et les deux outils ne doivent pas se marcher dessus.
import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.e2e.js',
  fullyParallel: true,
  workers: 2,                  // au-delà, une machine déjà occupée sature (charge 22 vue le 2026-10-16) et les délais sautent
  timeout: 60000,              // une séance de 13 pages, animations comprises, dépasse les 30 s par défaut
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}/`,
    trace: 'retain-on-failure',
    locale: 'fr-FR'
  },
  projects: [
    // mobile d'abord : l'écran qui compte pour un élève
    { name: 'mobile', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } }
  ],
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120000
  }
});
