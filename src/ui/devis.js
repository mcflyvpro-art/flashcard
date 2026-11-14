// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { I, svg } from '../icones.js';
import { adm, ref, setAnimate, view } from '../data/etat.js';
import { esc } from '../core/coeur-sync.js';
import { agirDevis, lireDevis } from '../core/devis.js';
import {
  courrielDevis, etatDevis, gestesEditeur, ligneLicence, mentionsDevis, periodeScolaire, peutRepondre, porteeDevis, VALIDITE
} from '../devis.js';
import { dateFr, enCentimes, enteteClient, enteteVendeur, euros, totaux } from '../facture.js';
import { render } from './bibliotheque.js';
import { toast } from './import-cartes.js';
import './devis.css';

/* ══════════ les devis, dans les deux consoles (2026-11-14) ══════════
   Mirandola Campus se vend sur devis : l'éditeur l'émet depuis la fiche d'un
   établissement, le référent le lit dans sa Licence et l'accepte en ligne
   (« bon pour accord », son nom et sa fonction, son bon de commande), puis
   l'éditeur ouvre la licence et facture d'un geste. Un morceau à part,
   chargé à la demande par les deux consoles (admin-facturation.js,
   ref-licence.js) — rien d'autre ne doit l'importer : il a son plafond
   (tools/budget.js, fichiers `devis-…`). Un devis ouvert a l'adresse d'une
   pièce, son identifiant précédé de « d- » (`adm.fid`, `ref.open`) ; la
   pièce elle-même dans `adm.devis` ou `ref.devis`. La feuille imprimée est
   celle d'une facture (classes fa- de facture.css, déjà chargée). */

const cote = () => (view.name === 'admin' ? 'adm' : 'ref');
const etat = () => (cote() === 'adm' ? adm : ref);
const cle = () => (cote() === 'adm' ? 'fid' : 'open');
const repeint = () => { if (view.name === 'admin' || view.name === 'ref') { setAnimate(false); render(); } };
const val = id => ((document.getElementById(id) || {}).value || '').trim();
const vide = (ic, t) => `<div class="dv-vide">${svg(ic)}<p>${t}</p></div>`;

/* Chaque console dit comment relire sa licence (elle seule sait la sienne). */
const relire = {};
export const relireAvec = (c, f) => { relire[c] = f; };

/* ---------- ouvrir un devis ---------- */
export async function ouvrir(id) {
  const e = etat(), did = String(id).replace(/^d-/, '');
  e[cle()] = 'd-' + did; e.devis = null;
  repeint();
  try { e.devis = await lireDevis(did); } catch (err) { e.devis = false; }
  repeint();
}

async function apres(r, org) {
  if (!r) return;
  const e = etat(), d = e.devis;
  await Promise.allSettled([relire[cote()] && relire[cote()](org), d && ouvrir(d.id)]);
}

/* ---------- la feuille ---------- */
const quantite = q => (+q).toLocaleString('fr-FR', { maximumFractionDigits: 2 });
const colonne = (l, gras) => l.map((x, i) => (i === 0 && gras ? `<b>${esc(x)}</b>` : `<span>${esc(x)}</span>`)).join('');

function accord(d) {
  if (d.statut === 'accepte') {
    return `<div class="dv-accord fait"><b>Bon pour accord</b>
        <span>Accepté le ${dateFr(String(d.repondu_le || '').slice(0, 10))}${d.repondu_par ? ' par ' + esc(d.repondu_par) : ''}</span>
        ${d.engagement ? `<span>Bon de commande ${esc(d.engagement)}</span>` : ''}</div>`;
  }
  return `<div class="dv-accord"><b>Bon pour accord</b>
      <span>Date :</span><span>Nom et qualité du signataire :</span><span>Bon de commande n° :</span>
      <span class="dv-signature">Signature et cachet :</span></div>`;
}

