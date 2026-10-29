// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { $ } from '../racine.js';
import { I, svg } from '../icones.js';
import { auth, compte, db, eleve, me, online, prefs, school, view, visuels } from '../data/etat.js';
import { COLORS, delSubject, esc, pushSubject, save } from '../core/coeur-sync.js';
import { changerPseudo, envoyerPrefs, mePull, pseudoLibre } from '../core/reglages-corbeille.js';
import { annulerDemande, eleveClassesPull, messageErreur } from '../core/eleve-classes.js';
import { offrePull } from '../core/abonnement.js';
import { cerclePull } from '../core/classement.js';
import { prendre } from '../lien-garde.js';
import { nomPropre, nomValide } from '../classe.js';
import { choisirMonJeton } from '../core/visuels.js';
import { NEUTRE, avatarDeCle, avatarSvg, ecrireAvatar, nomOnglet, normaliser } from '../avatar.js';
import { COULEURS, rangCouleur } from '../jeton.js';
import {
  ANNEES, ajouterMatiere, anneeRequise, matieresApres, NIVEAUX_PERSO, nomMatiere, OBJECTIFS, prenomValide, proposees
} from '../bienvenue.js';
import { MAX, message, motif, proposer, saisie } from '../pseudo.js';
import { go } from './bibliotheque.js';
import { ouvrirCode } from './code-entree.js';
import { toast } from './import-cartes.js';
import { grilleCouleurs, grilleTrait, ongletsAvatar } from './jeton.js';
import { avancer } from './mouvement.js';
import './bienvenue.css';

/* ══════════ l’accueil d’un nouveau compte (2026-10-26, refait le 2026-10-27 et le 2026-10-29) ══════════
   Chargé une fois par compte par ui/bienvenue-porte.js. Un particulier :
   « pour moi » ou « j'ai un code », puis son prénom et son pseudo, son
   visage (composé trait par trait, src/avatar.js), son niveau et son année,
   ses matières (celles du niveau, cochées d'office, et les siennes écrites
   à la main), un objectif — et le tuto
   (ui/tuto.js), qui prend le relais. Un élève entré par son établissement :
   son lycée et sa classe pour l'accueillir, son pseudo (son nom de classe,
   « Prénom NOM », reste celui qu'on voit en classe), son visage — et le
   tuto aussi. « J'ai un code » ouvre la porte d'entrée par-dessus l'accueil :
   entré, l'élève reprend ici, en élève de sa classe. Le pseudo suit la
   règle de src/pseudo.js pendant la frappe, et la base dit s'il est libre.
   Le code d'un professeur particulier (2026-10-29) : l'élève attend ici
   qu'il valide (`attente`, relu toutes les 4 s) ; validé, l'accueil
   continue en élève de sa classe (pseudo, visage) puis le tuto de la
   classe ; refusé, il revient au choix. Un code tapé sur le site avant
   d'avoir un compte (src/lien-garde.js) ouvre la feuille du code dès
   l'arrivée : l'accueil commence par le nom et la classe.
   Habillé comme les écrans publics (la lumière de la marque, le logo, des
   titres en serif) : on arrive du site, on y est encore un peu. Un titre
   par écran et rien dessous (« Mes livres, mon rythme », « Tu révises pour
   toi… » sont partis le 2026-10-29), de gros boutons, une étape par écran ;
   « Passer » à tout moment (le pseudo donné d'office par la base reste
   alors). */

const e = { mode: 'perso', etape: 0, apres: null, prenom: '', pseudo: '', pseudoTouche: false, libre: '', suggestion: '',
  jeton: 0, av: NEUTRE, teinte: 0, trait: 'peau', niveau: '', annee: '', base: '', matieres: new Set(), ajoutees: [],
  objectif: 20, envoi: false, cid: null, prof: '' };

