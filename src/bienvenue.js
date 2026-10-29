/* ══════════ l'accueil d'un nouveau compte (2026-10-26) ══════════
   Ce qu'on demande en arrivant (docs/PARCOURS.md, § 2) : à un particulier,
   son prénom, un pseudo, un visage, son niveau, ses matières et un
   objectif de pages par jour — de quoi ouvrir une bibliothèque qui lui
   ressemble, avant la visite guidée ; à un élève entré par son
   établissement, son pseudo et son visage (son nom vient de sa classe).
   La règle du pseudo vit dans src/pseudo.js, le visage dans src/avatar.js.
   Pur, testé dans test/bienvenue.test.js ; affiché par ui/bienvenue.js. */
import { cleNom } from './journal.js';
import { couleurLibre, idLibre } from './matieres.js';

export const NIVEAUX_PERSO = { college: 'Collège', lycee: 'Lycée', sup: 'Études supérieures', autre: 'Autre' };

/* Le niveau dit, la page suivante propose ses matières déjà cochées
   (2026-10-29 : avant, on cochait tout soi-même alors que le niveau était
   connu). Pour cela il faut l'année (la philosophie n'est qu'en Terminale)
   ou, dans le supérieur, la filière. */
export const ANNEES = {
  college: { '6e': '6e', '5e': '5e', '4e': '4e', '3e': '3e' },
  lycee: { seconde: 'Seconde', premiere: 'Première', terminale: 'Terminale' },
  sup: { prepa: 'Prépa', droit: 'Droit', sante: 'Santé', eco: 'Éco-gestion', lettres: 'Lettres, langues',
    sciences: 'Sciences', info: 'Informatique', psycho: 'Psychologie' }
};

const LV = ['Espagnol', 'Allemand', 'Italien'];
const SPECIALITES = ['Mathématiques', 'Physique-chimie', 'SVT', 'SES', 'HGGSP', 'HLP', 'NSI', 'LLCER anglais', 'SI', 'Arts'];
const COLLEGE = [['Français', 'Mathématiques', 'Histoire-géo', 'Anglais', 'SVT', 'Physique-chimie', 'Technologie'],
  [...LV, 'Latin', 'EMC', 'Arts plastiques', 'Musique']];

/* [cochées d'office, proposées à côté] — on décoche, on coche, on ajoute
   les siennes ; on en ajoutera d'autres en créant ses livres. */
const PROPOSEES = {
  '6e': [['Français', 'Mathématiques', 'Histoire-géo', 'Anglais', 'Sciences et technologie'],
    ['Espagnol', 'Allemand', 'EMC', 'Arts plastiques', 'Musique']],
  '5e': COLLEGE, '4e': COLLEGE, '3e': COLLEGE,
  seconde: [['Français', 'Mathématiques', 'Histoire-géo', 'Anglais', 'SVT', 'Physique-chimie', 'SES', 'SNT'],
    [...LV, 'Latin', 'EMC']],
  premiere: [['Français', 'Histoire-géo', 'Anglais', 'Enseignement scientifique'], [...SPECIALITES, ...LV]],
  terminale: [['Philosophie', 'Histoire-géo', 'Anglais', 'Enseignement scientifique'], [...SPECIALITES, 'Maths expertes', ...LV]],
  prepa: [['Mathématiques', 'Anglais', 'Culture générale'],
    ['Physique', 'Chimie', 'Informatique', 'Économie', 'Histoire', 'Géopolitique', 'Philosophie', 'Lettres', 'SI', ...LV]],
  droit: [['Droit civil', 'Droit constitutionnel', 'Droit pénal', 'Droit administratif'],
    ['Introduction au droit', 'Histoire du droit', 'Droit des affaires', 'Droit européen', 'Anglais juridique', 'Économie']],
  sante: [['Anatomie', 'Biologie cellulaire', 'Physiologie', 'Biochimie'],
    ['Biophysique', 'Pharmacologie', 'Histologie', 'Embryologie', 'Génétique', 'Santé publique', 'Anglais médical']],
  eco: [['Microéconomie', 'Macroéconomie', 'Gestion', 'Comptabilité'],
    ['Marketing', 'Statistiques', 'Finance', 'Management', 'Droit des affaires', 'Anglais', 'Mathématiques']],
  lettres: [['Littérature', 'Langue française', 'Anglais'],
    [...LV, 'Latin', 'Grec', 'Linguistique', 'Civilisation', 'Histoire', 'Philosophie']],
  sciences: [['Mathématiques', 'Physique', 'Chimie', 'Biologie'], ['Informatique', 'Géologie', 'Statistiques', 'Anglais']],
  info: [['Algorithmique', 'Programmation', 'Mathématiques', 'Bases de données'],
    ['Réseaux', 'Systèmes', 'Web', 'Sécurité', 'Statistiques', 'Anglais']],
  psycho: [['Psychologie cognitive', 'Psychologie sociale', 'Développement', 'Neurosciences'],
    ['Psychopathologie', 'Statistiques', 'Méthodologie', 'Biologie', 'Anglais']],
  autre: [[], ['Anglais', 'Espagnol', 'Culture générale', 'Code de la route', 'Concours', 'Histoire', 'Musique', 'Informatique']]
};

