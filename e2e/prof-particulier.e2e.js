// Le parcours d'un professeur particulier (2026-10-29), de bout en bout :
// l'éditeur ouvre son compte et lui accorde des places ; il se connecte et
// choisit d'abord son mot de passe ; un élève crée son propre compte, entre
// le code dès son accueil et passe en salle d'attente — Mirandola Campus
// déjà : l'onglet Mirandola+ s'en va ; le professeur l'accepte, en refuse un
// autre (sa place revient, l'élève reçoit un mot et retombe en gratuit) ; la
// licence pleine arrête le suivant, et le professeur commande des places.
import { test, expect } from '@playwright/test';
import { brancher, nouveauStore } from './faux-supabase.js';
import { semerCompte } from './faux-cercle.js';
import { faireEleve, faireProfesseur, modele } from './faux-classes.js';
import { etab } from './faux-etablissement.js';
import { licences, semerLicenceProf } from '../src/base-locale/licences.js';
import { offreDe } from '../src/base-locale/abonnements.js';
import { sansTuto } from './aide.js';

const MDP = 'motdepasse-solide-42';

async function connexion(page, email, mdp = MDP) {
  await page.goto('./app');
  await expect(page.locator('#boot')).toHaveCount(0, { timeout: 10000 });
  await expect(page.getByRole('textbox', { name: 'Adresse e-mail' })).toBeFocused();
  await page.getByRole('textbox', { name: 'Adresse e-mail' }).fill(email);
  await page.getByRole('textbox', { name: 'Mot de passe' }).fill(mdp);
  await page.getByRole('button', { name: 'Se connecter' }).click();
}

test.describe('sur ordinateur', () => {
  test.use({ viewport: { width: 1360, height: 900 } });

  test('l’éditeur ouvre le compte d’une professeure ; elle choisit son mot de passe et voit ses places', async ({ page, browser }) => {
    const store = nouveauStore(), m = modele(store);
    const moi = semerCompte(store, 'editeur@mirandola.fr');
    m.roles[moi] = 'admin'; m.noms[moi] = 'Clément';
    sansTuto(store, 'editeur@mirandola.fr');
    await brancher(page, store);
    await connexion(page, 'editeur@mirandola.fr');
    await expect(page.locator('.ed-chiffres')).toBeVisible({ timeout: 10000 });

    await page.locator('#rail [data-r="adm:comptes"]').click();
    await page.locator('[data-adm="nouveau-compte"]').click();
    await page.locator('#nc-prenom').fill('Lucie');
    await page.locator('#nc-nom').fill('Mira');
    await page.locator('#nc-mail').fill('lucie@exemple.fr');
    const pw = await page.locator('#nc-pw').inputValue();
    expect(pw.length).toBeGreaterThanOrEqual(10);
    // le coût de l'IA suit la saisie : 1 professeur × 400 + 2 élèves × 30
    await page.locator('#nc-places').fill('2');
    await expect(page.locator('#nc-cout')).toContainText('460 générations');
    await page.getByRole('button', { name: 'Ouvrir le compte' }).click();

    await expect(page.locator('.ed-mdp .ed-code')).toHaveText(pw);
    await expect(page.locator('.ed-mdp a.ed-b.pri')).toHaveAttribute('href', /^mailto:lucie%40exemple\.fr\?subject=/);
    const lucie = store.users.find(u => u.email === 'lucie@exemple.fr');
    expect(lucie.password).toBe(pw);
    expect(m.roles[lucie.id]).toBe('prof');
    expect(m.noms[lucie.id]).toBe('Lucie MIRA');
    expect(licences(store).profs[lucie.id]).toMatchObject({ places: 2, ia_prof: 400, ia_eleve: 30 });
    expect(licences(store).provisoires[lucie.id]).toBeTruthy();

    // elle se connecte sur son ordinateur : son mot de passe d'abord, rien d'autre
    const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
    const p2 = await ctx.newPage();
    await brancher(p2, store);
    sansTuto(store, 'lucie@exemple.fr');
    await connexion(p2, 'lucie@exemple.fr', pw);
    await expect(p2.locator('#app')).toHaveAttribute('data-view', 'mdp', { timeout: 10000 });
    await expect(p2.locator('#rail')).toBeHidden();
    await p2.locator('#mdp1').fill('le-mien-a-moi-42');
    await p2.locator('#mdp2').fill('pas-le-meme-42');
    await p2.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(p2.locator('#mdpe')).toHaveText('Les deux ne sont pas pareils');
    await p2.locator('#mdp2').fill('le-mien-a-moi-42');
    await p2.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(p2.locator('#app')).toHaveAttribute('data-view', 'prof', { timeout: 10000 });
    expect(lucie.password).toBe('le-mien-a-moi-42');
    expect(licences(store).provisoires[lucie.id]).toBeFalsy();
    await expect(p2.locator('.pf-cb-lic')).toContainText('0/2 élèves');
    await ctx.close();
  });
});

