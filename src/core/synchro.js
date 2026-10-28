/* ══════════ la bibliothèque d'un autre appareil, sans recharger (2026-10-28) ══════════
   Jusqu'ici la bibliothèque ne se relisait qu'à l'ouverture de l'app : une
   page ajoutée sur le téléphone n'apparaissait sur l'ordinateur qu'après un
   rechargement — et l'ordinateur, resté sur l'ancienne version, écrivait
   ensuite par-dessus : la boîte de conflit.

   Un coup d'œil léger (ui/synchro-ecran.js le lance au retour sur l'app et
   une fois par minute tant qu'on s'en sert) : ce qui attend part d'abord
   (flush), puis le numéro de révision de chaque livre (quelques octets
   par livre), les matières, le courrier non lu et les pages lues
   aujourd'hui. Ce qui a bougé ailleurs est relu — les seuls livres qui
   ont changé (src/synchro.js dit lesquels), en deux requêtes par paquet
   de quarante. Rien ne se relit tant qu'un envoi attend : la fusion à
   trois le réglera à l'envoi.

   Jamais la relecture complète de l'ouverture (pull) : elle relit tout le
   compte, et repasse par cerclePull(), qui repeint l'écran quel qu'il soit
   — un écran en cours de saisie se redessinerait sous les doigts. Et rien
   ne se pose tant que `garde()` (l'écran, ui/synchro-ecran.js) ne le
   permet pas : une page en cours de modification tient une carte par son
   adresse. */
import { auth, bases, db, demoEtab, dirty, gone, mailbox, online, outbox } from '../data/etat.js';
import { ecarts, fusionnerMatieres, rangerLivres, signatureMatieres } from '../synchro.js';
import { CARDS_SELECT, api, apiAll, apiPage, cardsParDeck, flush, pushSubject, save, saveBases, snapOf } from './coeur-sync.js';

const PAQUET = 40;                                   // des identifiants dans l'adresse : elle doit rester courte
let enCours = null;

const enAttente = () => Object.keys(dirty).length + gone.length + outbox.length > 0;

async function lire(ids) {
  const lus = [];
  for (let i = 0; i < ids.length; i += PAQUET) {
    const liste = ids.slice(i, i + PAQUET).map(encodeURIComponent).join(',');
    const [rows, cartes] = await Promise.all([
      api(`/rest/v1/decks?id=in.(${liste})&deleted_at=is.null&select=id,name,subject,hidden,pos,pinned,meta,rev`),
      apiAll(`/rest/v1/cards?deck_id=in.(${liste})&select=${CARDS_SELECT}`)
    ]);
    const parLivre = cardsParDeck(cartes || []);
    for (const r of rows || []) {
      lus.push({ id: r.id, name: r.name, subject: r.subject, hidden: !!r.hidden, pos: r.pos,
        pinned: !!r.pinned, meta: r.meta || {}, rev: r.rev, cards: parLivre.get(r.id) || [] });
    }
  }
  return lus;
}

function poser(frais) {
  if (dirty[frais.id]) return;                       // modifié ici pendant la lecture : la fusion tranchera
  const i = db.decks.findIndex(d => d.id === frais.id);
  if (i >= 0) db.decks[i] = frais; else db.decks.push(frais);
  bases[frais.id] = snapOf(frais, frais.rev);
}

/* Le courrier non lu et les pages du jour : la pastille et l'objectif. */
function compteurs(n, auj, minuit) {
  let bouge = false;
  if (n !== mailbox.n) { mailbox.n = n; bouge = true; }
  if (auj && (!db.today || db.today.d !== minuit || db.today.n !== auj.total)) {
    db.today = { d: minuit, n: auj.total }; bouge = true;
  }
  return bouge;
}

async function regarder(garde) {
  await flush();
  if (enAttente()) return false;                     // hors ligne, ou un conflit à trancher : on réessaiera
  const minuit = new Date(); minuit.setHours(0, 0, 0, 0);
  const [rows, matieres, nonLus, auj] = await Promise.all([
    api('/rest/v1/decks?select=id,rev&deleted_at=is.null'),
    api('/rest/v1/subjects?select=id,name,color,pos'),
    api('/rest/v1/mail?select=id&read_at=is.null'),
    apiPage(`/rest/v1/reviews?select=id&created_at=gte.${minuit.toISOString()}`, 0, 0)
  ]);
  const bouge = compteurs((nonLus || []).length, auj, +minuit);
  const autresMatieres = matieres && signatureMatieres(matieres) !== signatureMatieres(db.subjects);
  const { changes, partis } = ecarts(rows || [], db.decks, dirty);
  if (!autresMatieres && !changes.length && !partis.length) return bouge;
  const frais = changes.length ? await lire(changes) : [];
  if (!garde() || enAttente()) return false;         // on s'est mis à écrire entre-temps : au prochain coup d'œil
  if (autresMatieres) {
    const { matieres: m, aRenvoyer } = fusionnerMatieres(matieres, db.subjects, db.decks);
    db.subjects = m;
    aRenvoyer.forEach(pushSubject);
  }
  frais.forEach(poser);
  db.decks = rangerLivres(db.decks.filter(d => !partis.includes(d.id) || dirty[d.id]));
  saveBases(); save();
  return true;
}

/* Rend vrai si l'écran doit se repeindre. Jamais dans la démo : elle n'a
   qu'un appareil, et sa base vit dans l'onglet. */
export function syncBibliotheque(garde = () => true) {
  if (!auth || demoEtab || !online) return Promise.resolve(false);
  if (!enCours) {
    enCours = regarder(garde)
      .catch(() => false)                            // réseau capricieux : le prochain coup d'œil réessaiera
      .finally(() => { enCours = null; });
  }
  return enCours;
}
