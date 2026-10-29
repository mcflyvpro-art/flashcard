/* ══════════ les codes qui attendent la connexion (2026-10-29) ══════════
   Sans dépendance. Un code de classe, de partie ou de club tapé sur le site
   (ou un QR scanné) avant d'avoir un compte attend ici que l'on soit
   connecté : `folio.rejoindre`, `folio.defi`, `folio.club`, `folio.plus`.
   Dans le stockage de l'origine (localStorage), pas celui de l'onglet :
   l'e-mail de confirmation d'une inscription s'ouvre souvent dans un autre
   onglet, et le code doit l'y retrouver. Une heure au plus — un code
   oublié ne doit pas ressurgir chez le prochain qui se connecte sur ce
   poste —, et repris une seule fois. Un code rangé par une version
   d'avant (sessionStorage, le texte seul) se lit encore. */
const DUREE = 3600e3;

/** @param {string} cle @param {string} v */
export function garder(cle, v) {
  try {
    localStorage.setItem(cle, JSON.stringify({ v: String(v), at: Date.now() }));
    sessionStorage.removeItem(cle);
  } catch (e) { /* stockage indisponible : le code ne survivra pas à la connexion */ }
}

/** @param {string} cle @returns {string} */
export function lire(cle) {
  try {
    const brut = localStorage.getItem(cle);
    if (brut) {
      const o = JSON.parse(brut);
      if (o && typeof o.v === 'string' && Date.now() - o.at < DUREE) return o.v;
      localStorage.removeItem(cle);                // passé l'heure : oublié
    }
    return sessionStorage.getItem(cle) || '';
  } catch (e) { return ''; }                        // illisible ou stockage refusé : rien n'attend
}

/** @param {string} cle */
export function oublier(cle) {
  try { localStorage.removeItem(cle); sessionStorage.removeItem(cle); }
  catch (e) { /* stockage indisponible : rien n'était gardé */ }
}

/* Reprendre un code : le lire et l'oublier d'un coup. */
/** @param {string} cle @returns {string} */
export function prendre(cle) {
  const v = lire(cle);
  if (v) oublier(cle);
  return v;
}
