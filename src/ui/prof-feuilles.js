// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { I, svg } from '../icones.js';
import { prof, setMenu } from '../data/etat.js';
import {
  CREATION, codeComplet, dansJours, echeance, etatDevoir, etatEleve, etatInscriptions, formatCode, grilleMois, iso,
  auJour, jourCourt, jourLong, lienCarte, lienRejoindre, lireListeEleves, messageStatut, MOIS, pc, tonReussite
} from '../classe.js';
import { qrSvg } from '../qr.js';
import { esc, live, plur } from '../core/coeur-sync.js';
import { avatar, btn, chargement, classeOuverte, couleur, pastilleClasse, pill } from './prof-accueil.js';
import { ETATS } from './prof-classe.js';
import { mountMenu } from './menus-a.js';
import { timeAgo } from './reglages-corbeille.js';

/* ══════════ les feuilles de l'espace professeur ══════════
   Une seule entrée dans la table des feuilles (`pf`, menus-a.js) ; laquelle
   est ouverte se lit dans `prof.feuille`, et ce qu'on y tape dans `prof.f`
   — ainsi une feuille repeinte (un chiffre qui arrive) garde la saisie. */

export const baseApp = () => location.origin + import.meta.env.BASE_URL;

function feuille(w, cls, titre, sous, corps, pied) {
  w.innerHTML = `<div class="scrim" data-mact="close"></div>
    <div class="menu pf-s ${cls || ''}">
      <div class="pf-sh">${titre}${sous ? `<i>${sous}</i>` : ''}</div>
      <div class="pf-sb">${corps}</div>
      ${pied ? `<div class="pf-sf">${pied}</div>` : ''}
    </div>`;
  mountMenu(w);
}

const champ = (lab, cle, attrs, val) => `<label class="pf-fl">${lab}<input data-pfin="f.${cle}" value="${
  esc(val !== undefined ? val : prof.f[cle] || '')}" ${attrs || ''}></label>`;

/* Le champ principal reçoit le focus à l'ouverture — sauf si l'on est déjà
   en train d'écrire ailleurs : un doigt rapide (ou un test) taperait sinon
   la suite dans le mauvais champ. */
