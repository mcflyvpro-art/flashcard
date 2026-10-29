// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { $ } from '../racine.js';
import { I, svg } from '../icones.js';
import { prof } from '../data/etat.js';
import { go } from './bibliotheque.js';
import {
  FILTRES, TRIS, correspond, etatDevoir, etatEleve, filtrerEleves, finTexte,
  formatCode, grilleMois, iso, auJour, jourCourt, MOIS, parJour, pc, syntheseClasse, trierEleves
} from '../classe.js';
import { esc, plur } from '../core/coeur-sync.js';
import {
  avatar, btn, chargement, classeOuverte, couleur, kpi, metaClasse, navProf, pastilleClasse, pill
} from './prof-accueil.js';
import { timeAgo } from './reglages-corbeille.js';

/* ══════════ une classe ══════════
   L'en-tête dit qui elle est et ce qu'on peut y faire tout de suite ; les
   chiffres disent où elle en est ; les onglets rangent le reste. La liste
   des élèves est un tableau sur ordinateur — une ligne, un élève, chaque
   chiffre dans sa colonne — et une liste de fiches sur téléphone. */

const ETATS = { ok: 'ok', am: 'am', ko: 'ko', jamais: 'gris', neutre: 'neutre' };

function selecteurMobile(c) {
  const l = (prof.classes || []).filter(x => !x.archivee || x.id === c.id);
  if (l.length < 2) return '';                   // une seule classe : rien à choisir
  return `<div class="pf-ksw" role="tablist" aria-label="Classes">${l.map(x =>
    `<button class="${x.id === c.id ? 'on' : ''}" data-pf="classe" data-id="${esc(x.id)}" style="--k:${couleur(x.id)}">
      <i></i>${esc(x.name)}${x.attente ? `<em>${x.attente}</em>` : ''}</button>`).join('')}</div>`;
}

/* Le premier bouton selon ce qu'est la classe (docs/PARCOURS.md) : un groupe
   se compose en cochant des élèves ; une classe de l'établissement ou d'un
   professeur particulier se rejoint avec le code. */
function boutonEleves(c) {
  if (c.genre === 'groupe') return c.gere ? btn('groupe-modifier', I.users, 'Élèves du groupe', 'pri') : '';
  if (!c.etab) return `${c.gere ? btn('inviter', I.plus, 'Ajouter des élèves', 'pri') : ''}${
    c.gere && (prof.classes || []).filter(x => !x.etab && !x.archivee).length > 1 ? btn('ajouter', I.swap, '', 'ic',
      'aria-label="Un élève de mes autres classes" title="Un élève de mes autres classes"') : ''}`;
  return btn('inviter', I.key, 'Code élèves', 'pri');
}

function enteteClasse(c) {
  const actions = c.archivee ? btn('desarchiver', I.redo, 'Désarchiver')
    : `${boutonEleves(c)}
       ${btn('direct', I.bolt, 'Défi en direct')}${btn('donner', I.card, 'Devoir')}${btn('message', I.mail2, 'Message')}
       ${btn('actions', I.more, '', 'ic', 'aria-label="Plus d’actions" title="Plus d’actions"')}`;
  return `<header class="pf-ch" style="--k:${couleur(c.id)}">
    ${c.gere ? `<button class="pf-blason" data-pf="blason" aria-label="Emblème de la classe">${pastilleClasse(c, true)}${svg(I.pen)}</button>`
      : pastilleClasse(c, true)}
    <div class="pf-cht"><h1>${esc(c.name)}</h1>
      <p>${metaClasse(c)}${metaClasse(c) ? ' · ' : ''}${esc(c.annee_scolaire || '')}</p>
      <div class="pf-chips">${c.genre === 'groupe' ? '<span class="pf-tag">Groupe</span>' : ''}${c.archivee ? pill('neutre', 'Archivée') : ''}
        <span class="pf-chip" title="${c.etab ? 'Élèves' : 'Élèves inscrits / places'}">${svg(I.users)}${c.effectif}${c.etab ? '' : '/' + c.places}</span>
        ${c.principal ? '<span class="pf-tag">Professeur principal</span>' : ''}
        ${c.etab ? '' : '<span class="pf-chip">Hors établissement</span>'}</div></div>
    <div class="pf-cha">${actions}</div>
  </header>`;
}

