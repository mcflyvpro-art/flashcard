// Folio+ : ce que les fonctions paiement et stripe-webhook disent à Stripe
// et retiennent de lui (supabase/functions/_shared/abonnement.js).
import { describe, expect, it } from 'vitest';
import {
  aEcrire, abonnementDe, autorise, compteDeLEvenement, comptesDeLEvenementRC, demandePaiement, demandePortail, finPeriode,
  formuleDe, formuleDuProduit, formulaire, ligneAbonnement, ligneMagasin, lireSignature, ouvre, signatureValide, signer, statutDe
} from '../supabase/functions/_shared/abonnement.js';

const PRIX = { annuel: 'price_an', mensuel: 'price_mois' };
const MAINTENANT = Date.parse('2026-11-01T10:00:00Z');
const sec = iso => Math.floor(Date.parse(iso) / 1000);

// un abonnement Stripe d'avant mars 2025 (période sur l'abonnement)…
const ancien = {
  id: 'sub_1', status: 'active', customer: 'cus_1', cancel_at_period_end: false, cancel_at: null,
  current_period_end: sec('2027-11-01T10:00:00Z'), metadata: { user_id: 'u1' },
  items: { data: [{ price: { id: 'price_an', recurring: { interval: 'year' } } }] }
};
// …et d'après (« basil » : la période est sur la ligne)
const basil = {
  id: 'sub_2', status: 'past_due', customer: { id: 'cus_2' }, cancel_at_period_end: false, cancel_at: sec('2026-12-01T10:00:00Z'),
  metadata: { user_id: 'u2' },
  items: { data: [{ current_period_end: sec('2026-12-01T10:00:00Z'), price: { id: 'price_autre', recurring: { interval: 'month' } } }] }
};

describe('un abonnement Stripe devient une ligne de la table abonnements', () => {
  it('les statuts', () => {
    expect(statutDe('active')).toBe('actif');
    expect(statutDe('trialing')).toBe('essai');
    expect(statutDe('past_due')).toBe('impaye');
    expect(statutDe('incomplete')).toBe('incomplet');
    for (const s of ['canceled', 'unpaid', 'incomplete_expired', 'paused', 'inconnu', undefined]) expect(statutDe(s)).toBe('fini');
  });

  it('la formule : par le prix connu, sinon par sa récurrence', () => {
    expect(formuleDe(ancien, PRIX)).toBe('annuel');
    expect(formuleDe(basil, PRIX)).toBe('mensuel');
    expect(formuleDe({ items: { data: [] } }, PRIX)).toBeNull();
  });

  it('la fin de période, dans les deux formes d’API', () => {
    expect(finPeriode(ancien)).toBe('2027-11-01T10:00:00.000Z');
    expect(finPeriode(basil)).toBe('2026-12-01T10:00:00.000Z');
    expect(finPeriode({})).toBeNull();
  });

  it('la ligne entière', () => {
    expect(ligneAbonnement(ancien, 'u1', PRIX, MAINTENANT)).toEqual({
      user_id: 'u1', offre: 'plus', statut: 'actif', source: 'stripe', formule: 'annuel', client_stripe: 'cus_1',
      abonnement_stripe: 'sub_1', fin_periode: '2027-11-01T10:00:00.000Z', fin_prevue: false, maj_le: '2026-11-01T10:00:00.000Z'
    });
    const l = ligneAbonnement(basil, 'u2', PRIX, MAINTENANT);
    expect(l.client_stripe).toBe('cus_2');           // un client développé (objet) ou un simple identifiant
    expect(l.fin_prevue).toBe(true);                 // une résiliation datée (cancel_at)
    expect(l.statut).toBe('impaye');
  });

  it('ce qui ouvre Folio+ : la même règle que la base', () => {
    expect(ouvre('actif', '2027-01-01T00:00:00Z', MAINTENANT)).toBe(true);
    expect(ouvre('impaye', '2027-01-01T00:00:00Z', MAINTENANT)).toBe(true);
    expect(ouvre('actif', '2026-10-01T00:00:00Z', MAINTENANT)).toBe(false);
    expect(ouvre('incomplet', null, MAINTENANT)).toBe(false);
    expect(ouvre('fini', null, MAINTENANT)).toBe(false);
  });
});

