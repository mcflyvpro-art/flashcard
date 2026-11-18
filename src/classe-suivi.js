/* ══════════ le suivi d'une classe ══════════
   Ce que décident l'espace professeur et la console du référent, sans DOM
   ni réseau (règle 1 de CLAUDE.md) : une liste d'élèves collée, des comptes
   ouverts d'un coup, les inscriptions d'une classe, l'état d'un élève,
   l'ordre et les filtres d'une liste, les chiffres d'une synthèse, ce qui
   demande un geste, le calendrier des devoirs. Sorti de src/classe.js le
   2026-11-18 : un élève ne le télécharge plus au démarrage. Les mêmes
   règles de dates (src/classe.js) : jamais `new Date('AAAA-MM-JJ')`, une date
   locale à midi. test/classe.test.js le vérifie. */

import { norm } from './normaliser.js';
import { auJour, echeance, espaces, iso, nomPropre, nomValide } from './classe.js';

/* ---------- une liste d'élèves collée ---------- */
const cleNom = s => espaces(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/* Un mot tout en capitales (deux lettres au moins) : c'est le nom de
   famille, comme l'écrivent Pronote et les listes d'appel. */
const enCapitales = w => /\p{L}.*\p{L}/u.test(w) && w === w.toUpperCase() && w !== w.toLowerCase();

function decoupeColonnes(cols) {
  const [a, b] = cols;
  if (enCapitales(b) && !enCapitales(a)) return { prenom: a, nom: b };
  return { prenom: b, nom: a };                  // « Nom ; Prénom », l'ordre des exports scolaires
}

function decoupeMots(mots) {
  const caps = mots.filter(enCapitales), autres = mots.filter(w => !enCapitales(w));
  if (caps.length && autres.length) return { prenom: autres.join(' '), nom: caps.join(' ') };
  return { prenom: mots.slice(0, -1).join(' '), nom: mots[mots.length - 1] };
}

const ENTETE = /^(nom|prénom|prenom|élève|eleve|élèves|eleves)\b/i;

const lisible = e => !!e && nomValide(e.prenom) && nomValide(e.nom);

/* Une ligne : deux colonnes « nom / prénom », ou un nom complet dans la
   première colonne (« MARTIN Alice ; 2nde 4 » : la suite est ignorée). */
function lireLigne(l) {
  const cols = l.split(/\t|;|,/).map(espaces).filter(Boolean);
  if (cols.length >= 2) {
    const e = decoupeColonnes(cols);
    if (lisible(e)) return e;
  }
  const mots = espaces(cols[0] || l).split(' ');
  const e = mots.length >= 2 ? decoupeMots(mots) : null;
  return lisible(e) ? e : null;
}

/* Une liste collée depuis Pronote, un tableur ou un traitement de texte :
   « MARTIN Alice », « Alice Martin », « Martin;Alice », « Martin<tab>Alice ».
   Rend les élèves reconnus (doublons retirés, 60 au plus) et les lignes
   qu'on n'a pas su lire, pour que le professeur les voie plutôt que de les
   perdre. */
export function lireListeEleves(texte, max = 60) {
  const eleves = [], ignorees = [], vus = new Set();
  for (const brute of String(texte || '').split(/\r?\n/)) {
    const l = brute.trim();
    if (!l || (ENTETE.test(l) && /nom/i.test(l))) continue;
    const e = lireLigne(l);
    if (!e) { ignorees.push(l); continue; }
    const k = cleNom(nomPropre(e.prenom, e.nom));
    if (vus.has(k)) continue;
    vus.add(k);
    eleves.push({ prenom: espaces(e.prenom), nom: espaces(e.nom), complet: nomPropre(e.prenom, e.nom) });
  }
  return { eleves: eleves.slice(0, max), ignorees, trop: Math.max(0, eleves.length - max) };
}

/* ---------- des comptes ouverts d'un coup (2026-10-29) ----------
   Le référent ouvre les comptes de ses élèves : une ligne par élève, telle
   qu'elle sort d'un tableur ou de Pronote — son nom et son adresse e-mail,
   dans n'importe quel ordre, séparés par une tabulation, un point-virgule
   ou une virgule (« MARTIN Alice ; alice.martin@lycee.fr »). Le nom se lit
   comme dans une liste d'appel (lireLigne) ; une ligne sans adresse, ou au
   nom illisible, est rendue telle quelle pour qu'on la corrige. Une adresse
   déjà vue plus haut n'ouvre pas un second compte. */
const ADRESSE = /[^\s@;,<>"']+@[^\s@;,<>"']+\.[^\s@;,<>"']+/;

export function lireComptes(texte, max = 200) {
  const comptes = [], ignorees = [], vues = new Set();
  for (const brute of String(texte || '').split(/\r?\n/)) {
    const l = brute.trim();
    if (!l || (ENTETE.test(l) && /nom/i.test(l))) continue;
    const m = l.match(ADRESSE), email = m ? m[0].toLowerCase() : '', at = m && m.index || 0;
    const reste = m ? l.slice(0, at) + ';' + l.slice(at + m[0].length) : '';
    const e = email ? lireLigne(reste.split(/\t|;|,/).map(espaces).filter(Boolean).join(';')) : null;
    if (!e) { ignorees.push(l); continue; }
    if (vues.has(email)) continue;
    vues.add(email);
    comptes.push({ prenom: espaces(e.prenom), nom: espaces(e.nom), complet: nomPropre(e.prenom, e.nom), email });
  }
  return { comptes: comptes.slice(0, max), ignorees, trop: Math.max(0, comptes.length - max) };
}

/* Ce qu'on donne à chacun : une ligne de tableur (nom, adresse, mot de
   passe provisoire), pour un publipostage ou une impression. */
export const tableurComptes = l => ['Nom\tAdresse e-mail\tMot de passe provisoire',
  ...l.map(x => [x.complet, x.email, x.pw].join('\t'))].join('\n');

/* ---------- les inscriptions d'une classe, en un mot ---------- */
export function etatInscriptions(c, maintenant = Date.now()) {
  if (c.archivee) return { k: 'archive', t: 'Archivée', ouvert: false };
  if (!c.ouvert) return { k: 'ferme', t: 'Inscriptions fermées', ouvert: false };
  if (c.fin && Date.parse(c.fin) <= maintenant) return { k: 'expire', t: 'Code expiré', ouvert: false };
  if (c.places && c.effectif >= c.places) return { k: 'complet', t: 'Complète', ouvert: false };
  return { k: 'ouvert', t: c.validation ? 'Ouvertes, sur validation' : 'Ouvertes à tous', ouvert: true };
}

/* Les durées qu'on propose pour un code : le temps d'un cours, d'une
   journée, d'une semaine. En minutes, comme la base les reçoit. */
export const DUREES = [
  { min: 60, t: '1 heure', s: 'le temps du cours' },
  { min: 1440, t: '24 heures', s: '' },
  { min: 10080, t: '7 jours', s: '' },
  { min: 43200, t: '30 jours', s: '' },
  { min: 0, t: 'Sans limite', s: '' }
];

export function finTexte(fin, maintenant = Date.now()) {
  if (!fin) return 'sans limite de durée';
  const reste = Date.parse(fin) - maintenant;
  if (reste <= 0) return 'expiré';
  const min = Math.ceil(reste / 60000);
  if (min < 60) return `encore ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `encore ${h} h`;
  return `encore ${Math.round(h / 24)} jours`;
}

export function erreurPlaces(n, effectif) {
  if (!Number.isInteger(n) || n < 1 || n > 300) return 'Entre 1 et 300 places';
  if (n < effectif) return `La classe compte déjà ${effectif} élèves`;
  return '';
}

/* ---------- un élève ---------- */
export const pc = (a, b) => (b ? Math.round((a / b) * 100) : 0);

/* Un élève n'a qu'un état à la fois, et c'est le plus grave qui compte. */
export function etatEleve(m) {
  if (m.jamais) return { k: 'jamais', t: 'Jamais connecté', rang: 1 };
  if (m.retard) return { k: 'ko', t: m.retard > 1 ? `${m.retard} devoirs en retard` : '1 devoir en retard', rang: 0 };
  if (!m.donnes) return { k: 'neutre', t: 'Aucun devoir', rang: 4 };
  if (m.rendus >= m.donnes) return { k: 'ok', t: 'À jour', rang: 3 };
  return { k: 'am', t: `${m.donnes - m.rendus} en cours`, rang: 2 };
}

const parNom = (a, b) => String(a.who || '').localeCompare(String(b.who || ''), 'fr', { sensitivity: 'base' });

export const TRIS = {
  suivi: 'Qui décroche',
  nom: 'Nom',
  reussite: 'Réussite',
  activite: 'Activité',
  arrivee: 'Arrivée'
};

export function trierEleves(l, tri) {
  const c = (l || []).slice();
  const cmp = {
    nom: parNom,
    reussite: (a, b) => (b.pct || 0) - (a.pct || 0) || parNom(a, b),
    activite: (a, b) => (b.pages7 || 0) - (a.pages7 || 0) || parNom(a, b),
    arrivee: (a, b) => String(b.inscrit || '').localeCompare(String(a.inscrit || '')) || parNom(a, b),
    suivi: (a, b) => etatEleve(a).rang - etatEleve(b).rang || (b.retard || 0) - (a.retard || 0)
      || (a.pct || 0) - (b.pct || 0) || parNom(a, b)
  }[tri] || parNom;
  return c.sort(cmp);
}

export const FILTRES = { tous: 'Tous', ko: 'En retard', jamais: 'Jamais connectés', ok: 'À jour' };

/* Chercher « emile » doit trouver « Émile » : un professeur tape vite, sans
   accent. (`norm` les garde exprès — au quiz, « été » n'est pas « ete ».) */
const sansAccent = s => norm(s).normalize('NFD').replace(/[̀-ͯ]/g, '');

/* Un filtre retient tous les élèves qui ont ce qu'il dit, pas seulement ceux
   dont c'est l'état le plus grave : un élève jamais connecté qui a un devoir
   échu est aussi « en retard ». Sans cela, le tableau de bord annonçait
   « 2 élèves en retard » et « Voir » ouvrait un filtre vide (2026-10-26) —
   ils étaient rangés sous « Jamais connectés ». Les nombres de l'accueil
   (prof_classes) comptent de la même façon. */
export function correspond(m, filtre) {
  if (!filtre || filtre === 'tous') return true;
  if (filtre === 'ko') return (m.retard || 0) > 0;
  if (filtre === 'jamais') return !!m.jamais;
  return etatEleve(m).k === filtre;
}

export function filtrerEleves(l, q, filtre) {
  const v = sansAccent(q || '');
  return (l || []).filter(m => {
    if (!correspond(m, filtre)) return false;
    return !v || sansAccent(m.who || '').includes(v) || sansAccent(m.handle || '').includes(v);
  });
}

/* ---------- la synthèse d'une classe ----------
   Une moyenne cache toujours deux groupes : on donne aussi la répartition
   par tranches de vingt, et la liste de ceux à reprendre. */
export function syntheseClasse(r) {
  const l = r || [];
  const groupe = k => l.filter(m => etatEleve(m).k === k);
  const notes = l.filter(m => (m.pct || 0) > 0).map(m => m.pct);
  const tranches = [[0, 20], [20, 40], [40, 60], [60, 80], [80, 101]].map(([a, b]) => ({
    t: `${a}–${b > 100 ? 100 : b}`, n: notes.filter(x => x >= a && x < b).length
  }));
  return {
    n: l.length,
    paquets: [
      { k: 'ok', t: 'À jour', l: groupe('ok') },
      { k: 'am', t: 'En cours', l: groupe('am') },
      { k: 'ko', t: 'En retard', l: groupe('ko') },
      { k: 'jamais', t: 'Jamais connectés', l: groupe('jamais') }
    ].filter(p => p.l.length),
    tranches,
    notes: notes.length,
    moyenne: notes.length ? Math.round(notes.reduce((a, b) => a + b, 0) / notes.length) : 0,
    actifs: l.filter(m => (m.pages7 || 0) > 0).length,
    pages: l.reduce((a, m) => a + (m.pages7 || 0), 0),
    aReprendre: trierEleves(l.filter(m => m.jamais || m.retard || ((m.pct || 0) > 0 && m.pct < 45)), 'suivi')
  };
}

/* ---------- l'accueil du professeur ---------- */
export function syntheseAccueil(classes) {
  const l = (classes || []).filter(c => !c.archivee);
  const som = k => l.reduce((a, c) => a + (c[k] || 0), 0);
  return { classes: l.length, eleves: som('effectif'), attente: som('attente'), retard: som('retard'),
           jamais: som('jamais'), encours: som('encours'), actifs: som('actifs7') };
}

/* Ce qui demande un geste aujourd'hui, du plus pressant au moins pressant.
   Une demande d'inscription attend quelqu'un devant sa porte : elle passe
   avant tout le reste. */
export function aTraiter(classes) {
  const out = [];
  for (const c of (classes || []).filter(x => !x.archivee)) {
    if (c.attente) out.push({ k: 'attente', rang: 0, cid: c.id, n: c.attente, classe: c.name });
    if (c.retard) out.push({ k: 'retard', rang: 1, cid: c.id, n: c.retard, classe: c.name });
    if (c.jamais) out.push({ k: 'jamais', rang: 2, cid: c.id, n: c.jamais, classe: c.name });
    if (!c.effectif) out.push({ k: 'vide', rang: 3, cid: c.id, n: 0, classe: c.name });
    else if (!c.devoirs) out.push({ k: 'sansdevoir', rang: 4, cid: c.id, n: 0, classe: c.name });
  }
  return out.sort((a, b) => a.rang - b.rang || b.n - a.n || String(a.classe).localeCompare(String(b.classe), 'fr'));
}

export const dansJours = (n, depuis = new Date()) => {
  const d = new Date(depuis.getFullYear(), depuis.getMonth(), depuis.getDate() + n, 12);
  return iso(d);
};

export const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
export const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août',
  'septembre', 'octobre', 'novembre', 'décembre'];

export const jourLong = s => {
  const d = auJour(s);
  return d ? `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]}` : '';
};

/* ---------- un devoir ---------- */
export function etatDevoir(d, auj = iso(new Date())) {
  const eff = d.effectif || 0;
  const tard = !!d.due && d.due < auj && (d.rendu || 0) < eff;
  return { tard, pasOuvert: Math.max(0, eff - (d.ouvert || 0)), taux: pc(d.rendu || 0, eff),
           echeance: echeance(d.due, auj) };
}

/* Les devoirs d'un mois, rangés par jour d'échéance. */
export function parJour(devoirs) {
  const m = {};
  for (const d of devoirs || []) if (d.due) (m[d.due] = m[d.due] || []).push(d);
  return m;
}

/* La grille d'un mois : semaines du lundi au dimanche, cases vides avant
   le premier jour. */
export function grilleMois(annee, mois) {
  const decal = (new Date(annee, mois, 1, 12).getDay() + 6) % 7;
  const n = new Date(annee, mois + 1, 0, 12).getDate();
  const cases = new Array(decal).fill(null);
  for (let j = 1; j <= n; j++) cases.push(iso(new Date(annee, mois, j, 12)));
  return cases;
}
