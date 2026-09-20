import { $ } from '../racine.js';
import { I, svg } from '../icones.js';
import {
  addQ, asgs, asks, auth, board, classOf, classes, duels, friends, groups, lib, mates, me,
  prof, roster, school, setAddQ, setAnimate, setMenu, view
} from '../data/etat.js';
import { bindPager, go, render, tabs } from './bibliotheque.js';
import { plain } from './carte-media.js';
import {
  atSchool, dueLabel, isProf, isPupil
} from './classement.js';
import { boardPull, schoolPull } from '../core/classement.js';
import { deck, esc, plur, shortWho, subj } from '../core/coeur-sync.js';
import { groupsPull } from '../core/bilan-devoirs.js';
import { myScore, rankOf } from './defis.js';
import { duelsPull } from '../core/defis.js';
import { BRANGE } from './ecran-groupe.js';
import {
  auJour, calendrier, dansJours, etatEleve, iso, jourFr, pcClass
} from './etablissement.js';
import { profCartesPull, profDo } from '../core/etablissement.js';
import { toast } from './import-cartes.js';
import { closeMenu, mountMenu, openMenu } from './menus-a.js';
import { timeAgo } from './reglages-corbeille.js';
import { askFriend, friendsPull, libPull, mePull } from '../core/reglages-corbeille.js';

/* ---------- onglet Bilan ----------
   La même classe, mais répartie : combien suivent, combien décrochent,
   combien ne sont jamais venus. Un professeur n'a pas à compter lui-même
   pour savoir s'il doit reprendre le chapitre ou trois élèves. */
export function profBilan(c) {
  const r = prof.roster || [];
  if (!prof.roster) return `<div class="card2"></div>`;
  if (!r.length) return `<div class="empty">${svg(I.chart)}<p>Aucun élève inscrit.</p></div>`;
  const n = r.length;
  const paquets = [
    { k: 'ok',     t: 'À jour',            l: r.filter(m => !m.jamais && !m.retard && m.donnes && m.rendus === m.donnes) },
    { k: 'am',     t: 'En cours',          l: r.filter(m => !m.jamais && !m.retard && m.donnes && m.rendus < m.donnes) },
    { k: 'ko',     t: 'En retard',         l: r.filter(m => !m.jamais && m.retard) },
    { k: 'jamais', t: 'Jamais connectés',  l: r.filter(m => m.jamais) }
  ].filter(p => p.l.length);
  /* La réussite par tranches de vingt : une moyenne de classe cache
     toujours deux groupes, et c'est aux deux qu'on enseigne. */
  const notes = r.filter(m => m.pct > 0).map(m => m.pct);
  /* Le « % » est dit une fois dans le titre de la section : répété sous
     chaque colonne, il la faisait déborder et se faire couper. */
  const tranches = [[0, 20], [20, 40], [40, 60], [60, 80], [80, 101]].map(([a, b]) => ({
    t: `${a}–${b === 101 ? 100 : b}`,
    n: notes.filter(x => x >= a && x < b).length, cls: pcClass(a + 10)
  }));
  const hi = Math.max(1, ...tranches.map(t => t.n));
  const moy = notes.length ? Math.round(notes.reduce((a, b) => a + b, 0) / notes.length) : 0;
  const actifs = r.filter(m => m.pages7 > 0);
  const pages = r.reduce((a, m) => a + (m.pages7 || 0), 0);

  return `
    <div class="kpi quatre">
      <div class="kc"><b class="${moy ? pcClass(moy) : ''}">${moy || '—'}${moy ? ' %' : ''}</b>
        <span>réussite moyenne</span></div>
      <div class="kc"><b>${actifs.length}<em>/${n}</em></b><span>ont travaillé cette semaine</span></div>
      <div class="kc"><b>${pages}</b><span>pages révisées sur 7 jours</span></div>
      <div class="kc"><b>${(prof.devoirs || []).filter(d => d.mien).length}</b><span>devoirs donnés</span></div>
    </div>

    <div class="lbl"><span>Où en est la classe</span></div>
    <div class="rep">${paquets.map(p => `<div class="rr ${p.k}">
      <span class="rt2"><b>${p.l.length}</b> ${p.t}</span>
      <span class="rb2"><i style="width:${Math.round(p.l.length / n * 100)}%"></i></span>
      <span class="rn2">${p.l.slice(0, 12).map(m => esc(m.who.split(' ')[0])).join(', ')}${
        p.l.length > 12 ? ` et ${p.l.length - 12} autres` : ''}</span>
    </div>`).join('')}</div>

    <div class="lbl"><span>Répartition des résultats, en % de réussite</span>
      <span>${notes.length} élèves notés</span></div>
    ${!notes.length ? `<div class="card2"></div>`
      : `<div class="histo">${tranches.map(t => `<div class="hb">
          <span class="hv">${t.n || ''}</span>
          <span class="hz"><i class="hc ${t.cls}"
            style="height:${t.n ? Math.max(4, Math.round(t.n / hi * 100)) : 0}%"></i></span>
          <span class="hl">${t.t}</span></div>`).join('')}</div>`}

    <div class="lbl"><span>À reprendre avec eux</span></div>
    ${(() => {
      const urg = r.filter(m => m.jamais || m.retard || (m.pct && m.pct < 45));
      if (!urg.length) return `<div class="card2"></div>`;
      return `<div class="elvs serre">${urg.slice(0, 20).map(m => {
        const e = etatEleve(m);
        return `<button class="elv ${e.k}" data-peleve="${esc(m.user_id)}">
          <i class="av sm">${esc(initial(m.who))}</i>
          <span class="en"><b>${esc(m.who)}</b><i>@${esc(m.handle || '')}</i></span>
          <span class="etat ${e.k}">${e.t}${m.pct && m.pct < 45 ? ` · ${m.pct} % juste` : ''}</span>
        </button>`;
      }).join('')}</div>`;
    })()}
    <div class="note" style="padding:10px 0 0">Le code de la classe est
      <b>${esc(c.code || '—')}</b> : c’est lui que saisissent les élèves qui n’ont jamais ouvert
      l’app.</div>`;
}

