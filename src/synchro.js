/* ══════════ ce qui a bougé ailleurs (2026-10-28) ══════════
   Module pur, sans dépendance, testé (test/synchro.test.js). La synchro
   légère (core/synchro.js) lit sur le serveur le numéro de révision de
   chaque livre ; ici, ce qu'il faut en conclure.

   - changé : un livre que le serveur a à une autre révision que nous, ou
     que nous n'avons pas (créé sur l'autre appareil) ;
   - parti : un livre que nous tenons du serveur (il a une révision) et
     que le serveur n'a plus (supprimé sur l'autre appareil).
   Un livre qui attend d'être envoyé n'est ni l'un ni l'autre : il reste à
   soi, et c'est la fusion à trois (src/fusion.js) qui tranchera à l'envoi.
   Un livre créé ici et pas encore envoyé n'a pas de révision : il n'est
   jamais « parti ». */
export function ecarts(serveur, locaux, enAttente = {}) {
  const ici = new Map(locaux.map(d => [d.id, d]));
  const vus = new Set(serveur.map(r => r.id));
  const changes = serveur
    .filter(r => !enAttente[r.id] && (!ici.has(r.id) || ici.get(r.id).rev !== r.rev))
    .map(r => r.id);
  const partis = locaux.filter(d => d.rev && !enAttente[d.id] && !vus.has(d.id)).map(d => d.id);
  return { changes, partis };
}

/* Les matières, comparées sans tenir compte de l'ordre d'arrivée. */
export const signatureMatieres = l => (l || []).map(s => [s.id, s.name, s.color, s.pos].join('|')).sort().join(',');

/* Les livres dans l'ordre de l'étagère, comme les rend la base (pos) ; à
   égalité, l'ordre d'avant ne bouge pas. */
export const rangerLivres = l => l.map((d, i) => [d, i])
  .sort((a, b) => ((a[0].pos || 0) - (b[0].pos || 0)) || a[1] - b[1]).map(x => x[0]);

/* Les matières du serveur, comme les pose la relecture de l'ouverture
   (pull) : sa liste fait foi, sauf une matière d'ici qu'il n'a pas encore
   et dont un livre se sert (créée hors ligne) — on la garde, et on la
   renvoie (aRenvoyer). */
export function fusionnerMatieres(serveur, locales, livres) {
  const matieres = (serveur || []).map(x => ({ id: x.id, name: x.name, color: x.color, pos: x.pos }));
  const aRenvoyer = (locales || []).filter(s => !matieres.some(x => x.id === s.id)
    && (livres || []).some(d => d.subject === s.id));
  return { matieres: matieres.concat(aRenvoyer), aRenvoyer };
}
