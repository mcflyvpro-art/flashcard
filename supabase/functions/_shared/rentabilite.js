/* La rentabilité de l'IA (2026-11-08) — module pur, sans dépendance au
   réseau : la fonction ai l'applique, test/rentabilite.test.js le vérifie,
   docs/RENTABILITE.md le raconte.

   Demandé : « calcule toujours la rentabilité, pour que peu importe
   l'utilisation ce soit rentable ». Avant, un compte payant n'avait qu'un
   nombre de générations par mois : rien ne bornait ce qu'une génération
   coûte (un PDF de 20 Mo d'un abonné Infini peut peser près d'un million de
   jetons, soit 2 $ sur le meilleur modèle), ni ce qu'un mois coûte (Infini
   continue sans limite de nombre au-delà de ses 150).

   Désormais chaque compte a un PLAFOND DE COÛT par mois, tiré de ce qu'il
   rapporte au pire :
   - le pire prix payé : le code de lancement appliqué, et la formule à
     l'année (la moins chère par mois) ;
   - moins la TVA (20 % — la franchise de TVA en dispense aujourd'hui, on
     compte comme si elle s'appliquait déjà), les cotisations (25,6 % du
     chiffre d'affaires hors taxe, le taux libéral, le plus haut des deux de
     docs/ENTREPRISE.md) et les frais de Stripe (1,5 % + 0,25 € par
     paiement) ;
   - dont l'IA ne prend jamais plus de la moitié (`PART_IA`) ; un dollar
     compté pour un euro (prudent : le dollar en vaut moins depuis 2003,
     sauf quelques semaines de 2022).
   La première part du plafond va au meilleur modèle, le reste au plus
   économe (`PART_PREMIUM`) : Infini garde « l'IA sans compter » — on
   n'arrête pas au 151e, on passe au modèle vingt fois moins cher —, et
   jamais un mois ne coûte plus que son plafond. Chaque génération est
   réservée en base à son PIRE coût (son entrée comptée par l'API, sa
   sortie au maximum permis) avant d'appeler le modèle : cinquante appels
   lancés ensemble ne passent pas plus que le plafond. */
import { PRIX, PROMO } from './abonnement.js';

/* Les tarifs, en dollars par million de jetons, vérifiés le 2026-11-08 sur
   la référence de l'API. Claude Haiku 5.5 a un second palier au-delà de
   100 000 jetons d'entrée. Un modèle inconnu est compté au prix du plus cher. */
export const TARIFS = {
  'claude-sonnet-5': { entree: 2, sortie: 10 },
  'claude-sonnet-5-5': { entree: 2, sortie: 10 },
  'claude-haiku-5-5': { entree: 0.1, sortie: 0.5, palier: { des: 100000, entree: 0.5, sortie: 2.5 } }
};
const PLUS_CHER = { entree: 2, sortie: 10 };

// le coût d'un appel, en cents de dollar ($ par million → cents : × 100 ÷ 1 000 000)
export function coutCents(modele, entree, sortie) {
  const t = TARIFS[modele] || PLUS_CHER;
  const p = t.palier && entree > t.palier.des ? t.palier : t;
  return (Math.max(0, entree) * p.entree + Math.max(0, sortie) * p.sortie) / 1e4;
}

export const CHARGES = { tva: 0.2, cotisations: 0.256, stripe: { taux: 0.015, fixe: 25 }, euroParDollar: 1 };
export const PART_IA = 0.5;
export const PART_PREMIUM = 0.75;
// l'essai de 7 jours : aucun paiement encore — ce qu'il coûte au plus, c'est un coût d'acquisition borné
export const ESSAI_CENTS = 25;
/* Campus : un compte d'établissement a le quota de sa licence (ia_quota) ; son
   plafond est ce quota fois le pire coût raisonnable d'une génération — ce
   que la console de l'éditeur met dans un devis (src/cout-ia.js). */
export const PAR_GENERATION_CAMPUS = 3;

