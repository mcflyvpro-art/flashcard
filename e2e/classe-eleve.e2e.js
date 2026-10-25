// La page d'une classe, côté élève (2026-10-25) : toucher sa classe dans
// « Ma classe » ouvre une page — nom, professeur et matière, élèves, devoirs
// de cette classe — au lieu d'une petite fiche ; un camarade y ouvre son
// profil. Qui voit quoi se prouve en base (supabase/tests/classe_eleve.sql).
import { test, expect } from '@playwright/test';
import { brancher, nouveauStore } from './faux-supabase.js';
import { semerAmis, semerCompte, semerPseudo } from './faux-cercle.js';
import { faireProfesseur, rpcClasses } from './faux-classes.js';
import { connecter } from './aide.js';

test('ma classe : son professeur, ses élèves, ses devoirs, un camarade', async ({ page }) => {
  const store = nouveauStore();
  const lea = semerCompte(store, 'lea@exemple.fr'), tom = semerCompte(store, 'tom@exemple.fr');
  const prof = semerCompte(store, 'prof@exemple.fr');
  semerPseudo(store, 'lea@exemple.fr', 'lea', 'Léa Martin');
  semerPseudo(store, 'tom@exemple.fr', 'tom', 'Tom Bernard');
  semerAmis(store, 'lea@exemple.fr', 'tom@exemple.fr');
  faireProfesseur(store, 'prof@exemple.fr', 'M. Durand');
  const [, cid] = rpcClasses(store, 'prof_creer_classe', { nom: '2nde B', niveau: '2nde', matiere: 'Anglais' }, { id: prof });
  for (const [uid, nom] of [[lea, 'Léa MARTIN'], [tom, 'Tom BERNARD']]) {
    store.cl.membres.push({ cid, uid, depuis: new Date().toISOString() });
    store.cl.noms[uid] = nom;
  }
  rpcClasses(store, 'prof_give', { cids: [cid], nom: 'Irregular verbs', matiere: 'Anglais', due: '2099-01-01',
    cartes: [['go', 'went'], ['see', 'saw']] }, { id: prof });

  await brancher(page, store);
  await connecter(page);
  await page.getByRole('button', { name: 'Classe', exact: true }).click();
  await page.locator('[data-el="classe"]', { hasText: '2nde B' }).click();
  await expect(page.locator('#app')).toHaveAttribute('data-view', 'classe');
  const tete = page.locator('.ec-tete');
  for (const t of ['2nde B', '2 élèves', 'Anglais']) await expect(tete).toContainText(t);
  await expect(page.locator('.ec-pers')).toContainText('M. Durand');
  await expect(page.locator('.ec-el')).toHaveCount(2);
  await expect(page.locator('.ec-el.moi')).toContainText('toi');
  await expect(page.locator('.ec-el', { hasText: 'Tom BERNARD' })).toContainText('ami');
  await expect(page.locator('[data-el="devoir"]')).toContainText('Irregular verbs');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

  // un camarade : son profil, et le retour ramène à la classe
  await page.locator('.ec-el', { hasText: 'Tom BERNARD' }).click();
  await expect(page.locator('.lp-tete')).toContainText('Tom Bernard');
  await page.getByRole('button', { name: 'Retour' }).first().click();
  await expect(page.locator('#app')).toHaveAttribute('data-view', 'classe');

  // un devoir ouvert d'ici y revient
  await page.locator('[data-el="devoir"]').first().click();
  await expect(page.locator('#app')).toHaveAttribute('data-view', 'deck', { timeout: 10000 });
  await page.getByRole('button', { name: 'Retour' }).first().click();
  await expect(page.locator('#app')).toHaveAttribute('data-view', 'classe');
  await page.getByRole('button', { name: 'Retour' }).first().click();
  await expect(page.locator('#app')).toHaveAttribute('data-view', 'classes');
});
