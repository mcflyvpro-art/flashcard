/* La page du moteur (/moteur) : les graphiques sont déjà dans la page
   (écrits au build par src/site/moteur-calc.js) ; ce script les redessine
   quand on joue avec — la stabilité, les jours, la rétention visée, le
   scénario d'une année, la mesure du banc d'essai. Tout passe par le moteur
   de l'app (src/fsrs.js) ; rien n'est envoyé nulle part. */
import { SCENARIOS, bilanSimulation, facteur, lignesSimulation, rappel, simuler, barresBanc, svgCourbe, svgSimulation } from './moteur-calc.js';
import { auClavier } from './commun.js';

const pct = r => (r * 100).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' %';
const jours = t => { const n = Math.round(t); return n + (n > 1 ? ' jours' : ' jour'); };

/* ---------- la courbe d'oubli : la stabilité et le temps ---------- */
function courbe() {
  const lab = document.getElementById('labo-courbe');
  if (!lab) return;
  const s = lab.querySelector('#labo-s'), t = lab.querySelector('#labo-t');
  const sv = lab.querySelector('#labo-s-v'), tv = lab.querySelector('#labo-t-v'), g = lab.querySelector('.m-labo-graph');
  const poser = () => {
    const S = Math.pow(10, -0.5 + 3 * s.value / 100);                // de 0,3 à 316 jours
    const T = 4 * S * t.value / 100;
    sv.textContent = S < 1 ? (Math.round(S * 24) + ' heures') : jours(S);
    tv.textContent = (T < 1 ? Math.round(T * 24) + ' heures' : jours(T)) + ' · R = ' + pct(rappel(T, S));
    g.innerHTML = svgCourbe(S, true, T);
  };
  s.addEventListener('input', poser);
  t.addEventListener('input', poser);
  poser();
}

/* ---------- le bon jour : la rétention visée ---------- */
function retention() {
  const lab = document.getElementById('labo-r');
  if (!lab) return;
  const r = lab.querySelector('#labo-r-in'), v = lab.querySelector('#labo-r-v'), f = lab.querySelector('#labo-r-f');
  const poser = () => {
    const x = r.value / 100;
    v.textContent = pct(x).replace(',0', '');
    f.textContent = '×' + facteur(x).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    lab.querySelectorAll('.m-table-r tbody tr').forEach(tr => tr.classList.toggle('ici', parseInt(tr.cells[0].textContent, 10) === +r.value));
  };
  r.addEventListener('input', poser);
  poser();
}

/* Un groupe de boutons-radio : celui qu'on touche s'allume, `faire` suit. */
function radios(groupe, faire) {
  if (!groupe) return;
  const choisir = b => {
    groupe.querySelectorAll('[role="radio"]').forEach(x => {
      x.setAttribute('aria-checked', String(x === b));
      x.tabIndex = x === b ? 0 : -1;
    });
    faire(b);
  };
  groupe.querySelectorAll('[role="radio"]').forEach(x => { x.tabIndex = x.getAttribute('aria-checked') === 'true' ? 0 : -1; });
  groupe.addEventListener('click', e => { const b = e.target.closest('[role="radio"]'); if (b) choisir(b); });
  auClavier(groupe, '[role="radio"]', choisir);
}

/* ---------- une page, un an ---------- */
function annee() {
  const g = document.getElementById('sim-graph'), l = document.getElementById('sim-lignes'), b = document.getElementById('sim-bilan');
  if (!g) return;
  radios(document.querySelector('.m-scenarios'), bouton => {
    const sim = simuler(SCENARIOS[bouton.dataset.scenario].notes);
    g.innerHTML = svgSimulation(sim);
    l.innerHTML = lignesSimulation(sim);
    b.textContent = bilanSimulation(sim);
  });
}

/* ---------- le banc d'essai : la mesure ---------- */
function banc() {
  radios(document.querySelector('.m-banc-choix'), bouton => {
    const m = bouton.dataset.mesure, cible = document.getElementById('banc-' + m);
    document.querySelectorAll('[id^="banc-"]').forEach(x => { x.hidden = x !== cible; });
    if (!cible.firstElementChild) cible.innerHTML = barresBanc(m);
  });
}

courbe();
retention();
annee();
banc();