/* L'examen blanc offert (2026-11-08, demandé : « Mirandola gratuit peut
   tester un examen IA gratuit, et avec + il en débloque 1 de plus, pour
   faire 2 ») : des examens à vie — composés ; chacun a droit à sa
   correction —, sans limite pour Infini. Le même tableau que src/offres.js
   (test/rentabilite.test.js). Un examen offert compose sur 120 cartes au plus
   (Infini : 300) ; un compte gratuit n'a que ce plafond-là, de quoi composer
   et corriger un examen au pire (≈ 30 + 26 cents). */
export const EXAMENS_OFFERTS = { gratuit: 1, plus: 2, campus: 2 };
export const EXAMEN_PAGES_OFFERT = 120;
export const GRATUIT_CENTS = 60;
export const examensPermis = niveau => (niveau === 'infini' ? Infinity : EXAMENS_OFFERTS[niveau] ?? 0);
/* `composes` : les examens déjà composés, `corriges` : les copies corrigées.
   Composer demande un examen offert de reste ; corriger, un sujet composé
   qui attend encore sa correction. */
export function examenPermis(op, niveau, composes, corriges) {
  if (niveau === 'infini') return true;
  if (op === 'examen') return composes < examensPermis(niveau);
  return corriges < composes;
}

const mois = f => (PRIX[f].intervalle === 'year' ? 12 : 1);
export const prixPromo = f => Math.round((PRIX[f].centimes * (100 - PROMO.remise)) / 100);

/* Ce qu'un abonnement laisse chaque mois, en centimes d'euro, une fois la
   TVA, les cotisations et les frais de Stripe payés. */
export function netMensuel(centimesTTC, nMois) {
  const ht = centimesTTC / (1 + CHARGES.tva);
  const frais = centimesTTC * CHARGES.stripe.taux + CHARGES.stripe.fixe;
  return (ht * (1 - CHARGES.cotisations) - frais) / nMois;
}

const formulesDe = niveau => Object.keys(PRIX).filter(f => (niveau === 'infini') === f.startsWith('infini'));

// le pire : chaque formule du niveau, au prix plein et au prix du lancement
export function pireNet(niveau) {
  return Math.min(...formulesDe(niveau).flatMap(f => [netMensuel(PRIX[f].centimes, mois(f)), netMensuel(prixPromo(f), mois(f))]));
}

/* Le plafond de coût d'un compte pour un mois, en cents de dollar. `licence`
   (un nombre) : un compte Campus ; `essai` : les 7 jours ; sinon le niveau
   (« infini », ou Mirandola+ — professeur compris : il paie le prix d'un élève). */
export function plafondCents({ niveau, essai, licence } = {}) {
  if (typeof licence === 'number') return Math.max(0, licence) * PAR_GENERATION_CAMPUS;
  if (essai) return ESSAI_CENTS;
  if (niveau === 'gratuit') return GRATUIT_CENTS;              // l'examen blanc offert, et rien d'autre
  return Math.floor((pireNet(niveau === 'infini' ? 'infini' : 'plus') * PART_IA) / CHARGES.euroParDollar);
}

// passé cette part du plafond, le modèle le plus économe prend le relais
export const econome = (depense, plafond) => plafond != null && depense >= plafond * PART_PREMIUM;

/* Une borne des jetons d'entrée sans les compter : jamais moins d'un jeton
   pour deux signes (le français en fait plutôt un pour quatre), le
   message système et le schéma de réponse compris. Au-delà de `COMPTER`,
   ou dès qu'il y a une image ou un PDF, la fonction demande le compte exact
   à l'API (gratuit). */
export const SYSTEME_JETONS = 4000;
export const COMPTER = 20000;
export const borneJetons = signes => Math.ceil(Math.max(0, signes) / 2) + SYSTEME_JETONS;

// le pire coût d'une génération : son entrée, et sa sortie au maximum permis, au tarif du modèle le plus cher essayé
export function pireCents(modeles, entree, sortieMax) {
  return Math.max(...modeles.map(m => coutCents(m, entree, sortieMax)));
}
