/* ══════════ les produits des magasins (2026-11-16) ══════════
   Module pur, sans dépendance, testé (test/natif.test.js) : ce que l'app
   des magasins vend, lu dans l'offre courante de RevenueCat — le paquet
   d'une formule, son prix tel que le magasin le dit, l'essai qu'il porte.
   Chargé avec l'écran Mirandola+ (core/vente.js, ui/plus.js). */

/* Une formule de l'app (« annuel », « mensuel », « infini_annuel »,
   « infini_mensuel ») est un paquet de l'offre courante de RevenueCat.
   Mirandola+ : les paquets standard ($rc_annual, $rc_monthly) ou ceux qui
   portent son nom ; Infini : un paquet dont l'identifiant ou le produit dit
   « infini » et sa période. Jamais un produit Infini pour Mirandola+, ni
   l'inverse : c'est ce que la fonction magasins relit pour écrire le
   niveau (formuleDuProduit de supabase/functions/_shared/abonnement.js). */
const PERIODE = { annuel: /annu|year|p1y/i, mensuel: /mens|month|p1m/i };
const idsDe = p => [p && p.identifier, p && p.product && p.product.identifier].filter(Boolean).join(' ');

export function paquetDe(offre, formule) {
  if (!offre || !Array.isArray(offre.availablePackages)) return null;
  const infini = /^infini_/.test(formule), periode = formule.replace(/^infini_/, '');
  if (!PERIODE[periode]) return null;
  const candidats = offre.availablePackages.filter(p => /infini/i.test(idsDe(p)) === infini);
  const juste = candidats.find(p => PERIODE[periode].test(idsDe(p)));
  if (juste) return juste;
  if (infini) return null;
  // Mirandola+ dans une offre aux paquets standard, sans nom de formule
  const standard = periode === 'annuel' ? offre.annual : offre.monthly;
  return standard && !/infini/i.test(idsDe(standard)) ? standard : null;
}

/* Le prix d'un paquet tel que le magasin le dit (sa devise, son format) et
   l'essai gratuit qu'il porte, s'il en porte un : l'écran Mirandola+ montre
   CE prix-là dans l'app des magasins — celui que la feuille d'Apple ou de
   Google demandera —, jamais celui du site. */
export function prixDuPaquet(p) {
  const pr = p && p.product;
  if (!pr || typeof pr.priceString !== 'string' || !pr.priceString) return null;
  const intro = pr.introPrice;
  const essai = intro && Number(intro.price) === 0 && intro.periodNumberOfUnits > 0
    ? { n: intro.periodNumberOfUnits * (intro.cycles || 1), unite: String(intro.periodUnit || 'DAY').toUpperCase() } : null;
  const parMois = typeof pr.pricePerMonthString === 'string' && pr.pricePerMonthString ? pr.pricePerMonthString : null;
  return { prix: pr.priceString, parMois, essai };
}

const UNITES = { DAY: ['jour', 'jours'], WEEK: ['semaine', 'semaines'], MONTH: ['mois', 'mois'], YEAR: ['an', 'ans'] };
// « 7 jours », « 1 mois » : la durée d'un essai du magasin, telle qu'on la lit
export function dureeEssai(e) {
  if (!e || !(e.n > 0)) return '';
  const [un, plusieurs] = UNITES[e.unite] || UNITES.DAY;
  return `${e.n}\u00a0${e.n > 1 ? plusieurs : un}`;
}

/* Tout ce que l'écran a besoin de savoir de l'offre courante, par formule
   (null pour une formule que le magasin ne vend pas encore). */
export function prixDuMagasin(offre) {
  const r = {};
  for (const f of ['annuel', 'mensuel', 'infini_annuel', 'infini_mensuel']) r[f] = prixDuPaquet(paquetDe(offre, f));
  return r;
}
