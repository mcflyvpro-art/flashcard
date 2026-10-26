/* ══════════ un établissement : les règles (2026-10-25) ══════════
   Module pur, sans aucune dépendance que le noyau des classes, testé dans
   test/etablissement.test.js. Ce que l'app dit d'un code d'établissement
   (élève, professeur, référent), d'une demande, et d'une licence. La base
   décide (migration 20261025233000) ; ici on ne fait que dire sa réponse
   avec des mots, et résumer une licence. docs/PARCOURS.md, § 4. */

import { formatCode, iso, joursEntre } from './classe.js';

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
  const ou = [r.nom, r.classe].filter(Boolean).join(' · ');
  if (r.type === 'prof') return `Tu suis ${ou}`;
  if (r.quel === 'ref') return `Tu es référent · ${r.nom}`;
  return `Bienvenue · ${ou}`;
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

/* Le rythme des codes (20261026110000). Un code élèves ou professeurs fait
   entrer sans validation : toute sa sécurité tient dans le fait qu'il ne
   traîne pas. Chaque semaine par défaut ; « jamais » n'existe pas. */
export const RYTHMES = { semaine: 'Chaque semaine', mois: 'Chaque mois', trimestre: 'Chaque trimestre' };

/* La tâche de la base passe chaque nuit à 02:53 UTC (`renouveler-codes-quotidien`) :
   un code échu à `jusqua` change au premier passage qui suit. */
export function renouvellement(jusqua) {
  const d = new Date(jusqua || NaN);
  if (isNaN(+d)) return null;
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 2, 53));
  if (t < d) t.setUTCDate(t.getUTCDate() + 1);
  return t;
}

/* Quand le code change, dit court : « cette nuit » à moins d'un jour, sinon le jour. */
export function changeLe(jusqua, maintenant = new Date(), tz = undefined) {
  const t = renouvellement(jusqua);
  if (!t) return '';
  if (+t - +maintenant < 864e5) return 'Nouveau code cette nuit';
  return 'Nouveau code le ' + t.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: tz });
}

/* Le mot de passe provisoire d'un professeur que le référent inscrit lui-même
   (ref_new_account) : douze caractères sans ceux qu'on confond (0/O, 1/l/I),
   en trois groupes pour se dicter. `alea` rend un nombre dans [0, 1). */
const ALPHA_MDP = 'abcdefghjkmnpqrstuvwxyz23456789';
export function motDePasseProvisoire(alea = Math.random) {
  const t = Array.from({ length: 12 }, () => ALPHA_MDP[Math.floor(alea() * ALPHA_MDP.length)]).join('');
  return `${t.slice(0, 4)}-${t.slice(4, 8)}-${t.slice(8)}`;
}

/* Les cycles d'une classe (la base range les classes par cycle, niveau_rang). */
export const CYCLES = { college: 'Collège', lycee_gt: 'Lycée général', lycee_techno: 'Lycée technologique',
  lycee_pro: 'Lycée professionnel', cpge: 'CPGE', sup: 'Supérieur' };

/* Les niveaux qu'on propose en créant une classe, et le cycle qui va avec :
   le référent choisit « 2nde », la base reçoit aussi « lycee_gt ». */
export const NIVEAUX = ['6e', '5e', '4e', '3e', '2nde', '1re', 'Tle', 'CAP', 'Bac pro', 'BTS', 'Prépa', 'Licence', 'Autre'];
export function cycleDe(niveau) {
  const n = String(niveau || '').toLowerCase();
  if (/^[3-6]e$/.test(n)) return 'college';
  if (['2nde', '1re', 'tle'].includes(n)) return 'lycee_gt';
  if (['cap', 'bac pro'].includes(n)) return 'lycee_pro';
  if (n === 'prépa') return 'cpge';
  if (['bts', 'licence'].includes(n)) return 'sup';
  return '';
}

export const uaiValide = s => /^[0-9]{7}[A-Z]$/.test(String(s || '').trim().toUpperCase());

/* ---------- le suivi commercial (console de l'éditeur, 2026-10-26) ----------
   Du premier contact au client : ce qui presse, ce qu'on compte, et le
   courriel qui transmet le code référent. La base garde la fiche
   (org_suivi, admin_orgs) ; ici on ne fait que la lire. */
export const ORDRE_ETAPES = ['prospect', 'demo', 'client', 'pause', 'perdu'];

const plat = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/* Une relance due : sa date est passée ou c'est aujourd'hui — sauf pour un établissement perdu. */
export const aRelancer = (o, auj = iso(new Date())) => !!o.relance && o.relance <= auj && o.statut !== 'perdu';

/* Une demande arrivée par le formulaire public, que personne n'a encore regardée (pas de note). */
export const nouvelleDemande = o => o.source === 'demande' && (o.statut || 'prospect') === 'prospect' && !o.notes;

