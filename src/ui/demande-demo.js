// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { $ } from '../racine.js';
import { I, svg } from '../icones.js';
import { auth, online, view } from '../data/etat.js';
import { esc } from '../core/coeur-sync.js';
import { demanderDemo } from '../core/demande.js';
import { FONCTIONS, messageDemande } from '../etablissement.js';
import './demande-demo.css';

/* ══════════ « Demander une démo » (2026-10-26) ══════════
   Un établissement qui découvre Folio laisse ses coordonnées, sans compte :
   la demande arrive dans la console de l'éditeur, étape Prospect
   (docs/PARCOURS.md, § 3). Chargé à la demande par ui/connexion.js
   (`demandeView`), ouvert depuis l'écran de connexion. Téléphone et PC. */

const etat = { champs: {}, envoi: false, rep: null, fini: false };

const champ = (k, lab, attr = '') => `<label class="dd-ch"><span>${lab}</span>
  <input id="dd-${k}" data-dd="${k}" value="${esc(etat.champs[k] || '')}" ${attr}></label>`;

function formulaire() {
  const m = etat.rep ? messageDemande(etat.rep) : null;
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
    </form>`;
}

function merci() {
  const m = messageDemande(etat.rep);
  return `<div class="dd-merci">${svg(I.check)}<b>${esc(m.titre)}</b><p>${esc(m.texte)}</p>
    <button class="cta" data-act="tolog">Retour${svg(I.arrow)}</button></div>`;
}

export function demandeEcran() {
  $.innerHTML = `<div class="bar"><button class="ic" data-act="${auth ? 'settings' : 'tolog'}" aria-label="Retour">${svg(I.back)}</button></div>
    <div class="page dd" id="page">
      <div class="top"><div class="hero">Folio pour votre établissement</div></div>
      <ul class="dd-points">
        <li>${svg(I.school)}<span>Un code pour tout l’établissement</span></li>
        <li>${svg(I.rocket)}<span>Une démo de 30 jours, avec vos classes</span></li>
        <li>${svg(I.lock)}<span>Données d’élèves protégées (RGPD)</span></li>
      </ul>
      ${etat.fini ? merci() : formulaire()}
    </div>`;
}

const repeint = () => { if (view.name === 'demande') demandeEcran(); };

async function envoyer() {
  if (etat.envoi) return;
  if (!online) { etat.rep = 'reseau'; return repeint(); }
  const c = etat.champs, n = String(c.eleves || '').replace(/\s/g, '');
  etat.envoi = true; etat.rep = null; repeint();
  try {
    etat.rep = await demanderDemo({ etab: c.etab || '', ville: c.ville || '', contact_nom: c.nom || '', fonction: c.fonction || '',
      email: c.email || '', tel: c.tel || '', eleves: /^\d+$/.test(n) ? +n : null, message: c.message || '' });
    etat.fini = etat.rep === 'ok' || etat.rep === 'deja';
  } catch (e) { etat.rep = 'reseau'; }
  etat.envoi = false;
  repeint();
}

/* Les champs tiennent leur valeur dans `etat` : un repeint (une réponse,
   une erreur) ne vide jamais ce qui est tapé. */
document.addEventListener('input', e => {
  const k = e.target.dataset && e.target.dataset.dd;
  if (k && view.name === 'demande') etat.champs[k] = e.target.value;
});
document.addEventListener('change', e => {
  const k = e.target.dataset && e.target.dataset.dd;
  if (k && view.name === 'demande') etat.champs[k] = e.target.value;
});
document.addEventListener('submit', e => {
  if (e.target.id !== 'ddform') return;
  e.preventDefault();
  envoyer();
});
