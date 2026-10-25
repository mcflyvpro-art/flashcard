// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { $ } from '../racine.js';
import { I, svg } from '../icones.js';
import { atSchool, isProf, isPupil } from './classement.js';
import { auth, cercle, compte, db, duels, eleve, mates2, online, setAnimate, setMenu, view } from '../data/etat.js';
import { go, render, tabs } from './bibliotheque.js';
import { defiLigne, enDirectHtml, parDefi } from './cercle.js';
import {
  codeComplet, codeDepuisTexte, echeance, etatDevoirEleve, formatCode, iso, jourCourt,
  messageStatut, nomPropre, nomValide, normCode
} from '../classe.js';
import { avatar, blason, couleurClasse } from './jeton.js';
import { esc, plur } from '../core/coeur-sync.js';
import {
  annulerDemande, apercuCode, cartesDevoir, eleveClassesPull, messageErreur, quitterClasse, rejoindreCode
} from '../core/eleve-classes.js';
import { importPayload, toast } from './import-cartes.js';
import { closeMenu, mountMenu, openMenu } from './menus-a.js';
import { rejoindreCollegue } from './prof-porte.js';

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
    return `<div class="el-carte el-apercu">
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
  return `<form class="el-carte el-rej" id="elform" autocomplete="off">
    <label for="elcode">Rejoindre une classe</label>
    <div class="el-code"><input id="elcode" data-elin="code" value="${esc(eleve.code)}" placeholder="XXXX-XXXX"
      inputmode="text" autocapitalize="characters" autocorrect="off" spellcheck="false" maxlength="40" enterkeyhint="go">
      <button class="el-btn pri" data-el="apercu" id="elok" ${codeComplet(eleve.code) && !eleve.envoi ? '' : 'disabled'}>OK</button></div>
    ${r ? `<p class="el-rep ${r.ton}"><b>${esc(r.titre)}</b>${r.texte ? ' ' + esc(r.texte) : ''}</p>` : ''}
  </form>`;
}

/* ---------- les devoirs ---------- */
function devoirsHtml() {
  const l = eleve.devoirs;
  if (!l) return `<div class="el-carte el-load"></div>`;
  const auj = iso(new Date());
  const afaire = l.filter(d => d.etat !== 'rendu');
  const rendus = l.length - afaire.length;
  if (!l.length) return `<p class="el-vide">${svg(I.check)}Aucun devoir pour l’instant.</p>`;
  return `${afaire.length ? `<div class="el-list">${afaire.map(d => {
      const e = etatDevoirEleve(d, auj);
      return `<button class="el-dv ${e.k}" data-el="devoir" data-id="${esc(d.id)}">
        <i class="el-dot" style="--k:${couleurClasse(d.class_id)}"></i>
        <span class="el-dvt"><b>${esc(d.nom)}</b><i>${esc(d.classe)} · ${plur(d.n, 'carte')}${d.due ? ' · ' + esc(echeance(d.due, auj)) : ''}</i></span>
        <em class="el-pill ${e.k}">${esc(e.t)}</em>${svg(I.arrow)}</button>`;
    }).join('')}</div>` : `<p class="el-vide">${svg(I.check)}Tout est rendu.</p>`}
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
      ${enDirectHtml((cercle.salles || []).filter(s => s.class_id))}
      <h2 class="el-h2">À faire</h2>${devoirsHtml()}
      ${defisClasseHtml()}
      ${rejoindreHtml()}
      <h2 class="el-h2">Mes classes</h2>${classesHtml()}
      ${camaradesHtml()}
    </div>
    ${tabs('classes')}`;
  const f = document.getElementById('elform');
  if (f) f.onsubmit = e => { e.preventDefault(); apercu(); };
}

/* ---------- les gestes ---------- */
async function apercu(code) {
  const k = normCode(code || eleve.code);
  if (!codeComplet(k)) return;
  if (!online) return toast(I.cloud, 'Hors ligne : rejoindre demande le réseau');
  eleve.envoi = true; eleve.reponse = null; repeint();
  try {
    const r = await apercuCode(k);
    eleve.apercu = r && r.statut === 'apercu' ? r : null;
    eleve.reponse = r && r.statut !== 'apercu' ? r.statut : r ? null : 'inconnu';
    if (r && r.statut === 'deja') eleveClassesPull();
  } catch (e) { eleve.reponse = 'erreur'; toast(I.x, messageErreur(e).slice(0, 120) || 'Impossible pour l’instant'); }
  eleve.envoi = false; repeint();
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
    const d = importPayload({ name: r.nom, subject: '', cards }, true);
    eleveClassesPull();
    if (d) { go('deck', d.id); toast(I.check, 'Devoir ajouté à ta bibliothèque'); }
  } catch (e) { toast(I.x, messageErreur(e).slice(0, 120) || 'Impossible pour l’instant'); }
}

function repeint() { if (view.name === 'classes') { setAnimate(false); render(); } }

/* La feuille d'une classe. */
export function paintMenuEleve(w) {
  const c = (eleve.classes || []).find(x => x.class_id === eleve.open);
  if (!c) { setMenu(null); return; }
  w.innerHTML = `<div class="scrim" data-mact="close"></div><div class="menu">
    <div class="mhd">${pastille(c.class_id)}<span class="mhx"><b>${esc(c.nom)}</b><i>${esc(c.etab || 'Hors établissement')}</i></span></div>
    <div class="el-fiche">
      ${c.prof ? `<p>${svg(I.user)}<b>${esc(c.prof)}</b></p>` : ''}
      ${c.matieres ? `<p>${svg(I.book)}${esc(c.matieres)}</p>` : ''}
      <p>${svg(I.users)}${plur(c.effectif, 'élève')}</p>
      <p>${svg(I.clock)}Inscrit le ${esc(jourCourt(String(c.depuis).slice(0, 10)))}</p></div>
    ${c.peut_quitter ? `<button class="mi warn" data-el="quitter" data-id="${esc(c.class_id)}">${svg(I.exit)}<span>Quitter la classe</span></button>`
      : `<p class="el-note pad">C’est ton établissement qui t’a inscrit : lui seul peut t’en retirer.</p>`}
  </div>`;
  mountMenu(w);
}

const ACTIONS = {
  apercu: () => apercu(),
  'annuler-apercu': () => { eleve.apercu = null; eleve.reponse = null; repeint(); },
  rejoindre,
  devoir: id => ouvrirDevoir(id),
  classe: id => { eleve.open = id; openMenu('el'); },
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
  if (k === 'code') {
    /* Un lien entier collé dans le champ se réduit à son code. */
    const v = /rejoindre=/.test(n.value) ? codeDepuisTexte(n.value) : n.value;
    eleve.code = formatCode(v);
    if (n.value !== eleve.code) { n.value = eleve.code; n.setSelectionRange(n.value.length, n.value.length); }
    eleve.reponse = null;
    const b = document.getElementById('elok'); if (b) b.disabled = !codeComplet(eleve.code);
    return;
  }
  eleve[k] = n.value;
  const ok = nomValide(eleve.prenom) && nomValide(eleve.nom);
  const b = document.getElementById('elgo'); if (b) b.disabled = !ok;
  const p = document.getElementById('elnomap');
  if (p) p.innerHTML = ok ? 'Tu apparaîtras comme <b>' + esc(nomPropre(eleve.prenom, eleve.nom)) + '</b>'
    : 'Ton vrai prénom et ton vrai nom : ton professeur doit te reconnaître.';
});

/* « ?rejoindre=CODE » : le lien envoyé par le professeur, ou le QR projeté.
   Sans session, le code attend la connexion (sessionStorage) ; avec, on
   ouvre « Mes classes » et on montre tout de suite la classe trouvée. */
export function consumeRejoindre() {
  const p = new URLSearchParams(location.search), brut = p.get('rejoindre');
  let k = brut ? codeDepuisTexte('?rejoindre=' + brut) : '';
  if (brut) {
    p.delete('rejoindre');
    history.replaceState(null, '', location.pathname + (p.toString() ? '?' + p : '') + location.hash);
  }
  try { k = k || sessionStorage.getItem('folio.rejoindre') || ''; } catch (e) { /* stockage indisponible : le code ne survivra pas à la connexion */ }
  if (!k) return false;
  try { auth ? sessionStorage.removeItem('folio.rejoindre') : sessionStorage.setItem('folio.rejoindre', k); }
  catch (e) { /* idem */ }
  if (!auth) return false;
  if (isProf()) { rejoindreCollegue(k); return true; }   // un code collègue : l'équipe, pas les élèves
  eleve.code = formatCode(k); eleve.apercu = null; eleve.reponse = null;
  eleveClassesPull();
  go('classes');
  apercu(k);
  return true;
}
