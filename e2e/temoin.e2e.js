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

// Les trois textes du cadre se chargent à la demande (ui/legal-textes.js) :
// ils doivent s'ouvrir avant tout compte, et passer de l'un à l'autre.
test('les conditions d’utilisation s’ouvrent depuis l’écran de connexion', async ({ page }) => {
  const erreurs = [];
  page.on('pageerror', e => erreurs.push(e.message));
  await page.goto('./');
  await page.locator('.lleg [data-legal="cgu"]').click();
  await expect(page.locator('.bar h1')).toHaveText('Conditions d’utilisation');
  await expect(page.locator('.legal')).toContainText('Ce que Folio est');
  await page.locator('#lgTabs [data-legal="vie"]').click();
  await expect(page.locator('.legal')).toContainText('Qui traite tes données');
  await page.getByRole('button', { name: 'Retour' }).click();
  await expect(page.getByRole('button', { name: 'Se connecter' })).toBeVisible();
  expect(erreurs).toEqual([]);
});

// Sur iPhone, un QR de partie scanné ouvre Safari, pas l'app installée : le
// code doit s'y lire en gros, prêt à copier, et attendre la connexion.
test('un QR de partie ouvert hors de l’app : le code en gros, prêt à copier', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('./?defi=482913');
  const carte = page.locator('#passage');
  await expect(carte).toContainText('482 913', { timeout: 10000 });
  await expect(carte).toContainText('Entrer un code');
  await expect(page).not.toHaveURL(/defi=/);            // rangé en attendant la connexion
  await carte.getByRole('button', { name: 'Copier' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('482913');
  await page.reload();
  await expect(page.locator('#passage')).toContainText('482 913');
  const largeur = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(largeur).toBeLessThanOrEqual(390);
});