export function devisHtml(d) {
  const taux = +d.taux_tva || 0, portee = porteeDevis(d), objet = [esc(d.objet || ''), esc(portee)].filter(Boolean).join('<br>');
  return `<article class="fa-feuille" aria-label="Devis ${esc(d.numero)}">
      <header class="fa-tete">
        <div class="fa-de">${colonne(enteteVendeur(d.vendeur || {}), true)}</div>
        <div class="fa-num"><h1>Devis</h1><b>N° ${esc(d.numero)}</b>
          <span>Émis le ${dateFr(d.emis_le)}</span><span>Valable jusqu’au ${dateFr(d.valable_jusqua)}</span></div>
      </header>
      <section class="fa-pour"><i>Adressé à</i>${colonne(enteteClient(d.client || {}), true)}</section>
      ${objet ? `<p class="fa-objet">${objet}</p>` : ''}
      <table class="fa-lignes">
        <thead><tr><th>Désignation</th><th>Quantité</th><th>Prix unitaire HT</th><th>Total HT</th></tr></thead>
        <tbody>${(d.lignes || []).map(l => `<tr><td>${esc(l.libelle)}</td><td>${quantite(l.quantite)}</td>
          <td>${euros(l.prix_ht)}</td><td>${euros(l.total_ht)}</td></tr>`).join('')}</tbody>
      </table>
      <div class="fa-totaux">
        <span>Total HT</span><b>${euros(d.total_ht)}</b>
        ${taux ? `<span>TVA ${quantite(taux)} %</span><b>${euros(d.tva)}</b>` : ''}
        <span class="fa-net">Total TTC</span><b class="fa-net">${euros(d.total_ttc)}</b>
      </div>
      ${accord(d)}
      <ul class="fa-mentions">${mentionsDevis(d).map(m => `<li>${esc(m)}</li>`).join('')}</ul>
    </article>`;
}

/* La liste des devis d'un établissement, la même des deux côtés. */
function liste(l, p) {
  return `<div class="${p}-pieces">${(l.devis || []).map(x => {
    const e = etatDevis(x);
    return `<button class="${p}-piece" data-dv="ouvrir" data-id="${esc(x.id)}">
      <span class="${p}-l1"><b>${esc(x.numero)}</b><i>${dateFr(x.emis_le)}${x.objet ? ' · ' + esc(x.objet) : ''}</i></span>
      <span class="${p}-montant">${euros(x.total_ttc)}</span><em class="${p}-etat ${e.k}">${e.t}</em></button>`;
  }).join('')}</div>`;
}

/* ══════════ côté éditeur ══════════ */
const champ = (id, lab, v, attr = '') => `<label class="ed-ch"><span>${lab}</span>
  <input id="${id}" value="${esc(v ?? '')}" ${attr}></label>`;
const ligneF = (i, x = {}) => `<div class="ed-lf">
    <input id="dv-lib-${i}" value="${esc(x.libelle || '')}" placeholder="Désignation" maxlength="200" aria-label="Désignation">
    <input id="dv-q-${i}" value="${x.quantite ?? ''}" placeholder="Qté" inputmode="decimal" aria-label="Quantité">
    <input id="dv-pu-${i}" value="${x.prix_ht != null ? String(x.prix_ht / 100).replace('.', ',') : ''}" placeholder="PU HT €"
      inputmode="decimal" aria-label="Prix unitaire HT en euros"></div>`;

function lignesSaisies() {
  return [0, 1, 2].map(i => ({ libelle: val('dv-lib-' + i), quantite: +val('dv-q-' + i).replace(',', '.'),
    prix_ht: enCentimes(val('dv-pu-' + i)) })).filter(x => x.libelle || x.quantite || x.prix_ht);
}

const apercu = lignes => {
  const v = adm.vendeur || {}, t = totaux(lignes, v.regime_tva, v.taux_tva);
  return `${euros(t.ht)} HT${t.tva ? ` · TVA ${euros(t.tva)}` : ''} · <b>${euros(t.ttc)} TTC</b>${t.mention ? ` · ${t.mention}` : ''}`;
};

/* La ligne proposée : au prix convenu si l'on reconduit les places de la
   licence en cours, sinon à celui de la grille pour ce nombre de places. */
const proposee = (o, places, debut, fin) =>
  ligneLicence({ places, prix: +places === +o.places ? o.prix_euros : 0, debut, fin });

/* Dans la fiche d'un établissement : ses devis, et le formulaire d'un nouveau. */
export function blocEditeur(o, l) {
  const v = adm.vendeur || {}, pret = v.raison_sociale && v.siret;
  const p = periodeScolaire(), places = l.places || o.eleves_estimes || '';
  const base = proposee(o, places, p.debut, p.fin);
  return `<h2 class="ed-h2">Devis</h2>
    ${(l.devis || []).length ? liste(l, 'ed') : '<p class="ed-rien">Aucun devis</p>'}
    ${pret ? `<details class="ed-modif" id="dvnouveau"><summary>${svg(I.plus)}Faire un devis</summary>
      <form id="dvform" class="dv-form" autocomplete="off">
        <div class="ed-ligne-f">${champ('dv-objet', 'Objet', 'Licence annuelle Mirandola Campus', 'maxlength="200"')}
          ${champ('dv-places', 'Places', places, 'inputmode="numeric"')}
          ${champ('dv-debut', 'Du', p.debut, 'type="date"')}${champ('dv-fin', 'Au', p.fin, 'type="date"')}
          ${champ('dv-valable', 'Valable (jours)', VALIDITE, 'inputmode="numeric"')}</div>
        ${ligneF(0, places ? base : {})}${ligneF(1)}${ligneF(2)}
        <p class="ed-apercu" id="dvapercu">${apercu(places ? [base] : [])}</p>
        <button class="ed-b pri" type="submit">${svg(I.check)}Émettre le devis</button>
        <span class="ed-rien" title="Un devis émis ne se modifie plus : on en émet un autre">Figé une fois émis</span>
      </form></details>` : ''}`;
}

