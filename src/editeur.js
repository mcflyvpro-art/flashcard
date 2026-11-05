/* L'éditeur de Mirandola, son contact et ce que la loi demande d'afficher —
   un fichier sans aucune dépendance, comme racine.js : les textes du cadre
   (ui/legal-textes.js, chargés à la demande) s'en servent au niveau module,
   et ui/connexion.js vérifie dès le démarrage qu'ils sont remplis.

   Les textes vivent dans le code plutôt que sur un site à part : il faut
   pouvoir les lire AVANT de créer un compte ou de payer — un consentement
   donné sans avoir pu lire n'en est pas un — et l'app doit rester entière
   hors réseau.

   Les passages entre ⟦crochets⟧ demandent une information que seul
   l'éditeur possède : ils se remplissent le jour où l'entreprise est
   immatriculée (son extrait Kbis ou son avis de situation SIRENE donne tout,
   sauf le médiateur, qu'on choisit et qui donne son adresse à l'adhésion).
   Tant qu'il en reste un, ces textes ne sont pas opposables et la vente ne
   doit pas ouvrir. Le reste de l'identité (forme, siège, immatriculation,
   TVA, directeur de la publication, médiateur, hébergeur) est dans
   src/entreprise.js : seuls les textes du cadre, chargés à la demande, la
   lisent — ici, elle pèserait sur le démarrage. Les mêmes informations se
   saisissent aussi dans la console de l'éditeur (Entreprise), pour les
   factures : les deux doivent dire la même chose. */
export const EDITEUR = '⟦raison sociale de l’éditeur⟧';

// une redirection d'OVH vers la boîte de l'éditeur (docs/COURRIELS.md)
export const CONTACT = 'contact@mirandola.fr';
