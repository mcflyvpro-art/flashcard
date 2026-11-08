// L'IA de la création (2026-11-07) : plus un onglet, une barre sous chaque
// façon de créer. Sans rien, elle crée ou retouche la liste ; avec des photos,
// un PDF ou un texte collé, elle en fait des cartes comme on le lui demande.
// Ce qu'elle rend va droit dans la liste, et « Annuler » remet celle d'avant.
// Chaque envoi est une génération du mois, que la pastille décompte. Un élève
// Campus à qui sa licence n'accorde rien voit la barre grisée, et pourquoi.
// La fausse fonction ai (src/base-locale/ia.js) répond de façon prévisible :
// « a = b » fait une carte, « inverse… » échange recto et verso, une photo
// fait « Carte de la photo n » avec la consigne au verso.
import { test, expect } from '@playwright/test';
import { brancher, nouveauStore } from './faux-supabase.js';
import { semerCompte } from './faux-cercle.js';
import { faireEleve, faireProfesseur, modele } from './faux-classes.js';
import { semerLicenceProf } from '../src/base-locale/licences.js';
import { sansTuto } from './aide.js';

const MDP = 'motdepasse-solide-42';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const photo = n => ({ name: `page-${n}.png`, mimeType: 'image/png', buffer: PNG });

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
  await expect(page.getByRole('button', { name: 'Nouveau paquet' }).first()).toBeVisible({ timeout: 10000 });
}

async function nouveau(page, titre) {
  await page.getByRole('button', { name: 'Nouveau paquet' }).first().click();
  await page.locator('#nm').fill(titre);
  await expect(page.locator('.pi-tete')).toBeVisible({ timeout: 10000 });
}

const reste = page => page.locator('.pi .cr-reste');
const cartes = page => page.locator('#dlist .dc');
const ia = page => page.getByRole('textbox', { name: 'Demande à l’IA' });

test('sans rien sous la main : l’IA crée la liste, la retouche, et « Annuler » la remet ; chaque envoi compte', async ({ page }) => {
  const store = nouveauStore();                               // Mirandola+ (les comptes des parcours sont « d'avant »)
  const lea = eleve(store, 'lea@exemple.fr');
  await brancher(page, store);
  await connexion(page, 'lea@exemple.fr');
  await nouveau(page, 'Italien');

  // plus d'onglet « Prompt » : quatre façons de créer, et l'IA sous chacune
  await expect(page.getByRole('tab')).toHaveCount(4);
  await expect(page.getByRole('tab', { name: 'Prompt' })).toHaveCount(0);
  await expect(reste(page)).toHaveText('30', { timeout: 10000 });
  await expect(reste(page)).toHaveAttribute('title', '30 générations d’IA restent ce mois-ci, sur 30');

  // un début de consigne se pose dans la zone, il ne part pas seul
  await page.locator('.pi-puce', { hasText: '10 cartes sur' }).click();
  await expect(ia(page)).toHaveValue('10 cartes sur ');                   // l'espace attend le sujet
  await ia(page).fill('chat = gatto\nchien = cane');
  await page.getByRole('button', { name: 'Envoyer' }).click();
  await expect(cartes(page)).toHaveCount(2, { timeout: 10000 });          // droit dans la liste
  await expect(page.locator('.pi-b.moi')).toContainText('chat = gatto');
  await expect(page.locator('.pi-b.ia').last()).toContainText('2 cartes');
  await expect(reste(page)).toHaveText('29');
  await expect(ia(page)).toHaveValue('');

  // une retouche, en un appui : toute la liste revient, retournée
  await page.locator('.pi-puce', { hasText: 'Inverse recto et verso' }).click();
  await expect(cartes(page).last().locator('b')).toHaveText('gatto', { timeout: 10000 });
  await expect(reste(page)).toHaveText('28');
  // « Annuler » remet la liste d'avant, sans rien dépenser
  await page.getByRole('button', { name: 'Annuler' }).click();
  await expect(cartes(page).last().locator('b')).toHaveText('chat');
  await expect(page.getByRole('button', { name: 'Annuler' })).toHaveCount(0);
  await expect(reste(page)).toHaveText('28');

  // une autre, écrite (Ctrl+Entrée envoie)
  await ia(page).fill('ours = orso');
  await ia(page).press('Control+Enter');
  await expect(cartes(page)).toHaveCount(3, { timeout: 10000 });
  await expect(reste(page)).toHaveText('27');

  await page.getByRole('button', { name: 'Créer le paquet' }).click();
  await expect(page.getByRole('button', { name: 'Menu du paquet' })).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('textbox', { name: 'Recto' })).toHaveCount(3);
  expect(store.tables.ai_usage.filter(a => a.user_id === lea && a.op === 'prompt')).toHaveLength(3);
});

