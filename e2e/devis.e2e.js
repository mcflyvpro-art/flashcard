// Le devis (2026-11-14) : Mirandola Campus se vend sur devis. L'éditeur
// l'émet depuis la fiche d'un établissement (la licence proposée au prix de
// la grille), le référent le lit dans sa Licence et l'accepte en ligne, puis
// l'éditeur ouvre la licence et facture d'un geste. Deux personnes, deux
// contextes, la même base.
import { test, expect } from '@playwright/test';
import { brancher, nouveauStore } from './faux-supabase.js';
import { semerCompte } from './faux-cercle.js';
import { modele } from './faux-classes.js';
import { etab, semerEtablissement } from './faux-etablissement.js';
import { fonctionsFacturation } from '../src/base-locale/facturation.js';

/* Un lycée en démo de 60 places, sa référente ; l'éditeur, son entreprise
   enregistrée ; les coordonnées de facturation du lycée. */
function decor(store) {
  const { org } = semerEtablissement(store, { nom: 'Lycée Camus', ville: 'Nîmes', classes: ['2nde A'], contact: 'Mme Roux' });
  const m = modele(store), et = etab(store);
  const compte = (email, role, nom) => {
    const id = semerCompte(store, email);
    m.roles[id] = role; m.noms[id] = nom;
    store.tables.prefs = [...(store.tables.prefs || []), { id, user_id: id, data: { tuto: 1 } }];
    return id;
  };
  const ref = compte('ref@lycee.fr', 'ref', 'Claire ROUX');
  et.membres[ref] = org.id;
  const editeur = compte('editeur@folio.fr', 'admin', 'Clément');
  org.suivi.contact_email = 'intendance@camus.fr';
  org.facturation = { nom: 'Lycée Albert Camus', adresse: '51 avenue Kennedy', code_postal: '30000', ville: 'Nîmes', siret: '',
    service: '', engagement: '', email: '' };
  fonctionsFacturation(store, et, m, editeur).admin_vendeur_enregistrer({ fiche: { raison_sociale: 'Mirandola', forme: 'EI',
    adresse: '1 rue des Paquets', code_postal: '30000', ville: 'Nîmes', siret: '91234567800011', regime_tva: 'franchise', delai_jours: '30' } });
  return { org, et };
}

async function entrer(page, email, vue) {
  await page.goto('./app');
  await expect(page.locator('#boot')).toHaveCount(0, { timeout: 10000 });
  await page.getByRole('textbox', { name: 'Adresse e-mail' }).fill(email);
  await page.getByRole('textbox', { name: 'Mot de passe' }).fill('motdepasse-solide-42');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.locator('#app')).toHaveAttribute('data-view', vue, { timeout: 10000 });
}

