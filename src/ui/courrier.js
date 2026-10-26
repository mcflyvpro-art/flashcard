// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { $ } from '../racine.js';
import { I, svg } from '../icones.js';
import { auth, db, mailbox, view } from '../data/etat.js';
import { esc, plur, shortWho, sty, subj } from '../core/coeur-sync.js';
import { trouverParNom } from '../matieres.js';
import { norm } from '../normaliser.js';
import { go, render } from './bibliotheque.js';
import { avatar } from './jeton.js';
import { timeAgo } from './reglages-corbeille.js';
import './courrier.css';

/* ══════════ le courrier (refait le 2026-10-25) ══════════
   Chargé à la demande (ui/reglages-corbeille.js, `mailView`/`lettreView`),
   avec sa feuille de style (préfixe co-). Un courrier, c'est une lettre :
   qui l'envoie (son jeton, son nom), quand, ce qu'il dit, et le livre qu'il
   contient — sa matière, ses pages, qu'on lit avant de l'ajouter. La boîte
   montre les mêmes choses en une ligne. Rien d'autre ne doit importer ce
   fichier : passer par la porte. */

const qui = it => shortWho(it.from_name) || 'Un ami';
const pages = it => (it.cards || []).length;
/* Une lettre sans pages est un mot — celui d'un professeur à sa classe
   (prof_message_classe) : le nom de la classe, le message, pas de livre. */
const mot = it => !pages(it);

// la matière du livre, à la couleur qu'elle a ici si on l'a aussi
function matiere(it) {
  if (!it.subject_name) return null;
  const s = trouverParNom(db.subjects, it.subject_name);
  return { nom: it.subject_name, sty: s ? sty(subj(s.id)) : '' };
}

const pastille = m => m ? `<span class="co-mat" style="${m.sty}"><i></i>${esc(m.nom)}</span>` : '';

function quand(iso) {
  const d = new Date(iso), maintenant = new Date();
  const jour = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long',
    ...(d.getFullYear() !== maintenant.getFullYear() ? { year: 'numeric' } : {}) });
  const ms = maintenant - d;
  return ms < 864e5 ? `aujourd’hui · ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
    : `le ${jour}`;
}

// un livre de ce nom est-il déjà dans la bibliothèque ?
const dejaLa = it => db.decks.find(d => norm(d.name) === norm(it.deck_name));

/* ---------- la boîte ---------- */
function ligne(it) {
  const m = matiere(it), neuf = !it.read_at;
  return `<button class="co-ligne${neuf ? ' neuf' : ''}" data-mail="${it.id}">
      ${avatar(it.from_user, qui(it))}
      <span class="co-l">
        <span class="co-h"><b>${esc(qui(it))}</b><time>${timeAgo(it.created_at)}</time></span>
        <span class="co-livre">${svg(mot(it) ? I.school : I.book)}<span>${esc(it.deck_name)}</span></span>
        <span class="co-s">${mot(it) ? '' : `${pastille(m)}<span class="co-n">${plur(pages(it), 'page')}</span>`}
          ${it.message ? `<span class="co-extrait">« ${esc(it.message)} »</span>` : ''}</span>
      </span>
      ${neuf ? '<i class="co-point" aria-label="Non lu"></i>' : ''}
    </button>`;
}

export function boiteView() {
  const l = mailbox.list;
  $.innerHTML = `
    <div class="bar"><button class="ic" data-act="home" aria-label="Retour">${svg(I.back)}</button></div>
    <div class="page">
      <div class="top"><div class="hero">Courrier</div>${mailbox.n ? `<span class="co-nb">${mailbox.n}</span>` : ''}</div>
      ${!l ? `<div class="empty">${svg(I.mail)}<p>${mailbox.err ? 'Boîte indisponible' : 'Chargement…'}</p></div>`
        : !l.length ? `<div class="empty">${svg(I.mail)}<p><b>Aucun message</b></p></div>`
        : `<div class="co-boite">${l.map(ligne).join('')}</div>`}
    </div>`;
}

/* ---------- une lettre ---------- */
const APERCU = 12;
let toutes = null;                   // la lettre dont on a déplié toutes les pages

function pagesHtml(it) {
  const l = it.cards || [], n = l.length, voir = toutes === it.id ? l : l.slice(0, APERCU);
  return `<section class="co-pages">
      <div class="lbl"><span>Pages</span><span>${n}</span></div>
      <ol class="co-liste">${voir.map(c => `<li><span class="a">${esc(c[0])}</span><span class="b">${esc(c[1])}</span></li>`).join('')}</ol>
      ${n > voir.length ? `<button class="co-plus" data-co="toutes">${svg(I.down)}Voir les ${n} pages</button>` : ''}
    </section>`;
}

function actionsHtml(it) {
  const la = dejaLa(it);
  const ajouter = `<button class="cta${it.added_at ? ' ghost' : ''}" data-mact="addmail">${svg(I.plus)}${it.added_at ? 'Ajouter une copie' : 'Ajouter à ma bibliothèque'}</button>`;
  const ouvrir = la ? `<button class="cta" data-go="${la.id}">${svg(I.book)}Ouvrir « ${esc(la.name)} »</button>` : '';
  return `<div class="co-actions">${it.added_at && la ? ouvrir + ajouter : ajouter}</div>
    ${!it.added_at && la ? `<p class="co-note">${svg(I.check)}Tu as déjà un livre « ${esc(la.name)} »</p>` : ''}`;
}

export function lettreView() {
  const it = (mailbox.list || []).find(x => String(x.id) === String(view.id));
  if (!it) return go('mail');
  const m = matiere(it), d = new Date(it.created_at);
  const autre = it.from_user && it.from_user !== auth.uid;
  $.innerHTML = `
    <div class="bar">
      <button class="ic" data-co="boite" aria-label="Retour">${svg(I.back)}</button>
      <div style="flex:1"></div>
    </div>
    <div class="co-page">
      <section class="co-lettre">
        <div class="co-de">${avatar(it.from_user, qui(it), 'lg')}
          <div><b>${esc(qui(it))}</b><span>${mot(it) ? `écrit à ${esc(it.deck_name || 'la classe')}` : 't’a envoyé un livre'}</span>
            <time datetime="${esc(it.created_at)}" title="${esc(d.toLocaleString('fr-FR'))}">${quand(it.created_at)}</time></div>
        </div>
        ${it.message ? `<blockquote class="co-mot">${esc(it.message)}</blockquote>` : ''}
        ${mot(it) ? '' : `<div class="co-colis" style="${m ? m.sty : ''}">
          <div class="co-couv">${svg(I.book)}</div>
          <div class="co-titre"><b>${esc(it.deck_name)}</b>
            <span>${pastille(m)}<span class="co-n">${plur(pages(it), 'page')}</span></span></div>
        </div>
        ${actionsHtml(it)}`}
        <div class="co-pied">
          <button data-mact="delmail">${svg(I.trash)}Supprimer</button>
          ${autre ? `<button data-mact="mailreport">${svg(I.warn)}Signaler</button>
            <button data-mact="mailblock">${svg(I.lock)}Bloquer</button>` : ''}
        </div>
      </section>
      ${mot(it) ? '' : pagesHtml(it)}
    </div>`;
}

/* Les gestes propres au courrier : un seul écouteur, posé quand le morceau
   se charge (ajouter, supprimer, signaler passent par menus-c, data-mact). */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-co]'); if (!b) return;
  if (b.dataset.co === 'boite') return go('mail');
  if (b.dataset.co === 'toutes') { toutes = view.id; render(); }
});
