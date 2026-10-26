// Gestes partagés par les parcours (M07) : ce qu'un élève fait le plus souvent.
import { expect } from '@playwright/test';

/* L'app redessine son écran au démarrage : remplir le formulaire avant la
   fin de l'ouverture (qui le couvre, M05.T4) mélangeait les saisies d'un
   champ à l'autre. Un élève ne peut pas taper si tôt ; le test non plus. */
async function ouvrir(page) {
  await page.goto('./app');
  await expect(page.locator('#boot')).toHaveCount(0, { timeout: 10000 });
}

export async function inscrire(page, email = 'lea@exemple.fr', mdp = 'motdepasse-solide-42') {
  await ouvrir(page);
  await page.getByRole('button', { name: 'Créer un compte' }).click();
  // le formulaire redonne le focus à l'e-mail 80 ms après chaque affichage (loginView) :
  // taper avant, c'était voir le mot de passe atterrir dans le champ e-mail
  await expect(page.getByRole('textbox', { name: 'Adresse e-mail' })).toBeFocused();
  await page.getByRole('textbox', { name: 'Adresse e-mail' }).fill(email);
  await page.getByRole('textbox', { name: 'Mot de passe' }).fill(mdp);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Créer le compte' }).click();
  await expect(page.getByText('Ta bibliothèque est vide')).toBeVisible({ timeout: 10000 });
}

export async function connecter(page, email = 'lea@exemple.fr', mdp = 'motdepasse-solide-42') {
  await ouvrir(page);
  await expect(page.getByRole('textbox', { name: 'Adresse e-mail' })).toBeFocused();
  await page.getByRole('textbox', { name: 'Adresse e-mail' }).fill(email);
  await page.getByRole('textbox', { name: 'Mot de passe' }).fill(mdp);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByRole('button', { name: 'Nouveau livre' })).toBeVisible({ timeout: 10000 });
}

/* Écrit un livre de `n` pages « Pays k » → « Capitale k », et l'ouvre. */
export async function creerLivre(page, titre = 'Capitales', n = 10) {
  await page.getByRole('button', { name: 'Nouveau livre' }).click();
  await page.locator('#nm').fill(titre);
  for (let k = 1; k <= n; k++) {
    await page.locator('#cf').fill('Pays ' + k);
    await page.locator('#cb').fill('Capitale ' + k);
    await page.locator('#cb').press('Enter');
    await expect(page.getByText('Pays ' + k, { exact: true })).toBeVisible();   // sous charge, ne pas taper plus vite que l'écran
  }
  await expect(page.getByText('Pays ' + n, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Créer' }).click();
  await expect(page.getByRole('button', { name: 'Menu du livre' })).toBeVisible();
  await expect(page.locator('main .lbl').first()).toContainText(String(n));   // le compte de pages, en tête de la liste
}

/* Retourne la page affichée et lui donne une note (« Encore », « Difficile »,
   « Correct », « Facile »). Un toucher pendant l'animation d'arrivée de la
   page peut ne pas la retourner (comme sur un vrai téléphone) : on retente
   tant que les boutons de note ne sont pas là. */
export async function noter(page, note) {
  const bouton = page.getByRole('button', { name: new RegExp('^' + note) });
  for (let essai = 0; essai < 5 && !(await bouton.isVisible()); essai++) {
    await page.locator('main').click({ position: { x: 195, y: 400 } });
    await bouton.waitFor({ state: 'visible', timeout: 1500 }).catch(() => {}); // pas encore retournée : on retente
  }
  await bouton.click();
  await page.waitForTimeout(400);           // l'animation de la page qui s'en va
}
