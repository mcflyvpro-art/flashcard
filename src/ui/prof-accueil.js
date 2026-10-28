// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { $ } from '../racine.js';
import { I, svg } from '../icones.js';
import { prefs, prof } from '../data/etat.js';
import {
  JOURS, MOIS, aTraiter, auJour, echeance, grilleMois, iso,
  jourLong, parJour, rangerClasses, syntheseAccueil
} from '../classe.js';
import { avatar as jeton, blason, couleurClasse } from './jeton.js';
import { esc, plur } from '../core/coeur-sync.js';
import { codeBande, etab } from './prof-etab.js';

/* ══════════ l'espace professeur : l'accueil ══════════
   Un outil de travail, pas une vitrine. On y lit d'un coup d'œil ce qui
   demande un geste (une demande d'inscription, un élève qui décroche, une
   classe vide), ce qui tombe cette semaine, et ses classes. Peu de mots :
   des chiffres, des couleurs, des boutons qui disent ce qu'ils font.

   Sur ordinateur, une barre latérale tient toutes les classes à portée de
   clic ; sur téléphone elle disparaît et l'accueil fait office de liste. */

/* ---------- les briques ---------- */
// Les jetons de ui/jeton.js : le blason d'une classe (son emblème, jamais un
// sigle tiré du nom), sa couleur pour ce qui s'y rapporte, le visage d'un élève.
export const couleur = id => couleurClasse(id);
export const pastilleClasse = (c, grand) => blason(c.id, grand ? 'lg' : '');
export const avatar = (id, nom) => jeton(id, nom, 'sm');

export const pill = (k, t) => `<span class="pf-pill ${k}"><i></i>${esc(t)}</span>`;

export const kpi = (ic, val, lab, ton, act) => `<${act ? `button data-pf="${act}"` : 'div'} class="pf-kpi ${ton || ''}">
  <span class="pf-kpi-l">${svg(ic)}${esc(lab)}</span><b>${val}</b></${act ? 'button' : 'div'}>`;

export const btn = (act, ic, lab, cls, extra) =>
  `<button class="pf-btn ${cls || ''}" data-pf="${act}" ${extra || ''}>${ic ? svg(ic) : ''}${lab ? `<span>${lab}</span>` : ''}</button>`;

export const chargement = () => `<div class="pf-load"><i></i><i></i><i></i></div>`;

export const tete = (titre, sous, actions) => `<header class="pf-h">
  <div><h1>${titre}</h1>${sous ? `<p>${sous}</p>` : ''}</div>
  ${actions ? `<div class="pf-ha">${actions}</div>` : ''}</header>`;

export const classeOuverte = () => (prof.classes || []).find(c => c.id === prof.open) || null;

export const metaClasse = c => [c.niveau, c.matiere].filter(Boolean).map(esc).join(' · ');

/* ---------- la barre latérale ---------- */
function ligneNav(c, actif) {
  const on = actif === 'classe' && prof.open === c.id;
  return `<button class="pf-ni pf-nk${on ? ' on' : ''}" data-pf="classe" data-id="${esc(c.id)}"
    style="--k:${couleur(c.id)}"><i class="pf-dot"></i><span>${esc(c.name)}</span>${
      c.attente ? `<em class="pf-badge" title="Demandes en attente">${c.attente}</em>` : `<b>${c.effectif}</b>`}</button>`;
}

export function navProf(actif) {
  const { actives, archives } = rangerClasses(prof.classes);
  const an = prof.annees || [];
  return `<nav class="pf-nav" aria-label="Espace professeur">
    <button class="pf-ni${actif === 'accueil' ? ' on' : ''}" data-pf="accueil">${svg(I.grid)}<span>Tableau de bord</span></button>
    <button class="pf-ni${actif === 'agenda' ? ' on' : ''}" data-pf="agenda">${svg(I.cal)}<span>Agenda</span></button>
    <div class="pf-nl"><span>Classes${an.length > 1 ? '' : prof.annee ? ' · ' + esc(prof.annee) : ''}</span>
      <span>${etab() ? `<button class="pf-nadd" data-pf="choisir" aria-label="Mes classes de l’établissement"
        title="Mes classes de l’établissement">${svg(I.school)}</button><button class="pf-nadd" data-pf="groupe"
        aria-label="Nouveau groupe" title="Nouveau groupe">${svg(I.plus)}</button>`
      : `<button class="pf-nadd" data-pf="rejoindre" aria-label="Rejoindre une classe avec un code collègue"
        title="Rejoindre avec un code collègue">${svg(I.link)}</button><button class="pf-nadd" data-pf="creer"
        aria-label="Nouvelle classe" title="Nouvelle classe">${svg(I.plus)}</button>`}</span></div>
    ${actives.map(c => ligneNav(c, actif)).join('') || '<p class="pf-nvide">Aucune classe</p>'}
    ${archives.length ? `<button class="pf-ni pf-narch" data-pf="archives">${svg(I.clock)}<span>Archives</span><b>${
      archives.length}</b></button>${prof.archives ? archives.map(c => ligneNav(c, actif)).join('') : ''}` : ''}
  </nav>
  <div class="pf-mnav" role="tablist" aria-label="Espace professeur">
    <button class="${actif === 'accueil' ? 'on' : ''}" data-pf="accueil">${svg(I.grid)}<span>Tableau de bord</span></button>
    <button class="${actif === 'agenda' ? 'on' : ''}" data-pf="agenda">${svg(I.cal)}<span>Agenda</span></button>
  </div>`;
}

