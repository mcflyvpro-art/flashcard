// Folio+ (2026-10-27) : l'onglet d'un compte gratuit, ce qu'il grise,
// l'écran, le paiement et son retour, puis Folio sur tous les écrans ; un
// compte d'avant le 2026-10-27, qui a Folio+ offert ; l'app des magasins.
// Les fonctions `paiement` et `magasins` sont jouées par la base locale
// (src/base-locale/abonnements.js) : « payer » y écrit l'abonnement comme le
// ferait stripe-webhook et renvoie à l'adresse de retour de Stripe. Les
// vraies fonctions, face à un faux Stripe et un faux RevenueCat :
// tools/paiement/essai.js.
import { test, expect } from '@playwright/test';
import { brancher, nouveauStore, semerLivre } from './faux-supabase.js';
import { semerCompte } from './faux-cercle.js';
import { etab, semerEtablissement } from './faux-etablissement.js';
import { inscrire } from './aide.js';

const ecran = page => page.locator('#app[data-view="plus"]');
// un compte créé après le 2026-10-27 : Folio gratuit (les comptes des parcours ont sinon Folio+ offert)
const gratuit = () => ({ ...nouveauStore(), parDefaut: 'gratuit' });
const pages = i => [1, 2, 3, 4].map(k => [`question ${i}.${k}`, `réponse ${i}.${k}`]);

test('un compte gratuit : l’onglet Folio+, le paiement, le retour ; l’onglet s’en va, Folio+ se voit', async ({ page }) => {
  const store = gratuit();
  await brancher(page, store);
  await inscrire(page);
  const onglet = page.locator('.tabs [data-act="tab-plus"]');
  await expect(onglet).toBeVisible({ timeout: 10000 });
  await expect(page.locator('html')).toHaveClass(/offre-gratuit/);
  await onglet.click();
  await expect(ecran(page)).toBeVisible({ timeout: 10000 });
  await expect(page).toHaveURL(/\/eleve\/folio-plus$/);
  await expect(page.locator('[data-fp="retour"]')).toHaveCount(0);             // un onglet : la barre du bas, pas de retour
  await expect(page.locator('.tabs [data-act="tab-plus"]')).toHaveClass(/on/);
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

  // sur tous ses écrans : ce téléphone l'a installée (la porte d'installation), l'ordinateur a son adresse
  await expect(page.locator('.fp-partout')).toBeVisible();
  await expect(page.locator('.fp-ici')).toContainText('Installé sur ce téléphone');
  await expect(page.locator('.fp-adresse')).toContainText('folioflashcard.online');
  await expect(page.locator('.fp-partout')).not.toContainText(/Bientôt|App Store|Google Play/);
  await expect(page.locator('html')).toHaveClass(/offre-plus/);

  // l'onglet Folio+ s'en est allé ; mon jeton porte le liseré de la marque
  await page.getByRole('button', { name: 'Retour' }).click();
  await expect(page.locator('.tabs button')).toHaveCount(2, { timeout: 10000 });   // Livres, Cercle
  await expect(page.locator('.tabs [data-act="tab-plus"]')).toHaveCount(0);
  await page.goto('./eleve/cercle');
  await expect(page.locator(`.jt.jt-plus[data-jt="p:${u.id}"]`).first()).toBeVisible({ timeout: 10000 });

  // les Réglages montrent maintenant Folio+, qui mène au portail de Stripe
  await page.goto('./eleve/reglages');
  const ligne = page.locator('[data-act="plus"]');
  await expect(ligne).toContainText('Actif', { timeout: 10000 });
  await ligne.click();
  await expect(page.locator('.fp-ligne')).toContainText('Mensuel · renouvelé le');
  await page.getByRole('button', { name: /Gérer mon abonnement/ }).click();
  await expect(page).toHaveURL(/\/eleve\/folio-plus$/, { timeout: 10000 });   // de retour du portail (?plus=retour)
  await expect(ecran(page)).toBeVisible();
});

