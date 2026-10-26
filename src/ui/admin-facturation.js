// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { I, svg } from '../icones.js';
import { adm, setAnimate, view } from '../data/etat.js';
import { esc } from '../core/coeur-sync.js';
import {
  admAvoir, admDates, admFacturationClient, admFacturePull, admFacturer, admLicencePull, admRepondre, admVendeur
} from '../core/admin.js';
import { iso } from '../classe.js';
import { dateFr, enCentimes, etatFacture, euros, lignesLicence, nonLus, siretValide, SUJETS, totaux } from '../facture.js';
import { render } from './bibliotheque.js';
import { factureHtml } from './facture-vue.js';
import { toast } from './import-cartes.js';
import { timeAgo } from './reglages-corbeille.js';

/* ══════════ la facturation, côté éditeur (2026-10-26) ══════════
   Dans la fiche d'un établissement : ses pièces (émettre une facture,
   la marquer déposée sur Chorus Pro ou payée, l'annuler par un avoir), ses
   coordonnées de facturation, le fil des échanges avec son référent. Un
   onglet « Entreprise » : l'identité du vendeur, que chaque facture
   photographie (admin_vendeur_enregistrer). Une pièce a son adresse,
   /admin/factures/<id>. Les montants se calculent en base (admin_facturer) ;
   l'aperçu suit la même règle (src/facture.js). */

const repeint = () => { if (view.name === 'admin') { setAnimate(false); render(); } };
const vide = (ic, t) => `<div class="ed-vide">${svg(ic)}<p>${t}</p></div>`;
const champ = (id, lab, v, attr = '') => `<label class="ed-ch"><span>${lab}</span>
  <input id="${id}" value="${esc(v ?? '')}" ${attr}></label>`;
const val = id => ((document.getElementById(id) || {}).value || '').trim();

/* ---------- dans la fiche d'un établissement ---------- */
export function blocFacturation(o) {
  const l = adm.licence && adm.licence.org_id === o.id ? adm.licence : null;
  if (!l) return `<h2 class="ed-h2">Facturation</h2>${vide(I.money, 'Chargement…')}`;
  return `<h2 class="ed-h2">Facturation${nonLus(l.echanges, 'folio') ? '<em class="ed-dr chaud">message</em>' : ''}</h2>
    ${pieces(l)}${emettre(o, l)}${coordonnees(l)}${fil(l)}`;
}

function pieces(l) {
  const f = l.factures || [];
  if (!f.length) return '<p class="ed-rien">Aucune facture</p>';
  return `<div class="ed-pieces">${f.map(x => {
    const e = etatFacture(x, f);
    return `<button class="ed-piece" data-adm="piece" data-id="${esc(x.id)}">
      <span class="ed-l1"><b>${esc(x.numero)}</b><i>${dateFr(x.emise_le)}${x.objet ? ' · ' + esc(x.objet) : ''}</i></span>
      <span class="ed-montant">${euros(x.total_ttc)}</span><em class="ed-etat ${e.k}">${e.t}</em></button>`;
  }).join('')}</div>`;
}

/* Le formulaire d'une facture : la ligne de la licence proposée, trois lignes au plus à l'écran. */
function emettre(o, l) {
  const v = adm.vendeur || {};
  if (!v.raison_sociale || !v.siret) {
    return `<p class="ed-alerte">${svg(I.warn)}<span>Avant de facturer : <button class="ed-lien" data-adm="onglet" data-id="entreprise">ton entreprise</button></span></p>`;
  }
  const debut = iso(new Date()), base = lignesLicence({ places: l.places, prix: l.prix, debut, fin: l.licence_fin })[0];
  const ligne = (i, x = {}) => `<div class="ed-lf">
      <input id="fl-lib-${i}" value="${esc(x.libelle || '')}" placeholder="Désignation" maxlength="200" aria-label="Désignation">
      <input id="fl-q-${i}" value="${x.quantite ?? ''}" placeholder="Qté" inputmode="decimal" aria-label="Quantité">
      <input id="fl-pu-${i}" value="${x.prix_ht != null ? String(x.prix_ht / 100).replace('.', ',') : ''}" placeholder="PU HT €"
        inputmode="decimal" aria-label="Prix unitaire HT en euros"></div>`;
  return `<details class="ed-modif" id="edemettre"><summary>${svg(I.plus)}Émettre une facture</summary>
      <form id="edfacture" autocomplete="off">
        <div class="ed-ligne-f">${champ('fl-objet', 'Objet', 'Licence annuelle', 'maxlength="200"')}
          ${champ('fl-debut', 'Du', debut, 'type="date"')}${champ('fl-fin', 'Au', l.licence_fin || '', 'type="date"')}</div>
        ${ligne(0, base)}${ligne(1)}${ligne(2)}
        <p class="ed-apercu" id="edapercu">${apercu([base], v)}</p>
        <button class="ed-b pri" type="submit">${svg(I.check)}Émettre</button>
        <span class="ed-rien" title="Une facture émise ne se modifie plus : une erreur se corrige par un avoir">Définitive une fois émise</span>
      </form></details>`;
}

