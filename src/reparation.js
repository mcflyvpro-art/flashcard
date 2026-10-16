/* ══════════ réparation de bibliothèque ══════════
   src/invariants.js dit ce qu'est une carte saine (12 règles). Ce module
   dit comment en réparer une qui ne l'est pas — pour l'écran « Vérifier
   ma bibliothèque » (M04.T2). Les 12 règles se regroupent en 8 familles
   de réparation : plusieurs règles voisines (id/recto/verso, ou
   S/D/seconde-trace) partagent la même cause et le même geste de
   réparation, donc la même famille.

   Choix de réparation, pensés pour ne jamais aggraver une carte plutôt
   que pour deviner ce que l'utilisateur voulait :
   - contenu manquant (recto ou verso vide) → la carte est retirée : on
     ne peut pas fabriquer une réponse, la garder invalide n'aiderait
     personne. Un identifiant manquant, lui, se répare (aucune perte).
   - valeur hors bornes (état, S, D, F, palier, compteurs) → ramenée à
     la borne la plus proche, jamais à une valeur arbitraire.
   - mémoire incomplète (S sans D, ou l'inverse, ou une dernière révision
     sans mémoire) → complétée par la valeur la plus prudente (S_MIN,
     difficulté médiane), jamais effacée. Une fiche ratée dès sa première
     vue (n = 0 avec une mémoire) est saine : `n` compte les réussites.
   - fiche révisée sans mémoire (n > 0 mais S/D absents) → migrée avec
     le même pont SM-2 que `fsrsSeed()` (src/ui/carte-media.js), mais
     sans le cas particulier qui la laisse partiellement migrée : ici,
     la réparation doit garantir qu'aucune anomalie ne subsiste.

   Chaque fonction de réparation mute la carte reçue (comme le reste du
   noyau — `tapSelsus`, `fsrsSeed`...) et rend `true` si elle a dû agir.
   `now` et le générateur d'identifiant sont toujours fournis par
   l'appelant, jamais lus ici (même raison que `file.js` : un résultat
   reproductible en test). Pur : ni DOM, ni réseau, ni almanach. Testé
   dans test/reparation.test.js. */
import { DAY, D_MIN, D_MAX, MIN, S_MIN, S_MAX, cl, sm2State } from './fsrs.js';
import { CARD_INVARIANTS, cardIssues } from './invariants.js';

const absent = v => v == null;
const testFor = code => CARD_INVARIANTS.find(inv => inv.code === code).test;

export const ANOMALY_FAMILIES = [
  { code: 'structure', label: 'identifiant manquant, ou contenu manquant (carte retirée)' },
  { code: 'state', label: 'état d’apprentissage invalide' },
  { code: 'hors-bornes', label: 'stabilité, difficulté ou seconde trace hors des bornes du moteur' },
  { code: 'memoire-orpheline-revisee', label: 'fiche révisée sans mémoire calculée' },
  { code: 'memoire-incomplete', label: 'mémoire à moitié posée (stabilité sans difficulté…)' },
  { code: 'echeance-anterieure', label: 'échéance antérieure à la dernière révision' },
  { code: 'palier-incoherent', label: 'palier d’apprentissage incohérent avec l’état' },
  { code: 'compteurs', label: 'compteurs de révisions ou de rechutes invalides' }
];

const FAMILY_OF = {
  id: 'structure', front: 'structure', back: 'structure',
  state: 'state',
  stability: 'hors-bornes', difficulty: 'hors-bornes', trace: 'hors-bornes',
  'reviewed-has-memory': 'memoire-orpheline-revisee',
  'memory-complete': 'memoire-incomplete',
  'due-after-review': 'echeance-anterieure',
  'step-coherent': 'palier-incoherent',
  counts: 'compteurs'
};

/* Les familles en jeu sur une carte, sans rien y toucher — pour l'état
   des lieux affiché avant de proposer la réparation. */
export function scanCard(c) {
  return [...new Set(cardIssues(c).map(code => FAMILY_OF[code]))];
}

function repairStructure(c, makeId) {
  let fixed = false;
  if (!testFor('id')(c)) { c.id = makeId(); fixed = true; }
  const drop = !testFor('front')(c) || !testFor('back')(c);
  return { fixed: fixed || drop, drop };
}

function repairState(c) {
  if (testFor('state')(c)) return false;
  delete c.st; delete c.sp;             // absent = « neuve », le seul état qu'on puisse garantir
  return true;
}

function repairBounds(c) {
  let fixed = false;
  if (!testFor('stability')(c)) { c.S = cl(c.S, S_MIN, S_MAX); fixed = true; }
  if (!testFor('difficulty')(c)) { c.D = cl(c.D, D_MIN, D_MAX); fixed = true; }
  if (!testFor('trace')(c)) { c.F = cl(c.F, S_MIN, S_MAX); fixed = true; }
  return fixed;
}

