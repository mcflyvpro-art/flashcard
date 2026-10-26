// Une adresse par écran et par espace (2026-10-26) : avant, tout vivait à
// « / » — rafraîchir ramenait à l'accueil (et sortait de la démo), le
// bouton retour du navigateur quittait l'app, rien ne se partageait.
// Chaque écran a maintenant son chemin (src/routes.js), dans l'espace de
// son métier : /eleve/…, /prof/…, /referent/…, /demo/<rôle>/….
import { test, expect } from '@playwright/test';
import { brancher, nouveauStore } from './faux-supabase.js';
import { semerCompte } from './faux-cercle.js';
import { modele } from './faux-classes.js';
import { etab, semerEtablissement } from './faux-etablissement.js';
import { creerLivre, inscrire } from './aide.js';

const chemin = page => new URL(page.url()).pathname;

async function entrer(page, email, url = './app') {
  await page.goto(url);
  await expect(page.locator('#boot')).toHaveCount(0, { timeout: 10000 });
  await expect(page.getByRole('textbox', { name: 'Adresse e-mail' })).toBeFocused();
  await page.getByRole('textbox', { name: 'Adresse e-mail' }).fill(email);
  await page.getByRole('textbox', { name: 'Mot de passe' }).fill('motdepasse-solide-42');
  await page.getByRole('button', { name: 'Se connecter' }).click();
}

function compte(store, email, role, nom, org) {
  const m = modele(store), id = semerCompte(store, email);
  m.roles[id] = role; m.noms[id] = nom;
  if (org) etab(store).membres[id] = org.id;
  store.tables.prefs = [...(store.tables.prefs || []), { id, user_id: id, data: { tuto: 1, bienvenue: 1 } }];
  return id;
}

test('un élève : chaque écran a son adresse, rafraîchir le garde, retour revient', async ({ page }) => {
  const store = nouveauStore();
  await brancher(page, store);
  await page.goto('./app');
  await expect(page.locator('#boot')).toHaveCount(0, { timeout: 10000 });
  await expect(page).toHaveURL(/\/connexion$/);
  await page.getByRole('button', { name: 'Créer un compte' }).click();
  await expect(page).toHaveURL(/\/inscription$/);

  await inscrire(page);
  await expect(page).toHaveURL(/\/eleve\/livres$/);
  await creerLivre(page, 'Capitales', 3);
  await expect(page).toHaveURL(/\/eleve\/livres\/[^/]+$/);
  const livre = chemin(page);

  await page.reload();
  await expect(page.getByRole('button', { name: 'Menu du livre' })).toBeVisible({ timeout: 10000 });
  expect(chemin(page)).toBe(livre);

  await page.goBack();
  await expect(page).toHaveURL(/\/eleve\/livres$/);
  await expect(page.getByRole('button', { name: 'Nouveau livre' })).toBeVisible();
  await page.goForward();
  await expect(page.getByRole('button', { name: 'Menu du livre' })).toBeVisible();
  expect(chemin(page)).toBe(livre);
});

test.describe('sur ordinateur', () => {
  test.use({ viewport: { width: 1360, height: 900 } });

  test('un professeur arrive sur la classe que donnait l’adresse, même sans session', async ({ page }) => {
    const store = nouveauStore();
    const { org, classes } = semerEtablissement(store, { nom: 'Lycée Camus', classes: ['2nde A', '1re B'] });
    const prof = compte(store, 'durand@lycee.fr', 'prof', 'Marc DURAND', org);
    const et = etab(store);
    et.services = classes.map(cid => ({ cid, prof, matiere: 'Maths', principal: false }));
    await brancher(page, store);

    // une adresse de l'espace professeur ouverte sans session : la connexion, puis la classe
    await entrer(page, 'durand@lycee.fr', '/prof/classes/' + classes[1]);
    await expect(page.locator('#app')).toHaveAttribute('data-view', 'profclasse', { timeout: 10000 });
    await expect(page).toHaveURL(new RegExp('/prof/classes/' + classes[1] + '$'));
    await expect(page.locator('.pf-cht h1')).toHaveText('1re B');

    await page.getByRole('tab', { name: /Devoirs/ }).click();
    await expect(page).toHaveURL(new RegExp('/prof/classes/' + classes[1] + '/devoirs$'));
    await page.reload();
    await expect(page.locator('#app')).toHaveAttribute('data-view', 'profclasse', { timeout: 10000 });
    await expect(page.getByRole('tab', { name: /Devoirs/ })).toHaveAttribute('aria-selected', 'true');

    await page.goBack();
    await expect(page).toHaveURL(new RegExp('/prof/classes/' + classes[1] + '$'));
  });

  test('un référent : les onglets de sa console sont des adresses', async ({ page }) => {
    const store = nouveauStore();
    const { org } = semerEtablissement(store, { nom: 'Lycée Camus', classes: ['2nde A'] });
    compte(store, 'ref@lycee.fr', 'ref', 'Claire ROUX', org);
    await brancher(page, store);
    await entrer(page, 'ref@lycee.fr');
    await expect(page.locator('#app')).toHaveAttribute('data-view', 'ref', { timeout: 10000 });
    await expect(page).toHaveURL(/\/referent$/);

    // sa barre ne porte que ses pages : ni livres, ni courrier, ni cercle
    await expect(page.locator('#rail nav button')).toHaveText(['Accueil', 'Classes', 'Élèves', 'Professeurs', 'Licence', 'Historique', 'Réglages']);
    await page.locator('#rail [data-r="ref:classes"]').click();
    await expect(page).toHaveURL(/\/referent\/classes$/);
    await page.reload();
    await expect(page.locator('#rail nav .on')).toHaveText('Classes', { timeout: 10000 });
    await page.goBack();
    await expect(page).toHaveURL(/\/referent$/);
    await expect(page.locator('#rail nav .on')).toHaveText('Accueil');

    // ses réglages : son compte, pas de matières ni d'objectif de lecture
    await page.locator('#rail [data-r="settings"]').click();
    await expect(page).toHaveURL(/\/referent\/reglages$/);
    await expect(page.getByText('Objectif du jour')).toHaveCount(0);
    await page.locator('#rail [data-r="ref:accueil"]').click();
    await expect(page).toHaveURL(/\/referent$/);
    await expect(page.locator('.rf-code-v').first()).toBeVisible();
  });
});

test('la démo a ses adresses, et rafraîchir ne la quitte plus', async ({ page }) => {
  await brancher(page, nouveauStore());
  await page.goto('./app');
  await expect(page.locator('#boot')).toHaveCount(0, { timeout: 10000 });
  await page.getByRole('button', { name: 'Essayer sans compte' }).click();
  await expect(page).toHaveURL(/\/essayer$/);
  await page.locator('.dm-role[data-v="prof"]').click();
  await expect(page.getByText('Bonjour, Marc')).toBeVisible({ timeout: 10000 });
  await expect(page).toHaveURL(/\/demo\/prof$/);

  await page.reload();
  await expect(page.getByText('Bonjour, Marc')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('.dm-bandeau')).toBeVisible();
  await expect(page).toHaveURL(/\/demo\/prof$/);

  await page.locator('.dm-bandeau').getByRole('button', { name: 'Quitter' }).click();
  await expect(page).toHaveURL(/\/connexion$/, { timeout: 10000 });
});
