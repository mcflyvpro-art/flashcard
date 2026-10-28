// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { $ } from '../racine.js';
import { I, svg } from '../icones.js';
import { SITE } from '../adresse.js';
import { ref, setAnimate, view } from '../data/etat.js';
import { esc, plur } from '../core/coeur-sync.js';
import {
  PAGE, refAgir, refAjouterProf, refCharger, refCreerCartes, refEquipePull, refJournalPull, refNouveauCode, refPersonnesPull,
  refProfsPull, refRetirer, refRythme, refServicePull
} from '../core/referent.js';
import { formatCode, lienCarte, lienRejoindre, lireListeEleves, nomPropre, nomValide } from '../classe.js';
import { changeLe, cycleDe, etatLicence, motDePasseProvisoire, NIVEAUX, RYTHMES } from '../etablissement.js';
import { render } from './bibliotheque.js';
import { avatar } from './jeton.js';
import { toast } from './import-cartes.js';
import { timeAgo } from './reglages-corbeille.js';
import { ACTIONS_LICENCE, FORMULAIRES_LICENCE, licence as ongletLicence, poserLicence } from './ref-licence.js';
import './ref-console.css';

/* ══════════ la console du référent (2026-10-26) ══════════
   Chargée à la demande par ui/etablissement.js (`refView`), avec sa feuille de
   style (préfixe rf-). Faite pour l'ordinateur : une liste à gauche, le
   détail à droite (docs/PARCOURS.md, § 4.4). Au téléphone, l'essentiel —
   la licence et les deux codes à montrer — et rien de plus. Tout passe par
   core/referent.js ; la base décide qui a le droit. */

const PC = () => matchMedia('(min-width: 900px)').matches;
const repeint = () => { if (view.name === 'ref') { setAnimate(false); render(); } };
const kc = (n, lab, cls) => `<div class="rf-kc ${cls || ''}"><b>${n ?? '—'}</b><span>${lab}</span></div>`;
const vide = (ic, t) => `<div class="rf-vide">${svg(ic)}<p>${t}</p></div>`;
// une place par élève et par professeur (20261026130000) ; le référent n'en prend pas
const licence = c => etatLicence({ offre: c.offre, places: c.places, eleves: (+c.eleves || 0) + (+c.profs || 0),
  licence_fin: c.licence_fin });
const jusque = l => (l.k === 'echue' ? 'finie le ' + l.fin : l.fin === 'sans fin' ? 'sans fin' : 'jusqu’au ' + l.fin);

/* ---------- l'en-tête : l'établissement et sa licence ---------- */
function tete(b, c) {
  const l = c ? licence(c) : null, ou = [b && b.ville, b && b.uai && 'UAI ' + b.uai].filter(Boolean).join(' · ');
  return `<div class="top"><div class="hero">${esc((b && b.org) || 'Mon établissement')}</div>
      ${ou ? `<span class="rf-ou">${esc(ou)}</span>` : ''}
      ${l ? `<span class="rf-lic ${l.k}" title="Licence">${svg(l.k === 'ok' ? I.check : I.warn)}${l.offre} · ${l.places} · ${jusque(l)}</span>` : ''}
    </div>`;
}


/* ---------- l'accueil : les codes, la licence, ce qui demande une décision ---------- */
function tuileCode(quel, titre, code, jusqua) {
  const fin = changeLe(jusqua);
  return `<div class="rf-code">
      <span class="rf-code-l">${svg(quel === 'eleve' ? I.users : I.school)}${titre}</span>
      <b class="rf-code-v">${code ? formatCode(code) : '— — —'}</b>
      ${fin ? `<span class="rf-code-f">${svg(I.clock)}${fin}</span>` : ''}
      <div class="rf-code-b">
        <button data-rf="copier" data-id="${quel}">${svg(I.copy)}Copier</button>
        <button data-rf="projeter" data-id="${quel}">${svg(I.grid)}Afficher</button>
        <button data-rf="changer" data-id="${quel}" title="L’ancien code cessera de marcher">${svg(I.refresh)}<span>Changer</span></button>
      </div>
    </div>`;
}

/* Les deux codes et leur rythme : un code qui ne change jamais finit sur un
   groupe de discussion, et fait encore entrer n'importe qui en juin. */
function tuilesCodes(c) {
  const r = c.rythme || 'semaine';
  return `${tuileCode('eleve', 'Code élèves', c.eleve, c.eleve_jusqua)}${tuileCode('prof', 'Code professeurs', c.prof, c.prof_jusqua)}
    <label class="rf-rythme" title="Les codes changent seuls ; ceux qui sont entrés restent">${svg(I.refresh)}
      <select id="rfrythme" aria-label="Nouveaux codes">${Object.entries(RYTHMES).map(([k, t]) =>
        `<option value="${k}"${k === r ? ' selected' : ''}>${t}</option>`).join('')}</select></label>`;
}

