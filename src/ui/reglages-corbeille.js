// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { $ } from '../racine.js';
import { cleTeinte } from '../couleurs.js';
import { couleurLibre } from '../matieres.js';
import { I, svg } from '../icones.js';
import { DAY, MIN } from '../fsrs.js';
import {
  accounts, auth, blocks, compte, db, iAmMod, me, mods, myRole, offre, online, prefs, ref,
  setSubjColor, setSubjEdit, setSubjName, shared, trash, vers, view
} from '../data/etat.js';
import { gestion, render } from './bibliotheque.js';
import { plain } from './carte-media.js';
import { atSchool, isAdmin } from './classement.js';
import {
  COLORS, PALETTE, canUndo, deck, esc, pending, plur, pushUndo, saveDeck,
  subj, sty, uid, undoLabel
} from '../core/coeur-sync.js';
import { KEEP, mePull, snapVersion } from '../core/reglages-corbeille.js';
import { offrePull } from '../core/abonnement.js';
import { VENTE_OUVERTE, resume } from '../abonnement.js';
import { sansFolioPlus } from './plus-porte.js';
import { hlp } from './connexion.js';
import { applyFont, savePrefs, toast } from './import-cartes.js';
import { closeMenu, openMenu } from './menus-a.js';
import { installed } from './onboarding.js';
import { norm } from './quiz.js';

/* ---------- réglages ---------- */
export function openSubject(id) {
  const t0 = db.subjects.find(x => x.id === id);
  /* Une matière posée par le professeur ne s'édite pas : elle sert de lien
     entre son cours et les livres de toute la classe. La base refuse déjà
     la modification comme l'effacement — ouvrir le formulaire ne ferait
     qu'annoncer un enregistrement qui n'aurait pas lieu. */
  if (t0 && t0.locked) return toast(I.lock, 'Matière du cours · posée par ton professeur');
  setSubjEdit(id);
  const t = t0;
  // une ancienne clé (corail, ambre) s'ouvre sur la teinte qui l'a remplacée
  setSubjColor(t ? cleTeinte(t.color) : couleurLibre(db.subjects, COLORS));
  setSubjName(t ? t.name : '');
  openMenu('subject');
}

/* La révision n'a plus de réglage du moteur (2026-10-25) : rétention, quota
   de pages neuves, ordre, mode simple, « Régler le moteur » — tout est figé
   sur les réglages d'Anki, qui marchent pour tout le monde, et le moteur se
   règle seul sur l'historique (fsrsAuto). Ne restent que l'objectif, le sens
   des pages et le mode rapide des exercices. */
function settingsRevisionHtml() {
  return `
      <div class="lbl"><span>Révision</span></div>
      <div class="slist">
        <div class="sr flat col">
          <div class="srh">${svg(I.target)}<span class="n">Objectif du jour</span>
            <span class="c">${prefs.goal} pages</span></div>
          <input class="rng" id="pGoal" type="range" min="5" max="200" step="5" value="${prefs.goal}"
            aria-label="Objectif du jour"></div>
        <button class="sr flat" data-act="tglboth">${svg(I.swap)}
          <span class="n">Mélanger les deux sens</span>
          <span class="tgl ${prefs.both ? 'on' : ''}"></span></button>
        <div class="srw"><button class="sr flat" data-act="tglfast">${svg(I.skip)}
          <span class="n">Mode rapide</span>
          <span class="tgl ${prefs.fast ? 'on' : ''}"></span></button>${hlp('fast')}</div>
      </div>`;
}