/* Une professeure sous licence (2 places), son code et sa classe ; des élèves
   qui ont créé leur compte (Mirandola gratuit). */
function semer() {
  const store = nouveauStore();
  store.parDefaut = 'gratuit';                       // des comptes neufs : Mirandola gratuit
  const m = modele(store);
  const lucie = semerCompte(store, 'lucie@exemple.fr');
  faireProfesseur(store, 'lucie@exemple.fr', 'Lucie MIRA');
  sansTuto(store, 'lucie@exemple.fr');
  semerLicenceProf(store, 'lucie@exemple.fr', { places: 2 });
  etab(store).codesProfs[lucie] = 'K7QM2XRP';
  m.classes.push({ id: '00000000-0000-4000-8000-0000000000c1', name: 'Maths Tle', niveau: 'Tle', matiere: 'Maths',
    code: 'HJKMNPQR', owner: lucie, ouvert: true, validation: false, places: 40, fin: null, archivee: false, org: null, genre: 'classe' });
  // Léa vient de créer son compte : son accueil l'attend ; Tom et Zoé ont déjà fait le leur
  const eleves = {};
  for (const p of ['lea', 'tom', 'zoe']) {
    eleves[p] = semerCompte(store, p + '@exemple.fr');
    faireEleve(store, p + '@exemple.fr');
    if (p === 'lea') continue;
    sansTuto(store, p + '@exemple.fr');
    store.tables.prefs.find(r => r.user_id === eleves[p]).data.bienvenue = 1;
  }
  return { store, m, lucie, eleves, cid: m.classes[0].id };
}

/* Le code de la professeure, son prénom et son nom, sa classe : « Entrer ». */
async function entrerLeCode(page, prenom, nom) {
  await page.locator('#cecode').fill('K7QM-2XRP');
  await page.locator('#ceok').click();
  await page.locator('[data-cein="prenom"]').fill(prenom);
  await page.locator('[data-cein="nom"]').fill(nom);
  await page.locator('.ce-cl', { hasText: 'Maths Tle' }).click();
  await page.locator('#cego').click();
}

test('un élève entre le code dès son accueil : salle d’attente, Campus, puis accepté par sa professeure', async ({ page, browser }) => {
  const { store, m, eleves, cid } = semer();
  await brancher(page, store);
  await connexion(page, 'lea@exemple.fr');
  await expect(page.locator('#app')).toHaveAttribute('data-view', 'bienvenue', { timeout: 10000 });
  await expect(page.locator('html')).toHaveClass(/offre-gratuit/);            // un compte neuf : Mirandola gratuit
  await page.getByRole('button', { name: 'J’ai un code' }).click();
  await entrerLeCode(page, 'léa', 'martin');
  await expect(page.locator('.toast:not(.sort)')).toContainText('Demande envoyée', { timeout: 10000 });
  expect(m.demandes.map(x => [x.cid, x.uid, x.who])).toEqual([[cid, eleves.lea, 'Léa MARTIN']]);
  expect(offreDe(store, eleves.lea)).toBe('campus');
  // Campus dès la salle d'attente : plus rien de bridé (et son tuto ne lui proposera pas Mirandola+)
  await expect(page.locator('html')).not.toHaveClass(/offre-gratuit/, { timeout: 10000 });

  // la professeure l'accepte
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  const prof = await ctx.newPage();
  await brancher(prof, store);
  await connexion(prof, 'lucie@exemple.fr');
  await expect(prof.locator('#app')).toHaveAttribute('data-view', 'prof', { timeout: 10000 });
  await expect(prof.locator('.pf-cb-lic')).toContainText('1 en attente');
  await prof.locator('.pf-cb-lic').click();
  await expect(prof.locator('.pf-mini')).toContainText('en attente');
  await prof.keyboard.press('Escape');
  await prof.locator('.pf-nav [data-pf="classe"]', { hasText: 'Maths Tle' }).click();
  await prof.locator('[data-pf="onglet"][data-v="demandes"]').click();
  await expect(prof.locator('.pf-dem')).toContainText('Léa MARTIN');
  await prof.locator('.pf-dem [data-pf="admettre"]').click();
  await expect.poll(() => m.membres.some(x => x.cid === cid && x.uid === eleves.lea)).toBe(true);
  expect(m.demandes).toHaveLength(0);
  expect(offreDe(store, eleves.lea)).toBe('campus');
  await ctx.close();
});

