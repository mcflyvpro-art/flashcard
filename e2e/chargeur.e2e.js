// Les écrans à la demande (2026-11-18) : la création, la page d'un club, les
// feuilles du cercle arrivent avec leur morceau. On en retient un exprès —
// un réseau lent, un téléphone qui se réveille : le chargeur paraît, puis
// l'écran, sans rien perdre ; un geste fait avant l'arrivée du morceau est
// rejoué. Le service worker est bloqué : il servirait le morceau de son
// cache avant que la route ne le voie.
import { test, expect } from '@playwright/test';
import { brancher, nouveauStore, semerLivre } from './faux-supabase.js';
import { semerCompte, semerClub } from './faux-cercle.js';
import { connecter } from './aide.js';

test.use({ serviceWorkers: 'block' });

/* Retient les morceaux dont le nom répond au motif, jusqu'à `lacher()`. */
async function retenir(page, motif) {
  let ouvert = false;
  const attente = [];
  await page.route(motif, async r => {
    if (!ouvert) await new Promise(f => attente.push(f));
    await r.continue();
  });
  return () => { ouvert = true; attente.splice(0).forEach(f => f()); };
}

function monde() {
  const store = nouveauStore();
  semerCompte(store, 'lea@exemple.fr'); semerCompte(store, 'tom@exemple.fr');
  semerClub(store, 'lea@exemple.fr', 'Club des verbes', ['tom@exemple.fr']);
  semerLivre(store, 'lea@exemple.fr', 'Verbes', [['être', 'to be'], ['avoir', 'to have']]);
  return store;
}

test('la page d’un club : le chargeur, puis le club', async ({ page }) => {
  const store = monde();
  await brancher(page, store);
  const lacher = await retenir(page, /\/assets\/club-[^/]*\.js$/);
  await connecter(page);
  await page.goto('./eleve/amis');
  await page.locator('.cc-club', { hasText: 'Club des verbes' }).first().click();
  await expect(page.locator('#app')).toHaveAttribute('data-view', 'club');
  await expect(page.locator('.chg')).toBeVisible();
  await expect(page.locator('.chg')).toHaveAttribute('role', 'status');
  lacher();
  await expect(page.locator('.cl-ban, .cl').first()).toBeVisible({ timeout: 10000 });
  await expect(page.locator('.chg')).toHaveCount(0);
});

test('l’écran de création : le chargeur, puis l’écran, et l’on écrit', async ({ page }) => {
  const store = monde();
  await brancher(page, store);
  const lacher = await retenir(page, /\/assets\/creation-[^/]*\.js$/);
  await connecter(page);
  await page.locator('[data-act="new"]:visible').first().click();
  await expect(page.locator('#app')).toHaveAttribute('data-view', 'import');
  await expect(page.locator('.chg')).toBeVisible();
  lacher();
  await page.locator('#nm').fill('Capitales');
  await page.locator('#cf').fill('France'); await page.locator('#cb').fill('Paris'); await page.locator('#cb').press('Enter');
  await expect(page.locator('.chg')).toHaveCount(0);
  await expect(page.locator('#app')).toContainText('Paris');
});

test('une feuille du cercle touchée avant son morceau s’ouvre à son arrivée', async ({ page }) => {
  const store = monde();
  await brancher(page, store);
  const lacher = await retenir(page, /\/assets\/cercle-feuilles-[^/]*\.js$/);
  await connecter(page);
  await page.goto('./eleve/amis');
  await expect(page.locator('#app')).toHaveAttribute('data-view', 'commu');
  // un geste qui mène ailleurs n'attend pas le morceau : « Entrer un code »
  await page.locator('[data-cc="pin"]').first().click();
  await expect(page.locator('.menu:not(.sort)')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.menu:not(.sort)')).toHaveCount(0);
  // « Créer un club » ouvre une feuille : elle attend son morceau, puis s'ouvre
  await page.locator('[data-cc="club-creer"]').first().click();
  await page.waitForTimeout(300);
  await expect(page.locator('.cc-f')).toHaveCount(0);
  lacher();
  await expect(page.locator('.cc-f')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('.cc-f')).toContainText('Nouveau club');
  await page.locator('[data-ccin="nom"]').fill('Les capitales');
  await expect(page.locator('#cfapn')).toHaveText('Les capitales');
});
