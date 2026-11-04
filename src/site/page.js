/* Les pages du site autres que l'accueil (src/site/pages.js) : tout leur
   texte est dans leur HTML, que les moteurs lisent sans ce script ; il ne
   fait que répondre — l'en-tête et son menu, « J'ai un code », les
   apparitions, et sur les pages qui les portent la bascule des tarifs et
   le calculateur de Campus, et les tuiles et le bloc Campus repris de
   l'accueil (le calendrier, les rôles). docs/SEO.md. */
import { apparitions, calcul, calendrier, doc, entete, fenetreCode, onglets, sommeil, tarifs, videos } from './commun.js';

doc.classList.add('pret');
apparitions();
sommeil();
entete();
calendrier();
videos();
onglets();
tarifs();
calcul();
fenetreCode();
