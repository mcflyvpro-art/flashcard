// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { I, svg } from '../icones.js';
import { SITE } from '../adresse.js';
import { accounts, adm, auth, setAnimate, view } from '../data/etat.js';
import { esc, plur } from '../core/coeur-sync.js';
import { admCreerCompte, admIa, admLicenceProf, admMdp } from '../core/admin.js';
import { nomPropre, nomValide } from '../classe.js';
import { coutIA, eurosDe } from '../cout-ia.js';
import { courrielCompte, lienCourriel, motDePasseProvisoire } from '../etablissement.js';
import { prixCampus } from '../tarifs.js';
import { render } from './bibliotheque.js';
import { toast } from './import-cartes.js';
import { timeAgo } from './reglages-corbeille.js';

/* ══════════ les comptes que l'éditeur ouvre (2026-10-29) ══════════
   Dans la console de l'éditeur (chargé avec elle, ui/admin-console.js) :
   « Nouveau compte » — un professeur particulier et sa licence (des places
   d'élèves, l'IA du mois pour lui et pour chaque élève, une fin), un autre
   éditeur, un élève —, la licence d'un professeur particulier dans sa
   fiche, un nouveau mot de passe provisoire pour n'importe quel compte, et
   l'IA d'un établissement. Chaque quota d'IA dit aussitôt ce qu'il peut
   coûter (src/cout-ia.js) : le coût moyen d'une génération, mesuré, fois
   tout ce qui est accordé. Un mot de passe provisoire n'est montré qu'ici,
   une fois, avec le message tout écrit à envoyer. */

const repeint = () => { if (view.name === 'admin') { setAnimate(false); render(); } };
const alea = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
const val = id => ((document.getElementById(id) || {}).value || '').trim();
const nombre = (id, d) => { const v = val(id).replace(/\s/g, ''); return v === '' ? d : +v; };
const champ = (id, lab, v, attr = '') => `<label class="ed-ch"><span>${lab}</span>
  <input id="${id}" value="${esc(v == null ? '' : v)}" ${attr}></label>`;
const ROLES_NEUFS = { prof: 'Professeur particulier', admin: 'Éditeur', eleve: 'Élève' };

/* ---------- ce que coûte l'IA, en une ligne ---------- */
function ligneCout(o) {
  const c = coutIA({ ...o, moyenne: adm.cout && adm.cout.moyenne });
  return `${svg(I.spark)}<span>IA : <b>${eurosDe(c.cents)}</b> par mois au plus · ${eurosDe(c.centsAn)} par an
    <i>${plur(c.generations, 'génération')} · ${eurosDe(c.parGeneration).replace(/,00 €$/, ' €')} l’une${c.estime ? ' (estimé)' : ''}</i></span>`;
}
// un prix de licence indicatif, la grille de src/tarifs.js : les places des élèves et celle du professeur
const ligneLicence = places => (+places > 0 ? `${svg(I.money)}<span>Licence : <b>${Math.round(prixCampus(+places + 1) / 100)} € HT</b> par an
    <i>la grille pour ${+places + 1} places</i></span>` : '');

const champsLicence = (p, l) => `<div class="ed-ligne-f">
    ${champ(p + '-places', 'Places d’élèves', l.places, 'inputmode="numeric" maxlength="5" data-cout')}
    ${champ(p + '-iap', 'IA du professeur / mois', l.ia_prof, 'inputmode="numeric" maxlength="5" data-cout')}
    ${champ(p + '-iae', 'IA par élève / mois', l.ia_eleve, 'inputmode="numeric" maxlength="4" data-cout')}
    ${champ(p + '-fin', 'Fin (vide : sans fin)', l.fin || '', 'type="date"')}
  </div>
  <p class="ed-cout" id="${p}-cout">${ligneCout({ profs: 1, eleves: l.places, iaProf: l.ia_prof, iaEleve: l.ia_eleve })}</p>
  <p class="ed-cout" id="${p}-prix">${ligneLicence(l.places)}</p>`;

const licenceDuFormulaire = p => ({ places: nombre(p + '-places', 0), ia_prof: nombre(p + '-iap', 0),
  ia_eleve: nombre(p + '-iae', 0), fin: val(p + '-fin') || null });

/* Le coût suit la saisie, sans repeindre le formulaire. */
export function suivreCout(e) {
  if (!e.target.hasAttribute || !e.target.hasAttribute('data-cout')) return;
  const id = e.target.id || '';
  if (id.startsWith('ia-')) {
    const o = (adm.orgs || []).find(x => x.id === adm.open) || {};
    const p = document.getElementById('ia-cout');
    if (p) p.innerHTML = ligneCout({ profs: +o.profs || 0, eleves: +o.eleves || 0, iaProf: nombre('ia-prof', 0), iaEleve: nombre('ia-eleve', 0) });
    return;
  }
  const p = id.split('-')[0], l = licenceDuFormulaire(p);
  const c = document.getElementById(p + '-cout'), x = document.getElementById(p + '-prix');
  if (c) c.innerHTML = ligneCout({ profs: 1, eleves: l.places, iaProf: l.ia_prof, iaEleve: l.ia_eleve });
  if (x) x.innerHTML = ligneLicence(l.places);
}