const apercu = (lignes, v) => {
  const t = totaux(lignes, v.regime_tva, v.taux_tva);
  return `${euros(t.ht)} HT${t.tva ? ` · TVA ${euros(t.tva)}` : ''} · <b>${euros(t.ttc)} TTC</b>${t.mention ? ` · ${t.mention}` : ''}`;
};

function lignesDuFormulaire() {
  return [0, 1, 2].map(i => ({ libelle: val('fl-lib-' + i), quantite: +val('fl-q-' + i).replace(',', '.'),
    prix_ht: enCentimes(val('fl-pu-' + i)) })).filter(x => x.libelle || x.quantite || x.prix_ht);
}

const CLIENT = [['nom', 'Établissement facturé'], ['adresse', 'Adresse'], ['code_postal', 'Code postal'], ['ville', 'Ville'],
  ['siret', 'SIRET'], ['service', 'Code service Chorus'], ['engagement', 'Bon de commande'], ['email', 'E-mail']];

function coordonnees(l) {
  const f = l.facturation || {}, manque = !f.nom || !f.adresse || !f.ville;
  return `<details class="ed-modif"${manque ? ' open' : ''}><summary>${svg(I.file)}Coordonnées de facturation${manque ? ' — à remplir' : ''}</summary>
      <form id="edclient" class="ed-grille-f" autocomplete="off">${CLIENT.map(([k, t]) => champ('ec-' + k, t, f[k], 'maxlength="200"')).join('')}
        <button class="ed-b" type="submit">${svg(I.check)}Enregistrer</button></form></details>`;
}

function fil(l) {
  const e = l.echanges || [];
  return `<h2 class="ed-h2">Échanges</h2>
    <div class="ed-fil">${e.length ? e.map(m => `<div class="ed-msg ${m.de === 'folio' ? 'moi' : 'eux'}">
        <span class="ed-msg-t"><b>${esc(m.auteur || '')}</b><em>${esc(SUJETS[m.sujet] || '')}</em><i>${timeAgo(m.cree)}</i></span>
        <p>${esc(m.message)}</p></div>`).join('') : '<p class="ed-rien">Rien encore</p>'}</div>
    <form id="edrepondre" class="ed-repondre" autocomplete="off">
      <select id="edrsujet" aria-label="Sujet">${Object.entries(SUJETS).map(([k, t]) => `<option value="${k}">${t}</option>`).join('')}</select>
      <textarea id="edrmsg" rows="3" maxlength="2000" placeholder="Réponse" aria-label="Réponse"></textarea>
      <button class="ed-b pri" type="submit">${svg(I.mail)}Répondre</button></form>`;
}

/* ---------- une pièce ---------- */
export function vuePiece() {
  const f = adm.facture;
  const retour = `<button class="ed-b sm" data-adm="piece-fin">${svg(I.back)}Retour</button>`;
  if (f === null) return `<div class="ed-barre-piece">${retour}</div>${vide(I.file, 'Chargement…')}`;
  if (!f) return `<div class="ed-barre-piece">${retour}</div>${vide(I.lock, 'Facture introuvable')}`;
  const liste = adm.licence && adm.licence.factures ? adm.licence.factures : [f], e = etatFacture(f, liste);
  const facture = f.genre === 'facture' && !f.avoir_numero;
  return `<div class="ed-barre-piece">${retour}<em class="ed-etat ${e.k}">${e.t}</em>
      ${f.avoir_numero ? `<em class="ed-etat annulee">Annulée par l’avoir ${esc(f.avoir_numero)}</em>` : ''}
      ${facture ? `<button class="ed-b sm" data-adm="deposee">${svg(I.check)}${f.deposee_le ? 'Déposée le ' + dateFr(f.deposee_le) : 'Déposée sur Chorus Pro'}</button>
        <button class="ed-b sm" data-adm="payee">${svg(I.money)}${f.payee_le ? 'Payée le ' + dateFr(f.payee_le) : 'Payée'}</button>
        <button class="ed-b sm ko" data-adm="avoir"><span>Annuler par un avoir</span></button>` : ''}
      <button class="ed-b pri" data-adm="imprimer">${svg(I.file)}Imprimer ou PDF</button></div>
    ${factureHtml(f)}`;
}

