/* ══════════ ce que l'écran Mirandola+ dit d'une licence (2026-10-28) ══════════
   Module pur, testé (test/abonnement.test.js). Sorti de src/abonnement.js,
   qui part au démarrage de l'app : ceci ne sert qu'à l'écran Mirandola+
   (ui/plus.js), chargé à la demande. */
import { FORMULES, dateLisible, euros, niveauDe } from './abonnement.js';

/* Ce que l'élève vient de toucher, quand l'écran Mirandola+ s'ouvre sur un
   geste bridé (ui/bridage.js) : dit en tête, au-dessus des formules. Ici et
   non dans src/abonnement.js depuis le 2026-11-13 : seul l'écran Mirandola+,
   chargé à la demande, le lit — au démarrage, c'était du poids pour rien. */
export const RAISONS = {
  ia: 'L’IA écrit tes paquets pour toi',
  photo: 'Ton cahier en photo, et c’est un paquet',
  fichier: 'Ton PDF devient un paquet',
  exercices: 'QCM et associations',
  media: 'Des images et des sons sur tes cartes',
  livres: 'Tes 5 paquets de Mirandola gratuit sont pris',
  journal: 'Toutes tes statistiques',
  // Mirandola Infini (2026-11-07) : un geste du menu d'un livre
  // l'objectif examen, ou les examens blancs offerts tous faits (2026-11-08)
  examen: 'L’objectif examen et l’examen blanc sont dans Mirandola Infini'
};

/* Les avantages (AVANTAGES de src/abonnement.js), en détail : une icône (src/icones.js),
   un titre, une ligne. `prof` : ce qui change pour un professeur. */
export const AVANTAGES_DETAIL = [
  { ic: 'bolt', t: 'Memory Engine Ultra', s: 'Réglé sur ta mémoire : chaque carte revient au moment où tu allais l’oublier.' },
  { ic: 'spark', t: 'L’IA', s: 'Ton cours, une photo de ton cahier ou un PDF devient un paquet de flashcards.',
    prof: 'Tes cours deviennent des paquets pour tes classes, sans compter.' },
  { ic: 'layers', t: 'Des paquets sans limite', s: 'Toutes tes matières, tous tes chapitres.' },
  { ic: 'target', t: 'QCM et associations', s: 'Pour t’entraîner avant le contrôle.' },
  { ic: 'image', t: 'Images et sons', s: 'Un schéma, une carte, la prononciation d’un mot.' },
  { ic: 'chart', t: 'Toutes tes statistiques', s: 'Ce que tu sais vraiment, tes heures, tes matières, les cartes qui résistent.' }
];

/* Ce que Mirandola Infini ajoute (2026-11-06) : tout Mirandola+, et ceci.
   Rien n'y est retiré à Mirandola+ : Infini est au-dessus, pas à côté. */
export const AVANTAGES_INFINI = [
  { ic: 'spark', t: 'L’IA sans compter', s: '150 générations du meilleur modèle chaque mois, puis sans limite. Des PDF de 20 Mo, 300 cartes d’un coup.' },
  { ic: 'pen', t: 'L’examen blanc', s: 'L’IA compose ton sujet et corrige ta copie, même écrite à la main : un conseil là où tu te trompes.' },
  { ic: 'target', t: 'L’objectif examen', s: 'Une date sur un paquet : le moteur vise 95 % de souvenir le jour J.' }
];

/* ---------- la licence, ligne par ligne (2026-10-28) ----------
   Ce que l'écran Mirandola+ dit d'un compte qui a Mirandola+ ou Campus : un état
   (une pastille), des lignes [libellé, valeur] — formule, prix, prochaine
   échéance, paiement — et l'engagement, en une phrase. Le prix est celui
   que la base a retenu de l'abonnement (montant), sinon celui de sa
   formule. Rien pour un compte gratuit : l'écran montre les formules. */
const SOURCES = { stripe: 'Carte bancaire, par Stripe', apple: 'L’App Store', google: 'Google Play' };
const prixDe = a => {
  const f = FORMULES[a.formule];
  const c = a.montant ?? (f && f.prix);
  return c == null ? '' : `${euros(c)} par ${f && f.par === 'an' ? 'an' : 'mois'}`;
};

