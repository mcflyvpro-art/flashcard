/* ══════════ Folio+ : ce qu'on dit à Stripe, ce qu'on retient de lui ══════════
   Partagé par les fonctions `paiement` et `stripe-webhook`, et testé par
   vitest (test/paiement.test.js) : rien ici ne touche au réseau ni à la
   base. Les fonctions ne font que transporter.

   Deux formes d'abonnement Stripe circulent selon la version d'API du
   compte : avant mars 2025, la période en cours est sur l'abonnement
   (`current_period_end`) ; depuis (« basil »), sur chacune de ses lignes.
   L'une ou l'autre est lue : rien ne casse le jour où le compte change de
   version. Même chose pour la facture, dont l'abonnement est passé sous
   `parent.subscription_details`. */

export const FORMULES = ['annuel', 'mensuel'];

/* Le statut Stripe → celui de la table abonnements. « past_due » : Stripe
   relance la carte pendant quelques jours, l'accès reste ouvert le temps
   des relances ; s'il renonce, l'abonnement passe « unpaid » ou
   « canceled » et se ferme. */
const STATUTS = {
  active: 'actif', trialing: 'essai', past_due: 'impaye', incomplete: 'incomplet',
  unpaid: 'fini', canceled: 'fini', incomplete_expired: 'fini', paused: 'fini'
};
export const statutDe = s => STATUTS[s] || 'fini';

/* Ce qui ouvre Folio+ : la même règle que abonnement_ouvre() en base. */
export const ouvre = (statut, fin, maintenant = Date.now()) =>
  ['actif', 'essai', 'impaye'].includes(statut) && (!fin || Date.parse(fin) > maintenant);

const ligne = sub => (sub && sub.items && sub.items.data && sub.items.data[0]) || null;

/* La formule : d'après l'identifiant du prix quand on le connaît (les prix
   de STRIPE_PRIX_ANNUEL et STRIPE_PRIX_MENSUEL), sinon d'après sa
   récurrence — un prix créé plus tard dans le tableau de bord de Stripe
   reste lisible. */
export function formuleDe(sub, prix = {}) {
  const p = (ligne(sub) || {}).price || {};
  if (p.id && p.id === prix.annuel) return 'annuel';
  if (p.id && p.id === prix.mensuel) return 'mensuel';
  const r = p.recurring && p.recurring.interval;
  return r === 'year' ? 'annuel' : r === 'month' ? 'mensuel' : null;
}

/* La fin de la période payée, en ISO. */
export function finPeriode(sub) {
  const s = (sub && sub.current_period_end) || (ligne(sub) || {}).current_period_end;
  return s ? new Date(s * 1000).toISOString() : null;
}

/* Le compte Folio d'un abonnement : posé dans ses métadonnées par la page
   de paiement (`subscription_data[metadata][user_id]`). */
export const compteDe = sub => (sub && sub.metadata && sub.metadata.user_id) || null;

const idDe = x => (x && typeof x === 'object' ? x.id : x) || null;

/* La ligne de la table abonnements que décrit un abonnement Stripe. */
export function ligneAbonnement(sub, userId, prix = {}, maintenant = Date.now()) {
  return {
    user_id: userId,
    offre: 'plus',
    statut: statutDe(sub.status),
    source: 'stripe',
    formule: formuleDe(sub, prix),
    client_stripe: idDe(sub.customer),
    abonnement_stripe: sub.id,
    fin_periode: finPeriode(sub),
    fin_prevue: !!(sub.cancel_at_period_end || sub.cancel_at),
    maj_le: new Date(maintenant).toISOString()
  };
}

/* Deux abonnements pour un même compte (il s'est réabonné après une
   résiliation) : les évènements de l'ancien peuvent arriver après ceux du
   nouveau. Celui qui a fini ne remplace jamais celui qui court. */
export function aEcrire(actuelle, nouvelle, maintenant = Date.now()) {
  if (!actuelle || actuelle.abonnement_stripe === nouvelle.abonnement_stripe) return true;
  if (actuelle.source && actuelle.source !== 'stripe' && ouvre(actuelle.statut, actuelle.fin_periode, maintenant)) return false;
  return !(ouvre(actuelle.statut, actuelle.fin_periode, maintenant) && !ouvre(nouvelle.statut, nouvelle.fin_periode, maintenant));
}

