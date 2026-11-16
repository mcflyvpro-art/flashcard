/* ══════════ Mirandola+ : la base et la fonction de paiement (2026-10-27) ══════════
   Ce que ce compte ouvre se lit dans la base (mon_offre, migration
   20261027190000) ; payer et gérer passent par la fonction `paiement`
   (supabase/functions/paiement), qui rend l'adresse d'une page Stripe —
   l'app y envoie le navigateur, la carte ne passe jamais par Mirandola.

   Payer ne se met pas en file d'attente (règle 5) : c'est un geste qui
   n'a de sens qu'en ligne, maintenant — hors ligne, l'écran le dit. La
   réponse de mon_offre est gardée par compte (folio.offre.<uid>) pour
   s'afficher hors ligne ; jamais en démo, qui ne touche pas au stockage. */
import { auth, demoEtab, ia, offre, plus, setIa, setOffre } from '../data/etat.js';
import { lireOffre } from '../abonnement.js';
import { api, apiPage } from './coeur-sync.js';

const cle = () => 'folio.offre.' + (auth && auth.uid);

function offreRangee() {
  try { return JSON.parse(localStorage.getItem(cle()) || 'null'); }
  catch (e) { return null; }           // stockage refusé : on redemandera à la base
}

/* Ce qu'on savait, au démarrage, avant que la base réponde : l'app se
   bride (ou se pare de Mirandola+) dès le premier écran, hors ligne compris. */
export function offreLocale() {
  if (!auth || demoEtab || offre) return;
  const r = offreRangee();
  if (r) setOffre(lireOffre(r));
}

/* Ce que la base dit du compte. Une base qui n'a pas encore la fonction
   (migration pas appliquée : 404) ou une coupure : ce qu'on savait, sinon
   RIEN — une offre inconnue ne bride pas (ui/bridage.js) ; jamais une
   erreur à l'écran pour ça. */
/* Ce qui, dans l'offre, change ce que l'app ouvre : l'offre, le niveau,
   l'état et la formule de l'abonnement. Deux lectures de même signature,
   rien à repeindre. */
export const signatureOffre = o => (o ? [o.offre, o.niveau, o.abonnement && o.abonnement.statut,
  o.abonnement && o.abonnement.formule, o.abonnement && o.abonnement.finPrevue].join('|') : '');

export async function offrePull() {
  if (!auth) return offre;
  const avant = signatureOffre(offre);
  try {
    const r = await api('/rest/v1/rpc/mon_offre', 'POST', {});
    if (!r || typeof r !== 'object' || Array.isArray(r)) throw new Error('mon_offre');
    setOffre(lireOffre(r));
    /* L'offre a changé (un paiement, un Mirandola+ offert depuis la console) :
       l'IA du mois se relit avec elle. Sans ça, un compte passé de gratuit à
       Mirandola+ gardait le quota 0 de son ancienne offre, et ses onglets
       d'IA restaient grisés jusqu'au redémarrage (2026-11-07). */
    if (avant && signatureOffre(offre) !== avant) await iaPull();
    if (!demoEtab) {
      try { localStorage.setItem(cle(), JSON.stringify(r)); }
      catch (e) { /* stockage plein ou refusé : la prochaine ouverture redemandera */ }
    }
  } catch (e) {
    const r = demoEtab ? null : offreRangee();
    if (r) setOffre(lireOffre(r));
  }
  return offre;
}

/* Les cours mis en flashcards par l'IA ce mois-ci (2026-10-28), pour
   l'écran Mirandola+ : la table ai_usage, que chacun lit pour lui seul (RLS),
   le même compte que la fonction ai (une ligne par appel, depuis le 1er du
   mois en UTC). Rien si la base ne répond pas : l'écran tait la ligne. */
export async function iaMoisPull() {
  if (!auth || demoEtab) return null;
  const d = new Date(), debut = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().slice(0, 10);
  try {
    const r = await apiPage(`/rest/v1/ai_usage?select=id&day=gte.${debut}`, 0, 0);
    plus.ia = r ? r.total : null;
  } catch (e) { plus.ia = null; }       // hors ligne : la ligne de l'IA attendra la prochaine ouverture
  return plus.ia;
}

/* L'IA du mois (mon_ia, 2026-10-29) : ce qui reste, posé sur les onglets de
   la création qui passent par l'IA (src/ia-mois.js). Hors ligne, rien : les
   onglets restent sans pastille, et la fonction ai tranchera. */
export async function iaPull() {
  if (!auth || demoEtab) return ia;
  try {
    const r = await api('/rest/v1/rpc/mon_ia', 'POST', {});
    if (r && typeof r === 'object' && !Array.isArray(r)) setIa(r);
  } catch (e) { /* hors ligne, ou base sans la fonction : pas de pastille, rien de fermé */ }
  return ia;
}

/* Payer (Stripe, ou l'achat intégré de l'app des magasins) : core/vente.js,
   chargé avec l'écran Mirandola+ seulement. */
