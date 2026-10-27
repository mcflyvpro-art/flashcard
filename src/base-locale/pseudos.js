// Les pseudos (migration 20261027090000) rejoués en mémoire, pour la démo
// et les parcours : la règle (src/pseudo.js, la même que la base),
// l'unicité au point et au tiret bas près, la réserve de 30 jours d'un
// pseudo quitté, deux changements par semaine, et un pseudo d'office pour
// chaque nouvelle ligne de profil — ce que l'écran affiche en dépend. Les
// droits par colonne se prouvent en base (supabase/tests/pseudos.sql) ; on
// refuse seulement, comme elle, qu'on écrive le pseudo par l'API brute.
import { cle, motif, proposer } from '../pseudo.js';

const JOUR = 864e5;
const tab = (store, name) => (store.tables[name] = store.tables[name] || []);
const hasard = n => Math.floor(Math.random() * n);

/* pris : par un autre compte, ou quitté par un autre il y a moins de 30 jours */
function pris(store, h, pour) {
  const k = cle(h);
  return tab(store, 'profiles').some(p => p.id !== pour && p.handle && cle(p.handle) === k)
    || tab(store, 'pseudo_journal').some(j => j.user_id !== pour && j.ancien && cle(j.ancien) === k
      && Date.now() - Date.parse(j.cree_le) < 30 * JOUR);
}

/* un pseudo libre tiré d'un prénom, des chiffres s'il le faut (`pseudo_neuf`) */
export function pseudoNeuf(store, base, pour) {
  const b = proposer(base);
  let k = b, n = 0;
  while (motif(k) !== 'ok' || pris(store, k, pour)) {
    n++;
    k = b + (n <= 20 ? 10 + hasard(90) : 1000 + hasard(9000));
  }
  return k;
}

/* L'API brute n'écrit plus le pseudo : la vraie base répond 42501. */
export const ecritPseudo = body => [].concat(body || []).some(r => r && Object.prototype.hasOwnProperty.call(r, 'handle'));
export const REFUS = [403, { code: '42501', message: 'permission denied for table profiles' }];

function libre(store, p, uid) {
  const h = String(p || '').trim().toLowerCase().replace(/^@+/, '');
  const m = motif(h);
  if (m !== 'ok') return { statut: m, pseudo: h };
  const moi = (tab(store, 'profiles').find(x => x.id === uid) || {}).handle;
  if (moi === h) return { statut: 'meme', pseudo: h };
  if (pris(store, h, uid)) return { statut: 'pris', pseudo: h, suggestion: pseudoNeuf(store, h, uid) };
  return { statut: 'ok', pseudo: h };
}

function changer(store, p, uid) {
  const v = libre(store, p, uid);
  if (v.statut !== 'ok') return v;
  const recents = tab(store, 'pseudo_journal').filter(j => j.user_id === uid && Date.now() - Date.parse(j.cree_le) < 7 * JOUR)
    .map(j => Date.parse(j.cree_le)).sort((a, b) => b - a).slice(0, 2);
  if (recents.length >= 2) return { statut: 'trop', pseudo: v.pseudo, jusqua: new Date(Math.min(...recents) + 7 * JOUR).toISOString() };
  const profils = tab(store, 'profiles'), moi = profils.find(x => x.id === uid);
  const ancien = moi ? moi.handle : null;
  if (moi) moi.handle = v.pseudo;
  else profils.push({ id: uid, email: (store.users.find(u => u.id === uid) || {}).email || '', handle: v.pseudo, name: null });
  tab(store, 'pseudo_journal').push({ id: tab(store, 'pseudo_journal').length + 1, user_id: uid, ancien, nouveau: v.pseudo,
    cree_le: new Date().toISOString() });
  return { statut: 'ok', pseudo: v.pseudo };
}

/* Rend [statut, corps] pour une fonction connue, `null` sinon. */
export function rpcPseudos(store, nom, b, user) {
  const c = b || {}, uid = user.id;
  const f = {
    pseudo_libre: () => libre(store, c.p, uid),
    changer_pseudo: () => changer(store, c.p, uid),
    find_user: () => tab(store, 'profiles')
      .filter(p => p.id !== uid && p.handle && cle(p.handle) === cle(String(c.q || '').trim().replace(/@/g, '')))
      .slice(0, 1).map(p => ({ id: p.id, handle: p.handle, name: p.name || p.handle }))
  }[nom];
  return f ? [200, f()] : null;
}
