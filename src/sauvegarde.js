/* ══════════ sauvegarde intégrale ══════════
   M04.T6 : exporter toute la bibliothèque dans un fichier, et la
   retrouver à l'identique en le réimportant — état d'apprentissage
   compris (S, D, F, échéances, paliers, compteurs, réglages de paquet).
   Le lien « recto et verso seulement » (#i=…) est parti le 2026-11-18 :
   il ne servait à rien que le code d'un paquet ne fasse mieux, et il
   faisait entrer une bibliothèque entière par-dessus la limite de l'offre.

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

   Un fichier peut avoir été écrit à la main (2026-11-18, demandé : « évite
   les douilles d'abonnement en exportant et en réintégrant ») : il est lu
   comme s'il venait de n'importe qui. Borné (BORNES), ses textes ramenés à
   des chaînes, ses images et ses sons gardés seulement s'ils sont des
   chemins du seau qu'on peut lire (mediaGarde) — une image en `data:`
   donnait des images à Mirandola gratuit, que la base leur refuse —, et
   jamais plus de paquets que l'offre n'en garde (planRestauration).

   Pur : ni DOM, ni réseau, ni horloge lue ici. Testé dans
   test/export.test.js. */

export const FORMAT = 'folio-bibliotheque';
export const VERSION = 1;

/* Bien au-delà d'une vraie bibliothèque (la plus grosse connue en
   production : 16 paquets, 1 265 cartes), assez peu pour qu'un fichier
   fabriqué ne fasse pas tomber l'app. Un texte plus long n'est pas une
   carte (MAXF et MAXB de la création : 500 et 4 000 signes). */
export const BORNES = { paquets: 2000, cartes: 100000, texte: 20000, nom: 200 };
const MEDIAS = ['fi', 'bi', 'fa', 'ba'];

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
  if (data.decks.some(d => d.cards.some(c => !c || typeof c !== 'object' || Array.isArray(c)))) return 'Carte mal formée';
  const cartes = data.decks.reduce((n, d) => n + d.cards.length, 0);
  if (data.decks.length > BORNES.paquets || data.subjects.length > BORNES.paquets || cartes > BORNES.cartes) return 'Sauvegarde trop grande';
  return '';
}

/* Une image ou un son se garde s'il est un chemin du seau `media` que ce
   compte peut lire : son propre dossier, ou celui des cours d'une classe
   (`cours/…`, les devoirs illustrés). Une ancienne adresse du seau en
   https se relit de même. Le reste — `data:`, `blob:`, un autre site, le
   dossier d'un autre compte — ne s'afficherait pas, ou passerait par-dessus
   ce que l'offre ouvre : il ne revient pas. */
