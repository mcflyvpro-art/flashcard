/* ══════════ un établissement : les règles (2026-10-25) ══════════
   Module pur, sans aucune dépendance que le noyau des classes, testé dans
   test/etablissement.test.js. Ce que l'app dit d'un code d'établissement
   (élève, professeur, référent), d'une demande, et d'une licence. La base
   décide (migration 20261025233000) ; ici on ne fait que dire sa réponse
   avec des mots, et résumer une licence. docs/PARCOURS.md, § 4. */

import { iso, joursEntre } from './classe.js';

export const ROLES_CODE = { eleve: 'Élève', prof: 'Professeur', ref: 'Référent' };

export const GENRES = {
  college: 'Collège', lycee: 'Lycée', lycee_pro: 'Lycée professionnel', sup: 'Études supérieures', autre: 'Autre'
};

export const OFFRES = { essai: 'Essai', etablissement: 'Licence' };

/* La réponse de code_apercu / etab_demander, en clair. `quel` précise le
   rôle quand il change la phrase (un référent entre tout de suite). */
const STATUTS = {
  ok: ['ok', 'C’est bien ton établissement ?', ''],
  attente: ['attente', 'Demande envoyée', 'Ton établissement doit la valider. Tu le verras ici dès que ce sera fait.'],
  admis: ['ok', 'Tu es référent de l’établissement', ''],
  deja: ['ok', 'Tu fais déjà partie de cet établissement', ''],
  autre: ['ko', 'Ton compte appartient à un autre établissement', 'Un compte ne fait partie que d’un seul établissement.'],
  gere: ['ko', 'Ton compte vient déjà de ton établissement', 'Une carte élève n’a pas besoin de code.'],
  role: ['ko', 'Ce code n’est pas pour ce compte', 'Les élèves et les professeurs n’ont pas le même code.'],
  demande: ['ko', 'Une demande attend déjà ailleurs', 'Annule-la dans « Ma classe » avant d’en envoyer une autre.'],
  plein: ['ko', 'L’établissement n’a plus de place', 'Préviens-le : il doit ajouter des places à sa licence.'],
  licence: ['ko', 'La licence de l’établissement a pris fin', 'Préviens-le : il doit la renouveler.'],
  complet: ['ko', 'Trop de demandes en attente', 'Ton établissement doit d’abord répondre aux demandes en cours.'],
  nom: ['ko', 'Ton prénom et ton nom', 'Ton établissement doit te reconnaître : écris ton vrai prénom et ton vrai nom.'],
  classe: ['ko', 'Classe trop longue', 'Quarante caractères au plus, par exemple « 2nde 4 ».'],
  inconnu: ['ko', 'Code inconnu', 'Vérifie les huit caractères : sans 0, O, 1, I ni L.'],
  trop: ['ko', 'Trop d’essais', 'Par sécurité, réessaie dans une heure.'],
  connexion: ['ko', 'Connecte-toi d’abord', '']
};

export function messageEtab(statut, quel) {
  const [ton, titre, texte] = STATUTS[statut] || ['ko', 'Impossible pour l’instant', 'Réessaie dans un moment.'];
  if (statut === 'attente' && quel === 'prof') {
    return { ton, titre, texte: 'Le référent de l’établissement doit la valider. Tu auras l’espace professeur dès que ce sera fait.' };
  }
  return { ton, titre, texte };
}

const finFr = fin => (fin ? `${fin.slice(8, 10)}/${fin.slice(5, 7)}/${fin.slice(0, 4)}` : 'sans fin');
const decompte = (eleves, places) => (places == null ? `${eleves} élève${eleves > 1 ? 's' : ''}` : `${eleves} / ${places}`);

/* Ce qui presse d'abord : une licence échue, puis pleine, puis bientôt finie. */
function urgence(jours, eleves, places) {
  if (jours != null && jours < 0) return 'echue';
  if (places != null && eleves >= places) return 'pleine';
  if (jours != null && jours <= 30) return 'bientot';
  return 'ok';
}

/* Une licence en un coup d'œil : où on en est, et ce qui presse. `l` vient
   de ref_codes() ou admin_orgs() : { offre, places, eleves, licence_fin }. */
export function etatLicence(l, auj = iso(new Date())) {
  const places = l.places == null ? null : +l.places;
  const eleves = +l.eleves || 0;
  const fin = l.licence_fin || null;
  const jours = fin ? joursEntre(auj, fin) : null;
  return {
    k: urgence(jours, eleves, places), jours,
    libre: places == null ? null : Math.max(0, places - eleves),
    offre: OFFRES[l.offre] || 'Licence',
    places: decompte(eleves, places),
    pc: places ? Math.min(100, Math.round((eleves / places) * 100)) : 0,
    fin: finFr(fin)
  };
}

export const uaiValide = s => /^[0-9]{7}[A-Z]$/.test(String(s || '').trim().toUpperCase());
