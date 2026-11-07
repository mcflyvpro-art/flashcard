// La sécurité du compte (2026-11-02, core/compte-auth.js, ui/verif.js,
// ui/securite.js) : tout ce que les e-mails de Supabase Auth servent, joué
// sur la base locale — les codes y sont dans `store.courriels`, comme dans
// une boîte aux lettres. Le mot de passe oublié par code, la connexion par
// code (sans rien dire d'une adresse inconnue), la vérification en deux
// étapes (activée, demandée à la connexion suivante et rien n'est lu avant,
// gardée au rechargement, désactivée), le mot de passe changé avec le code de
// réauthentification, l'adresse changée avec ses deux codes, une adresse mal
// tapée à l'inscription.
import { test, expect } from '@playwright/test';
import { brancher, nouveauStore } from './faux-supabase.js';
import { semerCompte } from './faux-cercle.js';
import { connecter, sansTuto } from './aide.js';

const dernier = (store, type) => [...(store.courriels || [])].reverse().find(c => c.type === type);

async function ouvrir(page) {
  await page.goto('./app');
  await expect(page.locator('#boot')).toHaveCount(0, { timeout: 10000 });
  await expect(page.getByRole('textbox', { name: 'Adresse e-mail' })).toBeFocused();
}

async function securite(page) {
  // déjà sur les Réglages (au téléphone, la barre du bas n'y est plus) : la ligne seule
  if (!(await page.locator('[data-act="secu"]').isVisible())) await page.getByRole('button', { name: 'Réglages' }).first().click();
  await page.locator('[data-act="secu"]').click();
  await expect(page.locator('.menu.sc')).toBeVisible();
}

