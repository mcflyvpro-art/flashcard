// L'accessibilité (2026-11-07, M09.T3, docs/FIABILITE.md) : axe-core, le
// moteur d'audit de référence (celui des outils de Chrome, de Microsoft et
// de Deque), passe sur les écrans principaux — le site, la connexion, et la
// vraie app dans la démo pour l'élève, le professeur et le référent. Aucune
// violation « grave » ni « critique » (un bouton sans nom, une image sans
// texte, un champ sans étiquette, un contraste illisible, un rôle ARIA
// faux) : un lecteur d'écran doit pouvoir tout dire, un clavier tout faire.
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { brancher, nouveauStore } from './faux-supabase.js';

const GRAVES = ['serious', 'critical'];

async function audit(page, ou) {
  /* juger l'écran posé, pas une entrée en cours : un texte qui apparaît en
     fondu se mesurerait à moitié transparent (les boucles infinies, elles,
     ne s'arrêtent jamais : on ne les attend pas) */
  await page.waitForFunction(() => document.getAnimations().every(a =>
    a.playState !== 'running' || a.effect?.getComputedTiming().iterations === Infinity), null, { timeout: 8000 }).catch(() => {});
  const r = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    // le voile d'une feuille qui se ferme, l'ouverture : rien à juger ; le dos
    // d'une carte retournée (.verso), caché en 3D, qu'axe ne sait pas voir caché
    .exclude('.sort').exclude('#boot').exclude('.verso')
    .analyze();
  const graves = r.violations.filter(v => GRAVES.includes(v.impact));
  const lisible = graves.map(v => `${v.impact} ${v.id} (${v.nodes.length}) : ${v.help}\n    ${v.nodes.slice(0, 4)
    .map(n => n.target.join(' ') + ' — ' + ((n.any[0] || n.all[0] || {}).message || '').slice(0, 160)).join('\n    ')}`);
  expect(lisible, `${ou} — axe-core`).toEqual([]);
}

test.describe('le site', () => {
  for (const chemin of ['/?site', '/tarifs', '/etablissements', '/academie', '/moteur']) {
    test(`${chemin}`, async ({ page }) => {
      await brancher(page, nouveauStore(), { navigateur: true });
      await page.goto('.' + chemin);
      await page.waitForTimeout(800);
      await audit(page, chemin);
    });
  }
});

test('la connexion et l’inscription', async ({ page }) => {
  await brancher(page, nouveauStore());
  await page.goto('./connexion');
  await expect(page.locator('#boot')).toHaveCount(0, { timeout: 10000 });
  await audit(page, 'connexion');
  await page.goto('./inscription');
  await expect(page.locator('#boot')).toHaveCount(0, { timeout: 10000 });
  await audit(page, 'inscription');
});

/* la vraie app, dans la démo : chaque rôle, ses écrans principaux */
async function entrerDemo(page, role) {
  await brancher(page, nouveauStore(), { navigateur: true });
  await page.goto('./essayer');
  await page.locator(`.dm-role[data-v="${role}"]`).click();
  // le tuto de la démo : on le passe, on audite l'app elle-même
  await page.locator('#tu [data-tu="non"], #tu [data-tu="passer"]').first().click({ timeout: 15000 });
  await expect(page.locator('#tu')).toHaveCount(0, { timeout: 10000 });
}

test('l’élève : sa classe, ses livres, un livre, le cercle', async ({ page }) => {
  test.setTimeout(120000);
  await entrerDemo(page, 'eleve');
  await audit(page, 'élève — sa classe (son arrivée)');
  await page.getByRole('button', { name: 'Livres', exact: true }).click();
  await page.waitForTimeout(600);
  await audit(page, 'élève — ses livres');
  await page.locator('[data-go]:visible').first().click();
  await page.waitForTimeout(600);
  await audit(page, 'élève — un livre');
  await page.getByRole('button', { name: 'Retour' }).first().click();
  await page.getByRole('button', { name: /^Cercle des lecteurs/ }).click();
  await page.waitForTimeout(800);
  await audit(page, 'élève — le cercle');
});

test('le professeur : son tableau de bord', async ({ page }) => {
  test.setTimeout(90000);
  await entrerDemo(page, 'prof');
  await page.waitForTimeout(800);
  await audit(page, 'professeur — tableau de bord');
});

test('le référent : sa console', async ({ page }) => {
  test.setTimeout(90000);
  await entrerDemo(page, 'ref');
  await page.waitForTimeout(800);
  await audit(page, 'référent — console');
});
