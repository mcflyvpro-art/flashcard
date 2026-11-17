/* ══════════ l'app des magasins (2026-11-16) ══════════
   Module pur, sans dépendance, testé (test/natif.test.js) : les règles de
   l'app native (Capacitor, docs/CAPACITOR.md) qui ne touchent ni le DOM ni
   le réseau.

   1. Les adresses de mirandola.fr qu'ouvre l'app installée (liens
      universels d'iOS, App Links d'Android), écrites une fois : le fichier
      apple-app-site-association (tools/natif/liens.js) et le manifeste
      d'Android (android/app/src/main/AndroidManifest.xml, gardé d'accord
      par le test) en dérivent. La racine en fait partie : c'est là que
      mènent les invitations (« ?rejoindre= », « ?defi= », « ?club= »), les
      paquets partagés (« #s= ») et les e-mails ; une personne qui a l'app y
      arrive connectée, comme l'aiguillage du site l'envoie déjà à l'app.
      Les pages du site (tarifs, moteur…) restent au navigateur.
   2. Ce qu'on fait d'un lien reçu : seulement un lien de mirandola.fr.
   Les produits des magasins (RevenueCat) sont dans src/magasin.js, chargé
   avec l'écran Mirandola+ : ce fichier-ci ne part qu'avec le pont natif. */

export const DOMAINE = 'mirandola.fr';

/* `exact` : l'adresse elle-même ; `prefixe` : elle et tout ce qui suit. */
export const CHEMINS_APP = [
  { exact: '/' },
  { prefixe: '/app' },
  { prefixe: '/eleve/' }, { prefixe: '/prof/' }, { prefixe: '/referent/' }, { prefixe: '/admin/' },
  { prefixe: '/demo/' }, { exact: '/essayer' },
  { exact: '/connexion' }, { exact: '/inscription' }, { prefixe: '/mentions/' }
];

/* Le lien que l'app sait suivre, ou null : un lien https de mirandola.fr
   (ou www.), sur une adresse de l'app. Un lien d'ailleurs (une page qui
   aurait réussi à se faire passer pour un lien de l'app) ne touche à
   rien. */
export function lienDeLApp(url) {
  let u;
  try { u = new URL(String(url)); } catch (e) { return null; }
  if (u.protocol !== 'https:' || (u.hostname !== DOMAINE && u.hostname !== 'www.' + DOMAINE)) return null;
  const p = u.pathname || '/';
  return CHEMINS_APP.some(c => (c.exact ? p === c.exact || p === c.exact + '/' : p.startsWith(c.prefixe))) ? u.href : null;
}

/* Le fichier apple-app-site-association : les mêmes adresses, pour l'app
   de cette équipe (l'identifiant d'équipe du compte Apple Developer). */
export function associationApple(equipe, appId = 'fr.mirandola.app') {
  if (!/^[A-Z0-9]{10}$/.test(String(equipe))) throw new Error('identifiant d’équipe Apple invalide (10 lettres ou chiffres)');
  const id = `${equipe}.${appId}`;
  const components = CHEMINS_APP.map(c => ({ '/': c.exact || c.prefixe + '*' }));
  return { applinks: { details: [{ appIDs: [id], components }] }, webcredentials: { apps: [id] } };
}

/* Le fichier assetlinks.json : l'app Android, signée de cette empreinte
   (SHA-256 de la clé qui signe ce que Google Play distribue). */
export function associationAndroid(empreintes, paquet = 'fr.mirandola.app') {
  const l = [].concat(empreintes).map(e => String(e).trim().toUpperCase());
  if (!l.length || l.some(e => !/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(e))) throw new Error('empreinte SHA-256 invalide (32 octets, AA:BB:…)');
  return [{ relation: ['delegate_permission/common.handle_all_urls'],
    target: { namespace: 'android_app', package_name: paquet, sha256_cert_fingerprints: l } }];
}
