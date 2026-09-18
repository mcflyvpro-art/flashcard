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

/* Due : pas suspendue, et l'échéance (d) est passée ou absente (jamais vue). */
export const isDue = (c, now) => !c.x && (!c.d || c.d <= now);

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
     order — 'deck' (ordre du paquet), 'worst' (les plus coriaces d'abord),
             'due' (les plus en retard d'abord) ; sinon mélange
     fresh — en mélange, mélanger neuves et déjà-vues séparément plutôt
             qu'ensemble (garde les neuves groupées dans le résultat)
     limit — tronque la file finale à ce nombre de cartes
   `now` sert à `isDue` ; `rand` au mélange. */
export function buildQueue(cards, opts = {}, now, rand = Math.random) {
  let list = cards.filter(c => !c.x || opts.susp);
  if (opts.only === 'due') list = list.filter(c => isDue(c, now));
  if (opts.only === 'leech') list = list.filter(isLeech);
  const fresh = list.filter(c => !c.n), seen = list.filter(c => c.n);
  const cap = opts.cap || 0;
  const kept = cap > 0 ? fresh.slice(0, cap) : fresh;
  let ordered;
  if (opts.order === 'deck') ordered = [...kept, ...seen];
  else if (opts.order === 'worst') ordered = [...kept, ...seen].sort((a, b) => (b.l || 0) - (a.l || 0));
  else if (opts.order === 'due') ordered = [...kept, ...seen].sort((a, b) => (a.d || 0) - (b.d || 0));
  else if (opts.fresh) ordered = [...shuffle(kept, rand), ...shuffle(seen, rand)];
  else ordered = shuffle([...kept, ...seen], rand);
  return opts.limit > 0 ? ordered.slice(0, opts.limit) : ordered;
}
