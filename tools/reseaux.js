// Le kit des réseaux sociaux de Mirandola (2026-11-04, docs/SEO.md § 4) :
// LinkedIn, Instagram, TikTok, YouTube. Chaque image à la taille que le
// réseau demande, dessinée comme le site et l'app (le papier, l'encre, la
// pile de livres, les pages d'un livre avec leur reliure, la lumière
// bleu-rose en halos, jamais en aplat), et les textes de chaque profil,
// vérifiés contre la limite de chaque champ : le script refuse d'écrire
// un texte trop long.
//
//   node tools/reseaux.js        écrit marque/reseaux/ (images + TEXTES.md)
//
// Rien à servir : le logo et les icônes sont lus dans le dépôt
// (public/site/logo.svg, src/site/partiels/icones.html), le navigateur
// photographie. La police est celle de cette machine (Bitstream Charter,
// comme les images de partage du site).
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';

const SORTIE = 'marque/reseaux/';
const chrome = process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium';
const logo = readFileSync('public/site/logo.svg', 'utf8');
const icones = readFileSync('src/site/partiels/icones.html', 'utf8');

/* ---------- les textes, et la limite de chaque champ ---------- */
const TEXTES = [
  { reseau: 'Instagram', champs: [
    ['Nom (cherché par Instagram)', 30, 'Mirandola · flashcards IA'],
    ['Nom d’utilisateur', 30, 'mirandola.fr'],
    ['Bio', 150, 'L’IA fait de ton cours un livre de flashcards.\nMirandola te repose chaque page juste avant l’oubli.\nGratuit, même hors ligne.'],
    ['Lien', 0, 'https://mirandola.fr'],
    ['Catégorie', 0, 'Éducation'],
    ['À la une (titres sous les couvertures)', 15, 'Réviser · L’IA · Ma classe · Défis · Mirandola+']
  ] },
  { reseau: 'TikTok', champs: [
    ['Nom', 30, 'Mirandola · flashcards IA'],
    ['Nom d’utilisateur', 24, 'mirandola.fr'],
    ['Bio', 80, 'L’IA fait tes flashcards.\nMirandola te les repose juste avant l’oubli.'],
    ['Lien (compte Business)', 0, 'https://mirandola.fr']
  ] },
  { reseau: 'YouTube', champs: [
    ['Nom de la chaîne', 50, 'Mirandola'],
    ['Identifiant', 30, '@mirandola.fr'],
    ['Description', 1000, `Mirandola fait de ton cours un livre de flashcards, puis te repose chaque page juste avant que tu l’oublies. La méthode s’appelle la répétition espacée : c’est le moteur d’Anki, sans un seul réglage.

Ici, des vidéos courtes pour prendre l’app en main, que tu sois élève, professeur ou référent d’un établissement, et ce qu’on sait de la mémoire pour réviser moins et retenir plus longtemps.

Mirandola est gratuit, sur téléphone et ordinateur, même hors ligne. Mirandola+ ajoute l’IA, qui écrit tes pages depuis un cours, une photo ou un PDF. Mirandola Campus ouvre l’app à tout un établissement.

Testé et validé en classe prépa. Le nom vient de Pic de la Mirandole, l’érudit à la mémoire prodigieuse.

https://mirandola.fr`],
    ['Liens (titre · adresse)', 0, 'Mirandola · https://mirandola.fr\nÉtablissements · https://mirandola.fr/etablissements\nLa répétition espacée · https://mirandola.fr/repetition-espacee'],
    ['Mots clés de la chaîne', 500, 'flashcards, répétition espacée, réviser, méthode de révision, mémoriser, apprendre par cœur, bac, brevet, prépa, Anki, FSRS, IA, Mirandola']
  ] },
  { reseau: 'LinkedIn', champs: [
    ['Nom', 100, 'Mirandola'],
    ['Slogan', 120, 'Flashcards, IA et répétition espacée : l’app de révision des élèves, des professeurs et des établissements.'],
    ['Site web', 0, 'https://mirandola.fr'],
    ['Secteur', 0, 'E-learning (taper « e-learning » dans le champ)'],
    ['Spécialités (une par case)', 0, 'flashcards · répétition espacée · révision · mémorisation · intelligence artificielle · EdTech · collèges · lycées · classes préparatoires · devoirs en ligne · RGPD'],
    ['Présentation', 2000, `Mirandola est une application de révision. Elle fait d’un cours un livre de flashcards, une question au recto de chaque page et la réponse au verso, puis repose chaque page à l’élève juste avant qu’il l’oublie. Derrière, la répétition espacée : FSRS, le moteur d’Anki, appris sur des centaines de millions de révisions et réglé sans aucun curseur.

Pour les élèves et les étudiants, l’IA écrit les pages depuis un cours, une photo ou un PDF, et tout marche hors ligne, sur téléphone et ordinateur. Mirandola est gratuit ; Mirandola+ ouvre l’IA et un moteur réglé sur la mémoire de chacun.

Pour les établissements, Mirandola Campus : deux codes, et en dix minutes chaque élève et chaque professeur a son espace. Les professeurs donnent un livre en devoir, voient qui l’a lu et ce que la classe rate le plus, lancent un défi en direct au tableau. Le référent garde la main sur les codes, les classes, les comptes et la licence. Les données sont hébergées dans l’Union européenne, sans publicité ni traceur.

Mirandola a été testé et validé en classe prépa. Son nom vient de Pic de la Mirandole, l’humaniste de la Renaissance à la mémoire prodigieuse.

Démo gratuite de 30 jours pour votre établissement : https://mirandola.fr/etablissements`]
  ] }
];

