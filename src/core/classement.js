import { DAY } from '../fsrs.js';
import { I } from '../icones.js';
import {
  adm, asgs, auth, blocks, board, classes, duels, iAmMod, lib, mailbox, me,
  menu, mods, myRole, prefs, prof, ref, reportOn, reportWhy, roster,
  scope, setAccounts, setAnimate, setAsgs, setAsks, setBlocks, setClassOf, setClasses,
  setFriends, setIAmMod, setMates, setMates2, setMyRole, setReportOn, setReportWhy,
  setRoster, setSchool, setTeam, view
} from '../data/etat.js';
import { go, render } from '../ui/bibliotheque.js';
import { atSchool, isPupil, isProf, maClassePull } from '../ui/classement.js';
import { plain } from '../ui/carte-media.js';
import { api, esc, plur, shortWho } from './coeur-sync.js';
import { duelsPull } from './defis.js';
import { profPull } from './etablissement.js';
import { importPayload, toast } from '../ui/import-cartes.js';
import { closeMenu, paintMenu } from '../ui/menus-a.js';
import { friendsPull, libPull, mailPull } from './reglages-corbeille.js';
import { timeAgo } from '../ui/reglages-corbeille.js';

/* ---------- classement ----------
   Les révisions de chacun restent privées : la fonction côté serveur ne
   rend qu'un décompte par compte, jamais le détail des cartes ni des
   erreurs. On compare un volume de travail, pas un contenu. */
export async function boardPull(bg) {
  try {
    board.rows = await api('/rest/v1/rpc/leaderboard', 'POST', { days: board.range, gid: scope }) || [];
    board.err = 0;
  } catch (e) { board.err = 1; }
  const sig = JSON.stringify(board.rows) + ':' + board.err;
  const same = bg && sig === board.sig;        // rien de neuf : on ne fait pas clignoter l'écran
  board.sig = sig;
  if (same) return;
  if (/^(commu|friends|groups|duels|library|board|group)$/.test(view.name)) { setAnimate(false); render(); }
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
    lib.list = null; duels.list = null; mailbox.list = null; board.rows = null;
    setFriends(null); setMates(null); setAsks(null);
    friendsPull(); libPull(); duelsPull(); mailPull(); boardPull();
    toast(I.lock, (who ? shortWho(who) : 'Ce compte') + ' est bloqué');
  } catch (e) { toast(I.x, 'Blocage impossible'); }
  render();
}

export async function unblockUser(id) {
  try {
    await api('/rest/v1/blocks?blocked_id=eq.' + encodeURIComponent(id), 'DELETE',
      null, { Prefer: 'return=minimal' });
    setBlocks(null); await blocksPull();
    lib.list = null; duels.list = null; board.rows = null;
    toast(I.check, 'Compte débloqué');
  } catch (e) { toast(I.x, 'Impossible pour l’instant'); }
  paintMenu(); render();
}

