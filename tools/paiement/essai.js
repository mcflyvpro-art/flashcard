/* Les deux fonctions de paiement (supabase/functions/paiement et
   stripe-webhook), lancées pour de vrai sous Deno, face à un faux Stripe et
   une fausse base (PostgREST) servis ici. Ce que l'on prouve : la page de
   paiement demandée avec le bon compte, jamais deux fois la même chose,
   la signature exigée, un évènement rejoué sans effet, l'ordre d'arrivée
   sans importance, un compte supprimé sans erreur.

     node tools/paiement/essai.js
   Deno : la variable DENO (chemin du binaire) ou `npx --yes deno@2`. Le port
   8000 doit être libre (celui de Deno.serve). */
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { signer } from '../../supabase/functions/_shared/abonnement.js';

const PORT = 54399, ICI = `http://127.0.0.1:${PORT}`, FONCTION = 'http://127.0.0.1:8000';
const SECRET = 'whsec_essai', MAINTENANT = () => Math.floor(Date.now() / 1000);
const AN = MAINTENANT() + 365 * 86400;

/* ---------- le faux monde ---------- */
const comptes = new Set(['u1', 'u2', 'u3']);              // u4 a supprimé son compte
const abonnements = [{ user_id: 'u2', statut: 'actif', source: 'stripe', client_stripe: 'cus_u2', abonnement_stripe: 'sub_u2',
  fin_periode: new Date(AN * 1000).toISOString(), fin_prevue: false }];
const evenements = [], sessions = new Map(), recu = { checkout: [], ecritures: 0 };
const offres = { u3: 'campus' };
const subs = {
  sub_u1: { id: 'sub_u1', status: 'active', customer: 'cus_u1', cancel_at_period_end: false, current_period_end: AN,
    metadata: { user_id: 'u1' }, items: { data: [{ price: { id: 'price_an', recurring: { interval: 'year' } } }] } },
  sub_vieux: { id: 'sub_vieux', status: 'canceled', customer: 'cus_u1', cancel_at_period_end: false,
    current_period_end: MAINTENANT() - 86400, metadata: { user_id: 'u1' },
    items: { data: [{ price: { id: 'price_mois', recurring: { interval: 'month' } } }] } },
  sub_u4: { id: 'sub_u4', status: 'canceled', customer: 'cus_u4', metadata: { user_id: 'u4' },
    items: { data: [{ current_period_end: MAINTENANT(), price: { id: 'price_mois', recurring: { interval: 'month' } } }] } }
};

const lire = req => new Promise(res => { let b = ''; req.on('data', c => (b += c)); req.on('end', () => res(b)); });
const envoie = (res, statut, corps) => { res.writeHead(statut, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(corps)); };
const filtre = (q, cle) => (q.get(cle) || '').replace(/^eq\./, '');

function base(req, res, url, corps) {
  const q = url.searchParams, t = url.pathname.replace('/rest/v1/', '');
  if (t === 'rpc/mon_offre') {
    const sub = JSON.parse(Buffer.from((req.headers.authorization || '').split('.')[1] || 'e30', 'base64url')).sub;
    return envoie(res, 200, { offre: offres[sub] || 'gratuit' });
  }
  if (t === 'abonnements' && req.method === 'GET') {
    if (q.get('or')) {
      const [, a, c] = q.get('or').match(/abonnement_stripe\.eq\.([^,]+),client_stripe\.eq\.([^)]+)/) || [];
      return envoie(res, 200, abonnements.filter(r => r.abonnement_stripe === a || r.client_stripe === c).slice(0, 1));
    }
    return envoie(res, 200, abonnements.filter(r => r.user_id === filtre(q, 'user_id')));
  }
  if (t === 'abonnements' && req.method === 'POST') {
    const l = JSON.parse(corps);
    if (!comptes.has(l.user_id)) return envoie(res, 409, { code: '23503', message: 'clé étrangère' });
    recu.ecritures++;
    const i = abonnements.findIndex(r => r.user_id === l.user_id);
    if (i >= 0) abonnements[i] = { ...abonnements[i], ...l }; else abonnements.push(l);
    return envoie(res, 201, null);
  }
  if (t === 'stripe_evenements' && req.method === 'GET') return envoie(res, 200, evenements.filter(e => e.id === filtre(q, 'id')));
  if (t === 'stripe_evenements' && req.method === 'POST') {
    const e = JSON.parse(corps);
    if (!evenements.some(x => x.id === e.id)) evenements.push(e);
    return envoie(res, 201, null);
  }
  return envoie(res, 404, { message: 'inconnu ' + t });
}

