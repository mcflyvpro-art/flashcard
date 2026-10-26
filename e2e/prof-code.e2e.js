// L'espace professeur au modèle « un seul code » (2026-10-26) : dans un
// établissement, on choisit ses classes et on forme des groupes ; seul, on a
// son code, que les élèves tapent avant de choisir leur cours.
import { test, expect } from '@playwright/test';
import { brancher, nouveauStore } from './faux-supabase.js';
import { semerCompte } from './faux-cercle.js';
import { modele } from './faux-classes.js';
import { etab, semerEtablissement } from './faux-etablissement.js';

const enClair = c => c.slice(0, 4) + '-' + c.slice(4);

async function entrer(page, email) {
  await page.goto('./');
  await expect(page.locator('#boot')).toHaveCount(0, { timeout: 10000 });
  await expect(page.getByRole('textbox', { name: 'Adresse e-mail' })).toBeFocused();
  await page.getByRole('textbox', { name: 'Adresse e-mail' }).fill(email);
  await page.getByRole('textbox', { name: 'Mot de passe' }).fill('motdepasse-solide-42');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.locator('#app')).toHaveAttribute('data-view', 'prof', { timeout: 10000 });
}

function compte(store, email, role, nom, org) {
  const m = modele(store), id = semerCompte(store, email);
  m.roles[id] = role; m.noms[id] = nom;
  if (org) etab(store).membres[id] = org.id;
  store.tables.prefs = [...(store.tables.prefs || []), { id, user_id: id, data: { tuto: 1 } }];
  return id;
}

test.describe('sur ordinateur', () => {
  test.use({ viewport: { width: 1360, height: 900 } });

  test('un professeur d’établissement : ses classes, un groupe, le code à projeter', async ({ page }) => {
    const store = nouveauStore();
    const { org, classes } = semerEtablissement(store, { nom: 'Lycée Camus', classes: ['2nde A', '1re B'] });
    const m = modele(store);
    const prof = compte(store, 'durand@lycee.fr', 'prof', 'Marc DURAND', org);
    const lea = compte(store, 'lea@lycee.fr', 'eleve', 'Léa MARTIN', org);
    const tom = compte(store, 'tom@lycee.fr', 'eleve', 'Tom PETIT', org);
    m.membres.push({ cid: classes[0], uid: lea, depuis: new Date().toISOString() },
      { cid: classes[1], uid: tom, depuis: new Date().toISOString() });
    await brancher(page, store);
    await entrer(page, 'durand@lycee.fr');

    // pas encore de classe : les choisir dans l'établissement
    await page.locator('[data-pf="choisir"]').first().click();
    await page.locator('#pfmat').fill('Mathématiques');
    await page.locator('.pf-li', { hasText: '2nde A' }).locator('[data-pf="enseigner"]').click();
    await expect(page.locator('.pf-li', { hasText: '2nde A' })).toContainText('J’y enseigne');
    expect(store.et.services.some(s => s.cid === classes[0] && s.prof === prof && s.matiere === 'Mathématiques')).toBe(true);
    await page.getByRole('button', { name: 'Terminé' }).click();
    await expect(page.locator('.pf-kc', { hasText: '2nde A' })).toBeVisible();
    await expect(page.locator('.pf-codeband .pf-cb-c')).toHaveText(enClair(org.codes.eleve));

    // un groupe : chercher, cocher des élèves de classes différentes
    await page.locator('.pf-ha [data-pf="groupe"]').click();
    await page.locator('#pfgnom').fill('Spé maths');
    await page.locator('[data-pfin="f.gq"]').fill('mart');
    await expect(page.locator('.pf-gl')).toHaveCount(1);
    await page.locator('.pf-gl', { hasText: 'Léa MARTIN' }).click();
    await page.locator('[data-pfin="f.gq"]').fill('');
    await expect(page.locator('.pf-gl')).toHaveCount(2);
    await page.locator('.pf-gl', { hasText: 'Tom PETIT' }).click();
    await expect(page.locator('#pfgo')).toHaveText('Créer le groupe (2)');
    await page.locator('#pfgo').click();
    await expect(page.locator('#app')).toHaveAttribute('data-view', 'profclasse');
    await expect(page.locator('.pf-ch h1')).toHaveText('Spé maths');
    const g = store.cl.classes.find(c => c.name === 'Spé maths');
    expect(g.genre).toBe('groupe');
    expect(store.cl.membres.filter(x => x.cid === g.id).map(x => x.uid).sort()).toEqual([lea, tom].sort());

    // le groupe se recompose
    await page.locator('.pf-cha [data-pf="groupe-modifier"]').click();
    await page.locator('.pf-gl', { hasText: 'Tom PETIT' }).click();
    await page.locator('#pfgo').click();
    await expect.poll(() => store.cl.membres.filter(x => x.cid === g.id).length).toBe(1);

    // une classe de l'établissement : le code élèves, prêt à projeter
    await page.locator('.pf-nav [data-pf="classe"]', { hasText: '2nde A' }).click();
    await page.locator('.pf-cha [data-pf="inviter"]').click();
    await expect(page.locator('.pf-inv .pf-gros')).toHaveText(enClair(org.codes.eleve));
    await expect(page.locator('.pf-etapes')).toContainText('Choisir « 2nde A »');
    await expect(page.locator('.pf-inv-qr svg')).toBeVisible();
    expect(await page.evaluate(() => document.body.scrollWidth)).toBeLessThanOrEqual(1360);
  });
});

test('un professeur particulier : son code, changé, puis sa première classe', async ({ page }) => {
  const store = nouveauStore();
  const tuteur = compte(store, 'tuteur@exemple.fr', 'prof', 'Paul Tuteur');
  await brancher(page, store);
  await entrer(page, 'tuteur@exemple.fr');

  await expect(page.locator('.pf-codeband .pf-cb-c')).toBeVisible();
  const avant = etab(store).codesProfs[tuteur];
  await expect(page.locator('.pf-codeband .pf-cb-c')).toHaveText(enClair(avant));
  const changer = page.locator('.pf-codeband [data-pf="code-changer"]');
  await changer.click();
  await changer.click();
  await expect.poll(() => etab(store).codesProfs[tuteur]).not.toBe(avant);
  await expect(page.locator('.pf-codeband .pf-cb-c')).toHaveText(enClair(etab(store).codesProfs[tuteur]));

  await page.locator('[data-pf="creer"]:visible').first().click();
  await page.locator('#pfnom').fill('Maths Tle');
  await page.locator('[data-pf="creer-go"]').click();
  await expect(page.locator('.pf-etapes')).toContainText('Choisir « Maths Tle »');
  await expect(page.locator('.pf-inv .pf-gros')).toHaveText(enClair(etab(store).codesProfs[tuteur]));
  expect(store.cl.classes.find(c => c.name === 'Maths Tle').genre).toBe('classe');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
