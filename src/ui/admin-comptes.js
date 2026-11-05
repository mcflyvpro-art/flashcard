// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { I, svg } from '../icones.js';
import { SITE } from '../adresse.js';
import { accounts, adm, auth, setAnimate, view } from '../data/etat.js';
import { esc, plur } from '../core/coeur-sync.js';
import { admConfirmer, admCreerCompte, admIa, admLicenceProf, admMdp, admSupprimer, admSuspendre } from '../core/admin.js';
import {
  bilanSuppression, compterFiltres, FILTRES, filtrerComptes, finSuspension, sansFin, SUSPENSIONS, TRIS, trierComptes
} from '../comptes.js';
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

/* ══════════ tous les comptes, et la main sur chacun (2026-11-05) ══════════
   Trier et filtrer toute l'app (src/comptes.js), choisir plusieurs comptes
   pour les supprimer d'un coup, et dans la fiche : ce qu'on sait du compte
   (jamais le contenu de ses livres), confirmer son adresse, le suspendre,
   le supprimer. Tout ce qui efface demande deux appuis. */
const ORDRE_SUSPENSIONS = ['1', '7', '30', '0'];
const leJour = x => new Date(x).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

export const comptesVus = () => trierComptes(filtrerComptes(accounts || [],
  { role: adm.crole, filtre: adm.cfiltre, q: adm.cq }), adm.ctri);

// ce que la ligne dit à droite, selon le tri : on voit pourquoi elle est là
export function detailLigne(a) {
  const t = adm.ctri;
  if (t === 'vu') return a.vu ? timeAgo(a.vu) : 'jamais';
  if (t === 'revise') return a.revise ? timeAgo(a.revise) : 'aucune';
  if (t === 'revisions') return plur(+a.revisions || 0, 'révision');
  if (t === 'livres') return plur(+a.livres || 0, 'livre');
  return a.cree ? timeAgo(a.cree) : '';
}

