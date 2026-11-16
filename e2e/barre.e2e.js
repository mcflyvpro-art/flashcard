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