function settingsAffichageHtml(sansSons) {
  return `
      <div class="lbl"><span>Affichage</span></div>
      <div class="slist">
        <div class="sr flat col">
          <div class="srh">${svg(I.card)}<span class="n">Taille du texte</span>
            <span class="c">${Math.round((prefs.font || 1) * 100)} %</span></div>
          <input class="rng" id="pFont" type="range" min="80" max="140" step="5"
            value="${Math.round((prefs.font || 1) * 100)}" aria-label="Taille du texte">
          <div class="fprev" style="font-size:calc(17px * var(--fs,1))">Aperçu : la casa</div>
        </div>
        ${sansSons ? '' : `<button class="sr flat" data-act="tglsound">${svg(I.sound)}
          <span class="n">Sons</span>
          <span class="tgl ${prefs.sound ? 'on' : ''}"></span></button>`}
      </div>`;
}

function settingsMatieresHtml() {
  return `
      <div class="lbl"><span>Matières</span><span>${db.subjects.length}</span></div>
      <div class="slist">
        ${db.subjects.map(t => {
          const pal = PALETTE[t.color] || PALETTE.graphite;
          const n = db.decks.filter(d => d.subject === t.id).length;
          return `<button class="sr" data-sub="${t.id}" style="${sty(pal)}">
            <i></i><span class="n">${esc(t.name)}</span>
            <span class="c">${n || ''}</span>${svg(I.arrow)}</button>`;
        }).join('')}
        <button class="sr add" data-sub="">${svg(I.plus)}<span class="n">Nouvelle matière</span></button>
      </div>`;
}

/* La ligne « Mirandola+ » : à qui l'a déjà (abonnement, établissement, Mirandola+
   offert aux comptes d'avant le 2026-10-27), et à tous une fois la vente
   ouverte (VENTE_OUVERTE, src/abonnement.js). Jamais au référent, à
   l'éditeur ni dans la démo. */
function lignePlus() {
  if (sansFolioPlus() || !(VENTE_OUVERTE || (offre && offre.offre !== 'gratuit'))) return '';
  const r = offre ? resume(offre) : null;
  const etat = !r ? '' : r.cle === 'gratuit' ? 'Gratuit' : r.cle === 'campus' ? 'Campus'
    : offre.abonnement && offre.abonnement.source === 'offert' ? 'Offert' : offre.abonnement && offre.abonnement.finPrevue ? 'Résilié' : 'Actif';
  return `<button class="sr flat" data-act="plus">${svg(I.star)}<span class="n">Mirandola+</span>
          <span class="c">${esc(etat)}</span>${svg(I.arrow)}</button>`;
}

function settingsCompteHtml() {
  return `
      <div class="lbl"><span>Mon compte</span></div>
      <div class="slist">
        ${lignePlus()}
        <button class="sr flat" data-act="rename">${svg(I.user)}
          <span class="n">${esc(prefs.name || auth.email)}</span>${svg(I.arrow)}</button>
        <button class="sr flat" data-act="handle">${svg(I.hash)}<span class="n">Pseudo</span>
          <span class="c">${me && me.handle ? '@' + esc(me.handle) : ''}</span>${svg(I.arrow)}</button>
        <button class="sr flat" data-act="stats">${svg(I.chart)}<span class="n">Journal de lecture</span>${svg(I.arrow)}</button>
        <button class="sr flat" data-act="commu">${svg(I.users)}<span class="n">Le cercle des lecteurs</span>${svg(I.arrow)}</button>
        ${(myRole === 'eleve' || myRole === 'prof') && !atSchool() ? `<button class="sr flat" data-ce="ouvrir">${svg(I.key)}
          <span class="n">J’ai un code</span><span class="c">établissement, professeur</span>${svg(I.arrow)}</button>` : ''}
        <button class="sr flat" data-act="chpwd">${svg(I.lock)}<span class="n">Changer le mot de passe</span>${svg(I.arrow)}</button>
      </div>`;
}

/* Les lignes de rôle (référent, admin, modération) : chacune ne s'affiche
   qu'à qui elle concerne, séparées ici pour ne pas alourdir settingsView. */
