/* L'éditeur de Mirandola et son contact — un fichier sans aucune dépendance,
   comme racine.js : les textes du cadre (ui/legal-textes.js, chargés à la
   demande) s'en servent au niveau module, et ui/connexion.js vérifie dès le
   démarrage qu'ils sont remplis.

   Trois textes, lisibles sans compte et hors ligne. Ils vivent dans le
   code plutôt que sur un site à part pour deux raisons : il faut pouvoir
   les lire AVANT de créer un compte — un consentement donné sans avoir pu
   lire n'en est pas un — et l'app doit rester entière hors réseau.

   Les passages entre ⟦crochets⟧ demandent une information que seul
   l'éditeur possède. Tant qu'ils sont là, ces textes ne sont pas
   opposables : ils sont une ossature juste, pas un document signé. Faire
   relire le contrat de sous-traitance par un juriste avant tout
   établissement — pas ces trois pages-ci, qui tiennent debout seules. */
export const EDITEUR = '⟦nom ou raison sociale de l’éditeur⟧';

export const CONTACT = '⟦adresse de contact⟧';
