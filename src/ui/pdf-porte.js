// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { I, svg } from '../icones.js';
import { view } from '../data/etat.js';
import { deck, esc } from '../core/coeur-sync.js';
import { closeMenu, mountMenu, openMenu, paintMenu } from './menus-a.js';
import { toast } from './import-cartes.js';

/* ══════════ le PDF d'un livre : la porte (2026-11-02) ══════════
   Dans le menu « … » d'un livre : « PDF du livre » ouvre cette feuille —
   recto et verso, ou le verso à compléter —, puis le PDF part (le partage
   au téléphone : Imprimer, Enregistrer dans Fichiers ; un onglet sur
   ordinateur, où l'on imprime). Le travail est dans ui/livre-pdf.js et ses
   règles dans src/pdf-livre.js, chargés à la demande (préfixe `pdf-` dans
   le budget) : rien d'autre ne doit importer ui/livre-pdf.js. */

let charge = null;
const charger = () => charge || (charge = import('./livre-pdf.js'));
let pret = null;          // le PDF fait, quand le navigateur a refusé de le partager sans un nouveau geste
let enCours = '';

export function paintMenuPdf(w) {
  const d = deck(view.id);
  if (!d) return;
  charger().catch(() => { /* hors ligne au premier passage : le geste le redira */ });
  const n = d.cards.length;
  const ligne = (k, ic, t) => `<button class="mi" data-mact="pdf-${k}" ${enCours ? 'disabled' : ''}>${svg(ic)}${t}
      ${enCours === k ? '<span class="tail"><i class="spin"></i></span>' : ''}</button>`;
  w.innerHTML = `<div class="scrim" data-mact="close"></div>
    <div class="menu">
      <div class="mhd">${svg(I.file)}<span class="mhx"><b>${esc(d.name)}</b><i>${n} carte${n > 1 ? 's' : ''}</i></span></div>
      ${pret ? `<button class="mi" data-mact="pdf-ouvrir">${svg(I.share)}Ouvrir le PDF</button>`
        : ligne('tout', I.rows, 'Recto et verso') + ligne('vide', I.pen, 'Verso à compléter')}
    </div>`;
  mountMenu(w);
}

export async function clickPdf(a, b, d) {
  if (a === 'pdfopen') { pret = null; return openMenu('pdf'); }
  if (a === 'pdf-ouvrir' && pret) {
    const m = await charger();
    await m.livrer(pret);
    pret = null;
    return closeMenu();
  }
  if (!d || enCours) return;
  enCours = a === 'pdf-vide' ? 'vide' : 'tout';
  paintMenu();
  try {
    const m = await charger();
    const fichier = await m.fichierPdf(d, { versoVide: enCours === 'vide' });
    enCours = '';
    /* Le partage et l'ouverture d'un onglet demandent un geste récent : un
       livre plein d'images a pu le laisser passer. Alors, un bouton. */
    if (await m.livrer(fichier)) return closeMenu();
    pret = fichier;
    paintMenu();
  } catch (e) {
    enCours = '';
    paintMenu();
    console.warn('pdf', e);
    toast(I.x, 'Le PDF n’a pas pu se faire');
  }
}
