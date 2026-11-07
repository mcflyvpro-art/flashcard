/* ══════════ tous les comptes, vus par l'éditeur (2026-11-05) ══════════
   Sans dépendance, pur et testé (test/comptes.test.js). La base rend chaque
   compte avec de quoi le juger (admin_comptes, migration 20261105122753) ;
   ici, les règles du tri et des filtres de la console de l'éditeur. Un
   compte d'une app plus ancienne (admin_accounts : sans dernière connexion
   ni révisions) se trie quand même : ce qui manque compte pour rien. */

export const TRIS = {
  recent: 'Plus récents',
  ancien: 'Plus anciens',
  vu: 'Dernière connexion',
  revise: 'Dernière révision',
  revisions: 'Révisions',
  livres: 'Paquets',
  nom: 'Nom'
};

// une puce par filtre, dans cet ordre ; `test` dit si un compte y entre
export const FILTRES = {
  tous: ['Tous', () => true],
  gratuit: ['Gratuit', a => a.offre === 'gratuit'],
  plus: ['Mirandola+', a => a.offre === 'plus'],
  campus: ['Campus', a => a.offre === 'campus'],
  actifs: ['Actifs 30 j', (a, t) => !!a.revise && t - Date.parse(a.revise) <= 30 * 864e5],
  jamais: ['Jamais connectés', a => 'vu' in a && !a.vu],
  attente: ['Adresse à confirmer', a => a.confirme === false],
  suspendus: ['Suspendus', a => !!a.suspendu]
};

// sans casse ni accent : « Élodie » se trouve en tapant « elodie »
export const plat = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const date = x => (x ? Date.parse(x) || 0 : 0);
const nomDe = a => plat(a.name || a.handle || a.email);
const CLES = {
  recent: a => -date(a.cree),
  ancien: a => date(a.cree),
  vu: a => -date(a.vu),
  revise: a => -date(a.revise),
  revisions: a => -(+a.revisions || 0),
  livres: a => -(+a.livres || 0)
};

export function trierComptes(liste, tri = 'recent') {
  const l = [...(liste || [])];
  if (tri === 'nom') return l.sort((a, b) => nomDe(a).localeCompare(nomDe(b), 'fr'));
  const cle = CLES[tri] || CLES.recent;
  // à égalité, le plus récent d'abord : l'ordre ne saute pas d'un repeint à l'autre
  return l.sort((a, b) => cle(a) - cle(b) || date(b.cree) - date(a.cree) || String(a.id).localeCompare(String(b.id)));
}

export function filtrerComptes(liste, { role = '', filtre = 'tous', q = '' } = {}, maintenant = Date.now()) {
  const v = plat(q).trim(), test = /** @type {(a: any, t?: number) => boolean} */ ((FILTRES[filtre] || FILTRES.tous)[1]);
  return (liste || []).filter(a => (!role || a.role === role) && test(a, maintenant)
    && (!v || [a.name, a.handle, a.email, a.etablissement].some(x => plat(x).includes(v))));
}

// combien chaque puce en montrerait, le rôle et la recherche déjà appliqués
export function compterFiltres(liste, { role = '', q = '' } = {}, maintenant = Date.now()) {
  const base = filtrerComptes(liste, { role, q }, maintenant);
  return Object.fromEntries(Object.entries(FILTRES).map(([k, f]) => {
    const t = /** @type {(a: any, t?: number) => boolean} */ (f[1]);
    return [k, base.filter(a => t(a, maintenant)).length];
  }));
}

/* La durée d'une suspension, choisie en un geste. « Sans fin » : une date
   assez lointaine pour Supabase Auth, qui ne connaît que « jusqu'à ». */
export const SUSPENSIONS = { 1: '1 jour', 7: '7 jours', 30: '30 jours', 0: 'Sans fin' };
export function finSuspension(jours, maintenant = Date.now()) {
  const j = +jours;
  return new Date(j > 0 ? maintenant + j * 864e5 : Date.UTC(2999, 11, 31)).toISOString();
}
export const sansFin = jusqua => !!jusqua && new Date(jusqua).getUTCFullYear() >= 2999;

/* Le bilan d'une suppression par lots : combien sont partis, et le premier
   refus, dit tel que la base l'a écrit (« Son abonnement Mirandola+ court
   chez Stripe… »). */
export function bilanSuppression(resultats) {
  const ok = resultats.filter(r => r.ok).length, ko = resultats.filter(r => !r.ok);
  return { ok, ko: ko.length, motif: ko.length ? ko[0].motif || '' : '' };
}
