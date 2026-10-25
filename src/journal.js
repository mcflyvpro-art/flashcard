/* ══════════ le journal de lecture : les règles ══════════
   Deux questions différentes, deux sources différentes, jamais mélangées :

   · CE QUE TU AS FAIT (l'activité) se lit dans le journal des révisions.
     Chaque révision y est écrite une fois, avec son contexte du moment —
     matière, livre, écart depuis la lecture précédente (migration
     20261025170855). Supprimer, fusionner, scinder, renommer un livre ou
     changer sa matière ne réécrit donc jamais le passé : trois heures de
     droit restent trois heures de droit, même si le livre s'appelle
     aujourd'hui autrement, a changé de matière ou n'existe plus.

   · CE QUE TU SAIS (la mémoire) se lit sur les cartes telles qu'elles sont
     aujourd'hui : leur état FSRS voyage avec elles (une fusion les copie
     avec tout leur état), une carte supprimée n'est plus sue, une carte
     recréée repart de zéro, un livre qui change de matière y emporte ce
     qu'on en sait.

   Une matière se reconnaît à son NOM, pas à son identifiant : l'identifiant
   n'a de sens que chez son propriétaire (un devoir, un partage, un envoi
   arrivent d'un autre compte). Deux matières qui portent le même nom, à la
   casse et aux accents près, n'en font qu'une dans le journal.

   Pur, sans DOM ni réseau : testé dans test/journal.test.js. Les jours sont
   des chaînes « AAAA-MM-JJ » dans le fuseau de l'appareil — la base compte
   dans le même fuseau (journal(p_tz)) —, jamais des millisecondes : un
   changement d'heure ne fait ni sauter ni doubler un jour. */
import { DAY, fsrsR } from './fsrs.js';
import { norm } from './normaliser.js';

/* Les paliers d'écart (en jours) entre deux lectures d'une même page. La
   base range chaque révision avec width_bucket(ecart, PALIERS) : la règle
   reste ici, elle ne fait que compter. -1 : la toute première lecture ;
   0 : relue le jour même (on apprend encore) ; 1 : 1–2 jours ; 2 : 3–13 ;
   3 : 14–89 ; 4 : 90 et plus. */
export const PALIERS = [1, 3, 14, 90];
export const NOMS_PALIERS = ['1–2 j', '3–13 j', '2–12 sem.', '3 mois +'];

export function palier(ecart) {
  if (ecart == null || !(ecart >= 0)) return -1;
  let i = 0;
  while (i < PALIERS.length && ecart >= PALIERS[i]) i++;
  return i;
}

/* ---------- les jours ---------- */
const deux = n => String(n).padStart(2, '0');
export const jourDe = t => { const d = new Date(t); return `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`; };
export const heureDe = t => new Date(t).getHours();
export function decaler(jour, k) {
  const [y, m, d] = jour.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + k));
  return `${t.getUTCFullYear()}-${deux(t.getUTCMonth() + 1)}-${deux(t.getUTCDate())}`;
}
export const ecartJours = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / DAY);
// 0 = lundi … 6 = dimanche
export const jourSemaine = jour => (new Date(jour + 'T00:00:00Z').getUTCDay() + 6) % 7;

/* ---------- réunir ce que dit la base et ce que l'appareil sait déjà ----------
   La base rend des comptes regroupés ; l'appareil garde les révisions qu'il
   a faites sans les avoir vues revenir (`locaux`). La réponse dit lesquelles
   la base a déjà (`connus`, même photographie que les comptes) : celles-là
   sortent des locaux, les autres s'ajoutent. Ni oubli, ni double compte,
   que la révision soit partie avant, pendant ou après la lecture. */
export function ligneLocale(r) {
  return { j: jourDe(r.created_at), s: r.subject || '', d: r.deck_id || '', p: palier(r.ecart),
           n: 1, ok: r.correct ? 1 : 0, ms: Math.max(0, +r.ms || 0), h: heureDe(r.created_at) };
}

