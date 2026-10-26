import { I } from '../icones.js';
import {
  adm, auth, blocks, board, cercle, duels, iAmMod, mailbox,
  mods, myRole, ref, reportOn, reportWhy,
  setAnimate, setAsks, setBlocks,
  setFriends, setIAmMod, setMates, setMates2, setMyRole, setReportOn, setReportWhy,
  setSchool, view
} from '../data/etat.js';
import { go, render } from '../ui/bibliotheque.js';
import { atSchool, isPupil, isProf } from '../ui/classement.js';
import { api, shortWho } from './coeur-sync.js';
import { duelsPull } from './defis.js';
import { comptePull, eleveClassesPull } from './eleve-classes.js';
import { toast } from '../ui/import-cartes.js';
import { closeMenu, paintMenu } from '../ui/menus-a.js';
import { allerAccueil } from '../ui/prof-porte.js';
import { lienApresRole } from '../ui/liens-entrants.js';
import { friendsPull, mailPull } from './reglages-corbeille.js';
import { sallesPull } from './cercle.js';

/* ---------- classement ----------
   Les révisions de chacun restent privées : la fonction côté serveur ne
   rend qu'un décompte par compte, jamais le détail des cartes ni des
   erreurs. On compare un volume de travail, pas un contenu. */
export async function boardPull(bg) {
  try {
    board.rows = await api('/rest/v1/rpc/leaderboard', 'POST', { days: board.range, gid: null }) || [];
    board.err = 0;
  } catch (e) { board.err = 1; }
  const sig = JSON.stringify(board.rows) + ':' + board.err;
  const same = bg && sig === board.sig;        // rien de neuf : on ne fait pas clignoter l'écran
  board.sig = sig;
  if (same) return;
  if (/^(commu|friends)$/.test(view.name)) { setAnimate(false); render(); }
}

export async function blocksPull() {
  try { setBlocks(await api('/rest/v1/blocks?select=blocked_id,who,created_at&order=created_at.desc') || []); }
  catch (e) { setBlocks(blocks || []); }
}

export async function blockUser(id, who) {
  closeMenu();
  try {
    await api('/rest/v1/rpc/block_user', 'POST', { other: id, who: shortWho(who || '') });
    setBlocks(null); await blocksPull();
    /* Ce que la personne avait posé doit disparaître tout de suite : la
       base ne le rend déjà plus, mais l'écran garde sa dernière copie. */
    duels.list = null; mailbox.list = null; board.rows = null; cercle.salles = null;
    setFriends(null); setMates(null); setAsks(null);
    friendsPull(); duelsPull(); mailPull(); boardPull(); sallesPull();
    toast(I.lock, (who ? shortWho(who) : 'Ce compte') + ' est bloqué');
  } catch (e) { toast(I.x, 'Blocage impossible'); }
  render();
}

export async function unblockUser(id) {
  try {
    await api('/rest/v1/blocks?blocked_id=eq.' + encodeURIComponent(id), 'DELETE',
      null, { Prefer: 'return=minimal' });
    setBlocks(null); await blocksPull();
    duels.list = null; board.rows = null;
    toast(I.check, 'Compte débloqué');
  } catch (e) { toast(I.x, 'Impossible pour l’instant'); }
  paintMenu(); render();
}

export async function sendReport() {
  const r = reportOn;
  const note = (/** @type {{ value?: string }} */ (document.getElementById('rnote') || {})).value || '';
  if (!r || !reportWhy) return;
  closeMenu();
  try {
    await api('/rest/v1/reports', 'POST', [{
      reporter: auth.uid, kind: r.kind, target_id: r.id, target_user: r.user,
      reason: reportWhy, note: note.slice(0, 500), snapshot: r.snapshot
    }], { Prefer: 'return=minimal' });
    toast(I.check, 'Signalement envoyé');
  } catch (e) { toast(I.x, 'Envoi impossible'); }
  setReportOn(null); setReportWhy('');
}

