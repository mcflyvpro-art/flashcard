// Les fichiers qui relient mirandola.fr à l'app des magasins (2026-11-16,
// docs/CAPACITOR.md, « Liens universels ») : sans eux, un lien de l'app
// (le QR d'une classe, une invitation, un e-mail) s'ouvre dans le
// navigateur ; avec eux, dans l'app, connectée.
//
//   node tools/natif/liens.js --equipe ABCDE12345
//   node tools/natif/liens.js --empreinte AA:BB:…:FF [--empreinte …]
//
// --equipe     l'identifiant d'équipe du compte Apple Developer (Membership,
//              10 signes) → public/.well-known/apple-app-site-association,
//              et l'en-tête qu'Apple attend dans vercel.json ;
// --empreinte  l'empreinte SHA-256 de la clé qui signe l'app que Google Play
//              distribue (Play Console → Intégrité de l'app → Signature de
//              l'app) — et, pour essayer un APK signé à la main, celle de la
//              clé d'importation → public/.well-known/assetlinks.json.
//
// Ne jamais publier un fichier aux identifiants faux : Apple et Google
// mettent la vérification ratée en cache. Les adresses viennent de
// CHEMINS_APP (src/natif.js), les mêmes que le manifeste d'Android.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { associationAndroid, associationApple } from '../../src/natif.js';

const args = process.argv.slice(2);
const valeurs = nom => args.flatMap((a, i) => (a === nom && args[i + 1] ? [args[i + 1]] : []));
const equipe = valeurs('--equipe')[0];
const empreintes = valeurs('--empreinte');
if (!equipe && !empreintes.length) {
  console.error('Rien à écrire : --equipe <identifiant Apple> et/ou --empreinte <SHA-256 Google Play>.');
  process.exit(1);
}

mkdirSync('public/.well-known', { recursive: true });
if (equipe) {
  writeFileSync('public/.well-known/apple-app-site-association', JSON.stringify(associationApple(equipe), null, 2) + '\n');
  // Apple lit ce fichier sans extension : il le veut en JSON
  const v = JSON.parse(readFileSync('vercel.json', 'utf8'));
  const source = '/.well-known/apple-app-site-association';
  if (!v.headers.some(h => h.source === source)) {
    v.headers.push({ source, headers: [{ key: 'Content-Type', value: 'application/json' }] });
    writeFileSync('vercel.json', JSON.stringify(v, null, 2) + '\n');
  }
  console.log('✓ public/.well-known/apple-app-site-association (équipe ' + equipe + ') et son en-tête dans vercel.json');
}
if (empreintes.length) {
  writeFileSync('public/.well-known/assetlinks.json', JSON.stringify(associationAndroid(empreintes), null, 2) + '\n');
  console.log('✓ public/.well-known/assetlinks.json (' + empreintes.length + ' empreinte' + (empreintes.length > 1 ? 's' : '') + ')');
}
console.log('Ensuite : commit, mise en ligne, puis vérifier https://mirandola.fr/.well-known/… (docs/MAGASINS.md).');