const ETAPES_PERSO = ['choix', 'nom', 'visage', 'niveau', 'matieres', 'objectif'];
const etapes = () => (e.mode === 'classe' ? ['pseudo', 'visage'] : e.mode === 'attente' ? ['attente'] : ETAPES_PERSO);
const actuel = () => (me && me.handle) || '';

/* Le visage de départ : le sien s'il en a déjà un, sinon le même pour tous
   — on le compose trait par trait, rien n'est tiré au hasard. */
function visageDepart() {
  const v = (auth && visuels['p:' + auth.uid]) || {};
  return { av: avatarDeCle(v.cle) || NEUTRE, teinte: rangCouleur(auth ? auth.uid : '', v.teinte) };
}

export function commencer(mode, apres) {
  Object.assign(e, { mode, etape: 0, apres, prenom: String(prefs.name || '').trim(), pseudo: '', pseudoTouche: false,
    libre: '', suggestion: '', ...visageDepart(), trait: 'peau', niveau: '', annee: '', base: '', matieres: new Set(), ajoutees: [],
    objectif: prefs.goal || 20, envoi: false, cid: null, prof: '' });
  e.pseudo = mode === 'perso' && e.prenom ? proposer(e.prenom) : actuel();
  go('bienvenue');
  if (mode === 'perso') reprendreCode();
  // le pseudo donné d'office par la base, s'il n'est pas encore là
  if (!me) mePull().then(() => {
    if (e.pseudoTouche || (mode === 'perso' && e.prenom) || !actuel()) return;
    e.pseudo = actuel(); repeint();
  });
}

const repeint = () => { if (view.name === 'bienvenue') bienvenueEcran(); };

/* ---------- un code : l'accueil continue sur place ---------- */
const entre = { entre: r => entreParCode(r) };

/* Ce qui attendait l'arrivée : une demande déjà en salle d'attente (l'app
   rouverte pendant l'attente), ou un code tapé sur le site. */
async function reprendreCode() {
  if (!eleve.classes) await eleveClassesPull();
  if (view.name !== 'bienvenue' || e.mode !== 'perso' || e.etape) return;
  const c = (eleve.classes || []).find(x => x.statut === 'attente');
  if (c) return attendre(c.class_id, c.prof);
  const k = prendre('folio.rejoindre');
  if (k) ouvrirCode(k, entre);
}

function entreParCode(r) {
  // le prénom donné avec le code : celui dont le tuto le salue (« Bienvenue, Léa »)
  const f = eleve.entree || {};
  if (!prefs.name && nomValide(f.prenom) && nomValide(f.nom)) prefs.name = nomPropre(f.prenom, f.nom).split(' ')[0];
  if (r.statut !== 'attente') { enClasse(); return true; }
  const c = (eleve.classes || []).find(x => x.statut === 'attente');
  attendre(c ? c.class_id : null, r.nom || (c && c.prof) || '');
  return true;
}

/* Entré (ou validé) : son pseudo — celui que la base lui a donné —, puis son visage. */
function enClasse() {
  Object.assign(e, { mode: 'classe', etape: 0, cid: null, pseudo: actuel() || e.pseudo, pseudoTouche: false, libre: '', suggestion: '' });
  if (view.name !== 'bienvenue') go('bienvenue'); else repeint();
}

let minuteur = 0;
function attendre(cid, prof) {
  Object.assign(e, { mode: 'attente', etape: 0, cid, prof: prof || '' });
  repeint();
  clearInterval(minuteur);
  minuteur = setInterval(regarder, 4000);
}

const arreterAttente = () => { clearInterval(minuteur); minuteur = 0; };

/* La salle d'attente, relue : toujours là, validé, ou refusé (la demande
   n'existe plus — le professeur lui a écrit pourquoi). */
