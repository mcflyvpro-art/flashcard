// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { $ } from '../racine.js';
import { repeindreEnGardant } from './garde-saisie.js';
import { I, svg } from '../icones.js';
import { auth, online, setLoginMode } from '../data/etat.js';
import { esc } from '../core/coeur-sync.js';
import { codeConnexion, codeOubli, facteurs, renvoyerCode, validerTotp, verifierCode } from '../core/compte-auth.js';
import { CODE_EMAIL, CODE_TOTP, adresseValide, chiffres, messageSecurite } from '../securite.js';
import { render } from './bibliotheque.js';
import { apresConnexion, pubTete } from './connexion.js';
import { demanderNouveauMdp, etatVerif as e, mfaAFaire } from './mdp-porte.js';
import './verif.css';

/* ══════════ l'écran des codes (2026-11-02) ══════════
   Chargé par sa porte (ui/mdp-porte.js : `verifView`, `ouvrirVerif`) ;
   rien d'autre ne doit importer ce fichier. Quatre chemins, un seul geste
   — taper un code :
   - « inscription » : le compte attend le code reçu à son adresse (une
     adresse qui n'existe pas ne reçoit rien, le compte ne s'ouvre jamais) ;
   - « oubli » : l'adresse, puis le code, puis « Choisis un nouveau mot de
     passe » (ui/mdp.js) ;
   - « code » : se connecter avec un code reçu par e-mail, sans mot de passe ;
   - la vérification en deux étapes : le code de l'application
     d'authentification, une fois par connexion — jamais à chaque ouverture :
     la session reste, et son renouvellement garde le second niveau.
   Les liens des mêmes e-mails mènent au même endroit (ui/liens-entrants.js).
   Le champ ne se repeint jamais pendant la frappe : seules la ligne d'erreur
   et le bouton changent sur place. */

const ATTENTE = 60;                     // Supabase n'envoie pas deux e-mails à la même adresse en moins d'une minute
let minuteur = 0;

const deux = () => mfaAFaire();
const longueur = () => (deux() ? CODE_TOTP : CODE_EMAIL);
const etapeCode = () => deux() || e.mode === 'inscription' || e.etape === 'code';

const TITRES = {
  inscription: 'Vérifie ta boîte mail.', oubli: 'Mot de passe oublié.', code: 'Connexion par code.'
};

function champAdresse() {
  return `<div class="lrow">${svg(I.mail)}
      <input id="vfa" name="email" type="email" placeholder="Adresse e-mail" autocomplete="username" value="${esc(e.email || '')}"
        autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="send" aria-label="Adresse e-mail"></div>`;
}

function champCode() {
  const n = longueur();
  return `<input id="vfc" class="vf-code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]*"
      maxlength="${n}" placeholder="${'•'.repeat(n)}" aria-label="Code à ${n} chiffres" enterkeyhint="go">`;
}

function texte() {
  if (deux()) return `<p class="vf-dit">${svg(I.lock)}<span>Ouvre ton application d’authentification et tape le code à 6 chiffres.</span></p>`;
  if (!etapeCode()) return '';
  return `<p class="vf-dit">${svg(I.mail)}<span>Code à ${CODE_EMAIL} chiffres envoyé à <b>${esc(e.email)}</b>. Regarde aussi les indésirables.</span></p>`;
}

function liens() {
  if (deux()) {
    return `<div class="vf-liens"><button class="lnk" data-act="logout" type="button">Se déconnecter</button></div>
      <p class="vf-aide">Plus accès à ton application&#8239;? Écris à <a href="mailto:contact@mirandola.fr">contact@mirandola.fr</a></p>`;
  }
  const renvoi = etapeCode() ? `<button class="lnk" data-vf="renvoyer" id="vfr" type="button">${libelleRenvoi()}</button>` : '';
  const changer = e.mode === 'inscription'
    ? '<button class="lnk" data-vf="changer" type="button">Changer d’adresse</button>'
    : '<button class="lnk" data-vf="retour" type="button">Retour</button>';
  return `<div class="vf-liens">${renvoi}${changer}</div>`;
}

function bouton() {
  const libelle = e.envoi ? (etapeCode() ? 'Vérification…' : 'Envoi…') : etapeCode() ? 'Valider' : 'Recevoir un code';
  return `<button class="cta" id="vfgo" type="submit" ${e.envoi ? 'disabled' : ''}>${libelle}${svg(I.arrow)}</button>`;
}

export function verifView() {
  const titre = deux() ? 'Code de vérification.' : TITRES[e.mode] || TITRES.code;
  // un render() de fond repeint aussi cet écran : l'adresse ou le code qu'on tape reste (ui/garde-saisie.js)
  repeindreEnGardant($, `<div class="pub pub-connexion">
    ${pubTete(false)}
    <div class="pub-duo"><div class="login vf" data-etape="${deux() ? 'deux' : e.mode + (etapeCode() ? '-code' : '')}">
      <h1 class="lt">${titre}</h1>
      ${deux() ? `<p class="lsub">${esc(auth.email || '')}</p>` : ''}
      ${texte()}
      <form class="lf" id="vff" autocomplete="on" novalidate>
        ${etapeCode() ? `<input type="email" name="email" value="${esc(deux() ? auth.email || '' : e.email)}" autocomplete="username" hidden readonly>${champCode()}`
          : champAdresse()}
        <div class="lerr ${e.info ? 'lok' : ''}" id="vfe" aria-live="polite">${esc(e.erreur || e.info || '')}</div>
        ${bouton()}
      </form>
      ${liens()}
    </div></div>
  </div>`, ['vfa', 'vfc']);
  armerMinuteur();
  setTimeout(() => {
    const c = document.getElementById(etapeCode() ? 'vfc' : 'vfa');
    if (c && document.activeElement !== c && !e.envoi) c.focus();
  }, 80);
}

