/* ══════════ une matière qui arrive d'ailleurs ══════════
   Un devoir, un livre partagé par lien ou envoyé par un ami viennent d'un
   autre compte. L'identifiant de leur matière ne veut rien dire ici
   (« droit » chez l'un peut être un « Allemand » renommé chez l'autre) :
   seul le NOM voyage, et c'est par lui qu'on retrouve la sienne. Si on ne
   l'a pas, on la crée — un devoir de Géographie arrive en Géographie, pas
   « sans matière ». Le nom se compare sans casse ni accents (« Éco » et
   « eco » sont la même matière).

   Un lien de sauvegarde, lui, revient sur le même compte avec ses propres
   identifiants : sans nom, un identifiant connu est gardé tel quel.

   Pur, testé dans test/matieres.test.js ; branché par core/matieres.js. */
import { cleNom } from './journal.js';

export const slug = n => (n || '').normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'matiere';

export function idLibre(subjects, nom) {
  const base = slug(nom);
  let id = base, n = 2;
  while ((subjects || []).some(x => x.id === id)) id = base + '-' + n++;
  return id;
}

/* La couleur la moins employée, dans l'ordre de la palette : deux matières
   créées l'une après l'autre ne se ressemblent pas. */
export function couleurLibre(subjects, couleurs) {
  const n = new Map(couleurs.map(c => [c, 0]));
  for (const s of subjects || []) if (n.has(s.color)) n.set(s.color, n.get(s.color) + 1);
  return [...n.entries()].reduce((b, e) => e[1] < b[1] ? e : b)[0];
}

export const trouverParNom = (subjects, nom) => {
  const k = cleNom(nom);
  return k ? (subjects || []).find(s => cleNom(s.name) === k) || null : null;
};

/* Rend { id, creer } : l'identifiant à donner au livre, et la matière à
   créer d'abord s'il le faut (null sinon). `demande` : { nom, id }. */
export function choisirMatiere(subjects, demande, couleurs) {
  const nom = String((demande && demande.nom) || '').trim().slice(0, 60);
  if (nom) {
    const t = trouverParNom(subjects, nom);
    if (t) return { id: t.id, creer: null };
    const s = { id: idLibre(subjects, nom), name: nom, color: couleurLibre(subjects, couleurs), pos: (subjects || []).length };
    return { id: s.id, creer: s };
  }
  const id = demande && demande.id;
  return { id: id && (subjects || []).some(s => s.id === id) ? id : '', creer: null };
}
