// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { $ } from '../racine.js';
import { I, svg } from '../icones.js';
import { SITE } from '../adresse.js';
import { offre, plus, view } from '../data/etat.js';
import { ESSAI_JOURS, FORMULES, RAISONS, erreurDe, euros, formuleDe, gestion, resume } from '../abonnement.js';
import { AVANTAGES_DETAIL, AVANTAGES_INFINI, iaDuMois, licence } from '../licence.js';
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
      <h2>Bienvenue dans ${offre.niveau === 'infini' ? 'Mirandola Infini' : 'Mirandola<span class="fp-plus">+</span>'}</h2>
      <p>${esc(resume(offre).ligne)}</p></section>`;
  }
  attendreActivation();
  const long = plus.attente >= 15;
  return `<section class="fp-merci fp-attente" data-k="fp-merci"><i class="fp-merci-ic">${svg(long ? I.clock : I.refresh)}</i>
    <h2>Paiement reçu</h2><p>${long ? 'L’activation prend plus de temps que prévu : elle arrivera seule dans quelques minutes.'
      : `On active ${infini() ? 'Mirandola Infini' : 'Mirandola+'} sur ton compte…`}</p></section>`;
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
  // Infini : sans compter, comme un professeur — le nombre seul, jamais une jauge
  const prof = isProf() || offre.niveau === 'infini', ia = iaDuMois(plus.ia, iaParMois(offre.offre, prof), prof);
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
    </section>${monter(p)}`;
}

/* Monter à Infini (2026-11-07, demandé : « quand on a + on peut upgrade ») :
   un abonné Mirandola+ — payé, offert, d'un magasin — voit ce qu'Infini
   ajoute et le prix en plus ; « Passer à Infini » ouvre le choix de sa
   formule (offreHtml, le niveau fixé). Par Stripe, le changement se fait au
   prorata dans son portail ; offert, Infini s'achète par-dessus. Jamais
   pendant une résiliation ni un impayé : il faut d'abord régler cela. */
const peutMonter = () => offre && offre.offre === 'plus' && offre.niveau !== 'infini'
  && !(offre.abonnement && (offre.abonnement.finPrevue || offre.abonnement.statut === 'impaye'));

function monter() {
  if (!peutMonter()) return '';
  const a = offre.abonnement, periode = a && FORMULES[a.formule] && FORMULES[a.formule].par === 'mois' ? 'mensuel' : 'annuel';
  const de = FORMULES[periode], vers = FORMULES['infini_' + periode];
  const ecart = periode === 'annuel' ? `+${euros(vers.mois - de.mois)}/mois` : `+${euros(vers.prix - de.prix)}/mois`;
  return `<section class="fp-montee">
      <div class="fp-m-tete"><h2>Mirandola <em>Infini</em></h2><span>${ecart}</span></div>
      <ul>${AVANTAGES_INFINI.map(x => `<li>${svg(I[x.ic] || I.check)}<b>${esc(x.t)}</b></li>`).join('')}</ul>
      <button class="fp-monter" data-fp="monter" data-v="${periode}">Passer à Infini${svg(I.arrow)}</button>
    </section>`;
}

/* ---------- les formules (Mirandola gratuit) ---------- */
/* Le niveau (2026-11-06) : Mirandola+ ou Mirandola Infini, au-dessus. Le
   même choix de période en dessous, les prix du niveau choisi. */
const infini = () => plus.niveau === 'infini';
const commande = () => formuleDe(plus.niveau, plus.formule);

function niveaux() {
  const n = (cle, nom, depuis) => `<button class="fp-n${plus.niveau === cle ? ' on' : ''}" role="radio" aria-checked="${plus.niveau === cle}"
      data-fp="niveau" data-v="${cle}"><b>${nom}</b><span>dès ${euros(depuis)}/mois</span></button>`;
  return `<div class="fp-niveaux" role="radiogroup" aria-label="Niveau">${n('plus', 'Mirandola+', FORMULES.annuel.mois)}${
    n('infini', 'Infini', FORMULES.infini_annuel.mois)}</div>`;
}