/* ══════════ 3. La fiche d'un élève ══════════
   Tout ce que le professeur a le droit de savoir, et rien de plus : ce qui
   a été rendu, quand, et avec quel taux de réussite. Jamais les réponses,
   jamais les horaires de travail, jamais les paquets personnels. La
   différence entre suivre une classe et surveiller quelqu'un. */
export function profEleveView() {
  const c = (prof.classes || []).find(x => x.id === prof.open);
  const m = (prof.roster || []).find(x => x.user_id === prof.eleve);
  if (!c || !m) return go('profclasse');
  const f = prof.fiche;
  const e = etatEleve(m);
  const ETAT = { 'rendu': 'ok', 'commencé': 'am', 'non rendu': 'ko', 'pas ouvert': 'gris' };
  $.innerHTML = `
    <div class="bar"><button class="ic" data-act="pback" aria-label="Retour">${svg(I.back)}</button>
      <h1>${esc(m.who)}</h1></div>
    <div class="page console">
      <div class="ecole"><i class="av">${esc(initial(m.who))}</i><span>
        <b>${esc(m.who)} <em class="etat ${e.k}">${e.t}</em></b>
        <i>@${esc(m.handle || '')} · ${esc(c.name)}${c.niveau ? ' · ' + esc(c.niveau) : ''}${
          c.matiere ? ' · ' + esc(c.matiere) : ''}</i></span></div>

      <div class="kpi cinq">
        <div class="kc"><b>${m.rendus}<em>/${m.donnes}</em></b><span>devoirs rendus</span></div>
        <div class="kc"><b class="${m.pct ? pcClass(m.pct) : ''}">${m.pct || '—'}${
          m.pct ? ' %' : ''}</b><span>de réussite</span></div>
        <div class="kc ${m.retard ? 'ko' : ''}"><b>${m.retard}</b><span>en retard</span></div>
        <div class="kc"><b>${m.pages7}</b><span>pages sur 7 jours</span></div>
        <div class="kc"><b>${m.jours7}</b><span>jours travaillés sur 7</span></div>
      </div>

      ${m.jamais ? `<div class="alerte">${svg(I.warn)}<span><b>Ce compte n’a jamais été ouvert.</b>
        Ni retard ni paresse : le lien n’est pas arrivé jusqu’à lui, ou le mot de passe est perdu.
        Le référent de l’établissement peut le refaire en trois clics.</span></div>` : ''}

      <div class="duo ghost">
        <button data-act="pmot">${svg(I.mail2)}Lui envoyer un mot</button>
      </div>

      <div class="lbl"><span>Devoirs de la classe</span><span>${f ? f.length : ''}</span></div>
      ${!f ? `<div class="card2"></div>`
        : !f.length ? `<div class="card2"><div class="note">Aucun devoir dans cette classe.</div></div>`
        : `<div class="dvrs">${f.map(x => `<div class="dvr lect">
            <span class="c1"><b>${esc(x.devoir)}</b>
              <i>${plur(x.n, 'page')}${x.matiere ? ' · ' + esc(x.matiere) : ''}${
                x.mien ? '' : ' · d’un collègue'}</i></span>
            <span class="an"><b class="${x.pct ? pcClass(x.pct) : ''}">${x.pct || '—'}</b>
              <i>% juste</i></span>
            <span class="an"><b>${x.due ? jourFr(x.due) : '—'}</b><i>à rendre</i></span>
            <span class="an"><b>${x.rendu ? timeAgo(x.rendu) : '—'}</b><i>rendu</i></span>
            <span class="etat ${ETAT[x.etat] || ''}">${esc(x.etat)}</span>
          </div>`).join('')}</div>`}
    </div>`;
}

