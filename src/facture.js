/* La licence d'un établissement, ses factures et ses échanges (2026-10-26) —
   pur et testé (test/facture.test.js). La base calcule et fige les montants
   (admin_facturer, 20261026130000) ; ici, ce qu'on en montre : les montants
   en euros, l'état d'une pièce, les mentions qu'une facture doit porter, le
   prix d'une place, et l'aperçu des totaux d'une facture qu'on prépare (la
   même règle que la base, pour que l'éditeur voie ce qu'il va émettre). */

/* ---------- montants et dates ---------- */
const FMT = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });

/* Des centimes en euros, à la française : « 1 234,56 € ». */
export const euros = c => FMT.format((Math.round(+c || 0)) / 100);

/* « 2026-10-28 » → « 28/10/2026 » ; rien pour rien. */
export const dateFr = d => (d ? `${String(d).slice(8, 10)}/${String(d).slice(5, 7)}/${String(d).slice(0, 4)}` : '');

/* Une saisie en euros (« 3 », « 2,50 », « 1 200 ») en centimes ; null si illisible.
   (`\s` couvre aussi les espaces insécables qu'Intl met entre les milliers.) */
export function enCentimes(s) {
  const t = String(s ?? '').replace(/[\s€]/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(parseFloat(t) * 100);
}

/* ---------- les totaux, comme la base ---------- */
/* `lignes` : [{ libelle, quantite, prix_ht }] (prix unitaire HT en centimes).
   Arrondi au centime par ligne, puis la TVA sur le total HT ; en franchise
   (art. 293 B du CGI), pas de TVA et la mention à la place. */
export function totaux(lignes, regime = 'franchise', taux = 20) {
  const l = (lignes || []).map(x => ({ ...x, total_ht: Math.round((+x.quantite || 0) * (+x.prix_ht || 0)) }));
  const ht = l.reduce((a, x) => a + x.total_ht, 0);
  const normal = regime === 'normal';
  const tva = normal ? Math.round((ht * (+taux || 0)) / 100) : 0;
  return { lignes: l, ht, tva, ttc: ht + tva, taux: normal ? +taux : 0, mention: normal ? '' : MENTION_FRANCHISE };
}

export const MENTION_FRANCHISE = 'TVA non applicable, art. 293 B du CGI';

/* ---------- la licence ---------- */
/* Le prix convenu (org_suivi.prix_euros) est annuel et hors taxe ; une place
   — un élève ou un professeur, la même — en est la part. */
export function prixPlace(prixAnnuel, places) {
  if (!prixAnnuel || !places) return null;
  return Math.round((prixAnnuel * 100) / places);
}

/* La ligne qu'on propose pour facturer une licence : une seule, à son prix
   annuel. L'éditeur la change à sa guise avant d'émettre. */
export function lignesLicence({ places, prix, debut, fin }) {
  const periode = debut && fin ? `, du ${dateFr(debut)} au ${dateFr(fin)}` : fin ? `, jusqu’au ${dateFr(fin)}` : '';
  return [{ libelle: `Licence Folio — ${places || 0} places (élèves et professeurs)${periode}`, quantite: 1,
    prix_ht: Math.round((+prix || 0) * 100) }];
}

/* ---------- l'état d'une pièce ---------- */
/* `liste` : toutes les pièces de l'établissement (pour savoir si un avoir
   annule cette facture) ; `auj` : « AAAA-MM-JJ ». */
export function etatFacture(f, liste = [], auj = new Date().toISOString().slice(0, 10)) {
  if (f.genre === 'avoir') return { k: 'avoir', t: 'Avoir' };
  if ((liste || []).some(a => a.genre === 'avoir' && a.origine === f.id)) return { k: 'annulee', t: 'Annulée par avoir' };
  if (f.payee_le) return { k: 'payee', t: `Payée le ${dateFr(f.payee_le)}` };
  if (f.echeance && f.echeance < auj) return { k: 'retard', t: `Échue le ${dateFr(f.echeance)}` };
  return { k: 'attente', t: `À payer avant le ${dateFr(f.echeance)}` };
}

/* Ce qui reste à payer : les factures ni payées ni annulées. */
export function resteDu(liste, auj) {
  return (liste || []).filter(f => ['attente', 'retard'].includes(etatFacture(f, liste, auj).k))
    .reduce((a, f) => a + (+f.total_ttc || 0), 0);
}

/* ---------- ce qu'une facture doit dire ---------- */
const ligne = (...l) => l.filter(Boolean).join(' ');

/* Le vendeur, tel qu'imprimé en tête : la forme accolée au nom (« Folio
   (EI) » — la mention EI est obligatoire pour un entrepreneur individuel). */
export function enteteVendeur(v = {}) {
  return [
    ligne(v.raison_sociale, v.forme && `(${v.forme})`),
    v.adresse, ligne(v.code_postal, v.ville),
    v.siret && `SIRET ${v.siret}`, v.immatriculation,
    v.tva_intracom && `TVA intracommunautaire ${v.tva_intracom}`,
    v.email
  ].filter(Boolean);
}

export function enteteClient(c = {}) {
  return [
    c.nom, c.adresse, ligne(c.code_postal, c.ville),
    c.siret && `SIRET ${c.siret}`, c.uai && `UAI ${c.uai}`,
    c.service && `Code service (Chorus Pro) ${c.service}`,
    c.engagement && `Bon de commande ${c.engagement}`
  ].filter(Boolean);
}

/* Les mentions du bas de page (art. L441-9 et L441-10 du code de commerce,
   art. R2192-31 du code de la commande publique pour un acheteur public). */
export function mentionsLegales(f = {}) {
  const v = f.vendeur || {};
  return [
    f.mention_tva,
    f.genre === 'avoir' ? null : `Échéance : ${dateFr(f.echeance)}.`,
    v.iban ? `Règlement par virement : IBAN ${v.iban}${v.bic ? `, BIC ${v.bic}` : ''}.` : null,
    'Pas d’escompte pour paiement anticipé.',
    'Retard de paiement : pour un acheteur public, intérêts moratoires au taux de la Banque centrale européenne majoré '
      + 'de huit points (art. R2192-31 du code de la commande publique) ; sinon, pénalités au taux de la BCE majoré de dix '
      + 'points (art. L441-10 du code de commerce). Indemnité forfaitaire pour frais de recouvrement : 40 €.'
  ].filter(Boolean);
}

/* ---------- les échanges ---------- */
export const SUJETS = { places: 'Des places', renouvellement: 'Le renouvellement', facture: 'Une facture', question: 'Une question' };

/* Les messages de l'autre côté pas encore lus : Folio pour le référent
   (`moi` = 'etab'), l'établissement pour l'éditeur (`moi` = 'folio'). */
export const nonLus = (echanges, moi) => (echanges || []).filter(e => e.de !== moi && !e.lu).length;

/* ---------- un SIRET ---------- */
/* Quatorze chiffres et la clé de Luhn ; La Poste (SIREN 356 000 000) a sa
   propre règle : la somme des chiffres est un multiple de 5. */
export function siretValide(s) {
  const t = String(s || '').replace(/\s/g, '');
  if (!/^\d{14}$/.test(t)) return false;
  if (t.startsWith('356000000')) return [...t].reduce((a, c) => a + +c, 0) % 5 === 0;
  let somme = 0;
  for (let i = 0; i < 14; i++) {
    let n = +t[13 - i];
    if (i % 2 === 1) { n *= 2; if (n > 9) n -= 9; }
    somme += n;
  }
  return somme % 10 === 0;
}
