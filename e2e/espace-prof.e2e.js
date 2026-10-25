// L'espace professeur et « Mes classes », de bout en bout (2026-10-24) : un
// professeur crée sa classe, crée les comptes à carte de deux élèves et
// projette le code ; un élève à compte personnel rejoint avec son vrai nom
// et attend ; le professeur l'admet et donne un devoir ; l'élève à carte se
// connecte avec son identifiant et son code et trouve le devoir.
//
// Sur téléphone (390 px, le projet Playwright) et sur ordinateur (1440 px) :
// aucun écran ne déborde. Les captures (SHOTS=dossier) servent à relire les
// écrans à l'œil ; elles ne sont pas comparées.
import { test, expect } from '@playwright/test';
import { brancher, nouveauStore, semerLivre } from './faux-supabase.js';
import { faireProfesseur } from './faux-classes.js';
import { inscrire } from './aide.js';

const SHOTS = process.env.SHOTS;

async function voir(page, nom, largeur, serie = largeur) {
  await expect(page.locator('#boot')).toHaveCount(0);
  await page.waitForTimeout(500);
  const l = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(l, `${nom} déborde à ${largeur} px`).toBeLessThanOrEqual(largeur);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${serie}-${nom}.png`, fullPage: false });
}

for (const largeur of [390, 1440]) {
  test(`professeur à ${largeur} px : créer une classe, des comptes à carte, admettre, donner un devoir`, async ({ page, browser }, info) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width: largeur, height: largeur > 900 ? 900 : 844 });
    const store = nouveauStore();
    await brancher(page, store);
    const erreurs = [];
    page.on('pageerror', e => erreurs.push(e.message));

    await inscrire(page, 'durand@exemple.fr');
    faireProfesseur(store, 'durand@exemple.fr', 'Claire DURAND');
    semerLivre(store, 'durand@exemple.fr', 'Verbes irréguliers', [['be', 'été'], ['go', 'aller'], ['see', 'voir'], ['take', 'prendre']]);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Votre première classe' })).toBeVisible({ timeout: 10000 });
    await voir(page, '01-accueil-vide', largeur);

    // un code collègue : la feuille le met en forme et ne vérifie qu'un code complet
    await page.getByRole('button', { name: 'J’ai un code collègue' }).click();
    await page.getByRole('textbox', { name: 'Code collègue' }).fill('abcd efg');
    await expect(page.getByRole('button', { name: 'Vérifier le code' })).toBeDisabled();
    await page.getByRole('textbox', { name: 'Code collègue' }).fill('abcdefgh');
    await expect(page.getByRole('textbox', { name: 'Code collègue' })).toHaveValue('ABCD-EFGH');
    await expect(page.getByRole('button', { name: 'Vérifier le code' })).toBeEnabled();
    await page.locator('.menu .mx').click();

    // créer la classe : la feuille d'ajout des élèves s'ouvre aussitôt
    await page.getByRole('button', { name: 'Créer une classe' }).click();
    await expect(page.getByLabel('Nom')).toBeFocused();
    await page.getByLabel('Nom').fill('2nde 4');
    await page.getByLabel('Niveau facultatif').fill('Seconde');
    await page.getByLabel('Matière facultatif').fill('Anglais');
    await voir(page, '02-creer', largeur);
    await page.getByRole('button', { name: 'Créer la classe' }).click();
    await expect(page.getByRole('button', { name: 'Créer les comptes' })).toBeVisible();

    // deux élèves collés depuis une liste : deux comptes à carte
    await page.locator('#pfliste').fill('MARTIN Alice\nN’DIAYE Awa\n');
    await expect(page.getByRole('button', { name: 'Créer 2 comptes' })).toBeEnabled();
    await voir(page, '03-liste', largeur);
    await page.getByRole('button', { name: 'Créer 2 comptes' }).click();
    await expect(page.getByText('alice.martin')).toBeVisible();
    await voir(page, '04-cartes-creees', largeur);
    await page.getByRole('button', { name: 'Terminé' }).click();
    await expect(page.locator('.pf-t-eleves')).toContainText('Alice MARTIN');
    await voir(page, '05-classe-eleves', largeur);

    // un élève à compte personnel demande à entrer avec le code
    const code = store.cl.classes[0].code;
    // un autre téléphone : un autre contexte, sans la session du professeur
    const autre = await browser.newContext({ ...info.project.use, viewport: { width: 390, height: 844 } });
    const eleve = await autre.newPage();
    await brancher(eleve, store);
    await inscrire(eleve, 'leo@exemple.fr');
    await eleve.goto('./?rejoindre=' + code);
    await expect(eleve.getByText('2nde 4')).toBeVisible({ timeout: 10000 });
    await eleve.getByLabel('Prénom').fill('léo');
    await eleve.getByLabel('Nom', { exact: true }).fill('dubois');
    await expect(eleve.getByText('Tu apparaîtras comme Léo DUBOIS')).toBeVisible();
    await voir(eleve, '06-eleve-apercu', 390, largeur);
    await eleve.getByRole('button', { name: 'Rejoindre', exact: true }).click();
    await expect(eleve.getByText('En attente de Claire DURAND')).toBeVisible();
    await voir(eleve, '07-eleve-attente', 390, largeur);

    // le professeur le voit dans les demandes et l'admet
    await page.getByRole('tab', { name: /Demandes/ }).click();
    await expect(page.getByText('Léo DUBOIS')).toBeVisible({ timeout: 10000 });
    await voir(page, '08-demandes', largeur);
    await page.getByRole('button', { name: 'Admettre', exact: true }).click();
    await page.getByRole('tab', { name: /Élèves/ }).click();
    await expect(page.locator('.pf-t-eleves')).toContainText('Léo DUBOIS');

    // projeter le code au tableau
    await page.getByRole('button', { name: 'Plus d’actions' }).click();
    await page.getByRole('button', { name: 'Projeter le code au tableau' }).click();
    await expect(page.locator('.pf-tb-code')).toHaveText(code.slice(0, 4) + '-' + code.slice(4));
    await voir(page, '09-tableau', largeur);
    await page.locator('.menu .mx').click();

    // donner un devoir depuis un livre de la bibliothèque
    await page.getByRole('button', { name: 'Devoir', exact: true }).click();
    await page.getByRole('button', { name: /Verbes irréguliers/ }).click();
    await voir(page, '10-donner', largeur);
    await page.getByRole('button', { name: 'Dans 1 semaine' }).click();
    await page.getByRole('button', { name: 'Donner', exact: true }).click();
    await expect(page.locator('.pf-t-devoirs')).toContainText('Verbes irréguliers');
    await voir(page, '11-devoirs', largeur);
    await page.getByRole('tab', { name: 'Bilan' }).click();
    await voir(page, '12-bilan', largeur);
    await page.getByRole('tab', { name: 'Réglages' }).click();
    await voir(page, '13-reglages', largeur);
    await page.getByRole('button', { name: 'Tableau de bord' }).first().click();
    await expect(page.locator('.pf-kc').first()).toContainText('2nde 4');
    await voir(page, '14-accueil', largeur);

    // l'élève admis trouve le devoir
    // (un compte personnel arrive sur sa bibliothèque ; une fois dans une classe, l'onglet « Classe » apparaît)
    await eleve.reload();
    await eleve.getByRole('button', { name: 'Classe', exact: true }).click();
    await expect(eleve.getByText('Verbes irréguliers')).toBeVisible({ timeout: 10000 });
    await voir(eleve, '15-eleve-devoir', 390, largeur);
    expect(erreurs, 'erreurs JavaScript côté professeur').toEqual([]);
    await autre.close();
    if (largeur !== 390) return;

    // les élèves à carte : identifiant + code tapés, puis le QR de la carte
    const telephone = async () => {
      const ctx = await browser.newContext({ ...info.project.use, viewport: { width: 390, height: 844 } });
      const p = await ctx.newPage();
      await brancher(p, store);
      return [ctx, p];
    };
    const carte = id => store.users.find(u => u.email === id + '@eleves.folio.invalid');
    const [c1, alice] = await telephone();
    await alice.goto('./');
    await expect(alice.locator('#boot')).toHaveCount(0, { timeout: 10000 });
    await alice.getByRole('button', { name: 'Carte élève' }).click();
    await alice.getByLabel('Identifiant').fill('alice.martin');
    await alice.getByLabel('Code').fill('ABCD-EFGH');
    await alice.getByRole('button', { name: 'Se connecter' }).click();
    await expect(alice.getByText('Identifiant ou code incorrect')).toBeVisible();
    await alice.getByLabel('Code').fill(carte('alice.martin').password.toLowerCase());
    await expect(alice.getByLabel('Code')).toHaveValue(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    await voir(alice, '16-connexion-carte', 390);
    await alice.getByRole('button', { name: 'Se connecter' }).click();
    // un élève à carte arrive sur ses devoirs, sous le nom de la liste de classe
    await expect(alice.getByText('Verbes irréguliers')).toBeVisible({ timeout: 10000 });
    await expect(alice.locator('.el-qui')).toContainText('Alice MARTIN');
    await voir(alice, '17-carte-mes-classes', 390);
    // M17.T1 : deux gestes pour commencer — le devoir, puis « Lire »
    await alice.getByRole('button', { name: /Verbes irréguliers/ }).click();
    await alice.getByRole('button', { name: /^Lire/ }).click();
    await expect(alice.locator('.face').first()).toBeVisible();
    await c1.close();

    const [c2, awa] = await telephone();
    await awa.goto('./?carte=awa.ndiaye-' + carte('awa.ndiaye').password);
    await expect(awa.getByText('Verbes irréguliers')).toBeVisible({ timeout: 10000 });
    await expect(awa.locator('.el-qui')).toContainText('Awa N’DIAYE');
    expect(new URL(awa.url()).search, 'le code ne reste pas dans l’adresse').toBe('');
    await c2.close();
  });
}
