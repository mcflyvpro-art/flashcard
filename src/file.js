/* ══════════ la file de révision ══════════
   Ce que voit l'élève quand il ouvre un paquet : quelles cartes (suspendues
   ou non, dues ou non, coriaces ou non), combien de neuves (le quota),
   dans quel ordre (mélangé, par échéance, ou tel quel). C'est une règle
   métier — « qu'est-ce qu'une carte due, qu'est-ce qu'une carte coriace,
   combien de neuves aujourd'hui » — donc elle vit ici, pas dans app.js
   (M01.T3).

   Pur : ni DOM, ni réseau, ni almanach — l'horloge (`now`) et le hasard
   (`rand`) sont toujours fournis par l'appelant, jamais lus ici. C'est ce
   qui permet de tester le mélange et les échéances de façon déterministe.
   Ne mute jamais le tableau `cards` reçu. Testé dans test/file.test.js. */

import { BASCULE } from './fsrs.js';

/* ---------- la journée d'Anki ----------
   Anki ne change pas de jour à minuit mais à 4 h (« le jour suivant
   commence à », réglage par défaut) : une séance après minuit compte
   encore pour la veille. C'est ce découpage que suivent le quota de pages
   neuves et l'échéance des cartes en révision ; le moteur compte les jours
   écoulés entre deux lectures avec la même bascule (`dayNo`, src/fsrs.js). */
export function debutJour(now) {
  const d = new Date(now);
  d.setHours(BASCULE, 0, 0, 0);
  if (d.getTime() > now) d.setDate(d.getDate() - 1);
  return d.getTime();
}
export function finJour(now) {
  const d = new Date(debutJour(now));
  d.setDate(d.getDate() + 1);              // setDate, pas + 24 h : un changement d'heure ne décale rien
  return d.getTime();
}

/* Due : pas suspendue, et l'échéance (d) est passée ou absente (jamais vue).
   Une carte en révision (st 2) se compte en jours, comme dans Anki : due
   pour aujourd'hui, elle l'est dès le début de la journée, pas seulement à
   l'heure exacte où on l'avait lue. Un palier d'apprentissage (st 1, 3) se
   compte en minutes : il attend son heure. */
export const isDue = (c, now) => !c.x && (!c.d || c.d <= now || (c.st === 2 && c.d < finJour(now)));

/* Neuve : jamais lue. Pas « aucune réussite » (`n` compte les réussites,
   CLAUDE.md) : une page ratée à sa première lecture est en apprentissage,
   et un quota de neuves ne doit jamais la retirer d'une séance. */
export const estNeuve = c => !c.n && !c.lr && !c.S;

/* ---------- les cartes neuves : toutes, puis le moteur ----------
   Décidé le 2026-11-15 (« le statut Nouvelle doit toujours être proposé
   pour les lancer dans le moteur, et après n'afficher que celles qui
   reviennent avec le temps ») : plus de quota de neuves. Une carte jamais
   révisée est toujours proposée — paquet neuf, cartes ajoutées, devoir —,
   sa première note la fait entrer dans le moteur, qui seul décide ensuite
   quand elle revient. Avant : 20 neuves par jour et par paquet, comme
   Anki ; des cartes ajoutées attendaient derrière les neuves plus
   anciennes (un paquet réel : 58 cartes, douze jours d'attente).
   `fl` (l'heure de la première révision, posée par grade()) reste rangé. */
export const deDevoir = cards => cards.some(c => String(c.id).startsWith('a:'));

/* Ce qu'affiche le bouton « Réviser » d'un paquet : tout ce qui est dû,
   les neuves comprises. */
export const aLire = (cards, now) => cards.filter(c => isDue(c, now)).length;

/* Coriace : huit échecs ou plus depuis la dernière remise à zéro (l). */
export const isLeech = c => (c.l || 0) >= 8;

/* Fisher-Yates en place. `rand` est injectable (tests déterministes) ;
   en pratique l'appelant passe Math.random ou rien. */