function tuileLicence(c) {
  const l = licence(c);
  const alerte = { echue: 'La licence a pris fin : les codes ne font plus entrer personne. Écris à Mirandola pour la renouveler.',
    pleine: 'Toutes les places sont prises : personne ne peut plus entrer. Demande des places dans l’onglet Licence.',
    bientot: `La licence finit dans ${l.jours} jour${l.jours > 1 ? 's' : ''}.` }[l.k];
  return `<div class="rf-tuile rf-licence">
      <div class="rf-tl">${l.offre}<span>${jusque(l)}</span></div>
      <div class="rf-barre"><i style="width:${l.pc}%"></i></div>
      <div class="rf-tl-p" title="Une place par élève et par professeur"><b>${l.places}</b> places${l.libre != null ? ` · ${l.libre} libre${l.libre > 1 ? 's' : ''}` : ''}</div>
      ${alerte ? `<p class="rf-alerte ${l.k}">${svg(I.warn)}${alerte}</p>` : ''}
    </div>`;
}

function aRegler(b) {
  const l = [
    b.sans_classe && [`${plur(b.sans_classe, 'élève')} sans classe`, 'sans-classe'],
    b.sans_pp && [`${plur(b.sans_pp, 'classe')} sans professeur principal`, 'classes'],
    b.classes_vides && [`${plur(b.classes_vides, 'classe')} vide${b.classes_vides > 1 ? 's' : ''}`, 'classes'],
    b.jamais_venus && [`${plur(b.jamais_venus, 'compte')} jamais utilisé${b.jamais_venus > 1 ? 's' : ''}`, 'eleves']
  ].filter(Boolean);
  if (!l.length) return '';
  return `<div class="rf-tuile"><h2>À régler</h2>${l.map(([t, k]) => `<button class="rf-ligne" data-rf="aller" data-id="${k}">
    ${svg(I.warn)}<span>${t}</span>${svg(I.arrow)}</button>`).join('')}</div>`;
}

function accueil() {
  const b = ref.board || {}, c = ref.codes;
  if (c === null) return vide(I.build, 'Chargement…');
  if (!c) return vide(I.lock, 'Réservé au référent de l’établissement');
  return `<div class="rf-accueil">
      <div class="rf-codes">${tuilesCodes(c)}</div>
      <div class="rf-cote">
        ${tuileLicence(c)}
        <div class="rf-chiffres">${kc(b.classes, 'classes')}${kc(b.eleves, 'élèves')}${kc(b.profs, 'professeurs')}
          ${kc(b.actifs7, 'actifs 7 j', b.actifs7 ? '' : 'am')}</div>
        ${aRegler(b)}
      </div>
    </div>
    <button class="rf-discret" data-rf="onglet" data-id="cartes">${svg(I.card)}Des élèves sans adresse e-mail ?</button>`;
}

/* ---------- les classes ---------- */
function ligneClasse(c) {
  return `<button class="rf-ligne${ref.open === c.id ? ' on' : ''}" data-rf="classe" data-id="${esc(c.id)}">
      <span class="rf-l1"><b>${esc(c.name)}</b><i>${esc(c.genre === 'groupe' ? (c.pp ? 'groupe · ' + c.pp : 'groupe') : c.pp || 'pas de professeur principal')}</i></span>
      <span class="rf-l2">${plur(c.effectif, 'élève')}</span>${svg(I.arrow)}</button>`;
}

/* Le niveau qu'on propose d'abord : celui de la dernière classe créée, sinon le premier du lycée ou du collège. */
const niveauPropose = () => {
  const l = (ref.classes || []).filter(c => c.genre === 'classe' && NIVEAUX.includes(c.niveau));
  return l.length ? l[l.length - 1].niveau : (ref.board && ref.board.kind === 'college' ? '6e' : '2nde');
};

function classes() {
  const l = ref.classes || [], cl = l.filter(c => c.genre === 'classe'), gr = l.filter(c => c.genre === 'groupe');
  return `<div class="rf-maitre">
      <div class="rf-liste">
        <form class="rf-ajout" id="rfnouvelle" autocomplete="off">
          <input id="rfcnom" placeholder="Nouvelle classe, par ex. 2nde 4" maxlength="60" aria-label="Nom de la classe">
          <select id="rfcniv" aria-label="Niveau">${NIVEAUX.map(n => `<option${n === niveauPropose() ? ' selected' : ''}>${n}</option>`).join('')}</select>
          <button class="rf-b pri" type="submit">${svg(I.plus)}Créer</button>
        </form>
        ${cl.length ? cl.map(ligneClasse).join('') : vide(I.school, 'Aucune classe')}
        ${gr.length ? `<h2 class="rf-h2">Groupes des professeurs</h2>${gr.map(ligneClasse).join('')}` : ''}
      </div>
      <div class="rf-detail">${detailClasse()}</div>
    </div>`;
}

