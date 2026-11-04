// IndexNow (2026-11-02, docs/SEO.md) : prévenir Bing, Yandex, Seznam et
// Naver qu'une page du site a changé, au lieu d'attendre leur prochain
// passage. Google n'y participe pas (pour lui : la Search Console et le
// sitemap). La clé n'a rien de secret : elle est publiée exprès à la racine
// du site (public/<clé>.txt), c'est ce qui prouve que le site est à nous.
//
// À lancer après un déploiement qui change le texte d'une page :
//   node tools/indexnow.js                 toutes les pages du site
//   node tools/indexnow.js /tarifs /       celles-là seulement
import { readdirSync } from 'node:fs';
import { PAGES, SITE } from '../src/site/pages.js';

const cle = readdirSync('public').find(f => /^[0-9a-f]{32}\.txt$/.test(f))?.slice(0, -4);
if (!cle) throw new Error('aucune clé IndexNow dans public/ (un fichier <32 signes hexadécimaux>.txt qui contient son nom)');

const voulues = process.argv.slice(2);
const urlList = PAGES.filter(p => !voulues.length || voulues.includes(p.chemin)).map(p => SITE + p.chemin);
if (!urlList.length) throw new Error('aucune de ces adresses n’est une page du site : ' + voulues.join(' '));

const r = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: new URL(SITE).host, key: cle, keyLocation: `${SITE}/${cle}.txt`, urlList })
});
/* 200 : reçu ; 202 : reçu, la clé sera vérifiée plus tard ; 403 : la clé
   n'est pas (encore) en ligne sur le site ; 422 : une adresse hors du site. */
console.log(r.status, r.statusText, '·', urlList.length, 'adresse(s)');
if (r.status >= 300) process.exit(1);