function formule(cle) {
  const f = FORMULES[formuleDe(plus.niveau, cle)], on = plus.formule === cle;
  const prix = cle === 'annuel' ? euros(f.mois) : euros(f.prix);
  // jamais un prix barré : 83,88 € n'a jamais été un prix de vente (article L112-1-1)
  const note = cle === 'annuel' ? `${euros(f.prix)} par an, ${f.remise}&#8239;% de moins qu’au mois` : 'Sans engagement';
  return `<button class="fp-f${on ? ' on' : ''}" role="radio" aria-checked="${on}" data-fp="formule" data-v="${cle}">
      <span class="fp-f-nom">${cle === 'annuel' ? 'Annuel' : 'Mensuel'}${cle === 'annuel' ? `<em>−${f.remise}&#8239;%</em>` : ''}</span>
      <span class="fp-f-prix"><b>${prix}</b>/mois</span><span class="fp-f-note">${note}</span></button>`;
}

/* L'accord, avant de payer (2026-11-05) : les conditions de vente, et la
   demande expresse que Mirandola+ commence tout de suite — sans elle, le
   service ne pourrait pas s'ouvrir pendant les 14 jours de rétractation
   (article L221-25). Le bouton reste éteint tant qu'on n'a pas coché ; la
   version acceptée part avec la commande (CGV_VERSION). */
const accord = () => `<label class="fp-accord" id="fp-accord"><input type="checkbox" data-fp="accord"${plus.accord ? ' checked' : ''}>
    <span>J’accepte les <button type="button" class="lnk" data-legal="cgv">conditions de vente</button> et je demande que
    ${infini() ? 'Mirandola Infini' : 'Mirandola+'} commence tout de suite. Si je me rétracte dans les 14 jours, je ne paie que les jours écoulés.</span></label>`;

// qui encaisse, dit sous le bouton : Stripe sur le web, le magasin dans son app
const garantie = p => (vente(p) === 'stripe' ? 'Paiement sécurisé par Stripe · Résiliable en un geste'
  : `Paiement par ${NOMS[p.os] || 'le magasin'} · Résiliable à tout moment`);

/* L'essai (2026-11-05) : un compte qui n'a jamais eu d'abonnement Stripe a
   7 jours gratuits — la fonction paiement en décide, l'écran le dit, avec
   le jour avant lequel rien n'est prélevé. */
// l'essai : jamais d'abonnement payé — un Mirandola+ offert y a droit aussi, pour Infini (la fonction paiement en décide pareil)
const essaiPossible = () => !offre.abonnement || offre.abonnement.source === 'offert';
const finEssai = () => new Date(Date.now() + ESSAI_JOURS * 864e5).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });

/* Le code d'un lien des réseaux, gardé 14 jours par ui/plus-porte.js. */
export function promoGardee() {
  try {
    const g = JSON.parse(localStorage.getItem('folio.promo') || 'null');
    return g && /^[A-Za-z0-9]{1,30}$/.test(g.c) && Date.now() - g.t < 14 * 864e5 ? g.c.toUpperCase() : '';
  } catch (e) { return ''; }                                   // stockage illisible : pas de code, le champ de Stripe reste
}

// le bouton d'achat et ce qu'il engage, dit dessous
function payer(p, monte) {
  const libelle = plus.envoi === 'payer' ? 'Ouverture du paiement…' : essaiPossible() ? `Essayer ${ESSAI_JOURS} jours gratuits`
    : infini() ? 'Passer à Mirandola Infini' : 'Passer à Mirandola+';
  const note = monte && offre.abonnement && offre.abonnement.source === 'stripe' ? 'Au prorata de ta période en cours, sur la page de Stripe'
    : essaiPossible() && vente(p) === 'stripe' ? `Rien n’est prélevé avant le ${finEssai()}. Résiliable d’un geste.` : garantie(p);
  return `<button class="fp-payer${infini() ? ' fp-payer-infini' : ''}" data-fp="payer" ${plus.envoi || !plus.accord ? 'disabled' : ''}
      aria-describedby="fp-accord">${libelle}${svg(I.arrow)}</button>
    <p class="fp-note">${svg(I.lock)}${note}</p>`;
}

function offreHtml(p) {
  const r = resume(offre), promo = promoGardee(), monte = plus.monter;
  return `${r.ligne !== 'Gratuit' && !monte ? `<p class="fp-alerte">${svg(I.warn)}${esc(r.ligne)}</p>` : ''}
    <section class="fp-offre${infini() ? ' fp-offre-infini' : ''}">
      ${monte ? `<button class="lnk fp-arriere" data-fp="licence">${svg(I.back)}Ma licence</button>` : niveaux()}
      <div class="fp-formules" role="radiogroup" aria-label="Formule">${formule('annuel')}${formule('mensuel')}</div>
      ${promo ? `<p class="fp-promo">${svg(I.tag)}<span>Code <b>${esc(promo)}</b> : posé sur la page de paiement</span></p>` : ''}
      ${accord()}
      ${payer(p, monte)}
      ${p.natif ? `<button class="lnk fp-restaurer" data-fp="restaurer" ${plus.envoi ? 'disabled' : ''}>${
        plus.envoi === 'restaurer' ? 'Recherche…' : 'Restaurer mes achats'}</button>` : ''}
      ${plus.err ? `<p class="fp-err" role="alert">${esc(plus.err)}</p>` : ''}
    </section>
    ${r.gerer && !monte ? actions(p) : ''}`;
}

function gauche(p) {
  if (plus.etape === 'merci') return merci();
  if (!offre) return `<section class="fp-licence fp-charge"><div class="fp-l-tete"><h2 class="fp-h2">Ma licence</h2></div></section>`;
  if (plus.monter && peutMonter()) return offreHtml(p);
  return resume(offre).payer ? offreHtml(p) : licenceHtml(p) + (plus.err ? `<p class="fp-err" role="alert">${esc(plus.err)}</p>` : '');
}

/* ---------- les avantages ---------- */
function avantagesHtml() {
  const prof = isProf(), gratuit = !offre || offre.offre === 'gratuit';
  const li = a => `<li><i class="fp-av-ic">${svg(I[a.ic] || I.check)}</i><span><b>${esc(a.t)}</b>${esc(prof && a.prof ? a.prof : a.s)}</span></li>`;
  const aInfini = offre && offre.niveau === 'infini';
  if ((gratuit && infini()) || aInfini || plus.monter) {
    return `<section class="fp-avantages fp-av-infini">
      <h2 class="fp-h2">${aInfini ? 'Tes avantages' : plus.monter ? 'Ce qu’Infini ajoute' : 'Ce que Mirandola Infini t’ouvre'}</h2>
      <ul class="fp-av">${AVANTAGES_INFINI.map(li).join('')}</ul>
      ${plus.monter ? '<p class="fp-et">Et tu gardes tout Mirandola+.</p>' : `<p class="fp-et">Et tout Mirandola+ :</p>
      <ul class="fp-av fp-av-court">${AVANTAGES_DETAIL.map(a => `<li><i class="fp-av-ic">${svg(I[a.ic] || I.check)}</i><span><b>${esc(a.t)}</b></span></li>`).join('')}</ul>`}
    </section>`;
  }
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
const raison = () => (plus.raison && RAISONS[plus.raison] && offre && (offre.offre === 'gratuit' || plus.monter)
  ? `<p class="fp-raison">${svg(I.spark)}${esc(RAISONS[plus.raison])}</p>` : '');

const titre = () => (offre && offre.offre === 'campus' ? 'Mirandola <em class="fp-campus">Campus</em>'
  : (offre && offre.niveau === 'infini') || (offre && (offre.offre === 'gratuit' || plus.monter) && infini()) ? 'Mirandola <em class="fp-infini">Infini</em>'
    : 'Mirandola<span class="fp-plus">+</span>');

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
  // un code qui n'est plus valable s'oublie : le prochain appui passe sans lui
  if (e.message === 'promo') {
    try { localStorage.removeItem('folio.promo'); } catch (x) { /* rien à oublier */ }
    plus.err = 'Ce code n’est plus valable : il est retiré, réessaie.';
  }
  if (e.message === 'deja' || e.message === 'campus') offrePull().then(() => { if (view.name === 'plus') render(); });
  render();
}

function vers(action) {
  if (plus.envoi) return;
  plus.envoi = action; plus.err = '';
  render();
  const p = ici();
  if (vente(p) === 'stripe') {
    return versStripe(action, commande(), plus.accord, action === 'payer' ? promoGardee() : '')
      .then(url => location.assign(url)).catch(echec);
  }
  /* l'achat intégré : la feuille d'Apple ou de Google s'ouvre par-dessus
     l'app, puis l'on revient ici — Mirandola+ s'active comme après Stripe */
  const geste = action === 'restaurer' ? restaurerAchats(p.os) : versMagasin(p.os, commande());
  geste.then(() => { plus.envoi = null; plus.etape = 'merci'; plus.attente = 0; render(); }).catch(echec);
}

const GESTES = {
  formule: b => { plus.formule = b.dataset.v === 'mensuel' ? 'mensuel' : 'annuel'; plus.err = ''; render(); },
  niveau: b => { plus.niveau = b.dataset.v === 'infini' ? 'infini' : 'plus'; plus.err = ''; render(); },
  monter: b => { Object.assign(plus, { monter: true, niveau: 'infini', formule: b.dataset.v === 'mensuel' ? 'mensuel' : 'annuel', err: '', accord: false }); render(); },
  licence: () => { Object.assign(plus, { monter: false, niveau: 'plus', err: '' }); render(); },
  payer: () => { if (plus.accord) vers('payer'); },
  accord: b => { plus.accord = !!b.checked; render(); },
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
