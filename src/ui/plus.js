// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { $ } from '../racine.js';
import { I, svg } from '../icones.js';
import { SITE } from '../adresse.js';
import { offre, plus, view } from '../data/etat.js';
import { FORMULES, RAISONS, erreurDe, euros, gestion, resume } from '../abonnement.js';
import { AVANTAGES_DETAIL, iaDuMois, licence } from '../licence.js';
import { iaParMois } from '../offres.js';
import { NOMS, mobile, plateforme, vente } from '../plateformes.js';
import { qrSvg } from '../qr.js';
import { offrePull, restaurerAchats, versMagasin, versStripe } from '../core/abonnement.js';
import { esc } from '../core/coeur-sync.js';
import { go, render, tabs } from './bibliotheque.js';
import { isProf } from './classement.js';
import { ongletPlus } from './plus-porte.js';
import { aDerriere } from './routeur.js';
import { installed, openInstall } from './onboarding.js';
import './plus.css';

/* ══════════ l'écran Mirandola+ (2026-10-27, refait le 2026-10-28) ══════════
   Chargé à la demande par ui/plus-porte.js (préfixe fp-). À gauche, ce
   que le compte a : pour Mirandola gratuit, les deux formules et le paiement
   (une page de Stripe : l'app n'y voit jamais la carte) ; pour Mirandola+ ou
   Campus, **sa licence** — formule, prix payé, prochaine échéance, moyen
   de paiement, l'IA du mois, l'engagement en une phrase (licence() et
   iaDuMois(), src/abonnement.js) — et de quoi la gérer ou la résilier, là
   où elle a été prise (gestion()). À droite, les avantages en détail et,
   sur un ordinateur où Mirandola n'est pas encore installé, « Installer » et
   le QR du téléphone. Au téléphone, rien à installer : on y est déjà
   (la porte d'installation, ui/pwa-porte.js).

   Sur ordinateur et dans un navigateur, Mirandola+ se paie par Stripe ; dans
   l'app des magasins (Capacitor), par l'achat intégré d'Apple ou de Google
   (RevenueCat) — leurs règles, sans lien vers Stripe. Pour un compte Mirandola
   gratuit au téléphone, c'est un onglet (ongletPlus) : pas de retour, la
   barre du bas ; sinon on y vient des Réglages ou de la barre latérale. */

