// Le profil d'un lecteur (2026-10-25) : toucher un ami, une ligne de
// classement ou un membre de club ouvre son profil. Ses chiffres pour un ami
// ou un membre d'un même club, son nom seulement pour une demande en attente.
// Qui voit quoi se prouve en base (supabase/tests/profil.sql).
import { test, expect } from '@playwright/test';
import { brancher, nouveauStore } from './faux-supabase.js';
import { semerAmis, semerClub, semerCompte, semerLectures, semerPseudo } from './faux-cercle.js';
import { inscrire } from './aide.js';

const versCercle = page => page.getByRole('button', { name: /^Mes amis(,.*)?$/ }).first().click();

test('le profil d’un ami, d’une demande en attente, d’un membre de club', async ({ page }) => {
  const store = nouveauStore();
  await brancher(page, store);
  await inscrire(page);
  for (const [e, h, n] of [['tom@exemple.fr', 'tom', 'Tom Bernard'], ['ines@exemple.fr', 'ines', 'Inès Roux'],
    ['ava@exemple.fr', 'ava', 'Ava Petit']]) { semerCompte(store, e); semerPseudo(store, e, h, n); }
  semerPseudo(store, 'lea@exemple.fr', 'lea', 'Léa Martin');
  semerAmis(store, 'lea@exemple.fr', 'tom@exemple.fr');
  semerAmis(store, 'ines@exemple.fr', 'lea@exemple.fr', 'pending');
  semerClub(store, 'lea@exemple.fr', 'Les Lecteurs', ['ava@exemple.fr']);
  semerLectures(store, 'tom@exemple.fr', 12, 9);
  semerLectures(store, 'ava@exemple.fr', 5);
  semerLectures(store, 'lea@exemple.fr', 3);           // un classement d'amis demande deux lecteurs

  // un ami : le profil complet
  await versCercle(page);
  await page.locator('.cc-ami', { hasText: 'Tom' }).click();
  const tete = page.locator('.lp-tete');
  for (const t of ['Tom Bernard', '@tom', 'Ami']) await expect(tete).toContainText(t);
  const tuiles = page.locator('.lp-tuile');
  await expect(tuiles.filter({ hasText: '7 jours' })).toContainText('12');
  await expect(tuiles.filter({ hasText: 'Justes' })).toContainText('75 %');
  await expect(page.locator('.lp-cal i:not(.vide)')).toHaveCount(35);
  await expect(page.getByRole('button', { name: 'Lui envoyer un paquet' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole('button', { name: 'Retour' }).first().click();
  await expect(page.locator('.cc-moi')).toBeVisible();

  // une ligne du classement mène au même profil
  await page.locator('.cc-rk', { hasText: 'Tom' }).click();
  await expect(page.locator('.lp-tete')).toContainText('Tom Bernard');
  await page.getByRole('button', { name: 'Retour' }).first().click();

  // une demande en attente : le nom, pas les chiffres
  await page.locator('[data-act="friends"]').first().click();
  await page.locator('.cc-qui', { hasText: 'Inès' }).click();
  await expect(page.locator('.lp-tete')).toContainText('Inès Roux');
  await expect(page.locator('.lp-prive')).toContainText('Statistiques réservées à ses amis');
  await expect(page.locator('.lp-tuile')).toHaveCount(0);
  await page.getByRole('button', { name: 'Retour' }).first().click();

  // un membre du club : ses chiffres, et le club en commun
  await page.getByRole('button', { name: 'Retour' }).first().click();      // la page Amis ramène au cercle
  await page.locator('.cc-club', { hasText: 'Les Lecteurs' }).click();
  await page.getByRole('tab', { name: 'Membres' }).click();          // au téléphone, un onglet par partie du club
  await page.locator('[data-cc="membre"]', { hasText: 'Ava' }).click();
  await expect(page.locator('.lp-tete')).toContainText('Les Lecteurs');
  await expect(page.locator('.lp-tuile').filter({ hasText: '7 jours' })).toContainText('5');
  await expect(page.getByRole('button', { name: 'Retirer du club' })).toBeVisible();     // Léa est la cheffe
  await page.getByRole('button', { name: 'Retour' }).first().click();
  await expect(page.getByRole('tab', { name: 'Membres' })).toBeVisible();      // revenu sur la page du club
});

// Un ami accepté pendant que l'app est ouverte (2026-11-07, trouvé par la
// CI) : le préchargement de l'arrivée a déjà lu la liste, vide ; rouvrir
// « Mes amis » doit la relire. Avant, Tom n'apparaissait qu'au redémarrage
// — rouge sur l'ancien code, quelle que soit la vitesse de la machine.
test('un ami accepté pendant que l’app est ouverte paraît dès qu’on ouvre « Mes amis »', async ({ page }) => {
  const store = nouveauStore();
  await brancher(page, store);
  const prechargee = page.waitForRequest(r => r.url().includes('/rpc/my_friends'), { timeout: 15000 });
  await inscrire(page);
  await prechargee;
  await page.waitForTimeout(300);
  semerCompte(store, 'tom@exemple.fr'); semerPseudo(store, 'tom@exemple.fr', 'tom', 'Tom Bernard');
  semerPseudo(store, 'lea@exemple.fr', 'lea', 'Léa Martin');
  semerAmis(store, 'lea@exemple.fr', 'tom@exemple.fr');
  await versCercle(page);
  await expect(page.locator('.cc-ami', { hasText: 'Tom' })).toBeVisible({ timeout: 10000 });
});

// Le liseré du jeton dit l'offre de CHACUN (2026-11-08, demandé : « ceux +
// en arc-en-ciel, Infini en or, les autres rien »). Avant, un abonné Infini
// voyait en or tous ses amis Mirandola+ : leur liseré lisait sa lumière à lui.
test('le liseré : Mirandola+ en arc-en-ciel, Infini en or, rien sinon — jamais l’offre de qui regarde', async ({ page }) => {
  const store = { ...nouveauStore(), parDefaut: 'gratuit' };
  await brancher(page, store);
  await inscrire(page);
  for (const [e, h] of [['tom@exemple.fr', 'tom'], ['ines@exemple.fr', 'ines'], ['ava@exemple.fr', 'ava']]) {
    semerCompte(store, e); semerPseudo(store, e, h, h); semerAmis(store, 'lea@exemple.fr', e);
  }
  const uid = e => store.users.find(u => u.email === e).id;
  const offert = (e, formule) => (store.tables.abonnements = store.tables.abonnements || [])
    .push({ user_id: uid(e), offre: 'plus', statut: 'actif', source: 'offert', formule, fin_periode: null, fin_prevue: false });
  offert('lea@exemple.fr', 'infini_annuel');           // qui regarde : Infini
  offert('tom@exemple.fr', null);                      // Mirandola+
  offert('ines@exemple.fr', 'infini_annuel');          // Infini
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/offre-infini/, { timeout: 10000 });
  await versCercle(page);
  const jeton = nom => page.locator('.cc-ami', { hasText: nom }).locator('.jt').first();
  await expect(jeton('tom')).toHaveClass(/jt-plus/, { timeout: 10000 });
  await expect(jeton('tom')).not.toHaveClass(/jt-infini/);
  await expect(jeton('ines')).toHaveClass(/jt-infini/);
  await expect(jeton('ava')).not.toHaveClass(/jt-(plus|infini)/);
  await expect(page.locator('.cc-moi .jt').first()).toHaveClass(/jt-infini/);
  // l'arc-en-ciel de Tom ne prend pas l'or de Léa
  const fond = await jeton('tom').evaluate(e => getComputedStyle(e).backgroundImage);
  expect(fond).toContain('conic-gradient');
  expect(fond).not.toMatch(/rgb\(212, 162, 60\)/);
});
