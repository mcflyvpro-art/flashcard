// @ts-nocheck
/* Le morceau chargé à la demande par prof-porte.js : tout ce dont la porte
   a besoin, en un seul import. prof-actions.js pose en plus, à son
   évaluation, les écouteurs de l'espace (clics, saisies, relève des
   demandes) — ils n'existent donc que chez qui a ouvert l'espace, comme sa
   feuille de style, que Vite sert avec ce morceau. */
import './prof-espace.css';
export { profAccueilView, profAgendaView } from './prof-accueil.js';
export { profClasseView } from './prof-classe.js';
export { paintMenuProf } from './prof-feuilles.js';
export { allerAccueil, donnerLivre, ouvrirAgenda, ouvrirClasse, rejoindreCollegue } from './prof-actions.js';
