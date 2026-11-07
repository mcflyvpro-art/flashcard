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
/* La version des conditions de vente qu'on accepte en payant (2026-11-05) :
   envoyée avec la commande, gardée dans les métadonnées Stripe de
   l'abonnement — la preuve de l'accord et de la demande de démarrage
   immédiat (article L221-25 du code de la consommation). Elle change avec
   le texte « cgv » de ui/legal-textes.js. */
export const CGV_VERSION = '2026-11-07';

/* Les prix du 2026-11-05 (décidés : « plus psychologiques, un peu à la
   baisse, rentables avec l'IA ») : Mirandola+ sous Quizlet Plus, l'annuel
   présenté au mois ; Infini au-dessus, l'IA sans compter et ses outils
   d'examen. `sans` : douze mois au mois, pour dire la remise de l'annuel —
   jamais affiché comme un prix barré (article L112-1-1). */
export const FORMULES = {
  annuel: { prix: 4499, par: 'an', mois: 375, sans: 7188, remise: 37 },
  mensuel: { prix: 599, par: 'mois' },
  infini_annuel: { prix: 7999, par: 'an', mois: 667, sans: 11988, remise: 33, niveau: 'infini' },
  infini_mensuel: { prix: 999, par: 'mois', niveau: 'infini' }
};
// « plus » ou « infini » : le niveau d'une formule (une formule inconnue reste Mirandola+)
export const niveauDe = f => (FORMULES[f] && FORMULES[f].niveau) || 'plus';
// la formule d'un niveau, pour une période : formuleDe('infini', 'annuel') → 'infini_annuel'
export const formuleDe = (niveau, periode) => (niveau === 'infini' ? 'infini_' : '') + (periode === 'mensuel' ? 'mensuel' : 'annuel');
// l'essai gratuit d'un premier abonnement Stripe (2026-11-05), et le code de lancement
export const ESSAI_JOURS = 7;
export const PROMO = { code: 'LANCEMENT', remise: 20, mois: 3, enCours: true };
/* Le code de lancement mis en avant (2026-11-07, demandé : « je veux qu'il
   soit visible au début ») : tant que `enCours`, l'écran Mirandola+ le pose
   d'office sur un premier abonnement et dit ce qu'il donne ; le site le
   montre en haut de chaque page (data-promo, test/site.test.js). Le prix
   sous le code, arrondi au centime comme Stripe arrondit une remise. */
export const prixPromo = f => Math.round(FORMULES[f].prix * (100 - PROMO.remise) / 100);
export const lignePromo = f => (FORMULES[f].par === 'an'
  ? `${euros(prixPromo(f))} la première année`
  : `${euros(prixPromo(f))} par mois les ${PROMO.mois} premiers mois`);

/* Ce que Mirandola+ ouvre, dit comme sur la page d'accueil (tarifs) : les
   règles elles-mêmes sont dans src/offres.js. */
export const AVANTAGES = [
  'Le Memory Engine Ultra, réglé sur ta mémoire',
  'L’IA : ton cours, une photo ou un PDF en flashcards, 30 par mois',
  'Des paquets sans limite',
  'QCM et associations pour t’entraîner',
  'Images et sons sur tes cartes',
  'Toutes tes stats : mémoire, matières, cartes qui résistent'
];

/* Ce que l'élève vient de toucher, quand l'écran Mirandola+ s'ouvre sur un
   geste bridé (ui/bridage.js) : dit en tête, au-dessus des formules. */
export const RAISONS = {
  ia: 'L’IA écrit tes paquets pour toi',
  photo: 'Ton cahier en photo, et c’est un paquet',
  fichier: 'Ton PDF devient un paquet',
  exercices: 'QCM et associations',
  media: 'Des images et des sons sur tes cartes',
  livres: 'Tes 5 paquets de Mirandola gratuit sont pris',
  journal: 'Toutes tes statistiques',
  // Mirandola Infini (2026-11-07) : un geste du menu d'un livre
  examen: 'L’objectif examen et l’examen blanc sont dans Mirandola Infini'
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
    // les quatre formules (les deux d'Infini comprises : jusqu'au 2026-11-07, la
    // licence d'un abonné Infini perdait sa formule et son prix)
    statut: String(a.statut || 'fini'), formule: Object.hasOwn(FORMULES, a.formule) ? a.formule : null,
    source: String(a.source || 'stripe'), fin: a.fin_periode || null, finPrevue: !!a.fin_prevue,
    montant: Number.isInteger(a.montant) && a.montant >= 0 ? a.montant : null
  };
}

export function lireOffre(r) {
  const o = r && typeof r === 'object' && !Array.isArray(r) ? r : {};
  return {
    offre: o.offre === 'plus' || o.offre === 'campus' ? o.offre : 'gratuit',
    // Mirandola Infini (2026-11-05) : un niveau au-dessus de Mirandola+, la même offre
    niveau: o.niveau === 'infini' && o.offre === 'plus' ? 'infini' : o.offre === 'plus' || o.offre === 'campus' ? o.offre : 'gratuit',
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
  const f = FORMULES[a.formule] ? (niveauDe(a.formule) === 'infini' ? 'Infini · ' : '') + (FORMULES[a.formule].par === 'an' ? 'Annuel' : 'Mensuel')
    : 'Abonnement';
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
  if (FORMULES[s]) return { etape: null, formule: s };
  return s ? { etape: null, formule: null } : null;
}
