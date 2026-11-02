// Les pages du site autres que l'accueil (2026-11-02, src/site/pages.js,
// docs/SEO.md) : chacune s'ouvre à son adresse, sans erreur ni débordement
// au téléphone, avec son titre et son fil d'Ariane ; l'en-tête et son menu
// y mènent de l'une à l'autre ; les tarifs basculent, le calculateur de
// Campus compte, « J'ai un code » s'ouvre, et les boutons mènent à l'app.
// Un téléphone dans son navigateur, comme pour l'accueil (e2e/site.e2e.js).
import { test, expect } from '@playwright/test';
import { SOUS_PAGES } from '../src/site/pages.js';

test('chaque page s’ouvre à son adresse : son titre, un seul h1, aucune erreur, aucun débordement', async ({ page }) => {
  const erreurs = [];
  page.on('pageerror', e => erreurs.push(e.message));
  page.on('console', m => { if (m.type() === 'error') erreurs.push(m.text()); });
  for (const p of SOUS_PAGES) {
    const r = await page.goto('.' + p.chemin);
    expect(r.status(), p.chemin).toBe(200);
    await expect(page).toHaveTitle(p.titre);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('.ariane [aria-current="page"]')).toHaveText(p.nom);
    expect(await page.evaluate(() => document.documentElement.scrollWidth), p.chemin).toBeLessThanOrEqual(390);
  }
  expect(erreurs).toEqual([]);
});

test('de l’accueil aux pages et retour, par le menu du téléphone et le pied de page', async ({ page }) => {
  await page.goto('./?site');
  await page.getByRole('button', { name: 'Ouvrir le menu' }).click();
  await page.locator('#menu-mobile').getByRole('link', { name: 'Établissements' }).click();
  await expect(page).toHaveURL(/\/etablissements$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('tout');

  await page.getByRole('button', { name: 'Ouvrir le menu' }).click();
  await expect(page.locator('#menu-mobile [aria-current="page"]')).toHaveText('Établissements');
  await page.locator('#menu-mobile').getByRole('link', { name: 'Le moteur' }).click();
  await expect(page).toHaveURL(/\/repetition-espacee$/);
  await expect(page.locator('.co-svg')).toBeVisible();                      // la courbe, dessinée au build

  await page.locator('.pied').getByRole('link', { name: 'Anki, Quizlet ou Mirandola' }).click();
  await expect(page).toHaveURL(/\/anki-quizlet$/);
  await page.locator('.ariane').getByRole('link', { name: 'Mirandola' }).click();
  await expect(page).toHaveURL(/\/$/);
});

test('les tarifs basculent, le calculateur compte, et « Passer à Mirandola+ » mène à l’app', async ({ page }) => {
  await page.goto('./tarifs');
  const prix = page.locator('.offre-plus .prix b');
  await expect(prix).toHaveText(/^4,17\s€$/);
  await page.getByRole('radio', { name: 'Mensuel' }).click();
  await expect(prix).toHaveText(/^6,99\s€$/);
  await expect(page.locator('.offre-plus [data-vente]')).toHaveAttribute('href', '/app?plus=mensuel');

  await page.goto('./etablissements');
  const places = page.locator('#calcul-places');
  await places.scrollIntoViewIfNeeded();
  await expect(page.locator('#calcul-prix')).toHaveText(/^1\s900\s€\sHT$/);
  await places.fill('16');
  await expect(page.locator('#calcul-prix')).toHaveText(/^100\s€\sHT$/);
  await page.locator('.p-heros').getByRole('link', { name: 'Demander une démo' }).click();
  await expect(page).toHaveURL(/\/demande-demo$/);
});

test('« J’ai un code » s’ouvre sur une page du site et mène à l’app', async ({ page }) => {
  await page.goto('./flashcards-ia');
  await page.getByRole('button', { name: 'Ouvrir le menu' }).click();
  await page.locator('#menu-mobile').getByRole('button', { name: 'J’ai un code' }).click();
  const fenetre = page.locator('#fenetre-code');
  await expect(fenetre).toBeVisible();
  await fenetre.getByRole('textbox', { name: 'Le code' }).fill('482913');
  await fenetre.getByRole('button', { name: 'Continuer' }).click();
  // l'app garde le code le temps de la connexion, et le montre à recopier (e2e/site.e2e.js)
  await expect(page.locator('#passage')).toContainText('482 913', { timeout: 10000 });
});
