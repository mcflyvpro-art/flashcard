// Le cercle refait (2026-10-24/25) : un club qu'on crée et qu'un ami rejoint
// par son code, une partie en direct à trois (un hôte, deux joueurs, chacun
// sur son téléphone), et le jeton qu'on se choisit, vu tel quel par un ami.
// Deux contextes = deux personnes ; le faux Supabase rejoue les fonctions
// (e2e/faux-cercle.js), la sécurité se prouve en base (supabase/tests/).
import { test, expect } from '@playwright/test';
import { brancher, nouveauStore, semerLivre } from './faux-supabase.js';
import { semerAmis, semerCompte, semerLectures, semerPseudo } from './faux-cercle.js';
import { connecter, inscrire } from './aide.js';

const CAPITALES = [['France', 'Paris'], ['Italie', 'Rome'], ['Espagne', 'Madrid'], ['Portugal', 'Lisbonne'],
  ['Allemagne', 'Berlin'], ['Autriche', 'Vienne'], ['Belgique', 'Bruxelles'], ['Suède', 'Stockholm']];

async function telephone(browser, store) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await brancher(page, store);
  return page;
}

const versCercle = page => page.getByRole('button', { name: /^(Le )?[Cc]ercle( des lecteurs)?$/ }).first().click();

test('un club : on le crée, on le personnalise, un ami entre avec son code', async ({ page, browser }) => {
  const store = nouveauStore();
  await brancher(page, store);
  await inscrire(page);
  semerCompte(store, 'tom@exemple.fr');
  semerPseudo(store, 'lea@exemple.fr', 'lea', 'Léa Martin');
  semerPseudo(store, 'tom@exemple.fr', 'tom', 'Tom Bernard');

  await versCercle(page);
  await page.getByRole('button', { name: 'Créer un club' }).first().click();
  await expect(page.getByRole('button', { name: 'Créer le club' })).toBeDisabled();
  await page.getByRole('textbox', { name: 'Nom du club' }).fill('Les Hiboux');
  await page.getByRole('textbox', { name: 'Devise' }).fill('On lit la nuit');
  await page.locator('[data-cc="emb"][data-id="chouette"]').click();
  await page.locator('[data-cc="teinte"][data-id="4"]').click();
  await page.getByRole('button', { name: 'Créer le club' }).click();

  // la page du club : son nom, sa devise, son chef
  await expect(page.locator('.cl-ban')).toContainText('Les Hiboux');
  await expect(page.locator('.cl-ban')).toContainText('On lit la nuit');
  const club = store.tables.groups.find(g => g.name === 'Les Hiboux');
  expect(club).toMatchObject({ embleme: 'chouette', teinte: 4 });

  // personnaliser : le chef change la devise
  await page.getByRole('button', { name: 'Personnaliser' }).click();
  await page.getByRole('textbox', { name: 'Devise' }).fill('Une page par jour');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.locator('.cl-ban')).toContainText('Une page par jour');

  // un ami entre avec le code, tapé en minuscules et sans tiret
  const tom = await telephone(browser, store);
  await connecter(tom, 'tom@exemple.fr').catch(() => {});      // pas de livre : l'accueil est vide, la session est ouverte
  await versCercle(tom);
  await tom.getByRole('button', { name: 'J’ai un code' }).click();
  await tom.getByRole('textbox', { name: 'Code du club' }).fill(club.code.toLowerCase());
  await tom.getByRole('button', { name: 'Rejoindre' }).click();
  await expect(tom.locator('.cl-ban')).toContainText('Les Hiboux');
  await expect(tom.getByRole('button', { name: 'Personnaliser' })).toHaveCount(0);   // pas chef : pas de pinceau
  expect(store.tables.group_members.filter(m => m.group_id === club.id)).toHaveLength(2);
});