/* ══════════ 4. Le composeur de devoir ══════════
   Créer les cartes là où on s'en sert, sans passer par une bibliothèque
   personnelle. Trois façons d'y arriver, parce que trois professeurs
   différents ne s'y prennent pas pareil : coller une liste depuis un
   traitement de texte, taper une paire à la fois, ou reprendre un livre
   déjà fait.

   Le collage accepte ce qu'on a sous la main — tabulation, point-virgule,
   égal, flèche, tiret — parce qu'exiger un séparateur, c'est renvoyer
   quelqu'un reformater son fichier. */
/* Le devoir se compose dans l'éditeur de livres — le vrai, celui qui sait
   lire une photo de page, un PDF, un export Quizlet, fabriquer les cartes
   à partir d'un cours collé, et poser une image ou un enregistrement sur
   chaque face. Il n'y a donc pas de second éditeur au rabais ici : cette
   feuille ne pose que les deux questions qui restent — à qui, et pour
   quand. Le livre, lui, reste dans la bibliothèque du professeur, prêt à
   resservir l'année suivante. */
export function compNeuf(pre) {
  const c = (prof.classes || []).find(x => x.id === prof.open);
  return { nom: '', matiere: (c && c.matiere) || '', due: dansJours(7), mois: null,
           livre: null, cibles: new Set(prof.open ? [prof.open] : []), ...(pre || {}) };
}

/* Les cartes partent entières : recto, verso, image et son. Les médias d'un
   livre de cours sont lisibles par la classe (préfixe « cours/ »). */
const carteNue = c => {
  const o = { f: plain(c.f), b: plain(c.b) };
  for (const k of ['fi', 'bi', 'fa', 'ba', 't', 'g']) if (c[k]) o[k] = c[k];
  return o;
};

function compCartes() {
  const k = prof.comp; if (!k || !k.livre) return [];
  const d = deck(k.livre);
  return d ? d.cards.map(carteNue).filter(c => c.f || c.fi || c.fa) : [];
}

/* Ouvrir la feuille « à qui, pour quand » sur un livre donné. */
export function donnerLivre(d) {
  prof.comp = compNeuf({ livre: d.id, nom: d.name,
    matiere: d.subject ? (subj(d.subject) || {}).name || '' : (prof.comp || {}).matiere || '' });
  openMenu('compo');
}

