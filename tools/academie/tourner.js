// Tourner la Mirandola Academy (tools/academie/README.md).
//   node tools/academie/tourner.js [eleve|prof|referent|tout] [--rep] [--sec] [--depuis=N]
//   node tools/academie/tourner.js echantillons      (la même phrase dans plusieurs voix, pour choisir)
// --rep : répétition rapide (voix accélérée, une capture par réplique dans
// .academie/tournage/<nom>/rep/), --sec : la voix seulement. Sans serveur sur
// ACADEMIE_URL, l'app est construite et servie le temps du tournage.
import { execFileSync, spawn } from 'node:child_process';
import { get } from 'node:http';
import { join } from 'node:path';
import { ICI, PY, TRAVAIL, BASE, tourner, attendre } from './moteur.js';
import eleve from './formations/eleve.js';
import prof from './formations/prof.js';
import referent from './formations/referent.js';

const FORMATIONS = { eleve, prof, referent };
const args = process.argv.slice(2);
const quoi = args.find(a => !a.startsWith('--')) || 'tout';
const repetition = args.includes('--rep'), secher = args.includes('--sec');
const depuis = Number((args.find(a => a.startsWith('--depuis=')) || '=0').split('=')[1]);
const RACINE = join(ICI, '..', '..');

/* node:http et non fetch : 4190 est un « port interdit » de la norme Fetch (ManageSieve) */
const enLigne = () => new Promise(ok => {
  get(BASE + '/essayer', r => { r.resume(); ok(r.statusCode === 200); }).on('error', () => ok(false));
});

async function serveur() {
  if (await enLigne()) return null;
  const port = new URL(BASE).port || '4190';
  execFileSync('npm', ['run', 'build'], { cwd: RACINE, stdio: 'inherit' });
  const s = spawn('npx', ['vite', 'preview', '--port', port, '--strictPort'], { cwd: RACINE, stdio: 'ignore' });
  for (let i = 0; i < 60 && !(await enLigne()); i++) await attendre(500);
  if (!(await enLigne())) throw new Error('vite preview ne répond pas sur ' + BASE);
  return s;
}

if (quoi === 'echantillons') {
  execFileSync(PY, ['-I', join(ICI, 'voix.py'), '--echantillons', join(TRAVAIL, 'echantillons')], { stdio: 'inherit' });
  console.log('écouter :', join(TRAVAIL, 'echantillons'));
} else {
  const liste = quoi === 'tout' ? Object.keys(FORMATIONS) : [quoi];
  if (liste.some(n => !FORMATIONS[n])) throw new Error('formation inconnue : ' + quoi);
  const s = secher ? null : await serveur();
  try {
    for (const n of liste) await tourner(FORMATIONS[n], { repetition, secher, depuis });
  } finally {
    if (s) s.kill();
  }
  if (!repetition && !secher) execFileSync(PY, ['-I', join(ICI, 'sommaire.py')], { stdio: 'inherit' });
}
