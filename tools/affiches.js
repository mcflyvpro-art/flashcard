// Les affiches des emplacements vidéo de la page d'accueil
// (public/site/affiches/*.webp) : les vrais écrans de l'app, pris dans la
// démo sans compte (« Essayer sans compte », le Lycée Démo Mirandola — aucune
// requête ne part vers la base, et celles qui essaieraient sont coupées).
// À relancer quand ces écrans changent de visage :
//   npm run build && npx vite preview --port 4190 --strictPort &
//   node tools/affiches.js            (AFFICHES_URL pour une autre adresse)
//   node tools/affiches.js og         (l'image de partage seule, depuis les affiches déjà là)
//   node tools/affiches.js prof-mobile (une ou plusieurs affiches, par leur nom)
// Le WebP est encodé par le navigateur lui-même (canvas) : aucun outil de
// plus à installer. docs/LANDING.md.
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const URL_APP = (process.env.AFFICHES_URL || 'http://localhost:4190') + '/essayer';
const SORTIE = 'public/site/affiches/';
const chrome = process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium';

/* Chaque affiche : un rôle de la démo, une fenêtre (taille CSS × densité =
   taille de l'image), et le chemin jusqu'à l'écran voulu. */
const AFFICHES = [
  { nom: 'pc', role: 'eleve', fenetre: { width: 1152, height: 720 }, densite: 1.25,
    async chemin(p) {
      await p.locator('aside, nav, .rail').getByText('Livres', { exact: true }).first().click();
      await p.getByText('La cellule', { exact: true }).first().click();
      await p.locator('[data-act="study"]:visible').first().click();
      await p.waitForTimeout(900);
      await p.keyboard.press('Space');               // la fiche retournée : la réponse et les quatre boutons
    } },
  { nom: 'mobile', role: 'eleve', fenetre: { width: 390, height: 844 }, densite: 2, mobile: true,
    async chemin(p) { await p.click('[data-act="tab-home"]'); } },
  { nom: 'eleve', role: 'eleve', fenetre: { width: 1280, height: 800 }, densite: 1.125,
    async chemin(p) {
      await p.locator('aside, nav, .rail').getByText('Mes classes', { exact: true }).first().click();
      await p.locator('[data-el="classe"]:visible').first().click();   // sa classe : devoirs, professeurs, camarades
      await p.waitForTimeout(600);
    } },
  { nom: 'prof', role: 'prof', fenetre: { width: 1280, height: 800 }, densite: 1.125,
    async chemin(p) { await p.getByText(/^Bon(jour|soir), Marc$/).waitFor(); } },
  { nom: 'referent', role: 'ref', fenetre: { width: 1280, height: 800 }, densite: 1.125,
    async chemin(p) { await p.getByText('PRFQ-WT58').waitFor(); } },
  /* le téléphone posé à côté de l'ordinateur, dans Mirandola Campus : l'élève
     sur ses devoirs à faire, le professeur sur son tableau de bord */
  { nom: 'eleve-mobile', role: 'eleve', fenetre: { width: 390, height: 844 }, densite: 2, mobile: true,
    async chemin(p) { await p.click('[data-act="tab-classes"]'); await p.waitForTimeout(600); } },
  { nom: 'prof-mobile', role: 'prof', fenetre: { width: 390, height: 844 }, densite: 2, mobile: true,
    async chemin(p) { await p.getByText(/^Bon(jour|soir), Marc$/).waitFor(); } }
];

/* Au téléphone, une vraie barre d'état d'iPhone (l'heure, le réseau, la
   batterie) et le contenu poussé dessous, comme sur l'appareil : sans elle,
   l'îlot du cadre dessiné par la page tombait sur le titre de l'écran. */
