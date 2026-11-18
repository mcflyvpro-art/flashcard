// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { chargeur } from './chargeur.js';
import { $ } from '../racine.js';
import { I, svg } from '../icones.js';
import {
  addQ, asks, auth, board, cercle, compte, duels, friends, mates, mates2, me, school, setAddQ, setAnimate, setMateOpen, view
} from '../data/etat.js';
import { bindPager, go, monIdent, render, tabs } from './bibliotheque.js';
import { isPupil } from './classement.js';
import { boardPull, schoolPull } from '../core/classement.js';
import { esc, plur, shortWho } from '../core/coeur-sync.js';
import { nombre } from './tuiles.js';
import { clubsPull, profilPull, sallesPull } from '../core/cercle.js';
import { toast } from './import-cartes.js';
import { classement, medaille } from '../club.js';
import { avatar, blasonClub, iconeEmbleme, medailleHtml } from './jeton.js';
import { hlp } from './connexion.js';
import { placeTexte } from '../defi.js';
import { myScore, rankOf } from './defis.js';
import { duelsPull } from '../core/defis.js';
import { camaradesHtml } from './eleve-classes.js';
import { askFriend, friendsPull, mePull } from '../core/reglages-corbeille.js';

/* ══════════ le cercle des lecteurs ══════════
   Refait le 2026-10-24. Trois choses, pas une de plus : des AMIS, des
   CLUBS, des DÉFIS. Ce qui vivait ici et n'en faisait pas partie en est
   sorti : « Mes classes » a son propre onglet (et seulement pour les comptes
   d'une classe), la bibliothèque commune a disparu, les défis ne sont plus
   une tuile à part mais ce qu'on fait avec ses amis et dans ses clubs.

   L'écran se lit de haut en bas comme on s'en sert : qui je suis, les deux
   gestes (lancer un défi, entrer un code), ce qui se joue en ce moment,
   mes clubs ; à côté (sur ordinateur) ou plus bas (sur téléphone), où j'en
   suis face à mes amis. */

export const BRANGE = { 7: '7 jours', 30: '30 jours', 365: 'Toujours' };

export { avatar };
export const iconeClub = g => iconeEmbleme(g.embleme);

/* Sous un titre, une seule information, dite en mots (2026-11-18, demandé :
   « ces micro-infos ne sont pas claires et chargent l'écran ») : plus de
   ligne d'icônes et de chiffres sans nom. Le détail va dans la fiche, en
   tuiles nommées (ui/tuiles.js). */
const ligne = t => (t ? `<i>${t}</i>` : '');
// la période du classement, dite en mots (BRANGE)
const PERIODE = { 7: ' cette semaine', 30: ' ces 30 derniers jours', 365: '' };

/* tout ce que l'écran a besoin de savoir, lancé en parallèle */
/* relire : on OUVRE l'onglet — les amis, le classement, les clubs et les
   défis se relisent en fond, même déjà là ; chacun ne repeint que si sa
   liste a bougé. Sans lui (le préchargement de l'arrivée), seulement ce
   qui manque : avant le 2026-11-07, un ami accepté ou un club rejoint
   pendant que l'app était ouverte n'apparaissait qu'au redémarrage (le
   préchargement avait déjà lu la liste ; trouvé par e2e/profil.e2e.js). */
export function commuPull(relire = false) {
  if (!me || relire) {
    const avant = JSON.stringify(me);                // une copie gardée : on ne repeint que si le profil a bougé
    mePull().then(() => { if (view.name === 'commu' && JSON.stringify(me) !== avant) { setAnimate(false); render(); } });
  }
  if (!friends || relire) friendsPull(relire);
  if (!duels.list || relire) duelsPull(relire);
  if (!board.rows || relire) boardPull(relire);
  if (!isPupil() && (cercle.clubs === null || relire)) clubsPull(relire);
  sallesPull();
  if (school === null) schoolPull().then(() => { if (view.name === 'commu') { setAnimate(false); render(); } });
}

/* ---------- qui je suis ---------- */
function maLigne() {
  return classement(board.rows || [], 'n', auth.uid).find(r => r.moi);
}

