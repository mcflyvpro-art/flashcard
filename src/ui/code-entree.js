// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { I, svg } from '../icones.js';
import { cercle, eleve, menu, online } from '../data/etat.js';
import { esc } from '../core/coeur-sync.js';
import { codeApercu, eleveClassesPull, messageErreur, rejoindreAvecCode } from '../core/eleve-classes.js';
import { cerclePull, refPull } from '../core/classement.js';
import { offrePull } from '../core/abonnement.js';
import { nomPropre, nomValide } from '../classe.js';
import { tokComplet } from '../livre-code.js';
import { quelCode } from '../codes.js';
import { messageSalle } from '../defi.js';
import { rejoindreClub, rejoindreSalle } from '../core/cercle.js';
import { garder } from '../lien-garde.js';
import { askFriend, openShared } from '../core/reglages-corbeille.js';
import { bienvenue, messageEtab, ROLES_CODE } from '../etablissement.js';
import { go } from './bibliotheque.js';
import { isProf } from './classement.js';
import { toast } from './import-cartes.js';
import { closeMenu, mountMenu, openMenu } from './menus-a.js';
import { allerAccueil, rejoindreCollegue } from './prof-porte.js';
import { versClasse } from './eleve-classes.js';
import { apresEntree } from './tuto-porte.js';
import { clubPull } from './club-porte.js';
import { ouvrirDirect } from './direct-porte.js';

/* ══════════ « J'ai un code » ══════════
   La seule porte d'entrée dans une école (docs/PARCOURS.md) : le code d'un
   établissement — élève, professeur ou référent — ou celui d'un professeur
   particulier. Deux temps : le code (la base dit ce que c'est), puis le
   prénom, le nom et la classe à choisir — et on est dedans. Ouverte depuis
   les Réglages, l'accueil d'un nouveau compte, « Ma classe » et les liens
   « ?rejoindre= ». Un ancien code de classe continue dans « Ma classe »,
   où vit déjà son parcours.

   Le code d'un livre partagé (2026-11-05, src/livre-code.js) entre aussi
   par ici : dix signes, ou le lien collé — le livre s'ouvre, prêt à être
   ajouté (vue `shared`).

   Chez un professeur particulier (2026-10-29), on n'entre pas tout de
   suite : on passe dans sa salle d'attente (statut « attente »), ce qui
   réserve une place de sa licence et ouvre déjà Mirandola Campus. Il
   vérifie le prénom et le nom, puis accepte — ou refuse, et la place lui
   revient. */

const E = () => eleve.entree;

/* Tous les codes (2026-11-16, src/codes.js) : un établissement, un
   professeur, une classe ou un club (« XXXX-XXXX »), une partie en direct
   (« 123 456 »), un paquet (« XXXX-XXXX-XX »), un ami (« @pseudo ») ; un
   lien ou un message collé se réduit au code qu'il porte. La forme suit ce
   qu'on tape. */
const complet = v => quelCode(v).complet;

/* `o.entre(r)` (2026-10-29) : qui a ouvert la feuille reprend la main une
   fois l'élève entré ou en salle d'attente — l'accueil d'un nouveau compte
   (ui/bienvenue.js) continue alors sur place, sans repasser par « Ma
   classe ». Rend vrai s'il s'en charge. */
export function ouvrirCode(code, o = {}) {
  const q = quelCode(code || '');
  Object.assign(E(), { code: q.lisible, club: !!q.club, fiche: null, reponse: null, texte: '', envoi: false, classe: '', type: '',
    entre: o.entre || null });
  openMenu('code');
  if (q.complet && !o.attendre) lire();               // un lien d'invitation (`attendre`) se montre : on entre d'un appui
}

const peindre = () => { if (menu === 'code') openMenu('code'); };
const coque = corps => `<div class="scrim" data-mact="close"></div><div class="menu ce-f">${corps}</div>`;
// la réponse d'un établissement (src/etablissement.js), ou une phrase à elle (une partie, un code inconnu)
const message = r => (r === 'texte' ? { ton: 'ko', titre: E().texte } : r ? messageEtab(r, E().type) : null);

