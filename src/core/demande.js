import { api } from './coeur-sync.js';

/* « Demander une démo » : la seule écriture ouverte sans compte (la clé
   anon suffit, demander_demo est freinée en base : 20 demandes par heure en
   tout, une par adresse et par jour). Rend le statut de la base. Pas de
   file d'attente hors ligne : sans réseau, l'écran le dit et rien n'est
   perdu, le formulaire reste rempli. */
export const demanderDemo = f => api('/rest/v1/rpc/demander_demo', 'POST', f);