function detailClasse() {
  const c = (ref.classes || []).find(x => x.id === ref.open);
  if (!c) return vide(I.school, 'Choisis une classe');
  const profs = (ref.profsListe || []);
  const eleves = ref.gens || [];
  const autres = (ref.classes || []).filter(x => x.genre === 'classe' && x.id !== c.id);
  return `<div class="rf-fiche">
      <form class="rf-renom" id="rfrenom" autocomplete="off">
        <input id="rfrnom" value="${esc(c.name)}" maxlength="60" aria-label="Nom">
        <button class="rf-b" type="submit">${svg(I.check)}Renommer</button>
      </form>
      <div class="rf-chiffres petit">${kc(c.effectif, 'élèves')}${kc(c.profs, 'professeurs')}${kc(c.devoirs, 'devoirs')}${kc(c.actifs7, 'actifs 7 j')}</div>
      <h2 class="rf-h2">Équipe</h2>
      ${(ref.team || []).map(t => `<div class="rf-ligne fixe">${avatar(t.teacher, t.nom, 'sm')}
        <span class="rf-l1"><b>${esc(t.nom)}</b><i>${esc(t.matiere)}</i></span>
        ${t.principal ? '<em class="rf-pp">PP</em>' : `<button class="rf-b sm" data-rf="pp" data-id="${esc(t.teacher)}" data-v="${esc(t.matiere)}">PP</button>`}
        <button class="rf-b sm ko" data-rf="retirer-service" data-id="${esc(t.teaching_id)}" aria-label="Retirer">${svg(I.x)}</button></div>`).join('')
        || '<p class="rf-rien">Personne pour l’instant.</p>'}
      ${profs.length ? `<form class="rf-ajout" id="rfservice" autocomplete="off">
        <select id="rfsprof" aria-label="Professeur">${profs.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select>
        <input id="rfsmat" placeholder="Matière" maxlength="60" aria-label="Matière">
        <button class="rf-b" type="submit">${svg(I.plus)}Ajouter</button></form>` : ''}
      <h2 class="rf-h2">Élèves <i>${eleves.length}</i></h2>
      ${eleves.map(e => `<div class="rf-ligne fixe">${avatar(e.id, e.name, 'sm')}<span class="rf-l1"><b>${esc(e.name)}</b>
          <i>${e.jamais ? 'aucune connexion' : 'vu ' + timeAgo(e.derniere)}</i></span>
        ${c.genre === 'classe' && autres.length ? `<select class="rf-deplacer" data-rf-deplacer="${esc(e.id)}" aria-label="Changer de classe">
          <option value="">Changer de classe…</option>${autres.map(x => `<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('')}
        </select>` : ''}</div>`).join('') || '<p class="rf-rien">Aucun élève : ils choisissent leur classe en tapant le code élèves.</p>'}
      ${c.genre === 'classe' && !c.effectif ? `<button class="rf-b ko large" data-rf="supprimer-classe">${svg(I.trash)}Supprimer la classe</button>` : ''}
    </div>`;
}

/* ---------- les élèves et les professeurs ---------- */
function filtres() {
  const cl = (ref.classes || []).filter(c => c.genre === 'classe');
  return `<div class="rf-filtres">
      <input id="rfq" type="search" value="${esc(ref.q)}" placeholder="Nom ou adresse" autocomplete="off" spellcheck="false" aria-label="Chercher">
      ${ref.role === 'eleve' ? `<select id="rfcls" aria-label="Classe">
        <option value="">Toutes les classes</option>
        <option value="-"${ref.sans ? ' selected' : ''}>Sans classe</option>
        ${cl.map(c => `<option value="${esc(c.id)}"${ref.cls === c.id ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}
      </select>` : ''}
    </div>`;
}

function liste() {
  const l = ref.gens;
  const pages = Math.ceil(ref.total / PAGE) || 1;
  if (!l) return vide(I.users, 'Chargement…');
  if (!l.length) return vide(I.search, 'Personne');
  return `<div class="rf-compte">${ref.total} ${ref.role === 'prof' ? 'professeur' : 'élève'}${ref.total > 1 ? 's' : ''}</div>
    ${l.map(g => `<button class="rf-ligne${ref.who && ref.who.id === g.id ? ' on' : ''}" data-rf="personne" data-id="${esc(g.id)}">
      ${avatar(g.id, g.name, 'sm')}
      <span class="rf-l1"><b>${esc(g.name)}</b><i>${esc(g.role === 'prof' ? g.matiere || '' : g.classe || '')}${
        g.role === 'eleve' && !g.classe ? '<em class="rf-chip">sans classe</em>' : ''}${g.carte ? '<em class="rf-chip">carte</em>' : ''}</i></span>
      <span class="rf-l2">${g.jamais ? 'aucune connexion' : timeAgo(g.derniere)}</span></button>`).join('')}
    ${pages > 1 ? `<div class="rf-pages"><button class="rf-b sm" ${ref.page ? '' : 'disabled'} data-rf="page" data-id="${ref.page - 1}">Précédent</button>
      <span>${ref.page + 1} / ${pages}</span>
      <button class="rf-b sm" ${ref.page + 1 < pages ? '' : 'disabled'} data-rf="page" data-id="${ref.page + 1}">Suivant</button></div>` : ''}`;
}

