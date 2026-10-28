// La porte d'installation (2026-10-28, ui/pwa-porte.js, ui/pwa.js, règles
// dans src/installation.js) : dans le navigateur d'un téléphone, l'app ne
// s'ouvre pas ; on y voit le geste de CE navigateur, animé, une flèche vers
// son bouton, le code d'un lien qui attend. Rien ne la contourne, sauf la
// démo et les textes du cadre. Installée, l'app accueille : « C'est
// installé », puis la connexion, et reprend le code que lui a confié son
// navigateur (Android). Sur ordinateur, rien ne change, et l'écran Mirandola+
// montre l'installation et le QR du téléphone, plus aucun magasin.
import { test, expect } from '@playwright/test';
import { appInstallee, brancher, nouveauStore } from './faux-supabase.js';
import { inscrire } from './aide.js';

const UA = {
  iphone18: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
  iphone26: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1',
  instagram: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 385.0.0.47.74 (iPhone15,2; iOS 18_5; fr_FR)',
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36',
  windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0'
};
const porte = page => page.getByRole('heading', { name: 'Installe Mirandola' });
const etapes = page => page.locator('.pw-etapes li > span');          // le texte, sans ce qu'on touche dessiné à côté

test.describe('un iPhone, dans Safari', () => {
  test.use({ userAgent: UA.iphone18 });

  test('la porte : le geste de Safari, la flèche, le code qui attend ; rien ne la contourne', async ({ page }) => {
    const erreurs = [];
    page.on('pageerror', e => erreurs.push(e.message));
    await brancher(page, nouveauStore(), { navigateur: true });
    await page.goto('./app?rejoindre=ABCD2345');
    await expect(porte(page)).toBeVisible({ timeout: 10000 });
    await expect(etapes(page)).toHaveCount(4);
    await expect(etapes(page).first()).toHaveText('Touche Partager, en bas de l’écran');
    await expect(etapes(page).nth(1)).toContainText('Sur l’écran d’accueil');
    await expect(etapes(page).last()).toContainText('connecte-toi');
    await expect(page.locator('.pw-fleche.bas')).toBeVisible();
    await expect(page.locator('.pw-scene .pw-tel')).toBeVisible();

    // le code de la classe : rangé, retiré de l'adresse, montré à recopier, confié à l'app
    await expect(page.locator('#passage')).toContainText('ABCD', { timeout: 10000 });
    await expect(page).not.toHaveURL(/rejoindre=/);
    const confie = await page.evaluate(() => JSON.parse(localStorage.getItem('folio.passage') || '{}'));
    expect(confie['folio.rejoindre']).toBe('ABCD2345');

    // rien de l'app derrière : ni barre du bas, ni barre latérale, ni écran de connexion
    await expect(page.locator('.tabs')).toHaveCount(0);
    await expect(page.locator('#rail')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Se connecter' })).toHaveCount(0);

    // qui ne trouve pas : Safari, par le lien copié
    await page.getByText('Tu ne trouves pas').click();
    await expect(page.locator('.pw-secours').getByRole('button', { name: 'Copier le lien' })).toBeVisible();

    // les textes du cadre et la démo restent ouverts, puis la porte revient
    await page.locator('.lleg [data-legal="cgu"]').click();
    await expect(page.locator('.bar h1')).toHaveText('Conditions d’utilisation', { timeout: 10000 });
    await page.getByRole('button', { name: 'Retour' }).click();
    await expect(porte(page)).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: 'Essayer sans compte' }).click();
    await expect(page.locator('.dm-role')).toHaveCount(3, { timeout: 10000 });
    await page.getByRole('button', { name: 'Retour' }).click();
    await expect(porte(page)).toBeVisible({ timeout: 10000 });

    // recharger, revenir à l'adresse d'un espace : toujours la porte
    await page.goto('./eleve/livres');
    await expect(porte(page)).toBeVisible({ timeout: 10000 });
    const largeur = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(largeur).toBeLessThanOrEqual(390);
    expect(erreurs).toEqual([]);
  });

  test('le visiteur arrivé du site essaie la démo sans la porte, puis la retrouve pour son compte', async ({ page }) => {
    await brancher(page, nouveauStore(), { navigateur: true });
    await page.goto('./essayer');
    await expect(page.locator('.dm-role')).toHaveCount(3, { timeout: 10000 });
    await expect(porte(page)).toHaveCount(0);
    await page.goto('./inscription');
    await expect(porte(page)).toBeVisible({ timeout: 10000 });
  });
});

