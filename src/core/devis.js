import { I } from '../icones.js';
import { online } from '../data/etat.js';
import { toast } from '../ui/import-cartes.js';
import { api } from './coeur-sync.js';
import { messageErreur } from './eleve-classes.js';

/* ══════════ les devis : ce qui part et ce qui revient (2026-11-14) ══════════
   Chargé avec l'écran des devis (ui/devis.js, à la demande), pour l'éditeur
   comme pour le référent : la base décide qui a le droit (admin_devis,
   ref_devis_repondre… 20261114090000). Une écriture refuse hors ligne, comme
   dans les deux consoles : un devis s'émet, s'accepte et se facture contre
   l'état réel de la base. */

const rpc = (nom, args) => api('/rest/v1/rpc/' + nom, 'POST', args || {});

/* Une pièce entière : ses lignes, le vendeur et le client photographiés. */
export const lireDevis = did => rpc('devis', { did });

/* Une écriture : le message de la base est montré tel quel. */
export async function agirDevis(nom, args, bon) {
  if (!online) { toast(I.cloud, 'Hors ligne : un devis demande le réseau'); return null; }
  try {
    const r = await rpc(nom, args);
    if (bon) toast(I.check, bon);
    return r === null || r === undefined ? true : r;
  } catch (e) {
    /* 404 : la base ne connaît pas encore la fonction — la migration des
       devis (20261114090000) n'y est pas appliquée. On le dit, plutôt que le
       message de PostgREST sur son « schema cache ». */
    const absente = e && e.status === 404;
    toast(I.x, absente ? 'Les devis attendent leur migration en base (20261114090000)'
      : messageErreur(e).slice(0, 140) || 'Impossible pour l’instant');
    return null;
  }
}
