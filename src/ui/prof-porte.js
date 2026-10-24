// @ts-nocheck
import { $ } from '../racine.js';
import { I } from '../icones.js';
import { setMenu, view } from '../data/etat.js';
import { go, render } from './bibliotheque.js';
import { toast } from './import-cartes.js';

/* ══════════ la porte de l'espace professeur ══════════
   L'espace professeur (quatre écrans, leurs feuilles, le générateur de QR)
   ne sert qu'aux professeurs : un élève qui ouvre l'app en 4G n'a pas à le
   télécharger au démarrage (budget de M08.T2, tools/budget.js). Il vit
   donc dans un morceau à part, chargé au premier besoin. Le service worker
   le met en cache avec tout le reste du build (vite.config.js prend chaque
   fichier du bundle) : une fois l'app installée, il s'ouvre hors ligne
   comme le reste. Le reste de l'app ne parle à l'espace que par ici. */
let espace = null, attente = null;

export function chargerEspace() {
  if (espace) return Promise.resolve(espace);
  if (!attente) {
    attente = import('./prof-espace.js').then(m => (espace = m)).catch(() => {
      attente = null;                    // la prochaine demande réessaiera
      toast(I.cloud, 'Espace professeur indisponible sans connexion');
      return null;
    });
  }
  return attente;
}

/* Un écran de l'espace demandé avant que le morceau soit là : un squelette
   de chargement, puis le vrai rendu dès qu'il arrive — si l'on n'est pas
   parti ailleurs entre-temps. */
const vue = nom => () => {
  if (espace) return espace[nom]();
  $.innerHTML = '<div class="pf"><main class="pf-main"><div class="pf-load"><i></i><i></i><i></i></div></main></div>';
  chargerEspace().then(m => {
    if (m && /^prof/.test(view.name)) render();
    else if (!m && /^prof/.test(view.name)) go('home');
  });
};

export const profAccueilView = vue('profAccueilView');
export const profAgendaView = vue('profAgendaView');
export const profClasseView = vue('profClasseView');

export const allerAccueil = () => chargerEspace().then(m => m && m.allerAccueil());
export const donnerLivre = d => chargerEspace().then(m => m && m.donnerLivre(d));
export const rejoindreCollegue = code => chargerEspace().then(m => m && m.rejoindreCollegue(code));

/* Les feuilles de l'espace ne s'ouvrent que depuis l'espace : le morceau est
   forcément là. Sinon (état restauré d'ailleurs), on referme. */
export function paintMenuProf(w) {
  if (espace) return espace.paintMenuProf(w);
  setMenu(null);
}