const focus = id => setTimeout(() => {
  const n = document.getElementById(id), a = document.activeElement;
  if (n && !(a && a !== n && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) n.focus();
}, 80);

/* ---------- créer une classe ---------- */
function creer(w) {
  feuille(w, '', '<b>Nouvelle classe</b>', '', `<div class="pf-form">
      ${champ('Nom', 'nom', 'id="pfnom" maxlength="60" placeholder="2nde 4" enterkeyhint="next" autocomplete="off"')}
      ${champ('Niveau <em>facultatif</em>', 'niveau', 'maxlength="40" placeholder="Seconde" autocomplete="off"')}
      ${champ('Matière <em>facultatif</em>', 'matiere', 'maxlength="60" placeholder="Anglais" enterkeyhint="done" autocomplete="off"')}
    </div>`, btn('creer-go', I.check, 'Créer la classe', 'pri lg'));
  focus('pfnom');
}

/* ---------- ajouter des élèves ---------- */
export function apercuListe() {
  const r = lireListeEleves(prof.f.liste || '');
  return `<div class="pf-apercu">
    ${r.eleves.length ? `<p><b>${plur(r.eleves.length, 'élève')}</b> reconnu${r.eleves.length > 1 ? 's' : ''}${
      r.trop ? ` · ${r.trop} au-delà de 60, à ajouter ensuite` : ''}</p>
      <div class="pf-noms">${r.eleves.map(e => `<span>${esc(e.complet)}</span>`).join('')}</div>` : ''}
    ${r.ignorees.length ? `<p class="ko">${plur(r.ignorees.length, 'ligne')} illisible${r.ignorees.length > 1 ? 's' : ''} :</p>
      <div class="pf-noms ko">${r.ignorees.slice(0, 12).map(l => `<span>${esc(l)}</span>`).join('')}</div>` : ''}
  </div>`;
}

function resultats() {
  const l = prof.faites || [];
  const n = s => l.filter(x => x.statut === s).length;
  return `<div class="pf-res-h">
      <span class="ok"><b>${n('cree')}</b>créés</span>${n('deja') ? `<span><b>${n('deja')}</b>déjà là</span>` : ''}
      ${n('homonyme') ? `<span class="am"><b>${n('homonyme')}</b>homonymes</span>` : ''}
      ${n('complet') + n('invalide') ? `<span class="ko"><b>${n('complet') + n('invalide')}</b>non créés</span>` : ''}</div>
    ${n('cree') ? `<p class="pf-alerte">${svg(I.warn)}Les codes ne seront plus affichés : imprimez les cartes maintenant.</p>` : ''}
    <div class="pf-table pf-t-cartes">${l.map(x => `<div class="pf-tr">
      <span class="pf-who"><b>${esc(x.nom)}</b></span>
      <span class="pf-mono">${esc(x.identifiant || '')}</span><span class="pf-mono fort">${x.code ? esc(formatCode(x.code)) : ''}</span>
      <span>${pill((CREATION[x.statut] || ['ko'])[0], (CREATION[x.statut] || ['', x.statut])[1])}</span></div>`).join('')}</div>
    ${n('homonyme') ? `<p class="pf-note">Un homonyme a sans doute déjà sa carte : il rejoint avec le code de la classe.
      ${btn('homonymes', I.plus, `Créer quand même (${n('homonyme')})`, 'sm')}</p>` : ''}`;
}

function inviterCode(c) {
  const ins = etatInscriptions(c), lien = lienRejoindre(baseApp(), c.code);
  return `<div class="pf-inv">
    <div class="pf-inv-qr">${qrSvg(lien, 'QR pour rejoindre ' + c.name)}</div>
    <div class="pf-inv-t"><span>Code de la classe</span><b class="pf-gros">${esc(formatCode(c.code))}</b>
      ${pill(ins.ouvert ? 'ok' : 'am', ins.t)}
      <div class="pf-lien"><input readonly value="${esc(lien)}" aria-label="Lien d’invitation">${btn('copier-lien', I.copy, '', 'ic sm', 'aria-label="Copier le lien"')}</div>
      ${!ins.ouvert && c.gere && !c.archivee ? btn('r-ouvert', I.redo, 'Rouvrir les inscriptions', 'sm') : ''}
    </div></div>
    <p class="pf-note">${c.validation ? 'Chaque élève attend votre accord dans « Demandes ».' : 'Les élèves entrent sans validation.'}
      Un compte personnel doit écrire son vrai prénom et son nom.</p>`;
}

function inviter(w) {
  const c = classeOuverte(); if (!c) return setMenu(null);
  const mode = prof.f.mode || 'liste';
  const seg = `<div class="pf-seg plein">${[['liste', I.key, 'Liste de noms'], ['code', I.link, 'Code à projeter']].map(([k, ic, t]) =>
    `<button class="${mode === k ? 'on' : ''}" data-pf="f-mode" data-v="${k}">${svg(ic)}${t}</button>`).join('')}</div>`;
  let corps, pied;
  if (mode === 'code') {
    corps = seg + inviterCode(c);
    pied = btn('tableau', I.grid, 'Projeter au tableau', 'pri lg');
  } else if (prof.faites) {
    corps = resultats();
    pied = (prof.faites.some(x => x.code) ? btn('imprimer', I.file, 'Imprimer les cartes', 'pri lg') : '') + btn('fermer', '', 'Terminé', 'lg');
  } else {
    const n = lireListeEleves(prof.f.liste || '').eleves.length;
    corps = `${seg}<label class="pf-fl">Un élève par ligne — copiez la colonne depuis Pronote ou un tableur
        <textarea id="pfliste" data-pfin="f.liste" rows="9" spellcheck="false" placeholder="MARTIN Alice&#10;DUBOIS Léo&#10;N’DIAYE Awa">${esc(prof.f.liste || '')}</textarea></label>
      <div id="pfapercu">${apercuListe()}</div>
      <p class="pf-note">${svg(I.lock)}Chaque élève reçoit un identifiant et un code secret. Son nom, « Prénom NOM », ne pourra pas être changé par lui.</p>`;
    pied = btn('creer-eleves', I.check, n ? `Créer ${plur(n, 'compte')}` : 'Créer les comptes', 'pri lg', `id="pfcreer" ${n ? '' : 'disabled'}`);
  }
  feuille(w, 'large', `<b>Ajouter des élèves</b>`, esc(c.name), corps, pied);
  if (mode === 'liste' && !prof.faites) focus('pfliste');
}

/* ---------- le mode tableau : projeté devant la classe ---------- */
function tableau(w) {
  const c = classeOuverte(); if (!c) return setMenu(null);
  const lien = lienRejoindre(baseApp(), c.code), l = prof.demandes || [];
  feuille(w, 'pf-tableau', '', '', `<div class="pf-tb">
      <div class="pf-tb-g">${pastilleClasse(c, true)}<h1>${esc(c.name)}</h1>
        <ol><li>Ouvrez <b>Folio</b> sur votre téléphone</li><li>Visez le QR code, ou tapez le code</li></ol>
        <b class="pf-tb-code">${esc(formatCode(c.code))}</b>
        <p>${esc(lien.replace(/^https?:\/\//, '').replace(/\?.*$/, ''))}</p></div>
      <div class="pf-tb-qr">${qrSvg(lien, 'QR pour rejoindre ' + c.name)}</div>
    </div>
    <div class="pf-tb-att"><span><b>${l.length}</b> en attente${c.effectif ? ` · ${plur(c.effectif, 'inscrit')}` : ''}</span>
      <div class="pf-noms">${l.slice(-24).map(d => `<span>${esc(d.who)}</span>`).join('')}</div>
      ${l.length ? btn('admettre-tout', I.check, 'Tout admettre', 'pri') : ''}</div>`, '');
}

/* ---------- un élève ---------- */
function devoirsEleve() {
  const f = prof.fiche;
  if (!f) return chargement();
  if (!f.length) return `<p class="pf-note">Aucun devoir dans cette classe.</p>`;
  const ETAT = { rendu: 'ok', 'commencé': 'am', 'non rendu': 'ko', 'pas ouvert': 'neutre' };
  return `<div class="pf-list">${f.map(x => `<div class="pf-li">
    <span class="pf-lit"><b>${esc(x.devoir)}</b><i>${jourCourt(x.due)} · ${esc(echeance(x.due))}${x.mien ? '' : ' · un collègue'}</i></span>
    <span class="pf-num ${x.pct ? tonReussite(x.pct) : ''}"><b>${x.pct || '—'}</b><i>${x.pct ? '%' : ''}</i></span>
    ${pill(ETAT[x.etat] || 'neutre', x.etat)}</div>`).join('')}</div>`;
}

function actionsEleve(c, m) {
  return `${btn('mot', I.mail2, 'Écrire')}
    ${c.gere && (m.carte || !c.etab) ? btn('nommer', I.type, 'Corriger le nom') : ''}
    ${c.gere && m.carte ? btn('carte-une', I.key, 'Nouvelle carte') : ''}
    ${c.gere ? btn('retirer', I.x, 'Retirer…', 'warn') : ''}`;
}

function chiffresEleve(m) {
  return `<div class="pf-mini">
      <span><b>${m.rendus}<small>/${m.donnes}</small></b><i>rendus</i></span>
      <span class="${m.pct ? tonReussite(m.pct) : ''}"><b>${m.pct || '—'}${m.pct ? '<small>%</small>' : ''}</b><i>réussite</i></span>
      <span class="${m.retard ? 'ko' : ''}"><b>${m.retard}</b><i>en retard</i></span>
      <span><b>${m.pages7}</b><i>pages · 7 j</i></span></div>
    ${m.jamais ? `<p class="pf-alerte">${svg(I.lock)}${m.carte ? 'Jamais connecté : sa carte lui est-elle parvenue ?'
      : 'Ce compte ne s’est jamais connecté.'}</p>` : ''}`;
}

function eleveFiche(w) {
  const c = classeOuverte(), m = (prof.roster || []).find(x => x.user_id === prof.eleve);
  if (!c || !m) return setMenu(null);
  const e = etatEleve(m);
  feuille(w, 'pf-tiroir', `<span class="pf-sh-av">${avatar(m.user_id, m.who)}<span><b>${esc(m.who)}</b>${pill(ETATS[e.k], e.t)}</span></span>`,
    `${m.carte ? `Carte · ${esc(m.identifiant)}` : '@' + esc(m.handle || '')} · inscrit ${timeAgo(m.inscrit)}`,
    `${chiffresEleve(m)}<h3 class="pf-h3">Devoirs</h3>${devoirsEleve()}`,
    `<div class="pf-acts">${actionsEleve(c, m)}</div>`);
}

function retirer(w) {
  const c = classeOuverte(), qui = prof.f.qui || [];
  const l = (prof.roster || []).filter(m => qui.includes(m.user_id));
  if (!c || !l.length) return setMenu(null);
  const toutesCartes = l.every(m => m.carte), choix = prof.f.choix || 'retirer';
  const opt = (k, t, s) => `<button class="pf-opt${choix === k ? ' on' : ''}" data-pf="f-choix" data-v="${k}">
    <i>${svg(choix === k ? I.check : I.arrow)}</i><span><b>${t}</b><em>${s}</em></span></button>`;
  feuille(w, '', `<b>Retirer ${l.length > 1 ? plur(l.length, 'élève') : esc(l[0].who)}</b>`, esc(c.name), `
    ${opt('retirer', 'Retirer de la classe', 'Son avancement dans cette classe est effacé. Il pourra redemander à entrer.')}
    ${opt('exclure', 'Retirer et exclure', 'Il ne pourra plus demander à entrer, même avec le code.')}
    ${toutesCartes ? opt('supprimer', 'Supprimer son compte', 'Pour un compte à carte qui n’est dans aucune autre classe : tout est effacé.') : ''}`,
    btn('retirer-go', I.x, choix === 'supprimer' ? 'Supprimer définitivement' : 'Retirer', 'warn lg'));
}

function nommer(w) {
  const m = (prof.roster || []).find(x => x.user_id === prof.eleve);
  if (!m) return setMenu(null);
  feuille(w, '', '<b>Corriger le nom</b>', esc(m.who), `<div class="pf-form">
      ${champ('Prénom', 'prenom', 'id="pfpre" maxlength="40" autocomplete="off"')}
      ${champ('Nom', 'nomfam', 'maxlength="40" autocomplete="off"')}</div>
    <p class="pf-note">S’affichera : <b id="pfnomapercu"></b></p>`, btn('nommer-go', I.check, 'Enregistrer', 'pri lg'));
  focus('pfpre');
}

function message(w) {
  const c = classeOuverte(); if (!c) return setMenu(null);
  const qui = prof.f.qui;
  const n = qui ? qui.length : c.effectif;
  feuille(w, '', `<b>${qui ? (n > 1 ? `Écrire à ${n} élèves` : 'Écrire à ' + esc(((prof.roster || []).find(m => m.user_id === qui[0]) || {}).who || ''))
    : 'Écrire à la classe'}</b>`, esc(c.name), `<label class="pf-fl">Message
      <textarea id="pfmsg" data-pfin="f.msg" rows="6" maxlength="1000" placeholder="On reprend la série 2 jeudi : révisez les cartes 10 à 20.">${esc(prof.f.msg || '')}</textarea></label>
    <p class="pf-note">${svg(I.mail)}Arrive dans leur courrier Folio.</p>`,
    btn('message-go', I.mail2, `Envoyer${n > 1 ? ` à ${n} élèves` : ''}`, 'pri lg'));
  focus('pfmsg');
}

/* ---------- un devoir ---------- */
export const devoirOuvert = () => [...(prof.devoirs || []), ...(prof.semaine || []), ...(prof.agenda || [])]
  .find(x => x.id === prof.work) || null;

function choixDate(d, act) {
  const ancre = auJour(prof.f.mois || d || iso(new Date())), a = ancre.getFullYear(), m = ancre.getMonth();
  const lundi = (() => { const x = new Date(); x.setDate(x.getDate() + ((8 - x.getDay()) % 7 || 7)); return iso(x); })();
  const vite = [['Demain', dansJours(1)], ['Lundi', lundi], ['Dans 1 semaine', dansJours(7)], ['Dans 2 semaines', dansJours(14)]];
  const auj = iso(new Date());
  return `<div class="pf-dates">${vite.map(([t, k]) => `<button class="${d === k ? 'on' : ''}" data-pf="${act}" data-v="${k}">${t}</button>`).join('')}</div>
    <div class="pf-cal">
      <div class="pf-calh">${btn('f-mois', I.back, '', 'ic sm', `data-v="${iso(new Date(a, m - 1, 1, 12))}" aria-label="Mois précédent"`)}
        <b>${MOIS[m]} ${a}</b>${btn('f-mois', I.arrow, '', 'ic sm', `data-v="${iso(new Date(a, m + 1, 1, 12))}" aria-label="Mois suivant"`)}</div>
      <div class="pf-calg">${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(j => `<span>${j}</span>`).join('')}${grilleMois(a, m).map(k => !k ? '<span></span>'
        : `<button class="${k === d ? 'on' : ''}${k === auj ? ' auj' : ''}" data-pf="${act}" data-v="${k}" ${k < auj ? 'disabled' : ''}>${+k.slice(8)}</button>`).join('')}</div>
    </div>`;
}

function chiffresDevoir(d, e) {
  return `<div class="pf-mini">
      <span><b>${d.rendu}<small>/${d.effectif}</small></b><i>rendus</i></span>
      <span class="${e.pasOuvert ? 'am' : ''}"><b>${e.pasOuvert}</b><i>pas ouvert</i></span>
      <span class="${d.pct ? tonReussite(d.pct) : ''}"><b>${d.pct || '—'}${d.pct ? '<small>%</small>' : ''}</b><i>réussite</i></span>
      <span class="${e.tard ? 'ko' : ''}"><b>${esc(jourCourt(d.due))}</b><i>${esc(e.echeance)}</i></span></div>`;
}

/* Ce que la classe rate le plus : des comptes, jamais des noms. */
function bloqueHtml(ca) {
  if (!ca) return chargement();
  if (!ca.length) return `<p class="pf-note">Pas encore assez de réponses.</p>`;
  return `<div class="pf-list">${ca.slice(0, 12).map(x => `<div class="pf-li"><span class="pf-lit"><b>${esc(x.recto)} → ${esc(x.verso)}</b>
      <i>${x.ratees} erreurs sur ${x.vues} · ${plur(x.eleves, 'élève')}</i></span>
      <span class="pf-mb court"><i class="ko" style="width:${pc(x.ratees, x.vues)}%"></i></span></div>`).join('')}</div>`;
}

function devoirFeuille(w) {
  const d = devoirOuvert(); if (!d) return setMenu(null);
  const e = etatDevoir(d, iso(new Date()));
  const sous = `${plur(d.n, 'carte')}${d.matiere ? ' · ' + esc(d.matiere) : ''}${d.classe ? ' · ' + esc(d.classe) : ''} · ${
    d.mien ? 'à rendre ' + esc(echeance(d.due)) : 'donné par ' + esc(d.auteur || 'un collègue')}`;
  feuille(w, 'pf-tiroir', `<b>${esc(d.nom)}</b>`, sous,
    `${chiffresDevoir(d, e)}
    ${d.mien ? `<h3 class="pf-h3">À rendre le ${esc(jourLong(d.due))}</h3>${choixDate(d.due, 'echeance')}` : ''}
    <h3 class="pf-h3">Ce qui bloque</h3>${bloqueHtml(prof.cartes)}`,
    d.mien ? `<div class="pf-acts">${e.pasOuvert ? btn('relancer', I.mail2, `Relancer (${e.pasOuvert})`) : ''}
      ${btn('defi', I.flame, 'Défi')}${btn('redonner', I.copy, 'Redonner')}${btn('retirer-devoir', I.trash, '', 'ic warn', 'aria-label="Retirer ce devoir"')}</div>` : '');
}

/* ---------- donner un devoir ---------- */
export function listeLivres() {
  const q = (prof.f.cherche || '').toLowerCase();
  const l = live().filter(d => !q || d.name.toLowerCase().includes(q));
  return l.map(d => `<button class="pf-li" data-pf="livre" data-id="${esc(d.id)}">${svg(I.book)}
      <span class="pf-lit"><b>${esc(d.name)}</b><i>${plur(d.cards.length, 'carte')}</i></span>${svg(I.arrow)}</button>`).join('')
    || `<p class="pf-note">${q ? 'Aucun livre ne correspond.' : 'Votre bibliothèque est vide.'}</p>`;
}

function choixLivre(w) {
  feuille(w, 'large', '<b>Donner un devoir</b>', 'Quel livre ?', `
    <button class="pf-choix ligne" data-pf="livre-neuf">${svg(I.plus)}<b>Créer un nouveau livre</b>
      <span>Collez un cours, une liste, une photo de page…</span></button>
    <label class="pf-search">${svg(I.search)}<input data-pfin="f.cherche" value="${esc(prof.f.cherche || '')}" placeholder="Chercher un livre" aria-label="Chercher un livre"></label>
    <div class="pf-list" id="pflivres">${listeLivres()}</div>`, '');
}

function donnerDetails(w) {
  const k = prof.comp;
  const cl = (prof.classes || []).filter(c => !c.archivee);
  const n = (k.cartes || []).length, pret = k.nom.trim() && n && k.cibles.size && k.due;
  feuille(w, 'large', '<b>Donner un devoir</b>', `${plur(n, 'carte')}${k.riches ? ` · ${k.riches} avec image ou son` : ''}`, `
    <div class="pf-form deux">${champ('Titre', 'nom', 'data-pfcomp="nom" maxlength="120"', k.nom)}${champ('Matière', 'matiere', 'data-pfcomp="matiere" maxlength="60"', k.matiere)}</div>
    <h3 class="pf-h3">Classes <span>${k.cibles.size || ''}</span></h3>
    <div class="pf-cibles">${cl.map(c => `<button class="${k.cibles.has(c.id) ? 'on' : ''}" data-pf="cible" data-id="${esc(c.id)}" style="--k:${couleur(c.id)}">
      <i>${svg(I.check)}</i>${esc(c.name)}<em>${c.effectif}</em></button>`).join('') || '<p class="pf-note">Aucune classe active.</p>'}</div>
    <h3 class="pf-h3">À rendre ${k.due ? 'le ' + esc(jourLong(k.due)) : ''}</h3>${choixDate(k.due, 'due')}`,
    `<span class="pf-sf-t">${plur(n, 'carte')} · ${k.cibles.size ? plur(k.cibles.size, 'classe') : 'aucune classe'}${k.due ? ' · ' + esc(jourCourt(k.due)) : ''}</span>
     ${btn('donner-go', I.share, 'Donner', 'pri lg', pret ? '' : 'disabled')}`);
}

/* ---------- le menu « plus » d'une classe ---------- */
function actions(w) {
  const c = classeOuverte(); if (!c) return setMenu(null);
  const li = (act, ic, t, cls) => `<button class="mi ${cls || ''}" data-pf="${act}">${svg(ic)}<span>${t}</span></button>`;
  feuille(w, '', `<span class="pf-sh-av">${pastilleClasse(c)}<b>${esc(c.name)}</b></span>`, '', `
    ${li('tableau', I.grid, 'Projeter le code au tableau')}
    ${c.gere && (prof.roster || []).some(m => m.carte) ? li('cartes', I.key, 'Cartes de connexion') : ''}
    ${li('message', I.mail2, 'Écrire à la classe')}
    ${li('reglages', I.gear, 'Réglages de la classe')}
    ${c.createur ? li(c.archivee ? 'desarchiver' : 'archiver', c.archivee ? I.redo : I.clock, c.archivee ? 'Désarchiver' : 'Archiver') : ''}
    ${c.createur ? li('supprimer', I.trash, 'Supprimer la classe', 'warn') : ''}`, '');
}

function supprimer(w) {
  const c = classeOuverte(); if (!c) return setMenu(null);
  feuille(w, '', '<b>Supprimer la classe</b>', esc(c.name), `
    <p class="pf-alerte">${svg(I.warn)}${plur(c.effectif, 'élève')}, ${plur(c.devoirs, 'devoir')} et tout l’avancement seront effacés. Les comptes à carte restent, sans classe.</p>
    <label class="pf-fl">Pour confirmer, tapez « ${esc(c.name)} »<input id="pfconf" data-pfin="f.conf" autocomplete="off" spellcheck="false"></label>`,
    btn('supprimer-go', I.trash, 'Supprimer définitivement', 'warn lg', `id="pfsupp" ${
      (prof.f.conf || '').trim().toLowerCase() === c.name.trim().toLowerCase() ? '' : 'disabled'}`));
  focus('pfconf');
}

/* ---------- rejoindre l'équipe d'une classe ---------- */
function rejoindre(w) {
  const a = prof.f.apercu, r = prof.f.reponse ? messageStatut(prof.f.reponse) : null;
  feuille(w, '', '<b>Rejoindre une classe</b>', 'Avec le code collègue donné par son créateur', `
    <label class="pf-fl">Code collègue<input id="pfcode" class="pf-codein" data-pfin="f.code" value="${esc(prof.f.code || '')}"
      placeholder="XXXX-XXXX" maxlength="40" autocomplete="off" autocapitalize="characters" spellcheck="false"></label>
    ${a ? `<div class="pf-li pf-ap">${pastilleClasse({ id: a.class_id, name: a.nom })}<span class="pf-lit"><b>${esc(a.nom)}</b><i>${
      [a.niveau, a.prof, a.etab].filter(Boolean).map(esc).join(' · ')}</i></span></div>` : ''}
    ${r ? `<p class="pf-alerte">${svg(I.warn)}<span><b>${esc(r.titre)}</b>${r.texte ? ' ' + esc(r.texte) : ''}</span></p>` : ''}`,
    a ? btn('rejoindre-go', I.check, 'Rejoindre l’équipe', 'pri lg')
      : btn('rejoindre-voir', I.search, 'Vérifier le code', 'pri lg', `id="pfrv" ${codeComplet(prof.f.code) ? '' : 'disabled'}`));
  if (!a) focus('pfcode');
}

/* ---------- les cartes de connexion ---------- */
function cartes(w) {
  const c = classeOuverte(); if (!c) return setMenu(null);
  if (prof.faites) {
    feuille(w, 'large', '<b>Cartes de connexion</b>', esc(c.name), resultats(),
      btn('imprimer', I.file, 'Imprimer les cartes', 'pri lg') + btn('fermer', '', 'Terminé', 'lg'));
    return;
  }
  const l = (prof.roster || []).filter(m => m.carte), sel = prof.f.cartes || new Set(l.map(m => m.user_id));
  prof.f.cartes = sel;
  feuille(w, 'large', '<b>Cartes de connexion</b>', esc(c.name), `
    <p class="pf-note">${svg(I.lock)}Les codes ne sont jamais conservés en clair : imprimer, c’est donner un nouveau code. L’ancienne carte cesse de marcher, et l’élève est déconnecté de ses appareils.</p>
    <div class="pf-list">${l.map(m => `<button class="pf-li" data-pf="carte-coche" data-id="${esc(m.user_id)}">
      <span class="pf-cb" role="checkbox" aria-checked="${sel.has(m.user_id)}"><i>${svg(I.check)}</i></span>
      ${avatar(m.user_id, m.who)}<span class="pf-lit"><b>${esc(m.who)}</b><i>${esc(m.identifiant)}${m.jamais ? ' · jamais connecté' : ''}</i></span></button>`).join('')}</div>`,
    btn('cartes-go', I.key, `Nouvelles cartes (${sel.size})`, 'pri lg', sel.size ? '' : 'disabled'));
}

/* L'impression : huit cartes par page A4, découpables. */
export function imprimerCartes(l, c) {
  const vieux = document.getElementById('impression');
  if (vieux) vieux.remove();
  const n = document.createElement('div');
  n.id = 'impression';
  n.innerHTML = l.filter(x => x.code).map(x => `<div class="pf-carte">
    <div class="pf-carte-t"><b>${esc(x.nom)}</b><i>${esc(c ? c.name : '')}</i></div>
    <div class="pf-carte-q">${qrSvg(lienCarte(baseApp(), x.identifiant, x.code), 'Carte de ' + x.nom)}</div>
    <dl><dt>Identifiant</dt><dd>${esc(x.identifiant)}</dd><dt>Code</dt><dd class="code">${esc(formatCode(x.code))}</dd></dl>
    <p>Folio → « Élève » → identifiant et code, ou visez le QR code avec l’appareil photo.</p></div>`).join('');
  document.body.appendChild(n);
  const fin = () => { n.remove(); window.removeEventListener('afterprint', fin); };
  window.addEventListener('afterprint', fin);
  window.print();
}

const FEUILLES = {
  creer, inviter, tableau, eleve: eleveFiche, retirer, nommer, message, devoir: devoirFeuille,
  donner: w => (prof.comp && prof.comp.cartes ? donnerDetails(w) : choixLivre(w)),
  actions, supprimer, cartes, rejoindre
};

export function paintMenuProf(w) {
  const f = FEUILLES[prof.feuille];
  if (!f) { setMenu(null); return; }
  f(w);
}
