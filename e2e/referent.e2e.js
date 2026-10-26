// La console du référent (2026-10-26) : faite pour l'ordinateur — les deux
// codes à donner, la licence, ce qui demande une décision, les classes, les
// élèves, les professeurs, le journal ; et, cachées derrière un lien
// discret, les cartes élève. Au téléphone, l'essentiel seulement.
import { test, expect } from '@playwright/test';
import { brancher, nouveauStore } from './faux-supabase.js';
import { semerCompte } from './faux-cercle.js';
import { modele } from './faux-classes.js';
import { etab, semerEtablissement } from './faux-etablissement.js';

/* Un lycée en démo : le référent, une élève dans sa classe, un élève qui
   n'en a pas encore, un professeur. */
function lycee(store) {
  const { org, classes } = semerEtablissement(store, { nom: 'Lycée Camus', ville: 'Nîmes', classes: ['2nde A', '1re B'] });
  const m = modele(store), et = etab(store);
  const membre = (email, role, nom) => {
    const id = semerCompte(store, email);
    m.roles[id] = role; m.noms[id] = nom; et.membres[id] = org.id;
    store.tables.prefs = [...(store.tables.prefs || []), { id, user_id: id, data: { tuto: 1 } }];
    return id;
  };
  const ref = membre('ref@lycee.fr', 'ref', 'Claire ROUX');
  const lea = membre('lea@lycee.fr', 'eleve', 'Léa MARTIN');
  const tom = membre('tom@lycee.fr', 'eleve', 'tom dupont');
  const prof = membre('durand@lycee.fr', 'prof', 'Marc DURAND');
  m.membres.push({ cid: classes[0], uid: lea, depuis: new Date().toISOString() });
  return { org, classes, ref, lea, tom, prof };
}

async function entrerReferent(page) {
  await page.goto('./');
  await expect(page.locator('#boot')).toHaveCount(0, { timeout: 10000 });
  await expect(page.getByRole('textbox', { name: 'Adresse e-mail' })).toBeFocused();
  await page.getByRole('textbox', { name: 'Adresse e-mail' }).fill('ref@lycee.fr');
  await page.getByRole('textbox', { name: 'Mot de passe' }).fill('motdepasse-solide-42');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.locator('#app')).toHaveAttribute('data-view', 'ref', { timeout: 10000 });
}

const enClair = c => c.slice(0, 4) + '-' + c.slice(4);

