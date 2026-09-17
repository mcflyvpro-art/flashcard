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
         règle 6). En avertissement tant que l'existant n'est pas passé en revue :
         il y en a une trentaine, à trier un par un plutôt qu'à faire taire. */
      'no-empty': ['warn', { allowEmptyCatch: false }],
      'no-useless-assignment': 'warn',
      'no-undef': 'error',
      'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }]
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