test('des cartes écrites à la main, puis l’IA les retouche', async ({ page }) => {
  const store = nouveauStore();
  eleve(store, 'lea@exemple.fr');
  await brancher(page, store);
  await connexion(page, 'lea@exemple.fr');
  await nouveau(page, 'Anglais');
  await page.locator('#cf').fill('to go');
  await page.locator('#cb').fill('aller');
  await page.locator('#cb').press('Enter');
  await expect(cartes(page)).toHaveCount(1);
  await ia(page).fill('Inverse recto et verso');
  await page.getByRole('button', { name: 'Envoyer' }).click();
  await expect(cartes(page).first().locator('b')).toHaveText('aller', { timeout: 10000 });
  await expect(cartes(page).first().locator('span')).toHaveText('to go');
});

test('des photos et une consigne : un seul envoi, les cartes dans la liste ; une photo se retire avant', async ({ page }) => {
  const store = nouveauStore();
  const lea = eleve(store, 'lea@exemple.fr');
  await brancher(page, store);
  await connexion(page, 'lea@exemple.fr');
  await nouveau(page, 'Histoire');
  await page.getByRole('tab', { name: 'Photo' }).click();
  await page.locator('#fshot').setInputFiles([photo(1), photo(2), photo(3)]);
  await expect(page.locator('.pi-ph')).toHaveCount(3);
  await page.getByRole('button', { name: 'Retirer la photo 3' }).click();
  await expect(page.locator('.pi-ph')).toHaveCount(2);
  await expect(ia(page)).toHaveAttribute('placeholder', /consigne/);

  await ia(page).fill('seulement les dates');
  await page.getByRole('button', { name: 'Créer les cartes' }).click();
  await expect(cartes(page)).toHaveCount(2, { timeout: 10000 });
  await expect(cartes(page).first().locator('span')).toHaveText('seulement les dates');
  await expect(page.locator('.pi-b.moi').last()).toContainText('2 photos');
  await expect(page.locator('.pi-b.ia').last()).toContainText('2 cartes ajoutées');
  await expect(page.locator('.pi-ph')).toHaveCount(0);                    // parties avec l'envoi
  // une génération pour les deux photos ; la consigne et le contexte à leur place
  expect(store.tables.ai_usage.filter(a => a.user_id === lea && a.op === 'ocr')).toHaveLength(1);
  expect(store.iaDemande).toMatchObject({ op: 'ocr', consigne: 'seulement les dates', images: 2 });
  expect(store.iaDemande.contexte).toContain('Histoire');
  await expect(reste(page)).toHaveText('29');
});

test('la fonction d’avant (une photo par appel) : les suivantes partent seules, avec la même consigne', async ({ page }) => {
  const store = { ...nouveauStore(), iaAncienne: true };
  const lea = eleve(store, 'lea@exemple.fr');
  await brancher(page, store);
  await connexion(page, 'lea@exemple.fr');
  await nouveau(page, 'Histoire');
  await page.getByRole('tab', { name: 'Photo' }).click();
  await page.locator('#fshot').setInputFiles([photo(1), photo(2)]);
  await ia(page).fill('une question au recto');
  await page.getByRole('button', { name: 'Créer les cartes' }).click();
  await expect(cartes(page)).toHaveCount(2, { timeout: 10000 });
  expect(store.tables.ai_usage.filter(a => a.user_id === lea && a.op === 'ocr')).toHaveLength(2);
  await expect(cartes(page).last().locator('span')).toHaveText('une question au recto');
});

test('un PDF et une consigne ; un texte collé et une consigne, sans doublon de la liste', async ({ page }) => {
  const store = nouveauStore();
  eleve(store, 'lea@exemple.fr');
  await brancher(page, store);
  await connexion(page, 'lea@exemple.fr');
  await nouveau(page, 'Histoire');

  await page.getByRole('tab', { name: 'Fichier' }).click();
  await page.locator('#fpdf').setInputFiles({ name: 'Chapitre 2.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 x') });
  await expect(page.locator('.pi-pdf')).toContainText('Chapitre 2.pdf');
  await ia(page).fill('le chapitre 2, en questions');
  await page.getByRole('button', { name: 'Créer les cartes' }).click();
  await expect(cartes(page)).toHaveCount(1, { timeout: 10000 });
  await expect(cartes(page).first().locator('span')).toHaveText('le chapitre 2, en questions');
  expect(store.iaDemande).toMatchObject({ op: 'pdf', consigne: 'le chapitre 2, en questions' });

  // un texte collé : l'IA le lit avec la consigne ; ce qui est déjà dans la liste n'y entre pas deux fois
  await page.getByRole('tab', { name: 'Coller' }).click();
  await page.locator('#tx').fill('Carte du PDF = le chapitre 2, en questions\nprise = Bastille');
  await ia(page).fill('garde tout');
  await page.getByRole('button', { name: 'Créer les cartes' }).click();
  await expect(cartes(page)).toHaveCount(2, { timeout: 10000 });
  await expect(page.locator('.pi-b.ia').last()).toContainText('1 carte ajoutée · 1 déjà là');
  await expect(page.locator('#tx')).toHaveValue('');                       // le texte est devenu des cartes
  expect(store.iaDemande.message).toContain('garde tout');
  expect(store.iaDemande.message).toContain('prise = Bastille');
});

