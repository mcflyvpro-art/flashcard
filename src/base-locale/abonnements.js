/* Mirandola+ dans la base locale (2026-10-27) : mon_offre(), comme les
   migrations 20261027190000 et 20261027210000 (une ligne par source), et
   les fonctions `paiement` et `magasins` jouées sans Stripe ni RevenueCat —
   pour les parcours (e2e/folio-plus.e2e.js) et la démo, qui n'appelle
   jamais une fonction (core/abonnement.js refuse d'emblée).

   `store.parDefaut` : l'offre d'un compte sans aucune ligne. « gratuit »,
   comme un compte créé après le 2026-10-27 ; les parcours e2e passent
   « plus » (e2e/faux-supabase.js) : leurs comptes sont ceux d'avant, qui
   ont reçu Mirandola+ offert — un parcours qui essaie Mirandola gratuit le dit.

   La page de paiement de Stripe n'existe pas ici : « payer » écrit
   l'abonnement comme le ferait stripe-webhook, puis rend l'adresse de
   retour de Stripe. `store.paiement` règle ce que répond la fonction :
   absent → payé ; 'absent' → 404 (fonction pas encore déployée) ; un code
   (nokey, stripe…) → cette erreur ; 'lent' → payé, mais l'abonnement ne
   s'écrit qu'à la troisième lecture de mon_offre (un webhook en retard). */
import { etab, orgDe } from './etablissement.js';
import { modele } from './classes.js';
import { campusProf, licences } from './licences.js';

const table = store => (store.tables.abonnements = store.tables.abonnements || []);
const ouvre = a => ['actif', 'essai', 'impaye'].includes(a.statut) && (!a.fin_periode || Date.parse(a.fin_periode) > Date.now());
const aujourdhui = () => new Date().toISOString().slice(0, 10);

/* l'abonnement que dit mon_offre() : celui qui court (le plus lointain),
   sinon le dernier touché */
const rang = a => (ouvre(a) ? 2e15 : 0) + (a.fin_periode ? Date.parse(a.fin_periode) / 1e3 : 1e12);
const lignesDe = (store, uid) => table(store).filter(x => x.user_id === uid).sort((a, b) => rang(b) - rang(a));

function campusDe(store, uid) {
  const o = orgDe(etab(store), uid);
  return !!o && (!o.fin || o.fin >= aujourdhui()) ? o : null;
}

// offre_de(), interne en base : ici aussi pour visuels()
export function offreDe(store, uid) {
  if (campusDe(store, uid) || campusProf(store, uid)) return 'campus';
  const l = lignesDe(store, uid);
  if (!l.length) return store.parDefaut === 'plus' ? 'plus' : 'gratuit';
  return ouvre(l[0]) ? 'plus' : 'gratuit';
}

export function monOffre(store, uid) {
  if (store.enRetard && store.enRetard.uid === uid && --store.enRetard.n <= 0) {
    table(store).push(store.enRetard.ligne);
    store.enRetard = null;
  }
  const o = campusDe(store, uid), campus = !!o, p = campus ? null : campusProf(store, uid);
  // un compte d'avant le 2026-10-27 : la ligne « offert » que la migration lui a donnée
  const a = lignesDe(store, uid)[0] || (store.parDefaut === 'plus'
    ? { statut: 'actif', formule: null, source: 'offert', fin_periode: null, fin_prevue: false } : null);
  return {
    offre: offreDe(store, uid),
    etablissement: campus ? o.nom : null,
    // le professeur particulier dont la licence ouvre Campus (20261029090000) ; pas pour lui-même
    professeur: p && p !== uid ? modele(store).noms[p] || 'Ton professeur' : null,
    licence_fin: campus ? o.fin || null : p ? licences(store).profs[p].fin || null : null,
    abonnement: a ? { statut: a.statut, formule: a.formule, source: a.source, fin_periode: a.fin_periode, fin_prevue: a.fin_prevue,
      montant: a.montant ?? null } : null
  };
}

