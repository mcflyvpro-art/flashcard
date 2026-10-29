// L'accueil d'un nouveau compte (2026-10-26, refait le 2026-10-27, puis le
// 2026-10-29) : un particulier donne son prénom, son pseudo, compose son
// visage trait par trait, dit son niveau et son année, retrouve les
// matières de son année déjà cochées (et en écrit une à la main), choisit
// un objectif, puis le tuto prend le relais (ui/tuto.js,
// e2e/tuto.e2e.js le joue) ; un élève entré par son établissement voit son
// lycée et sa classe, choisit son pseudo et son visage (son nom de classe ne
// bouge pas, e2e/pseudo.e2e.js), puis son tuto ; « J'ai un code » ouvre la
// porte d'entrée par-dessus l'accueil.
import { test, expect } from '@playwright/test';
import { brancher, nouveauStore } from './faux-supabase.js';
import { semerCompte } from './faux-cercle.js';
import { faireEleve, modele } from './faux-classes.js';
import { etab, semerEtablissement } from './faux-etablissement.js';
import { TRAITS, lireAvatar } from '../src/avatar.js';

async function entrer(page, email) {
  await page.goto('./app');
  await expect(page.locator('#boot')).toHaveCount(0, { timeout: 10000 });
  await expect(page.getByRole('textbox', { name: 'Adresse e-mail' })).toBeFocused();
  await page.getByRole('textbox', { name: 'Adresse e-mail' }).fill(email);
  await page.getByRole('textbox', { name: 'Mot de passe' }).fill('motdepasse-solide-42');
  await page.getByRole('button', { name: 'Se connecter' }).click();
}

test('un particulier : prénom, pseudo, visage, matières, objectif, puis le tuto', async ({ page }) => {
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

  // le visage : rien au hasard, chaque trait se choisit (la peau, la coiffure, sa couleur, les lunettes…)
  await expect(page.getByRole('heading', { name: 'Ton visage' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'D’autres' })).toHaveCount(0);
  const visage = () => page.locator('#bvmoi').innerHTML();
  const avant = await visage();
  await page.getByRole('button', { name: 'ébène' }).click();
  expect(await visage()).not.toBe(avant);
  await page.getByRole('tab', { name: 'Coiffure' }).click();
  await page.getByRole('button', { name: 'hijab' }).click();
  await expect(page.getByRole('tab', { name: 'Hijab' })).toBeVisible();      // ses cheveux couverts : la couleur est celle du tissu
  await page.getByRole('tab', { name: 'Hijab' }).click();
  await page.getByRole('button', { name: 'violets' }).click();
  await page.getByRole('tab', { name: 'Lunettes' }).click();
  await page.getByRole('button', { name: 'rondes' }).click();
  await page.getByRole('tab', { name: 'Bijoux' }).click();
  await page.getByRole('button', { name: 'créoles' }).click();
  await expect(page.getByRole('button', { name: 'créoles' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Continuer' }).click();

  // le niveau et l'année, puis les matières de cette année déjà cochées
  await expect(page.getByRole('button', { name: 'Continuer' })).toBeDisabled();
  await page.getByRole('button', { name: 'Lycée' }).click();
  await expect(page.getByRole('button', { name: 'Continuer' })).toBeDisabled();   // l'année aussi
  await page.getByRole('button', { name: 'Terminale' }).click();
  await page.getByRole('button', { name: 'Continuer' }).click();
  await expect(page.getByRole('heading', { name: 'Tes matières' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Philosophie' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'SVT' })).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'SVT' }).click();
  await page.getByRole('button', { name: 'Anglais', exact: true }).click();              // décochée
  await page.getByLabel('Une autre matière').fill('droit du travail');
  await page.getByLabel('Une autre matière').press('Enter');
  await expect(page.getByRole('button', { name: 'Droit du travail' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Continuer' }).click();

  await page.locator('.bv-obj', { hasText: '30' }).click();
  await page.getByRole('button', { name: 'C’est parti' }).click();

  await expect(page.locator('#tu .tu-debut')).toContainText('Bienvenue, Léa', { timeout: 10000 });   // le tuto prend le relais
  const p = (store.tables.prefs || []).find(r => r.user_id === lea);
  await expect.poll(() => (store.tables.prefs || []).find(r => r.user_id === lea)?.data?.bienvenue).toBe(1);
  expect(p.data).toMatchObject({ name: 'Léa', goal: 30, niveau: 'lycee', annee: 'terminale' });
  expect((store.tables.profiles || []).find(r => r.id === lea).handle).toBe('lea_75');
  const a = lireAvatar(store.jetons['p:' + lea].cle);
  expect(a).toMatchObject({ peau: TRAITS.peau.indexOf('ébène'), coiffure: TRAITS.coiffure.indexOf('hijab'),
    cheveux: TRAITS.cheveux.indexOf('violets'), lunettes: TRAITS.lunettes.indexOf('rondes'), bijoux: TRAITS.bijoux.indexOf('créoles') });
  expect(store.jetons['p:' + lea].cle).toMatch(/^[a-z]{2,16}$/);             // la contrainte de la base
  const mats = (store.tables.subjects || []).filter(s => s.user_id === lea).map(s => s.name);
  expect(mats).toEqual(expect.arrayContaining(['Philosophie', 'Histoire-géo', 'SVT', 'Droit du travail']));
  expect(mats).not.toContain('Anglais');                                     // décochée
  expect(mats).not.toContain('Italien');                                     // les exemples non choisis partent
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('un élève de son lycée : son lycée et sa classe, son pseudo, son visage, puis son tuto', async ({ page }) => {
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
  await expect(page.locator('.bv-ecole')).toHaveText('Lycée Camus · 2nde A');
  await expect(page.locator('.bv-classe')).toContainText('Tom PETIT');
  await page.getByRole('button', { name: 'Continuer' }).click();            // le pseudo donné d'office lui va
  await expect(page.getByRole('heading', { name: 'Ton visage' })).toBeVisible();
  await page.getByRole('tab', { name: 'Barbe' }).click();
  await page.getByRole('button', { name: 'courte', exact: true }).click();
  await page.getByRole('button', { name: 'C’est parti' }).click();
  await expect(page.locator('#app')).toHaveAttribute('data-view', 'classes');
  await expect.poll(() => lireAvatar((store.jetons || {})['p:' + tom]?.cle)?.barbe).toBe(TRAITS.barbe.indexOf('courte'));
  await expect(page.locator('#tu .tu-debut')).toContainText('Bienvenue, Tom', { timeout: 10000 });   // son tuto, côté classe
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
