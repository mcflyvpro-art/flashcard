// L'objectif examen (Mirandola Infini, 2026-11-05) : la date d'un examen sur
// un livre, sa pastille « J-n » en tête du livre, la feuille qui la change ou
// la retire, la date qui part avec le livre vers la base ; rien de tout cela
// pour un compte Mirandola+. Les règles du moteur : test/examen.test.js.
import { test, expect } from '@playwright/test';
import { brancher, nouveauStore } from './faux-supabase.js';
import { creerLivre, inscrire } from './aide.js';

const iso = j => { const d = new Date(Date.now() + j * 86400000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

function infini(store, email = 'lea@exemple.fr') {
  const u = store.users.find(x => x.email === email);
  store.tables.abonnements = [{ user_id: u.id, source: 'stripe', statut: 'actif', formule: 'infini_annuel', fin_prevue: false,
    fin_periode: new Date(Date.now() + 300 * 86400000).toISOString() }];
}

test('Infini : fixer la date d’un examen, la voir en tête du livre, la changer, la retirer', async ({ page }) => {
  const store = nouveauStore();
  await brancher(page, store);
  await inscrire(page);
  infini(store);
  await page.reload();
  await creerLivre(page, 'Histoire', 4);

  await page.getByRole('button', { name: 'Menu du livre' }).click();
  await page.getByRole('button', { name: 'Objectif examen' }).click();
  const feuille = page.locator('.menu.ex');
  await expect(feuille).toBeVisible({ timeout: 10000 });
  await feuille.getByLabel('Date de l’examen').fill(iso(20));
  await feuille.getByRole('button', { name: 'Fixer la date' }).click();

  // la feuille dit le compte à rebours, la prévision et ce que fait le moteur
  await expect(feuille.locator('.ex-j b')).toHaveText('J-20');
  await expect(feuille.locator('.ex-prev b')).toHaveText('0 %');          // rien lu encore
  await expect(feuille.locator('.ex-faits .on').first()).toHaveText('95 %');
  await page.keyboard.press('Escape');

  const pastille = page.locator('.head .exa');
  await expect(pastille).toHaveText('J-20');
  await expect.poll(() => (store.tables.decks.find(d => d.name === 'Histoire') || {}).meta?.examen, { timeout: 10000 }).toBe(iso(20));

  // la pastille rouvre la feuille ; changer, puis retirer
  await pastille.click();
  await feuille.getByRole('button', { name: 'Changer la date' }).click();
  await feuille.getByLabel('Date de l’examen').fill(iso(45));
  await feuille.getByRole('button', { name: 'Changer' }).click();
  await expect(feuille.locator('.ex-j b')).toHaveText('J-45');
  await expect(feuille.locator('.ex-faits span').first()).toHaveText('95 % dès J-30');
  await feuille.getByRole('button', { name: 'Retirer l’objectif' }).click();
  await expect(feuille.getByRole('button', { name: 'Fixer la date' })).toBeVisible();
  await expect(pastille).toHaveCount(0);
  await expect.poll(() => (store.tables.decks.find(d => d.name === 'Histoire') || {}).meta?.examen ?? null, { timeout: 10000 }).toBeNull();
});

test('Mirandola+ : ni objectif examen, ni pastille', async ({ page }) => {
  const store = nouveauStore();
  await brancher(page, store);
  await inscrire(page);
  await creerLivre(page, 'Histoire', 2);
  await page.getByRole('button', { name: 'Menu du livre' }).click();
  await expect(page.getByRole('button', { name: 'Réglages du livre' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Objectif examen' })).toHaveCount(0);
});