function feuilleCode(e) {
  const m = message(e.reponse);
  return coque(`<div class="mhd">${svg(I.key)}<span class="mhx"><b>J’ai un code</b></span></div>
    <form class="ce-form" id="ceform" autocomplete="off">
      <input class="ce-code" id="cecode" data-cein="code" value="${esc(e.code)}" placeholder="Code ou @pseudo"
        autocapitalize="characters" autocorrect="off" spellcheck="false" maxlength="400" enterkeyhint="go" aria-label="Code">
      <p class="ce-rep${m ? ' ' + m.ton : ''}" id="cerep">${m ? `<b>${esc(m.titre)}</b>${m.texte ? `<span>${esc(m.texte)}</span>` : ''}` : ''}</p>
      <button class="cta" data-ce="lire" id="ceok" ${complet(e.code) && !e.envoi ? '' : 'disabled'}>Continuer</button>
    </form>`);
}

/* Le nom figé à l'entrée : on le montre tel qu'il apparaîtra. */
const apparaitra = e => (nomValide(e.prenom) && nomValide(e.nom)
  ? `Tu apparaîtras comme <b>${esc(nomPropre(e.prenom, e.nom))}</b>` : '');

function choixClasse(f, e) {
  if (!f.classes || !f.classes.length) return '';
  return `<div class="ce-lbl">${f.type === 'prof' ? 'Ton cours' : 'Ta classe'}</div>
    <div class="ce-classes" role="radiogroup">${f.classes.map(c => `<button type="button" role="radio"
      class="ce-cl${e.classe === c.id ? ' on' : ''}" data-ce="classe" data-id="${esc(c.id)}" aria-checked="${e.classe === c.id}">
      ${esc(c.nom)}</button>`).join('')}</div>`;
}

function feuilleNom(e, f) {
  const role = f.type === 'prof' ? 'Cours particulier' : ROLES_CODE[f.quel] || '';
  const pret = nomValide(e.prenom) && nomValide(e.nom) && (!(f.classes || []).length || e.classe);
  const m = message(e.reponse);
  return coque(`<div class="mhd"><i class="jt groupe vide">${svg(f.type === 'prof' ? I.user : I.school)}</i>
      <span class="mhx"><b>${esc(f.nom)}</b><i>${esc(role + (f.ville ? (role ? ' à ' : '') + f.ville : ''))}</i></span></div>
    <div class="ce-form">
      <div class="ce-noms">
        <input id="cepre" data-cein="prenom" value="${esc(e.prenom)}" placeholder="Prénom" autocomplete="given-name" maxlength="40" aria-label="Prénom">
        <input data-cein="nom" value="${esc(e.nom)}" placeholder="Nom" autocomplete="family-name" maxlength="40" aria-label="Nom">
      </div>
      <p class="ce-note" id="cenom">${apparaitra(e)}</p>
      ${choixClasse(f, e)}
      ${m ? `<p class="ce-rep ${m.ton}"><b>${esc(m.titre)}</b>${m.texte ? `<span>${esc(m.texte)}</span>` : ''}</p>` : ''}
      <div class="ce-b"><button class="el-btn" data-ce="retour">Retour</button>
        <button class="el-btn pri" data-ce="entrer" id="cego" ${pret && !e.envoi ? '' : 'disabled'}>Entrer</button></div>
    </div>`);
}

export function paintMenuCode(w) {
  const e = E();
  w.innerHTML = e.fiche ? feuilleNom(e, e.fiche) : feuilleCode(e);
  mountMenu(w);
  // le curseur d'ouverture se pose plus tard : on regarde alors si l'on tape déjà
  // ailleurs (sinon la suite du nom partait dans le prénom, « léamartin »)
  const champ = document.getElementById(e.fiche ? 'cepre' : 'cecode');
  const libre = () => { const a = document.activeElement; return !(a && a.tagName === 'INPUT'); };
  if (champ && !champ.value && libre()) setTimeout(() => { if (champ.isConnected && !champ.value && libre()) champ.focus(); }, 80);
}

/* ---------- les gestes ---------- */
/* Déjà dans cette classe, ou déjà dans sa salle d'attente : rien à entrer,
   on y va (l'accueil, s'il a ouvert la feuille, reprend là). */
