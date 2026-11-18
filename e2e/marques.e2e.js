// Le menu d'une carte, l'aperçu de la taille du texte et les fonctions
// marquées (2026-11-18) : « l'affichage mémoire n'est pas beau, fouillis,
// pas clair » ; « l'aperçu : une vraie carte où l'on écrit ce qu'on veut,
// qu'on retourne » ; « les features + en or, celles d'Infini à la couleur
// d'Infini, peu importe le profil ; pas dispo : la feature grisée, le badge
// comme avant ».
import { test, expect } from '@playwright/test';
import { brancher, nouveauStore, semerLivre } from './faux-supabase.js';
import { semerCompte } from './faux-cercle.js';
import { connecter } from './aide.js';

const J = 864e5;

function compte(offre) {
  const store = { ...nouveauStore(), ...(offre === 'gratuit' ? { parDefaut: 'gratuit' } : {}) };
  const u = semerCompte(store, 'lea@exemple.fr');
  if (offre !== 'gratuit') store.tables.abonnements = [{ user_id: u, source: 'offert', statut: 'actif', formule: offre === 'infini' ? 'infini_annuel' : null, fin_periode: null }];
  const id = semerLivre(store, 'lea@exemple.fr', 'Verbes', [['frapper', 'hit'], ['avoir', 'to have']]);
  Object.assign(store.tables.cards.find(c => c.deck_id === id && c.front === 'frapper'), {
    state: 2, stability: 14.2, difficulty: 1.3, trace2: 14.2, last_review: Date.now() - 2 * J, due: Date.now() + 12 * J,
    interval_days: 14, reviews_count: 3, lapses: 1 });
  return store;
}

async function ouvrirPaquet(page) {
  await page.locator('[data-go]', { hasText: 'Verbes' }).first().click();
  await expect(page.locator('#app')).toHaveAttribute('data-view', 'deck', { timeout: 10000 });
}

test('la mémoire d’une carte : trois tuiles, puis son âge et ce qui les explique', async ({ page }) => {
  await brancher(page, compte('plus'));
  await connecter(page);
  await ouvrirPaquet(page);
  await page.locator('[data-card]').first().click();
  const mem = page.locator('.menu .mem');
  await expect(mem.locator('.mem-t span')).toHaveText(['Souvenir', 'Revient', 'Difficulté']);
  await expect(mem.locator('.mem-t').nth(1).locator('b')).toHaveText('12 j');
  await expect(mem.locator('.mem-t').nth(2).locator('b')).toHaveText('1,3/10');
  await expect(page.locator('.menu .mem-s')).toHaveText(/Récente · stable 14 j · 3 réussites · 1 oubli/);
  await expect(page.locator('.menu')).not.toContainText('Prochain passage');
  // une carte jamais révisée le dit, sans tuiles
  await page.locator('.menu:not(.sort) .mx').click();
  await page.locator('[data-card]').nth(1).click();
  await expect(page.locator('.menu .mem')).toHaveCount(0);
  await expect(page.locator('.menu .mem-s')).toHaveText(/Nouvelle · jamais révisée/);
});

test('la taille du texte se règle sur une vraie carte, qu’on écrit et qu’on retourne', async ({ page }) => {
  await brancher(page, compte('plus'));
  await connecter(page);
  await page.goto('./eleve/reglages');
  const carte = page.locator('.fcarte .card');
  await expect(carte).toBeVisible({ timeout: 10000 });
  const recto = page.locator('.fcarte .tx[data-fc="f"]'), verso = page.locator('.fcarte .tx[data-fc="b"]');
  await page.locator('[data-fc="ecrire"]').click();
  await expect(recto).toBeFocused();
  await page.keyboard.type('el perro');
  await expect(recto).toHaveText('el perro');
  await page.locator('[data-fc="tour"]').click();
  await expect(carte).toHaveClass(/flip/);
  // le verso suit le réglage, comme le recto
  const taille = () => verso.evaluate(n => parseFloat(getComputedStyle(n).fontSize));
  const avant = await taille();
  await page.locator('#pFont').fill('140');
  await expect.poll(taille).toBeGreaterThan(avant * 1.2);
  // un appui ailleurs sur la carte la retourne aussi ; le texte écrit est resté
  await carte.click({ position: { x: 20, y: 20 } });
  await expect(carte).not.toHaveClass(/flip/);
  await expect(recto).toHaveText('el perro');
});

test('une fonction des offres se voit pour tous : l’or de Mirandola+, le bleu-rose d’Infini ; fermée, grisée sous sa pastille', async ({ browser }) => {
  const OR = 'rgb(160, 98, 0)', INFINI = 'rgb(106, 85, 181)', GRIS = 'rgb(109, 105, 99)';
  const voir = async offre => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await brancher(page, compte(offre));
    await connecter(page);
    await ouvrirPaquet(page);
    await expect(page.locator('html')).toHaveClass(offre === 'gratuit' ? /offre-gratuit/ : /offre-plus/, { timeout: 10000 });
    const qcm = page.locator('.acts [data-act="mcq"]');
    if (offre !== 'gratuit') await expect.poll(() => qcm.evaluate(n => getComputedStyle(n).color), { timeout: 10000 }).toBe(OR);
    const r = { qcm: await qcm.evaluate(n => [getComputedStyle(n).color, getComputedStyle(n, '::after').backgroundImage]) };
    await page.getByRole('button', { name: 'Menu du paquet' }).click();
    const examen = page.locator('.menu .mi[data-mact^="examen"]').first();
    r.examen = await examen.evaluate(n => [n.dataset.mact, getComputedStyle(n).color, (n.querySelector('.mi-infini') || {}).textContent || '']);
    await ctx.close();
    return r;
  };
  const g = await voir('gratuit'), p = await voir('plus'), i = await voir('infini');
  // fermée : le nom grisé, la pastille « + » d'or comme avant (pas grise)
  expect(g.qcm[0]).toBe(GRIS);
  expect(g.qcm[1]).toContain('gradient');
  // ouverte : l'or de Mirandola+, chez un abonné Mirandola+ comme chez un abonné Infini
  expect(p.qcm[0]).toBe(OR);
  expect(i.qcm[0]).toBe(OR);
  // Objectif examen : fermé chez Mirandola+ (grisé, pastille « Infini »), au bleu-rose chez Infini
  expect(p.examen).toEqual(['examen-infini', GRIS, 'Infini']);
  expect(i.examen).toEqual(['examen', INFINI, '']);
});

test('la pastille « Infini » d’une fonction fermée garde la couleur d’Infini', async ({ page }) => {
  await brancher(page, compte('plus'));
  await connecter(page);
  await ouvrirPaquet(page);
  await page.getByRole('button', { name: 'Menu du paquet' }).click();
  const pastille = page.locator('.menu [data-mact="examen-infini"] .mi-infini');
  await expect(pastille).toHaveText('Infini');
  expect(await pastille.evaluate(n => getComputedStyle(n).backgroundImage)).toContain('gradient');
});