test.describe('un iPhone, dans Safari 26', () => {
  test.use({ userAgent: UA.iphone26 });
  test('Partager est dans le menu ••• en bas à droite : la flèche y pointe', async ({ page }) => {
    await brancher(page, nouveauStore(), { navigateur: true });
    await page.goto('./connexion');
    await expect(porte(page)).toBeVisible({ timeout: 10000 });
    await expect(etapes(page).first()).toHaveText('Touche ••• en bas à droite, puis Partager');
    await expect(page.locator('.pw-fleche.bas-droite')).toBeVisible();
    await expect(page.locator('.pw-scene[data-fleche="bas-droite"]')).toHaveCount(1);
  });
});

test.describe('dans Instagram', () => {
  test.use({ userAgent: UA.instagram });
  test('rien ne s’y installe : sortir vers Safari, le lien copié', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await brancher(page, nouveauStore(), { navigateur: true });
    await page.goto('./inscription');
    await expect(page.getByRole('heading', { name: 'Continue dans Safari' })).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.pw-fleche.haut-droite')).toBeVisible();
    await page.locator('.pw-carte').getByRole('button', { name: 'Copier le lien' }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('https://mirandola.fr/inscription');
  });
});

test.describe('un téléphone Android, dans Chrome', () => {
  test.use({ userAgent: UA.android });

  test('l’invite du navigateur : un bouton, la confirmation, « C’est installé »', async ({ page }) => {
    // Chrome propose d'installer (beforeinstallprompt) ; l'utilisateur accepte
    await page.addInitScript(() => {
      window.__invite = 0;
      addEventListener('load', () => setTimeout(() => {
        const e = new Event('beforeinstallprompt', { cancelable: true });
        e.prompt = () => { window.__invite += 1; };
        e.userChoice = Promise.resolve({ outcome: 'accepted', platform: 'web' });
        dispatchEvent(e);
      }, 200));
    });
    await brancher(page, nouveauStore(), { navigateur: true });
    await page.goto('./app');
    const bouton = page.locator('.pw-carte').getByRole('button', { name: 'Installer Mirandola' });
    await expect(bouton).toBeEnabled({ timeout: 10000 });
    await expect(etapes(page)).toHaveCount(3);
    await expect(page.locator('.pw-fleche')).toHaveCount(0);           // le bouton est dans la page
    await bouton.click();
    await expect(page.getByRole('heading', { name: 'C’est installé' })).toBeVisible({ timeout: 10000 });
    expect(await page.evaluate(() => window.__invite)).toBe(1);
    await expect(page.locator('.pw-carte')).toContainText('Ouvre Mirandola depuis ton écran d’accueil');
  });

  test('sans invite : le menu ⋮ en haut à droite, dans les mots de Chrome', async ({ page }) => {
    await brancher(page, nouveauStore(), { navigateur: true });
    await page.goto('./app');
    await expect(etapes(page).first()).toHaveText('Touche ⋮, en haut à droite', { timeout: 10000 });
    await expect(etapes(page).nth(1)).toHaveText('Choisis Installer l’application');
    await expect(page.locator('.pw-fleche.haut-droite')).toBeVisible();
  });

  test('un compte déjà ouvert dans le navigateur : la porte aussi, et son compte suivra l’app', async ({ context }) => {
    const store = nouveauStore();
    await brancher(context, store, { navigateur: true });
    // créé dans l'app installée ; le navigateur partage son stockage (Android)
    const app = await context.newPage();
    await appInstallee(app);
    await inscrire(app);
    const nav = await context.newPage();
    await nav.goto('./app');
    await expect(nav.locator('.pw-carte')).toBeVisible({ timeout: 10000 });
    await expect(nav.getByText('Ta bibliothèque est vide')).toHaveCount(0);
    await expect(nav.locator('.tabs')).toHaveCount(0);
    await expect(nav.getByRole('button', { name: 'Essayer sans compte' })).toHaveCount(0);
    await expect(nav.locator('.pw-carte')).toContainText('ton compte t’y attend', { timeout: 5000 });
  });
});

