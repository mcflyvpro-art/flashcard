// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { $ } from '../racine.js';
import { I, svg } from '../icones.js';
import { DAY } from '../fsrs.js';
import {
  auth, board, db, duels, findQ, groupTab, groups, lib, quiz, scope, setAnimate, setFindQ,
  stats, study
} from '../data/etat.js';
import { render } from './bibliotheque.js';
import { groupsPull } from '../core/bilan-devoirs.js';
import { STATE, cstate, plain } from './carte-media.js';
import { boardPull } from '../core/classement.js';
import { PALETTE, esc, live, plur, scopeName, shortWho, sty, subj } from '../core/coeur-sync.js';
import { myScore, rankOf } from './defis.js';
import { duelsPull } from '../core/defis.js';
import { toast } from './import-cartes.js';
import { mountMenu } from './menus-a.js';
import { norm } from './quiz.js';
import { timeAgo } from './reglages-corbeille.js';
import { libPull } from '../core/reglages-corbeille.js';

/* ---------- l'écran du groupe ---------- */
const GTABS = { lib: 'Bibliothèque', duel: 'Défis', board: 'Classement' };

export const BRANGE = { 7: '7 jours', 30: '30 jours', 365: 'Toujours' };

/* Une seule barre gouverne les trois onglets : ce qu'on lit et ce qu'on
   publie vont au même endroit. Sans club, elle n'a rien à demander et
   ne s'affiche pas. */
function scopeBar() {
  if (!groups || !groups.length) return '';
  return `<div class="pills" id="gScope">
    <button class="p${scope === null ? ' on' : ''}" data-scope="">Mes lecteurs</button>
    ${groups.map(g => `<button class="p${scope === g.id ? ' on' : ''}"
      data-scope="${esc(g.id)}">${esc(g.name)}</button>`).join('')}</div>`;
}

const inScope = x => (x.group_id || null) === scope;

export function groupView() {
  $.innerHTML = `
    <div class="bar"><button class="ic" data-act="home" aria-label="Retour">${svg(I.back)}</button>
      <h1>${esc(scopeName())}</h1></div>
    <div class="page">
      ${scopeBar()}
      <div class="seg" id="gTabs">${Object.entries(GTABS).map(([k, n]) =>
        `<button class="${groupTab === k ? 'on' : ''}" data-gtab="${k}">${n}</button>`).join('')}</div>
      ${groupTab === 'lib' ? libPane() : groupTab === 'duel' ? duelPane() : boardPane()}
    </div>`;
}

function libPane() {
  const l = lib.list && lib.list.filter(inScope);
  return !l ? `<div class="empty">${svg(I.book)}<p>${lib.err ? 'Bibliothèque indisponible' : 'Chargement…'}</p></div>`
    : !l.length ? `<div class="empty">${svg(I.book)}<p><b>Étagère vide</b>${
        scope ? 'Personne n’a encore posé de livre dans ce club.' : 'Prête un livre depuis son menu Partager.'}</p></div>`
    : `<div class="slist">${l.map(it => `
        <button class="sr flat" data-lib="${esc(it.deck_id)}">${svg(I.book)}
          <span class="ml2"><span class="n">${esc(it.name)}</span>
            <span class="sub">${esc(shortWho(it.who) || 'Un compte')}${
              it.subject ? ' · ' + esc(it.subject) : ''} · ${plur(it.n, 'page')}</span></span>
          <span class="c">${timeAgo(it.updated_at)}</span>${svg(I.arrow)}</button>`).join('')}</div>`;
}

function duelPane() {
  const l = duels.list && duels.list.filter(inScope);
  const mk = `<button class="cta ghost" data-act="duelnew">${svg(I.flame)}Lancer un défi</button>`;
  if (!l) return `${mk}<div class="empty">${svg(I.flame)}<p>${duels.err ? 'Défis indisponibles' : 'Chargement…'}</p></div>`;
  if (!l.length) return `${mk}<div class="empty">${svg(I.flame)}<p><b>Aucun défi</b>Dix questions, les mêmes pour tous.</p></div>`;
  return `${mk}<div class="slist">${l.map(du => {
    const me = myScore(du.id), r = rankOf(du.id);
    const pos = me ? r.findIndex(s => s.user_id === auth.uid) + 1 : 0;
    return `<button class="sr flat" data-duel="${esc(du.id)}">${svg(I.flame)}
      <span class="ml2"><span class="n">${esc(du.name)}</span>
        <span class="sub">${esc(shortWho(du.who) || 'Un compte')} · ${plur(du.total, 'question')}${
          r.length ? ' · ' + plur(r.length, 'joueur') : ''}</span></span>
      <span class="c">${me ? `<b class="dsc">${me.score}/${du.total}</b> ${pos === 1 ? '🥇' : pos + 'ᵉ'}`
        : '<span class="dnew">à jouer</span>'}</span>${svg(I.arrow)}</button>`;
  }).join('')}</div>`;
}