function personnes() {
  const prof = ref.role === 'prof';
  const detail = ref.who ? detailPersonne(ref.who) : prof && ref.nouveauProf ? nouveauProf()
    : vide(I.user, prof ? 'Choisis un professeur' : 'Choisis un élève');
  return `<div class="rf-maitre"><div class="rf-liste">
      ${prof ? `<button class="rf-b pri rf-ajouter" data-rf="nouveau-prof">${svg(I.plus)}Ajouter un professeur</button>` : ''}
      ${filtres()}${liste()}</div>
    <div class="rf-detail">${detail}</div></div>`;
}

/* Un professeur arrivé en cours d'année : le code professeurs suffit d'ordinaire ;
   ici, le référent ouvre lui-même son compte. Il prend une place de la licence. */
function nouveauProf() {
  const n = ref.nouveauProf;
  if (n.fait) {
    return `<div class="rf-fiche"><h2 class="rf-h2">Compte ouvert</h2>
        <div class="rf-mdp"><span>${esc(n.adresse)}</span><b>${esc(n.pw)}</b>
          <button class="rf-b sm" data-rf="copier-mdp">${svg(I.copy)}Copier</button></div>
        <p class="rf-rien" title="Le mot de passe n’est gardé nulle part">À donner à ${esc(n.nom)} : il le change dans ses réglages.</p>
        <button class="rf-b" data-rf="nouveau-prof">${svg(I.plus)}Un autre</button></div>`;
  }
  return `<div class="rf-fiche"><h2 class="rf-h2">Ajouter un professeur</h2>
      <form id="rfprof" class="rf-grille-f" autocomplete="off">
        <label class="rf-ch"><span>Prénom</span><input id="rfpprenom" maxlength="40" spellcheck="false"></label>
        <label class="rf-ch"><span>Nom</span><input id="rfpnom" maxlength="40" spellcheck="false"></label>
        <label class="rf-ch rf-ch-email"><span>Adresse e-mail</span><input id="rfpmail" type="email" maxlength="200" spellcheck="false"
          autocapitalize="none"></label>
        <label class="rf-ch rf-ch-email"><span>Mot de passe provisoire</span><input id="rfppw" value="${esc(n.pw)}" minlength="10"
          maxlength="72" spellcheck="false" autocapitalize="none"></label>
        <button class="rf-b pri" type="submit">${svg(I.check)}Ouvrir le compte</button>
      </form></div>`;
}

function detailPersonne(g) {
  const cl = (ref.classes || []).filter(c => c.genre === 'classe');
  return `<div class="rf-fiche">
      <div class="rf-qui">${avatar(g.id, g.name, 'lg')}<div><b>${esc(g.name)}</b>
        <i>${esc(g.carte ? 'carte élève' : g.email || '')}${g.jamais ? ' · aucune connexion' : ' · vu ' + timeAgo(g.derniere)}</i></div></div>
      <h2 class="rf-h2">Nom</h2>
      <form class="rf-renom" id="rfnom" autocomplete="off">
        <input id="rfnnom" value="${esc(g.name)}" maxlength="80" aria-label="Prénom NOM" spellcheck="false">
        <button class="rf-b" type="submit">${svg(I.check)}Corriger</button>
      </form>
      ${g.role === 'eleve' ? `<h2 class="rf-h2">Classe</h2>
        <select class="rf-deplacer large" data-rf-deplacer="${esc(g.id)}" aria-label="Classe">
          <option value="">${g.classe ? esc(g.classe) : 'Sans classe'}</option>
          ${cl.filter(c => c.id !== g.class_id).map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}
        </select>` : servicesProf(g, cl)}
      <h2 class="rf-h2">Rôle</h2>
      <div class="rf-seg" role="radiogroup">${[['eleve', 'Élève'], ['prof', 'Professeur']].map(([k, t]) => `<button role="radio"
        aria-checked="${g.role === k}" class="${g.role === k ? 'on' : ''}" data-rf="role" data-id="${k}">${t}</button>`).join('')}</div>
      ${g.carte ? '' : `<h2 class="rf-h2">Mot de passe oublié</h2>
        <form class="rf-renom" id="rfmdp" autocomplete="off">
          <input id="rfmpw" placeholder="Dix caractères au moins" minlength="10" maxlength="72" spellcheck="false"
            autocapitalize="none" aria-label="Nouveau mot de passe">
          <button class="rf-b" type="submit">${svg(I.key)}Remplacer</button>
        </form>`}
      <button class="rf-b ko large rf-retirer" data-rf="retirer" title="Il quitte ses classes ; son compte et ses livres restent">
        ${svg(I.exit)}<span>Retirer de l’établissement</span></button>
    </div>`;
}

