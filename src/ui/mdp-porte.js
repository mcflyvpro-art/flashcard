// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { $ } from '../racine.js';
import { auth, compte, demoEtab } from '../data/etat.js';
import { render } from './bibliotheque.js';

/* ══════════ le mot de passe à choisir (2026-10-29) ══════════
   Un compte ouvert par quelqu'un d'autre — l'éditeur pour un professeur
   particulier, le référent pour ses élèves et ses professeurs — arrive avec
   un mot de passe provisoire, montré une fois à qui l'a ouvert. Tant qu'il
   ne l'a pas remplacé (`mon_compte().provisoire`, migration 20261029090000),
   l'app ne montre que cet écran, quel que soit celui d'en dessous : comme la
   porte d'installation, render() le peint à la place. La base retire la
   marque d'elle-même quand le mot de passe change (déclencheur
   mdp_choisi) ; ici, on la retire aussi tout de suite, pour ne pas attendre
   la prochaine lecture du compte. Jamais dans la démo.

   Le même écran sert au lien « mot de passe oublié » (2026-10-29,
   ui/liens-entrants.js) : la session ouverte par le lien mène ici d'abord. */

// partagé avec l'écran (ui/mdp.js, chargé à la demande)
export const etatMdp = { recuperation: false };

export const demanderNouveauMdp = () => { etatMdp.recuperation = true; };
export const mdpAChoisir = () => !!(auth && !demoEtab && (etatMdp.recuperation || (compte && compte.provisoire)));

/* L'écran se charge la première fois qu'il le faut ; d'ici là, la page est
   vide (un instant : le morceau est petit, et en cache après une visite). */
let mod = null, charge = null;
export function mdpView() {
  if (mod) return mod.mdpView();
  $.innerHTML = '<div class="pub pub-connexion"></div>';
  if (!charge) charge = import('./mdp.js').then(m => { mod = m; render(); }).catch(() => { charge = null; });
}


