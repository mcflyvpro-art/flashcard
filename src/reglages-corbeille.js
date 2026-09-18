import { $ } from './racine.js';
import { I, svg } from './icones.js';
import { DAY, MIN } from './fsrs.js';
import {
  accounts, asks, auth, blocks, db, friends, iAmMod, lib, mailbox, mates, me, menu, mods,
  myRole, online, prefs, ref, scope, sendMsg, setAnimate, setAsks, setFriends, setMailOpen,
  setMates, setMe, setSendMsg, setSendTo, setShared, setSubjColor, setSubjEdit, setSubjName,
  setVers, setView, shared, trash, vers, view
} from './data/etat.js';
import { go, render } from './bibliotheque.js';
import { fsrsDR, plain } from './carte-media.js';
import { atSchool, isAdmin } from './classement.js';
import {
  COLORS, PALETTE, api, canUndo, deck, esc, metaOf, pending, plur, pull, pushUndo, save,
  saveDeck, scopeName, setMeta, shortWho, sty, subj, uid, undoLabel
} from './coeur-sync.js';
import { hlp } from './connexion.js';
import { applyFont, importPayload, savePrefs, toast } from './import-cartes.js';
import { closeMenu, openMenu, paintMenu } from './menus-a.js';
import { installed } from './onboarding.js';
import { norm } from './quiz.js';

/* ---------- réglages ---------- */
export function openSubject(id) {
  const t0 = db.subjects.find(x => x.id === id);
  /* Une matière posée par le professeur ne s'édite pas : elle sert de lien
     entre son cours et les livres de toute la classe. La base refuse déjà
     la modification comme l'effacement — ouvrir le formulaire ne ferait
     qu'annoncer un enregistrement qui n'aurait pas lieu. */
  if (t0 && t0.locked) return toast(I.lock, 'Matière du cours · posée par ton professeur');
  setSubjEdit(id);
  const t = t0;
  setSubjColor(t ? t.color : COLORS[db.subjects.length % COLORS.length]);
  setSubjName(t ? t.name : '');
  openMenu('subject');
}

