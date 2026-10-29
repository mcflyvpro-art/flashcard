/* ══════════ ce que coûte l'IA d'une licence (2026-10-29) ══════════
   Module pur, sans dépendance, testé (test/cout-ia.test.js). L'éditeur fixe
   le nombre de générations par mois qu'il accorde — à un professeur
   particulier et à ses élèves, aux professeurs et aux élèves d'un
   établissement — et la console lui dit aussitôt ce que cela peut lui
   coûter : le coût moyen d'une génération (admin_cout_ia : la moyenne des
   90 derniers jours de `ai_usage`, en centimes ; une estimation tant qu'il
   n'y a pas d'historique) multiplié par toutes les générations accordées.
   C'est un plafond — personne n'utilise tout —, et c'est lui qui compte
   pour décider. */

/* Une génération moyenne, sans historique : un cours collé (~0,7 c), une
   photo (~1 c), un PDF (~4,6 c), mesurés en octobre 2026 ; on prend large. */
export const PAR_GENERATION_DEFAUT = 1.5;

const entier = n => Math.max(0, Math.floor(+n || 0));

export const parGeneration = moyenne => (+moyenne > 0 ? +moyenne : PAR_GENERATION_DEFAUT);

/* Ce que coûtent, au plus, les générations accordées pour un mois :
   { generations, cents, centsAn, parGeneration, estime } (`estime` : sans
   historique, le coût d'une génération est notre estimation). */
export function coutIA({ profs = 0, eleves = 0, iaProf = 0, iaEleve = 0, moyenne = null } = {}) {
  const generations = entier(profs) * entier(iaProf) + entier(eleves) * entier(iaEleve);
  const p = parGeneration(moyenne), cents = Math.round(generations * p);
  return { generations, cents, centsAn: cents * 12, parGeneration: p, estime: !(+moyenne > 0) };
}

/* « 1,23 € » depuis des centimes (une fraction de centime arrondie). */
export const eurosDe = c => `${(Math.round(+c || 0) / 100).toFixed(2).replace('.', ',')} €`;