export function outilsComptes() {
  const n = compterFiltres(accounts || [], { role: adm.crole, q: adm.cq }), sel = adm.csel;
  return `<div class="ed-outils">
      <label class="ed-ch"><span>Trier</span><select id="edctri">${Object.entries(TRIS).map(([k, t]) =>
        `<option value="${k}"${adm.ctri === k ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
      <label class="ed-ch"><span>Afficher</span><select id="edcfiltre">${Object.entries(FILTRES).map(([k, [t]]) =>
        `<option value="${k}"${adm.cfiltre === k ? ' selected' : ''}>${t} (${n[k]})</option>`).join('')}</select></label>
      <button class="ed-b${sel ? ' pri' : ''}" data-adm="csel">${svg(I.check)}${sel ? 'Fini' : 'Choisir'}</button>
    </div>
    ${sel ? `<div class="ed-lot">
      <b>${plur(sel.length, 'compte')}</b>
      <button class="ed-b sm" data-adm="ctout">Tous ceux affichés</button>
      <button class="ed-b sm" data-adm="caucun" ${sel.length ? '' : 'disabled'}>Aucun</button>
      <button class="ed-b sm ko" data-adm="csuppr-lot" ${sel.length ? '' : 'disabled'}>${svg(I.trash)}<span>Supprimer</span></button>
    </div>` : ''}`;
}

const oui = (v, o, n) => (v ? o : n);
export function infosCompte(a) {
  if (!('vu' in a)) return '';     // une base sans admin_comptes : rien de plus à dire
  const ligne = (t, v, cls = '') => `<div class="${cls}"><span>${t}</span><b>${v}</b></div>`;
  return `<div class="ed-infos">
      ${ligne('Dernière connexion', a.vu ? timeAgo(a.vu) : 'jamais', a.vu ? '' : 'chaud')}
      ${ligne('Adresse', oui(a.confirme, 'confirmée', 'à confirmer'), a.confirme ? '' : 'chaud')}
      ${ligne('Offre', { gratuit: 'Gratuit', plus: 'Mirandola+', campus: 'Campus' }[a.offre] || '—')}
      ${a.etablissement ? ligne('Établissement', esc(a.etablissement)) : ''}
      ${ligne('Livres', +a.livres || 0)}${ligne('Pages', +a.cartes || 0)}${ligne('Révisions', +a.revisions || 0)}
      ${ligne('Dernière révision', a.revise ? timeAgo(a.revise) : 'aucune')}
      ${ligne('Connexion', [a.google ? 'Google' : 'e-mail', a.deux_etapes ? 'deux étapes' : ''].filter(Boolean).join(' · '))}
      ${a.provisoire ? ligne('Mot de passe', 'provisoire', 'chaud') : ''}
    </div>`;
}

export function blocGestion(a) {
  if (a.id === auth.uid) return '';
  const s = a.suspendu;
  return `<h2 class="ed-h2">Accès</h2><div class="ed-acces">
    ${'confirme' in a && !a.confirme ? `<button class="ed-b" data-adm="cconfirmer">${svg(I.mail)}Confirmer son adresse</button>` : ''}
    ${s ? `<p class="ed-message ko">${svg(I.lock)}<span><b>Suspendu ${sansFin(s) ? 'sans fin' : 'jusqu’au ' + leJour(s)}</b> : il ne peut plus se connecter.</span></p>
      <button class="ed-b" data-adm="cretablir">${svg(I.redo)}Rétablir le compte</button>`
    : `<div class="ed-seg ed-suspendre"><span>${svg(I.lock)}Suspendre</span>${ORDRE_SUSPENSIONS.map(k =>
      `<button data-adm="csuspendre" data-id="${k}">${SUSPENSIONS[k]}</button>`).join('')}</div>`}
    <button class="ed-b ko discret" data-adm="csupprimer">${svg(I.trash)}<span>Supprimer ce compte et tout ce qui est à lui</span></button>
  </div>`;
}

/* Deux appuis : le premier arme le bouton, le second efface. */
function arme(b, texte) {
  if (b.dataset.arme === '1') return true;
  b.dataset.arme = '1';
  const t = b.querySelector('span'); if (t) t.textContent = texte;
  return false;
}

function direBilan(r) {
  const b = bilanSuppression(r);
  if (!b.ko) return toast(I.check, b.ok > 1 ? plur(b.ok, 'compte') + ' supprimés' : 'Compte supprimé');
  toast(I.x, (b.ok ? plur(b.ok, 'compte') + ' supprimés · ' : '') + `${b.ko} refusé${b.ko > 1 ? 's' : ''} : ${b.motif}`.slice(0, 160));
}

async function supprimerUn(id, b) {
  const a = (accounts || []).find(x => x.id === adm.copen); if (!a) return;
  if (!arme(b, `Sûr ? ${a.email} part pour de bon`)) return;
  const r = await admSupprimer([a.id]);
  direBilan(r);
  if (r[0] && r[0].ok) adm.copen = null;
  repeint();
}

async function supprimerLot(id, b) {
  const sel = adm.csel || []; if (!sel.length) return;
  if (!arme(b, `Sûr ? ${plur(sel.length, 'compte')} pour de bon`)) return;
  const r = await admSupprimer(sel.filter(x => x !== auth.uid));
  direBilan(r);
  adm.csel = r.filter(x => !x.ok).map(x => x.id);
  if (r.some(x => x.ok && x.id === adm.copen)) adm.copen = null;
  repeint();
}

function choisir(id) {
  const sel = adm.csel || [];
  adm.csel = sel.includes(id) ? sel.filter(x => x !== id) : [...sel, id];
  repeint();
}

/* Les deux listes déroulantes du haut : le tri et le filtre. */
export function suivreTri(e) {
  if (e.target.id === 'edctri') adm.ctri = e.target.value;
  else if (e.target.id === 'edcfiltre') adm.cfiltre = e.target.value;
  else return;
  repeint();
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
  'nouveau-mdp': nouveauMdp,
  csel: () => { adm.csel = adm.csel ? null : []; repeint(); },
  cchoisir: choisir,
  ctout: () => { adm.csel = comptesVus().map(a => a.id).filter(x => x !== auth.uid); repeint(); },
  caucun: () => { adm.csel = []; repeint(); },
  'csuppr-lot': supprimerLot,
  csupprimer: supprimerUn,
  csuspendre: k => { if (adm.copen) admSuspendre(adm.copen, finSuspension(k)); },
  cretablir: () => { if (adm.copen) admSuspendre(adm.copen, null); },
  cconfirmer: () => { if (adm.copen) admConfirmer(adm.copen); }
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
