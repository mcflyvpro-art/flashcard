// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { I, svg } from '../icones.js';
import { SITE } from '../adresse.js';
import { auth, cercle, compte, friends, me, menu, setAnimate, setMenu, view, visuels } from '../data/etat.js';
import { go, monIdent, render } from './bibliotheque.js';
import { esc } from '../core/coeur-sync.js';
import {
  creerClub, exclureMembre, modifierClub, nouveauCodeClub, quitterClub
} from '../core/cercle.js';
import { codeClubLisible, deviseValide, lienClub, nomClubValide } from '../club.js';
import { COULEURS, couleurDe, embleme, rangCouleur, teinte } from '../jeton.js';
import { auHasard, avatarDe, avatarDeCle, ecrireAvatar } from '../avatar.js';
import { choisirMonJeton } from '../core/visuels.js';
import { avatar, blasonClub, grilleCouleurs, grilleEmblemes, grilleTrait, iconeEmbleme, ongletsAvatar } from './jeton.js';
import { isPupil } from './classement.js';
import { clubOuvert, clubPull } from './club-porte.js';
import { toast } from './import-cartes.js';
import { closeMenu, mountMenu, openMenu } from './menus-a.js';
import { askFriend } from '../core/reglages-corbeille.js';
import { ouvrirPseudo } from './pseudo-porte.js';
import './cercle-feuilles.css';

/* ══════════ les feuilles du cercle, et ses gestes ══════════
   Une seule entrée `cc` dans la table des menus (menus-a.js) ; laquelle
   s'affiche, c'est `cercle.feuille`. Un seul écouteur `[data-cc]` sur le
   document, comme l'espace professeur (`[data-pf]`) et « Mes classes »
   (`[data-el]`). Les champs ne repeignent jamais la feuille où l'on tape :
   ils mettent à jour, sur place, ce qui dépend d'eux. */

const ouvrir = f => { cercle.feuille = f; openMenu('cc'); };
const repeint = () => { setAnimate(false); render(); };
const tete = (ic, titre, sous) => `<div class="mhd">${ic}<span class="mhx"><b>${titre}</b>${sous || ''}</span></div>`;
const coque = corps => `<div class="scrim" data-mact="close"></div><div class="menu cc-f">${corps}</div>`;

/* ---------- entrer dans une partie en direct ---------- */
/* ---------- créer, personnaliser un club ---------- */
function apercuClub(f) {
  return `<div class="cf-apercu" id="cfap" style="--k:${teinte(f.teinte)}"><i class="jt groupe club lg" id="cfapj">${iconeEmbleme(f.embleme)}</i>
    <span><b id="cfapn">${esc(f.nom.trim() || 'Nom du club')}</b><i id="cfapd">${esc(f.devise.trim())}</i></span></div>`;
}

function feuilleForm() {
  const f = cercle.form, edit = !!f.id;
  return coque(`${tete(svg(edit ? I.pen : I.plus), edit ? 'Personnaliser' : 'Nouveau club')}
    ${apercuClub(f)}
    <div class="cf-champs"><input data-ccin="nom" maxlength="40" value="${esc(f.nom)}" placeholder="Nom du club"
      autocomplete="off" spellcheck="false" aria-label="Nom du club">
    <input data-ccin="devise" maxlength="90" value="${esc(f.devise)}" placeholder="Devise (facultatif)" autocomplete="off"
      aria-label="Devise"></div>
    <div class="cf-pick">${grilleEmblemes(embleme(f.embleme), 'data-cc="emb" data-id')}</div>
    <div class="cf-pick">${grilleCouleurs(+f.teinte || 0, 'data-cc="teinte" data-id')}</div>
    <button class="cta" data-cc="form-ok" id="cfok" ${nomClubValide(f.nom) && !cercle.envoi ? '' : 'disabled'}>${edit ? 'Enregistrer' : 'Créer le club'}</button>`);
}

async function validerForm() {
  const f = cercle.form;
  if (!nomClubValide(f.nom) || !deviseValide(f.devise) || cercle.envoi) return;
  const champs = { nom: f.nom.replace(/\s+/g, ' ').trim(), devise: f.devise.trim(), embleme: embleme(f.embleme), teinte: +f.teinte || 0 };
  cercle.envoi = true;
  const id = f.id ? (await modifierClub(f.id, champs) ? f.id : null) : await creerClub(champs);
  cercle.envoi = false;
  if (!id) return peindre();
  closeMenu(); cercle.form = null;
  if (view.name === 'club' && view.id === id) return repeint();
  cercle.onglet = 'defis'; clubPull(id); go('club', id);
}