test.describe('sur ordinateur', () => {
  test.use({ viewport: { width: 1360, height: 900 } });

  test('un devis émis par l’éditeur, accepté en ligne par le référent, puis la licence ouverte et la facture émise d’un geste', async ({ browser }) => {
    const store = nouveauStore();
    const { org, et } = decor(store);
    const an = new Date().getFullYear();
    const chezEditeur = await browser.newContext({ viewport: { width: 1360, height: 900 } });
    const chezReferent = await browser.newContext({ viewport: { width: 1360, height: 900 } });
    await brancher(chezEditeur, store);
    await brancher(chezReferent, store);
    const ed = await chezEditeur.newPage(), rf = await chezReferent.newPage();

    // ── l'éditeur : la fiche du lycée, « Faire un devis » ──
    await entrer(ed, 'editeur@folio.fr', 'admin');
    await ed.locator('.ed-ligne', { hasText: 'Lycée Camus' }).click();
    await ed.locator('#dvnouveau summary').click();
    await expect(ed.locator('#dv-places')).toHaveValue('60');                 // les places de la démo, d'office
    await ed.locator('#dv-places').fill('300');
    // 300 places à la grille : 100 × 5 € + 200 × 3,50 € = 1 200 € HT
    await expect(ed.locator('#dv-pu-0')).toHaveValue('1200');
    await expect(ed.locator('#dv-lib-0')).toHaveValue(/^Licence Mirandola Campus, 300 places/);
    await expect(ed.locator('#dvapercu')).toContainText('1 200,00');
    await expect(ed.locator('#dvapercu')).toContainText('art. 293 B');
    await ed.getByRole('button', { name: 'Émettre le devis' }).click();
    await expect(ed).toHaveURL(/\/admin\/factures\/d-[0-9a-f-]+$/);
    const feuille = ed.locator('.fa-feuille');
    await expect(feuille).toContainText(`D-${an}-0001`);
    await expect(feuille.locator('h1')).toHaveText('Devis');
    await expect(feuille).toContainText('Lycée Albert Camus');
    await expect(feuille).toContainText('Valable jusqu’au');
    await expect(feuille).toContainText('300 places');
    await expect(feuille.locator('.dv-accord')).toContainText('Signature et cachet');
    await expect(ed.locator('.ed-barre-piece .ed-etat')).toContainText('Valable jusqu’au');
    // le message au contact, tout écrit
    const lien = await ed.locator('.ed-barre-piece a[href^="mailto:"]').getAttribute('href');
    expect(lien.startsWith('mailto:intendance@camus.fr?')).toBe(true);
    expect(decodeURIComponent(lien)).toContain(`le devis D-${an}-0001`);
    expect(decodeURIComponent(lien)).toContain('onglet Licence');
    // pas encore accepté : rien à facturer
    await expect(ed.locator('[data-dv="facturer"]')).toHaveCount(0);
    // son adresse se recharge
    await ed.reload();
    await expect(ed.locator('#boot')).toHaveCount(0, { timeout: 10000 });
    await expect(ed.locator('.fa-feuille')).toContainText(`D-${an}-0001`);

    // ── le référent : sa Licence, le devis, « bon pour accord » ──
    await entrer(rf, 'ref@lycee.fr', 'ref');
    await rf.locator('#rail [data-r="ref:licence"]').click();
    const ligne = rf.locator('.rf-piece[data-dv="ouvrir"]');
    await expect(ligne).toContainText(`D-${an}-0001`);
    await expect(ligne).toContainText('1 200,00');
    await ligne.click();
    await expect(rf).toHaveURL(/\/referent\/licence\/factures\/d-[0-9a-f-]+$/);
    await expect(rf.locator('.fa-feuille')).toContainText('1 200,00');
    // sans nom, pas d'accord
    await rf.locator('#dva-nom').fill('ab');
    await rf.getByRole('button', { name: 'Accepter le devis' }).click();
    expect(et.devis[0].statut).toBe('envoye');
    await rf.locator('#dva-nom').fill('Claire Roux, proviseure');
    await rf.locator('#dva-bc').fill('BC-2026-042');
    await rf.getByRole('button', { name: 'Accepter le devis' }).click();
    await expect(rf.locator('.rf-barre-piece .rf-etat')).toContainText('Accepté');
    await expect(rf.locator('#dvaccord')).toHaveCount(0);                      // une réponse ne se redonne pas
    await expect(rf.locator('.dv-accord.fait')).toContainText('par Claire Roux, proviseure');
    await expect(rf.locator('.dv-accord.fait')).toContainText('Bon de commande BC-2026-042');
    expect(et.devis[0]).toMatchObject({ statut: 'accepte', engagement: 'BC-2026-042' });
    expect(et.echanges.at(-1).message).toContain(`Devis D-${an}-0001 accepté par Claire Roux, proviseure`);

    // ── l'éditeur est prévenu, ouvre la licence et facture d'un geste ──
    await ed.goto('./admin');
    await expect(ed.locator('.ed-ligne', { hasText: 'Lycée Camus' })).toContainText('message', { timeout: 10000 });
    await ed.locator('.ed-ligne', { hasText: 'Lycée Camus' }).click();
    await ed.locator('.ed-piece[data-dv="ouvrir"]').click();
    const facturer = ed.locator('[data-dv="facturer"]');
    await expect(facturer).toContainText('Ouvrir la licence et facturer');
    await facturer.click();
    await expect(facturer).toContainText('Sûr ?');
    expect(et.factures || []).toHaveLength(0);                                 // le premier appui ne facture rien
    await facturer.click();
    await expect(ed.locator('.ed-barre-piece .ed-etat')).toContainText(`facture F-${an}-0001`);
    await expect(ed.locator('[data-dv="facturer"]')).toHaveCount(0);
    expect(org).toMatchObject({ offre: 'etablissement', places: 300 });
    expect(org.suivi).toMatchObject({ statut: 'client', prix_euros: 1200 });
    expect(et.factures).toHaveLength(1);
    expect(et.factures[0]).toMatchObject({ total_ht: 120000, engagement: 'BC-2026-042' });
    expect(et.factures[0].objet).toContain(`(devis D-${an}-0001)`);
    expect(et.devis[0].facture_id).toBe(et.factures[0].id);
    // du devis à sa facture
    await ed.locator('.ed-barre-piece [data-adm="piece"]').click();
    await expect(ed.locator('.fa-feuille h1')).toHaveText('Facture');
    await expect(ed.locator('.fa-feuille')).toContainText('Bon de commande BC-2026-042');

    // ── le référent retrouve sa licence ouverte, son devis et sa facture ──
    await rf.locator('[data-rf="lic-retour"]').click();
    await rf.reload();
    await expect(rf.locator('#boot')).toHaveCount(0, { timeout: 10000 });
    await expect(rf.locator('.rf-piece[data-dv="ouvrir"]')).toContainText(`facture F-${an}-0001`, { timeout: 10000 });
    await expect(rf.locator('.rf-piece[data-rf="lic-piece"]')).toContainText(`F-${an}-0001`);
    await expect(rf.locator('.rf-places .rf-kc', { hasText: 'places' })).toContainText('300');
    await chezEditeur.close(); await chezReferent.close();
  });

  test('l’éditeur note un accord reçu par courrier, se ravise, note un refus ; un devis sans places facture sans toucher la licence', async ({ page }) => {
    const store = nouveauStore();
    const { org, et } = decor(store);
    await brancher(page, store);
    await entrer(page, 'editeur@folio.fr', 'admin');
    await page.locator('.ed-ligne', { hasText: 'Lycée Camus' }).click();
    await page.locator('#dvnouveau summary').click();
    await page.locator('#dv-places').fill('');
    await page.locator('#dv-lib-0').fill('Formation des professeurs');
    await page.locator('#dv-q-0').fill('2');
    await page.locator('#dv-pu-0').fill('150');
    await expect(page.locator('#dvapercu')).toContainText('300,00');
    await page.getByRole('button', { name: 'Émettre le devis' }).click();
    await expect(page.locator('.fa-feuille')).toContainText('Formation des professeurs');

    await page.locator('#dvn-nom').fill('M. Péguy, gestionnaire');
    await page.locator('[data-dv="noter"][data-id="refuse"]').click();
    await expect(page.locator('.ed-barre-piece .ed-etat')).toHaveText('Refusé');
    await page.locator('[data-dv="noter"][data-id="envoye"]').click();            // noté à tort : il le rouvre
    await expect(page.locator('.ed-barre-piece .ed-etat')).toContainText('Valable jusqu’au');
    await page.locator('#dvn-nom').fill('M. Péguy, gestionnaire');
    await page.locator('#dvn-bc').fill('BC-7');
    await page.locator('[data-dv="noter"][data-id="accepte"]').click();
    await expect(page.locator('.dv-accord.fait')).toContainText('par M. Péguy, gestionnaire');
    const facturer = page.locator('[data-dv="facturer"]');
    await expect(facturer).toHaveText('Facturer');                               // ni places ni fin : la facture seule
    await facturer.click(); await facturer.click();
    await expect(page.locator('.ed-barre-piece .ed-etat')).toContainText('facture F-');
    expect(et.factures).toHaveLength(1);
    expect(et.factures[0].total_ht).toBe(30000);
    expect(org).toMatchObject({ offre: 'demo', places: 60 });                    // la licence n'a pas bougé
    await page.locator('[data-adm="piece-fin"]').click();
    await expect(page.locator('.ed-piece[data-dv="ouvrir"]')).toContainText('Accepté · facture F-');
  });
});
