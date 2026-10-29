// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { $ } from '../racine.js';
import { I, svg } from '../icones.js';
import { auth, compte, demoEtab, online, setCompte } from '../data/etat.js';
import { esc } from '../core/coeur-sync.js';
import { changePassword } from '../core/menus-c.js';
import { render } from './bibliotheque.js';
import { pubTete } from './connexion.js';
import { toast } from './import-cartes.js';
import { maybeTuto } from './tuto-porte.js';

/* ══════════ le mot de passe à choisir (2026-10-29) ══════════
   Un compte ouvert par quelqu'un d'autre — l'éditeur pour un professeur
   particulier, le référent pour ses élèves et ses professeurs — arrive avec
   un mot de passe provisoire, montré une fois à qui l'a ouvert. Tant qu'il
   ne l'a pas remplacé (`mon_compte().provisoire`, migration 20261029090000),
   l'app ne montre que cet écran, quel que soit celui d'en dessous : comme la
   porte d'installation, render() le peint à la place. La base retire la
   marque d'elle-même quand le mot de passe change (déclencheur
   mdp_choisi) ; ici, on la retire aussi tout de suite, pour ne pas attendre
   la prochaine lecture du compte. Jamais dans la démo. */

export const mdpAChoisir = () => !!(auth && compte && compte.provisoire && !demoEtab);

let erreur = '', envoi = false;

export function mdpView() {
  $.innerHTML = `<div class="pub pub-connexion">
    ${pubTete(false)}
    <div class="pub-duo"><div class="login">
      <h1 class="lt">Choisis ton mot de passe.</h1>
      <p class="lsub">${esc(auth.email || '')}</p>
      <form class="lf" id="mdpf" autocomplete="on">
        <input type="email" value="${esc(auth.email || '')}" autocomplete="username" hidden readonly>
        <div class="lrow">${svg(I.lock)}
          <input id="mdp1" type="password" placeholder="Nouveau mot de passe" autocomplete="new-password"
            autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="next" aria-label="Nouveau mot de passe"></div>
        <div class="lrow">${svg(I.lock)}
          <input id="mdp2" type="password" placeholder="Encore une fois" autocomplete="new-password"
            autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="go" aria-label="Encore une fois"></div>
        <div class="lerr" id="mdpe">${esc(erreur)}</div>
        <button class="cta" id="mdpgo" type="submit" ${envoi ? 'disabled' : ''}>${envoi ? 'Enregistrement…' : 'Enregistrer'}${svg(I.arrow)}</button>
      </form>
      <button class="lnk" data-act="logout" type="button">Se déconnecter</button>
    </div></div>
  </div>`;
  if (!envoi) setTimeout(() => document.getElementById('mdp1')?.focus(), 80);
}

/* Ce que GoTrue répond, en clair. */
function messageDe(x) {
  const t = String((x && x.message) || '');
  if (/different|same/i.test(t)) return 'Choisis un mot de passe différent de celui qu’on t’a donné';
  if (/weak|short|characters/i.test(t)) return 'Ce mot de passe est trop faible : allonge-le';
  return 'Enregistrement impossible : réessaie dans un moment';
}

async function enregistrer() {
  const a = document.getElementById('mdp1'), b = document.getElementById('mdp2'), e = document.getElementById('mdpe');
  const pw = (a && a.value) || '';
  if (pw.length < 8) { e.textContent = 'Huit caractères au moins'; a.focus(); return; }
  if (pw !== ((b && b.value) || '')) { e.textContent = 'Les deux ne sont pas pareils'; b.focus(); return; }
  if (!online) { e.textContent = 'Hors ligne : il faut le réseau pour changer de mot de passe'; return; }
  envoi = true; erreur = ''; mdpView();
  try {
    await changePassword(pw);
    setCompte({ ...compte, provisoire: false });
    envoi = false;
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