function boardPane() {
  const r = board.rows;
  const seg = `<div class="seg" id="bRange">${Object.entries(BRANGE).map(([k, n]) =>
    `<button class="${board.range === +k ? 'on' : ''}" data-brange="${k}">${n}</button>`).join('')}</div>`;
  if (!r) return `${seg}<div class="empty">${svg(I.trophy)}<p>${board.err ? 'Classement indisponible' : 'Chargement…'}</p></div>`;
  if (!r.length) return `${seg}<div class="empty">${svg(I.trophy)}<p><b>Personne n’a révisé</b>sur cette période.</p></div>`;
  const top = r[0].n || 1;
  const MED = ['🥇', '🥈', '🥉'];
  return `${seg}<div class="rows">${r.map((x, i) => `
    <div class="bdr ${x.uid === auth.uid ? 'me' : ''}">
      <span class="bdp">${MED[i] || (i + 1)}</span>
      <span class="bdn"><b>${esc(shortWho(x.who) || 'Compte')}</b>
        <i>${plur(+x.n, 'page')} · ${Math.round(x.ok / (x.n || 1) * 100)} % juste · ${plur(+x.jours, 'jour')}</i>
        <em style="width:${Math.max(4, Math.round(x.n / top * 100))}%"></em></span>
    </div>`).join('')}</div>
`;
}

export function groupPull() {
  if (!groups) groupsPull();                  // sans eux, la barre de portée n'a rien à proposer
  if (groupTab === 'lib' && !lib.list) libPull();
  if (groupTab === 'duel' && !duels.list) duelsPull();
  if (groupTab === 'board' && !board.rows) boardPull();
}

/* ══════════ statistiques ══════════
   Tout se calcule à partir de la table des révisions : une ligne par
   carte jouée, avec la date, la réussite et le temps passé. Rien n'est
   pré-agrégé côté serveur — à l'échelle de quelques milliers de lignes,
   le navigateur va plus vite que l'aller-retour, et ça évite une vue SQL
   de plus à maintenir. */
const dayKey = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return +d; };

const dayLabel = t => new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

/* index texte des cartes, pour nommer celles qui reviennent dans le top */
function cardIndex() {
  const m = new Map();
  for (const d of db.decks) for (const c of d.cards) m.set(c.id, { c, d });
  return m;
}

function aggregateReviews(R) {
  let ok = 0, ms = 0;
  const byDay = new Map(), byCard = new Map(), bySubj = new Map();
  for (const r of R) {
    if (r.correct) ok++;
    ms += r.ms || 0;
    const k = dayKey(r.created_at);
    const d = byDay.get(k) || { n: 0, ok: 0, ms: 0 };
    d.n++; if (r.correct) d.ok++; d.ms += r.ms || 0;
    byDay.set(k, d);
    if (!r.correct) byCard.set(r.card_id, (byCard.get(r.card_id) || 0) + 1);
    const deck = db.decks.find(x => x.id === r.deck_id);
    const sname = deck ? subj(deck.subject).name : 'Autres';
    bySubj.set(sname, (bySubj.get(sname) || 0) + (r.ms || 0));
  }
  return { ok, ms, byDay, byCard, bySubj };
}

/* Rétention : pour chaque carte, l'écart avec sa révision précédente dit
   à quelle distance la mémoire a été sollicitée. On garde trois paliers,
   ceux que tout le monde lit d'un coup d'œil. Calculé sur l'année pleine,
   pas sur la fenêtre choisie : à sept jours il n'y aurait rien à voir. */
