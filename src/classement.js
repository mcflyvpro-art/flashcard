import { $ } from './racine.js';
import { I, svg } from './icones.js';
import { DAY } from './fsrs.js';
import {
  accOpen, accounts, adm, asgs, auth, blocks, board, classes, duels, iAmMod, lib, mailbox,
  mates2, me, menu, mods, myRole, prefs, prof, ref, reportOn, reportWhy, roster, school,
  scope, setAccounts, setAnimate, setAsgs, setAsks, setBlocks, setClassOf, setClasses,
  setFriends, setIAmMod, setMates, setMates2, setMenu, setMyRole, setReportOn, setReportWhy,
  setRoster, setSchool, setTeam, team, view
} from './data/etat.js';
import { go, render } from './bibliotheque.js';
import { initial } from './bilan-devoirs.js';
import { plain } from './carte-media.js';
import { api, esc, plur, shortWho } from './coeur-sync.js';
import { duelsPull } from './defis.js';
import {
  joursDici, profPull, refCls, refEtab, refGens
} from './etablissement.js';
import { importPayload, toast } from './import-cartes.js';
import { closeMenu, mountMenu, openMenu, paintMenu } from './menus-a.js';
import {
  cb, cf, friendsPull, libPull, mailPull, timeAgo
} from './reglages-corbeille.js';

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

const isBlocked = id => !!(blocks || []).some(b => b.blocked_id === id);

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

/* Les motifs sont courts et nommés du point de vue de l'élève : « ça me
   harcèle » se trouve plus vite que « atteinte aux personnes ». */
const RAISONS = [
  ['harass', 'Harcèlement, menaces'],
  ['hate', 'Contenu haineux ou illégal'],
  ['sexual', 'Contenu sexuel'],
  ['private', 'Données personnelles de quelqu’un'],
  ['spam', 'Spam ou publicité'],
  ['copy', 'Copié sans autorisation'],
  ['other', 'Autre']
];