/* Le même pont que fsrsSeed(), mais sans son cas partiel : ivl < 1 y
   laisse st/sp posés sans jamais fixer S/D (une fiche en apprentissage
   n'en a pas besoin dans l'usage courant) — une réparation, elle, doit
   garantir 0 anomalie restante, donc une mémoire minimale y est posée
   aussi. */
function repairReviewedMemory(c, w, now) {
  if (testFor('reviewed-has-memory')(c)) return false;
  const ivl = +c.i || 0;
  if (ivl >= 1) {
    const m = sm2State(w, 2.5, ivl, 0.9);
    c.S = m.S; c.D = m.D; c.F = m.S;
    c.st = 2; delete c.sp;
    c.lr = (c.d || now) - ivl * DAY;
  } else {
    c.S = S_MIN; c.D = 5; c.F = S_MIN;
    c.st = 1; c.sp = 0;
    c.lr = c.d ? c.d - 10 * MIN : now;
  }
  return true;
}

/* On complète plutôt qu'on efface : la moitié présente vient du moteur,
   l'autre reçoit la valeur la plus prudente (stabilité minimale = la
   fiche revient vite, difficulté médiane). */
function repairMemoryHalf(c, now) {
  if (testFor('memory-complete')(c)) return false;
  if (absent(c.S)) { c.S = S_MIN; if (absent(c.F)) c.F = S_MIN; }
  if (absent(c.D)) c.D = 5;
  if (absent(c.lr)) c.lr = Math.min(c.d || now, now);
  return true;
}

function repairDueOrder(c) {
  if (testFor('due-after-review')(c)) return false;
  c.d = c.lr;
  return true;
}

function repairStep(c) {
  if (testFor('step-coherent')(c)) return false;
  if (c.st === 1 || c.st === 3) c.sp = 0; else delete c.sp;
  return true;
}

function repairCounts(c) {
  if (testFor('counts')(c)) return false;
  c.n = Math.max(0, Math.round(c.n || 0));
  c.l = Math.max(0, Math.round(c.l || 0));
  return true;
}

/* Répare une carte en place. `cfg` : { w } — les poids FSRS du compte,
   pour que la mémoire reconstruite (famille memoire-orpheline-revisee)
   suive le même moteur que le reste de la bibliothèque. `makeId` (ex.
   `uid` de core/coeur-sync.js) et `now` sont injectés, jamais lus ici.
   Rend les familles réparées, et `drop: true` si la carte doit être
   retirée du paquet plutôt que gardée (contenu manquant). */
export function repairCard(c, cfg, makeId, now = Date.now()) {
  const families = [];
  const struct = repairStructure(c, makeId);
  if (struct.fixed) families.push('structure');
  if (struct.drop) return { drop: true, families };

  if (repairState(c)) families.push('state');
  if (repairBounds(c)) families.push('hors-bornes');
  if (repairReviewedMemory(c, cfg.w, now)) families.push('memoire-orpheline-revisee');
  if (repairMemoryHalf(c, now)) families.push('memoire-incomplete');
  if (repairDueOrder(c)) families.push('echeance-anterieure');
  if (repairStep(c)) families.push('palier-incoherent');
  if (repairCounts(c)) families.push('compteurs');
  return { drop: false, families };
}

const emptyTally = () => Object.fromEntries(ANOMALY_FAMILIES.map(f => [f.code, 0]));

/* État des lieux sur toute la bibliothèque (tous les paquets), sans rien
   modifier — pour afficher les compteurs avant de proposer de réparer. */
export function scanLibrary(decks) {
  const tally = emptyTally();
  let cards = 0;
  for (const d of decks) for (const c of d.cards) {
    const families = scanCard(c);
    if (families.length) cards++;
    for (const f of families) tally[f]++;
  }
  return { tally, cards };
}

/* Répare toute la bibliothèque en place : mute `d.cards` de chaque
   paquet touché (cartes réparées, ou retirées si leur contenu manque).
   `touched` (les paquets à sauvegarder) laisse l'appelant décider quand
   et comment persister — cette fonction ne connaît ni `saveDeck` ni la
   file d'attente hors ligne. */
export function repairLibrary(decks, cfg, makeId, now = Date.now()) {
  const tally = emptyTally();
  let dropped = 0;
  const touched = [];
  for (const d of decks) {
    let changed = false;
    d.cards = d.cards.filter(c => {
      const r = repairCard(c, cfg, makeId, now);
      for (const f of r.families) tally[f]++;
      if (r.families.length) changed = true;
      if (r.drop) { dropped++; return false; }
      return true;
    });
    if (changed) touched.push(d);
  }
  return { tally, dropped, touched };
}