/* ---------- rejoindre un club avec son code ---------- */
/* ---------- inviter ---------- */
function feuilleInviter() {
  const g = clubOuvert(); if (!g) { setMenu(null); return ''; }
  const lien = lienClub(SITE, g.code);
  return coque(`${tete(blasonClub(g, 'sm'), esc(g.nom))}
    <div class="cf-invit"><div class="cf-qr" id="cfqr" data-lien="${esc(lien)}" data-titre="${esc('Rejoindre ' + g.nom)}"></div>
      <div class="cf-code"><b>${esc(codeClubLisible(g.code))}</b></div></div>
    <button class="mi" data-cc="club-copier">${svg(I.copy)}Copier</button>
    <button class="mi" data-cc="club-partager">${svg(I.share)}Partager</button>
    ${g.chef ? `<button class="mi" data-cc="club-code-neuf">${svg(I.refresh)}<span>Nouveau code</span></button>` : ''}`);
}

/* ---------- les options d'un club ---------- */
function feuilleMenuClub() {
  const g = clubOuvert(); if (!g) { setMenu(null); return ''; }
  return coque(`${tete(blasonClub(g, 'sm'), esc(g.nom))}
    ${g.chef ? `<button class="mi" data-cc="club-perso">${svg(I.pen)}Personnaliser</button>` : ''}
    <button class="mi" data-cc="club-inviter">${svg(I.users)}Inviter</button>
    <div class="msep"></div>
    <button class="mi warn" data-cc="club-quitter">${svg(g.chef ? I.trash : I.exit)}<span>${g.chef ? 'Supprimer le club' : 'Quitter le club'}</span></button>`);
}

/* ---------- un membre ---------- */
function gestesMembre(g, m) {
  const ami = (friends || []).some(f => f.id === m.user_id);
  if (m.moi) return '';
  return (m.pseudo && !ami ? `<button class="mi" data-cc="membre-ami">${svg(I.plus)}Ajouter en ami</button>` : '')
    + (ami ? `<div class="mi" style="color:var(--soft)">${svg(I.check)}Ami</div>` : '')
    + (g.chef ? `<button class="mi warn" data-cc="membre-retirer">${svg(I.x)}<span>Retirer du club</span></button>` : '');
}

function feuilleMembre() {
  const g = clubOuvert(), m = g && (cercle.membres[g.id] || []).find(x => x.user_id === cercle.membre);
  if (!m) { setMenu(null); return ''; }
  const pct = m.pages ? Math.round(m.justes / m.pages * 100) : 0;
  return coque(`${tete(avatar(m.user_id, m.pseudo || m.nom, 'lg'), esc(m.nom) + (m.chef ? ' ' + svg(I.crown) : ''),
      m.pseudo ? `<i>@${esc(m.pseudo)}</i>` : '')}
    <div class="cf-stats"><span title="Cartes révisées cette semaine">${svg(I.book)}<b>${m.pages}</b></span>
      <span title="Réponses justes">${svg(I.check)}<b>${pct} %</b></span><span title="Jours de révision">${svg(I.cal)}<b>${m.jours}</b></span></div>
    ${gestesMembre(g, m)}`);
}

/* ---------- mon jeton ----------
   Mon avatar (ou mes initiales) et ma couleur : un visage dessiné qu'on
   compose trait par trait (src/avatar.js), chaque choix montré sur le visage
   lui-même, d'un appui. Le jeton change aussitôt partout à l'écran, la base
   suit. Le pseudo s'édite à part, dans sa feuille (ui/pseudo-porte.js) ; un
   élève de classe en a un aussi, sous son nom de classe qui, lui, ne bouge
   pas (2026-10-27). */
const monNom = () => (compte && compte.nom) || (me && (me.handle || me.name)) || '?';
const monChoix = () => visuels['p:' + auth.uid] || {};
const maTeinte = () => { const v = monChoix(); return v.teinte != null ? v.teinte : rangCouleur(auth.uid); };
// l'avatar qu'on modifie : le sien, ou, la première fois, celui que tire son identifiant
const monAvatar = () => avatarDeCle(monChoix().cle) || avatarDe(auth.uid);