/* Ma place parmi mes amis, en une phrase ; seul, ce que j'ai révisé. */
function moiLigne() {
  const r = maLigne(), n = (board.rows || []).length, quand = PERIODE[board.range] || '';
  if (!r || !+r.n) return '';
  return ligne(n > 1 ? `${placeTexte(r.place)} de tes amis${quand}`
    : `${nombre(r.n)} carte${+r.n > 1 ? 's' : ''} révisée${+r.n > 1 ? 's' : ''}${quand}`);
}

function moiEleve() {
  const nom = (compte && compte.nom) || (me && me.name) || 'Élève';
  // son nom de classe en titre ; dessous, le pseudo que voient ses camarades
  const sous = me && me.handle ? '@' + esc(me.handle) : school && school.classe ? esc(school.classe) : '';
  return `<button class="cc-moi" data-cc="moi">${avatar(auth.uid, monIdent(), 'lg')}
    <span class="cc-moi-t"><b>${esc(nom)}</b>${ligne(sous)}</span>${svg(I.pen)}</button>`;
}

function moiHtml(eleve) {
  if (eleve) return moiEleve();
  const h = me && me.handle;
  return `<button class="cc-moi" data-cc="moi">${avatar(auth.uid, monIdent(), 'lg')}
    <span class="cc-moi-t"><b>${h ? '@' + esc(h) : '…'}</b>${moiLigne()}</span>${svg(I.pen)}</button>`;
}

function actionsHtml(eleve) {
  return `<div class="cc-actions">
    <button class="cc-act pri" data-cc="defi">${svg(I.bolt)}<b>Lancer un défi</b></button>
    <button class="cc-act" data-cc="pin">${svg(I.hash)}<b>Entrer un code</b></button>
  </div>`;
}

/* ---------- ce qui se joue en ce moment ---------- */
export function enDirectHtml(salles) {
  const l = salles || [];
  if (!l.length) return '';
  return `<section class="cc-sec"><h2 class="cc-h">En direct</h2><div class="cc-lives">${l.map(s => `
    <div class="cc-live"><span class="cc-pulse" aria-hidden="true"></span>
      <span class="cc-live-t"><b>${esc(s.titre)}</b>${ligne((s.hote ? 'Ta partie' : 'Lancée par ' + esc(s.hote_nom || 'un ami'))
        + (s.joueurs ? ', ' + plur(s.joueurs, 'joueur') : ''))}</span>
      <button class="cc-btn pri" data-cc="salle" data-id="${esc(s.id)}" data-pin="${esc(s.pin)}"
        data-dedans="${s.dedans || s.hote ? 1 : ''}">${s.hote ? 'Reprendre' : s.dedans ? 'Revenir' : 'Rejoindre'}</button>
    </div>`).join('')}</div></section>`;
}

/* Un défi « à son rythme » : à jouer en premier, puis ceux déjà joués, avec
   ma place. Dessous, qui l'a lancé et, s'il vient d'un club ou de la
   classe, d'où (dans Mes amis, les amis vont sans dire) ; le nombre de
   questions, le jeu et les joueurs sont dans sa fiche. */
function ouDefi(du) {
  if (du.class_id) return ' pour ta classe';
  if (du.group_id) { const g = (cercle.clubs || []).find(x => x.id === du.group_id); return ' dans ' + (g ? esc(g.nom) : 'un club'); }
  return '';
}
export const lanceur = du => (du.owner === auth.uid ? 'Lancé par toi' : 'Lancé par ' + esc(shortWho(du.who) || 'un ami'));

export function defiLigne(du, avecOu = true) {
  const m = myScore(du.id), r = rankOf(du.id);
  const pos = m ? r.findIndex(x => x.user_id === auth.uid) + 1 : 0;
  return `<button class="cc-defi" data-duel="${esc(du.id)}">
    <i class="cc-defi-i">${svg(I.bolt)}</i>
    <span class="cc-defi-t"><b>${esc(du.name)}</b>${ligne(lanceur(du) + (avecOu ? ouDefi(du) : ''))}</span>
    ${m ? `<em class="cc-score">${medaille(pos) ? medailleHtml(pos) : placeTexte(pos)}<b>${m.score}/${du.total}</b></em>`
      : `<em class="cc-ajouer">${svg(I.play)}Jouer</em>`}</button>`;
}