describe('deux abonnements pour un compte : l’ancien ne remplace jamais celui qui court', () => {
  const court = { abonnement_stripe: 'sub_neuf', statut: 'actif', source: 'stripe', fin_periode: '2027-11-01T00:00:00Z' };
  it('un évènement tardif de l’ancien abonnement, fini, est ignoré', () => {
    expect(aEcrire(court, { abonnement_stripe: 'sub_vieux', statut: 'fini', fin_periode: '2026-10-01T00:00:00Z' }, MAINTENANT)).toBe(false);
  });
  it('le même abonnement, ou un nouveau qui court, s’écrit', () => {
    expect(aEcrire(court, { ...court, statut: 'fini' }, MAINTENANT)).toBe(true);
    expect(aEcrire(court, { abonnement_stripe: 'sub_autre', statut: 'actif', fin_periode: '2028-01-01T00:00:00Z' }, MAINTENANT)).toBe(true);
    expect(aEcrire(null, { abonnement_stripe: 'sub_1', statut: 'incomplet' }, MAINTENANT)).toBe(true);
    expect(aEcrire({ ...court, statut: 'fini', fin_periode: '2026-01-01T00:00:00Z' },
      { abonnement_stripe: 'sub_x', statut: 'incomplet' }, MAINTENANT)).toBe(true);
  });
  it('un Folio+ offert ou acheté dans un magasin qui court n’est pas écrasé par Stripe', () => {
    expect(aEcrire({ ...court, source: 'apple' }, { abonnement_stripe: 'sub_x', statut: 'actif', fin_periode: '2028-01-01T00:00:00Z' },
      MAINTENANT)).toBe(false);
  });
});

describe('les évènements', () => {
  it('l’abonnement dont parle chaque évènement', () => {
    expect(abonnementDe({ type: 'checkout.session.completed', data: { object: { mode: 'subscription', subscription: 'sub_1' } } })).toBe('sub_1');
    expect(abonnementDe({ type: 'checkout.session.completed', data: { object: { mode: 'payment' } } })).toBeNull();
    expect(abonnementDe({ type: 'customer.subscription.deleted', data: { object: { id: 'sub_3' } } })).toBe('sub_3');
    expect(abonnementDe({ type: 'invoice.paid', data: { object: { subscription: 'sub_4' } } })).toBe('sub_4');
    expect(abonnementDe({ type: 'invoice.payment_failed',
      data: { object: { parent: { subscription_details: { subscription: 'sub_5' } } } } })).toBe('sub_5');
    expect(abonnementDe({ type: 'charge.refunded', data: { object: {} } })).toBeNull();
  });
  it('le compte nommé par la page de paiement', () => {
    expect(compteDeLEvenement({ data: { object: { client_reference_id: 'u9' } } })).toBe('u9');
    expect(compteDeLEvenement({ data: { object: { metadata: { user_id: 'u8' } } } })).toBe('u8');
    expect(compteDeLEvenement({ data: { object: {} } })).toBeNull();
  });
});

