// M07.T2 — le parcours d'un élève B2C : inscription → créer un livre →
// réviser 10 cartes → les statistiques affichées sont justes.
// Contre le faux Supabase en mémoire (e2e/faux-supabase.js) : aucun compte
// créé dans la vraie base.
import { test, expect } from '@playwright/test';
import { brancher, nouveauStore } from './faux-supabase.js';
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