function kpisClasse(c, s) {
  const r = prof.roster || [];
  const donnes = r.reduce((a, m) => a + (m.donnes || 0), 0), rendus = r.reduce((a, m) => a + (m.rendus || 0), 0);
  const jamais = s.paquets.find(p => p.k === 'jamais'), ko = s.paquets.find(p => p.k === 'ko');
  return `<div class="pf-kpis">
    ${kpi(I.chart, s.moyenne ? s.moyenne + '<small>%</small>' : '—', 'Réussite moyenne')}
    ${kpi(I.check, donnes ? pc(rendus, donnes) + '<small>%</small>' : '—', 'Devoirs rendus')}
    ${kpi(I.warn, ko ? ko.l.length : 0, 'En retard', ko ? 'ko' : '', ko ? 'filtre-ko' : '')}
    ${kpi(I.lock, jamais ? jamais.l.length : 0, 'Jamais connectés', jamais ? 'gris' : '', jamais ? 'filtre-jamais' : '')}
    ${kpi(I.flame, `${s.actifs}<small>/${s.n}</small>`, 'Actifs cette semaine')}
  </div>`;
}

function onglets(c) {
  const mien = (prof.devoirs || []).filter(d => d.mien).length;
  const o = (k, t, n, alerte) => `<button role="tab" aria-selected="${prof.tab === k}" class="${prof.tab === k ? 'on' : ''}"
    data-pf="onglet" data-v="${k}">${t}${n ? `<em class="${alerte ? 'alerte' : ''}">${n}</em>` : ''}</button>`;
  return `<div class="pf-tabs" role="tablist">
    ${o('eleves', 'Élèves', c.effectif)}
    ${c.attente || c.validation ? o('demandes', 'Demandes', c.attente, c.attente > 0) : ''}
    ${o('devoirs', 'Devoirs', mien)}
    ${o('bilan', 'Bilan')}
    ${o('reglages', 'Réglages')}
  </div>`;
}

/* ---------- élèves ---------- */
function ligneEleve(m) {
  const e = etatEleve(m), sel = prof.sel.has(m.user_id);
  const taux = pc(m.rendus, m.donnes);
  return `<div class="pf-tr${sel ? ' sel' : ''}" role="button" tabindex="0" data-pf="eleve" data-id="${esc(m.user_id)}"
      data-nom="${esc((m.who + ' ' + (m.handle || '')).toLowerCase())}">
    <span class="pf-cb" role="checkbox" aria-checked="${sel}" aria-label="Sélectionner ${esc(m.who)}" data-pf="coche"
      data-id="${esc(m.user_id)}"><i>${svg(I.check)}</i></span>
    <span class="pf-who">${avatar(m.user_id, m.who)}<span><b>${esc(m.who)}</b>${
      m.handle ? `<i>@${esc(m.handle)}</i>` : ''}</span></span>
    <span class="pf-c-etat">${pill(ETATS[e.k], e.t)}</span>
    <span class="pf-num pf-c-rendu"><b>${m.rendus}</b><i>/${m.donnes}</i>
      <span class="pf-mb"><i style="width:${m.rendus ? Math.max(4, taux) : 0}%"></i></span></span>
    <span class="pf-num pf-c-pct"><b>${m.pct || '—'}</b><i>${m.pct ? '%' : ''}</i></span>
    <span class="pf-num pf-c-act"><b>${m.pages7 || 0}</b><i>p · ${m.jours7 || 0} j</i></span>
    <span class="pf-dim pf-c-vu">${m.jamais ? '—' : m.vu ? timeAgo(m.vu) : 'aucun rendu'}</span>
  </div>`;
}

function barreSelection() {
  const n = prof.sel.size;
  if (!n) return '';
  return `<div class="pf-bulk" data-k="pf-bulk" role="toolbar" aria-label="Élèves sélectionnés">
    <b>${plur(n, 'élève')}</b>
    ${btn('sel-message', I.mail2, 'Écrire')}
    ${btn('sel-retirer', I.x, 'Retirer', 'warn')}
    ${btn('sel-vider', I.x, '', 'ic', 'aria-label="Tout désélectionner"')}
  </div>`;
}

/* Personne encore : le code d'abord (les élèves entrent seuls et choisissent
   cette classe) ; un groupe, lui, se compose en cochant des élèves. */