test('refusé, l’élève retombe en gratuit et reçoit un mot ; la licence pleine arrête le suivant ; la professeure commande des places', async ({ page, browser }) => {
  const { store, m, eleves, cid } = semer();
  m.membres.push({ cid, uid: eleves.lea, depuis: new Date().toISOString(), who: 'Léa MARTIN' });
  m.demandes.push({ cid, uid: eleves.tom, depuis: new Date().toISOString(), who: 'Tom DURAND' });
  expect(offreDe(store, eleves.tom)).toBe('campus');

  await page.setViewportSize({ width: 1360, height: 900 });
  await brancher(page, store);
  await connexion(page, 'lucie@exemple.fr');
  await expect(page.locator('#app')).toHaveAttribute('data-view', 'prof', { timeout: 10000 });
  await expect(page.locator('.pf-cb-lic')).toContainText('1/2 élèves');
  await page.locator('.pf-nav [data-pf="classe"]', { hasText: 'Maths Tle' }).click();
  await page.locator('[data-pf="onglet"][data-v="demandes"]').click();
  await page.locator('.pf-dem', { hasText: 'Tom DURAND' }).locator('[data-pf="refuser"]').click();
  await expect.poll(() => m.demandes.length).toBe(0);
  expect(offreDe(store, eleves.tom)).toBe('gratuit');
  const mot = (store.tables.mail || []).find(x => x.to_user === eleves.tom);
  expect(mot.message).toContain('pas validé');
  expect(mot.cards).toEqual([]);

  // Zoé entre : il reste une place, elle la prend (en attente) ; Tom, revenu, trouve plein
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const zoe = await ctx.newPage();
  await brancher(zoe, store);
  await connexion(zoe, 'zoe@exemple.fr');
  await expect(zoe.locator('#app')).toHaveAttribute('data-view', 'home', { timeout: 10000 });
  await zoe.getByRole('button', { name: 'Réglages' }).first().click();
  await zoe.locator('[data-ce="ouvrir"]').first().click();
  await entrerLeCode(zoe, 'Zoé', 'Petit');
  await expect(zoe.locator('.toast:not(.sort)')).toContainText('Demande envoyée', { timeout: 10000 });
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const tom = await ctx2.newPage();
  await brancher(tom, store);
  await connexion(tom, 'tom@exemple.fr');
  await expect(tom.locator('#app')).toHaveAttribute('data-view', 'home', { timeout: 10000 });
  await tom.getByRole('button', { name: 'Réglages' }).first().click();
  await tom.locator('[data-ce="ouvrir"]').first().click();
  await tom.locator('#cecode').fill('K7QM-2XRP');
  await tom.locator('#ceok').click();
  await expect(tom.locator('#cerep')).toContainText('Ton professeur n’a plus de place');
  await ctx.close(); await ctx2.close();

  // la professeure, revenue sur son accueil, voit sa licence pleine et commande des places
  await page.goto('./app');
  await expect(page.locator('#app')).toHaveAttribute('data-view', 'prof', { timeout: 10000 });
  await expect(page.locator('.pf-cb-lic')).toContainText('0 libre', { timeout: 10000 });
  await page.locator('.pf-cb-lic').click();
  await page.locator('#pfnb').fill('5');
  await page.locator('[data-pf="places-go"]').click();
  await expect.poll(() => licences(store).demandes.map(d => d.places)).toEqual([5]);
});
