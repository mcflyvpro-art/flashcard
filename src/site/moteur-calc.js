/* La page du moteur (/moteur, 2026-11-04) : tout ce qu'elle trace et
   tout ce qu'elle simule passe par src/fsrs.js, le code même qui choisit
   l'échéance de chaque page dans l'app (FSRS-6, porté du crate fsrs 6.6.2).
   Aucune formule n'est recopiée ici : on appelle le moteur, on lit ses
   réponses, on dessine. Pur et sans DOM : le build s'en sert pour écrire
   les graphiques dans la page (tools/site/gabarit.js, qui doit marcher sans
   JavaScript), src/site/moteur.js pour les redessiner quand on joue avec ;
   test/moteur.test.js le vérifie. */
import { W6, f6curve, f6fac, f6initD, fsrsInit, fsrsIvl, fsrsStep } from '../fsrs.js';

export const W = W6;
export const F = f6fac(W6);
export const RETENTION = 0.9;

/* Ce que fait chacun des 21 paramètres, dans l'ordre du crate. */
export const ROLES = [
  'Stabilité de départ après « Encore »', 'Stabilité de départ après « Difficile »',
  'Stabilité de départ après « Correct »', 'Stabilité de départ après « Facile »',
  'Difficulté de départ : son niveau', 'Difficulté de départ : sa pente selon la note',
  'Pas de la difficulté à chaque note', 'Retour de la difficulté vers sa moyenne',
  'Gain de stabilité : son échelle', 'Gain de stabilité : sa saturation avec S',
  'Gain de stabilité : l’effet du rappel', 'Après un oubli : l’échelle',
  'Après un oubli : l’effet de la difficulté', 'Après un oubli : l’effet de l’ancienne stabilité',
  'Après un oubli : l’effet du rappel', 'Malus de « Difficile »', 'Bonus de « Facile »',
  'Le jour même : l’échelle', 'Le jour même : le décalage', 'Le jour même : la saturation',
  'La courbe d’oubli : son exposant'
];

/* Le rappel prédit par le moteur, t jours après la dernière lecture. */
export const rappel = (t, S) => f6curve(W6, t, { S });
/* Une exponentielle qui passe aussi par 90 % au bout de S jours : ce que
   serait la mémoire si elle s'effaçait à vitesse constante. */
export const exponentielle = (t, S) => Math.pow(RETENTION, t / S);
/* Combien de fois S attendre pour une rétention visée r (I = S quand r = 0,9). */
export const facteur = r => fsrsIvl(W6, { S: 1, D: 5, F: 1 }, r);
/* Le jour où le rappel tombe à R, pour une stabilité S. */
const quand = (S, R) => fsrsIvl(W6, { S, D: 5, F: S }, R);

/* Ce que gagne la stabilité d'une page lue « Correct », selon le rappel au
   moment de la lire : le moteur lui-même, interrogé. */
export function gain(D, S, R, g = 3) {
  const m = { S, D, F: S };
  return fsrsStep(W6, m, quand(S, R), g).S / S;
}

export const difficulteDepart = g => f6initD(W6, g);

/* ---------- une page, un an ----------
   Le premier jour, comme l'app : une note, puis le palier de dix minutes
   (sauf « Facile », qui saute les paliers). Ensuite chaque révision tombe
   quand le rappel prédit touche 90 %, sans flou ni équilibreur, pour qu'on
   lise le moteur seul. Un « Encore » envoie au palier de rechute (dix
   minutes) avant de repartir. `notes` : la note de chaque révision. */
export const SCENARIOS = {
  correct: { nom: 'Toujours « Correct »', notes: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3] },
  oubli: { nom: 'Un oubli au 3ᵉ passage', notes: [3, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 3] },
  facile: { nom: 'Toujours « Facile »', notes: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4] },
  difficile: { nom: 'Toujours « Difficile »', notes: [3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2] }
};

export function simuler(notes, horizon = 365) {
  let m = fsrsInit(W6, notes[0]);
  if (notes[0] !== 4) m = fsrsStep(W6, m, 0, 3);          // le palier de dix minutes, réussi
  const lectures = [{ jour: 0, note: notes[0], S: m.S, D: m.D, R: 1 }];
  let jour = 0;
  for (let i = 1; i < notes.length; i++) {
    const I = Math.max(1, Math.round(fsrsIvl(W6, m, RETENTION)));
    if (jour + I > horizon) return { lectures, prochaine: jour + I, m };
    const R = f6curve(W6, I, m);
    jour += I;
    m = fsrsStep(W6, m, I, notes[i]);
    if (notes[i] === 1) m = fsrsStep(W6, m, 0, 3);           // la rechute : dix minutes, réussie
    lectures.push({ jour, note: notes[i], S: m.S, D: m.D, R, I });
  }
  return { lectures, prochaine: jour + Math.max(1, Math.round(fsrsIvl(W6, m, RETENTION))), m };
}

/* ---------- les dessins (des SVG en texte, pour le build et pour la page) ---------- */
const f1 = v => (Math.round(v * 10) / 10).toString();
const nb = (v, d = 1) => v.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });

