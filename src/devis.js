/* Le devis d'une licence Mirandola Campus (2026-11-14) — pur et testé
   (test/devis.test.js). La base émet, numérote et fige (admin_devis,
   20261114090000) ; ici, ce qu'on en montre et ce qu'on propose : la ligne
   de licence au prix de la grille, la période d'une année scolaire, l'état
   d'un devis, ce qu'il imprime en bas de page, et le message qui
   l'accompagne. Les montants et les dates s'écrivent comme sur une facture
   (src/facture.js). */

import { dateFr, euros } from './facture.js';
import { prixCampus } from './tarifs.js';

export const VALIDITE = 30;                                   // jours, d'office

const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/* La période qu'on propose : d'aujourd'hui au 31 août qui suit — la fin de
   l'année scolaire. À moins de trois mois de cette date (un devis de juin
   pour la rentrée), c'est l'année suivante qu'on vend : du 1er septembre au
   31 août d'après. */
export function periodeScolaire(auj = new Date()) {
  const a = auj.getFullYear(), fin = new Date(auj.getMonth() >= 8 ? a + 1 : a, 7, 31);
  if ((fin.getTime() - auj.getTime()) / 864e5 >= 90) return { debut: iso(auj), fin: iso(fin) };
  return { debut: `${fin.getFullYear()}-09-01`, fin: `${fin.getFullYear() + 1}-08-31` };
}

/* La ligne proposée : la licence pour tant de places, au prix convenu s'il y
   en a un (`prix`, en euros HT par an), sinon à celui de la grille
   (src/tarifs.js). L'éditeur la change à sa guise avant d'émettre. */
export function ligneLicence({ places, prix, debut, fin } = {}) {
  const n = Math.max(0, Math.floor(+places || 0));
  const periode = debut && fin ? `, du ${dateFr(debut)} au ${dateFr(fin)}` : fin ? `, jusqu’au ${dateFr(fin)}` : '';
  return { libelle: `Licence Mirandola Campus, ${n} place${n > 1 ? 's' : ''} (élèves, professeurs et référents)${periode}`,
    quantite: 1, prix_ht: +prix > 0 ? Math.round(+prix * 100) : prixCampus(n) };
}

/* ---------- l'état d'un devis ----------
   `k` reprend les classes d'état d'une facture (attente, retard, payee,
   annulee) : les mêmes pastilles dans les deux consoles. */
const aujourdhui = () => iso(new Date());

export const perime = (d, auj = aujourdhui()) => d.statut === 'envoye' && !!d.valable_jusqua && d.valable_jusqua < auj;

export function etatDevis(d, auj = aujourdhui()) {
  if (d.statut === 'refuse') return { k: 'annulee', t: 'Refusé' };
  if (d.statut === 'accepte') {
    const le = d.repondu_le ? ` le ${dateFr(String(d.repondu_le).slice(0, 10))}` : '';
    return { k: 'payee', t: d.facture_numero ? `Accepté · facture ${d.facture_numero}` : `Accepté${le}` };
  }
  if (perime(d, auj)) return { k: 'retard', t: `Expiré le ${dateFr(d.valable_jusqua)}` };
  return { k: 'attente', t: `Valable jusqu’au ${dateFr(d.valable_jusqua)}` };
}

/* Le référent y répond en ligne tant qu'il attend et qu'il est valable. */
export const peutRepondre = (d, auj = aujourdhui()) => d.statut === 'envoye' && !perime(d, auj);

/* Ce que l'éditeur peut en faire : noter une réponse tant qu'il n'est pas
   facturé, le facturer une fois accepté. `licence` : il porte de quoi
   ouvrir la licence du même geste (ses places et sa fin). */
export function gestesEditeur(d) {
  const facture = !!d.facture_id;
  return { noter: !facture && d.statut === 'envoye', rouvrir: !facture && d.statut !== 'envoye',
    facturer: !facture && d.statut === 'accepte', licence: !!(d.places && d.periode_fin) };
}

/* ---------- ce qu'un devis dit en bas de page ---------- */
export function mentionsDevis(d = {}) {
  const v = d.vendeur || {}, delai = +v.delai_jours || 30;
  return [
    d.mention_tva,
    `Devis gratuit, valable jusqu’au ${dateFr(d.valable_jusqua)}.`,
    `Règlement à ${delai} jours à réception de la facture, par virement${v.iban ? ` (IBAN ${v.iban})` : ''} ; `
      + 'pour un établissement public, facture déposée sur Chorus Pro.',
    'Une place par compte ouvert : élève, professeur ou référent. La licence est régie par les conditions générales de vente '
      + 'de Mirandola Campus et son contrat de sous-traitance (art. 28 du RGPD), remis avec ce devis.',
    'Pas d’escompte pour paiement anticipé. Retard de paiement : pour un acheteur public, intérêts moratoires au taux de la '
      + 'Banque centrale européenne majoré de huit points ; sinon, pénalités au taux de la BCE majoré de dix points. '
      + 'Indemnité forfaitaire pour frais de recouvrement : 40 €.'
  ].filter(Boolean);
}

/* La ligne sous l'objet : la période et les places. */
export function porteeDevis(d = {}) {
  return [
    d.periode_debut && d.periode_fin ? `Période : du ${dateFr(d.periode_debut)} au ${dateFr(d.periode_fin)}`
      : d.periode_fin ? `Période : jusqu’au ${dateFr(d.periode_fin)}` : '',
    d.places ? `${d.places} place${d.places > 1 ? 's' : ''}` : ''
  ].filter(Boolean).join(' · ');
}

/* ---------- le message qui l'accompagne ----------
   L'éditeur l'envoie au contact avec le PDF en pièce jointe (« Imprimer ou
   PDF ») ; `enLigne` : l'établissement a un référent, qui peut l'accepter
   depuis sa console. */
export function courrielDevis({ devis: d, etab, contact, enLigne, signature } = {}) {
  const sujet = `Devis ${d.numero} · Mirandola Campus${etab ? ' · ' + etab : ''}`;
  const corps = [
    `Bonjour${contact ? ' ' + contact : ''},`,
    '',
    `Vous trouverez ci-joint le devis ${d.numero} : ${euros(d.total_ht)} hors taxes`
      + `${d.places ? ` pour ${d.places} places` : ''}${d.periode_fin ? `, jusqu’au ${dateFr(d.periode_fin)}` : ''}. `
      + `Il est valable jusqu’au ${dateFr(d.valable_jusqua)}.`,
    '',
    enLigne
      ? 'Pour l’accepter : ouvrez Mirandola, onglet Licence, puis « Accepter le devis ». Vous pouvez aussi nous le retourner '
        + 'signé, ou nous adresser votre bon de commande.'
      : 'Pour l’accepter : retournez-le signé (« Bon pour accord »), ou adressez-nous votre bon de commande.',
    'Dès votre accord, la licence est ouverte et la facture émise (déposée sur Chorus Pro pour un établissement public).',
    '',
    'Bien cordialement,',
    signature || 'Mirandola'
  ].join('\n');
  return { sujet, corps };
}