export function restantsApres(locaux, connus) {
  const k = new Set(connus || []);
  return (locaux || []).filter(r => !k.has(r.client_id));
}

export function rassembler(rep, locaux) {
  const r = rep || {};
  const lignes = (r.jours || []).map(([j, s, d, p, n, ok, ms]) =>
    ({ j: String(j), s: s || '', d: d || '', p: +p, n: +n || 0, ok: +ok || 0, ms: +ms || 0 }));
  const heures = (r.heures || []).map(([j, h, n]) => ({ j: String(j), h: +h, n: +n || 0 }));
  const loc = restantsApres(locaux, r.connus).map(ligneLocale);
  for (const l of loc) { lignes.push(l); heures.push({ j: l.j, h: l.h, n: 1 }); }
  const t = r.toujours || {};
  const toujours = { n: (+t.n || 0) + loc.length, ok: (+t.ok || 0) + loc.reduce((a, l) => a + l.ok, 0),
                     ms: (+t.ms || 0) + loc.reduce((a, l) => a + l.ms, 0), depuis: t.depuis || null };
  return { lignes, heures, toujours, matieres: r.matieres || {}, livres: r.livres || {} };
}

/* ---------- la série ----------
   Un jour de grâce par semaine entamée : un week-end chez les grands-parents
   n'efface pas trois mois d'assiduité. La journée en cours peut n'avoir pas
   encore commencé : la série court jusqu'à hier. */
export function serie(jours, aujourdhui) {
  let n = 0, grace = 0, k = jours.has(aujourdhui) ? aujourdhui : decaler(aujourdhui, -1);
  for (let garde = 0; garde < 4000; garde++, k = decaler(k, -1)) {
    if (jours.has(k)) { n++; continue; }
    if (grace < Math.floor(n / 7) + (n ? 1 : 0)) { grace++; continue; }
    break;
  }
  return n;
}

/* ---------- l'activité d'une période ----------
   `depuis` : premier jour compris (null = tout ce que la base a rendu) ;
   `jusqua` : premier jour exclu (null = jusqu'à aujourd'hui). La série et
   le record se comptent toujours sur tout l'historique rendu. */
const vide = () => ({ n: 0, ok: 0, ms: 0 });
const ajoute = (m, k, l) => { const v = m.get(k) || vide(); v.n += l.n; v.ok += l.ok; v.ms += l.ms; m.set(k, v); return v; };

export function activite(J, { depuis = null, jusqua = null, aujourdhui }) {
  const dedans = l => (!depuis || l.j >= depuis) && (!jusqua || l.j < jusqua);
  const tous = new Map(), jours = new Map(), mat = new Map(), livres = new Map();
  const mem = [0, 0, 0, 0].map(() => [0, 0]);
  let n = 0, ok = 0, ms = 0, decouvertes = 0, repetees = 0;
  for (const l of J.lignes) {
    ajoute(tous, l.j, l);
    if (!dedans(l)) continue;
    n += l.n; ok += l.ok; ms += l.ms;
    ajoute(jours, l.j, l);
    ajoute(mat, l.s, l);
    const lv = ajoute(livres, l.d, l); lv.s = l.s;
    if (l.p < 0) decouvertes += l.n;
    else if (l.p === 0) repetees += l.n;
    else { mem[l.p - 1][0] += l.ok; mem[l.p - 1][1] += l.n; }
  }
  const heures = Array(24).fill(0);
  for (const h of J.heures) if (dedans(h)) heures[h.h] = (heures[h.h] || 0) + h.n;
  const actifs = jours.size;
  const record = [...tous.entries()].reduce((b, [j, v]) => v.n > b.n ? { j, n: v.n } : b, { j: null, n: 0 });
  const rappel = mem.reduce((a, [o, t]) => [a[0] + o, a[1] + t], [0, 0]);
  return {
    n, ok, ms, decouvertes, repetees, jours, matieres: mat, livres, heures,
    justesse: n ? ok / n : null,
    rappel: rappel[1] ? rappel[0] / rappel[1] : null,            // réussite sur les pages revues après au moins un jour
    paliers: mem.map(([o, t], i) => ({ nom: NOMS_PALIERS[i], ok: o, n: t, pct: t ? o / t : null })),
    actifs, parJourActif: actifs ? n / actifs : 0, msParPage: n ? ms / n : 0,
    serie: serie(tous, aujourdhui), record,
    heure: heures.some(Boolean) ? heures.indexOf(Math.max(...heures)) : null
  };
}

