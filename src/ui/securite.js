// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { I, svg } from '../icones.js';
import { auth, compte, menu, myRole, online, setCompte } from '../data/etat.js';
import { esc } from '../core/coeur-sync.js';
import {
  changerAdresse, changerMdp, codeReauth, commencerTotp, facteurs, retirerTotp, validerTotp, verifierCode
} from '../core/compte-auth.js';
import { qrSvg } from '../qr.js';
import { CODE_EMAIL, CODE_TOTP, adresseValide, chiffres, groupes, messageSecurite } from '../securite.js';
import { render } from './bibliotheque.js';
import { atSchool } from './classement.js';
import { PWMIN } from './connexion.js';
import { toast } from './import-cartes.js';
import { closeMenu, mountMenu, paintMenu } from './menus-a.js';
import './securite.css';

/* ══════════ « Sécurité du compte » (2026-11-02) ══════════
   Chargée par sa porte (ui/securite-porte.js). Une feuille, quatre étapes :
   - l'accueil : l'adresse, le mot de passe, la vérification en deux étapes ;
   - le mot de passe : le nouveau (le gestionnaire de mots de passe le
     propose et le garde : `new-password`, l'identifiant caché à côté) ; si
     la session date de plus de 24 h, Supabase demande le code envoyé par
     e-mail (« Reauthentication ») avant de l'accepter ;
   - l'adresse : la nouvelle, puis un code à chacune des deux (« Secure email
     change ») — rien ne change avant le second ;
   - la vérification en deux étapes : le QR code à lire avec une application
     d'authentification (ou à poser dans le Trousseau, 1Password, Bitwarden…
     par le lien `otpauth://`), son premier code, puis « Activée » ; la
     désactiver se confirme en deux appuis.
   Les e-mails d'alerte (mot de passe, adresse, vérification ajoutée ou
   retirée) partent de Supabase, pas d'ici. Rien ne se repeint pendant la
   frappe : la ligne d'erreur et le bouton changent sur place. */

const s = { etape: 'accueil', facteurs: null, totp: null, erreur: '', envoi: false, mdp: '', nouvelle: '', faits: {}, arme: false };

// un élève d'établissement : son adresse est celle que le référent a donnée (verrouillée en base)
const adresseFixe = () => myRole === 'eleve' && atSchool();

export function preparer(etape) {
  Object.assign(s, { etape, totp: null, erreur: '', envoi: false, mdp: '', nouvelle: '', faits: {}, arme: false });
  lireFacteurs();
}

function lireFacteurs() {
  facteurs().then(f => { s.facteurs = f; repeindre(); }, () => { s.facteurs = s.facteurs || []; repeindre(); });
}

const actif = () => (s.facteurs || []).find(f => f.status === 'verified');
const repeindre = () => { if (menu === 'secu') paintMenu(); };
const aller = etape => { Object.assign(s, { etape, erreur: '', envoi: false }); repeindre(); };

function dire(msg) {
  s.erreur = msg;
  const n = document.getElementById('sce'); if (n) n.textContent = msg;
}

const ligneErreur = () => `<p class="sc-e" id="sce" aria-live="polite">${esc(s.erreur)}</p>`;
const ok = (libelle, id = 'scok') => `<button class="cta sc-ok" id="${id}" type="submit" ${s.envoi ? 'disabled' : ''}>${s.envoi ? 'Un instant…' : libelle}</button>`;
const retour = () => '<button class="lnk sc-ret" data-sc="accueil" type="button">Retour</button>';
const codeChamp = (id, n, label) => `<input id="${id}" class="sc-code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]*"
    maxlength="${n}" placeholder="${'•'.repeat(n)}" aria-label="${esc(label)}">`;

/* ---------- les étapes ---------- */
function accueilHtml() {
  const etat = s.facteurs === null ? '…' : actif() ? 'Activée' : 'Désactivée';
  return `<div class="mhd">${svg(I.lock)}<span class="mhx"><b>Sécurité du compte</b></span></div>
    <button class="mi sc-l" data-sc="adresse">${svg(I.mail)}<span>Adresse e-mail</span><i>${esc(auth.email || '')}</i>${svg(I.arrow)}</button>
    <button class="mi sc-l" data-sc="mdp">${svg(I.key)}<span>Mot de passe</span>${svg(I.arrow)}</button>
    <button class="mi sc-l" data-sc="deux">${svg(I.check)}<span>Vérification en deux étapes</span><i class="${actif() ? 'sc-on' : ''}">${etat}</i>${svg(I.arrow)}</button>`;
}

