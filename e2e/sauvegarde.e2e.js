// La sauvegarde (2026-11-18, ui/sauvegarde.js) : exporter, restaurer, et
// jamais plus de paquets que l'offre n'en garde. Demandé : « évite les
// douilles d'abonnement en exportant les données et en les réintégrant
// gratuitement ; si on importe plus de paquets que la limite, un message ».
// Le lien « recto et verso seulement » est parti.
import { test, expect } from '@playwright/test';
import { brancher, nouveauStore, semerLivre } from './faux-supabase.js';
import { inscrire } from './aide.js';

const gratuit = () => ({ ...nouveauStore(), parDefaut: 'gratuit' });
const pages = i => [1, 2].map(k => [`question ${i}.${k}`, `réponse ${i}.${k}`]);

/* Une sauvegarde de `n` paquets, faite par un autre compte (un fichier
   qu'on se passe) ; la première carte porte une image en `data:`, que
   Mirandola gratuit n'a pas. */
function fichier(n) {
  const decks = Array.from({ length: n }, (_, i) => ({
    id: 'paquet-' + i, name: 'Sauvé ' + (i + 1), subject: '',
    cards: [{ id: 'c' + i, f: 'recto ' + i, b: 'verso ' + i, fi: 'data:image/png;base64,iVBORw0KGgo=' }]
  }));
  return Buffer.from(JSON.stringify({ format: 'folio-bibliotheque', version: 1, owner: 'un-autre-compte', subjects: [], decks }));
}

async function ouvrirSauvegarde(page) {
  await page.goto('./eleve/reglages');
  await page.locator('[data-act="backup2"]').click();
  await expect(page.locator('.menu.sv')).toBeVisible({ timeout: 10000 });
}

async function restaurer(page, n) {
  const choix = page.waitForEvent('filechooser');
  await page.locator('[data-sv="restaurer"]').click();
  await (await choix).setFiles({ name: 'sauvegarde.json', mimeType: 'application/json', buffer: fichier(n) });
}

test('Mirandola gratuit : la feuille dit ce qui tient, et rien n’entre au-delà', async ({ page }) => {
  const store = gratuit();
  await brancher(page, store);
  await inscrire(page);
  for (let i = 1; i <= 2; i++) semerLivre(store, 'lea@exemple.fr', 'Paquet ' + i, pages(i));
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/offre-gratuit/, { timeout: 10000 });

  await ouvrirSauvegarde(page);
  await expect(page.locator('.menu.sv')).not.toContainText('Partager un lien');
  await restaurer(page, 6);
  // le message, avant d'écrire quoi que ce soit : 6 paquets, 3 places
  await expect(page.locator('.sv-trop h2')).toHaveText('Ta sauvegarde a 6 paquets');
  await expect(page.locator('.sv-trop p')).toContainText('3 paquets peuvent entrer');
  await expect(page.locator('.sv-p.entre')).toHaveCount(3);
  await expect(page.locator('.sv-dehors')).toHaveText('+3');
  expect(store.tables.decks.filter(d => !d.deleted_at)).toHaveLength(2);

  await page.locator('[data-sv="partiel"]').click();
  await expect(page.locator('.toast')).toContainText('3 paquets restaurés');
  await expect(page.locator('html')).toHaveClass(/livres-plein/);
  await page.goto('./eleve/paquets');
  for (const t of ['Sauvé 1', 'Sauvé 2', 'Sauvé 3']) await expect(page.getByText(t, { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Sauvé 4', { exact: true })).toHaveCount(0);
  // et l'image en data: n'est pas venue avec
  const venues = () => store.tables.cards.filter(c => /^recto /.test(c.front));
  await expect.poll(() => venues().length, { timeout: 10000 }).toBe(3);
  expect(venues().every(c => !(c.meta || {}).fi)).toBe(true);

  // pleine : la feuille ne propose plus que Mirandola+, qui dit pourquoi
  await ouvrirSauvegarde(page);
  await restaurer(page, 2);
  await expect(page.locator('.sv-trop p')).toContainText('ta bibliothèque est pleine');
  await expect(page.locator('[data-sv="partiel"]')).toHaveCount(0);
  await page.locator('[data-sv="plus"]').click();
  await expect(page.locator('.fp-raison')).toContainText('Tes 5 paquets de Mirandola gratuit sont pris', { timeout: 10000 });
});

test('Mirandola gratuit : dupliquer un paquet, bibliothèque pleine, ouvre Mirandola+', async ({ page }) => {
  const store = gratuit();
  await brancher(page, store);
  await inscrire(page);
  for (let i = 1; i <= 5; i++) semerLivre(store, 'lea@exemple.fr', 'Paquet ' + i, pages(i));
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/livres-plein/, { timeout: 10000 });
  await page.getByText('Paquet 1', { exact: true }).first().click();
  await page.getByRole('button', { name: 'Menu du paquet' }).click();
  await page.locator('[data-mact="clone"]').click();
  await expect(page.locator('.fp-raison')).toContainText('Tes 5 paquets de Mirandola gratuit sont pris', { timeout: 10000 });
  expect(store.tables.decks.filter(d => !d.deleted_at)).toHaveLength(5);
});

test('Mirandola+ : tout se restaure d’un coup, et l’export rend le fichier complet', async ({ page }) => {
  const store = nouveauStore();
  await brancher(page, store);
  await inscrire(page);
  await ouvrirSauvegarde(page);
  await restaurer(page, 7);
  await expect(page.locator('.toast')).toContainText('7 paquets restaurés', { timeout: 10000 });
  await expect(page.locator('.menu.sv')).toHaveCount(0);

  await ouvrirSauvegarde(page);
  await expect(page.locator('.mhd')).toContainText('7 cartes dans 7 paquets');
  const dl = page.waitForEvent('download');
  await page.locator('[data-sv="exporter"]').click();
  const f = await dl;
  expect(f.suggestedFilename()).toMatch(/^mirandola-bibliotheque-\d{4}-\d{2}-\d{2}\.json$/);
});