test('le paiement pas encore branché, hors ligne : chaque cas dit ce qu’il en est', async ({ page }) => {
  const store = gratuit();
  await brancher(page, store);
  await inscrire(page);
  // la vente est ouverte : les Réglages d'un compte gratuit ont leur ligne Folio+
  await page.goto('./eleve/reglages');
  await expect(page.getByRole('button', { name: 'Se déconnecter' })).toBeVisible({ timeout: 10000 });
  await expect(page.locator('[data-act="plus"]')).toContainText('Gratuit');

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
  const store = gratuit();
  await brancher(page, store);
  await inscrire(page);
  store.paiement = 'lent';
  await page.goto('./eleve/folio-plus');
  await page.getByRole('button', { name: 'Passer à Folio+' }).click({ timeout: 10000 });
  await expect(page.getByRole('heading', { name: 'Paiement reçu' })).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('heading', { name: 'Bienvenue dans Folio+' })).toBeVisible({ timeout: 15000 });
});

test('le site envoie vers Folio+ sans session : la formule attend la connexion', async ({ page }) => {
  const store = gratuit();
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

test('Folio gratuit grise ce qui est dans Folio+ ; le toucher ouvre Folio+ et dit pourquoi', async ({ page }) => {
  const store = gratuit();
  await brancher(page, store);
  await inscrire(page);
  for (let i = 1; i <= 5; i++) semerLivre(store, 'lea@exemple.fr', 'Livre ' + i, pages(i));
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/livres-plein/, { timeout: 10000 });

  // la bibliothèque est pleine : « Nouveau livre » ouvre Folio+ et dit pourquoi
  await page.locator('[data-act="new"]:visible').first().click();
  await expect(ecran(page)).toBeVisible({ timeout: 10000 });
  await expect(page.locator('.fp-raison')).toContainText('Ta bibliothèque est pleine');

  // un QCM : dans Folio+
  await page.goto('./eleve/livres');
  await page.getByText('Livre 1', { exact: true }).first().click();
  await expect(page.locator('#app')).toHaveAttribute('data-view', 'deck', { timeout: 10000 });
  await page.locator('[data-act="mcq"]').first().click();
  await expect(page.locator('.fp-raison')).toContainText('QCM et associations', { timeout: 10000 });

  // le journal : la série reste, la mémoire se floute
  await page.goto('./eleve/journal');
  await expect(page.locator('[data-volet="memoire"]')).toHaveClass(/plus-floute/, { timeout: 10000 });
});

test('un compte d’avant le 2026-10-27 : Folio+ offert, rien de grisé, pas d’onglet', async ({ page }) => {
  const store = nouveauStore();                       // parDefaut « plus » : le compte a reçu Folio+ offert
  await brancher(page, store);
  await inscrire(page);
  for (let i = 1; i <= 6; i++) semerLivre(store, 'lea@exemple.fr', 'Livre ' + i, pages(i));
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/offre-plus/, { timeout: 10000 });
  await expect(page.locator('html')).not.toHaveClass(/offre-gratuit|livres-plein/);
  await expect(page.locator('.tabs [data-act="tab-plus"]')).toHaveCount(0);
  await page.locator('[data-act="new"]:visible').first().click();
  await expect(page.locator('#app')).toHaveAttribute('data-view', 'import', { timeout: 10000 });
  await page.goto('./eleve/reglages');
  await expect(page.locator('[data-act="plus"]')).toContainText('Offert', { timeout: 10000 });
});

test('dans l’app des magasins : l’achat intégré, jamais Stripe', async ({ page }) => {
  const store = gratuit();
  // l'enveloppe native (Capacitor) et le greffon RevenueCat, sans les clés : l'achat « ouvre bientôt »
  await page.addInitScript(() => {
    window.Capacitor = { getPlatform: () => 'android', isNativePlatform: () => true, Plugins: { Purchases: {} } };
  });
  await brancher(page, store);
  await inscrire(page);
  await page.goto('./eleve/folio-plus');
  await expect(ecran(page)).toBeVisible({ timeout: 10000 });
  await expect(page.locator('.fp-offre')).toContainText('Paiement par Google Play');
  await expect(page.locator('.fp-offre')).not.toContainText('Stripe');
  await expect(page.getByRole('button', { name: 'Restaurer mes achats' })).toBeVisible();
  await page.getByRole('button', { name: 'Passer à Folio+' }).click();
  await expect(page.locator('.fp-err')).toHaveText('Le paiement ouvre bientôt');
  expect(store.tables.abonnements || []).toHaveLength(0);
});