export async function sendReport() {
  const r = reportOn, note = (document.getElementById('rnote') || {}).value || '';
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

export async function accountsPull() {
  try { setAccounts(await api('/rest/v1/rpc/admin_accounts', 'POST', {}) || []); }
  catch (e) { setAccounts([]); }
  if (view.name === 'admin') { setAnimate(false); render(); }
}

const ROLES = { eleve: 'Élève', prof: 'Professeur',
                ref: 'Référent d’établissement', admin: 'Éditeur' };

export async function setRole(id, role) {
  closeMenu();
  try {
    await api('/rest/v1/rpc/set_role', 'POST', { cible: id, nouveau: role });
    setAccounts(null); await accountsPull();
    toast(I.check, ROLES[role] + ' · rôle enregistré');
  } catch (e) {
    const m = String((e && e.message) || '');
    toast(I.x, /propre rôle/.test(m) ? 'On ne retire pas son propre rôle'
      : /autoris/.test(m) ? 'Réservé aux administrateurs' : 'Changement impossible');
  }
  render();
}

export async function admPull() {
  try {
    const [o, e] = await Promise.all([
      api('/rest/v1/rpc/admin_orgs', 'POST', {}),
      api('/rest/v1/rpc/admin_etat', 'POST', {})
    ]);
    adm.orgs = o || []; adm.etat = (e || [])[0] || null;
  } catch (x) { adm.orgs = adm.orgs || []; }
  if (view.name === 'admin') { setAnimate(false); render(); }
}

export async function schoolPull() {
  try {
    const [r] = await api('/rest/v1/rpc/my_school', 'POST', {}) || [];
    setSchool(r || false);
  } catch (e) { setSchool(false); }
}

export async function teamPull() {
  try { setTeam(await api('/rest/v1/rpc/my_class_team', 'POST', {}) || []); }
  catch (e) { setTeam([]); }
  if (view.name === 'classe' || view.name === 'classes') { setAnimate(false); render(); }
}

/* Le rôle, les coupures, les classes et les signalements arrivent
   ensemble, et l'écran ne se repeint qu'une fois tout su. Lancés
   séparément, chacun repeignait de son côté : les Réglages pouvaient
   s'afficher avant qu'on sache si le compte est administrateur, et
   l'entrée manquait alors sans aucune raison visible. C'est exactement ce
   qui faisait dire que le compte admin n'avait rien d'admin. */
/* Chaque métier a son point d'arrivée. Un professeur qui ouvre l'app veut
   savoir où en sont ses classes, pas relire sa bibliothèque ; un élève veut
   ses devoirs. On ne le sait qu'après le rôle, donc on attend : rediriger
   après coup ferait clignoter un écran qu'on n'a pas demandé. */
export async function accueil() {
  await Promise.all([rolePull(), schoolPull()]);
  if (view.name !== 'home') return;              // l'utilisateur est déjà parti ailleurs
  if (myRole === 'ref' && atSchool()) { refPull(); return go('ref'); }
  if (isProf() && atSchool()) { if (!prof.classes) profPull(); return go('prof'); }
  if (isPupil()) { maClassePull(); return go('maclasse'); }
}

export async function cerclePull() {
  await Promise.all([rolePull(), schoolPull(), modCheck(), blocksPull()]);
  await Promise.all([classesPull(), iAmMod ? modPull() : null]);
  setAnimate(false); render();
}

async function rolePull() {
  try { setMyRole((await api('/rest/v1/rpc/my_role', 'POST', {})) || 'eleve'); }
  catch (e) { setMyRole('eleve'); }
}

export async function classesPull() {
  try {
    /* Deux origines pour une même liste : celles qu'on tient et celles
       qu'on a rejointes. Les règles de lecture rendent déjà les deux. */
    setClasses(await api('/rest/v1/classes?select=id,name,level,year,code,owner&order=created_at.desc') || []);
  } catch (e) { setClasses(classes || []); }
  if (/^(classes|classe)$/.test(view.name)) { setAnimate(false); render(); }
}

export async function classPull(id) {
  try {
    const [m, a] = await Promise.all([
      api(`/rest/v1/class_members?select=user_id,who,joined_at&class_id=eq.${id}&order=who.asc`),
      api(`/rest/v1/assignments?select=id,name,n,due,created_at&class_id=eq.${id}&order=created_at.desc`)
    ]);
    setRoster(m || []); setAsgs(a || []);
  } catch (e) { setRoster(roster || []); setAsgs(asgs || []); }
  if (view.name === 'classe') { setAnimate(false); render(); }
}

const classCode = () => Array.from(crypto.getRandomValues(new Uint8Array(6)),
  b => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[b % 31]).join('');

/* L'année scolaire bascule en août, pas en janvier. */
function scolaire() {
  const d = new Date(), y = d.getFullYear();
  return d.getMonth() >= 7 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

export async function makeClass(name, level) {
  try {
    const [c] = await api('/rest/v1/classes', 'POST',
      [{ name: (name || '').trim() || 'Ma classe', level: (level || '').trim(),
         year: scolaire(), code: classCode(), owner: auth.uid }],
      { Prefer: 'return=representation' }) || [];
    closeMenu(); setClasses(null); await classesPull();
    if (c) { setClassOf(c.id); setRoster(null); setAsgs(null); classPull(c.id); go('classe'); }
    toast(I.check, 'Classe créée · code ' + (c ? c.code : ''));
  } catch (e) { toast(I.x, 'Création impossible'); }
}

export async function joinClass(code) {
  try {
    await api('/rest/v1/rpc/join_class', 'POST',
      { join_code: code, who: prefs.name || (me && me.handle) || 'Compte' });
    closeMenu(); setClasses(null); await classesPull();
    toast(I.check, 'Classe rejointe');
  } catch (e) { toast(I.x, 'Code inconnu'); }
}

export async function dropMember(cid, uid2) {
  try {
    await api(`/rest/v1/class_members?class_id=eq.${cid}&user_id=eq.${uid2}`, 'DELETE',
      null, { Prefer: 'return=minimal' });
    setRoster((roster || []).filter(m => m.user_id !== uid2));
  } catch (e) { toast(I.x, 'Impossible pour l’instant'); }
  closeMenu(); render();
}

/* Donner un devoir, c'est envoyer une copie du livre : la bibliothèque du
   professeur reste la sienne, et l'élève repart de zéro sur ces cartes —
   la progression de quelqu'un d'autre ne veut rien dire chez lui. */
export async function giveWork(d, cid, days) {
  const cards = d.cards.map(c => [plain(c.f), plain(c.b)]);
  const due = new Date(Date.now() + (days || 7) * DAY).toISOString().slice(0, 10);
  try {
    await api('/rest/v1/assignments', 'POST',
      [{ class_id: cid, name: d.name, cards, n: cards.length, due, created_by: auth.uid }],
      { Prefer: 'return=minimal' });
    closeMenu(); setAsgs(null); classPull(cid);
    toast(I.check, plur(cards.length, 'page') + ' à rendre avant le ' + due.split('-').reverse().slice(0, 2).join('/'));
  } catch (e) { toast(I.x, 'Envoi impossible'); }
}

/* L'élève ajoute le devoir à sa bibliothèque et son avancement remonte —
   fait ou pas fait, et le pourcentage. Jamais le détail carte par carte. */
/* Les cartes d'un devoir gardent un identifiant qui dit d'où elles
   viennent : « a:<devoir>:<rang> ». Sans lui, les révisions de l'élève
   remontent sous un identifiant tiré au hasard chez lui, et plus rien ne
   permet de dire à son professeur quelle carte sa classe rate. Avec lui,
   `prof_cartes` recoud les deux — et ne rend jamais que des comptes,
   jamais qui s'est trompé. */
export async function takeWork(a) {
  const cartes = (a.cards || []).map((c, i) => {
    const [f, b] = Array.isArray(c) ? c : [c.f, c.b];
    return { id: `a:${a.id}:${i}`, f, b };
  });
  const d = importPayload({ name: a.name, subject: '', cards: cartes }, true);
  try {
    await api('/rest/v1/assignment_progress', 'POST',
      [{ assignment_id: a.id, user_id: auth.uid, who: prefs.name || (me && me.handle) || 'Compte', pct: 0 }],
      { Prefer: 'resolution=merge-duplicates,return=minimal' });
  } catch (e) { /* juste un compteur de suivi côté prof : le devoir est déjà dans la bibliothèque */ }
  closeMenu();
  if (d) go('deck', d.id);
  toast(I.check, 'Devoir ajouté à ta bibliothèque');
}

/* Ce que le professeur a le droit de voir : combien ont rendu, et le taux
   de réussite moyen. Pas le détail carte par carte, pas les horaires — la
   différence entre suivre une classe et surveiller quelqu'un. */
export async function workProgress(id) {
  const box = document.getElementById('wprog'); if (!box) return;
  try {
    const rows = await api('/rest/v1/assignment_progress?select=user_id,who,pct,done_at'
      + '&assignment_id=eq.' + encodeURIComponent(id)) || [];
    const total = (roster || []).length;
    const faits = rows.filter(r => r.done_at || r.pct > 0);
    const moy = faits.length
      ? Math.round(faits.reduce((a, r) => a + (r.pct || 0), 0) / faits.length) : 0;
    box.innerHTML = !total ? 'Aucun élève inscrit pour l’instant.'
      : `<b>${faits.length} / ${total}</b> ${faits.length > 1 ? 'ont commencé' : 'a commencé'}`
        + (faits.length ? ` · ${moy} % de réussite moyenne` : '')
        + (total - faits.length ? `<br>${plur(total - faits.length, 'élève')} n’${
            total - faits.length > 1 ? 'ont' : 'a'} pas encore ouvert.` : '');
  } catch (e) { box.textContent = 'Suivi indisponible.'; }
}

export async function matesPull() {
  try { setMates2(await api('/rest/v1/rpc/my_classmates', 'POST', {}) || []); }
  catch (e) { setMates2([]); }
  if (view.name === 'classe') { setAnimate(false); render(); }
}

export const PAGE_REF = 60;

export const ROLENOM = { eleve: 'Élève', prof: 'Professeur', ref: 'Référent', admin: 'Éditeur' };

async function refBoard() {
  try { const [r] = await api('/rest/v1/rpc/ref_dashboard', 'POST', {}) || []; ref.board = r || false; }
  catch (e) { ref.board = false; ref.err = 1; }
  if (view.name === 'ref') { setAnimate(false); render(); }
}

async function refClasses() {
  try { ref.classes = await api('/rest/v1/rpc/ref_classes', 'POST', {}) || []; }
  catch (e) { ref.classes = []; }
  if (view.name === 'ref') { setAnimate(false); render(); }
}

/* La recherche repart toujours de la première page : garder la page 4 en
   changeant le filtre donne un écran vide qu'on ne sait pas expliquer. */
export async function refPeople(reset) {
  if (reset) ref.page = 0;
  const n = ++ref.cherche;
  try {
    const rows = await api('/rest/v1/rpc/ref_people', 'POST',
      { q: ref.q.trim(), qrole: ref.role, qclass: ref.cls,
        lim: PAGE_REF, off: ref.page * PAGE_REF }) || [];
    if (n !== ref.cherche) return;                 // une frappe plus récente a gagné
    ref.gens = rows; ref.total = rows.length ? +rows[0].total : 0;
  } catch (e) { if (n === ref.cherche) { ref.gens = []; ref.total = 0; } }
  if (view.name === 'ref') { setAnimate(false); render(); }
}

export async function refTeam(cid) {
  try { ref.team = await api('/rest/v1/rpc/ref_class_team', 'POST', { cid }) || []; }
  catch (e) { ref.team = []; }
  if (menu) paintMenu();
}

export async function refService(uid) {
  try { ref.service = await api('/rest/v1/rpc/ref_service', 'POST', { uid }) || []; }
  catch (e) { ref.service = []; }
  if (menu) paintMenu();
}

/* Le journal, affiché après coup : il n'a jamais à retarder l'écran, et
   son absence n'empêche rien. On le lit directement — la table est déjà
   fermée par sa politique, et personne ne peut y écrire depuis l'app. */
export async function refTrace() {
  const box = document.getElementById('rtrace'); if (!box) return;
  try {
    const rows = await api('/rest/v1/ref_audit?select=acte,cible,created_at,detail'
      + '&order=created_at.desc&limit=12') || [];
    box.innerHTML = !rows.length
      ? 'Aucune modification pour l’instant. Tout ce que tu changeras ici sera inscrit.'
      : `<div class="rjour">${rows.map(r => `<div class="rj">
          <b>${esc(r.acte)}</b>
          <i>${esc(quoiTrace(r.detail))}</i>
          <span>${timeAgo(r.created_at)}</span></div>`).join('')}</div>`;
  } catch (e) { box.textContent = 'Journal indisponible.'; }
}

/* Le détail est du JSON, et le référent n'a pas à lire du JSON. */
function quoiTrace(d) {
  if (!d || typeof d !== 'object') return '';
  if (d.avant && d.apres && typeof d.avant === 'object')
    return `${d.avant.nom || ''} → ${d.apres.nom || d.avant.nom || ''}`;
  if (d.avant || d.apres) return `${d.avant || '—'} → ${d.apres || '—'}`;
  return [d.nom, d.classe, d.matiere, d.adresse, d.role && ROLENOM[d.role]]
    .filter(Boolean).join(' · ');
}

export function refPull() {
  if (!ref.board) refBoard();
  if (!ref.classes) refClasses();
  if (!ref.gens) refPeople(true);
}

/* Une seule fonction pour tous les appels d'écriture : chacun renvoie le
   message de la base, qui est déjà écrit pour être lu — « Cette classe
   compte encore 28 élèves. Déplace-les d'abord. » vaut mieux que tout ce
   que le client pourrait inventer. */
export async function refDo(rpc, args, bon) {
  try {
    const r = await api('/rest/v1/rpc/' + rpc, 'POST', args);
    ref.board = null; ref.classes = null;
    refBoard(); refClasses(); refPeople(false);
    if (ref.open) refTeam(ref.open);
    if (ref.who) refService(ref.who.id);
    toast(I.check, bon);
    return r;
  } catch (e) {
    const m = String((e && e.message) || '');
    toast(I.x, m.slice(0, 90) || 'Impossible pour l’instant');
    return null;
  }
}
