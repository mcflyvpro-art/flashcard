import { I } from '../icones.js';
import { JEUX, jeuRythme, questionsRythme } from '../defi.js';
import {
  auth, cercle, duelRun, duels, me, prefs, setAnimate, setDuelRun, view
} from '../data/etat.js';
import { go, render } from '../ui/bibliotheque.js';
import { plain } from '../ui/carte-media.js';
import { api, plur } from './coeur-sync.js';
import { toast } from '../ui/import-cartes.js';
import { closeMenu, openMenu } from '../ui/menus-a.js';

/* ---------- défis ----------
   Les questions sont figées à la création : tout le monde répond
   exactement aux mêmes, dans le même ordre. Sinon comparer les scores ne
   voudrait rien dire, et le paquet d'origine peut très bien changer
   ensuite. Un essai par personne, pour la même raison. */
export const DUELQ = 10;

/* Mes scores qui partent : gardés tant que la base ne les rend pas. Une
   relecture des défis lancée avant l'envoi (le retour sur « Mes amis » en
   relit) revenait sans eux : à la fin d'une partie, le classement disait
   « Personne n'a encore joué » et proposait de rejouer (trouvé le
   2026-11-07 par e2e/cercle.e2e.js). */
const enAttente = new Map();

// `bg` : relecture de fond, l'écran n'est repeint que si les défis ont changé
let sigDefis = '';
export async function duelsPull(bg) {
  try {
    const [ds, sc] = await Promise.all([
      api('/rest/v1/duels?select=id,owner,who,name,total,cards,jeu,group_id,created_at&order=created_at.desc&limit=40'),
      api('/rest/v1/duel_scores?select=duel_id,user_id,who,score,ms')
    ]);
    const scores = sc || [];
    for (const [id, row] of enAttente) {
      if (scores.some(x => x.duel_id === id && x.user_id === row.user_id)) enAttente.delete(id);
      else scores.push(row);
    }
    duels.list = ds || []; duels.scores = scores; duels.err = 0;
  } catch (e) { duels.err = 1; }
  const sig = JSON.stringify([duels.list, duels.scores, duels.err]);
  if (bg && sig === sigDefis) return;
  sigDefis = sig;
  if (/^(commu|friends|club|classes)$/.test(view.name)) { setAnimate(false); render(); }
}

/* Un défi « à son rythme » : à mes amis (ni club ni classe), à un club, ou
   à une classe (professeur). Le jeu et le nombre de questions se choisissent
   (2026-11-07 ; avant, toujours un QCM de 10) ; les questions se figent ici,
   par src/defi.js. Renvoie vrai s'il est lancé. */
export async function duelMake(d, ou = {}, reglage = {}) {
  const jeu = jeuRythme(reglage.jeu);
  const cartes = d.cards.filter(c => !c.x).map(c => ({ f: plain(c.f), b: plain(c.b) }));
  const cards = questionsRythme(cartes, jeu, reglage.n || DUELQ);
  if (!cards.length) {
    closeMenu();
    toast(I.x, jeu === 'qcm' ? 'Il faut 4 réponses différentes' : jeu === 'vf' ? 'Il faut 2 réponses différentes' : 'Ce paquet est vide');
    return false;
  }
  closeMenu();
  try {
    await api('/rest/v1/duels', 'POST',
      [{ deck_id: d.id, owner: auth.uid, who: prefs.name || (me && me.handle) || 'Compte',
         name: d.name, total: cards.length, cards, jeu, group_id: ou.club || null, class_id: ou.classe || null }],
      { Prefer: 'return=minimal' });
    duels.list = null; duelsPull();
    toast(I.bolt, `Défi lancé · ${plur(cards.length, 'question')} · ${JEUX[jeu].nom}`);
    return true;
  } catch (e) { toast(I.x, 'Défi impossible'); return false; }
}


export async function duelDrop(id) {
  duels.list = (duels.list || []).filter(x => x.id !== id);
  closeMenu(); render();
  try { await api('/rest/v1/duels?id=eq.' + encodeURIComponent(id), 'DELETE', null, { Prefer: 'return=minimal' }); }
  catch (e) { toast(I.x, 'Suppression impossible'); }
}

export async function duelEnd() {
  const r = duelRun; if (!r) return;
  const row = { duel_id: r.id, user_id: auth.uid, who: prefs.name || (me && me.handle) || 'Compte',
                score: r.score, ms: Date.now() - r.t0 };
  setDuelRun(null);
  duels.scores = (duels.scores || []).filter(s => !(s.duel_id === row.duel_id && s.user_id === auth.uid));
  duels.scores.push(row);
  enAttente.set(row.duel_id, row);
  duels.open = r.id;
  const ret = cercle.retour || { name: 'commu' };
  go(ret.name, ret.id); openMenu('duelitem');
  try {
    await api('/rest/v1/duel_scores', 'POST', [row],
      { Prefer: 'resolution=merge-duplicates,return=minimal' });
  } catch (e) { enAttente.delete(row.duel_id); toast(I.x, 'Score non enregistré'); }
}
