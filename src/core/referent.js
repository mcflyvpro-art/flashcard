import { I } from '../icones.js';
import { online, ref, setAnimate, view } from '../data/etat.js';
import { render } from '../ui/bibliotheque.js';
import { toast } from '../ui/import-cartes.js';
import { api } from './coeur-sync.js';
import { messageErreur } from './eleve-classes.js';

/* ══════════ la console du référent : ce qui part et ce qui revient ══════════
   Chargé avec la console (ui/ref-console.js, à la demande). Tout passe par
   les fonctions ref_* de la base, qui vérifient elles-mêmes l'établissement
   (20261024113815, 20261026001000, 20261026020000) ; rien ici ne décide qui
   a le droit. Une écriture refuse hors ligne : une décision de gestion se
   prend contre l'état réel de l'établissement, comme dans l'espace
   professeur. */

const rpc = (nom, args) => api('/rest/v1/rpc/' + nom, 'POST', args || {});
const repeint = () => { if (view.name === 'ref') { setAnimate(false); render(); } };

export const PAGE = 60;

async function lire(champ, nom, args, vide) {
  try { ref[champ] = await rpc(nom, args); } catch (e) { ref[champ] = vide; ref.err = 1; }
}

export async function refCodesPull() {
  await lire('codes', 'ref_codes', {}, false);
  repeint();
}

export async function refClassesPull() {
  await lire('classes', 'ref_classes', {}, []);
  repeint();
}

export async function refTableauPull() {
  try { const [r] = await rpc('ref_dashboard') || []; ref.board = r || false; } catch (e) { ref.board = false; ref.err = 1; }
  repeint();
}

/* La liste des personnes : la recherche repart toujours de la première page
   (garder la page 4 en changeant de filtre donne un écran vide), et la
   réponse d'une frappe plus ancienne ne remplace jamais celle d'une plus
   récente. */
export async function refPersonnesPull(depuisDebut) {
  if (depuisDebut) ref.page = 0;
  const n = ++ref.cherche;
  try {
    const l = await rpc('ref_personnes', { q: ref.q.trim(), qrole: ref.role, qclass: ref.cls, sans_classe: !!ref.sans,
      lim: PAGE, off: ref.page * PAGE }) || [];
    if (n !== ref.cherche) return;
    ref.gens = l; ref.total = l.length ? +l[0].total : 0;
  } catch (e) { if (n === ref.cherche) { ref.gens = []; ref.total = 0; } }
  repeint();
}

/* Les professeurs de l'établissement, pour composer une équipe : une
   liste à part, que la recherche dans l'onglet Élèves ne touche pas. */
export async function refProfsPull() {
  await lire('profsListe', 'ref_personnes', { q: '', qrole: 'prof', qclass: null, sans_classe: false, lim: 300, off: 0 }, []);
  repeint();
}

export async function refEquipePull(cid) {
  await lire('team', 'ref_class_team', { cid }, []);
  repeint();
}

export async function refServicePull(uid) {
  await lire('service', 'ref_service', { uid }, []);
  repeint();
}

/* Le journal : la table est fermée par sa politique (le référent de
   l'établissement et l'éditeur seuls la lisent), personne n'y écrit. */
export async function refJournalPull() {
  try {
    ref.trace = await api('/rest/v1/ref_audit?select=acte,cible,created_at,detail&order=created_at.desc&limit=60') || [];
  } catch (e) { ref.trace = []; }
  repeint();
}

/* Le premier passage : tout ce que l'accueil montre, d'un coup. */
export async function refCharger() {
  await Promise.allSettled([refCodesPull(), refTableauPull(), refClassesPull()]);
}

/* Une écriture : le message de la base est déjà écrit pour être lu (« Cette
   classe compte encore 28 élèves. Déplace-les d'abord. ») — on le montre
   tel quel. Puis on relit ce qui a pu bouger. */
export async function refAgir(nom, args, bon) {
  if (!online) { toast(I.cloud, 'Hors ligne : la console demande le réseau'); return null; }
  try {
    const r = await rpc(nom, args);
    if (bon) toast(I.check, bon);
    await Promise.allSettled([refTableauPull(), refClassesPull(), refPersonnesPull(false),
      ref.open && refEquipePull(ref.open), ref.who && ref.who.role === 'prof' && refServicePull(ref.who.id)]);
    // la fiche ouverte se relit dans la liste : nom, rôle et classe à jour
    if (ref.who) ref.who = (ref.gens || []).find(g => g.id === ref.who.id) || ref.who;
    repeint();
    return r === null ? true : r;
  } catch (e) {
    toast(I.x, messageErreur(e).slice(0, 120) || 'Impossible pour l’instant');
    return null;
  }
}

export async function refNouveauCode(quel) {
  const r = await refAgir('ref_nouveau_code', { quel }, 'Nouveau code : l’ancien ne marche plus');
  if (r) await refCodesPull();
  return r;
}

/* Le rythme des codes : chaque semaine, chaque mois ou chaque trimestre
   (20261026110000). La base garde le code du moment ; seule sa date de fin
   bouge avec le rythme. */
export async function refRythme(p) {
  const r = await refAgir('ref_rythme', { p }, 'Rythme des codes changé');
  if (r) await refCodesPull();
  return r;
}

/* Les cartes élève (cas particulier : des élèves sans adresse e-mail) : la
   fonction des professeurs, que le référent a le droit d'appeler sur une
   classe de son établissement (class_manager). */
export async function refCreerCartes(cid, eleves) {
  if (!online) { toast(I.cloud, 'Hors ligne : la console demande le réseau'); return null; }
  try { return await rpc('prof_creer_eleves', { cid, eleves, forcer: false }) || []; }
  catch (e) { toast(I.x, messageErreur(e).slice(0, 120) || 'Impossible pour l’instant'); return null; }
}