function elevesVide(c) {
  if (c.genre === 'groupe') {
    return `<div class="pf-vide petit"><i class="pf-vide-ic">${svg(I.users)}</i><h2>Aucun élève</h2>
      ${c.gere ? btn('groupe-modifier', I.users, 'Choisir les élèves', 'pri') : ''}</div>`;
  }
  return `<div class="pf-vide petit"><i class="pf-vide-ic">${svg(I.users)}</i><h2>Aucun élève</h2>
    ${btn('inviter', I.key, 'Donner le code', 'pri')}</div>`;
}

function elevesOnglet(c) {
  const r = prof.roster;
  if (!r) return chargement();
  if (!r.length) return elevesVide(c);
  const vus = trierEleves(filtrerEleves(r, prof.q, prof.filtre), prof.tri);
  const n = k => r.filter(m => correspond(m, k)).length;
  const tous = vus.length && vus.every(m => prof.sel.has(m.user_id));
  return `<div class="pf-tool">
      <label class="pf-search">${svg(I.search)}<input id="pfq" type="search" placeholder="Rechercher un élève"
        value="${esc(prof.q)}" autocomplete="off" spellcheck="false" data-pfin="q" aria-label="Rechercher un élève"><kbd>/</kbd></label>
      <div class="pf-seg pf-filtres" role="group" aria-label="Filtrer">${Object.entries(FILTRES).map(([k, t]) =>
        `<button class="${prof.filtre === k ? 'on' : ''}" data-pf="filtre" data-v="${k}">${t}<em>${n(k)}</em></button>`).join('')}</div>
      <select class="pf-sel" data-pfch="tri" aria-label="Trier">${Object.entries(TRIS).map(([k, t]) =>
        `<option value="${k}"${prof.tri === k ? ' selected' : ''}>${t}</option>`).join('')}</select>
    </div>
    <div class="pf-table pf-t-eleves" role="table" aria-label="Élèves">
      <div class="pf-tr pf-th" role="row">
        <span class="pf-cb" role="checkbox" aria-checked="${tous}" aria-label="Tout sélectionner" data-pf="coche-tout"><i>${svg(I.check)}</i></span>
        <span>Élève</span><span class="pf-c-etat">État</span><span class="pf-c-rendu">Rendus</span>
        <span class="pf-c-pct">Réussite</span><span class="pf-c-act">Activité 7 j</span><span class="pf-c-vu">Dernier rendu</span>
      </div>
      ${vus.map(ligneEleve).join('') || `<div class="pf-ok">${svg(I.search)}<span>Aucun élève ne correspond</span></div>`}
    </div>
    ${barreSelection()}`;
}

/* ---------- la salle d'attente ---------- */
function demandesOnglet(c) {
  const l = prof.demandes;
  if (!l) return chargement();
  if (!l.length) {
    return `<div class="pf-vide petit"><i class="pf-vide-ic">${svg(I.check)}</i><h2>Personne en attente</h2>
      ${btn('tableau', I.grid, 'Projeter le code', 'pri')}</div>`;
  }
  return `<div class="pf-dem-h"><b>${plur(l.length, 'élève')} en attente</b>
      <span>Un nom inconnu ? Refusez-le, et bloquez-le.</span>
      ${btn('admettre-tout', I.check, 'Tout admettre', 'pri')}</div>
    <div class="pf-list">${l.map(d => `<div class="pf-li pf-dem">
      ${avatar(d.user_id, d.who)}<span class="pf-lit"><b>${esc(d.who)}</b><i>${d.handle ? '@' + esc(d.handle) + ' · ' : ''}${timeAgo(d.depuis)}</i></span>
      ${btn('admettre', I.check, 'Admettre', 'sm pri', `data-id="${esc(d.user_id)}"`)}
      ${btn('refuser', I.x, 'Refuser', 'sm', `data-id="${esc(d.user_id)}"`)}
      ${btn('bloquer', I.lock, '', 'sm ic warn', `data-id="${esc(d.user_id)}" aria-label="Refuser et bloquer" title="Refuser et bloquer"`)}
    </div>`).join('')}</div>`;
}