/* Un texte trop long ne part pas : le réseau le couperait, ou le refuserait.
   Ni tiret long ni « fiche » : la règle du site (test/site.test.js). */
function verifier() {
  const fautes = [];
  for (const { reseau, champs } of TEXTES) {
    for (const [nom, max, t] of champs) {
      const n = [...t].length;
      const morceaux = nom.startsWith('À la une') ? t.split(' · ') : [t];
      for (const m of morceaux) if (max && [...m].length > max) fautes.push(`${reseau}, ${nom} : ${[...m].length} > ${max}`);
      if (/[—–]/.test(t)) fautes.push(`${reseau}, ${nom} : un tiret long`);
      if (/\bfiches?\b/i.test(t)) fautes.push(`${reseau}, ${nom} : « fiche »`);
      if (max && !nom.startsWith('À la une') && n > max) fautes.push(`${reseau}, ${nom} : ${n} > ${max}`);
    }
  }
  if (fautes.length) throw new Error('Textes à reprendre :\n' + [...new Set(fautes)].join('\n'));
}

/* ---------- le décor commun : le papier et la lumière de la marque ---------- */
const BASE = `
  *{box-sizing:border-box}
  body{margin:0;overflow:hidden;font-family:Inter,system-ui,sans-serif;color:#1D1C19;background:#F6F5F1}
  .serif{font-family:'Bitstream Charter',Charter,Georgia,serif}
  .lumiere{position:absolute;inset:0;
    background:radial-gradient(42% 70% at 4% 0%,rgba(90,118,208,.30),transparent 70%),
      radial-gradient(40% 70% at 100% 20%,rgba(215,100,141,.26),transparent 70%),
      radial-gradient(36% 60% at 46% 40%,rgba(154,120,207,.14),transparent 70%),
      radial-gradient(50% 60% at 70% 115%,rgba(215,100,141,.12),transparent 70%)}
  em.marque{font-style:italic;background:linear-gradient(100deg,#3E4FA0 8%,#80439C 55%,#B33F6C 94%);-webkit-background-clip:text;background-clip:text;color:transparent;padding-right:.08em}
  /* une page d'un livre, comme dans l'app : la couverture de sa matière,
     son filet, la matière en tête avec la pastille de sa reliure, le signet */
  .page{position:absolute;padding:.62em 1.5em .7em .75em;border-radius:.62em;background:var(--c);
    box-shadow:inset 0 0 0 .05em var(--b),0 .8em 1.8em -.8em rgba(29,28,25,.35);transform:rotate(var(--r,0deg))}
  .page::before{content:'';position:absolute;right:.62em;top:0;width:.55em;height:1.1em;background:linear-gradient(90deg,rgba(255,255,255,.14),transparent 45%,rgba(0,0,0,.14)) var(--d);
    clip-path:polygon(0 0,100% 0,100% 100%,50% 76%,0 100%)}
  .page small{display:flex;align-items:center;gap:.35em;font:800 .46em/1 Inter,sans-serif;letter-spacing:.09em;text-transform:uppercase;color:var(--ci)}
  .page small::before{content:'';width:.6em;height:.6em;border-radius:50%;background:var(--d)}
  .page b{display:block;margin-top:.3em;font:700 1em/1.15 'Bitstream Charter',Charter,Georgia,serif;white-space:nowrap}
  [data-t=yellow]{--d:#CCA855;--c:#F9EED7;--b:#E9D7B0;--ci:#513C00}
  [data-t=purple]{--d:#6A265A;--c:#FDE8F6;--b:#F4CBE7;--ci:#400D35}
  [data-t=teal]{--d:#1E6162;--c:#E1F3F4;--b:#C1E0E1;--ci:#093E3F}
  [data-t=red]{--d:#9F3D34;--c:#FEEAE7;--b:#FDCCC4;--ci:#6B2620}
  [data-t=blue]{--d:#0970A4;--c:#E3F2FD;--b:#B6DFFE;--ci:#024467}
  [data-t=green]{--d:#2D8A4F;--c:#DFF6E4;--b:#BBE6C5;--ci:#024D24}
  .logo svg{display:block;width:100%;height:auto}
`;
/* Les pages qui flottent : de vraies questions de cours, une matière chacune. */
const PAGES = [
  ['yellow', 'Histoire', '14 juillet 1789'],
  ['purple', 'Philosophie', 'Kant, 1781'],
  ['teal', 'Chimie', 'pH neutre à 25 °C'],
  ['red', 'Anglais', 'to cope with'],
  ['blue', 'Maths', 'Théorème de Pythagore'],
  ['green', 'SVT', 'La mitose']
];
const page = (i, style) => { const [t, m, q] = PAGES[i]; return `<div class="page" data-t="${t}" style="${style}"><small>${m}</small><b>${q}</b></div>`; };

