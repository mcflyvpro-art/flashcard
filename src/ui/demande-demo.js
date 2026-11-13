// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { $ } from '../racine.js';
import { I, svg } from '../icones.js';
import { auth, online, view } from '../data/etat.js';
import { esc } from '../core/coeur-sync.js';
import { demanderDemo, demanderEspaceProf } from '../core/demande.js';
import { FONCTIONS, messageDemande } from '../etablissement.js';
import { pubTete } from './connexion.js';
import './demande-demo.css';

/* ══════════ « Demander une démo » (2026-10-26) ══════════
   Un établissement qui découvre Mirandola laisse ses coordonnées, sans compte :
   la demande arrive dans la console de l'éditeur, étape Prospect
   (docs/PARCOURS.md, § 3). Chargé à la demande par ui/connexion.js
   (`demandeView`), ouvert depuis l'écran de connexion. Téléphone et PC.

   Le professeur particulier a le sien (2026-11-13, vue `demandeprof`,
   adresse /professeur-particulier, demandé : « prof particulier c'est prof
   particulier ») : le même écran, mais rien d'un établissement — ni Campus,
   ni démo, ni fonction ni ville —, et sa demande part par
   demander_espace_prof, à part de tout établissement. */

const etat = { champs: {}, envoi: false, rep: null, fini: false };
const chezProf = () => view.name === 'demandeprof';

const champ = (k, lab, attr = '') => `<label class="dd-ch"><span>${lab}</span>
  <input id="dd-${k}" data-dd="${k}" value="${esc(etat.champs[k] || '')}" ${attr}></label>`;

function formulaireProf(m) {
  return `<form class="dd-form" id="ddform" autocomplete="on" novalidate>
      ${champ('nom', 'Votre nom', 'autocomplete="name" maxlength="80" required')}
      ${champ('email', 'E-mail', 'type="email" autocomplete="email" maxlength="120" required spellcheck="false" autocapitalize="none"')}
      ${champ('tel', 'Téléphone', 'type="tel" autocomplete="tel" maxlength="30"')}
      ${champ('eleves', 'Nombre d’élèves', 'inputmode="numeric" maxlength="4"')}
      <label class="dd-ch large"><span>Ce que vous enseignez</span><textarea id="dd-message" data-dd="message" rows="3"
        maxlength="2000">${esc(etat.champs.message || '')}</textarea></label>
      ${m ? `<p class="dd-rep ${m.ton}"><b>${esc(m.titre)}</b>${m.texte ? `<span>${esc(m.texte)}</span>` : ''}</p>` : ''}
      <button class="cta dd-go" type="submit" ${etat.envoi ? 'disabled' : ''}>Ouvrir mon espace${svg(I.arrow)}</button>
    </form>`;
}

function formulaire() {
  const m = etat.rep ? messageDemande(etat.rep, chezProf()) : null;
  if (chezProf()) return formulaireProf(m);
  return `<form class="dd-form" id="ddform" autocomplete="on" novalidate>
      ${champ('etab', 'Établissement', 'autocomplete="organization" maxlength="120" required')}
      ${champ('ville', 'Ville', 'autocomplete="address-level2" maxlength="80"')}
      ${champ('nom', 'Votre nom', 'autocomplete="name" maxlength="80" required')}
      <label class="dd-ch"><span>Votre fonction</span><select id="dd-fonction" data-dd="fonction">
        <option value=""></option>${FONCTIONS.map(f => `<option${etat.champs.fonction === f ? ' selected' : ''}>${f}</option>`).join('')}
      </select></label>
      ${champ('email', 'E-mail', 'type="email" autocomplete="email" maxlength="120" required spellcheck="false" autocapitalize="none"')}
      ${champ('tel', 'Téléphone', 'type="tel" autocomplete="tel" maxlength="30"')}
      ${champ('eleves', 'Nombre d’élèves', 'inputmode="numeric" maxlength="6"')}
      <label class="dd-ch large"><span>Votre besoin</span><textarea id="dd-message" data-dd="message" rows="3"
        maxlength="2000">${esc(etat.champs.message || '')}</textarea></label>
      ${m ? `<p class="dd-rep ${m.ton}"><b>${esc(m.titre)}</b>${m.texte ? `<span>${esc(m.texte)}</span>` : ''}</p>` : ''}
      <button class="cta dd-go" type="submit" ${etat.envoi ? 'disabled' : ''}>Demander une démo${svg(I.arrow)}</button>
      ${auth ? '' : `<button class="lnk" data-act="decouvrir" type="button">${svg(I.play)}Essayer tout de suite, sans compte</button>`}
    </form>`;
}

