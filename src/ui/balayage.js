// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
/* ══════════ la porte du balayage entre onglets ══════════
   Le geste lui-même (ui/balayage-geste.js) est un morceau à part, chargé à
   la première page à onglets, au téléphone seulement (sur ordinateur, rien
   ne glisse) : le démarrage n'en paie rien. Chaque page à onglets appelle
   bindPager() une fois rendue ; tant que le morceau arrive, elle le demande,
   et il se branche dès qu'il est là. Rien d'autre ne doit importer
   ui/balayage-geste.js. */
const LARGE = matchMedia('(min-width: 900px)');
let morceau = null, demande = null;

export function bindPager() {
  if (morceau) return morceau.lier();
  if (demande || LARGE.matches) return;
  demande = import('./balayage-geste.js')
    .then(m => { morceau = m; m.lier(); })
    .catch(() => { demande = null; });             // une panne : la page reste où elle est, la barre du bas suffit
}
