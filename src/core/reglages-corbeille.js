import { I } from '../icones.js';
import { SITE } from '../adresse.js';
import { DAY } from '../fsrs.js';
import {
  asks, auth, db, friends, mailbox, mates, me, menu, prefs, sendMsg,
  setAnimate, setAsks, setFriends, setMailOpen, setMates, setMe, setSendMsg,
  setSendTo, setShared, setVers, setView, trash, vers, view
} from '../data/etat.js';
import { go, render } from '../ui/bibliotheque.js';
import { fsrsW, plain } from '../ui/carte-media.js';
import {
  api, deck, metaOf, plur, pull, pushSubject, pushUndo, save, saveDeck, setMeta, subj, uid
} from './coeur-sync.js';
import { deDevoir } from '../file.js';
import { importPayload, toast } from '../ui/import-cartes.js';
import { closeMenu, paintMenu } from '../ui/menus-a.js';
import { norm } from '../ui/quiz.js';

/* ---------- corbeille ----------
   Supprimer un paquet le marque d'une date au lieu de l'effacer. Il reste
   là trente jours, restaurable en un geste ; passé ce délai il part pour
   de bon, purgé à l'ouverture de la corbeille — personne n'a à y penser. */
export const KEEP = 30;

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
  } catch (e) { /* ligne de profil best-effort : un futur appel réussi la remettra à jour */ }
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
  } catch (e) { /* réseau indisponible : friendsPull() qui suit remontrera le lien tel quel */ }
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
      deck_name: d.name, subject_name: d.subject ? subj(d.subject).name.slice(0, 60) : null, message: msg, cards
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
    const rows = await api('/rest/v1/mail?select=id,from_user,from_name,deck_name,subject_name,message,cards,created_at,read_at,added_at&order=created_at.desc');
    mailbox.list = rows || [];
    mailbox.n = mailbox.list.filter(r => !r.read_at).length;
    mailbox.err = 0;
  } catch (e) { mailbox.err = 1; }
  if (view.name === 'mail') render();
}

export async function openMail(id) {
  setMailOpen(id);
  const it = mailbox.list && mailbox.list.find(x => x.id === id);
  go('lettre', id);
  if (it && !it.read_at) {
    it.read_at = new Date().toISOString();
    mailbox.n = mailbox.list.filter(r => !r.read_at).length;
    if (view.name === 'mail') render();
    try { await api(`/rest/v1/mail?id=eq.${id}`, 'PATCH', { read_at: it.read_at }, { Prefer: 'return=minimal' }); }
    catch (e) { /* marquage « lu » sans conséquence grave : au pire, le mail reparaît non lu au prochain mailPull() */ }
  }
}

export async function addMail(it) {
  const n = (it.cards || []).length;
  const d = importPayload({ name: it.deck_name, subjectName: it.subject_name, cards: it.cards }, true);
  it.added_at = new Date().toISOString();
  closeMenu();
  if (d) go('deck', d.id);
  toast(I.check, plur(n) + ' ajoutée' + (n > 1 ? 's' : ''));
  try { await api(`/rest/v1/mail?id=eq.${it.id}`, 'PATCH', { added_at: it.added_at }, { Prefer: 'return=minimal' }); }
  catch (e) { /* le paquet est déjà dans la bibliothèque locale, ce marquage n'est qu'un repère */ }
}

export async function delMail(id) {
  mailbox.list = mailbox.list.filter(x => x.id !== id);
  mailbox.n = mailbox.list.filter(r => !r.read_at).length;
  closeMenu();
  if (view.name === 'lettre') go('mail'); else render();
  try { await api(`/rest/v1/mail?id=eq.${id}`, 'DELETE', null, { Prefer: 'return=minimal' }); }
  catch (e) { /* la boîte de réception locale l'a déjà retiré ; au pire il réapparaît au prochain mailPull() */ }
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
  } catch (e) { /* l'élagage n'est pas critique : les vieilles versions attendront le prochain passage */ }
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
  toast(I.redo, plur(d.cards.length) + ' restaurée' + (d.cards.length > 1 ? 's' : ''), true);
}

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
  return SITE + '#s=' + tok;
}

