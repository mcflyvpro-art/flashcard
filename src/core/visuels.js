import { I } from '../icones.js';
import { auth, online, setVisuels, visuels } from '../data/etat.js';
import { api } from './coeur-sync.js';
import { messageErreur } from './eleve-classes.js';
import { toast } from '../ui/import-cartes.js';
import { repeindreJetons } from '../ui/jeton.js';

/* ══════════ les jetons d'identité : réseau ══════════
   (2026-10-25, migration 20261025111500). Un écran dessine tout de suite le
   jeton qu'il connaît — celui que la personne a choisi s'il est en cache,
   sinon ses initiales et sa couleur par défaut — et demande en passant ce
   qu'il ignore. Les demandes d'un même affichage partent ensemble, une
   seule fois par session et par identifiant ; la réponse ne redessine que
   les jetons concernés (repeindreJetons), jamais l'écran entier : rien ne
   bouge sous les doigts de qui tape. */

const rpc = (f, body) => api('/rest/v1/rpc/' + f, 'POST', body || {});
const cle = () => 'folio.visuels.' + (auth && auth.uid);
const PAQUET = { p: 200, c: 100 };                 // les bornes de visuels()

let pour = null;                                    // le compte dont le cache est chargé
const demandes = new Set();                         // « p:id », déjà demandés cette session
let file = { p: new Set(), c: new Set() }, minuterie = 0;
const abonnes = new Set();

function charger() {
  pour = auth && auth.uid;
  try { setVisuels(JSON.parse(localStorage.getItem(cle())) || {}); }
  catch (e) { setVisuels({}); /* illisible : les jetons par défaut s'affichent, la base redira les choix */ }
}

function garder() {
  try { localStorage.setItem(cle(), JSON.stringify(visuels)); }
  catch (e) { /* quota plein : on relira les choix au prochain démarrage */ }
}

// La session change (déconnexion, autre compte) : on oublie tout.
export function oublierVisuels() {
  pour = null; demandes.clear(); file = { p: new Set(), c: new Set() };
  clearTimeout(minuterie); minuterie = 0; setVisuels({});
}

// Un écran qui colore autre chose que le jeton (l'espace prof teinte ses
// listes à la couleur de la classe) se fait prévenir quand un choix arrive.
export const surVisuels = f => abonnes.add(f);

/* Ce qu'on sait du jeton choisi (`genre` : 'p' personne, 'c' classe), et
   la demande à la base de ce qu'on n'a pas encore relu cette session. */
export function voir(genre, id) {
  if (!id || !auth || !auth.uid) return undefined;
  if (pour !== auth.uid) charger();
  const k = genre + ':' + id;
  if (!demandes.has(k)) {
    demandes.add(k);
    file[genre].add(id);
    if (!minuterie) minuterie = setTimeout(demander, 30);
  }
  return visuels[k];
}

function rendre(genre, ids) { for (const id of ids) demandes.delete(genre + ':' + id); }

function noter(genre, ids, rows, changes) {
  const vus = new Set();
  for (const r of rows) {
    if (r.genre !== genre) continue;
    const k = genre + ':' + r.id, v = { cle: r.cle || null, teinte: r.teinte == null ? null : +r.teinte, plus: !!r.plus };
    vus.add(r.id);
    const avant = visuels[k];
    if (!avant || avant.cle !== v.cle || avant.teinte !== v.teinte || !!avant.plus !== v.plus) { visuels[k] = v; changes.push(k); }
  }
  // plus visible (ami retiré, classe quittée) : on revient au jeton par défaut
  for (const id of ids) if (!vus.has(id) && visuels[genre + ':' + id]) { delete visuels[genre + ':' + id]; changes.push(genre + ':' + id); }
}

async function demander() {
  minuterie = 0;
  const p = [...file.p].slice(0, PAQUET.p), c = [...file.c].slice(0, PAQUET.c);
  for (const id of p) file.p.delete(id);
  for (const id of c) file.c.delete(id);
  if (file.p.size || file.c.size) minuterie = setTimeout(demander, 30);   // le reste au paquet suivant
  if (!p.length && !c.length) return;
  if (!online) { rendre('p', p); rendre('c', c); return; }
  try {
    const rows = await rpc('visuels', { personnes: p, classes: c }) || [];
    const changes = [];
    noter('p', p, rows, changes);
    noter('c', c, rows, changes);
    if (!changes.length) return;
    garder();
    repeindreJetons(changes);
    for (const f of abonnes) f(changes);
  } catch (e) { rendre('p', p); rendre('c', c); /* réseau : on redemandera au prochain affichage */ }
}

/* ---------- choisir ---------- */
async function choisir(k, v, appel, quoi) {
  if (!online) { toast(I.cloud, 'Hors ligne : ' + quoi + ' demande le réseau'); return false; }
  if (pour !== auth.uid) charger();
  const avant = visuels[k];
  visuels[k] = v; garder(); repeindreJetons([k]);
  try { await appel(); for (const f of abonnes) f([k]); return true; }
  catch (e) {
    if (avant) visuels[k] = avant; else delete visuels[k];
    garder(); repeindreJetons([k]);
    toast(I.x, messageErreur(e).slice(0, 120) || 'Impossible pour l’instant');
    return false;
  }
}

// figure : une clé de FIGURES ou null (les initiales) ; teinte : 0–11 ou null
export const choisirMonJeton = (figure, teinte) => choisir('p:' + auth.uid, { cle: figure, teinte },
  () => rpc('mon_jeton', { cle: figure, rang: teinte }), 'changer ton jeton');

export const choisirJetonClasse = (cid, emb, teinte) => choisir('c:' + cid, { cle: emb, teinte },
  () => rpc('prof_jeton_classe', { cid, cle: emb, rang: teinte }), 'changer l’emblème');