export function settingsView() {
  $.innerHTML = `
    <div class="bar"><button class="ic" data-act="home" aria-label="Retour">${svg(I.back)}</button></div>
    <div class="page">
      <div class="top"><div class="hero">Réglages</div></div>
      <div class="lbl"><span>Révision</span></div>
      <div class="slist">
        <div class="srw"><button class="sr flat" data-act="tglsimple">${svg(I.brain)}
          <span class="n">Mode simple</span>
          <span class="tgl ${prefs.simple ? 'on' : ''}"></span></button>${hlp('simple')}</div>
        <div class="sr flat col">
          <div class="srh">${svg(I.target)}<span class="n">Objectif du jour</span>
            <span class="c">${prefs.goal} pages</span></div>
          <input class="rng" id="pGoal" type="range" min="5" max="200" step="5" value="${prefs.goal}"
            aria-label="Objectif du jour"></div>
        ${prefs.simple ? '' : `<div class="sr flat col">
          <div class="srh">${svg(I.plus)}<span class="n">Nouvelles pages par séance</span>
            <span class="c">${prefs.cap || 'sans limite'}</span></div>
          <input class="rng" id="pCap" type="range" min="0" max="100" step="5" value="${prefs.cap}"
            aria-label="Nouvelles pages par séance"></div>
        <div class="sr flat col">
          <div class="srh">${svg(I.brain)}<span class="n">Rétention visée</span>
            <span class="c">${Math.round(fsrsDR() * 100)} %</span>${hlp('dr')}</div>
          <input class="rng" id="pDr" type="range" min="70" max="97" step="1"
            value="${Math.round(fsrsDR() * 100)}" aria-label="Rétention visée"></div>`}
        <div class="sr flat col">
          <div class="srh">${svg(I.shuffle)}<span class="n">Ordre des pages</span>${hlp('order')}</div>
          <div class="seg" id="pOrder">
            ${[['random', 'Aléatoire'], 
['deck', 'Du livre'], ['worst', 'Ratées'], ['due', 'Urgentes']]
              .filter(([v]) => !(prefs.simple && v === 'due'))
              .map(([v, l]) => `<button data-ord="${v}" class="${prefs.order === v ? 'on' : ''}">${l}</button>`).join('')}
          </div>
        </div>
        <button class="sr flat" data-act="tglfresh">${svg(I.card)}
          <span class="n">Nouvelles pages d’abord</span>
          <span class="tgl ${prefs.fresh ? 'on' : ''}"></span></button>
        <button class="sr flat" data-act="tglboth">${svg(I.swap)}
          <span class="n">Mélanger les deux sens</span>
          <span class="tgl ${prefs.both ? 'on' : ''}"></span></button>
        <div class="srw"><button class="sr flat" data-act="tglfast">${svg(I.skip)}
          <span class="n">Mode rapide</span>
          <span class="tgl ${prefs.fast ? 'on' : ''}"></span></button>${hlp('fast')}</div>
        ${prefs.simple ? '' : `<div class="srw"><button class="sr flat" data-act="replay">${svg(I.chart)}
          <span class="n">Régler le moteur sur moi</span>
          <span class="c">${prefs.wAt
            ? (prefs.wN ? prefs.wN.toLocaleString('fr-FR') + ' révisions' : 'réglé')
            : 'réglages d’origine'}</span>
          ${svg(I.arrow)}</button>${hlp('tune')}</div>`}
      </div>

      <div class="lbl"><span>Affichage</span></div>
      <div class="slist">
        <div class="sr flat col">
          <div class="srh">${svg(I.card)}<span class="n">Taille du texte</span>
            <span class="c">${Math.round((prefs.font || 1) * 100)} %</span></div>
          <input class="rng" id="pFont" type="range" min="80" max="140" step="5"
            value="${Math.round((prefs.font || 1) * 100)}" aria-label="Taille du texte">
          <div class="fprev" style="font-size:calc(17px * var(--fs,1))">Aperçu : la casa</div>
        </div>
        <button class="sr flat" data-act="tglsound">${svg(I.sound)}
          <span class="n">Sons</span>
          <span class="tgl ${prefs.sound ? 'on' : ''}"></span></button>
      </div>

      <div class="lbl"><span>Matières</span><span>${db.subjects.length}</span></div>
      <div class="slist">
        ${db.subjects.map(t => {
          const pal = PALETTE[t.color] || PALETTE.graphite;
          const n = db.decks.filter(d => d.subject === t.id).length;
          return `<button class="sr" data-sub="${t.id}" style="${sty(pal)}">
            <i></i><span class="n">${esc(t.name)}</span>
            <span class="c">${n || ''}</span>${svg(I.arrow)}</button>`;
        }).join('')}
        <button class="sr add" data-sub="">${svg(I.plus)}<span class="n">Nouvelle matière</span></button>
      </div>

      <div class="lbl"><span>Mon compte</span></div>
      <div class="slist">
        <button class="sr flat" data-act="rename">${svg(I.user)}
          <span class="n">${esc(prefs.name || auth.email)}</span>${svg(I.arrow)}</button>
        <button class="sr flat" data-act="stats">${svg(I.chart)}<span class="n">Journal de lecture</span>${svg(I.arrow)}</button>
        <button class="sr flat" data-act="commu">${svg(I.user)}<span class="n">Le cercle des lecteurs</span>${svg(I.arrow)}</button>
        <button class="sr flat" data-act="chpwd">${svg(I.lock)}<span class="n">Changer le mot de passe</span>${svg(I.arrow)}</button>
      </div>

      <div class="lbl"><span>Mes données</span></div>
      <div class="slist">
        ${canUndo() ? `<button class="sr flat" data-act="undo2">${svg(I.redo)}
          <span class="n">Annuler ${esc(undoLabel().toLowerCase())}</span></button>` : ''}
        <button class="sr flat" data-act="trash">${svg(I.trash)}<span class="n">Corbeille</span>
          <span class="c">${trash.n || ''}</span>${svg(I.arrow)}</button>
        <button class="sr flat" data-act="help">${svg(I.bulb)}<span class="n">Aide</span>
          <span class="c">revoir la visite</span>${svg(I.arrow)}</button>
        ${installed() ? '' : `<button class="sr flat" data-act="install">${svg(I.plus)}
          <span class="n">Ajouter à l’écran d’accueil</span>${svg(I.arrow)}</button>`}
        ${myRole === 'ref' && atSchool() ? `<button class="sr flat" data-act="ref">${svg(I.build)}
          <span class="n">Mon établissement</span>
          <span class="c">${ref.board ? esc(ref.board.org) : ''}</span>${svg(I.arrow)}</button>` : ''}
        ${isAdmin() ? `<button class="sr flat" data-act="admin">${svg(I.key)}
          <span class="n">Administration</span>
          <span class="c">${accounts ? accounts.length : ''}</span>${svg(I.arrow)}</button>` : ''}
        ${iAmMod ? `<button class="sr flat" data-act="mod">${svg(I.warn)}
          <span class="n">Signalements</span>
          <span class="c">${mods.list ? (mods.list.length || '') : ''}</span>${svg(I.arrow)}</button>` : ''}
        <button class="sr flat" data-act="blocked">${svg(I.lock)}
          <span class="n">Comptes bloqués</span>
          <span class="c">${blocks && blocks.length ? blocks.length : ''}</span>${svg(I.arrow)}</button>
        <button class="sr flat" data-legal="cgu">${svg(I.file)}
          <span class="n">Conditions et confidentialité</span>${svg(I.arrow)}</button>
      </div>

      <div class="lbl"><span>Quitter</span></div>
      <div class="slist">
        <button class="sr flat warn" data-act="logout">${svg(I.exit)}<span class="n">Se déconnecter</span></button>
        <button class="sr flat warn" data-act="delacc">${svg(I.trash)}<span class="n">Supprimer le compte</span></button>
      </div>
      <div class="foot">${pending()
        ? plur(pending(), 'modification') + ' en attente' + (online ? ' d’envoi' : ' — reprise dès le retour du réseau')
        : online ? 'Synchronisé' : 'Hors ligne — rien en attente'}</div>
    </div>`;
  const g = document.getElementById('pGoal'), c = document.getElementById('pCap');
  g.addEventListener('input', () => {
    prefs.goal = +g.value; savePrefs();
    g.closest('.sr').querySelector('.c').textContent = prefs.goal + ' pages';
  });
  if (c) c.addEventListener('input', () => {
    prefs.cap = +c.value; savePrefs();
    c.closest('.sr').querySelector('.c').textContent = prefs.cap || 'sans limite';
  });
  /* Le seul bouton de réglage du moteur : viser plus haut, c'est plus de
     révisions ; viser plus bas, c'est en oublier davantage. */
  const dr = document.getElementById('pDr');
  if (dr) dr.addEventListener('input', () => {
    prefs.dr = +dr.value / 100; savePrefs();
    dr.closest('.sr').querySelector('.c').textContent = dr.value + ' %';
  });
  const fo = document.getElementById('pFont');
  if (fo) fo.addEventListener('input', () => {
    prefs.font = +fo.value / 100; savePrefs(); applyFont();
    fo.closest('.sr').querySelector('.c').textContent = fo.value + ' %';
  });
  document.getElementById('pOrder').addEventListener('click', e => {
    const b = e.target.closest('[data-ord]'); if (!b) return;
    prefs.order = b.dataset.ord; savePrefs(); render();
  });
}

