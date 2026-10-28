/* ══════════ le prix d'une licence d'établissement (2026-10-28) ══════════
   Module pur, sans dépendance, testé (test/tarifs.test.js) : la page
   d'accueil (son calculateur, src/site/site.js), la console de l'éditeur
   (le prix proposé en passant un établissement en licence) et la démo s'en
   servent. Le prix d'une offre B2C (Mirandola+) est dans src/abonnement.js.

   Une place par élève ET par professeur (le référent n'en prend pas). Le
   prix est dégressif PAR TRANCHES, comme l'impôt : chaque place est payée
   au prix de sa tranche, jamais toutes au prix de la dernière — ajouter
   une place ne fait jamais baisser la facture, et il n'y a pas de seuil où
   l'on aurait intérêt à prendre plus de places qu'on n'en a besoin.

   Un minimum couvre les petits groupes : un professeur particulier et ses
   quinze élèves, un petit centre de soutien. */

// en centimes HT, par place et par an ; `jusqua` : la dernière place de la tranche
export const TRANCHES = [
  { jusqua: 100, prix: 500 },
  { jusqua: 500, prix: 350 },
  { jusqua: 1500, prix: 250 },
  { jusqua: Infinity, prix: 200 }
];
export const MINIMUM = 10000;                         // 100 € HT par an
export const PLACES_DU_MINIMUM = Math.floor(MINIMUM / TRANCHES[0].prix);   // 20 places

const entier = n => Math.max(0, Math.floor(+n || 0));

/* Ce que coûtent `places` places, tranche par tranche : [{ places, prix, total }]. */
export function detailCampus(places) {
  let reste = entier(places), debut = 0;
  const l = [];
  for (const t of TRANCHES) {
    if (!reste) break;
    const ici = Math.min(reste, t.jusqua - debut);
    l.push({ places: ici, prix: t.prix, total: ici * t.prix });
    reste -= ici; debut = t.jusqua;
  }
  return l;
}

/* Le prix annuel HT, en centimes, minimum compris. 0 place : rien. */
export function prixCampus(places) {
  if (!entier(places)) return 0;
  return Math.max(MINIMUM, detailCampus(places).reduce((s, t) => s + t.total, 0));
}

/* Le prix moyen d'une place, en centimes (arrondi). */
export const parPlace = places => (entier(places) ? Math.round(prixCampus(places) / entier(places)) : 0);

/* « 1 234,50 € » : séparateur de milliers et virgule à la française,
   espaces insécables (un prix ne se coupe jamais en fin de ligne). */
export function eurosHT(c, decimales = true) {
  const [e, d] = (Math.round(c) / 100).toFixed(2).split('.');
  const milliers = e.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return (decimales && d !== '00' ? `${milliers},${d}` : milliers) + ' €';
}
