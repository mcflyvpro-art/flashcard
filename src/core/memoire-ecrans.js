/* ══════════ ce que montraient « Mes amis » et « Classe » (2026-11-17) ══════════
   Demandé : « pourquoi les données chargent devant le user ? Pendant deux
   secondes, dans la communauté, des blocs gris ; tout doit être chargé et
   parfait, le user ne doit jamais rien voir arriver en direct ». La
   bibliothèque se gardait sur l'appareil, pas le cercle : à chaque ouverture,
   « Mes amis » attendait la base (son profil « … », 0 carte, des défis, des
   clubs et un classement gris), et la voisine glissée sous le doigt aussi.

   La dernière copie est gardée par compte (`folio.ecrans.<uid>`) et reprise
   avec la bibliothèque (load() de coeur-sync) : l'écran s'ouvre plein, la
   relecture de fond ne le repeint que si quelque chose a bougé. Jamais dans
   la démo, effacée à la déconnexion (ce sont des noms d'amis). Sans autre
   dépendance que l'état. */
import { auth, board, cercle, demoEtab, duels, eleve, friends, mates2, me,
  setAsks, setFriends, setMates, setMates2, setMe } from '../data/etat.js';

const cle = () => 'folio.ecrans.' + (auth && /** @type {any} */ (auth).uid);
let minuterie = 0;

/* Après une lecture : une seule écriture pour plusieurs lectures proches. */
export function retenir() {
  document.dispatchEvent(new Event('folio:donnees'));   // les voisines du balayage se referont (ui/balayage-geste.js)
  if (demoEtab || !auth || minuterie) return;
  minuterie = setTimeout(() => {
    minuterie = 0;
    if (!auth) return;
    const m = { v: 1, me, friends, defis: [duels.list, duels.scores], board: board.range === 7 ? board.rows : null,
      clubs: cercle.clubs, classes: [eleve.classes, eleve.devoirs], mates2 };
    try { localStorage.setItem(cle(), JSON.stringify(m)); } catch (e) { /* stockage plein : la prochaine ouverture relira la base, comme avant */ }
  }, 700);
}

/* Au démarrage et à la connexion : seulement ce qui n'est pas encore là. */
export function reprendre() {
  /** @type {any} */
  let m = null;
  try { m = JSON.parse(localStorage.getItem(cle()) || 'null'); } catch (e) { /* copie illisible : on attend la base */ }
  if (!m || m.v !== 1) return;
  reprendreAmis(m);
  reprendreListes(m);
}

/** @param {any} m */
function reprendreAmis(m) {
  if (!me && m.me) setMe(m.me);
  if (!mates2 && Array.isArray(m.mates2)) setMates2(m.mates2);
  if (friends || !Array.isArray(m.friends)) return;
  setFriends(m.friends);
  setMates(m.friends.filter((/** @type {any} */ f) => f.status === 'ok'));
  setAsks(m.friends.filter((/** @type {any} */ f) => f.status === 'pending' && f.sens === 'recue'));
}

/** @param {any} m */
function reprendreListes(m) {
  const [defis, scores] = m.defis || [], [classes, devoirs] = m.classes || [];
  if (!duels.list && defis) { duels.list = defis; duels.scores = scores || []; }
  if (!board.rows && m.board) { board.rows = m.board; board.sig = JSON.stringify(m.board) + ':0'; }
  if (cercle.clubs === null && Array.isArray(m.clubs)) cercle.clubs = m.clubs;
  if (!eleve.classes && classes) { eleve.classes = classes; eleve.devoirs = devoirs || []; }
}

export function oublier() {
  try { localStorage.removeItem(cle()); } catch (e) { /* stockage indisponible : rien à effacer */ }
}
