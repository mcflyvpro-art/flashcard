import { $ } from '../racine.js';
import { I, svg } from '../icones.js';
import { DAY, MIN } from '../fsrs.js';
import {
  accounts, auth, blocks, db, iAmMod, mailbox, mods, myRole, online, prefs, ref,
  setSubjColor, setSubjEdit, setSubjName, shared, trash, vers
} from '../data/etat.js';
import { go, render } from './bibliotheque.js';
import { fsrsDR, plain } from './carte-media.js';
import { atSchool, isAdmin } from './classement.js';
import {
  COLORS, PALETTE, canUndo, deck, esc, pending, plur, pushUndo, saveDeck, shortWho,
  subj, sty, uid, undoLabel
} from '../core/coeur-sync.js';
import { KEEP, snapVersion } from '../core/reglages-corbeille.js';
import { hlp } from './connexion.js';
import { applyFont, importPayload, savePrefs, toast } from './import-cartes.js';
import { closeMenu, openMenu } from './menus-a.js';
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

const leftFor = iso => Math.max(0, KEEP - Math.floor((Date.now() - Date.parse(iso)) / DAY));

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

export const cf = c => Array.isArray(c) ? c[0] : ((c && c.f) || '');

export const cb = c => Array.isArray(c) ? c[1] : ((c && c.b) || '');

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