/* ---------- les devoirs ---------- */
function ligneDevoir(d) {
  const e = etatDevoir(d, iso(new Date()));
  return `<div class="pf-tr" role="button" tabindex="0" data-pf="devoir" data-id="${esc(d.id)}">
    <span class="pf-who"><i class="pf-di">${svg(I.card)}</i><span><b>${esc(d.nom)}</b><i>${plur(d.n, 'carte')}${
      d.matiere ? ' · ' + esc(d.matiere) : ''}${d.mien ? '' : ' · ' + esc(d.auteur)}</i></span></span>
    <span class="pf-c-due ${e.tard ? 'ko' : ''}"><b>${esc(jourCourt(d.due))}</b><i>${esc(e.echeance)}</i></span>
    <span class="pf-num pf-c-rendu"><b>${d.rendu}</b><i>/${d.effectif}</i>
      <span class="pf-mb"><i style="width:${d.rendu ? Math.max(4, e.taux) : 0}%"></i></span></span>
    <span class="pf-num pf-c-po ${e.pasOuvert ? 'am' : ''}"><b>${e.pasOuvert}</b><i>pas ouvert</i></span>
    <span class="pf-num pf-c-pct"><b>${d.pct || '—'}</b><i>${d.pct ? '%' : ''}</i></span>
  </div>`;
}

function calendrierDevoirs(l) {
  const ancre = auJour(prof.mois || iso(new Date())), jours = parJour(l), auj = iso(new Date());
  const a = ancre.getFullYear(), m = ancre.getMonth();
  return `<div class="pf-calh">
      <button class="pf-btn ic" data-pf="mois" data-v="${iso(new Date(a, m - 1, 1, 12))}" aria-label="Mois précédent">${svg(I.back)}</button>
      <h2>${MOIS[m]} ${a}</h2>
      <button class="pf-btn ic" data-pf="mois" data-v="${iso(new Date(a, m + 1, 1, 12))}" aria-label="Mois suivant">${svg(I.arrow)}</button></div>
    <div class="pf-agenda petit">${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(j => `<span class="pf-agh">${j}</span>`).join('')}
      ${grilleMois(a, m).map(k => !k ? '<span class="pf-agv"></span>' : `<button class="pf-agj${k === auj ? ' auj' : ''}${
        k < auj ? ' passe' : ''}" ${jours[k] ? `data-pf="devoir" data-id="${esc(jours[k][0].id)}"` : 'disabled'}><b>${+k.slice(8)}</b>${
        (jours[k] || []).map(x => `<span class="pf-agi" style="--k:${couleur(prof.open)}"><i></i>${esc(x.nom)}</span>`).join('')}</button>`).join('')}
    </div>`;
}

function devoirsOnglet(c) {
  const l = prof.devoirs;
  if (!l) return chargement();
  const mien = l.filter(d => d.mien), autres = l.filter(d => !d.mien);
  const tete2 = `<div class="pf-tr pf-th"><span>Devoir</span><span class="pf-c-due">Échéance</span><span class="pf-c-rendu">Rendus</span>
    <span class="pf-c-po">Pas ouvert</span><span class="pf-c-pct">Réussite</span></div>`;
  const vue = `<div class="pf-seg" role="group"><button class="${prof.vue !== 'cal' ? 'on' : ''}" data-pf="vue" data-v="liste">${
    svg(I.rows)}Liste</button><button class="${prof.vue === 'cal' ? 'on' : ''}" data-pf="vue" data-v="cal">${svg(I.cal)}Mois</button></div>`;
  return `<div class="pf-tool">${vue}<span class="pf-sp"></span>${c.archivee ? '' : btn('donner', I.plus, 'Donner un devoir', 'pri sm')}</div>
    ${!l.length ? `<div class="pf-vide petit"><i class="pf-vide-ic">${svg(I.card)}</i><h2>Aucun devoir</h2>${
      c.archivee ? '' : btn('donner', I.plus, 'Donner un premier devoir', 'pri')}</div>`
    : prof.vue === 'cal' ? calendrierDevoirs(l)
    : `${mien.length ? `<div class="pf-table pf-t-devoirs">${tete2}${mien.map(ligneDevoir).join('')}</div>` : ''}
       ${autres.length ? `<h3 class="pf-h3">Collègues <span>${autres.length}</span></h3>
         <div class="pf-table pf-t-devoirs">${tete2}${autres.map(ligneDevoir).join('')}</div>` : ''}`}`;
}

