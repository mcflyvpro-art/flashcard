import { auth, comp, optRunning, prefs, setOptRunning, view } from '../data/etat.js';
import { SB, api, deck, refreshToken, uid } from './coeur-sync.js';
import { savePrefs } from '../ui/import-cartes.js';
import { fsrsItems, fsrsOptimize, fsrsReplay } from '../ui/carte-media.js';

/* Vrai quand on est en train de composer ou d'éditer un livre destiné à
   une classe : ses médias doivent être lisibles par les élèves. */
const coursOuvert = () => !!(comp && comp.cours)
  || !!(view.id && (deck(view.id) || {}).cours);

/* Le seau n'accepte qu'une liste de types. Safari ne rend pas « audio/mp4 »
   mais « audio/mp4;codecs=… » : le seau comparait la chaîne entière, ne
   reconnaissait rien, et refusait tous les enregistrements du micro sur
   iPhone. On ne garde donc que le type, sans ses paramètres.
   L'extension se déduit du type et non du nom : un enregistrement n'a pas
   de nom de fichier, et celui qu'on lui inventait annonçait « .webm »
   pour un contenu qui n'en était pas un. */
const MEXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
               'audio/webm': 'webm', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/ogg': 'ogg' };

export async function upload(file) {
  if (!auth) throw new Error('auth');
  if (file.size > 7.5e6) throw new Error('big');
  const mime = String(file.type || '').split(';')[0].trim().toLowerCase();
  const named = ((file.name || '').split('.').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const ext = MEXT[mime] || named || 'bin';
  /* Ce qui est déposé depuis un livre de cours part sous « cours/<uid>/ » :
     c'est le seul préfixe que la classe peut lire. Le reste de la
     bibliothèque du professeur lui reste privé. */
  const path = `${coursOuvert() ? 'cours/' : ''}${auth.uid}/${uid()}.${ext}`;
  if (auth.exp && Date.now() > auth.exp - 60000) await refreshToken();
  const r = await fetch(`${SB.url}/storage/v1/object/media/${path}`, {
    method: 'POST',
    headers: { apikey: SB.key, Authorization: 'Bearer ' + auth.token,
               'Content-Type': mime || 'application/octet-stream', 'x-upsert': 'true' },
    body: file
  });
  /* Le code de refus est repris dans le message : « impossible » sans
     rien d'autre ne se diagnostique pas, et c'est toujours le même mot
     pour un type refusé, un jeton périmé ou un seau plein. */
  if (!r.ok) throw new Error('up:' + r.status);
  return path;                             // le chemin, pas l'adresse : elle se résout à l'affichage
}

/* ══════════ FSRS : recalcul depuis l'historique réel ══════════
   Le rejeu et l'optimisation eux-mêmes (`fsrsReplayAll`, le worker wasm)
   sont dans src/fsrs.js et src/ui/carte-media.js — ici ne reste que ce qui
   parle au serveur : aller chercher l'historique, puis appliquer. */
const OPT_MIN_REVIEWS = 400;

/* L'historique complet, sans la fenêtre d'un an des statistiques : le
   moteur apprend sur tout ce qu'on lui a donné depuis le début. */
async function histPull() {
  const out = [];
  for (let page = 0; page < 20; page++) {
    const rows = await api('/rest/v1/reviews?select=card_id,rating,created_at'
      + `&rating=not.is.null&order=created_at.asc&limit=10000&offset=${page * 10000}`);
    if (!rows || !rows.length) break;
    out.push(...rows);
    if (rows.length < 10000) break;
  }
  return out;
}

export async function fsrsTune(force) {
  if (optRunning) return 0;
  setOptRunning(1);
  try {
    const rows = await histPull();
    const n = rows.length;
    if (!force && n < OPT_MIN_REVIEWS) return 0;
    const items = fsrsItems(rows);
    if (items.lengths.length >= 64) {
      const w = await fsrsOptimize(items);
      if (w && (w.length === 21 || w.length === 34) && w.every(x => isFinite(x))) {
        prefs.w = w; prefs.wAt = Date.now(); prefs.wN = n;
        savePrefs();
      }
    }
    return fsrsReplay(rows) || 0;
  } catch (e) { return 0; }
  finally { setOptRunning(0); }
}
