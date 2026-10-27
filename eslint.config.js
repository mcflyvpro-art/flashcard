import js from '@eslint/js';
import globals from 'globals';

export default [
  /* les rapports de Playwright embarquent la visionneuse de traces (du JS
     minifié) : un `npm run check` lancé après un parcours raté les lisait */
  { ignores: ['dist/', 'node_modules/', 'supabase/functions/', 'playwright-report/', 'test-results/', '.academie/'] },
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: globals.browser },
    rules: {
      /* Un catch vide doit porter un commentaire qui dit pourquoi (CLAUDE.md,
         règle 6) — l'existant a été passé en revue et chaque cas justifié
         (M06.T6), donc plus d'avertissement toléré : en erreur. */
      'no-empty': ['error', { allowEmptyCatch: false }],
      'no-useless-assignment': 'error',
      'no-undef': 'error',
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
      /* ESLint strict (M06.T6) : une fonction trop complexe ou trop
         profondément imbriquée est le signe qu'elle mélange plusieurs
         responsabilités — à ce point, mieux vaut l'extraire. */
      complexity: ['error', 15],
      'max-depth': ['error', 4]
    }
  },
  /* La base locale (2026-10-26) rejoue des fonctions SQL au plus près de
     leur texte — un verdict, ses dix cas, dans l'ordre de la base : la
     découper pour la complexité éloignerait l'émulation de ce qu'elle
     émule. Le reste des règles s'applique. */
  {
    files: ['src/base-locale/**/*.js'],
    rules: { complexity: 'off' }
  },
  {
    files: ['src/sw.js'],
    languageOptions: { sourceType: 'script', globals: { ...globals.serviceworker, __SHELL__: 'readonly' } }
  },
  {
    files: ['*.config.js', 'tools/**/*.js'],
    languageOptions: { sourceType: 'module', globals: globals.node }
  },
  /* le service worker qui désinscrit l'ancienne app de GitHub Pages */
  {
    files: ['tools/pages-redirection/sw.js'],
    languageOptions: { sourceType: 'script', globals: globals.serviceworker }
  },
  /* les affiches du site : Node, et le navigateur dans page.evaluate() */
  {
    files: ['tools/affiches.js'],
    languageOptions: { sourceType: 'module', globals: { ...globals.node, ...globals.browser } }
  },
  /* la Folio Academy : Node, et la page cadre dans page.evaluate() (son objet A) */
  {
    files: ['tools/academie/**/*.js'],
    languageOptions: { sourceType: 'module', globals: { ...globals.node, ...globals.browser, A: 'readonly' } }
  },
  /* M07 : un parcours tourne dans Node, mais les fonctions passées à
     page.evaluate() s'exécutent dans la page — les deux jeux de globales. */
  {
    files: ['e2e/**/*.js'],
    languageOptions: { sourceType: 'module', globals: { ...globals.node, ...globals.browser } }
  }
];
