// Les icônes de l'app installée (public/icons/*.png) : le logo vectoriel
// (public/site/icone.svg, tracé par tools/logo.py) photographié par le
// navigateur, à chaque taille. Un carré plein, sans coins transparents :
// iOS et Android découpent eux-mêmes l'icône à leur forme (un coin
// transparent devient noir sur iPhone). L'icône « maskable » garde le
// dessin dans le cercle central (80 % du côté), que tout masque respecte.
// Lancer après tools/logo.py :  node tools/icones.js
// (il écrit aussi le favicon de la racine : favicon.ico, favicon-48.png,
// apple-touch-icon.png)
import { chromium } from '@playwright/test';
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';

const chrome = process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium';
const source = readFileSync('public/site/icone.svg', 'utf8');

/* Le carré à bords francs ; `reduire` resserre le dessin (pas le fond)
   autour du centre, pour l'icône maskable. */
function carre(reduire = 1) {
  const plein = source.replace(/ rx="114"/g, '');
  if (reduire === 1) return plein;
  const fonds = plein.lastIndexOf('fill="url(#halo)"/>') + 'fill="url(#halo)"/>'.length;
  return plein.slice(0, fonds) + `<g transform="translate(256 256) scale(${reduire}) translate(-256 -256)">`
    + plein.slice(fonds, plein.lastIndexOf('</svg>')) + '</g></svg>';
}

const ICONES = [
  ['icon-180.png', 180, 1], ['icon-192.png', 192, 1], ['icon-512.png', 512, 1], ['icon-maskable.png', 512, .78]
];

const navigateur = await chromium.launch({ executablePath: chrome });
const page = await navigateur.newPage();
for (const [nom, cote, reduire] of ICONES) {
  await page.setViewportSize({ width: cote, height: cote });
  const svg = carre(reduire).replace('width="512" height="512"', `width="${cote}" height="${cote}"`);
  await page.setContent(`<!doctype html><style>html,body{margin:0}svg{display:block}</style>${svg}`);
  writeFileSync('public/icons/' + nom, await page.screenshot({ omitBackground: false }));
  console.log(nom, cote);
}
/* Le favicon (2026-11-02, docs/SEO.md) : Google montre l'icône d'un site à
   côté de son résultat ; il la veut carrée, d'un multiple de 48 px, à une
   adresse qu'il peut lire. Le SVG suffit aux navigateurs, mais des robots
   et de vieux lecteurs demandent encore /favicon.ico et
   /apple-touch-icon.png à la racine — sans eux, la réécriture de
   vercel.json leur servait la page de l'app. */
const favicon = readFileSync('public/favicon.svg', 'utf8');
const pngs = [];
for (const cote of [16, 32, 48]) {
  await page.setViewportSize({ width: cote, height: cote });
  await page.setContent(`<!doctype html><style>html,body{margin:0;background:transparent}svg{display:block}</style>`
    + favicon.replace('width="512" height="512"', `width="${cote}" height="${cote}"`));
  pngs.push([cote, await page.screenshot({ omitBackground: true })]);
}
writeFileSync('public/favicon-48.png', pngs[2][1]);
/* Un .ico, ce sont des PNG mis bout à bout derrière un petit sommaire. */
const tete = Buffer.alloc(6 + 16 * pngs.length);
tete.writeUInt16LE(0, 0); tete.writeUInt16LE(1, 2); tete.writeUInt16LE(pngs.length, 4);
let decalage = tete.length;
pngs.forEach(([cote, png], i) => {
  const o = 6 + 16 * i;
  tete.writeUInt8(cote, o); tete.writeUInt8(cote, o + 1); tete.writeUInt16LE(1, o + 4); tete.writeUInt16LE(32, o + 6);
  tete.writeUInt32LE(png.length, o + 8); tete.writeUInt32LE(decalage, o + 12);
  decalage += png.length;
});
writeFileSync('public/favicon.ico', Buffer.concat([tete, ...pngs.map(x => x[1])]));
copyFileSync('public/icons/icon-180.png', 'public/apple-touch-icon.png');
console.log('favicon.ico (16, 32, 48), favicon-48.png, apple-touch-icon.png');
await navigateur.close();
