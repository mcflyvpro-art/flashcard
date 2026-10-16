// M07.T6 — douze écrans, sur téléphone (390 px) et sur ordinateur (1440 px) :
// aucun ne déborde horizontalement, et chacun ressemble à sa capture de
// référence (e2e/captures.e2e.js-snapshots/).
//
// Les captures ne se comparent qu'en local : en CI (Linux), les polices ne
// sont pas celles d'un Mac et chaque image différerait de quelques pixels
// partout. Le contrôle de débordement, lui, tourne partout. Mettre à jour
// les références après un changement voulu : npx playwright test captures
// --update-snapshots.
import { test, expect } from '@playwright/test';
import { brancher, nouveauStore, semerLivre } from './faux-supabase.js';
import { inscrire } from './aide.js';

const MAINTENANT = new Date('2026-10-16T10:00:00Z');
const LARGEURS = [{ nom: 'mobile', width: 390, height: 844 }, { nom: 'bureau', width: 1440, height: 900 }];

for (const ecran of LARGEURS) {
  test(`12 écrans à ${ecran.width} px : 0 débordement, conformes aux captures`, async ({ page }) => {
    test.setTimeout(180000);
    await page.setViewportSize({ width: ecran.width, height: ecran.height });
    await page.clock.setFixedTime(MAINTENANT);
    // mélanges (association, QCM, ordre de révision) tirés d'une graine fixe : même image à chaque passage
    await page.addInitScript(() => { let g = 42; Math.random = () => (g = (g * 1103515245 + 12345) % 2147483648) / 2147483648; });
    const store = nouveauStore();
    await brancher(page, store);
    const vus = [];

    async function verifier(nom) {
      await page.waitForTimeout(700);                       // fin des transitions
      const largeur = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(largeur, `${nom} déborde à ${ecran.width} px`).toBeLessThanOrEqual(ecran.width);
      if (!process.env.CI) {
        await expect(page).toHaveScreenshot(`${ecran.nom}-${String(vus.length + 1).padStart(2, '0')}-${nom}.png`,
          { animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.005,
            // tolérance de couleur resserrée : à 0,2 (défaut), des boutons crème sur fond crème
            // étirés sur toute une colonne passaient inaperçus (vu le 2026-10-16)
            threshold: 0.03 });
      }
      vus.push(nom);
    }

    await page.goto('./');
    await expect(page.locator('#boot')).toHaveCount(0, { timeout: 10000 });
    await verifier('connexion');
    await page.getByRole('button', { name: 'Créer un compte' }).click();
    await verifier('inscription');
    await inscrire(page);
    await verifier('bibliotheque-vide');

    semerLivre(store, 'lea@exemple.fr', 'Capitales', [1, 2, 3, 4, 5, 6].map(k => ['Pays ' + k, 'Capitale ' + k]));
    await page.reload();
    await expect(page.getByRole('button', { name: /Capitales/ })).toBeVisible();
    await verifier('bibliotheque');

    await page.getByRole('button', { name: 'Nouveau livre' }).click();
    await page.locator('#nm').fill('Vocabulaire');
    await verifier('nouveau-livre');
    await page.getByRole('button', { name: 'Retour' }).first().click();

    await page.getByRole('button', { name: /Capitales/ }).click();
    await verifier('livre');

    await page.getByRole('button', { name: /^Lire/ }).click();
    await verifier('revision-recto');
    await page.locator('main').click({ position: { x: Math.round(ecran.width / 2), y: 400 } });
    await expect(page.getByRole('button', { name: /^Facile/ })).toBeVisible();
    await verifier('revision-verso');
    await page.getByRole('button', { name: 'Retour' }).first().click();

    await page.getByRole('button', { name: 'QCM', exact: true }).click();
    await expect(page.getByRole('button', { name: /^Capitale \d$/ })).toHaveCount(4);
    await verifier('qcm');
    await page.getByRole('button', { name: 'Retour' }).first().click();

    await page.getByRole('button', { name: 'Association', exact: true }).click();
    await verifier('association');
    await page.getByRole('button', { name: 'Retour' }).first().click();
    await page.getByRole('button', { name: 'Retour' }).first().click();

    await page.getByRole('button', { name: 'Réglages' }).click();
    await verifier('reglages');
    await page.getByRole('button', { name: 'Retour' }).first().click();

    // onglets en bas sur téléphone, barre latérale sur ordinateur
    await page.getByRole('button', { name: /^Le cercle( des lecteurs)?$/ }).first().click();
    await verifier('cercle-des-lecteurs');

    expect(vus).toHaveLength(12);
  });
}
