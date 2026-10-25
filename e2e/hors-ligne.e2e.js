// M07.T3 — réviser sans réseau, fermer et rouvrir l'app toujours sans
// réseau, puis retrouver le réseau : aucune des 50 révisions ne se perd.
import { test, expect } from '@playwright/test';
import { brancher, nouveauStore, semerPaquetDu } from './faux-supabase.js';
import { inscrire, noter } from './aide.js';

test('50 révisions hors ligne, app rouverte hors ligne, 50 retrouvées au retour du réseau', async ({ page, context }) => {
  test.setTimeout(240000);
  const store = nouveauStore();
  await brancher(context, store);
  await inscrire(page);
  const deckId = semerPaquetDu(store, 'lea@exemple.fr', 50);
  await page.reload();
  await expect(page.getByRole('button', { name: /Révisions/ })).toBeVisible({ timeout: 10000 });
  // le service worker doit tenir l'app avant qu'on coupe : sinon rien ne rouvrirait hors ligne
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 10000 }).toBe(true);

  // page.route passe avant la coupure de Playwright : couper les deux, comme un vrai tunnel
  await context.setOffline(true); store.online = false;
  await page.getByRole('button', { name: /Révisions/ }).click();
  await page.getByRole('button', { name: /^Lire/ }).click();
  for (let k = 0; k < 50; k++) await noter(page, 'Facile');
  await expect(page.locator('main')).toContainText('100%');
  expect(store.tables.reviews || []).toHaveLength(0);            // rien n'a pu partir

  // fermer et rouvrir l'app, toujours sans réseau : la file doit survivre
  const finSeance = Date.now();
  await page.reload();
  await expect(page.getByRole('button', { name: /Révisions/ })).toBeVisible({ timeout: 10000 });
  expect(store.tables.reviews || []).toHaveLength(0);
  // le journal les compte déjà, hors ligne, depuis ce que l'appareil a gardé
  await page.locator('[data-act="goalinfo"]').click();
  await expect(page.locator('[data-k="pages"] b')).toHaveText('50', { timeout: 10000 });
  await page.waitForTimeout(1500);                              // une séance hors ligne n'est pas « dans le futur »

  store.online = true; await context.setOffline(false);
  await expect.poll(() => (store.tables.reviews || []).length, { timeout: 30000 }).toBe(50);
  // la base les confirme : le journal se relit et en compte toujours 50, pas 100
  await expect.poll(() => store.journal.filter(l => l.includes('rpc/journal') && l.endsWith('200')).length, { timeout: 20000 })
    .toBeGreaterThan(0);
  await expect(page.locator('[data-k="pages"] b')).toHaveText('50');
  // datées du moment de la lecture, pas de l'envoi
  expect(store.tables.reviews.every(r => Date.parse(r.created_at) <= finSeance)).toBe(true);
  const reviews = store.tables.reviews;
  expect(new Set(reviews.map(r => r.client_id)).size).toBe(50);   // 50 distinctes, aucun doublon
  expect(new Set(reviews.map(r => r.card_id)).size).toBe(50);
  expect(reviews.every(r => r.deck_id === deckId && r.rating === 3)).toBe(true);
  // et l'état des cartes a suivi : plus aucune n'est due aujourd'hui
  await expect.poll(() => store.tables.cards.filter(c => c.deck_id === deckId && c.due > Date.now()).length,
    { timeout: 15000 }).toBe(50);
});
