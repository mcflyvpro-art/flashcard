// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { $ } from '../racine.js';
import { I, svg } from '../icones.js';
import { atSchool, isProf, isPupil } from './classement.js';
import { auth, cercle, compte, db, duels, eleve, mates2, online, setAnimate, view } from '../data/etat.js';
import { bindPager, go, render, tabs } from './bibliotheque.js';
import { defiLigne, enDirectHtml, parDefi } from './cercle.js';
import {
  codeDepuisTexte, echeance, etatDevoirEleve, formatCode, iso,
  messageStatut, nomPropre, nomValide, normCode
} from '../classe.js';
import { avatar, blason, couleurClasse } from './jeton.js';
import { esc, plur } from '../core/coeur-sync.js';
import {
  annulerDemande, cartesDevoir, classePull, eleveClassesPull, messageErreur, quitterClasse, rejoindreCode
} from '../core/eleve-classes.js';
import { importPayload, toast } from './import-cartes.js';
import { closeMenu } from './menus-a.js';
import { ouvrirCode } from './code-entree.js';

/* ══════════ « Mes classes », côté élève (téléphone d'abord) ══════════
   Dans l'ordre de ce qui presse : les devoirs à faire, puis rejoindre une
   classe (le code se tape, se colle en lien, ou arrive par le QR projeté),
   puis ses classes et ses demandes en attente. Le nom sous lequel on entre
   n'est pas un pseudo : c'est celui du compte à carte ou de l'établissement,
   ou, pour un compte personnel, son vrai prénom et son vrai nom. */

/* Le blason d'une classe (ui/jeton.js) : avant d'y être entré, on ne le
   connaît pas encore — une icône neutre plutôt qu'un emblème qui changerait
   une fois dedans. */
const pastille = id => blason(id);
const neutre = () => `<i class="jt groupe vide">${svg(I.school)}</i>`;

/* Un compte à carte ou d'établissement a déjà son nom : on ne le redemande pas. */
const nomConnu = () => !!(compte && compte.gere) || atSchool();

/* ---------- rejoindre ---------- */
function rejoindreHtml() {
  const a = eleve.apercu, r = eleve.reponse ? messageStatut(eleve.reponse) : null;
  if (a) {
    const demander = !nomConnu();
    const ok = !demander || (nomValide(eleve.prenom) && nomValide(eleve.nom));
    return `<div class="el-carte el-apercu" data-k="apercu">
      <div class="el-ap-h">${neutre()}<span><b>${esc(a.nom)}</b><i>${
        [a.niveau, a.prof, a.etab].filter(Boolean).map(esc).join(' · ')}</i></span></div>
      ${a.validation ? `<p class="el-note">${svg(I.lock)}Ton professeur validera ta demande.</p>` : ''}
      ${demander ? `<div class="el-noms">
          <input id="elpre" data-elin="prenom" value="${esc(eleve.prenom)}" placeholder="Prénom" autocomplete="given-name" maxlength="40" aria-label="Prénom">
          <input data-elin="nom" value="${esc(eleve.nom)}" placeholder="Nom" autocomplete="family-name" maxlength="40" aria-label="Nom"></div>
        <p class="el-note" id="elnomap">${ok ? 'Tu apparaîtras comme <b>' + esc(nomPropre(eleve.prenom, eleve.nom)) + '</b>'
          : 'Ton vrai prénom et ton vrai nom : ton professeur doit te reconnaître.'}</p>` : ''}
      <div class="el-ap-b"><button class="el-btn" data-el="annuler-apercu">Annuler</button>
        <button class="el-btn pri" data-el="rejoindre" id="elgo" ${ok && !eleve.envoi ? '' : 'disabled'}>Rejoindre</button></div>
    </div>`;
  }
  /* Un seul champ pour tous les codes : la feuille « J'ai un code »
     (ui/code-entree.js). La réponse d'un ancien code de classe s'affiche ici. */
  return `<button class="el-carte el-rej-b" data-ce="ouvrir">${svg(I.key)}<span>J’ai un code</span>${svg(I.arrow)}</button>
    ${r ? `<p class="el-rep ${r.ton}"><b>${esc(r.titre)}</b>${r.texte ? ' ' + esc(r.texte) : ''}</p>` : ''}`;
}