export function shuffle(a, rand = Math.random) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = (rand() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* Construit la file d'une séance à partir des cartes d'un paquet (ou d'un
   marathon).
   opts :
     susp  — garder aussi les cartes suspendues (par défaut : non)
     only  — 'due' ou 'leech' pour ne garder que celles-là
     cap   — nombre maximum de cartes neuves introduites (0 ou absent =
             pas de plafond, comme le mode simple qui ne connaît pas de quota)
     order — 'anki' (l'ordre d'Anki, voir `ordreAnki`), 'deck' (ordre du
             paquet), 'worst' (les plus coriaces d'abord), 'due' (les plus
             en retard d'abord) ; sinon mélange
     fresh — en mélange, mélanger neuves et déjà-vues séparément plutôt
             qu'ensemble (garde les neuves groupées dans le résultat)
     limit — tronque la file finale à ce nombre de cartes
   `now` sert à `isDue` ; `rand` au mélange. */
export function buildQueue(cards, opts = {}, now, rand = Math.random) {
  let list = cards.filter(c => !c.x || opts.susp);
  if (opts.only === 'due') list = list.filter(c => isDue(c, now));
  if (opts.only === 'leech') list = list.filter(isLeech);
  const fresh = list.filter(estNeuve), seen = list.filter(c => !estNeuve(c));
  const cap = opts.cap || 0;
  const kept = cap > 0 ? fresh.slice(0, cap) : fresh;
  let ordered;
  if (opts.order === 'anki') ordered = ordreAnki(kept, seen, rand);
  else if (opts.order === 'deck') ordered = [...kept, ...seen];
  else if (opts.order === 'worst') ordered = [...kept, ...seen].sort((a, b) => (b.l || 0) - (a.l || 0));
  else if (opts.order === 'due') ordered = [...kept, ...seen].sort((a, b) => (a.d || 0) - (b.d || 0));
  else if (opts.fresh) ordered = [...shuffle(kept, rand), ...shuffle(seen, rand)];
  else ordered = shuffle([...kept, ...seen], rand);
  return opts.limit > 0 ? ordered.slice(0, opts.limit) : ordered;
}

/* ---------- l'ordre d'Anki (réglages par défaut) ----------
   Les paliers d'apprentissage d'abord (ils ont une heure, des minutes près) ;
   puis les révisions par jour d'échéance, au hasard dans un même jour
   (« Date d'échéance, puis aléatoire ») ; les neuves dans l'ordre du paquet
   (« Ordre de collecte »), réparties à intervalles réguliers parmi les
   révisions (« Mélanger avec les révisions »). */
export function ordreAnki(neuves, vues, rand = Math.random) {
  const appr = vues.filter(c => c.st === 1 || c.st === 3).sort((a, b) => (a.d || 0) - (b.d || 0));
  const jour = c => c.d ? debutJour(c.d) : 0;
  const revues = shuffle(vues.filter(c => c.st !== 1 && c.st !== 3), rand).sort((a, b) => jour(a) - jour(b));
  return [...appr, ...entrelacer(revues, neuves)];
}

/* Répartit `b` à intervalles réguliers dans `a` : la k-ième carte de `b`
   prend la place ⌊(k + ½) × total / |b|⌋. */
export function entrelacer(a, b) {
  if (!b.length) return a;
  if (!a.length) return b;
  const total = a.length + b.length, out = new Array(total);
  for (let k = 0; k < b.length; k++) out[Math.floor((k + 0.5) * total / b.length)] = b[k];
  let i = 0;
  for (let p = 0; p < total; p++) if (out[p] === undefined) out[p] = a[i++];
  return out;
}

/* ---------- ce qui revient pendant la séance ----------
   Demandé le 2026-11-16 : « tant que ce n'est pas su, la carte revient
   dans la même séance — mais on reste bloqué à l'infini ». Avant, toute
   carte encore sur un palier d'apprentissage (1 min, 10 min ; rechute
   10 min) repartait en fin de file, quel que soit son délai : il fallait
   « Correct » deux fois ou « Facile » une fois sur chaque carte neuve pour
   sortir, et « Difficile », qui garde le palier, tournait en rond.

   Comme dans Anki, une carte en apprentissage revient quand son heure est
   venue, pendant qu'on révise encore : la plus proche d'abord, donc celle
   au plus long délai en dernier. Une fois toute la file vue, seules les
   cartes qu'on n'a pas sues (« Encore ») reviennent sans attendre leur
   heure ; celles qu'on a sues et qui attendent leur palier ne retiennent
   plus la séance — le bilan dit quand elles reviennent, et « Revoir
   maintenant » les ramène pour qui veut (`tout` : la limite d'avance
   d'Anki, au choix). Le moteur, lui, ne change pas : elles sont dues à
   leur heure, et la prochaine séance les montre. */
export const RETOUR_SIMPLE = 60000;      // le mode simple n'a pas d'heure : une ratée revient au bout d'une minute

/* Après une note : la carte revient-elle dans cette séance, et quand ?
   `c` est la carte telle que la note l'a laissée (son palier `st`, son
   heure `d`). Rend `{ id, d, sue }` ou null. */
export function aRevoir(id, c, ok, simple, now) {
  if (simple) return ok ? null : { id, d: now + RETOUR_SIMPLE, sue: false };
  return c && (c.st === 1 || c.st === 3) ? { id, d: c.d || now, sue: !!ok } : null;
}

/* Les cartes qui attendent (`attente`) rejoignent la file à la place `i` :
   celles dont l'heure est venue ; la file vue en entier, celles qu'on n'a
   pas sues ; avec `tout`, toutes. Les plus proches d'abord. Pur : rend une
   nouvelle file et ce qui attend encore. */
export function ramener(file, i, attente, now, tout) {
  const fin = i >= file.length;
  const pretes = attente.filter(a => a.d <= now || (fin && (tout || !a.sue))).sort((a, b) => a.d - b.d);
  if (!pretes.length) return { file, attente };
  const ids = new Set(pretes.map(a => a.id));
  return { file: [...file.slice(0, i), ...pretes.map(a => a.id), ...file.slice(i)], attente: attente.filter(a => !ids.has(a.id)) };
}

/* La reprise d'une lecture interrompue (`cartes.resume.<uid>`) photographie
   la file : des identifiants de pages. Entre-temps, le livre a pu partir à la
   corbeille ou perdre des pages, ailleurs ou ici : on ne garde que les pages
   qui existent encore, et sans page à lire il n'y a rien à reprendre — un
   livre supprimé s'affichait encore dans « Reprendre ». `existe(id)` dit si
   la page est toujours dans un livre vivant. */
export function reprise(r, existe) {
  if (!r || !Array.isArray(r.queue) || !(r.i >= 0)) return null;
  const reste = r.queue.slice(r.i).filter(existe);
  if (!reste.length) return null;
  /* une séance rangée avant le 2026-11-16 n'a pas d'attente, mais une liste
     `again` de cartes à revoir sans heure : elles reviennent comme des ratées */
  const attente = (Array.isArray(r.attente) ? r.attente : (r.again || []).map(id => ({ id, d: 0, sue: false })))
    .filter(a => a && existe(a.id));
  return { ...r, queue: [...r.queue.slice(0, r.i), ...reste], attente };
}
