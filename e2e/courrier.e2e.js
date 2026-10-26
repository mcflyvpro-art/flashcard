// Le courrier refait (2026-10-25) : une lettre dit qui l'envoie, quand, ce
// qu'il dit, et le livre qu'elle contient — sa matière, ses pages, qu'on
// lit avant de l'ajouter.
import { test, expect } from '@playwright/test';
import { brancher, nouveauStore } from './faux-supabase.js';
import { inscrire } from './aide.js';

const J = 864e5;

test('un courrier : qui, quand, quel livre, quelle matière, ses pages, puis l’ajouter', async ({ page }) => {
  const store = nouveauStore();
  await brancher(page, store);
  await inscrire(page);
  store.tables.mail = [{
    id: 7, from_user: '5b7a3c1e-0000-4000-8000-000000000007', from_name: 'Thibaut', deck_name: 'Mobility',
    subject_name: 'Anglais', message: 'Tiens, pour jeudi', created_at: new Date(Date.now() - 19 * J).toISOString(),
    cards: Array.from({ length: 32 }, (_, j) => ['word ' + j, 'mot ' + j]), read_at: null, added_at: null
  }];
  await page.goto('./app?go=mail');
  const ligne = page.locator('.co-ligne');
  for (const t of ['Thibaut', 'Mobility', 'Anglais', '32 pages', '19 j', '« Tiens, pour jeudi »']) await expect(ligne).toContainText(t);
  await expect(ligne).toHaveClass(/neuf/);

  await ligne.click();
  const lettre = page.locator('.co-lettre');
  for (const t of ['Thibaut', 't’a envoyé un livre', 'Tiens, pour jeudi', 'Mobility', 'Anglais', '32 pages']) await expect(lettre).toContainText(t);
  await expect(page.locator('.co-liste li')).toHaveCount(12);
  await expect(page.locator('.co-liste li').first()).toContainText('word 0');
  await expect.poll(() => store.tables.mail[0].read_at, { timeout: 5000 }).toBeTruthy();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole('button', { name: 'Voir les 32 pages' }).click();
  await expect(page.locator('.co-liste li')).toHaveCount(32);

  await page.getByRole('button', { name: 'Ajouter à ma bibliothèque' }).click();
  await expect(page.getByRole('button', { name: 'Menu du livre' })).toBeVisible();
  await expect(page.locator('main .lbl').first()).toContainText('32');
  // le retour du livre ramène à la lettre, qui sait maintenant que le livre est là
  await page.getByRole('button', { name: 'Retour' }).first().click();
  await expect(page.getByRole('button', { name: /Ouvrir « Mobility »/ })).toBeVisible();
  await page.getByRole('button', { name: 'Retour' }).first().click();
  await expect(page.locator('.co-ligne')).not.toHaveClass(/neuf/);
});
