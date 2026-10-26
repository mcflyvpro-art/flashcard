/* ══════════ l'accueil d'un nouveau compte (2026-10-26) ══════════
   Ce qu'on demande en arrivant (docs/PARCOURS.md, § 2) : à un particulier,
   son prénom, un pseudo, un visage, son niveau, ses matières et un
   objectif de pages par jour — de quoi ouvrir une bibliothèque qui lui
   ressemble, avant la visite guidée ; à un élève entré par son
   établissement, seulement son visage (son nom vient de sa classe).
   Pur, testé dans test/bienvenue.test.js ; affiché par ui/bienvenue.js. */
import { avatarDe, ecrireAvatar } from './avatar.js';
import { COULEURS, hachage } from './jeton.js';
import { cleNom } from './journal.js';
import { couleurLibre, idLibre } from './matieres.js';

export const NIVEAUX_PERSO = { college: 'Collège', lycee: 'Lycée', sup: 'Études supérieures', autre: 'Autre' };

/* Les matières proposées selon le niveau : on en coche quelques-unes, on
   en ajoutera d'autres en créant ses livres. */
export const MATIERES = {
  college: ['Français', 'Mathématiques', 'Histoire-géo', 'Anglais', 'Espagnol', 'Allemand', 'SVT', 'Physique-chimie', 'Technologie'],
  lycee: ['Français', 'Philosophie', 'Mathématiques', 'Histoire-géo', 'Anglais', 'Espagnol', 'SES', 'SVT', 'Physique-chimie',
    'NSI', 'HGGSP', 'HLP'],
  sup: ['Droit', 'Médecine', 'Économie', 'Gestion', 'Lettres', 'Langues', 'Histoire', 'Sciences', 'Informatique', 'Psychologie'],
  autre: ['Langues', 'Culture générale', 'Code de la route', 'Concours', 'Musique', 'Histoire']
};

/* Pages par jour (prefs.goal) : de quoi tenir sans se décourager. */
export const OBJECTIFS = [{ n: 10, t: 'Tranquille' }, { n: 20, t: 'Régulier' }, { n: 30, t: 'Sérieux' }, { n: 50, t: 'Intensif' }];

/* Six visages à choisir, toujours les mêmes pour un compte et un tour
   (« d'autres » passe au tour suivant), chacun sur sa couleur. */
export function propositions(graine, tour = 0, n = 6) {
  return Array.from({ length: n }, (_, i) => {
    const k = `${graine}:${tour}:${i}`, a = avatarDe(k);
    return { cle: ecrireAvatar(a), avatar: a, teinte: hachage(k) % COULEURS.length };
  });
}

/* Un pseudo proposé depuis le prénom (sinon l'adresse) : minuscules, sans
   accent ni espace, 3 à 20 caractères — la règle de saveHandle. */
const nettoyer = v => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9_.-]/g, '').slice(0, 20);
export const pseudoValide = h => /^[a-z0-9_.-]{3,20}$/.test(String(h || ''));
export function pseudoPropose(prenom, email) {
  const p = nettoyer(String(prenom || '').split(/\s+/)[0]);
  const base = p.length >= 3 ? p : nettoyer(String(email || '').split('@')[0]);
  return base.length >= 3 ? base : (base + 'lecteur').slice(0, 20);
}

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
