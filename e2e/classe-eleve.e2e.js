// La page d'une classe, côté élève (2026-10-25) : toucher sa classe dans
// « Ma classe » ouvre une page — nom, professeur et matière, élèves, devoirs
// de cette classe — au lieu d'une petite fiche ; un camarade y ouvre son
// profil. Qui voit quoi se prouve en base (supabase/tests/classe_eleve.sql).
import { test, expect } from '@playwright/test';
import { brancher, nouveauStore } from './faux-supabase.js';
import { semerAmis, semerCompte, semerPseudo } from './faux-cercle.js';
import { faireEleve, faireProfesseur, rpcClasses } from './faux-classes.js';
import { semerEtablissement } from './faux-etablissement.js';
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

// Un particulier n'a pas d'onglet « Classe » (docs/PARCOURS.md). Le jour où
// son lycée lui donne un code : Réglages → « J'ai un code », son nom, sa
// classe dans la liste — il est dedans, sans que personne ait à valider.
async function entrerCode(page, code) {
  await page.getByRole('button', { name: 'Réglages' }).first().click();
  await page.getByRole('button', { name: /J’ai un code/ }).click();
  await page.locator('#cecode').fill(code);
  await page.locator('#ceok').click();
}

function particulier(store) {
  const lea = semerCompte(store, 'lea@exemple.fr');
  faireEleve(store, 'lea@exemple.fr');
  // la visite guidée déjà faite : elle s'invite sinon chez un compte « eleve »
  store.tables.prefs = [{ id: lea, user_id: lea, data: { tuto: 1 } }];
  return lea;
}

test('un particulier : pas de « Classe » ; le code de son lycée, son nom, sa classe — il est dedans', async ({ page }) => {
  const store = nouveauStore();
  const lea = particulier(store);
  const { org, classes } = semerEtablissement(store, { nom: 'Lycée Camus', classes: ['2nde A', '1re B'] });

  await brancher(page, store);
  await connecter(page);
  await expect(page.locator('.tabs button')).toHaveCount(2, { timeout: 10000 });   // Livres, Cercle

  await entrerCode(page, org.codes.eleve.slice(0, 4).toLowerCase() + '-' + org.codes.eleve.slice(4));
  await expect(page.locator('.ce-f .mhx b')).toHaveText('Lycée Camus');
  await expect(page.locator('#cego')).toBeDisabled();
  await page.getByLabel('Prénom').fill('léa');
  await page.getByLabel('Nom', { exact: true }).fill('martin');
  await expect(page.locator('#cenom')).toContainText('Léa MARTIN');
  await expect(page.locator('#cego')).toBeDisabled();                           // il faut encore la classe
  await page.locator('.ce-cl', { hasText: '2nde A' }).click();
  await page.locator('#cego').click();

  await expect(page.locator('#app')).toHaveAttribute('data-view', 'classes');
  await expect(page.locator('.tabs button')).toHaveCount(3);
  expect(store.et.membres[lea]).toBe(org.id);
  expect(store.cl.membres.some(x => x.uid === lea && x.cid === classes[0])).toBe(true);
  expect(store.cl.noms[lea]).toBe('Léa MARTIN');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('un professeur particulier : son code, et son élève arrive dans « Mes élèves »', async ({ page }) => {
  const store = nouveauStore();
  const lea = particulier(store);
  const prof = semerCompte(store, 'prof@exemple.fr');
  faireProfesseur(store, 'prof@exemple.fr', 'M. Durand');
  const [, code] = rpcClasses(store, 'prof_mon_code', {}, { id: prof });

  await brancher(page, store);
  await connecter(page);
  await entrerCode(page, code);
  await expect(page.locator('.ce-f .mhx b')).toHaveText('M. Durand');
  await expect(page.locator('.ce-classes')).toHaveCount(0);                     // pas encore de classe : rien à choisir
  await page.getByLabel('Prénom').fill('Léa');
  await page.getByLabel('Nom', { exact: true }).fill('Martin');
  await page.locator('#cego').click();
  await expect(page.locator('#app')).toHaveAttribute('data-view', 'classes');
  await expect(page.locator('[data-el="classe"]', { hasText: 'Mes élèves' })).toBeVisible();
  expect(store.cl.membres.some(x => x.uid === lea)).toBe(true);
});