async function regarder() {
  if (view.name !== 'bienvenue' || e.mode !== 'attente') return arreterAttente();
  if (document.hidden || !online) return;
  await eleveClassesPull();
  if (e.mode !== 'attente') return;
  const l = eleve.classes || [], de = x => !e.cid || x.class_id === e.cid;
  if (l.some(x => de(x) && x.statut === 'attente')) return;
  arreterAttente();
  const c = l.find(x => de(x) && x.statut === 'inscrit');
  await Promise.all([offrePull(), cerclePull()]);
  if (c) { toast(I.check, `C’est validé : bienvenue dans ${c.nom}`); return enClasse(); }
  toast(I.x, 'Ta demande n’a pas été validée');
  Object.assign(e, { mode: 'perso', etape: 0, cid: null });
  repeint();
}

async function annuler() {
  arreterAttente();
  try { if (e.cid) await annulerDemande(e.cid); }
  catch (x) { toast(I.x, messageErreur(x).slice(0, 120) || 'Impossible pour l’instant'); minuteur = setInterval(regarder, 4000); return; }
  await Promise.all([offrePull(), eleveClassesPull()]);
  Object.assign(e, { mode: 'perso', etape: 0, cid: null });
  repeint();
}

const gros = (act, ic, titre) => `<button class="bv-gros" data-bv="${act}">
  <i class="bv-gros-ic">${svg(ic)}</i><span class="bv-gros-t"><b>${titre}</b></span>${svg(I.arrow)}</button>`;

/* ---------- les étapes ---------- */
function choix() {
  return `<h1 class="bv-t">Bienvenue sur <em>Mirandola.</em></h1>
    <div class="bv-duo">
      ${gros('pour-moi', I.book, 'Je révise pour moi')}
      ${gros('code', I.key, 'J’ai un code')}
    </div>`;
}

const champPseudo = () => `<label class="bv-ch"><span>Pseudo</span><span class="bv-arobase"><i>@</i><input id="bvpse"
    data-bvin="pseudo" value="${esc(e.pseudo)}" maxlength="${MAX}" autocapitalize="none" autocorrect="off" spellcheck="false"
    enterkeyhint="done" aria-describedby="bvpv"></span></label>
  <p class="bv-pv" id="bvpv" aria-live="polite">${verdict()}</p>`;

function nom() {
  return `<h1 class="bv-t">Comment t’appelles-tu&nbsp;?</h1>
    <div class="bv-champs bv-verre">
      <label class="bv-ch"><span>Prénom</span><input id="bvpre" data-bvin="prenom" value="${esc(e.prenom)}" maxlength="40"
        autocomplete="given-name" enterkeyhint="next"></label>
      ${champPseudo()}
    </div>`;
}

/* Où l'élève vient d'entrer : son établissement et sa classe (une carte
   élève : la classe de son professeur). */
function ouEntre() {
  const cl = (eleve.classes || []).find(c => c.statut === 'inscrit') || {};
  const ec = school || {};
  const lieu = ec.org || cl.etab || cl.prof || '', classe = ec.classe || cl.nom || '';
  if (!lieu && !classe) return '';
  return `<p class="bv-ecole">${svg(I.school)}<span>${[lieu && esc(lieu), classe && `<b>${esc(classe)}</b>`].filter(Boolean).join(' · ')}</span></p>`;
}

/* En salle d'attente : qui doit valider, et rien d'autre à faire qu'attendre. */
function attente() {
  return `<div class="bv-attente" aria-hidden="true">${svg(I.clock)}</div>
    <h1 class="bv-t">En attente de <em>${esc(e.prof || 'ton professeur')}</em></h1>
    <button class="bv-annuler" data-bv="annuler">Annuler ma demande</button>`;
}

/* L'élève de classe : son nom de classe, fixe, et le pseudo qu'il veut. */
function pseudo() {
  return `${ouEntre()}<h1 class="bv-t">Bienvenue&nbsp;! Choisis ton pseudo</h1>
    ${compte && compte.nom ? `<p class="bv-classe">${svg(I.lock)}<span>En classe : <b>${esc(compte.nom)}</b></span></p>` : ''}
    <div class="bv-champs bv-verre">${champPseudo()}</div>`;
}

