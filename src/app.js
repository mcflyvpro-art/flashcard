/* Point d'entrée : ne fait qu'importer les modules de l'app, chacun pour
   ses effets de bord (fonctions et écrans qu'il définit, écouteurs qu'il
   pose). C'est encore l'ordre du fichier unique d'avant M06.T3 — chaque
   module importe explicitement ce dont il a besoin des autres (voir
   l'en-tête de chacun), l'ordre d'import ici ne conditionne donc plus
   rien : seul `onboarding.js`, qui porte l'amorçage (section « démarrage »),
   doit s'évaluer après que tous les autres aient défini leurs fonctions —
   déjà garanti par le graphe d'imports ES, pas par cet ordre-ci. */
import './core/coeur-sync.js';
import './ui/carte-media.js';
import './ui/import-cartes.js';
import './ui/bibliotheque.js';
import './ui/connexion.js';
import './ui/reglages-corbeille.js';
import './ui/defis.js';
import './ui/classement.js';
import './ui/etablissement.js';
import './ui/bilan-devoirs.js';
import './ui/ecran-groupe.js';
import './ui/menus-a.js';
import './ui/menus-b.js';
import './ui/menus-c.js';
import './ui/revision.js';
import './ui/quiz.js';
import './ui/interactions.js';
import './ui/onboarding.js';