export function compSheet(w) {
  const k = prof.comp;
  if (!k) { setMenu(null); return; }
  const d = k.livre ? deck(k.livre) : null;
  const cartes = compCartes();
  const cls = prof.classes || [];
  const riches = cartes.filter(c => c.fi || c.bi || c.fa || c.ba).length;
  const pret = k.nom.trim() && cartes.length && k.cibles.size;
  w.innerHTML = `<div class="scrim" data-mact="close"></div>
    <div class="menu pv">
      <div class="mhd">${svg(I.share)}<span class="mhx"><b>Donner un devoir</b>
        <i>${d ? esc(d.name) : ''}</i></span></div>
      <div class="mscroll">
        <div class="rform">
          <label>Titre<input id="cnom" value="${esc(k.nom)}" spellcheck="false"></label>
          <label>Matière<input id="cmat" value="${esc(k.matiere)}" spellcheck="false"></label>
        </div>
        <div class="mlbl">Contenu</div>
        <div class="cchif">
          <div><b>${cartes.length}</b><span>cartes</span></div>
          ${riches ? `<div><b>${riches}</b><span>avec image ou son</span></div>` : ''}
          <button class="cedit" data-cedit="1">${svg(I.type)}Modifier le livre</button>
        </div>
        <div class="msep"></div>
        <div class="mlbl">À rendre le ${jourFr(k.due)}</div>
        ${calendrier(auJour(k.mois || k.due), k.due, null, 'cdue2', 'cmois')}
        <div class="msep"></div>
        <div class="mlbl">Classes <em>${k.cibles.size || ''}</em></div>
        <div class="mscroll courte">${cls.map(c => `
          <button class="mi${k.cibles.has(c.id) ? ' on' : ''}" data-ccible="${esc(c.id)}">
            ${svg(k.cibles.has(c.id) ? I.check : I.plus)}<span>${esc(c.name)}</span>
            <span class="tail">${esc(c.niveau || '')} · ${c.effectif} él.</span></button>`).join('')}</div>
      </div>
      <div class="cbar">
        <span>${plur(cartes.length, 'carte')} · ${
          k.cibles.size ? plur(k.cibles.size, 'classe') : 'aucune classe'}</span>
        <button class="cgo" data-mact="cgive" ${pret ? '' : 'disabled'}>Donner</button>
      </div>
    </div>`;
  mountMenu(w);
  const lie = (id, ch) => { const n = document.getElementById(id);
    if (n) n.addEventListener('input', () => prof.comp[ch] = n.value); };
  lie('cnom', 'nom'); lie('cmat', 'matiere');
}

/* Les champs de la feuille avant chaque repeinture : un titre tapé puis
   perdu au premier clic est ce qui fait abandonner un outil. */
export function lireComp() {
  const k = prof.comp; if (!k) return;
  for (const [ch, id] of [['nom', 'cnom'], ['matiere', 'cmat']]) {
    const n = document.getElementById(id);
    if (n) k[ch] = n.value;
  }
}

export async function compDonner() {
  const k = prof.comp; if (!k) return;
  const cartes = compCartes();
  if (!cartes.length) return toast(I.x, 'Ce livre n’a aucune carte');
  const n = await profDo('prof_give',
    { cids: [...k.cibles], nom: k.nom.trim(), matiere: k.matiere.trim(),
      cartes, due: k.due },
    r => `${plur(cartes.length, 'carte')} à ${plur(r, 'classe')}, à rendre avant le `
      + jourFr(k.due));
  if (n) {
    prof.comp = null; closeMenu();
    /* On revient là où le professeur travaillait : sa classe s'il en
       regardait une, sinon ses classes. Rester sur l'éditeur du livre
       après l'envoi laisse croire que rien n'est parti. */
    go(prof.open ? 'profclasse' : 'prof');
  }
}

/* ---------- la feuille d'un devoir ---------- */
export function workSheet(w) {
  const d = (prof.devoirs || []).find(x => x.id === prof.work);
  if (!d) { setMenu(null); return; }
  const pas = Math.max(0, (d.effectif || 0) - (d.ouvert || 0));
  const ca = prof.cartes;
  w.innerHTML = `<div class="scrim" data-mact="close"></div>
    <div class="menu pv">
      <div class="mhd">${svg(I.card)}<span class="mhx"><b>${esc(d.nom)}</b>
        <i>${plur(d.n, 'page')}${d.matiere ? ' · ' + esc(d.matiere) : ''}${
          d.due ? ' · ' + dueLabel(d.due) : ''}${d.mien ? '' : ' · donné par ' + esc(d.auteur)}</i></span></div>
      <div class="mscroll">
        <div class="fiche">
          <div><b>${d.rendu} / ${d.effectif}</b><span>ont rendu</span></div>
          <div><b>${d.ouvert}</b><span>ont ouvert</span></div>
          <div><b class="${pas ? 'ko' : ''}">${pas}</b><span>n’ont pas ouvert</span></div>
          <div><b class="${d.pct ? pcClass(d.pct) : ''}">${d.pct || '—'}${
            d.pct ? ' %' : ''}</b><span>de réussite</span></div>
        </div>
        ${d.mien ? `
          <div class="msep"></div>
          <div class="mlbl">À rendre le ${jourFr(d.due)}</div>
          ${calendrier(auJour(prof.mois || d.due || iso(new Date())), d.due, null, 'cdue', 'pmois2')}
          ${pas ? `<button class="mi" data-mact="prelance">${svg(I.mail2)}
            <span>Relancer les ${pas} qui n’ont pas ouvert</span>
            <span class="tail">un mot dans leur courrier</span></button>` : ''}
          <button class="mi" data-mact="pdefi">${svg(I.flame)}
            <span>Lancer un défi à la classe</span></button>
          <button class="mi" data-mact="predonner">${svg(I.copy)}
            <span>Redonner à d’autres classes</span></button>
          <div class="msep"></div>` : '<div class="msep"></div>'}

        <div class="mlbl">Ce qui bloque dans ce devoir</div>
        ${!ca ? ``
          : !ca.length ? ``
          : `<div class="mscroll courte">${ca.map(c => `<div class="mi lect">
              <span class="carte"><b>${esc(c.recto)} → ${esc(c.verso)}</b>
                <i>${c.ratees} erreurs sur ${c.vues} passages · ${plur(c.eleves, 'élève')}</i></span>
              </div>`).join('')}</div>`}

        ${d.mien ? `<div class="msep"></div>
          <button class="mi warn" data-mact="pdel">${svg(I.trash)}<span>Retirer ce devoir</span>
            <span class="tail">l’avancement est perdu</span></button>` : ''}
      </div>
    </div>`;
  mountMenu(w);
  if (!ca) profCartesPull(d.id);
}

