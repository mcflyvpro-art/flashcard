// M08.T2 — budget de poids, vérifié après chaque build (npm run check, donc
// en CI). Un élève ouvre l'app sur un forfait mobile, parfois en 4G
// faiblarde : chaque kilo-octet compte au démarrage. Au-delà, le build
// échoue — on décide alors en connaissance de cause (alléger, ou relever
// le budget ici, dans un commit qui dit pourquoi).
import { readdirSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const BUDGET = { js: 120 * 1024, css: 25 * 1024 };   // octets gzip, tous fichiers du type cumulés
const dir = 'dist/assets';
const total = { js: 0, css: 0 };
for (const f of readdirSync(dir)) {
  const ext = f.split('.').pop();
  if (ext in total) total[ext] += gzipSync(readFileSync(`${dir}/${f}`), { level: 9 }).length;
}
let ok = true;
for (const ext of Object.keys(BUDGET)) {
  const ko = (n) => (n / 1024).toFixed(1) + ' Ko';
  const dedans = total[ext] <= BUDGET[ext];
  console.log(`${dedans ? '✓' : '✗'} ${ext.toUpperCase()} ${ko(total[ext])} gzip / budget ${ko(BUDGET[ext])}`);
  ok = ok && dedans;
}
process.exit(ok ? 0 : 1);
