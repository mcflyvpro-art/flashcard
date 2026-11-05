// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { $ } from '../racine.js';
import { I, svg } from '../icones.js';
import { auth, compte, online, setCompte } from '../data/etat.js';
import { esc } from '../core/coeur-sync.js';
import { changerMdp, codeReauth } from '../core/compte-auth.js';
import { CODE_EMAIL, chiffres, messageSecurite } from '../securite.js';
import { render } from './bibliotheque.js';
import { PWMIN, pubTete } from './connexion.js';
import { toast } from './import-cartes.js';
import { maybeTuto } from './tuto-porte.js';
import { etatMdp, mdpAChoisir } from './mdp-porte.js';
import { repeindreEnGardant } from './garde-saisie.js';

/* ══════════ « Choisis ton mot de passe » (2026-10-29) ══════════
   L'écran lui-même, chargé à la demande par sa porte, ui/mdp-porte.js (qui
   dit quand il le faut) : il ne sert qu'une fois par compte. Rien d'autre
   ne doit importer ce fichier. */

let erreur = '', envoi = false;
/* La session a plus de 24 h (réglage « Secure password change ») : Supabase
   envoie un code à l'adresse du compte et l'attend avec le mot de passe. */
let reauth = false, memo = '';

export function mdpView() {
  // un render() de fond repeint aussi cet écran : ce qu'on tape reste (ui/garde-saisie.js)
  const garde = repeindreEnGardant($, `<div class="pub pub-connexion">
    ${pubTete(false)}
    <div class="pub-duo"><div class="login">
      <h1 class="lt">${etatMdp.recuperation ? 'Choisis un nouveau mot de passe.' : 'Choisis ton mot de passe.'}</h1>
      <p class="lsub">${esc(auth.email || '')}</p>
      <form class="lf" id="mdpf" autocomplete="on">
        <input type="email" value="${esc(auth.email || '')}" autocomplete="username" hidden readonly>
        ${reauth ? '' : `<div class="lrow">${svg(I.lock)}
          <input id="mdp1" type="password" placeholder="Nouveau mot de passe" autocomplete="new-password"
            autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="next" aria-label="Nouveau mot de passe"></div>
        <div class="lrow">${svg(I.lock)}
          <input id="mdp2" type="password" placeholder="Encore une fois" autocomplete="new-password"
            autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="go" aria-label="Encore une fois"></div>`}
        ${reauth ? `<p class="lsub">Pour confirmer, tape le code à ${CODE_EMAIL} chiffres envoyé à ton adresse.</p>
        <div class="lrow">${svg(I.mail)}<input id="mdpc" inputmode="numeric" autocomplete="one-time-code" maxlength="${CODE_EMAIL}"
          placeholder="Code reçu par e-mail" aria-label="Code reçu par e-mail"></div>` : ''}
        <div class="lerr" id="mdpe">${esc(erreur)}</div>
        <button class="cta" id="mdpgo" type="submit" ${envoi ? 'disabled' : ''}>${envoi ? 'Enregistrement…' : 'Enregistrer'}${svg(I.arrow)}</button>
      </form>
      <button class="lnk" data-act="logout" type="button">Se déconnecter</button>
    </div></div>
  </div>`, ['mdp1', 'mdp2', 'mdpc']);
  // le curseur d'arrivée, jamais pris à un champ où l'on tape déjà
  if (!envoi && !garde) {
    setTimeout(() => {
      const a = document.activeElement;
      if (!(a && a.tagName === 'INPUT')) document.getElementById(reauth ? 'mdpc' : 'mdp1')?.focus();
    }, 80);
  }
}

/* Ce que Supabase Auth répond, en clair (src/securite.js). */
function messageDe(x) {
  if (x && x.code === 'same_password') return 'Choisis un mot de passe différent de celui qu’on t’a donné';
  return messageSecurite(x);
}

// ce qui manque avant d'envoyer ; rien si tout y est
function manque(pw, nonce, b) {
  if (reauth && nonce.length !== CODE_EMAIL) return `Le code a ${CODE_EMAIL} chiffres`;
  if (pw.length < PWMIN) return `${PWMIN} caractères au moins`;
  if (!reauth && pw !== ((b && b.value) || '')) return 'Les deux ne sont pas pareils';
  return online ? '' : 'Hors ligne : il faut le réseau pour changer de mot de passe';
}

// rend false quand Supabase attend d'abord le code envoyé par e-mail (l'écran le demande)
async function envoyer(pw, nonce) {
  try { await changerMdp(pw, nonce || undefined); return true; }
  catch (x) {
    if (x.code !== 'reauthentication_needed') throw x;
    await codeReauth();
    reauth = true; memo = pw; envoi = false; erreur = '';
    mdpView();
    return false;
  }
}

async function enregistrer() {
  const a = document.getElementById('mdp1'), b = document.getElementById('mdp2'), e = document.getElementById('mdpe');
  const pw = (a && a.value) || memo;
  const nonce = reauth ? chiffres((document.getElementById('mdpc') || {}).value, CODE_EMAIL) : '';
  const m = manque(pw, nonce, b);
  if (m) { e.textContent = m; return; }
  envoi = true; erreur = ''; mdpView();
  try {
    if (!(await envoyer(pw, nonce))) return;
    if (compte) setCompte({ ...compte, provisoire: false });
    envoi = false; reauth = false; memo = ''; etatMdp.recuperation = false;
    toast(I.check, 'Mot de passe enregistré');
    render();
    maybeTuto(Promise.resolve());          // le tuto attendait que le compte soit à lui
  } catch (x) {
    envoi = false; erreur = messageDe(x);
    mdpView();
  }
}

document.addEventListener('submit', e => {
  if (e.target.id !== 'mdpf' || !mdpAChoisir()) return;
  e.preventDefault();
  if (!envoi) enregistrer();
});
