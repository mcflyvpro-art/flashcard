import { I } from '../icones.js';
import { shuffle } from '../file.js';
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

export async function duelsPull() {
  try {
    const [ds, sc] = await Promise.all([
      api('/rest/v1/duels?select=id,owner,who,name,total,cards,group_id,created_at&order=created_at.desc&limit=40'),
      api('/rest/v1/duel_scores?select=duel_id,user_id,who,score,ms')
    ]);
    duels.list = ds || []; duels.scores = sc || []; duels.err = 0;
  } catch (e) { duels.err = 1; }
  if (/^(commu|friends|club|classes)$/.test(view.name)) { setAnimate(false); render(); }
}

/* Un défi « à son rythme » : à mes amis (ni club ni classe), à un club, ou
   à une classe (professeur). Renvoie vrai s'il est lancé. */
export async function duelMake(d, ou = {}) {
  const uniq = [];
  for (const c of d.cards) {
    const b = plain(c.b).trim();
    if (b && !uniq.some(x => x[1] === b)) uniq.push([plain(c.f).trim(), b]);
  }
  if (uniq.length < 4) { closeMenu(); toast(I.x, 'Il faut 4 réponses différentes'); return false; }
  const cards = shuffle(uniq.slice()).slice(0, DUELQ);
  closeMenu();
  try {
    await api('/rest/v1/duels', 'POST',
      [{ deck_id: d.id, owner: auth.uid, who: prefs.name || (me && me.handle) || 'Compte',
         name: d.name, total: cards.length, cards, group_id: ou.club || null, class_id: ou.classe || null }],
      { Prefer: 'return=minimal' });
    duels.list = null; duelsPull();
    toast(I.bolt, 'Défi lancé · ' + plur(cards.length, 'question'));
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
  duels.open = r.id;
  const ret = cercle.retour || { name: 'commu' };
  go(ret.name, ret.id); openMenu('duelitem');
  try {
    await api('/rest/v1/duel_scores', 'POST', [row],
      { Prefer: 'resolution=merge-duplicates,return=minimal' });
  } catch (e) { toast(I.x, 'Score non enregistré'); }
}
