// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { I, svg } from '../icones.js';
import { ref, setAnimate, view } from '../data/etat.js';
import { esc } from '../core/coeur-sync.js';
import { refEcrire, refFacturation, refFacturePull, refLicencePull } from '../core/referent.js';
import { etatLicence } from '../etablissement.js';
import { dateFr, etatFacture, euros, prixPlace, resteDu, siretValide, SUJETS } from '../facture.js';
import { render } from './bibliotheque.js';
import { factureHtml } from './facture-vue.js';
import { toast } from './import-cartes.js';
import { timeAgo } from './reglages-corbeille.js';

/* ══════════ la licence, côté référent (2026-10-26) ══════════
   Un onglet de la console (adresse /referent/licence) : les places prises
   — un élève ou un professeur, une place chacun —, le prix convenu, les
   factures et les avoirs (chacun à son adresse, /referent/licence/factures/<id>,
   imprimable), les coordonnées de facturation que demandent les factures et
   Chorus Pro, les échanges avec Folio, et les documents du contrat. Tout
   vient de licence_tableau (20261026130000) ; rien ne se calcule ici. */

const repeint = () => { if (view.name === 'ref') { setAnimate(false); render(); } };
const vide = (ic, t) => `<div class="rf-vide">${svg(ic)}<p>${t}</p></div>`;
const kc = (n, lab, cls) => `<div class="rf-kc ${cls || ''}"><b>${n ?? '—'}</b><span>${lab}</span></div>`;

/* Les documents du contrat : leurs textes se chargent à la demande. */
const DOCS = { cgv: 'Conditions générales de vente', dpa: 'Contrat de sous-traitance (RGPD)', registre: 'Fiche pour le registre' };
let documents = null;
const chargerDocuments = () => import('./documents-etab.js').then(m => (documents = m));

/* ---------- l'onglet ---------- */
export function poserLicence(id) {
  ref.facture = null; ref.doc = ''; ref.open = id || null;
  if (!ref.licence) refLicencePull();
  if (id) refFacturePull(id);
}

export function licence() {
  if (ref.open) return vuePiece();
  if (ref.doc) return vueDocument();
  const l = ref.licence;
  if (l === null) return vide(I.build, 'Chargement…');
  if (!l) return vide(I.lock, 'Réservé au référent de l’établissement');
  return `<div class="rf-ltab">
      <div class="rf-ltab-g">${tuilePlaces(l)}${tuileFactures(l)}${tuileDocuments()}</div>
      <div class="rf-ltab-d">${tuileEchanges(l)}${tuileFacturation(l)}</div>
    </div>`;
}

function tuilePlaces(l) {
  const e = etatLicence({ offre: l.offre, places: l.places, eleves: l.prises, licence_fin: l.licence_fin });
  const pp = prixPlace(l.prix, l.places), du = resteDu(l.factures);
  return `<div class="rf-tuile rf-places">
      <div class="rf-tl">${e.offre}<span>${e.k === 'echue' ? 'finie le ' : e.fin === 'sans fin' ? '' : 'jusqu’au '}${e.fin}</span></div>
      <div class="rf-barre ${e.k}"><i style="width:${e.pc}%"></i></div>
      <div class="rf-chiffres">${kc(l.places ?? '∞', 'places')}${kc(l.eleves, 'élèves')}${kc(l.profs, 'professeurs')}
        ${kc(e.libre ?? '—', 'libres', e.libre === 0 ? 'ko' : '')}</div>
      ${l.prix ? `<div class="rf-prix" title="Hors taxes, par année scolaire ; une place par élève ou professeur">
        <span>${svg(I.money)}<b>${euros(l.prix * 100)}</b> HT / an</span>${pp ? `<span>${euros(pp)} la place</span>` : ''}
        ${du ? `<span class="rf-du">${euros(du)} à régler</span>` : ''}</div>` : ''}
      <div class="rf-b-l">
        <button class="rf-b" data-rf="lic-demander" data-id="places">${svg(I.plus)}Des places</button>
        <button class="rf-b" data-rf="lic-demander" data-id="renouvellement">${svg(I.refresh)}Renouveler</button>
      </div>
    </div>`;
}

function tuileFactures(l) {
  const f = l.factures || [];
  return `<div class="rf-tuile"><h2>Factures</h2>
      ${f.length ? `<div class="rf-pieces">${f.map(x => {
        const e = etatFacture(x, f);
        return `<button class="rf-piece" data-rf="lic-piece" data-id="${esc(x.id)}">
          <span class="rf-l1"><b>${esc(x.numero)}</b><i>${dateFr(x.emise_le)}${x.objet ? ' · ' + esc(x.objet) : ''}</i></span>
          <span class="rf-montant">${euros(x.total_ttc)}</span><em class="rf-etat ${e.k}">${e.t}</em>${svg(I.arrow)}</button>`;
      }).join('')}</div>` : '<p class="rf-rien">Aucune facture</p>'}
    </div>`;
}

function tuileDocuments() {
  return `<div class="rf-tuile"><h2>Documents</h2>${Object.entries(DOCS).map(([k, t]) =>
    `<button class="rf-ligne" data-rf="lic-doc" data-id="${k}">${svg(I.file)}<span>${t}</span>${svg(I.arrow)}</button>`).join('')}</div>`;
}

