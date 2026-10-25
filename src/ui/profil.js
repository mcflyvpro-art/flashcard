// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { $ } from '../racine.js';
import { I, svg } from '../icones.js';
import { cercle, friends, view } from '../data/etat.js';
import { esc, plur } from '../core/coeur-sync.js';
import { askFriend } from '../core/reglages-corbeille.js';
import { exclureMembre } from '../core/cercle.js';
import { blockUser } from '../core/classement.js';
import { go } from './bibliotheque.js';
import { isPupil, openReport } from './classement.js';
import { avatar, blasonClub } from './jeton.js';
import { ident } from './cercle.js';
import './profil.css';

/* ══════════ le profil d'un lecteur (2026-10-25) ══════════
   Chargé à la demande par ui/cercle.js (`profilView`, `ouvrirProfil`), avec
   sa feuille de style (préfixe lp-). Ce que la base rend (profil_lecteur,
   migration 20261025200000) décide de ce qu'on montre : son visage et son
   nom à qui le voit déjà, ses chiffres à soi-même, à un ami ou à un membre
   d'un même club. Des chiffres et des icônes, presque pas de phrases. */

const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const depuis = j => { const [a, m] = String(j || '').split('-'); return a && m ? `${MOIS[+m - 1]} ${a}` : ''; };
const nb = n => (+n || 0).toLocaleString('fr-FR');

function tete(id, p) {
  const ami = (friends || []).some(f => f.id === id && f.status === 'ok') || p.ami;
  return `<section class="lp-tete">
      ${avatar(id, ident(p.pseudo, p.nom), 'xl')}
      <h1>${esc(p.nom)}</h1>
      <div class="lp-sous">${p.pseudo ? `<span>@${esc(p.pseudo)}</span>` : ''}
        ${p.depuis ? `<span title="Lit sur Folio depuis">${svg(I.cal)}${depuis(p.depuis)}</span>` : ''}
        ${ami && !p.moi ? `<span class="lp-ami">${svg(I.check)}Ami</span>` : ''}</div>
      ${(p.clubs || []).length ? `<div class="lp-clubs">${p.clubs.map(g =>
        `<span class="lp-club">${blasonClub(g, 'xs')}${esc(g.nom)}</span>`).join('')}</div>` : ''}
    </section>`;
}

function tuile(ic, chiffre, legende, sous) {
  return `<div class="lp-tuile">${svg(I[ic])}<b>${chiffre}</b><span>${legende}</span>${sous ? `<i>${sous}</i>` : ''}</div>`;
}

/* Les 35 derniers jours, comme une page de calendrier (une ligne par
   semaine, lundi à gauche) : plus c'est foncé, plus il a lu ce jour-là. */
function calendrier(jours) {
  const l = jours || [], max = Math.max(1, ...l);
  const debut = new Date(); debut.setDate(debut.getDate() - (l.length - 1));
  const vides = (debut.getDay() + 6) % 7;
  const cases = [...Array(vides).fill(null), ...l];
  return `<div class="lp-cal" role="img" aria-label="Pages lues ces cinq dernières semaines">${'LMMJVSD'.split('').map(j => `<b>${j}</b>`).join('')}${cases.map(n => n == null
    ? '<i class="vide"></i>'
    : `<i class="n${n ? Math.min(4, Math.ceil(n / max * 4)) : 0}" title="${plur(n, 'page')}"></i>`).join('')}</div>`;
}

function matieres(l) {
  if (!(l || []).length) return '';
  const max = Math.max(...l.map(m => m.n));
  return `<div class="lp-mats">${l.map(m => `<div class="lp-mat"><span>${esc(m.nom)}</span>
      <em><i style="width:${Math.round(m.n / max * 100)}%"></i></em><b>${nb(m.n)}</b></div>`).join('')}</div>`;
}

function chiffres(p) {
  const faits = [
    p.heure != null ? [I.clock, `vers ${p.heure} h`, 'Heure de lecture préférée'] : null,
    p.livres ? [I.book, plur(p.livres, 'livre'), 'Livres lus ces 30 jours'] : null,
    [I.layers, nb(p.toujours) + ' pages', 'Depuis toujours']
  ].filter(Boolean);
  return `<section class="lp-chiffres">
      <div class="lp-tuiles">
        ${tuile('flame', p.serie ? p.serie + ' j' : '0', 'Série', p.record > p.serie ? 'record ' + p.record + ' j' : '')}
        ${tuile('book', nb(p.semaine), '7 jours')}
        ${tuile('chart', nb(p.mois), '30 jours')}
        ${tuile('check', p.justes != null ? p.justes + ' %' : '—', 'Justes')}
      </div>
      <div class="lp-duo">
        <div class="lp-carte"><h2>${svg(I.cal)}5 semaines</h2>${calendrier(p.jours)}</div>
        ${(p.matieres || []).length ? `<div class="lp-carte"><h2>${svg(I.tag)}Matières</h2>${matieres(p.matieres)}</div>` : ''}
      </div>
      <div class="lp-faits">${faits.map(([ic, t, q]) => `<span title="${q}">${svg(ic)}${t}</span>`).join('')}</div>
    </section>`;
}