/* Un cadre de graphique : 1000 × h, marges, repères de y en %. */
/* ce que dit chaque graphique, pour un lecteur d'écran (role="img" sans nom :
   axe-core, e2e/accessibilite.e2e.js) */
const LEGENDES = {
  'm-oubli': 'La courbe de l’oubli de FSRS-6 face à une exponentielle',
  'm-famille': 'Les courbes de l’oubli de FSRS-6 pour plusieurs stabilités, sur un an',
  'm-gainsvg': 'Le gain de stabilité après une réussite, selon le rappel et la difficulté',
  'm-simsvg': 'Le rappel d’une page sur un an, révision après révision'
};

function cadre(h, ys, xs, contenu, classe) {
  const X0 = 70, X1 = 975, Y0 = 24, Y1 = h - 46;
  const y = r => Y1 - (Y1 - Y0) * r, x = u => X0 + (X1 - X0) * u;
  const grilles = ys.map(([r, t]) => `<line class="m-grille" x1="${X0}" x2="${X1}" y1="${f1(y(r))}" y2="${f1(y(r))}"/>`
    + `<text class="m-ty" x="${X0 - 12}" y="${f1(y(r) + 5)}">${t}</text>`).join('');
  const abs = xs.map(([u, t]) => `<text class="m-tx" x="${f1(x(u))}" y="${h - 16}">${t}</text>`).join('');
  return `<svg class="m-svg ${classe || ''}" viewBox="0 0 1000 ${h}" role="img" aria-label="${LEGENDES[classe] || 'Graphique'}">${grilles}${abs}${contenu(x, y)}</svg>`;
}
/* Des coordonnées entières : sur 1 000 unités, le dixième ne se voit pas, et
   la page pèse 40 % de moins (budget des pages du site, tools/budget.js). */
const chemin = (pts, x, y) => 'M' + pts.map(([u, r]) => `${Math.round(x(u))} ${Math.round(y(r))}`).join('L');

/* La courbe d'oubli d'une page de stabilité S, sur 4 S, et l'exponentielle. */
export function svgCourbe(S, expo = true, lecture = null) {
  const T = 4 * S, n = 70, pts = [], pte = [];
  for (let i = 0; i <= n; i++) { const t = T * i / n; pts.push([i / n, rappel(t, S)]); pte.push([i / n, exponentielle(t, S)]); }
  const xs = [[0, '0'], [0.25, 'S'], [0.5, '2S'], [0.75, '3S'], [1, '4S']];
  return cadre(420, [[1, '100 %'], [0.9, '90 %'], [0.5, '50 %'], [0, '0 %']], xs, (x, y) =>
    (expo ? `<path class="m-expo" d="${chemin(pte, x, y)}"/>` : '')
    + `<path class="m-fsrs" d="${chemin(pts, x, y)}"/>`
    + `<circle class="m-pt" cx="${f1(x(0.25))}" cy="${f1(y(0.9))}" r="7"/>`
    + (lecture == null ? '' : (() => {
      const u = lecture / T, r = rappel(lecture, S);
      return `<line class="m-lect" x1="${f1(x(u))}" x2="${f1(x(u))}" y1="${f1(y(0))}" y2="${f1(y(1))}"/>`
        + `<circle class="m-pt2" cx="${f1(x(u))}" cy="${f1(y(r))}" r="7"/>`;
    })()), 'm-oubli');
}

/* Une famille de courbes : la même équation, quatre stabilités. */
export const FAMILLE = [1, 7, 30, 180];
export function svgFamille() {
  const T = 365, n = 90;
  const ligne = S => {
    const pts = [];
    for (let i = 0; i <= n; i++) { const u = i / n, t = T * u * u; pts.push([u, rappel(t, S)]); }
    return pts;
  };
  const xs = [[0, '0'], [Math.sqrt(7 / 365), '1 sem.'], [Math.sqrt(30 / 365), '1 mois'], [Math.sqrt(180 / 365), '6 mois'], [1, '1 an']];
  return cadre(420, [[1, '100 %'], [0.9, '90 %'], [0.5, '50 %'], [0, '0 %']], xs, (x, y) =>
    FAMILLE.map((S, k) => `<path class="m-fam m-fam${k}" d="${chemin(ligne(S), x, y)}"/>`).join('')
    + FAMILLE.map((S, k) => { const u = Math.sqrt(S / T); return `<circle class="m-fam-pt m-fam${k}" cx="${f1(x(u))}" cy="${f1(y(0.9))}" r="6"/>`; }).join(''),
  'm-famille');
}