export const parDefi = l => (l || []).slice().sort((a, b) => (myScore(a.id) ? 1 : 0) - (myScore(b.id) ? 1 : 0));

function defisHtml() {
  const l = duels.list;
  if (!l) return `<section class="cc-sec"><h2 class="cc-h">Défis</h2>${chargeur(true)}</section>`;
  const tri = parDefi(l), max = cercle.tous ? 40 : 4;
  return `<section class="cc-sec"><div class="cc-h"><h2>Défis</h2>${
    tri.length > 4 ? `<button class="cc-lnk" data-cc="tous">${cercle.tous ? 'Moins' : 'Voir les ' + tri.length}</button>` : ''}</div>
    ${tri.length ? `<div class="cc-list">${tri.slice(0, max).map(du => defiLigne(du)).join('')}</div>`
      : `<p class="cc-vide">${svg(I.bolt)}Aucun défi</p>`}
  </section>`;
}

/* ---------- mes clubs ---------- */
export function clubCarte(g) {
  const rang = g.membres > 1 && g.mes_pages ? placeTexte(g.mon_rang) : '';
  return `<button class="cc-club" data-cc="club" data-id="${esc(g.id)}">
    ${blasonClub(g)}
    <span class="cc-club-t"><b>${esc(g.nom)}</b>${ligne(plur(g.membres || 1, 'membre'))}</span>
    ${g.en_direct ? '<em class="cc-tag live">En direct</em>' : rang ? `<em class="cc-tag">${rang}</em>` : ''}</button>`;
}

function clubsHtml() {
  const l = cercle.clubs;
  if (l === null) return `<section class="cc-sec"><h2 class="cc-h">Mes clubs</h2>${chargeur(true)}</section>`;
  if (!l.length) return `<section class="cc-sec"><h2 class="cc-h">Mes clubs</h2>
    <div class="cc-nouveau"><i class="jt groupe xl" style="--k:var(--ink)">${svg(I.owl)}</i>
      <div class="cc-nv-b"><button class="cc-btn pri" data-cc="club-creer">${svg(I.plus)}Créer un club</button>
        <button class="cc-btn" data-cc="club-rejoindre">${svg(I.hash)}J’ai un code</button></div></div></section>`;
  return `<section class="cc-sec"><div class="cc-h"><h2>Mes clubs</h2>
      <button class="cc-lnk" data-cc="club-rejoindre">${svg(I.hash)}Code</button></div>
    <div class="cc-clubs">${l.map(clubCarte).join('')}
      <button class="cc-club cc-creer" data-cc="club-creer"><i class="jt groupe vide">${svg(I.plus)}</i>
        <span class="cc-club-t"><b>Créer un club</b></span></button>
    </div></section>`;
}

/* ---------- face aux amis ---------- */
/* `ident` : ce dont le jeton tire ses initiales — le pseudo s'il y en a un,
   sinon le nom. Le même partout (cercle, club, amis, fiches), pour qu'une
   personne ait le même visage d'un écran à l'autre. */
export const ident = (pseudo, nom) => pseudo || nom || '';

// sous une ligne de classement : la part de bonnes réponses, en mots
export const reussite = (justes, n) => (+n ? `${Math.round(justes / n * 100)} % de bonnes réponses` : '');

export function rangLigne(r, nom, sous) {
  return `<button class="cc-rk${r.moi ? ' moi' : ''}" data-lecteur="${esc(r.uid || r.user_id)}"><span class="cc-pl">${medailleHtml(r.place)}</span>
    ${avatar(r.uid || r.user_id, ident(r.handle || r.pseudo, nom), 'sm')}
    <span class="cc-rk-t"><b>${esc(nom)}${r.moi ? ' <small>toi</small>' : ''}</b>
      ${sous ? `<i>${esc(sous)}</i>` : ''}<span class="cc-bar"><em style="width:${r.part}%"></em></span></span>
    <span class="cc-rk-n">${r.n != null ? r.n : r.pages}</span></button>`;
}