async function barreEtat(p) {
  // la barre du haut d'un compte de gestion (le professeur) est fixe : elle
  // descend sous la barre d'état, et la page avec elle (64 px dans app.css)
  await p.addStyleTag({ content: '#app{padding-top:58px!important}.statusmask{height:54px!important}'
    + 'html.nav-haut #rail{top:54px!important}html.nav-haut #app{padding-top:118px!important}' });
  await p.evaluate(() => {
    const b = document.createElement('div');
    b.style.cssText = 'position:fixed;top:0;left:0;right:0;height:54px;z-index:999;display:flex;align-items:flex-end;'
      + 'justify-content:space-between;padding:0 30px 9px 40px;font:600 16.5px -apple-system,system-ui,sans-serif;'
      + 'letter-spacing:-.2px;color:#1D1C19;pointer-events:none';
    b.innerHTML = '<span>9:41</span><span style="display:flex;gap:6px;align-items:center">'
      + '<svg width="18" height="12" viewBox="0 0 18 12" fill="#1D1C19" stroke="none"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>'
      + '<svg width="16" height="12" viewBox="0 0 16 12" fill="#1D1C19" stroke="none"><path d="M8 2.6c2.3 0 4.4.9 6 2.4l1.3-1.4A10.6 10.6 0 0 0 8 .6 10.6 10.6 0 0 0 .7 3.6L2 5a8.6 8.6 0 0 1 6-2.4zm0 3.6c1.3 0 2.5.5 3.4 1.3l1.4-1.4A6.8 6.8 0 0 0 8 4.2c-1.8 0-3.5.7-4.8 1.9l1.4 1.4c.9-.8 2.1-1.3 3.4-1.3zM8 12l2.4-2.5a3.4 3.4 0 0 0-4.8 0z"/></svg>'
      + '<svg width="27" height="13" viewBox="0 0 27 13" stroke="none"><rect x=".5" y=".5" width="23" height="12" rx="3.6" fill="none" stroke="#1D1C19" opacity=".4"/><rect x="2" y="2" width="20" height="9" rx="2.2" fill="#1D1C19"/><path d="M25 4.5v4c.8-.3 1.4-1.1 1.4-2s-.6-1.7-1.4-2z" fill="#1D1C19" opacity=".4"/></svg>'
      + '</span>';
    document.body.appendChild(b);
  });
}

/* `echelle` < 1 : la même image, plus petite (la variante « -petit » que
   la page sert aux petits écrans, srcset). */
async function webp(page, png, qualite, echelle = 1) {
  const b64 = await page.evaluate(async ({ src, q, k }) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + src;
    await img.decode();
    const c = new OffscreenCanvas(Math.round(img.width * k), Math.round(img.height * k));
    const g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, 0, 0, c.width, c.height);
    const octets = new Uint8Array(await (await c.convertToBlob({ type: 'image/webp', quality: q })).arrayBuffer());
    let s = '';
    for (let i = 0; i < octets.length; i += 0x8000) s += String.fromCharCode(...octets.subarray(i, i + 0x8000));
    return btoa(s);
  }, { src: png.toString('base64'), q: qualite, k: echelle });
  return Buffer.from(b64, 'base64');
}

/* Les captures du manifeste (public/shots/) : ce que Chrome montre avant
   d'installer l'app, la bibliothèque de Léa sur ordinateur et au téléphone.
   La taille en pixels doit être celle que déclare le manifeste. */
const CAPTURES = [
  { nom: 'wide', role: 'eleve', fenetre: { width: 1440, height: 900 }, densite: 1,
    async chemin(p) { await p.locator('aside, nav, .rail').getByText('Livres', { exact: true }).first().click(); } },
  { nom: 'narrow', role: 'eleve', fenetre: { width: 414, height: 896 }, densite: 1, mobile: true,
    async chemin(p) { await p.click('[data-act="tab-home"]'); } }
];

/* L'image de partage de chaque page du site (2026-11-02, docs/SEO.md) :
   public/site/og/<page>.jpg, 1200 × 630, ce qu'affichent un message, un
   réseau social ou Google Discover quand on partage l'adresse. Le logo, le
   sujet de la page, sa phrase, et l'écran de l'app qui lui va (des
   affiches déjà faites : rien à photographier, pas besoin de serveur).
     node tools/affiches.js pages */
