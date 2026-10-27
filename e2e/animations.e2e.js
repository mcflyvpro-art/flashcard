// Les animations ne se rejouent jamais (2026-10-25). Un écran ou une
// feuille qui se redessine — un jour choisi dans le calendrier d'un devoir,
// une classe cochée, dix appuis sur le même onglet — ne refait pas son
// entrée : seule une vraie arrivée s'anime, une fois. Et la feuille garde sa
// place de défilement : choisir un jour en bas du calendrier ne la ramène
// plus en haut.
//
// On compte les animations CSS d'entrée en cours (`document.getAnimations()`,
// les boucles infinies — un chargement qui respire — mises à part) juste
// après chaque geste : il n'y en a aucune quand rien n'arrive à l'écran.
import { test, expect } from '@playwright/test';
import { brancher, nouveauStore, semerLivre } from './faux-supabase.js';
import { semerCompte } from './faux-cercle.js';
import { faireProfesseur, rpcClasses } from './faux-classes.js';
import { connecter, sansTuto } from './aide.js';

/* Les animations d'entrée en cours, avec ce qu'elles animent (pour lire
   l'échec) : une transition (un fond qui s'éclaire sous le doigt) n'en est
   pas une. */
const entrees = page => page.evaluate(() => document.getAnimations()
  .filter(a => a.playState === 'running' && typeof CSSAnimation !== 'undefined' && a instanceof CSSAnimation
    && a.effect.getComputedTiming().iterations !== Infinity)
  .map(a => `${a.animationName} sur ${a.effect.target.className || a.effect.target.tagName}`));

function professeur() {
  const store = nouveauStore();
  semerCompte(store, 'lea@exemple.fr');
  const prof = semerCompte(store, 'prof@exemple.fr');
  faireProfesseur(store, 'prof@exemple.fr', 'Claire DURAND');
  sansTuto(store, 'prof@exemple.fr');
  rpcClasses(store, 'prof_creer_classe', { nom: '2nde 4' }, { id: prof });
  rpcClasses(store, 'prof_creer_classe', { nom: '1re 2' }, { id: prof });
  semerLivre(store, 'prof@exemple.fr', 'Verbes irréguliers', [['be', 'été'], ['go', 'aller'], ['see', 'voir']]);
  return store;
}

for (const largeur of [390, 1440]) {
  test(`à ${largeur} px, donner un devoir : choisir des jours et des classes ne rejoue rien`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: largeur > 900 ? 900 : 700 });
    const store = professeur();
    await brancher(page, store);
    /* pas connecter() : il attend la bibliothèque, qu'un professeur ne voit
       pas toujours — son rôle connu tôt, il arrive droit sur ses classes */
    await page.goto('./app');
    await expect(page.locator('#boot')).toHaveCount(0, { timeout: 10000 });
    await expect(page.getByRole('textbox', { name: 'Adresse e-mail' })).toBeFocused();
    await page.getByRole('textbox', { name: 'Adresse e-mail' }).fill('prof@exemple.fr');
    await page.getByRole('textbox', { name: 'Mot de passe' }).fill('motdepasse-solide-42');
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await page.getByRole('button', { name: /2nde 4/ }).first().click({ timeout: 10000 });
    await page.getByRole('button', { name: 'Devoir', exact: true }).click();
    await page.getByRole('button', { name: /Verbes irréguliers/ }).click();
    const feuille = page.getByRole('dialog');
    await expect(feuille.getByRole('button', { name: 'Dans 1 semaine' })).toBeVisible();
    await page.waitForTimeout(700);                       // l'entrée de la feuille est finie

    // le calendrier est en bas de la feuille : on y descend, comme un doigt
    const corps = page.locator('.menu .mbody');
    await corps.evaluate(n => { n.scrollTop = n.scrollHeight; });
    const bas = await corps.evaluate(n => n.scrollTop);

    const jours = feuille.locator('.pf-calg button:not([disabled])');
    for (let k = 0; k < 6; k++) {
      await jours.nth(k).click();
      expect(await entrees(page), `jour ${k + 1} : rien ne doit se rejouer`).toEqual([]);
      expect(await corps.evaluate(n => n.scrollTop), `jour ${k + 1} : la feuille reste où on l'a laissée`).toBe(bas);
    }
    await expect(jours.nth(5)).toHaveClass(/on/);
    for (const raccourci of ['Demain', 'Dans 2 semaines', 'Dans 2 semaines', 'Lundi']) {
      await feuille.getByRole('button', { name: raccourci }).click();
      expect(await entrees(page), `${raccourci} : rien ne doit se rejouer`).toEqual([]);
    }
    for (let k = 0; k < 4; k++) {
      await feuille.locator('.pf-cibles button').nth(k % 2).click();
      expect(await entrees(page), `classe ${k + 1} : rien ne doit se rejouer`).toEqual([]);
    }

    // elle s'en va en glissant, mais n'est plus une feuille ouverte pour personne pendant ce temps
    await page.locator('.menu .mx').click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('html')).not.toHaveClass(/sheet-open/);
    await expect(page.locator('.menu')).toHaveCount(0);
  });
}

test('dix appuis sur le même onglet ne rejouent pas l’écran ; une vraie arrivée s’anime, une fois', async ({ page }) => {
  const store = nouveauStore();
  semerCompte(store, 'lea@exemple.fr');
  semerLivre(store, 'lea@exemple.fr', 'Capitales', [['France', 'Paris'], ['Italie', 'Rome']]);
  await brancher(page, store);
  await connecter(page);
  await page.waitForTimeout(800);
  // chaque entrée d'écran qui démarre (.fade posée sur la racine), comptée au moment où elle part
  await page.evaluate(() => {
    const app = document.getElementById('app');
    window.entreesEcran = 0;
    let avait = app.classList.contains('fade');
    new MutationObserver(() => {
      const a = app.classList.contains('fade');
      if (a && !avait) window.entreesEcran++;
      avait = a;
    }).observe(app, { attributes: true, attributeFilter: ['class'] });
  });
  const arrivees = () => page.evaluate(() => window.entreesEcran);

  const livres = page.getByRole('button', { name: 'Livres' });
  for (let k = 0; k < 10; k++) {
    await livres.click();
    expect(await entrees(page), `appui ${k + 1} sur « Livres »`).toEqual([]);
  }
  expect(await arrivees(), 'Livres est déjà à l’écran : rien n’arrive').toBe(0);

  const cercle = page.getByRole('button', { name: 'Cercle des lecteurs' });
  await cercle.click();
  await expect.poll(arrivees, { message: 'arriver sur le Cercle s’anime' }).toBe(1);
  await page.waitForTimeout(800);
  for (let k = 0; k < 5; k++) {
    await cercle.click();
    expect(await entrees(page), `appui ${k + 1} sur « Cercle des lecteurs »`).toEqual([]);
  }
  expect(await arrivees(), 'une seule entrée pour six appuis').toBe(1);
});