/* Un devis ouvert : ce qu'on peut en faire, puis la feuille. */
export function pieceEditeur() {
  const d = adm.devis;
  const retour = `<button class="ed-b sm" data-adm="piece-fin">${svg(I.back)}Retour</button>`;
  if (d === null || d === undefined) return `<div class="ed-barre-piece">${retour}</div>${vide(I.file, 'Chargement…')}`;
  if (!d) return `<div class="ed-barre-piece">${retour}</div>${vide(I.lock, 'Devis introuvable')}`;
  const e = etatDevis(d), g = gestesEditeur(d), o = (adm.orgs || []).find(x => x.id === d.org_id) || {};
  const c = courrielDevis({ devis: d, etab: o.name, contact: o.contact_nom, enLigne: !!o.refs });
  const ecrire = o.contact_email ? `<a class="ed-b sm" href="mailto:${esc(o.contact_email)}?subject=${encodeURIComponent(c.sujet)}&body=${
    encodeURIComponent(c.corps)}">${svg(I.mail)}Écrire au contact</a>` : '';
  return `<div class="ed-barre-piece">${retour}<em class="ed-etat ${e.k}">${e.t}</em>
      ${g.noter ? `<button class="ed-b sm" data-dv="noter" data-id="accepte">${svg(I.check)}Accepté</button>
        <button class="ed-b sm" data-dv="noter" data-id="refuse">${svg(I.x)}Refusé</button>` : ''}
      ${g.facturer ? `<button class="ed-b sm pri dv-facturer" data-dv="facturer">${svg(I.money)}<span>${
        g.licence ? 'Ouvrir la licence et facturer' : 'Facturer'}</span></button>` : ''}
      ${g.rouvrir ? `<button class="ed-b sm" data-dv="noter" data-id="envoye">${svg(I.refresh)}Rouvrir</button>` : ''}
      ${d.facture_id ? `<button class="ed-b sm" data-adm="piece" data-id="${esc(d.facture_id)}">${svg(I.file)}Facture ${esc(d.facture_numero || '')}</button>` : ''}
      ${ecrire}<button class="ed-b pri" data-adm="imprimer">${svg(I.file)}Imprimer ou PDF</button></div>
    ${g.noter ? `<form id="dvnote" class="dv-note" autocomplete="off">
        <input id="dvn-nom" placeholder="Signataire (nom et fonction)" maxlength="120" aria-label="Signataire">
        <input id="dvn-bc" placeholder="Bon de commande" maxlength="60" aria-label="Bon de commande"></form>` : ''}
    ${devisHtml(d)}`;
}

/* ══════════ côté référent ══════════ */
export function tuileReferent(l) {
  if (!(l.devis || []).length) return '';
  return `<div class="rf-tuile"><h2>Devis</h2>${liste(l, 'rf')}</div>`;
}

export function pieceReferent() {
  const d = ref.devis;
  const barre = e => `<div class="rf-barre-piece">
      <button class="rf-b sm" data-rf="lic-retour">${svg(I.back)}Licence</button>
      ${e ? `<em class="rf-etat ${e.k}">${e.t}</em>` : ''}
      ${d && d.facture_id ? `<button class="rf-b sm" data-rf="lic-piece" data-id="${esc(d.facture_id)}">${svg(I.file)}Facture ${esc(d.facture_numero || '')}</button>` : ''}
      <button class="rf-b pri" data-rf="imprimer">${svg(I.file)}Imprimer ou PDF</button></div>`;
  if (d === null || d === undefined) return barre() + vide(I.file, 'Chargement…');
  if (!d) return barre() + vide(I.lock, 'Ce devis n’est pas à toi');
  const repondre = peutRepondre(d) ? `<form id="dvaccord" class="dv-repondre" autocomplete="off">
      <b>Bon pour accord</b>
      <label class="rf-ch"><span>Ton nom et ta fonction</span>
        <input id="dva-nom" maxlength="120" placeholder="Marie Curie, proviseure" required></label>
      <label class="rf-ch"><span>Bon de commande</span>
        <input id="dva-bc" maxlength="60" placeholder="n° d’engagement, si tu en as un"></label>
      <div class="dv-boutons"><button class="rf-b pri" type="submit">${svg(I.check)}Accepter le devis</button>
        <button class="rf-b dv-refuser" type="button" data-dv="refuser"><span>Refuser</span></button></div>
    </form>` : '';
  return `${barre(etatDevis(d))}${repondre}<div class="rf-impression-f">${devisHtml(d)}</div>`;
}