/* ---------- l'écran des classes ---------- */
export function classesView() {
  const l = classes;
  const mine = (l || []).filter(c => c.owner === auth.uid);
  const in_ = (l || []).filter(c => c.owner !== auth.uid);
  const carte = c => `<button class="sr flat" data-classe="${esc(c.id)}">${svg(I.layers)}
    <span class="ml2"><span class="n">${esc(c.name)}</span>
      <span class="sub">${esc(c.level || 'Classe')}${c.year ? ' · ' + esc(c.year) : ''}${
        c.owner === auth.uid ? ' · code ' + esc(c.code) : ''}</span></span>${svg(I.arrow)}</button>`;
  $.innerHTML = `
    <div class="bar"><button class="ic" data-act="home" aria-label="Retour">${svg(I.back)}</button>
      <h1>${isProf() ? 'Mes classes' : 'Ma classe'}</h1></div>
    <div class="page">
      ${isProf() ? `<button class="cta ghost" data-act="newclass">${svg(I.plus)}Créer une classe</button>` : ''}
      <button class="cta ghost" data-act="joinclass">${svg(I.key)}Rejoindre avec un code</button>
      ${!l ? `<div class="empty">${svg(I.layers)}<p>Chargement…</p></div>`
        : !l.length ? `<div class="empty">${svg(I.layers)}<p><b>Aucune classe</b>${
            isProf() ? 'Crée-en une, puis distribue son code à tes élèves.'
                     : 'Demande son code à ton professeur.'}</p></div>`
        : `${mine.length ? `<div class="lbl"><span>Je les tiens</span><span>${mine.length}</span></div>
             <div class="slist">${mine.map(carte).join('')}</div>` : ''}
           ${in_.length ? `<div class="lbl"><span>J’y suis inscrit</span><span>${in_.length}</span></div>
             <div class="slist">${in_.map(carte).join('')}</div>` : ''}`}
    </div>`;
}