/* Une licence qui demande une décision : finie, pleine ou bientôt finie. */
// une place par élève et par professeur (20261026130000) : une licence pleine l'est aussi de professeurs
const licenceAlerte = (o, auj) => !!o.licence_fin && o.statut !== 'perdu'
  && etatLicence({ ...o, eleves: (+o.eleves || 0) + (+o.profs || 0) }, auj).k !== 'ok';

export function compterEtapes(orgs) {
  const n = { tous: orgs.length };
  for (const k of ORDRE_ETAPES) n[k] = 0;
  for (const o of orgs) n[o.statut || 'prospect'] = (n[o.statut || 'prospect'] || 0) + 1;
  return n;
}

/* L'ordre de la liste : d'abord ce qui presse — une demande neuve, une
   relance due, une licence qui finit —, puis par nom. */
export function trierSuivi(orgs, auj = iso(new Date())) {
  const poids = o => (nouvelleDemande(o) ? 0 : aRelancer(o, auj) ? 1 : licenceAlerte(o, auj) ? 2 : 3);
  return [...orgs].sort((a, b) => poids(a) - poids(b) || String(a.name).localeCompare(String(b.name), 'fr'));
}

/* L'étape choisie et la recherche (nom, ville, UAI, contact), sans casse ni accent. */
export function filtrerSuivi(orgs, etape = 'tous', q = '') {
  const v = plat(q).trim();
  return orgs.filter(o => (etape === 'tous' || (o.statut || 'prospect') === etape)
    && (!v || [o.name, o.ville, o.uai, o.contact_nom, o.contact_email].some(x => plat(x).includes(v))));
}

/* Les chiffres du haut : ce qui tourne et ce qui attend. */
export function bilanSuivi(orgs, auj = iso(new Date())) {
  const vivants = orgs.filter(o => ['demo', 'client'].includes(o.statut));
  return {
    demos: orgs.filter(o => o.statut === 'demo').length,
    clients: orgs.filter(o => o.statut === 'client').length,
    eleves: vivants.reduce((n, o) => n + (+o.eleves || 0), 0),
    revenu: orgs.filter(o => o.statut === 'client').reduce((n, o) => n + (+o.prix_euros || 0), 0),
    relances: orgs.filter(o => aRelancer(o, auj)).length,
    demandes: orgs.filter(nouvelleDemande).length
  };
}

/* La prochaine chose à faire pour un établissement, selon où il en est. */
export function prochainPas(o, auj = iso(new Date())) {
  if (o.code_ref) return 'code';                       // un code référent attend d'être utilisé : le transmettre
  if (o.statut === 'prospect' || !o.licence_fin) return 'demo';
  if (o.statut === 'demo' || licenceAlerte(o, auj)) return 'licence';
  return 'suivre';
}

/* Le courriel qui transmet le code référent, prêt à partir de la
   messagerie de l'éditeur (un lien mailto:, rien ne passe par Folio). */
export function courrielReferent({ etab, contact, code, fin, site }) {
  const bonjour = contact ? `Bonjour ${contact},` : 'Bonjour,';
  return {
    sujet: `Folio · l’accès de ${etab}`,
    corps: `${bonjour}

Voici l’accès de ${etab} à Folio.

1. Ouvrez ${site} sur un ordinateur et créez votre compte.
2. Réglages → « J’ai un code » → ${formatCode(code)}

Ce code ne sert qu’une fois${fin ? ` et vaut jusqu’au ${finFr(String(fin).slice(0, 10))}` : ''}. Vous trouverez ensuite dans votre console les codes à donner aux élèves et aux professeurs.

Bonne découverte,
`
  };
}

export const lienCourriel = (email, c) =>
  `mailto:${encodeURIComponent(email || '')}?subject=${encodeURIComponent(c.sujet)}&body=${encodeURIComponent(c.corps)}`;

/* La réponse de demander_demo (le formulaire public, sans compte), en clair.
   On vouvoie : c'est une direction, un professeur, un CPE qui écrit. */
const DEMANDE = {
  ok: ['ok', 'Merci, c’est noté', 'Nous vous écrivons sous deux jours ouvrés pour ouvrir votre démo.'],
  deja: ['ok', 'Votre demande nous est déjà parvenue', 'Nous vous écrivons très vite.'],
  email: ['ko', 'Cette adresse e-mail ne semble pas valide', ''],
  champs: ['ko', 'Il manque le nom de l’établissement ou le vôtre', ''],
  trop: ['ko', 'Beaucoup de demandes en ce moment', 'Réessayez dans une heure.']
};
export function messageDemande(statut) {
  const [ton, titre, texte] = DEMANDE[statut] || ['ko', 'Envoi impossible', 'Vérifiez votre connexion et réessayez.'];
  return { ton, titre, texte };
}
export const FONCTIONS = ['Direction', 'Professeur', 'CPE', 'Professeur documentaliste', 'Autre'];
