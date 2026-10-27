// Les icônes de l'app installée (public/icons/*.png) : le logo vectoriel
// (public/site/icone.svg, tracé par tools/logo.py) photographié par le
// navigateur, à chaque taille. Un carré plein, sans coins transparents :
// iOS et Android découpent eux-mêmes l'icône à leur forme (un coin
// transparent devient noir sur iPhone). L'icône « maskable » garde le
// dessin dans le cercle central (80 % du côté), que tout masque respecte.
// Lancer après tools/logo.py :  node tools/icones.js
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';

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
await navigateur.close();
