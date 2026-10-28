// M07.T4 — deux appareils du même compte modifient le même livre sans se
// voir (hors ligne), puis se reconnectent : aucune modification ne se perd,
// et aucune boîte de dialogue ne demande de choisir (fusion à trois
// versions, src/fusion.js, branchée dans flush() et pull()).
import { test, expect } from '@playwright/test';
import { brancher, nouveauStore } from './faux-supabase.js';
import { connecter, creerLivre, inscrire } from './aide.js';

const carte = (store, k) => store.tables.cards.find(c => c.front.startsWith('Pays ' + k));

async function modifier(page, champ, index, texte) {
  const boite = page.getByRole('textbox', { name: champ }).nth(index);
  await boite.click();
  await boite.fill(texte);
  await boite.blur();
}

async function couper(ctx, store, coupe) {
  await ctx.setOffline(coupe);
}

async function deuxAppareils(browser, store) {
  const ctxA = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const ctxB = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await brancher(ctxA, store); await brancher(ctxB, store);
  const A = await ctxA.newPage(), B = await ctxB.newPage();
  await inscrire(A);
  await creerLivre(A, 'Capitales', 3);
  await expect.poll(() => (store.tables.cards || []).length).toBe(3);
  await connecter(B);
  await B.getByRole('button', { name: /Capitales/ }).click();
  await expect(B.getByRole('textbox', { name: 'Recto' })).toHaveCount(3);
  return { ctxA, ctxB, A, B };
}

test('édition croisée hors ligne sur deux appareils : 0 perte, 0 boîte de choix', async ({ browser }) => {
  test.setTimeout(120000);
  const store = nouveauStore();
  const ctxA = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const ctxB = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await brancher(ctxA, store); await brancher(ctxB, store);
  const A = await ctxA.newPage(), B = await ctxB.newPage();

  await inscrire(A);
  await creerLivre(A, 'Capitales', 3);
  await expect.poll(() => (store.tables.cards || []).length).toBe(3);

  await connecter(B);
  await B.getByRole('button', { name: /Capitales/ }).click();
  await expect(B.getByRole('textbox', { name: 'Recto' })).toHaveCount(3);

  // les deux appareils perdent le réseau (page.route passe avant setOffline : couper aussi le faux serveur)
  store.online = false;
  await couper(ctxA, store, true); await couper(ctxB, store, true);
  await modifier(A, 'Recto', 0, 'Pays 1 — corrigé sur A');
  await modifier(B, 'Verso', 2, 'Capitale 3 — corrigée sur B');

  // A revient le premier : sa version part telle quelle
  store.online = true;
  await couper(ctxA, store, false);
  await expect.poll(() => carte(store, 1).front, { timeout: 15000 }).toBe('Pays 1 — corrigé sur A');

  // puis B, dont la version de base est désormais périmée
  await couper(ctxB, store, false);
  await expect.poll(() => carte(store, 3).back, { timeout: 15000 }).toBe('Capitale 3 — corrigée sur B');
  expect(carte(store, 1).front).toBe('Pays 1 — corrigé sur A');           // le travail de A n'a pas été écrasé
  expect(store.tables.cards).toHaveLength(3);
  await expect(B.getByText('Modifié sur un autre appareil')).toHaveCount(0);

  // et chaque appareil, rouvert (sur le livre : l'adresse le garde), voit les deux corrections
  for (const p of [A, B]) {
    await p.reload();
    await expect(p.getByRole('button', { name: 'Menu du livre' })).toBeVisible({ timeout: 10000 });
    await expect(p.getByRole('textbox', { name: 'Recto' }).nth(0)).toHaveValue('Pays 1 — corrigé sur A');
    await expect(p.getByRole('textbox', { name: 'Verso' }).nth(2)).toHaveValue('Capitale 3 — corrigée sur B');
  }
  await ctxA.close(); await ctxB.close();
});

/* Le chemin de la réouverture : avant le 2026-10-16, pull() donnait au
   paquet modifié localement le numéro de révision du serveur sans rien
   comparer — l'envoi suivant passait le contrôle et écrasait en silence
   ce que l'autre appareil avait fait entre-temps. */
test('modifié hors ligne, app fermée, l’autre appareil passe, réouverture : 0 perte', async ({ browser }) => {
  test.setTimeout(120000);
  const store = nouveauStore();
  const { ctxA, ctxB, A, B } = await deuxAppareils(browser, store);

  store.online = false; await couper(ctxB, store, true);
  await modifier(B, 'Verso', 2, 'Capitale 3 — corrigée sur B');
  await B.close();                                   // B ferme l'app sans avoir pu envoyer

  store.online = true;
  await modifier(A, 'Recto', 0, 'Pays 1 — corrigé sur A');
  await expect.poll(() => carte(store, 1).front, { timeout: 15000 }).toBe('Pays 1 — corrigé sur A');

  await couper(ctxB, store, false);
  const B2 = await ctxB.newPage();                   // B rouvre l'app, réseau revenu
  await B2.goto('./app');
  await expect.poll(() => carte(store, 3).back, { timeout: 15000 }).toBe('Capitale 3 — corrigée sur B');
  expect(carte(store, 1).front).toBe('Pays 1 — corrigé sur A');
  await expect(B2.getByText('Modifié sur un autre appareil')).toHaveCount(0);
  await ctxA.close(); await ctxB.close();
});

/* 2026-10-28 : la bibliothèque suit l'autre appareil sans recharger.
   Avant, B ne voyait le livre créé sur A qu'après un rechargement — et
   restait sur l'ancienne version d'un livre que A venait de corriger. Le
   retour sur l'app (focus) suffit désormais (ui/synchro-ecran.js). */
test('un livre créé et une page corrigée sur A apparaissent sur B au retour, sans recharger', async ({ browser }) => {
  test.setTimeout(120000);
  const store = nouveauStore();
  const { ctxA, ctxB, A, B } = await deuxAppareils(browser, store);
  const revenir = p => p.evaluate(() => dispatchEvent(new Event('focus')));

  await modifier(A, 'Recto', 0, 'Pays 1 — corrigé sur A');
  await expect.poll(() => carte(store, 1).front, { timeout: 15000 }).toBe('Pays 1 — corrigé sur A');
  await revenir(B);
  await expect(B.getByRole('textbox', { name: 'Recto' }).nth(0)).toHaveValue('Pays 1 — corrigé sur A', { timeout: 10000 });

  await A.getByRole('button', { name: 'Retour' }).first().click();
  await creerLivre(A, 'Fleuves', 2);
  await expect.poll(() => (store.tables.decks || []).filter(d => d.name === 'Fleuves').length).toBe(1);
  await B.getByRole('button', { name: 'Retour' }).first().click();
  await expect(B.getByRole('button', { name: /Capitales/ })).toBeVisible();
  await B.waitForTimeout(5200);                      // deux retours à moins de 5 s n'en font qu'un
  await revenir(B);
  await expect(B.getByRole('button', { name: /Fleuves/ })).toBeVisible({ timeout: 10000 });
  await expect(B.getByText('Modifié sur un autre appareil')).toHaveCount(0);
  await ctxA.close(); await ctxB.close();
});