function mdpHtml() {
  if (s.etape === 'mdp-code') {
    return `<div class="mhd">${svg(I.key)}<span class="mhx"><b>Confirme que c’est toi</b><i>Code à ${CODE_EMAIL} chiffres envoyé à ${esc(auth.email || '')}</i></span></div>
      <form class="sc-f" id="scf" data-f="mdp-code" autocomplete="on" novalidate>
        ${codeChamp('scc', CODE_EMAIL, 'Code reçu par e-mail')}
        ${ligneErreur()}${ok('Changer le mot de passe')}
      </form>${retour()}`;
  }
  return `<div class="mhd">${svg(I.key)}<span class="mhx"><b>Nouveau mot de passe</b><i>${PWMIN} caractères au moins</i></span></div>
    <form class="sc-f" id="scf" data-f="mdp" autocomplete="on" novalidate>
      <input type="email" name="email" value="${esc(auth.email || '')}" autocomplete="username" hidden readonly>
      <div class="sc-champ">${svg(I.lock)}<input id="scp" name="new-password" type="password" autocomplete="new-password"
        minlength="${PWMIN}" passwordrules="minlength: ${PWMIN}; maxlength: 72;" placeholder="Nouveau mot de passe"
        autocapitalize="none" autocorrect="off" spellcheck="false" aria-label="Nouveau mot de passe">
        <button type="button" class="peek" data-sc="voir" aria-label="Afficher">${svg(I.eye)}</button></div>
      ${ligneErreur()}${ok('Changer le mot de passe')}
    </form>${retour()}`;
}

function adresseHtml() {
  if (adresseFixe()) {
    return `<div class="mhd">${svg(I.mail)}<span class="mhx"><b>Adresse e-mail</b><i>${esc(auth.email || '')}</i></span></div>
      <p class="sc-p">${svg(I.school)}<span>Ton établissement gère ton adresse : pour la changer, demande au référent.</span></p>${retour()}`;
  }
  if (s.etape === 'adresse-code') {
    const ligne = (cle, adr) => `<label class="sc-dbl ${s.faits[cle] ? 'fait' : ''}"><span>Code reçu à <b>${esc(adr)}</b></span>
      ${s.faits[cle] ? `<i>${svg(I.check)}Confirmé</i>` : codeChamp('scc-' + cle, CODE_EMAIL, 'Code reçu à ' + adr)}</label>`;
    return `<div class="mhd">${svg(I.mail)}<span class="mhx"><b>Deux codes à taper</b><i>Rien ne change avant le second</i></span></div>
      <form class="sc-f" id="scf" data-f="adresse-code" autocomplete="off" novalidate>
        ${ligne('nouvelle', s.nouvelle)}${ligne('ancienne', auth.email || '')}
        ${ligneErreur()}${ok('Confirmer')}
      </form>${retour()}`;
  }
  return `<div class="mhd">${svg(I.mail)}<span class="mhx"><b>Nouvelle adresse e-mail</b><i>Aujourd’hui : ${esc(auth.email || '')}</i></span></div>
    <form class="sc-f" id="scf" data-f="adresse" autocomplete="on" novalidate>
      <div class="sc-champ">${svg(I.mail)}<input id="sca" name="email" type="email" autocomplete="email" placeholder="Nouvelle adresse"
        value="${esc(s.nouvelle)}" autocapitalize="none" autocorrect="off" spellcheck="false" aria-label="Nouvelle adresse e-mail"></div>
      ${ligneErreur()}${ok('Recevoir les codes')}
    </form>${retour()}`;
}