const OG_PAGES = {
  'flashcards-ia': { sujet: 'Flashcards avec l’IA', titre: 'L’IA fait tes <em>flashcards.</em>', ligne: 'Un cours, une photo, un PDF :<br>un livre de flashcards en quelques secondes.', pc: 'pc', tel: 'mobile' },
  'repetition-espacee': { sujet: 'Le guide', titre: 'La répétition <em>espacée.</em>', ligne: 'Revoir chaque page juste avant<br>de l’oublier, et la garder des mois.', courbe: true },
  etablissements: { sujet: 'Mirandola Campus', titre: 'Tout l’établissement, <em>en deux codes.</em>', ligne: 'Collège, lycée, prépa :<br>ouvert en dix minutes.', pc: 'prof', tel: 'eleve-mobile' },
  professeurs: { sujet: 'Pour les professeurs', titre: 'Vos élèves révisent. <em>Vous le voyez.</em>', ligne: 'Devoirs suivis, ce qui bloque,<br>défis en direct au tableau.', pc: 'prof', tel: 'prof-mobile' },
  tarifs: { sujet: 'Tarifs', titre: 'Gratuit pour <em>réviser.</em>', ligne: 'Mirandola+ dès 4,17 € par mois.<br>Campus de 5 à 2 € HT par élève et par an.', pc: 'pc', tel: 'mobile' },
  'anki-quizlet': { sujet: 'Le comparatif', titre: 'Anki, Quizlet <em>ou Mirandola ?</em>', ligne: 'Trois apps de flashcards,<br>et comment passer de l’une à l’autre.', pc: 'pc', tel: 'mobile' },
  'a-propos': { sujet: 'Le nom', titre: 'Pourquoi <em>Mirandola ?</em>', ligne: 'D’après Pic de la Mirandole,<br>l’érudit à la mémoire prodigieuse.', logo: true },
  moteur: { sujet: 'Memory Engine · FSRS-6', titre: 'Le moteur, <em>formule par formule.</em>', ligne: 'Trois variables, vingt et un paramètres,<br>une courbe. Sans rien arrondir.', moteur: true }
};

