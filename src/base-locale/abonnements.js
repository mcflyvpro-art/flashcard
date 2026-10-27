/* Folio+ dans la base locale (2026-10-27) : mon_offre(), comme la migration
   20261027190000, et la fonction `paiement` jouée sans Stripe — pour les
   parcours (e2e/folio-plus.e2e.js) et la démo, qui n'appelle jamais la
   fonction (core/abonnement.js refuse d'emblée).

   La page de paiement de Stripe n'existe pas ici : « payer » écrit
   l'abonnement comme le ferait stripe-webhook, puis rend l'adresse de
   retour de Stripe. `store.paiement` règle ce que répond la fonction :
   absent → payé ; 'absent' → 404 (fonction pas encore déployée) ; un code
   (nokey, stripe…) → cette erreur ; 'lent' → payé, mais l'abonnement ne
   s'écrit qu'à la troisième lecture de mon_offre (un webhook en retard). */
import { etab, orgDe } from './etablissement.js';

const table = store => (store.tables.abonnements = store.tables.abonnements || []);
const ouvre = a => ['actif', 'essai', 'impaye'].includes(a.statut) && (!a.fin_periode || Date.parse(a.fin_periode) > Date.now());
const aujourdhui = () => new Date().toISOString().slice(0, 10);

export function monOffre(store, uid) {
  if (store.enRetard && store.enRetard.uid === uid && --store.enRetard.n <= 0) {
    table(store).push(store.enRetard.ligne);
    store.enRetard = null;
  }
  const o = orgDe(etab(store), uid);
  const campus = !!o && (!o.fin || o.fin >= aujourdhui());
  const a = table(store).find(x => x.user_id === uid);
  return {
    offre: campus ? 'campus' : a && ouvre(a) ? 'plus' : 'gratuit',
    etablissement: campus ? o.nom : null,
    licence_fin: campus ? o.fin || null : null,
    abonnement: a ? { statut: a.statut, formule: a.formule, source: a.source, fin_periode: a.fin_periode, fin_prevue: a.fin_prevue } : null
  };
}

export function rpcAbonnements(store, nom, user) {
  return nom === 'mon_offre' ? [200, monOffre(store, user.id)] : null;
}

function payer(store, b, uid) {
  if (!['annuel', 'mensuel'].includes(b.formule)) return [400, { error: 'formule' }];
  const a = table(store).find(x => x.user_id === uid);
  if (a && ouvre(a)) return [409, { error: 'deja' }];
  if (monOffre(store, uid).offre === 'campus') return [409, { error: 'campus' }];
  const ligne = { user_id: uid, offre: 'plus', statut: 'actif', source: 'stripe', formule: b.formule,
    client_stripe: 'cus_' + uid.slice(0, 8), abonnement_stripe: 'sub_' + uid.slice(0, 8),
    fin_periode: new Date(Date.now() + (b.formule === 'annuel' ? 365 : 31) * 864e5).toISOString(), fin_prevue: false };
  store.tables.abonnements = table(store).filter(x => x.user_id !== uid);
  if (store.paiement === 'lent') store.enRetard = { uid, ligne, n: 3 };
  else table(store).push(ligne);
  return [200, { url: '/app?plus=merci&session=cs_test_local' }];
}

export function paiementFaux(store, body, user) {
  if (store.paiement === 'absent') return [404, null];
  if (store.paiement && store.paiement !== 'lent') return [503, { error: store.paiement }];
  const b = body || {};
  if (b.action === 'gerer') {
    const a = table(store).find(x => x.user_id === user.id);
    return a && a.client_stripe ? [200, { url: '/app?plus=retour' }] : [404, { error: 'aucun' }];
  }
  return b.action === 'payer' ? payer(store, b, user.id) : [400, { error: 'body' }];
}