function feuilleMoi() {
  const v = monChoix(), eleve = isPupil(), trait = cercle.trait || 'coiffure';
  return coque(`<div class="jt-apercu">${avatar(auth.uid, monIdent(), 'xl')}
      ${eleve ? `<b>${esc(monNom())}</b>` : ''}<button class="jt-pseudo" data-cc="pseudo">${
        me && me.handle ? '@' + esc(me.handle) : 'Mon pseudo'}${svg(I.pen)}</button></div>
    <div class="av-barre">
      <button class="av-b" data-cc="av-hasard">${svg(I.shuffle)}Au hasard</button>
      <button class="av-b${v.cle ? '' : ' on'}" data-cc="av-init" aria-pressed="${!v.cle}"><b>Aa</b>Initiales</button>
    </div>
    ${ongletsAvatar(monAvatar(), trait, 'data-cc="av-trait" data-id')}
    <div class="cf-pick">${trait === 'fond'
      ? grilleCouleurs(maTeinte(), 'data-cc="couleur" data-id')
      : grilleTrait(monAvatar(), trait, couleurDe(auth.uid, maTeinte()), 'data-cc="av" data-id', !!v.cle)}</div>`);
}

const FEUILLES = { moi: feuilleMoi, 'club-form': feuilleForm, 'club-inviter': feuilleInviter,
  'club-menu': feuilleMenuClub, membre: feuilleMembre };

function peindre() { if (menu === 'cc') openMenu('cc'); }

let encodeur = null;

export function paintMenuCercle(w) {
  const f = FEUILLES[cercle.feuille];
  const html = f ? f() : '';
  if (!html) { setMenu(null); return; }
  w.innerHTML = html;
  mountMenu(w);
  /* L'encodeur QR ne sert qu'ici et dans l'espace professeur : il arrive à
     la demande, au lieu de peser sur le démarrage de tout le monde. */
  const qr = document.getElementById('cfqr');
  if (qr) {
    /* l'encodeur gardé : une feuille redessinée (« Nouveau code ») a son QR
       dans le même rendu, sans repasser par un carré vide */
    const dessiner = m => { encodeur = m; if (qr.isConnected) qr.innerHTML = m.qrSvg(qr.dataset.lien, qr.dataset.titre); };
    if (encodeur) dessiner(encodeur);
    else import('../qr.js').then(dessiner).catch(() => { qr.remove(); });   // hors ligne et jamais chargé : le code suffit
  }
}

/* ---------- partager ---------- */
function copier(t, ok) {
  navigator.clipboard.writeText(t).then(() => toast(I.check, ok), () => toast(I.x, 'Copie impossible'));
}

function partagerClub() {
  const g = clubOuvert(); if (!g) return;
  const url = lienClub(SITE, g.code);
  // le code dans le message même : une app installée ne s'ouvre pas d'un lien, on le recopie
  const text = `Rejoins « ${g.nom} » sur Mirandola : code ${codeClubLisible(g.code)}, dans Mes amis › Entrer un code`;
  if (navigator.share) navigator.share({ title: g.nom, text, url }).catch(() => {});   // annulé par l'utilisateur : rien à dire
  else copier(text + ' ' + url, 'Invitation copiée');
}

/* Son pseudo est son code d'ami (2026-11-16) : on le partage avec la place
   où l'entrer ; le lien mène à la page du code (code.html), qui le montre. */
function partagerPseudo() {
  const h = me && me.handle; if (!h) return;
  const u = new URL(SITE); u.search = '?ami=' + h; u.hash = '';
  const text = `Ajoute-moi sur Mirandola : @${h}, dans Mes amis › Entrer un code`;
  if (navigator.share) navigator.share({ title: 'Mirandola', text, url: u.toString() }).catch(() => {});   // annulé : rien à dire
  else copier(text + ' ' + u, 'Invitation copiée');
}

/* Les gestes qui détruisent demandent un second appui (le bouton change de
   texte trois secondes), comme partout ailleurs dans l'app. */
function arme(b, texte) {
  if (b.dataset.arme) return true;
  b.dataset.arme = '1';
  const s = b.querySelector('span'); if (s) s.textContent = texte;
  setTimeout(() => { if (b.isConnected) { delete b.dataset.arme; peindre(); } }, 3000);
  return false;
}