function servicesProf(g, cl) {
  const s = ref.service;
  return `<h2 class="rf-h2">Ses classes</h2>
    ${!s ? '<p class="rf-rien">Chargement…</p>' : s.map(x => `<div class="rf-ligne fixe">${svg(I.school)}
      <span class="rf-l1"><b>${esc(x.classe)}</b><i>${esc(x.matiere)}${x.principal ? ' · PP' : ''}</i></span>
      <button class="rf-b sm ko" data-rf="retirer-service" data-id="${esc(x.teaching_id)}" aria-label="Retirer">${svg(I.x)}</button></div>`).join('')
      || '<p class="rf-rien">Aucune classe : chaque professeur choisit les siennes dans son espace.</p>'}
    <form class="rf-ajout" id="rfservprof" autocomplete="off">
      <select id="rfspcls" aria-label="Classe">${cl.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select>
      <input id="rfspmat" value="${esc(g.matiere || '')}" placeholder="Matière" maxlength="60" aria-label="Matière">
      <button class="rf-b" type="submit">${svg(I.plus)}Ajouter</button></form>`;
}

/* ---------- le journal ---------- */
const QUI_CODE = { eleve: 'élèves', prof: 'professeurs', ref: 'référent' };

/* Un code changé, renouvelé, ou son rythme : « code élèves · chaque semaine ». */
const detailCode = d => [QUI_CODE[d.role] && 'code ' + QUI_CODE[d.role], (RYTHMES[d.rythme] || '').toLowerCase()]
  .filter(Boolean).join(' · ');

function detailTrace(d, acte) {
  if (!d || typeof d !== 'object') return '';
  if (/code/.test(acte || '')) return detailCode(d);
  if (d.avant && d.apres && typeof d.avant === 'object') return `${d.avant.nom || ''} → ${d.apres.nom || d.avant.nom || ''}`;
  if (d.avant || d.apres) return `${d.avant || '—'} → ${d.apres || '—'}`;
  return [d.nom, d.classe, d.matiere, d.role].filter(Boolean).join(' · ');
}

function journal() {
  const l = ref.trace;
  if (!l) return vide(I.clock, 'Chargement…');
  if (!l.length) return vide(I.clock, 'Rien encore');
  return `<div class="rf-journal">${l.map(r => `<div class="rf-jl"><b>${esc(r.acte)}</b><i>${esc(detailTrace(r.detail, r.acte))}</i>
    <span>${timeAgo(r.created_at)}</span></div>`).join('')}</div>`;
}

