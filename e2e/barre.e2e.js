// La barre du bas vivante (ui/barre.js, 2026-11-16) : on glisse la pastille
// d'un onglet à l'autre, et, quoi qu'on fasse et aussi vite qu'on le fasse,
// elle finit sous l'onglet ouvert. Le bug du 2026-11-16 : un appui rapide
// juste après un glisser était avalé — la pastille partait sur un onglet qui
// ne s'ouvrait pas, et l'icône de l'onglet ouvert restait blanche sur blanc.
// Les gestes passent par la souris : le même code, et WebKit les joue aussi.
import { test, expect } from '@playwright/test';
import { brancher, nouveauStore } from './faux-supabase.js';
import { inscrire } from './aide.js';

async function ouvrir(page) {
  const store = nouveauStore();
  await brancher(page, store);
  await inscrire(page);
  // la barre vivante se charge au calme, après l'ouverture
  await page.waitForFunction(() => performance.getEntriesByType('resource').some(r => /\/barre-/.test(r.name)), null, { timeout: 15000 });
  const boutons = page.locator('.tabs button');
  await expect(boutons).toHaveCount(2);
  const centres = [];
  for (let i = 0; i < 2; i++) { const b = await boutons.nth(i).boundingBox(); centres.push([b.x + b.width / 2, b.y + b.height / 2]); }
  return centres;
}

// la pastille posée (plus de ressort) sous l'onglet ouvert
async function poseeSurLOnglet(page) {
  await expect.poll(() => page.evaluate(() => {
    const nav = document.querySelector('.tabs'), sl = nav.querySelector('.sl');
    const i = [...nav.querySelectorAll('button')].findIndex(b => b.getAttribute('aria-current') === 'page');
    const x = new DOMMatrixReadOnly(getComputedStyle(sl).transform).m41;
    return Math.abs(x - i * 74) < 1 && !nav.classList.contains('presse') ? 'posée' : `x=${x.toFixed(1)}, onglet ${i}`;
  }), { timeout: 4000 }).toBe('posée');
}

test('glisser la pastille d’un onglet à l’autre l’ouvre ; glisser puis revenir ne change rien', async ({ page }) => {
  const [a, b] = await ouvrir(page);
  await page.mouse.move(...a);
  await page.mouse.down();
  await expect(page.locator('.tabs.presse')).toHaveCount(1);              // appuyée, elle grossit
  await page.mouse.move(...b, { steps: 10 });
  await expect(page.locator('.tabs button.vise')).toHaveCount(1);         // l'icône couverte s'allume
  await page.mouse.up();
  await expect(page.locator('.tabs button').nth(1)).toHaveAttribute('aria-current', 'page');
  await poseeSurLOnglet(page);

  const adresse = page.url();
  await page.mouse.move(...b); await page.mouse.down();
  await page.mouse.move(...a, { steps: 6 }); await page.mouse.move(...b, { steps: 6 });
  await page.mouse.up();
  await poseeSurLOnglet(page);
  expect(page.url()).toBe(adresse);
});

test('changer vite d’onglet : la pastille finit toujours sous l’onglet ouvert', async ({ page }) => {
  const [a, b] = await ouvrir(page);
  // un glisser, puis aussitôt un appui sur l'autre onglet (celui-là était avalé)
  await page.mouse.move(...a); await page.mouse.down();
  await page.mouse.move(...b, { steps: 4 }); await page.mouse.up();
  await page.mouse.click(...a);
  await expect(page.locator('.tabs button').nth(0)).toHaveAttribute('aria-current', 'page');
  await poseeSurLOnglet(page);
  // une rafale d'appuis, sans attendre que la pastille se pose
  for (let k = 0; k < 9; k++) await page.mouse.click(...(k % 2 ? a : b), { delay: 15 });   // le dernier : « Mes amis »
  await expect(page.locator('.tabs button').nth(1)).toHaveAttribute('aria-current', 'page', { timeout: 5000 });
  await poseeSurLOnglet(page);
  // l'icône de l'onglet ouvert n'est jamais blanche sur la barre
  expect(await page.locator('.tabs button.vise').count()).toBe(0);
});