test('défi en direct : un hôte, deux joueurs, un code, un podium', async ({ page, browser }) => {
  test.setTimeout(90000);
  const store = nouveauStore();
  store.lectureMs = 200;                        // 3 s de lecture en vrai
  await brancher(page, store);
  await inscrire(page);
  for (const n of ['tom', 'ines']) semerCompte(store, n + '@exemple.fr');
  semerPseudo(store, 'lea@exemple.fr', 'lea');
  semerPseudo(store, 'tom@exemple.fr', 'tom');
  semerPseudo(store, 'ines@exemple.fr', 'ines');
  semerLivre(store, 'lea@exemple.fr', 'Capitales', CAPITALES);
  await page.reload();
  await expect(page.locator('#boot')).toHaveCount(0, { timeout: 10000 });

  // l'hôte : une salle ouverte, un livre, 5 questions
  await versCercle(page);
  await page.getByRole('button', { name: 'Lancer un défi' }).click();
  await page.getByRole('button', { name: 'Salle ouverte' }).click();
  await page.locator('[data-cc="dn-livre"]', { hasText: 'Capitales' }).click();
  await page.locator('[data-cc="dn-n"][data-id="5"]').click();
  await page.getByRole('button', { name: 'Ouvrir la salle' }).click();
  await expect(page.locator('.dx-pin')).toHaveText(/^\d{3} \d{3}$/, { timeout: 10000 });
  const pin = (await page.locator('.dx-pin').textContent()).replace(/\D/g, '');
  await expect(page.locator('[data-dx="avancer"]')).toBeDisabled();       // personne encore

  // deux joueurs entrent par le code (six chiffres : on entre sans bouton)
  const joueurs = [];
  for (const n of ['tom', 'ines']) {
    const p = await telephone(browser, store);
    await connecter(p, n + '@exemple.fr').catch(() => {});
    await versCercle(p);
    await p.getByRole('button', { name: 'Entrer un code' }).click();
    await p.getByRole('textbox', { name: 'Code de la partie' }).fill(pin);
    await expect(p.locator('.dx-moi')).toHaveText(n, { timeout: 10000 });
    joueurs.push(p);
  }
  await expect(page.locator('.dx-n b')).toHaveText('2', { timeout: 10000 });

  // cinq questions : tom répond toujours la première case, ines la deuxième
  await page.locator('[data-dx="avancer"]').click();
  for (let q = 0; q < 5; q++) {
    for (const [k, p] of joueurs.entries()) {
      await expect(p.locator('[data-dx="choix"]').first()).toBeVisible({ timeout: 10000 });
      await p.locator('[data-dx="choix"]').nth(k).click();
    }
    // tout le monde a répondu : la correction tombe sans attendre la fin du chrono
    await expect(page.locator('.dx-bilan')).toContainText('/2', { timeout: 10000 });
    await page.locator('[data-dx="avancer"]').click();
  }

  // le podium, chez l'hôte et chez chaque joueur
  await expect(page.locator('.dx-podium')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('.dx-podium')).toContainText('tom');
  await expect(page.locator('.dx-podium')).toContainText('ines');
  for (const p of joueurs) await expect(p.locator('.dx-bravo')).toBeVisible({ timeout: 10000 });
  const scores = store.ce.joueurs.map(j => j.score);
  expect(scores.reduce((a, b) => a + b, 0)).toBeGreaterThan(0);    // des bonnes réponses ont rapporté des points
  expect(store.ce.reponses).toHaveLength(10);                      // 5 questions × 2 joueurs, une réponse chacun
});

test('mon jeton : un avatar et une couleur, le même visage chez un ami', async ({ page, browser }) => {
  const store = nouveauStore();
  await brancher(page, store);
  await inscrire(page);
  semerCompte(store, 'tom@exemple.fr');
  semerPseudo(store, 'lea@exemple.fr', 'lea', 'Léa Martin');
  semerPseudo(store, 'tom@exemple.fr', 'tom', 'Tom Bernard');
  semerAmis(store, 'lea@exemple.fr', 'tom@exemple.fr');
  semerLectures(store, 'lea@exemple.fr', 12);
  semerLectures(store, 'tom@exemple.fr', 20);

  await versCercle(page);
  await expect(page.locator('.cc-moi .jt')).toHaveText('L');          // par défaut : ses initiales
  await page.locator('.cc-moi').click();
  // un avatar composé trait par trait (2026-10-25 : plus d'émoji) : une coiffure bouclée, puis le fond
  await page.locator('[data-cc="av-trait"][data-id="coiffure"]').click();
  await page.locator('[data-cc="av"][data-id="coiffure:3"]').click();
  await page.locator('[data-cc="av-trait"][data-id="fond"]').click();
  await page.locator('[data-cc="couleur"][data-id="3"]').click();
  await expect(page.locator('.jt-apercu .jt svg.visage')).toBeVisible();
  await expect(page.locator('.cc-moi .jt svg.visage')).toBeVisible();     // sur la page derrière, sans la redessiner
  await page.keyboard.press('Escape');
  await expect.poll(() => ((store.jetons || {})['p:' + store.users[0].id] || {}).teinte).toBe(3);
  const cle = store.jetons['p:' + store.users[0].id].cle;
  expect(cle).toMatch(/^av[a-z]{7,14}$/);                                // quatorze traits depuis le 2026-10-29 (src/avatar.js)
  expect(cle[3]).toBe('d');                                          // la coiffure n° 3 : bouclée

  // chez Tom : la même figure, la même couleur, dans le classement et les amis
  const tom = await telephone(browser, store);
  await connecter(tom, 'tom@exemple.fr').catch(() => {});
  await versCercle(tom);
  const chezTom = tom.locator(`.cc-rank [data-jt="p:${store.users[0].id}"]`);
  await expect(chezTom.locator('svg.visage')).toBeVisible({ timeout: 10000 });
  await expect(chezTom).toHaveAttribute('style', /#A8483C/);
});