test('l’IA épuisée le dit, la consigne revient et les photos attendent encore', async ({ page }) => {
  const store = nouveauStore();
  const lea = eleve(store, 'lea@exemple.fr');
  const jour = new Date().toISOString().slice(0, 10);
  store.tables.ai_usage = Array.from({ length: 30 }, () => ({ user_id: lea, day: jour, op: 'cards', cents: 0.4 }));
  await brancher(page, store);
  await connexion(page, 'lea@exemple.fr');
  await nouveau(page, 'Histoire');
  await expect(reste(page)).toHaveText('0', { timeout: 10000 });
  await expect(reste(page)).toHaveClass(/vide/);
  await page.getByRole('tab', { name: 'Photo' }).click();
  await page.locator('#fshot').setInputFiles([photo(1)]);
  await ia(page).fill('seulement les dates');
  await page.getByRole('button', { name: 'Créer les cartes' }).click();
  await expect(page.locator('.pi-b.err')).toContainText('Ton IA du mois est épuisée', { timeout: 10000 });
  await expect(ia(page)).toHaveValue('seulement les dates');
  await expect(page.locator('.pi-ph')).toHaveCount(1);
  await expect(cartes(page)).toHaveCount(0);
});

test('le plafond de coût du mois (rentabilité) : l’IA le dit en clair, un document trop lourd aussi', async ({ page }) => {
  const store = nouveauStore();
  eleve(store, 'lea@exemple.fr');
  await brancher(page, store);
  await connexion(page, 'lea@exemple.fr');
  await nouveau(page, 'Histoire');
  store.iaPanne = 'plafond';                                  // ce que rend la fonction ai au plafond du compte
  await ia(page).fill('10 cartes sur la Révolution');
  await page.getByRole('button', { name: 'Envoyer' }).click();
  await expect(page.locator('.pi-b.err')).toContainText('usage raisonnable du mois', { timeout: 10000 });
  await expect(ia(page)).toHaveValue('10 cartes sur la Révolution');
  store.iaPanne = 'lourd';
  await page.getByRole('button', { name: 'Envoyer' }).click();
  await expect(page.locator('.pi-b.err')).toContainText('document plus court', { timeout: 10000 });
});

test('un élève Campus sans IA : la barre, Photo et Fichier grisés, et pourquoi', async ({ page }) => {
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
  await page.getByRole('button', { name: 'Nouveau paquet' }).first().click();

  const barre = page.locator('.pi');
  await expect(barre).toHaveClass(/ferme/, { timeout: 10000 });
  await expect(barre).toHaveAttribute('data-astuce', 'Ton professeur n’a pas ouvert l’IA à ton compte');
  await expect(barre).not.toHaveAttribute('data-offre', 'plus');          // rien à acheter : c'est la licence
  for (const o of ['Fichier', 'Photo']) await expect(page.getByRole('tab', { name: o })).toHaveClass(/ferme/);
  await expect(page.locator('.cr-reste')).toHaveCount(0);
  await barre.click();
  await expect(page.locator('.toast:not(.sort)')).toContainText('Ton professeur n’a pas ouvert l’IA à ton compte');
  await expect(page.getByRole('tab', { name: 'Écrire' })).toHaveAttribute('aria-selected', 'true');
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
  await page.goto('./prof/paquets/nouveau');
  await expect(reste(page)).toHaveText('400', { timeout: 10000 });         // un professeur : 400 par mois

  store.iaPanne = 'surcharge';
  await ia(page).fill('to go = aller');
  await page.getByRole('button', { name: 'Envoyer' }).click();
  await expect(page.locator('.pi-b.err')).toContainText('L’IA est très demandée', { timeout: 10000 });
  await expect(ia(page)).toHaveValue('to go = aller');
  await expect(reste(page)).toHaveText('400');

  store.iaPanne = 'credit';
  await page.getByRole('button', { name: 'Envoyer' }).click();
  await expect(page.locator('.pi-b.err')).toContainText('L’IA fait une courte pause', { timeout: 10000 });

  store.iaPanne = null;
  await page.getByRole('button', { name: 'Envoyer' }).click();
  await expect(cartes(page)).toHaveCount(1, { timeout: 10000 });
  await expect(page.locator('.pi-b.err')).toHaveCount(0);
  await expect(reste(page)).toHaveText('399');
});