function etatLicence(a) {
  if (a.statut === 'impaye') return { k: 'ko', t: 'Paiement refusé' };
  if (a.finPrevue) return { k: 'am', t: 'Résilié' };
  if (a.statut === 'essai') return { k: 'ok', t: 'Essai' };
  return { k: 'ok', t: 'Actif' };
}

// Mirandola Infini (2026-11-05) : la même offre, un niveau au-dessus — son nom partout où l'abonnement se dit
const nomDe = a => (niveauDe(a.formule) === 'infini' ? 'Mirandola Infini' : 'Mirandola+');
const annuel = a => !!FORMULES[a.formule] && FORMULES[a.formule].par === 'an';

function engagement(a, date) {
  const jusqua = date ? ` jusqu’au ${date}` : '', nom = nomDe(a);
  if (a.finPrevue) return `Résilié : ${nom} reste ouvert${jusqua}, sans nouveau prélèvement.`;
  if (annuel(a)) return `Engagement d’un an, payé d’avance. Résilier arrête le renouvellement : ${nom} reste ouvert${jusqua}.`;
  return `Sans engagement. Résilier arrête le prochain prélèvement : ${nom} reste ouvert${jusqua}.`;
}

function licenceAbonne(a) {
  const date = dateLisible(a.fin);
  const echeance = a.finPrevue ? ['Fin', date] : a.statut === 'essai' ? ['Fin de l’essai', date] : ['Prochain prélèvement', date];
  return {
    etat: etatLicence(a),
    lignes: [['Formule', FORMULES[a.formule] ? `${niveauDe(a.formule) === 'infini' ? 'Infini, ' : ''}${annuel(a) ? 'annuelle' : 'mensuelle'}`
      .replace(/^./, x => x.toUpperCase()) : 'Abonnement'],
      ['Prix', prixDe(a)], date ? echeance : null, ['Paiement', SOURCES[a.source] || '']].filter(l => l && l[1]),
    engagement: engagement(a, date)
  };
}

function licenceCampus(o) {
  // un établissement ; ou, sans lui, un professeur particulier — son élève, ou lui-même (2026-11-13)
  const fin = dateLisible(o.licenceFin), qui = o.etablissement || o.professeur;
  const de = o.etablissement ? 'ton établissement' : o.professeur ? 'ton professeur' : '';
  return {
    etat: { k: 'ok', t: 'Active' },
    lignes: [['Licence', qui ? `Offerte par ${qui}` : 'Ta licence de professeur particulier'],
      ['Échéance', fin || (de ? `Fixée par ${de}` : 'Sans date de fin')], ['Prix', de ? 'Rien à payer' : 'Sur devis']],
    engagement: de ? `${de[0].toUpperCase() + de.slice(1)} gère la licence : rien à résilier de ton côté.`
      : 'Tes places se commandent depuis ton espace professeur.'
  };
}

export function licence(o) {
  if (!o || o.offre === 'gratuit') return null;
  if (o.offre === 'campus') return licenceCampus(o);
  const a = o.abonnement;
  if (a && a.source !== 'offert') return licenceAbonne(a);
  const fin = a && dateLisible(a.fin);
  return {
    etat: { k: 'ok', t: 'Offert' },
    lignes: [['Formule', a && niveauDe(a.formule) === 'infini' ? 'Mirandola Infini, offert par Mirandola' : 'Offerte par Mirandola'],
      ['Échéance', fin ? `Jusqu’au ${fin}` : 'Sans fin'], ['Prix', 'Rien à payer']],
    engagement: 'Un cadeau : rien à résilier.'
  };
}

/* L'IA du mois, dite en clair : « 12 sur 30 », ou « 12 ce mois-ci » pour
   un professeur, qui n'a pas à compter. */
export function iaDuMois(n, max, prof) {
  const fait = Math.max(0, +n || 0);
  if (prof) return { t: `${fait} ce mois-ci`, pc: 0 };
  return { t: `${fait} sur ${max}`, pc: max ? Math.min(100, Math.round((fait / max) * 100)) : 0 };
}