function stripe(req, res, url, corps) {
  if (req.headers.authorization !== 'Bearer sk_test_essai') return envoie(res, 401, { error: { message: 'clé' } });
  const p = url.pathname.replace('/v1/', '');
  if (p === 'checkout/sessions') {
    const f = Object.fromEntries(new URLSearchParams(corps));
    const cle = req.headers['idempotency-key'];
    if (!sessions.has(cle)) { sessions.set(cle, { id: 'cs_' + sessions.size, f }); recu.checkout.push(f); }
    const s = sessions.get(cle);
    return envoie(res, 200, { id: s.id, url: 'https://checkout.stripe.com/c/pay/' + s.id });
  }
  if (p === 'billing_portal/sessions') {
    const f = Object.fromEntries(new URLSearchParams(corps));
    return envoie(res, 200, { url: 'https://billing.stripe.com/p/session/' + f.customer, retour: f.return_url });
  }
  const m = p.match(/^subscriptions\/(.+)$/);
  if (m && subs[m[1]]) return envoie(res, 200, subs[m[1]]);
  return envoie(res, 404, { error: { message: 'inconnu ' + p } });
}

const serveur = createServer(async (req, res) => {
  const url = new URL(req.url, ICI), corps = await lire(req);
  if (url.pathname.startsWith('/rest/v1/')) return base(req, res, url, corps);
  if (url.pathname.startsWith('/v1/')) return stripe(req, res, url, corps);
  envoie(res, 404, {});
});

/* ---------- les fonctions, sous Deno ---------- */
const ENV = {
  SUPABASE_URL: ICI, SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service', STRIPE_API: ICI + '/v1/',
  STRIPE_SECRET_KEY: 'sk_test_essai', STRIPE_WEBHOOK_SECRET: SECRET, STRIPE_PRIX_ANNUEL: 'price_an',
  STRIPE_PRIX_MENSUEL: 'price_mois', SITE_URL: 'https://www.folioflashcard.online'
};

function lancer(nom) {
  const [cmd, ...args] = process.env.DENO ? [process.env.DENO] : ['npx', '--yes', 'deno@2'];
  const p = spawn(cmd, [...args, 'run', '--quiet', '--no-lock', '--allow-net', '--allow-env',
    `supabase/functions/${nom}/index.ts`], { env: { ...process.env, ...ENV }, stdio: ['ignore', 'pipe', 'pipe'] });
  p.journal = '';
  p.stdout.on('data', d => (p.journal += d)); p.stderr.on('data', d => (p.journal += d));
  return p;
}

async function attendre() {
  for (let i = 0; i < 300; i++) {
    try { await fetch(FONCTION, { method: 'OPTIONS' }); return; } catch { await new Promise(r => setTimeout(r, 100)); }
  }
  throw new Error('la fonction ne démarre pas');
}

const jeton = (sub, email = sub + '@exemple.fr') =>
  'e30.' + Buffer.from(JSON.stringify({ sub, email, role: 'authenticated' })).toString('base64url') + '.signature';
const appel = (corps, sub) => fetch(FONCTION, { method: 'POST', body: JSON.stringify(corps),
  headers: { 'Content-Type': 'application/json', ...(sub ? { Authorization: 'Bearer ' + jeton(sub) } : {}) } })
  .then(async r => ({ statut: r.status, j: await r.json().catch(() => ({})) }));

async function evenement(ev, { t = MAINTENANT(), secret = SECRET } = {}) {
  const corps = JSON.stringify(ev), sig = await signer(corps, secret, t);
  const r = await fetch(FONCTION, { method: 'POST', body: corps, headers: { 'Stripe-Signature': `t=${t},v1=${sig}` } });
  return { statut: r.status, j: await r.json().catch(() => ({})) };
}