/* ---------- le mot de passe montré une fois, et son message ---------- */
function carteMdp(n) {
  const c = courrielCompte({ nom: n.nom, email: n.adresse, pw: n.pw, role: n.role, site: SITE });
  return `<div class="ed-pas ed-mdp">
      <span class="ed-pas-t">${svg(I.key)}${esc(n.titre || 'Compte ouvert')}</span>
      <div class="ed-mdp-l"><span>${esc(n.adresse)}</span><b class="ed-code">${esc(n.pw)}</b></div>
      <p class="ed-rien">Montré une seule fois : il le remplace à sa première connexion.</p>
      <div class="ed-actions">
        <a class="ed-b pri" href="${esc(lienCourriel(n.adresse, c))}">${svg(I.mail)}Écrire à ${esc(n.nom || n.adresse)}</a>
        <button class="ed-b" data-adm="copier-acces">${svg(I.copy)}Copier le message</button>
        ${n.id ? `<button class="ed-b" data-adm="compte" data-id="${esc(n.id)}">${svg(I.user)}Sa fiche</button>` : ''}
      </div>
    </div>`;
}

/* ---------- « Nouveau compte » ---------- */
export function nouveauCompte() {
  const n = adm.neuf || {};
  if (n.fait) {
    return `<div class="ed-fiche"><div class="ed-qui"><div><b>${esc(n.nom)}</b><i>${esc(ROLES_NEUFS[n.role] || '')}</i></div></div>
      ${carteMdp(n)}
      <button class="ed-b" data-adm="nouveau-compte">${svg(I.plus)}Un autre compte</button></div>`;
  }
  const prof = (n.role || 'prof') === 'prof';
  return `<div class="ed-fiche"><div class="ed-qui"><div><b>Nouveau compte</b></div></div>
    <form class="ed-form" id="ednouveau" autocomplete="off">
      <label class="ed-ch"><span>Rôle</span><select id="nc-role">${Object.entries(ROLES_NEUFS).map(([k, t]) =>
        `<option value="${k}"${(n.role || 'prof') === k ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
      ${champ('nc-prenom', 'Prénom', n.prenom, 'maxlength="40" required')}
      ${champ('nc-nom', 'Nom', n.nomfam, 'maxlength="40" required')}
      ${champ('nc-mail', 'Adresse e-mail', n.adresse, 'type="email" maxlength="200" spellcheck="false" autocapitalize="none" required')}
      ${champ('nc-pw', 'Mot de passe provisoire', n.pw || motDePasseProvisoire(alea), 'minlength="10" maxlength="72" spellcheck="false" autocapitalize="none"')}
      <fieldset class="ed-licence" id="nc-licence" ${prof ? '' : 'hidden'}><legend>Licence Campus</legend>
        ${champsLicence('nc', { places: 30, ia_prof: 400, ia_eleve: 30, fin: '' })}</fieldset>
      <div class="ed-actions"><button class="ed-b pri" type="submit">${svg(I.check)}Ouvrir le compte</button></div>
    </form></div>`;
}

/* ---------- dans la fiche d'un compte ---------- */
function etatLicenceProf(p) {
  if (!p.licence) return '<p class="ed-rien">Pas encore de licence : ses élèves ne peuvent pas entrer.</p>';
  const fini = p.fin && p.fin < new Date().toISOString().slice(0, 10);
  return `<div class="ed-tuile ed-usage">
      <div class="ed-kc"><b>${p.inscrits}<small>/${p.places}</small></b><span>élèves</span></div>
      <div class="ed-kc ${p.attente ? 'chaud' : ''}"><b>${p.attente}</b><span>en attente</span></div>
      <div class="ed-kc"><b>${Math.max(0, p.places - p.prises)}</b><span>places libres</span></div>
      <div class="ed-kc"><b>${p.ia_mois}<small>/${p.ia_prof}</small></b><span>IA ce mois</span></div>
      <div class="ed-kc ${fini ? 'chaud' : ''}"><b>${p.fin ? esc(p.fin.split('-').reverse().join('/')) : '∞'}</b><span>${fini ? 'finie' : 'fin'}</span></div>
    </div>`;
}

export function blocProf(a) {
  const p = (adm.profs || {})[a.id];
  if (a.role !== 'prof' || !p) return '';
  const l = p.licence ? p : { places: p.demande_places || 30, ia_prof: 400, ia_eleve: 30, fin: '' };
  return `<h2 class="ed-h2">Licence Campus${p.demande_places ? '<em class="ed-dr chaud">places demandées</em>' : ''}</h2>
    ${etatLicenceProf(p)}
    ${p.demande_places ? `<p class="ed-message">${svg(I.quote)}<span><b>${plur(p.demande_places, 'place')} de plus</b>${
      p.demande_mot ? ' · ' + esc(p.demande_mot) : ''} · ${timeAgo(p.demande_le)}</span></p>` : ''}
    <form class="ed-form" id="edlicprof" autocomplete="off">
      ${champsLicence('pl', { ...l, places: p.demande_places ? (+p.places || 0) + p.demande_places : l.places })}
      <div class="ed-actions"><button class="ed-b pri" type="submit">${svg(I.check)}${p.licence ? 'Enregistrer la licence' : 'Accorder la licence'}</button></div>
    </form>`;
}

export function blocMdp(a) {
  if (a.id === auth.uid) return '';
  const n = adm.neuf && adm.neuf.mdpDe === a.id ? adm.neuf : null;
  return `<h2 class="ed-h2">Mot de passe</h2>
    ${n ? carteMdp(n) : `<button class="ed-b" data-adm="nouveau-mdp">${svg(I.key)}Nouveau mot de passe provisoire</button>`}`;
}

/* ---------- l'IA d'un établissement ---------- */
export function tuileIa(o) {
  const ia = (adm.ia || {})[o.id];
  if (!ia) return '';
  return `<form class="ed-tuile" id="edia" autocomplete="off">
      <div class="ed-tl">${svg(I.spark)}IA par mois</div>
      <div class="ed-ligne-f">
        ${champ('ia-prof', 'Par professeur', ia.ia_prof, 'inputmode="numeric" maxlength="5" data-cout')}
        ${champ('ia-eleve', 'Par élève', ia.ia_eleve, 'inputmode="numeric" maxlength="4" data-cout')}
        <button class="ed-b" type="submit">${svg(I.check)}Enregistrer</button>
      </div>
      <p class="ed-cout" id="ia-cout">${ligneCout({ profs: +o.profs || 0, eleves: +o.eleves || 0, iaProf: ia.ia_prof, iaEleve: ia.ia_eleve })}</p>
    </form>`;
}

/* ---------- les gestes ---------- */
async function copierAcces() {
  const n = adm.neuf; if (!n) return;
  const c = courrielCompte({ nom: n.nom, email: n.adresse, pw: n.pw, role: n.role, site: SITE });
  try { await navigator.clipboard.writeText(c.corps); toast(I.check, 'Message copié'); }
  catch (e) { toast(I.x, 'Copie impossible : recopie-le'); }
}

async function nouveauMdp() {
  const a = (accounts || []).find(x => x.id === adm.copen); if (!a) return;
  const pw = motDePasseProvisoire(alea);
  if (await admMdp(a.id, pw)) {
    adm.neuf = { mdpDe: a.id, titre: 'Nouveau mot de passe provisoire', nom: a.name || a.handle || '', adresse: a.email, pw, role: a.role };
    repeint();
  }
}

/* Le premier champ d'un formulaire qui s'ouvre, un instant après : jamais
   sous les doigts — un champ déjà actif le garde (sinon la suite de la
   saisie partait dans le premier : « Lycée NeufArles »). */
export function premierChamp(id) {
  setTimeout(() => {
    const a = document.activeElement;
    if (!(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) document.getElementById(id)?.focus();
  }, 60);
}

export const ACTIONS_COMPTES = {
  'nouveau-compte': () => { Object.assign(adm, { tab: 'comptes', copen: 'nouveau', neuf: { role: 'prof' } }); repeint();
    premierChamp('nc-prenom'); },
  'copier-acces': copierAcces,
  'nouveau-mdp': nouveauMdp
};

export const FORMULAIRES_COMPTES = {
  ednouveau: async () => {
    const role = val('nc-role') || 'prof', prenom = val('nc-prenom'), nomfam = val('nc-nom'),
      adresse = val('nc-mail').toLowerCase(), pw = val('nc-pw');
    adm.neuf = { role, prenom, nomfam, adresse, pw };
    if (!nomValide(prenom) || !nomValide(nomfam)) return toast(I.x, 'Le prénom et le nom');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(adresse)) return toast(I.x, 'Une adresse e-mail');
    if (pw.length < 10) return toast(I.x, 'Mot de passe : dix caractères au moins');
    const nom = nomPropre(prenom, nomfam), licence = role === 'prof' ? licenceDuFormulaire('nc') : null;
    const id = await admCreerCompte({ adresse, nom, qrole: role, pw, licence });
    if (id) { adm.neuf = { fait: true, id, role, nom, adresse, pw }; toast(I.check, 'Compte ouvert'); repeint(); }
  },
  edlicprof: () => (adm.copen ? admLicenceProf(adm.copen, licenceDuFormulaire('pl')) : null),
  edia: () => (adm.open ? admIa(adm.open, nombre('ia-prof', 0), nombre('ia-eleve', 0)) : null)
};

/* Le rôle choisi montre ou cache la licence, sans repeindre ce qu'on a tapé. */
export function suivreRole(e) {
  if (e.target.id !== 'nc-role') return;
  const f = document.getElementById('nc-licence');
  if (f) f.hidden = e.target.value !== 'prof';
}