async function dejaLa(r) {
  closeMenu(); toast(I.check, messageEtab(r.statut, r.type).titre);
  if (await reprise({ ...r, statut: r.statut === 'deja' ? 'ok' : 'attente' })) return;
  go('classes');
}

/* Le code d'un livre : le livre s'ouvre, prêt à être ajouté. Depuis
   l'accueil d'un nouveau compte, il attend la fin des premiers pas
   (liens-entrants.js, `consumeLivre`) : l'accueil ne se quitte pas. */
function livre(tok) {
  const e = E(), f = e.entre;
  if (!tokComplet(tok) || e.envoi) return;
  if (!online) return toast(I.cloud, 'Hors ligne : un code demande le réseau');
  Object.assign(e, { code: '', entre: null });
  closeMenu();
  if (f) { garder('folio.livre', tok); return toast(I.card, 'Ton paquet t’attend : il s’ouvre après tes premiers pas'); }
  openShared(tok);
}

function lire() {
  const e = E(), q = quelCode(e.code), k = q.valeur;
  if (q.genre === 'paquet') return livre(k);
  if (!q.complet || e.envoi) return;
  if (!online) return toast(I.cloud, 'Hors ligne : un code demande le réseau');
  if (q.genre === 'partie') return partie(k);
  if (q.genre === 'ami') return ami(k);
  return e.club ? club(k) : huit(k);                // un lien d'invitation dit déjà que c'est un club
}

// huit signes : un établissement, un professeur, une classe… ou un club
async function huit(k) {
  const e = E();
  e.envoi = true; e.reponse = null; peindre();
  try {
    const r = await codeApercu(k) || {};
    e.envoi = false;
    if (r.type === 'classe' || !r.type) {
      /* Ni établissement ni professeur : une classe qui existe (un ancien
         code, l'équipe d'un collègue)… sinon, un club. Avant le 2026-11-16,
         un code de club partait sur « Ma classe », « Code incorrect ». */
      if (!(r.fiche && r.fiche.statut && r.fiche.statut !== 'inconnu')) return club(k);
      closeMenu();
      return isProf() ? rejoindreCollegue(k) : versClasse(k, r.fiche);
    }
    e.type = r.type || '';
    if (r.statut === 'ok') { e.fiche = r; e.classe = ''; }
    else if (r.statut === 'deja' || r.statut === 'attente') return dejaLa(r);
    else e.reponse = r.statut;
  } catch (x) { e.envoi = false; e.reponse = 'erreur'; toast(I.x, messageErreur(x).slice(0, 120) || 'Impossible pour l’instant'); }
  peindre();
}

/* Un club : on y entre, et l'on y va (depuis l'accueil d'un nouveau
   compte, on y reste : le club attend dans Mes amis). */
async function club(k) {
  const e = E();
  e.envoi = true; e.reponse = null; peindre();
  const id = await rejoindreClub(k, true);
  e.envoi = false;
  if (id === 0) { e.reponse = 'inconnu'; return peindre(); }
  if (!id) return peindre();                        // une panne : rejoindreClub l'a dite
  const f = e.entre;
  Object.assign(e, { code: '', club: false });
  closeMenu();
  if (f) return;
  cercle.onglet = 'defis'; clubPull(id); go('club', id);
}

// une partie en direct : six chiffres
async function partie(pin) {
  const e = E();
  e.envoi = true; e.reponse = null; peindre();
  const r = await rejoindreSalle(pin);
  e.envoi = false;
  if (r.statut === 'ok' || r.statut === 'hote') { e.code = ''; closeMenu(); return ouvrirDirect(r.salle); }
  Object.assign(e, { reponse: 'texte', texte: messageSalle(r.statut) || 'Impossible d’entrer' });
  peindre();
}

// un ami : « @pseudo » (askFriend dit lui-même ce qu'il en est)
async function ami(p) {
  const e = E();
  e.envoi = true; e.reponse = null; peindre();
  let ok = false;
  try { ok = await askFriend(p); } catch (x) { toast(I.x, 'Impossible pour l’instant'); }
  e.envoi = false;
  if (!ok) return peindre();
  e.code = ''; closeMenu();
}