function computeRetention(all) {
  const seen = new Map(), ret = { 1: [0, 0], 7: [0, 0], 30: [0, 0] };
  for (const r of all) {
    const t = +new Date(r.created_at), prev = seen.get(r.card_id);
    if (prev != null) {
      const gap = (t - prev) / DAY;
      const b = gap < 3 ? 1 : gap < 14 ? 7 : gap < 90 ? 30 : 0;
      if (b) { ret[b][1]++; if (r.correct) ret[b][0]++; }
    }
    seen.set(r.card_id, t);
  }
  return ret;
}

/* Série de jours : un jour de grâce par semaine entamée, sinon un
   week-end chez les grands-parents efface trois mois d'assiduité. */
function computeStreak(byDay) {
  let streak = 0, grace = 0, cur = dayKey(Date.now());
  if (!byDay.has(cur)) cur -= DAY;               // la journée peut n'avoir pas commencé
  for (let k = cur; ; k -= DAY) {
    if (byDay.has(k)) { streak++; continue; }
    if (grace < Math.floor(streak / 7) + (streak ? 1 : 0)) { grace++; continue; }
    break;
  }
  return streak;
}

function computeStats() {
  const all = stats.rows || [];
  const cut = stats.range ? Date.now() - stats.range * DAY : 0;
  const R = all.filter(r => +new Date(r.created_at) >= cut);

  const { ok, ms, byDay, byCard, bySubj } = aggregateReviews(R);
  const ret = computeRetention(all);
  const streak = computeStreak(byDay);

  const maxSubj = Math.max(1, ...bySubj.values());
  return {
    n: R.length, ok, ms, byDay, streak,
    per: R.length ? ms / R.length : 0,
    ret,
    subjects: [...bySubj.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ k, v, p: v / maxSubj })),
    worst: [...byCard.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
  };
}

/* Progression d'un paquet : la part des cartes vraiment installées.
   Elle se lit sur les cartes elles-mêmes, pas sur l'historique — c'est
   l'état actuel qui compte, pas le chemin parcouru. */
function deckProgress() {
  return live().map(d => {
    const k = { new: 0, learn: 0, young: 0, mature: 0, susp: 0 };
    d.cards.forEach(c => k[cstate(c)]++);
    const n = d.cards.length || 1;
    return { d, k, n: d.cards.length, pct: Math.round(k.mature / n * 100) };
  }).sort((a, b) => b.pct - a.pct);
}

function statsCSV() {
  const S = computeStats();
  const q = v => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [['section', 'clé', 'valeur'].join(';')];
  lines.push(['résumé', 'cartes revues', S.n].map(q).join(';'));
  lines.push(['résumé', 'réussite %', S.n ? Math.round(S.ok / S.n * 100) : 0].map(q).join(';'));
  lines.push(['résumé', 'temps total (min)', Math.round(S.ms / 60000)].map(q).join(';'));
  lines.push(['résumé', 'secondes par carte', (S.per / 1000).toFixed(1)].map(q).join(';'));
  lines.push(['résumé', 'série de jours', S.streak].map(q).join(';'));
  for (const [k, v] of [...S.byDay.entries()].sort((a, b) => a[0] - b[0]))
    lines.push(['jour', new Date(k).toISOString().slice(0, 10), v.n + ' cartes, ' + v.ok + ' justes'].map(q).join(';'));
  for (const s of S.subjects)
    lines.push(['temps par matière', s.k, Math.round(s.v / 60000) + ' min'].map(q).join(';'));
  for (const [b, [o, t]] of Object.entries(S.ret))
    if (t) lines.push(['rétention', b + ' jour(s)', Math.round(o / t * 100) + ' % sur ' + t].map(q).join(';'));
  const idx = cardIndex();
  for (const [id, fails] of S.worst) {
    const e = idx.get(id);
    lines.push(['page ratée', e ? e.c.f : id, fails + ' échecs'].map(q).join(';'));
  }
  for (const p of deckProgress())
    lines.push(['livre', p.d.name, p.pct + ' % mûres sur ' + p.n].map(q).join(';'));
  return '﻿' + lines.join('\n');       // BOM : Excel ouvre l'UTF-8 correctement
}

