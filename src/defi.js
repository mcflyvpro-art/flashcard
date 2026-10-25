/* Les règles d'un défi (2026-10-24) — module pur, sans aucune dépendance à
   l'écran ni au réseau, testé dans test/defi.test.js.

   Un défi se joue sur un livre, de deux façons : EN DIRECT (une salle à code
   à 6 chiffres, l'hôte fait défiler les questions, la base compte les points
   — voir la migration 20261024232855) ou À SON RYTHME (les `duels` : les
   mêmes questions pour tous, un essai chacun). Ici : fabriquer les questions
   depuis les pages d'un livre, lire un code, et tout ce que l'écran déduit de
   l'état d'une salle (chrono, phase, podium) sans jamais calculer un score —
   le score est l'affaire de la base, pour qu'aucun téléphone ne puisse le
   gonfler. */
import { norm } from './normaliser.js';

export const JEUX = {
  qcm: { nom: 'QCM', aide: 'Quatre réponses, une seule bonne' },
  vf: { nom: 'Vrai ou faux', aide: 'Une réponse proposée : juste ou pas ?' },
  ecrit: { nom: 'Réponse écrite', aide: 'On tape la réponse, accents pardonnés' }
};

export const DUREES = [10, 20, 30, 45];
export const NOMBRES = [5, 10, 15, 20];

// les bornes de la base : au-delà, salle_ouvrir refuse la salle entière
const MAX_ENONCE = 400, MAX_CHOIX = 200;

const coupe = (s, n) => {
  const t = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t;
};

/* La clé d'une réponse écrite : la forme normalisée, sans accents ni
   ponctuation. La base compare des clés, et l'app de l'hôte comme celle du
   joueur les calculent ici, avec la même fonction : « Élève » et « eleve »
   tombent juste, sans que la base ait à connaître les accents. */
export const cleReponse = s => norm(s).normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^\p{L}\p{N} ]+/gu, ' ').replace(/\s+/g, ' ').trim();

/* Les réponses admises pour une page : la réponse entière, et chacune de
   ses parties quand elle en énumère plusieurs (« chat, matou »). */
export function reponsesAdmises(b) {
  const k = cleReponse(b);
  const parts = norm(b).split(/\s*[,;/·|]+\s*/).map(cleReponse).filter(Boolean);
  return [...new Set([k, ...(parts.length > 1 ? parts : [])])].filter(Boolean).slice(0, 10)
    .filter(x => x.length <= MAX_CHOIX);
}