function tuileEchanges(l) {
  const e = l.echanges || [], s = ref.sujet || 'question';
  return `<div class="rf-tuile rf-fil-t"><h2>Échanges avec Folio</h2>
      <div class="rf-fil">${e.length ? e.map(m => `<div class="rf-msg ${m.de === 'folio' ? 'folio' : 'moi'}">
          <span class="rf-msg-t"><b>${esc(m.auteur || '')}</b><em>${esc(SUJETS[m.sujet] || '')}</em><i>${timeAgo(m.cree)}</i></span>
          <p>${esc(m.message)}</p></div>`).join('') : '<p class="rf-rien">Rien encore</p>'}</div>
      <form id="rfecrire" class="rf-ecrire" autocomplete="off">
        <select id="rfesujet" aria-label="Sujet">${Object.entries(SUJETS).map(([k, t]) =>
          `<option value="${k}"${k === s ? ' selected' : ''}>${t}</option>`).join('')}</select>
        <textarea id="rfemsg" rows="3" maxlength="2000" placeholder="Ton message" aria-label="Message">${esc(ref.brouillon || '')}</textarea>
        <button class="rf-b pri" type="submit">${svg(I.mail)}Envoyer</button>
      </form>
    </div>`;
}

const CHAMPS = [['nom', 'Établissement facturé', 'Lycée Albert Camus'], ['adresse', 'Adresse', ''], ['code_postal', 'Code postal', ''],
  ['ville', 'Ville', ''], ['siret', 'SIRET', '14 chiffres'], ['service', 'Code service Chorus Pro', 'si demandé'],
  ['engagement', 'Bon de commande', 'n° d’engagement'], ['email', 'E-mail de l’intendance', '']];

function tuileFacturation(l) {
  const f = l.facturation || {};
  return `<div class="rf-tuile"><h2>Coordonnées de facturation</h2>
      <form id="rffact" class="rf-grille-f" autocomplete="off">${CHAMPS.map(([k, t, p]) => `<label class="rf-ch rf-ch-${k}"><span>${t}</span>
        <input id="rff-${k}" value="${esc(f[k] || '')}" placeholder="${esc(p)}" maxlength="200"${k === 'siret' ? ' inputmode="numeric"' : ''}
          ${k === 'email' ? ' type="email"' : ''}></label>`).join('')}
        <button class="rf-b pri" type="submit">${svg(I.check)}Enregistrer</button>
      </form>
    </div>`;
}

/* ---------- une pièce ---------- */
function vuePiece() {
  const f = ref.facture, l = ref.licence || {};
  const barre = e => `<div class="rf-barre-piece">
      <button class="rf-b sm" data-rf="lic-retour">${svg(I.back)}Licence</button>
      ${e ? `<em class="rf-etat ${e.k}">${e.t}</em>` : ''}
      ${f && f.avoir_numero ? `<em class="rf-etat annulee">Annulée par l’avoir ${esc(f.avoir_numero)}</em>` : ''}
      <button class="rf-b pri" data-rf="imprimer">${svg(I.file)}Imprimer ou PDF</button></div>`;
  if (f === null) return barre() + vide(I.file, 'Chargement…');
  if (!f) return barre() + vide(I.lock, 'Cette facture n’est pas à toi');
  return `${barre(etatFacture(f, l.factures || []))}<div class="rf-impression-f">${factureHtml(f)}</div>`;
}

/* ---------- un document ---------- */
function vueDocument() {
  const barre = `<div class="rf-barre-piece"><button class="rf-b sm" data-rf="lic-retour">${svg(I.back)}Licence</button>
      <button class="rf-b pri" data-rf="imprimer">${svg(I.file)}Imprimer ou PDF</button></div>`;
  if (!documents) {
    chargerDocuments().then(repeint).catch(() => toast(I.x, 'Le document n’a pas pu s’ouvrir : vérifie ta connexion'));
    return barre + vide(I.file, 'Chargement…');
  }
  return `${barre}<div class="rf-impression-f">${documents.documentHtml(ref.doc, ref.licence || {})}</div>`;
}

/* ---------- les gestes ---------- */
export const ACTIONS_LICENCE = {
  'lic-piece': id => { ref.open = id; ref.facture = null; refFacturePull(id); repeint(); },
  'lic-doc': k => { ref.doc = k; repeint(); },
  'lic-retour': () => { ref.open = null; ref.facture = null; ref.doc = ''; repeint(); },
  'lic-demander': k => {
    ref.sujet = k;
    repeint();
    const t = document.getElementById('rfemsg');
    if (t) t.focus();
  }
};

const val = id => ((document.getElementById(id) || {}).value || '').trim();

export const FORMULAIRES_LICENCE = {
  rfecrire: async () => {
    const message = val('rfemsg');
    ref.sujet = val('rfesujet') || 'question';
    if (!message) return toast(I.x, 'Écris ton message');
    ref.brouillon = message;
    if (await refEcrire(ref.sujet, message)) { ref.brouillon = ''; ref.sujet = 'question'; repeint(); }
  },
  rffact: async () => {
    const fiche = Object.fromEntries(CHAMPS.map(([k]) => [k, val('rff-' + k)]));
    if (fiche.siret && !siretValide(fiche.siret)) return toast(I.warn, 'Ce SIRET ne passe pas la vérification : relis-le');
    await refFacturation(fiche);
  }
};
