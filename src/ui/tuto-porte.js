// @ts-nocheck — M06.T8 : la vérification douce (checkJs + JSDoc) ne couvre que src/core/
import { I } from '../icones.js';
import { demoEtab, menu, myRole, prefs, tuto, view } from '../data/etat.js';
import { atSchool, eleveDeClasse } from './classement.js';
import { ouvrirBienvenue } from './bienvenue-porte.js';
import { toast } from './import-cartes.js';
import { aInstaller } from './pwa-porte.js';
import { mdpAChoisir } from './mdp-porte.js';

/* ══════════ la porte du tuto (2026-10-27) ══════════
   Le tuto (ui/tuto.js, sa feuille tuto.css, préfixe tu-, et ses scénarios
   de src/tuto.js) ne sert qu'une fois par compte, ou quand on le redemande :
   il se charge à la demande. Rien d'autre ne doit importer ui/tuto.js —
   passer par ici. */
let mod = null, charge = null;

function charger() {
  if (mod) return Promise.resolve(mod);
  if (!charge) charge = import('./tuto.js').then(m => (mod = m)).catch(e => { charge = null; throw e; });
  return charge;
}

/* `rejoue` : demandé (les Réglages, le bandeau de la démo) — un échec se dit. */
export function lancerTuto(o = {}) {
  return charger().then(m => m.lancer(o))
    .catch(() => { if (o.rejoue) toast(I.x, 'Le tuto n’a pas pu s’ouvrir : vérifie ta connexion'); });
}

export function arreterTuto() { if (mod) mod.arreter(); }

/* Les écrans où l'on arrive : le tuto ne part que de là, jamais par-dessus
   un livre ouvert, une lecture ou une feuille — on est venu pour autre chose. */
const ARRIVEES = ['home', 'classes', 'prof', 'ref'];

/* La première fois : un élève passe d'abord par son accueil (ui/bienvenue.js),
   qui enchaîne sur le tuto ; un professeur et un référent n'ont que le tuto ;
   l'éditeur rien, un rôle inconnu non plus. */
function premiereFois() {
  // un mot de passe provisoire d'abord : ui/mdp-porte.js relance le tuto une fois choisi
  if (prefs.tuto || tuto || demoEtab || menu || mdpAChoisir()) return;
  const eleve = myRole === 'eleve';
  if (!eleve && myRole !== 'prof' && !(myRole === 'ref' && atSchool())) return;
  if (eleve && !prefs.bienvenue) {
    if (!['home', 'classes'].includes(view.name)) return;
    return ouvrirBienvenue(eleveDeClasse() ? 'classe' : 'perso', () => lancerTuto());
  }
  if (ARRIVEES.includes(view.name)) lancerTuto();
}

/* Au démarrage et à la connexion : `pret` est la promesse d'accueil() — le
   rôle et l'établissement connus, pas un délai qui parie sur le réseau. Un
   lien de partage ou un raccourci qui s'ouvre passe avant. */
export function maybeTuto(pret) {
  if (prefs.tuto || tuto || demoEtab || location.hash || location.search.includes('go=') || aInstaller()) return;
  Promise.resolve(pret).catch(() => { /* accueil() a échoué : on décide quand même, sur ce qu'on sait */ })
    .then(() => setTimeout(premiereFois, 600));
}

/* Entré par un code (ui/code-entree.js) : un compte neuf qui devient élève
   d'une classe, professeur ou référent a son accueil et son tuto à lui —
   une fois arrivé sur son écran (l'espace professeur se fait attendre). */
export function apresEntree() {
  if (prefs.tuto || tuto || demoEtab) return;
  let n = 0;
  const essai = () => {
    if (!ARRIVEES.includes(view.name) && n++ < 15) return setTimeout(essai, 200);
    premiereFois();
  };
  setTimeout(essai, 300);
}
