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
  await expect(page.getByRole('button', { name: 'Lire 10' })).toBeVisible();   // les 10 pages sont à lire

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
  // ouvert juste après la séance : les 13 lectures comptent tout de suite (l'appareil les garde
  // tant que la base ne les a pas confirmées), puis la base les confirme sans double compte
  await expect(journal.locator('[data-k="pages"] b')).toHaveText('13', { timeout: 10000 });
  await expect(journal.locator('[data-k="justes"] b')).toHaveText('77 %');   // 10 réussites sur 13 réponses
  await expect(journal.locator('[data-k="serie"] b')).toHaveText('1');       // un jour d'affilée
  await expect(journal.locator('.jr-livre', { hasText: 'Capitales' })).toContainText('0 %');   // rien de « su » après une séance
  const ages = await journal.locator('.jr-leg b').allTextContents();
  expect(ages.map(Number).reduce((a, b) => a + b, 0)).toBe(10);                  // la mémoire compte les 10 pages, une fois chacune
  await expect.poll(() => store.journal.filter(l => l.includes('rpc/journal')).length, { timeout: 10000 }).toBeGreaterThan(0);
  await expect(journal.locator('[data-k="pages"] b')).toHaveText('13');

  // et ce qui est parti au serveur raconte la même chose
  await expect.poll(() => (store.tables.reviews || []).length, { timeout: 10000 }).toBe(13);
  expect(store.tables.reviews.filter(r => !r.correct)).toHaveLength(3);
  expect(store.tables.cards).toHaveLength(10);
  expect(store.tables.cards.every(c => c.state === 2 && c.stability > 0)).toBe(true);
  // la séance part après ses révisions : l'attendre, plutôt que la lire au vol
  await expect.poll(() => (store.tables.sessions || []).length, { timeout: 10000 }).toBe(1);
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
  await expect(page.locator('main .lbl').first()).toContainText('3');
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

/* La recherche dans un livre, au téléphone (2026-10-25) : le champ
   s'étirait sur tout l'écran quand la liste filtrée était courte, et chaque
   lettre reconstruisait la page entière — le clavier sautait. Le champ doit
   garder sa hauteur d'une ligne et rester le même élément : seule la liste
   change. */
test('chercher dans un livre : une ligne, le même champ, seule la liste bouge', async ({ page }) => {
  const store = nouveauStore();
  await brancher(page, store);
  await inscrire(page);
  semerLivre(store, 'lea@exemple.fr', 'Vocabulaire',
    [...Array.from({ length: 30 }, (_, j) => ['mot ' + j, 'sens ' + j]), ['le calme', 'la calma']]);
  await page.reload();
  await page.getByRole('button', { name: /Vocabulaire/ }).click();
  await page.getByRole('button', { name: 'Chercher dans ce livre' }).click();
  const champ = page.getByRole('searchbox', { name: 'Chercher dans ce livre' });
  await expect(champ).toBeFocused();
  await page.evaluate(() => { document.getElementById('dq').dataset.temoin = 'là'; });
  const h0 = (await champ.boundingBox()).height;
  expect(h0).toBeLessThan(60);
  await champ.pressSequentially('le ca', { delay: 60 });
  await expect(page.locator('#dcount')).toHaveText('1 / 31');
  await expect(page.locator('.rows .row')).toHaveCount(1);
  await expect(champ).toBeFocused();
  expect(await page.evaluate(() => document.getElementById('dq').dataset.temoin)).toBe('là');   // jamais recréé
  expect((await champ.boundingBox()).height).toBe(h0);
  await champ.pressSequentially('zz', { delay: 60 });
  await expect(page.getByText('Aucune carte ne contient')).toBeVisible();
  expect((await champ.boundingBox()).height).toBe(h0);
  await champ.fill('');
  await expect(page.locator('#dcount')).toHaveText('31');
});

/* Un gros livre sur ordinateur (2026-10-25) : la molette fait défiler les
   pages, pas la page entière — le livre, « Lire » et la recherche restent
   sous les yeux. Repeindre (suspendre une page) ne renvoie pas la liste en
   haut. */
test('sur ordinateur, seules les pages d’un gros livre défilent', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 800 });
  const store = nouveauStore();
  await brancher(page, store);
  await inscrire(page);
  semerLivre(store, 'lea@exemple.fr', 'Tutti', Array.from({ length: 200 }, (_, j) => ['parola ' + j, 'mot ' + j]));
  await page.reload();
  await page.getByRole('button', { name: /Tutti/ }).click();
  const rows = page.locator('.rows');
  await expect(rows.locator('.row').first()).toBeVisible();
  await rows.hover();
  await page.mouse.wheel(0, 2500);
  await expect.poll(() => rows.evaluate(r => r.scrollTop)).toBeGreaterThan(1500);
  expect(await page.evaluate(() => document.body.scrollTop)).toBe(0);
  await expect(page.locator('.cta.read')).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Chercher dans ce livre' })).toBeInViewport();
  const ligne = rows.locator('.row').filter({ has: page.locator('input[value="parola 40"]') });
  await ligne.hover();
  const avant = await rows.evaluate(r => r.scrollTop);
  expect(avant).toBeGreaterThan(1000);
  await ligne.locator('[data-sus]').click();
  await expect(page.locator('.rows .row.off')).toHaveCount(1);
  expect(Math.abs(await page.locator('.rows').evaluate(r => r.scrollTop) - avant)).toBeLessThan(40);
});

/* Réglé comme Anki (2026-10-25) : 20 pages neuves par jour et par livre,
   « +20 » pour aller plus loin, et plus aucun réglage du moteur à
   comprendre dans les Réglages. */
test('un livre de 30 pages neuves : 20 aujourd’hui, « +20 » pour la suite, des réglages sans moteur', async ({ page }) => {
  const store = nouveauStore();
  await brancher(page, store);
  await inscrire(page);
  semerLivre(store, 'lea@exemple.fr', 'Verbes', Array.from({ length: 30 }, (_, j) => ['verbe ' + j, 'sens ' + j]));
  await page.reload();
  await page.getByRole('button', { name: /Verbes/ }).click();
  await page.getByRole('button', { name: 'Lire 20' }).click();
  await expect(page.getByText('1/20')).toBeVisible();
  for (let k = 0; k < 20; k++) await noter(page, 'Facile');
  await page.getByRole('button', { name: 'Fin' }).click();
  await page.getByRole('button', { name: 'Lire +20' }).click();
  await expect(page.getByText('1/10')).toBeVisible();          // les 10 qui restaient
  await noter(page, 'Facile');
  await page.getByRole('button', { name: 'Retour' }).first().click();     // quitter la séance
  await page.getByRole('button', { name: 'Retour' }).first().click();     // quitter le livre
  await page.getByRole('button', { name: 'Réglages' }).click();
  const reglages = page.locator('main');
  await expect(reglages).toContainText('Objectif du jour');
  for (const parti of ['Rétention', 'Nouvelles pages par séance', 'Régler le moteur', 'Vérifier ma bibliothèque', 'Mode simple', 'Ordre des pages']) {
    await expect(reglages).not.toContainText(parti);
  }
});
