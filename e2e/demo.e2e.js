// « Essayer sans compte » (2026-10-26) : la vraie app, sur une base locale
// semée du Lycée Démo Folio (src/base-locale/). Tout marche — un devoir lu par
// Léa se voit chez Marc, un mot de Marc arrive chez Léa, une classe créée
// par Claire reste après un rafraîchissement — et rien ne part vers la base :
// chaque visiteur a son lycée, dans son onglet. Ce qui coûte (l'IA, les
// photos, les fichiers) est grisé et le dit. « Quitter » ne laisse rien.
import { test, expect } from '@playwright/test';
import { brancher, nouveauStore } from './faux-supabase.js';
import { noter } from './aide.js';

const BASE = /supabase\.co\//;

async function ouvrirDemo(page, role) {
  await brancher(page, nouveauStore());
  const parties = [];
  page.on('request', r => { if (BASE.test(r.url())) parties.push(r.method() + ' ' + new URL(r.url()).pathname); });
  await aller(page, '/essayer');
  await expect(page.locator('.dm-role')).toHaveCount(3, { timeout: 10000 });
  await page.locator(`.dm-role[data-v="${role}"]`).click();
  return parties;
}

const changer = (page, role) => page.locator('.dm-bandeau select').selectOption(role);

/* Ouvrir une adresse, puis attendre que l'écran d'ouverture se soit effacé
   (il couvre la page le temps de son fondu, comme chez un vrai visiteur). */
async function aller(page, url) {
  if (url) await page.goto(url); else await page.reload();
  await expect(page.locator('#boot')).toHaveCount(0, { timeout: 10000 });
}