/* L'écart avec la période précédente, en proportion : rien à comparer
   quand la précédente était vide (un « +∞ % » n'apprend rien). */
export const evolution = (maintenant, avant) => avant > 0 ? (maintenant - avant) / avant : null;

/* Le rythme d'une période : un bâton par jour sur 7 ou 30 jours, un par
   semaine (du lundi au dimanche, la dernière finissant aujourd'hui) sur
   une année. */
export function rythme(jours, aujourdhui, periode) {
  const lire = j => jours.get(j) || vide();
  if (periode <= 31) {
    return Array.from({ length: periode }, (_, i) => {
      const j = decaler(aujourdhui, i - periode + 1), v = lire(j);
      return { j, n: v.n, ms: v.ms };
    });
  }
  const debut = decaler(aujourdhui, -jourSemaine(aujourdhui) - 51 * 7);
  return Array.from({ length: 52 }, (_, s) => {
    const j = decaler(debut, s * 7);
    let n = 0, ms = 0;
    for (let k = 0; k < 7; k++) { const v = lire(decaler(j, k)); n += v.n; ms += v.ms; }
    return { j, n, ms };
  });
}

/* ---------- les matières du journal ----------
   Un identifiant encore connu prend le nom et la couleur d'aujourd'hui (une
   matière renommée reste la même matière) ; un identifiant disparu garde
   le nom qu'il avait au moment des révisions, sans couleur. Puis tout ce
   qui porte le même nom se rassemble. */
