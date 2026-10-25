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

/* ---------- la journée d'Anki ----------
   Anki ne change pas de jour à minuit mais à 4 h (« le jour suivant
   commence à », réglage par défaut) : une séance après minuit compte
   encore pour la veille. C'est ce découpage que suivent le quota de pages
   neuves et l'échéance des cartes en révision. */
export const BASCULE = 4;
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

/* ---------- le quota de pages neuves (Anki : 20 par jour et par paquet) ----------
   `fl` est l'heure de la première lecture d'une page (posée par grade()) ;
   les pages lues pour la première fois depuis le début de la journée
   entament le quota. Un devoir n'en a pas : ce que le professeur a donné
   doit pouvoir se faire d'un trait. */
export const NEUVES_PAR_JOUR = 20;
export const deDevoir = cards => cards.some(c => String(c.id).startsWith('a:'));
export function neuvesPermises(cards, now) {
  if (deDevoir(cards)) return Infinity;
  const t0 = debutJour(now);
  const lues = cards.filter(c => c.fl >= t0).length;
  return Math.max(0, NEUVES_PAR_JOUR - lues);
}

/* Ne garde, parmi les neuves, que les premières permises de chaque paquet
   (`reste(clé)`), dans l'ordre reçu ; les autres cartes passent toutes. */
/** @param {(c: any) => any} [cle] */
export function garderNeuves(cards, reste, cle = c => '') {
  const prises = new Map(), max = new Map();
  return cards.filter(c => {
    if (!estNeuve(c)) return true;
    const k = cle(c);
    if (!max.has(k)) max.set(k, reste(k));
    const n = prises.get(k) || 0;
    if (n >= max.get(k)) return false;
    prises.set(k, n + 1);
    return true;
  });
}

/* Ce qu'affiche le bouton « Lire » d'un paquet : les cartes dues déjà
   commencées, plus les neuves dans la limite du quota du jour. */
export function aLire(cards, now) {
  let vues = 0, neuves = 0;
  for (const c of cards) {
    if (!isDue(c, now)) continue;
    if (estNeuve(c)) neuves++; else vues++;
  }
  return vues + Math.min(neuves, neuvesPermises(cards, now));
}

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
