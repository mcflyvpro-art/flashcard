/* ══════════ ce que l'écran Mirandola+ dit d'une licence (2026-10-28) ══════════
   Module pur, testé (test/abonnement.test.js). Sorti de src/abonnement.js,
   qui part au démarrage de l'app : ceci ne sert qu'à l'écran Mirandola+
   (ui/plus.js), chargé à la demande. */
import { FORMULES, dateLisible, euros } from './abonnement.js';

/* Les avantages (AVANTAGES de src/abonnement.js), en détail : une icône (src/icones.js),
   un titre, une ligne. `prof` : ce qui change pour un professeur. */
export const AVANTAGES_DETAIL = [
  { ic: 'bolt', t: 'Memory Engine Ultra', s: 'Réglé sur ta mémoire : chaque page revient au moment où tu allais l’oublier.' },
  { ic: 'spark', t: 'L’IA', s: 'Ton cours, une photo de ton cahier ou un PDF devient un livre de flashcards.',
    prof: 'Tes cours deviennent des livres pour tes classes, sans compter.' },
  { ic: 'layers', t: 'Des livres sans limite', s: 'Toutes tes matières, tous tes chapitres.' },
  { ic: 'target', t: 'QCM et associations', s: 'Pour t’entraîner avant le contrôle.' },
  { ic: 'image', t: 'Images et sons', s: 'Un schéma, une carte, la prononciation d’un mot.' },
  { ic: 'chart', t: 'Ton journal complet', s: 'Ce que tu sais vraiment, tes heures, tes matières, les pages qui résistent.' }
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
  return c == null ? '' : `${euros(c)} par ${a.formule === 'annuel' ? 'an' : 'mois'}`;
};

function etatLicence(a) {
  if (a.statut === 'impaye') return { k: 'ko', t: 'Paiement refusé' };
  if (a.finPrevue) return { k: 'am', t: 'Résilié' };
  if (a.statut === 'essai') return { k: 'ok', t: 'Essai' };
  return { k: 'ok', t: 'Actif' };
}

function engagement(a, date) {
  const jusqua = date ? ` jusqu’au ${date}` : '';
  if (a.finPrevue) return `Résilié : Mirandola+ reste ouvert${jusqua}, sans nouveau prélèvement.`;
  if (a.formule === 'annuel') return `Engagement d’un an, payé d’avance. Résilier arrête le renouvellement : Mirandola+ reste ouvert${jusqua}.`;
  return `Sans engagement. Résilier arrête le prochain prélèvement : Mirandola+ reste ouvert${jusqua}.`;
}

function licenceAbonne(a) {
  const date = dateLisible(a.fin);
  const echeance = a.finPrevue ? ['Fin', date] : a.statut === 'essai' ? ['Fin de l’essai', date] : ['Prochain prélèvement', date];
  return {
    etat: etatLicence(a),
    lignes: [['Formule', a.formule === 'annuel' ? 'Annuelle' : a.formule === 'mensuel' ? 'Mensuelle' : 'Abonnement'],
      ['Prix', prixDe(a)], date ? echeance : null, ['Paiement', SOURCES[a.source] || '']].filter(l => l && l[1]),
    engagement: engagement(a, date)
  };
}

export function licence(o) {
  if (!o || o.offre === 'gratuit') return null;
  if (o.offre === 'campus') {
    const fin = dateLisible(o.licenceFin);
    return {
      etat: { k: 'ok', t: 'Active' },
      lignes: [['Licence', o.etablissement ? `Offerte par ${o.etablissement}` : 'Offerte par ton établissement'],
        ['Échéance', fin || 'Fixée par ton établissement'], ['Prix', 'Rien à payer']],
      engagement: 'Ton établissement gère la licence : rien à résilier de ton côté.'
    };
  }
  const a = o.abonnement;
  if (a && a.source !== 'offert') return licenceAbonne(a);
  const fin = a && dateLisible(a.fin);
  return {
    etat: { k: 'ok', t: 'Offert' },
    lignes: [['Formule', 'Offerte par Mirandola'], ['Échéance', fin ? `Jusqu’au ${fin}` : 'Sans fin'], ['Prix', 'Rien à payer']],
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