export async function exportStats() {
  const csv = statsCSV();
  const name = 'cartes-stats-' + new Date().toISOString().slice(0, 10) + '.csv';
  const file = new File([csv], name, { type: 'text/csv' });
  /* Sur iPhone, une ancre à télécharger ne donne rien dans une app
     installée : la feuille de partage est le seul chemin qui aboutit. */
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Journal de lecture Folio' });
      return;
    }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  try {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast(I.check, 'Export téléchargé');
  } catch (e) {
    try { await navigator.clipboard.writeText(csv); toast(I.check, 'Export copié'); }
    catch (x) { toast(I.x, 'Export impossible'); }
  }
}

/* ---------- recherche globale ----------
   Un seul champ pour les paquets et les cartes : on cherche un mot, pas
   un endroit où chercher. Tout se fait en mémoire, la bibliothèque tient
   déjà entière dans le navigateur. */
function findResults(q) {
  const n = norm(q);
  if (!n) return { decks: [], cards: [] };
  const decks = live().filter(d => norm(d.name).includes(n)).slice(0, 12);
  const cards = [];
  for (const d of live()) {
    for (const c of d.cards) {
      if (norm(plain(c.f)).includes(n) || norm(plain(c.b)).includes(n)) cards.push({ c, d });
      if (cards.length >= 60) break;
    }
    if (cards.length >= 60) break;
  }
  return { decks, cards };
}

export function findView() {
  $.innerHTML = `
    <div class="bar"><button class="ic" data-act="home" aria-label="Retour">${svg(I.back)}</button>
      <div class="fld"><input id="fq" type="search" placeholder="Chercher un mot, un livre…"
        autocomplete="off" autocapitalize="none" spellcheck="false" enterkeyhint="search"
        value="${esc(findQ)}" aria-label="Recherche"></div></div>
    <div class="page" id="fres"></div>`;
  paintFind();
  bindFind();
function paintFind() {
  const box = document.getElementById('fres'); if (!box) return;
  const r = findResults(findQ);
  box.innerHTML = `
      ${!findQ.trim() ? `<div class="empty">${svg(I.search)}</div>`
        : (!r.decks.length && !r.cards.length) ? `<div class="empty">${svg(I.search)}<p><b>Rien trouvé</b>pour « ${esc(findQ)} »</p></div>`
        : `${r.decks.length ? `<div class="lbl"><span>Livres</span><span>${r.decks.length}</span></div>
          <div class="slist">${r.decks.map(d => `<button class="sr flat" data-go="${d.id}">
            <i class="ldot" style="${sty(subj(d.subject))}"></i>
            <span class="n">${esc(d.name)}</span>
            <span class="c">${d.cards.length}</span>${svg(I.arrow)}</button>`).join('')}</div>` : ''}
        ${r.cards.length ? `<div class="lbl"><span>Pages</span><span>${r.cards.length}</span></div>
          <div class="slist">${r.cards.map(({ c, d }) => `<button class="sr flat" data-go="${d.id}">
            <span class="ml2"><span class="n">${hl(plain(c.f), findQ)}</span>
              <span class="sub">${hl(plain(c.b), findQ)} · ${esc(d.name)}</span></span>
            ${svg(I.arrow)}</button>`).join('')}</div>` : ''}`}`;
}
function bindFind() {
  const f = document.getElementById('fq');
  /* On ne redessine que les résultats. Redessiner l'écran entier
     recréait le champ à chaque lettre : il perdait le curseur et le
     clavier se refermait au milieu du mot. */
  let t = 0;
  f.addEventListener('input', () => {
    setFindQ(f.value);
    clearTimeout(t);
    t = setTimeout(paintFind, 90);
  });
  if (document.activeElement !== f) setTimeout(() => {
    f.focus(); f.setSelectionRange(f.value.length, f.value.length);
  }, 50);
}
}

/* surligne ce qui a été cherché, sans jamais laisser passer de balise */
function hl(txt, q) {
  const t = String(txt), n = norm(q);
  if (!n) return esc(t);
  const i = norm(t).indexOf(n);
  if (i < 0) return esc(t);
  return esc(t.slice(0, i)) + '<mark>' + esc(t.slice(i, i + q.trim().length)) + '</mark>'
    + esc(t.slice(i + q.trim().length));
}

/* Ce qui serait perdu en quittant maintenant : un exercice court, sans
   reprise possible, et déjà entamé. */
