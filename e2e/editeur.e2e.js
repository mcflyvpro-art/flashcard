// La console de l'éditeur (2026-10-26) : chaque établissement du premier
// contact au client — la demande arrivée du site, la démo en un geste, le
// code référent transmis par courriel, la licence —, et les comptes.
import { test, expect } from '@playwright/test';
import { brancher, nouveauStore } from './faux-supabase.js';
import { semerCompte } from './faux-cercle.js';
import { modele } from './faux-classes.js';
import { semerEtablissement } from './faux-etablissement.js';

function editeurEtProspect(store) {
  const m = modele(store);
  const moi = semerCompte(store, 'editeur@folio.fr');
  m.roles[moi] = 'admin'; m.noms[moi] = 'Clément';
  store.tables.prefs = [{ id: moi, user_id: moi, data: { tuto: 1 } }];
  const { org } = semerEtablissement(store, { nom: 'Collège Hugo', ville: 'Lyon', statut: 'prospect', fin: null, places: null,
    sansRef: true });
  org.codes = { eleve: null, prof: null, ref: null };
  Object.assign(org.suivi, { source: 'demande', contact_nom: 'M. Péguy', contact_email: 'principal@hugo.fr',
    eleves_estimes: 450, message: 'Pour nos 3e, avant le brevet.' });
  semerEtablissement(store, { nom: 'Lycée Zola', statut: 'client', offre: 'etablissement', places: 900 });
  const tuteur = semerCompte(store, 'tuteur@exemple.fr');
  m.noms[tuteur] = 'Paul Martin';
  return { org, tuteur };
}

async function entrer(page) {
  await page.goto('./');
  await expect(page.locator('#boot')).toHaveCount(0, { timeout: 10000 });
  await expect(page.getByRole('textbox', { name: 'Adresse e-mail' })).toBeFocused();
  await page.getByRole('textbox', { name: 'Adresse e-mail' }).fill('editeur@folio.fr');
  await page.getByRole('textbox', { name: 'Mot de passe' }).fill('motdepasse-solide-42');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.locator('#boot')).toHaveCount(0);
  await expect(page.locator('.ed-chiffres')).toBeVisible({ timeout: 10000 });     // l'éditeur arrive sur sa console
  await expect(page).toHaveURL(/\/admin$/);
}