async function imagesDesPages() {
  const { courbeOubli } = await import('./site/gabarit.js');
  const { svgFamille } = await import('../src/site/moteur-calc.js');
  const css = readFileSync('src/site/pages.css', 'utf8').match(/\.co-svg\{[\s\S]*?\.co-rev text\{[^}]*\}/)[0];
  const logo = readFileSync('public/site/logo.svg', 'utf8');
  const uri = f => 'data:image/webp;base64,' + readFileSync(SORTIE + f + '.webp').toString('base64');
  mkdirSync('public/site/og', { recursive: true });
  const p = await (await navigateur.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })).newPage();
  for (const [nom, o] of Object.entries(OG_PAGES)) {
    const visuel = o.moteur ? `<div class="moteur"><math display="block"><mi>R</mi><mo stretchy="false">(</mo><mi>t</mi><mo>,</mo><mi>S</mi><mo stretchy="false">)</mo><mo>=</mo><msup><mrow><mo>(</mo><mn>1</mn><mo>+</mo><mi>f</mi><mfrac><mi>t</mi><mi>S</mi></mfrac><mo>)</mo></mrow><mrow><mo>−</mo><msub><mi>w</mi><mn>20</mn></msub></mrow></msup></math>${svgFamille()}</div>`
      : o.courbe ? `<div class="courbe">${courbeOubli()}</div>`
      : o.logo ? `<div class="grand-logo">${logo}</div>`
        : `<div class="pc"><img src="${uri(o.pc)}"></div><div class="socle"></div><div class="tel"><img src="${uri(o.tel)}"><i></i></div>`;
    await p.setContent(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>
      body{margin:0;width:1200px;height:630px;overflow:hidden;font-family:Inter,system-ui,sans-serif;color:#1D1C19;
        --az3:#91A8EB;--rose:#D7648D;--doux:#6B675F;--encre2:#4B4842;--filet:rgba(29,28,25,.09);
        background:radial-gradient(48% 64% at 6% 0%,rgba(90,118,208,.30),transparent),radial-gradient(44% 60% at 100% 24%,rgba(215,100,141,.26),transparent),
        radial-gradient(40% 50% at 42% 30%,rgba(154,120,207,.16),transparent),#F6F5F1}
      .g{position:absolute;left:72px;top:66px;width:540px}
      .m{display:flex;align-items:center;gap:14px;font:700 40px 'Bitstream Charter',Charter,Georgia,serif;letter-spacing:-1px}
      .m svg{width:66px;height:auto}
      .p{display:inline-flex;align-items:center;gap:8px;margin-top:40px;padding:9px 16px;border-radius:99px;background:#fff;
        box-shadow:inset 0 0 0 1px rgba(29,28,25,.14);font-weight:700;font-size:19px}
      .p i{width:10px;height:10px;border-radius:50%;background:linear-gradient(115deg,#5A76D0,#9A78CF,#D7648D)}
      h1{margin:22px 0 0;font:700 66px/1 'Bitstream Charter',Charter,Georgia,serif;letter-spacing:-2px}
      h1 em{font-style:italic;background:linear-gradient(100deg,#3E4FA0 8%,#80439C 55%,#B33F6C 94%);-webkit-background-clip:text;background-clip:text;color:transparent;padding-right:.08em}
      .s{margin-top:22px;font-size:24px;color:#4B4842;line-height:1.4}
      .pc{position:absolute;left:640px;top:130px;width:590px;background:#121211;border-radius:16px 16px 4px 4px;padding:9px 9px 13px;box-shadow:0 40px 80px -30px rgba(29,28,25,.5)}
      .pc img{display:block;width:100%;aspect-ratio:1440/900;object-fit:cover;object-position:top;border-radius:3px}
      .socle{position:absolute;left:615px;top:516px;width:640px;height:13px;border-radius:2px 2px 12px 12px;background:linear-gradient(#E2DFD8,#C3BFB7 55%,#8E8A83)}
      .tel{position:absolute;left:1010px;top:258px;width:158px;background:#121211;border-radius:28px;padding:7px;transform:rotate(4deg);box-shadow:0 40px 70px -24px rgba(29,28,25,.55)}
      .tel img{display:block;width:100%;border-radius:22px}
      .tel i{position:absolute;top:13px;left:50%;width:46px;height:13px;margin-left:-23px;border-radius:9px;background:#0A0A09}
      .courbe{position:absolute;left:630px;top:120px;width:510px;padding:26px 26px 18px;border-radius:28px;background:#fff;box-shadow:0 30px 70px -30px rgba(29,28,25,.45)}
      ${css.replace(/var\(--sans\)/g, 'Inter,system-ui,sans-serif')}
      .co-sans{fill:none;stroke:#B9B3A8;stroke-width:3;stroke-dasharray:2 7}.co-avec{fill:none;stroke:url(#co-g);stroke-width:5}
      .grand-logo{position:absolute;left:720px;top:110px;width:380px}.grand-logo svg{width:100%;height:auto}
      body.nuit{color:#F3EEE3;background:radial-gradient(50% 70% at 0% 100%,rgba(215,100,141,.32),transparent),radial-gradient(50% 70% at 90% 0%,rgba(90,118,208,.38),transparent),#17161E}
      .nuit .s{color:#CFC8BA}.nuit .p{background:rgba(243,238,227,.08);box-shadow:inset 0 0 0 1px rgba(243,238,227,.18)}
      .nuit h1 em{background:linear-gradient(100deg,#8DA2F0 8%,#B996EC 55%,#F38DB2 94%);-webkit-background-clip:text;background-clip:text}
      .moteur{position:absolute;left:640px;top:84px;width:500px}
      .moteur math{font-size:44px;color:#F3EEE3;margin-bottom:26px}
      .moteur svg{display:block;width:100%;height:auto;padding:22px 22px 10px;box-sizing:border-box;border-radius:26px;background:rgba(243,238,227,.05);box-shadow:inset 0 0 0 1px rgba(243,238,227,.14)}
      .moteur text{font:600 22px Inter,system-ui,sans-serif;fill:#A29CAF}.m-ty{text-anchor:end}.m-tx{text-anchor:middle}
      .m-grille{stroke:rgba(243,238,227,.12);stroke-width:1}
      .m-fam{fill:none;stroke-width:5;stroke-linecap:round}.m-fam-pt{stroke:#17161E;stroke-width:3}
      .m-fam0{stroke:#91A8EB;fill:#91A8EB}.m-fam1{stroke:#B996EC;fill:#B996EC}.m-fam2{stroke:#E58BB7;fill:#E58BB7}.m-fam3{stroke:#F3C1D4;fill:#F3C1D4}path.m-fam{fill:none}
    </style></head><body${o.moteur ? ' class="nuit"' : ''}>
      <div class="g"><div class="m">${logo}<span>Mirandola</span></div>
        <div class="p"><i></i>${o.sujet}</div>
        <h1>${o.titre}</h1>
        <p class="s">${o.ligne}</p></div>
      ${visuel}
    </body></html>`);
    await p.waitForTimeout(300);
    writeFileSync(`public/site/og/${nom}.jpg`, await p.screenshot({ type: 'jpeg', quality: 86 }));
    console.log(`site/og/${nom}.jpg`);
  }
}

/* Dix heures du matin, aujourd'hui : l'accueil du professeur dit
   « Bonjour », quelle que soit l'heure où l'on photographie (la démo se
   sème autour de cette heure-là, rien d'autre ne bouge). */
const matin = new Date(); matin.setHours(10, 0, 0, 0);

async function ouvrir(a) {
  const ctx = await navigateur.newContext({ viewport: a.fenetre, deviceScaleFactor: a.densite, locale: 'fr-FR',
    isMobile: !!a.mobile, hasTouch: !!a.mobile });
  await ctx.clock.install({ time: matin });
  const p = await ctx.newPage();
  await p.route(/supabase\.co/, r => r.abort());
  await p.goto(URL_APP);
  // le tuto de chaque rôle part à sa première entrée dans la démo : déjà vu
  // (posé après le démarrage, qui efface ce qu'une démo précédente a laissé)
  await p.evaluate(() => sessionStorage.setItem('folio.demo.tuto', JSON.stringify(['eleve', 'prof', 'ref'])));
  await p.click(`.dm-role[data-v="${a.role}"]`);
  await p.waitForTimeout(1500);
  // ni le bandeau de la démo ni un message passager sur une affiche
  await p.addStyleTag({ content: '.dm-bandeau,.toast{display:none!important}' });
  await a.chemin(p);
  if (!a.mobile) await p.mouse.move(0, 0);   // rien de survolé sur l'image
  return { ctx, p };
}

const navigateur = await chromium.launch({ executablePath: chrome });
mkdirSync(SORTIE, { recursive: true });
if (process.argv.includes('pages')) {
  await imagesDesPages();
  await navigateur.close();
  process.exit(0);
}
const seulOg = process.argv.includes('og');
// des noms d'affiches (node tools/affiches.js prof-mobile …) : celles-là seules
const noms = process.argv.slice(2).filter(x => x !== 'og');
for (const a of seulOg || noms.length ? [] : CAPTURES) {
  const { ctx, p } = await ouvrir(a);
  await p.waitForTimeout(1400);
  writeFileSync(`public/shots/${a.nom}.png`, await p.screenshot());
  console.log(`shots/${a.nom}.png`);
  await ctx.close();
}
for (const a of seulOg ? [] : AFFICHES.filter(x => !noms.length || noms.includes(x.nom))) {
  const { ctx, p } = await ouvrir(a);
  if (a.mobile) await barreEtat(p);
  await p.waitForTimeout(1400);
  const png = await p.screenshot();
  const image = await webp(p, png, .84), petite = await webp(p, png, .84, .5);
  writeFileSync(SORTIE + a.nom + '.webp', image);
  writeFileSync(SORTIE + a.nom + '-petit.webp', petite);
  console.log(a.nom + '.webp', Math.round(image.length / 1024) + ' Ko,', '-petit', Math.round(petite.length / 1024) + ' Ko');
  await ctx.close();
}
if (noms.length) { await navigateur.close(); process.exit(0); }
/* L'image de partage (Open Graph, 1200 × 630) : le logo, le titre, et les
   deux affiches qu'on vient de faire dans leurs appareils. Elle est figée
   en pixels : la police est celle de cette machine (Charter, à défaut le
   serif du système). */
const dataUri = (f, type) => `data:${type};base64,` + readFileSync(f).toString('base64');
const logo = readFileSync('public/site/logo.svg', 'utf8');
const og = await (await navigateur.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })).newPage();
await og.setContent(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>
  body{margin:0;width:1200px;height:630px;overflow:hidden;font-family:Inter,system-ui,sans-serif;color:#1D1C19;
    background:radial-gradient(48% 64% at 6% 0%,rgba(90,118,208,.30),transparent),radial-gradient(44% 60% at 100% 24%,rgba(215,100,141,.26),transparent),
    radial-gradient(40% 50% at 42% 30%,rgba(154,120,207,.16),transparent),radial-gradient(50% 50% at 60% 110%,rgba(215,100,141,.12),transparent),#F6F5F1}
  .g{position:absolute;left:72px;top:70px;width:560px}
  .m{display:flex;align-items:center;gap:14px;font:700 44px 'Bitstream Charter',Charter,Georgia,serif;letter-spacing:-1px}
  .m svg{width:74px;height:auto}
  .p{display:inline-flex;align-items:center;gap:8px;margin-top:34px;padding:9px 16px;border-radius:99px;background:#fff;
    box-shadow:inset 0 0 0 1px rgba(29,28,25,.14);font-weight:700;font-size:19px}
  .p i{width:10px;height:10px;border-radius:50%;background:linear-gradient(115deg,#5A76D0,#9A78CF,#D7648D)}
  h1{margin:24px 0 0;font:700 78px/0.98 'Bitstream Charter',Charter,Georgia,serif;letter-spacing:-2.5px}
  h1 em{font-style:italic;background:linear-gradient(100deg,#3E4FA0 8%,#80439C 55%,#B33F6C 94%);-webkit-background-clip:text;background-clip:text;color:transparent;padding-right:.08em}
  .s{margin-top:22px;font-size:25px;color:#4B4842;line-height:1.4}
  .pc{position:absolute;left:640px;top:118px;width:600px;background:#121211;border-radius:16px 16px 4px 4px;padding:9px 9px 13px;
    box-shadow:0 40px 80px -30px rgba(29,28,25,.5)}
  .pc img{display:block;width:100%;border-radius:3px}
  .socle{position:absolute;left:615px;top:509px;width:650px;height:13px;border-radius:2px 2px 12px 12px;background:linear-gradient(#E2DFD8,#C3BFB7 55%,#8E8A83)}
  .tel{position:absolute;left:1000px;top:250px;width:165px;background:#121211;border-radius:28px;padding:7px;transform:rotate(4deg);
    box-shadow:0 40px 70px -24px rgba(29,28,25,.55)}
  .tel img{display:block;width:100%;border-radius:22px}
  .tel i{position:absolute;top:13px;left:50%;width:48px;height:13px;margin-left:-24px;border-radius:9px;background:#0A0A09}
  /* une page d'histoire, dessinée comme dans l'app : la couverture de sa teinte (moutarde,
     src/couleurs.js), son filet, la matière et la pastille de sa reliure, le signet */
  .f{position:absolute;left:575px;top:380px;width:210px;padding:15px 16px;border-radius:14px;background:#F9EED7;transform:rotate(-6deg);
    box-shadow:inset 0 0 0 1px #E9D7B0,0 18px 40px -16px rgba(29,28,25,.4)}
  .f::before{content:'';position:absolute;right:15px;top:0;width:14px;height:28px;background:#CCA855;clip-path:polygon(0 0,100% 0,100% 100%,50% 76%,0 100%)}
  .f small{display:flex;align-items:center;gap:6px;font:800 11px Inter,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#513C00}
  .f small::before{content:'';width:7px;height:7px;border-radius:50%;background:#CCA855}
  .f b{display:block;margin-top:6px;font:700 21px 'Bitstream Charter',Georgia,serif}
</style></head><body>
  <div class="g"><div class="m">${logo}<span>Mirandola</span></div>
    <div class="p"><i></i>Testé et validé en prépa · boosté à l’IA</div>
    <h1>Révise moins.<br>Retiens <em>tout.</em></h1>
    <p class="s">L’IA fait de ton cours un livre<br>de flashcards. Mirandola te repose chaque<br>page juste avant que tu l’oublies.</p></div>
  <div class="pc"><img src="${dataUri(SORTIE + 'pc.webp', 'image/webp')}"></div><div class="socle"></div>
  <div class="tel"><img src="${dataUri(SORTIE + 'mobile.webp', 'image/webp')}"><i></i></div>
  <div class="f"><small>Histoire</small><b>14 juillet 1789</b></div>
</body></html>`);
await og.waitForTimeout(500);
writeFileSync('public/site/og.jpg', await og.screenshot({ type: 'jpeg', quality: 88 }));
console.log('og.jpg');
await navigateur.close();