export function lostOnLeave() {
  if (quiz && quiz.pool && quiz.i > 0 && quiz.i < quiz.pool.length) return true;
  if (study && study.mode && study.i > 0 && study.i < study.queue.length) return true;
  return false;
}

export function statsView() {
  if (!stats.rows) {
    $.innerHTML = `<div class="bar"><button class="ic" data-act="home" aria-label="Retour">${svg(I.back)}</button></div>
      <div class="page"><div class="top"><div class="hero">Journal de lecture</div></div>
      <div class="empty">${svg(I.chart)}<p>${stats.err ? 'Statistiques indisponibles' : 'Chargement…'}</p></div></div>`;
    return;
  }
  const S = computeStats();
  const pct = S.n ? Math.round(S.ok / S.n * 100) : 0;
  const prog = deckProgress();
  const idx = cardIndex();

  /* dix-huit semaines de cases : le passé proche, celui sur lequel on peut
     encore agir. Au-delà, c'est de la décoration. */
  const days = [];
  const end = dayKey(Date.now());
  for (let k = end - 125 * DAY; k <= end; k += DAY) days.push(k);
  const maxDay = Math.max(1, ...[...S.byDay.values()].map(v => v.n));
  const cols = [];
  for (let i = 0; i < days.length; i += 7) cols.push(days.slice(i, i + 7));

  $.innerHTML = `
    <div class="bar"><button class="ic" data-act="home" aria-label="Retour">${svg(I.back)}</button></div>
    <div class="page">
      <div class="top"><div class="hero">Journal de lecture</div></div>
      <div class="seg" id="stRange">
        ${[[7, '7 jours'], [30, '30 jours'], [0, 'Tout']].map(([v, l]) =>
          `<button data-strange="${v}" class="${stats.range === v ? 'on' : ''}">${l}</button>`).join('')}
      </div>

      <div class="tiles st4">
        <div class="st"><b>${S.n}</b><span>pages lues</span></div>
        <div class="st"><b>${pct}%</b><span>de réussite</span></div>
        <div class="st"><b>${Math.round(S.ms / 60000)}</b><span>minutes</span></div>
        <div class="st"><b>${(S.per / 1000).toFixed(1).replace('.', ',')}s</b><span>par page</span></div>
      </div>

      <div class="lbl"><span>Assiduité</span><span>${S.streak ? S.streak + ' jour' + (S.streak > 1 ? 's' : '') + ' d’affilée' : ''}</span></div>
      <div class="card2">
        <div class="heat">${cols.map(col => `<div class="hc">${col.map(k => {
          const v = S.byDay.get(k);
          const lvl = !v ? 0 : v.n >= maxDay * .66 ? 4 : v.n >= maxDay * .33 ? 3 : v.n >= 2 ? 2 : 1;
          return `<i class="l${lvl}" title="${dayLabel(k)}${v ? ' · ' + v.n + ' pages' : ''}"></i>`;
        }).join('')}</div>`).join('')}</div>
        <div class="heatk"><span>${dayLabel(days[0])}</span><span>aujourd’hui</span></div>
      </div>

      <div class="lbl"><span>Ces sept jours</span></div>
      <div class="card2">${weekBars(S)}</div>

      <div class="lbl"><span>Où en sont tes livres</span><span>${prog.length || ''}</span></div>
      <div class="card2">
        ${prog.length ? prog.map(p => `<div class="bkline">
          <span class="bkn">${esc(p.d.name)}<i>${p.k.mature} sue${p.k.mature > 1 ? 's' : ''} sur ${p.n}</i></span>
          <span class="mix sm">${['new', 'learn', 'young', 'mature'].filter(x => p.k[x])
            .map(x => `<i class="${x}" style="flex:${p.k[x]}"></i>`).join('')}</span>
        </div>`).join('') + `<div class="bkkey">${['new', 'learn', 'young', 'mature']
            .map(x => `<span><i class="${x}"></i>${STATE[x]}</span>`).join('')}</div>`
          : '<div class="note">Aucun livre pour l’instant.</div>'}
      </div>

      ${S.subjects.length ? `<div class="lbl"><span>Temps par matière</span></div>
      <div class="card2">
        ${S.subjects.map(x => `<div class="brow"><span class="bl">${esc(x.k)}</span>
          <span class="bt"><i style="width:${Math.round(x.p * 100)}%;background:${
            subjColorByName(x.k)}"></i></span>
          <span class="bv">${x.v >= 60000 ? Math.round(x.v / 60000) + ' min' : Math.round(x.v / 1000) + ' s'}</span></div>`).join('')}
      </div>` : ''}

      ${S.worst.length ? `<div class="lbl"><span>Pages les plus ratées</span><span>${S.worst.length}</span></div>
      <div class="slist">
        ${S.worst.map(([id, fails]) => {
          const e = idx.get(id);
          return `<button class="sr flat wrow" ${e ? `data-go="${e.d.id}"` : ''}>
            <i class="wn">${fails}</i>
            <span class="ml2"><span class="n">${e ? esc(e.c.f) : 'Carte supprimée'}</span>
              <span class="sub">${e ? esc(e.c.b) : ''}</span></span>
            ${e ? svg(I.arrow) : ''}</button>`;
        }).join('')}
      </div>` : ''}

      <button class="lnk" data-act="expstats" style="margin:16px auto 0">${svg(I.down)}Exporter en CSV</button>
    </div>`;
  const seg = document.getElementById('stRange');
  seg.addEventListener('click', e => {
    const b = e.target.closest('[data-strange]'); if (!b) return;
    stats.range = +b.dataset.strange; setAnimate(false); render();
  });
}

