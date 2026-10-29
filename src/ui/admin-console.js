// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { $ } from '../racine.js';
import { I, svg } from '../icones.js';
import { SITE } from '../adresse.js';
import { accounts, adm, auth, setAnimate, view } from '../data/etat.js';
import { esc, plur } from '../core/coeur-sync.js';
import { admAgir, admCharger, admOffrirPlus, admRole } from '../core/admin.js';
import { formatCode, iso } from '../classe.js';
import { prixCampus } from '../tarifs.js';
import {
  aRelancer, BESOINS, bilanSuivi, compterEtapes, courrielReferent, ETAPES, etatLicence, filtrerSuivi, GENRES,
  lienCourriel, nouvelleDemande, OFFRES, ORDRE_ETAPES, prochainPas, trierSuivi
} from '../etablissement.js';
import { render } from './bibliotheque.js';
import { avatar } from './jeton.js';
import { toast } from './import-cartes.js';
import { timeAgo } from './reglages-corbeille.js';
import {
  ACTIONS_FACTURATION, admLicencePull, blocFacturation, FORMULAIRES_FACTURATION, suivreSaisie, vueEntreprise, vuePiece
} from './admin-facturation.js';
import { admFacturePull } from '../core/admin.js';
import {
  ACTIONS_COMPTES, blocMdp, blocProf, FORMULAIRES_COMPTES, nouveauCompte, suivreCout, suivreRole, tuileIa
} from './admin-comptes.js';
import './admin-console.css';

/* ══════════ la console de l'éditeur (2026-10-26) ══════════
   Chargée à la demande par ui/classement.js (`adminView`), avec sa feuille
   de style (préfixe ed- : jamais « ad- », que les bloqueurs de publicité
   masquent). Deux onglets : le suivi des établissements, du premier contact
   au client (docs/PARCOURS.md, § 3), et les comptes. Sur ordinateur, la
   liste à gauche et la fiche à droite ; au téléphone, l'une puis l'autre.
   L'éditeur gère des accès : il ne voit ni les livres, ni la progression,
   ni le courrier de personne. */

const PC = () => matchMedia('(min-width: 900px)').matches;
const repeint = () => { if (view.name === 'admin') { setAnimate(false); render(); } };
const vide = (ic, t) => `<div class="ed-vide">${svg(ic)}<p>${t}</p></div>`;
const euros = n => `${Math.round(+n || 0).toLocaleString('fr-FR')} €`;
const centimes = c => `${(Math.round(+c || 0) / 100).toFixed(2).replace('.', ',')} €`;
const ROLES = { eleve: 'Élève', prof: 'Professeur', ref: 'Référent', admin: 'Éditeur' };
const orgOuverte = () => (adm.orgs || []).find(o => o.id === adm.open);
// une place par élève, par professeur et par référent (20261029090000)
const licenceDe = (o, auj) => etatLicence({ ...o, eleves: (+o.eleves || 0) + (+o.profs || 0) + (+o.refs || 0) }, auj);
const kc = (n, lab, cls, attr) => `<${attr ? 'button' : 'div'} class="ed-kc ${cls || ''}" ${attr || ''}><b>${n}</b>
  <span>${lab}</span></${attr ? 'button' : 'div'}>`;

/* ---------- le haut : les chiffres qui comptent ---------- */
function chiffres() {
  const b = bilanSuivi(adm.orgs || [], iso(new Date())), e = adm.etat || {};
  const places = Object.values(adm.profs || {}).filter(p => p.demande_places).length;
  return `<div class="ed-chiffres">
      ${kc(b.demandes, 'demandes', b.demandes ? 'chaud' : '', b.demandes ? 'data-adm="voir-demandes"' : '')}
      ${places ? kc(places, 'places demandées', 'chaud', 'data-adm="voir-places"') : ''}
      ${kc(b.relances, 'à relancer', b.relances ? 'chaud' : '', b.relances ? 'data-adm="voir-relances"' : '')}
      ${kc(b.demos, 'démos')}${kc(b.clients, 'clients')}${kc(b.eleves, 'élèves')}
      ${kc(euros(b.revenu), 'par an')}${kc(centimes(e.cents_mois), 'IA ce mois')}
      ${kc(e.signalements || 0, 'signalements', e.signalements ? 'chaud' : '', 'data-act="mod"')}
    </div>`;
}