export async function revokeShare(d) {
  const tok = (d.meta || {}).tok; if (!tok) return;
  const m = { ...metaOf(d) }; delete m.tok; d.meta = m; saveDeck(d);
  try { await api('/rest/v1/shares?token=eq.' + encodeURIComponent(tok), 'DELETE', null, { Prefer: 'return=minimal' }); }
  catch (e) { /* le lien local est déjà retiré du paquet ; le jeton orphelin restera sans usage */ }
}

export async function openShared(tok) {
  setShared({ tok, st: 'load' });
  setView({ name: 'shared' }); setAnimate(true); render();
  try {
    const rows = await api('/rest/v1/rpc/shared_deck', 'POST', { tok });
    const r = (rows || [])[0];
    setShared(r ? { tok, st: 'ok', d: r } : { tok, st: 'gone' });
  } catch (e) { setShared({ tok, st: 'err' }); }
  if (view.name === 'shared') render();
}

/* ---------- l'entretien de la bibliothèque (M04.T2, M04.T4) ----------
   Ce qu'on demandait autrefois à « Vérifier ma bibliothèque » se fait seul,
   sans rien demander ni afficher (2026-10-25), au calme après le démarrage :
   les 12 invariants (src/invariants.js), les 8 familles de réparation
   (src/reparation.js) et les doublons d'un même livre (src/doublons.js),
   purs et testés, chargés à la demande (le démarrage n'a plus de marge).
   Les doublons ne se retirent pas d'un devoir : chaque page y compte pour
   l'avancement que voit le professeur. Rien n'est envoyé si rien n'a bougé. */
export async function entretienAuto() {
  if (!auth || !db.decks.length) return 0;
  const [{ repairLibrary, scanLibrary }, { dedupeLibrary }] =
    await Promise.all([import('../reparation.js'), import('../doublons.js')]);
  const abimees = scanLibrary(db.decks).cards;
  const { touched } = abimees ? repairLibrary(db.decks, { w: fsrsW() }, uid, Date.now()) : { touched: [] };
  const dd = dedupeLibrary(db.decks.filter(d => !deDevoir(d.cards)));
  const tous = new Set([...touched, ...dd.touched]);
  for (const d of tous) saveDeck(d);
  if (tous.size && view.name === 'deck') render();
  return tous.size;
}

/* ---------- sauvegarde intégrale (M04.T6) ----------
   Le format, la lecture et la restauration sont purs et testés
   (src/sauvegarde.js) ; ici, seulement l'état courant et l'écriture :
   chaque paquet restauré passe par saveDeck (donc la file hors ligne), et
   toute la restauration s'annule d'un geste (pushUndo, avec les
   identifiants tirés d'avance quand le fichier vient d'un autre compte). */
/* src/sauvegarde.js ne se charge qu'ici, à la demande : une sauvegarde se
   fait rarement, et le démarrage n'a plus un octet de marge (tools/budget.js). */
const sauvegarde = () => import('../sauvegarde.js');

export async function backupData() {
  const { exportLibrary } = await sauvegarde();
  return exportLibrary(db, auth && auth.uid, Date.now());
}

export async function lireSauvegarde(txt) {
  const { readBackup } = await sauvegarde();
  return readBackup(txt);
}

export async function backupRestore(data) {
  const { restoreLibrary } = await sauvegarde();
  const owner = auth && auth.uid;
  const foreign = !!data.owner && data.owner !== owner;
  const ids = data.decks.map(d => (foreign ? uid() : d.id));
  pushUndo('Restauration', ids);
  let k = 0;
  const r = restoreLibrary(db, data, owner, () => ids[k++]);
  for (const d of r.decks) saveDeck(d);
  if (auth) for (const s of r.subjects) pushSubject(s);
  save(); render();
  return r;
}