/* ---------- le pseudo : la règle ici, la place à la base ---------- */
function verdict() {
  const m = motif(e.pseudo);
  if (m !== 'ok') return e.pseudo ? `<span class="bv-non">${esc(message(m))}</span>` : '';
  if (e.libre === 'ok') return `<span class="bv-oui">${svg(I.check)}Libre</span>`;
  if (e.libre === 'verif') return '<span>…</span>';
  if (!e.libre || e.libre === 'meme' || e.libre === 'hors_ligne') return '';
  return `<span class="bv-non">${esc(message(e.libre))}</span>${e.suggestion
    ? `<button class="bv-sug" data-bv="sug">@${esc(e.suggestion)}</button>` : ''}`;
}

const pseudoPret = () => motif(e.pseudo) === 'ok' && !['pris', 'trop', 'erreur'].includes(e.libre);
const pretEtape = k => (k === 'nom' ? prenomValide(e.prenom) && pseudoPret() : k === 'pseudo' ? pseudoPret()
  : k === 'niveau' ? !!e.niveau && (!anneeRequise(e.niveau) || !!e.annee) : true);

function poserPseudo() {
  const v = document.getElementById('bvpv'); if (v) v.innerHTML = verdict();
  const b = document.getElementById('bvgo'); if (b) b.disabled = !pretEtape(etapes()[e.etape]) || e.envoi;
}

/* La dernière frappe seulement (`jeton`), 300 ms après. */
function verifier() {
  const v = e.pseudo, jeton = ++e.jeton;
  e.suggestion = '';
  e.libre = motif(v) !== 'ok' ? '' : v === actuel() ? 'meme' : online ? 'verif' : 'hors_ligne';
  poserPseudo();
  if (e.libre !== 'verif') return;
  setTimeout(async () => {
    if (jeton !== e.jeton) return;
    const r = await pseudoLibre(v);
    if (jeton !== e.jeton) return;
    e.libre = r.statut || 'erreur'; e.suggestion = r.suggestion || '';
    poserPseudo();
  }, 300);
}

/* ---------- le visage : chaque trait se choisit, un à un ----------
   Le visage en grand, les onglets des traits (peau, coiffure, cheveux,
   sourcils, yeux… jusqu'au fond), et la grille du trait ouvert : chaque
   choix dessiné sur le visage en cours. Un choix ne repeint que ce qui
   change (le visage, la grille, le nom d'un onglet) : les onglets gardent
   leur défilement. */
const fond = () => COULEURS[e.teinte];
const apercu = () => `<i class="jt xl vis" style="--k:${fond()}">${avatarSvg(e.av)}</i>`;
const grille = () => (e.trait === 'fond' ? grilleCouleurs(e.teinte, 'data-bv="fond" data-v')
  : grilleTrait(e.av, e.trait, fond(), 'data-bv="av" data-v'));

function visage() {
  return `<h1 class="bv-t">Ton visage</h1>
    <div class="bv-moi"><span id="bvmoi">${apercu()}</span>${motif(e.pseudo) === 'ok' ? `<span>@${esc(e.pseudo)}</span>` : ''}</div>
    <div class="bv-traits">${ongletsAvatar(e.av, e.trait, 'data-bv="trait" data-v')}</div>
    <div class="bv-pick" id="bvpick">${grille()}</div>`;
}

function peindreVisage() {
  const m = document.getElementById('bvmoi'), p = document.getElementById('bvpick');
  if (m) m.innerHTML = apercu();
  if (p) p.innerHTML = grille();
  for (const b of document.querySelectorAll('[data-bv="trait"]')) {
    const on = b.dataset.v === e.trait;
    b.classList.toggle('on', on); b.setAttribute('aria-selected', on);
    if (b.dataset.v === 'cheveux') b.textContent = nomOnglet('cheveux', e.av);      // « Hijab », « Turban » : la couleur du tissu
  }
}

