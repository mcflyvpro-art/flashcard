// Les tests de mutation (2026-11-07, nuit.yml le dimanche, docs/FIABILITE.md) :
// Stryker modifie le noyau pur — une condition inversée, un < devenu <=, une
// constante changée, un bloc retiré — et regarde si un test le remarque. Un
// mutant qui survit, c'est un comportement que nos tests ne gardent pas.
// Le noyau seulement : là vivent les règles (CLAUDE.md, règle 1).
//   npm run mutation          → reports/mutation/index.html
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  testRunner: 'vitest',
  plugins: ['@stryker-mutator/vitest-runner'],
  mutate: [
    'src/file.js', 'src/fusion.js', 'src/livre-code.js', 'src/normaliser.js', 'src/examen.js',
    'src/tarifs.js', 'src/erreurs.js', 'src/offres.js', 'src/pseudo.js', 'src/classe.js',
    'src/journal.js', 'src/facture.js', 'src/securite.js', 'src/synchro.js', 'src/ia-mois.js'
  ],
  coverageAnalysis: 'perTest',
  reporters: ['clear-text', 'progress', 'html'],
  htmlReporter: { fileName: 'reports/mutation/index.html' },
  // le seuil sous lequel la nuit échoue : le score du premier passage, à ne
  // plus jamais laisser descendre (docs/FIABILITE.md)
  thresholds: { high: 85, low: 70, break: 75 },
  concurrency: 2,
  timeoutMS: 20000,
  tempDirName: '.stryker-tmp',
  /* le projet est en JavaScript, vérifié par TypeScript 7 (natif), qui n'a
     plus l'API JavaScript que Stryker appelle pour réécrire tsconfig.json :
     on ne lui donne pas de tsconfig à réécrire, ni de vérification de types
     à couper */
  tsconfigFile: 'tsconfig.inexistant.json',
  disableTypeChecks: false,
  /* les mutants « statiques » (une constante de module) rejouent toute la
     suite à chaque fois : 22 % des mutants pour 82 % du temps au premier
     passage. On les laisse : les règles sont dans les fonctions. */
  ignoreStatic: true
};