/* ---------- les devoirs ---------- */
export function devoirLigne(d, auj) {
  const e = etatDevoirEleve(d, auj);
  return `<button class="el-dv ${e.k}" data-el="devoir" data-id="${esc(d.id)}">
        <i class="el-dot" style="--k:${couleurClasse(d.class_id)}"></i>
        <span class="el-dvt"><b>${esc(d.nom)}</b><i>${esc(d.classe)} · ${plur(d.n, 'carte')}${d.due ? ' · ' + esc(echeance(d.due, auj)) : ''}</i></span>
        <em class="el-pill ${e.k}">${esc(e.t)}</em>${svg(I.arrow)}</button>`;
}

function devoirsHtml() {
  const l = eleve.devoirs;
  if (!l) return `<div class="el-carte el-load"></div>`;
  const auj = iso(new Date());
  const afaire = l.filter(d => d.etat !== 'rendu');
  const rendus = l.length - afaire.length;
  if (!l.length) return `<p class="el-vide">${svg(I.check)}Aucun devoir pour l’instant.</p>`;
  return `${afaire.length ? `<div class="el-list">${afaire.map(d => devoirLigne(d, auj)).join('')}</div>`
      : `<p class="el-vide">${svg(I.check)}Tout est rendu.</p>`}
    ${rendus ? `<p class="el-note">${plur(rendus, 'devoir')} rendu${rendus > 1 ? 's' : ''}.</p>` : ''}`;
}

/* ---------- les classes ---------- */
function classesHtml() {
  const l = eleve.classes;
  if (!l) return '';
  const ins = l.filter(c => c.statut === 'inscrit'), att = l.filter(c => c.statut === 'attente');
  return `${att.map(c => `<div class="el-cl attente">${pastille(c.class_id)}
      <span class="el-clt"><b>${esc(c.nom)}</b><i>En attente de ${esc(c.prof || 'ton professeur')}</i></span>
      <button class="el-btn sm" data-el="annuler" data-id="${esc(c.class_id)}">Annuler</button></div>`).join('')}
    ${ins.map(c => `<button class="el-cl" data-el="classe" data-id="${esc(c.class_id)}">${pastille(c.class_id)}
      <span class="el-clt"><b>${esc(c.nom)}</b><i>${[c.prof, c.matieres].filter(Boolean).map(esc).join(' · ') || esc(c.etab)}</i></span>
      ${c.a_faire ? `<em class="el-badge">${c.a_faire}</em>` : ''}${svg(I.arrow)}</button>`).join('')}
    ${!l.length ? '<p class="el-vide">Tu n’es dans aucune classe.</p>' : ''}`;
}

export function camaradesHtml() {
  const l = mates2 || [];
  if (!isPupil() || !l.length) return '';
  return `<h2 class="el-h2">Camarades <span>${l.length}</span></h2><div class="el-list">${l.map(m => `<div class="el-cl">
    ${avatar(m.id, m.handle || m.name)}<span class="el-clt"><b>${esc(m.name)}</b></span>
    ${m.lien === 'ok' ? `<button class="camo" data-mate="${esc(m.id)}" aria-label="Voir">${svg(I.arrow)}</button>`
      : m.lien ? '<span class="camw">demandé</span>'
      : `<button class="camadd" data-camadd="${esc(m.id)}" data-camn="${esc(m.handle || '')}" aria-label="Ajouter ${esc(m.name)}">${svg(I.plus)}</button>`}
  </div>`).join('')}</div>`;
}

/* Les défis que le professeur a lancés pour la classe, à son rythme : ils
   vivent ici, avec la classe, plus dans le cercle. */
function defisClasseHtml() {
  const l = parDefi((duels.list || []).filter(d => d.class_id));
  if (!l.length) return '';
  return `<h2 class="el-h2">Défis de la classe</h2><div class="cc-list">${l.map(d => defiLigne(d, false)).join('')}</div>`;
}

