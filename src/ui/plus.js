// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { $ } from '../racine.js';
import { I, svg } from '../icones.js';
import { SITE } from '../adresse.js';
import { offre, plus, view } from '../data/etat.js';
import { AVANTAGES, FORMULES, RAISONS, erreurDe, euros, gestion, resume } from '../abonnement.js';
import { NOMS, installer, mobile, partout, plateforme, vente } from '../plateformes.js';
import { qrSvg } from '../qr.js';
import { offrePull, restaurerAchats, versMagasin, versStripe } from '../core/abonnement.js';
import { esc } from '../core/coeur-sync.js';
import { go, render, tabs } from './bibliotheque.js';
import { ongletPlus } from './plus-porte.js';
import { installed, openInstall } from './onboarding.js';
import './plus.css';

/* ══════════ l'écran Folio+ (2026-10-27) ══════════
   Chargé à la demande par ui/plus-porte.js (préfixe fp-). Trois choses :
   ce que le compte a (mon_offre, dit par resume() de src/abonnement.js) et
   de quoi le gérer (le portail de Stripe) ; les deux formules et le
   paiement (une page de Stripe : l'app n'y voit jamais la carte) ; et Folio
   sur tous ses écrans — c'est là qu'on arrive après avoir payé.

   Sur ordinateur et dans un navigateur, Folio+ se paie par Stripe ; dans
   l'app des magasins (Capacitor), par l'achat intégré d'Apple ou de Google
   (RevenueCat) — leurs règles, sans lien vers Stripe. Un abonnement se gère
   là où il a été pris (gestion(), src/abonnement.js). Pour un compte Folio
   gratuit, c'est un onglet (ongletPlus) : pas de retour, la barre du bas. */

const IC = {
  tel: '<rect x="7" y="2.8" width="10" height="18.4" rx="2.4"/><path d="M11 18h2"/>',
  ordi: '<rect x="4" y="5" width="16" height="11" rx="1.6"/><path d="M2.5 19.2h19"/>'
};
const ici = () => plateforme({ ua: navigator.userAgent, touches: navigator.maxTouchPoints || 0,
  capacitor: window.Capacitor && window.Capacitor.getPlatform ? window.Capacitor.getPlatform() : null });
const actif = () => !!offre && offre.offre !== 'gratuit';

/* ---------- après le paiement ----------
   Stripe ramène ici avant, parfois, que son évènement ait écrit
   l'abonnement : on relit la base toutes les deux secondes, trente
   secondes au plus. Au-delà, l'accès s'ouvrira seul — on le dit. */
let relance = null;
function attendreActivation() {
  if (relance || actif() || plus.attente >= 15) return;
  relance = setTimeout(() => {
    relance = null;
    plus.attente += 1;
    offrePull().then(() => { if (view.name === 'plus') render(); });
  }, 2000);
}

function merci() {
  if (plus.etape === 'annule') return `<p class="fp-note fp-annule">${svg(I.x)}Paiement annulé : rien n’a été prélevé.</p>`;
  if (plus.etape !== 'merci') return '';
  if (actif()) {
    return `<section class="fp-merci" data-k="fp-merci"><i class="fp-merci-ic">${svg(I.check)}</i>
      <h2>Bienvenue dans Folio<span class="fp-plus">+</span></h2><p>${esc(resume(offre).ligne)}</p></section>`;
  }
  attendreActivation();
  const long = plus.attente >= 15;
  return `<section class="fp-merci fp-attente" data-k="fp-merci"><i class="fp-merci-ic">${svg(long ? I.clock : I.refresh)}</i>
    <h2>Paiement reçu</h2><p>${long ? 'L’activation prend plus de temps que prévu : elle arrivera seule dans quelques minutes.'
      : 'On active Folio+ sur ton compte…'}</p></section>`;
}

