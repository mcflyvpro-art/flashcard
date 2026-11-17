// La séance ne tourne plus en rond (2026-11-16, src/file.js : aRevoir, ramener).
// Une carte neuve notée « Correct » passe au palier de 10 min : avant, elle
// revenait aussitôt en fin de file, et il fallait « Correct » deux fois (ou
// « Facile ») sur chaque carte pour sortir. Désormais une carte sue ne retient
// plus la séance : le bilan dit quand elle revient, et « Revoir maintenant »
// la ramène à qui veut. Une carte ratée revient, elle, sans attendre.
// Et « Rejouer » reprend les cartes de la séance, même quand plus rien n'est dû.
import { test, expect } from '@playwright/test';
import { brancher, nouveauStore, semerLivre, semerPaquetDu } from './faux-supabase.js';
import { inscrire, noter } from './aide.js';

async function ouvrirPaquet(page, nom) {
  await page.getByRole('button', { name: new RegExp(nom) }).first().click();
  await page.getByRole('button', { name: /^Réviser/ }).click();
  await expect(page.locator('#top')).toBeVisible();
}

const recto = page => page.locator('#top .face:not(.bk)').innerText();

async function avecTroisNeuves(page) {
  const store = nouveauStore();
  await brancher(page, store);
  await inscrire(page);
  semerLivre(store, 'lea@exemple.fr', 'Capitales', [['France', 'Paris'], ['Italie', 'Rome'], ['Espagne', 'Madrid']]);
  await page.reload();
  await ouvrirPaquet(page, 'Capitales');
  return store;
}

test('trois cartes neuves sues : la séance finit, le bilan dit quand elles reviennent, « Revoir maintenant » les ramène', async ({ page }) => {
  await avecTroisNeuves(page);
  for (let k = 0; k < 3; k++) await noter(page, 'Correct');
  // plus de boucle : le bilan, au bout de trois cartes
  await expect(page.locator('.rev')).toBeVisible();
  await expect(page.locator('.rv-att')).toContainText('3 cartes en cours');
  await expect(page.locator('.rv-att')).toContainText('reviennent dans 10 min');
  // pour qui veut : les revoir tout de suite, puis les faire passer en jours
  await page.getByRole('button', { name: 'Revoir maintenant' }).click();
  await expect(page.locator('#top')).toBeVisible();
  for (let k = 0; k < 3; k++) await noter(page, 'Correct');
  await expect(page.locator('.rev')).toBeVisible();
  await expect(page.locator('.rv-att')).toHaveCount(0);
});

test('une carte ratée revient sans attendre ; ensuite, la plus proche d’abord et le plus long délai en dernier', async ({ page }) => {
  await avecTroisNeuves(page);
  const ordre = [];
  for (const note of ['Encore', 'Difficile', 'Correct']) { ordre.push(await recto(page)); await noter(page, note); }
  // la file vue : la ratée revient, pas les deux autres
  expect(await recto(page)).toBe(ordre[0]);
  await noter(page, 'Correct');
  await expect(page.locator('.rev')).toBeVisible();
  await expect(page.locator('.rv-att')).toContainText('3 cartes en cours');
  // « Revoir maintenant » : Difficile (6 min) d'abord, puis les deux à 10 min, la plus ancienne d'abord
  await page.getByRole('button', { name: 'Revoir maintenant' }).click();
  const revues = [];
  for (let k = 0; k < 3; k++) { revues.push(await recto(page)); await noter(page, 'Facile'); }
  expect(revues).toEqual([ordre[1], ordre[2], ordre[0]]);
  await expect(page.locator('.rv-att')).toHaveCount(0);
});

test('« Rejouer » reprend les cartes de la séance, même quand plus rien n’est dû', async ({ page }) => {
  const store = nouveauStore();
  await brancher(page, store);
  await inscrire(page);
  semerPaquetDu(store, 'lea@exemple.fr', 4);
  await page.reload();
  await ouvrirPaquet(page, 'Révisions');
  for (let k = 0; k < 4; k++) await noter(page, 'Correct');
  await expect(page.locator('.rev')).toBeVisible();
  await expect(page.locator('.rv-att')).toHaveCount(0);           // passées en jours : rien n'attend
  await page.getByRole('button', { name: 'Rejouer' }).click();
  await expect(page.locator('#top')).toBeVisible();
  await expect(page.locator('.bar .num')).toHaveText('1/4');
  await expect(page.getByText('Rien à revoir ici')).toHaveCount(0);
  for (let k = 0; k < 4; k++) await noter(page, 'Facile');
  await expect(page.locator('.rev')).toBeVisible();
  await expect.poll(() => (store.tables.reviews || []).length, { timeout: 10000 }).toBe(8);
});