/* ---------- corbeille ----------
   Supprimer un paquet le marque d'une date au lieu de l'effacer. Il reste
   là trente jours, restaurable en un geste ; passé ce délai il part pour
   de bon, purgé à l'ouverture de la corbeille — personne n'a à y penser. */
const KEEP = 30;

const leftFor = iso => Math.max(0, KEEP - Math.floor((Date.now() - Date.parse(iso)) / DAY));

export async function trashPull() {
  const cut = new Date(Date.now() - KEEP * DAY).toISOString();
  try {
    /* purge d'abord : ce qui s'affiche ensuite est exactement ce qui reste */
    await api(`/rest/v1/decks?deleted_at=lt.${cut}`, 'DELETE', null, { Prefer: 'return=minimal' });
    const rows = await api('/rest/v1/decks?select=id,name,subject,cards,deleted_at'
      + '&deleted_at=not.is.null&order=deleted_at.desc');
    trash.list = (rows || []).map(x => ({
      id: x.id, name: x.name, subject: x.subject,
      cards: (x.cards || []).length, at: x.deleted_at
    }));
    trash.n = trash.list.length; trash.err = 0;
  } catch (e) { trash.err = 1; }
  if (view.name === 'trash') render();
}

export function trashView() {
  const l = trash.list;
  $.innerHTML = `
    <div class="bar"><button class="ic" data-act="settings" aria-label="Retour">${svg(I.back)}</button></div>
    <div class="page">
      <div class="top"><div class="hero">Corbeille</div></div>
      <div class="note">Gardés ${KEEP} jours, pages et progression comprises.</div>
      ${!l ? `<div class="empty">${svg(I.clock)}<p>${trash.err ? 'Corbeille indisponible' : 'Chargement…'}</p></div>`
        : !l.length ? `<div class="empty">${svg(I.trash)}<p><b>Corbeille vide</b></p></div>`
        : `<div class="slist">${l.map(t => {
            const s = subj(t.subject), d = leftFor(t.at);
            return `<div class="sr flat col trr" style="${sty(s)}">
              <div class="srh"><i class="tri"></i><span class="n">${esc(t.name)}</span>
                <span class="c">${t.cards} carte${t.cards > 1 ? 's' : ''}</span></div>
              <div class="trf">
                <span class="trd ${d <= 3 ? 'soon' : ''}">${d
                  ? 'Encore ' + d + ' jour' + (d > 1 ? 's' : '') : 'Part aujourd’hui'}</span>
                <button class="trb" data-trr="${t.id}">${svg(I.redo)}Restaurer</button>
                <button class="trb warn" data-trd="${t.id}">${svg(I.trash)}Supprimer</button>
              </div></div>`;
          }).join('')}</div>`}
    </div>`;
}