/* admin_offrir_plus : la ligne « offert », comme en base */
function offrir(store, b, user) {
  if (modele(store).roles[user.id] !== 'admin') return [400, { code: '42501', message: 'Réservé à l’éditeur' }];
  if (!store.users.some(u => u.id === b.cible)) return [400, { code: '22023', message: 'Compte inconnu' }];
  store.tables.abonnements = table(store).filter(x => !(x.user_id === b.cible && x.source === 'offert'));
  table(store).push({ user_id: b.cible, offre: 'plus', statut: b.retirer ? 'fini' : 'actif', source: 'offert', formule: null,
    fin_periode: b.retirer ? new Date().toISOString() : b.jusqua || null, fin_prevue: false });
  return [200, { offre: offreDe(store, b.cible) }];
}

export function rpcAbonnements(store, nom, user, body) {
  if (nom === 'mon_offre') return [200, monOffre(store, user.id)];
  if (nom === 'admin_offrir_plus') return offrir(store, body || {}, user);
  return null;
}

// une ligne par source : écrire celle-là remplace l'ancienne de la même source
function ecrire(store, ligne) {
  store.tables.abonnements = table(store).filter(x => !(x.user_id === ligne.user_id && x.source === ligne.source));
  table(store).push(ligne);
}

function payer(store, b, uid) {
  if (!['annuel', 'mensuel'].includes(b.formule)) return [400, { error: 'formule' }];
  const offre = offreDe(store, uid);
  if (offre === 'plus') return [409, { error: 'deja' }];
  if (offre === 'campus') return [409, { error: 'campus' }];
  const ligne = { user_id: uid, offre: 'plus', statut: 'actif', source: 'stripe', formule: b.formule,
    client_stripe: 'cus_' + uid.slice(0, 8), abonnement_stripe: 'sub_' + uid.slice(0, 8),
    fin_periode: new Date(Date.now() + (b.formule === 'annuel' ? 365 : 31) * 864e5).toISOString(), fin_prevue: false,
    montant: b.formule === 'annuel' ? 4999 : 699 };
  store.tables.abonnements = table(store).filter(x => !(x.user_id === uid && x.source === 'stripe'));
  if (store.paiement === 'lent') store.enRetard = { uid, ligne, n: 3 };
  else ecrire(store, ligne);
  return [200, { url: '/app?plus=merci&session=cs_test_local' }];
}

export function paiementFaux(store, body, user) {
  if (store.paiement === 'absent') return [404, null];
  if (store.paiement && store.paiement !== 'lent') return [503, { error: store.paiement }];
  const b = body || {};
  if (b.action === 'gerer' || b.action === 'resilier') {
    const a = table(store).find(x => x.user_id === user.id && x.source === 'stripe');
    if (!a || !a.client_stripe) return [404, { error: 'aucun' }];
    if (b.action === 'resilier') a.fin_prevue = true;   // le portail de Stripe, résilié d'un geste (le webhook l'écrirait)
    return [200, { url: '/app?plus=retour' }];
  }
  return b.action === 'payer' ? payer(store, b, user.id) : [400, { error: 'body' }];
}

/* La fonction `magasins`, au retour d'un achat dans l'app des magasins :
   `store.magasin` tient ce que RevenueCat dirait de l'abonné ({ source,
   formule }) ; la ligne s'écrit comme la vraie fonction l'écrirait. */
export function magasinsFaux(store, body, user) {
  if (store.paiement === 'absent') return [404, null];
  const m = store.magasin && store.magasin[user.id];
  if (!m) return [200, { ok: true, ecrit: false }];
  ecrire(store, { user_id: user.id, offre: 'plus', statut: 'actif', source: m.source, formule: m.formule,
    fin_periode: new Date(Date.now() + 365 * 864e5).toISOString(), fin_prevue: false });
  return [200, { ok: true, ecrit: true }];
}