/* L'année scolaire : un sélecteur seulement s'il y en a plusieurs. */
export function anneeChoix() {
  const an = prof.annees || [];
  if (an.length < 2) return '';
  return `<select class="pf-sel" id="pfan" data-pfch="annee" aria-label="Année scolaire">${an.map(a =>
    `<option value="${esc(a.annee)}"${a.annee === prof.annee ? ' selected' : ''}>${esc(a.annee)}</option>`).join('')}</select>`;
}

/* ---------- le tableau de bord ---------- */
const TODO = {
  attente: [I.users, 'am', n => plur(n, 'demande') + ' d’inscription', 'Admettre', 'demandes'],
  retard: [I.warn, 'ko', n => plur(n, 'élève') + ' en retard', 'Voir', 'retard'],
  jamais: [I.lock, 'gris', n => (n > 1 ? `${n} élèves jamais connectés` : '1 élève jamais connecté'), 'Voir', 'jamais'],
  vide: [I.user, 'neutre', () => 'Aucun élève', 'Ajouter', 'inviter'],
  sansdevoir: [I.card, 'neutre', () => 'Aucun devoir donné', 'Donner', 'donner']
};

function aTraiterHtml(l) {
  const t = aTraiter(l).slice(0, 8);
  if (!t.length) return `<div class="pf-ok">${svg(I.check)}<span>Rien à traiter</span></div>`;
  return `<div class="pf-todo">${t.map(x => {
    const [ic, ton, lab, bouton, cible] = TODO[x.k];
    return `<div class="pf-td ${ton}"><i class="pf-tdi">${svg(ic)}</i>
      <span class="pf-tdt"><b>${lab(x.n)}</b><em style="--k:${couleur(x.cid)}"><i></i>${esc(x.classe)}</em></span>
      <button class="pf-btn sm" data-pf="aller" data-id="${esc(x.cid)}" data-v="${cible}">${bouton}</button></div>`;
  }).join('')}</div>`;
}

/* Les sept jours qui viennent : ce qui est à rendre, classe par classe. */
function semaineHtml() {
  const l = prof.semaine;
  if (!l) return chargement();
  if (!l.length) return `<div class="pf-ok">${svg(I.check)}<span>Rien à rendre d’ici sept jours</span></div>`;
  const jours = parJour(l), auj = iso(new Date());
  const cases = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i);
    return iso(d);
  });
  return `<div class="pf-week">${cases.map(k => {
    const ds = jours[k] || [], d = auJour(k);
    return `<div class="pf-wd${k === auj ? ' auj' : ''}${ds.length ? '' : ' vide'}">
      <span class="pf-wdh"><b>${JOURS[d.getDay()].slice(0, 3)}.</b><i>${d.getDate()}</i></span>
      ${ds.slice(0, 3).map(x => `<button class="pf-wi" data-pf="devoir" data-id="${esc(x.id)}" style="--k:${couleur(x.class_id)}"
        title="${esc(x.classe)} · ${esc(x.nom)}"><i></i><span>${esc(x.nom)}</span><em>${x.rendu}/${x.effectif}</em></button>`).join('')}
      ${ds.length > 3 ? `<span class="pf-wplus">+${ds.length - 3}</span>` : ''}</div>`;
  }).join('')}</div>`;
}

