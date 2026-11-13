import { auth, online } from '../data/etat.js';
import { api, enqueue, subj, uid } from './coeur-sync.js';
import { aiCall, shrink } from '../ui/import-cartes.js';
import { MAX_ENVOI, MAX_ENVOI_OFFERT, ligneExamen, lireCorrection, lireSujet, pagesPourSujet } from '../examen-blanc.js';
import { examensOfferts } from '../ui/examen-porte.js';

/* L'examen blanc de Mirandola Infini (2026-11-06) : le transport. Chargé
   avec son écran (ui/examen-blanc.js), jamais au démarrage. L'IA compose,
   l'IA corrige — deux générations du mois —, et ce qu'elle rend est relu
   par src/examen-blanc.js avant d'être montré. Le résultat part par la file
   d'écriture : un examen corrigé ne se perd pas si le réseau tombe juste
   après. */

// l'historique de chaque livre, lu une fois par ouverture
const historiques = new Map();

export const historiqueDe = deckId => historiques.get(deckId) || null;

export async function examensPull(deckId) {
  if (!online || !auth) return historiqueDe(deckId);
  try {
    const rows = await api(`/rest/v1/examens?deck_id=eq.${deckId}&select=id,created_at,note,questions,justes,copie,detail`
      + '&order=created_at.desc&limit=30');
    const locaux = (historiqueDe(deckId) || []).filter(e => e.local && !(rows || []).some(r => r.id === e.id));
    historiques.set(deckId, [...locaux, ...(rows || []).map(r => ({ ...r, note: Number(r.note) }))]);
  } catch (e) {
    // pas de table encore, ou hors ligne : l'historique attend, l'examen reste possible
    console.warn('examens', e && e.message);
  }
  return historiqueDe(deckId);
}

// le contexte que l'IA reçoit pour viser le bon niveau
const contexte = d => [d.name, d.subject ? subj(d.subject).name : ''].filter(Boolean).join(' · ').slice(0, 200);

/* Le sujet : les pages qui résistent d'abord (pagesPourSujet), puis ce que
   l'IA en a fait, relu. Rend aussi les pages envoyées, par lesquelles la
   correction retrouve les pages à revoir. */
export async function composer(d, n) {
  const envoyees = pagesPourSujet(d.cards, examensOfferts() === Infinity ? MAX_ENVOI : MAX_ENVOI_OFFERT);
  const j = await aiCall({ op: 'examen', n, hint: contexte(d), cards: envoyees.map(({ f, b }) => ({ f, b })) }, 'brut');
  const sujet = lireSujet(j.sujet, envoyees, n);
  if (!sujet.length) throw new Error('empty');
  return { sujet, envoyees };
}

/* La correction d'une copie tapée (`reponses`) ou photographiée (`photos`,
   des fichiers, réduits comme ceux de la création). */
export async function corriger(d, sujet, envoyees, { reponses, photos }) {
  const images = photos && photos.length ? await Promise.all(photos.map(shrink)) : [];
  const j = await aiCall({
    op: 'corriger', hint: contexte(d), sujet: sujet.map(({ q, attendu }) => ({ q, attendu })),
    reponses: images.length ? [] : reponses, photos: images
  }, 'brut');
  return lireCorrection(j.correction, sujet, envoyees);
}

/* Garder le résultat : dans l'historique tout de suite, en base par la
   file (une ligne qui ne se modifie jamais : « ignorer » au renvoi). */
export function garder(d, resultat, copie) {
  const row = { id: uid(), ...ligneExamen(d.id, resultat, copie, Date.now()) };
  enqueue('/rest/v1/examens', row, true);
  historiques.set(d.id, [{ ...row, local: true }, ...(historiqueDe(d.id) || [])]);
  return row;
}