test.describe('sur ordinateur', () => {
  test.use({ viewport: { width: 1360, height: 900 } });

  test('une demande du site : la démo, le code par courriel, puis la licence', async ({ page }) => {
    const store = nouveauStore();
    const { org } = editeurEtProspect(store);
    await brancher(page, store);
    await entrer(page);

    await page.locator('[data-adm="voir-demandes"]').click();
    await expect(page.locator('.ed-puces .on')).toContainText('Prospect');
    await page.locator('.ed-ligne', { hasText: 'Collège Hugo' }).click();
    await expect(page.locator('.ed-message')).toContainText('avant le brevet');
    await expect(page.locator('#ed-dpl')).toHaveValue('450');

    await page.locator('#ed-dpl').fill('120');
    await page.getByRole('button', { name: 'Lancer', exact: true }).click();
    await expect(page.locator('.ed-code')).toBeVisible();
    expect(org.places).toBe(120);
    expect(org.suivi.statut).toBe('demo');
    await expect(page.locator('.ed-code')).toHaveText(org.codes.ref.slice(0, 4) + '-' + org.codes.ref.slice(4));
    const lien = await page.locator('a.ed-b.pri').getAttribute('href');
    expect(lien.startsWith('mailto:principal%40hugo.fr?')).toBe(true);
    expect(decodeURIComponent(lien)).toContain(org.codes.ref.slice(0, 4) + '-' + org.codes.ref.slice(4));
    await expect(page.locator('#edetape')).toHaveValue('demo');

    // le référent a utilisé son code : la prochaine étape est la licence
    org.codes.ref = null;
    await page.locator('#ef-notes').fill('Démo lancée, rappeler fin novembre.');
    await page.locator('#edfiche').getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect(page.locator('#edlicence')).toBeVisible();
    await page.locator('#lp-pl').fill('450');
    await page.locator('#lp-prix').fill('1350');
    await page.getByRole('button', { name: 'Passer en licence' }).click();
    await expect.poll(() => org.suivi.statut).toBe('client');
    expect(org.offre).toBe('etablissement');
    expect(org.places).toBe(450);
    await expect.poll(() => org.suivi.prix_euros).toBe(1350);
    expect(org.suivi.notes).toContain('fin novembre');
    expect(await page.evaluate(() => document.body.scrollWidth)).toBeLessThanOrEqual(1360);
  });

  test('un établissement créé à la main, effacé ; un professeur particulier nommé', async ({ page }) => {
    const store = nouveauStore();
    const { tuteur } = editeurEtProspect(store);
    await brancher(page, store);
    await entrer(page);

    await page.locator('[data-adm="nouveau"]').click();
    await page.locator('#ef-nom').fill('Lycée Neuf');
    await page.locator('#ef-ville').fill('Arles');
    await page.locator('#ef-uai').fill('0130001x');
    await page.locator('.ed-besoins label', { hasText: 'Devoirs' }).click();
    await page.getByRole('button', { name: 'Créer', exact: true }).click();
    await expect(page.locator('.ed-qui b')).toHaveText('Lycée Neuf');
    const neuf = store.et.orgs.find(o => o.nom === 'Lycée Neuf');
    expect(neuf.uai).toBe('0130001X');
    expect(neuf.suivi.besoins).toEqual(['devoirs']);

    const effacer = page.locator('[data-adm="supprimer"]');
    await effacer.click();
    await expect(effacer).toContainText('Sûr ?');
    await effacer.click();
    await expect(page.locator('.ed-ligne', { hasText: 'Lycée Neuf' })).toHaveCount(0);
    expect(store.et.orgs.some(o => o.nom === 'Lycée Neuf')).toBe(false);

    await page.locator('#rail [data-r="adm:comptes"]').click();
    await page.locator('#edcq').fill('tuteur');
    await page.locator('.ed-ligne', { hasText: 'tuteur@exemple.fr' }).click();
    await page.locator('[data-adm="role"][data-id="prof"]').click();
    await expect.poll(() => store.cl.roles[tuteur]).toBe('prof');
    await expect(page.locator('[data-adm="role"].on')).toHaveText('Professeur');
  });

  test('facturer : l’entreprise, les coordonnées du client, une facture à son adresse, payée, un avoir ; un message', async ({ page }) => {
    const store = nouveauStore();
    editeurEtProspect(store);
    const zola = store.et.orgs.find(o => o.nom === 'Lycée Zola');
    zola.suivi.prix_euros = 2700;
    store.et.echanges = [{ id: 1, org_id: zola.id, de: 'etab', auteur: null, sujet: 'places', message: 'Cinquante places de plus ?',
      cree: new Date().toISOString(), lu: null }];
    await brancher(page, store);
    await entrer(page);
    await expect(page.locator('.ed-ligne', { hasText: 'Lycée Zola' })).toContainText('message');

    // pas de facture sans l'identité du vendeur
    await page.locator('#rail [data-r="adm:entreprise"]').click();
    await expect(page).toHaveURL(/\/admin\/entreprise$/);
    await page.locator('#ev-raison_sociale').fill('Folio');
    await page.locator('#ev-forme').fill('EI');
    await page.locator('#ev-adresse').fill('1 rue des Livres');
    await page.locator('#ev-code_postal').fill('30000');
    await page.locator('#ev-ville').fill('Nîmes');
    await page.locator('#ev-siret').fill('912 345 678 00011');
    await page.locator('#ev-iban').fill('FR76 3000 6000 0112 3456 7890 189');
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect.poll(() => store.et.vendeur && store.et.vendeur.siret).toBe('91234567800011');

    await page.locator('#rail [data-r="adm:suivi"]').click();
    await page.locator('.ed-ligne', { hasText: 'Lycée Zola' }).click();
    // le message lu en ouvrant la fiche, puis la réponse
    await expect(page.locator('.ed-msg.eux')).toContainText('Cinquante places');
    await page.locator('#edrmsg').fill('C’est fait, la facture suit.');
    await page.locator('#edrepondre').getByRole('button', { name: 'Répondre' }).click();
    await expect(page.locator('.ed-msg.moi')).toContainText('la facture suit');
    expect(store.et.echanges.every(e => e.de === 'folio' || e.lu)).toBe(true);
    await expect(page.locator('.ed-ligne', { hasText: 'Lycée Zola' })).not.toContainText('message');

    // les coordonnées du client manquent : le formulaire est ouvert
    await page.locator('#ec-nom').fill('Lycée Émile Zola');
    await page.locator('#ec-adresse').fill('2 rue Neuve');
    await page.locator('#ec-ville').fill('Aix');
    await page.locator('#edclient').getByRole('button', { name: 'Enregistrer' }).click();
    await expect.poll(() => zola.facturation && zola.facturation.ville).toBe('Aix');

    // la facture : la licence proposée à son prix, l'aperçu, puis sa page à elle
    await page.locator('#edemettre summary').click();
    await expect(page.locator('#fl-pu-0')).toHaveValue('2700');
    await expect(page.locator('#edapercu')).toContainText('2 700,00');
    await page.getByRole('button', { name: 'Émettre' }).click();
    await expect(page).toHaveURL(/\/admin\/factures\/[0-9a-f-]+$/);
    const an = new Date().getFullYear();
    await expect(page.locator('.fa-feuille')).toContainText(`F-${an}-0001`);
    await expect(page.locator('.fa-feuille')).toContainText('Lycée Émile Zola');
    await expect(page.locator('.fa-feuille')).toContainText('IBAN FR7630006000011234567890189');
    await page.locator('[data-adm="payee"]').click();
    await expect(page.locator('[data-adm="payee"]')).toContainText('Payée le');
    const avoir = page.locator('[data-adm="avoir"]');
    await avoir.click();
    await expect(avoir).toContainText('Sûr ?');
    await avoir.click();
    await expect(page.locator('.fa-feuille')).toContainText(`A-${an}-0001`);
    await expect(page.locator('.fa-feuille')).toContainText(`Sur la facture F-${an}-0001`);
    expect(store.et.factures.map(f => f.total_ttc)).toEqual([270000, -270000]);
    await page.locator('[data-adm="piece-fin"]').click();
    await expect(page.locator('.ed-piece')).toHaveCount(2);
    const facture = page.locator('.ed-piece').filter({ has: page.getByText(`F-${an}-0001`, { exact: true }) });
    await expect(facture).toContainText('Annulée par avoir');
  });
});

