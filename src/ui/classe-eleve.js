// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { $ } from '../racine.js';
import { I, svg } from '../icones.js';
import { duels, eleve, view } from '../data/etat.js';
import { esc, plur } from '../core/coeur-sync.js';
import { eleveClassesPull, messageErreur, quitterClasse } from '../core/eleve-classes.js';
import { iso, jourCourt } from '../classe.js';
import { go } from './bibliotheque.js';
import { defiLigne, ident, parDefi } from './cercle.js';
import { devoirLigne } from './eleve-classes.js';
import { toast } from './import-cartes.js';
import { avatar, blason } from './jeton.js';
import './classe-eleve.css';

/* ══════════ la page d'une classe, côté élève (2026-10-25) ══════════
   Chargée à la demande par ui/eleve-classes.js (`ouvrirClasse`,
   `classeEleveView`), avec sa feuille de style (préfixe ec-). La classe telle
   que la base la décrit à un de ses élèves (eleve_classe, migration
   20261025210000) : son nom, son établissement, ses professeurs, ses
   élèves ; et, depuis ce que l'app a déjà lu, ses devoirs et ses défis.
   Toucher un camarade ouvre son profil (data-lecteur, ui/cercle.js). */

function tete(c, f) {
  const matieres = [...new Set((f.profs || []).map(p => p.matiere).filter(Boolean))];
  const n = (f.eleves || []).length;
  return `<section class="ec-tete">${blason(c, 'xl')}
      <div class="ec-titre"><h1>${esc(f.nom)}</h1>
        <span>${[f.niveau, f.etab || 'Hors établissement'].filter(Boolean).map(esc).join(' · ')}</span></div>
      <div class="ec-puces">
        <span>${svg(I.users)}${plur(n, 'élève')}</span>
        ${matieres.map(m => `<span>${svg(I.book)}${esc(m)}</span>`).join('')}
        ${f.depuis ? `<span title="Inscrit le">${svg(I.clock)}${esc(jourCourt(String(f.depuis).slice(0, 10)))}</span>` : ''}
      </div>
    </section>`;
}

function devoirs(c) {
  const l = (eleve.devoirs || []).filter(d => d.class_id === c), auj = iso(new Date());
  const afaire = l.filter(d => d.etat !== 'rendu'), rendus = l.filter(d => d.etat === 'rendu');
  const defis = parDefi((duels.list || []).filter(d => d.class_id === c));
  return `<section class="ec-sec"><h2 class="el-h2">À faire <span>${afaire.length || ''}</span></h2>
      ${afaire.length ? `<div class="el-list">${afaire.map(d => devoirLigne(d, auj)).join('')}</div>`
        : `<p class="el-vide">${svg(I.check)}Tout est rendu.</p>`}
      ${rendus.length ? `<details class="ec-rendus"><summary>${svg(I.check)}${plur(rendus.length, 'devoir')} rendu${rendus.length > 1 ? 's' : ''}</summary>
        <div class="el-list">${rendus.map(d => devoirLigne(d, auj)).join('')}</div></details>` : ''}
      ${defis.length ? `<h2 class="el-h2">Défis</h2><div class="cc-list">${defis.map(d => defiLigne(d, false)).join('')}</div>` : ''}
    </section>`;
}

function profs(f) {
  const l = f.profs || [];
  if (!l.length) return '';
  return `<section class="ec-sec"><h2 class="el-h2">${l.length > 1 ? 'Professeurs' : 'Professeur'}</h2>
      <div class="ec-liste">${l.map(p => `<div class="ec-pers">${avatar(p.id, p.nom)}
        <span class="ec-pers-t"><b>${esc(p.nom)}</b>${p.matiere ? `<i>${esc(p.matiere)}</i>` : ''}</span>
        ${p.principal ? `<em class="ec-tag" title="Professeur principal">${svg(I.star)}</em>` : ''}</div>`).join('')}</div>
    </section>`;
}

function eleves(f) {
  const l = f.eleves || [];
  return `<section class="ec-sec"><h2 class="el-h2">Élèves <span>${l.length}</span></h2>
      <div class="ec-eleves">${l.map(e => e.moi
        ? `<div class="ec-el moi">${avatar(e.id, ident(e.pseudo, e.nom), 'lg')}<b>${esc(e.nom)}</b><em>toi</em></div>`
        : `<button class="ec-el" data-lecteur="${esc(e.id)}">${avatar(e.id, ident(e.pseudo, e.nom), 'lg')}<b>${esc(e.nom)}</b>
            ${e.ami === 'ok' ? `<em class="ami">${svg(I.check)}ami</em>` : ''}</button>`).join('')}</div>
    </section>`;
}

function pied(c, f) {
  return f.peut_quitter
    ? `<button class="ec-quitter" data-ec="quitter">${svg(I.exit)}<span>Quitter la classe</span></button>`
    : `<p class="ec-note">${svg(I.lock)}Inscrit par ton établissement</p>`;
}

export function classeEcran() {
  const c = view.id, f = eleve.fiches[c];
  const barre = `<div class="bar"><button class="ic" data-ec="retour" aria-label="Retour">${svg(I.back)}</button><div style="flex:1"></div></div>`;
  if (!f) { $.innerHTML = barre + '<div class="page el-page"><div class="el-carte el-load"></div></div>'; return; }
  if (f.statut !== 'inscrit') {
    $.innerHTML = barre + `<div class="page el-page"><div class="empty">${svg(I.school)}<p>${f.statut === 'attente'
      ? 'En attente de ton professeur' : f.statut === 'erreur' ? 'Classe indisponible hors ligne' : 'Tu n’es plus dans cette classe'}</p></div></div>`;
    return;
  }
  $.innerHTML = `${barre}
    <div class="page el-page ec">
      <div class="ec-grille">
        <div>${tete(c, f)}${devoirs(c)}</div>
        <div>${profs(f)}${eleves(f)}${pied(c, f)}</div>
      </div>
    </div>`;
}

const GESTES = {
  retour: () => go('classes'),
  quitter: async b => {
    if (b.dataset.arme !== '1') { b.dataset.arme = '1'; b.querySelector('span').textContent = 'Confirmer : quitter'; return; }
    try { await quitterClasse(view.id); toast(I.check, 'Classe quittée'); go('classes'); }
    catch (e) { toast(I.x, messageErreur(e).slice(0, 120) || 'Impossible pour l’instant'); }
    eleveClassesPull();
  }
};

document.addEventListener('click', e => {
  const b = e.target.closest('[data-ec]'); if (!b || view.name !== 'classe') return;
  const f = GESTES[b.dataset.ec]; if (f) f(b);
});