test('mot de passe oublié : l’adresse, le code reçu, puis un nouveau mot de passe', async ({ page }) => {
  const store = nouveauStore();
  const id = semerCompte(store, 'lea@exemple.fr', 'oublie-depuis-longtemps');
  sansTuto(store, 'lea@exemple.fr');
  await brancher(page, store);
  await ouvrir(page);
  await page.getByRole('textbox', { name: 'Adresse e-mail' }).fill('lea@exemple.fr');
  await page.getByRole('button', { name: 'Mot de passe oublié' }).click();
  await expect(page.getByRole('heading', { name: 'Mot de passe oublié.' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Adresse e-mail' })).toHaveValue('lea@exemple.fr');
  await page.getByRole('button', { name: 'Recevoir un code' }).click();
  await expect(page.getByText('Code à 8 chiffres envoyé à')).toBeVisible({ timeout: 10000 });
  expect(dernier(store, 'recovery').email).toBe('lea@exemple.fr');

  // un code faux : on le dit, le champ se vide
  await page.getByRole('textbox', { name: 'Code à 8 chiffres' }).fill('00000000');
  await expect(page.locator('#vfe')).toContainText('Code faux ou expiré', { timeout: 10000 });
  // le bon, tapé en entier, part tout seul
  await page.getByRole('textbox', { name: 'Code à 8 chiffres' }).fill(dernier(store, 'recovery').code);
  await expect(page.getByRole('heading', { name: 'Choisis un nouveau mot de passe.' })).toBeVisible({ timeout: 10000 });
  await page.locator('#mdp1').fill('tout-neuf-2026');
  await page.locator('#mdp2').fill('tout-neuf-2026');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByRole('button', { name: 'Nouveau livre' })).toBeVisible({ timeout: 10000 });
  expect(store.users.find(u => u.id === id).password).toBe('tout-neuf-2026');
});

test('connexion par code : sans mot de passe ; une adresse inconnue ne se trahit pas', async ({ page }) => {
  const store = nouveauStore();
  semerCompte(store, 'lea@exemple.fr');
  sansTuto(store, 'lea@exemple.fr');
  await brancher(page, store);
  await ouvrir(page);
  await page.getByRole('button', { name: 'Recevoir un code' }).click();
  await expect(page.getByRole('heading', { name: 'Connexion par code.' })).toBeVisible();

  await page.getByRole('textbox', { name: 'Adresse e-mail' }).fill('personne@exemple.fr');
  await page.getByRole('button', { name: 'Recevoir un code' }).click();
  await expect(page.getByText('Code à 8 chiffres envoyé à')).toBeVisible({ timeout: 10000 });
  expect(store.courriels || []).toHaveLength(0);
  await page.getByRole('button', { name: 'Retour' }).click();

  await page.getByRole('textbox', { name: 'Adresse e-mail' }).fill('lea@exemple.fr');
  await page.getByRole('button', { name: 'Recevoir un code' }).click();
  await expect(page.getByText('Code à 8 chiffres envoyé à')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#vfr')).toBeDisabled();                  // pas deux e-mails dans la minute
  await page.getByRole('textbox', { name: 'Code à 8 chiffres' }).fill(dernier(store, 'magiclink').code);
  await expect(page.getByRole('button', { name: 'Nouveau livre' })).toBeVisible({ timeout: 10000 });
});

test('vérification en deux étapes : activée, demandée à la connexion suivante, rien n’est lu avant, puis retirée', async ({ page }) => {
  const store = nouveauStore();
  semerCompte(store, 'lea@exemple.fr');
  sansTuto(store, 'lea@exemple.fr');
  await brancher(page, store);
  await connecter(page);
  await securite(page);
  await page.locator('[data-sc="deux"]').click();
  await page.getByRole('button', { name: 'Activer' }).click();
  await expect(page.locator('.sc-qr svg')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#sccle')).toContainText('JBSW Y3DP');
  await page.getByRole('textbox', { name: 'Code de l’application' }).fill('000000');
  await expect(page.locator('#sce')).toContainText('Code faux', { timeout: 10000 });
  await page.getByRole('textbox', { name: 'Code de l’application' }).fill('123456');
  await expect(page.locator('.toast')).toContainText('Vérification en deux étapes activée', { timeout: 10000 });
  expect(store.users[0].facteurs[0].status).toBe('verified');

  // une nouvelle connexion : le code de l'application, et aucune donnée lue avant
  await page.keyboard.press('Escape');
  await page.locator('[data-act="logout"]').first().click();
  const lus = [];
  // le rapporteur d'erreurs (rpc/signaler) part sans compte et ne lit rien : il ne compte pas
  page.on('request', r => { if (r.url().includes('/rest/v1/') && !r.url().includes('/rpc/signaler')) lus.push(r.url()); });
  await ouvrir(page);
  await page.getByRole('textbox', { name: 'Adresse e-mail' }).fill('lea@exemple.fr');
  await page.getByRole('textbox', { name: 'Mot de passe' }).fill('motdepasse-solide-42');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByRole('heading', { name: 'Code de vérification.' })).toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(600);
  expect(lus).toEqual([]);
  await page.getByRole('textbox', { name: 'Code à 6 chiffres' }).fill('123456');
  await expect(page.getByRole('button', { name: 'Nouveau livre' })).toBeVisible({ timeout: 10000 });

  // rouvrir l'app ne le redemande pas : la session reste
  await page.reload();
  await expect(page.getByRole('button', { name: 'Nouveau livre' })).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('heading', { name: 'Code de vérification.' })).toHaveCount(0);

  // la retirer : deux appuis
  await securite(page);
  await expect(page.locator('[data-sc="deux"]')).toContainText('Activée', { timeout: 10000 });
  await page.locator('[data-sc="deux"]').click();
  await page.getByRole('button', { name: 'Désactiver' }).click();
  await page.getByRole('button', { name: 'Confirmer : désactiver' }).click();
  await expect(page.locator('.toast')).toContainText('désactivée', { timeout: 10000 });
  expect(store.users[0].facteurs).toHaveLength(0);
});

test('changer de mot de passe : le code de réauthentification quand la session a plus de 24 h', async ({ page }) => {
  const store = nouveauStore();
  const id = semerCompte(store, 'lea@exemple.fr');
  sansTuto(store, 'lea@exemple.fr');
  await brancher(page, store);
  await connecter(page);
  store.reauth = true;
  await securite(page);
  await page.locator('[data-sc="mdp"]').click();
  await page.getByRole('textbox', { name: 'Nouveau mot de passe' }).fill('court');
  await page.getByRole('button', { name: 'Changer le mot de passe' }).click();
  await expect(page.locator('#sce')).toContainText('10 caractères au moins');
  await page.getByRole('textbox', { name: 'Nouveau mot de passe' }).fill('un-tout-nouveau-2026');
  await page.getByRole('button', { name: 'Changer le mot de passe' }).click();
  await expect(page.locator('.menu.sc')).toContainText('Confirme que c’est toi', { timeout: 10000 });
  await page.getByRole('textbox', { name: 'Code reçu par e-mail' }).fill(dernier(store, 'reauthentication').code);
  await expect(page.locator('.toast')).toContainText('Mot de passe changé', { timeout: 10000 });
  expect(store.users.find(u => u.id === id).password).toBe('un-tout-nouveau-2026');
});

test('changer d’adresse : un code à chacune des deux, rien ne change avant le second', async ({ page }) => {
  const store = nouveauStore();
  const id = semerCompte(store, 'lea@exemple.fr');
  sansTuto(store, 'lea@exemple.fr');
  await brancher(page, store);
  await connecter(page);
  await securite(page);
  await page.locator('[data-sc="adresse"]').click();
  await page.getByRole('textbox', { name: 'Nouvelle adresse e-mail' }).fill('lea.martin@exemple.fr');
  await page.getByRole('button', { name: 'Recevoir les codes' }).click();
  await expect(page.locator('.menu.sc')).toContainText('Deux codes à taper', { timeout: 10000 });
  const [nouvelle, ancienne] = store.courriels.filter(c => c.type === 'email_change');
  expect([nouvelle.email, ancienne.email]).toEqual(['lea.martin@exemple.fr', 'lea@exemple.fr']);

  await page.getByRole('textbox', { name: 'Code reçu à lea.martin@exemple.fr' }).fill(nouvelle.code);
  await page.getByRole('button', { name: 'Confirmer' }).click();
  await expect(page.locator('.sc-dbl.fait')).toHaveCount(1, { timeout: 10000 });
  expect(store.users.find(u => u.id === id).email).toBe('lea@exemple.fr');
  await page.getByRole('textbox', { name: 'Code reçu à lea@exemple.fr' }).fill(ancienne.code);
  await page.getByRole('button', { name: 'Confirmer' }).click();
  await expect(page.locator('.toast')).toContainText('Adresse changée', { timeout: 10000 });
  expect(store.users.find(u => u.id === id).email).toBe('lea.martin@exemple.fr');
  await securite(page);
  await expect(page.locator('[data-sc="adresse"]')).toContainText('lea.martin@exemple.fr');
});

test('une adresse mal tapée à l’inscription : la bonne est proposée, rien n’est créé avant', async ({ page }) => {
  const store = nouveauStore();
  store.confirmation = true;
  await brancher(page, store);
  await ouvrir(page);
  await page.getByRole('button', { name: 'Créer un compte' }).click();
  await page.getByRole('textbox', { name: 'Adresse e-mail' }).fill('zoe@gmial.com');
  await page.getByRole('textbox', { name: 'Mot de passe' }).fill('un-mot-de-passe');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Créer le compte' }).click();
  await expect(page.locator('#le')).toContainText('Tu voulais dire');
  expect(store.users).toHaveLength(0);
  await page.getByRole('button', { name: 'zoe@gmail.com ?' }).click();
  await expect(page.getByRole('textbox', { name: 'Adresse e-mail' })).toHaveValue('zoe@gmail.com');
  await page.getByRole('button', { name: 'Créer le compte' }).click();
  await expect(page.getByRole('heading', { name: 'Vérifie ta boîte mail.' })).toBeVisible({ timeout: 10000 });
  expect(store.users.map(u => u.email)).toEqual(['zoe@gmail.com']);
});