function settingsRoleRowsHtml() {
  return (myRole === 'ref' && atSchool() ? `<button class="sr flat" data-act="ref">${svg(I.build)}
      <span class="n">Mon établissement</span>
      <span class="c">${ref.board ? esc(ref.board.org) : ''}</span>${svg(I.arrow)}</button>` : '')
    + (isAdmin() ? `<button class="sr flat" data-act="admin">${svg(I.key)}
      <span class="n">Administration</span>
      <span class="c">${accounts ? accounts.length : ''}</span>${svg(I.arrow)}</button>` : '')
    + (iAmMod ? `<button class="sr flat" data-act="mod">${svg(I.warn)}
      <span class="n">Signalements</span>
      <span class="c">${mods.list ? (mods.list.length || '') : ''}</span>${svg(I.arrow)}</button>` : '');
}

function settingsDonneesHtml() {
  return `
      <div class="lbl"><span>Mes données</span></div>
      <div class="slist">
        ${canUndo() ? `<button class="sr flat" data-act="undo2">${svg(I.redo)}
          <span class="n">Annuler ${esc(undoLabel().toLowerCase())}</span></button>` : ''}
        <button class="sr flat" data-act="trash">${svg(I.trash)}<span class="n">Corbeille</span>
          <span class="c">${trash.n || ''}</span>${svg(I.arrow)}</button>
        <button class="sr flat" data-act="tuto">${svg(I.play)}<span class="n">Revoir le tuto</span>${svg(I.arrow)}</button>
        ${installed() ? '' : `<button class="sr flat" data-act="install">${svg(I.plus)}
          <span class="n">Ajouter à l’écran d’accueil</span>${svg(I.arrow)}</button>`}
        ${settingsRoleRowsHtml()}
        <button class="sr flat" data-act="blocked">${svg(I.lock)}
          <span class="n">Comptes bloqués</span>
          <span class="c">${blocks && blocks.length ? blocks.length : ''}</span>${svg(I.arrow)}</button>
        <button class="sr flat" data-legal="cgu">${svg(I.file)}
          <span class="n">Conditions et confidentialité</span>${svg(I.arrow)}</button>
      </div>`;
}

function settingsQuitterHtml() {
  return `
      <div class="lbl"><span>Quitter</span></div>
      <div class="slist">
        <button class="sr flat warn" data-act="logout">${svg(I.exit)}<span class="n">Se déconnecter</span></button>
        <button class="sr flat warn" data-act="delacc">${svg(I.trash)}<span class="n">Supprimer le compte</span></button>
      </div>
      <div class="foot">${pending()
        ? plur(pending(), 'modification') + ' en attente' + (online ? ' d’envoi' : ' — reprise dès le retour du réseau')
        : online ? 'Synchronisé' : 'Hors ligne — rien en attente'}</div>`;
}

/* Le référent et l'éditeur ne révisent pas : leur compte (son nom vient de
   l'établissement, il ne se change pas d'ici), l'affichage, les textes du
   cadre, et c'est tout — ni objectif, ni matières, ni corbeille, ni sons. */
function settingsGestionHtml() {
  return `
      <div class="lbl"><span>Mon compte</span></div>
      <div class="slist">
        <div class="sr flat fixe">${svg(I.user)}<span class="n">${esc((compte && compte.nom) || prefs.name || '')}</span>
          <span class="c">${esc(auth.email || '')}</span></div>
        <button class="sr flat" data-act="handle">${svg(I.hash)}<span class="n">Pseudo</span>
          <span class="c">${me && me.handle ? '@' + esc(me.handle) : ''}</span>${svg(I.arrow)}</button>
        <button class="sr flat" data-act="chpwd">${svg(I.lock)}<span class="n">Changer le mot de passe</span>${svg(I.arrow)}</button>
        ${myRole === 'ref' ? `<button class="sr flat" data-act="tuto">${svg(I.play)}<span class="n">Revoir le tuto</span>${svg(I.arrow)}</button>` : ''}
        ${installed() ? '' : `<button class="sr flat" data-act="install">${svg(I.plus)}
          <span class="n">Ajouter à l’écran d’accueil</span>${svg(I.arrow)}</button>`}
        <button class="sr flat" data-legal="cgu">${svg(I.file)}
          <span class="n">Conditions et confidentialité</span>${svg(I.arrow)}</button>
      </div>`;
}

