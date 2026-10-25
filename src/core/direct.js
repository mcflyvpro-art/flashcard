import { direct, view } from '../data/etat.js';
import { api } from './coeur-sync.js';
import { decalage, signature } from '../defi.js';

/* ══════════ une partie en direct : réseau ══════════
   Chargé avec l'écran de la partie (ui/direct-ecran.js), jamais au
   démarrage. Chaque écran — l'hôte comme chaque joueur — interroge la base
   une fois par seconde (`salle_etat`) : c'est elle qui tient l'état de la
   partie, fait avancer la question quand le temps est écoulé et compte les
   points. Un téléphone qui rate une interrogation ne rate rien : la
   suivante lui donne l'état exact.

   Pourquoi pas une connexion qui pousse l'état (websocket) : sans
   bibliothèque, il faudrait réécrire un client du protocole Realtime de
   Supabase ; l'interrogation à la seconde tient une classe (30 téléphones,
   30 requêtes courtes par seconde) et ne casse pas quand le réseau du
   lycée coupe une seconde. L'équité ne dépend pas de ce délai : le chrono
   de chaque joueur part quand SON téléphone reçoit les choix (vu_at). */

const rpc = (f, b) => api('/rest/v1/rpc/' + f, 'POST', b || {});
let minuterie = 0, enCours = false, peindre = () => {};

const termine = e => e && /^(fini|absent|exclu)$/.test(e.etat);

// Un joueur qui tape sa réponse ne doit pas voir l'écran se redessiner sous
// ses doigts parce qu'un autre vient de répondre : son écran ne dépend pas
// du compte des réponses tant qu'il n'a pas répondu lui-même.
function signatureEcran(e) {
  const vue = !e.hote && e.etat === 'question' && e.moi && !e.moi.repondu ? { ...e, repondu: 0, joueurs: 0 } : e;
  return signature(vue) + '|' + (e.question ? e.question.enonce : '');
}

async function interroger() {
  if (enCours || !direct.id) return;
  enCours = true;
  const id = direct.id, t0 = Date.now();
  try {
    const e = await rpc('salle_etat', { salle: id });
    if (id !== direct.id) return;                    // on a changé de partie entre-temps
    direct.dec = decalage(e && e.maintenant, (t0 + Date.now()) / 2);
    direct.etat = e;
    const lost = direct.err >= 2;
    direct.err = 0;
    const sig = signatureEcran(e);
    if (sig !== direct.sig || lost) {
      if (direct.etat.etat !== 'question' || (direct.etat.rang !== Number(direct.sig.split('|')[1]))) direct.choix = null;
      direct.sig = sig; peindre();
    }
  } catch (x) {
    direct.err++;
    if (direct.err === 2) peindre();                 // deux échecs d'affilée : on le montre
  } finally { enCours = false; }
}

export function suivre(f) {
  peindre = f;
  arreter();
  const boucle = async () => {
    if (view.name !== 'direct' || !direct.id) return arreter();
    await interroger();
    const lent = termine(direct.etat) ? 15000 : document.hidden ? 4000 : 1000;
    minuterie = setTimeout(boucle, lent);
  };
  boucle();
}

export function arreter() { clearTimeout(minuterie); minuterie = 0; }

export const suivie = () => !!minuterie;

/* L'hôte avance : on dit à la base ce que son écran montrait, pour qu'un
   double appui n'avance qu'une fois. */
export async function avancer() {
  const e = direct.etat; if (!e || direct.envoi) return null;
  direct.envoi = true;
  try { return await rpc('salle_avancer', { salle: direct.id, depuis: e.etat, rang_vu: e.rang }); }
  finally { direct.envoi = false; await interroger(); }
}

// 'ok', 'deja', 'ferme' ou 'absent' ; jamais si c'est juste (la correction le dira)
export async function repondre(choix, texte) {
  const e = direct.etat; if (!e) return null;
  try {
    return await rpc('salle_repondre', { salle: direct.id, rang: e.rang, choix: choix == null ? null : choix,
      texte: texte == null ? null : texte });
  } finally { await interroger(); }
}

export async function exclure(uid) {
  try { await rpc('salle_exclure', { salle: direct.id, joueur: uid }); }
  finally { await interroger(); }
}

export const fermer = () => rpc('salle_fermer', { salle: direct.id });