/* Faut-il dire l'année (ou la filière) avant d'aller plus loin ? */
export const anneeRequise = niveau => !!ANNEES[niveau];

/* Les matières du niveau : celles qu'on coche d'office, celles qu'on propose. */
export function proposees(niveau, annee) {
  const k = niveau === 'autre' ? 'autre' : ANNEES[niveau] && ANNEES[niveau][annee] ? annee : '';
  const [cochees, autres] = PROPOSEES[k] || [[], []];
  return { cochees: [...cochees], autres: autres.filter(m => !cochees.includes(m)) };
}

/* Une matière écrite à la main : nettoyée (espaces, majuscule), entre 2 et
   40 caractères, au moins une lettre, rien d'autre que des lettres, des
   chiffres et un peu de ponctuation. `null` sinon. */
export function nomMatiere(s) {
  const v = String(s || '').replace(/\s+/g, ' ').trim();
  if (v.length < 2 || v.length > 40 || !/\p{L}/u.test(v) || !/^[\p{L}\p{N} '’.,&+()/-]+$/u.test(v)) return null;
  return v[0].toLocaleUpperCase('fr') + v.slice(1);
}

/* Ajoute une matière écrite à la main : une proposée se coche (au nom près,
   sans casse ni accent), une nouvelle s'ajoute aux siennes. Rend
   { nom, nouvelle } ou `null` si le nom ne va pas. */
export function ajouterMatiere(saisie, connues) {
  const nom = nomMatiere(saisie);
  if (!nom) return null;
  const deja = (connues || []).find(m => cleNom(m) === cleNom(nom));
  return deja ? { nom: deja, nouvelle: false } : { nom, nouvelle: true };
}

/* Pages par jour (prefs.goal) : de quoi tenir sans se décourager. */
export const OBJECTIFS = [{ n: 10, t: 'Tranquille' }, { n: 20, t: 'Régulier' }, { n: 30, t: 'Sérieux' }, { n: 50, t: 'Intensif' }];

export const prenomValide = p => /^[\p{L}][\p{L} '’-]{0,39}$/u.test(String(p || '').trim());

/* Les matières après l'accueil : celles qu'on a cochées, et celles qu'un
   livre emploie déjà (on n'en retire jamais une qui sert). Les matières
   d'exemple que personne n'a choisies partent. Rend { liste, retirees } :
   la liste à garder (dans l'ordre des choix) et ce qu'il faut effacer. */
export function matieresApres(subjects, decks, choisies, couleurs) {
  const servent = new Set((decks || []).map(d => d.subject).filter(Boolean));
  const voulues = [...new Set((choisies || []).map(n => String(n).trim()).filter(Boolean))];
  const liste = [];
  for (const nom of voulues) {
    const deja = (subjects || []).find(s => cleNom(s.name) === cleNom(nom));
    liste.push(deja || { id: idLibre([...(subjects || []), ...liste], nom), name: nom, color: couleurLibre(liste, couleurs) });
  }
  for (const s of subjects || []) if (servent.has(s.id) && !liste.includes(s)) liste.push(s);
  const garde = new Set(liste.map(s => s.id));
  return {
    liste: liste.map((s, i) => ({ id: s.id, name: s.name, color: s.color, pos: i })),
    retirees: (subjects || []).filter(s => !garde.has(s.id))
  };
}
