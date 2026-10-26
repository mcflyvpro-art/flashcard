// « Essayer sans compte » (2026-10-26) : depuis l'écran de connexion, un
// visiteur entre dans le Lycée Démo Folio comme élève, professeur ou
// référent — les vrais écrans, servis par le lycée fictif (src/demo-etab.js).
// Rien ne part vers la base, une écriture est refusée honnêtement, et
// « Quitter » ramène à l'écran de connexion sans rien laisser derrière.
import { test, expect } from '@playwright/test';
import { brancher, nouveauStore } from './faux-supabase.js';

const BASE = /\/(rest|auth|storage|functions)\/v1\//;

async function ouvrirDemo(page) {
  const store = nouveauStore();
  await brancher(page, store);
  const parties = [];
  page.on('request', r => { if (BASE.test(r.url())) parties.push(r.method() + ' ' + new URL(r.url()).pathname); });
  await page.goto('./');
  await expect(page.locator('#boot')).toHaveCount(0, { timeout: 10000 });
  await page.getByRole('button', { name: 'Essayer sans compte' }).click();
  await expect(page.locator('#app')).toHaveAttribute('data-view', 'decouvrir');
  await expect(page.getByText('Lycée Démo Folio')).toBeVisible();
  parties.length = 0;                      // seul compte ce qui part après l'entrée dans la démo
  return parties;
}

test('élève : ses devoirs, sa classe, un devoir ouvert et lu', async ({ page }) => {
  const parties = await ouvrirDemo(page);
  await page.locator('.dm-role[data-v="eleve"]').click();

  await expect(page.locator('#app')).toHaveAttribute('data-view', 'classes', { timeout: 10000 });
  await expect(page.locator('#page').getByText('Léa MARTIN')).toBeVisible();
  await expect(page.getByText('Fonctions affines')).toBeVisible();
  await expect(page.locator('.dm-bandeau')).toBeVisible();

  await page.getByText('Fonctions affines').click();
  await expect(page.locator('#app')).toHaveAttribute('data-view', 'deck', { timeout: 10000 });
  await page.locator('[data-act="study"]').click();
  await expect(page.locator('#app')).toHaveAttribute('data-view', 'study');
  expect(parties).toEqual([]);
});

test('professeur : ses classes et son groupe, une classe ouverte', async ({ page }) => {
  const parties = await ouvrirDemo(page);
  await page.locator('.dm-role[data-v="prof"]').click();

  await expect(page.getByText('Bonjour, Marc')).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('DEMX-PK47').first()).toBeVisible();
  await page.locator('[data-pf="classe"]:visible').filter({ hasText: '2nde B' }).first().click();
  await expect(page.getByText('Léa MARTIN').first()).toBeVisible({ timeout: 10000 });
  expect(parties).toEqual([]);
});

test('référent, sur ordinateur : les codes, la liste des élèves ; une écriture est refusée', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const parties = await ouvrirDemo(page);
  await page.locator('.dm-role[data-v="ref"]').click();

  await expect(page.getByText('PRFQ-WT58')).toBeVisible({ timeout: 10000 });
  await page.getByRole('tab', { name: /Élèves/ }).click();
  await expect(page.locator('#page').getByText('Léa MARTIN')).toBeVisible();

  await page.getByRole('tab', { name: /Accueil/ }).click();
  await page.getByRole('button', { name: 'Changer' }).first().click();
  await page.getByRole('button', { name: 'Sûr ? L’ancien cessera' }).click();
  await expect(page.locator('.toast')).toContainText('Démo : rien n’est enregistré');
  await expect(page.getByText('DEMX-PK47')).toBeVisible();
  expect(parties).toEqual([]);
});

test('le bandeau change de rôle, et « Quitter » ramène à la connexion', async ({ page }) => {
  await ouvrirDemo(page);
  await page.locator('.dm-role[data-v="eleve"]').click();
  await expect(page.locator('#page').getByText('Léa MARTIN')).toBeVisible({ timeout: 10000 });

  await page.locator('.dm-bandeau select').selectOption('prof');
  await expect(page.getByText('Bonjour, Marc')).toBeVisible({ timeout: 10000 });

  await page.locator('.dm-bandeau').getByRole('button', { name: 'Quitter' }).click();
  await expect(page.getByRole('button', { name: 'Se connecter' })).toBeVisible({ timeout: 10000 });
  await expect(page.locator('.dm-bandeau')).toHaveCount(0);
  const restes = await page.evaluate(() => Object.keys(localStorage).filter(k => /demo-/.test(k)));
  expect(restes).toEqual([]);
});
