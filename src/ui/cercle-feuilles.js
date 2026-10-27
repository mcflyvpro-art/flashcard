// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { I, svg } from '../icones.js';
import { SITE } from '../adresse.js';
import { auth, cercle, compte, friends, me, menu, setAnimate, setMenu, view, visuels } from '../data/etat.js';
import { go, monIdent, render } from './bibliotheque.js';
import { esc } from '../core/coeur-sync.js';
import {
  clubsPull, creerClub, exclureMembre, modifierClub, nouveauCodeClub, quitterClub, rejoindreClub, rejoindreSalle
} from '../core/cercle.js';
import { codeClubDepuisTexte, codeClubLisible, deviseValide, lienClub, nomClubValide } from '../club.js';
import { COULEURS, couleurDe, embleme, rangCouleur, teinte } from '../jeton.js';
import { avatarDe, avatarDeCle, ecrireAvatar } from '../avatar.js';
import { choisirMonJeton } from '../core/visuels.js';
import { messageSalle, pinComplet, pinDepuisTexte, pinLisible } from '../defi.js';
import { avatar, blasonClub, grilleCouleurs, grilleEmblemes, grilleTrait, iconeEmbleme } from './jeton.js';
import { isPupil } from './classement.js';
import { clubOuvert, clubPull } from './club.js';
import { ouvrirProfil } from './cercle.js';
import { ACTIONS_DEFI, ouvrirDefi } from './defi-nouveau.js';
import { ouvrirDirect } from './direct-porte.js';
import { toast } from './import-cartes.js';
import { closeMenu, mountMenu, openMenu } from './menus-a.js';
import { askFriend } from '../core/reglages-corbeille.js';

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
function feuillePin() {
  return coque(`${tete(svg(I.hash), 'Code de la partie')}
    <form class="cc-pinf" id="ccpinf" autocomplete="off">
      <input class="cc-pin" id="ccpin" data-ccin="pin" inputmode="numeric" pattern="[0-9 ]*" enterkeyhint="go"
        placeholder="000 000" maxlength="7" value="${esc(pinLisible(cercle.code))}" aria-label="Code de la partie">
      <p class="cc-rep${cercle.reponse ? ' ko' : ''}" id="ccrep">${esc(cercle.reponse ? messageSalle(cercle.reponse) || '' : '')}</p>
      <button class="cta" data-cc="pin-ok" id="ccpingo" ${pinComplet(cercle.code) && !cercle.envoi ? '' : 'disabled'}>Entrer</button>
    </form>`);
}

async function entrerPin() {
  const p = pinDepuisTexte(cercle.code);
  if (!pinComplet(p) || cercle.envoi) return;
  cercle.envoi = true; peindre();
  const r = await rejoindreSalle(p);
  cercle.envoi = false;
  if (r.statut === 'ok' || r.statut === 'hote') { cercle.code = ''; cercle.reponse = null; closeMenu(); return ouvrirDirect(r.salle); }
  cercle.reponse = r.statut; peindre();
}

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
function feuilleCode() {
  const k = codeClubDepuisTexte(cercle.code);
  return coque(`${tete(svg(I.users), 'Code du club')}
    <form class="cc-pinf" id="cccodef" autocomplete="off">
      <input class="cc-pin code" id="cccode" data-ccin="code" autocapitalize="characters" autocorrect="off" spellcheck="false"
        enterkeyhint="go" placeholder="XXXX-XXXX" maxlength="40" value="${esc(codeClubLisible(k))}" aria-label="Code du club">
      <p class="cc-rep" id="ccrep"></p>
      <button class="cta" data-cc="code-ok" id="cccodego" ${k.length >= 5 && !cercle.envoi ? '' : 'disabled'}>Rejoindre</button>
    </form>`);
}

