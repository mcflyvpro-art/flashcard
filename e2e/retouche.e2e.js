// Modifier un paquet entier avec l'IA (2026-11-07) : le bouton « IA » de la
// page d'un paquet ouvre la barre de l'IA ; ce qu'elle rend remplace le
// paquet, mais une carte corrigée reste la même carte — son identifiant et
// son état d'apprentissage. « Annuler » repose le paquet d'avant ; chaque
// envoi compte au mois. Mirandola gratuit : le geste mène à Mirandola+.
// La fausse fonction ai (src/base-locale/ia.js) : « corrige X en Y »,
// « enlève X », « a = b ».
import { test, expect } from '@playwright/test';
import { brancher, nouveauStore, semerLivre } from './faux-supabase.js';
import { semerCompte } from './faux-cercle.js';
import { faireEleve } from './faux-classes.js';
import { sansTuto } from './aide.js';

const MDP = 'motdepasse-solide-42';
const PAYS = [['France', 'Paris'], ['Italie', 'Rmoe'], ['Espagne', 'Madrid'], ['Portugal', 'Lisbonne']];

function eleve(store, email) {
  const id = semerCompte(store, email);
  faireEleve(store, email);
  sansTuto(store, email);
  store.tables.prefs.find(r => r.user_id === id).data.bienvenue = 1;
  return id;
}

async function ouvrirPaquet(page, email, nom) {
  await page.goto('./app');
  await expect(page.locator('#boot')).toHaveCount(0, { timeout: 10000 });
  await expect(page.getByRole('textbox', { name: 'Adresse e-mail' })).toBeFocused();
  await page.getByRole('textbox', { name: 'Adresse e-mail' }).fill(email);
  await page.getByRole('textbox', { name: 'Mot de passe' }).fill(MDP);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.getByText(nom, { exact: true }).first().click();
  await expect(page.locator('.head .t')).toHaveText(nom, { timeout: 10000 });
}

const demander = async (page, texte) => {
  const ia = page.getByRole('textbox', { name: 'Demande à l’IA' });
  await ia.fill(texte);
  await page.getByRole('button', { name: 'Envoyer' }).click();
};
const reponse = page => page.locator('.menu.retouche .pi-b.ia').last();
// les cartes de la liste sont des champs : on lit leurs valeurs
const versos = page => page.locator('.rows input.b').evaluateAll(l => l.map(e => e.value));
const ligne = (store, deckId, id) => store.tables.cards.find(r => r.deck_id === deckId && r.id === id);

test('corriger, retirer, annuler, ajouter : le paquet suit, une carte corrigée garde son état, chaque envoi compte', async ({ page }) => {
  const store = nouveauStore();                         // Mirandola+ (les comptes des parcours sont « d'avant »)
  eleve(store, 'lea@exemple.fr');
  const deckId = semerLivre(store, 'lea@exemple.fr', 'Capitales', PAYS);
  // l'Italie a déjà été révisée trois fois : son état doit survivre à la correction
  Object.assign(ligne(store, deckId, 'q2'), { state: 2, stability: 31.5, difficulty: 4.8, reviews_count: 3,
    due: Date.now() + 20 * 864e5, last_review: Date.now() - 10 * 864e5 });
  await brancher(page, store);
  await ouvrirPaquet(page, 'lea@exemple.fr', 'Capitales');

  await page.locator('[data-act="retouche"]').click();
  await expect(page.locator('.menu.retouche')).toBeVisible();
  await expect(page.locator('.menu.retouche .mhx i')).toContainText('4 cartes');

  // une faute corrigée : la même carte, son état gardé
  await demander(page, 'corrige Rmoe en Rome');
  await expect(reponse(page)).toContainText('1 modifiée', { timeout: 10000 });
  await expect.poll(() => versos(page)).toContain('Rome');
  await expect.poll(() => ligne(store, deckId, 'q2') && ligne(store, deckId, 'q2').back, { timeout: 10000 }).toBe('Rome');
  expect(ligne(store, deckId, 'q2')).toMatchObject({ stability: 31.5, difficulty: 4.8, reviews_count: 3, state: 2 });

  // une carte retirée, puis « Annuler » : elle revient, la même
  await demander(page, 'enlève Espagne');
  await expect(reponse(page)).toContainText('1 retirée', { timeout: 10000 });
  await expect.poll(() => versos(page)).not.toContain('Madrid');
  await reponse(page).getByRole('button', { name: 'Annuler' }).click();
  await expect.poll(() => versos(page)).toContain('Madrid');
  await expect.poll(() => (ligne(store, deckId, 'q3') || {}).back, { timeout: 10000 }).toBe('Madrid');

  // une carte ajoutée, neuve
  await demander(page, 'Allemagne = Berlin');
  await expect(reponse(page)).toContainText('1 ajoutée', { timeout: 10000 });
  await expect.poll(() => versos(page)).toContain('Berlin');
  await expect.poll(() => store.tables.cards.filter(r => r.deck_id === deckId).length, { timeout: 10000 }).toBe(5);

  // trois envois, trois générations du mois
  expect(store.tables.ai_usage.filter(r => r.op === 'prompt')).toHaveLength(3);
});

test('Mirandola gratuit : le bouton porte le « + » et mène à Mirandola+, sans appeler l’IA', async ({ page }) => {
  const store = { ...nouveauStore(), parDefaut: 'gratuit' };
  eleve(store, 'tom@exemple.fr');
  semerLivre(store, 'tom@exemple.fr', 'Capitales', PAYS);
  await brancher(page, store);
  await ouvrirPaquet(page, 'tom@exemple.fr', 'Capitales');
  await expect(page.locator('html')).toHaveClass(/offre-gratuit/, { timeout: 10000 });
  await page.locator('[data-act="retouche"]').click();
  await expect(page).toHaveURL(/mirandola-plus/, { timeout: 10000 });
  await expect(page.locator('.menu.retouche')).toHaveCount(0);
  expect((store.tables.ai_usage || []).length).toBe(0);
});
