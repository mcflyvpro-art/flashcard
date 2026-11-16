// Les images de l'app des magasins (2026-11-16), toutes tirées des dessins
// de la marque — rien n'est dessiné à la main :
//   marque/natif/        les sources que lit @capacitor/assets pour écrire
//                        les icônes d'iOS et d'Android (icon-only,
//                        icon-foreground, icon-background) ;
//   marque/magasins/     ce que demandent les fiches : l'icône d'App Store
//                        Connect (1024, opaque, sans coins), celle de Google
//                        Play (512) et la bannière de Google Play (1024 × 500).
//
//   node tools/natif/ressources.js
//   npx @capacitor/assets@4.0.0 generate --assetPath marque/natif \
//     --iconBackgroundColor '#F6F5F1' --ios --android
//
// Pas d'image de lancement : l'écran de lancement est le papier seul, sans
// logo (décidé le 2026-11-16) — une couleur, pas un PNG de 2732 px. Sur
// iOS, ios/App/App/Base.lproj/LaunchScreen.storyboard ; sur Android,
// android/app/src/main/res/drawable/splash.xml et le thème de lancement.
// L'ouverture de l'app (app.html, #boot) commence par ce même papier, puis
// le logo y entre en glissant : un logo déjà posé par le lancement aurait
// sauté d'une place à l'autre au moment où la page prend la main. Android
// 12 et plus posent quand même l'icône de l'app au centre (le système
// l'impose), sur ce papier.
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const chrome = process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium';
const PAPIER = '#F6F5F1';
const icone = readFileSync('public/site/icone.svg', 'utf8');
const logo = readFileSync('public/site/logo.svg', 'utf8');

const sansCoins = icone.replace(/ rx="114"/g, '');
const finFonds = sansCoins.lastIndexOf('fill="url(#halo)"/>') + 'fill="url(#halo)"/>'.length;
const fermer = sansCoins.lastIndexOf('</svg>');
/* Le fond de l'icône (le papier et sa lumière), et le dessin seul, resserré
   au centre. @capacitor/assets pose ces deux images dans la partie visible
   de l'icône adaptative d'Android (un encart de 16,7 % dans le calque de
   108 dp), que chaque téléphone découpe à sa forme — rond, carré arrondi,
   goutte ; le cercle sûr y fait 92 % du côté. À 0,86, la pile de livres et
   son ombre y tiennent sous tous les masques. */
const fond = sansCoins.slice(0, finFonds) + '</svg>';
const dessin = (echelle) => sansCoins.slice(0, sansCoins.indexOf('<rect')) +
  `<g transform="translate(256 256) scale(${echelle}) translate(-256 -256)">${sansCoins.slice(finFonds, fermer)}</g></svg>`;

const page = (corps, fondPage = 'transparent') =>
  `<!doctype html><html><head><style>html,body{margin:0;background:${fondPage}}svg{display:block}</style></head><body>${corps}</body></html>`;
const aLaTaille = (svg, cote) => svg.replace('width="512" height="512"', `width="${cote}" height="${cote}"`);

const navigateur = await chromium.launch({ executablePath: chrome });
const onglet = await navigateur.newPage();
async function photo(html, l, h, transparent = false) {
  await onglet.setViewportSize({ width: l, height: h });
  await onglet.setContent(html);
  await onglet.evaluate(() => document.fonts.ready);
  return onglet.screenshot({ omitBackground: transparent, type: 'png' });
}

mkdirSync('marque/natif', { recursive: true });
mkdirSync('marque/magasins', { recursive: true });

const ecrire = (chemin, png) => { writeFileSync(chemin, png); console.log('✓', chemin); };

ecrire('marque/natif/icon-only.png', await photo(page(aLaTaille(sansCoins, 1024)), 1024, 1024));
ecrire('marque/natif/icon-background.png', await photo(page(aLaTaille(fond, 1024)), 1024, 1024));
ecrire('marque/natif/icon-foreground.png', await photo(page(aLaTaille(dessin(0.86), 1024)), 1024, 1024, true));

/* Les fiches des magasins. App Store Connect refuse une icône qui a de la
   transparence ou ses propres coins : le carré plein. Google Play la veut
   en 512 et pose lui-même ses coins. */
ecrire('marque/magasins/app-store-icone-1024.png', await photo(page(aLaTaille(sansCoins, 1024)), 1024, 1024));
ecrire('marque/magasins/google-play-icone-512.png', await photo(page(aLaTaille(sansCoins, 512)), 512, 512));

/* La bannière de Google Play (1024 × 500), sans texte au bord : Google
   peut la recadrer et y poser un bouton de lecture au centre. Le papier,
   la lumière bleu-rose de la marque en halos, le logo, le nom en serif et
   la promesse de la page d'accueil. */
const banniere = `<div style="position:relative;width:1024px;height:500px;overflow:hidden;background:${PAPIER};
  font-family:'Bitstream Charter',Charter,Georgia,serif;color:#1D1C19">
  <div style="position:absolute;inset:0;background:
    radial-gradient(520px 340px at 88% 8%,rgba(110,136,222,.30),transparent 70%),
    radial-gradient(460px 320px at 96% 92%,rgba(208,106,146,.24),transparent 70%),
    radial-gradient(380px 260px at 6% 100%,rgba(154,120,207,.14),transparent 70%)"></div>
  <div style="position:absolute;left:112px;top:50%;transform:translateY(-50%);display:flex;align-items:center;gap:44px">
    <div style="width:196px">${logo.replace('<svg ', '<svg width="196" ')}</div>
    <div>
      <div style="font-size:84px;font-weight:700;letter-spacing:-2px;line-height:1">Mirandola</div>
      <div style="margin-top:22px;font-size:38px;line-height:1.2">Révise moins.<br>Retiens <em>tout.</em></div>
      <div style="margin-top:22px;font:600 22px Inter,system-ui,sans-serif;color:#5C564C">Flashcards · IA · répétition espacée</div>
    </div>
  </div>
</div>`;
ecrire('marque/magasins/google-play-banniere-1024x500.png', await photo(page(banniere, PAPIER), 1024, 500));

await navigateur.close();
