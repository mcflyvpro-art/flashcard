/* ══════════ Folio+ dans l'app : ce que dit la base, dit en clair (2026-10-27) ══════════
   Module pur, sans dépendance, testé (test/abonnement.test.js). La base dit
   ce que le compte ouvre (mon_offre(), migration 20261027190000) ; l'écran
   Folio+ (ui/plus.js) le montre. Ce qui s'achète, au prix de la page
   d'accueil (index.html, tarifs) et des prix créés dans Stripe : les trois
   doivent dire la même chose (test/site.test.js compare la page à FORMULES).

   La vente ouvre quand Stripe est branché (docs/VENTE.md) : d'ici là,
   VENTE_OUVERTE reste faux — l'entrée « Folio+ » des Réglages ne se montre
   qu'à qui a déjà Folio+ ou Campus, et l'écran (adresse …/folio-plus) ne
   propose rien à acheter. */

export const VENTE_OUVERTE = false;

// en centimes, TVA comprise
export const FORMULES = {
  annuel: { prix: 2999, par: 'an', mois: 250, sans: 5988 },
  mensuel: { prix: 499, par: 'mois' }
};

/* Ce que Folio+ ouvre, dit comme sur la page d'accueil (tarifs) : les
   règles elles-mêmes sont dans src/offres.js. */
export const AVANTAGES = [
  'Le Memory Engine Ultra, réglé sur ta mémoire',
  'L’IA : ton cours, une photo ou un PDF en flashcards, 50 par mois',
  'Des livres sans limite',
  'QCM et associations pour t’entraîner',
  'Images et sons sur tes pages',
  'Toutes tes stats : mémoire, matières, pages qui résistent'
];

// 2999 → « 29,99 € » (espace insécable : le prix ne se coupe jamais)
export const euros = c => (c / 100).toFixed(2).replace('.', ',') + ' €';

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre',
  'novembre', 'décembre'];
export function dateLisible(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`;
}

/* La réponse de mon_offre(), quelle qu'elle soit (rien, une liste vide
   d'une base qui n'a pas encore la fonction, un objet) → une forme sûre. */
function lireAbonnement(a) {
  if (!a || typeof a !== 'object') return null;
  return {
    statut: String(a.statut || 'fini'), formule: a.formule === 'annuel' || a.formule === 'mensuel' ? a.formule : null,
    source: String(a.source || 'stripe'), fin: a.fin_periode || null, finPrevue: !!a.fin_prevue
  };
}

export function lireOffre(r) {
  const o = r && typeof r === 'object' && !Array.isArray(r) ? r : {};
  return {
    offre: o.offre === 'plus' || o.offre === 'campus' ? o.offre : 'gratuit',
    etablissement: typeof o.etablissement === 'string' ? o.etablissement : '',
    licenceFin: o.licence_fin || null,
    abonnement: lireAbonnement(o.abonnement)
  };
}

const court = a => ['actif', 'essai', 'impaye'].includes(a.statut);
const MAGASIN = { apple: 'l’App Store', google: 'Google Play' };

function ligneAbonne(a) {
  const date = dateLisible(a.fin);
  if (a.statut === 'impaye') return 'Paiement refusé : mets ta carte à jour';
  if (a.source === 'offert') return date ? `Offert jusqu’au ${date}` : 'Offert';
  if (a.finPrevue) return date ? `Se termine le ${date}` : 'Résilié';
  if (a.statut === 'essai') return date ? `Essai jusqu’au ${date}` : 'Essai';
  const f = a.formule === 'annuel' ? 'Annuel' : a.formule === 'mensuel' ? 'Mensuel' : 'Abonnement';
  return date ? `${f} · renouvelé le ${date}` : f;
}

function resumeCampus(o) {
  const a = o.abonnement, fin = dateLisible(o.licenceFin);
  const double = !!a && a.source === 'stripe' && court(a) && !a.finPrevue;
  return {
    titre: 'Folio Campus',
    ligne: (o.etablissement ? `Offert par ${o.etablissement}` : 'Offert par ton établissement') + (fin ? ` jusqu’au ${fin}` : ''),
    alerte: double ? 'Ton abonnement Folio+ continue d’être prélevé : ton établissement t’offre déjà tout.' : '',
    payer: false, gerer: !!a && a.source === 'stripe'
  };
}

function resumeGratuit(a) {
  const ligne = a && a.statut === 'incomplet' ? 'Le paiement n’a pas abouti'
    : a && a.statut === 'fini' ? 'Ton abonnement Folio+ a pris fin' : 'Gratuit';
  return { titre: 'Folio', ligne, alerte: '', payer: true, gerer: !!a && a.source === 'stripe' };
}

/* Ce que l'écran dit du compte : un titre, une ligne, et ce qu'on peut y
   faire — payer (Folio gratuit), gérer (un abonnement Stripe : carte,
   formule, résiliation, factures, par le portail de Stripe), et une alerte
   quand quelque chose demande un geste. */
export function resume(o) {
  const a = o.abonnement;
  if (o.offre === 'campus') return resumeCampus(o);
  if (o.offre !== 'plus') return resumeGratuit(a);
  if (!a) return { titre: 'Folio+', ligne: 'Actif', alerte: '', payer: false, gerer: false };
  return {
    titre: 'Folio+',
    ligne: ligneAbonne(a) + (MAGASIN[a.source] ? ` · géré dans ${MAGASIN[a.source]}` : ''),
    alerte: a.statut === 'impaye' ? 'Stripe va réessayer ta carte : mets-la à jour pour garder Folio+.' : '',
    payer: false, gerer: a.source === 'stripe'
  };
}

/* Ce que rend la fonction paiement quand elle ne peut pas, dit à l'élève. */
const ERREURS = {
  bientot: 'Le paiement ouvre bientôt',
  deja: 'Folio+ est déjà actif sur ce compte',
  campus: 'Ton établissement t’offre déjà tout Folio+',
  aucun: 'Aucun abonnement à gérer sur ce compte',
  hors: 'Hors ligne : le paiement attend le réseau',
  demo: 'Dans la démo, rien ne se paie : crée ton compte',
  auth: 'Reconnecte-toi pour continuer',
  stripe: 'Le paiement ne répond pas : réessaie dans un instant'
};
export const erreurDe = code => ERREURS[{ nokey: 'bientot', noprix: 'bientot' }[code] || code] || ERREURS.stripe;

/* « ?plus=… » : l'adresse qui ouvre l'écran Folio+ — un bouton du site
   (« annuel », « mensuel » : la formule choisie), le retour de Stripe
   (« merci » après le paiement, « annule » s'il a renoncé, « retour » du
   portail). */
export function lireRetour(v) {
  const s = String(v || '').toLowerCase();
  if (s === 'merci' || s === 'annule' || s === 'retour') return { etape: s, formule: null };
  if (s === 'annuel' || s === 'mensuel') return { etape: null, formule: s };
  return s ? { etape: null, formule: null } : null;
}
