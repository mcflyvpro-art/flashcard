/* ══════════ sauvegarde intégrale ══════════
   M04.T6 : exporter toute la bibliothèque dans un fichier, et la
   retrouver à l'identique en le réimportant — état d'apprentissage
   compris (S, D, F, échéances, paliers, compteurs, réglages de paquet).
   L'ancienne « sauvegarde » (lien #i=…, menus-c.js) ne gardait que recto
   et verso : utile pour partager un paquet, mais une restauration
   repartait de zéro sur chaque carte.

   Ce qui n'est PAS dans le fichier, exprès :
   - `rev` d'un paquet : c'est le numéro de concurrence de SA ligne en base
     (M03), pas une donnée de l'élève. Restaurer un vieux `rev` ferait
     crier au conflit à chaque envoi.
   - `dup`, `big` sur une carte : marques posées par l'écran d'import
     (markDups/markOver), jamais persistées en base.
   - le journal des révisions (`reviews`) : il vit côté serveur et sert à
     régler le moteur ; l'export de toutes les données d'un compte est une
     autre tâche (M11.T3).

   Restaurer sur le même compte remet chaque paquet à l'identique, sous le
   même identifiant (celui qui existe déjà est remplacé, son `rev` local
   gardé). Restaurer le fichier d'un autre compte donne de nouveaux
   identifiants aux paquets : en base, un identifiant de paquet appartient
   à un seul compte, et le réutiliser serait refusé (RLS) à chaque envoi,
   indéfiniment.

   Pur : ni DOM, ni réseau, ni horloge lue ici. Testé dans
   test/export.test.js. */

export const FORMAT = 'folio-bibliotheque';
export const VERSION = 1;

const CARD_TRANSIENT = new Set(['dup', 'big']);
const DECK_TRANSIENT = new Set(['rev']);

const cleanCard = c => Object.fromEntries(Object.entries(c).filter(([k]) => !CARD_TRANSIENT.has(k)));

function cleanDeck(d) {
  const out = {};
  for (const [k, v] of Object.entries(d)) {
    if (DECK_TRANSIENT.has(k)) continue;
    out[k] = k === 'cards' ? v.map(cleanCard) : v;
  }
  return out;
}

/* Une copie profonde par aller-retour JSON : c'est exactement ce que le
   fichier contiendra, donc ce que la restauration relira. */
const deep = x => JSON.parse(JSON.stringify(x));

export function exportLibrary(db, owner, now) {
  return {
    format: FORMAT, version: VERSION, owner: owner || null,
    exported_at: new Date(now).toISOString(),
    subjects: deep(db.subjects || []),
    decks: deep((db.decks || []).map(cleanDeck))
  };
}

const isStr = v => typeof v === 'string';

/* Lit le texte d'un fichier : rend { ok: true, data } ou { ok: false,
   error } avec un message lisible. Ne juge que la forme du fichier, pas
   la santé des cartes : une sauvegarde doit rendre ce qu'elle contient,
   même une carte malade — l'entretien automatique de la bibliothèque
   (M04.T2, entretienAuto) la réparera ensuite. */
export function readBackup(text) {
  let data;
  try { data = JSON.parse(text); } catch (e) { return { ok: false, error: 'Fichier illisible (pas du JSON)' }; }
  const error = headerError(data) || contentError(data);
  return error ? { ok: false, error } : { ok: true, data };
}

function headerError(data) {
  if (!data || data.format !== FORMAT) return 'Ce fichier n’est pas une sauvegarde Mirandola';
  if (data.version !== VERSION) return 'Version de sauvegarde inconnue';
  if (!Array.isArray(data.subjects) || !Array.isArray(data.decks)) return 'Sauvegarde incomplète';
  return '';
}

function contentError(data) {
  if (data.subjects.some(s => !s || !isStr(s.id))) return 'Matière sans identifiant';
  if (data.decks.some(d => !d || !isStr(d.id) || !Array.isArray(d.cards))) return 'Paquet mal formé';
  if (data.decks.some(d => d.cards.some(c => !c || typeof c !== 'object'))) return 'Carte mal formée';
  return '';
}

/* Restaure en place dans `db`. `owner` : le compte qui restaure ;
   `makeId` : fabrique d'identifiants (uid de coeur-sync.js), injectée.
   Rend ce qui a changé, pour que l'appelant sauvegarde (saveDeck,
   pushSubject) et prépare l'annulation — ce module ne connaît ni la file
   d'attente ni le réseau. */
export function restoreLibrary(db, data, owner, makeId) {
  const foreign = !!data.owner && data.owner !== owner;
  const subjects = [];
  for (const s of deep(data.subjects)) {
    const i = db.subjects.findIndex(x => x.id === s.id);
    if (i >= 0) db.subjects[i] = s; else db.subjects.push(s);
    subjects.push(s);
  }
  const decks = [];
  let added = 0, replaced = 0;
  for (const d of deep(data.decks)) {
    if (foreign) d.id = makeId();
    const i = db.decks.findIndex(x => x.id === d.id);
    if (i >= 0) {
      if (db.decks[i].rev != null) d.rev = db.decks[i].rev;
      db.decks[i] = d; replaced++;
    } else { db.decks.push(d); added++; }
    decks.push(d);
  }
  return { subjects, decks, added, replaced, foreign };
}