export function settingsView() {
  // le pseudo de la ligne « Pseudo » : lu une fois, l'écran se repeint à son arrivée
  if (!me && auth) mePull().then(() => { if (view.name === 'settings') render(); });
  // l'offre du compte, pour la ligne « Mirandola+ » : lue une fois, comme le pseudo
  if (!offre && auth && !sansFolioPlus()) offrePull().then(() => { if (view.name === 'settings') render(); });
  const sections = gestion() ? [settingsGestionHtml, () => settingsAffichageHtml(true), settingsQuitterHtml]
    : [settingsRevisionHtml, settingsAffichageHtml, settingsMatieresHtml, settingsCompteHtml, settingsDonneesHtml, settingsQuitterHtml];
  $.innerHTML = `
    <div class="bar"><button class="ic" data-act="home" aria-label="Retour">${svg(I.back)}</button></div>
    <div class="page">
      <div class="top"><div class="hero">Réglages</div></div>
      <div class="rg-grille">${sections.map(f => `<section class="rg">${f()}</section>`).join('')}</div>
    </div>`;
  const g = document.getElementById('pGoal');
  if (g) g.addEventListener('input', () => {
    prefs.goal = +g.value; savePrefs();
    g.closest('.sr').querySelector('.c').textContent = prefs.goal + ' pages';
  });
  const fo = document.getElementById('pFont');
  if (fo) fo.addEventListener('input', () => {
    prefs.font = +fo.value / 100; savePrefs(); applyFont();
    fo.closest('.sr').querySelector('.c').textContent = fo.value + ' %';
  });
}

const leftFor = iso => Math.max(0, KEEP - Math.floor((Date.now() - Date.parse(iso)) / DAY));

export function trashView() {
  const l = trash.list;
  $.innerHTML = `
    <div class="bar"><button class="ic" data-act="settings" aria-label="Retour">${svg(I.back)}</button></div>
    <div class="page">
      <div class="top"><div class="hero">Corbeille</div></div>
      <div class="note">Gardés ${KEEP} jours, pages et progression comprises.</div>
      ${!l ? `<div class="empty">${svg(I.clock)}<p>${trash.err ? 'Corbeille indisponible' : 'Chargement…'}</p></div>`
        : !l.length ? `<div class="empty">${svg(I.trash)}<p><b>Corbeille vide</b></p></div>`
        : `<div class="slist">${l.map(t => {
            const s = subj(t.subject), d = leftFor(t.at);
            return `<div class="sr flat col trr" style="${sty(s)}">
              <div class="srh"><i class="tri"></i><span class="n">${esc(t.name)}</span>
                <span class="c">${t.cards} carte${t.cards > 1 ? 's' : ''}</span></div>
              <div class="trf">
                <span class="trd ${d <= 3 ? 'soon' : ''}">${d
                  ? 'Encore ' + d + ' jour' + (d > 1 ? 's' : '') : 'Part aujourd’hui'}</span>
                <button class="trb" data-trr="${t.id}">${svg(I.redo)}Restaurer</button>
                <button class="trb warn" data-trd="${t.id}">${svg(I.trash)}Supprimer</button>
              </div></div>`;
          }).join('')}</div>`}
    </div>`;
}

export function timeAgo(iso) {
  const ms = Date.now() - Date.parse(iso);
  if (ms < MIN) return 'à l’instant';
  if (ms < 60 * MIN) return Math.round(ms / MIN) + ' min';
  if (ms < DAY) return Math.round(ms / (60 * MIN)) + ' h';
  const j = Math.round(ms / DAY);
  return j < 31 ? j + ' j' : Math.round(j / 30) + ' mois';
}