export async function trashRestore(id) {
  const t = trash.list && trash.list.find(x => x.id === id); if (!t) return;
  trash.list = trash.list.filter(x => x.id !== id); trash.n = trash.list.length;
  render();
  try {
    await api(`/rest/v1/decks?id=eq.${encodeURIComponent(id)}`, 'PATCH',
      { deleted_at: null }, { Prefer: 'return=minimal' });
    await pull(); save();
    if (view.name === 'trash') render();
    toast(I.check, 'Paquet restauré');
  } catch (e) { trash.list = null; trashPull(); toast(I.x, "Restauration impossible"); }
}

export async function trashPurge(id) {
  trash.list = trash.list.filter(x => x.id !== id); trash.n = trash.list.length;
  render();
  try {
    await api(`/rest/v1/decks?id=eq.${encodeURIComponent(id)}`, 'DELETE', null,
      { Prefer: 'return=minimal' });
    toast(I.trash, 'Supprimé définitivement');
  } catch (e) { trash.list = null; trashPull(); toast(I.x, "Suppression impossible"); }
}

/* ---------- annuaire des comptes ----------
   De quoi choisir un destinataire, rien de plus : un nom, un identifiant.
   Chaque connexion réécrit sa propre ligne ; jamais celle d'un autre. */
export async function upsertProfile() {
  if (!auth) return;
  try {
    await api('/rest/v1/profiles', 'POST',
      [{ id: auth.uid, email: auth.email, name: prefs.name || null }],
      { Prefer: 'resolution=merge-duplicates,return=minimal' });
  } catch (e) {}
}

/* On n'envoie un paquet qu'à quelqu'un qu'on a ajouté, et l'annuaire
   complet n'est plus lisible : chacun ne voit que ses propres liens. */
export async function friendsPull() {
  try {
    const rows = await api('/rest/v1/rpc/my_friends', 'POST', {});
    setFriends(rows || []);
    setMates(friends.filter(f => f.status === 'ok'));
    setAsks(friends.filter(f => f.status === 'pending' && f.sens === 'recue'));
  } catch (e) { setFriends(friends || []); setMates(mates || []); setAsks(asks || []); }
  if (view.name === 'commu' || view.name === 'friends') { setAnimate(false); render(); }
  if (menu) paintMenu();
}