/* ---------- le bilan ---------- */
function bilanOnglet() {
  const r = prof.roster;
  if (!r) return chargement();
  if (!r.length) return `<div class="pf-vide petit"><i class="pf-vide-ic">${svg(I.chart)}</i><h2>Pas encore d’élève</h2></div>`;
  const s = syntheseClasse(r), hi = Math.max(1, ...s.tranches.map(t => t.n));
  const COUL = { ok: 'ok', am: 'am', ko: 'ko', jamais: 'gris' };
  return `<div class="pf-2">
    <section class="pf-panel"><h2>Où en est la classe</h2>
      <div class="pf-stack">${s.paquets.map(p => `<i class="${COUL[p.k]}" style="flex:${p.l.length}" title="${esc(p.t)} : ${p.l.length}"></i>`).join('')}</div>
      <div class="pf-leg">${s.paquets.map(p => `<span class="${COUL[p.k]}"><i></i><b>${p.l.length}</b>${esc(p.t)}</span>`).join('')}</div>
    </section>
    <section class="pf-panel"><h2>Répartition des réussites <span>${s.notes} notés</span></h2>
      ${s.notes ? `<div class="pf-histo">${s.tranches.map(t => `<span class="pf-hb"><em>${t.n || ''}</em>
        <i style="height:${t.n ? Math.max(6, Math.round(t.n / hi * 100)) : 0}%"></i><b>${t.t}</b></span>`).join('')}</div>`
        : `<div class="pf-ok">${svg(I.chart)}<span>Aucun résultat pour l’instant</span></div>`}
    </section></div>
    <section class="pf-panel"><h2>À reprendre <span>${s.aReprendre.length}</span></h2>
      ${s.aReprendre.length ? `<div class="pf-chipsl">${s.aReprendre.map(m => `<button class="pf-pe" data-pf="eleve" data-id="${esc(m.user_id)}">
        ${avatar(m.user_id, m.who)}<span><b>${esc(m.who)}</b><i>${esc(etatEleve(m).t)}${m.pct && m.pct < 45 ? ` · ${m.pct} %` : ''}</i></span></button>`).join('')}</div>`
      : `<div class="pf-ok">${svg(I.check)}<span>Personne à reprendre</span></div>`}
    </section>`;
}

/* ---------- les réglages ---------- */

/* Les inscriptions se règlent au niveau du code (docs/PARCOURS.md) : dans un
   établissement, c'est l'affaire du référent ; seul reste, pour la classe
   d'un professeur particulier, le nombre de places. */
function reglagesInscriptions(c) {
  if (c.etab) return '';
  const g = c.gere && !c.archivee;
  return `<section class="pf-panel"><h2>Inscriptions</h2>
    <div class="pf-row"><span><b>Places</b><i>${c.effectif} inscrits</i></span>
      <span class="pf-step">${btn('r-places', I.minus, '', 'ic sm', `data-v="-1" aria-label="Une place de moins" ${g ? '' : 'disabled'}`)}
        <input type="number" min="1" max="300" value="${c.places}" data-pfch="places" aria-label="Places" ${g ? '' : 'disabled'}>
        ${btn('r-places', I.plus, '', 'ic sm', `data-v="1" aria-label="Une place de plus" ${g ? '' : 'disabled'}`)}</span></div>
  </section>`;
}

