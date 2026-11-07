/* ══════════ l'IA du mois, sur les onglets de la création (2026-10-29) ══════════
   Sans dépendance. Ce que montrent les trois façons de créer qui passent par
   l'IA — Fichier, Prompt, Photo — selon le compte :
   - `plus`    : Mirandola gratuit, l'IA est dans Mirandola+ (ui/bridage.js) ;
   - `ferme`   : un compte Campus à qui sa licence n'accorde aucune
                 génération (quota 0) — grisé, et pourquoi au survol et au
                 toucher ;
   - `epuise`  : tout le mois est pris — la suite le 1er ;
   - `ouvert`  : le reste du mois, posé en pastille sur chaque onglet ;
   - `inconnu` : la base n'a pas encore répondu (hors ligne, premier
                 affichage) — rien de posé, rien de fermé : la fonction ai
                 tranchera, comme partout ailleurs (« une offre inconnue ne
                 bride rien »).
   `ia` : la réponse de mon_ia() ({ fait, quota }), mise à jour par chaque
   appel à la fonction ai (`mois`). `offre` : celle de mon_offre(). */

/* Rien de sûr à dire : rien de lu, ou une IA lue pour une autre offre
   (avant un paiement, un Mirandola+ offert) — on attend la relecture. */
const incertain = (ia, o) => !ia || ia.quota == null || ia.fait == null || (!!ia.offre && !!o && ia.offre !== o);

export function etatIA(ia, offre) {
  const o = offre && offre.offre;
  if (o === 'gratuit') return { cle: 'plus' };
  if (incertain(ia, o)) return { cle: 'inconnu' };
  const quota = Math.max(0, +ia.quota || 0), fait = Math.max(0, +ia.fait || 0);
  // fermée : seul un compte Campus l'est par sa licence — ailleurs, un quota nul n'est qu'une lecture en retard
  if (!quota) return o === 'campus' ? { cle: 'ferme', texte: messageFerme(offre) } : { cle: 'inconnu' };
  // Mirandola Infini (2026-11-05) : sans compter — un signe ∞, jamais un reste qui s'épuise
  if (ia.sans_compter) return { cle: 'infini', titre: 'L’IA sans compter, avec Mirandola Infini' };
  const reste = Math.max(0, quota - fait);
  const titre = reste
    ? `${reste} génération${reste > 1 ? 's' : ''} d’IA ${reste > 1 ? 'restent' : 'reste'} ce mois-ci, sur ${quota}`
    : 'Ton IA du mois est épuisée : la suite le 1er';
  return { cle: reste ? 'ouvert' : 'epuise', reste, quota, pc: Math.round((reste / quota) * 100), titre };
}

/* Pourquoi l'IA est fermée à un compte Campus : qui la lui accorde. */
export function messageFerme(offre) {
  if (offre && offre.professeur) return 'Ton professeur n’a pas ouvert l’IA à ton compte';
  return 'Ton établissement n’a pas ouvert l’IA à ton compte';
}

/* Après une génération : le compte que rend la fonction ai (`mois`). */
export function compter(ia, mois) {
  if (!mois || mois.fait == null) return ia;
  const o = { ...ia, fait: +mois.fait, quota: mois.quota == null ? ia && ia.quota : +mois.quota };
  // Infini : la réponse le dit ; sans un mot d'elle, on garde ce qu'on savait
  if (mois.sans_compter ?? (ia && ia.sans_compter)) o.sans_compter = true; else delete o.sans_compter;
  return o;
}