function carteClasse(c) {
  return `<button class="pf-kc" data-pf="classe" data-id="${esc(c.id)}" style="--k:${couleur(c.id)}">
    <span class="pf-kch">${pastilleClasse(c)}<span><b>${esc(c.name)}</b><i>${metaClasse(c) || '&nbsp;'}</i></span>
      ${c.attente ? `<em class="pf-badge" title="Demandes en attente">${c.attente}</em>` : ''}</span>
    <span class="pf-kcs">
      <span><b>${c.effectif}</b><i>élèves</i></span>
      <span class="${c.retard ? 'ko' : ''}"><b>${c.retard}</b><i>en retard</i></span>
      <span><b>${c.pct ? c.pct + '<small>%</small>' : '—'}</b><i>réussite</i></span>
    </span>
    <span class="pf-kcd">${c.dernier ? `${svg(I.card)}<b>${esc(c.dernier)}</b><i>${esc(echeance(c.dernier_due))}</i>`
      : `<i>Aucun devoir</i>`}</span>
    <span class="pf-kcf">${c.genre === 'groupe' ? '<em class="pf-tag">Groupe</em>' : ''}${c.principal && c.genre !== 'groupe' ? '<em class="pf-tag">PP</em>' : ''}</span>
  </button>`;
}

/* Le premier jour : dans un établissement, choisir ses classes ; seul, donner
   son code — le premier élève qui le tape crée « Mes élèves ». */
function accueilVide() {
  if (etab()) {
    return `<div class="pf-vide">
      <i class="pf-vide-ic">${svg(I.school)}</i>
      <h2>Vos classes</h2>
      <ol class="pf-etapes">
        <li><b>1</b><span>Choisissez vos classes dans l’établissement</span></li>
        <li><b>2</b><span>Formez un groupe si besoin (spécialité, option…)</span></li>
        <li><b>3</b><span>Donnez un devoir</span></li>
      </ol>
      ${btn('choisir', I.school, 'Choisir mes classes', 'pri lg')}
      <button class="pf-lnk seul" data-pf="groupe">${svg(I.users)}Former un groupe</button>
    </div>`;
  }
  return `${codeBande()}<div class="pf-vide">
    <i class="pf-vide-ic">${svg(I.key)}</i>
    <h2>Vos premiers élèves</h2>
    <ol class="pf-etapes">
      <li><b>1</b><span>Donnez votre code à vos élèves</span></li>
      <li><b>2</b><span>Ils le tapent dans Mirandola → Réglages → J’ai un code</span></li>
      <li><b>3</b><span>Donnez un devoir</span></li>
    </ol>
    ${btn('tableau', I.grid, 'Projeter mon code', 'pri lg')}
    <span class="pf-lnks"><button class="pf-lnk" data-pf="creer">${svg(I.plus)}Créer une classe</button>
      <button class="pf-lnk" data-pf="rejoindre">${svg(I.link)}J’ai un code collègue</button></span>
  </div>`;
}

function accueilCorps(l) {
  const s = syntheseAccueil(l);
  const { actives } = rangerClasses(l);
  return `${codeBande()}<div class="pf-kpis">
      ${kpi(I.users, s.eleves, 'Élèves')}
      ${s.attente ? kpi(I.user, s.attente, 'En attente', 'am', 'aller-attente') : ''}
      ${kpi(I.warn, s.retard, 'En retard', s.retard ? 'ko' : '')}
      ${kpi(I.lock, s.jamais, 'Jamais connectés', s.jamais ? 'gris' : '')}
      ${kpi(I.card, s.encours, 'Devoirs en cours')}
    </div>
    <div class="pf-2">
      <section class="pf-panel"><h2>À traiter</h2>${aTraiterHtml(l)}</section>
      <section class="pf-panel pf-semaine"><h2>Cette semaine <button class="pf-lnk" data-pf="agenda">Agenda</button></h2>${semaineHtml()}</section>
    </div>
    <section class="pf-sec"><h2>Mes classes <span>${actives.length}</span></h2>
      <div class="pf-grid">${actives.map(carteClasse).join('')}
        ${etab() ? `<button class="pf-kc pf-kadd" data-pf="choisir">${svg(I.school)}<span>Mes classes</span></button>
          <button class="pf-kc pf-kadd" data-pf="groupe">${svg(I.users)}<span>Nouveau groupe</span></button>`
        : `<button class="pf-kc pf-kadd" data-pf="creer">${svg(I.plus)}<span>Nouvelle classe</span></button>`}</div></section>`;
}

const bonjour = () => {
  const h = new Date().getHours(), n = String(prefs.name || '').trim().split(' ')[0];
  return `${h < 18 ? 'Bonjour' : 'Bonsoir'}${n ? ', ' + esc(n) : ''}`;
};