export async function askFriend(q) {
  const one = (await api('/rest/v1/rpc/find_user', 'POST', { q }) || [])[0];
  if (!one) { toast(I.x, 'Aucun compte sous ce pseudo'); return false; }
  if (friends && friends.some(f => f.id === one.id)) { toast(I.check, 'Déjà dans ta liste'); return true; }
  await api('/rest/v1/friends', 'POST', [{ user_id: auth.uid, friend_id: one.id, status: 'pending' }],
    { Prefer: 'return=minimal' });
  toast(I.check, 'Demande envoyée à ' + (one.handle || one.name));
  friendsPull();
  return true;
}

export async function answerFriend(id, yes) {
  try {
    if (yes) await api(`/rest/v1/friends?user_id=eq.${id}&friend_id=eq.${auth.uid}`, 'PATCH',
      { status: 'ok' }, { Prefer: 'return=minimal' });
    else await api(`/rest/v1/friends?user_id=eq.${id}&friend_id=eq.${auth.uid}`, 'DELETE',
      null, { Prefer: 'return=minimal' });
    toast(yes ? I.check : I.x, yes ? 'Lecteur ajouté' : 'Demande refusée');
  } catch (e) { toast(I.x, 'Impossible pour l’instant'); }
  friendsPull();
}

export async function dropFriend(id) {
  try {
    await api(`/rest/v1/friends?or=(and(user_id.eq.${auth.uid},friend_id.eq.${id}),`
      + `and(user_id.eq.${id},friend_id.eq.${auth.uid}))`, 'DELETE', null, { Prefer: 'return=minimal' });
  } catch (e) {}
  closeMenu(); friendsPull();
}

/* ---------- pseudo ----------
   On s'ajoute par pseudo, pas par adresse : c'est ce qu'on se dit de vive
   voix, et ça évite de faire circuler les e-mails de tout le monde. */
const cleanHandle = v => String(v || '').toLowerCase().replace(/[^a-z0-9_.-]/g, '').slice(0, 20);

export async function saveHandle(v) {
  const h = cleanHandle(v);
  if (h.length < 3) { toast(I.x, 'Au moins 3 caractères'); return false; }
  try {
    await api('/rest/v1/profiles', 'POST', [{ id: auth.uid, email: auth.email, handle: h, name: prefs.name || null }],
      { Prefer: 'resolution=merge-duplicates,return=minimal' });
    me.handle = h; save();
    toast(I.check, '@' + h);
    return true;
  } catch (e) {
    toast(I.x, /duplicate|unique/i.test(String(e.message || '')) ? 'Ce pseudo est déjà pris' : 'Impossible pour l’instant');
    return false;
  }
}

export async function mePull() {
  try {
    const r = (await api('/rest/v1/profiles?select=id,handle,name&id=eq.' + auth.uid) || [])[0];
    setMe(r || { id: auth.uid, handle: '' });
  } catch (e) { setMe(me || { id: auth.uid, handle: '' }); }
}

/* ---------- envoyer un paquet à un ami ----------
   Seuls le recto et le verso voyagent, jamais la progression : la
   révision de l'expéditeur ne veut rien dire chez quelqu'un d'autre, qui
   doit pouvoir repartir de zéro sur ce paquet comme sur les siens. */
export async function sendDeck(d, p) {
  const msg = sendMsg.trim(), cards = d.cards.map(c => [c.f, c.b]);
  setSendTo(null); setSendMsg('');
  try {
    await api('/rest/v1/mail', 'POST', [{
      from_user: auth.uid, to_user: p.id, from_name: prefs.name || (me && me.handle) || 'Compte',
      deck_name: d.name, message: msg, cards
    }], { Prefer: 'return=minimal' });
    toast(I.check, 'Envoyé à ' + (p.name || p.email));
  } catch (e) { toast(I.x, 'Envoi impossible'); }
}

