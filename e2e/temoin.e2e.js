// M07.T1 — le parcours témoin : l'app s'ouvre, l'écran de connexion est là,
// rien ne plante, rien ne déborde sur un téléphone.
import { test, expect } from '@playwright/test';

test('ouvrir l’app sans compte : écran de connexion, aucune erreur, aucun débordement', async ({ page }) => {
  const erreurs = [];
  page.on('pageerror', e => erreurs.push(e.message));

  await page.goto('./');
  await expect(page.getByRole('button', { name: 'Se connecter' })).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('textbox', { name: 'Adresse e-mail' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Mot de passe' })).toBeVisible();

  // l'écran d'ouverture finit par laisser la place (M05.T4 : 3 s exprès)
  await expect(page.locator('#boot')).toHaveCount(0, { timeout: 8000 });

  const largeur = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(largeur).toBeLessThanOrEqual(390);
  expect(erreurs).toEqual([]);
});