export function classeView() {
  const c = (classes || []).find(x => x.id === classOf);
  if (!c) return go('classes');
  const owner = c.owner === auth.uid;
  $.innerHTML = `
    <div class="bar"><button class="ic" data-act="classes" aria-label="Retour">${svg(I.back)}</button>
      <h1>${esc(c.name)}</h1>
      </div>
    <div class="page">
      ${owner ? `<div class="ccode">${svg(I.key)}<span>Code de la classe</span><b>${esc(c.code)}</b></div>` : ''}

      <div class="lbl"><span>Devoirs</span><span>${asgs ? asgs.length : ''}</span></div>
      ${owner ? `<button class="cta ghost" data-act="newwork">${svg(I.share)}Donner un devoir</button>` : ''}
      ${!asgs ? `<div class="empty">${svg(I.card)}<p>Chargement…</p></div>`
        : !asgs.length ? `<div class="empty">${svg(I.card)}<p><b>Aucun devoir</b>${
            owner ? 'Choisis un livre et donne-le à la classe.' : 'Rien à faire pour l’instant.'}</p></div>`
        : `<div class="slist">${asgs.map(a => `<button class="sr flat" data-work="${esc(a.id)}">
             ${svg(I.card)}<span class="ml2"><span class="n">${esc(a.name)}</span>
               <span class="sub">${plur(a.n, 'page')}${a.due ? ' · ' + dueLabel(a.due) : ''}</span></span>
             ${svg(I.arrow)}</button>`).join('')}</div>`}

      ${owner ? `<div class="lbl"><span>Élèves</span><span>${roster ? roster.length : ''}</span></div>
        ${!roster ? `<div class="empty">${svg(I.user)}<p>Chargement…</p></div>`
          : !roster.length ? `<div class="empty">${svg(I.user)}<p><b>Personne encore</b>
              Projette le code <b>${esc(c.code)}</b> : trois minutes en début de cours suffisent.</p></div>`
          : `<div class="slist">${roster.map(m => `<button class="sr flat" data-member="${esc(m.user_id)}">
               <i class="av">${esc(initial(m.who))}</i>
               <span class="ml2"><span class="n">${esc(m.who || 'Élève')}</span>
                 <span class="sub">inscrit ${timeAgo(m.joined_at)}</span></span>${svg(I.arrow)}</button>`).join('')}</div>`}` : ''}
    </div>`;
}

/* ══════════ communauté ══════════
   Un centre unique : qui tu es, qui tu connais, les groupes, les défis,
   l'étagère commune et le classement. Le reste de l'app n'a plus à parler
   de « groupe » ici et là — tout ce qui concerne les autres vit ici. */

/* tout ce que l'écran a besoin de savoir, en un seul aller-retour groupé */
export function commuPull() {
  if (!me) mePull().then(() => { if (view.name === 'commu') { setAnimate(false); render(); } });
  if (!friends) friendsPull();
  if (!groups && !atSchool()) groupsPull();   // pas de club à l'école
  if (!duels.list) duelsPull();
  if (!lib.list) libPull();
  if (!board.rows) boardPull();
  if (school === null) schoolPull().then(() => { if (view.name === 'commu') { setAnimate(false); render(); } });
}

export const initial = s => (String(s || '?').trim()[0] || '?').toUpperCase();

export function commuView() {
  const nMates = (mates || []).length, nAsk = (asks || []).length;
  const nGroup = (groups || []).length;
  const toPlay = (duels.list || []).filter(d => !myScore(d.id)).length;
  const nLib = (lib.list || []).length;
  const rows = board.rows || [];
  const mine = rows.findIndex(r => r.uid === auth.uid);
  const MED = ['🥇', '🥈', '🥉'];
  const tile = (act, ic, lab, val, warn) => `<button class="ctile" data-act="${act}">
    <i class="ci">${svg(ic)}${warn ? `<b class="cbdg">${warn}</b>` : ''}</i>
    <span class="cn">${lab}</span><span class="cv">${val}</span></button>`;
  /* Un élève inscrit par son établissement n'a ni pseudo à choisir, ni
     club, ni annuaire ouvert : sa carte affiche sa classe, et ses trois
     tuiles sont Défis, Ma classe, Bibliothèque. Un compte personnel garde
     les quatre d'origine. */
  const eleve = isPupil();
  $.innerHTML = `
    <div class="page" id="page">
      <div class="top"><div class="hero">Le cercle des lecteurs</div></div>
      ${eleve ? `<div class="mecard fixe">
        <i class="av">${esc(initial(me && (me.handle || me.name)))}</i>
        <span class="mex"><b>${me && me.handle ? '@' + esc(me.handle) : esc((me && me.name) || 'Élève')}</b>
          <i>${school.classe ? `<b class="maclasse">${esc(school.classe)}</b> · ${esc(school.org)}`
            : esc(school.org)}</i></span></div>`
      : `<button class="mecard" data-act="handle">
        <i class="av">${esc(initial(me && (me.handle || me.name)))}</i>
        <span class="mex"><b>${me && me.handle ? '@' + esc(me.handle) : 'Choisis ton pseudo'}</b>
          <i>${me && me.handle ? (mine >= 0 ? `${MED[mine] || (mine + 1) + 'ᵉ'} cette semaine · ${plur(+rows[mine].n, 'page')}`
            : 'Pas encore révisé cette semaine')
            : 'C’est ce que tes amis taperont pour t’ajouter'}</i></span>
        ${svg(I.arrow)}</button>`}
      <div class="ctiles${eleve || atSchool() ? ' trois' : ''}">
        ${eleve ? `
          ${tile('duels', I.flame, 'Défis', toPlay ? toPlay + ' à jouer' : '—', toPlay)}
          ${tile('classes', I.school, 'Ma classe', school.effectif ? school.effectif + ' élèves' : '—', nAsk)}
          ${tile('library', I.book, 'Bibliothèque', nLib || '—', 0)}`
        : `
          ${tile('friends', I.user, 'Lecteurs', nMates || '—', nAsk)}
          ${atSchool() ? '' : tile('groups', I.layers, 'Clubs', nGroup || '—', 0)}
          ${tile('duels', I.flame, 'Défis', toPlay ? toPlay + ' à jouer' : '—', toPlay)}
          ${tile('library', I.book, 'Bibliothèque', nLib || '—', 0)}`}
      </div>
      <div class="lbl"><span>Classement de la semaine</span>
        ${rows.length > 3 ? '<button class="lnk" data-act="board">Tout voir</button>' : ''}</div>
      ${!board.rows ? `<div class="card2"><div class="note">${board.err ? 'Indisponible' : 'Chargement…'}</div></div>`
        : !rows.length ? `<div class="card2"><div class="note">Ajoute un lecteur.</div></div>`
        : `<div class="rows">${rows.slice(0, 3).map((x, i) => bdRow(x, i)).join('')}</div>`}
    </div>
    ${tabs('commu')}`;
  bindPager();
}