const SEAU = /^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/(?:public|authenticated|sign)\/media\/([^?#]+)/i;

export function mediaGarde(v, owner) {
  if (!isStr(v) || !v || v.length > 600) return false;
  let p = v;
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) {
    const m = SEAU.exec(v);
    if (!m) return false;
    try { p = decodeURIComponent(m[1]); } catch (e) { return false; }
  }
  if (p.includes('..') || p.startsWith('/')) return false;
  return p.startsWith('cours/') || (!!owner && p.startsWith(owner + '/'));
}

const texte = v => (v == null ? '' : String(v)).slice(0, BORNES.texte);

/* Une carte telle qu'elle peut entrer : recto et verso en texte, ses
   médias lisibles, un identifiant en texte ; tout le reste — l'état
   d'apprentissage, que l'entretien automatique répare s'il le faut — tel
   quel. */
function carteSure(c, owner) {
  const o = { ...c, id: isStr(c.id) && c.id ? c.id.slice(0, 120) : '', f: texte(c.f), b: texte(c.b) };
  for (const k of MEDIAS) if (k in o && !mediaGarde(o[k], owner)) delete o[k];
  return o;
}

function paquetSur(d, owner) {
  const o = { ...d, name: texte(d.name).slice(0, BORNES.nom) || 'Paquet', subject: isStr(d.subject) ? d.subject : '',
              cards: d.cards.map(c => carteSure(c, owner)) };
  if (o.meta != null && (typeof o.meta !== 'object' || Array.isArray(o.meta))) delete o.meta;
  return o;
}

const estDevoir = d => d.cards.some(c => String(c.id).startsWith('a:'));

/* Un fichier n'est « du même compte » que s'il le dit : sans compte écrit,
   il est d'ailleurs. Garder ses identifiants ferait refuser chaque envoi par
   la base (RLS), indéfiniment, s'ils sont ceux d'un autre. */
export const dAilleurs = (data, owner) => !owner || data.owner !== owner;

/* Ce que la restauration va faire, avant de rien toucher. `place` : combien
   de paquets à soi peuvent encore entrer (Mirandola gratuit en garde 5,
   src/offres.js ; Infinity ailleurs). Un paquet qui remplace le sien (même
   compte, même identifiant) ne prend pas de place ; tous les autres en
   prennent une, un devoir compris : un devoir ne compte pas dans la
   bibliothèque, et des cartes « a:… » écrites à la main en faisaient
   entrer sans fin. Dans l'ordre du fichier ; ce qui ne tient pas est
   `refuses`, dit à l'élève avant qu'il choisisse. */
export function planRestauration(db, data, owner, place = Infinity) {
  const foreign = dAilleurs(data, owner);
  let reste = place;
  const garder = [], refuses = [];
  for (const d of data.decks) {
    const remplace = !foreign && db.decks.some(x => x.id === d.id);
    if (!remplace && reste <= 0) { refuses.push(d); continue; }
    if (!remplace) reste--;
    garder.push(d);
  }
  return { garder, refuses, foreign, place };
}

/* Restaure en place dans `db`. `owner` : le compte qui restaure ;
   `makeId` : fabrique d'identifiants de paquet (tirés d'avance par
   l'appelant, pour l'annulation), `idCarte` ceux des cartes (uid de
   coeur-sync.js) ; `place` : celle de planRestauration. Rend ce qui a changé, pour que
   l'appelant sauvegarde (saveDeck, pushSubject) et prépare l'annulation —
   ce module ne connaît ni la file d'attente ni le réseau. Quand la place est
   comptée (Mirandola gratuit), un paquet neuf qui se dit devoir perd ses
   identifiants « a:… » : il compte alors comme un paquet à soi, et ne peut
   plus faire entrer une bibliothèque par-dessus la limite. */
function restaurerMatieres(db, data) {
  const subjects = [];
  for (const s of deep(data.subjects)) {
    s.name = texte(s.name).slice(0, 80) || 'Matière';
    const i = db.subjects.findIndex(x => x.id === s.id);
    if (i >= 0) db.subjects[i] = s; else db.subjects.push(s);
    subjects.push(s);
  }
  return subjects;
}

// les identifiants de cartes qui manquent, et ceux d'un faux devoir quand la place est comptée
function identifier(d, neuf, compte, idCarte) {
  const faux = neuf && compte && estDevoir(d);
  for (const c of d.cards) if (!c.id || (faux && c.id.startsWith('a:'))) c.id = idCarte();
}

export function restoreLibrary(db, data, owner, makeId, place = Infinity, idCarte = makeId) {
  const plan = planRestauration(db, data, owner, place);
  const { foreign } = plan;
  const subjects = restaurerMatieres(db, data);
  const decks = [];
  let added = 0, replaced = 0;
  for (const brut of deep(plan.garder)) {
    const d = paquetSur(brut, owner);
    if (foreign) d.id = makeId();
    const i = db.decks.findIndex(x => x.id === d.id);
    identifier(d, i < 0, place !== Infinity, idCarte);
    if (i >= 0) {
      if (db.decks[i].rev != null) d.rev = db.decks[i].rev;
      db.decks[i] = d; replaced++;
    } else { db.decks.push(d); added++; }
    decks.push(d);
  }
  return { subjects, decks, added, replaced, foreign, refuses: plan.refuses.length };
}
