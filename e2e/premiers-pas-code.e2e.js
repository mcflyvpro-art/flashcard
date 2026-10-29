// Les premiers pas d'un élève qui a un code (2026-10-29) : l'accueil ne
// repart plus au choix « Je révise pour moi / J'ai un code » une fois le code
// entré. Chez un professeur particulier, l'élève attend sur son accueil que
// le professeur valide — qui le voit arriver sans recharger — puis l'accueil
// continue (pseudo, visage) et le tuto de la classe suit ; refusé, il revient
// au choix. Un code tapé sur le site avant d'avoir un compte attend la
// connexion : celui d'une classe ouvre l'accueil sur le nom et la classe,
// celui d'un club passe après l'accueil et le tuto.
import { test, expect } from '@playwright/test';
import { brancher, nouveauStore } from './faux-supabase.js';
import { semerClub, semerCompte } from './faux-cercle.js';
import { faireEleve, faireProfesseur, modele } from './faux-classes.js';
import { etab, semerEtablissement } from './faux-etablissement.js';
import { semerLicenceProf } from '../src/base-locale/licences.js';
import { passerTuto, sansTuto } from './aide.js';

const MDP = 'motdepasse-solide-42';

async function connexion(page, email) {
  await expect(page.locator('#boot')).toHaveCount(0, { timeout: 10000 });
  await expect(page.getByRole('textbox', { name: 'Adresse e-mail' })).toBeFocused();
  await page.getByRole('textbox', { name: 'Adresse e-mail' }).fill(email);
  await page.getByRole('textbox', { name: 'Mot de passe' }).fill(MDP);
  await page.getByRole('button', { name: 'Se connecter' }).click();
}

/* Une professeure sous licence, son code, sa classe ; Léa vient de créer son compte. */
function semer() {
  const store = nouveauStore();
  store.parDefaut = 'gratuit';
  const m = modele(store);
  const lucie = semerCompte(store, 'lucie@exemple.fr');
  faireProfesseur(store, 'lucie@exemple.fr', 'Lucie MIRA');
  sansTuto(store, 'lucie@exemple.fr');
  semerLicenceProf(store, 'lucie@exemple.fr', { places: 2 });
  etab(store).codesProfs[lucie] = 'K7QM2XRP';
  m.classes.push({ id: '00000000-0000-4000-8000-0000000000c1', name: 'Maths Tle', niveau: 'Tle', matiere: 'Maths',
    code: 'HJKMNPQR', owner: lucie, ouvert: true, validation: false, places: 40, fin: null, archivee: false, org: null, genre: 'classe' });
  const lea = semerCompte(store, 'lea@exemple.fr');
  faireEleve(store, 'lea@exemple.fr');
  return { store, m, lea, cid: m.classes[0].id };
}

async function entrerLeCode(page) {
  await page.getByRole('button', { name: 'J’ai un code' }).click({ timeout: 10000 });
  await page.locator('#cecode').fill('K7QM-2XRP');
  await page.locator('#ceok').click();
  await page.locator('[data-cein="prenom"]').fill('léa');
  await page.locator('[data-cein="nom"]').fill('martin');
  await page.locator('.ce-cl', { hasText: 'Maths Tle' }).click();
  await page.locator('#cego').click();
}

const attente = page => page.locator('.bv[data-etape="attente"]');

test('le code de sa professeure dès l’accueil : il attend, elle le voit arriver et valide, l’accueil continue, puis le tuto de la classe', async ({ page, browser }) => {
  test.setTimeout(90000);
  const { store, m, lea, cid } = semer();
  // la professeure est déjà sur son accueil, sur son ordinateur
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  const prof = await ctx.newPage();
  await brancher(prof, store);
  await prof.goto('./app');
  await connexion(prof, 'lucie@exemple.fr');
  await expect(prof.locator('.pf-cb-lic')).toContainText('0/2 élèves', { timeout: 10000 });

  await brancher(page, store);
  await page.goto('./app');
  await connexion(page, 'lea@exemple.fr');
  await expect(page.locator('#app')).toHaveAttribute('data-view', 'bienvenue', { timeout: 10000 });
  await entrerLeCode(page);
  // elle attend sur son accueil : pas de retour au choix
  await expect(attente(page).locator('.bv-t')).toHaveText('En attente de Lucie MIRA', { timeout: 10000 });
  await expect(page.getByRole('button', { name: 'Je révise pour moi' })).toHaveCount(0);

  // la professeure la voit arriver, sans recharger
  await expect(prof.locator('.pf-cb-lic')).toContainText('1 en attente', { timeout: 15000 });
  await expect(prof.locator('.toast:not(.sort)')).toContainText('Un élève attend votre validation');
  await prof.locator('.pf-nav [data-pf="classe"]', { hasText: 'Maths Tle' }).click();
  await prof.locator('[data-pf="onglet"][data-v="demandes"]').click();
  await prof.locator('.pf-dem', { hasText: 'Léa MARTIN' }).locator('[data-pf="admettre"]').click();
  await expect.poll(() => m.membres.some(x => x.cid === cid && x.uid === lea)).toBe(true);
  await ctx.close();

  // validée : l'accueil continue, en élève de sa classe, sans recharger
  await expect(page.locator('.toast:not(.sort)')).toContainText('C’est validé', { timeout: 15000 });
  await expect(page.locator('.bv[data-etape="pseudo"]')).toBeVisible();
  await expect(page.locator('.bv-ecole')).toContainText('Maths Tle');
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByRole('button', { name: 'C’est parti' }).click();
  // puis le tuto de la classe (Campus : pas de Mirandola+ à la fin, src/tuto.js)
  await expect(page.locator('#tu')).toHaveAttribute('data-role', 'classe', { timeout: 10000 });
  await expect(page.locator('#tu .tu-debut h2')).toHaveText('Bienvenue, Léa');
});

