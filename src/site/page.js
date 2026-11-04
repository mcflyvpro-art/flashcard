/* Les pages du site autres que l'accueil (src/site/pages.js) : tout leur
   texte est dans leur HTML, que les moteurs lisent sans ce script ; il ne
   fait que répondre — l'en-tête et son menu, « J'ai un code », les
   apparitions, et sur les pages qui les portent la bascule des tarifs et
   le calculateur de Campus. Ni scène, ni vidéo : une page de lecture se
   charge d'un coup. docs/SEO.md. */
import { apparitions, calcul, doc, entete, fenetreCode, tarifs } from './commun.js';

doc.classList.add('pret');
apparitions();
entete();
tarifs();
calcul();
fenetreCode();