/* ---------- le niveau, puis ses matières ---------- */
function niveau() {
  const annees = ANNEES[e.niveau];
  return `<h1 class="bv-t">Tu es en…</h1>
    <div class="bv-niveaux">${Object.entries(NIVEAUX_PERSO).map(([k, t]) =>
      `<button class="bv-pil${e.niveau === k ? ' on' : ''}" data-bv="niveau" data-v="${k}" aria-pressed="${e.niveau === k}">${t}</button>`).join('')}</div>
    ${annees ? `<div class="bv-annees" data-k="bv:annees:${e.niveau}">${Object.entries(annees).map(([k, t]) =>
      `<button class="bv-mat${e.annee === k ? ' on' : ''}" data-bv="annee" data-v="${k}" aria-pressed="${e.annee === k}">${esc(t)}</button>`).join('')}</div>` : ''}`;
}

/* Toutes les matières montrées : celles du niveau, puis celles qu'on a écrites. */
const toutes = () => { const p = proposees(e.niveau, e.annee); return [...p.cochees, ...p.autres, ...e.ajoutees]; };
const puces = () => toutes().map(m =>
  `<button class="bv-mat${e.matieres.has(m) ? ' on' : ''}" data-bv="matiere" data-v="${esc(m)}" aria-pressed="${e.matieres.has(m)}">${
    e.matieres.has(m) ? svg(I.check) : ''}${esc(m)}</button>`).join('');

function matieres() {
  return `<h1 class="bv-t">Tes matières</h1>
    <div class="bv-mats" id="bvmats">${puces()}</div>
    <div class="bv-ajout"><input id="bvmat" data-bvin="matiere" placeholder="Une autre matière" maxlength="40"
        autocapitalize="sentences" enterkeyhint="done" aria-label="Une autre matière">
      <button class="bv-plus" id="bvplus" data-bv="ajouter" aria-label="Ajouter la matière" disabled>${svg(I.plus)}</button></div>`;
}

/* En arrivant sur ses matières : celles du niveau cochées d'office (et
   celles qu'on avait écrites) ; revenir sans changer de niveau garde ses choix. */
function poserProposees() {
  const k = e.niveau + ':' + e.annee;
  if (e.base === k) return;
  e.base = k;
  e.matieres = new Set([...proposees(e.niveau, e.annee).cochees, ...e.ajoutees]);
}

function ajouter() {
  const n = document.getElementById('bvmat'), r = n && ajouterMatiere(n.value, toutes());
  if (!r) return;
  if (r.nouvelle) e.ajoutees.push(r.nom);
  e.matieres.add(r.nom);
  n.value = '';
  document.getElementById('bvmats').innerHTML = puces();
  document.getElementById('bvplus').disabled = true;
}

function objectif() {
  return `<h1 class="bv-t">Combien de pages par jour&nbsp;?</h1>
    <div class="bv-objectifs">${OBJECTIFS.map(o => `<button class="bv-obj${e.objectif === o.n ? ' on' : ''}" data-bv="objectif"
      data-v="${o.n}"><b>${o.n}</b><span>${o.t}</span></button>`).join('')}</div>`;
}

const ECRANS = { choix, nom, pseudo, visage, niveau, matieres, objectif, attente };

/* Le bouton du bas : « Continuer », ou « C'est parti » à la dernière étape.
   La première étape d'un particulier se choisit par ses deux gros boutons. */
function suite() {
  const k = etapes()[e.etape], dernier = e.etape === etapes().length - 1;
  if (k === 'choix' || k === 'attente') return '';
  const pret = pretEtape(k);
  return `<button class="cta bv-go" id="bvgo" data-bv="suivant" ${pret && !e.envoi ? '' : 'disabled'}>${
    dernier ? 'C’est parti' : 'Continuer'}${svg(I.arrow)}</button>`;
}

