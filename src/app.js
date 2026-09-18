/* Point d'entrée : ne fait qu'importer les modules de l'app, chacun pour
   ses effets de bord (fonctions et écrans qu'il définit, écouteurs qu'il
   pose). C'est encore l'ordre du fichier unique d'avant M06.T3 — chaque
   module importe explicitement ce dont il a besoin des autres (voir
   l'en-tête de chacun), l'ordre d'import ici ne conditionne donc plus
   rien : seul `onboarding.js`, qui porte l'amorçage (section « démarrage »),
   doit s'évaluer après que tous les autres aient défini leurs fonctions —
   déjà garanti par le graphe d'imports ES, pas par cet ordre-ci. */
import './coeur-sync.js';
import './carte-media.js';
import './import-cartes.js';
import './bibliotheque.js';
import './connexion.js';
import './reglages-corbeille.js';
import './defis.js';
import './classement.js';
import './etablissement.js';
import './bilan-devoirs.js';
import './ecran-groupe.js';
import './menus-a.js';
import './menus-b.js';
import './menus-c.js';
import './revision.js';
import './quiz.js';
import './interactions.js';
import './onboarding.js';
