// La page d'accueil du site (index.html, servie à la racine ; l'app est à
// /app — docs/LANDING.md) : elle s'affiche au téléphone sans erreur ni
// débordement, ses boutons ouvrent l'app au bon endroit, et son aiguillage
// fait passer dans l'app qui l'a déjà : une session sur l'appareil, un lien
// de l'app arrivé à la racine (QR imprimés, codes partagés). Ces parcours
// sont ceux d'un téléphone dans son navigateur : l'app y laisse place à la
// porte d'installation (2026-10-28), sauf la démo et les textes du cadre.
import { test, expect } from '@playwright/test';
import { brancher, nouveauStore } from './faux-supabase.js';
import { inscrire } from './aide.js';

const TITRE = 'Révise moins. Retiens tout.';

test('au téléphone : le titre, les tarifs au mois ou à l’année, aucune erreur, aucun débordement', async ({ page }) => {
  const erreurs = [];
  page.on('pageerror', e => erreurs.push(e.message));
  page.on('console', m => { if (m.type() === 'error') erreurs.push(m.text()); });
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(TITRE);
  await expect(page).toHaveURL(/\/$/);

  const prix = page.locator('.offre-plus .prix b');
  await prix.scrollIntoViewIfNeeded();
  await expect(prix).toHaveText(/^2,50\s€$/);
  await page.getByRole('radio', { name: 'Mensuel' }).click();
  await expect(prix).toHaveText(/^4,99\s€$/);
  await expect(page.locator('.offre-plus .prix-note')).toHaveText(/Sans engagement/);

  // au téléphone, l'inscription reste dans l'en-tête, « Se connecter » passe dans le menu
  await page.evaluate(() => scrollTo(0, 0));
  await expect(page.locator('#tete nav').getByRole('link', { name: 'Créer un compte' })).toBeVisible();
  await expect(page.locator('#tete nav').getByRole('link', { name: 'Se connecter' })).toBeHidden();
  await page.getByRole('button', { name: 'Ouvrir le menu' }).click();
  await expect(page.locator('#menu-mobile').getByRole('link', { name: 'Créer un compte' })).toBeVisible();
  await expect(page.locator('#menu-mobile').getByRole('link', { name: 'Se connecter' })).toBeVisible();

  // « Passer à Folio+ » : l'écran Folio+ de l'app, la formule choisie déjà cochée (2026-10-27 : la vente est ouverte)
  await expect(page.locator('[data-vente]')).toHaveAttribute('href', /^\/app\?plus=(annuel|mensuel)$/);
  // plus de section « Sur tous tes écrans » : un téléphone a son magasin, un ordinateur son navigateur
  await expect(page.locator('#telecharger')).toHaveCount(0);

  const largeur = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(largeur).toBeLessThanOrEqual(390);
  expect(erreurs).toEqual([]);
});

test('les boutons ouvrent l’app à l’adresse de chaque écran (src/routes.js)', async ({ page }) => {
  await page.goto('./');
  await page.locator('.heros').getByRole('link', { name: 'Commencer gratuitement' }).click();
  await expect(page.getByRole('heading', { name: 'Installe Folio' })).toBeVisible({ timeout: 10000 });
  await expect(page).toHaveURL(/\/inscription$/);

  await page.goto('./');
  await page.locator('.heros').getByRole('link', { name: 'Essayer sans compte' }).click();
  await expect(page.locator('#app')).toHaveAttribute('data-view', 'decouvrir', { timeout: 10000 });
  await expect(page).toHaveURL(/\/essayer$/);

  await page.goto('./');
  await page.locator('#campus').getByRole('link', { name: 'Essayer en professeur' }).click();
  await expect(page.getByText(/^Bon(jour|soir), Marc$/)).toBeVisible({ timeout: 10000 });
  await expect(page).toHaveURL(/\/demo\/prof$/);

  await page.goto('./');
  await page.locator('#campus').getByRole('link', { name: 'Demander une démo' }).click();
  await expect(page.locator('#app')).toHaveAttribute('data-view', 'demande', { timeout: 10000 });

  await page.goto('./');
  await page.locator('.pied').getByRole('link', { name: 'Carte élève' }).click();
  await expect(page).toHaveURL(/\/carte-eleve$/, { timeout: 10000 });
  await expect(page.getByRole('heading', { name: 'Installe Folio' })).toBeVisible({ timeout: 10000 });

  await page.goto('./');
  await page.locator('.pied').getByRole('link', { name: 'Mentions légales' }).click();
  await expect(page.locator('.bar h1')).toHaveText('Mentions légales', { timeout: 10000 });
});

test('« J’ai un code » : un code de classe attend la connexion dans l’app', async ({ page }) => {
  await page.goto('./');
  await page.locator('.heros').getByRole('button', { name: 'J’ai un code' }).click();
  const champ = page.getByRole('textbox', { name: 'Le code' });
  await expect(champ).toBeFocused();
  await champ.pressSequentially('abcd234');
  await page.getByRole('button', { name: 'Continuer' }).click();
  await expect(page.locator('#code-erreur')).toContainText('8 lettres ou chiffres');
  await champ.press('5');
  await expect(champ).toHaveValue('ABCD 2345');
  await page.getByRole('button', { name: 'Continuer' }).click();
  await expect(page.locator('#passage')).toContainText('ABCD', { timeout: 10000 });
  await expect(page).toHaveURL(/\/connexion$/);
});

