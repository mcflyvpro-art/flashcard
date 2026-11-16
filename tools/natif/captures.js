// Les captures des fiches App Store et Google Play (2026-11-16,
// docs/MAGASINS.md) : les vrais écrans de l'app, pris dans la démo sans
// compte (le Lycée Démo Mirandola ; aucune requête ne part vers la base),
// posés sous une phrase dans la serif de la marque, à la taille exacte que
// chaque magasin demande :
//   iPhone 6,9 pouces       1320 × 2868   (App Store, obligatoire)
//   iPad 13 pouces          2064 × 2752   (App Store, l'app tourne sur iPad)
//   téléphone Android       1080 × 1920   (Google Play)
//
//   npm run build && node tools/natif/captures.js      → marque/magasins/captures/
//
// Le script sert lui-même le build (vite preview, port 4191). À dix heures
// du matin : l'accueil du professeur dit « Bonjour », comme les affiches du
// site (tools/affiches.js), dont il reprend la façon d'entrer dans la démo.
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { get } from 'node:http';
import { mkdirSync, writeFileSync } from 'node:fs';

const PORT = 4191;
const URL_DEMO = `http://localhost:${PORT}/essayer`;
const SORTIE = 'marque/magasins/captures/';
const chrome = process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium';

/* Les appareils : la taille de l'image demandée, la fenêtre de l'app (en
   points, comme l'appareil) et sa densité, et la place de l'écran sous la
   phrase. L'écran déborde en bas, comme sur les fiches des grandes apps. */
const APPAREILS = {
  iphone: { image: [1320, 2868], fenetre: { width: 402, height: 874 }, densite: 3, mobile: true,
    titre: 112, sous: 54, haut: 140, ecran: { x: 130, y: 560, l: 1060 }, rayon: 150, barre: 'ios' },
  ipad: { image: [2064, 2752], fenetre: { width: 1032, height: 1376 }, densite: 2, mobile: false, tactile: true,
    titre: 120, sous: 58, haut: 150, ecran: { x: 162, y: 560, l: 1740 }, rayon: 70, barre: 'ios' },
  android: { image: [1080, 1920], fenetre: { width: 412, height: 915 }, densite: 2.625, mobile: true,
    titre: 80, sous: 38, haut: 100, ecran: { x: 150, y: 400, l: 780 }, rayon: 70, barre: 'android' }
};

/* Les écrans : ce que dit la phrase (vrai, sans promesse qui n'y serait pas)
   et le chemin pour y arriver dans la démo. `pc` : la version large de l'app
   (iPad), où la barre latérale remplace celle du bas. */
const SCENES = [
  { nom: '1-paquets', role: 'eleve', titre: 'Tes cours, <em>en flashcards.</em>',
    sous: 'Écris-les, ou laisse l’IA les faire d’un cours<br>ou d’une photo, avec Mirandola+.',
    async aller(p, pc) { await p.click(pc ? '#rail [data-r="home"]' : '[data-act="tab-home"]'); } },
  { nom: '2-revision', role: 'eleve', titre: 'Révise juste <em>avant d’oublier.</em>',
    sous: 'Le moteur FSRS calcule pour chaque carte<br>le jour où tu allais l’oublier.',
    async aller(p, pc) {
      await p.click(pc ? '#rail [data-r="home"]' : '[data-act="tab-home"]');
      await p.getByText('La cellule', { exact: true }).first().click();
      await p.locator('[data-act="study"]:visible').first().click();
      await p.waitForTimeout(900);
      await p.keyboard.press('Space');                // la carte retournée : la réponse et ses quatre notes
    } },
  { nom: '3-classe', role: 'eleve', titre: 'Ta classe, <em>tes devoirs.</em>',
    sous: 'Ce que ton professeur donne,<br>à réviser au bon moment.',
    async aller(p, pc) {
      if (pc) { await p.locator('#rail [data-r="classes"]').first().click(); await p.locator('[data-el="classe"]:visible').first().click(); }
      else await p.click('[data-act="tab-classes"]');
    } },
  { nom: '4-amis', role: 'eleve', titre: 'Défie <em>tes amis.</em>',
    sous: 'Clubs, classements de la semaine,<br>parties en direct.',
    async aller(p, pc) { await p.click(pc ? '#rail [data-r="commu"]' : '[data-act="tab-commu"]'); } },
  { nom: '5-professeur', role: 'prof', titre: 'Pour les professeurs <em>aussi.</em>',
    sous: 'Devoirs suivis, ce qui bloque,<br>défis en direct au tableau.',
    async aller(p) { await p.getByText(/^Bon(jour|soir), Marc$/).waitFor(); } }
];

const BARRES = {
  ios: '<span>9:41</span><span style="display:flex;gap:6px;align-items:center">'
    + '<svg width="18" height="12" viewBox="0 0 18 12" fill="#1D1C19"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>'
    + '<svg width="27" height="13" viewBox="0 0 27 13"><rect x=".5" y=".5" width="23" height="12" rx="3.6" fill="none" stroke="#1D1C19" opacity=".4"/><rect x="2" y="2" width="20" height="9" rx="2.2" fill="#1D1C19"/></svg></span>',
  android: '<span>9:41</span><span style="display:flex;gap:6px;align-items:center">'
    + '<svg width="14" height="14" viewBox="0 0 14 14" fill="#1D1C19"><path d="M14 0v14H0z"/></svg>'
    + '<svg width="10" height="15" viewBox="0 0 10 15" fill="#1D1C19"><rect x="0" y="1.5" width="10" height="13.5" rx="1.6"/><rect x="3" y="0" width="4" height="2" rx=".6"/></svg></span>'
};