/* En tête : le retour (ou le logo à la première étape), le fil de
   l'avancement, « Passer ». Le fil glisse d'une étape à l'autre (avancer). */
export function bienvenueEcran() {
  const l = etapes(), k = l[e.etape];
  $.innerHTML = `<div class="pub bv-pub"><div class="bv" data-etape="${k}">
      <header class="bv-haut">
        ${e.etape > 0 ? `<button class="ic" data-bv="retour" aria-label="Retour">${svg(I.back)}</button>`
          : '<span class="bv-logo"><img src="/site/logo.svg" alt="" width="26" height="28"><span>Mirandola</span></span>'}
        <span class="bv-fil" role="progressbar" aria-label="Avancement" aria-valuemin="1" aria-valuemax="${l.length}"
          aria-valuenow="${e.etape + 1}"><i id="bvfil"></i></span>
        ${k === 'attente' ? '<span></span>' : '<button class="bv-passer" data-bv="passer">Passer</button>'}
      </header>
      <div class="bv-corps" data-k="bv:${k}">${ECRANS[k]()}</div>
      <div class="bv-bas">${suite()}</div>
    </div></div>`;
  avancer('bienvenue', document.getElementById('bvfil'), Math.round((e.etape + 1) / l.length * 100));
  if (k === 'nom') setTimeout(() => { const i = document.getElementById(e.prenom ? 'bvpse' : 'bvpre'); if (i && !e.prenom) i.focus(); }, 80);
  if ((k === 'nom' || k === 'pseudo') && !e.libre && motif(e.pseudo) === 'ok') verifier();
}

/* ---------- la fin : tout ce qu'on a choisi part d'un coup ---------- */
async function poserMatieres() {
  if (!e.matieres.size) return;
  const { liste, retirees } = matieresApres(db.subjects, db.decks, [...e.matieres], COLORS);
  const avant = new Set(db.subjects.map(s => s.id));
  db.subjects = liste;
  save();
  for (const s of liste) if (!avant.has(s.id)) pushSubject(s);
  for (const s of retirees) delSubject(s.id);
}

async function terminer(complet) {
  e.envoi = true; repeint();
  prefs.bienvenue = 1;
  if (complet && e.mode === 'perso') {
    prefs.name = e.prenom.trim(); prefs.goal = e.objectif;
    if (e.niveau) { prefs.niveau = e.niveau; prefs.annee = e.annee || ''; }
    await poserMatieres();
  }
  // le pseudo choisi ; refusé (pris entre-temps, hors ligne), celui d'office reste et l'écran le dit
  if (complet && motif(e.pseudo) === 'ok' && e.pseudo !== actuel()) {
    const r = await changerPseudo(e.pseudo);
    if (r.statut !== 'ok') toast(I.x, message(r.statut));
  }
  await envoyerPrefs();                 // tout de suite : la visite guidée qui suit n'envoie plus rien
  if (complet) await choisirMonJeton(ecrireAvatar(e.av), e.teinte);
  e.envoi = false;
  go(e.mode === 'classe' ? 'classes' : 'home');
  if (e.apres) e.apres();               // le tuto, pour l'un comme pour l'autre
}

