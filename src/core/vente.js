/* ══════════ Mirandola+ : payer (2026-10-27 ; sorti de core/abonnement.js le 2026-11-16) ══════════
   Les gestes d'achat, chargés avec l'écran Mirandola+ (ui/plus.js) et
   jamais au démarrage : un élève qui révise ne paie pas, et le démarrage
   n'a plus d'octet à donner. Ce que le compte ouvre se lit toujours dans
   core/abonnement.js (offrePull), qui reste au démarrage.

   Payer ne se met pas en file d'attente (règle 5) : c'est un geste qui
   n'a de sens qu'en ligne, maintenant — hors ligne, l'écran le dit. */
import { auth, demoEtab, online } from '../data/etat.js';
import { CGV_VERSION, REVENUECAT } from '../abonnement.js';
import { paquetDe, prixDuMagasin } from '../magasin.js';
import { api } from './coeur-sync.js';
import { offrePull } from './abonnement.js';

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
export async function versStripe(action, formule, accord, promo) {
  if (demoEtab) throw new Error('demo');
  if (!online) throw new Error('hors');
  let r;
  // l'accord (conditions de vente et démarrage immédiat) ne voyage qu'avec un paiement
  const corps = action === 'payer' ? { action, formule, cgv: accord ? CGV_VERSION : null, promo: promo || undefined }
    : { action, formule };
  try { r = await api('/functions/v1/paiement', 'POST', corps); }
  catch (e) { throw new Error(codeDe(e), { cause: e }); }
  if (!r || typeof r.url !== 'string' || !/^https:\/\//.test(r.url) && !r.url.startsWith('/app?')) throw new Error('stripe');
  return r.url;
}

/* ---------- l'app des magasins : l'achat intégré, par RevenueCat ----------
   Le greffon @revenuecat/purchases-capacitor vit dans le morceau de l'app
   native (ui/natif.js), que seul le vrai pont de Capacitor charge : on l'y
   prend. Avant le 2026-11-16, on le cherchait sous Capacitor.Plugins, qui
   n'existe pas sans le JavaScript de @capacitor/core — l'achat n'aurait
   jamais trouvé son greffon. Un faux greffon posé là par un parcours de
   test passe encore en premier.

   Le compte RevenueCat est le compte Mirandola (appUserID) : l'achat suit
   l'élève d'un appareil à l'autre, et un autre compte sur le même
   téléphone n'hérite de rien. Après l'achat, la fonction magasins relit
   RevenueCat et écrit l'abonnement sans attendre son évènement. Les codes
   d'erreur sont ceux de src/abonnement.js (erreurDe). */
async function greffon() {
  const cap = /** @type {any} */ (window).Capacitor;
  if (cap && cap.Plugins && cap.Plugins.Purchases) return cap.Plugins.Purchases;
  if (!cap || !cap.isNativePlatform || !cap.isNativePlatform()) return null;
  try { return (await import('../ui/natif.js')).Purchases || null; }
  catch (e) { return null; }           // le morceau natif ne se charge pas : « bientôt », comme sans clé
}

/** @type {Promise<any> | null} */
let configure = null;
/** @type {string | null} */
let compteRC = null;

async function magasin(os) {
  if (demoEtab) throw new Error('demo');
  if (!online) throw new Error('hors');
  const cleRC = /** @type {Record<string, string>} */ (REVENUECAT)[os];
  if (!cleRC) throw new Error('bientot');
  const session = /** @type {any} */ (auth), uid = session && session.uid;
  if (!uid) throw new Error('auth');
  const P = await greffon();
  if (!P) throw new Error('bientot');
  try {
    if (!configure) configure = P.configure({ apiKey: cleRC, appUserID: uid }).catch((/** @type {any} */ e) => { configure = null; throw e; });
    await configure;
    // un autre compte ouvert depuis : l'achat doit aller au compte connecté maintenant
    if (compteRC !== uid) { await P.logIn({ appUserID: uid }); compteRC = uid; }
  } catch (e) { throw new Error('magasin', { cause: e }); }
  return P;
}

// relire l'abonné chez RevenueCat, puis ce que la base dit du compte
async function relireMagasin() {
  try { await api('/functions/v1/magasins', 'POST', {}); }
  catch (e) { /* l'évènement de RevenueCat écrira l'abonnement : l'écran relit la base quelques secondes */ }
  return offrePull();
}

/* Ce que le magasin vend et à quel prix, pour l'écran (null : on ne sait
   pas encore, ou le magasin ne répond pas — l'écran garde alors les prix
   du site, les mêmes en France). */
export async function prixMagasin(os) {
  try {
    const P = await magasin(os);
    return prixDuMagasin((await P.getOfferings() || {}).current);
  } catch (e) { return null; }
}

/* `formule` : l'une des quatre de src/abonnement.js — Mirandola+ ou Infini,
   à l'année ou au mois. Chacune a son paquet chez RevenueCat (paquetDe,
   src/natif.js) : avant le 2026-11-16, Infini achetait le paquet de
   Mirandola+. */
export async function versMagasin(os, formule) {
  const P = await magasin(os);
  let paquet;
  try { paquet = paquetDe((await P.getOfferings() || {}).current, formule); }
  catch (e) { throw new Error('magasin', { cause: e }); }
  if (!paquet) throw new Error('bientot');               // les produits pas encore créés dans les magasins
  try { await P.purchasePackage({ aPackage: paquet }); }
  catch (e) {
    const x = /** @type {any} */ (e);
    throw new Error(x && (x.userCancelled || String(x.code) === '1') ? 'annule' : 'magasin', { cause: e });
  }
  return relireMagasin();
}

// « Restaurer mes achats » (demandé par Apple) : un abonnement pris sur un autre appareil, ou avant une réinstallation
export async function restaurerAchats(os) {
  const P = await magasin(os);
  try { await P.restorePurchases(); } catch (e) { throw new Error('magasin', { cause: e }); }
  const o = /** @type {any} */ (await relireMagasin());
  if (!o || o.offre === 'gratuit') throw new Error('rien');
  return o;
}
