// M08.T2 — budget de poids, vérifié après chaque build (npm run check, donc
// en CI). Un élève ouvre l'app sur un forfait mobile, parfois en 4G
// faiblarde : chaque kilo-octet compte au démarrage. Au-delà, le build
// échoue — on décide alors en connaissance de cause (alléger, ou relever
// le budget ici, dans un commit qui dit pourquoi).
//
// Depuis l'espace professeur (2026-10-24), JS et CSS se comptent en deux parts.
// Le démarrage : ce que dist/index.html charge (script d'entrée et ses
// modulepreload) — c'est lui que tout le monde attend, élèves compris, et
// c'est lui qui garde les 120 Ko d'origine. Les morceaux chargés à la
// demande (aujourd'hui le seul espace professeur, ui/prof-porte.js, et sa
// feuille de style) ne pèsent que chez qui les ouvre : ils ont leur propre
// plafond, pour qu'ils ne grossissent pas non plus sans qu'on le décide.
import { readdirSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

// octets gzip, tous fichiers de la part cumulés
const BUDGET = { js: 120 * 1024, css: 25 * 1024, jsDemande: 30 * 1024, cssDemande: 12 * 1024 };
const NOMS = { js: 'JS au démarrage', css: 'CSS au démarrage', jsDemande: 'JS à la demande', cssDemande: 'CSS à la demande' };
const dir = 'dist/assets';
const html = readFileSync('dist/index.html', 'utf8');
const auDemarrage = f => html.includes('/assets/' + f);
const total = { js: 0, css: 0, jsDemande: 0, cssDemande: 0 };
for (const f of readdirSync(dir)) {
  const ext = f.split('.').pop();
  if (ext !== 'js' && ext !== 'css') continue;
  const part = auDemarrage(f) ? ext : ext + 'Demande';
  total[part] += gzipSync(readFileSync(`${dir}/${f}`), { level: 9 }).length;
}
let ok = true;
for (const k of Object.keys(BUDGET)) {
  const ko = (n) => (n / 1024).toFixed(1) + ' Ko';
  const dedans = total[k] <= BUDGET[k];
  console.log(`${dedans ? '✓' : '✗'} ${NOMS[k]} ${ko(total[k])} gzip / budget ${ko(BUDGET[k])}`);
  ok = ok && dedans;
}
process.exit(ok ? 0 : 1);