/* ---------- boîte de réception ----------
   Le détail (cartes, message) n'arrive qu'à l'ouverture de l'écran, comme
   la corbeille ; seul le compte de non-lus voyage à chaque connexion,
   pour que le petit repère au-dessus du gear reste à jour sans attendre. */
export async function mailPull() {
  try {
    const rows = await api('/rest/v1/mail?select=id,from_user,from_name,deck_name,message,cards,created_at,read_at,added_at&order=created_at.desc');
    mailbox.list = rows || [];
    mailbox.n = mailbox.list.filter(r => !r.read_at).length;
    mailbox.err = 0;
  } catch (e) { mailbox.err = 1; }
  if (view.name === 'mail') render();
}

export function timeAgo(iso) {
  const ms = Date.now() - Date.parse(iso);
  if (ms < MIN) return 'à l’instant';
  if (ms < 60 * MIN) return Math.round(ms / MIN) + ' min';
  if (ms < DAY) return Math.round(ms / (60 * MIN)) + ' h';
  const j = Math.round(ms / DAY);
  return j < 31 ? j + ' j' : Math.round(j / 30) + ' mois';
}

export function mailView() {
  const l = mailbox.list;
  $.innerHTML = `
    <div class="bar"><button class="ic" data-act="home" aria-label="Retour">${svg(I.back)}</button></div>
    <div class="page">
      <div class="top"><div class="hero">Boîte de réception</div></div>
      ${!l ? `<div class="empty">${svg(I.mail)}<p>${mailbox.err ? 'Boîte indisponible' : 'Chargement…'}</p></div>`
        : !l.length ? `<div class="empty">${svg(I.mail)}<p><b>Aucun message</b></p></div>`
        : `<div class="slist">${l.map(it => `
          <button class="sr flat mlrow ${!it.read_at ? 'unread' : ''}" data-mail="${it.id}">
            ${it.read_at ? svg(I.mail) : '<i class="mdot"></i>'}
            <span class="ml2">
              <span class="n">${esc(shortWho(it.from_name) || 'Un ami')} → ${esc(it.deck_name)}</span>
              <span class="sub">${it.message
                ? `« ${esc(it.message)} »`
                : plur((it.cards || []).length, 'page')}</span>
            </span>
            <span class="c">${timeAgo(it.created_at)}</span>${svg(I.arrow)}
          </button>`).join('')}</div>`}
    </div>`;
}

export async function openMail(id) {
  setMailOpen(id);
  const it = mailbox.list && mailbox.list.find(x => x.id === id);
  openMenu('mailitem');
  if (it && !it.read_at) {
    it.read_at = new Date().toISOString();
    mailbox.n = mailbox.list.filter(r => !r.read_at).length;
    if (view.name === 'mail') render();
    try { await api(`/rest/v1/mail?id=eq.${id}`, 'PATCH', { read_at: it.read_at }, { Prefer: 'return=minimal' }); }
    catch (e) {}
  }
}

export async function addMail(it) {
  const n = (it.cards || []).length;
  const d = importPayload({ name: it.deck_name, subject: '', cards: it.cards }, true);
  it.added_at = new Date().toISOString();
  closeMenu();
  if (d) go('deck', d.id);
  toast(I.check, plur(n, 'page') + ' ajoutée' + (n > 1 ? 's' : ''));
  try { await api(`/rest/v1/mail?id=eq.${it.id}`, 'PATCH', { added_at: it.added_at }, { Prefer: 'return=minimal' }); }
  catch (e) {}
}

export async function delMail(id) {
  mailbox.list = mailbox.list.filter(x => x.id !== id);
  mailbox.n = mailbox.list.filter(r => !r.read_at).length;
  closeMenu(); render();
  try { await api(`/rest/v1/mail?id=eq.${id}`, 'DELETE', null, { Prefer: 'return=minimal' }); }
  catch (e) {}
}

/* ---------- historique d'un paquet ----------
   Annuler ne va pas plus loin que la session en cours et ne suit pas
   l'appareil. Avant chaque opération qui remplace le contenu d'un paquet
   — remplacement en masse, fusion, découpe, réimport — on en garde une
   photo côté serveur. Dix par paquet : au-delà, ce n'est plus de
   l'histoire, c'est du stockage. */
