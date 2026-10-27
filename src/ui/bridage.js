// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { db, demoEtab, offre } from '../data/etat.js';
import { deDevoir } from '../file.js';
import { JOURNAL_PLUS, LIVRES_GRATUITS, MOTEUR, permis } from '../offres.js';
import { ouvrirPlus } from './plus-porte.js';
import { ouvrirEnvie } from './demo-porte.js';

/* ══════════ ce que Folio gratuit n'ouvre pas (2026-10-27) ══════════
   Les règles sont dans src/offres.js ; ici, seulement leur application à
   l'écran — pour un vrai compte gratuit comme pour la démo d'un élève, qui
   essaie Folio gratuit. Ce qui est dans Folio+ porte un « + » (app.css,
   html.offre-gratuit), se grise, et son geste ouvre ce que ferait la
   fonction : l'écran Folio+ (vrai compte), la fenêtre de la démo sinon.

   Ce qui coûte de l'argent est aussi tenu par la base (migration
   20261027210000 : les médias ; la fonction ai : l'IA). Les livres, les QCM
   et le journal sont des règles d'écran.

   Une offre INCONNUE ne bride rien : pas encore lue, une base qui n'a pas
   la fonction, hors ligne sans copie — on ne retire jamais à quelqu'un ce
   qu'il a peut-être payé. Les comptes d'avant le 2026-10-27 ont Folio+
   offert : seuls les comptes neufs commencent en gratuit. */

/* L'offre qui bride : la démo d'un élève essaie Folio gratuit, un
   professeur ou un référent de la démo est dans son lycée (Campus). */
export function offreActive() {
  if (demoEtab) return document.documentElement.classList.contains('en-demo-libre') ? 'gratuit' : 'campus';
  return offre ? offre.offre : null;
}

export const bride = fonction => offreActive() === 'gratuit' && !permis('gratuit', fonction);
export const moteurLite = () => MOTEUR[offreActive()] === 'lite';

// Folio+ se voit (app.css, html.offre-plus) : un abonnement, offert ou payé — pas Campus, qui ne s'achète pas
export const aFolioPlus = () => !demoEtab && !!offre && offre.offre === 'plus';

const mesLivres = () => ((db && db.decks) || []).filter(d => !d.deleted_at && !deDevoir(d.cards || [])).length;
export const plein = () => offreActive() === 'gratuit' && mesLivres() >= LIVRES_GRATUITS;

// le geste bridé : ce que ferait la fonction, et comment l'avoir
export function envie(cle) {
  if (demoEtab) return ouvrirEnvie(cle);
  ouvrirPlus({ raison: cle });
}

/* Ce qui est dans Folio+ et se touche ailleurs que sur un onglet de la
   création (qui se grise lui-même, ui/creation.js). */
const SEUL = {
  exercices: '[data-act="mcq"],[data-act="match"],[data-mact="mcq"],[data-mact="match"]',
  media: '[data-mact^="med-"]'
};

// écouté avant le gestionnaire de l'app : le geste ouvre Folio+ au lieu de la fonction
document.addEventListener('click', ev => {
  if (offreActive() !== 'gratuit') return;
  const cle = ev.target.closest('[data-act="new"]') && plein() ? 'livres'
    : ev.target.closest('.plus-floute') ? 'journal' : Object.keys(SEUL).find(k => ev.target.closest(SEUL[k]));
  if (!cle) return;
  ev.stopPropagation(); ev.preventDefault();
  envie(cle);
}, true);

/* Les marques de la racine, recalculées à chaque changement de l'écran
   (une fois par image) : gratuit, bibliothèque pleine, Folio+ ; et les
   volets du journal réservés (data-volet de ui/journal-ecran.js), floutés
   sous leur titre. */
let image = 0;
function marquer() {
  image = 0;
  const html = document.documentElement, gratuit = offreActive() === 'gratuit';
  html.classList.toggle('offre-gratuit', gratuit);
  html.classList.toggle('livres-plein', gratuit && plein());
  html.classList.toggle('offre-plus', aFolioPlus());
  for (const v of document.querySelectorAll('[data-volet]')) v.classList.toggle('plus-floute', gratuit && JOURNAL_PLUS.includes(v.dataset.volet));
}
export const remarquer = () => { if (!image) image = requestAnimationFrame(marquer); };
new MutationObserver(remarquer).observe(document.body, { childList: true, subtree: true });
