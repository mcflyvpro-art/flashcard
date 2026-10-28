/* ══════════ Mirandola+ : la base et la fonction de paiement (2026-10-27) ══════════
   Ce que ce compte ouvre se lit dans la base (mon_offre, migration
   20261027190000) ; payer et gérer passent par la fonction `paiement`
   (supabase/functions/paiement), qui rend l'adresse d'une page Stripe —
   l'app y envoie le navigateur, la carte ne passe jamais par Mirandola.

   Payer ne se met pas en file d'attente (règle 5) : c'est un geste qui
   n'a de sens qu'en ligne, maintenant — hors ligne, l'écran le dit. La
   réponse de mon_offre est gardée par compte (folio.offre.<uid>) pour
   s'afficher hors ligne ; jamais en démo, qui ne touche pas au stockage. */
import { auth, demoEtab, offre, online, plus, setOffre } from '../data/etat.js';
import { REVENUECAT, lireOffre } from '../abonnement.js';
import { api, apiPage } from './coeur-sync.js';

const cle = () => 'folio.offre.' + (auth && auth.uid);

function offreRangee() {
  try { return JSON.parse(localStorage.getItem(cle()) || 'null'); }
  catch (e) { return null; }           // stockage refusé : on redemandera à la base
}

/* Ce qu'on savait, au démarrage, avant que la base réponde : l'app se
   bride (ou se pare de Mirandola+) dès le premier écran, hors ligne compris. */
export function offreLocale() {
  if (!auth || demoEtab || offre) return;
  const r = offreRangee();
  if (r) setOffre(lireOffre(r));
}

/* Ce que la base dit du compte. Une base qui n'a pas encore la fonction
   (migration pas appliquée : 404) ou une coupure : ce qu'on savait, sinon
   RIEN — une offre inconnue ne bride pas (ui/bridage.js) ; jamais une
   erreur à l'écran pour ça. */
export async function offrePull() {
  if (!auth) return offre;
  try {
    const r = await api('/rest/v1/rpc/mon_offre', 'POST', {});
    if (!r || typeof r !== 'object' || Array.isArray(r)) throw new Error('mon_offre');
    setOffre(lireOffre(r));
    if (!demoEtab) {
      try { localStorage.setItem(cle(), JSON.stringify(r)); }
      catch (e) { /* stockage plein ou refusé : la prochaine ouverture redemandera */ }
    }
  } catch (e) {
    const r = demoEtab ? null : offreRangee();
    if (r) setOffre(lireOffre(r));
  }
  return offre;
}

/* Les cours mis en flashcards par l'IA ce mois-ci (2026-10-28), pour
   l'écran Mirandola+ : la table ai_usage, que chacun lit pour lui seul (RLS),
   le même compte que la fonction ai (une ligne par appel, depuis le 1er du
   mois en UTC). Rien si la base ne répond pas : l'écran tait la ligne. */
export async function iaMoisPull() {
  if (!auth || demoEtab) return null;
  const d = new Date(), debut = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().slice(0, 10);
  try {
    const r = await apiPage(`/rest/v1/ai_usage?select=id&day=gte.${debut}`, 0, 0);
    plus.ia = r ? r.total : null;
  } catch (e) { plus.ia = null; }       // hors ligne : la ligne de l'IA attendra la prochaine ouverture
  return plus.ia;
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

/* ---------- l'app des magasins : l'achat intégré, par RevenueCat ----------
   Le greffon @revenuecat/purchases-capacitor (docs/CAPACITOR.md) n'est pas
   une dépendance de l'app web : on le trouve sous Capacitor.Plugins une fois
   l'app native construite, et nulle part ailleurs. Le compte RevenueCat est
   le compte Mirandola (logIn) : l'achat suit l'élève d'un appareil à l'autre, et
   un autre compte sur le même téléphone n'hérite de rien. Après l'achat, la
   fonction magasins relit RevenueCat et écrit l'abonnement sans attendre son
   évènement. Les codes d'erreur sont ceux de src/abonnement.js (erreurDe). */
const greffon = () => {
  const cap = /** @type {any} */ (window).Capacitor;
  return (cap && cap.Plugins && cap.Plugins.Purchases) || null;
};
let configure = null;

async function magasin(os) {
  if (demoEtab) throw new Error('demo');
  if (!online) throw new Error('hors');
  const P = greffon(), cleRC = REVENUECAT[os];
  if (!P || !cleRC) throw new Error('bientot');
  try {
    if (!configure) configure = P.configure({ apiKey: cleRC, appUserID: auth.uid }).catch(e => { configure = null; throw e; });
    await configure;
    await P.logIn({ appUserID: auth.uid });
  } catch (e) { throw new Error('magasin', { cause: e }); }
  return P;
}

// relire l'abonné chez RevenueCat, puis ce que la base dit du compte
async function relireMagasin() {
  try { await api('/functions/v1/magasins', 'POST', {}); }
  catch (e) { /* l'évènement de RevenueCat écrira l'abonnement : l'écran relit la base quelques secondes */ }
  return offrePull();
}

export async function versMagasin(os, formule) {
  const P = await magasin(os);
  let paquet;
  try {
    const o = (await P.getOfferings() || {}).current;
    paquet = o && (formule === 'mensuel' ? o.monthly : o.annual);
  } catch (e) { throw new Error('magasin', { cause: e }); }
  if (!paquet) throw new Error('bientot');               // les produits pas encore créés dans les magasins
  try { await P.purchasePackage({ aPackage: paquet }); }
  catch (e) { throw new Error(e && (e.userCancelled || String(e.code) === '1') ? 'annule' : 'magasin', { cause: e }); }
  return relireMagasin();
}

// « Restaurer mes achats » (demandé par Apple) : un abonnement pris sur un autre appareil, ou avant une réinstallation
export async function restaurerAchats(os) {
  const P = await magasin(os);
  try { await P.restorePurchases(); } catch (e) { throw new Error('magasin', { cause: e }); }
  const o = await relireMagasin();
  if (!o || o.offre === 'gratuit') throw new Error('rien');
  return o;
}
