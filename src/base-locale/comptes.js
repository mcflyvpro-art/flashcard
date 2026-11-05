// La console de l'éditeur sur tous les comptes (migration 20261105122753),
// rejouée en mémoire pour les parcours : admin_comptes (de quoi trier),
// admin_supprimer_compte, admin_suspendre, admin_confirmer. On émule ce que
// l'app appelle et lit ; la sécurité se prouve en base
// (supabase/tests/editeur_comptes.sql). Un compte suspendu (`suspendu` sur
// la ligne de `store.users`) est refusé à la connexion par serveur.js,
// comme Supabase Auth refuse un `banned_until` à venir. Branché par
// e2e/faux-supabase.js devant serveur.js, comme securite.js : la démo sans
// compte n'a pas d'éditeur, elle ne le charge pas (son poids est compté).
import { modele } from './classes.js';
import { userOf } from './serveur.js';
import { etab, orgDe } from './etablissement.js';
import { offreDe } from './abonnements.js';

const refus = (message, code = 'P0001') => [400, { code, message }];
const t = (store, nom) => store.tables[nom] || [];
const DEPUIS = Date.now();

function ligne(store, m, et, u) {
  const p = t(store, 'profiles').find(x => x.id === u.id) || {};
  const revs = t(store, 'reviews').filter(r => r.user_id === u.id);
  const revise = revs.reduce((x, r) => (r.created_at > x ? r.created_at : x), '') || null;
  const o = orgDe(et, u.id);
  const suspendu = u.suspendu && Date.parse(u.suspendu) > Date.now() ? u.suspendu : null;
  return {
    id: u.id, email: u.email, handle: p.handle || '', name: m.noms[u.id] || p.name || '', role: m.roles[u.id] || 'eleve',
    cree: u.cree || new Date(DEPUIS).toISOString(), vu: u.vu || null, confirme: u.confirme !== false, suspendu,
    provisoire: false, google: false, deux_etapes: (u.facteurs || []).some(f => f.status === 'verified'),
    livres: t(store, 'decks').filter(d => d.user_id === u.id && !d.deleted_at).length,
    cartes: t(store, 'cards').filter(c => c.user_id === u.id).length,
    revisions: revs.length, revise, offre: offreDe(store, u.id), etablissement: o ? o.nom : null
  };
}

// tout ce qui porte son identifiant part avec lui, comme les cascades de la base
function effacer(store, m, et, id) {
  store.users = store.users.filter(u => u.id !== id);
  for (const [k, l] of Object.entries(store.tables)) {
    if (Array.isArray(l)) store.tables[k] = l.filter(r => r.user_id !== id && !(k === 'profiles' && r.id === id));
  }
  delete m.roles[id]; delete m.noms[id]; delete et.membres[id];
}

const NOMS = ['admin_comptes', 'admin_supprimer_compte', 'admin_suspendre', 'admin_confirmer'];

export function repondreComptes(store, { url, headers, body }) {
  const nom = url.pathname.replace('/rest/v1/rpc/', '');
  if (!url.pathname.startsWith('/rest/v1/rpc/') || !NOMS.includes(nom)) return null;
  const user = userOf(store, { headers });
  return user ? rpcComptes(store, nom, user, body || {}) : [401, { message: 'JWT expired' }];
}

function rpcComptes(store, nom, user, b) {
  const m = modele(store), et = etab(store);
  if (m.roles[user.id] !== 'admin') return refus('Réservé à l’éditeur', '42501');
  if (nom === 'admin_comptes') {
    return [200, store.users.map(u => ligne(store, m, et, u)).sort((x, y) => y.cree.localeCompare(x.cree))];
  }
  const cible = store.users.find(u => u.id === b.cible);
  if (nom === 'admin_supprimer_compte') {
    if (b.cible === user.id) return refus('Ton propre compte se supprime depuis tes Réglages');
    if (!cible) return refus('Ce compte n’existe plus');
    const stripe = t(store, 'abonnements').some(a => a.user_id === b.cible && a.source === 'stripe' && !a.fin_prevue
      && ['actif', 'essai', 'impaye'].includes(a.statut));
    if (stripe) return refus('Son abonnement Mirandola+ court chez Stripe : résilie-le d’abord dans Stripe, sinon il continuerait d’être prélevé');
    effacer(store, m, et, b.cible);
    return [200, null];
  }
  if (nom === 'admin_suspendre') {
    if (b.cible === user.id) return refus('On ne se suspend pas soi-même');
    if (b.jusqua && Date.parse(b.jusqua) <= Date.now()) return refus('Une date à venir');
    if (!cible) return refus('Ce compte n’existe plus');
    cible.suspendu = b.jusqua || null;
    return [200, b.jusqua || null];
  }
  if (!cible) return refus('Ce compte n’existe plus');
  cible.confirme = true;
  return [200, null];
}
