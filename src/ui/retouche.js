// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { I, svg } from '../icones.js';
import { demoEtab, ia, menu, offre, view } from '../data/etat.js';
import { deck, esc, plur, pushUndo, saveDeck, uid } from '../core/coeur-sync.js';
import { iaPull } from '../core/abonnement.js';
import { etatIA } from '../ia-mois.js';
import { aChange, appliquer, bilanTexte, pourIA, retouchable } from '../retouche.js';
import { render } from './bibliotheque.js';
import { bride, envie } from './bridage.js';
import { markOver } from './carte-media.js';
import { contexte } from './creation.js';
import { toast } from './import-cartes.js';
import { mountMenu } from './menus-a.js';
import { monter, repeindre } from './prompt-ia.js';
import './retouche.css';

/* ══════════ modifier un paquet entier avec l'IA (2026-11-07) ══════════
   Demandé : « pouvoir éditer un paquet directement avec l'IA, par prompt ;
   que pour Mirandola+ et Infini, pareil limité ». La barre de l'IA de la
   création (ui/prompt-ia.js), dans une feuille ouverte depuis la page du
   paquet : on écrit ce qu'on veut (« corrige les fautes », « ajoute 10
   cartes », « plus courtes »), l'IA rend la liste entière, et src/retouche.js
   la remet dans le paquet — une carte gardée ou corrigée garde son état
   d'apprentissage, ses images, ses sons. Une génération du mois par envoi,
   comme à la création (la pastille) ; « Annuler » repose le paquet d'avant,
   état compris. Chargé à la demande par sa porte, ui/retouche-porte.js :
   rien d'autre ne doit importer ce fichier. */

const PUCES = ['Corrige les fautes', 'Plus courtes', 'Ajoute 10 cartes', 'Ajoute un exemple au verso', 'Inverse recto et verso'];
const etats = {};                       // la conversation de chaque paquet, le temps de la session
const copies = {};                      // le paquet d'avant la dernière retouche, pour « Annuler »

/* La feuille se mesure dès qu'elle est posée (ui/menus-a.js, pour glisser
   d'une hauteur à l'autre) ; la barre ne s'y dessine qu'ensuite. Sa place
   lui est donc gardée à la hauteur qu'elle avait au dessin d'avant. */
let hauteurBarre = 0;

const iaPayante = () => !!demoEtab || bride('ia');
const etatDuMois = () => (iaPayante() ? null : etatIA(ia, offre));
const niveau = () => (offre && offre.niveau) || 'plus';

function refus(d) {
  const r = retouchable(d.cards, niveau());
  if (r.ok) return '';
  if (r.raison === 'devoir') return 'Un devoir ne se retouche pas : chaque carte compte pour ton professeur.';
  return `Ce paquet a ${d.cards.length} cartes : l’IA en retouche ${r.max} au plus d’un coup${niveau() === 'infini' ? '' : ' (300 avec Mirandola Infini)'}.`;
}

function contexteDe(id) {
  return {
    etatPrompt: neuf => (etats[id] = etats[id] || neuf()),
    puces: PUCES,
    contexte: () => contexte(deck(id)),
    etat: etatDuMois,
    bloque: () => {
      const d = deck(id), e = etatDuMois();
      if (iaPayante()) return { cle: 'plus' };
      if (e && e.cle === 'ferme') return { cle: 'ferme', texte: e.texte };
      const r = d ? refus(d) : 'Ce paquet n’existe plus.';
      return r ? { cle: 'ferme', texte: r } : null;
    },
    debloquer: () => {
      if (iaPayante()) return envie('ia');
      const b = contexteDe(id).bloque();
      if (b && b.texte) toast(I.x, b.texte);
    },
    texte: () => '',
    viderTexte: () => {},
    liste: () => { const d = deck(id); return d ? pourIA(d.cards) : []; },
    ajouter: () => ({ n: 0, dup: 0, big: 0 }),
    // la liste entière que rend l'IA : les cartes trop longues restent dehors, le reste remplace le paquet
    remplacer: cartes => {
      const d = deck(id);
      if (!d) return { big: 0, dit: 'Ce paquet n’existe plus.' };
      const tri = cartes.map(c => ({ f: c.f, b: c.b }));
      markOver(tri);
      const bonnes = tri.filter(c => !c.big), big = tri.length - bonnes.length;
      // une liste vide n'efface jamais un paquet : l'IA a dû mal comprendre
      if (!bonnes.length && d.cards.length) return { big, dit: 'L’IA n’a rendu aucune carte : ton paquet n’a pas bougé.' };
      const r = appliquer(d.cards, bonnes, uid);
      if (!aChange(r.bilan)) { copies[id] = null; return { big, dit: bilanTexte(r.bilan) }; }
      copies[id] = JSON.parse(JSON.stringify(d.cards));
      pushUndo('Retouche par l’IA', [id]);
      d.cards = r.cartes;
      saveDeck(d); render();
      return { big, dit: bilanTexte(r.bilan) };
    },
    annuler: () => {
      const d = deck(id);
      if (!d || !copies[id]) return;
      d.cards = copies[id]; copies[id] = null;
      saveDeck(d); render();
    }
  };
}

export function peindre(w) {
  const d = deck(view.id);
  if (!d) return;
  w.innerHTML = `<div class="scrim" data-mact="close"></div>
    <div class="menu retouche">
      <div class="mhd">${svg(I.spark)}<span class="mhx"><b>Modifier avec l’IA</b><i>${esc(d.name)} · ${plur(d.cards.length, 'carte')}</i></span></div>
      <div class="pi" id="rtpi" style="min-height:${Math.round(hauteurBarre)}px"></div>
    </div>`;
  mountMenu(w);                         // la feuille passe dans la page : on y cherche la barre
  const n = document.getElementById('rtpi');
  if (!n) return;
  monter(n, contexteDe(d.id));
  n.style.minHeight = '';
  hauteurBarre = n.getBoundingClientRect().height;
}

// à l'ouverture : l'IA du mois relue (un abonnement pris ailleurs, le mois qui change)
export function relire() {
  iaPull().then(() => { if (menu === 'retouche') repeindre(true); })
    .catch(() => { /* hors ligne : la pastille garde ce qu'on savait */ });
}