test('Léa lit son devoir, Marc le voit ; Marc écrit à la classe, Léa le reçoit', async ({ page }) => {
  test.setTimeout(90000);
  const parties = await ouvrirDemo(page, 'eleve');
  await expect(page).toHaveURL(/\/demo\/eleve\/classe$/, { timeout: 10000 });
  await expect(page.locator('#page').getByText('Léa MARTIN')).toBeVisible();

  // le devoir à faire : six pages, toutes lues
  await page.getByText('Fonctions affines').click();
  await expect(page.locator('#app')).toHaveAttribute('data-view', 'deck', { timeout: 10000 });
  await page.locator('[data-act="study"]').click();
  for (let k = 0; k < 6; k++) await noter(page, 'Facile');           // « Facile » : la page sort de la séance
  await expect(page.locator('.rev')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('.dm-bandeau')).toBeHidden();                 // il ne cachait pas les boutons de note
  await page.getByRole('button', { name: 'Retour' }).first().click();
  await expect(page.locator('.dm-bandeau')).toBeVisible();

  // Marc : dans la fiche de Léa, le devoir est rendu
  await changer(page, 'prof');
  await expect(page.getByText(/^Bon(jour|soir), Marc$/)).toBeVisible({ timeout: 10000 });
  await expect(page).toHaveURL(/\/demo\/prof$/);
  await page.locator('[data-pf="classe"]:visible').filter({ hasText: '2nde B' }).first().click();
  await page.locator('[data-pf="eleve"]', { hasText: 'Léa MARTIN' }).first().click();
  // (la fiche se remplit : ses points de chargement restaient là pour toujours)
  const fiche = page.locator('.menu:not(.sort) .pf-li', { hasText: 'Fonctions affines' });
  await expect(fiche).toContainText('rendu', { timeout: 10000 });
  await page.keyboard.press('Escape');
  await expect(page.locator('.menu:not(.sort)')).toHaveCount(0);

  // « Ce qui bloque » dans un devoir de la classe : les pages ratées, pas un chargement sans fin
  await page.getByRole('tab', { name: /Devoirs/ }).click();
  await page.locator('[data-pf="devoir"]', { hasText: 'Vocabulaire : la ville' }).first().click();
  await expect(page.locator('.menu:not(.sort)')).toContainText('Ce qui bloque');
  await expect(page.locator('.menu:not(.sort) .pf-load')).toHaveCount(0, { timeout: 10000 });
  await page.keyboard.press('Escape');

  // et un mot à la classe
  await page.locator('[data-pf="message"]').first().click();
  await page.locator('#pfmsg').fill('Contrôle vendredi : révisez les fonctions');
  await page.locator('[data-pf="message-go"]').click();
  await expect(page.locator('.toast')).toContainText('Message envoyé à 11 élèves');

  // Léa le trouve dans son courrier, comme un mot et non comme un livre
  await changer(page, 'eleve');
  await expect(page).toHaveURL(/\/demo\/eleve\/classe$/, { timeout: 10000 });
  await aller(page, '/demo/eleve/courrier');
  const mot = page.locator('.co-ligne', { hasText: 'Contrôle vendredi' });
  await expect(mot).toBeVisible({ timeout: 10000 });
  await expect(mot).not.toContainText('page');

  // et le devoir lu n'est plus à faire, même après un rechargement de la page
  await aller(page, '/demo/eleve/classe');
  await expect(page.locator('#page').getByText('Irregular verbs, série 1')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#page').getByText('Fonctions affines')).toHaveCount(0);
  expect(parties).toEqual([]);
});

test('ce qui coûte est grisé, et le dit', async ({ page }) => {
  const parties = await ouvrirDemo(page, 'eleve');
  await expect(page).toHaveURL(/\/demo\/eleve\/classe$/, { timeout: 10000 });
  await aller(page, '/demo/eleve/livres/nouveau');
  const cours = page.getByRole('tab', { name: 'Cours' });
  await expect(cours).toHaveClass(/payant/, { timeout: 10000 });
  await expect(cours).toHaveAttribute('data-astuce', 'Avec un compte Folio');
  await expect(page.getByRole('tab', { name: 'Photo' })).toHaveClass(/payant/);
  await expect(page.getByRole('tab', { name: 'Fichier' })).toHaveClass(/payant/);
  await expect(page.getByRole('tab', { name: 'Coller' })).not.toHaveClass(/payant/);
  await cours.click({ force: true });                     // aria-disabled : on touche quand même, comme un visiteur
  await expect(page.locator('.toast')).toContainText('Avec un compte Folio');
  await expect(page.getByRole('tab', { name: 'Écrire' })).toHaveAttribute('aria-selected', 'true');
  expect(parties).toEqual([]);
});

test.describe('sur ordinateur', () => {
  test.use({ viewport: { width: 1360, height: 860 } });

  test('Claire crée une classe ; elle reste après un rafraîchissement ; « Quitter » ne laisse rien', async ({ page }) => {
    const parties = await ouvrirDemo(page, 'ref');
    await expect(page.locator('.rf-code-v').first()).toHaveText('DEMX-PK47', { timeout: 10000 });
    await page.locator('#rail [data-r="ref:classes"]').click();
    await page.locator('#rfcnom').fill('2nde C');
    await page.locator('#rfcniv').selectOption('2nde');
    await page.getByRole('button', { name: 'Créer' }).click();
    await expect(page.locator('.rf-ligne', { hasText: '2nde C' })).toBeVisible({ timeout: 10000 });

    await aller(page);
    await expect(page).toHaveURL(/\/demo\/referent\/classes/);
    await expect(page.locator('.rf-ligne', { hasText: '2nde C' })).toBeVisible({ timeout: 10000 });
    expect(parties).toEqual([]);

    // « Quitter » ramène au site, pas à la connexion (2026-10-26)
    await page.locator('.dm-bandeau').getByRole('button', { name: 'Quitter' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Révise moins. Retiens tout.', { timeout: 10000 });
    await expect(page).toHaveURL(/\/$/);
    const restes = await page.evaluate(() => [...Object.keys(localStorage), ...Object.keys(sessionStorage)]
      .filter(k => /dece0000-|folio\.demo/.test(k)));
    expect(restes).toEqual([]);
  });
});