/* ---------- le suivi : la liste ---------- */
function drapeau(o, auj) {
  if (adm.attente && adm.attente[o.id]) return '<em class="ed-dr chaud">message</em>';
  if (o.statut === 'perdu') return '';
  if (nouvelleDemande(o)) return '<em class="ed-dr chaud">demande</em>';
  if (aRelancer(o, auj)) return '<em class="ed-dr chaud">relancer</em>';
  if (o.code_ref) return '<em class="ed-dr">code à transmettre</em>';
  if (!o.licence_fin) return '';
  const l = licenceDe(o, auj);
  return l.k === 'ok' ? `<em class="ed-dr">${l.places}</em>` : `<em class="ed-dr chaud">${l.k === 'echue' ? 'licence finie'
    : l.k === 'pleine' ? 'licence pleine' : 'J-' + l.jours}</em>`;
}

function ligneOrg(o, auj) {
  return `<button class="ed-ligne${adm.open === o.id ? ' on' : ''}" data-adm="org" data-id="${esc(o.id)}">
      <span class="ed-l1"><b>${esc(o.name)}</b><i>${esc([o.ville, o.contact_nom].filter(Boolean).join(' · '))}</i></span>
      <span class="ed-l2"><em class="ed-et ${esc(o.statut || 'prospect')}">${ETAPES[o.statut] || 'Prospect'}</em>${drapeau(o, auj)}</span>
    </button>`;
}

function listeSuivi() {
  const auj = iso(new Date()), tout = adm.orgs;
  if (!tout) return vide(I.build, 'Chargement…');
  const n = compterEtapes(tout), l = trierSuivi(filtrerSuivi(tout, adm.etape, adm.q), auj);
  return `<div class="ed-filtres">
      <div class="ed-puces">${['tous', ...ORDRE_ETAPES].map(k => `<button class="${adm.etape === k ? 'on' : ''}"
        data-adm="etape" data-id="${k}">${k === 'tous' ? 'Tous' : ETAPES[k]}<i>${n[k] || 0}</i></button>`).join('')}</div>
      <input id="edq" type="search" value="${esc(adm.q)}" placeholder="Nom, ville, contact, UAI" autocomplete="off"
        spellcheck="false" aria-label="Chercher un établissement">
    </div>
    ${l.length ? l.map(o => ligneOrg(o, auj)).join('') : vide(I.school, tout.length ? 'Aucun établissement ici' : 'Aucun établissement')}`;
}

/* ---------- le suivi : la fiche d'un établissement ---------- */
const champ = (id, lab, v, attr = '') => `<label class="ed-ch"><span>${lab}</span>
  <input id="${id}" value="${esc(v == null ? '' : v)}" ${attr}></label>`;