function reglagesEquipe(c) {
  const l = prof.equipe || [];
  const moi = l.find(t => t.moi);
  return `<section class="pf-panel"><h2>Équipe <span>${l.length}</span></h2>
    <div class="pf-list">${l.map(t => `<div class="pf-li">${avatar(t.teacher, t.nom)}
      <span class="pf-lit"><b>${esc(t.nom)}${t.moi ? ' (vous)' : ''}</b><i>${esc(t.matiere)}${t.createur ? ' · créateur' : ''}${t.principal ? ' · PP' : ''}</i></span>
      ${c.createur && !t.moi ? btn('retirer-collegue', I.x, '', 'sm ic warn', `data-id="${esc(t.teacher)}" aria-label="Retirer ${esc(t.nom)}"`) : ''}
    </div>`).join('')}</div>
    ${c.etab ? (c.genre === 'classe' && !c.createur
      ? btn('ne-plus-enseigner', I.exit, 'Ne plus enseigner dans cette classe', 'sm warn') : '')
    : c.createur ? (c.code_collegue
      ? `<div class="pf-code"><span>Code collègue</span><b>${esc(formatCode(c.code_collegue))}</b>${btn('copier-collegue', I.copy, 'Copier', 'sm')}${
          btn('collegue-off', I.x, 'Désactiver', 'sm')}</div><p class="pf-note">Valable ${esc(finTexte(c.fin_collegue))}, pour un professeur${c.etab ? ' de votre établissement' : ''}.</p>`
      : btn('collegue-on', I.plus, 'Inviter un collègue', 'sm'))
      : moi && !c.createur && !c.etab ? btn('quitter', I.exit, 'Quitter la classe', 'sm warn') : ''}
  </section>`;
}

function reglagesExclus(c) {
  const l = prof.exclus;
  return `<section class="pf-panel"><h2>Exclus <span>${l ? l.length : ''}</span></h2>
    ${!l ? chargement() : !l.length ? `<p class="pf-note">Personne n’est exclu. Un élève retiré « et exclu » ne peut plus redemander à entrer.</p>`
      : `<div class="pf-list">${l.map(x => `<div class="pf-li">${avatar(x.user_id, x.who)}
          <span class="pf-lit"><b>${esc(x.who)}</b><i>${timeAgo(x.depuis)}</i></span>
          ${c.gere ? btn('reintegrer', I.redo, 'Lever', 'sm', `data-id="${esc(x.user_id)}"`) : ''}</div>`).join('')}</div>`}
  </section>`;
}

function reglagesClasse(c) {
  if (!c.createur && !c.gere) return '';
  const f = prof.f;
  return `<section class="pf-panel"><h2>La classe</h2>
    ${c.createur ? `<div class="pf-form">
      <label>Nom<input data-pfin="f.nom" value="${esc(f.nom ?? c.name)}" maxlength="60"></label>
      <label>Niveau<input data-pfin="f.niveau" value="${esc(f.niveau ?? (c.niveau || ''))}" maxlength="40"></label>
      ${btn('enregistrer-classe', I.check, 'Enregistrer', 'sm pri')}</div>` : ''}
    <div class="pf-row"><span><b>${c.archivee ? 'Archivée' : 'Archiver'}</b><i>Fin d’année : plus d’inscription ni de devoir, tout reste lisible</i></span>
      ${c.createur ? btn(c.archivee ? 'desarchiver' : 'archiver', c.archivee ? I.redo : I.clock, c.archivee ? 'Désarchiver' : 'Archiver', 'sm') : ''}</div>
    ${c.createur ? `<div class="pf-row"><span><b>Supprimer</b><i>Élèves, devoirs, avancement : tout est effacé</i></span>
      ${btn('supprimer', I.trash, 'Supprimer', 'sm warn')}</div>` : ''}
  </section>`;
}

function reglagesOnglet(c) {
  return `<div class="pf-2">${reglagesInscriptions(c)}${reglagesEquipe(c)}</div>
    <div class="pf-2">${reglagesExclus(c)}${reglagesClasse(c)}</div>`;
}

const ONGLETS = { eleves: elevesOnglet, demandes: demandesOnglet, devoirs: devoirsOnglet, bilan: bilanOnglet, reglages: reglagesOnglet };

export function profClasseView() {
  const c = classeOuverte();
  /* ouverte par son adresse, la classe arrive avec la liste : on attend */
  if (!c && !prof.classes) { $.innerHTML = '<div class="pf"><main class="pf-main"><div class="pf-load"><i></i><i></i><i></i></div></main></div>'; return; }
  if (!c) return go('prof');
  const s = syntheseClasse(prof.roster || []);
  $.innerHTML = `<div class="pf">${navProf('classe')}<main class="pf-main">
    ${selecteurMobile(c)}
    ${enteteClasse(c)}
    ${kpisClasse(c, s)}
    ${onglets(c)}
    <section class="pf-corps" role="tabpanel" data-k="pftab:${esc(c.id)}:${prof.tab}">${(ONGLETS[prof.tab] || elevesOnglet)(c)}</section>
  </main></div>`;
}

export { ETATS };