function deuxHtml() {
  const tete = `<div class="mhd">${svg(I.check)}<span class="mhx"><b>Vérification en deux étapes</b>
      <i>${actif() ? 'Activée' : 'À chaque nouvelle connexion, un code de ton application en plus du mot de passe'}</i></span></div>`;
  if (s.facteurs === null) return tete + '<p class="sc-p sc-att">…</p>' + retour();
  if (s.totp) return tete + qrHtml() + retour();
  if (actif()) {
    return `${tete}<p class="sc-p">${svg(I.lock)}<span>Ton application d’authentification te sera demandée à chaque nouvelle connexion, jamais à chaque ouverture.</span></p>
      ${ligneErreur()}
      <button class="cta sc-ok sc-non" data-sc="desactiver" type="button" ${s.envoi ? 'disabled' : ''}>${s.arme ? 'Confirmer : désactiver' : 'Désactiver'}</button>${retour()}`;
  }
  return `${tete}<p class="sc-p">${svg(I.key)}<span>Il te faut une application d’authentification : celle de ton gestionnaire de mots de passe (Trousseau iCloud, Google, 1Password, Bitwarden…) ou Google Authenticator, Microsoft Authenticator.</span></p>
    ${ligneErreur()}
    <button class="cta sc-ok" data-sc="activer" type="button" ${s.envoi ? 'disabled' : ''}>${s.envoi ? 'Un instant…' : 'Activer'}</button>${retour()}`;
}

function qrHtml() {
  const t = s.totp.totp || {};
  return `<div class="sc-qr">${qrSvg(t.uri || '', 'QR code de la vérification en deux étapes')}</div>
    <a class="sc-ajout" href="${esc(t.uri || '')}">${svg(I.plus)}Ajouter à mon application</a>
    <p class="sc-cle"><span>Clé à recopier</span><b id="sccle">${esc(groupes(t.secret))}</b>
      <button type="button" class="lnk" data-sc="copier">${svg(I.copy)}Copier</button></p>
    <form class="sc-f" id="scf" data-f="totp" autocomplete="off" novalidate>
      ${codeChamp('scc', CODE_TOTP, 'Code de l’application')}
      ${ligneErreur()}${ok('Activer')}
    </form>`;
}

export function peindre(w) {
  const corps = s.etape.startsWith('mdp') ? mdpHtml() : s.etape.startsWith('adresse') ? adresseHtml()
    : s.etape === 'deux' ? deuxHtml() : accueilHtml();
  w.innerHTML = `<div class="scrim" data-mact="close"></div>
    <div class="menu sc" data-etape="${s.etape}">${corps}</div>`;
  mountMenu(w);
  setTimeout(() => {
    const c = document.querySelector('.sc input:not([hidden]):not([readonly])');
    if (c && document.activeElement !== c && !s.envoi) c.focus();
  }, 80);
}

/* ---------- les gestes ---------- */
async function enAttente(fn) {
  if (!online) { dire('Hors ligne : il faut le réseau.'); return; }
  s.envoi = true;
  const b = document.getElementById('scok'); if (b) { b.disabled = true; b.textContent = 'Un instant…'; }
  try { await fn(); }
  catch (x) {
    s.envoi = false; s.erreur = messageSecurite(x);
    repeindre();
  }
}

/* Chrome et Android gardent le nouveau mot de passe dans leur gestionnaire ;
   Safari et les autres le lisent dans le formulaire (new-password). */
function auCoffre(password) {
  try {
    if (window.PasswordCredential) navigator.credentials.store(new window.PasswordCredential({ id: auth.email, password })).catch(() => {});
  } catch (e) { /* le navigateur refuse : le mot de passe est changé quand même */ }
}

function mdpChange() {
  auCoffre(s.mdp);
  if (compte && compte.provisoire) setCompte({ ...compte, provisoire: false });
  s.mdp = ''; s.envoi = false;
  closeMenu(); toast(I.check, 'Mot de passe changé');
}