describe('ce qu’on demande à Stripe', () => {
  const base = { formule: 'annuel', prix: 'price_an', userId: 'u1', site: 'https://www.folioflashcard.online' };
  it('la page de paiement : l’abonnement, le compte, les retours', () => {
    const d = demandePaiement({ ...base, email: 'lea@exemple.fr' });
    expect(d.mode).toBe('subscription');
    expect(d['line_items[0][price]']).toBe('price_an');
    expect(d.client_reference_id).toBe('u1');
    expect(d['subscription_data[metadata][user_id]']).toBe('u1');
    expect(d.customer_email).toBe('lea@exemple.fr');
    expect(d.customer).toBeUndefined();
    expect(d.success_url).toBe('https://www.folioflashcard.online/app?plus=merci&session={CHECKOUT_SESSION_ID}');
    expect(d.cancel_url).toBe('https://www.folioflashcard.online/app?plus=annule');
    expect(d['automatic_tax[enabled]']).toBeUndefined();
    expect(d['consent_collection[terms_of_service]']).toBeUndefined();
    expect(d['custom_text[submit][message]']).toMatch(/résiliable/);
  });
  it('l’adresse technique d’un élève à carte ne part pas chez Stripe', () => {
    expect(demandePaiement({ ...base, email: 'lea.martin@eleves.folio.invalid' }).customer_email).toBeUndefined();
  });
  it('les conditions de vente à cocher, une fois posées dans Stripe', () => {
    expect(demandePaiement({ ...base, cgv: true })['consent_collection[terms_of_service]']).toBe('required');
  });
  it('un ancien client garde son identifiant ; la TVA de Stripe Tax si demandée', () => {
    const d = demandePaiement({ ...base, email: 'x@y.fr', client: 'cus_1', taxe: true });
    expect(d.customer).toBe('cus_1');
    expect(d.customer_email).toBeUndefined();
    expect(d['automatic_tax[enabled]']).toBe('true');
    expect(d['customer_update[address]']).toBe('auto');
  });
  it('le portail ramène dans l’app', () => {
    expect(demandePortail({ client: 'cus_1', site: 'https://s.fr' })).toEqual({ customer: 'cus_1', return_url: 'https://s.fr/app?plus=retour' });
  });
  it('le formulaire encode les crochets et laisse tomber le vide', () => {
    expect(formulaire({ 'a[b]': 'x y', vide: '', nul: null, n: '1' })).toBe('a%5Bb%5D=x+y&n=1');
  });
});

describe('la signature d’un évènement Stripe', () => {
  const corps = '{"id":"evt_1","type":"invoice.paid"}', secret = 'whsec_test', t = Math.floor(MAINTENANT / 1000);
  it('lit l’en-tête', () => {
    expect(lireSignature('t=12,v1=aa,v1=bb,v0=cc')).toEqual({ t: 12, v1: ['aa', 'bb'] });
    expect(lireSignature('')).toEqual({ t: null, v1: [] });
  });
  it('accepte la bonne, refuse le reste', async () => {
    const s = await signer(corps, secret, t);
    expect(s).toMatch(/^[0-9a-f]{64}$/);
    expect(await signatureValide(corps, `t=${t},v1=${s}`, secret, MAINTENANT)).toBe(true);
    expect(await signatureValide(corps, `t=${t},v1=faux,v1=${s}`, secret, MAINTENANT)).toBe(true);   // Stripe en envoie deux pendant un changement de secret
    expect(await signatureValide(corps + ' ', `t=${t},v1=${s}`, secret, MAINTENANT)).toBe(false);   // corps modifié
    expect(await signatureValide(corps, `t=${t},v1=${s}`, 'whsec_autre', MAINTENANT)).toBe(false);  // autre secret
    expect(await signatureValide(corps, `t=${t},v1=${s}`, secret, MAINTENANT + 301e3)).toBe(false); // trop vieux : rejoué
    expect(await signatureValide(corps, `t=${t},v1=${s}`, '', MAINTENANT)).toBe(false);
    expect(await signatureValide(corps, '', secret, MAINTENANT)).toBe(false);
  });
});

