// Le Prompt de la création (2026-10-29) : on colle, on demande, l'IA écrit les
// pages ; on les retouche en lui parlant ; chaque message est une génération
// du mois, que la pastille de chaque onglet d'IA décompte. Un élève Campus à
// qui sa licence n'accorde aucune génération voit ces onglets grisés, et
// pourquoi. La fausse fonction ai (src/base-locale/ia.js) répond de façon
// prévisible : « a = b » fait une page, « inverse… » échange recto et verso.
import { test, expect } from '@playwright/test';
import { brancher, nouveauStore } from './faux-supabase.js';
import { semerCompte } from './faux-cercle.js';
import { faireEleve, faireProfesseur, modele } from './faux-classes.js';
import { semerLicenceProf } from '../src/base-locale/licences.js';
import { sansTuto } from './aide.js';

const MDP = 'motdepasse-solide-42';

function eleve(store, email) {
  const id = semerCompte(store, email);
  faireEleve(store, email);
  sansTuto(store, email);
  store.tables.prefs.find(r => r.user_id === id).data.bienvenue = 1;
  return id;
}

async function connexion(page, email) {
  await page.goto('./app');
  await expect(page.locator('#boot')).toHaveCount(0, { timeout: 10000 });
  await expect(page.getByRole('textbox', { name: 'Adresse e-mail' })).toBeFocused();
  await page.getByRole('textbox', { name: 'Adresse e-mail' }).fill(email);
  await page.getByRole('textbox', { name: 'Mot de passe' }).fill(MDP);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByRole('button', { name: 'Nouveau livre' }).first()).toBeVisible({ timeout: 10000 });
}

const reste = (page, onglet) => page.getByRole('tab', { name: onglet }).locator('.cr-reste');

test('un cours collé devient des pages, qu’on retouche en parlant ; chaque message compte', async ({ page }) => {
  const store = nouveauStore();                               // Mirandola+ (les comptes des parcours sont « d'avant »)
  const lea = eleve(store, 'lea@exemple.fr');
  await brancher(page, store);
  await connexion(page, 'lea@exemple.fr');
  await page.getByRole('button', { name: 'Nouveau livre' }).first().click();
  await page.locator('#nm').fill('Italien');

  // ce qui reste ce mois-ci, sur les trois façons de créer qui passent par l'IA
  for (const o of ['Fichier', 'Photo', 'Prompt']) await expect(reste(page, o)).toHaveText('30', { timeout: 10000 });
  await expect(page.getByRole('tab', { name: 'Coller' }).locator('.cr-reste')).toHaveCount(0);
  await expect(reste(page, 'Prompt')).toHaveAttribute('title', '30 générations d’IA restent ce mois-ci, sur 30');

  await page.getByRole('tab', { name: 'Prompt' }).click();
  const msg = page.locator('#pimsg');
  await expect(msg).toBeVisible({ timeout: 10000 });
  // un début de consigne se pose dans la zone, il ne part pas seul
  await page.locator('.pi-puce', { hasText: 'La définition au recto' }).click();
  await expect(msg).toHaveValue('La définition au recto, le mot au verso');
  await msg.fill('chat = gatto\nchien = cane');
  await page.getByRole('button', { name: 'Envoyer' }).click();
  await expect(page.locator('.pi-p')).toHaveCount(2, { timeout: 10000 });
  await expect(page.locator('.pi-b.moi')).toContainText('chat = gatto');
  await expect(page.locator('.pi-b.ia').last()).toContainText('2 pages');
  await expect(reste(page, 'Prompt')).toHaveText('29');
  await expect(reste(page, 'Photo')).toHaveText('29');                     // un seul compte pour toute l'IA
  await expect(msg).toHaveValue('');

  // une retouche, en un appui : toute la liste revient, retournée
  await page.locator('.pi-puce', { hasText: 'Inverse recto et verso' }).click();
  await expect(page.locator('.pi-p .a').first()).toHaveText('gatto', { timeout: 10000 });
  await expect(page.locator('.pi-p .b').first()).toHaveText('chat');
  await expect(reste(page, 'Prompt')).toHaveText('28');

  // une autre, écrite (Ctrl+Entrée envoie)
  await msg.fill('ours = orso');
  await msg.press('Control+Enter');
  await expect(page.locator('.pi-p')).toHaveCount(3, { timeout: 10000 });
  await expect(reste(page, 'Prompt')).toHaveText('27');
  // une page qu'on ne veut pas : on la retire sans rien dépenser
  await page.locator('.pi-p', { hasText: 'orso' }).getByRole('button', { name: 'Retirer la page' }).click();
  await expect(page.locator('.pi-p')).toHaveCount(2);
  await expect(reste(page, 'Prompt')).toHaveText('27');

  // « Créer » prend les pages qui attendent
  await page.getByRole('button', { name: 'Créer le livre' }).click();
  await expect(page.getByRole('button', { name: 'Menu du livre' })).toBeVisible({ timeout: 10000 });
  const rectos = page.getByRole('textbox', { name: 'Recto' });
  await expect(rectos).toHaveCount(2);
  await expect(rectos.nth(0)).toHaveValue('gatto');
  await expect(rectos.nth(1)).toHaveValue('cane');
  expect(store.tables.ai_usage.filter(a => a.user_id === lea && a.op === 'prompt')).toHaveLength(3);
});

