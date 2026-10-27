// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { $ } from '../racine.js';
import { I, svg } from '../icones.js';
import { auth, demoEtab, view } from '../data/etat.js';
import { MAGASINS, NOMS, plateforme, versLeMagasin } from '../plateformes.js';
import { esc } from '../core/coeur-sync.js';
import { pubTete } from './connexion.js';
import { cartePassage, lierPassage } from './passage.js';

/* ══════════ un téléphone dans son navigateur : son magasin (2026-10-27) ══════════
   Décidé le 2026-10-27 : sur un téléphone ou une tablette, Folio est l'app
   des magasins, jamais le site. Le compte se crée ou s'ouvre sur le site ;
   une fois connecté, un téléphone ne voit plus que cet écran — l'app de son
   magasin, et le code qui attendait (une classe, une partie, un club), à
   recopier dans l'app (la carte de passage, ui/passage.js). Rien ne se perd :
   l'écran ne déconnecte pas, les écritures en attente partent comme
   d'habitude, et les mentions légales restent lisibles.

   Endormi tant que MAGASINS est vide (src/plateformes.js) : d'ici là, la
   version web reste, au téléphone aussi. La démo sans compte n'est pas
   concernée — elle n'a pas de compte à ouvrir dans l'app. */

const ici = () => plateforme({ ua: navigator.userAgent, touches: navigator.maxTouchPoints || 0,
  capacitor: window.Capacitor && window.Capacitor.getPlatform ? window.Capacitor.getPlatform() : null });

export const auMagasin = () => !!auth && !demoEtab && view.name !== 'legal' && versLeMagasin(ici());

// habillé comme la connexion (enveloppe .pub, carte .login) : aucune feuille à lui
export function magasinView() {
  const p = ici();
  $.innerHTML = `<div class="pub pub-connexion">
    ${pubTete(false)}
    <div class="pub-duo"><div class="login">
      <h1 class="lt">Folio est une app.</h1>
      <p class="lsub">Ton compte est prêt : télécharge Folio et connecte-toi, tes livres t’y attendent.</p>
      ${cartePassage()}
      <a class="cta" href="${esc(MAGASINS[p.os])}" rel="noopener">${svg(I.down)}Télécharger sur ${esc(NOMS[p.os])}</a>
    </div></div>
  </div>`;
  lierPassage();
}