/* ---------- ce que le compte a ---------- */
function gererHtml(r, p) {
  const g = r.gerer && gestion(offre.abonnement, p);
  if (!g) return '';
  if (g.type === 'texte') return `<p class="fp-note">${svg(I.gear)}${esc(g.texte)}</p>`;
  const corps = `${svg(I.gear)}<span class="n">${plus.envoi === 'gerer' ? 'Ouverture…' : 'Gérer mon abonnement'}</span>
        <span class="c">${g.type === 'stripe' ? 'carte, factures, résiliation' : 'formule, résiliation'}</span>${svg(I.arrow)}`;
  return g.type === 'lien' ? `<a class="sr flat fp-gerer" href="${esc(g.lien)}" target="_blank" rel="noopener">${corps}</a>`
    : `<button class="sr flat fp-gerer" data-fp="gerer" ${plus.envoi ? 'disabled' : ''}>${corps}</button>`;
}

function etat(p) {
  if (!offre) return `<section class="fp-etat"><div class="fp-ligne"><b>…</b></div></section>`;
  const r = resume(offre);
  return `<section class="fp-etat">
      <div class="fp-ligne"><b class="fp-titre">${r.titre === 'Folio+' ? 'Folio<span class="fp-plus">+</span>'
        : esc(r.titre)}</b><span>${esc(r.ligne)}</span></div>
      ${r.alerte ? `<p class="fp-alerte">${svg(I.warn)}${esc(r.alerte)}</p>` : ''}
      ${gererHtml(r, p)}
    </section>`;
}

/* ---------- les formules ---------- */
function formule(cle) {
  const f = FORMULES[cle], on = plus.formule === cle;
  const prix = cle === 'annuel' ? euros(f.mois) : euros(f.prix);
  const note = cle === 'annuel' ? `${euros(f.prix)} par an, au lieu de <s>${euros(f.sans)}</s>` : 'Sans engagement';
  return `<button class="fp-f${on ? ' on' : ''}" role="radio" aria-checked="${on}" data-fp="formule" data-v="${cle}">
      <span class="fp-f-nom">${cle === 'annuel' ? 'Annuel' : 'Mensuel'}${cle === 'annuel' ? '<em>−50&#8239;%</em>' : ''}</span>
      <span class="fp-f-prix"><b>${prix}</b>/mois</span><span class="fp-f-note">${note}</span></button>`;
}

// qui encaisse, dit sous le bouton : Stripe sur le web, le magasin dans son app
const garantie = p => (vente(p) === 'stripe' ? 'Paiement sécurisé par Stripe · Résiliable en un geste'
  : `Paiement par ${NOMS[p.os] || 'le magasin'} · Résiliable à tout moment`);

function offreHtml(p) {
  if (!offre || !resume(offre).payer) return '';
  return `<section class="fp-offre">
      <div class="fp-formules" role="radiogroup" aria-label="Formule">${formule('annuel')}${formule('mensuel')}</div>
      <ul class="fp-inclus">${AVANTAGES.map(a => `<li>${svg(I.check)}${esc(a)}</li>`).join('')}</ul>
      <button class="fp-payer" data-fp="payer" ${plus.envoi ? 'disabled' : ''}>${plus.envoi === 'payer' ? 'Ouverture du paiement…'
        : `Passer à Folio+`}${svg(I.arrow)}</button>
      <p class="fp-note">${svg(I.lock)}${garantie(p)}</p>
      ${p.natif ? `<button class="lnk fp-restaurer" data-fp="restaurer" ${plus.envoi ? 'disabled' : ''}>${
        plus.envoi === 'restaurer' ? 'Recherche…' : 'Restaurer mes achats'}</button>` : ''}
      ${plus.err ? `<p class="fp-err" role="alert">${esc(plus.err)}</p>` : ''}
    </section>`;
}

/* ---------- Folio partout ---------- */
function cetAppareil(p) {
  const i = installer(p);
  if (i.type === 'deja' || installed()) {
    return `<div class="fp-ici fp-ok">${svg(I.check)}<span>Installé sur cet appareil</span></div>`;
  }
  if (i.type === 'magasin') {
    return `<a class="fp-ici fp-bouton" href="${esc(i.lien)}" target="_blank" rel="noopener">${svg(I.down)}<span>Télécharger sur ${esc(i.nom)}</span></a>`;
  }
  if (i.type === 'bientot') return `<div class="fp-ici fp-ok">${svg(I.clock)}<span>Bientôt sur ${esc(i.nom)}</span></div>`;
  return `<button class="fp-ici fp-bouton" data-fp="installer">${svg(I.down)}<span>Installer sur cet appareil</span></button>`;
}

