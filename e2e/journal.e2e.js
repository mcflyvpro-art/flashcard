// Le journal de lecture refait (2026-10-25) : quoi qu'on fasse d'un livre
// ensuite — changer sa matière, le supprimer —, ce qui a été lu reste où
// on l'a lu ; et un devoir arrive dans la matière de son professeur,
// créée chez l'élève s'il ne l'avait pas. La règle se prouve aussi en base
// (supabase/tests/journal.sql) et dans le noyau (test/journal.test.js).
import { test, expect } from '@playwright/test';
import { brancher, nouveauStore, semerLivre } from './faux-supabase.js';
import { semerCompte } from './faux-cercle.js';
import { faireProfesseur, rpcClasses } from './faux-classes.js';
import { connecter, inscrire } from './aide.js';

const J = 864e5;

async function ouvrirJournal(page) {
  await page.goto('./?go=stats');
  await expect(page.locator('#boot')).toHaveCount(0, { timeout: 10000 });
  await expect(page.locator('.jr-kpi')).toBeVisible({ timeout: 10000 });
}

test('changer la matière d’un livre puis le supprimer : son temps reste en Droit', async ({ page }) => {
  const store = nouveauStore();
  await brancher(page, store);
  await inscrire(page);
  const u = store.users[0];
  const livre = semerLivre(store, 'lea@exemple.fr', 'Contrats', [['offre', 'proposition ferme'], ['vice', 'défaut caché']]);
  store.tables.decks.find(d => d.id === livre).subject = 'droit';
  // trois heures de droit, il y a deux jours, telles que l'app les a écrites
  for (let k = 0; k < 36; k++) {
    store.tables.reviews.push({ id: 'r' + k, user_id: u.id, deck_id: livre, card_id: 'q' + (k % 2 + 1), mode: 'study',
      rating: 2, correct: true, ms: 300000, created_at: new Date(Date.now() - 2 * J + k * 1000).toISOString(),
      client_id: 'c' + k, subject: 'droit', subject_name: 'Droit', deck_name: 'Contrats', ecart: k < 2 ? -1 : 0 });
  }
  await ouvrirJournal(page);
  const droit = page.locator('.jr-mat', { hasText: 'Droit' });
  await expect(droit).toContainText('3 h');
  await expect(page.locator('[data-k="temps"] b')).toHaveText('3 h');
  // l'heure la plus chargée repose sur la ligne de base, comme les autres
  // (elle portait la classe « top » des barres de titre, et ses marges)
  const pic = await page.locator('.jr-h24 .jr-pic').boundingBox();
  const axe = await page.locator('.jr-h24').boundingBox();
  expect(Math.abs(pic.y + pic.height - (axe.y + axe.height))).toBeLessThan(1);

  // le livre passe en Anglais, puis part à la corbeille (sur un autre appareil) : le passé ne bouge pas
  store.tables.decks.find(d => d.id === livre).subject = 'anglais';
  await ouvrirJournal(page);
  await expect(page.locator('.jr-mat', { hasText: 'Droit' })).toContainText('3 h');
  await expect(page.locator('.jr-mat', { hasText: 'Anglais' })).toHaveCount(0);
  store.tables.decks.find(d => d.id === livre).deleted_at = new Date().toISOString();
  await ouvrirJournal(page);
  await expect(page.locator('.jr-mat', { hasText: 'Droit' })).toContainText('3 h');
  await expect(page.locator('.jr-livre.parti', { hasText: 'Contrats' })).toContainText('3 h');
  await expect(page.locator('[data-k="pages"] b')).toHaveText('36');
});

test('un devoir de Géographie arrive en Géographie, même si l’élève n’avait pas cette matière', async ({ page }) => {
  const store = nouveauStore();
  const lea = semerCompte(store, 'lea@exemple.fr');
  const prof = semerCompte(store, 'prof@exemple.fr');
  faireProfesseur(store, 'prof@exemple.fr', 'M. Durand');
  const [, cid] = rpcClasses(store, 'prof_creer_classe', { nom: '2nde B' }, { id: prof });
  store.cl.membres.push({ cid, uid: lea, depuis: new Date().toISOString() });
  store.cl.noms[lea] = 'Léa MARTIN';
  rpcClasses(store, 'prof_give', { cids: [cid], nom: 'Fleuves', matiere: 'Géographie', due: '2099-01-01',
    cartes: [['Seine', 'Paris'], ['Loire', 'Nantes']] }, { id: prof });
  semerLivre(store, 'lea@exemple.fr', 'Verbes', [['être', 'to be']]);
  await brancher(page, store);
  await connecter(page);
  await page.getByRole('button', { name: 'Classe', exact: true }).click();
  await page.locator('[data-el="devoir"]').first().click();
  await expect(page.locator('#app')).toHaveAttribute('data-view', 'deck', { timeout: 10000 });
  await expect.poll(() => (store.tables.subjects || []).filter(s => s.user_id === lea && s.name === 'Géographie').length,
    { timeout: 10000 }).toBe(1);
  const geo = store.tables.subjects.find(s => s.user_id === lea && s.name === 'Géographie');
  await expect.poll(() => (store.tables.decks.find(d => d.user_id === lea && d.name === 'Fleuves') || {}).subject,
    { timeout: 10000 }).toBe(geo.id);
});
