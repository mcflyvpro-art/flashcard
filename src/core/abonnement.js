/* ══════════ Folio+ : la base et la fonction de paiement (2026-10-27) ══════════
   Ce que ce compte ouvre se lit dans la base (mon_offre, migration
   20261027190000) ; payer et gérer passent par la fonction `paiement`
   (supabase/functions/paiement), qui rend l'adresse d'une page Stripe —
   l'app y envoie le navigateur, la carte ne passe jamais par Folio.

   Payer ne se met pas en file d'attente (règle 5) : c'est un geste qui
   n'a de sens qu'en ligne, maintenant — hors ligne, l'écran le dit. La
   réponse de mon_offre est gardée par compte (folio.offre.<uid>) pour
   s'afficher hors ligne ; jamais en démo, qui ne touche pas au stockage. */
import { auth, demoEtab, offre, online, setOffre } from '../data/etat.js';
import { lireOffre } from '../abonnement.js';
import { api } from './coeur-sync.js';

const cle = () => 'folio.offre.' + (auth && auth.uid);

function offreRangee() {
  try { return JSON.parse(localStorage.getItem(cle()) || 'null'); }
  catch (e) { return null; }           // stockage refusé : on redemandera à la base
}

/* Ce que la base dit du compte. Une base qui n'a pas encore la fonction
   (migration pas appliquée : 404) ou une coupure : ce qu'on savait, sinon
   Folio gratuit — jamais une erreur à l'écran pour ça. */
export async function offrePull() {
  if (!auth) return offre;
  try {
    const r = await api('/rest/v1/rpc/mon_offre', 'POST', {});
    setOffre(lireOffre(r));
    if (!demoEtab) {
      try { localStorage.setItem(cle(), JSON.stringify(r)); }
      catch (e) { /* stockage plein ou refusé : la prochaine ouverture redemandera */ }
    }
  } catch (e) {
    setOffre(lireOffre(demoEtab ? null : offreRangee()));
  }
  return offre;
}

/* Le code d'erreur de la fonction : son corps le dit ({ error }) ; une
   fonction pas encore déployée répond 404 sans corps — « bientôt ». */
function codeDe(e) {
  let code = '';
  try { code = JSON.parse(e.message).error || ''; } catch (x) { /* pas du JSON : la page d'erreur du serveur */ }
  if (code) return code;
  if (e.status === 404) return 'bientot';
  if (e.status === 401) return 'auth';
  return navigator.onLine === false ? 'hors' : 'stripe';
}

/* `action` : « payer » (avec la formule) ou « gerer ». Rend l'adresse de la
   page Stripe ; sinon lève une Error dont le message est un code de
   src/abonnement.js (erreurDe). */
export async function versStripe(action, formule) {
  if (demoEtab) throw new Error('demo');
  if (!online) throw new Error('hors');
  let r;
  try { r = await api('/functions/v1/paiement', 'POST', { action, formule }); }
  catch (e) { throw new Error(codeDe(e), { cause: e }); }
  if (!r || typeof r.url !== 'string' || !/^https:\/\//.test(r.url) && !r.url.startsWith('/app?')) throw new Error('stripe');
  return r.url;
}