export function mesClassesView() {
  if (isProf()) return go('prof');
  const qui = compte && compte.nom ? compte.nom : '';
  const n = (eleve.classes || []).filter(c => c.statut === 'inscrit').length;
  $.innerHTML = `
    <div class="page el-page" id="page">
      <div class="top"><div class="hero">${n === 1 ? 'Ma classe' : 'Mes classes'}</div></div>
      ${qui && nomConnu() ? `<p class="el-qui">${svg(I.user)}<b>${esc(qui)}</b>${compte && compte.gere ? '<i>carte élève</i>' : ''}</p>` : ''}
      <div class="el-grille">
        <div>${enDirectHtml((cercle.salles || []).filter(s => s.class_id))}
          <h2 class="el-h2">À faire</h2>${devoirsHtml()}
          ${defisClasseHtml()}</div>
        <div><h2 class="el-h2">Mes classes</h2>${classesHtml()}
          ${rejoindreHtml()}
          ${camaradesHtml()}</div>
      </div>
    </div>
    ${tabs('classes')}`;
  bindPager();
}

/* ---------- les gestes ---------- */
/* Un ancien code de classe (la feuille « J'ai un code » l'a reconnu) : son
   parcours continue ici — la classe trouvée, le nom, « Rejoindre ». */
export function versClasse(code, f) {
  eleve.code = formatCode(code);
  eleve.apercu = f && f.statut === 'apercu' ? f : null;
  eleve.reponse = f && f.statut !== 'apercu' ? f.statut : f ? null : 'inconnu';
  if (f && f.statut === 'deja') eleveClassesPull();
  go('classes');
  if (eleve.apercu && !nomConnu()) {
    setTimeout(() => {
      const n = document.getElementById('elpre'), a = document.activeElement;
      if (n && !(a && a.tagName === 'INPUT')) n.focus();       // jamais sous les doigts de qui écrit déjà
    }, 80);
  }
}

async function rejoindre() {
  const a = eleve.apercu; if (!a) return;
  eleve.envoi = true; repeint();
  try {
    const r = await rejoindreCode(normCode(eleve.code), eleve.prenom, eleve.nom);
    const s = r ? r.statut : 'inconnu';
    eleve.reponse = s; eleve.apercu = null;
    if (s === 'inscrit' || s === 'attente' || s === 'deja') { eleve.code = ''; eleveClassesPull(); }
    const m = messageStatut(s);
    toast(m.ton === 'ko' ? I.x : I.check, m.titre);
  } catch (e) { eleve.reponse = 'erreur'; toast(I.x, messageErreur(e).slice(0, 120) || 'Impossible pour l’instant'); }
  eleve.envoi = false; repeint();
}

/* Un devoir s'ouvre dans la bibliothèque. S'il y est déjà, on l'y retrouve
   au lieu d'en créer une seconde copie (l'ancien bouton en ajoutait une à
   chaque appui). Ses cartes gardent leur identifiant « a:<devoir>:<rang> » :
   c'est par lui que la base compte ce qui est revu. */
const MEDIAS = ['fi', 'bi', 'fa', 'ba', 't', 'g'];

async function ouvrirDevoir(aid) {
  const deja = db.decks.find(d => d.cards.some(c => String(c.id).startsWith(`a:${aid}:`)));
  if (deja) { cartesDevoir(aid).catch(() => {}); return go('deck', deja.id); }   // déjà ouvert : on note seulement, sans attendre
  if (!online) return toast(I.cloud, 'Hors ligne : ouvre ce devoir une fois connecté');
  try {
    const r = await cartesDevoir(aid);
    if (!r) return toast(I.x, 'Devoir introuvable');
    const cards = (r.cartes || []).map((c, i) => {
      const o = Array.isArray(c) ? { f: c[0], b: c[1] } : { f: c.f, b: c.b };
      if (!Array.isArray(c)) for (const k of MEDIAS) if (c[k]) o[k] = c[k];
      return { id: `a:${aid}:${i}`, ...o };
    });
    const d = importPayload({ name: r.nom, subjectName: r.matiere, cards }, true);   // la matière du professeur, retrouvée ou créée chez l'élève
    eleveClassesPull();
    if (d) { go('deck', d.id); toast(I.check, 'Devoir ajouté à ta bibliothèque'); }
  } catch (e) { toast(I.x, messageErreur(e).slice(0, 120) || 'Impossible pour l’instant'); }
}