/* ---------- la porte du profil d'un lecteur ----------
   Toucher quelqu'un (un ami, une ligne de classement, un membre de club)
   ouvre son profil : ui/profil.js et sa feuille de style, chargés à la
   demande. Rien d'autre ne doit importer ui/profil.js. */
let profilMorceau = null;
export function ouvrirProfil(id, o = {}) {
  if (!id) return;
  cercle.profilClub = o.club || null;
  cercle.profilRetour = { name: view.name, id: view.id };
  setMateOpen(id);                   // les gestes d'ami (défier, prêter, retirer) lisent mateOpen
  profilPull(id);
  go('profil', id);
}
export function profilView() {
  if (profilMorceau) return profilMorceau.profilEcran();
  $.innerHTML = `<div class="page cc">${chargeur()}</div>`;
  import('./profil.js').then(m => { profilMorceau = m; if (view.name === 'profil') render(); })
    .catch(() => toast(I.x, 'Le profil n’a pas pu s’ouvrir : vérifie ta connexion'));
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-lecteur]');
  if (b) ouvrirProfil(b.dataset.lecteur);
});

function classementCourt() {
  if (!board.rows) return `${chargeur(true)}`;
  const l = classement(board.rows, 'n', auth.uid);
  if (l.length < 2) return `<p class="cc-vide">${svg(I.trophy)}Ajoute des amis</p>`;
  const top = l.slice(0, 5), moi = l.find(r => r.moi);
  if (moi && !top.includes(moi)) top.push(moi);
  return `<div class="cc-rank">${top.map(r => rangLigne(r, shortWho(r.who) || 'Membre')).join('')}</div>`;
}

function amisHtml(eleve) {
  const l = mates || [], a = (asks || []).length;
  return `<section class="cc-carte">
    <div class="cc-h"><h2>${eleve ? 'Camarades' : 'Amis'} <span>${l.length || ''}</span></h2>
      <button class="cc-lnk" data-act="friends" aria-label="${a ? `Gérer, ${a} ${a > 1 ? 'demandes' : 'demande'}` : 'Gérer'}">${
        a ? `<b class="cc-badge">${a}</b>` : ''}${svg(I.arrow)}</button></div>
    <div class="cc-amis">${l.slice(0, 11).map(f => `<button class="cc-ami" data-mate="${esc(f.id)}">
        ${avatar(f.id, f.handle || f.name)}<span>${esc((shortWho(f.name || f.handle) || '').split(' ')[0])}</span></button>`).join('')}
      <button class="cc-ami plus" data-act="friends"><i class="jt vide">${svg(I.plus)}</i><span>Ajouter</span></button></div>
  </section>`;
}

export function commuView() {
  const eleve = isPupil();
  $.innerHTML = `
    <div class="page cc" id="page">
      <div class="top"><div class="hero">Mes amis</div></div>
      <div class="cc-grille">
        <div class="cc-main">
          ${moiHtml(eleve)}
          ${actionsHtml(eleve)}
          ${enDirectHtml(cercle.salles)}
          ${defisHtml()}
          ${eleve ? '' : clubsHtml()}
        </div>
        <aside class="cc-cote">
          <section class="cc-carte"><div class="cc-h"><h2>Classement ${hlp('classement')}</h2>
            <button class="cc-lnk" data-act="friends" aria-label="Tout voir">${svg(I.arrow)}</button></div>
            ${classementCourt()}</section>
          ${amisHtml(eleve)}
        </aside>
      </div>
    </div>
    ${tabs('commu')}`;
  bindPager();
}

/* ══════════ la page des amis ══════════
   Ajouter quelqu'un par son pseudo, répondre aux demandes, et le classement
   complet, sur 7 jours, 30 jours ou depuis toujours. Un élève de classe
   n'a pas d'annuaire : il ajoute ses camarades depuis leur liste. */