function merci() {
  const m = messageDemande(etat.rep, chezProf());
  return `<div class="dd-merci">${svg(I.check)}<b>${esc(m.titre)}</b><p>${esc(m.texte)}</p>
    <button class="cta" data-act="tolog">Retour${svg(I.arrow)}</button></div>`;
}

/* Sans compte, l'écran public (le site, la lumière, le logo) ; ouvert
   depuis les Réglages d'un compte, une page de l'app comme une autre. */
const pitchProf = () => `<div class="dd-pitch">
        <p class="dd-marque"><span class="dd-ic solo" aria-hidden="true"><img src="/site/logo.svg" alt="" width="26" height="28"></span><span>Mirandola</span></p>
        <h1 class="dd-t">Vos cours <em>particuliers.</em></h1>
        <ul class="dd-points">
          <li>${svg(I.key)}<span>Votre code : vos élèves vous rejoignent</span></li>
          <li>${svg(I.users)}<span>Vous acceptez chacun, vous suivez ses devoirs</span></li>
          <li>${svg(I.spark)}<span>Mirandola+ pour vos élèves, sur devis</span></li>
        </ul>
      </div>`;

export function demandeEcran() {
  if (etat.prof !== chezProf()) Object.assign(etat, { prof: chezProf(), champs: {}, rep: null, fini: false });
  const corps = chezProf() ? `${pitchProf()}${etat.fini ? merci() : formulaire()}` : `<div class="dd-pitch">
        <p class="dd-marque"><span class="dd-ic" aria-hidden="true"><img src="/site/logo.svg" alt="" width="26" height="28"><i>${svg(I.school)}</i></span><span>Mirandola <em>Campus</em></span></p>
        <h1 class="dd-t">Mirandola pour votre <em>établissement.</em></h1>
        <ul class="dd-points">
          <li>${svg(I.school)}<span>Un code pour tout l’établissement</span></li>
          <li>${svg(I.rocket)}<span>Une démo de 30 jours, avec vos classes</span></li>
          <li>${svg(I.lock)}<span>Données d’élèves protégées (RGPD)</span></li>
        </ul>
      </div>
      ${etat.fini ? merci() : formulaire()}`;
  $.innerHTML = auth
    ? `<div class="bar"><button class="ic" data-act="settings" aria-label="Retour">${svg(I.back)}</button></div>
      <div class="page dd" id="page">${corps}</div>`
    : `<div class="pub pub-demande">${pubTete()}<div class="dd">${corps}</div></div>`;
}

const repeint = () => { if (/^demande/.test(view.name)) demandeEcran(); };

// ce qui part : la demande d'un établissement, ou celle d'un professeur particulier (2026-11-13)
function demande(c) {
  const n = String(c.eleves || '').replace(/\s/g, ''), eleves = /^\d+$/.test(n) ? +n : null;
  if (chezProf()) return demanderEspaceProf({ nom: c.nom || '', email: c.email || '', tel: c.tel || '', eleves, message: c.message || '' });
  return demanderDemo({ etab: c.etab || '', ville: c.ville || '', contact_nom: c.nom || '', fonction: c.fonction || '',
    email: c.email || '', tel: c.tel || '', eleves, message: c.message || '' });
}

async function envoyer() {
  if (etat.envoi) return;
  if (!online) { etat.rep = 'reseau'; return repeint(); }
  etat.envoi = true; etat.rep = null; repeint();
  try {
    etat.rep = await demande(etat.champs);
    etat.fini = etat.rep === 'ok' || etat.rep === 'deja';
  } catch (e) { etat.rep = 'reseau'; }
  etat.envoi = false;
  repeint();
}

/* Les champs tiennent leur valeur dans `etat` : un repeint (une réponse,
   une erreur) ne vide jamais ce qui est tapé. */
document.addEventListener('input', e => {
  const k = e.target.dataset && e.target.dataset.dd;
  if (k && /^demande/.test(view.name)) etat.champs[k] = e.target.value;
});
document.addEventListener('change', e => {
  const k = e.target.dataset && e.target.dataset.dd;
  if (k && /^demande/.test(view.name)) etat.champs[k] = e.target.value;
});
document.addEventListener('submit', e => {
  if (e.target.id !== 'ddform') return;
  e.preventDefault();
  envoyer();
});
