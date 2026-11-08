// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { I } from '../icones.js';
import { auth, cercle, duels, setDuelRun } from '../data/etat.js';
import { go } from './bibliotheque.js';
import { toast } from './import-cartes.js';

/* ---------- défis ----------
   Les questions sont figées à la création : tout le monde répond
   exactement aux mêmes, dans le même ordre. Sinon comparer les scores ne
   voudrait rien dire, et le paquet d'origine peut très bien changer
   ensuite. Un essai par personne, pour la même raison. */
export const myScore = id => (duels.scores || []).find(s => s.duel_id === id && s.user_id === auth.uid);

export const rankOf = id => (duels.scores || []).filter(s => s.duel_id === id)
  .sort((a, b) => b.score - a.score || a.ms - b.ms);

/* ---------- la porte de l'écran de jeu ----------
   L'écran d'une partie (ui/duel-jeu.js et sa feuille) se charge quand on
   lance la partie : rien d'autre ne doit l'importer. Le service worker le
   garde avec le reste, il s'ouvre aussi hors ligne. */
let jeu = null, chargement = null;
const charger = () => chargement || (chargement = import('./duel-jeu.js').then(m => (jeu = m)));

export async function duelStart(du) {
  if (myScore(du.id)) return;
  try { await charger(); }
  catch (e) { chargement = null; return toast(I.x, 'Défi indisponible pour l’instant'); }
  jeu.commencer(du);
}

// une adresse de partie rouverte sans partie en cours : retour d'où l'on venait
export function duelView() {
  if (jeu) return jeu.duelView();
  setDuelRun(null);
  const ret = cercle.retour || { name: 'commu' };
  return go(ret.name, ret.id);
}

export function duelPick(k) { if (jeu) jeu.duelPick(k); }
