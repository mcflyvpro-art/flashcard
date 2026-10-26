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

export const OFFRES = { demo: 'Démo', etablissement: 'Licence' };

/* La réponse de code_apercu / rejoindre, en clair. Il n'y a plus d'attente :
   le code fait entrer (migration 20261026001000). */
const STATUTS = {
  ok: ['ok', 'C’est bien ça ?', ''],
  deja: ['ok', 'Tu y es déjà', ''],
  choisir: ['ko', 'Choisis ta classe', ''],
  classe: ['ko', 'Cette classe n’est plus proposée', 'Choisis-en une autre dans la liste.'],
  autre: ['ko', 'Ton compte appartient à un autre établissement', 'Un compte ne fait partie que d’un seul établissement.'],
  gere: ['ko', 'Ton compte vient déjà de ton établissement', 'Une carte élève n’a pas besoin de code.'],
  role: ['ko', 'Ce code n’est pas pour ce compte', 'Les élèves et les professeurs n’ont pas le même code.'],
  soi: ['ko', 'C’est ton propre code', 'Donne-le à tes élèves.'],
  plein: ['ko', 'L’établissement n’a plus de place', 'Préviens-le : il doit ajouter des places à sa licence.'],
  complet: ['ko', 'Cette classe est complète', 'Ton professeur doit ajouter des places.'],
  licence: ['ko', 'La licence de l’établissement a pris fin', 'Préviens-le : il doit la renouveler.'],
  nom: ['ko', 'Ton prénom et ton nom', 'Ton vrai prénom et ton vrai nom : on doit te reconnaître.'],
  inconnu: ['ko', 'Code inconnu', 'Vérifie les huit caractères : sans 0, O, 1, I ni L.'],
  trop: ['ko', 'Trop d’essais', 'Par sécurité, réessaie dans une heure.'],
  connexion: ['ko', 'Connecte-toi d’abord', '']
};

export function messageEtab(statut) {
  const [ton, titre, texte] = STATUTS[statut] || ['ko', 'Impossible pour l’instant', 'Réessaie dans un moment.'];
  return { ton, titre, texte };
}

/* Ce qu'on dit en entrant, selon qui l'on devient. */
export function bienvenue(r) {
  if (r.type === 'prof') return `Tu suis maintenant ${r.nom}${r.classe ? ' · ' + r.classe : ''}`;
  if (r.quel === 'ref') return `Tu es référent de ${r.nom}`;
  if (r.quel === 'prof') return `Bienvenue à ${r.nom}`;
  return `Bienvenue à ${r.nom}${r.classe ? ' · ' + r.classe : ''}`;
}

/* Le suivi d'un établissement, du premier contact au client. */
export const ETAPES = {
  prospect: 'Prospect', demo: 'Démo', client: 'Client', pause: 'En pause', perdu: 'Perdu'
};
export const BESOINS = {
  devoirs: 'Devoirs', revision: 'Révision autonome', ia: 'Fiches par l’IA', defis: 'Défis en classe',
  suivi: 'Suivi des élèves', examens: 'Examens'
};

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