export const VERSN = 10;

export async function snapVersion(d, why) {
  if (!auth || !d || !d.cards.length) return;
  try {
    await api('/rest/v1/deck_versions', 'POST',
      [{ user_id: auth.uid, deck_id: d.id, name: d.name, why: why || '',
         cards: d.cards.map(c => [c.f, c.b, c.id]) }], { Prefer: 'return=minimal' });
    const old = await api(`/rest/v1/deck_versions?deck_id=eq.${encodeURIComponent(d.id)}`
      + `&select=id&order=created_at.desc&offset=${VERSN}`);
    if (old && old.length) {
      await api(`/rest/v1/deck_versions?id=in.(${old.map(r => r.id).join(',')})`, 'DELETE',
        null, { Prefer: 'return=minimal' });
    }
  } catch (e) {}
}

export async function versPull(id) {
  setVers({ list: null, err: 0, of: id });
  paintMenu();
  try {
    vers.list = await api(`/rest/v1/deck_versions?deck_id=eq.${encodeURIComponent(id)}`
      + '&select=id,name,why,cards,created_at&order=created_at.desc') || [];
  } catch (e) { vers.err = 1; }
  if (menu === 'vers') paintMenu();
}

export function versRestore(vid) {
  const v = (vers.list || []).find(x => x.id === vid);
  const d = deck(vers.of);
  if (!v || !d) return closeMenu();
  pushUndo('Restauration', [d.id]);
  snapVersion(d, 'avant restauration');
  /* La progression suit la carte, pas son texte : une version garde
     l'identifiant de chaque carte, donc restaurer un libellé — même après
     un remplacement en masse qui a réécrit les deux faces — ne remet pas à
     zéro trois semaines de révision. Le recto sert de repêchage pour les
     versions enregistrées avant que les identifiants ne soient gardés. */
  const byId = new Map(d.cards.map(c => [c.id, c]));
  const byF = new Map(d.cards.map(c => [norm(plain(c.f)), c]));
  d.cards = v.cards.map(([f, b, id]) => {
    const old = (id && byId.get(id)) || byF.get(norm(plain(f)));
    return old ? { ...old, f, b } : { id: id || uid(), f, b };
  });
  saveDeck(d); closeMenu(); render();
  toast(I.redo, plur(d.cards.length, 'page') + ' restaurée' + (d.cards.length > 1 ? 's' : ''), true);
}

export const cf = c => Array.isArray(c) ? c[0] : ((c && c.f) || '');

export const cb = c => Array.isArray(c) ? c[1] : ((c && c.b) || '');

/* ---------- lien de consultation ----------
   Le lien porte un jeton, pas les cartes : il tient sur une ligne quel que
   soit le paquet, il montre toujours la version du jour, et le révoquer le
   coupe pour de bon — alors qu'un lien qui contient tout reste valable à
   jamais une fois copié. */
const TOKC = 'abcdefghjkmnpqrstuvwxyz23456789';

const newTok = () => Array.from(crypto.getRandomValues(new Uint8Array(10)),
                                b => TOKC[b % TOKC.length]).join('');

export async function shareLink(d) {
  let tok = (d.meta || {}).tok;
  if (!tok) {
    tok = newTok();
    await api('/rest/v1/shares', 'POST',
      [{ token: tok, deck_id: d.id, user_id: auth.uid, mode: 'ro' }], { Prefer: 'return=minimal' });
    setMeta(d, { tok });
  }
  return location.origin + location.pathname + '#s=' + tok;
}

export async function revokeShare(d) {
  const tok = (d.meta || {}).tok; if (!tok) return;
  const m = { ...metaOf(d) }; delete m.tok; d.meta = m; saveDeck(d);
  try { await api('/rest/v1/shares?token=eq.' + encodeURIComponent(tok), 'DELETE', null, { Prefer: 'return=minimal' }); }
  catch (e) {}
}

