// Prêter un livre par son CODE (2026-11-05, src/livre-code.js). Le lien de
// consultation se perdait : sur un téléphone sans l'app, il tombait sur la
// porte d'installation ; sans session, sur la connexion — et le livre
// n'arrivait jamais. Un code se recopie partout et s'entre dans « J'ai un
// code » ; le lien, lui, attend désormais la connexion et montre son code.
import { test, expect } from '@playwright/test';
import { brancher, nouveauStore } from './faux-supabase.js';
import { creerLivre, inscrire } from './aide.js';

const MDP = 'motdepasse-solide-42';

/* Léa crée un livre et son code de partage ; rend le code lu à l'écran. */
async function codeDeLea(page) {
  await inscrire(page, 'lea@exemple.fr');
  await creerLivre(page, 'Capitales', 3);
  await page.locator('[data-act="sharepick"]').first().click();
  await page.locator('[data-mact="rolink"]').click();
  const code = await page.locator('#lccode').textContent();
  expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{2}$/);
  await expect(page.locator('#lcqr svg')).toBeVisible();          // le QR mène au même livre
  return code;
}

async function entrerCode(page, code) {
  await page.getByRole('button', { name: 'Nouveau livre' }).click();
  await page.getByRole('button', { name: 'J’ai un code' }).click();
  await page.locator('#cecode').fill(code);
  await expect(page.locator('#cecode')).toHaveValue(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{2}$/);   // remis en forme XXXX-XXXX-XX
  await page.locator('#ceok').click();
}

test('un code prête le livre ; révoqué, il ne mène plus à rien', async ({ page, browser }) => {
  const store = nouveauStore();
  const erreurs = [];
  page.on('pageerror', e => erreurs.push(e.message));
  await brancher(page, store);
  const code = await codeDeLea(page);

  // ce que la base prête : recto et verso, jamais l'état d'apprentissage de Léa
  const tok = code.replace(/-/g, '').toLowerCase();
  const prete = store.tables.shares.find(s => s.token === tok);
  expect(prete).toBeTruthy();

  const hugo = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await brancher(hugo, store);
  const p2 = await hugo.newPage();
  p2.on('pageerror', e => erreurs.push(e.message));
  await inscrire(p2, 'hugo@exemple.fr');
  await entrerCode(p2, code.toLowerCase().replace(/-/g, ' '));      // tapé n'importe comment, il se remet en forme
  await expect(p2.locator('.hero', { hasText: 'Capitales' })).toBeVisible();
  await expect(p2.getByText('Pays 2', { exact: true })).toBeVisible();
  await p2.locator('[data-act="addshared"]').click();
  await expect(p2.getByRole('button', { name: 'Menu du livre' })).toBeVisible();
  await expect(p2.locator('main .lbl').first()).toContainText('3');

  // Léa révoque : le même code ne mène plus à rien
  await page.locator('[data-mact="roff"]').click();
  await expect(page.locator('[data-mact="rolink"]')).toBeVisible();
  await p2.getByRole('button', { name: 'Retour' }).first().click();
  await entrerCode(p2, code);
  await expect(p2.getByText('Aucun livre à ce code')).toBeVisible();
  expect(erreurs).toEqual([]);
  await hugo.close();
});

test.describe('le lien d’un livre, sans session', () => {
  test.use({ viewport: { width: 1280, height: 860 }, isMobile: false, hasTouch: false,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36' });

  test('sur ordinateur : il attend la connexion, puis le livre s’ouvre', async ({ page, browser }) => {
    const store = nouveauStore();
    await brancher(page, store);
    const code = await codeDeLea(page);
    const tok = code.replace(/-/g, '').toLowerCase();

    const hugo = await browser.newContext({ viewport: { width: 1280, height: 860 } });
    await brancher(hugo, store, { navigateur: true });
    const p2 = await hugo.newPage();
    await inscrire(p2, 'hugo@exemple.fr');
    await p2.evaluate(() => localStorage.removeItem('cartes.auth'));        // déconnecté, le compte existe
    await p2.goto('./#s=' + tok);                                            // par la page d'accueil et son aiguillage
    await expect(p2.locator('#passage')).toContainText(code);
    await expect(p2).not.toHaveURL(/#s=/);                                  // le jeton ne traîne pas dans l'adresse
    await p2.getByRole('textbox', { name: 'Adresse e-mail' }).fill('hugo@exemple.fr');
    await p2.getByRole('textbox', { name: 'Mot de passe' }).fill(MDP);
    await p2.getByRole('button', { name: 'Se connecter' }).click();
    await expect(p2.locator('.hero', { hasText: 'Capitales' })).toBeVisible({ timeout: 10000 });
    await expect(p2.locator('[data-act="addshared"]')).toBeVisible();
    await hugo.close();
  });

  test('avec une session : le lien ouvre le livre tout de suite', async ({ page }) => {
    const store = nouveauStore();
    await brancher(page, store);
    const code = await codeDeLea(page);
    await page.keyboard.press('Escape');
    await page.goto('./#s=' + code.replace(/-/g, '').toLowerCase());
    await expect(page.locator('.hero', { hasText: 'Capitales' })).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-act="addshared"]')).toBeVisible();
  });
});

test.describe('le lien d’un livre, dans Safari sur iPhone', () => {
  test.use({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1' });

  test('la porte d’installation montre le code à recopier dans l’app', async ({ page, browser }) => {
    const store = nouveauStore();
    await brancher(page, store);
    const code = await codeDeLea(page);

    const autre = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1' });
    await brancher(autre, store, { navigateur: true });
    const p2 = await autre.newPage();
    await p2.goto('./#s=' + code.replace(/-/g, '').toLowerCase());
    await expect(p2.getByRole('heading', { name: 'Installe Mirandola' })).toBeVisible({ timeout: 10000 });
    await expect(p2.locator('#passage')).toContainText(code);
    await expect(p2.locator('#passage')).toContainText('J’ai un code');
    await expect(p2.locator('#passcopie')).toBeVisible();
    await autre.close();
  });
});

test('un lien de livre collé dans « J’ai un code » marche aussi', async ({ page, browser }) => {
  const store = nouveauStore();
  await brancher(page, store);
  const code = await codeDeLea(page);
  const hugo = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await brancher(hugo, store);
  const p2 = await hugo.newPage();
  await inscrire(p2, 'hugo@exemple.fr');
  await p2.getByRole('button', { name: 'Nouveau livre' }).click();
  await p2.getByRole('button', { name: 'J’ai un code' }).click();
  await p2.locator('#cecode').fill('« Capitales » sur Mirandola Code : ' + code + ' https://mirandola.fr/#s=' + code.replace(/-/g, '').toLowerCase());
  await expect(p2.locator('#cecode')).toHaveValue(code);
  await p2.locator('#ceok').click();
  await expect(p2.locator('.hero', { hasText: 'Capitales' })).toBeVisible();
  await hugo.close();
});