async function modCheck() {
  try { setIAmMod(!!(await api('/rest/v1/rpc/is_mod', 'POST', {}))); }
  catch (e) { setIAmMod(false); }
}

export async function modPull() {
  try {
    mods.list = await api('/rest/v1/reports?select=id,kind,target_id,target_user,reason,note,'
      + 'snapshot,status,created_at&status=eq.open&order=created_at.desc&limit=60') || [];
    mods.err = 0;
  } catch (e) { mods.err = 1; }
  if (view.name === 'mod') { setAnimate(false); render(); }
  if (view.name === 'settings') { setAnimate(false); render(); }
}

export async function modAct(id, act) {
  closeMenu();
  try {
    await api('/rest/v1/rpc/mod_act', 'POST', { rid: id, act });
    mods.list = (mods.list || []).filter(r => r.id !== id);
    toast(I.check, act === 'hide' ? 'Contenu masqué' : 'Signalement classé');
  } catch (e) { toast(I.x, 'Action impossible'); }
  render();
}

/* La console de l'éditeur vit dans un morceau chargé à la demande
   (ui/admin-console.js, core/admin.js) : ici, seulement de quoi la faire
   relire à sa prochaine ouverture. */
export function admPull() { adm.charge = false; }

export async function schoolPull() {
  try {
    const [r] = await api('/rest/v1/rpc/my_school', 'POST', {}) || [];
    setSchool(r || false);
  } catch (e) { setSchool(false); }
}

/* Chaque métier a son point d'arrivée. Un professeur qui ouvre l'app veut
   savoir où en sont ses classes, pas relire sa bibliothèque ; un élève de
   classe veut ses devoirs. On ne le sait qu'après le rôle, donc on attend :
   rediriger après coup ferait clignoter un écran qu'on n'a pas demandé. */
export async function accueil() {
  await Promise.all([rolePull(), schoolPull(), comptePull()]);
  /* Un lien ou un QR « rejoindre », une partie en direct (« ?defi= »), une
     invitation dans un club (« ?club= ») attendait — ouvert avant la
     connexion, ou à l'instant : il passe avant l'écran d'arrivée habituel. */
  if (await lienApresRole()) return;
  /* Un compte personnel peut avoir rejoint la classe d'un professeur : il
     faut le savoir pour lui montrer l'onglet « Classe ». */
  if (!isPupil() && !isProf() && myRole !== 'ref' && myRole !== 'admin') eleveClassesPull();
  if (view.name !== 'home') return;              // l'utilisateur est déjà parti ailleurs
  if (myRole === 'ref' && atSchool()) { refPull(); return go('ref'); }
  if (isProf()) return allerAccueil();
  if (isPupil()) { eleveClassesPull(); matesPull(); return go('classes'); }
}

/* Le rôle, les coupures et les signalements arrivent ensemble, et l'écran
   ne se repeint qu'une fois tout su. Lancés séparément, chacun repeignait
   de son côté : les Réglages pouvaient s'afficher avant qu'on sache si le
   compte est administrateur, et l'entrée manquait alors sans aucune raison
   visible. C'est exactement ce qui faisait dire que le compte admin
   n'avait rien d'admin. */
export async function cerclePull() {
  await Promise.all([rolePull(), schoolPull(), comptePull(), modCheck(), blocksPull()]);
  if (iAmMod) await modPull();
  setAnimate(false); render();
}

async function rolePull() {
  try { setMyRole((await api('/rest/v1/rpc/my_role', 'POST', {})) || 'eleve'); }
  catch (e) { setMyRole('eleve'); }
}

export async function matesPull() {
  try { setMates2(await api('/rest/v1/rpc/my_classmates', 'POST', {}) || []); }
  catch (e) { setMates2([]); }
  if (view.name === 'classes') { setAnimate(false); render(); }
}

/* La console du référent vit dans un morceau chargé à la demande
   (ui/ref-console.js, core/referent.js) : ici, seulement de quoi la faire
   relire en entier à sa prochaine ouverture. */
export function refPull() { ref.charge = false; }