test('« Ajouter » verse les pages dans la liste, sans doublon ; l’IA épuisée le dit et rend le message', async ({ page }) => {
  const store = nouveauStore();
  const lea = eleve(store, 'lea@exemple.fr');
  // 29 générations déjà prises ce mois-ci
  const jour = new Date().toISOString().slice(0, 10);
  store.tables.ai_usage = Array.from({ length: 29 }, () => ({ user_id: lea, day: jour, op: 'cards', cents: 0.4 }));
  await brancher(page, store);
  await connexion(page, 'lea@exemple.fr');
  await page.getByRole('button', { name: 'Nouveau livre' }).first().click();
  await page.locator('#cf').fill('chat');
  await page.locator('#cb').fill('gatto');
  await page.locator('#cb').press('Enter');
  await page.getByRole('tab', { name: 'Prompt' }).click();
  await expect(reste(page, 'Prompt')).toHaveText('1', { timeout: 10000 });
  await page.locator('#pimsg').fill('chat = gatto\nloup = lupo');
  await page.getByRole('button', { name: 'Envoyer' }).click();
  await expect(page.locator('.pi-p')).toHaveCount(2, { timeout: 10000 });
  await expect(reste(page, 'Prompt')).toHaveText('0');
  await expect(reste(page, 'Prompt')).toHaveClass(/vide/);

  await page.getByRole('button', { name: 'Ajouter 2 pages' }).click();
  await expect(page.locator('.toast:not(.sort)')).toContainText('1 page · 1 déjà là');
  await expect(page.locator('.pi-p')).toHaveCount(0);

  // plus rien ce mois-ci : la base refuse, le message revient dans la zone
  await page.locator('#pimsg').fill('ours = orso');
  await page.getByRole('button', { name: 'Envoyer' }).click();
  await expect(page.locator('.pi-b.err')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#pimsg')).toHaveValue('ours = orso');
  await expect(page.locator('.pi-b.moi')).toHaveCount(1);
});

test('un élève Campus sans IA : les trois onglets grisés, et pourquoi', async ({ page }) => {
  const store = nouveauStore(), m = modele(store);
  const lucie = semerCompte(store, 'lucie@exemple.fr');
  faireProfesseur(store, 'lucie@exemple.fr', 'Lucie MIRA');
  semerLicenceProf(store, 'lucie@exemple.fr', { places: 5, ia_eleve: 0 });
  const tom = eleve(store, 'tom@exemple.fr');
  m.classes.push({ id: '00000000-0000-4000-8000-0000000000c1', name: 'Maths Tle', niveau: 'Tle', matiere: 'Maths',
    code: 'HJKMNPQR', owner: lucie, ouvert: true, validation: true, places: 40, fin: null, archivee: false, org: null, genre: 'classe' });
  m.membres.push({ cid: m.classes[0].id, uid: tom, depuis: new Date().toISOString() });
  m.noms[tom] = 'Tom DURAND';
  await brancher(page, store);
  await connexion(page, 'tom@exemple.fr');
  await page.getByRole('button', { name: 'Nouveau livre' }).first().click();

  const prompt = page.getByRole('tab', { name: 'Prompt' });
  for (const o of ['Fichier', 'Photo', 'Prompt']) {
    await expect(page.getByRole('tab', { name: o })).toHaveClass(/ferme/, { timeout: 10000 });
    await expect(page.getByRole('tab', { name: o })).toHaveAttribute('data-astuce', 'Ton professeur n’a pas ouvert l’IA à ton compte');
  }
  await expect(prompt).not.toHaveAttribute('data-offre', 'plus');           // rien à acheter : c'est la licence
  await expect(page.locator('.cr-reste')).toHaveCount(0);
  await prompt.click({ force: true });
  await expect(page.locator('.toast:not(.sort)')).toContainText('Ton professeur n’a pas ouvert l’IA à ton compte');
  await expect(page.getByRole('tab', { name: 'Écrire' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#pimsg')).toHaveCount(0);
});

test('une professeure, et l’IA en panne : le message dit pourquoi, rien n’est compté, le message attend ; revenue, ça marche', async ({ page }) => {
  const store = nouveauStore();
  semerCompte(store, 'lucie@exemple.fr');
  faireProfesseur(store, 'lucie@exemple.fr', 'Lucie MIRA');
  sansTuto(store, 'lucie@exemple.fr');
  await brancher(page, store);
  await page.goto('./app');
  await expect(page.locator('#boot')).toHaveCount(0, { timeout: 10000 });
  await page.getByRole('textbox', { name: 'Adresse e-mail' }).fill('lucie@exemple.fr');
  await page.getByRole('textbox', { name: 'Mot de passe' }).fill(MDP);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.locator('#app')).toHaveAttribute('data-view', 'prof', { timeout: 10000 });
  await page.goto('./prof/livres/nouveau');
  await page.getByRole('tab', { name: 'Prompt' }).click({ timeout: 10000 });
  await expect(reste(page, 'Prompt')).toHaveText('400', { timeout: 10000 });       // un professeur : 400 par mois

  store.iaPanne = 'surcharge';
  await page.locator('#pimsg').fill('to go = aller');
  await page.getByRole('button', { name: 'Envoyer' }).click();
  await expect(page.locator('.pi-b.err')).toContainText('L’IA est très demandée', { timeout: 10000 });
  await expect(page.locator('#pimsg')).toHaveValue('to go = aller');
  await expect(reste(page, 'Prompt')).toHaveText('400');

  store.iaPanne = 'credit';
  await page.getByRole('button', { name: 'Envoyer' }).click();
  await expect(page.locator('.pi-b.err')).toContainText('L’IA fait une courte pause', { timeout: 10000 });

  store.iaPanne = null;
  await page.getByRole('button', { name: 'Envoyer' }).click();
  await expect(page.locator('.pi-p')).toHaveCount(1, { timeout: 10000 });
  await expect(page.locator('.pi-b.err')).toHaveCount(0);
  await expect(reste(page, 'Prompt')).toHaveText('399');
});
