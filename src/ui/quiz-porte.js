// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { $ } from '../racine.js';
import { I } from '../icones.js';
import { view } from '../data/etat.js';
import { render } from './bibliotheque.js';
import { toast } from './import-cartes.js';
import { chargeur } from './chargeur.js';

/* ══════════ la porte de la récitation (2026-11-18) ══════════
   La récitation d'un paquet (ui/quiz.js : la réponse tapée ou dictée, la
   marge d'erreur, le chrono, la série) arrive à la demande, préchauffée au
   calme après l'accueil. Ses gestes ne se font que sur son écran : son
   morceau est forcément là. Rien d'autre ne doit importer ui/quiz.js. */
let mod = null, demande = null;

export function chargerQuiz() {
  if (mod) return Promise.resolve(mod);
  if (!demande) demande = import('./quiz.js').then(m => (mod = m)).catch(e => { demande = null; throw e; });
  return demande;
}

const panne = () => toast(I.x, 'La récitation n’a pas pu s’ouvrir : vérifie ta connexion');

// le second argument de then : seule une panne de chargement se dit « connexion » ; une erreur de l'écran remonte telle quelle
export const startQuiz = (id, pool, rev, opt) => chargerQuiz().then(m => m.startQuiz(id, pool, rev, opt), panne);

export function quizView() {
  if (mod) return mod.quizView();
  $.innerHTML = `<div class="page">${chargeur()}</div>`;
  chargerQuiz().then(() => { if (view.name === 'run') render(); }, panne);
}

export const stopTimer = () => { if (mod) mod.stopTimer(); };
export const dictate = () => mod && mod.dictate();
export const fail = () => mod && mod.fail();
export const submit = () => mod && mod.submit();
export const pickQuiz = k => mod && mod.pickQuiz(k);
export const nextQ = () => mod && mod.nextQ();
