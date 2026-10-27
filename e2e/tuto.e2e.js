// Le tuto de première connexion (2026-10-27, ui/tuto.js, scénarios de
// src/tuto.js) : un guide court qui fait faire, sur le vrai écran. Un
// particulier finit son accueil et le tuto lui fait créer son premier livre,
// le lire et noter une page, puis montre le cercle et finit sur Folio+ ; un
// élève entré par un code (depuis l'accueil même) a l'accueil de sa classe,
// puis son tuto, qui se passe et se rejoue des Réglages ; un professeur et
// un référent ont le leur, sans accueil ; l'éditeur rien. Dans la démo sans
// compte, le tuto part à la première entrée, pas aux changements de rôle, et
// le bandeau le rejoue.
import { test, expect } from '@playwright/test';
import { brancher, nouveauStore } from './faux-supabase.js';
import { semerCompte } from './faux-cercle.js';
import { faireEleve, faireProfesseur, modele } from './faux-classes.js';
import { etab, semerEtablissement } from './faux-etablissement.js';
import { passerTuto } from './aide.js';

async function entrer(page, email) {
  await page.goto('./app');
  await expect(page.locator('#boot')).toHaveCount(0, { timeout: 10000 });
  await page.getByRole('textbox', { name: 'Adresse e-mail' }).fill(email);
  await page.getByRole('textbox', { name: 'Mot de passe' }).fill('motdepasse-solide-42');
  await page.getByRole('button', { name: 'Se connecter' }).click();
}

const bulle = page => page.locator('#tu .tu-bulle.vue');
const etape = (page, titre) => expect(bulle(page).locator('.tu-t')).toHaveText(titre, { timeout: 10000 });
const prefsDe = (store, id) => ((store.tables.prefs || []).find(r => r.user_id === id) || {}).data || {};

/* Toucher ce que montre l'anneau : le geste passe par le trou, comme un
   doigt. L'anneau glisse d'une cible à l'autre (0,45 s) : on attend qu'il
   se pose, sinon on viserait l'endroit où il passait. */
async function toucherLaCible(page) {
  await expect(page.locator('#tu')).toHaveAttribute('data-mode', 'geste');
  const anneau = page.locator('#tu .tu-anneau');
  let avant = null, b = await anneau.boundingBox();
  for (let n = 0; n < 20 && JSON.stringify(b) !== JSON.stringify(avant); n++) {
    avant = b; await page.waitForTimeout(120); b = await anneau.boundingBox();
  }
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
}