/* ---------- chaque image ---------- */
const IMAGES = [
  /* L'avatar : la pile seule, au centre du rond que chaque réseau découpe
     (rien hors des 80 % du centre). Une source, quatre tailles. */
  ...[['avatar-1080.png', 1080, 'Instagram et TikTok'], ['youtube-avatar-800.png', 800, 'YouTube'], ['linkedin-logo-400.png', 400, 'LinkedIn']]
    .map(([nom, cote]) => ({ nom, w: cote, h: cote, html: `<style>${BASE}
      .lumiere{background:radial-gradient(70% 60% at 18% 8%,rgba(90,118,208,.30),transparent 70%),radial-gradient(70% 60% at 92% 90%,rgba(215,100,141,.26),transparent 70%),radial-gradient(50% 50% at 50% 45%,rgba(255,255,255,.7),transparent 75%)}
      .logo{position:absolute;left:50%;top:50%;width:58%;transform:translate(-50%,-52%)}
      </style><div class="lumiere"></div><div class="logo">${logo}</div>` })),

  /* YouTube : 2560 × 1440. Seule la bande du centre (1546 × 423) se voit
     partout ; la télévision montre tout, l'ordinateur une bande de la
     largeur, le téléphone le centre. Le message tient dans le centre, les
     pages qui flottent l'entourent. */
  { nom: 'youtube-banniere-2560x1440.png', w: 2560, h: 1440, html: `<style>${BASE}
      .sur{position:absolute;left:507px;top:508px;width:1546px;height:423px;display:flex;align-items:center;justify-content:center;gap:70px}
      .sur .logo{width:250px;flex:none}
      .sur h1{margin:0;font-size:150px;line-height:.98;letter-spacing:-5px}
      .sur p{margin:22px 0 0;font-size:40px;color:#4B4842;letter-spacing:.2px}
      .bande{position:absolute;inset:0;font-size:44px}
      </style><div class="lumiere"></div>
      <div class="bande">
        ${page(0, 'left:110px;top:580px;--r:-7deg')}${page(4, 'left:40px;top:840px;--r:5deg')}
        ${page(1, 'left:2140px;top:540px;--r:6deg')}${page(2, 'left:2110px;top:770px;--r:-5deg')}
        ${page(3, 'left:420px;top:150px;--r:4deg;font-size:40px')}${page(5, 'left:1880px;top:1150px;--r:-4deg;font-size:40px')}
      </div>
      <div class="sur"><div class="logo">${logo}</div>
        <div><h1 class="serif">Révise moins.<br>Retiens <em class="marque">tout.</em></h1><p>Flashcards, IA et répétition espacée · mirandola.fr</p></div></div>` },

  /* LinkedIn : la couverture d'une page d'entreprise, 1512 × 256 (le même
     rapport que l'ancien 1128 × 191), en double résolution. Le logo de la
     page la mord en bas à gauche : rien d'important dans le premier quart. */
  { nom: 'linkedin-couverture-3024x512.png', w: 3024, h: 512, html: `<style>${BASE}
      .lumiere{background:radial-gradient(30% 120% at 0% 0%,rgba(90,118,208,.30),transparent 70%),radial-gradient(30% 120% at 100% 30%,rgba(215,100,141,.26),transparent 70%),radial-gradient(30% 100% at 55% 50%,rgba(154,120,207,.14),transparent 70%)}
      .msg{position:absolute;left:900px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center}
      .msg h1{margin:0;font-size:124px;line-height:1;letter-spacing:-4px}
      .msg p{margin:24px 0 0;font-size:40px;color:#4B4842}
      .bande{position:absolute;inset:0;font-size:40px}
      </style><div class="lumiere"></div>
      <div class="bande">${page(0, 'left:2330px;top:70px;--r:-6deg')}${page(1, 'left:2560px;top:270px;--r:5deg')}${page(2, 'left:330px;top:46px;--r:-5deg;font-size:34px')}</div>
      <div class="msg"><h1 class="serif">Révise moins. Retiens <em class="marque">tout.</em></h1>
        <p>L’app de révision des élèves, des professeurs et des établissements · mirandola.fr</p></div>` },

  /* YouTube : le filigrane posé sur chaque vidéo, 150 × 150, sans fond. */
  { nom: 'youtube-filigrane-150.png', w: 150, h: 150, transparent: true, html: `<style>${BASE}body{background:transparent}
      .logo{position:absolute;left:50%;top:50%;width:84%;transform:translate(-50%,-50%)}</style><div class="logo">${logo}</div>` },

  /* Instagram : les couvertures « À la une » (1080 × 1920, Instagram n'en
     garde que le rond du centre). Une icône de l'app par thème. */
  ...[['reviser', 'i-livre'], ['ia', 'i-etincelle'], ['classe', 'i-ecole'], ['defis', 'i-eclair'], ['plus', null]].map(([nom, ic]) => ({
    nom: `instagram-a-la-une-${nom}.png`, w: 1080, h: 1920, html: `<style>${BASE}
      .lumiere{background:radial-gradient(60% 34% at 20% 34%,rgba(90,118,208,.30),transparent 70%),radial-gradient(60% 34% at 84% 66%,rgba(215,100,141,.26),transparent 70%)}
      .rond{position:absolute;left:50%;top:50%;width:880px;height:880px;transform:translate(-50%,-50%);border-radius:50%;background:#FFFFFF;
        box-shadow:0 30px 80px -30px rgba(29,28,25,.35),inset 0 0 0 3px rgba(29,28,25,.06);display:grid;place-items:center}
      .rond svg{width:430px;height:430px;fill:none;stroke:url(#g);stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
      .plus{font:800 480px/1 Inter,sans-serif;background:linear-gradient(135deg,#4258B8 26%,#8A48AC 50%,#C8467A 74%);-webkit-background-clip:text;background-clip:text;color:transparent;margin-top:-30px}
      </style>${icones}<svg width="0" height="0" style="position:absolute"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4258B8"/><stop offset=".5" stop-color="#8A48AC"/><stop offset="1" stop-color="#C8467A"/></linearGradient></defs></svg>
      <div class="lumiere"></div><div class="rond">${ic ? `<svg viewBox="0 0 24 24"><use href="#${ic}"/></svg>` : '<span class="plus">+</span>'}</div>` }))
];

