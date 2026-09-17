/* ══════════ fusion à trois versions ══════════
   Deux appareils modifient le même paquet sans se voir : au retour du
   réseau, aucune des deux versions n'est « la bonne » toute seule. La
   file actuelle (app.js, « conflits entre appareils ») demandait de
   choisir — la sienne, l'autre, ou garder les deux — pour tout le
   paquet d'un coup, y compris quand les deux appareils n'avaient touché
   à rien en commun.

   Ce module compare chaque carte à sa base commune (le dernier état que
   les deux appareils partageaient) : ce qui n'a changé que d'un côté est
   pris tel quel, sans demander ; ce qui a vraiment changé des deux côtés
   de façon différente est tranché par une règle fixe, écrite une fois
   pour toutes, plutôt que par une boîte de dialogue. Rien ne bloque,
   rien ne demande — c'est tout l'objet de M03.T4. Les cas vraiment
   divergents sont listés en sortie (`notes`), pour qu'on puisse un jour
   les compter ou les journaliser, jamais pour qu'on doive les montrer.

   Pur : ni DOM, ni réseau, ni almanach — seulement les trois tableaux
   qu'on lui passe. Testé dans test/fusion.test.js. */

const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* Les dix champs de la mémoire FSRS (voir le bandeau de fsrs.js) : ils
   ne se fusionnent jamais indépendamment les uns des autres — mélanger
   le S d'un appareil avec le D de l'autre donnerait un état que le
   moteur n'a jamais calculé, donc un état sans aucun sens physique. */
export const STATE_FIELDS = ['S', 'D', 'F', 'st', 'sp', 'd', 'lr', 'i', 'n', 'l'];
/* Le contenu éditorial d'une carte : ce qu'on écrit, pas ce que le
   moteur en déduit. */
export const CONTENT_FIELDS = ['f', 'b', 'x'];

/* Un seul champ scalaire (texte, booléen, nombre isolé). Si un seul
   côté a bougé depuis la base, c'est lui qui gagne — l'autre appareil
   n'avait juste rien à en dire. Si les deux ont bougé vers la même
   valeur, ce n'est pas un désaccord. Si les deux ont bougé vers des
   valeurs différentes, c'est un vrai conflit de contenu : on tranche
   pour la version distante — elle porte déjà un numéro de séquence
   serveur (`usn`, M03.T1), l'autre pas encore. */
export function mergeScalar(base, mine, theirs) {
  if (eq(mine, theirs)) return { value: mine, conflict: false };
  if (eq(mine, base)) return { value: theirs, conflict: false };
  if (eq(theirs, base)) return { value: mine, conflict: false };
  return { value: theirs, conflict: true };
}

/* Le bloc mémoire, comme un tout. Si un seul appareil a révisé la carte
   pendant que l'autre ne la touchait pas, c'est cet appareil qui gagne
   sans discussion. Si les deux l'ont révisée chacun de leur côté, celui
   qui est allé le plus loin (le plus de révisions, puis la plus
   récente) l'emporte pour l'affichage — rien n'est perdu pour autant :
   chaque révision est déjà dans le journal (`reviews`, M03.T2) et
   recalculera l'état exact des deux quand les lectures basculeront sur
   les nouvelles tables (M03.T6). */
export function mergeStateGroup(base, mine, theirs) {
  const pick = o => STATE_FIELDS.reduce((acc, k) => { acc[k] = (o || {})[k]; return acc; }, {});
  const b = pick(base), m = pick(mine), t = pick(theirs);
  const mChanged = !eq(m, b), tChanged = !eq(t, b);
  if (!mChanged && !tChanged) return { value: b, conflict: false };
  if (mChanged && !tChanged) return { value: m, conflict: false };
  if (!mChanged && tChanged) return { value: t, conflict: false };
  const mn = m.n || 0, tn = t.n || 0;
  if (mn !== tn) return { value: mn > tn ? m : t, conflict: true };
  const mlr = m.lr || 0, tlr = t.lr || 0;
  return { value: mlr >= tlr ? m : t, conflict: true };
}

/* Une carte présente des trois côtés : fusion champ par champ pour le
   contenu, en bloc pour la mémoire, et les champs rares ou hérités
   (voir `meta` dans le schéma `cards`, M03.T1) au cas par cas. */