const bdRow = (x, i) => {
  const MED = ['🥇', '🥈', '🥉'];
  const top = Math.max(1, +((board.rows || [])[0] || {}).n || 1);
  return `<div class="bdr ${x.uid === auth.uid ? 'me' : ''}">
    <span class="bdp">${MED[i] || (i + 1)}</span>
    <span class="bdn"><b>${esc(x.who)}</b>
      <i>${plur(+x.n, 'page')} · ${Math.round(x.ok / (x.n || 1) * 100)} % juste · ${plur(+x.jours, 'jour')}</i>
      <em style="width:${Math.max(4, Math.round(x.n / top * 100))}%"></em></span></div>`;
};

export function friendsView() {
  const l = mates || [], a = asks || [];
  $.innerHTML = `
    <div class="bar"><button class="ic" data-act="commu" aria-label="Retour">${svg(I.back)}</button>
      <h1>Lecteurs</h1></div>
    <div class="page">
      <div class="fld addf"><input id="addq" type="search" placeholder="Pseudo d’un lecteur"
        autocomplete="off" autocapitalize="none" spellcheck="false" value="${esc(addQ)}"
        aria-label="Pseudo d’un lecteur"><button class="addgo" data-act="doadd">Ajouter</button></div>
      ${a.length ? `<div class="lbl"><span>Demandes reçues</span><span>${a.length}</span></div>
        <div class="slist">${a.map(f => `<div class="sr flat">
          <i class="av sm">${esc(initial(f.handle || f.name))}</i>
          <span class="n">@${esc(f.handle || '')}</span>
          <button class="fyes" data-yes="${f.id}">${svg(I.check)}</button>
          <button class="fno" data-no="${f.id}">${svg(I.x)}</button></div>`).join('')}</div>` : ''}
      <div class="lbl"><span>Mes lecteurs</span><span>${l.length || ''}</span></div>
      ${!friends ? `<div class="card2"></div>`
        : !l.length ? `<div class="empty">${svg(I.user)}<p><b>Personne pour l’instant</b>Ajoute quelqu’un par son pseudo.</p></div>`
        : `<div class="slist">${l.map(f => `<button class="sr flat" data-mate="${f.id}">
            <i class="av sm">${esc(initial(f.handle || f.name))}</i>
            <span class="ml2"><span class="n">${esc(f.name || '')}</span>
              <span class="sub">@${esc(f.handle || '')}</span></span>${svg(I.arrow)}</button>`).join('')}</div>`}
    </div>`;
  const q = document.getElementById('addq');
  if (q) {
    q.addEventListener('input', () => setAddQ(q.value));
    q.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); doAdd(); } });
  }
}

export async function doAdd() {
  const v = addQ.trim(); if (!v) return;
  if (await askFriend(v)) { setAddQ(''); setAnimate(false); render(); }
}

