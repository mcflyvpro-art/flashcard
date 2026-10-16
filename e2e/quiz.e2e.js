// M07.T5 — les quatre façons de s'interroger (récitation, QCM, association,
// vrai/faux), chacune jouée avec des erreurs voulues : le score affiché en
// fin de série doit être exactement celui qu'on attend.
import { test, expect } from '@playwright/test';
import { brancher, nouveauStore, semerLivre } from './faux-supabase.js';
import { inscrire } from './aide.js';

const texte = async page => (await page.locator('main').innerText()).replace(/\s+/g, ' ');
const finVisible = page => page.getByRole('button', { name: 'Fin' }).isVisible();
const CAPITALES = [1, 2, 3, 4, 5, 6].map(k => ['Pays ' + k, 'Capitale ' + k]);

async function ouvrirLivre(page, nom, cartes) {
  const store = nouveauStore();
  await brancher(page, store);
  await inscrire(page);
  semerLivre(store, 'lea@exemple.fr', nom, cartes);
  await page.reload();
  await page.getByRole('button', { name: new RegExp(nom) }).click();
  return store;
}

async function scoreFinal(page, pct, juste, total, erreurs) {
  const fin = page.locator('main');
  await expect(fin).toContainText(`${pct}%`);
  await expect(fin).toContainText(`${juste} / ${total}`);
  await expect(fin).toContainText(new RegExp(`${erreurs}\\s*erreurs?`, 'i'));
}

test('récitation : 4 réponses justes, 2 fausses → 67 %', async ({ page }) => {
  await ouvrirLivre(page, 'Capitales', CAPITALES);
  await page.getByRole('button', { name: 'Récitation', exact: true }).click();
  for (let i = 0; i < 6; i++) {
    await expect(page.locator('#ans')).toBeVisible();
    const k = /Pays (\d)/.exec(await texte(page))[1];
    await page.locator('#ans').fill(i < 4 ? 'capitale ' + k + ' ' : 'Lisbonne');   // casse et espaces tolérés
    await page.getByRole('button', { name: 'Valider' }).click();
    await page.getByRole('button', { name: /^Suivant/ }).click();
  }
  await scoreFinal(page, 67, 4, 6, 2);
});

test('QCM : une seule mauvaise case → 83 %', async ({ page }) => {
  test.setTimeout(120000);
  await ouvrirLivre(page, 'Capitales', CAPITALES);
  await page.getByRole('button', { name: 'QCM', exact: true }).click();
  // une bonne réponse note « Correct » : la carte neuve revient tant qu'elle est sur ses paliers
  for (let n = 0; !(await finVisible(page)) && n < 40; n++) {
    await expect(page.getByRole('button', { name: /^Capitale \d$/ })).toHaveCount(4);
    const k = /Pays (\d)/.exec(await texte(page))[1];
    const choix = n === 5
      ? page.getByRole('button', { name: /^Capitale \d$/ }).filter({ hasNotText: 'Capitale ' + k }).first()
      : page.getByRole('button', { name: 'Capitale ' + k, exact: true });
    await choix.click();
    await page.getByRole('button', { name: /^Suivant/ }).click();
    await page.waitForTimeout(300);
  }
  await scoreFinal(page, 83, 5, 6, 1);
});

test('association : une paire ratée coûte les deux pages → 67 %', async ({ page }) => {
  await ouvrirLivre(page, 'Capitales', CAPITALES);
  await page.getByRole('button', { name: 'Association', exact: true }).click();
  await page.getByRole('button', { name: 'Pays 1', exact: true }).click();
  await page.getByRole('button', { name: 'Capitale 2', exact: true }).click();
  for (let n = 0; !(await finVisible(page)) && n < 20; n++) {
    const gauche = page.locator('button.mc:not(.done)[data-mt^="L:"]').first();
    if (!(await gauche.count())) { await page.waitForTimeout(300); continue; }
    const k = (await gauche.innerText()).trim().slice(-1);
    await gauche.click();
    await page.locator('button.mc:not(.done)[data-mt^="R:"]', { hasText: 'Capitale ' + k }).click();
  }
  await scoreFinal(page, 67, 4, 6, 2);
});

test('vrai/faux : une affirmation mal jugée → 75 %', async ({ page }) => {
  await ouvrirLivre(page, 'Vrai ou faux', [
    ['La Terre est ronde', 'Vrai', { t: 'tf' }], ['Paris est en Italie', 'Faux', { t: 'tf' }],
    ['L’eau bout à 100 °C au niveau de la mer', 'Vrai', { t: 'tf' }], ['2 + 2 = 5', 'Faux', { t: 'tf' }]]);
  await page.getByRole('button', { name: /^Lire/ }).click();
  let premiereFois = true;
  for (let n = 0; !(await finVisible(page)) && n < 20; n++) {
    await expect(page.locator('[data-tf="1"]')).toBeVisible();
    const t = await texte(page);
    const vrai = /Terre|eau bout/.test(t);
    const dire = /eau bout/.test(t) && premiereFois ? !vrai : vrai;    // l'erreur voulue, une fois
    if (/eau bout/.test(t)) premiereFois = false;
    await page.locator(`[data-tf="${dire ? 1 : 0}"]`).click();
    await page.getByRole('button', { name: /^Suivant/ }).click();
    await page.waitForTimeout(300);
  }
  await scoreFinal(page, 75, 3, 4, 1);
});