async function entrerCode() {
  const k = codeClubDepuisTexte(cercle.code);
  if (k.length < 5 || cercle.envoi) return;
  cercle.envoi = true; peindre();
  const id = await rejoindreClub(k);
  cercle.envoi = false;
  if (!id) return peindre();
  cercle.code = ''; closeMenu(); cercle.onglet = 'defis'; clubPull(id); go('club', id);
}

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
    <div class="cf-stats"><span title="Pages lues cette semaine">${svg(I.book)}<b>${m.pages}</b></span>
      <span title="Réponses justes">${svg(I.check)}<b>${pct} %</b></span><span title="Jours de lecture">${svg(I.cal)}<b>${m.jours}</b></span></div>
    ${gestesMembre(g, m)}`);
}

/* ---------- mon jeton ----------
   Mon avatar (ou mes initiales) et ma couleur : un visage dessiné qu'on
   compose trait par trait (src/avatar.js), chaque choix montré sur le visage
   lui-même, d'un appui. Le jeton change aussitôt partout à l'écran, la base
   suit. Le pseudo s'édite à part (un élève de classe n'en a pas : son nom est
   celui que tient son professeur). */
const monNom = () => (compte && compte.nom) || (me && (me.handle || me.name)) || '?';
const monChoix = () => visuels['p:' + auth.uid] || {};
const maTeinte = () => { const v = monChoix(); return v.teinte != null ? v.teinte : rangCouleur(auth.uid); };
// l'avatar qu'on modifie : le sien, ou, la première fois, celui que tire son identifiant
const monAvatar = () => avatarDeCle(monChoix().cle) || avatarDe(auth.uid);
const ONGLETS_AV = { coiffure: 'Coiffure', cheveux: 'Cheveux', peau: 'Peau', yeux: 'Yeux', bouche: 'Bouche',
  accessoire: 'Accessoire', haut: 'Haut', fond: 'Fond' };

function feuilleMoi() {
  const v = monChoix(), eleve = isPupil(), trait = cercle.trait || 'coiffure';
  return coque(`<div class="jt-apercu">${avatar(auth.uid, monIdent(), 'xl')}
      ${eleve ? `<b>${esc(monNom())}</b>` : `<button class="jt-pseudo" data-act="handle">${
        me && me.handle ? '@' + esc(me.handle) : 'Choisis ton pseudo'}${svg(I.pen)}</button>`}</div>
    <div class="av-barre">
      <button class="av-b" data-cc="av-hasard">${svg(I.shuffle)}Au hasard</button>
      <button class="av-b${v.cle ? '' : ' on'}" data-cc="av-init" aria-pressed="${!v.cle}"><b>Aa</b>Initiales</button>
    </div>
    <div class="av-traits" role="tablist">${Object.entries(ONGLETS_AV).map(([k, n]) =>
      `<button role="tab" class="${trait === k ? 'on' : ''}" aria-selected="${trait === k}" data-cc="av-trait" data-id="${k}">${n}</button>`).join('')}</div>
    <div class="cf-pick">${trait === 'fond'
      ? grilleCouleurs(maTeinte(), 'data-cc="couleur" data-id')
      : grilleTrait(monAvatar(), trait, couleurDe(auth.uid, maTeinte()), 'data-cc="av" data-id', !!v.cle)}</div>`);
}

const FEUILLES = { moi: feuilleMoi, pin: feuillePin, 'club-form': feuilleForm, 'club-code': feuilleCode, 'club-inviter': feuilleInviter,
  'club-menu': feuilleMenuClub, membre: feuilleMembre };

function peindre() { if (menu === 'cc') openMenu('cc'); }

export function paintMenuCercle(w) {
  const f = FEUILLES[cercle.feuille];
  const html = f ? f() : '';
  if (!html) { setMenu(null); return; }
  w.innerHTML = html;
  mountMenu(w);
  const champ = document.getElementById({ pin: 'ccpin', 'club-code': 'cccode' }[cercle.feuille]);
  if (champ) setTimeout(() => { champ.focus(); champ.setSelectionRange(champ.value.length, champ.value.length); }, 80);
  /* L'encodeur QR ne sert qu'ici et dans l'espace professeur : il arrive à
     la demande, au lieu de peser sur le démarrage de tout le monde. */
  const qr = document.getElementById('cfqr');
  if (qr) import('../qr.js').then(m => { if (qr.isConnected) qr.innerHTML = m.qrSvg(qr.dataset.lien, qr.dataset.titre); })
    .catch(() => { qr.remove(); });                 // hors ligne et jamais chargé : le code suffit
  for (const id of ['ccpinf', 'cccodef']) {
    const form = document.getElementById(id);
    if (form) form.onsubmit = e => { e.preventDefault(); return id === 'ccpinf' ? entrerPin() : entrerCode(); };
  }
}

/* ---------- partager ---------- */
function copier(t, ok) {
  navigator.clipboard.writeText(t).then(() => toast(I.check, ok), () => toast(I.x, 'Copie impossible'));
}

function partagerClub() {
  const g = clubOuvert(); if (!g) return;
  const url = lienClub(SITE, g.code);
  const text = `Rejoins « ${g.nom} » sur Folio : code ${codeClubLisible(g.code)}`;
  if (navigator.share) navigator.share({ title: g.nom, text, url }).catch(() => {});   // annulé par l'utilisateur : rien à dire
  else copier(url, 'Lien copié');
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

const ACTIONS = {
  ...ACTIONS_DEFI,
  defi: (id, b) => {
    const r = view.name === 'club' ? { name: 'club', id: view.id } : { name: view.name === 'friends' ? 'friends' : 'commu' };
    closeMenu();
    ouvrirDefi({ ou: b.dataset.ou || null, mode: b.dataset.mode || 'direct', livre: b.dataset.livre || null, retour: r });
  },
  pin: () => { cercle.code = ''; cercle.reponse = null; ouvrir('pin'); },
  'pin-ok': () => entrerPin(),
  salle: async (id, b) => {
    if (b.dataset.dedans) return ouvrirDirect(id);
    const r = await rejoindreSalle(b.dataset.pin);
    if (r.statut === 'ok' || r.statut === 'hote') return ouvrirDirect(r.salle);
    toast(I.x, messageSalle(r.statut) || 'Impossible d’entrer');
  },
  tous: () => { cercle.tous = !cercle.tous; repeint(); },
  club: id => { cercle.onglet = 'defis'; clubPull(id); go('club', id); },
  onglet: k => { cercle.onglet = k; const p = document.querySelector('.cl'); if (p) p.dataset.onglet = k;
    document.querySelectorAll('.cl-tabs button').forEach(x => { x.classList.toggle('on', x.dataset.id === k); x.setAttribute('aria-selected', x.dataset.id === k); }); },
  'club-creer': () => { cercle.form = { nom: '', devise: '', embleme: 'livre', teinte: Math.floor(Math.random() * COULEURS.length) }; ouvrir('club-form'); },
  'club-perso': () => {
    const g = clubOuvert(); if (!g) return;
    cercle.form = { id: g.id, nom: g.nom, devise: g.devise || '', embleme: g.embleme, teinte: g.teinte };
    ouvrir('club-form');
  },
  'club-rejoindre': () => { cercle.code = ''; ouvrir('club-code'); },
  'code-ok': () => entrerCode(),
  'club-inviter': () => ouvrir('club-inviter'),
  'club-menu': () => ouvrir('club-menu'),
  'club-copier': () => { const g = clubOuvert(); if (g) copier(codeClubLisible(g.code), 'Code copié'); },
  'club-partager': () => partagerClub(),
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
  // toucher un membre ouvre son profil ; le chef y retrouve « Retirer du club »
  membre: id => { const g = clubOuvert(); cercle.membre = id; ouvrirProfil(id, { club: g && g.id }); },
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
  'av-trait': k => { cercle.trait = k; peindre(); },
  av: id => {
    const [trait, k] = String(id).split(':'), a = monAvatar();
    a[trait] = +k;
    choisirMonJeton(ecrireAvatar(a), maTeinte()); peindre();
  },
  'av-hasard': () => { choisirMonJeton(ecrireAvatar(avatarDe(Math.random())), maTeinte()); peindre(); },
  'av-init': () => { choisirMonJeton(null, maTeinte()); peindre(); },
  couleur: i => { choisirMonJeton(monChoix().cle || null, +i); peindre(); },
  'form-ok': () => validerForm()
};

document.addEventListener('click', e => {
  const b = e.target.closest('[data-cc]');
  if (!b || b.disabled) return;
  const f = ACTIONS[b.dataset.cc];
  if (!f) return;
  e.preventDefault();
  f(b.dataset.id, b);
});

const desactiver = (id, non) => { const b = document.getElementById(id); if (b) b.disabled = non; };

function saisiePin(n) {
  cercle.code = pinDepuisTexte(n.value); cercle.reponse = null;
  const v = pinLisible(cercle.code);
  if (n.value !== v) n.value = v;
  desactiver('ccpingo', !pinComplet(cercle.code));
  const rep = document.getElementById('ccrep'); if (rep) { rep.textContent = ''; rep.classList.remove('ko'); }
  if (pinComplet(cercle.code)) entrerPin();               // six chiffres : on entre sans chercher le bouton
}

function saisieCode(n) {
  cercle.code = n.value;
  const c = codeClubDepuisTexte(n.value), v = codeClubLisible(c);
  if (n.value !== v && /club=/.test(n.value)) n.value = v;   // un lien collé se réduit à son code
  desactiver('cccodego', c.length < 5);
}

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
  if (k === 'pin') return saisiePin(n);
  if (k === 'code') return saisieCode(n);
  return saisieClub(k, n);
});

/* « ?club=CODE » : un lien d'invitation. Sans session, il attend la
   connexion (sessionStorage), comme « ?rejoindre= » pour une classe. */
export function consumeClub(connecte) {
  const p = new URLSearchParams(location.search), brut = p.get('club');
  let k = brut ? codeClubDepuisTexte(brut) : '';
  if (brut) {
    p.delete('club');
    history.replaceState(null, '', location.pathname + (p.toString() ? '?' + p : '') + location.hash);
  }
  try { k = k || sessionStorage.getItem('folio.club') || ''; } catch (e) { /* stockage indisponible : le code ne survivra pas à la connexion */ }
  if (!k) return false;
  try { connecte ? sessionStorage.removeItem('folio.club') : sessionStorage.setItem('folio.club', k); }
  catch (e) { /* idem */ }
  if (!connecte) return false;
  if (cercle.clubs === null) clubsPull();
  cercle.code = codeClubLisible(k);
  go('commu'); ouvrir('club-code');
  return true;
}