function prive(id, p) {
  const peutAjouter = p.pseudo && !isPupil();
  return `<section class="lp-prive">${svg(I.lock)}<b>Journal réservé à ses amis</b>
      ${peutAjouter ? `<button class="cta" data-lp="ami">${svg(I.plus)}Ajouter en ami</button>` : ''}</section>`;
}

function gestes(id, p) {
  if (p.moi) return `<div class="lp-gestes"><button class="mi" data-cc="moi">${svg(I.pen)}Mon jeton et mon pseudo</button></div>`;
  const ami = (friends || []).some(f => f.id === id && f.status === 'ok');
  const club = cercle.profilClub && (cercle.clubs || []).find(g => g.id === cercle.profilClub);
  return `<div class="lp-gestes">
      ${ami ? `<button class="mi" data-mact="matedefi">${svg(I.bolt)}Défier</button>
        <button class="mi" data-mact="matesend">${svg(I.share)}Lui prêter un livre</button>` : ''}
      ${!ami && p.statut === 'ok' && p.pseudo && !isPupil() ? `<button class="mi" data-lp="ami">${svg(I.plus)}Ajouter en ami</button>` : ''}
      ${club && club.chef ? `<button class="mi warn" data-lp="retirer">${svg(I.x)}<span>Retirer du club</span></button>` : ''}
      ${ami ? `<button class="mi warn" data-mact="matedrop">${svg(I.x)}<span>Retirer de mes amis</span></button>` : ''}
      <div class="msep"></div>
      <button class="mi" data-lp="signaler">${svg(I.warn)}<span>Signaler</span></button>
      <button class="mi warn" data-lp="bloquer">${svg(I.lock)}<span>Bloquer</span></button>
    </div>`;
}

export function profilEcran() {
  const id = view.id, p = cercle.profils[id];
  const barre = `<div class="bar"><button class="ic" data-lp="retour" aria-label="Retour">${svg(I.back)}</button><div style="flex:1"></div></div>`;
  if (!p) { $.innerHTML = barre + '<div class="page lp"><div class="cc-load"></div></div>'; return; }
  if (p.statut !== 'ok' && p.statut !== 'prive') {
    $.innerHTML = barre + `<div class="page lp"><div class="empty">${svg(I.user)}<p>${p.statut === 'erreur'
      ? 'Profil indisponible hors ligne' : 'Ce profil n’est pas visible'}</p></div></div>`;
    return;
  }
  $.innerHTML = `${barre}
    <div class="page lp">
      <div class="lp-grille">
        <div class="lp-gauche">${tete(id, p)}${gestes(id, p)}</div>
        <div class="lp-droite">${p.statut === 'ok' ? chiffres(p) : prive(id, p)}</div>
      </div>
    </div>`;
}

/* ---------- les gestes propres au profil ---------- */
const GESTES = {
  retour: () => { const r = cercle.profilRetour || { name: 'commu' }; go(r.name, r.id); },
  ami: async () => {
    const p = cercle.profils[view.id];
    if (p && p.pseudo && await askFriend(p.pseudo)) { const b = document.querySelector('[data-lp="ami"]'); if (b) b.disabled = true; }
  },
  retirer: b => {
    if (b.dataset.arme !== '1') { b.dataset.arme = '1'; b.querySelector('span').textContent = 'Confirmer : retirer'; return; }
    exclureMembre(cercle.profilClub, view.id);
    GESTES.retour();
  },
  signaler: () => {
    const p = cercle.profils[view.id] || {};
    openReport('profile', view.id, view.id, p.nom || ('@' + (p.pseudo || '')), { pseudo: p.pseudo, nom: p.nom });
  },
  bloquer: () => { const p = cercle.profils[view.id] || {}; blockUser(view.id, p.nom || p.pseudo); GESTES.retour(); }
};

document.addEventListener('click', e => {
  const b = e.target.closest('[data-lp]'); if (!b || view.name !== 'profil') return;
  const f = GESTES[b.dataset.lp]; if (f) f(b);
});