/* La barre d'état de l'appareil, dessinée (une capture d'écran de page n'en
   a pas), et le contenu poussé dessous comme sur le vrai téléphone. */
async function barreEtat(p, sorte) {
  const h = sorte === 'ios' ? 54 : 36;
  await p.addStyleTag({ content: `#app{padding-top:${h + 4}px!important}.statusmask{height:${h}px!important}` });
  await p.evaluate(([html, h, ios]) => {
    const b = document.createElement('div');
    b.style.cssText = `position:fixed;top:0;left:0;right:0;height:${h}px;z-index:999;display:flex;align-items:${ios ? 'flex-end' : 'center'};`
      + `justify-content:space-between;padding:0 ${ios ? '30px 9px 40px' : '18px'};font:600 ${ios ? 16.5 : 14}px system-ui,sans-serif;color:#1D1C19;pointer-events:none`;
    b.innerHTML = html;
    document.body.appendChild(b);
  }, [BARRES[sorte], h, sorte === 'ios']);
}

const matin = new Date(); matin.setHours(10, 0, 0, 0);

async function ecran(navigateur, a, scene) {
  const ctx = await navigateur.newContext({ viewport: a.fenetre, deviceScaleFactor: a.densite, locale: 'fr-FR',
    isMobile: a.mobile, hasTouch: a.mobile || !!a.tactile });
  await ctx.clock.install({ time: matin });
  const p = await ctx.newPage();
  await p.route(/supabase\.co/, r => r.abort());
  await p.goto(URL_DEMO);
  await p.evaluate(() => sessionStorage.setItem('folio.demo.tuto', JSON.stringify(['eleve', 'prof', 'ref'])));
  await p.click(`.dm-role[data-v="${scene.role}"]`);
  await p.waitForTimeout(1500);
  await p.addStyleTag({ content: '.dm-bandeau,.toast{display:none!important}' });
  await scene.aller(p, a.fenetre.width >= 900);
  if (a.fenetre.width < 900 || a.tactile) await barreEtat(p, a.barre);
  await p.waitForTimeout(1400);
  const png = await p.screenshot();
  await ctx.close();
  return png;
}

async function composer(navigateur, a, scene, png) {
  const [L, H] = a.image, e = a.ecran;
  const p = await (await navigateur.newContext({ viewport: { width: L, height: H }, deviceScaleFactor: 1 })).newPage();
  await p.setContent(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>
    body{margin:0;width:${L}px;height:${H}px;overflow:hidden;color:#1D1C19;
      background:radial-gradient(60% 40% at 8% 0%,rgba(90,118,208,.26),transparent),
        radial-gradient(56% 38% at 100% 10%,rgba(215,100,141,.22),transparent),#F6F5F1}
    h1{position:absolute;left:0;right:0;top:${a.haut}px;margin:0;text-align:center;
      font:700 ${a.titre}px/1.08 'Bitstream Charter',Charter,Georgia,serif;letter-spacing:-.02em}
    h1 em{font-style:italic}
    p{position:absolute;left:0;right:0;top:${a.haut + a.titre * 1.08 + a.sous * .7}px;margin:0;text-align:center;
      font:500 ${a.sous}px/1.3 Inter,system-ui,sans-serif;color:#5C564C}
    .ecran{position:absolute;left:${e.x}px;top:${e.y}px;width:${e.l}px;border-radius:${a.rayon}px;overflow:hidden;
      box-shadow:0 0 0 ${Math.round(e.l / 70)}px #1D1C19,0 40px 120px rgba(29,28,25,.28)}
    .ecran img{display:block;width:100%}
  </style></head><body><h1>${scene.titre}</h1><p>${scene.sous}</p>
    <div class="ecran"><img src="data:image/png;base64,${png.toString('base64')}"></div></body></html>`);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(150);
  const image = await p.screenshot({ type: 'png' });
  await p.context().close();
  return image;
}

/* le build servi, le temps des photos */
const serveur = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
const pret = () => new Promise(ok => get(`http://localhost:${PORT}/app`, r => { r.resume(); ok(r.statusCode < 500); }).on('error', () => ok(false)));
for (let i = 0; i < 60 && !(await pret()); i++) await new Promise(r => setTimeout(r, 500));

const navigateur = await chromium.launch({ executablePath: chrome });
try {
  const voulus = process.argv.slice(2);
  for (const [nom, a] of Object.entries(APPAREILS)) {
    if (voulus.length && !voulus.includes(nom)) continue;
    mkdirSync(SORTIE + nom, { recursive: true });
    for (const scene of SCENES) {
      const image = await composer(navigateur, a, scene, await ecran(navigateur, a, scene));
      writeFileSync(`${SORTIE}${nom}/${scene.nom}.png`, image);
      console.log(`✓ ${nom}/${scene.nom}.png  ${a.image.join(' × ')}`);
    }
  }
} finally {
  await navigateur.close();
  serveur.kill();
}
