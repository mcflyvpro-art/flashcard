import { I } from '../icones.js';
import { auth, cercle, menu, online, setAnimate, view } from '../data/etat.js';
import { go, render } from '../ui/bibliotheque.js';
import { api } from './coeur-sync.js';
import { messageErreur } from './eleve-classes.js';
import { toast } from '../ui/import-cartes.js';
import { closeMenu, paintMenu } from '../ui/menus-a.js';

/* ══════════ le cercle des lecteurs : réseau ══════════
   Refait le 2026-10-24 (migration 20261024232855). Trois choses seulement :
   des amis (core/reglages-corbeille.js, inchangé), des clubs, des défis.
   Tout ce qui touche à un club ou à une salle passe par une fonction de la
   base : on n'écrit jamais `groups` ni `group_members` à la main (le code
   d'un club est tiré par la base, et on n'entre plus sans lui).

   Ces gestes demandent le réseau par nature — rejoindre un club avec un
   code, entrer dans une partie en direct : il n'y a rien à mettre en file
   d'attente, on le dit tout de suite au lieu d'échouer en silence. */

const rpc = (f, body) => api('/rest/v1/rpc/' + f, 'POST', body || {});
const ECRANS = /^(commu|friends|club|defi|classes)$/;

function repeindre(re = ECRANS) {
  if (re.test(view.name)) { setAnimate(false); render(); }
  if (menu) paintMenu();
}

const horsLigne = quoi => { if (online) return false; toast(I.cloud, 'Hors ligne : ' + quoi + ' demande le réseau'); return true; };

/* ---------- lire ---------- */
export async function clubsPull() {
  try { cercle.clubs = await rpc('mes_clubs') || []; cercle.err = 0; }
  catch (e) { cercle.clubs = cercle.clubs || []; cercle.err = 1; }
  repeindre();
}

export async function sallesPull() {
  try { cercle.salles = await rpc('salles_ouvertes') || []; }
  catch (e) { cercle.salles = cercle.salles || []; }
  repeindre();
}

export async function membresPull(club) {
  try { cercle.membres[club] = await rpc('club_membres', { club }) || []; }
  catch (e) { cercle.membres[club] = cercle.membres[club] || []; }
  repeindre(/^club$/);
}

export async function termineesPull(club, classe) {
  const k = club || 'classe:' + classe;
  try { cercle.terminees[k] = await rpc('salles_terminees', { club: club || null, classe: classe || null }) || []; }
  catch (e) { cercle.terminees[k] = cercle.terminees[k] || []; }
  repeindre(/^(club|classes)$/);
}

/* ---------- les clubs ---------- */
export async function creerClub(f) {
  if (horsLigne('créer un club')) return null;
  try {
    const [r] = await rpc('club_creer', { nom: f.nom, embleme: f.embleme, teinte: f.teinte, devise: f.devise || '' }) || [];
    toast(I.check, 'Club créé');
    await clubsPull();
    return r ? r.id : null;
  } catch (e) { toast(I.x, messageErreur(e).slice(0, 120) || 'Création impossible'); return null; }
}

// le chef seul (la base le vérifie, politique groups_edit) : nom, emblème, couleur, devise
export async function modifierClub(id, f) {
  if (horsLigne('personnaliser un club')) return false;
  try {
    await api('/rest/v1/groups?id=eq.' + encodeURIComponent(id), 'PATCH',
      { name: f.nom, embleme: f.embleme, teinte: f.teinte, devise: f.devise || '' }, { Prefer: 'return=minimal' });
    toast(I.check, 'Club mis à jour');
    await clubsPull();
    return true;
  } catch (e) { toast(I.x, 'Modification impossible'); return false; }
}

/* Un code faux ne lève pas d'erreur côté base (elle doit pouvoir compter
   l'essai) : elle ne renvoie simplement aucun club. */
export async function rejoindreClub(code) {
  if (horsLigne('rejoindre un club')) return null;
  try {
    const [g] = await rpc('join_group', { join_code: code }) || [];
    if (!g) { toast(I.x, 'Aucun club avec ce code'); return null; }
    toast(I.check, 'Bienvenue dans ' + g.name);
    await clubsPull();
    return g.id;
  } catch (e) { toast(I.x, messageErreur(e).slice(0, 120) || 'Impossible pour l’instant'); return null; }
}

export async function nouveauCodeClub(id) {
  if (horsLigne('changer le code')) return null;
  try {
    const k = await rpc('club_nouveau_code', { club: id });
    toast(I.check, 'Nouveau code : l’ancien ne marche plus');
    await clubsPull();
    return k;
  } catch (e) { toast(I.x, 'Impossible pour l’instant'); return null; }
}

/* Quitter ; pour le chef, c'est supprimer le club (et ses défis, ses
   parties : la base les emporte en cascade). */
export async function quitterClub(id, chef) {
  if (horsLigne(chef ? 'supprimer un club' : 'quitter un club')) return;
  try {
    if (chef) await api('/rest/v1/groups?id=eq.' + encodeURIComponent(id), 'DELETE', null, { Prefer: 'return=minimal' });
    else await api(`/rest/v1/group_members?group_id=eq.${encodeURIComponent(id)}&user_id=eq.${auth.uid}`,
      'DELETE', null, { Prefer: 'return=minimal' });
    toast(I.check, chef ? 'Club supprimé' : 'Tu as quitté le club');
  } catch (e) { toast(I.x, 'Impossible pour l’instant'); }
  closeMenu(); cercle.club = null;
  await clubsPull();
  go('commu');
}

export async function exclureMembre(club, uid) {
  if (horsLigne('retirer un membre')) return;
  try {
    await api(`/rest/v1/group_members?group_id=eq.${encodeURIComponent(club)}&user_id=eq.${encodeURIComponent(uid)}`,
      'DELETE', null, { Prefer: 'return=minimal' });
    toast(I.check, 'Retiré du club');
  } catch (e) { toast(I.x, 'Impossible pour l’instant'); }
  closeMenu();
  membresPull(club); clubsPull();
}

/* ---------- les salles en direct ---------- */
// { statut, salle, titre } ; statut 'erreur' si la base est injoignable
export async function rejoindreSalle(pin) {
  if (horsLigne('une partie en direct')) return { statut: 'horsligne' };
  try {
    const [r] = await rpc('salle_rejoindre', { code: pin }) || [];
    return r || { statut: 'erreur' };
  } catch (e) { return { statut: 'erreur' }; }
}

export async function ouvrirSalle(p) {
  if (horsLigne('ouvrir une partie en direct')) return null;
  try {
    const [r] = await rpc('salle_ouvrir', {
      titre: p.titre, jeu: p.jeu, duree: p.duree, questions: p.questions,
      classe: p.classe || null, club: p.club || null
    }) || [];
    return r || null;
  } catch (e) { toast(I.x, messageErreur(e).slice(0, 120) || 'Ouverture impossible'); return null; }
}
