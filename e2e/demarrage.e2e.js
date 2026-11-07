// Le démarrage et le rapporteur d'erreurs (2026-11-07, M05.T1, M05.T4) :
// une ouverture se compte avec son temps, une erreur non rattrapée arrive
// nettoyée et une seule fois, hors ligne elle attend puis part, la démo
// n'envoie rien ; et si l'app ne charge pas, l'écran de secours le dit au
// bout de 15 s au lieu d'un écran figé.
import { test, expect } from '@playwright/test';
import { brancher, nouveauStore } from './faux-supabase.js';
import { inscrire } from './aide.js';

const SIGNALER = /\/rest\/v1\/rpc\/signaler$/;

/* les en-têtes de chaque rapport parti : jamais la session d'un compte */
function ecouterRapports(page) {
  const partis = [];
  page.on('request', r => { if (SIGNALER.test(r.url())) partis.push(r.headers()); });
  return partis;
}

test('une ouverture se compte, avec son temps, sans rien qui désigne le compte', async ({ page }) => {
  const store = nouveauStore();
  await brancher(page, store);
  const partis = ecouterRapports(page);
  await page.goto('./app');
  await expect.poll(() => (store.ouvertures || []).length).toBe(1);
  const o = store.ouvertures[0];
  expect(o.type).toBe('demarrage');
  expect(o.ms).toBeGreaterThan(0);
  expect(o.build).not.toBe('');
  expect(Object.keys(o).sort()).toEqual(['build', 'ecran', 'empreinte', 'installee', 'message', 'ms', 'navigateur', 'pile', 'plateforme', 'type']);

  // connecté, une erreur part encore sous la clé publique, jamais sous la session
  await inscrire(page);
  await page.evaluate(() => setTimeout(() => { throw new Error('boum pour lea@lycee.fr 3f2a9c1e-7b4d-4e2a-9f10-2c3d4e5f6a7b'); }));
  await expect.poll(() => (store.erreursClient || []).length).toBe(1);
  const e = store.erreursClient[0];
  expect(e.type).toBe('erreur');
  expect(e.message).toMatch(/Error: boum pour <courriel> <id>$/);
  expect(e.empreinte).toMatch(/^e[0-9a-f]{8}$/);
  const session = await page.evaluate(() => JSON.parse(localStorage.getItem('cartes.auth') || '{}').token || '');
  expect(session.length).toBeGreaterThan(10);
  expect(partis.length).toBeGreaterThanOrEqual(2);
  for (const h of partis) expect(h.authorization).not.toContain(session);
});

test('la même erreur ne part qu’une fois ; une promesse rejetée part aussi', async ({ page }) => {
  const store = nouveauStore();
  await brancher(page, store);
  await page.goto('./app');
  await expect.poll(() => (store.ouvertures || []).length).toBe(1);
  await page.evaluate(() => {
    for (let i = 0; i < 3; i++) setTimeout(() => { throw new Error('toujours la même ' + i); });
    Promise.reject(new Error('une promesse que personne n’attend'));
  });
  await expect.poll(() => (store.erreursClient || []).map(e => e.type).sort().join(',')).toBe('erreur,promesse');
  await page.waitForTimeout(500);
  expect(store.erreursClient).toHaveLength(2);
});

test('hors ligne, une erreur attend sur l’appareil puis part au retour du réseau', async ({ page }) => {
  const store = nouveauStore();
  await brancher(page, store);
  await page.goto('./app');
  await expect.poll(() => (store.ouvertures || []).length).toBe(1);
  store.online = false;
  await page.evaluate(() => setTimeout(() => { throw new Error('pendant la coupure'); }));
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('folio.erreurs') || '[]').length)).toBe(1);
  expect(store.erreursClient || []).toHaveLength(0);
  store.online = true;
  await page.evaluate(() => dispatchEvent(new Event('online')));
  await expect.poll(() => (store.erreursClient || []).length).toBe(1);
  expect(await page.evaluate(() => localStorage.getItem('folio.erreurs'))).toBeNull();
});

test('la démo n’envoie rien, même une erreur', async ({ page }) => {
  const store = nouveauStore();
  await brancher(page, store, { navigateur: true });
  const partis = ecouterRapports(page);
  await page.goto('./essayer');
  await page.locator('.dm-role[data-v="eleve"]').click();
  await page.evaluate(() => setTimeout(() => { throw new Error('dans la démo'); }));
  await page.waitForTimeout(1500);
  expect(partis).toHaveLength(0);
});

test('l’app ne charge pas : au bout de 15 s, l’écran de secours, puis « Réessayer » la rouvre', async ({ page }) => {
  test.setTimeout(60000);
  const store = nouveauStore();
  await brancher(page, store);
  const panne = /\/assets\/app-[^/]+\.js$/;
  await page.route(panne, r => r.abort());
  await page.goto('./app');
  const secours = page.locator('#boot .sec');
  await expect(secours).toBeVisible({ timeout: 20000 });
  await expect(page.locator('#boot')).toContainText('n’arrive pas à s’ouvrir');
  await page.unroute(panne);
  await secours.getByRole('button', { name: 'Réessayer' }).click();
  await expect(page.locator('#app')).not.toBeEmpty({ timeout: 15000 });
  await expect(page.locator('#boot .sec')).toHaveCount(0);
});