export function groupsView() {
  const l = groups || [];
  $.innerHTML = `
    <div class="bar"><button class="ic" data-act="commu" aria-label="Retour">${svg(I.back)}</button>
      <h1>Clubs</h1></div>
    <div class="page">
      <div class="duo ghost">
        <button data-act="newgroup">${svg(I.plus)}Créer</button>
        <button data-act="joingroup">${svg(I.link)}Rejoindre</button>
      </div>
      ${!groups ? `<div class="card2"></div>`
        : !l.length ? `<div class="empty">${svg(I.layers)}<p><b>Aucun club</b>Une classe, un binôme : la même bibliothèque et les mêmes défis pour tous.</p></div>`
        : `<div class="slist">${l.map(g => `<button class="sr flat" data-group="${g.id}">
            ${svg(I.layers)}<span class="ml2"><span class="n">${esc(g.name)}</span>
              <span class="sub">code ${esc(g.code)}</span></span>${svg(I.arrow)}</button>`).join('')}</div>`}
    </div>`;
}

export function duelsView() {
  const l = duels.list;
  $.innerHTML = `
    <div class="bar"><button class="ic" data-act="commu" aria-label="Retour">${svg(I.back)}</button>
      <h1>Défis</h1></div>
    <div class="page">
      <button class="cta ghost" data-act="duelnew">${svg(I.flame)}Lancer un défi</button>
      ${!l ? `<div class="card2"><div class="note">${duels.err ? 'Indisponible' : 'Chargement…'}</div></div>`
        : !l.length ? `<div class="empty">${svg(I.flame)}<p><b>Aucun défi</b>Dix questions d’un de tes livres, les mêmes pour tous.</p></div>`
        : `<div class="slist">${l.map(du => {
            const m = myScore(du.id), r = rankOf(du.id);
            const pos = m ? r.findIndex(x => x.user_id === auth.uid) + 1 : 0;
            return `<button class="sr flat" data-duel="${esc(du.id)}">${svg(I.flame)}
              <span class="ml2"><span class="n">${esc(du.name)}</span>
                <span class="sub">${esc(shortWho(du.who) || 'Un ami')} · ${plur(du.total, 'question')}${
                  r.length ? ' · ' + plur(r.length, 'joueur') : ''}</span></span>
              <span class="c">${m ? `<b class="dsc">${m.score}/${du.total}</b> ${pos === 1 ? '🥇' : pos + 'ᵉ'}`
                : '<span class="dnew">à jouer</span>'}</span>${svg(I.arrow)}</button>`;
          }).join('')}</div>`}
    </div>`;
}

export function libraryView() {
  const l = lib.list;
  $.innerHTML = `
    <div class="bar"><button class="ic" data-act="commu" aria-label="Retour">${svg(I.back)}</button>
      <h1>Bibliothèque</h1></div>
    <div class="page">
      ${!l ? `<div class="card2"><div class="note">${lib.err ? 'Indisponible' : 'Chargement…'}</div></div>`
        : !l.length ? `<div class="empty">${svg(I.book)}<p><b>Bibliothèque vide</b>Prête un livre depuis son menu Partager.</p></div>`
        : `<div class="slist">${l.map(it => `<button class="sr flat" data-lib="${esc(it.deck_id)}">${svg(I.book)}
            <span class="ml2"><span class="n">${esc(it.name)}</span>
              <span class="sub">${esc(shortWho(it.who) || 'Un ami')}${it.subject ? ' · ' + esc(it.subject) : ''} · ${plur(it.n, 'page')}</span></span>
            <span class="c">${timeAgo(it.updated_at)}</span>${svg(I.arrow)}</button>`).join('')}</div>`}
    </div>`;
}

export function boardView() {
  const r = board.rows || [];
  $.innerHTML = `
    <div class="bar"><button class="ic" data-act="commu" aria-label="Retour">${svg(I.back)}</button>
      <h1>Classement</h1></div>
    <div class="page">
      <div class="seg" id="bRange">${Object.entries(BRANGE).map(([k, n]) =>
        `<button class="${board.range === +k ? 'on' : ''}" data-brange="${k}">${n}</button>`).join('')}</div>
      ${!board.rows ? `<div class="card2"><div class="note">${board.err ? 'Indisponible' : 'Chargement…'}</div></div>`
        : !r.length ? `<div class="empty">${svg(I.trophy)}<p><b>Rien sur cette période</b></p></div>`
        : `<div class="rows">${r.map((x, i) => bdRow(x, i)).join('')}</div>
`}
    </div>`;
}
