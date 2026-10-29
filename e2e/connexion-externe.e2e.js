// Se connecter par Google ou Apple, et le lien « mot de passe oublié »
// (2026-10-29, core/connexion-externe.js) : les boutons ne paraissent que
// pour un fournisseur allumé dans le projet ; le retour porte la session dans
// l'adresse, l'app l'ouvre et la retire aussitôt de l'adresse ; un lien de
// récupération mène tout droit au choix d'un nouveau mot de passe.
import { test, expect } from '@playwright/test';
import { brancher, nouveauStore } from './faux-supabase.js';
import { semerCompte } from './faux-cercle.js';
import { sansTuto } from './aide.js';

async function ouvrir(page) {
  await page.goto('./app');
  await expect(page.locator('#boot')).toHaveCount(0, { timeout: 10000 });
}

test('aucun fournisseur allumé : la connexion par e-mail, seule', async ({ page }) => {
  const store = nouveauStore();
  await brancher(page, store);
  await ouvrir(page);
  await expect(page.getByRole('textbox', { name: 'Adresse e-mail' })).toBeVisible();
  await page.waitForTimeout(500);
  await expect(page.locator('#lext')).toBeHidden();
});

test('Google allumé : « Continuer avec Google » ouvre la session, et l’adresse ne garde aucun jeton', async ({ page }) => {
  const store = nouveauStore();
  store.fournisseurs = { google: true, apple: false };
  store.oauth = { google: 'nina@gmail.com' };
  await brancher(page, store);
  await ouvrir(page);
  await expect(page.getByRole('button', { name: 'Continuer avec Google' })).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('button', { name: 'Continuer avec Apple' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Continuer avec Google' }).click();
  await expect(page.locator('#app')).not.toHaveAttribute('data-view', 'login', { timeout: 10000 });
  expect(store.users.some(u => u.email === 'nina@gmail.com')).toBe(true);
  expect(page.url()).not.toContain('access_token');
});

test('le lien « mot de passe oublié » : un nouveau mot de passe d’abord', async ({ page }) => {
  const store = nouveauStore();
  const id = semerCompte(store, 'lea@exemple.fr', 'oublie-depuis-longtemps');
  sansTuto(store, 'lea@exemple.fr');
  await brancher(page, store);
  await page.goto(`./app#access_token=tok-${id}-lien&refresh_token=ref-${id}&expires_in=3600&token_type=bearer&type=recovery`);
  await expect(page.getByRole('heading', { name: 'Choisis un nouveau mot de passe.' })).toBeVisible({ timeout: 10000 });
  expect(page.url()).not.toContain('access_token');
  await page.locator('#mdp1').fill('tout-neuf-2026');
  await page.locator('#mdp2').fill('tout-neuf-2026');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByRole('heading', { name: 'Choisis un nouveau mot de passe.' })).toHaveCount(0, { timeout: 10000 });
  expect(store.users.find(u => u.id === id).password).toBe('tout-neuf-2026');
});

test('un lien expiré : la connexion, et ce qu’il faut faire', async ({ page }) => {
  const store = nouveauStore();
  await brancher(page, store);
  await page.goto('./app#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired');
  await expect(page.locator('.toast')).toContainText('Ce lien a expiré', { timeout: 10000 });
  await expect(page.getByRole('textbox', { name: 'Adresse e-mail' })).toBeVisible();
  expect(page.url()).not.toContain('error');
});
