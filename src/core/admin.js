import { I } from '../icones.js';
import { adm, online, setAccounts, setAnimate, view } from '../data/etat.js';
import { render } from '../ui/bibliotheque.js';
import { toast } from '../ui/import-cartes.js';
import { api } from './coeur-sync.js';
import { messageErreur } from './eleve-classes.js';

/* ══════════ la console de l'éditeur : ce qui part et ce qui revient ══════════
   Chargé avec la console (ui/admin-console.js, à la demande). Tout passe
   par les fonctions admin_* et set_role, qui vérifient elles-mêmes que
   l'appelant est l'éditeur (is_admin) ; rien ici ne décide qui a le droit.
   Une écriture refuse hors ligne, comme dans la console du référent. */

const rpc = (nom, args) => api('/rest/v1/rpc/' + nom, 'POST', args || {});
const repeint = () => { if (view.name === 'admin') { setAnimate(false); render(); } };

export async function admOrgsPull() {
  try { adm.orgs = await rpc('admin_orgs') || []; } catch (e) { adm.orgs = adm.orgs || []; adm.err = 1; }
  repeint();
}

export async function admEtatPull() {
  try { adm.etat = (await rpc('admin_etat') || [])[0] || null; } catch (e) { adm.err = 1; }
  repeint();
}

export async function admComptesPull() {
  try { setAccounts(await rpc('admin_accounts') || []); } catch (e) { setAccounts([]); adm.err = 1; }
  repeint();
}

export async function admCharger() {
  await Promise.allSettled([admOrgsPull(), admEtatPull(), admComptesPull(), admAttentePull(), admVendeurPull()]);
}

/* Une écriture : le message de la base est montré tel quel (« Un nom de 2 à
   120 caractères », « Des comptes existent… »), puis on relit le suivi. */
export async function admAgir(nom, args, bon) {
  if (!online) { toast(I.cloud, 'Hors ligne : la console demande le réseau'); return null; }
  try {
    const r = await rpc(nom, args);
    if (bon) toast(I.check, bon);
    await Promise.allSettled([admOrgsPull(), admEtatPull()]);
    return r === null || r === undefined ? true : r;
  } catch (e) {
    toast(I.x, messageErreur(e).slice(0, 120) || 'Impossible pour l’instant');
    return null;
  }
}

/* Le rôle d'un compte (set_role refuse qu'on se retire le sien). */
export async function admRole(cible, nouveau) {
  const r = await admAgir('set_role', { cible, nouveau }, 'Rôle enregistré');
  if (r) await admComptesPull();
  return r;
}

/* Mirandola+ offert à un compte, sans fin, ou repris (admin_offrir_plus,
   20261027210000) : un ami, un testeur, un geste commercial. Ne touche
   jamais un abonnement payé — il reste à Stripe ou au magasin. */
export async function admOffrirPlus(cible, retirer) {
  const r = await admAgir('admin_offrir_plus', { cible, jusqua: null, retirer: !!retirer });
  if (r && r.offre) {
    toast(I.check, r.offre === 'gratuit' ? 'Mirandola+ repris : le compte est en Mirandola gratuit'
      : r.offre === 'campus' ? 'Enregistré : son établissement lui offre déjà tout' : 'Mirandola+ offert');
  }
  return r;
}

/* ══════════ la facturation (20261026130000) ══════════
   L'identité du vendeur (une seule ligne, l'éditeur), la licence d'un
   établissement (le même tableau que voit son référent), ses pièces. Les
   montants se calculent en base ; une facture émise ne bouge plus. */
export async function admVendeurPull() {
  try { adm.vendeur = await rpc('admin_vendeur') || {}; } catch (e) { adm.vendeur = {}; adm.err = 1; }
  repeint();
}

export async function admAttentePull() {
  try { adm.attente = Object.fromEntries((await rpc('admin_echanges_attente') || []).map(x => [x.org_id, x.n])); }
  catch (e) { adm.attente = {}; }
  repeint();
}

export async function admLicencePull(org) {
  adm.licence = null;
  try { adm.licence = { ...(await rpc('licence_tableau', { org })), org_id: org }; } catch (e) { adm.licence = false; }
  repeint();
  if (online && adm.attente[org]) {
    try { await rpc('echanges_lus', { org }); delete adm.attente[org]; repeint(); }
    catch (e) { /* le message reste marqué « à lire » : on réessaiera à la prochaine ouverture */ }
  }
}

export async function admFacturePull(fid) {
  adm.facture = null;
  try { adm.facture = await rpc('facture', { fid }); } catch (e) { adm.facture = false; }
  repeint();
}

async function agirFacture(nom, args, bon, org) {
  const r = await admAgir(nom, args, bon);
  if (r && org) await admLicencePull(org);
  return r;
}

export const admVendeur = fiche => admAgir('admin_vendeur_enregistrer', { fiche }, 'Entreprise enregistrée').then(r => {
  if (r) admVendeurPull();
  return r;
});
export const admFacturer = (org, lignes, debut, fin, objet) =>
  agirFacture('admin_facturer', { org, lignes, debut: debut || null, fin: fin || null, objet: objet || '' }, 'Facture émise', org);
export const admAvoir = (org, fid, motif) => agirFacture('admin_avoir', { fid, motif: motif || '' }, 'Avoir émis', org);
export const admDates = (org, fid, deposee, payee) =>
  agirFacture('admin_facture_dates', { fid, deposee: deposee || null, payee: payee || null }, 'Enregistré', org);
export const admRepondre = (org, message, sujet) => agirFacture('admin_repondre', { org, message, sujet }, 'Réponse envoyée', org);
export const admFacturationClient = (org, fiche) =>
  agirFacture('facturation_enregistrer', { fiche, org }, 'Coordonnées enregistrées', org);