/* Le gain de stabilité (S'/S) selon le rappel au moment de lire, pour trois difficultés. */
export const DIFFICULTES = [2, 5, 8];
export function svgGain(S = 10) {
  const n = 36, maxi = 21;
  const pts = D => { const p = []; for (let i = 0; i <= n; i++) { const R = 0.98 - 0.48 * i / n; p.push([i / n, gain(D, S, R) / maxi]); } return p; };
  const xs = [[0, '98 %'], [1 / 6, '90 %'], [0.5, '74 %'], [5 / 6, '58 %'], [1, '50 %']];
  return cadre(420, [[20 / 21, '×20'], [15 / 21, '×15'], [10 / 21, '×10'], [5 / 21, '×5'], [1 / 21, '×1']], xs, (x, y) =>
    DIFFICULTES.map((D, k) => `<path class="m-gain m-gain${k}" d="${chemin(pts(D), x, y)}"/>`).join(''), 'm-gainsvg');
}

/* Le banc d'essai public (open-spaced-repetition/srs-benchmark), relevé le
   2026-11-04 : 9 999 collections, révisions du jour même exclues. */
export const BANC = [
  { nom: 'FSRS-6', n: 21, logloss: 0.3460, rmse: 0.0653, auc: 0.7034, nous: true },
  { nom: 'FSRS-5', n: 19, logloss: 0.3561, rmse: 0.0742, auc: 0.7010 },
  { nom: 'FSRS-4.5', n: 17, logloss: 0.3625, rmse: 0.0764, auc: 0.6891 },
  { nom: 'HLR', n: 3, logloss: 0.4694, rmse: 0.1275, auc: 0.6369 },
  { nom: 'Ebisu v2', n: 0, logloss: 0.4989, rmse: 0.1627, auc: 0.6051 }
];
/* En barres HTML plutôt qu'en SVG : au téléphone, un dessin de 1 000 unités
   rapetissait les noms jusqu'à l'illisible ; une barre, elle, garde ses lettres. */
export function barresBanc(cle = 'rmse') {
  const maxi = Math.max(...BANC.map(b => b[cle])) * 1.3;
  return '<ol class="m-banc">' + BANC.map(b => `<li${b.nous ? ' class="m-nous"' : ''}><span class="m-bn">${b.nom}</span>`
    + `<span class="m-bbarre"><i style="width:${f1(100 * b[cle] / maxi)}%"></i><b class="m-bv">${nb(b[cle], 4)}</b></span></li>`).join('') + '</ol>';
}

/* Une année d'une page : le rappel en dents de scie, une marque par lecture. */
export function svgSimulation(sim, horizon = 365) {
  const pts = [];
  const L = sim.lectures;
  for (let k = 0; k < L.length; k++) {
    const debut = L[k].jour, fin = k + 1 < L.length ? L[k + 1].jour : horizon, S = L[k].S;
    if (k) pts.push([debut / horizon, 1]);
    const n = Math.max(8, Math.ceil((fin - debut) / 2));
    for (let i = 0; i <= n; i++) { const t = (fin - debut) * i / n; pts.push([(debut + t) / horizon, rappel(t, S)]); }
  }
  const xs = [[0, 'Jour 0'], [90 / 365, '3 mois'], [182 / 365, '6 mois'], [273 / 365, '9 mois'], [1, '1 an']];
  return cadre(380, [[1, '100 %'], [0.9, '90 %'], [0.7, '70 %']].map(([r, t]) => [(r - 0.6) / 0.4, t]), xs, (x, y) => {
    const yy = r => y((r - 0.6) / 0.4);
    const d = 'M' + pts.map(([u, r]) => `${Math.round(x(u))} ${Math.round(yy(Math.max(r, 0.6)))}`).join('L');
    return `<path class="m-dents" d="${d}"/>` + L.slice(1).map(l =>
      `<circle class="m-lu${l.note === 1 ? ' m-oublie' : ''}" cx="${f1(x(l.jour / horizon))}" cy="${f1(yy(1))}" r="8"/>`).join('');
  }, 'm-simsvg');
}

const NOTES = { 1: 'Encore', 2: 'Difficile', 3: 'Correct', 4: 'Facile' };
/* La liste des lectures, en lignes de tableau. */
export function lignesSimulation(sim) {
  return sim.lectures.map((l, k) => `<tr${l.note === 1 ? ' class="m-rechute"' : ''}><td>${k ? 'J+' + l.jour : 'J 0'}</td>`
    + `<td>${k ? nb(l.R * 100, 1) + '&nbsp;%' : '·'}</td><td>${NOTES[l.note]}</td>`
    + `<td>${nb(l.S, l.S < 10 ? 2 : 1)}&nbsp;j</td><td>${nb(l.D, 2)}</td></tr>`).join('');
}

/* Le bilan d'une année, en une phrase. */
export const bilanSimulation = sim => `${sim.lectures.length} révisions dans l’année, la première comprise. La suivante : jour ${sim.prochaine}.`;

/* La table des 21 paramètres, écrite depuis W6 : elle ne peut pas mentir. */
export function tableParametres() {
  return W6.map((v, i) => `<tr data-w="${i}"><td><i>w</i><sub>${i}</sub></td><td>${v.toLocaleString('fr-FR', { maximumFractionDigits: 4 })}</td><td>${ROLES[i]}</td></tr>`).join('');
}