test('au téléphone : la liste, puis la fiche, et retour', async ({ page }) => {
  const store = nouveauStore();
  editeurEtProspect(store);
  await brancher(page, store);
  await entrer(page);
  await page.locator('.ed-ligne', { hasText: 'Lycée Zola' }).click();
  await expect(page.locator('.ed-qui b')).toHaveText('Lycée Zola');
  await expect(page.locator('.ed-ligne', { hasText: 'Collège Hugo' })).toHaveCount(0);
  await page.locator('[data-adm="fermer"]').click();
  await expect(page.locator('.ed-ligne', { hasText: 'Collège Hugo' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('sans compte, un principal demande une démo ; l’éditeur la voit arriver', async ({ page }) => {
  const store = nouveauStore();
  const m = modele(store);
  const moi = semerCompte(store, 'editeur@folio.fr');
  m.roles[moi] = 'admin';
  store.tables.prefs = [{ id: moi, user_id: moi, data: { tuto: 1 } }];
  await brancher(page, store);
  await page.goto('./');
  await expect(page.locator('#boot')).toHaveCount(0, { timeout: 10000 });

  await page.getByRole('button', { name: 'Un établissement ? Demander une démo' }).click();
  await page.getByLabel('Établissement').fill('Collège Jean Moulin');
  await page.getByLabel('Ville').fill('Arles');
  await page.getByLabel('Votre nom').fill('Mme Lefèvre');
  await page.getByLabel('Votre fonction').selectOption('Direction');
  await page.getByLabel('E-mail').fill('pas-une-adresse');
  await page.getByLabel('Nombre d’élèves').fill('520');
  await page.getByRole('button', { name: 'Demander une démo' }).click();
  await expect(page.locator('.dd-rep.ko')).toContainText('adresse e-mail');
  await expect(page.getByLabel('Établissement')).toHaveValue('Collège Jean Moulin');   // rien n'est perdu
  await page.getByLabel('E-mail').fill('direction@moulin.fr');
  await page.getByRole('button', { name: 'Demander une démo' }).click();
  await expect(page.locator('.dd-merci')).toContainText('Merci');
  const o = store.et.orgs.find(x => x.nom === 'Collège Jean Moulin');
  expect(o.suivi).toMatchObject({ source: 'demande', statut: 'prospect', contact_email: 'direction@moulin.fr', eleves_estimes: 520 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

  await page.locator('.dd-merci [data-act="tolog"]').click();
  // l'écran de connexion rend le focus à l'e-mail 80 ms après s'être affiché (aide.js) : taper avant,
  // c'était voir le mot de passe atterrir dans le champ e-mail sur une machine chargée
  await expect(page.getByRole('textbox', { name: 'Adresse e-mail' })).toBeFocused();
  await page.getByRole('textbox', { name: 'Adresse e-mail' }).fill('editeur@folio.fr');
  await page.getByRole('textbox', { name: 'Mot de passe' }).fill('motdepasse-solide-42');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.locator('[data-adm="voir-demandes"] b')).toHaveText('1', { timeout: 10000 });
  await expect(page.locator('.ed-ligne', { hasText: 'Collège Jean Moulin' })).toContainText('demande');
});
