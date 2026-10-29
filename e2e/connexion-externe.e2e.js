// Se connecter par Google, le lien « mot de passe oublié », et l'inscription par
// e-mail quand le projet demande de confirmer l'adresse (2026-10-29,
// core/connexion-externe.js, src/connexion-erreurs.js) : le bouton ne paraît
// que pour Google allumé dans le projet (Apple est écarté, même allumé) ; le
// retour porte la session dans l'adresse, l'app l'ouvre et la retire aussitôt ;
// un lien de récupération mène au choix d'un nouveau mot de passe ; un refus de
// Supabase Auth se dit avec son vrai motif.
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
  store.fournisseurs = { google: true, apple: true };          // Apple écarté le 2026-10-29 : même allumé, pas de bouton
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

/* Le formulaire d'inscription : l'adresse, le mot de passe, la case des 15 ans. */
async function inscrire(page, email, pw) {
  await page.locator('[data-lm="up"]').click();
  await page.locator('#em').fill(email);
  await page.locator('#pw').fill(pw);
  await page.locator('#age').check();
  await page.locator('#go').click();
}
async function connecter(page, email, pw) {
  await page.locator('#em').fill(email);
  await page.locator('#pw').fill(pw);
  await page.locator('#go').click();
}

test('confirmer son adresse : le compte attend son lien, la connexion dit pourquoi et renvoie l’e-mail', async ({ page }) => {
  const store = nouveauStore();
  store.confirmation = true;
  await brancher(page, store);
  await ouvrir(page);
  await inscrire(page, 'zoe@exemple.fr', 'un-mot-de-passe');
  await expect(page.locator('#le')).toContainText('Compte créé', { timeout: 10000 });

  // pas encore confirmée : le vrai motif, et de quoi recevoir le lien de nouveau
  await connecter(page, 'zoe@exemple.fr', 'un-mot-de-passe');
  await expect(page.locator('#le')).toContainText('pas encore confirmée', { timeout: 10000 });
  await page.getByRole('button', { name: 'Renvoyer l’e-mail' }).click();
  await expect(page.locator('#le')).toContainText('E-mail renvoyé');
  expect(store.courriels.map(c => c.type)).toEqual(['signup', 'signup']);

  // le lien suivi, la même connexion entre
  store.users.find(u => u.email === 'zoe@exemple.fr').confirme = true;
  await connecter(page, 'zoe@exemple.fr', 'un-mot-de-passe');
  await expect(page.locator('#app')).not.toHaveAttribute('data-view', 'login', { timeout: 10000 });
});

test('la limite d’e-mails du projet : l’inscription le dit, au lieu de « Inscription impossible »', async ({ page }) => {
  const store = nouveauStore();
  Object.assign(store, { confirmation: true, limiteCourriels: 0 });
  await brancher(page, store);
  await ouvrir(page);
  await inscrire(page, 'tom@exemple.fr', 'un-mot-de-passe');
  await expect(page.locator('#le')).toContainText('ne peut pas partir', { timeout: 10000 });
  expect(store.users.some(u => u.email === 'tom@exemple.fr')).toBe(false);

  // un mauvais mot de passe reste un mauvais mot de passe
  await page.locator('[data-lm="in"]').click();
  await connecter(page, 'personne@exemple.fr', 'pas-le-bon');
  await expect(page.locator('#le')).toContainText('E-mail ou mot de passe incorrect');
});
