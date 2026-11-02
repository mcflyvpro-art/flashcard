// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { I, svg } from '../icones.js';
import { adm } from '../data/etat.js';
import { admStripe } from '../core/admin.js';

/* ══════════ « Brancher Stripe », dans l'onglet Entreprise (2026-11-02) ══════════
   Chargé avec la console de l'éditeur. Une clé à poser dans Supabase, un
   bouton ici : la fonction paiement crée chez Stripe le produit Mirandola+,
   ses deux prix, le point d'arrivée des évènements et le portail client.
   Ce bloc ne montre que l'état (jamais un secret) ; passer en vrai, c'est
   changer de clé (sk_live_…) et rappuyer. */

const SECRETS = 'https://supabase.com/dashboard/project/qqbzefpdeinlynjtarqr/functions/secrets';
const CLES = 'https://dashboard.stripe.com/test/apikeys';
const puce = (ok, t) => `<span class="ed-puce ${ok ? 'ok' : ''}">${svg(ok ? I.check : I.x)}${t}</span>`;

const SANS_CLE = `<ol class="ed-etapes"><li>Copie ta clé secrète de test (<code>sk_test_…</code>) dans <a href="${CLES}" target="_blank" rel="noopener">Stripe → Clés API</a>.</li>
      <li>Colle-la dans <a href="${SECRETS}" target="_blank" rel="noopener">Supabase → Edge Functions → Secrets</a>, sous le nom <code>STRIPE_SECRET_KEY</code>.</li>
      <li>Reviens ici : <b>Brancher Stripe</b>.</li></ol>
      <button class="ed-b" data-adm="stripe-etat">${svg(I.refresh)}J’ai posé la clé</button>`;

const date = d => new Date(d).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' });

// la clé est là : ce qui est branché, et le bouton
function branche(s) {
  const pret = s.prix && s.webhook && s.portail;
  const quand = s.branche_le ? `<p class="ed-doux">Branché le ${date(s.branche_le)}${s.mode === 'live' ? ''
    : ' · paiements fictifs : carte 4242 4242 4242 4242'}.</p>` : '';
  const refus = s.erreur === 'stripe' ? '<p class="ed-doux">Stripe a refusé : la clé est-elle complète, et ce compte peut-il créer des produits&#8239;?</p>' : '';
  const libelle = s.enCours ? 'Branchement…' : pret ? 'Rebrancher' : 'Brancher Stripe';
  return `<div class="ed-puces">${puce(true, s.mode === 'live' ? 'Clé réelle' : 'Clé de test')}${puce(s.prix || s.a_la_main, 'Prix')}
      ${puce(s.webhook, 'Évènements')}${puce(s.portail, 'Portail client')}</div>${quand}${refus}
    <button class="ed-b ${pret ? '' : 'pri'}" data-adm="stripe-brancher" ${s.enCours ? 'disabled' : ''}>${svg(I.link)}${libelle}</button>`;
}

function corpsStripe(s) {
  if (!s) return '<p class="ed-doux">Lecture de l’état…</p>';
  if (s.erreur === 'absente') return '<p class="ed-doux">La fonction <b>paiement</b> ne répond pas : elle n’est pas déployée.</p>';
  if (!s.cle || s.erreur === 'nokey') return 'cle' in s || s.erreur === 'nokey' ? SANS_CLE
    : '<p class="ed-doux">Stripe n’a pas répondu. Réessaie dans un instant.</p>';
  return branche(s);
}

export function blocStripe() {
  if (adm.stripe === undefined) { adm.stripe = null; admStripe('etat'); }
  return `<div class="ed-fiche ed-stripe"><div class="ed-qui"><div><b>Paiement en ligne (Stripe)</b></div></div>${corpsStripe(adm.stripe)}</div>`;
}

export const ACTIONS_STRIPE = {
  'stripe-etat': () => { adm.stripe = null; admStripe('etat'); },
  'stripe-brancher': () => admStripe('preparer')
};
