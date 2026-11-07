// Le cliquet des types stricts (2026-11-07, docs/FIABILITE.md).
//
// `npm run typecheck` relit src/core/ en mode permissif (tsconfig.json,
// M06.T8) : il attrape les vraies bêtises sans exiger d'annoter tout. Le
// mode strict, lui, en voit davantage — une valeur peut-être nulle qu'on
// lit sans la vérifier, un paramètre sans type —, 289 le 2026-11-07. Les
// corriger toutes d'un coup serait une refonte ; on pose un cliquet : le
// nombre d'erreurs strictes de chaque fichier ne peut que baisser. Un
// fichier neuf part à zéro.
//
//   node tools/types-cliquet.js            vérifie (la CI, par npm run typecheck)
//   node tools/types-cliquet.js --ecrire   enregistre les chiffres du moment,
//                                          après en avoir corrigé (jamais pour
//                                          en accepter de nouvelles)
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const registre = path.join(racine, 'tools', 'types-cliquet.json');
const tsc = path.join(racine, 'node_modules', '.bin', 'tsc');

function erreursStrictes() {
  let sortie;
  try {
    sortie = execFileSync(tsc, ['--noEmit', '--strict', '--pretty', 'false'], { cwd: racine, encoding: 'utf8', maxBuffer: 1 << 26 });
  } catch (e) {
    // tsc rend un code de sortie non nul dès qu'il trouve une erreur : c'est
    // le cas attendu ici, sa liste est sur la sortie standard
    sortie = String(e.stdout || '');
    if (!sortie.includes('error TS')) throw e;
  }
  const parFichier = {};
  for (const ligne of sortie.split('\n')) {
    const m = ligne.match(/^(.+?)\(\d+,\d+\): error TS\d+/);
    if (m) { const f = m[1].replace(/\\/g, '/'); parFichier[f] = (parFichier[f] || 0) + 1; }
  }
  return parFichier;
}

const maintenant = erreursStrictes();
const total = o => Object.values(o).reduce((a, b) => a + b, 0);

if (process.argv.includes('--ecrire')) {
  const trie = Object.fromEntries(Object.keys(maintenant).sort().map(f => [f, maintenant[f]]));
  writeFileSync(registre, JSON.stringify(trie, null, 2) + '\n');
  console.log(`cliquet enregistré : ${total(maintenant)} erreurs strictes dans ${Object.keys(trie).length} fichiers`);
  process.exit(0);
}

const avant = existsSync(registre) ? JSON.parse(readFileSync(registre, 'utf8')) : {};
const pires = Object.entries(maintenant).filter(([f, n]) => n > (avant[f] || 0));
const mieux = Object.entries(avant).filter(([f, n]) => (maintenant[f] || 0) < n);

if (pires.length) {
  console.error('✗ des erreurs de types strictes en plus (npx tsc --noEmit --strict pour les voir) :');
  for (const [f, n] of pires) console.error(`  ${f} : ${avant[f] || 0} → ${n}`);
  process.exit(1);
}
console.log(`✓ types stricts : ${total(maintenant)} erreurs, aucune de plus (cliquet ${total(avant)})`);
if (mieux.length) console.log(`  ${mieux.length} fichier(s) en ont moins : node tools/types-cliquet.js --ecrire pour serrer le cliquet`);