function partoutHtml(p) {
  const qr = mobile(p) || p.natif ? '' : `<div class="fp-qr">${qrSvg(SITE + 'app', 'Folio sur ton téléphone')}
      <span>${svg(IC.tel)}Sur ton téléphone : scanne avec l’appareil photo</span></div>`;
  const autres = partout(p).filter(x => !x.ici).map(x => `<li>
      ${svg(x.os === 'mac' || x.os === 'windows' ? IC.ordi : IC.tel)}<b>${esc(x.appareil)}</b>
      ${x.lien ? `<a href="${esc(x.lien)}" target="_blank" rel="noopener">${esc(x.magasin)}</a>` : `<span>${esc(x.geste)}</span>`}</li>`).join('');
  return `<section class="fp-partout">
      <h2 class="fp-h2">Folio partout</h2>
      ${p.natif ? '' : cetAppareil(p)}${qr}
      <ul class="fp-autres">${autres}</ul>
    </section>`;
}

// ce que l'élève vient de toucher, s'il arrive d'un geste bridé (ui/bridage.js)
const raison = () => (plus.raison && RAISONS[plus.raison] && offre && offre.offre === 'gratuit'
  ? `<p class="fp-raison">${svg(I.spark)}${esc(RAISONS[plus.raison])}</p>` : '');

export function plusEcran() {
  const p = ici(), onglet = ongletPlus() && !plus.etape;
  $.innerHTML = `
    ${onglet ? '' : `<div class="bar"><button class="ic" data-fp="retour" aria-label="Retour">${svg(I.back)}</button></div>`}
    <div class="page fp">
      <div class="top"><div class="hero">Folio<span class="fp-plus">+</span></div></div>
      ${raison()}
      ${plus.etape === 'annule' ? merci() : ''}
      <div class="fp-grille">
        <div class="fp-col">${plus.etape === 'merci' ? merci() : etat(p) + offreHtml(p)}</div>
        <div class="fp-col">${partoutHtml(p)}</div>
      </div>
    </div>
    ${onglet ? tabs('plus') : ''}`;
}

/* ---------- les gestes ---------- */
function echec(e) {
  plus.envoi = null; plus.err = erreurDe(e.message);
  if (e.message === 'deja' || e.message === 'campus') offrePull().then(() => { if (view.name === 'plus') render(); });
  render();
}

function vers(action) {
  if (plus.envoi) return;
  plus.envoi = action; plus.err = '';
  render();
  const p = ici();
  if (vente(p) === 'stripe') return versStripe(action, plus.formule).then(url => location.assign(url)).catch(echec);
  /* l'achat intégré : la feuille d'Apple ou de Google s'ouvre par-dessus
     l'app, puis l'on revient ici — Folio+ s'active comme après Stripe */
  const geste = action === 'restaurer' ? restaurerAchats(p.os) : versMagasin(p.os, plus.formule);
  geste.then(() => { plus.envoi = null; plus.etape = 'merci'; plus.attente = 0; render(); }).catch(echec);
}

const GESTES = {
  formule: b => { plus.formule = b.dataset.v === 'mensuel' ? 'mensuel' : 'annuel'; plus.err = ''; render(); },
  payer: () => vers('payer'),
  gerer: () => vers('gerer'),
  restaurer: () => vers('restaurer'),
  installer: () => openInstall(),
  // après un paiement, l'accueil ; sinon les Réglages, d'où l'on vient (le routeur recule dans l'historique)
  retour: () => go(plus.etape ? 'home' : 'settings')
};

document.addEventListener('click', ev => {
  const b = ev.target.closest('[data-fp]');
  if (!b || view.name !== 'plus' || !GESTES[b.dataset.fp]) return;
  GESTES[b.dataset.fp](b);
});
