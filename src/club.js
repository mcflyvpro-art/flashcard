/* L'identité d'un club et les classements du cercle (2026-10-24) — module
   pur, testé dans test/club.test.js. Un club se reconnaît d'un coup d'œil :
   un emblème, une couleur (les jetons de src/jeton.js, communs aux classes
   et aux personnes), une devise, que son chef choisit. */

export const NOM_MAX = 40, DEVISE_MAX = 90;

export function nomClubValide(s) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length >= 2 && t.length <= NOM_MAX;
}

export const deviseValide = s => String(s || '').trim().length <= DEVISE_MAX;

// le code d'invitation d'un club : 8 symboles, lu par paquets de 4
export const codeClubLisible = c => {
  const k = String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return k.length > 4 ? k.slice(0, 4) + '-' + k.slice(4) : k;
};
export const codeClubDepuisTexte = s => {
  const m = String(s || '').match(/[?&]club=([A-Za-z0-9-]+)/);
  return String(m ? m[1] : s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
};

export function lienClub(adresse, code) {
  const u = new URL(adresse);
  u.search = ''; u.hash = '';
  u.searchParams.set('club', codeClubDepuisTexte(code));
  return u.toString();
}

/* Un classement : places partagées à égalité, la barre de chacun relative
   au premier, et la ligne de qui regarde repérée. `cle` est le nombre qui
   classe (pages de la semaine, score d'une partie). */
export function classement(rows, cle = 'n', moi = null) {
  const tri = (rows || []).slice().sort((a, b) => (+b[cle] || 0) - (+a[cle] || 0));
  const haut = Math.max(1, +(tri[0] || {})[cle] || 0);
  let prec = null, place = 0;
  return tri.map((r, i) => {
    const v = +r[cle] || 0;
    if (prec === null || v !== prec) { place = i + 1; prec = v; }
    return { ...r, place, part: Math.max(v ? 4 : 0, Math.round(v / haut * 100)),
             moi: moi != null && (r.uid === moi || r.user_id === moi || r.moi === true) };
  });
}

// une médaille pour les trois premiers (1 or, 2 argent, 3 bronze), 0 sinon : l'écran la dessine
export const medaille = p => (p >= 1 && p <= 3 ? p : 0);

export const pourcent = (ok, n) => n ? Math.round(ok / n * 100) : 0;

/* « 3e sur 12 » : ce qu'une carte de club dit de soi. */
export const rangTexte = (rang, total) => !total ? '' : rang === 1 ? `1er sur ${total}` : `${rang}e sur ${total}`;