/* L'abonnement dont parle un évènement, quel qu'il soit. */
export function abonnementDe(ev) {
  const o = (ev && ev.data && ev.data.object) || {};
  if (ev.type === 'checkout.session.completed') return o.mode === 'subscription' ? idDe(o.subscription) : null;
  if (ev.type.startsWith('customer.subscription.')) return o.id || null;
  if (ev.type.startsWith('invoice.')) {
    return idDe(o.subscription) || idDe(o.parent && o.parent.subscription_details && o.parent.subscription_details.subscription);
  }
  return null;
}

/* Le compte qu'un évènement nomme lui-même (la page de paiement porte le
   compte dans client_reference_id) ; sinon, l'abonnement le dira. */
export function compteDeLEvenement(ev) {
  const o = (ev && ev.data && ev.data.object) || {};
  return o.client_reference_id || (o.metadata && o.metadata.user_id) || null;
}

export const EVENEMENTS = [
  'checkout.session.completed',
  'customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted',
  'customer.subscription.paused', 'customer.subscription.resumed',
  'invoice.paid', 'invoice.payment_failed'
];

/* ---------- la page de paiement de Stripe (Checkout) ----------
   Ce qu'on lui demande. `client` : l'identifiant Stripe déjà connu du
   compte (un ancien abonné), sinon son adresse — Stripe crée alors le
   client lui-même. `taxe` : Stripe Tax calcule la TVA du pays de l'acheteur
   (à activer dans son tableau de bord ; sinon, le prix affiché est le prix
   payé, TVA française comprise). `cgv` : faire cocher les conditions de
   vente (STRIPE_CGV=1, une fois leur adresse donnée à Stripe). */
export function demandePaiement({ formule, prix, userId, email, client, site, taxe, cgv }) {
  const d = {
    mode: 'subscription',
    'line_items[0][price]': prix,
    'line_items[0][quantity]': '1',
    client_reference_id: userId,
    'metadata[user_id]': userId,
    'metadata[formule]': formule,
    'subscription_data[metadata][user_id]': userId,
    success_url: `${site}/app?plus=merci&session={CHECKOUT_SESSION_ID}`,
    cancel_url: `${site}/app?plus=annule`,
    allow_promotion_codes: 'true',
    locale: 'fr',
    billing_address_collection: 'auto',
    'custom_text[submit][message]': 'Sans engagement : résiliable à tout moment, depuis Folio.'
  };
  /* l'adresse technique d'un élève à carte (…@eleves.folio.invalid) n'en
     est pas une : Stripe demandera la vraie sur sa page */
  if (client) d.customer = client; else if (email && !/\.invalid$/i.test(email)) d.customer_email = email;
  // les conditions de vente à cocher, une fois leur adresse posée dans Stripe (Paramètres → Détails publics)
  if (cgv) d['consent_collection[terms_of_service]'] = 'required';
  if (taxe) {
    d['automatic_tax[enabled]'] = 'true';
    if (client) d['customer_update[address]'] = 'auto';
  }
  return d;
}

/* Le portail de Stripe : changer de carte, de formule, résilier, ses factures. */
export const demandePortail = ({ client, site }) => ({ customer: client, return_url: `${site}/app?plus=retour` });

/* Stripe parle en formulaire, pas en JSON. */
export const formulaire = d => new URLSearchParams(Object.entries(d).filter(([, v]) => v != null && v !== '')).toString();

/* ---------- la signature d'un évènement ----------
   L'en-tête Stripe-Signature : « t=<horodatage>,v1=<signature>[,v1=…] ».
   La signature est un HMAC-SHA256 de « <t>.<corps brut> » avec le secret
   du point d'arrivée (whsec_…). Au-delà de cinq minutes, un évènement est
   refusé : on ne rejoue pas une requête interceptée. */
const octets = s => new TextEncoder().encode(s);
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');

function egales(a, b) {
  if (a.length !== b.length) return false;
  let x = 0;
  for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return x === 0;
}

export function lireSignature(entete) {
  const parts = String(entete || '').split(',').map(p => p.trim().split('='));
  const t = Number((parts.find(([k]) => k === 't') || [])[1]);
  const v1 = parts.filter(([k, v]) => k === 'v1' && v).map(([, v]) => v);
  return { t: Number.isFinite(t) && t > 0 ? t : null, v1 };
}

export async function signer(corps, secret, t) {
  const cle = await crypto.subtle.importKey('raw', octets(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', cle, octets(`${t}.${corps}`)));
}

export async function signatureValide(corps, entete, secret, maintenant = Date.now(), tolerance = 300) {
  const { t, v1 } = lireSignature(entete);
  if (!secret || !t || !v1.length) return false;
  if (Math.abs(maintenant / 1000 - t) > tolerance) return false;
  const attendue = await signer(corps, secret, t);
  return v1.some(s => egales(s, attendue));
}
