/* ══════════ Mirandola+ dans l'app : ce que dit la base, dit en clair (2026-10-27) ══════════
   Module pur, sans dépendance, testé (test/abonnement.test.js). La base dit
   ce que le compte ouvre (mon_offre(), migration 20261027190000) ; l'écran
   Mirandola+ (ui/plus.js) le montre. Ce qui s'achète, au prix de la page
   d'accueil (index.html, tarifs) et des prix créés dans Stripe : les trois
   doivent dire la même chose (test/site.test.js compare la page à FORMULES).

   La vente est ouverte (2026-10-27) : un compte Mirandola gratuit a l'onglet
   Mirandola+, les boutons du site mènent à l'écran Mirandola+ de l'app. Tant que
   Stripe (sur ordinateur) ou RevenueCat (dans l'app des magasins) n'est pas
   branché, « Passer à Mirandola+ » répond « le paiement ouvre bientôt »
   (docs/VENTE.md) ; repasser VENTE_OUVERTE à faux rend aux boutons du site
   le chemin de l'inscription. */

export const VENTE_OUVERTE = true;

/* Les clés PUBLIQUES de RevenueCat (appl_…, goog_…), faites pour vivre dans
   l'app comme la clé anon de Supabase ; vides tant que l'app des magasins
   n'existe pas (docs/VENTE.md). */
export const REVENUECAT = { ios: '', android: '' };

/* En centimes, TVA comprise (2026-10-28). Le prix d'un élève qui révise
   son bac ou son concours : moins qu'une heure de cours particulier pour
   l'année, et le mensuel assez cher pour que l'annuel soit l'évidence. */
export const FORMULES = {
  annuel: { prix: 4999, par: 'an', mois: 417, sans: 8388, remise: 40 },
  mensuel: { prix: 699, par: 'mois' }
};

/* Ce que Mirandola+ ouvre, dit comme sur la page d'accueil (tarifs) : les
   règles elles-mêmes sont dans src/offres.js. */
export const AVANTAGES = [
  'Le Memory Engine Ultra, réglé sur ta mémoire',
  'L’IA : ton cours, une photo ou un PDF en flashcards, 30 par mois',
  'Des livres sans limite',
  'QCM et associations pour t’entraîner',
  'Images et sons sur tes pages',
  'Toutes tes stats : mémoire, matières, pages qui résistent'
];

/* Ce que l'élève vient de toucher, quand l'écran Mirandola+ s'ouvre sur un
   geste bridé (ui/bridage.js) : dit en tête, au-dessus des formules. */
export const RAISONS = {
  ia: 'L’IA écrit tes livres pour toi',
  photo: 'Ton cahier en photo, et c’est un livre',
  fichier: 'Ton PDF devient un livre',
  exercices: 'QCM et associations',
  media: 'Des images et des sons sur tes pages',
  livres: 'Ta bibliothèque est pleine : 5 livres avec Mirandola gratuit',
  journal: 'Ton journal complet'
};

// 2999 → « 29,99 € » (espace insécable : le prix ne se coupe jamais)
export const euros = c => (c / 100).toFixed(2).replace('.', ',') + ' €';

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre',
  'novembre', 'décembre'];
