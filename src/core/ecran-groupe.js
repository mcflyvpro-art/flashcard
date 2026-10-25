import { DAY } from '../fsrs.js';
import { auth, setAnimate, stats, view } from '../data/etat.js';
import { render } from '../ui/bibliotheque.js';
import { PALIERS, restantsApres } from '../journal.js';
import { api } from './coeur-sync.js';

/* ══════════ le journal de lecture ══════════
   La base compte (fonction journal(), migration 20261025170855) : une année
   de révisions regroupées par jour, matière, livre et palier — jamais les
   lignes une à une, qui dépassaient les 1 000 que PostgREST accepte de
   rendre (le journal restait figé sur les plus anciennes). L'appareil, lui,
   garde les révisions qu'il a faites tant qu'il ne les a pas vues revenir
   (`stats.locaux`) : le journal les montre à la seconde où on lit, hors
   ligne compris, et la base dit à chaque lecture lesquelles elle a déjà.
   Les calculs vivent dans src/journal.js. Réponse et révisions locales se
   gardent par compte (`folio.journal.<uid>`) : rouvert hors ligne, le
   journal montre la dernière réponse et ce qu'on a lu depuis. */
const JOURS = 400;                 // une année pleine, plus la marge de la grille

const cle = () => 'folio.journal.' + auth.uid;

/* Le journal du compte ouvert, chargé du stockage local au premier besoin :
   changer de compte vide `stats` (resetSession), la clé change avec. */
function charger() {
  if (stats.uid === auth.uid) return;
  stats.uid = auth.uid; stats.rep = null; stats.locaux = [];
  if (!auth.uid) return;
  try {
    const o = JSON.parse(localStorage.getItem(cle()) || 'null');
    if (o) { stats.rep = o.rep || null; stats.locaux = Array.isArray(o.locaux) ? o.locaux : []; }
  } catch (e) { /* stockage illisible : le journal se relira du serveur, rien n'est perdu côté base */ }
}

function garder() {
  if (!auth.uid) return;
  try { localStorage.setItem(cle(), JSON.stringify({ rep: stats.rep, locaux: stats.locaux.slice(-5000) })); }
  catch (e) { /* stockage plein ou bloqué : la base garde tout, seule la lecture hors ligne en pâtit */ }
}

export function journalLocal() { charger(); return stats; }

/* Une révision vient d'être jouée : elle compte tout de suite. */
export function noterLocale(row) {
  charger();
  stats.locaux.push({ client_id: row.client_id, created_at: row.created_at, deck_id: row.deck_id,
    subject: row.subject || '', correct: !!row.correct, ms: row.ms || 0, ecart: row.ecart });
  garder();
}

/* La base a refusé la ligne pour de bon (4xx) : elle n'arrivera jamais,
   elle ne doit plus compter. */
export function oublierLocale(clientId) {
  charger();
  const n = stats.locaux.length;
  stats.locaux = stats.locaux.filter(r => r.client_id !== clientId);
  if (stats.locaux.length !== n) garder();
}

const fuseau = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch (e) { return 'UTC'; } };

export async function statsPull(bg) {
  charger();
  try {
    const rep = await api('/rest/v1/rpc/journal', 'POST', {
      p_depuis: new Date(Date.now() - JOURS * DAY).toISOString(), p_tz: fuseau(), p_bornes: PALIERS,
      p_locaux: stats.locaux.map(r => r.client_id)
    });
    if (rep && Array.isArray(rep.jours)) {
      stats.rep = rep;
      stats.locaux = restantsApres(stats.locaux, rep.connus);
      stats.err = 0;
      garder();
    } else stats.err = 1;
  } catch (e) { stats.err = 1; }
  /* Le rafraîchissement de fond ne redessine que si les chiffres ont
     bougé : sinon l'écran sautait toutes les quinze secondes pour rien. */
  const t = stats.rep && stats.rep.toujours;
  const sig = (t ? t.n + ':' + t.ms : '-') + ':' + stats.locaux.length + ':' + stats.err;
  const same = bg && sig === stats.sig;
  stats.sig = sig;
  if (view.name === 'stats' && !same) { setAnimate(false); render(); }
}
