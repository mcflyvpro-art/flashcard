import { eleve, prefs, setAnimate, setCompte, view } from '../data/etat.js';
import { render } from '../ui/bibliotheque.js';
import { api } from './coeur-sync.js';

/* ══════════ « Mes classes », côté élève : ce qui part et ce qui revient ══════════
   Rejoindre passe toujours par la base (`class_preview`, `class_join`) : c'est
   elle qui compte les essais, vérifie l'établissement, et décide si l'élève
   entre ou attend. L'app n'affiche que sa réponse. */

const rpc = (nom, args) => api('/rest/v1/rpc/' + nom, 'POST', args || {});

/** Le message d'une erreur PostgREST (`{"message": …}`), sinon le texte brut.
    Ici plutôt que dans espace-prof.js, qui s'en sert aussi : l'espace
    professeur est chargé à la demande (ui/prof-porte.js), l'élève ne doit
    pas avoir à le télécharger pour lire un refus. */
export function messageErreur(e) {
  const t = String((e && e.message) || '');
  try { return JSON.parse(t).message || t; } catch (x) { return t; }   // pas du JSON : le texte tel quel
}

const enClasse = () => (eleve.classes || []).some(c => c.statut === 'inscrit' || c.statut === 'attente');

export async function eleveClassesPull() {
  const r = await Promise.allSettled([rpc('eleve_classes'), rpc('eleve_devoirs')]);
  const avant = enClasse();
  eleve.classes = r[0].status === 'fulfilled' ? r[0].value || [] : eleve.classes || [];
  eleve.devoirs = r[1].status === 'fulfilled' ? r[1].value || [] : eleve.devoirs || [];
  eleve.err = r.some(x => x.status === 'rejected') ? 1 : 0;
  /* Admis dans une classe (ou sorti) : l'onglet « Classe » apparaît (ou
     s'en va) sur l'écran d'accueil aussi, pas seulement dans le cercle. */
  if (view.name === 'classes' || view.name === 'commu' || (view.name === 'home' && avant !== enClasse())) { setAnimate(false); render(); }
}

/* La page d'une classe (migration 20261025210000) : ses professeurs, ses
   élèves et le lien d'amitié avec chacun ; la base décide ce qui se voit. */
export async function classePull(cid) {
  try { eleve.fiches[cid] = await rpc('eleve_classe', { cid }) || { statut: 'inconnue' }; }
  catch (e) { eleve.fiches[cid] = eleve.fiches[cid] || { statut: 'erreur' }; }
  if (view.name === 'classe') { setAnimate(false); render(); }
}

/** @returns {Promise<any>} la fiche (statut, nom, prof…) ou `null` */
export async function apercuCode(code) {
  const [r] = await rpc('class_preview', { join_code: code }) || [];
  return r || null;
}

export async function rejoindreCode(code, prenom, nom) {
  const [r] = await rpc('class_join', { join_code: code, son_prenom: prenom || '', son_nom: nom || '' }) || [];
  return r || null;
}

export const annulerDemande = cid => rpc('eleve_annuler', { cid });

export const quitterClasse = cid => rpc('eleve_quitter', { cid });

/** @returns {Promise<{ nom: string, matiere: string, cartes: any[] } | null>} */
export async function cartesDevoir(aid) {
  const [r] = await rpc('eleve_ouvrir_devoir', { aid }) || [];
  return r || null;
}

export async function comptePull() {
  try {
    const [r] = await rpc('mon_compte') || [];
    setCompte(r || null);
    /* Un compte à carte n'a pas d'e-mail lisible (identifiant@eleves.folio.invalid) :
       partout où l'app affiche « son nom », c'est celui de la classe. */
    if (r && r.gere && r.nom) prefs.name = r.nom;
  }
  catch (e) { /* hors ligne : on garde ce qu'on savait, la base verrouille de toute façon le nom */ }
}