describe('l’app des magasins : un abonné RevenueCat devient sa ligne apple ou google', () => {
  const U = '11111111-2222-4333-8444-555555555555';
  const abonne = (sub, produit = 'folio_plus_annuel') => ({
    entitlements: { plus: { product_identifier: produit, expires_date: sub.expires_date } },
    subscriptions: { [produit]: sub }
  });
  const an = '2027-11-01T10:00:00Z';

  it('un achat sur l’iPhone : Folio+ annuel, ligne apple', () => {
    const l = ligneMagasin(abonne({ store: 'app_store', expires_date: an, period_type: 'normal' }), U, MAINTENANT);
    expect(l).toEqual({ user_id: U, offre: 'plus', statut: 'actif', source: 'apple', formule: 'annuel', client_stripe: null,
      abonnement_stripe: null, fin_periode: '2027-11-01T10:00:00.000Z', fin_prevue: false, maj_le: '2026-11-01T10:00:00.000Z' });
  });
  it('Google, mensuel, à l’essai puis résilié', () => {
    const l = ligneMagasin(abonne({ store: 'play_store', expires_date: an, period_type: 'trial',
      unsubscribe_detected_at: '2026-10-30T00:00:00Z' }, 'folio_plus:mensuel'), U, MAINTENANT);
    expect([l.source, l.formule, l.statut, l.fin_prevue]).toEqual(['google', 'mensuel', 'essai', true]);
  });
  it('un paiement refusé : le délai de grâce garde l’accès jusqu’à sa fin', () => {
    const l = ligneMagasin(abonne({ store: 'app_store', expires_date: '2026-10-31T00:00:00Z',
      billing_issues_detected_at: '2026-10-31T00:00:00Z', grace_period_expires_date: '2026-11-15T00:00:00Z' }), U, MAINTENANT);
    expect([l.statut, l.fin_periode]).toEqual(['impaye', '2026-11-15T00:00:00.000Z']);
    expect(ouvre(l.statut, l.fin_periode, MAINTENANT)).toBe(true);
  });
  it('expiré ou remboursé : fini', () => {
    expect(ligneMagasin(abonne({ store: 'app_store', expires_date: '2026-10-01T00:00:00Z' }), U, MAINTENANT).statut).toBe('fini');
    expect(ligneMagasin(abonne({ store: 'play_store', expires_date: an, refunded_at: '2026-10-31T00:00:00Z' }), U, MAINTENANT).statut)
      .toBe('fini');
  });
  it('rien à écrire : jamais acheté, ou acheté hors des magasins (Stripe, une promotion)', () => {
    expect(ligneMagasin({ entitlements: {}, subscriptions: {} }, U, MAINTENANT)).toBeNull();
    expect(ligneMagasin(null, U, MAINTENANT)).toBeNull();
    expect(ligneMagasin(abonne({ store: 'stripe', expires_date: an }), U, MAINTENANT)).toBeNull();
    expect(ligneMagasin(abonne({ store: 'promotional', expires_date: an }), U, MAINTENANT)).toBeNull();
  });
  it('la formule d’après l’identifiant du produit', () => {
    expect(formuleDuProduit('folio_plus_annuel')).toBe('annuel');
    expect(formuleDuProduit('folio.plus.yearly')).toBe('annuel');
    expect(formuleDuProduit('folio_plus:mensuel')).toBe('mensuel');
    expect(formuleDuProduit('folio_plus_monthly')).toBe('mensuel');
    expect(formuleDuProduit('autre')).toBeNull();
  });
  it('les comptes Folio d’un évènement, sans les identifiants anonymes', () => {
    const V = '99999999-2222-4333-8444-555555555555';
    expect(comptesDeLEvenementRC({ event: { app_user_id: U, original_app_user_id: '$RCAnonymousID:abc' } })).toEqual([U]);
    expect(comptesDeLEvenementRC({ event: { type: 'TRANSFER', transferred_from: [U], transferred_to: [V] } })).toEqual([U, V]);
    expect(comptesDeLEvenementRC({})).toEqual([]);
  });
  it('le secret du webhook : exact, jamais vide', () => {
    expect(autorise('Bearer rc_secret', 'Bearer rc_secret')).toBe(true);
    expect(autorise('Bearer rc_autre', 'Bearer rc_secret')).toBe(false);
    expect(autorise('', '')).toBe(false);
    expect(autorise(null, 'x')).toBe(false);
  });
});
