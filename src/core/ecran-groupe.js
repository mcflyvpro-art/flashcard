import { DAY } from '../fsrs.js';
import { setAnimate, stats, view } from '../data/etat.js';
import { render } from '../ui/bibliotheque.js';
import { api } from './coeur-sync.js';

/* ══════════ statistiques ══════════
   Tout se calcule à partir de la table des révisions : une ligne par
   carte jouée, avec la date, la réussite et le temps passé. Rien n'est
   pré-agrégé côté serveur — à l'échelle de quelques milliers de lignes,
   le navigateur va plus vite que l'aller-retour, et ça évite une vue SQL
   de plus à maintenir. */
export async function statsPull(bg) {
  try {
    const since = new Date(Date.now() - 365 * DAY).toISOString();
    const rows = await api('/rest/v1/reviews?select=deck_id,card_id,mode,rating,correct,ms,created_at'
      + `&created_at=gte.${since}&order=created_at.asc&limit=20000`);
    stats.rows = rows || [];
    stats.err = 0;
  } catch (e) { stats.err = 1; }
  /* Le rafraîchissement de fond ne redessine que si les chiffres ont
     bougé : sinon l'écran sautait toutes les quinze secondes pour rien. */
  const sig = (stats.rows || []).length + ':' + stats.err;
  const same = bg && sig === stats.sig;       // rafraîchissement de fond sans rien de neuf
  stats.sig = sig;
  if (view.name === 'stats' && !same) { setAnimate(false); render(); }
}