/* ---------- renvoyer, pas plus d'une fois par minute ---------- */
const reste = () => Math.max(0, Math.ceil(((e.renvoi || 0) - Date.now()) / 1000));
const libelleRenvoi = () => (reste() ? `Renvoyer (${reste()} s)` : 'Renvoyer le code');

function armerMinuteur() {
  clearInterval(minuteur);
  if (!reste()) return;
  minuteur = setInterval(() => {
    const b = document.getElementById('vfr');
    if (!b) { clearInterval(minuteur); return; }
    b.textContent = libelleRenvoi();
    b.disabled = !!reste();
    if (!reste()) clearInterval(minuteur);
  }, 1000);
  const b = document.getElementById('vfr'); if (b) b.disabled = true;
}

function dire(msg, ok) {
  e.erreur = ok ? '' : msg; e.info = ok ? msg : '';
  const n = document.getElementById('vfe');
  if (n) { n.textContent = msg; n.classList.toggle('lok', !!ok); }
}

async function envoyerCode() {
  if (e.mode === 'inscription') return renvoyerCode('signup', e.email);
  if (e.mode === 'oubli') return codeOubli(e.email);
  return codeConnexion(e.email);
}

/* ---------- les gestes ---------- */
async function demander() {
  const a = document.getElementById('vfa');
  e.email = ((a && a.value) || e.email || '').trim();
  if (!adresseValide(e.email)) { dire('Renseigne ton adresse e-mail.'); if (a) a.focus(); return; }
  if (!online) { dire('Hors ligne : il faut le réseau pour recevoir un code.'); return; }
  e.envoi = true; verifView();
  try {
    await envoyerCode();
    Object.assign(e, { envoi: false, etape: 'code', erreur: '', info: '', renvoi: Date.now() + ATTENTE * 1000 });
  } catch (x) { e.envoi = false; e.erreur = messageSecurite(x); }
  verifView();
}

async function renvoyer() {
  if (reste() || e.envoi) return;
  if (!online) { dire('Hors ligne : il faut le réseau pour recevoir un code.'); return; }
  e.renvoi = Date.now() + ATTENTE * 1000;
  armerMinuteur();
  try { await envoyerCode(); dire('Nouveau code envoyé.', true); }
  catch (x) { dire(messageSecurite(x)); }
}

/* La session est ouverte : il peut rester la vérification en deux étapes
   (l'écran se repeint sur elle), sinon la suite de toute connexion. */
function ouverte() {
  e.envoi = false; e.erreur = ''; e.info = '';
  if (auth && auth.mfa) return render();
  return apresConnexion();
}

const TYPES = { inscription: 'signup', oubli: 'recovery', code: 'email' };

async function valider() {
  const c = document.getElementById('vfc'), code = chiffres(c && c.value, longueur());
  if (code.length !== longueur()) { dire(`Le code a ${longueur()} chiffres.`); if (c) c.focus(); return; }
  if (!online) { dire('Hors ligne : il faut le réseau pour vérifier le code.'); return; }
  e.envoi = true;
  const b = document.getElementById('vfgo'); if (b) { b.disabled = true; b.firstChild.textContent = 'Vérification…'; }
  try {
    if (deux()) {
      const f = (await facteurs()).find(x => x.status === 'verified');
      if (!f) throw Object.assign(new Error('aal2'), { code: 'insufficient_aal' });
      await validerTotp(f.id, code);
    } else {
      await verifierCode(TYPES[e.mode] || 'email', e.email, code);
      if (e.mode === 'oubli') demanderNouveauMdp();     // le nouveau mot de passe, une fois tout vérifié (ui/mdp.js)
    }
    await ouverte();
  } catch (x) {
    e.envoi = false;
    if (b && b.isConnected) { b.disabled = false; b.firstChild.textContent = 'Valider'; }
    dire(messageSecurite(x));
    const n = document.getElementById('vfc');            // l'écran a pu être repeint pendant l'attente
    if (n) { n.value = ''; n.focus(); }
  }
}

function quitter(versInscription) {
  e.mode = ''; e.etape = ''; e.erreur = ''; e.info = '';
  setLoginMode(versInscription ? 'up' : 'in');
  render();
}

document.addEventListener('submit', ev => {
  if (ev.target.id !== 'vff') return;
  ev.preventDefault();
  if (e.envoi) return;
  if (etapeCode()) valider(); else demander();
});

// un code complet part tout seul : le collage, le remplissage du clavier (iOS, Android) et la frappe
document.addEventListener('input', ev => {
  if (ev.target.id !== 'vfc') return;
  const v = chiffres(ev.target.value, longueur());
  if (v !== ev.target.value) ev.target.value = v;
  if (e.erreur) dire('');
  if (v.length === longueur() && !e.envoi) valider();
});

document.addEventListener('click', ev => {
  const b = ev.target.closest('[data-vf]'); if (!b) return;
  const a = b.dataset.vf;
  if (a === 'renvoyer') return renvoyer();
  if (a === 'changer') return quitter(true);
  if (a === 'retour') {
    if (e.etape === 'code' && e.mode !== 'inscription') { e.etape = ''; e.erreur = ''; e.info = ''; return verifView(); }
    return quitter(false);
  }
});
