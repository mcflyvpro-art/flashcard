/* La racine DOM de l'app, seule — un module à part pour la même raison
   que icones.js : une constante sans dépendance ne doit jamais se
   retrouver de l'autre côté d'un cycle d'import (« Cannot access '$'
   before initialization »), ce qui arrive dès qu'un fichier l'utilise
   au niveau module plutôt que dans une fonction (ex. `$.addEventListener`
   posé une fois au démarrage). */
export const $ = document.getElementById('app');
