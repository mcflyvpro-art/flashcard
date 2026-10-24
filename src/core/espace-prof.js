import { I } from '../icones.js';
import { dansJours, iso } from '../classe.js';
import { auth, menu, online, prof, setAnimate, view } from '../data/etat.js';
import { render } from '../ui/bibliotheque.js';
import { api } from './coeur-sync.js';
import { messageErreur } from './eleve-classes.js';
import { toast } from '../ui/import-cartes.js';
import { paintMenu } from '../ui/menus-a.js';

/* ══════════ l'espace professeur : ce qui part et ce qui revient ══════════
   Tout passe par les fonctions de la base (migrations 20261024…) : elles
   vérifient qui appelle, et leurs refus sont des phrases écrites pour être
   lues. Aucune écriture de gestion ne passe par la file hors ligne (règle 5
   de CLAUDE.md) : admettre un élève, changer un code ou retirer quelqu'un
   n'a de sens que contre l'état réel de la classe, au moment où on le fait.
   Hors ligne, on le dit et on ne fait rien, plutôt que de rejouer plus tard
   une décision prise sur un écran périmé. */

const rpc = (nom, args) => api('/rest/v1/rpc/' + nom, 'POST', args || {});

/* Repeindre l'espace professeur, mais jamais sous les doigts de quelqu'un
   qui tape : une liste rafraîchie pendant qu'on écrit dans la recherche ou
   dans une feuille effacerait la saisie. Sous une feuille ouverte, la page
   attend sa fermeture (`feuille-fermee`, menus-a.js) ; la feuille elle-même
   n'est repeinte que si ce qui arrive la concerne (`feuille`). */
export function repeindre(feuille) {
  const a = document.activeElement;
  const tape = a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName);
  if (menu) { prof.sale = true; if (feuille && menu === 'pf' && !tape) paintMenu(); return; }
  if (tape) { prof.sale = true; return; }
  if (/^prof/.test(view.name)) { prof.sale = false; setAnimate(false); render(); }
}

document.addEventListener('feuille-fermee', () => {
  if (prof.sale && /^prof/.test(view.name)) repeindre();
});

/* ---------- lire ---------- */
export async function profPull() {
  try {
    if (!prof.annees) {
      prof.annees = await rpc('prof_annees') || [];
      const c = prof.annees.find(a => a.courante) || prof.annees[0];
      if (!prof.annee && c) prof.annee = c.annee;
    }
    prof.classes = await rpc('prof_classes', { annee: prof.annee }) || [];
    prof.err = 0;
  } catch (e) { prof.classes = prof.classes || []; prof.err = 1; }
  repeindre();
}

const valeur = (r, avant) => (r.status === 'fulfilled' ? r.value || [] : avant || []);

export async function classePull(cid) {
  const r = await Promise.allSettled([
    rpc('prof_roster', { cid }), rpc('prof_devoirs', { cid }),
    rpc('prof_demandes', { cid }), rpc('prof_equipe', { cid })
  ]);
  if (prof.open !== cid) return;                 // le professeur a déjà changé de classe
  prof.roster = valeur(r[0], prof.roster); prof.devoirs = valeur(r[1], prof.devoirs);
  prof.demandes = valeur(r[2], prof.demandes); prof.equipe = valeur(r[3], prof.equipe);
  repeindre();
}

/* La salle d'attente se relit seule tant qu'elle est à l'écran : rend
   `true` si quelqu'un est arrivé ou parti, pour ne repeindre qu'alors. */
export async function demandesPull(cid) {
  try {
    const l = await rpc('prof_demandes', { cid }) || [];
    const avant = (prof.demandes || []).map(d => d.user_id).join();
    if (prof.open !== cid) return false;
    prof.demandes = l;
    const c = (prof.classes || []).find(x => x.id === cid);
    if (c) c.attente = l.length;
    return l.map(d => d.user_id).join() !== avant;
  } catch (e) { return false; }                  // panne passagère : le prochain tour réessaie
}

export async function exclusPull(cid) {
  try { prof.exclus = await rpc('prof_exclus', { cid }) || []; } catch (e) { prof.exclus = []; }
  repeindre();
}

export async function fichePull(cid, qui) {
  try { prof.fiche = await rpc('prof_eleve', { cid, qui }) || []; } catch (e) { prof.fiche = []; }
  repeindre();
}

export async function cartesBloquePull(aid) {
  try { prof.cartes = await rpc('prof_cartes', { aid }) || []; } catch (e) { prof.cartes = []; }
  repeindre();
}

export async function agendaPull(du, au) {
  try { prof.agenda = await rpc('prof_agenda', { du, au }) || []; } catch (e) { prof.agenda = []; }
  repeindre();
}

/* Les sept jours qui viennent, pour l'accueil. */
export async function semainePull() {
  try { prof.semaine = await rpc('prof_agenda', { du: iso(new Date()), au: dansJours(6) }) || []; }
  catch (e) { prof.semaine = []; }
  repeindre();
}

/* Les cartes telles qu'elles ont été données (instantané pris au moment du
   « Donner »), pour redonner un devoir ou en tirer un défi : le livre
   d'origine a pu changer ou disparaître depuis. */
export const cartesDuDevoir = aid => rpc('prof_assignment_cards', { aid }).then(r => r || []);

/* Un code collègue : `class_preview` montre la classe, `class_join` fait
   entrer dans son équipe. La base décide (rôle, établissement, durée) et
   compte les essais comme pour un élève. */
export async function codeCollegue(code, entrer) {
  const [r] = await rpc(entrer ? 'class_join' : 'class_preview', { join_code: code }) || [];
  return r || null;
}

/* Un défi de classe : les questions sont figées à la création (voir
   core/defis.js), visible des seuls membres de la classe (RLS de `duels`). */
export const defiClasse = ({ classe, nom, cartes, qui }) => api('/rest/v1/duels', 'POST',
  [{ deck_id: null, owner: auth.uid, who: qui, name: nom, total: cartes.length, cards: cartes, class_id: classe }],
  { Prefer: 'return=minimal' });

/* ---------- écrire ---------- */
export async function ecrire(nom, args, bon) {
  if (!online) { toast(I.cloud, 'Hors ligne : réessaie une fois connecté'); return null; }
  try {
    const r = await rpc(nom, args);
    if (bon) toast(I.check, typeof bon === 'function' ? bon(r) : bon);
    return r === null || r === undefined ? true : r;
  } catch (e) {
    toast(I.x, messageErreur(e).slice(0, 140) || 'Impossible pour l’instant');
    return null;
  }
}

/* Après une écriture : la liste des classes et la classe ouverte sont
   relues, sans être vidées (vider éjecterait le professeur de l'écran qu'il
   regarde pendant l'aller-retour). */
export function relire() {
  profPull();
  if (prof.open) classePull(prof.open);
}