// Au doigt, les événements d'un appui vont au bouton touché : redessiné pendant
// l'appui (une relecture de fond), il quitte la page et le lâcher ne remontait
// plus — la pastille restait grossie, et plus aucun appui ne répondait.
// Le toucher passe par Chromium (CDP) : WebKit le saute.
test('au doigt, harcelée, redessinée pendant l’appui : la barre ne reste jamais coincée', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'le toucher simulé passe par CDP');
  const [a, b] = await ouvrir(page);
  const cdp = await page.context().newCDPSession(page);
  const touche = (type, [x, y] = [0, 0]) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  const redessiner = () => page.evaluate(() => { const n = document.querySelector('.tabs'); n.replaceWith(n.cloneNode(true)); });

  // la barre redessinée sous le doigt, puis le doigt se lève
  await touche('touchStart', a);
  await touche('touchMove', [(a[0] + b[0]) / 2, a[1]]);
  await redessiner();
  await touche('touchMove', b);
  await touche('touchEnd');
  await poseeSurLOnglet(page);

  // le harcèlement : des appuis partout, très vite, des glisser, des rendus au milieu
  const points = [a, b, [(a[0] + b[0]) / 2, a[1]], [a[0] - 20, a[1] + 8], [b[0] + 25, b[1] - 10]];
  for (let k = 0; k < 40; k++) {
    const p = points[(k * 7) % points.length], q = points[(k * 3 + 1) % points.length];
    await touche('touchStart', p);
    if (k % 3 === 0) await touche('touchMove', q);
    if (k % 5 === 0) await redessiner();
    if (k % 4 === 1) await redessiner();                               // le rendu juste avant le lâcher
    await touche('touchEnd');
  }
  await poseeSurLOnglet(page);
  expect(await page.locator('.tabs.presse, .tabs button.vise').count()).toBe(0);

  // et elle répond toujours : un appui sur l'autre onglet l'ouvre
  const ouvert = await page.locator('.tabs button[aria-current="page"]').getAttribute('aria-label');
  const autre = ouvert === 'Paquets' ? b : a;
  await touche('touchStart', autre); await touche('touchEnd');
  await expect(page.locator('.tabs button[aria-current="page"]')).not.toHaveAttribute('aria-label', ouvert);
  await poseeSurLOnglet(page);
});

// Ce que fait Safari sur iPhone : les événements d'un appui restent adressés au
// bouton touché, même s'il a quitté la page (la barre redessinée pendant
// l'appui) — le lâcher ne remonte plus jusqu'à la fenêtre. On le joue tel quel :
// le lâcher envoyé au bouton détaché.
test('le lâcher adressé au bouton disparu (Safari) ne coince pas la barre', async ({ page }) => {
  const [a, b] = await ouvrir(page);
  const coince = await page.evaluate(([a, b]) => {
    const evt = (type, [x, y], id) => new PointerEvent(type, { bubbles: true, cancelable: true, composed: true, pointerId: id, isPrimary: true, pointerType: 'touch', clientX: x, clientY: y, button: 0, buttons: type === 'pointerup' ? 0 : 1 });
    const bouton = document.elementFromPoint(...a).closest('button');
    bouton.dispatchEvent(evt('pointerdown', a, 41));
    const n = document.querySelector('.tabs'); n.replaceWith(n.cloneNode(true));   // le rendu pendant l'appui
    bouton.dispatchEvent(evt('pointermove', b, 41));
    bouton.dispatchEvent(evt('pointerup', b, 41));                                   // adressé au bouton parti
    return new Promise(r => setTimeout(() => r(document.querySelectorAll('.tabs.presse').length), 900));
  }, [a, b]);
  expect(coince).toBe(0);
  await poseeSurLOnglet(page);
  // un appui suivant répond
  await page.mouse.click(...b);
  await expect(page.locator('.tabs button').nth(1)).toHaveAttribute('aria-current', 'page');
  await poseeSurLOnglet(page);
});