function melanger(t, alea) {
  const a = t.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(alea() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* Les pages jouables : un recto et un verso non vides, une fois le texte mis
   à plat par l'appelant (images et formules sont rendues par l'écran, pas
   par une salle à 30 joueurs). */
export const pagesJouables = cartes => (cartes || [])
  .map(c => ({ f: coupe(c.f, MAX_ENONCE), b: coupe(c.b, MAX_CHOIX) }))
  .filter(c => c.f && c.b);

/* Combien de réponses DIFFÉRENTES un livre offre : il en faut 2 pour un vrai
   ou faux, 2 pour un QCM (qui en montre alors autant qu'il peut, 4 au plus). */
export const reponsesDistinctes = pages => new Set(pages.map(c => cleReponse(c.b))).size;

export function jouable(cartes, jeu) {
  const p = pagesJouables(cartes);
  if (!p.length) return false;
  return jeu === 'ecrit' ? true : reponsesDistinctes(p) >= 2;
}

/* Les questions d'une salle, au format attendu par salle_ouvrir :
   { e: énoncé, c: [choix], b: rang du bon choix, a: [clés admises], r: réponse }. */
export function fabriquerQuestions(cartes, jeu, n, alea = Math.random) {
  const pages = pagesJouables(cartes);
  const tirees = melanger(pages, alea).slice(0, Math.max(1, Math.min(n || 10, 50)));
  const autres = c => {
    const k = cleReponse(c.b), vus = new Set([k]), l = [];
    for (const x of melanger(pages, alea)) {
      const kx = cleReponse(x.b);
      if (!vus.has(kx)) { vus.add(kx); l.push(x.b); }
    }
    return l;
  };
  return tirees.map(c => {
    if (jeu === 'ecrit') return { e: c.f, a: reponsesAdmises(c.b), r: c.b };
    if (jeu === 'vf') {
      const faux = autres(c);
      const vrai = !faux.length || alea() < 0.5;
      return { e: c.f, c: [vrai ? c.b : faux[0]], b: vrai ? 0 : 1, r: c.b };
    }
    const choix = melanger([c.b, ...autres(c).slice(0, 3)], alea);
    return { e: c.f, c: choix, b: choix.indexOf(c.b), r: c.b };
  }).filter(q => jeu !== 'ecrit' || q.a.length);
}

/* ---------- le code d'une salle ---------- */
export const pinDepuisTexte = s => {
  const m = String(s || '').match(/[?&]defi=([0-9 ]+)/);
  return String(m ? m[1] : s || '').replace(/\D/g, '').slice(0, 6);
};
export const pinComplet = s => /^\d{6}$/.test(pinDepuisTexte(s));
export const pinLisible = s => { const p = pinDepuisTexte(s); return p.length > 3 ? p.slice(0, 3) + ' ' + p.slice(3) : p; };

export function lienDefi(adresse, pin) {
  const u = new URL(adresse);
  u.search = ''; u.hash = '';
  u.searchParams.set('defi', pinDepuisTexte(pin));
  return u.toString();
}

/* Ce que salle_rejoindre peut répondre, dit pour un élève. */
export const STATUTS_SALLE = {
  ok: null,
  hote: null,
  format: 'Le code d’une salle a 6 chiffres.',
  inconnu: 'Aucune salle ouverte avec ce code.',
  trop: 'Trop de codes faux : attends quelques minutes.',
  classe: 'Cette salle est réservée à une classe.',
  club: 'Cette salle est réservée aux membres d’un club.',
  exclu: 'L’hôte t’a retiré de cette salle.',
  pleine: 'Cette salle est pleine.'
};
export const messageSalle = statut => STATUTS_SALLE[statut] === undefined
  ? 'Impossible d’entrer pour l’instant.' : STATUTS_SALLE[statut];

/* ---------- le temps ----------
   La base dit l'heure (`maintenant`) à chaque réponse : l'écart avec
   l'horloge du téléphone corrige un appareil en avance ou en retard, pour
   que tous les chronos d'une salle tombent à zéro ensemble. */
export const decalage = (maintenantServeur, recuLocal) =>
  maintenantServeur ? Date.parse(maintenantServeur) - recuLocal : 0;

export function phase(etat, tLocal, dec) {
  if (!etat) return 'absent';
  if (etat.etat !== 'question') return etat.etat;
  const t = tLocal + (dec || 0);
  return t < Date.parse(etat.debut) ? 'lecture' : 'reponse';
}

// millisecondes restantes avant la lecture (phase « lecture ») ou la fin de la question
export function restant(etat, tLocal, dec) {
  if (!etat || etat.etat !== 'question') return 0;
  const t = tLocal + (dec || 0);
  const debut = Date.parse(etat.debut), fin = Date.parse(etat.fin);
  return Math.max(0, (t < debut ? debut : fin) - t);
}

// part du temps de réponse déjà écoulée, de 0 à 1 (la barre qui se vide)
export function ecoule(etat, tLocal, dec) {
  if (!etat || etat.etat !== 'question') return 0;
  const t = tLocal + (dec || 0);
  const debut = Date.parse(etat.debut), fin = Date.parse(etat.fin);
  if (t <= debut) return 0;
  return Math.min(1, (t - debut) / Math.max(1, fin - debut));
}

/* ---------- le classement ----------
   Deux joueurs à égalité partagent la même place (1er, 1er, 3e). */
export function places(rows, cle = 'score') {
  let prec = null, place = 0;
  return (rows || []).map((r, i) => {
    if (prec === null || r[cle] !== prec) { place = i + 1; prec = r[cle]; }
    return { ...r, place };
  });
}

export const placeTexte = p => p === 1 ? '1er' : p + 'e';

export const podium = top => places(top).filter(r => r.place <= 3).slice(0, 3);

/* Ce qui, dans l'état d'une salle, oblige à redessiner l'écran. Le reste
   (les secondes qui passent) ne touche qu'au chrono : redessiner chaque
   seconde ferait perdre la saisie d'une réponse écrite. */
export const signature = e => !e ? '' : [
  e.etat, e.rang, e.joueurs, e.repondu, (e.liste || []).length,
  e.moi ? [e.moi.repondu, e.moi.score].join(':') : '',
  e.question ? (e.question.choix || []).length : '',
  e.correction ? 'c' : ''
].join('|');