function formFiche(o, neuf) {
  const b = new Set(o.besoins || []);
  return `<form class="ed-form" id="edfiche" autocomplete="off">
      ${champ('ef-nom', 'Nom', o.name, 'maxlength="120" required')}
      <label class="ed-ch"><span>Type</span><select id="ef-genre">${Object.entries(GENRES).map(([k, t]) =>
        `<option value="${k}"${(o.kind || 'lycee') === k ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
      ${champ('ef-ville', 'Ville', o.ville, 'maxlength="80"')}
      ${champ('ef-uai', 'UAI', o.uai, 'maxlength="8" spellcheck="false" autocapitalize="characters"')}
      ${champ('ef-cnom', 'Contact', o.contact_nom, 'maxlength="80"')}
      ${champ('ef-cfon', 'Fonction', o.contact_fonction, 'maxlength="80"')}
      ${champ('ef-cmel', 'E-mail', o.contact_email, 'type="email" maxlength="120" spellcheck="false" autocapitalize="none"')}
      ${champ('ef-ctel', 'Téléphone', o.contact_tel, 'type="tel" maxlength="30"')}
      ${champ('ef-elv', 'Élèves (estimés)', o.eleves_estimes, 'inputmode="numeric" maxlength="6"')}
      ${champ('ef-bud', 'Budget (€)', o.budget_euros, 'inputmode="numeric" maxlength="7"')}
      ${champ('ef-prix', 'Prix annuel (€)', o.prix_euros, 'inputmode="numeric" maxlength="7"')}
      ${champ('ef-rel', 'Relance', o.relance, 'type="date"')}
      ${neuf ? `<label class="ed-ch"><span>Étape</span><select id="ef-etape">${ORDRE_ETAPES.map(k =>
        `<option value="${k}">${ETAPES[k]}</option>`).join('')}</select></label>` : ''}
      <fieldset class="ed-besoins"><legend>Besoins</legend>${Object.entries(BESOINS).map(([k, t]) => `<label>
        <input type="checkbox" value="${k}"${b.has(k) ? ' checked' : ''}><span>${t}</span></label>`).join('')}</fieldset>
      <label class="ed-ch large"><span>Notes</span><textarea id="ef-notes" rows="4" maxlength="4000">${esc(o.notes || '')}</textarea></label>
      ${o.message ? `<p class="ed-message">${svg(I.quote)}<span>${esc(o.message)}</span></p>` : ''}
      <div class="ed-actions"><button class="ed-b pri" type="submit">${svg(I.check)}${neuf ? 'Créer' : 'Enregistrer'}</button></div>
    </form>`;
}

/* La prochaine chose à faire, en tête de fiche. */
function blocPas(o) {
  const pas = prochainPas(o, iso(new Date()));
  if (pas === 'code') {
    const c = courrielReferent({ etab: o.name, contact: o.contact_nom, code: o.code_ref, fin: o.code_ref_fin, site: SITE });
    return `<div class="ed-pas">
        <span class="ed-pas-t">${svg(I.key)}Code référent à transmettre</span>
        <b class="ed-code">${formatCode(o.code_ref)}</b>
        <div class="ed-actions">
          ${o.contact_email ? `<a class="ed-b pri" href="${esc(lienCourriel(o.contact_email, c))}">${svg(I.mail)}Écrire à ${esc(o.contact_nom || o.contact_email)}</a>` : ''}
          <button class="ed-b" data-adm="copier-courriel">${svg(I.copy)}Copier le message</button>
          <button class="ed-b" data-adm="code-ref" title="L’ancien cessera de marcher">${svg(I.refresh)}Nouveau code</button>
        </div>
      </div>`;
  }
  if (pas === 'demo') {
    return `<form class="ed-pas" id="eddemo" autocomplete="off">
        <span class="ed-pas-t">${svg(I.rocket)}Lancer la démo</span>
        <div class="ed-ligne-f">
          ${champ('ed-dpl', 'Places', o.eleves_estimes ? Math.min(+o.eleves_estimes, 2000) : 60, 'inputmode="numeric" maxlength="5"')}
          <label class="ed-ch"><span>Durée</span><select id="ed-djr">${[14, 30, 60, 90].map(j =>
            `<option value="${j}"${j === 30 ? ' selected' : ''}>${j} jours</option>`).join('')}</select></label>
          <label class="ed-coche"><input type="checkbox" id="ed-dex" checked><span>Classes d’exemple</span></label>
          <button class="ed-b pri" type="submit">${svg(I.rocket)}Lancer</button>
        </div>
      </form>`;
  }
  if (pas === 'licence') return `<form class="ed-pas" id="edlicence" autocomplete="off">
      <span class="ed-pas-t">${svg(I.money)}Passer en licence</span>${champsLicence(o, true, 'lp')}</form>`;
  return '';
}

/* La date de fin proposée : le 31 août qui suit (l'année scolaire). */
const finAnnee = () => { const d = new Date(), a = d.getFullYear() + (d.getMonth() >= 6 ? 1 : 0); return `${a}-08-31`; };

// le prix de la grille (src/tarifs.js), en euros HT : celui que propose « Passer en licence »
const grille = places => (+places ? Math.round(prixCampus(+places) / 100) : '');

/* `p` préfixe les identifiants : la fiche d'une démo montre les deux formulaires à la fois. */
function champsLicence(o, passer, p) {
  const places = passer ? Math.max(+o.eleves_estimes || 0, +o.eleves || 0, +o.places || 0) || '' : o.places;
  return `<div class="ed-ligne-f">
      ${passer ? '' : `<label class="ed-ch"><span>Offre</span><select id="${p}-offre">${Object.entries(OFFRES).map(([k, t]) =>
        `<option value="${k}"${(o.offre || 'demo') === k ? ' selected' : ''}>${t}</option>`).join('')}</select></label>`}
      ${champ(p + '-pl', 'Places', places, 'inputmode="numeric" maxlength="6"')}
      ${champ(p + '-fin', 'Fin', passer ? finAnnee() : o.licence_fin, 'type="date"')}
      ${passer ? champ(p + '-prix', 'Prix annuel HT (€)', o.prix_euros || grille(places),
        `inputmode="numeric" maxlength="7" title="La grille : ${grille(places) || '…'} € HT pour ${places || '…'} places"`) : ''}
      <button class="ed-b pri" type="submit">${svg(I.check)}${passer ? 'Passer en licence' : 'Enregistrer'}</button>
    </div>`;
}

function tuileLicence(o) {
  if (!o.licence_fin && o.places == null) return '';
  const l = licenceDe(o, iso(new Date()));
  return `<div class="ed-tuile">
      <div class="ed-tl">${l.offre}<span>${l.k === 'echue' ? 'finie le ' : 'jusqu’au '}${l.fin}</span></div>
      <div class="ed-barre"><i style="width:${l.pc}%"></i></div>
      <div class="ed-tl-p" title="Une place par élève, par professeur et par référent"><b>${l.places}</b> places</div>
      <details class="ed-modif"><summary>Modifier la licence</summary>
        <form id="edlicence2" autocomplete="off">${champsLicence(o, false, 'lm')}</form></details>
    </div>`;
}

function tuileUsage(o) {
  const ouverts = (+o.eleves || 0) + (+o.profs || 0) + (+o.refs || 0), venus = Math.max(0, ouverts - (+o.jamais_venus || 0));
  if (!ouverts) return '';
  return `<div class="ed-tuile ed-usage">
      ${kc(o.classes, 'classes')}${kc(o.eleves, 'élèves')}${kc(o.profs, 'profs')}
      ${kc(`${venus}/${ouverts}`, 'venus', ouverts && venus / ouverts < 0.25 ? 'chaud' : '')}
      ${kc(o.actifs7, 'actifs 7 j')}${kc(centimes(o.cents_mois), 'IA ce mois')}
    </div>`;
}

function codesEtab(o) {
  if (!o.code_eleve && !o.code_prof) return '';
  return `<div class="ed-codes" title="Les codes que le référent distribue">
      <span>${svg(I.users)}Élèves <code>${formatCode(o.code_eleve || '')}</code></span>
      <span>${svg(I.school)}Professeurs <code>${formatCode(o.code_prof || '')}</code></span>
    </div>`;
}

function ficheOrg() {
  if (adm.open === 'nouveau') {
    return `<div class="ed-fiche"><div class="ed-qui"><div><b>Nouvel établissement</b></div></div>
      ${formFiche({ besoins: [] }, true)}</div>`;
  }
  const o = orgOuverte();
  if (!o) return vide(I.school, 'Choisis un établissement');
  const vides = !((+o.eleves || 0) + (+o.profs || 0) + (+o.refs || 0));
  return `<div class="ed-fiche">
      ${PC() ? '' : `<button class="ed-b sm" data-adm="fermer">${svg(I.back)}Retour</button>`}
      <div class="ed-qui"><div><b>${esc(o.name)}</b>
        <i>${esc([o.ville, o.uai && 'UAI ' + o.uai, GENRES[o.kind]].filter(Boolean).join(' · '))}${o.source === 'demande'
          ? ' · demande du site' : ''}${o.suivi_maj ? ' · ' + timeAgo(o.suivi_maj) : ''}</i></div>
        <select class="ed-etape" id="edetape" aria-label="Étape">${ORDRE_ETAPES.map(k =>
          `<option value="${k}"${(o.statut || 'prospect') === k ? ' selected' : ''}>${ETAPES[k]}</option>`).join('')}</select>
      </div>
      ${blocPas(o)}
      ${tuileLicence(o)}${tuileUsage(o)}${tuileIa(o)}${codesEtab(o)}
      ${o.licence_fin || o.places != null || o.statut === 'client' ? blocFacturation(o) : ''}
      <h2 class="ed-h2">Fiche</h2>
      ${formFiche(o, false)}
      ${vides ? `<button class="ed-b ko discret" data-adm="supprimer">${svg(I.trash)}<span>Effacer cet établissement et son contact</span></button>` : ''}
    </div>`;
}

/* ---------- les comptes ---------- */
function comptesFiltres() {
  const l = accounts || [], v = adm.cq.trim().toLowerCase();
  return l.filter(a => (!adm.crole || a.role === adm.crole)
    && (!v || [a.name, a.handle, a.email].some(x => String(x || '').toLowerCase().includes(v))));
}

function listeComptes() {
  if (!accounts) return vide(I.users, 'Chargement…');
  const n = r => accounts.filter(a => a.role === r).length, l = comptesFiltres(), montres = l.slice(0, 200);
  return `<div class="ed-filtres">
      <div class="ed-puces">${['', 'eleve', 'prof', 'ref', 'admin'].map(k => `<button class="${adm.crole === k ? 'on' : ''}"
        data-adm="crole" data-id="${k}">${k ? ROLES[k] : 'Tous'}<i>${k ? n(k) : accounts.length}</i></button>`).join('')}</div>
      <input id="edcq" type="search" value="${esc(adm.cq)}" placeholder="Nom, pseudo, adresse" autocomplete="off"
        spellcheck="false" aria-label="Chercher un compte">
    </div>
    ${montres.map(a => `<button class="ed-ligne${adm.copen === a.id ? ' on' : ''}" data-adm="compte" data-id="${esc(a.id)}">
      ${avatar(a.id, a.handle || a.name || '', 'sm')}
      <span class="ed-l1"><b>${esc(a.name || a.handle || a.email)}</b><i>${esc(a.email)}</i></span>
      <span class="ed-l2"><em class="ed-role ${esc(a.role)}">${ROLES[a.role] || esc(a.role)}</em>${
        (adm.profs || {})[a.id] && adm.profs[a.id].demande_places ? '<em class="ed-dr chaud">places</em>' : ''}</span></button>`).join('')
      || vide(I.search, 'Personne')}
    ${l.length > montres.length ? `<p class="ed-rien">et ${l.length - montres.length} autres : affine la recherche</p>` : ''}`;
}

function ficheCompte() {
  if (adm.copen === 'nouveau') return nouveauCompte();
  const a = (accounts || []).find(x => x.id === adm.copen);
  if (!a) return vide(I.user, 'Choisis un compte');
  const moi = a.id === auth.uid;
  return `<div class="ed-fiche">
      ${PC() ? '' : `<button class="ed-b sm" data-adm="fermer">${svg(I.back)}Retour</button>`}
      <div class="ed-qui">${avatar(a.id, a.handle || a.name || '', 'lg')}<div><b>${esc(a.name || a.handle || a.email)}</b>
        <i>${esc(a.email)}${a.handle ? ' · @' + esc(a.handle) : ''} · ${plur(+a.livres || 0, 'livre')}${a.cree ? ' · ' + timeAgo(a.cree) : ''}</i></div></div>
      <h2 class="ed-h2">Rôle</h2>
      <div class="ed-seg" role="radiogroup">${Object.entries(ROLES).map(([k, t]) => `<button role="radio" aria-checked="${a.role === k}"
        class="${a.role === k ? 'on' : ''}" data-adm="role" data-id="${k}" ${moi && k !== 'admin' ? 'disabled' : ''}>${t}</button>`).join('')}</div>
      ${moi ? '<p class="ed-rien">C’est ton compte : tu ne peux pas te retirer ton rôle.</p>' : ''}
      <h2 class="ed-h2">Mirandola+</h2>
      <div class="ed-seg"><button data-adm="offrir">${svg(I.spark)}Offrir Mirandola+</button>
        <button data-adm="reprendre">Reprendre</button></div>
      <p class="ed-rien">Offert sans fin. Un abonnement payé reste à Stripe ou au magasin.</p>
      ${blocProf(a)}${blocMdp(a)}
    </div>`;
}

/* Depuis une adresse (ui/routeur.js, par la porte ui/classement.js). */
export function allerA(k, id) {
  adm.tab = ['comptes', 'entreprise'].includes(k) ? k : 'suivi';
  adm.fid = null;
  if (k === 'facture' && id) {
    // une pièce ouverte depuis son adresse : sa fiche derrière elle
    adm.fid = id;
    admFacturePull(id).then(() => { if (adm.facture) { adm.open = adm.facture.org_id; admLicencePull(adm.open); } });
  } else if (adm.tab === 'suivi') {
    adm.open = id || null;
    if (id) admLicencePull(id);
  } else if (adm.tab === 'comptes') adm.copen = id || null;
  repeint();
}

/* ---------- l'écran ---------- */
const NOUVEAU = { suivi: ['nouveau', 'Établissement'], comptes: ['nouveau-compte', 'Compte'] };
const boutonNouveau = () => {
  const n = NOUVEAU[adm.tab];
  return n ? `<button class="ed-b pri ed-nouveau" data-adm="${n[0]}">${svg(I.plus)}<span>${n[1]}</span></button>` : '';
};

export function consoleAdmin() {
  if (!adm.charge) { adm.charge = true; admCharger(); }
  const suivi = adm.tab === 'suivi', ouvert = suivi ? adm.open : adm.copen;
  const liste = suivi ? listeSuivi() : listeComptes(), fiche = suivi ? ficheOrg() : ficheCompte();
  const corps = adm.tab === 'entreprise' ? vueEntreprise() : adm.fid ? vuePiece()
    : PC() ? `<div class="ed-maitre"><div class="ed-liste">${liste}</div><div class="ed-detail">${fiche}</div></div>`
      : `<div class="ed-liste">${ouvert ? fiche : liste}</div>`;
  $.innerHTML = `<div class="page ed" id="page">
      <div class="top"><div class="hero">Administration</div>
        ${boutonNouveau()}</div>
      ${adm.err && !adm.orgs?.length && !accounts?.length ? vide(I.lock, 'Réservé à l’éditeur') : `${chiffres()}
      <section class="ed-corps">${corps}</section>`}
    </div>`;
}

/* ---------- les gestes ---------- */
const val = id => ((document.getElementById(id) || {}).value || '').trim();

/* La fiche telle que la base l'attend : tous les champs, car
   admin_etab_enregistrer réécrit la ligne entière (une étape changée seule
   effacerait le reste si on ne renvoyait pas tout). */
const ficheDe = o => ({ nom: o.name, genre: o.kind, ville: o.ville, uai: o.uai, statut: o.statut || 'prospect',
  contact_nom: o.contact_nom, contact_fonction: o.contact_fonction, contact_email: o.contact_email,
  contact_tel: o.contact_tel, eleves_estimes: o.eleves_estimes ?? '', budget_euros: o.budget_euros ?? '',
  prix_euros: o.prix_euros ?? '', besoins: o.besoins || [], notes: o.notes || '', relance: o.relance || '' });

const chiffre = s => s.replace(/\s/g, '');

function ficheDuFormulaire(o) {
  return { ...ficheDe(o || {}), nom: val('ef-nom'), genre: val('ef-genre'), ville: val('ef-ville'), uai: val('ef-uai'),
    contact_nom: val('ef-cnom'), contact_fonction: val('ef-cfon'), contact_email: val('ef-cmel'), contact_tel: val('ef-ctel'),
    eleves_estimes: chiffre(val('ef-elv')), budget_euros: chiffre(val('ef-bud')), prix_euros: chiffre(val('ef-prix')),
    relance: val('ef-rel'), notes: (document.getElementById('ef-notes') || {}).value || '',
    besoins: [...document.querySelectorAll('.ed-besoins input:checked')].map(i => i.value),
    ...(o ? {} : { statut: val('ef-etape') || 'prospect' }) };
}

async function copierCourriel() {
  const o = orgOuverte(); if (!o) return;
  const c = courrielReferent({ etab: o.name, contact: o.contact_nom, code: o.code_ref, fin: o.code_ref_fin, site: SITE });
  try { await navigator.clipboard.writeText(c.corps); toast(I.check, 'Message copié'); }
  catch (e) { toast(I.x, 'Copie impossible'); }
}

const ACTIONS = {
  ...ACTIONS_FACTURATION,
  ...ACTIONS_COMPTES,
  'voir-places': () => { const p = Object.values(adm.profs || {}).find(x => x.demande_places);
    Object.assign(adm, { tab: 'comptes', crole: 'prof', copen: p ? p.id : null }); repeint(); },
  onglet: k => { adm.tab = k; adm.fid = null; repeint(); },
  etape: k => { adm.etape = k; repeint(); },
  'voir-demandes': () => { Object.assign(adm, { tab: 'suivi', etape: 'prospect', q: '' }); repeint(); },
  'voir-relances': () => { Object.assign(adm, { tab: 'suivi', etape: 'tous', q: '' }); repeint(); },
  org: id => { adm.open = id; admLicencePull(id); repeint(); },
  nouveau: () => { adm.open = 'nouveau'; adm.tab = 'suivi'; repeint(); setTimeout(() => document.getElementById('ef-nom')?.focus(), 60); },
  fermer: () => { adm.open = null; adm.copen = null; repeint(); },
  crole: k => { adm.crole = k; repeint(); },
  compte: id => { adm.copen = id; if (adm.neuf && adm.neuf.mdpDe !== id) adm.neuf = null; adm.tab = 'comptes'; repeint(); },
  role: k => { const a = (accounts || []).find(x => x.id === adm.copen); if (a && a.role !== k) admRole(a.id, k); },
  offrir: () => { if (adm.copen) admOffrirPlus(adm.copen, false); },
  reprendre: () => { if (adm.copen) admOffrirPlus(adm.copen, true); },
  'copier-courriel': copierCourriel,
  'code-ref': () => admAgir('admin_code_ref', { org: adm.open }, 'Nouveau code référent : l’ancien ne marche plus'),
  supprimer: async (id, b) => {
    if (b.dataset.arme !== '1') { b.dataset.arme = '1'; b.querySelector('span').textContent = 'Sûr ? Effacer pour de bon'; return; }
    if (await admAgir('admin_supprimer_etab', { org: adm.open }, 'Établissement effacé')) { adm.open = null; repeint(); }
  }
};

document.addEventListener('click', e => {
  const b = e.target.closest('[data-adm]');
  if (!b || b.disabled || view.name !== 'admin') return;
  const f = ACTIONS[b.dataset.adm];
  if (!f) return;
  e.preventDefault();
  f(b.dataset.id, b);
});

const nombre = id => { const v = chiffre(val(id)); return v === '' ? null : +v; };

const FORMULAIRES = {
  ...FORMULAIRES_FACTURATION,
  ...FORMULAIRES_COMPTES,
  edfiche: async () => {
    const o = adm.open === 'nouveau' ? null : orgOuverte();
    const r = await admAgir('admin_etab_enregistrer', { org: o ? o.id : null, fiche: ficheDuFormulaire(o) },
      o ? 'Fiche enregistrée' : 'Établissement créé');
    if (r && !o) { adm.open = r; repeint(); }
  },
  eddemo: () => admAgir('admin_lancer_demo', { org: adm.open, places: nombre('ed-dpl'), jours: +val('ed-djr') || 30,
    exemples: !!(document.getElementById('ed-dex') || {}).checked }, 'Démo lancée : transmets le code référent'),
  edlicence: async () => {
    const o = orgOuverte(); if (!o) return;
    // tout se lit avant d'envoyer : le repeint qui suit la licence fait disparaître ce formulaire
    const fin = val('lp-fin'), places = nombre('lp-pl'), prix = chiffre(val('lp-prix'));
    if (!fin) return toast(I.x, 'Indique la date de fin');
    const r = await admAgir('admin_licence', { org: o.id, places, fin, offre: 'etablissement' }, 'Licence enregistrée : client');
    if (r && prix !== '' && +prix !== +o.prix_euros) {
      const maj = orgOuverte() || o;
      await admAgir('admin_etab_enregistrer', { org: o.id, fiche: { ...ficheDe(maj), prix_euros: prix } }, '');
    }
  },
  edlicence2: () => {
    const o = orgOuverte(); if (!o) return;
    return admAgir('admin_licence', { org: o.id, places: nombre('lm-pl'), fin: val('lm-fin') || null, offre: val('lm-offre') },
      'Licence enregistrée');
  }
};

document.addEventListener('submit', e => {
  const f = FORMULAIRES[e.target.id];
  if (!f || view.name !== 'admin') return;
  e.preventDefault();
  f();
});

/* L'étape changée en tête de fiche s'enregistre aussitôt. */
document.addEventListener('change', e => {
  if (view.name === 'admin') suivreRole(e);
  if (e.target.id !== 'edetape' || view.name !== 'admin') return;
  const o = orgOuverte(); if (!o) return;
  admAgir('admin_etab_enregistrer', { org: o.id, fiche: { ...ficheDe(o), statut: e.target.value } }, 'Étape : ' + ETAPES[e.target.value]);
});

/* Les recherches ne repeignent que la liste — jamais le champ où l'on tape. */
document.addEventListener('input', e => {
  if (view.name === 'admin') { suivreSaisie(e); suivreCout(e); }
  if (view.name !== 'admin' || !['edq', 'edcq'].includes(e.target.id)) return;
  if (e.target.id === 'edq') adm.q = e.target.value; else adm.cq = e.target.value;
  const liste = document.querySelector('.ed-liste');
  if (!liste) return;
  const html = adm.tab === 'suivi' ? listeSuivi() : listeComptes(), tmp = document.createElement('div');
  tmp.innerHTML = html;
  [...liste.children].forEach(n => { if (!n.classList.contains('ed-filtres')) n.remove(); });
  [...tmp.children].forEach(n => { if (!n.classList.contains('ed-filtres')) liste.appendChild(n); });
});