const resultats = [];
const verifie = (nom, ok, vu) => { resultats.push({ nom, ok: !!ok }); console.log(`${ok ? '✓' : '✗'} ${nom}${ok ? '' : '  → ' + JSON.stringify(vu)}`); };
const ligne = uid => abonnements.find(r => r.user_id === uid);

async function essaisPaiement() {
  let r = await appel({ action: 'payer', formule: 'annuel' }, 'u1');
  const f = recu.checkout[0] || {};
  verifie('payer : une page de paiement Stripe', r.statut === 200 && /^https:\/\/checkout\.stripe\.com\//.test(r.j.url), r);
  verifie('… pour ce compte, au prix annuel, en abonnement', f.mode === 'subscription' && f['line_items[0][price]'] === 'price_an'
    && f.client_reference_id === 'u1' && f['subscription_data[metadata][user_id]'] === 'u1' && f.customer_email === 'u1@exemple.fr', f);
  verifie('… qui revient dans l’app', f.success_url === 'https://www.folioflashcard.online/app?plus=merci&session={CHECKOUT_SESSION_ID}'
    && f.cancel_url === 'https://www.folioflashcard.online/app?plus=annule', f);
  const r2 = await appel({ action: 'payer', formule: 'annuel' }, 'u1');
  verifie('un double appui : la même page, une seule session', r2.j.url === r.j.url && recu.checkout.length === 1, recu.checkout.length);
  const rafale = await Promise.all(Array.from({ length: 20 }, () => appel({ action: 'payer', formule: 'annuel' }, 'u1')));
  verifie('vingt appuis à la fois : toujours une seule page de paiement', rafale.every(x => x.j.url === r.j.url)
    && recu.checkout.length === 1, recu.checkout.length);
  r = await appel({ action: 'payer', formule: 'mensuel' }, 'u1');
  verifie('la formule mensuelle : son prix', r.statut === 200 && recu.checkout[1]['line_items[0][price]'] === 'price_mois', recu.checkout[1]);
  r = await appel({ action: 'payer', formule: 'a-vie' }, 'u1');
  verifie('une formule inconnue : refusée', r.statut === 400 && r.j.error === 'formule', r);
  r = await appel({ action: 'payer', formule: 'annuel' }, 'u2');
  verifie('Folio+ court déjà : pas de second abonnement', r.statut === 409 && r.j.error === 'deja', r);
  r = await appel({ action: 'payer', formule: 'annuel' }, 'u3');
  verifie('l’établissement l’offre : rien à payer', r.statut === 409 && r.j.error === 'campus', r);
  r = await appel({ action: 'gerer' }, 'u1');
  verifie('gérer sans abonnement : rien à gérer', r.statut === 404 && r.j.error === 'aucun', r);
  r = await appel({ action: 'gerer' }, 'u2');
  verifie('gérer : le portail Stripe du bon client', r.statut === 200 && r.j.url === 'https://billing.stripe.com/p/session/cus_u2', r);
  r = await appel({ action: 'payer', formule: 'annuel' });
  verifie('sans compte : refusé', r.statut === 401, r);
}

async function essaisWebhook() {
  let r = await evenement({ id: 'evt_x', type: 'invoice.paid', data: { object: { subscription: 'sub_u1' } } }, { secret: 'whsec_faux' });
  verifie('une signature fausse : refusée, rien d’écrit', r.statut === 400 && !ligne('u1'), r);
  r = await evenement({ id: 'evt_y', type: 'invoice.paid', data: { object: { subscription: 'sub_u1' } } }, { t: MAINTENANT() - 600 });
  verifie('un évènement de plus de cinq minutes (rejoué) : refusé', r.statut === 400 && !ligne('u1'), r);
  const paye = { id: 'evt_1', type: 'checkout.session.completed',
    data: { object: { mode: 'subscription', subscription: 'sub_u1', client_reference_id: 'u1' } } };
  r = await evenement(paye);
  const l = ligne('u1') || {};
  verifie('paiement abouti : Folio+ annuel écrit pour ce compte', r.statut === 200 && l.statut === 'actif' && l.formule === 'annuel'
    && l.client_stripe === 'cus_u1' && l.abonnement_stripe === 'sub_u1' && !l.fin_prevue, l);
  const avant = recu.ecritures;
  r = await evenement(paye);
  verifie('le même évènement rejoué : sans effet', r.statut === 200 && r.j.deja === true && recu.ecritures === avant, r);
  const rejeux = await Promise.all(Array.from({ length: 100 }, () => evenement(paye)));
  verifie('cent rejeux du même évènement, en même temps : aucune écriture de plus', rejeux.every(x => x.statut === 200)
    && recu.ecritures === avant && evenements.filter(e => e.id === 'evt_1').length === 1, { ecritures: recu.ecritures - avant });
  r = await evenement({ id: 'evt_2', type: 'customer.subscription.deleted', data: { object: { id: 'sub_vieux' } } });
  verifie('la fin tardive d’un ancien abonnement n’écrase pas celui qui court', r.statut === 200 && ligne('u1').statut === 'actif'
    && ligne('u1').abonnement_stripe === 'sub_u1', ligne('u1'));
  subs.sub_u1 = { ...subs.sub_u1, cancel_at_period_end: true };
  r = await evenement({ id: 'evt_3', type: 'customer.subscription.updated', data: { object: { id: 'sub_u1' } } });
  verifie('résilié : il court jusqu’à sa fin', r.statut === 200 && ligne('u1').fin_prevue === true && ligne('u1').statut === 'actif', ligne('u1'));
  subs.sub_u1 = { ...subs.sub_u1, status: 'past_due' };
  r = await evenement({ id: 'evt_4', type: 'invoice.payment_failed',
    data: { object: { parent: { subscription_details: { subscription: 'sub_u1' } } } } });
  verifie('un paiement refusé (forme d’API récente) : impayé, l’accès reste le temps des relances',
    r.statut === 200 && ligne('u1').statut === 'impaye', ligne('u1'));
  subs.sub_u1 = { ...subs.sub_u1, status: 'active' };
  const neuf = { id: 'evt_7', type: 'invoice.paid', data: { object: { subscription: 'sub_u1' } } };
  const salve = await Promise.all(Array.from({ length: 100 }, () => evenement(neuf)));
  verifie('un évènement neuf livré cent fois à la fois : une seule ligne, juste, un seul évènement retenu',
    salve.every(x => x.statut === 200) && abonnements.filter(a => a.user_id === 'u1').length === 1
    && ligne('u1').statut === 'actif' && evenements.filter(x => x.id === 'evt_7').length === 1, ligne('u1'));
  r = await evenement({ id: 'evt_5', type: 'customer.subscription.deleted', data: { object: { id: 'sub_u4' } } });
  verifie('un compte supprimé : accepté sans erreur, rien d’écrit', r.statut === 200 && !ligne('u4'), r);
  r = await evenement({ id: 'evt_6', type: 'charge.refunded', data: { object: {} } });
  verifie('un évènement qui ne nous regarde pas : ignoré', r.statut === 200 && r.j.ignore === 'charge.refunded', r);
}

async function avec(nom, essais) {
  const p = lancer(nom);
  try { await attendre(); await essais(); }
  finally { p.kill(); await new Promise(r => p.once('exit', r)); }
  if (/error/i.test(p.journal)) console.log(`  (journal de ${nom})\n` + p.journal.trim().split('\n').map(x => '  ' + x).join('\n'));
}

serveur.listen(PORT, '127.0.0.1', async () => {
  try {
    await avec('paiement', essaisPaiement);
    await avec('stripe-webhook', essaisWebhook);
  } catch (e) {
    console.error(e);
    resultats.push({ nom: 'démarrage', ok: false });
  }
  serveur.close();
  const ko = resultats.filter(r => !r.ok).length;
  console.log(`\n${resultats.length - ko}/${resultats.length} vérifications`);
  process.exit(ko ? 1 : 0);
});
