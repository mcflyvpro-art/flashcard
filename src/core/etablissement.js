import { I } from '../icones.js';
import { menu, prof, setAnimate, view } from '../data/etat.js';
import { render } from '../ui/bibliotheque.js';
import { api } from './coeur-sync.js';
import { toast } from '../ui/import-cartes.js';
import { paintMenu } from '../ui/menus-a.js';

/* ---------- ce qu'on va chercher ---------- */
export async function profPull() {
  try {
    if (!prof.annees) {
      prof.annees = await api('/rest/v1/rpc/prof_annees', 'POST', {}) || [];
      const c = prof.annees.find(a => a.courante) || prof.annees[0];
      if (!prof.annee && c) prof.annee = c.annee;
    }
    prof.classes = await api('/rest/v1/rpc/prof_classes', 'POST',
      { annee: prof.annee }) || [];
    prof.err = 0;
  } catch (e) { prof.classes = prof.classes || []; prof.err = 1; }
  if (/^prof/.test(view.name)) { setAnimate(false); render(); }
}

export async function profClassePull(cid) {
  try {
    const [r, d] = await Promise.all([
      api('/rest/v1/rpc/prof_roster', 'POST', { cid }),
      api('/rest/v1/rpc/prof_devoirs', 'POST', { cid })
    ]);
    prof.roster = r || []; prof.devoirs = d || [];
  } catch (e) { prof.roster = prof.roster || []; prof.devoirs = prof.devoirs || []; }
  if (/^prof/.test(view.name)) { setAnimate(false); render(); }
}

export async function profFichePull(cid, qui) {
  try { prof.fiche = await api('/rest/v1/rpc/prof_eleve', 'POST', { cid, qui }) || []; }
  catch (e) { prof.fiche = []; }
  if (view.name === 'profeleve') { setAnimate(false); render(); }
}

export async function profCartesPull(aid) {
  try { prof.cartes = await api('/rest/v1/rpc/prof_cartes', 'POST', { aid }) || []; }
  catch (e) { prof.cartes = []; }
  if (menu) paintMenu();
}

/* Les cartes telles qu'envoyées avec le devoir — `assignments.cards`, un
   instantané pris au moment du « Donner » (voir compDonner dans
   src/ui/bilan-devoirs.js). Rien à voir avec `prof_cartes` ci-dessus, qui
   ne renvoie que des statistiques d'erreur (recto/verso/ratees/vues) pour
   le panneau « Ce qui bloque » : redonner le devoir a besoin du contenu
   entier, pas de ses statistiques.
   Passe par une RPC (`prof_assignment_cards`, migration
   20260920140000) et non par un SELECT PostgREST direct sur `assignments` :
   la politique `asg_read` n'autorise que l'élève inscrit ou le propriétaire
   de la classe, pas le professeur de matière qui l'enseigne sans la
   posséder (`teaches`, via `teachings`) — RLS aurait filtré la ligne en
   silence pour ce cas-là, sans jamais lever d'erreur. */
export async function profAssignmentCartes(aid) {
  return await api('/rest/v1/rpc/prof_assignment_cards', 'POST', { aid }) || [];
}

/* ---------- écrire ---------- */
export async function profDo(rpc, args, bon) {
  try {
    const r = await api('/rest/v1/rpc/' + rpc, 'POST', args);
    /* On rafraîchit sans vider : `profClasseView` cherche sa classe dans
       `prof.classes` et repart au tableau de bord quand elle n'y est pas.
       La vider une demi-seconde suffisait donc à éjecter le professeur de
       la classe qu'il regardait, juste après avoir donné son devoir. */
    profPull();
    if (prof.open) profClassePull(prof.open);
    if (bon) toast(I.check, typeof bon === 'function' ? bon(r) : bon);
    return r === null || r === undefined ? true : r;
  } catch (e) {
    toast(I.x, String((e && e.message) || '').slice(0, 90) || 'Impossible pour l’instant');
    return null;
  }
}
