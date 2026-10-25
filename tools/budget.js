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
//
// 2026-10-25 : le journal de lecture devient le troisième morceau (après
// l'espace professeur et la partie en direct) — 4,8 Ko de JS et 2,5 Ko de
// CSS à lui seul. Le plafond « à la demande » additionne les trois, que
// personne ne charge ensemble (un élève n'ouvre jamais l'espace prof) : il
// passe de 30 à 40 Ko (JS) et de 12 à 16 Ko (CSS), pour garder la même
// marge par morceau ; le démarrage, lui, garde ses 120 Ko.
//
// 2026-10-25 (bis) : le démarrage n'avait plus un octet de marge ; la
// sauvegarde, l'entretien de la bibliothèque (réparation, doublons) et le
// courrier refait sortent en morceaux à la demande, et la page d'une classe
// et le profil d'un lecteur suivent le même chemin. Le plafond « à la
// demande » passe de 40 à 56 Ko (JS) et de 16 à 22 Ko (CSS) — toujours la
// même marge par morceau, et toujours personne qui les charge tous ; le
// démarrage garde ses 120 Ko (115 aujourd'hui).
import { readdirSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

// octets gzip, tous fichiers de la part cumulés
const BUDGET = { js: 120 * 1024, css: 25 * 1024, jsDemande: 56 * 1024, cssDemande: 22 * 1024 };
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