/* ---------- la porte du courrier ----------
   La boîte et les lettres vivent dans ui/courrier.js, chargé à la demande
   avec sa feuille de style (le démarrage n'a pas de marge, tools/budget.js).
   Rien d'autre ne doit importer ui/courrier.js. */
let courrier = null, chargeCourrier = null;

/* Le morceau, chargé une fois : au calme dès l'arrivée (ui/synchro-ecran.js),
   ou au premier toucher s'il n'est pas encore là. */
export function prechargerCourrier() {
  if (courrier) return Promise.resolve(courrier);
  if (!chargeCourrier) {
    chargeCourrier = import('./courrier.js').then(m => (courrier = m)).catch(e => { chargeCourrier = null; throw e; });
  }
  return chargeCourrier;
}

function attendreCourrier() {
  $.innerHTML = `<div class="page"><div class="top"><div class="hero">Courrier</div></div>
    <div class="empty">${svg(I.mail)}<p>Chargement…</p></div></div>`;
  prechargerCourrier().then(() => {
    if (view.name === 'mail' || view.name === 'lettre') render();
  }).catch(() => toast(I.x, 'Le courrier n’a pas pu s’ouvrir : vérifie ta connexion'));
}
export const mailView = () => (courrier ? courrier.boiteView() : attendreCourrier());
export const lettreView = () => (courrier ? courrier.lettreView() : attendreCourrier());

export const cf = c => Array.isArray(c) ? c[0] : ((c && c.f) || '');

export const cb = c => Array.isArray(c) ? c[1] : ((c && c.b) || '');

export function versRestore(vid) {
  const v = (vers.list || []).find(x => x.id === vid);
  const d = deck(vers.of);
  if (!v || !d) return closeMenu();
  pushUndo('Restauration', [d.id]);
  snapVersion(d, 'avant restauration');
  /* La progression suit la carte, pas son texte : une version garde
     l'identifiant de chaque carte, donc restaurer un libellé — même après
     un remplacement en masse qui a réécrit les deux faces — ne remet pas à
     zéro trois semaines de révision. Le recto sert de repêchage pour les
     versions enregistrées avant que les identifiants ne soient gardés. */
  const byId = new Map(d.cards.map(c => [c.id, c]));
  const byF = new Map(d.cards.map(c => [norm(plain(c.f)), c]));
  d.cards = v.cards.map(([f, b, id]) => {
    const old = (id && byId.get(id)) || byF.get(norm(plain(f)));
    return old ? { ...old, f, b } : { id: id || uid(), f, b };
  });
  saveDeck(d); closeMenu(); render();
  toast(I.redo, plur(d.cards.length, 'page') + ' restaurée' + (d.cards.length > 1 ? 's' : ''), true);
}

export function sharedView() {
  const s = shared || {}, d = s.d, cards = d ? (d.cards || []) : [];
  $.innerHTML = `
    <div class="bar"><button class="ic" data-act="home" aria-label="Retour">${svg(I.back)}</button>
      <h1>Livre partagé</h1></div>
    <div class="page">
      ${s.st === 'load' ? `<div class="empty">${svg(I.link)}<p>Ouverture du lien…</p></div>`
      : s.st !== 'ok' ? `<div class="empty">${svg(I.warn)}<p><b>${s.st === 'gone' ? 'Lien révoqué' : 'Lien illisible'}</b>${
          s.st === 'gone' ? 'Ce livre n’est plus prêté.' : 'Réessaie une fois en ligne.'}</p></div>`
      : `<div class="top"><div class="hero">${esc(d.name)}</div></div>
        <button class="cta" data-act="addshared">${svg(I.plus)}Ajouter à ma bibliothèque</button>
        <div class="rows">${cards.slice(0, 300).map(c => `<div class="pr">
          <span class="a">${esc(plain(cf(c)))}</span>${svg(I.arrow)}<span class="b">${esc(plain(cb(c)))}</span>
          </div>`).join('')}</div>`}
    </div>`;
}