test('un particulier : son accueil, puis son premier livre, une page lue et notée, le cercle, Folio+', async ({ page }) => {
  test.setTimeout(90000);
  const store = nouveauStore();
  const lea = semerCompte(store, 'lea@exemple.fr');
  faireEleve(store, 'lea@exemple.fr');
  await brancher(page, store);
  await entrer(page, 'lea@exemple.fr');

  await page.getByRole('button', { name: 'Je révise pour moi' }).click({ timeout: 10000 });
  await page.getByLabel('Prénom').fill('Léa');
  await expect(page.locator('#bvpv')).toContainText('Libre');
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByRole('button', { name: 'Lycée' }).click();
  await page.getByRole('button', { name: 'Anglais' }).click();
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByRole('button', { name: 'C’est parti' }).click();

  // la carte du début, puis les gestes
  await expect(page.locator('#tu .tu-debut h2')).toHaveText('Bienvenue, Léa', { timeout: 10000 });
  await expect.poll(() => prefsDe(store, lea).tuto).toBe(1);          // vu dès qu'il commence
  await page.locator('#tu .tu-go').click();

  await etape(page, 'Ton premier livre');
  // un appui hors du trou ne fait rien : le tuto le rappelle, l'écran ne bouge pas
  await page.mouse.click(30, 300);
  await expect(page.locator('#app')).toHaveAttribute('data-view', 'home');
  await toucherLaCible(page);

  await etape(page, 'Écris ta première page');
  await expect(page.locator('#app')).toHaveAttribute('data-view', 'import');
  await bulle(page).getByRole('button', { name: 'Remplir pour moi' }).click();
  await expect(page.locator('#cn')).toHaveText('3');
  await expect(page.locator('#nm')).toHaveValue('Verbes irréguliers');   // la matière choisie à l'accueil

  await etape(page, 'Crée-le');
  await toucherLaCible(page);
  await etape(page, 'Lis-le');
  await expect(page.locator('#app')).toHaveAttribute('data-view', 'deck');
  await toucherLaCible(page);

  await etape(page, 'Retourne la page');
  await toucherLaCible(page);
  await etape(page, 'Dis si tu savais');
  await page.getByRole('button', { name: /^Correct/ }).click();

  await etape(page, 'Continue');                                     // une lecture libre : la bulle seule, sans voile
  await expect(page.locator('#tu')).toHaveAttribute('data-mode', 'libre');
  await bulle(page).getByRole('button', { name: 'Passer à la suite' }).click();

  await etape(page, 'Le cercle');
  await toucherLaCible(page);
  await expect(page.locator('#app')).toHaveAttribute('data-view', 'commu', { timeout: 10000 });

  // la fin : Folio+, la page des tarifs dans un autre onglet
  const fin = page.locator('#tu .tu-fin.plus');
  await expect(fin).toBeVisible({ timeout: 10000 });
  const lien = fin.getByRole('link', { name: 'Découvrir Folio+' });
  await expect(lien).toHaveAttribute('href', /\?site#tarifs$/);
  await expect(lien).toHaveAttribute('target', '_blank');
  await fin.getByRole('button', { name: 'Terminer' }).click();
  await expect(page.locator('#tu')).toHaveCount(0);

  // tout est vrai : le livre, ses trois pages, la page lue au journal
  const livre = (store.tables.decks || []).find(d => d.user_id === lea && d.name === 'Verbes irréguliers');
  expect(livre).toBeTruthy();
  await expect.poll(() => (store.tables.reviews || []).filter(r => r.user_id === lea).length).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

  // il ne revient pas de lui-même
  await page.reload();
  await expect(page.locator('#boot')).toHaveCount(0, { timeout: 10000 });
  await page.waitForTimeout(1500);
  await expect(page.locator('#tu')).toHaveCount(0);
});

test('« J’ai un code » dès l’accueil : l’accueil de sa classe, son tuto, passé puis rejoué des Réglages', async ({ page }) => {
  test.setTimeout(90000);
  const store = nouveauStore();
  const { org } = semerEtablissement(store, { nom: 'Lycée Camus', classes: ['2nde A'] });
  const zoe = semerCompte(store, 'zoe@exemple.fr');
  faireEleve(store, 'zoe@exemple.fr');
  await brancher(page, store);
  await entrer(page, 'zoe@exemple.fr');

  // le code s'ouvre par-dessus l'accueil : refermé, on y est encore
  await page.getByRole('button', { name: 'J’ai un code' }).click({ timeout: 10000 });
  await page.locator('#cecode').fill(org.codes.eleve);
  await page.locator('[data-ce="lire"]').click();
  await expect(page.locator('.ce-f .mhx b')).toHaveText('Lycée Camus', { timeout: 10000 });
  await page.getByLabel('Prénom').fill('Zoé');
  await page.getByLabel('Nom', { exact: true }).fill('Bernard');
  await expect(page.locator('#cenom')).toContainText('Zoé BERNARD');
  await page.locator('.ce-cl', { hasText: '2nde A' }).click();
  await page.locator('#cego').click();

  // élève de sa classe : son lycée, son pseudo, son visage
  await expect(page.locator('.bv-ecole')).toHaveText('Lycée Camus · 2nde A', { timeout: 10000 });
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByRole('button', { name: 'C’est parti' }).click();

  // puis son tuto, côté classe ; « Passer » dit où le retrouver
  await expect(page.locator('#tu .tu-debut h2')).toHaveText('Bienvenue, Zoé', { timeout: 10000 });
  await passerTuto(page);
  await expect(page.locator('.toast')).toContainText('Le tuto t’attend dans les Réglages');
  await expect.poll(() => prefsDe(store, zoe).tuto).toBe(1);

  // il ne revient pas de lui-même ; les Réglages le rejouent
  await page.goto('./eleve/reglages');
  await expect(page.locator('#boot')).toHaveCount(0, { timeout: 10000 });
  await page.getByRole('button', { name: 'Revoir le tuto' }).click({ timeout: 10000 });
  await expect(page.locator('#tu .tu-debut h2')).toHaveText('Bienvenue, Zoé', { timeout: 10000 });
  await page.locator('#tu .tu-go').click();
  await etape(page, 'Ta classe');                                    // rejoué des Réglages : d'abord y aller
  await toucherLaCible(page);
  await etape(page, 'Tes devoirs');                                  // pas encore de devoir : là où ils arriveront
  await expect(page.locator('#app')).toHaveAttribute('data-view', 'classes');
});

test('un professeur particulier : son code, sa première classe, et c’est prêt', async ({ page }) => {
  test.setTimeout(90000);
  const store = nouveauStore();
  const marc = semerCompte(store, 'marc@exemple.fr');
  faireProfesseur(store, 'marc@exemple.fr', 'Marc DURAND');
  await brancher(page, store);
  await entrer(page, 'marc@exemple.fr');

  await expect(page.locator('#tu .tu-debut h2')).toHaveText('Bonjour, Marc', { timeout: 10000 });
  await expect(page.locator('#tu .tu-debut .tu-lien')).toHaveText('Passer');
  await page.locator('#tu .tu-go').click();
  await etape(page, 'Le code élèves');
  await expect(page.locator('#tu')).toHaveAttribute('data-mode', 'info');
  await bulle(page).getByRole('button', { name: 'Suivant' }).click();
  await etape(page, 'Votre classe');
  await toucherLaCible(page);
  await etape(page, 'Nommez-la');
  // la feuille reste à portée de main : on y tape, on y valide
  await expect(page.locator('#tu')).toHaveAttribute('data-mode', 'ouvert');
  const feuille = page.locator('.menu:not(.sort)');
  await feuille.getByLabel('Nom', { exact: true }).fill('2nde 4');
  await feuille.getByRole('button', { name: 'Créer la classe' }).click();
  await expect(page.locator('#tu .tu-fin.pret h2')).toHaveText('Tout est prêt', { timeout: 10000 });
  await page.locator('#tu .tu-fin').getByRole('button', { name: 'Commencer' }).click();
  await expect(page.locator('#tu')).toHaveCount(0);
  // la classe existe, et l'app continue comme sans tuto : la feuille pour ajouter ses élèves
  await expect(page.locator('#app')).toHaveAttribute('data-view', 'profclasse', { timeout: 10000 });
  await expect(page.locator('.menu:not(.sort)')).toContainText('2nde 4');
  expect(prefsDe(store, marc).tuto).toBe(1);
});

test.describe('sur ordinateur', () => {
  // un ordinateur, pas un téléphone en grand : une souris, sans écran tactile (« Cliquez », pas « Touchez »)
  test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

  test('un référent : ses codes, puis les onglets de sa console, et c’est prêt', async ({ page }) => {
    const store = nouveauStore();
    const { org } = semerEtablissement(store, { nom: 'Lycée Camus', classes: ['2nde A'] });
    const m = modele(store);
    const claire = semerCompte(store, 'ref@lycee.fr');
    m.roles[claire] = 'ref'; m.noms[claire] = 'Claire ROUX'; etab(store).membres[claire] = org.id;
    await brancher(page, store);
    await entrer(page, 'ref@lycee.fr');

    await expect(page.locator('#tu .tu-debut h2')).toHaveText('Bonjour, Claire', { timeout: 10000 });
    await page.locator('#tu .tu-go').click();
    await etape(page, 'Vos deux codes');
    await bulle(page).getByRole('button', { name: 'Suivant' }).click();
    for (const [titre, aide] of [['Les classes', 'Cliquez sur « Classes »'], ['Les élèves', 'Cliquez sur « Élèves »'],
      ['La licence', 'Cliquez sur « Licence »']]) {
      await etape(page, titre);
      await expect(bulle(page).locator('.tu-geste')).toHaveText(aide);     // à la souris, on clique
      await toucherLaCible(page);
    }
    await expect(page).toHaveURL(/\/referent\/licence/);
    await expect(page.locator('#tu .tu-fin.pret')).toBeVisible({ timeout: 10000 });
    await page.locator('#tu .tu-fin').getByRole('button', { name: 'Commencer' }).click();
    await expect(page.locator('#tu')).toHaveCount(0);
  });

  test('l’éditeur n’a pas de tuto', async ({ page }) => {
    const store = nouveauStore();
    const moi = semerCompte(store, 'admin@folio.fr');
    modele(store).roles[moi] = 'admin';
    await brancher(page, store);
    await entrer(page, 'admin@folio.fr');
    await expect(page.locator('#app')).toHaveAttribute('data-view', 'admin', { timeout: 10000 });
    await page.waitForTimeout(1500);
    await expect(page.locator('#tu')).toHaveCount(0);
    await page.goto('./admin/reglages');
    await expect(page.locator('#app')).toHaveAttribute('data-view', 'settings', { timeout: 10000 });
    await expect(page.getByRole('button', { name: 'Revoir le tuto' })).toHaveCount(0);
  });
});

test('la démo : le tuto à la première entrée, pas aux changements de rôle, et le bandeau le rejoue', async ({ page }) => {
  test.setTimeout(90000);
  await brancher(page, nouveauStore());
  await page.goto('./essayer');
  await expect(page.locator('#boot')).toHaveCount(0, { timeout: 10000 });
  await page.locator('.dm-role[data-v="eleve"]').click();
  await expect(page.locator('#tu .tu-debut h2')).toHaveText('Tu es Léa, en 2nde B', { timeout: 10000 });

  // le devoir de Léa, lu pour de vrai dans le lycée de la démo
  await page.locator('#tu .tu-go').click();
  await etape(page, 'Ton devoir');
  await toucherLaCible(page);
  await etape(page, 'Lis-le');
  await expect(page.locator('#app')).toHaveAttribute('data-view', 'deck');
  await bulle(page).getByRole('button', { name: 'Quitter le tuto' }).click();
  await expect(page.locator('#tu')).toHaveCount(0);
  await expect(page.locator('.toast')).toContainText('Revois le tuto depuis le bandeau');

  // un autre rôle : pas de tuto ; le bandeau le rejoue, pour ce rôle
  await page.locator('.dm-bandeau select').selectOption('prof');
  await expect(page.getByText(/^Bon(jour|soir), Marc$/)).toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(1200);
  await expect(page.locator('#tu')).toHaveCount(0);
  await page.locator('.dm-bandeau [data-dm="tuto"]').click();
  await expect(page.locator('#tu .tu-debut h2')).toHaveText('Vous êtes Marc, professeur', { timeout: 10000 });
  await page.locator('#tu .tu-go').click();
  await etape(page, 'Le code élèves');
  await page.keyboard.press('Escape');                                 // Échap le quitte aussi
  await expect(page.locator('#tu')).toHaveCount(0);

  // la fin d'un élève de la démo mène au compte, et quitter la démo l'oublie
  await page.locator('.dm-bandeau select').selectOption('eleve');
  await expect(page).toHaveURL(/\/demo\/eleve\/classe$/, { timeout: 10000 });
  await page.locator('.dm-bandeau [data-dm="quitter"]').click();
  await expect(page).toHaveURL(/\/$/, { timeout: 10000 });
  await page.goto('./essayer');
  await expect(page.locator('#boot')).toHaveCount(0, { timeout: 10000 });
  await page.locator('.dm-role[data-v="ref"]').click();
  await expect(page.locator('#tu .tu-debut h2')).toHaveText('Vous êtes Claire, référente', { timeout: 10000 });
});
