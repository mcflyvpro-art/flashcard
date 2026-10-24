// M07.T2 — le parcours d'un élève B2C : inscription → créer un livre →
// réviser 10 cartes → les statistiques affichées sont justes.
// Contre le faux Supabase en mémoire (e2e/faux-supabase.js) : aucun compte
// créé dans la vraie base.
import { test, expect } from '@playwright/test';
import { brancher, nouveauStore, semerLivre } from './faux-supabase.js';
import { creerLivre, inscrire, noter } from './aide.js';

test('inscription, un livre de 10 pages, une séance, des chiffres justes', async ({ page }) => {
  const store = nouveauStore();
  await brancher(page, store);
  const erreurs = [];
  page.on('pageerror', e => erreurs.push(e.message));

  await inscrire(page);
  expect(store.users).toHaveLength(1);

  await creerLivre(page, 'Capitales', 10);
  await expect(page.getByText('10 à revoir')).toBeVisible();

  // 10 pages vues : 7 sues du premier coup, 3 ratées (« Encore »)...
  await page.getByRole('button', { name: 'Lire 10' }).click();
  await expect(page.getByText('1/10')).toBeVisible();
  for (let k = 0; k < 10; k++) await noter(page, k < 7 ? 'Facile' : 'Encore');
  // ...que la séance représente aussitôt, et qui passent cette fois
  await expect(page.getByText('1/3')).toBeVisible();
  for (let k = 0; k < 3; k++) await noter(page, 'Facile');

  // fin de séance : 7 sur 10 du premier coup
  const fin = page.locator('main');
  await expect(fin).toContainText('70%');
  await expect(fin).toContainText('7 / 10');
  await expect(fin).toContainText(/3\s*erreurs/i);
  await expect(fin).toContainText(/À revoir\s*3/i);

  await page.getByRole('button', { name: 'Fin' }).click();
  await expect(page.getByText('Relue 10')).toBeVisible();
  await page.getByRole('button', { name: 'Retour' }).click();

  // le compteur du jour, puis le journal de lecture
  await page.getByRole('button', { name: '13', exact: true }).click();
  const journal = page.locator('main');
  // le journal se charge depuis le serveur (statsPull) : il montre « ······ » le temps d'arriver
  // ouvert juste après la séance : la file part, puis le journal se relit tout seul
  await expect(journal).toContainText(/13\s*pages lues/i, { timeout: 10000 });
  await expect(journal).toContainText(/77%\s*de réussite/i);        // 10 réussites sur 13 réponses
  await expect(journal).toContainText(/1\s*jour d’affilée/i);
  await expect(journal).toContainText(/0 sue sur 10/i);
  await expect(page.getByRole('button', { name: /^1 Pays \d+ Capitale \d+$/ })).toHaveCount(3);

  // et ce qui est parti au serveur raconte la même chose
  await expect.poll(() => (store.tables.reviews || []).length, { timeout: 10000 }).toBe(13);
  expect(store.tables.reviews.filter(r => !r.correct)).toHaveLength(3);
  expect(store.tables.cards).toHaveLength(10);
  expect(store.tables.cards.every(c => c.state === 2 && c.stability > 0)).toBe(true);
  expect(store.tables.sessions).toHaveLength(1);
  expect(store.tables.sessions[0].pct).toBe(0.7);            // fraction en base, pourcentage à l'écran
  expect(erreurs).toEqual([]);
});

/* L'écran unique de création (2026-10-24) : les méthodes sont des onglets,
   seule la choisie s'affiche, et toutes remplissent la même liste. Une liste
   collée puis « Créer » directement — sans passer par « Ajouter » — doit
   donner un livre complet : c'est le geste naturel, et l'ancien écran le
   perdait (le bouton « Créer » n'existait pas dans la zone de collage). */
test('écran unique : écrire, coller, et « Créer » prend aussi la liste en attente', async ({ page }) => {
  const store = nouveauStore();
  await brancher(page, store);
  await inscrire(page);
  await page.getByRole('button', { name: 'Nouveau livre' }).click();
  await page.locator('#nm').fill('Italien');
  await page.locator('#cf').fill('bonjour');
  await page.locator('#cb').fill('buongiorno');
  await page.locator('#cb').press('Enter');
  await expect(page.locator('#cn')).toHaveText('1');

  // une seule méthode à la fois : le composeur disparaît avec « Coller »
  await page.getByRole('tab', { name: 'Coller' }).click();
  await expect(page.locator('#cf')).toHaveCount(0);
  await expect(page.locator('#aipdf')).toHaveCount(0);
  // « bonjour » est déjà dans la liste, écrit à la main : écarté comme doublon
  await page.locator('#tx').fill('chat = gatto\nchien = cane\nbonjour = buongiorno');
  await expect(page.getByRole('button', { name: 'Ajouter 2 pages' })).toBeVisible();

  // le titre et la page déjà écrite survivent au changement d'onglet
  await page.getByRole('tab', { name: 'Fichier' }).click();
  await expect(page.locator('#aipdf')).toBeVisible();
  await page.getByRole('tab', { name: 'Coller' }).click();
  await expect(page.locator('#tx')).toHaveValue(/chien = cane/);
  await expect(page.locator('#nm')).toHaveValue('Italien');

  await page.getByRole('button', { name: 'Créer le livre' }).click();
  await expect(page.getByRole('button', { name: 'Menu du livre' })).toBeVisible();
  await expect(page.locator('main')).toContainText('3 pages');
});

/* C'est <body> qui défile, pas la fenêtre : le window.scrollTo(0, 0) de go()
   ne faisait rien, et un livre ouvert depuis le bas de la bibliothèque
   s'affichait au milieu de sa page (2026-10-24, sur PC comme sur téléphone). */
for (const [w, h] of [[390, 700], [1440, 700]]) {
  test(`ouvrir un livre depuis le bas de la bibliothèque arrive en haut (${w} px)`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    const store = nouveauStore();
    await brancher(page, store);
    await inscrire(page);
    for (let k = 0; k < 14; k++) semerLivre(store, 'lea@exemple.fr', 'Livre ' + k, Array.from({ length: 40 }, (_, j) => ['Q' + j, 'R' + j]));
    await page.reload();
    await expect(page.getByRole('button', { name: /Livre 13/ })).toBeVisible();
    await page.waitForTimeout(800);                          // la bibliothèque se repeint après sa synchro
    const livre = page.getByRole('button', { name: /Livre 12/ });
    await livre.scrollIntoViewIfNeeded();
    const avant = await page.evaluate(() => document.body.scrollTop);
    expect(avant).toBeGreaterThan(100);
    await livre.click();
    await expect(page.getByRole('button', { name: 'Menu du livre' })).toBeVisible();
    expect(await page.evaluate(() => document.body.scrollTop)).toBe(0);
    // le retour retrouve la bibliothèque là où on l'avait laissée
    await page.getByRole('button', { name: 'Retour' }).first().click();
    await expect(page.getByRole('button', { name: /Livre 12/ })).toBeInViewport();
  });
}
