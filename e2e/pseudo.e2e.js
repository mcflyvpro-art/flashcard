// Les pseudos (2026-10-27) : tout compte en a un d'office, qui se change de
// partout — Réglages, « Mon jeton » du cercle, l'accueil d'un nouveau
// compte — dans la règle (src/pseudo.js) : l'écran dit pendant la frappe ce
// qui ne va pas, la base dit si c'est libre et propose une variante sinon,
// deux changements par semaine. Un élève de lycée choisit le sien aussi ;
// son nom de classe, « Prénom NOM », ne bouge pas. Le faux Supabase rejoue
// la règle (src/base-locale/pseudos.js) ; les droits se prouvent en base
// (supabase/tests/pseudos.sql).
import { test, expect } from '@playwright/test';
import { brancher, nouveauStore } from './faux-supabase.js';
import { semerCompte, semerPseudo } from './faux-cercle.js';
import { modele } from './faux-classes.js';
import { etab, semerEtablissement } from './faux-etablissement.js';
import { inscrire, passerTuto } from './aide.js';

const pseudoDe = (store, email) => {
  const u = store.users.find(x => x.email === email);
  return ((store.tables.profiles || []).find(p => p.id === u.id) || {}).handle;
};

test('un pseudo d’office, changé dans les Réglages : la règle, « pris », deux fois par semaine', async ({ page }) => {
  const store = nouveauStore();
  await brancher(page, store);
  semerCompte(store, 'tom@exemple.fr');
  semerPseudo(store, 'tom@exemple.fr', 'tom.b', 'Tom Bernard');
  await inscrire(page);
  await expect.poll(() => pseudoDe(store, 'lea@exemple.fr')).toMatch(/^lecteur\d*$/);     // personne n'est sans pseudo

  await page.getByRole('button', { name: 'Réglages' }).first().click();
  const ligne = page.locator('[data-act="handle"]');
  await expect(ligne).toContainText('@lecteur');
  await ligne.click();
  const champ = page.getByRole('textbox', { name: 'Ton pseudo' });
  const verdict = page.locator('#psv');
  const ok = page.getByRole('button', { name: 'Enregistrer' });

  await champ.fill('ab');
  await expect(verdict).toHaveText(/Au moins 3 caractères/);
  await expect(ok).toBeDisabled();
  await champ.fill('Léa Martin');
  await expect(champ).toHaveValue('lea.martin');                              // minuscules, sans accent, l'espace devient un point
  await champ.fill('lea.admin');
  await expect(verdict).toHaveText(/réservé/);
  await champ.fill('c0nn4rd');
  await expect(verdict).toHaveText(/pas permis/);
  await expect(ok).toBeDisabled();

  await champ.fill('tom_b');                                                  // « tom.b » au tiret bas près
  await expect(verdict).toContainText('déjà pris');
  await expect(ok).toBeDisabled();
  await page.locator('.ps-sug').click();
  await expect(champ).toHaveValue(/^tom_b\d+$/);
  await expect(verdict).toContainText('Libre');

  await champ.fill('lea.martin');
  await expect(verdict).toContainText('Libre');
  await ok.click();
  await expect.poll(() => pseudoDe(store, 'lea@exemple.fr')).toBe('lea.martin');
  await expect(ligne).toContainText('@lea.martin');

  await ligne.click();
  await champ.fill('lea.lit');
  await expect(verdict).toContainText('Libre');
  await ok.click();
  await expect.poll(() => pseudoDe(store, 'lea@exemple.fr')).toBe('lea.lit');

  await ligne.click();                                                        // une troisième fois dans la semaine : non
  await champ.fill('lea.relit');
  await expect(verdict).toContainText('Libre');
  await ok.click();
  await expect(verdict).toContainText('Deux changements par semaine au plus');
  expect(pseudoDe(store, 'lea@exemple.fr')).toBe('lea.lit');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('un élève de lycée : son pseudo à l’accueil, puis dans le cercle ; son nom de classe reste', async ({ page }) => {
  const store = nouveauStore();
  const { org, classes } = semerEtablissement(store, { nom: 'Lycée Camus', classes: ['2nde A'] });
  const m = modele(store);
  const tom = semerCompte(store, 'tom@lycee.fr');
  m.roles[tom] = 'eleve'; m.noms[tom] = 'Tom PETIT'; etab(store).membres[tom] = org.id;
  m.membres.push({ cid: classes[0], uid: tom, depuis: new Date().toISOString() });
  semerCompte(store, 'zoe@exemple.fr');
  semerPseudo(store, 'zoe@exemple.fr', 'tom.p', 'Zoé');
  await brancher(page, store);
  await page.goto('./app');
  await expect(page.locator('#boot')).toHaveCount(0, { timeout: 10000 });
  await page.getByRole('textbox', { name: 'Adresse e-mail' }).fill('tom@lycee.fr');
  await page.getByRole('textbox', { name: 'Mot de passe' }).fill('motdepasse-solide-42');
  await page.getByRole('button', { name: 'Se connecter' }).click();

  await expect(page.getByRole('heading', { name: 'Choisis ton pseudo' })).toBeVisible({ timeout: 10000 });
  await expect(page.locator('.bv-classe')).toContainText('Tom PETIT');
  const champ = page.getByLabel('Pseudo');
  await champ.fill('tom.p');
  await expect(page.locator('#bvpv')).toContainText('déjà pris');
  await expect(page.getByRole('button', { name: 'Continuer' })).toBeDisabled();
  await champ.fill('tom.petit');
  await expect(page.locator('#bvpv')).toContainText('Libre');
  await page.getByRole('button', { name: 'Continuer' }).click();
  await expect(page.getByRole('heading', { name: 'Choisis ton visage' })).toBeVisible();
  await page.getByRole('button', { name: 'C’est parti' }).click();
  await expect(page.locator('#app')).toHaveAttribute('data-view', 'classes');
  await expect.poll(() => pseudoDe(store, 'tom@lycee.fr')).toBe('tom.petit');
  await passerTuto(page);                                                     // le tuto prend le relais de l'accueil

  await page.getByRole('button', { name: /^(Le )?[Cc]ercle( des lecteurs)?$/ }).first().click();
  await expect(page.locator('.cc-moi')).toContainText('Tom PETIT');
  await expect(page.locator('.cc-moi')).toContainText('@tom.petit');
  await page.locator('.cc-moi').click();
  await page.locator('.jt-pseudo').click();
  await expect(page.locator('.ps-nom')).toContainText('Tom PETIT');
  await page.getByRole('textbox', { name: 'Ton pseudo' }).fill('tomtom');
  await expect(page.locator('#psv')).toContainText('Libre');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect.poll(() => pseudoDe(store, 'tom@lycee.fr')).toBe('tomtom');
  await expect(page.locator('.cc-moi')).toContainText('Tom PETIT');            // le nom de classe n'a pas bougé
  await expect(page.locator('.cc-moi')).toContainText('@tomtom');
});
