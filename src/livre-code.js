/* ══════════ le code d'un livre partagé (2026-11-05) ══════════
   Sans dépendance. Un livre se prête par un CODE : un lien seul ne suffisait
   pas — ouvert sur un téléphone sans l'app, il tombait sur la porte
   d'installation (ou la connexion) et se perdait en route ; sur iPhone,
   l'app de l'écran d'accueil ne voit jamais un lien. Un code, lui, se
   recopie partout : « J'ai un code », dans l'app, l'ouvre.

   Le code EST le jeton de `shares.token` (10 signes de l'alphabet des codes
   de classe, sans 0/O/1/I/L), écrit en capitales par paquets de quatre :
   « ABCD-EFGH-JK ». La base le range en minuscules : `tokDepuisTexte` y
   ramène tout ce qu'on tape ou colle (le code, avec ou sans tirets, ou un
   lien « …#s=… »). 31¹⁰ ≈ 8·10¹⁴ jetons : on ne tombe pas sur un livre en
   essayant. Les liens restent (`lienLivre`), et mènent au même code. */
export const LONGUEUR_LIVRE = 10;
const ALPHA = 'abcdefghjkmnpqrstuvwxyz23456789';

/** @param {string} s @returns {string} le jeton (minuscules), peut-être incomplet */
export function tokDepuisTexte(s) {
  const t = String(s || '');
  // un lien, puis un code écrit par paquets au milieu d'une phrase collée (« Code : ABCD-EFGH-JK »)
  const m = t.match(/[#?&](?:s|livre)=([A-Za-z0-9-]+)/) || t.match(/(?:^|[^A-Za-z0-9])([A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{2})(?![A-Za-z0-9])/);
  return (m ? m[1] : t).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, LONGUEUR_LIVRE);
}

/** @param {string} t */
export const tokComplet = t => typeof t === 'string' && t.length === LONGUEUR_LIVRE && [...t].every(c => ALPHA.includes(c));

/* Ce que l'on tape est-il le code d'un livre ? Un lien de livre, ou plus
   de huit signes (les codes d'établissement, de professeur et de club en
   ont huit, une partie six chiffres). */
/** @param {string} s */
export function estCodeLivre(s) {
  const t = String(s || '');
  if (/[#?&](?:s|livre)=/.test(t)) return true;
  if (/[?&](?:rejoindre|club|defi)=/.test(t)) return false;
  return t.toUpperCase().replace(/[^A-Z0-9]/g, '').length > 8;
}

/* « ABCD-EFGH-JK » : par quatre, comme les autres codes (la saisie ne
   saute pas d'une forme à l'autre au neuvième signe). */
/** @param {string} s */
export function codeLivre(s) {
  const k = tokDepuisTexte(s).toUpperCase();
  return (k.match(/.{1,4}/g) || []).join('-');
}

/** @param {string} site @param {string} tok */
export const lienLivre = (site, tok) => String(site).replace(/[?#].*$/, '') + '#s=' + tokDepuisTexte(tok);