test('« J’ai un code » : six chiffres, c’est une partie en direct', async ({ page }) => {
  await page.goto('./');
  await page.locator('.heros').getByRole('button', { name: 'J’ai un code' }).click();
  await page.getByRole('textbox', { name: 'Le code' }).pressSequentially('482913');
  await expect(page.getByRole('radio', { name: 'D’une partie' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('textbox', { name: 'Le code' })).toHaveValue('482 913');
  await page.getByRole('button', { name: 'Continuer' }).click();
  await expect(page.locator('#passage')).toContainText('482 913', { timeout: 10000 });
});

test('l’aiguillage : un lien de l’app arrivé à la racine passe dans l’app', async ({ page }) => {
  await page.goto('./?defi=482913');
  await expect(page.locator('#passage')).toContainText('482 913', { timeout: 10000 });
  await expect(page).toHaveURL(/\/connexion$/);
});

test('l’aiguillage : avec une session, la racine ouvre l’app ; « ?site » montre l’accueil', async ({ page }) => {
  const store = nouveauStore();
  await brancher(page, store);
  await inscrire(page);
  await page.goto('./');
  await expect(page).toHaveURL(/\/eleve\/livres$/, { timeout: 10000 });
  await expect(page.getByRole('button', { name: 'Nouveau livre' })).toBeVisible({ timeout: 10000 });
  await page.goto('./?site');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(TITRE);
});

test('la pile du héros se note : Facile l’envoie à droite, Encore à gauche, la suivante avance', async ({ page }) => {
  await page.goto('./');
  const essai = page.locator('#essai');
  await essai.scrollIntoViewIfNeeded();
  const dessus = () => essai.locator('.carte[data-rang="0"] .face:not(.verso) b');
  await expect(dessus()).toHaveText('Prise de la Bastille');
  await essai.getByRole('button', { name: /^Facile/ }).click();
  await expect(essai.locator('.essai-retour')).toHaveText('Revient dans 9 jours');
  await expect(dessus()).toHaveText('Mitochondrie');
  await expect(essai.locator('.essai-indice')).toHaveCSS('opacity', '0');      // « Clique pour tester » a servi
  await essai.getByRole('button', { name: /^Encore/ }).click();
  await expect(essai.locator('.essai-retour')).toHaveText('Revient dans 10 min');
  await expect(dessus()).toHaveText('to take for granted', { timeout: 5000 });
});

test('Folio Campus : chaque rôle montre son espace et mène à sa démo', async ({ page }) => {
  await page.goto('./');
  const roles = page.locator('.roles');
  const tel = page.locator('#tel-campus');
  await roles.scrollIntoViewIfNeeded();
  await expect(page.locator('#p-prof')).toBeVisible();
  // le même espace au téléphone, posé contre l'ordinateur
  await expect(tel.locator('[data-onglet="p-prof"]')).toBeVisible();
  await expect(tel).not.toHaveClass(/range/);
  await roles.getByRole('tab', { name: /Référent de l’établissement/ }).click();
  await expect(page.locator('#p-ref')).toBeVisible();
  await expect(page.locator('#p-prof')).toBeHidden();
  await expect(tel).toHaveClass(/range/);                       // sa console est faite pour l'ordinateur
  await expect(tel.locator('.ecran:visible')).toHaveCount(0);
  await expect(page.locator('#essai-espace')).toHaveAttribute('href', '/demo/referent');
  await roles.getByRole('tab', { name: /Élève/ }).click();
  await expect(tel).not.toHaveClass(/range/);
  await expect(tel.locator('[data-onglet="p-eleve"]')).toBeVisible();
  await expect(tel.locator('[data-onglet="p-prof"]')).toBeHidden();
  await expect(page.locator('#essai-espace')).toHaveAttribute('href', '/demo/eleve');
  await page.locator('#essai-espace').click();
  await expect(page).toHaveURL(/\/demo\/eleve/, { timeout: 10000 });
  await expect(page.locator('.dm-bandeau')).toBeVisible({ timeout: 10000 });
});

test('« Retour » d’un écran ouvert depuis le site ramène au site, pas à la connexion', async ({ page }) => {
  await page.goto('./');
  await page.locator('.heros').getByRole('link', { name: 'Essayer sans compte' }).click();
  await expect(page.locator('.dm-role')).toHaveCount(3, { timeout: 10000 });
  await page.getByRole('button', { name: 'Retour' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(TITRE, { timeout: 10000 });

  // depuis la connexion, il revient à la connexion
  await page.goto('./connexion');
  await page.getByRole('button', { name: 'Essayer sans compte' }).click();
  await expect(page).toHaveURL(/\/essayer$/);
  await page.getByRole('button', { name: 'Retour' }).click();
  await expect(page).toHaveURL(/\/connexion$/);
  await expect(page.getByRole('heading', { name: 'Installe Folio' })).toBeVisible();     // au téléphone, la porte
});