export const cleNom = s => norm(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');

export function nommerMatieres(parCle, subjects, nomsDuJournal) {
  const out = new Map();
  for (const [cle, v] of parCle) {
    const sj = cle ? (subjects || []).find(x => x.id === cle) : null;
    const nom = !cle ? 'Sans matière' : sj ? sj.name : ((nomsDuJournal || {})[cle] || cle);
    const k = cle ? 'n:' + cleNom(nom) : '';
    const g = out.get(k) || { cle: sj ? sj.id : cle, nom, couleur: sj ? sj.color : null, actuelle: !!sj, n: 0, ok: 0, ms: 0 };
    if (sj && !g.actuelle) Object.assign(g, { cle: sj.id, nom: sj.name, couleur: sj.color, actuelle: true });
    g.n += v.n; g.ok += v.ok; g.ms += v.ms;
    out.set(k, g);
  }
  return [...out.values()].sort((a, b) => b.ms - a.ms || b.n - a.n);
}

/* Les livres de la période : celui qui existe encore porte son nom actuel,
   un livre supprimé ou fusionné garde celui qu'il avait. */
export function nommerLivres(parLivre, decks, nomsDuJournal) {
  return [...parLivre.entries()].map(([id, v]) => {
    const d = (decks || []).find(x => x.id === id);
    return { id, nom: d ? d.name : ((nomsDuJournal || {})[id] || 'Livre supprimé'), existe: !!d,
             n: v.n, ok: v.ok, ms: v.ms };
  }).sort((a, b) => b.ms - a.ms || b.n - a.n);
}

/* ---------- la grille de l'année ----------
   Des colonnes de sept jours, du lundi au dimanche, la dernière finissant
   aujourd'hui. Cinq niveaux, relatifs au meilleur jour affiché : un petit
   jour et un grand jour ne doivent pas se ressembler. */
export function grille(jours, aujourdhui, semaines) {
  const fin = aujourdhui, debut = decaler(fin, -(jourSemaine(fin) + 7 * (semaines - 1)));
  let max = 0;
  for (let k = debut; k <= fin; k = decaler(k, 1)) max = Math.max(max, (jours.get(k) || vide()).n);
  const cols = [];
  for (let k = debut; k <= fin; k = decaler(k, 1)) {
    if (jourSemaine(k) === 0) cols.push([]);
    const n = (jours.get(k) || vide()).n;
    cols[cols.length - 1].push({ j: k, n, niveau: !n ? 0 : n >= max * .75 ? 4 : n >= max * .5 ? 3 : n >= max * .25 ? 2 : 1 });
  }
  return cols;
}

/* ---------- ce que tu sais : les cartes d'aujourd'hui ---------- */
export const etatCarte = c => {
  if (c.x) return 'susp';
  if (!c.n && !c.S) return 'new';
  if (c.st === 1 || c.st === 3 || !c.i || c.i < 1) return 'learn';
  return c.i < 21 ? 'young' : 'mature';
};

const compteEtats = () => ({ new: 0, learn: 0, young: 0, mature: 0, susp: 0 });

/* La part de pages sues (mûres) parmi les pages qu'on lit — celles mises de
   côté ne comptent ni pour ni contre. */
export const maitrise = k => { const t = k.new + k.learn + k.young + k.mature; return t ? k.mature / t : 0; };

/* Une carte, comptée dans son livre : son âge, sa part du rappel estimé
   (FSRS, à l'instant), et le jour où elle revient — aujourd'hui pour tout
   ce qui est déjà en retard. */
function compterCarte(c, k, x) {
  const e = etatCarte(c);
  k[e]++; x.total[e]++;
  if (e === 'susp') return;
  if (c.S > 0 && c.lr) { x.somR += fsrsR(x.w, Math.max(0, (x.maintenant - c.lr) / DAY), c); x.nR++; }
  if (e === 'new' || !c.d) return;
  const i = c.d <= x.fin ? 0 : Math.ceil((c.d - x.fin) / DAY);
  if (i < x.aRevoir.length) x.aRevoir[i]++;
}

export function savoir(decks, { maintenant, w, jours = 7 }) {
  const fin = new Date(maintenant); fin.setHours(23, 59, 59, 999);
  const x = { total: compteEtats(), aRevoir: Array(jours).fill(0), somR: 0, nR: 0, w, maintenant, fin: +fin };
  const parMatiere = new Map(), parLivre = [];
  for (const d of decks || []) {
    const k = compteEtats();
    for (const c of d.cards || []) compterCarte(c, k, x);
    parLivre.push({ id: d.id, nom: d.name, s: d.subject || '', k, n: (d.cards || []).length, pct: maitrise(k) });
    const m = parMatiere.get(d.subject || '') || compteEtats();
    for (const e of Object.keys(k)) m[e] += k[e];
    parMatiere.set(d.subject || '', m);
  }
  return { total: x.total, parMatiere, parLivre: parLivre.sort((a, b) => b.pct - a.pct || b.n - a.n),
           retenue: x.nR ? x.somR / x.nR : null, aRevoir: x.aRevoir, pct: maitrise(x.total) };
}

/* Les pages qui résistent : celles qu'on a le plus souvent oubliées, puis
   les plus difficiles. Des cartes qui existent — on peut agir dessus. */
export function resistantes(decks, n = 8) {
  const l = [];
  for (const d of decks || []) for (const c of d.cards || []) {
    if (!c.x && (c.l || 0) >= 1) l.push({ c, d, l: c.l || 0, D: c.D || 0 });
  }
  return l.sort((a, b) => b.l - a.l || b.D - a.D).slice(0, n);
}