export function dateLisible(iso) {
  if (!iso) return '';                 // sans date (Mirandola+ offert sans fin) : new Date(null) serait le 1er janvier 1970
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`;
}

/* La réponse de mon_offre(), quelle qu'elle soit (rien, une liste vide
   d'une base qui n'a pas encore la fonction, un objet) → une forme sûre. */
function lireAbonnement(a) {
  if (!a || typeof a !== 'object') return null;
  return {
    statut: String(a.statut || 'fini'), formule: a.formule === 'annuel' || a.formule === 'mensuel' ? a.formule : null,
    source: String(a.source || 'stripe'), fin: a.fin_periode || null, finPrevue: !!a.fin_prevue,
    montant: Number.isInteger(a.montant) && a.montant >= 0 ? a.montant : null
  };
}

export function lireOffre(r) {
  const o = r && typeof r === 'object' && !Array.isArray(r) ? r : {};
  return {
    offre: o.offre === 'plus' || o.offre === 'campus' ? o.offre : 'gratuit',
    etablissement: typeof o.etablissement === 'string' ? o.etablissement : '',
    // Campus chez un professeur particulier : son nom (20261029090000), qui dit à l'élève qui lui ouvre l'IA
    professeur: typeof o.professeur === 'string' ? o.professeur : '',
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
    cle: 'campus',
    titre: 'Mirandola Campus',
    ligne: (o.etablissement ? `Offert par ${o.etablissement}` : 'Offert par ton établissement') + (fin ? ` jusqu’au ${fin}` : ''),
    alerte: double ? 'Ton abonnement Mirandola+ continue d’être prélevé : ton établissement t’offre déjà tout.' : '',
    payer: false, gerer: !!a && a.source !== 'offert' && court(a)
  };
}

function resumeGratuit(a) {
  const ligne = a && a.statut === 'incomplet' ? 'Le paiement n’a pas abouti'
    : a && a.statut === 'fini' ? 'Ton abonnement Mirandola+ a pris fin' : 'Gratuit';
  return { cle: 'gratuit', titre: 'Mirandola', ligne, alerte: '', payer: true, gerer: !!a && a.source === 'stripe' };
}

/* Ce que l'écran dit du compte : un titre, une ligne, et ce qu'on peut y
   faire — payer (Mirandola gratuit), gérer (un abonnement payé : carte,
   formule, résiliation, là où il a été pris — gestion()), et une alerte
   quand quelque chose demande un geste. */
export function resume(o) {
  const a = o.abonnement;
  if (o.offre === 'campus') return resumeCampus(o);
  if (o.offre !== 'plus') return resumeGratuit(a);
  if (!a) return { cle: 'plus', titre: 'Mirandola+', ligne: 'Actif', alerte: '', payer: false, gerer: false };
  return {
    cle: 'plus',
    titre: 'Mirandola+',
    ligne: ligneAbonne(a) + (MAGASIN[a.source] ? ` · géré dans ${MAGASIN[a.source]}` : ''),
    alerte: a.statut === 'impaye' ? (a.source === 'stripe' ? 'Stripe va réessayer ta carte : mets-la à jour pour garder Mirandola+.'
      : `Mets à jour ton moyen de paiement dans ${MAGASIN[a.source] || 'le magasin'} pour garder Mirandola+.`) : '',
    payer: false, gerer: a.source !== 'offert'
  };
}

/* Où se gère un abonnement, vu de CET appareil (`p` : plateforme(), src/
   plateformes.js). Chacun là où il a été pris : Stripe par son portail —
   jamais depuis l'app des magasins, où un lien vers un paiement hors
   d'Apple et de Google est interdit —, Apple dans les réglages de l'iPhone,
   Google dans Google Play. Ailleurs, on dit où. */
export const GERER = {
  apple: 'https://apps.apple.com/account/subscriptions',
  google: 'https://play.google.com/store/account/subscriptions'
};
export function gestion(a, p) {
  if (!a || a.source === 'offert') return null;
  if (a.source === 'stripe') return p.natif ? { type: 'texte', texte: 'Se gère sur mirandola.fr, depuis un ordinateur' }
    : { type: 'stripe' };
  if (a.source === 'apple') return p.os === 'ios' ? { type: 'lien', lien: GERER.apple }
    : { type: 'texte', texte: 'Se gère sur ton iPhone ou ton iPad : Réglages, ton nom, Abonnements' };
  if (a.source === 'google') return p.os === 'android' ? { type: 'lien', lien: GERER.google }
    : { type: 'texte', texte: 'Se gère dans Google Play, sur ton téléphone Android' };
  return null;
}

/* Ce que rend la fonction paiement quand elle ne peut pas, dit à l'élève. */
const ERREURS = {
  bientot: 'Le paiement ouvre bientôt',
  deja: 'Mirandola+ est déjà actif sur ce compte',
  campus: 'Ton établissement t’offre déjà tout Mirandola+',
  aucun: 'Aucun abonnement à gérer sur ce compte',
  hors: 'Hors ligne : le paiement attend le réseau',
  magasin: 'Le magasin ne répond pas : réessaie dans un instant',
  annule: 'Achat annulé : rien n’a été prélevé',
  rien: 'Aucun achat Mirandola+ à restaurer sur ce compte',
  demo: 'Dans la démo, rien ne se paie : crée ton compte',
  auth: 'Reconnecte-toi pour continuer',
  stripe: 'Le paiement ne répond pas : réessaie dans un instant'
};
export const erreurDe = code => ERREURS[{ nokey: 'bientot', noprix: 'bientot' }[code] || code] || ERREURS.stripe;

/* « ?plus=… » : l'adresse qui ouvre l'écran Mirandola+ — un bouton du site
   (« annuel », « mensuel » : la formule choisie), le retour de Stripe
   (« merci » après le paiement, « annule » s'il a renoncé, « retour » du
   portail). */
export function lireRetour(v) {
  const s = String(v || '').toLowerCase();
  if (s === 'merci' || s === 'annule' || s === 'retour') return { etape: s, formule: null };
  if (s === 'annuel' || s === 'mensuel') return { etape: null, formule: s };
  return s ? { etape: null, formule: null } : null;
}