/* Les gestes qui mènent ailleurs (un club, un défi, une partie, un code, un
   profil) restent à la porte, ui/cercle-feuilles-porte.js ; ceux-ci ouvrent
   ou remplissent une feuille. */
const ACTIONS = {
  'club-creer': () => { cercle.form = { nom: '', devise: '', embleme: 'livre', teinte: Math.floor(Math.random() * COULEURS.length) }; ouvrir('club-form'); },
  'club-perso': () => {
    const g = clubOuvert(); if (!g) return;
    cercle.form = { id: g.id, nom: g.nom, devise: g.devise || '', embleme: g.embleme, teinte: g.teinte };
    ouvrir('club-form');
  },
  'club-inviter': () => ouvrir('club-inviter'),
  'club-menu': () => ouvrir('club-menu'),
  'club-copier': () => { const g = clubOuvert(); if (g) copier(codeClubLisible(g.code), 'Code copié'); },
  'club-partager': () => partagerClub(),
  'ami-partager': () => partagerPseudo(),
  'club-code-neuf': async (id, b) => {
    if (!arme(b, 'Confirmer : l’ancien ne marchera plus')) return;
    const g = clubOuvert(); if (!g) return;
    await nouveauCodeClub(g.id); peindre(); repeint();
  },
  'club-quitter': (id, b) => {
    const g = clubOuvert(); if (!g) return;
    if (!arme(b, g.chef ? 'Confirmer : supprimer pour tous' : 'Confirmer : quitter')) return;
    return quitterClub(g.id, g.chef);
  },
  'membre-ami': async () => {
    const g = clubOuvert(), m = g && (cercle.membres[g.id] || []).find(x => x.user_id === cercle.membre);
    if (m && m.pseudo && await askFriend(m.pseudo)) closeMenu();
  },
  'membre-retirer': (id, b) => {
    const g = clubOuvert(); if (!g || !arme(b, 'Confirmer : retirer')) return;
    return exclureMembre(g.id, cercle.membre);
  },
  emb: k => {
    cercle.form.embleme = k;
    document.querySelectorAll('[data-cc="emb"]').forEach(x => x.classList.toggle('on', x.dataset.id === k));
    const ap = document.getElementById('cfapj'); if (ap) ap.innerHTML = iconeEmbleme(k);
  },
  teinte: i => {
    cercle.form.teinte = +i;
    document.querySelectorAll('[data-cc="teinte"]').forEach(x => x.classList.toggle('on', x.dataset.id === String(i)));
    const ap = document.getElementById('cfap'); if (ap) ap.style.setProperty('--k', teinte(i));
  },
  moi: () => ouvrir('moi'),
  pseudo: () => ouvrirPseudo(),
  'av-trait': k => { cercle.trait = k; peindre(); },
  av: id => {
    const [trait, k] = String(id).split(':'), a = monAvatar();
    a[trait] = +k;
    choisirMonJeton(ecrireAvatar(a), maTeinte()); peindre();
  },
  'av-hasard': () => { choisirMonJeton(ecrireAvatar(auHasard()), maTeinte()); peindre(); },
  'av-init': () => { choisirMonJeton(null, maTeinte()); peindre(); },
  couleur: i => { choisirMonJeton(monChoix().cle || null, +i); peindre(); },
  'form-ok': () => validerForm()
};

/* le geste qui a fait venir le morceau, rejoué par la porte ; ensuite,
   l'écouteur d'ici prend les suivants */
export function agir(b) {
  const f = ACTIONS[b.dataset.cc];
  if (f) f(b.dataset.id, b);
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-cc]');
  if (!b || b.disabled) return;
  const f = ACTIONS[b.dataset.cc];
  if (!f) return;
  e.preventDefault();
  f(b.dataset.id, b);
});

const desactiver = (id, non) => { const b = document.getElementById(id); if (b) b.disabled = non; };

function saisieClub(k, n) {
  if (!cercle.form) return;
  cercle.form[k] = n.value;
  const t = document.getElementById(k === 'nom' ? 'cfapn' : 'cfapd');
  if (t) t.textContent = n.value.trim() || (k === 'nom' ? 'Nom du club' : '');
  desactiver('cfok', !nomClubValide(cercle.form.nom));
}

document.addEventListener('input', e => {
  const n = e.target.closest('[data-ccin]'); if (!n) return;
  const k = n.dataset.ccin;
  return saisieClub(k, n);
});