test('refusée, elle revient au choix ; « Annuler ma demande » aussi', async ({ page }) => {
  const { store, m } = semer();
  await brancher(page, store);
  await page.goto('./app');
  await connexion(page, 'lea@exemple.fr');
  await expect(page.locator('#app')).toHaveAttribute('data-view', 'bienvenue', { timeout: 10000 });
  await entrerLeCode(page);
  await expect(attente(page)).toBeVisible({ timeout: 10000 });
  m.demandes.splice(0);                                  // la professeure refuse
  await expect(page.locator('.toast:not(.sort)')).toContainText('Ta demande n’a pas été validée', { timeout: 15000 });
  await expect(page.locator('.bv[data-etape="choix"]')).toBeVisible();
  await expect(page.locator('html')).toHaveClass(/offre-gratuit/, { timeout: 10000 });

  await entrerLeCode(page);
  await expect(attente(page)).toBeVisible({ timeout: 10000 });
  expect(m.demandes).toHaveLength(1);
  await page.getByRole('button', { name: 'Annuler ma demande' }).click();
  await expect(page.locator('.bv[data-etape="choix"]')).toBeVisible({ timeout: 10000 });
  expect(m.demandes).toHaveLength(0);
});

test('le code d’une classe tapé sur le site avant d’avoir un compte : connecté, l’accueil s’ouvre sur le nom et la classe', async ({ page }) => {
  const store = nouveauStore();
  const { org } = semerEtablissement(store, { nom: 'Lycée Camus', classes: ['2nde A'] });
  semerCompte(store, 'zoe@exemple.fr');
  faireEleve(store, 'zoe@exemple.fr');
  await brancher(page, store);
  await page.goto('./app?rejoindre=' + org.codes.eleve);
  await expect(page.locator('#app')).toHaveAttribute('data-view', 'login', { timeout: 10000 });
  // gardé pour l'origine, pas pour l'onglet : l'e-mail de confirmation s'ouvre souvent ailleurs
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('folio.rejoindre')).v)).toBe(org.codes.eleve);
  await connexion(page, 'zoe@exemple.fr');

  await expect(page.locator('#app')).toHaveAttribute('data-view', 'bienvenue', { timeout: 10000 });
  await expect(page.locator('.ce-f .mhx b')).toHaveText('Lycée Camus', { timeout: 10000 });
  await page.locator('[data-cein="prenom"]').fill('Zoé');
  await page.locator('[data-cein="nom"]').fill('Bernard');
  await page.locator('.ce-cl', { hasText: '2nde A' }).click();
  await page.locator('#cego').click();
  await expect(page.locator('.bv-ecole')).toHaveText('Lycée Camus · 2nde A', { timeout: 10000 });
  expect(await page.evaluate(() => localStorage.getItem('folio.rejoindre'))).toBeNull();
});

test('le code d’un club tapé sur le site : il attend la fin de l’accueil et du tuto', async ({ page }) => {
  const store = nouveauStore();
  semerCompte(store, 'max@exemple.fr');
  const { code } = semerClub(store, 'max@exemple.fr', 'Les Lève-tôt');
  semerCompte(store, 'zoe@exemple.fr');
  faireEleve(store, 'zoe@exemple.fr');
  await brancher(page, store);
  await page.goto('./app?club=' + code);
  await connexion(page, 'zoe@exemple.fr');
  await expect(page.locator('#app')).toHaveAttribute('data-view', 'bienvenue', { timeout: 10000 });
  await expect(page.locator('.menu:not(.sort)')).toHaveCount(0);      // rien par-dessus l'accueil
  await page.locator('[data-bv="passer"]').click();
  await passerTuto(page);
  await expect(page.locator('#app')).toHaveAttribute('data-view', 'commu', { timeout: 10000 });
  await expect(page.locator('#cccode')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('folio.club'))).toBeNull();
});
