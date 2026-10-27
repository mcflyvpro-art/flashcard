// Folio+ (2026-10-27) : l'écran, le paiement et son retour, puis Folio sur
// tous les écrans. La fonction `paiement` est jouée par la base locale
// (src/base-locale/abonnements.js) : « payer » y écrit l'abonnement comme le
// ferait stripe-webhook et renvoie à l'adresse de retour de Stripe. Les
// vraies fonctions, face à un faux Stripe : tools/paiement/essai.js.
import { test, expect } from '@playwright/test';
import { brancher, nouveauStore } from './faux-supabase.js';
import { semerCompte } from './faux-cercle.js';
import { etab, semerEtablissement } from './faux-etablissement.js';
import { inscrire } from './aide.js';

const ecran = page => page.locator('#app[data-view="plus"]');

test('un compte gratuit passe à Folio+ : la formule, le paiement, le retour, puis Folio partout', async ({ page }) => {
  const store = nouveauStore();
  await brancher(page, store);
  await inscrire(page);
  await page.goto('./eleve/folio-plus');
  await expect(ecran(page)).toBeVisible({ timeout: 10000 });
  await expect(page.locator('.fp-ligne')).toContainText('Gratuit');
  await expect(page.getByRole('radio', { name: /Annuel/ })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('radio', { name: /Annuel/ })).toContainText('29,99');
  await page.getByRole('radio', { name: /Mensuel/ }).click();
  await expect(page.getByRole('radio', { name: /Mensuel/ })).toHaveAttribute('aria-checked', 'true');

  await page.getByRole('button', { name: 'Passer à Folio+' }).click();
  await expect(page.getByRole('heading', { name: 'Bienvenue dans Folio+' })).toBeVisible({ timeout: 10000 });
  await expect(page).toHaveURL(/\/eleve\/folio-plus$/);                // ?plus=merci&session=… consommé
  await expect(page.locator('.fp-merci')).toContainText('Mensuel · renouvelé le');
  await expect(page.getByRole('button', { name: 'Passer à Folio+' })).toHaveCount(0);
  const u = store.users.find(x => x.email === 'lea@exemple.fr');
  expect(store.tables.abonnements.find(a => a.user_id === u.id)).toMatchObject({ statut: 'actif', formule: 'mensuel' });

  // Folio partout : installer ici, et les autres appareils
  await expect(page.locator('.fp-partout')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Installer sur cet appareil' })).toBeVisible();
  await expect(page.locator('.fp-autres li')).toHaveCount(3);

  // les Réglages montrent maintenant Folio+, qui mène au portail de Stripe
  await page.getByRole('button', { name: 'Retour' }).click();
  await page.goto('./eleve/reglages');
  const ligne = page.locator('[data-act="plus"]');
  await expect(ligne).toContainText('Actif', { timeout: 10000 });
  await ligne.click();
  await expect(page.locator('.fp-ligne')).toContainText('Mensuel · renouvelé le');
  await page.getByRole('button', { name: /Gérer mon abonnement/ }).click();
  await expect(page).toHaveURL(/\/eleve\/folio-plus$/, { timeout: 10000 });   // de retour du portail (?plus=retour)
  await expect(ecran(page)).toBeVisible();
});

test('le paiement pas encore ouvert, hors ligne : chaque cas dit ce qu’il en est', async ({ page }) => {
  const store = nouveauStore();
  await brancher(page, store);
  await inscrire(page);
  // la vente n'est pas ouverte : aucune ligne Folio+ dans les Réglages d'un compte gratuit
  await page.goto('./eleve/reglages');
  await expect(page.getByRole('button', { name: 'Se déconnecter' })).toBeVisible({ timeout: 10000 });
  await expect(page.locator('[data-act="plus"]')).toHaveCount(0);

  await page.goto('./eleve/folio-plus');
  await expect(ecran(page)).toBeVisible({ timeout: 10000 });
  store.paiement = 'absent';                                             // la fonction n'est pas déployée
  await page.getByRole('button', { name: 'Passer à Folio+' }).click();
  await expect(page.locator('.fp-err')).toHaveText('Le paiement ouvre bientôt');
  store.paiement = 'nokey';                                              // déployée, sans clé Stripe
  await page.getByRole('button', { name: 'Passer à Folio+' }).click();
  await expect(page.locator('.fp-err')).toHaveText('Le paiement ouvre bientôt');
  store.paiement = undefined;
  store.online = false;
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await page.getByRole('button', { name: 'Passer à Folio+' }).click();
  await expect(page.locator('.fp-err')).toHaveText(/Hors ligne|ne répond pas/);
  expect(store.tables.abonnements || []).toHaveLength(0);
});

test('Stripe ramène avant que l’abonnement soit écrit : l’écran attend, puis l’ouvre', async ({ page }) => {
  const store = nouveauStore();
  await brancher(page, store);
  await inscrire(page);
  store.paiement = 'lent';
  await page.goto('./eleve/folio-plus');
  await page.getByRole('button', { name: 'Passer à Folio+' }).click({ timeout: 10000 });
  await expect(page.getByRole('heading', { name: 'Paiement reçu' })).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('heading', { name: 'Bienvenue dans Folio+' })).toBeVisible({ timeout: 15000 });
});

test('le site envoie vers Folio+ sans session : la formule attend la connexion', async ({ page }) => {
  const store = nouveauStore();
  semerCompte(store, 'lea@exemple.fr');
  await brancher(page, store);
  await page.goto('./app?plus=mensuel');
  await expect(page.getByRole('textbox', { name: 'Adresse e-mail' })).toBeVisible({ timeout: 10000 });
  await page.getByRole('textbox', { name: 'Adresse e-mail' }).fill('lea@exemple.fr');
  await page.getByRole('textbox', { name: 'Mot de passe' }).fill('motdepasse-solide-42');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(ecran(page)).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('radio', { name: /Mensuel/ })).toHaveAttribute('aria-checked', 'true');
  await expect(page).toHaveURL(/\/eleve\/folio-plus$/);
});

test('un élève d’un établissement sous licence : Folio Campus, rien à acheter', async ({ page }) => {
  const store = nouveauStore();
  const { org } = semerEtablissement(store, { nom: 'Lycée Camus', offre: 'etablissement' });
  const tom = semerCompte(store, 'tom@lycee.fr');
  etab(store).membres[tom] = org.id;
  await brancher(page, store);
  await page.goto('./app');
  await page.getByRole('textbox', { name: 'Adresse e-mail' }).fill('tom@lycee.fr');
  await page.getByRole('textbox', { name: 'Mot de passe' }).fill('motdepasse-solide-42');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.locator('#boot')).toHaveCount(0, { timeout: 10000 });
  await page.goto('./eleve/folio-plus');
  await expect(page.locator('.fp-ligne')).toContainText('Offert par Lycée Camus', { timeout: 10000 });
  await expect(page.getByRole('button', { name: 'Passer à Folio+' })).toHaveCount(0);
  await page.goto('./eleve/reglages');
  await expect(page.locator('[data-act="plus"]')).toContainText('Campus', { timeout: 10000 });
});