const SOUMETTRE = {
  mdp: () => {
    const v = (document.getElementById('scp') || {}).value || '';
    if (v.length < PWMIN) return dire(`${PWMIN} caractères au moins.`);
    s.mdp = v;
    return enAttente(async () => {
      try { await changerMdp(v); }
      catch (x) {
        if (x.code !== 'reauthentication_needed') throw x;
        // la session a plus de 24 h : Supabase envoie un code, et attend qu'on le tape
        await codeReauth();
        s.envoi = false; s.etape = 'mdp-code'; s.erreur = ''; repeindre();
        return;
      }
      mdpChange();
    });
  },
  'mdp-code': () => {
    const code = chiffres((document.getElementById('scc') || {}).value, CODE_EMAIL);
    if (code.length !== CODE_EMAIL) return dire(`Le code a ${CODE_EMAIL} chiffres.`);
    return enAttente(async () => { await changerMdp(s.mdp, code); mdpChange(); });
  },
  adresse: () => {
    const v = ((document.getElementById('sca') || {}).value || '').trim().toLowerCase();
    if (!adresseValide(v)) return dire('Cette adresse e-mail n’est pas valide.');
    if (v === (auth.email || '').toLowerCase()) return dire('C’est déjà ton adresse.');
    s.nouvelle = v;
    return enAttente(async () => {
      await changerAdresse(v);
      Object.assign(s, { envoi: false, etape: 'adresse-code', faits: {}, erreur: '' });
      repeindre();
    });
  },
  'adresse-code': () => {
    const lus = ['nouvelle', 'ancienne'].filter(k => !s.faits[k])
      .map(k => [k, chiffres((document.getElementById('scc-' + k) || {}).value, CODE_EMAIL)])
      .filter(([, c]) => c.length === CODE_EMAIL);
    if (!lus.length) return dire(`Tape un code à ${CODE_EMAIL} chiffres.`);
    return enAttente(async () => {
      for (const [k, code] of lus) {
        const r = await verifierCode('email_change', k === 'nouvelle' ? s.nouvelle : auth.email, code);
        s.faits[k] = true;
        if (r === 'session') {
          s.envoi = false; closeMenu(); render();
          toast(I.check, 'Adresse changée');
          return;
        }
      }
      s.envoi = false; s.erreur = ''; repeindre();
    });
  },
  totp: () => {
    const code = chiffres((document.getElementById('scc') || {}).value, CODE_TOTP);
    if (code.length !== CODE_TOTP) return dire(`Le code a ${CODE_TOTP} chiffres.`);
    return enAttente(async () => {
      await validerTotp(s.totp.id, code);
      s.totp = null; s.envoi = false;
      toast(I.check, 'Vérification en deux étapes activée');
      lireFacteurs();
    });
  }
};

async function activer() {
  if (!online) return dire('Hors ligne : il faut le réseau.');
  s.envoi = true; repeindre();
  try { s.totp = await commencerTotp(); s.envoi = false; s.erreur = ''; }
  catch (x) { s.envoi = false; s.erreur = messageSecurite(x); }
  repeindre();
}

async function desactiver() {
  if (!s.arme) { s.arme = true; repeindre(); setTimeout(() => { if (s.arme) { s.arme = false; repeindre(); } }, 3000); return; }
  if (!online) return dire('Hors ligne : il faut le réseau.');
  s.arme = false; s.envoi = true; repeindre();
  try {
    await retirerTotp(actif().id);
    s.envoi = false;
    toast(I.check, 'Vérification en deux étapes désactivée');
    lireFacteurs();
  } catch (x) { s.envoi = false; s.erreur = messageSecurite(x); repeindre(); }
}

const GESTES = {
  accueil: () => aller('accueil'), mdp: () => aller('mdp'), adresse: () => aller('adresse'), deux: () => aller('deux'),
  activer, desactiver,
  voir: b => {
    const i = document.getElementById('scp'); if (!i) return;
    const on = i.type === 'password'; i.type = on ? 'text' : 'password';
    b.innerHTML = svg(on ? I.eyeoff : I.eye); i.focus();
  },
  copier: () => {
    const t = (s.totp && s.totp.totp && s.totp.totp.secret) || '';
    navigator.clipboard.writeText(t).then(() => toast(I.check, 'Clé copiée'), () => toast(I.x, 'Copie impossible'));
  }
};

document.addEventListener('click', ev => {
  const b = ev.target.closest('[data-sc]');
  if (!b || menu !== 'secu') return;
  const g = GESTES[b.dataset.sc];
  if (g) g(b);
});

document.addEventListener('submit', ev => {
  if (ev.target.id !== 'scf' || menu !== 'secu') return;
  ev.preventDefault();
  if (s.envoi) return;
  const f = SOUMETTRE[ev.target.dataset.f];
  if (f) f();
});

// un code complet part tout seul (sauf les deux codes d'un changement d'adresse : on valide les deux)
document.addEventListener('input', ev => {
  const c = ev.target;
  if (!c.classList || !c.classList.contains('sc-code')) return;
  const n = +c.maxLength || CODE_EMAIL, v = chiffres(c.value, n);
  if (v !== c.value) c.value = v;
  if (s.erreur) dire('');
  if (v.length === n && !s.envoi && c.id === 'scc') document.getElementById('scf').requestSubmit();
});
