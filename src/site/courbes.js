/* Le graphique du moteur, sur la page d'accueil : ce qu'on retient de cinq
   pages pendant un an, sans révision, avec Memory Engine Lite et avec
   Memory Engine Ultra. Pur, sans DOM :
   site.js dessine et anime, test/site.test.js vérifie les chiffres.

   La courbe d'oubli est celle de FSRS (R = (1 + 19/81 · t/S)^-0,5, qui vaut
   0,9 quand t = S). Sans révision, chaque fiche glisse sur sa courbe. Avec
   Mirandola, elle revient quand son rappel tombe à 90 %, comme le règle le
   moteur de l'app, et chaque révision réussie allonge sa stabilité : les
   révisions s'espacent. Le temps est porté en racine carrée, sinon la
   première semaine, où tout se joue, tiendrait dans un trait. */

export const AN = 365;
const F = 19 / 81;

/* La stabilité de départ de chaque fiche, en jours : de la plus coriace à
   la plus facile. */
export const DEPART = [0.8, 1.4, 2.3, 3.4, 5];

export const rappel = (t, S) => (1 + F * t / S) ** -0.5;

/* Ce que gagne une fiche revue juste à temps : beaucoup au début, un peu
   moins à mesure qu'elle tient. */
const apres = S => S * (1 + 2.1 * S ** -0.14);

export const versX = t => Math.sqrt(Math.max(0, t) / AN);
export const versT = x => AN * x * x;

/* Les périodes d'une page revue : chacune commence à une révision (la
   première à la lecture) avec sa stabilité, et finit quand le moteur la
   rappelle. Ultra (`juste` = 1) connaît la mémoire de chacun : il rappelle
   la page quand le rappel retombe à 90 %. Lite garde les réglages de base,
   qui ne connaissent pas ta mémoire : il rappelle la page bien trop tard
   (`JUSTE_LITE`, une stabilité prêtée plus de dix fois trop grande), quand
   le rappel est déjà tombé vers 60 % ; il tourne autour de 65 à 70 % sur
   l'année (demandé le 2026-10-27, pour que l'écart se voie). */
export const JUSTE_LITE = 0.075;
export function programme(S0, juste = 1) {
  const p = [{ debut: 0, S: S0 }];
  for (;;) {
    const d = p[p.length - 1], fin = d.debut + d.S / juste;
    if (fin > AN) return p;
    p.push({ debut: fin, S: apres(d.S) });
  }
}

export function rappelAvec(t, p) {
  let d = p[0];
  for (const x of p) if (x.debut <= t) d = x;
  return rappel(t - d.debut, d.S);
}

const moyenne = a => a.reduce((s, v) => s + v, 0) / a.length;

/* Coordonnées du dessin : 1000 × 1000, le temps à droite, 100 % en haut. */
const X = x => (1000 * x).toFixed(1);
const Y = r => (1000 * (1 - r)).toFixed(1);

function cheminSans(S, n = 90) {
  let d = 'M0 0';
  for (let i = 1; i <= n; i++) { const x = i / n; d += `L${X(x)} ${Y(rappel(versT(x), S))}`; }
  return d;
}

function cheminAvec(p, juste = 1, n = 14) {
  let d = 'M0 0';
  p.forEach(({ debut, S }) => {
    const x0 = versX(debut), x1 = versX(Math.min(debut + S / juste, AN));
    if (debut > 0) d += `L${X(x0)} 0`;                     // la révision : retour à 100 %
    for (let i = 1; i <= n; i++) {
      const x = x0 + (x1 - x0) * i / n;
      d += `L${X(x)} ${Y(rappel(versT(x) - debut, S))}`;
    }
  });
  return d;
}

export function courbes() {
  const progs = DEPART.map(S => programme(S));
  const lites = DEPART.map(S => programme(S, JUSTE_LITE));
  const lire = x => {
    const t = versT(x);
    return { avec: moyenne(progs.map(p => rappelAvec(t, p))), lite: moyenne(lites.map(p => rappelAvec(t, p))),
      sans: moyenne(DEPART.map(S => rappel(t, S))) };
  };
  let aire = 'M0 1000L0 0';
  for (let i = 1; i <= 200; i++) aire += `L${X(i / 200)} ${Y(lire(i / 200).avec)}`;
  return {
    sans: DEPART.map(S => cheminSans(S)),
    avec: progs.map(p => cheminAvec(p)),
    lite: lites.map(p => cheminAvec(p, JUSTE_LITE)),
    aire: aire + 'L1000 1000Z',
    revisions: progs.flatMap(p => p.slice(1).map(d => versX(d.debut))).sort((a, b) => a - b),
    lire
  };
}

/* « 3 mois », « 2 semaines » : le temps sous la tête de lecture. */
export function duree(t) {
  if (t < 0.5) return 'Aujourd’hui';
  if (t < 10) { const j = Math.round(t); return j + (j > 1 ? ' jours' : ' jour'); }
  if (t < 52) { const s = Math.round(t / 7); return s + (s > 1 ? ' semaines' : ' semaine'); }
  if (t < 350) return Math.round(t / 30.4) + ' mois';
  return '1 an';
}
