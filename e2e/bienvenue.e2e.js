// L'accueil d'un nouveau compte (2026-10-26) : un particulier donne son
// prénom, son pseudo, choisit son visage, son niveau, ses matières et un
// objectif, puis la visite guidée part ; un élève entré par son
// établissement choisit son pseudo et son visage (2026-10-27 ; son nom de
// classe ne bouge pas, e2e/pseudo.e2e.js) ; « J'ai un code » ouvre la
// porte d'entrée dans une école.
import { test, expect } from '@playwright/test';
import { brancher, nouveauStore } from './faux-supabase.js';
import { semerCompte } from './faux-cercle.js';
import { faireEleve, modele } from './faux-classes.js';
import { etab, semerEtablissement } from './faux-etablissement.js';

async function entrer(page, email) {
  await page.goto('./app');
  await expect(page.locator('#boot')).toHaveCount(0, { timeout: 10000 });
  await expect(page.getByRole('textbox', { name: 'Adresse e-mail' })).toBeFocused();
  await page.getByRole('textbox', { name: 'Adresse e-mail' }).fill(email);
  await page.getByRole('textbox', { name: 'Mot de passe' }).fill('motdepasse-solide-42');
  await page.getByRole('button', { name: 'Se connecter' }).click();
}

test('un particulier : prénom, pseudo, visage, matières, objectif, puis la visite', async ({ page }) => {
  const store = nouveauStore();
  const lea = semerCompte(store, 'lea@exemple.fr');
  faireEleve(store, 'lea@exemple.fr');
  await brancher(page, store);
  await entrer(page, 'lea@exemple.fr');

  await expect(page.locator('#app')).toHaveAttribute('data-view', 'bienvenue', { timeout: 10000 });
  await expect(page.locator('#rail')).toHaveCount(0);
  await page.getByRole('button', { name: 'Je révise pour moi' }).click();

  await page.getByLabel('Prénom').fill('Léa');
  await expect(page.getByLabel('Pseudo')).toHaveValue('lea');
  await page.getByLabel('Pseudo').fill('Lea_75 !');
  await expect(page.getByLabel('Pseudo')).toHaveValue('lea_75.');          // l'espace devient un point…
  await expect(page.getByRole('button', { name: 'Continuer' })).toBeDisabled();   // … qui ne finit pas un pseudo
  await page.getByLabel('Pseudo').fill('Lea_75');
  await expect(page.getByLabel('Pseudo')).toHaveValue('lea_75');
  await expect(page.locator('#bvpv')).toContainText('Libre');
  await page.getByRole('button', { name: 'Continuer' }).click();

  await expect(page.locator('.bv-vis')).toHaveCount(6);
  const premier = await page.locator('.bv-vis').first().innerHTML();
  await page.getByRole('button', { name: 'D’autres' }).click();
  expect(await page.locator('.bv-vis').first().innerHTML()).not.toBe(premier);
  await page.locator('.bv-vis').nth(2).click();
  await expect(page.locator('.bv-vis').nth(2)).toHaveClass(/on/);
  await page.getByRole('button', { name: 'Continuer' }).click();

  await expect(page.getByRole('button', { name: 'Continuer' })).toBeDisabled();   // le niveau d'abord
  await page.getByRole('button', { name: 'Lycée' }).click();
  await page.getByRole('button', { name: 'SVT' }).click();
  await page.getByRole('button', { name: 'Philosophie' }).click();
  await page.getByRole('button', { name: 'Continuer' }).click();

  await page.locator('.bv-obj', { hasText: '30' }).click();
  await page.getByRole('button', { name: 'C’est parti' }).click();

  await expect(page.locator('.tbub')).toBeVisible({ timeout: 10000 });        // la visite guidée prend le relais
  const p = (store.tables.prefs || []).find(r => r.user_id === lea);
  await expect.poll(() => (store.tables.prefs || []).find(r => r.user_id === lea)?.data?.bienvenue).toBe(1);
  expect(p.data).toMatchObject({ name: 'Léa', goal: 30, niveau: 'lycee' });
  expect((store.tables.profiles || []).find(r => r.id === lea).handle).toBe('lea_75');
  expect(store.jetons['p:' + lea].cle).toMatch(/^av[a-z]{7}$/);
  const mats = (store.tables.subjects || []).filter(s => s.user_id === lea).map(s => s.name);
  expect(mats).toEqual(expect.arrayContaining(['SVT', 'Philosophie']));
  expect(mats).not.toContain('Italien');                                     // les exemples non choisis partent
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('un élève de son lycée : son pseudo, son visage, puis ses classes', async ({ page }) => {
  const store = nouveauStore();
  const { org, classes } = semerEtablissement(store, { nom: 'Lycée Camus', classes: ['2nde A'] });
  const m = modele(store);
  const tom = semerCompte(store, 'tom@lycee.fr');
  m.roles[tom] = 'eleve'; m.noms[tom] = 'Tom PETIT'; etab(store).membres[tom] = org.id;
  m.membres.push({ cid: classes[0], uid: tom, depuis: new Date().toISOString() });
  await brancher(page, store);
  await entrer(page, 'tom@lycee.fr');

  await expect(page.locator('#app')).toHaveAttribute('data-view', 'bienvenue', { timeout: 10000 });
  await expect(page.getByRole('heading', { name: 'Choisis ton pseudo' })).toBeVisible();
  await expect(page.locator('.bv-classe')).toContainText('Tom PETIT');
  await page.getByRole('button', { name: 'Continuer' }).click();            // le pseudo donné d'office lui va
  await expect(page.getByRole('heading', { name: 'Choisis ton visage' })).toBeVisible();
  await page.locator('.bv-vis').nth(4).click();
  await page.getByRole('button', { name: 'C’est parti' }).click();
  await expect(page.locator('#app')).toHaveAttribute('data-view', 'classes');
  await expect.poll(() => (store.jetons || {})['p:' + tom]?.cle).toMatch(/^av[a-z]{7}$/);
  await expect(page.locator('.tbub')).toHaveCount(0);                        // pas de visite de la bibliothèque
});

test('« J’ai un code » dès l’accueil ouvre la porte d’entrée', async ({ page }) => {
  const store = nouveauStore();
  semerCompte(store, 'zoe@exemple.fr');
  faireEleve(store, 'zoe@exemple.fr');
  await brancher(page, store);
  await entrer(page, 'zoe@exemple.fr');
  await expect(page.locator('#app')).toHaveAttribute('data-view', 'bienvenue', { timeout: 10000 });
  await page.getByRole('button', { name: 'J’ai un code' }).click();
  await expect(page.locator('#cecode')).toBeVisible();
});