/* Les sept derniers jours, en colonnes : on voit d'un coup les jours
   travaillés et les jours sautés, sans avoir à lire un pourcentage. */
/* Les sept derniers jours. Le chiffre vit au-dessus de la barre, dans sa
   propre ligne : il a toujours sa place, même quand la barre est minuscule.
   La barre, elle, occupe le reste de la hauteur, en proportion du meilleur
   jour de la semaine — 96 et 125 ne doivent pas se ressembler. */
function weekBars(S) {
  const out = [];
  const days = [...Array(7)].map((_, i) => {
    const t = Date.now() - (6 - i) * DAY;
    const v = S.byDay.get(dayKey(t));
    return { t, n: v ? v.n : 0 };
  });
  const top = Math.max(1, ...days.map(d => d.n));
  for (const { t, n } of days) {
    const h = n ? Math.max(8, Math.round(n / top * 100)) : 0;
    out.push(`<div class="wd"><b>${n || ''}</b>
      <u><i style="height:${h}%" class="${n ? '' : 'nil'}"></i></u>
      <span>${['D', 'L', 'M', 'M', 'J', 'V', 'S'][new Date(t).getDay()]}</span></div>`);
  }
  return `<div class="week">${out.join('')}</div>`;
}

/* la couleur d'une matière depuis son nom : les statistiques agrègent par
   nom, pas par identifiant */
const subjColorByName = name => {
  const t = db.subjects.find(x => x.name === name);
  return t ? (PALETTE[t.color] || PALETTE.graphite).d : 'var(--soft)';
};

/* ---------- pages d'un PDF ----------
   Une feuille légère, hors du système de menus : elle se referme d'
   elle-même et rend la main au code qui l'a ouverte. Laisser le champ
   vide prend tout le document. */
export function askPages(done) {
  document.querySelectorAll('.scrim,.menu').forEach(n => n.remove());
  const w = document.createElement('div');
  w.innerHTML = `<div class="scrim" id="pgx"></div>
    <div class="menu">
      <div class="mi" style="font-weight:750">${svg(I.file)}Quelles pages ?</div>
      <input class="tok" id="pgin" placeholder="Toutes les pages" spellcheck="false"
        autocapitalize="none" inputmode="numeric" enterkeyhint="done">
      <div class="note">Par exemple <b>3-7</b> pour une suite, <b>2, 5, 9</b> pour un choix,
        ou rien du tout pour prendre le document entier.</div>
      <button class="mi" id="pgok" style="justify-content:center;font-weight:700">
        ${svg(I.check)}Lire le PDF</button>
    </div>`;
  mountMenu(w);
  const inp = document.getElementById('pgin');
  const close = () => document.querySelectorAll('.scrim,.menu').forEach(n => n.remove());
  const go2 = () => { const v = inp.value.trim(); close(); done(v); };
  document.getElementById('pgok').onclick = go2;
  document.getElementById('pgx').onclick = close;
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go2(); } });
  setTimeout(() => inp.focus(), 60);
}
