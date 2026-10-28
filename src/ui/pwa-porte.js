// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { $ } from '../racine.js';
import { I, svg } from '../icones.js';
import { demoEtab, view } from '../data/etat.js';
import { plateforme, porte } from '../plateformes.js';
import { estArme, installee } from './routeur.js';
import { render } from './bibliotheque.js';

/* ══════════ la porte d'installation (2026-10-28) ══════════
   Sur un téléphone ou une tablette, Folio ne s'ouvre que depuis son icône
   d'écran d'accueil (src/plateformes.js, `porte`). Dans le navigateur,
   l'app laisse place à ce seul écran : le geste qui l'installe, montré et
   animé pour CE navigateur (ui/pwa.js et sa feuille, chargés à la demande,
   préfixe pw-). Puis on ouvre Folio par son icône et l'on s'y connecte.

   Pourquoi fermer la porte plutôt que proposer : dans le navigateur, une
   app web n'a ni stockage durable (Safari efface ce qu'un site garde au
   bout de sept jours sans visite), ni rappels, ni plein écran ; et sur
   iPhone l'app installée a son stockage à elle — ce qu'on aurait fait dans
   Safari ne l'y suivrait pas.

   Rien ne la contourne, sauf ce qui se lit ou s'essaie sans compte : la
   démo, les textes du cadre, la demande de démo d'un établissement. Rien
   ne se perd non plus : une session ouverte dans le navigateur continue
   d'envoyer ce qui attendait (boot() suit son cours, seul l'écran change),
   et le code d'un lien attend l'app (ui/passage.js). */

const LIBRES = new Set(['decouvrir', 'legal', 'demande']);
let ici = null;
const appareil = () => ici || (ici = plateforme({ ua: navigator.userAgent, touches: navigator.maxTouchPoints || 0,
  capacitor: window.Capacitor && window.Capacitor.getPlatform ? window.Capacitor.getPlatform() : null }));

export function aInstaller() {
  if (demoEtab || LIBRES.has(view.name)) return false;
  /* Au tout premier écran, avant que le routeur n'ouvre celui de
     l'adresse, l'adresse dit encore où l'on va (/essayer, /mentions/…) */
  const chemin = !estArme() && view.name === 'login' ? location.pathname : '/app';
  return porte(appareil(), { installee: installee(), chemin });
}

let mod = null, charge = null;
const charger = () => charge || (charge = import('./pwa.js').then(m => (mod = m)));

export function porteView() {
  if (mod) return mod.pwaEcran();
  if (!$.querySelector('.pub')) $.innerHTML = `<div class="pub"><div class="pub-attente">${svg(I.down)}</div></div>`;
  charger().then(() => { if (aInstaller()) render(); }).catch(() => {
    /* hors ligne au premier passage : le geste, sans son animation */
    if (aInstaller()) $.innerHTML = `<div class="pub"><div class="pub-attente"><p style="max-width:280px;text-align:center">
      Ajoute Folio à ton écran d’accueil depuis le menu de ton navigateur, puis ouvre-le par son icône.</p></div></div>`;
  });
}