function repeint() { if (view.name === 'classes') { setAnimate(false); render(); } }

const ACTIONS = {
  'annuler-apercu': () => { eleve.apercu = null; eleve.reponse = null; repeint(); },
  rejoindre,
  devoir: id => ouvrirDevoir(id),
  // toucher sa classe ouvre sa page (ui/classe-eleve.js, chargé à la demande)
  classe: id => ouvrirClasse(id),
  annuler: async id => {
    try { await annulerDemande(id); toast(I.check, 'Demande annulée'); } catch (e) { toast(I.x, 'Impossible pour l’instant'); }
    eleveClassesPull();
  },
  quitter: async (id, b) => {
    if (!b.dataset.arme) { b.dataset.arme = '1'; b.querySelector('span').textContent = 'Confirmer : quitter'; return; }
    try { await quitterClasse(id); toast(I.check, 'Classe quittée'); closeMenu(); }
    catch (e) { toast(I.x, messageErreur(e).slice(0, 120) || 'Impossible pour l’instant'); }
    eleveClassesPull();
  }
};

document.addEventListener('click', e => {
  const b = e.target.closest('[data-el]');
  if (!b || b.disabled) return;
  const f = ACTIONS[b.dataset.el];
  if (!f) return;
  e.preventDefault();
  f(b.dataset.id, b);
});

document.addEventListener('input', e => {
  const n = e.target.closest('[data-elin]'); if (!n) return;
  const k = n.dataset.elin;
  eleve[k] = n.value;
  const ok = nomValide(eleve.prenom) && nomValide(eleve.nom);
  const b = document.getElementById('elgo'); if (b) b.disabled = !ok;
  const p = document.getElementById('elnomap');
  if (p) p.innerHTML = ok ? 'Tu apparaîtras comme <b>' + esc(nomPropre(eleve.prenom, eleve.nom)) + '</b>'
    : 'Ton vrai prénom et ton vrai nom : ton professeur doit te reconnaître.';
});

/* ---------- la porte de la page d'une classe ----------
   La page vit dans ui/classe-eleve.js, chargée à la demande avec sa feuille
   de style. Rien d'autre ne doit importer ui/classe-eleve.js. */
let classeMorceau = null;
export function ouvrirClasse(id) {
  if (!id) return;
  eleve.open = id;
  classePull(id);
  go('classe', id);
}
export function classeEleveView() {
  if (classeMorceau) return classeMorceau.classeEcran();
  $.innerHTML = `<div class="page el-page"><div class="el-carte el-load"></div></div>`;
  import('./classe-eleve.js').then(m => { classeMorceau = m; if (view.name === 'classe') render(); })
    .catch(() => toast(I.x, 'La classe n’a pas pu s’ouvrir : vérifie ta connexion'));
}

/* « ?rejoindre=CODE » : le lien envoyé par le professeur, ou le QR projeté.
   Sans session, le code attend la connexion (sessionStorage) ; avec, on
   ouvre « Mes classes » et on montre tout de suite la classe trouvée. */
export function consumeRejoindre(connecte = !!auth) {
  const p = new URLSearchParams(location.search), brut = p.get('rejoindre');
  let k = brut ? codeDepuisTexte('?rejoindre=' + brut) : '';
  if (brut) {
    p.delete('rejoindre');
    history.replaceState(null, '', location.pathname + (p.toString() ? '?' + p : '') + location.hash);
  }
  try { k = k || sessionStorage.getItem('folio.rejoindre') || ''; } catch (e) { /* stockage indisponible : le code ne survivra pas à la connexion */ }
  if (!k) return false;
  try { connecte ? sessionStorage.removeItem('folio.rejoindre') : sessionStorage.setItem('folio.rejoindre', k); }
  catch (e) { /* idem */ }
  if (!connecte) return false;
  /* Code d'établissement, de professeur particulier, d'équipe ou ancien
     code de classe : la feuille « J'ai un code » reconnaît chacun. */
  ouvrirCode(k);
  return true;
}