export function openReport(kind, id, user, label, snapshot) {
  setReportOn({ kind, id: String(id || ''), user: user || null, label: label || '', snapshot: snapshot || {} });
  setReportWhy('');
  openMenu('report');
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

export function reportSheet(w) {
  const r = reportOn;
  if (!r) { setMenu(null); return; }
  w.innerHTML = `<div class="scrim" data-mact="close"></div>
    <div class="menu">
      <div class="mhd">${svg(I.warn)}<span class="mhx"><b>Signaler</b>
        <span class="msub">${esc(r.label || 'Ce contenu')} — le contenu est joint au signalement,
          même s’il est effacé ensuite. Rien n’est envoyé à la personne visée.</span></span></div>
      <div class="rlist">${RAISONS.map(([k, t]) =>
        `<button class="mi${reportWhy === k ? ' on' : ''}" data-why="${k}">
          ${svg(reportWhy === k ? I.check : I.arrow)}${t}</button>`).join('')}</div>
      <input class="tok" id="rnote" placeholder="Précision (facultatif)" maxlength="500">
      <button class="mi" data-mact="rsend" ${reportWhy ? '' : 'disabled'}
        style="justify-content:center;font-weight:700">${svg(I.share)}Envoyer le signalement</button>
      ${r.user ? `<div class="msep"></div>
        <button class="mi warn" data-mact="rblock">${svg(I.lock)}<span>Bloquer aussi ce compte</span></button>` : ''}
    </div>`;
  mountMenu(w);
}

/* La liste des comptes coupés, pour pouvoir revenir en arrière : un
   blocage qu'on ne peut pas défaire est une punition, pas un réglage. */
export function blockedSheet(w) {
  const l = blocks || [];
  w.innerHTML = `<div class="scrim" data-mact="close"></div>
    <div class="menu">
      <div class="mhd">${svg(I.lock)}<span class="mhx"><b>Comptes bloqués</b>
        <span class="msub">Ils ne voient plus rien de toi, et toi non plus.</span></span></div>
      ${!l.length ? `<div class="note" style="padding:4px 18px 14px">Aucun compte bloqué.</div>`
        : `<div class="mscroll">${l.map(b => `<button class="mi" data-unblock="${esc(b.blocked_id)}">
             ${svg(I.redo)}<span>${esc(b.who || 'Un compte')}</span>
             <span class="tail">Débloquer</span></button>`).join('')}</div>`}
    </div>`;
  mountMenu(w);
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

const RNAME = Object.fromEntries(RAISONS);

const KNAME = { mail: 'Courrier', library: 'Étagère', duel: 'Défi', profile: 'Compte' };

/* La copie jointe s'affiche telle qu'elle a été prise : c'est la pièce du
   dossier, pas un aperçu à rafraîchir. */
function snapHtml(s) {
  if (!s || typeof s !== 'object') return '';
  const line = (k, v) => `<div class="sl"><i>${esc(k)}</i><span>${esc(v)}</span></div>`;
  let out = '';
  for (const [k, v] of Object.entries(s)) {
    if (k === 'cartes') continue;
    if (v) out += line(k, String(v).slice(0, 300));
  }
  const c = s.cartes;
  if (Array.isArray(c) && c.length) {
    out += `<div class="scards">${c.slice(0, 12).map(x => `<div class="pr">
      <span class="a">${esc(cf(x))}</span>${svg(I.arrow)}<span class="b">${esc(cb(x))}</span></div>`).join('')}
      ${c.length > 12 ? `<div class="note">…et ${c.length - 12} autres</div>` : ''}</div>`;
  }
  return out;
}

export function modView() {
  const l = mods.list;
  $.innerHTML = `
    <div class="bar"><button class="ic" data-act="settings" aria-label="Retour">${svg(I.back)}</button>
      <h1>Signalements</h1></div>
    <div class="page">
      ${!l ? `<div class="empty">${svg(I.warn)}<p>${mods.err ? 'Liste indisponible' : 'Chargement…'}</p></div>`
      : !l.length ? `<div class="empty">${svg(I.check)}<p><b>Rien à traiter</b>Tous les signalements sont classés.</p></div>`
      : `<div class="note" style="padding:0 0 14px">Un contenu signalé par deux comptes différents est déjà
           masqué automatiquement. Ce qui suit attend une décision.</div>
         ${l.map(r => `<div class="rep">
           <div class="rh"><b>${esc(KNAME[r.kind] || r.kind)}</b>
             <i>${esc(RNAME[r.reason] || r.reason)}</i>
             <span>${timeAgo(r.created_at)}</span></div>
           ${r.note ? `<div class="rn">${svg(I.quote)}<p>${esc(r.note)}</p></div>` : ''}
           <div class="rs">${snapHtml(r.snapshot)}</div>
           <div class="rb">
             <button data-modact="clear" data-rid="${r.id}">${svg(I.check)}Rien à signaler</button>
             <button class="warn" data-modact="hide" data-rid="${r.id}">${svg(I.eyeoff)}Masquer</button>
           </div>
         </div>`).join('')}`}
    </div>`;
}

const ROLES = { eleve: 'Élève', prof: 'Professeur',
                ref: 'Référent d’établissement', admin: 'Éditeur' };

export async function accountsPull() {
  try { setAccounts(await api('/rest/v1/rpc/admin_accounts', 'POST', {}) || []); }
  catch (e) { setAccounts([]); }
  if (view.name === 'admin') { setAnimate(false); render(); }
}

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

const euros = c => (Math.round(+c || 0) / 100).toFixed(2).replace('.', ',') + ' €';

export function adminView() {
  const l = accounts, o = adm.orgs, e = adm.etat;
  const par = r => (l || []).filter(x => x.role === r);
  const onglet = (k, n) => `<button class="otab ${adm.tab === k ? 'on' : ''}" data-atab="${k}">${n}</button>`;
  const kc = (v, lab, cls) => `<div class="kc ${cls || ''}"><b>${v}</b><span>${lab}</span></div>`;

  const ligneOrg = x => {
    const ouverts = (x.eleves || 0) + (x.profs || 0) + (x.refs || 0);
    const venus = Math.max(0, ouverts - (x.jamais_venus || 0));
    const pris = ouverts ? Math.round(venus / ouverts * 100) : 0;
    return `<div class="rrow">
      <span class="c1"><b>${esc(x.name)}</b><i>${esc(x.ville || '')}${
        x.uai ? ' · ' + esc(x.uai) : ''}</i></span>
      <span class="c2">${x.classes} classes · ${x.eleves} él. · ${x.profs} prof.</span>
      <span class="c3">${venus} / ${ouverts} <em class="rl ${
        pris < 25 ? 'jamais' : pris < 60 ? 'vide' : ''}">${pris} % venus</em></span>
      <span class="c4">${x.actifs7} actifs 7 j · ${x.actifs30} sur 30 j</span>
      <span class="c5">${euros(x.cents_mois)} ce mois${
        +x.cents_total > +x.cents_mois ? ' · ' + euros(x.cents_total) + ' au total' : ''}</span>
    </div>`;
  };
  const ligneCpt = a => `<button class="rrow" data-account="${esc(a.id)}">
    <span class="c1"><b>${esc(a.name || a.handle || a.email)}</b><i>@${esc(a.handle || '')}</i></span>
    <span class="c2">${esc(a.email)}</span>
    <span class="c3"><em class="rl ${esc(a.role)}">${esc(ROLES[a.role] || a.role)}</em></span>
    <span class="c4">${plur(+a.livres, 'livre')}</span>
    <span class="c5">${a.bloque ? 'modère les signalements' : ''}</span></button>`;

  $.innerHTML = `
    <div class="bar"><button class="ic" data-act="settings" aria-label="Retour">${svg(I.back)}</button>
      <h1>Administration</h1></div>
    <div class="page dense">
      ${!l ? `<div class="empty">${svg(I.build)}<p>Chargement…</p></div>`
      : !l.length ? `<div class="empty">${svg(I.lock)}<p><b>Réservé à l’éditeur</b>
          Ce compte n’a pas ce rôle.</p></div>`
      : `${e ? `<div class="kpi six">
           ${kc(e.orgs, 'établissements')}${kc(e.comptes, 'comptes')}
           ${kc(e.hors_etab, 'hors établissement')}${kc(e.actifs7, 'actifs cette semaine')}
           ${kc(euros(e.cents_mois), 'd’IA ce mois')}
           ${kc(e.signalements, 'signalements', e.signalements ? 'ko' : '')}
         </div>` : ''}
         <div class="rtabs">${onglet('orgs', 'Établissements')}${onglet('cpt', 'Comptes')}</div>
         ${adm.tab === 'orgs' ? `
           <div class="note" style="padding:0 0 12px">L’écart entre comptes ouverts et comptes
             venus dit si le déploiement a pris. En dessous de 25 %, l’établissement n’a pas
             distribué le lien — c’est un problème de terrain, pas de produit.</div>
           ${!o ? `<div class="card2"><div class="note">Chargement…</div></div>`
             : !o.length ? `<div class="empty">${svg(I.build)}<p><b>Aucun établissement</b></p></div>`
             : `<div class="rtable">
                 <div class="rrow tete"><span class="c1">Établissement</span>
                   <span class="c2">Effectifs</span><span class="c3">Comptes venus</span>
                   <span class="c4">Usage réel</span><span class="c5">Coût IA</span></div>
                 ${o.map(ligneOrg).join('')}</div>`}
           <div class="note" style="padding:6px 0 0">⚠ Le plafond d’IA est encore global à tous
             les comptes (AI_BUDGET_USD), et non par établissement : un seul lycée actif l’épuise
             et la fonctionnalité s’éteint pour tout le monde. À remplacer avant la première vente.</div>`
         : `<div class="note" style="padding:0 0 12px">L’éditeur gère des accès. Il ne voit ni les
             fiches, ni la progression, ni le courrier de personne.</div>
           ${['admin', 'ref', 'prof', 'eleve'].map(r => par(r).length ? `
             <div class="lbl"><span>${esc(ROLES[r] || r)}${par(r).length > 1 ? 's' : ''}</span>
               <span>${par(r).length}</span></div>
             <div class="rtable">${par(r).map(ligneCpt).join('')}</div>` : '').join('')}`}`}
    </div>`;
}

export function accountSheet(w) {
  const a = (accounts || []).find(x => x.id === accOpen);
  if (!a) { setMenu(null); return; }
  const moi = a.id === auth.uid;
  w.innerHTML = `<div class="scrim" data-mact="close"></div>
    <div class="menu">
      <div class="mhd"><i class="av">${esc(initial(a.handle || a.name || a.email))}</i>
        <span class="mhx"><b>${esc(a.name || a.handle || a.email)}</b>
          <i>${esc(a.email)}${a.handle ? ' · @' + esc(a.handle) : ''}</i></span></div>
      <div class="msep"></div>
      ${Object.entries(ROLES).map(([k, n]) => `
        <button class="mi${a.role === k ? ' on' : ''}" data-setrole="${k}" data-who="${esc(a.id)}"
          ${moi && k !== 'admin' ? 'disabled' : ''}>
          ${svg(a.role === k ? I.check : I.arrow)}${n}
          ${k === 'admin' ? '<span class="tail">instruit les signalements</span>' : ''}</button>`).join('')}
      ${moi ? `<div class="note" style="padding:6px 18px 12px">C’est ton compte : tu ne peux pas
        te retirer ton propre rôle, sinon plus personne ne pourrait rendre la main.</div>` : ''}
    </div>`;
  mountMenu(w);
}

export const atSchool = () => !!(school && school.org_id);

export const isPupil = () => atSchool() && myRole === 'eleve';

export async function schoolPull() {
  try {
    const [r] = await api('/rest/v1/rpc/my_school', 'POST', {}) || [];
    setSchool(r || false);
  } catch (e) { setSchool(false); }
}

async function teamPull() {
  try { setTeam(await api('/rest/v1/rpc/my_class_team', 'POST', {}) || []); }
  catch (e) { setTeam([]); }
  if (view.name === 'classe' || view.name === 'classes') { setAnimate(false); render(); }
}

export const isProf = () => myRole === 'prof' || myRole === 'admin';

export const isAdmin = () => myRole === 'admin';

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

/* L'année scolaire bascule en août, pas en janvier. */
function scolaire() {
  const d = new Date(), y = d.getFullYear();
  return d.getMonth() >= 7 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
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
  } catch (e) {}
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

export const dueLabel = s => {
  if (!s) return '';
  const j = joursDici(s);
  return j < 0 ? (j === -1 ? 'hier' : `il y a ${-j} jours`)
       : j === 0 ? 'aujourd’hui' : j === 1 ? 'demain' : `dans ${j} jours`;
};

export async function matesPull() {
  try { setMates2(await api('/rest/v1/rpc/my_classmates', 'POST', {}) || []); }
  catch (e) { setMates2([]); }
  if (view.name === 'classe') { setAnimate(false); render(); }
}

export function maClassePull() {
  if (school === null) schoolPull().then(() => { maClassePull(); setAnimate(false); render(); });
  if (school && school.class_id && !asgs) classPull(school.class_id);
  if (!team) teamPull();
  if (!mates2) matesPull();
}

export function maClasseView() {
  if (!school || !school.class_id) {
    $.innerHTML = `
      <div class="bar"><button class="ic" data-act="commu" aria-label="Retour">${svg(I.back)}</button>
        <h1>Ma classe</h1></div>
      <div class="page"><div class="empty">${svg(I.school)}<p><b>Aucune classe</b>
        ${school === null ? 'Chargement…'
          : 'Ton établissement ne t’a pas encore inscrit dans une classe. Préviens ton professeur principal.'}</p></div></div>`;
    return;
  }
  const c = school;
  const l = asgs || [];
  /* Les devoirs en retard d'abord : c'est la seule chose qui presse. */
  const retard = l.filter(a => a.due && Date.parse(a.due + 'T12:00:00') < Date.now());
  const avenir = l.filter(a => !retard.includes(a));
  const ligne = a => `<button class="sr flat${a.due && Date.parse(a.due + 'T12:00:00') < Date.now() ? ' tard' : ''}"
      data-work="${esc(a.id)}">${svg(I.card)}
    <span class="ml2"><span class="n">${esc(a.name)}</span>
      <span class="sub">${plur(a.n, 'page')}${a.due ? ' · ' + dueLabel(a.due) : ''}</span></span>
    ${svg(I.arrow)}</button>`;
  const cam = mates2 || [];
  $.innerHTML = `
    <div class="bar"><button class="ic" data-act="commu" aria-label="Retour">${svg(I.back)}</button>
      <h1>${esc(c.classe)}</h1></div>
    <div class="page">
      <div class="ecole">${svg(I.school)}<span><b>${esc(c.org)}</b>
        <i>${esc(c.niveau || '')}${c.filiere ? ' · ' + esc(c.filiere) : ''}${
          c.effectif ? ' · ' + plur(c.effectif, 'élève') : ''}</i></span></div>

      <div class="lbl"><span>Devoirs</span><span>${l.length || ''}</span></div>
      ${!asgs ? `<div class="card2"><div class="note">Chargement…</div></div>`
        : !l.length ? `<div class="empty">${svg(I.card)}<p><b>Rien à faire</b>
            Tes professeurs n’ont pas encore donné de devoir.</p></div>`
        : `${retard.length ? `<div class="slist">${retard.map(ligne).join('')}</div>` : ''}
           ${avenir.length ? `<div class="slist">${avenir.map(ligne).join('')}</div>` : ''}`}

      <div class="lbl"><span>Mes professeurs</span><span>${team ? team.length : ''}</span></div>
      ${!team ? `<div class="card2"><div class="note">Chargement…</div></div>`
        : !team.length ? `<div class="card2"><div class="note">Aucun cours renseigné.</div></div>`
        : `<div class="profs">${team.map(t => `<div class="pf">
            <i class="av sm">${esc(initial(t.teacher))}</i>
            <span class="ml2"><span class="n">${esc(t.subject)}</span>
              <span class="sub">${esc(t.teacher)}${t.principal ? ' · professeur principal' : ''}</span></span>
            </div>`).join('')}</div>`}

      <div class="lbl"><span>Ma classe</span><span>${cam.length || ''}</span></div>
      ${!mates2 ? `<div class="card2"><div class="note">Chargement…</div></div>`
        : !cam.length ? `<div class="card2"><div class="note">Tu es seul inscrit pour l’instant.</div></div>`
        : `<div class="slist">${cam.map(m => `<div class="sr flat">
            <i class="av sm">${esc(initial(m.name))}</i>
            <span class="ml2"><span class="n">${esc(m.name)}</span>
              <span class="sub">@${esc(m.handle || '')}</span></span>
            ${m.lien === 'ok' ? `<button class="camo" data-mate="${esc(m.id)}">${svg(I.arrow)}</button>`
              : m.lien ? `<span class="camw">demandé</span>`
              : `<button class="camadd" data-camadd="${esc(m.id)}" data-camn="${esc(m.handle || '')}"
                   aria-label="Ajouter ${esc(m.name)}">${svg(I.plus)}</button>`}
            </div>`).join('')}</div>`}
    </div>`;
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
async function refTrace() {
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

/* Un bouton de la feuille la repeint, et repeindre efface ce qui est tapé.
   On relit donc les champs avant chaque repeinture : sans cela, choisir le
   rôle en dernier effaçait l'adresse, et choisir l'adresse en dernier
   effaçait le rôle — l'un ou l'autre, jamais les deux. */
const lireChamps = map => {
  const o = {};
  for (const [k, id] of Object.entries(map)) {
    const n = document.getElementById(id);
    if (n) o[k] = n.value;            // absent = on garde ce qu'on avait
  }
  return o;
};

export const lireNew = () => lireChamps({ mel: 'nmel', nom: 'nnom', pse: 'npse', pw: 'npw' });

export const lireClass = () => lireChamps({ nom: 'knom', niv: 'kniv', fil: 'kfil', pre: 'kpre' });

export function refView() {
  const b = ref.board;
  const onglet = (k, n) => `<button class="otab ${ref.tab === k ? 'on' : ''}" data-rtab="${k}">${n}</button>`;
  $.innerHTML = `
    <div class="bar"><button class="ic" data-act="home" aria-label="Retour">${svg(I.back)}</button>
      <h1>${b ? esc(b.org) : 'Mon établissement'}</h1></div>
    <div class="page dense">
      <div class="rtabs">${onglet('etab', 'Établissement')}${onglet('gens', 'Comptes')}${onglet('cls', 'Classes')}</div>
      ${ref.tab === 'etab' ? refEtab() : ref.tab === 'gens' ? refGens() : refCls()}
    </div>`;
  if (ref.tab === 'etab') refTrace();
  const q = document.getElementById('rq');
  if (q) {
    q.addEventListener('input', () => { ref.q = q.value; clearTimeout(refView.t);
      refView.t = setTimeout(() => refPeople(true), 220); });
    if (ref.tab === 'gens' && document.activeElement !== q && ref.q) {
      q.focus(); q.setSelectionRange(q.value.length, q.value.length);
    }
  }
}