/* ══════════ les gestes ══════════ */
const ACTIONS = {
  ouvrir: id => ouvrir(id),
  noter: async statut => {
    const d = adm.devis; if (!d) return;
    const bon = { accepte: 'Devis accepté', refuse: 'Devis refusé', envoye: 'Devis rouvert' }[statut];
    await apres(await agirDevis('admin_devis_statut', { did: d.id, statut, nom: val('dvn-nom'), engagement: val('dvn-bc') }, bon), d.org_id);
  },
  /* en deux appuis : une facture émise ne se reprend que par un avoir */
  facturer: async (_, b) => {
    const d = adm.devis; if (!d) return;
    if (b.dataset.arme !== '1') { b.dataset.arme = '1'; b.querySelector('span').textContent = 'Sûr ? Une facture de ' + euros(d.total_ttc); return; }
    const r = await agirDevis('admin_devis_facturer', { did: d.id, licence: true },
      gestesEditeur(d).licence ? 'Licence ouverte, facture émise' : 'Facture émise');
    await apres(r, d.org_id);
  },
  refuser: async (_, b) => {
    const d = ref.devis; if (!d) return;
    if (b.dataset.arme !== '1') { b.dataset.arme = '1'; b.querySelector('span').textContent = 'Sûr ? Refuser ce devis'; return; }
    await apres(await agirDevis('ref_devis_repondre', { did: d.id, accepte: false, nom: val('dva-nom'), engagement: '' }, 'Devis refusé'));
  }
};

document.addEventListener('click', e => {
  const b = e.target.closest('[data-dv]');
  if (!b || b.disabled || (view.name !== 'admin' && view.name !== 'ref')) return;
  const f = ACTIONS[b.dataset.dv];
  if (!f) return;
  e.preventDefault();
  f(b.dataset.id, b);
});

const FORMULAIRES = {
  dvform: async () => {
    const l = lignesSaisies(), org = adm.open;
    if (!l.length || l.some(x => !x.libelle || !(x.quantite > 0) || x.prix_ht == null)) return toast(I.x, 'Chaque ligne : une désignation, une quantité, un prix');
    const places = parseInt(val('dv-places'), 10) || null;
    const r = await agirDevis('admin_devis', { org, lignes: l, valable: parseInt(val('dv-valable'), 10) || VALIDITE,
      debut: val('dv-debut') || null, fin: val('dv-fin') || null, objet: val('dv-objet'), places }, 'Devis émis');
    if (!r || !r.id) return;
    if (relire.adm) await relire.adm(org);
    await ouvrir(r.id);
  },
  dvnote: () => {},
  dvaccord: async () => {
    const d = ref.devis, nom = val('dva-nom');
    if (!d) return;
    if (nom.length < 3) return toast(I.x, 'Indique ton nom et ta fonction');
    await apres(await agirDevis('ref_devis_repondre', { did: d.id, accepte: true, nom, engagement: val('dva-bc') }, 'Devis accepté : Mirandola est prévenu'));
  }
};

document.addEventListener('submit', e => {
  const f = FORMULAIRES[e.target.id];
  if (!f || (view.name !== 'admin' && view.name !== 'ref')) return;
  e.preventDefault();
  f();
});

/* L'aperçu suit la saisie ; le nombre de places refait la ligne de licence
   tant qu'on ne l'a pas écrite à la main. */
document.addEventListener('input', e => {
  const id = e.target.id || '';
  if (view.name !== 'admin' || !id.startsWith('dv-')) return;
  if (/^dv-(lib|pu)-0$/.test(id)) e.target.form.dataset.main = '1';
  if (['dv-places', 'dv-debut', 'dv-fin'].includes(id) && e.target.form.dataset.main !== '1') {
    const o = (adm.orgs || []).find(x => x.id === adm.open) || {}, places = parseInt(val('dv-places'), 10) || 0;
    const x = proposee(o, places, val('dv-debut'), val('dv-fin'));
    const pose = (k, v) => { const c = document.getElementById(k); if (c) c.value = v; };
    pose('dv-lib-0', places ? x.libelle : ''); pose('dv-q-0', places ? 1 : ''); pose('dv-pu-0', places ? String(x.prix_ht / 100).replace('.', ',') : '');
  }
  const p = document.getElementById('dvapercu');
  if (p) p.innerHTML = apercu(lignesSaisies().filter(x => x.prix_ht != null));
});