test.describe('sur ordinateur', () => {
  test.use({ viewport: { width: 1360, height: 900 } });

  test('les codes, la licence, un élève sans classe rangé et renommé', async ({ page }) => {
    const store = nouveauStore();
    const { org, classes, tom } = lycee(store);
    await brancher(page, store);
    await entrerReferent(page);

    await expect(page.locator('.top .hero')).toHaveText('Lycée Camus');
    await expect(page.locator('.rf-lic')).toContainText('Démo');
    await expect(page.locator('.rf-code-v').first()).toHaveText(enClair(org.codes.eleve));
    await expect(page.locator('.rf-code-v').nth(1)).toHaveText(enClair(org.codes.prof));

    // ce qui demande une décision mène droit à la liste filtrée
    await page.locator('[data-rf="aller"]', { hasText: 'sans classe' }).click();
    await expect(page.locator('#rail nav .on')).toContainText('Élèves');      // les pages du référent sont dans la barre
    await expect(page.locator('.rf-liste .rf-ligne')).toHaveCount(1);
    await page.locator('.rf-liste .rf-ligne', { hasText: 'tom dupont' }).click();

    await page.locator('.rf-detail .rf-deplacer').selectOption({ label: '1re B' });
    await expect(page.locator('.toast')).toContainText('Changé de classe');
    await expect.poll(() => store.cl.membres.some(x => x.uid === tom && x.cid === classes[1])).toBe(true);

    await page.locator('#rfnnom').fill('Tom DUPONT');
    await page.getByRole('button', { name: 'Corriger' }).click();
    await expect.poll(() => store.cl.noms[tom]).toBe('Tom DUPONT');
    await expect(page.locator('.rf-qui b')).toHaveText('Tom DUPONT');

    // le journal garde la trace de ce qu'on vient de faire
    await page.locator('#rail [data-r="ref:journal"]').click();
    await expect(page.locator('.rf-jl', { hasText: 'identité corrigée' })).toBeVisible();
    await expect(page.locator('.rf-jl', { hasText: 'élève déplacé' })).toBeVisible();
    expect(await page.evaluate(() => document.body.scrollWidth)).toBeLessThanOrEqual(1360);
  });

  test('une classe créée, son équipe, un code changé et projeté', async ({ page }) => {
    const store = nouveauStore();
    const { org, classes, prof } = lycee(store);
    await brancher(page, store);
    await entrerReferent(page);
    const ancien = org.codes.eleve;

    // changer un code demande deux appuis : l'ancien cesse de marcher
    const changer = page.locator('[data-rf="changer"][data-id="eleve"]');
    await changer.click();
    await expect(changer).toContainText('Sûr ?');
    await changer.click();
    await expect.poll(() => org.codes.eleve).not.toBe(ancien);
    await expect(page.locator('.rf-code-v').first()).toHaveText(enClair(org.codes.eleve));

    await page.locator('[data-rf="projeter"][data-id="eleve"]').click();
    await expect(page.locator('.rf-projo-c')).toHaveText(enClair(org.codes.eleve));
    await expect(page.locator('.rf-projo .rf-qr svg')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.rf-projo')).toHaveCount(0);

    await page.locator('#rail [data-r="ref:classes"]').click();
    await page.locator('#rfcnom').fill('2nde C');
    await page.locator('#rfcniv').selectOption('2nde');
    await page.getByRole('button', { name: 'Créer' }).click();
    await expect(page.locator('.rf-liste .rf-ligne', { hasText: '2nde C' })).toBeVisible();
    expect(store.cl.classes.find(c => c.name === '2nde C').cycle).toBe('lycee_gt');

    await page.locator('.rf-liste .rf-ligne', { hasText: '2nde A' }).click();
    await expect(page.locator('.rf-fiche')).toContainText('Léa MARTIN');
    await page.locator('#rfsprof').selectOption({ label: 'Marc DURAND' });
    await page.locator('#rfsmat').fill('Mathématiques');
    await page.getByRole('button', { name: 'Ajouter' }).click();
    await expect(page.locator('.rf-fiche .rf-ligne', { hasText: 'Marc DURAND' })).toContainText('Mathématiques');
    await page.locator('[data-rf="pp"]').click();
    await expect(page.locator('.rf-fiche .rf-pp')).toBeVisible();
    expect(store.et.services.find(s => s.cid === classes[0] && s.prof === prof).pp).toBe(true);

    // une classe vide se supprime ; une classe qui a des élèves, non
    await page.locator('.rf-liste .rf-ligne', { hasText: '2nde C' }).click();
    await page.locator('[data-rf="supprimer-classe"]').click();
    await expect(page.locator('.rf-liste .rf-ligne', { hasText: '2nde C' })).toHaveCount(0);
    await page.locator('.rf-liste .rf-ligne', { hasText: '2nde A' }).click();
    await expect(page.locator('[data-rf="supprimer-classe"]')).toHaveCount(0);
  });

  test('les cartes élève : cachées, expliquées, imprimables', async ({ page }) => {
    const store = nouveauStore();
    const { org, classes } = lycee(store);
    await brancher(page, store);
    await entrerReferent(page);

    await page.getByRole('button', { name: 'Des élèves sans adresse e-mail ?' }).click();
    await expect(page.locator('.rf-cartes')).toContainText('code secret');
    await page.locator('#rfkcls').selectOption({ label: '1re B' });
    await page.locator('#rfkliste').fill('MOREAU Inès\nPETIT Hugo');
    await page.getByRole('button', { name: 'Créer les comptes' }).click();
    await expect(page.locator('.rf-cartes h2')).toHaveText('2 comptes créés');
    await expect(page.locator('.rf-carte')).toHaveCount(2);
    await expect(page.locator('.rf-carte .rf-qr svg')).toHaveCount(2);
    const ines = store.users.find(u => u.email.startsWith('ines.moreau@'));
    expect(store.cl.membres.some(x => x.uid === ines.id && x.cid === classes[1])).toBe(true);
    expect(store.et.membres[ines.id]).toBe(org.id);

    await page.getByRole('button', { name: 'Terminé' }).click();
    await expect(page.locator('.rf-code')).toHaveCount(2);
  });
});

test('au téléphone : les deux codes et la licence, le reste sur ordinateur', async ({ page }) => {
  const store = nouveauStore();
  const { org } = lycee(store);
  await brancher(page, store);
  await entrerReferent(page);
  await expect(page.locator('.rf-tel .rf-code-v').first()).toHaveText(enClair(org.codes.eleve));
  await expect(page.locator('.rf-tel .rf-licence')).toContainText('Démo');
  await expect(page.locator('#rail [data-r="ref:classes"]')).toBeHidden();      // au téléphone : les codes, la licence
  await expect(page.locator('.rf-tel')).toContainText('sur ordinateur');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