/* ---------- l'entreprise : le vendeur ---------- */
const VENDEUR = [['raison_sociale', 'Raison sociale ou nom'], ['forme', 'Forme (EI, SAS au capital de…)'], ['adresse', 'Adresse'],
  ['code_postal', 'Code postal'], ['ville', 'Ville'], ['siret', 'SIRET'], ['immatriculation', 'Immatriculation (RCS…)'],
  ['tva_intracom', 'TVA intracommunautaire'], ['iban', 'IBAN'], ['bic', 'BIC'], ['email', 'E-mail de facturation']];

export function vueEntreprise() {
  const v = adm.vendeur;
  if (!v) return vide(I.build, 'Chargement…');
  return `<div class="ed-fiche ed-entreprise"><div class="ed-qui">
      <div><b title="Ce que chaque facture imprime ; une facture déjà émise garde ce qu’elle disait">Mon entreprise</b></div></div>
      <form id="edvendeur" class="ed-grille-f" autocomplete="off">
        ${VENDEUR.map(([k, t]) => champ('ev-' + k, t, v[k], 'maxlength="200"')).join('')}
        <label class="ed-ch"><span>TVA</span><select id="ev-regime_tva">
          <option value="franchise"${v.regime_tva !== 'normal' ? ' selected' : ''}>Franchise en base (art. 293 B du CGI)</option>
          <option value="normal"${v.regime_tva === 'normal' ? ' selected' : ''}>Assujetti</option></select></label>
        ${champ('ev-taux_tva', 'Taux de TVA (%)', v.taux_tva ?? 20, 'inputmode="decimal"')}
        ${champ('ev-delai_jours', 'Délai de paiement (jours)', v.delai_jours ?? 30, 'inputmode="numeric"')}
        <button class="ed-b pri" type="submit">${svg(I.check)}Enregistrer</button>
      </form></div>`;
}

/* ---------- les gestes ---------- */
async function dateDuJour(champ, b) {
  const f = adm.facture; if (!f) return;
  const d = { deposee: f.deposee_le, payee: f.payee_le };
  d[champ] = d[champ] ? null : iso(new Date());
  if (await admDates(f.org_id, f.id, d.deposee, d.payee)) await admFacturePull(f.id);
  b.blur();
}

export const ACTIONS_FACTURATION = {
  piece: id => { adm.fid = id; admFacturePull(id); repeint(); },
  'piece-fin': () => { adm.fid = null; adm.facture = null; repeint(); },
  deposee: (_, b) => dateDuJour('deposee', b),
  payee: (_, b) => dateDuJour('payee', b),
  avoir: async (_, b) => {
    const f = adm.facture; if (!f) return;
    if (b.dataset.arme !== '1') { b.dataset.arme = '1'; b.querySelector('span').textContent = 'Sûr ? Un avoir de ' + euros(-f.total_ttc); return; }
    const r = await admAvoir(f.org_id, f.id, '');
    if (r && r.id) { adm.fid = r.id; await admFacturePull(r.id); }
  },
  imprimer: () => window.print()
};

export const FORMULAIRES_FACTURATION = {
  edfacture: async () => {
    const l = lignesDuFormulaire();
    if (!l.length || l.some(x => !x.libelle || !(x.quantite > 0) || x.prix_ht == null)) return toast(I.x, 'Chaque ligne : une désignation, une quantité, un prix');
    const r = await admFacturer(adm.open, l, val('fl-debut'), val('fl-fin'), val('fl-objet'));
    if (r && r.id) { adm.fid = r.id; await admFacturePull(r.id); }
  },
  edclient: () => {
    const fiche = Object.fromEntries(CLIENT.map(([k]) => [k, val('ec-' + k)]));
    if (fiche.siret && !siretValide(fiche.siret)) return toast(I.warn, 'Ce SIRET ne passe pas la vérification : relis-le');
    return admFacturationClient(adm.open, fiche);
  },
  edrepondre: async () => {
    const m = val('edrmsg');
    if (!m) return toast(I.x, 'Écris ta réponse');
    await admRepondre(adm.open, m, val('edrsujet') || 'question');
  },
  edvendeur: () => {
    const fiche = Object.fromEntries([...VENDEUR.map(([k]) => k), 'regime_tva', 'taux_tva', 'delai_jours'].map(k => [k, val('ev-' + k)]));
    if (fiche.siret && !siretValide(fiche.siret)) return toast(I.warn, 'Ce SIRET ne passe pas la vérification : relis-le');
    return admVendeur(fiche);
  }
};

/* L'aperçu d'une facture suit la saisie (sans repeindre le formulaire). */
export function suivreSaisie(e) {
  if (!/^fl-(q|pu)-/.test(e.target.id || '')) return;
  const p = document.getElementById('edapercu');
  if (p) p.innerHTML = apercu(lignesDuFormulaire().filter(x => x.prix_ht != null), adm.vendeur || {});
}

export { admLicencePull };
