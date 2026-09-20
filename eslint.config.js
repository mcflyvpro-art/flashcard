import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist/', 'node_modules/', 'supabase/functions/'] },
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
  {
    files: ['src/sw.js'],
    languageOptions: { sourceType: 'script', globals: { ...globals.serviceworker, __SHELL__: 'readonly' } }
  },
  {
    files: ['*.config.js'],
    languageOptions: { sourceType: 'module', globals: globals.node }
  }
];
