/* Retoucher un paquet entier par l'IA (2026-11-07) — module pur, sans
   dépendance à l'écran ni au réseau, testé dans test/retouche.test.js.

   Demandé : « pouvoir éditer un paquet directement avec l'IA, par prompt ;
   que pour Mirandola+ et Infini (pareil limité) ». On envoie à l'IA le recto
   et le verso de chaque carte (op « prompt » de la fonction ai, une
   génération du mois), elle rend la liste entière, retouchée. Ici, on la
   remet dans le paquet SANS rien perdre de ce que l'IA ne voit pas : une
   carte que l'IA a gardée, ou seulement corrigée, reste la même carte — son
   identifiant, son état d'apprentissage (FSRS), ses images et ses sons, sa
   suspension. Seules les cartes vraiment neuves partent de zéro, et seules
   celles que l'IA a retirées s'en vont.

   L'appariement, du plus sûr au moins sûr :
   1. le même recto et le même verso (à la casse et aux accents près) : la
      carte est gardée, telle quelle si rien n'a bougé ;
   2. le même recto : son verso a été retouché (on garde l'état) ;
   3. le même verso : son recto a été retouché ;
   4. une carte proche (Dice sur les paires de lettres ≥ PROCHE) : une
      reformulation, l'état est gardé ;
   le reste rendu est neuf, le reste d'avant est retiré. L'ordre est celui
   que l'IA rend (« range par chapitre » doit pouvoir réordonner). */
import { norm } from './normaliser.js';

/* Ce que la fonction ai accepte en une fois (MAX_CARDS et INFINI.cartes de
   supabase/functions/ai/index.ts — test/retouche.test.js garde les deux
   d'accord) : au-delà, elle refuserait la liste entière. */
export const MAX_RETOUCHE = { plus: 120, infini: 300 };
export const PROCHE = 0.55;

export const maxRetouche = niveau => (niveau === 'infini' ? MAX_RETOUCHE.infini : MAX_RETOUCHE.plus);

/* Peut-on retoucher ce paquet ? Un devoir donné par un professeur, non :
   chaque carte y compte pour l'avancement (cartes « a:… ») ; trop de
   cartes pour la fonction, non plus (on le dit, avec la limite). */
export function retouchable(cartes, niveau) {
  const l = cartes || [];
  if (l.some(c => String(c.id).startsWith('a:'))) return { ok: false, raison: 'devoir' };
  const max = maxRetouche(niveau);
  if (l.length > max) return { ok: false, raison: 'trop', max };
  return { ok: true };
}

// ce qui part vers l'IA : le texte seul (les médias restent ici)
export const pourIA = cartes => (cartes || []).map(c => ({ f: String(c.f || ''), b: String(c.b || '') }));

const cle = s => norm(String(s || '')).normalize('NFD').replace(/[̀-ͯ]/g, '');

function paires(s) {
  const t = cle(s).replace(/\s+/g, ' ');
  const m = new Map();
  for (let i = 0; i < t.length - 1; i++) { const p = t.slice(i, i + 2); m.set(p, (m.get(p) || 0) + 1); }
  return { m, n: Math.max(0, t.length - 1) };
}

// Dice sur les paires de lettres : 1 pour deux textes égaux, 0 sans rien de commun
export function ressemblance(a, b) {
  const x = paires(a), y = paires(b);
  if (!x.n && !y.n) return 1;
  if (!x.n || !y.n) return 0;
  let commun = 0;
  for (const [p, n] of x.m) commun += Math.min(n, y.m.get(p) || 0);
  return (2 * commun) / (x.n + y.n);
}

/* anciennes : les cartes du paquet ; rendues : [{ f, b }] de l'IA ;
   nouvelId : fabrique un identifiant pour une carte neuve.
   → { cartes, bilan: { gardees, modifiees, ajoutees, retirees } } */
export function appliquer(anciennes, rendues, nouvelId) {
  const vieilles = (anciennes || []).map((c, i) => ({ c, i, f: cle(c.f), b: cle(c.b), prise: false }));
  const neuves = (rendues || []).map(r => ({ f: String(r.f || '').trim(), b: String(r.b || '').trim() }))
    .filter(r => r.f || r.b);
  const choix = new Array(neuves.length).fill(null);
  const bilan = { gardees: 0, modifiees: 0, ajoutees: 0, retirees: 0 };

  const passe = test => neuves.forEach((r, k) => {
    if (choix[k]) return;
    const kf = cle(r.f), kb = cle(r.b);
    const v = vieilles.find(x => !x.prise && test(x, kf, kb));
    if (v) { v.prise = true; choix[k] = { v }; }
  });
  passe((x, kf, kb) => x.f === kf && x.b === kb);
  passe((x, kf) => !!kf && x.f === kf);
  passe((x, kf, kb) => !!kb && x.b === kb);

  // une reformulation : la plus proche d'abord, jamais deux fois la même carte
  const proches = [];
  neuves.forEach((r, k) => {
    if (choix[k]) return;
    for (const v of vieilles) {
      if (v.prise) continue;
      const s = (ressemblance(r.f, v.c.f) + ressemblance(r.b, v.c.b)) / 2;
      if (s >= PROCHE) proches.push({ k, v, s });
    }
  });
  proches.sort((a, b) => b.s - a.s);
  for (const p of proches) {
    if (choix[p.k] || p.v.prise) continue;
    p.v.prise = true; choix[p.k] = { v: p.v };
  }

  /* une carte appariée prend toujours le texte rendu : appariée à la casse
     ou aux accents près, elle doit pouvoir passer en majuscules si on le demande */
  const cartes = neuves.map((r, k) => {
    const ch = choix[k];
    if (!ch) { bilan.ajoutees++; return { f: r.f, b: r.b, id: nouvelId() }; }
    const meme = ch.v.c.f === r.f && ch.v.c.b === r.b;
    if (meme) bilan.gardees++; else bilan.modifiees++;
    return meme ? ch.v.c : { ...ch.v.c, f: r.f, b: r.b };
  });
  bilan.retirees = vieilles.filter(v => !v.prise).length;
  return { cartes, bilan };
}

const accord = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;
export function bilanTexte(b) {
  const l = [];
  if (b.modifiees) l.push(accord(b.modifiees, 'modifiée'));
  if (b.ajoutees) l.push(accord(b.ajoutees, 'ajoutée'));
  if (b.retirees) l.push(accord(b.retirees, 'retirée'));
  return l.length ? l.join(' · ') : 'Rien n’a changé';
}

export const aChange = b => !!(b.modifiees || b.ajoutees || b.retirees);
