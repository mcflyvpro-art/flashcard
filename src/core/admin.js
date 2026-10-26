import { I } from '../icones.js';
import { adm, online, setAccounts, setAnimate, view } from '../data/etat.js';
import { render } from '../ui/bibliotheque.js';
import { toast } from '../ui/import-cartes.js';
import { api } from './coeur-sync.js';
import { messageErreur } from './eleve-classes.js';

/* ══════════ la console de l'éditeur : ce qui part et ce qui revient ══════════
   Chargé avec la console (ui/admin-console.js, à la demande). Tout passe
   par les fonctions admin_* et set_role, qui vérifient elles-mêmes que
   l'appelant est l'éditeur (is_admin) ; rien ici ne décide qui a le droit.
   Une écriture refuse hors ligne, comme dans la console du référent. */

const rpc = (nom, args) => api('/rest/v1/rpc/' + nom, 'POST', args || {});
const repeint = () => { if (view.name === 'admin') { setAnimate(false); render(); } };

export async function admOrgsPull() {
  try { adm.orgs = await rpc('admin_orgs') || []; } catch (e) { adm.orgs = adm.orgs || []; adm.err = 1; }
  repeint();
}

export async function admEtatPull() {
  try { adm.etat = (await rpc('admin_etat') || [])[0] || null; } catch (e) { adm.err = 1; }
  repeint();
}

export async function admComptesPull() {
  try { setAccounts(await rpc('admin_accounts') || []); } catch (e) { setAccounts([]); adm.err = 1; }
  repeint();
}

export async function admCharger() {
  await Promise.allSettled([admOrgsPull(), admEtatPull(), admComptesPull()]);
}

/* Une écriture : le message de la base est montré tel quel (« Un nom de 2 à
   120 caractères », « Des comptes existent… »), puis on relit le suivi. */
export async function admAgir(nom, args, bon) {
  if (!online) { toast(I.cloud, 'Hors ligne : la console demande le réseau'); return null; }
  try {
    const r = await rpc(nom, args);
    if (bon) toast(I.check, bon);
    await Promise.allSettled([admOrgsPull(), admEtatPull()]);
    return r === null || r === undefined ? true : r;
  } catch (e) {
    toast(I.x, messageErreur(e).slice(0, 120) || 'Impossible pour l’instant');
    return null;
  }
}

/* Le rôle d'un compte (set_role refuse qu'on se retire le sien). */
export async function admRole(cible, nouveau) {
  const r = await admAgir('set_role', { cible, nouveau }, 'Rôle enregistré');
  if (r) await admComptesPull();
  return r;
}