export function mergeCard(base, mine, theirs) {
  base = base || {}; mine = mine || {}; theirs = theirs || {};
  const out = { id: mine.id || theirs.id || base.id };
  const conflicts = [];

  for (const k of CONTENT_FIELDS) {
    const r = mergeScalar(base[k], mine[k], theirs[k]);
    if (r.value !== undefined) out[k] = r.value;
    if (r.conflict) conflicts.push(k);
  }

  const s = mergeStateGroup(base, mine, theirs);
  Object.assign(out, s.value);
  if (s.conflict) conflicts.push('mémoire');

  const connus = new Set(['id', ...CONTENT_FIELDS, ...STATE_FIELDS]);
  const autres = new Set([...Object.keys(base), ...Object.keys(mine), ...Object.keys(theirs)]
    .filter(k => !connus.has(k)));
  for (const k of autres) {
    const r = mergeScalar(base[k], mine[k], theirs[k]);
    if (r.value !== undefined) out[k] = r.value;
    if (r.conflict) conflicts.push(k);
  }
  return { card: out, conflicts };
}

/* Une carte a-t-elle vraiment changé depuis la base ? Sert à trancher le
   cas « supprimée d'un côté, éditée de l'autre » : l'édition l'emporte
   toujours sur la suppression — perdre une réponse ou des révisions
   parce qu'un appareil l'a supprimée sans savoir que l'autre venait d'y
   travailler serait exactement la perte que M03 existe pour éviter. */
function aBouge(base, carte) {
  if (!base) return true;
  return !CONTENT_FIELDS.concat(STATE_FIELDS).every(k => eq(base[k], carte[k]));
}

/* Les trois tableaux de cartes d'un paquet (même forme que `decks.cards`
   ou que ce que fournit `cards`, M03.T1). Rend le tableau fusionné et
   les notes sur les cas vraiment divergents — jamais une carte perdue
   silencieusement : toute carte présente d'un côté et absente de l'autre
   sans avoir été supprimée légitimement se retrouve dans le résultat. */
export function mergeCards(baseArr, mineArr, theirsArr) {
  const B = new Map((baseArr || []).map(c => [c.id, c]));
  const M = new Map((mineArr || []).map(c => [c.id, c]));
  const T = new Map((theirsArr || []).map(c => [c.id, c]));
  const ids = new Set([...B.keys(), ...M.keys(), ...T.keys()]);
  const cards = [], notes = [];

  for (const id of ids) {
    const b = B.get(id), m = M.get(id), t = T.get(id);
    if (b && m && t) {
      const { card, conflicts } = mergeCard(b, m, t);
      cards.push(card);
      if (conflicts.length) notes.push({ id, champs: conflicts });
    } else if (b && m && !t) {
      if (aBouge(b, m)) { cards.push(m); notes.push({ id, champs: ['restaurée : modifiée ici pendant sa suppression ailleurs'] }); }
    } else if (b && !m && t) {
      if (aBouge(b, t)) { cards.push(t); notes.push({ id, champs: ['restaurée : modifiée ailleurs pendant sa suppression ici'] }); }
    } else if (b && !m && !t) {
      /* supprimée des deux côtés : rien à faire */
    } else if (!b && m && !t) {
      cards.push(m);
    } else if (!b && !m && t) {
      cards.push(t);
    } else if (!b && m && t) {
      if (eq(m, t)) cards.push(m);
      else { cards.push(m); cards.push({ ...t, id: t.id + '·distante' }); notes.push({ id, champs: ['créée en double, gardée des deux côtés'] }); }
    }
  }
  return { cards, notes };
}

/* Le paquet entier : nom, matière, visibilité, épingle et cartes. `meta`
   (réglages du paquet : tolérance, langue par face, chrono) se fusionne
   en bloc, pas champ par champ — un cas assez rare pour ne pas mériter
   plus de finesse aujourd'hui. */
const DECK_FIELDS = ['name', 'subject', 'hidden', 'pinned'];
export function mergeDeck(base, mine, theirs) {
  base = base || {}; mine = mine || {}; theirs = theirs || {};
  const out = {};
  const notes = [];
  for (const k of DECK_FIELDS) {
    const r = mergeScalar(base[k], mine[k], theirs[k]);
    out[k] = r.value;
    if (r.conflict) notes.push({ champ: k });
  }
  out.meta = mergeScalar(base.meta, mine.meta, theirs.meta).value;
  const { cards, notes: notesCartes } = mergeCards(base.cards, mine.cards, theirs.cards);
  out.cards = cards;
  return { deck: out, notes: notes.concat(notesCartes) };
}