test.describe('l’app installée', () => {
  test('première ouverture : « C’est installé », le code confié par le navigateur repris', async ({ page }) => {
    await brancher(page, nouveauStore());
    await page.goto('./app');
    await expect(page.locator('.linstalle')).toHaveText('C’est installé. Plus qu’à te connecter.', { timeout: 10000 });
    await expect(porte(page)).toHaveCount(0);
    await page.getByRole('button', { name: 'Créer un compte' }).click();
    await expect(page.locator('.linstalle')).toHaveText('C’est installé. Plus qu’à créer ton compte.');

    // le navigateur avait confié un code de partie (Android) : l'app le reprend, une seule fois
    await page.evaluate(() => localStorage.setItem('folio.passage', JSON.stringify({ 'folio.defi': '482913', at: Date.now() })));
    await page.reload();
    await expect(page.locator('.linstalle')).toBeVisible({ timeout: 10000 });
    const repris = await page.evaluate(() => [sessionStorage.getItem('folio.defi'), localStorage.getItem('folio.passage')]);
    expect(repris).toEqual(['482913', null]);

    // une heure plus tard, un code oublié ne ressurgit pas
    await page.evaluate(() => {
      sessionStorage.removeItem('folio.defi');
      localStorage.setItem('folio.passage', JSON.stringify({ 'folio.defi': '111111', at: Date.now() - 2 * 3600e3 }));
    });
    await page.reload();
    await expect(page.locator('.linstalle')).toBeVisible({ timeout: 10000 });
    expect(await page.evaluate(() => sessionStorage.getItem('folio.defi'))).toBeNull();

    // après la première connexion, l'écran de connexion n'en parle plus
    await inscrire(page);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('folio.install') || '{}').connecte)).toBe(1);
  });
});

test.describe('sur ordinateur', () => {
  test.use({ userAgent: UA.windows, viewport: { width: 1360, height: 900 }, isMobile: false, hasTouch: false });

  test('pas de porte ; l’écran Mirandola+ installe ici et montre le QR du téléphone, plus aucun magasin', async ({ page }) => {
    await brancher(page, { ...nouveauStore(), parDefaut: 'gratuit' }, { navigateur: true });
    await inscrire(page);
    await page.goto('./eleve/mirandola-plus');
    await expect(page.locator('#app[data-view="plus"]')).toBeVisible({ timeout: 10000 });
    const ecrans = page.locator('.fp-partout');
    await expect(ecrans.getByRole('heading', { name: 'Sur cet ordinateur' })).toBeVisible();
    await expect(ecrans.locator('.fp-qr svg.qr')).toBeVisible();
    await expect(ecrans).toContainText('Sur ton téléphone : scanne, puis pose Mirandola sur ton écran d’accueil');
    await expect(ecrans).not.toContainText(/Bientôt|App Store|Google Play/);
    await ecrans.getByRole('button', { name: 'Installer Mirandola' }).click();
    await expect(page.locator('.menu .mhd')).toContainText('Installer Mirandola');
    await expect(page.locator('.menu')).toContainText('barre d’adresse');
  });
});
