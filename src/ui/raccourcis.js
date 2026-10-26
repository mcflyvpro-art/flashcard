// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { I } from '../icones.js';
import {
  mailbox, menu, pendingGrade, prefs, setLegalBack, setLegalTab, setLoginMode, setPendingGrade, study, view
} from '../data/etat.js';
import { allDue, go } from './bibliotheque.js';
import { commuPull } from './cercle.js';
import { canUndo, doUndo } from '../core/coeur-sync.js';
import { statsPull } from '../core/ecran-groupe.js';
import { toast } from './import-cartes.js';
import { closeMenu } from './menus-a.js';
import { mailPull } from '../core/reglages-corbeille.js';
import { resetComp } from './creation.js';
import {
  answerTF, cardOf, fling, isTF, pickMCQ, startStudy, toggleFlip
} from './revision.js';

/* ---------- raccourcis clavier pendant une révision ---------- */
const keyIsEditing = e => /INPUT|TEXTAREA/.test(e.target.tagName) || e.target.isContentEditable;

function keyUndo(e) {
  if (!((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !keyIsEditing(e))) return false;
  if (canUndo()) { e.preventDefault(); doUndo(); }
  return true;
}

function keyStudyTF(e) {                             // vrai / faux : v ou f
  if (e.key === 'v' || e.key === 'V' || e.key === 'ArrowLeft') return answerTF(true);
  if (e.key === 'f' || e.key === 'F' || e.key === 'ArrowRight') return answerTF(false);
}

function keyStudyMcq(e) {
  if (!'1234'.includes(e.key)) return;
  const k = +e.key - 1; if (study.opts && k < study.opts.length) pickMCQ(k);
}

function keyStudyFlip(e) {
  if (!(study.flip && !study.simple && '1234'.includes(e.key))) return false;
  setPendingGrade(+e.key - 1);
  fling(pendingGrade > 0 ? 1 : -1);
  return true;
}

function keyStudyNav(e) {
  if (e.key === 'ArrowLeft') fling(-1);
  else if (e.key === 'ArrowRight') fling(1);
  else if (e.key === ' ') { e.preventDefault(); toggleFlip(); }
}

function handleStudyKey(e) {
  if (!study) return;
  if (study.mode === 'match') return;
  if (isTF(cardOf(0))) return keyStudyTF(e);
  if (study.mode === 'mcq') return keyStudyMcq(e);
  if (keyStudyFlip(e)) return;
  keyStudyNav(e);
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && menu) return closeMenu();
  if (keyUndo(e)) return;
  if (view.name !== 'study' || keyIsEditing(e)) return;
  handleStudyKey(e);
});

/* ---------- raccourcis d'ouverture ----------
   « ?go=… » ouvre l'app à un endroit précis : c'est ce que le manifeste
   déclare pour le menu d'appui long sur l'icône. Le paramètre est retiré
   aussitôt, pour que recharger la page ne rejoue pas l'action. */
const GOTO = {
  study: () => { if (!allDue()) { go('home'); return toast(I.check, 'Rien à revoir pour l’instant'); }
                 startStudy('all', false, null, { only: 'due', both: prefs.both }); },
  new: () => { resetComp(); go('import'); },
  mail: () => { mailbox.list = null; mailPull(); go('mail'); },
  commu: () => { commuPull(); go('commu'); },
  stats: () => { statsPull(); go('stats'); }
};

/* Les portes de l'écran de connexion, pour les boutons de la page d'accueil
   du site (index.html, servie à la racine ; l'app est à /app) : « Créer un
   compte », « Carte élève », « Essayer sans compte », « Demander une démo »
   et les textes du cadre. Sans session seulement — la page d'accueil envoie
   déjà dans l'app qui en a une. Rend l'écran à ouvrir, ou rien. */
const legal = k => () => { setLegalTab(k); setLegalBack('login'); return 'legal'; };
const PORTES = {
  inscription: () => { setLoginMode('up'); return 'login'; },
  carte: () => { setLoginMode('carte'); return 'login'; },
  essai: () => 'decouvrir',
  demo: () => 'demande',
  cgu: legal('cgu'), vie: legal('vie'), mentions: legal('mentions')
};

export function consumePorte() {
  const q = new URLSearchParams(location.search).get('go');
  if (!q || !PORTES[q]) return null;
  history.replaceState(null, '', location.pathname + location.hash);
  return PORTES[q]();
}

export function consumeGoto() {
  const q = new URLSearchParams(location.search).get('go');
  if (!q || !GOTO[q]) return false;
  history.replaceState(null, '', location.pathname + location.hash);
  try { GOTO[q](); } catch (e) { go('home'); }
  return true;
}