export function profAccueilView() {
  const l = prof.classes;
  const actions = !(l && l.length) ? '' : etab()
    ? btn('choisir', I.school, 'Mes classes') + btn('donner', I.card, 'Donner un devoir') + btn('groupe', I.users, 'Nouveau groupe', 'pri')
    : btn('rejoindre', I.link, '', 'ic', 'aria-label="Rejoindre avec un code collègue" title="Rejoindre avec un code collègue"')
      + btn('donner', I.card, 'Donner un devoir') + btn('creer', I.plus, 'Nouvelle classe', 'pri');
  const an = anneeChoix() || (prof.annee ? esc(prof.annee) : '');
  $.innerHTML = `<div class="pf">${navProf('accueil')}<main class="pf-main" id="pfmain">
    ${tete(bonjour(), `${esc(jourLong(iso(new Date())))}${an ? ' · ' + an : ''}`, actions)}
    ${!l ? (prof.err ? `<div class="pf-vide">${svg(I.cloud)}<h2>Classes indisponibles</h2>${btn('relire', I.refresh, 'Réessayer')}</div>` : chargement())
      : !rangerClasses(l).actives.length ? accueilVide() : accueilCorps(l)}
  </main></div>`;
}

/* ---------- l'agenda : le mois de toutes les classes ---------- */
function moisAgenda(ancre) {
  const jours = parJour(prof.agenda), auj = iso(new Date());
  const cases = grilleMois(ancre.getFullYear(), ancre.getMonth());
  return `<div class="pf-agenda">
    ${['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'].map(j => `<span class="pf-agh">${j}</span>`).join('')}
    ${cases.map(k => {
      if (!k) return '<span class="pf-agv"></span>';
      const ds = jours[k] || [];
      return `<button class="pf-agj${k === auj ? ' auj' : ''}${k === prof.jour ? ' on' : ''}${k < auj ? ' passe' : ''}"
        data-pf="jour" data-v="${k}"><b>${+k.slice(8)}</b>${ds.slice(0, 3).map(x =>
          `<span class="pf-agi" style="--k:${couleur(x.class_id)}"><i></i><span>${esc(x.classe)} · ${esc(x.nom)}</span></span>`).join('')}${
          ds.length > 3 ? `<em>+${ds.length - 3}</em>` : ''}</button>`;
    }).join('')}</div>`;
}

function jourAgenda() {
  const ds = (parJour(prof.agenda)[prof.jour] || []);
  if (!prof.jour) return '';
  return `<section class="pf-panel"><h2>${esc(jourLong(prof.jour))} <span>${ds.length}</span></h2>
    ${ds.length ? `<div class="pf-list">${ds.map(x => `<button class="pf-li" data-pf="devoir" data-id="${esc(x.id)}">
      <i class="pf-dot" style="--k:${couleur(x.class_id)}"></i>
      <span class="pf-lit"><b>${esc(x.nom)}</b><i>${esc(x.classe)}${x.mien ? '' : ' · un collègue'} · ${plur(x.n, 'carte')}</i></span>
      <span class="pf-num"><b>${x.rendu}</b><i>/${x.effectif}</i></span>${svg(I.arrow)}</button>`).join('')}</div>`
      : `<div class="pf-ok">${svg(I.check)}<span>Rien à rendre ce jour-là</span></div>`}</section>`;
}

export function profAgendaView() {
  const ancre = auJour(prof.mois || iso(new Date()));
  const a = ancre.getFullYear(), m = ancre.getMonth();
  $.innerHTML = `<div class="pf">${navProf('agenda')}<main class="pf-main">
    ${tete('Agenda', '', btn('donner', I.plus, 'Donner un devoir', 'pri'))}
    <div class="pf-calh">
      <button class="pf-btn ic" data-pf="mois" data-v="${iso(new Date(a, m - 1, 1, 12))}" aria-label="Mois précédent">${svg(I.back)}</button>
      <h2>${MOIS[m]} ${a}</h2>
      <button class="pf-btn ic" data-pf="mois" data-v="${iso(new Date(a, m + 1, 1, 12))}" aria-label="Mois suivant">${svg(I.arrow)}</button>
      <button class="pf-btn sm" data-pf="mois" data-v="${iso(new Date())}">Aujourd’hui</button>
    </div>
    ${prof.agenda ? moisAgenda(ancre) : chargement()}
    ${jourAgenda()}
  </main></div>`;
}