/* ---------- les textes, en clair, à copier ---------- */
function ecrireTextes() {
  const n = t => [...t].length;
  const corps = TEXTES.map(({ reseau, champs }) => `## ${reseau}\n\n` + champs.map(([nom, max, t]) =>
    `**${nom}**${max ? ` (${nom.startsWith('À la une') ? `${max} signes chacun` : `${n(t)} / ${max} signes`})` : ''}\n\n\`\`\`\n${t}\n\`\`\``).join('\n\n')).join('\n\n');
  writeFileSync(SORTIE + 'TEXTES.md', `# Mirandola sur les réseaux : les textes

> Écrits par \`node tools/reseaux.js\`, qui vérifie chaque longueur : à
> retoucher dans le script, pas ici. Chaque bloc se copie tel quel.
> Les images du même dossier, réseau par réseau : voir LISEZMOI.md.

${corps}
`);
}

verifier();
mkdirSync(SORTIE, { recursive: true });
const navigateur = await chromium.launch({ executablePath: chrome });
for (const im of IMAGES) {
  const p = await navigateur.newPage({ viewport: { width: im.w, height: im.h }, deviceScaleFactor: 1 });
  await p.setContent(`<!doctype html><html lang="fr"><head><meta charset="utf-8"></head><body>${im.html}</body></html>`);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(250);
  writeFileSync(SORTIE + im.nom, await p.screenshot({ omitBackground: !!im.transparent }));
  console.log(im.nom, im.w + '×' + im.h, Math.round(statSync(SORTIE + im.nom).size / 1024) + ' Ko');
  await p.close();
}
await navigateur.close();
ecrireTextes();
console.log('TEXTES.md');