/* Entré (ou en salle d'attente) : on relit le rôle, l'établissement et
   l'offre — Campus s'ouvre dès maintenant, le tuto ne proposera donc pas
   Mirandola+ —, puis on va là où l'on est attendu : sa classe, son espace
   professeur, sa console de référent. Un compte neuf y trouve ensuite son
   accueil et son tuto (ui/tuto-porte.js). */
async function arriver(r) {
  toast(I.check, bienvenue(r));
  Object.assign(E(), { code: '', fiche: null, reponse: null, classe: '', type: '' });
  closeMenu();
  if (await reprise(r)) return;
  await offrePull();
  await cerclePull();
  eleveClassesPull();
  if (r.quel === 'ref') { refPull(); go('ref'); }
  else if (r.quel === 'prof') allerAccueil();
  else go('classes');
  apresEntree();
}

/* Un élève (pas un professeur ni un référent, qui ont leur espace) entré
   depuis l'accueil : l'accueil reprend, ce qu'il faut relu d'abord — l'offre
   (Campus dès la salle d'attente), l'établissement, le nom de classe, ses
   classes. */
async function reprise(r) {
  const f = E().entre;
  E().entre = null;
  if (!f || r.quel === 'prof' || r.quel === 'ref') return false;
  await Promise.all([offrePull(), cerclePull(), eleveClassesPull()]);
  return !!(await f(r));
}

async function entrer() {
  const e = E();
  if (e.envoi) return;
  e.envoi = true; e.reponse = null; peindre();
  try {
    const r = await rejoindreAvecCode(quelCode(e.code).valeur, e.prenom, e.nom, e.classe) || {};
    e.envoi = false;
    if (r.statut === 'ok' || r.statut === 'attente') return arriver(r);
    if (!['nom', 'choisir', 'classe'].includes(r.statut)) e.fiche = null;   // le code ne vaut plus : on revient au code
    e.reponse = r.statut;
  } catch (x) { e.envoi = false; toast(I.x, messageErreur(x).slice(0, 120) || 'Impossible pour l’instant'); }
  peindre();
}

const ACTIONS = {
  ouvrir: () => ouvrirCode(),
  lire,
  entrer,
  retour: () => { Object.assign(E(), { fiche: null, reponse: null }); peindre(); },
  classe: id => { E().classe = id; E().reponse = null; peindre(); }
};

document.addEventListener('click', e => {
  const b = e.target.closest('[data-ce]');
  if (!b || b.disabled) return;
  const f = ACTIONS[b.dataset.ce];
  if (!f) return;
  e.preventDefault();
  f(b.dataset.id, b);
});

document.addEventListener('submit', e => {
  if (e.target.id !== 'ceform') return;
  e.preventDefault();
  lire();
});

function saisieCode(n, s) {
  const q = quelCode(n.value);
  s.club = q.club || (s.club && q.lisible === s.code);   // un lien de club le reste tant qu'on n'y touche pas
  s.code = q.lisible;                               // un lien, un message collés se réduisent à leur code
  if (n.value !== s.code) { n.value = s.code; n.setSelectionRange(n.value.length, n.value.length); }
  s.reponse = null;
  const b = document.getElementById('ceok'); if (b) b.disabled = !q.complet;
  const p = document.getElementById('cerep'); if (p) { p.className = 'ce-rep'; p.innerHTML = ''; }
  if (q.genre === 'partie' && q.complet) lire();    // six chiffres : on entre sans chercher le bouton
}

/* Les champs ne repeignent jamais la feuille où l'on tape : ils mettent à
   jour sur place ce qui dépend d'eux (le bouton, le nom tel qu'il
   apparaîtra). */
document.addEventListener('input', e => {
  const n = e.target.closest('[data-cein]'); if (!n) return;
  const k = n.dataset.cein, s = E();
  if (k === 'code') return saisieCode(n, s);
  s[k] = n.value;
  const f = s.fiche || {};
  const b = document.getElementById('cego');
  if (b) b.disabled = !(nomValide(s.prenom) && nomValide(s.nom) && (!(f.classes || []).length || s.classe));
  const p = document.getElementById('cenom'); if (p) p.innerHTML = apparaitra(s);
});