function demandesHtml() {
  const a = asks || [];
  if (!a.length) return '';
  return `<section class="cc-sec"><h2 class="cc-h">Demandes <span>${a.length}</span></h2>
    <div class="cc-list">${a.map(f => `<div class="cc-ligne"><button class="cc-qui" data-lecteur="${esc(f.id)}">${avatar(f.id, f.handle || f.name)}
      <span class="cc-ligne-t"><b>${esc(f.name || '')}</b><i>@${esc(f.handle || '')}</i></span></button>
      <button class="cc-rond ok" data-yes="${esc(f.id)}" aria-label="Accepter">${svg(I.check)}</button>
      <button class="cc-rond" data-no="${esc(f.id)}" aria-label="Refuser">${svg(I.x)}</button></div>`).join('')}</div></section>`;
}

function mesAmisHtml(eleve) {
  const l = mates || [];
  if (!friends) return `${chargeur(true)}`;
  if (!l.length) return `<p class="cc-vide">${svg(I.users)}Personne pour l’instant</p>`;
  return `<div class="cc-list">${l.map(f => `<button class="cc-ligne" data-mate="${esc(f.id)}">${avatar(f.id, f.handle || f.name)}
    <span class="cc-ligne-t"><b>${esc(f.name || '')}</b><i>${f.handle ? '@' + esc(f.handle) : ''}</i></span>
    ${svg(I.arrow)}</button>`).join('')}</div>`;
}

function classementLong() {
  const seg = `<div class="seg" id="bRange">${Object.entries(BRANGE).map(([k, n]) =>
    `<button class="${board.range === +k ? 'on' : ''}" data-brange="${k}">${n}</button>`).join('')}</div>`;
  if (!board.rows) return seg + `${chargeur(true)}`;
  const l = classement(board.rows, 'n', auth.uid);
  if (!l.length) return seg + `<p class="cc-vide">${svg(I.trophy)}Aucune révision</p>`;
  return seg + `<div class="cc-rank">${l.map(r => rangLigne(r, shortWho(r.who) || 'Membre',
    reussite(r.ok, r.n))).join('')}</div>`;
}

export function friendsView() {
  const eleve = isPupil();
  $.innerHTML = `
    <div class="bar"><button class="ic" data-act="commu" aria-label="Retour">${svg(I.back)}</button>
      <h1>${eleve ? 'Camarades' : 'Amis'}</h1></div>
    <div class="page cc">
      <div class="cc-grille">
        <div class="cc-main">
          ${eleve ? '' : `<form class="cc-ajout" id="ccadd" autocomplete="off">
            <span class="cc-at">@</span><input id="addq" type="search" placeholder="Pseudo d’un ami" enterkeyhint="send"
              autocomplete="off" autocapitalize="none" spellcheck="false" value="${esc(addQ)}" aria-label="Pseudo d’un ami">
            <button class="cc-btn pri" data-act="doadd">Ajouter</button></form>
          ${me && me.handle ? `<button class="cc-btn cc-partage" data-cc="ami-partager">${svg(I.share)}Partager @${esc(me.handle)}</button>` : ''}`}
          ${demandesHtml()}
          ${eleve && (mates2 || []).length ? camaradesHtml() : ''}
          <section class="cc-sec"><h2 class="cc-h">Amis <span>${(mates || []).length || ''}</span></h2>
            ${mesAmisHtml(eleve)}</section>
        </div>
        <aside class="cc-cote"><section class="cc-carte"><h2 class="cc-h">Classement ${hlp('classement')}</h2>${classementLong()}</section></aside>
      </div>
    </div>`;
  const q = document.getElementById('addq'), f = document.getElementById('ccadd');
  if (q) q.addEventListener('input', () => setAddQ(q.value));
  if (f) f.onsubmit = e => { e.preventDefault(); doAdd(); };
}

export async function doAdd() {
  const v = addQ.trim().replace(/^@/, ''); if (!v) return;
  if (await askFriend(v)) { setAddQ(''); setAnimate(false); render(); }
}