/* ---------- les cartes élève : le cas particulier, caché ---------- */
function cartes() {
  const k = ref.cartes || {}, cl = (ref.classes || []).filter(c => c.genre === 'classe');
  if (k.res) return resultatsCartes(k);
  return `<div class="rf-cartes">
      <button class="rf-b sm" data-rf="onglet" data-id="accueil">${svg(I.back)}Retour</button>
      <h2>Des élèves sans adresse e-mail</h2>
      <p>Pour les élèves qui n’ont pas d’adresse e-mail (souvent de jeunes collégiens), Mirandola crée un compte par élève
        avec un identifiant et un code secret, imprimés sur une carte avec un QR. Ils n’ont alors pas besoin du code élèves :
        ils scannent leur carte. Les autres entrent normalement, avec le code élèves.</p>
      <form id="rfcartes" autocomplete="off">
        <select id="rfkcls" aria-label="Classe">${cl.map(c => `<option value="${esc(c.id)}"${k.cid === c.id ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
        <textarea id="rfkliste" rows="8" placeholder="Une ligne par élève : NOM Prénom" aria-label="Liste des élèves">${esc(k.texte || '')}</textarea>
        <button class="rf-b pri" type="submit" ${cl.length ? '' : 'disabled'}>${svg(I.card)}Créer les comptes</button>
      </form>
    </div>`;
}

const POURQUOI = { invalide: 'nom illisible', deja: 'déjà dans la classe', homonyme: 'un élève porte déjà ce nom',
  complet: 'classe complète' };

function resultatsCartes(k) {
  const faits = k.res.filter(r => r.statut === 'cree'), autres = k.res.filter(r => r.statut !== 'cree');
  return `<div class="rf-cartes">
      <h2>${plur(faits.length, 'compte')} créé${faits.length > 1 ? 's' : ''}</h2>
      <p>Les codes ne seront plus jamais montrés : imprime les cartes maintenant.</p>
      <div class="rf-b-l"><button class="rf-b pri" data-rf="imprimer">${svg(I.file)}Imprimer les cartes</button>
        <button class="rf-b" data-rf="cartes-fin">Terminé</button></div>
      ${autres.length ? `<p class="rf-alerte">${svg(I.warn)}${autres.map(r => `${esc(r.nom)} : ${POURQUOI[r.statut] || esc(r.statut)}`).join(' · ')}</p>` : ''}
      <div class="rf-impression" id="rfimpr">${faits.map(r => `<div class="rf-carte"><b>${esc(r.nom)}</b>
        <span>Identifiant <code>${esc(r.identifiant)}</code></span><span>Code <code>${esc(r.code)}</code></span>
        <i class="rf-qr" data-lien="${esc(lienCarte(SITE, r.identifiant, r.code))}"></i></div>`).join('')}</div>
    </div>`;
}

/* ---------- au téléphone : l'essentiel ---------- */
function telephone() {
  const c = ref.codes;
  if (c === null) return vide(I.build, 'Chargement…');
  if (!c) return vide(I.lock, 'Réservé au référent de l’établissement');
  return `<div class="rf-tel">${tuilesCodes(c)}
    ${tuileLicence(c)}<p class="rf-rien">${svg(I.build)}Classes, élèves et professeurs se gèrent sur ordinateur.</p></div>`;
}

/* ---------- la projection d'un code, en grand ---------- */
function projection() {
  const c = ref.codes || {}, code = c[ref.projo];
  return `<div class="rf-projo" role="dialog" aria-label="Code">
      <button class="rf-projo-x" data-rf="projo-fin" aria-label="Fermer">${svg(I.x)}</button>
      <span class="rf-projo-t">${ref.projo === 'eleve' ? 'Élèves' : 'Professeurs'} · ${esc((ref.board || {}).org || '')}</span>
      <b class="rf-projo-c">${formatCode(code || '')}</b>
      <i class="rf-qr grand" data-lien="${esc(lienRejoindre(SITE, code || ''))}"></i>
      <span class="rf-projo-a">Mirandola → Réglages → J’ai un code</span>
    </div>`;
}

const CORPS = { accueil, classes, eleves: personnes, profs: personnes, licence: ongletLicence, journal, cartes };

/* Chaque ouverture repart de l'accueil et relit tout (refPull, au retour
   d'ailleurs, remet `charge` à faux) : on n'y retrouve jamais une liste
   d'il y a une heure sous un filtre oublié. */
export function consoleRef() {
  if (!ref.charge) {
    const c = ref.cible;
    Object.assign(ref, { charge: true, tab: 'accueil', open: null, who: null, team: null, profsListe: null, projo: '', cible: null });
    refCharger();
    if (c) poserAdresse(c.sous, c.id);
  }
  const b = ref.board;
  $.innerHTML = `<div class="page rf" id="page">${tete(b, ref.codes)}
      ${PC() ? `<section class="rf-corps">${(CORPS[ref.tab] || accueil)()}</section>` : telephone()}
    </div>${ref.projo ? projection() : ''}`;
  dessinerQR();
}

/* Les QR (projection, cartes) : l'encodeur se charge à la demande. */
function dessinerQR() {
  const l = document.querySelectorAll('.rf-qr[data-lien]');
  if (!l.length) return;
  import('../qr.js').then(({ qrSvg }) => l.forEach(n => { n.innerHTML = qrSvg(n.dataset.lien); }))
    .catch(() => { /* hors ligne au premier affichage : le code reste lisible en clair */ });
}

/* ---------- les gestes ---------- */
/* Poser l'état d'un onglet sans repeindre : la première ouverture le fait
   au milieu du rendu (une adresse /referent/classes/… rechargée). */
function poserOnglet(k, sans = false) {
  ref.tab = k; ref.who = null; ref.service = null; ref.open = null; ref.team = null;
  if (k === 'eleves' || k === 'profs') {
    ref.role = k === 'eleves' ? 'eleve' : 'prof'; ref.cls = null; ref.sans = sans; ref.gens = null; ref.q = '';
    refPersonnesPull(true);
  }
  if (k === 'classes' && !ref.profsListe) refProfsPull();
  if (k === 'journal') { ref.trace = null; refJournalPull(); }
  if (k === 'licence') { ref.licence = null; poserLicence(null); }
  if (k === 'profs') ref.nouveauProf = null;
}

function poserClasse(id) {
  ref.open = id; ref.team = null; ref.gens = null; ref.role = 'eleve'; ref.cls = id; ref.sans = false; ref.q = '';
  refEquipePull(id); refPersonnesPull(true);
}

function ouvrirOnglet(k, sans = false) { poserOnglet(k, sans); repeint(); }
function ouvrirClasse(id) { poserClasse(id); repeint(); }

/* Depuis une adresse (ui/routeur.js, par la porte ui/etablissement.js) :
   l'onglet et, pour les classes, celle qui est ouverte. */
function poserAdresse(k, id) {
  poserOnglet(CORPS[k] ? k : 'accueil');
  if (ref.tab === 'classes' && id) poserClasse(id);
  if (ref.tab === 'licence' && id) poserLicence(id);
}
export function allerA(k, id) { poserAdresse(k, id); repeint(); }

function ouvrirPersonne(id) {
  ref.who = (ref.gens || []).find(g => g.id === id) || null;
  ref.service = null;
  if (ref.who && ref.who.role === 'prof') refServicePull(id);
  repeint();
}

async function copier(quel) {
  const code = (ref.codes || {})[quel];
  try { await navigator.clipboard.writeText(formatCode(code)); toast(I.check, 'Code copié'); }
  catch (e) { toast(I.x, 'Copie impossible : recopie-le'); }
}

async function changer(quel, b) {
  if (b.dataset.arme !== '1') { b.dataset.arme = '1'; b.querySelector('span').textContent = 'Sûr ? L’ancien cessera'; return; }
  await refNouveauCode(quel);
}

/* Le hasard d'un mot de passe : celui du système, pas Math.random. */
const alea = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;

async function retirer(_, b) {
  if (!ref.who) return;
  if (b.dataset.arme !== '1') { b.dataset.arme = '1'; b.querySelector('span').textContent = 'Sûr ? Sa place se libère'; return; }
  if (await refRetirer(ref.who.id)) { ref.who = null; repeint(); }
}

async function copierMdp() {
  const n = ref.nouveauProf || {};
  try { await navigator.clipboard.writeText(`${n.adresse} · ${n.pw}`); toast(I.check, 'Copié'); }
  catch (e) { toast(I.x, 'Copie impossible : recopie-le'); }
}

const ACTIONS = {
  ...ACTIONS_LICENCE,
  'nouveau-prof': () => { ref.who = null; ref.nouveauProf = { pw: motDePasseProvisoire(alea) }; repeint(); },
  retirer,
  'copier-mdp': copierMdp,
  onglet: k => ouvrirOnglet(k),
  aller: k => (k === 'sans-classe' ? ouvrirOnglet('eleves', true) : ouvrirOnglet(k)),
  classe: ouvrirClasse,
  personne: ouvrirPersonne,
  page: p => { ref.page = +p; refPersonnesPull(false); },
  copier,
  changer,
  projeter: q => { ref.projo = q; repeint(); },
  'projo-fin': () => { ref.projo = ''; repeint(); },
  pp: (prof, b) => refAgir('ref_set_teaching', { cid: ref.open, prof, matiere: b.dataset.v, pp: true }, 'Professeur principal'),
  'retirer-service': tid => refAgir('ref_drop_teaching', { tid }, 'Retiré'),
  'supprimer-classe': async () => {
    if (await refAgir('ref_delete_class', { cid: ref.open }, 'Classe supprimée')) { ref.open = null; repeint(); }
  },
  role: async k => {
    if (!ref.who || ref.who.role === k) return;
    if (await refAgir('ref_set_role', { cible: ref.who.id, nouveau: k }, 'Rôle changé')) ref.who = { ...ref.who, role: k };
    ref.profsListe = null; refProfsPull();
  },
  imprimer: () => window.print(),
  'cartes-fin': () => { ref.cartes = null; ouvrirOnglet('accueil'); }
};

document.addEventListener('click', e => {
  const b = e.target.closest('[data-rf]');
  if (!b || b.disabled || view.name !== 'ref') return;
  const f = ACTIONS[b.dataset.rf];
  if (!f) return;
  e.preventDefault();
  f(b.dataset.id, b);
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && ref.projo && view.name === 'ref') { ref.projo = ''; repeint(); }
});

/* ---------- les formulaires ---------- */
const val = id => (document.getElementById(id) || {}).value || '';

const FORMULAIRES = {
  ...FORMULAIRES_LICENCE,
  rfprof: async () => {
    const prenom = val('rfpprenom').trim(), nom = val('rfpnom').trim(), adresse = val('rfpmail').trim().toLowerCase(), pw = val('rfppw').trim();
    if (!nomValide(prenom) || !nomValide(nom)) return toast(I.x, 'Le prénom et le nom');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(adresse)) return toast(I.x, 'Une adresse e-mail');
    if (pw.length < 10) return toast(I.x, 'Au moins dix caractères');
    const qui = nomPropre(prenom, nom);
    if (await refAjouterProf(adresse, qui, pw)) { ref.nouveauProf = { fait: true, adresse, pw, nom: qui }; repeint(); }
  },
  rfnouvelle: async () => {
    const nom = val('rfcnom').trim(), niveau = val('rfcniv');
    if (!nom) return;
    await refAgir('ref_save_class', { cid: null, nom, niveau, cycle: cycleDe(niveau), filiere: '', prevu: null }, 'Classe créée');
  },
  rfrenom: async () => {
    const c = (ref.classes || []).find(x => x.id === ref.open), nom = val('rfrnom').trim();
    if (!c || !nom || nom === c.name) return;
    await refAgir('ref_save_class', { cid: c.id, nom, niveau: c.niveau || '', cycle: c.cycle || '', filiere: c.filiere || '',
      prevu: c.prevu }, 'Classe renommée');
  },
  rfservice: async () => {
    const mat = val('rfsmat').trim();
    if (!mat) return toast(I.x, 'Indique la matière');
    await refAgir('ref_set_teaching', { cid: ref.open, prof: val('rfsprof'), matiere: mat, pp: false }, 'Ajouté à l’équipe');
  },
  rfservprof: async () => {
    const mat = val('rfspmat').trim();
    if (!mat) return toast(I.x, 'Indique la matière');
    await refAgir('ref_set_teaching', { cid: val('rfspcls'), prof: ref.who.id, matiere: mat, pp: false }, 'Classe ajoutée');
  },
  rfnom: async () => {
    const nom = val('rfnnom').trim().replace(/\s+/g, ' ');
    if (!ref.who || !nom || nom === ref.who.name) return;
    const [prenom, ...reste] = nom.split(' ');
    if (!nomValide(prenom) || !reste.length) return toast(I.x, 'Le prénom puis le nom');
    // la fiche ne se relit pas forcément dans la liste (filtre « sans classe ») : on la met à jour ici
    if (await refAgir('ref_update_account', { cible: ref.who.id, nom }, 'Nom corrigé')) { ref.who = { ...ref.who, name: nom }; repeint(); }
  },
  rfmdp: async () => {
    const pw = val('rfmpw').trim();
    if (!ref.who || pw.length < 10) return toast(I.x, 'Au moins dix caractères');
    // le mot de passe s'affiche une fois, pour être dit à l'intéressé : il n'est gardé nulle part
    if (await refAgir('ref_set_password', { cible: ref.who.id, pw }, 'Mot de passe remplacé · ' + pw)) {
      const i = document.getElementById('rfmpw'); if (i) i.value = '';
    }
  },
  rfcartes: async () => {
    const cid = val('rfkcls'), texte = val('rfkliste');
    const { eleves, ignorees, trop } = lireListeEleves(texte);
    ref.cartes = { cid, texte };
    if (!eleves.length) return toast(I.x, 'Une ligne par élève : NOM Prénom');
    if (ignorees.length || trop) return toast(I.warn, ignorees.length ? `Ligne illisible : ${ignorees[0].slice(0, 40)}` : 'Soixante élèves à la fois');
    const res = await refCreerCartes(cid, eleves.map(x => ({ prenom: x.prenom, nom: x.nom })));
    if (res) { ref.cartes = { cid, texte: '', res }; repeint(); }
  }
};

document.addEventListener('submit', e => {
  const f = FORMULAIRES[e.target.id];
  if (!f || view.name !== 'ref') return;
  e.preventDefault();
  f();
});

document.addEventListener('change', e => {
  if (view.name !== 'ref') return;
  const s = e.target;
  if (s.dataset && s.dataset.rfDeplacer !== undefined) {
    if (!s.value) return;
    const cible = s.dataset.rfDeplacer, vers = (ref.classes || []).find(c => c.id === s.value);
    refAgir('ref_move_student', { cible, vers: s.value }, 'Changé de classe').then(r => {
      if (r && ref.who && ref.who.id === cible) { ref.who = { ...ref.who, class_id: vers.id, classe: vers.name }; repeint(); }
    });
    return;
  }
  if (s.id === 'rfrythme') { refRythme(s.value); return; }
  if (s.id === 'rfcls') {
    ref.sans = s.value === '-'; ref.cls = ref.sans || !s.value ? null : s.value; ref.who = null;
    refPersonnesPull(true);
  }
});

let attente = 0;
document.addEventListener('input', e => {
  // le message à Mirandola survit à un repeint (le tableau se relit après chaque geste)
  if (e.target.id === 'rfemsg') { ref.brouillon = e.target.value; return; }
  if (e.target.id !== 'rfq' || view.name !== 'ref') return;
  ref.q = e.target.value;
  clearTimeout(attente);
  attente = setTimeout(() => refPersonnesPull(true), 220);
});