const IC = {
  tel: '<rect x="7" y="2.8" width="10" height="18.4" rx="2.4"/><path d="M11 18h2"/>'
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
      <h2>Bienvenue dans Mirandola<span class="fp-plus">+</span></h2><p>${esc(resume(offre).ligne)}</p></section>`;
  }
  attendreActivation();
  const long = plus.attente >= 15;
  return `<section class="fp-merci fp-attente" data-k="fp-merci"><i class="fp-merci-ic">${svg(long ? I.clock : I.refresh)}</i>
    <h2>Paiement reçu</h2><p>${long ? 'L’activation prend plus de temps que prévu : elle arrivera seule dans quelques minutes.'
      : 'On active Mirandola+ sur ton compte…'}</p></section>`;
}

/* ---------- ma licence ---------- */
const bouton = (fp, texte, ic, cls = '') => `<button class="fp-act${cls}" data-fp="${fp}" ${plus.envoi ? 'disabled' : ''}>${
  svg(ic)}<span>${plus.envoi === fp ? 'Ouverture…' : texte}</span></button>`;

/* Gérer et résilier, là où l'abonnement a été pris. Stripe : son portail,
   et « Résilier » qui l'ouvre droit sur la résiliation (la confirmation
   est la sienne) ; un magasin : son lien sur son appareil, ailleurs où le
   trouver. Offert, Campus : rien à faire. */
function actions(p) {
  const r = resume(offre), a = offre.abonnement, g = r.gerer && gestion(a, p);
  if (!g) return '';
  if (g.type === 'texte') return `<p class="fp-note fp-ou">${svg(I.gear)}${esc(g.texte)}</p>`;
  if (g.type === 'lien') {
    return `<div class="fp-actions"><a class="fp-act" href="${esc(g.lien)}" target="_blank" rel="noopener">${svg(I.gear)}<span>${
      a.finPrevue ? 'Reprendre ou gérer' : 'Gérer ou résilier'}</span></a></div>`;
  }
  return `<div class="fp-actions">${bouton('gerer', a.finPrevue ? 'Reprendre l’abonnement' : 'Carte et factures', I.card)}${
    a.finPrevue || offre.offre !== 'plus' ? '' : bouton('resilier', 'Résilier l’abonnement', I.x, ' fp-resilier')}</div>`;
}

function ligneIA() {
  if (plus.ia == null) return '';
  const prof = isProf(), ia = iaDuMois(plus.ia, iaParMois(offre.offre, prof), prof);
  return `<div class="fp-ia"><dt>IA ce mois-ci</dt><dd>${esc(ia.t)}${prof ? '' : `<i class="fp-jauge"><b style="width:${ia.pc}%"></b></i>`}</dd></div>`;
}

function licenceHtml(p) {
  const l = licence(offre), r = resume(offre);
  return `<section class="fp-licence">
      <div class="fp-l-tete"><h2 class="fp-h2">Ma licence</h2><span class="fp-pastille fp-${l.etat.k}">${esc(l.etat.t)}</span></div>
      ${r.alerte ? `<p class="fp-alerte">${svg(I.warn)}${esc(r.alerte)}</p>` : ''}
      <dl class="fp-l">${l.lignes.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}${ligneIA()}</dl>
      <p class="fp-engage">${esc(l.engagement)}</p>
      ${actions(p)}
    </section>`;
}

/* ---------- les formules (Mirandola gratuit) ---------- */
function formule(cle) {
  const f = FORMULES[cle], on = plus.formule === cle;
  const prix = cle === 'annuel' ? euros(f.mois) : euros(f.prix);
  const note = cle === 'annuel' ? `${euros(f.prix)} par an, au lieu de <s>${euros(f.sans)}</s>` : 'Sans engagement';
  return `<button class="fp-f${on ? ' on' : ''}" role="radio" aria-checked="${on}" data-fp="formule" data-v="${cle}">
      <span class="fp-f-nom">${cle === 'annuel' ? 'Annuel' : 'Mensuel'}${cle === 'annuel' ? `<em>−${f.remise}&#8239;%</em>` : ''}</span>
      <span class="fp-f-prix"><b>${prix}</b>/mois</span><span class="fp-f-note">${note}</span></button>`;
}

// qui encaisse, dit sous le bouton : Stripe sur le web, le magasin dans son app
const garantie = p => (vente(p) === 'stripe' ? 'Paiement sécurisé par Stripe · Résiliable en un geste'
  : `Paiement par ${NOMS[p.os] || 'le magasin'} · Résiliable à tout moment`);

function offreHtml(p) {
  const r = resume(offre);
  return `${r.ligne !== 'Gratuit' ? `<p class="fp-alerte">${svg(I.warn)}${esc(r.ligne)}</p>` : ''}
    <section class="fp-offre">
      <div class="fp-formules" role="radiogroup" aria-label="Formule">${formule('annuel')}${formule('mensuel')}</div>
      <button class="fp-payer" data-fp="payer" ${plus.envoi ? 'disabled' : ''}>${plus.envoi === 'payer' ? 'Ouverture du paiement…'
        : `Passer à Mirandola+`}${svg(I.arrow)}</button>
      <p class="fp-note">${svg(I.lock)}${garantie(p)}</p>
      ${p.natif ? `<button class="lnk fp-restaurer" data-fp="restaurer" ${plus.envoi ? 'disabled' : ''}>${
        plus.envoi === 'restaurer' ? 'Recherche…' : 'Restaurer mes achats'}</button>` : ''}
      ${plus.err ? `<p class="fp-err" role="alert">${esc(plus.err)}</p>` : ''}
    </section>
    ${r.gerer ? actions(p) : ''}`;
}

function gauche(p) {
  if (plus.etape === 'merci') return merci();
  if (!offre) return `<section class="fp-licence fp-charge"><div class="fp-l-tete"><h2 class="fp-h2">Ma licence</h2></div></section>`;
  return resume(offre).payer ? offreHtml(p) : licenceHtml(p) + (plus.err ? `<p class="fp-err" role="alert">${esc(plus.err)}</p>` : '');
}

/* ---------- les avantages ---------- */
function avantagesHtml() {
  const prof = isProf(), gratuit = !offre || offre.offre === 'gratuit';
  return `<section class="fp-avantages">
      <h2 class="fp-h2">${gratuit ? 'Ce que Mirandola+ t’ouvre' : 'Tes avantages'}</h2>
      <ul class="fp-av">${AVANTAGES_DETAIL.map(a => `<li><i class="fp-av-ic">${svg(I[a.ic] || I.check)}</i><span><b>${esc(a.t)}</b>${
        esc(prof && a.prof ? a.prof : a.s)}</span></li>`).join('')}</ul>
    </section>`;
}

/* ---------- sur cet ordinateur ----------
   Seulement sur un ordinateur, dans son navigateur, où Mirandola n'est pas
   encore installé : « Installer », et le QR qui ouvre Mirandola sur le
   téléphone (puis sa porte d'installation). Installé : plus rien à dire. */
function installHtml(p) {
  if (p.natif || mobile(p) || installed()) return '';
  return `<section class="fp-partout"><h2 class="fp-h2">Sur cet ordinateur</h2>
      <button class="fp-ici fp-bouton" data-fp="installer">${svg(I.down)}<span>Installer Mirandola</span></button>
      <div class="fp-qr">${qrSvg(SITE + 'app', 'Mirandola sur ton téléphone')}
        <span>${svg(IC.tel)}Sur ton téléphone : scanne, puis pose Mirandola sur ton écran d’accueil</span></div>
    </section>`;
}

// ce que l'élève vient de toucher, s'il arrive d'un geste bridé (ui/bridage.js)
const raison = () => (plus.raison && RAISONS[plus.raison] && offre && offre.offre === 'gratuit'
  ? `<p class="fp-raison">${svg(I.spark)}${esc(RAISONS[plus.raison])}</p>` : '');

const titre = () => (offre && offre.offre === 'campus' ? 'Mirandola <em class="fp-campus">Campus</em>' : 'Mirandola<span class="fp-plus">+</span>');

export function plusEcran() {
  const p = ici(), onglet = ongletPlus() && !plus.etape;
  $.innerHTML = `
    ${onglet ? '' : `<div class="bar"><button class="ic" data-fp="retour" aria-label="Retour">${svg(I.back)}</button></div>`}
    <div class="page fp">
      <div class="top"><div class="hero">${titre()}</div></div>
      ${raison()}
      ${plus.etape === 'annule' ? merci() : ''}
      <div class="fp-grille">
        <div class="fp-col">${gauche(p)}</div>
        <div class="fp-col">${avantagesHtml()}${installHtml(p)}</div>
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
     l'app, puis l'on revient ici — Mirandola+ s'active comme après Stripe */
  const geste = action === 'restaurer' ? restaurerAchats(p.os) : versMagasin(p.os, plus.formule);
  geste.then(() => { plus.envoi = null; plus.etape = 'merci'; plus.attente = 0; render(); }).catch(echec);
}

const GESTES = {
  formule: b => { plus.formule = b.dataset.v === 'mensuel' ? 'mensuel' : 'annuel'; plus.err = ''; render(); },
  payer: () => vers('payer'),
  gerer: () => vers('gerer'),
  resilier: () => vers('resilier'),
  restaurer: () => vers('restaurer'),
  installer: () => openInstall(),
  // après un paiement, l'accueil ; sinon d'où l'on vient (le routeur recule dans l'historique)
  retour: () => (!plus.etape && aDerriere() ? history.back() : go('home'))
};

document.addEventListener('click', ev => {
  const b = ev.target.closest('[data-fp]');
  if (!b || view.name !== 'plus' || !GESTES[b.dataset.fp]) return;
  GESTES[b.dataset.fp](b);
});