/* ---------- les gestes ---------- */
const ACTIONS = {
  'pour-moi': () => { e.etape = 1; repeint(); },
  // par-dessus l'accueil : refermée, on y est encore ; entré, l'élève reprend ici (ui/tuto-porte.js, apresEntree)
  code: () => ouvrirCode('', entre),
  annuler,
  passer: () => terminer(false),
  retour: () => { e.etape = Math.max(0, e.etape - 1); repeint(); },
  suivant: async () => {
    const k = etapes()[e.etape];
    // un pseudo pas encore vérifié l'est avant d'aller plus loin : on ne découvre pas « pris » à la fin
    if ((k === 'nom' || k === 'pseudo') && online && e.pseudo !== actuel() && e.libre !== 'ok') {
      e.envoi = true; poserPseudo();
      const r = await pseudoLibre(e.pseudo);
      e.envoi = false; e.jeton++;
      e.libre = r.statut || 'erreur'; e.suggestion = r.suggestion || '';
      if (!['ok', 'meme', 'hors_ligne'].includes(e.libre)) { poserPseudo(); return; }
    }
    if (e.etape >= etapes().length - 1) return terminer(true);
    e.etape++;
    if (etapes()[e.etape] === 'matieres') poserProposees();
    repeint();
  },
  sug: () => {
    e.pseudo = e.suggestion; e.pseudoTouche = true;
    const p = document.getElementById('bvpse'); if (p) { p.value = e.pseudo; p.focus(); }
    verifier();
  },
  trait: (b) => { e.trait = b.dataset.v; peindreVisage(); },
  av: (b) => { const [k, v] = b.dataset.v.split(':'); e.av = normaliser({ ...e.av, [k]: +v }); peindreVisage(); },
  fond: (b) => { e.teinte = +b.dataset.v; peindreVisage(); },
  niveau: (b) => { if (e.niveau !== b.dataset.v) e.annee = ''; e.niveau = b.dataset.v; repeint(); },
  annee: (b) => { e.annee = b.dataset.v; repeint(); },
  /* une puce se coche sur place : l'écran ne se redessine pas (le champ d'à côté garde son clavier) */
  matiere: (b) => {
    const m = b.dataset.v; e.matieres.has(m) ? e.matieres.delete(m) : e.matieres.add(m);
    const on = e.matieres.has(m);
    b.classList.toggle('on', on); b.setAttribute('aria-pressed', on);
    b.innerHTML = (on ? svg(I.check) : '') + esc(m);
  },
  ajouter,
  objectif: (b) => { e.objectif = +b.dataset.v; repeint(); }
};

document.addEventListener('click', ev => {
  const b = ev.target.closest('[data-bv]');
  if (!b || b.disabled || view.name !== 'bienvenue') return;
  const f = ACTIONS[b.dataset.bv];
  if (!f) return;
  ev.preventDefault();
  f(b);
});

/* La saisie ne repeint pas l'écran (le clavier du téléphone sauterait) : le
   pseudo suit le prénom tant qu'on ne l'a pas touché, le bouton s'allume. */
document.addEventListener('input', ev => {
  const n = ev.target.closest && ev.target.closest('[data-bvin]');
  if (!n || view.name !== 'bienvenue') return;
  if (n.dataset.bvin === 'matiere') { const p = document.getElementById('bvplus'); if (p) p.disabled = !nomMatiere(n.value); return; }
  if (n.dataset.bvin === 'prenom') {
    e.prenom = n.value;
    if (!e.pseudoTouche) {
      const p = proposer(e.prenom);
      if (p !== e.pseudo) {
        e.pseudo = p;
        const c = document.getElementById('bvpse'); if (c) c.value = e.pseudo;
        verifier();
      }
    }
  } else {
    e.pseudoTouche = true;
    const v = saisie(n.value);
    if (n.value !== v) n.value = v;
    if (v !== e.pseudo) { e.pseudo = v; verifier(); }
  }
  poserPseudo();
});

document.addEventListener('keydown', ev => {
  if (ev.key !== 'Enter' || view.name !== 'bienvenue' || !ev.target.closest || !ev.target.closest('[data-bvin]')) return;
  if (ev.target.id === 'bvmat') { ev.preventDefault(); return ajouter(); }
  const b = document.getElementById('bvgo');
  if (b && !b.disabled) { ev.preventDefault(); b.click(); }
  else if (ev.target.id === 'bvpre') { ev.preventDefault(); document.getElementById('bvpse')?.focus(); }
});