export async function openShared(tok) {
  setShared({ tok, st: 'load' });
  setView({ name: 'shared' }); setAnimate(true); render(); window.scrollTo(0, 0);
  try {
    const rows = await api('/rest/v1/rpc/shared_deck', 'POST', { tok });
    const r = (rows || [])[0];
    setShared(r ? { tok, st: 'ok', d: r } : { tok, st: 'gone' });
  } catch (e) { setShared({ tok, st: 'err' }); }
  if (view.name === 'shared') render();
}

export function sharedView() {
  const s = shared || {}, d = s.d, cards = d ? (d.cards || []) : [];
  $.innerHTML = `
    <div class="bar"><button class="ic" data-act="home" aria-label="Retour">${svg(I.back)}</button>
      <h1>Livre partagé</h1></div>
    <div class="page">
      ${s.st === 'load' ? `<div class="empty">${svg(I.link)}<p>Ouverture du lien…</p></div>`
      : s.st !== 'ok' ? `<div class="empty">${svg(I.warn)}<p><b>${s.st === 'gone' ? 'Lien révoqué' : 'Lien illisible'}</b>${
          s.st === 'gone' ? 'Ce livre n’est plus prêté.' : 'Réessaie une fois en ligne.'}</p></div>`
      : `<div class="top"><div class="hero">${esc(d.name)}</div></div>
        <button class="cta" data-act="addshared">${svg(I.plus)}Ajouter à ma bibliothèque</button>
        <div class="rows">${cards.slice(0, 300).map(c => `<div class="pr">
          <span class="a">${esc(plain(cf(c)))}</span>${svg(I.arrow)}<span class="b">${esc(plain(cb(c)))}</span>
          </div>`).join('')}</div>`}
    </div>`;
}

/* ---------- bibliothèque commune ----------
   Publier, c'est poser une copie sur l'étagère du groupe : le paquet
   d'origine continue de vivre de son côté, et republier remplace la copie
   par la version du jour. Chacun ne peut retirer que ses propres paquets. */
export async function libPull() {
  try {
    lib.list = await api('/rest/v1/library?select=deck_id,user_id,who,name,subject,cards,n,group_id,updated_at'
      + '&order=updated_at.desc&limit=100') || [];
    lib.err = 0;
  } catch (e) { lib.err = 1; }
  if (/^(commu|friends|groups|duels|library|board|group)$/.test(view.name)) { setAnimate(false); render(); }
}

export async function libPublish(d) {
  closeMenu();
  const where = scopeName();
  const row = { deck_id: d.id, user_id: auth.uid, who: prefs.name || (me && me.handle) || 'Compte',
                name: d.name, subject: d.subject ? subj(d.subject).name : '',
                n: d.cards.length, cards: d.cards.map(c => [plain(c.f), plain(c.b)]),
                group_id: scope, updated_at: new Date().toISOString() };
  try {
    await api('/rest/v1/library', 'POST', [row], { Prefer: 'resolution=merge-duplicates,return=minimal' });
    setMeta(d, { pub: 1 });
    lib.list = null; libPull();
    toast(I.book, 'Sur l’étagère · ' + where);
  } catch (e) { toast(I.x, 'Publication impossible'); }
}

export async function libRemove(d) {
  closeMenu();
  setMeta(d, { pub: 0 });
  lib.list = (lib.list || []).filter(x => x.deck_id !== d.id);
  render();
  try { await api('/rest/v1/library?deck_id=eq.' + encodeURIComponent(d.id), 'DELETE', null, { Prefer: 'return=minimal' }); }
  catch (e) {}
  toast(I.check, 'Retiré de la bibliothèque');
}

export function libAdd(it) {
  /* les identifiants de matière sont propres à chaque compte : on
     rattache par le nom quand il existe déjà ici, sinon sans matière */
  const s = db.subjects.find(x => x.name.toLowerCase() === String(it.subject || '').toLowerCase());
  const n = (it.cards || []).length;
  const d = importPayload({ name: it.name, subject: s ? s.id : '', cards: it.cards }, true);
  closeMenu();
  if (d) go('deck', d.id);
  toast(I.check, plur(n, 'page') + ' ajoutée' + (n > 1 ? 's' : ''));
}
