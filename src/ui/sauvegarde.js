// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import './sauvegarde.css';
import { I, svg } from '../icones.js';
import { db } from '../data/etat.js';
import { plur } from '../core/coeur-sync.js';
import { exporter, lire, plan, restaurer } from '../core/sauvegarde.js';
import { LIVRES_GRATUITS } from '../offres.js';
import { envie, place } from './bridage.js';
import { toast } from './import-cartes.js';
import { closeMenu, mountMenu, paintMenu } from './menus-a.js';

/* ══════════ la feuille de la sauvegarde (2026-11-18) ══════════
   Exporter tout (le fichier complet, état d'apprentissage compris : la
   portabilité est un droit, jamais bridée), restaurer un fichier. Le lien
   « recto et verso seulement » est parti : le code d'un paquet fait mieux.

   Demandé : « évite les douilles d'abonnement en exportant les données et
   en les réintégrant gratuitement ; si on importe plus de paquets que la
   limite de notre abonnement, un message ». Avant d'écrire quoi que ce
   soit, le plan (src/sauvegarde.js) dit ce qui tient : tout tient, on
   restaure ; sinon la feuille le montre — la sauvegarde, la place, ce qui
   peut entrer — et l'élève choisit : ces paquets-là, ou Mirandola+. Jamais
   un paquet au-delà, jamais en silence. Le fichier est lu comme s'il venait
   de n'importe qui (bornes, médias, faux devoirs : src/sauvegarde.js). */
const LOURD = 40e6;            // bien au-delà d'une vraie bibliothèque ; au-delà, un fichier qui ferait tomber l'app
let etat = { etape: 'menu' };

export function preparer() { etat = { etape: 'menu' }; }

export function peindre(w) {
  w.innerHTML = `<div class="scrim" data-mact="close"></div>
    <div class="menu sv" data-etape="${etat.etape}">${etat.etape === 'trop' ? trop() : accueil()}</div>`;
  mountMenu(w);
}

function accueil() {
  const n = db.decks.length, c = db.decks.reduce((a, x) => a + x.cards.length, 0);
  return `<div class="mhd">${svg(I.cloud)}<span class="mhx"><b>Sauvegarde</b><i>${plur(c, 'carte')} dans ${plur(n, 'paquet')}</i></span></div>
    <button class="mi" data-sv="exporter">${svg(I.down)}Exporter tous mes paquets</button>
    <button class="mi" data-sv="restaurer">${svg(I.redo)}Restaurer depuis un fichier</button>`;
}

/* Les places de Mirandola gratuit, dessinées : celles qui sont prises,
   celles que la sauvegarde remplira, et ce qui reste dehors. */
function trop() {
  const { p, data } = etat, entrent = p.garder.length, total = data.decks.length;
  const pris = Math.max(0, LIVRES_GRATUITS - p.place);
  const cases = Array.from({ length: LIVRES_GRATUITS }, (_, i) =>
    `<i class="sv-p${i < pris ? ' pris' : i < pris + entrent ? ' entre' : ''}"></i>`).join('');
  return `<div class="sv-trop">
      <div class="sv-ic">${svg(I.layers)}</div>
      <h2>Ta sauvegarde a ${plur(total, 'paquet')}</h2>
      <div class="sv-places" role="img" aria-label="${pris} pris, ${entrent} qui entrent, ${p.refuses.length} dehors">${cases}
        <b class="sv-dehors">+${p.refuses.length}</b></div>
      <p>${entrent ? `Mirandola gratuit en garde ${LIVRES_GRATUITS} : <b>${plur(entrent, 'paquet')}</b> ${entrent > 1 ? 'peuvent' : 'peut'} entrer.`
        : `Mirandola gratuit en garde ${LIVRES_GRATUITS} : ta bibliothèque est pleine.`}</p>
    </div>
    <button class="cta sv-tout" data-sv="plus">${svg(I.star)}Tout garder avec Mirandola+</button>
    ${entrent ? `<button class="cta ghost" data-sv="partiel">Restaurer ${entrent > 1 ? 'les ' + entrent + ' premiers' : 'le premier'}</button>` : ''}`;
}

function fini(r) {
  closeMenu();
  const n = r.decks.length;
  toast(I.check, plur(n, 'paquet') + ' restauré' + (n > 1 ? 's' : ''), true);
}

function exporterTout() {
  closeMenu();
  const blob = new Blob([JSON.stringify(exporter())], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'mirandola-bibliotheque-' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast(I.check, 'Paquets exportés');
}

function choisirFichier() {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'application/json,.json';
  inp.onchange = async () => {
    const f = inp.files && inp.files[0]; if (!f) return;
    if (f.size > LOURD) return toast(I.x, 'Fichier trop lourd pour une sauvegarde');
    let txt;
    try { txt = await f.text(); } catch (e) { return toast(I.x, 'Fichier illisible'); }
    const r = lire(txt);
    if (!r.ok) return toast(I.x, r.error);
    const libre = place(), p = plan(r.data, libre);
    if (!p.refuses.length) return fini(restaurer(r.data, libre));
    etat = { etape: 'trop', data: r.data, p };
    paintMenu();
  };
  inp.click();
}

const GESTES = {
  exporter: exporterTout,
  restaurer: choisirFichier,
  partiel: () => fini(restaurer(etat.data, place())),     // la place relue : rien n'a pu entrer entre-temps sans qu'on le compte
  plus: () => envie('livres')
};

document.addEventListener('click', ev => {
  const b = ev.target.closest('[data-sv]');
  if (b && GESTES[b.dataset.sv]) GESTES[b.dataset.sv]();
});
