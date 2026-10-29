/* L'adresse de l'app, pour tout lien qui sort de l'app (partage, QR,
   invitation, carte de connexion) — un fichier sans aucune dépendance,
   comme racine.js.
   Pourquoi pas `location.origin` : ouverte depuis l'ancien GitHub Pages,
   une préversion Vercel ou l'alias *.vercel.app, l'app propageait cette
   adresse-là dans ses liens ; or une PWA installée (WebAPK Android)
   n'intercepte que les liens de SON origine, et un lien de préversion
   ouvrait le navigateur au lieu de l'app. Sous Capacitor, `location`
   vaudra `capacitor://localhost` : un lien partagé ne mènerait nulle part.
   Un seul domaine, donc, celui où l'app est installée et où les liens
   universels (iOS) et App Links (Android) seront déclarés : mirandola.fr
   depuis le 2026-10-28 ; l'ancien domaine renvoie tout vers lui depuis le
   2026-10-29 (vercel.json, src/sw.js). */
export const SITE = 'https://mirandola.fr/';
