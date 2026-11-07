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

/* L'examen blanc (2026-11-06) : la fausse IA de la base locale compose avec
   les premières pages (recto en question, verso attendu) et corrige en
   comparant ; la vraie relit ce qu'elle rend par src/examen-blanc.js. */
async function ouvrirBlanc(page, store) {
  await brancher(page, store);
  await inscrire(page);
  infini(store);
  await page.reload();
  await creerLivre(page, 'Capitales', 6);
  await page.getByRole('button', { name: 'Menu du livre' }).click();
  await page.getByRole('button', { name: 'Objectif examen' }).click();
  await page.locator('.menu.ex').getByRole('button', { name: /Examen blanc/ }).click();
  await expect(page).toHaveURL(/\/livres\/[^/]+\/examen-blanc$/, { timeout: 10000 });
}

test('l’examen blanc au clavier : rien sur ce qui est juste, une correction et un conseil sur ce qui ne l’est pas', async ({ page }) => {
  const store = nouveauStore();
  await ouvrirBlanc(page, store);
  await page.getByRole('button', { name: 'Composer le sujet' }).click();
  const reponses = page.locator('.eb-q textarea');
  await expect(reponses).toHaveCount(6, { timeout: 10000 });
  await expect(page.getByRole('button', { name: 'Rendre ma copie' })).toBeDisabled();
  for (let k = 0; k < 4; k++) await reponses.nth(k).fill('capitale ' + (k + 1));     // sans majuscule : juste quand même
  await reponses.nth(4).fill('Lyon');
  await page.getByRole('button', { name: 'Rendre ma copie' }).click();

  await expect(page.locator('.eb-note b')).toHaveText('13,5', { timeout: 10000 });
  await expect(page.locator('.eb-note p')).toHaveText('4/6 justes');
  await expect(page.locator('.eb-r.ok')).toHaveCount(4);
  await expect(page.locator('.eb-r.ok dl')).toHaveCount(0);                       // ce qui est juste : rien de plus
  const faux = page.locator('.eb-r.ko');
  await expect(faux).toHaveCount(2);
  await expect(faux.first()).toContainText('C’est « Capitale 5 »');
  await expect(faux.first()).toContainText('Tu as confondu avec « Lyon »');
  await expect(page.locator('.eb-bilan')).toBeVisible();

  // le résultat est gardé, en texte, au nom du compte
  await expect.poll(() => (store.tables.examens || []).length, { timeout: 10000 }).toBe(1);
  expect(store.tables.examens[0]).toMatchObject({ note: 13.5, questions: 6, justes: 4, copie: 'clavier' });

  // revoir les pages en cause, tout de suite
  await page.getByRole('button', { name: 'Revoir 2 pages' }).click();
  await expect(page.locator('#app')).toHaveAttribute('data-view', 'study');
  await page.goBack();
  await expect(page.locator('#app')).toHaveAttribute('data-view', 'deck', { timeout: 10000 });
});

test('l’examen blanc sur papier : la copie photographiée, lue et corrigée ; l’historique du livre', async ({ page }) => {
  const store = { ...nouveauStore(), copieLue: ['Capitale 1', 'Capitale 2', 'Capitale 3', 'Capitale 4', 'Capitale 5', 'Capitale 6'] };
  await ouvrirBlanc(page, store);
  await page.getByRole('radio', { name: 'Sur papier' }).click();
  await page.getByRole('button', { name: 'Composer le sujet' }).click();
  await expect(page.locator('.eb-papier .eb-q')).toHaveCount(6, { timeout: 10000 });
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  await page.locator('[data-eb-photo]').setInputFiles([
    { name: 'copie-1.png', mimeType: 'image/png', buffer: png }, { name: 'copie-2.png', mimeType: 'image/png', buffer: png }]);
  await expect(page.locator('.eb-photos figure')).toHaveCount(2);
  await page.getByRole('button', { name: 'Retirer la page 2' }).click();
  await expect(page.locator('.eb-photos figure')).toHaveCount(1);
  await page.getByRole('button', { name: 'Rendre ma copie' }).click();
  await expect(page.locator('.eb-note b')).toHaveText('20', { timeout: 10000 });
  await expect(page.getByRole('button', { name: /^Revoir/ })).toHaveCount(0);       // rien à revoir
  await expect.poll(() => (store.tables.examens || []).map(x => x.copie)).toEqual(['photo']);

  // l'historique du livre : la dernière note, au retour sur l'examen blanc
  await page.getByRole('button', { name: 'Terminer' }).click();
  await page.getByRole('button', { name: 'Menu du livre' }).click();
  await page.getByRole('button', { name: 'Objectif examen' }).click();
  await page.locator('.menu.ex').getByRole('button', { name: /Examen blanc/ }).click();
  await expect(page.locator('.eb-histo b')).toHaveText('20', { timeout: 10000 });
});
