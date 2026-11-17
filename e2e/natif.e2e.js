// L'app des magasins (2026-11-16, docs/CAPACITOR.md) : le vrai pont de
// Capacitor, joué dans Chromium. On injecte ce qu'injecte Android avant la
// page — window.Capacitor, le vrai native-bridge.js de @capacitor/android,
// les en-têtes des greffons — et seul le côté natif est simulé : chaque appel
// de l'app arrive dans `window.__natif.appels`, chaque réponse et chaque
// évènement (un lien, le bouton retour) repartent par Capacitor.fromNative,
// exactement comme depuis Java. Le JavaScript de l'app, de @capacitor/core et
// des greffons tourne donc pour de vrai.
//
// Ce que ça prouve : ui/natif.js se branche (lancement, barres, écoutes), les
// liens universels et le lien de lancement passent par la porte des liens,
// les autres sont ignorés, le bouton retour ferme puis recule puis met
// l'app en arrière-plan, partager / copier / vibrer passent par les
// greffons, Google est caché, et l'app native ne propose jamais de
// s'installer. Et le contraire : sans le vrai pont, rien de tout ça.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { brancher, nouveauStore } from './faux-supabase.js';
import { inscrire } from './aide.js';

const PONT = readFileSync('node_modules/@capacitor/android/capacitor/src/main/assets/native-bridge.js', 'utf8');

// les méthodes que chaque greffon déclare (Android les publie ainsi : PluginHeaders)
const p = (...noms) => noms.map(n => ({ name: n, rtype: 'promise' }));
const ENTETES = [
  { name: 'App', methods: [{ name: 'addListener', rtype: 'callback' }, ...p('removeListener', 'removeAllListeners', 'getLaunchUrl', 'minimizeApp', 'exitApp', 'getInfo', 'getState')] },
  { name: 'SplashScreen', methods: p('show', 'hide') },
  { name: 'SystemBars', methods: p('setStyle', 'show', 'hide', 'setAnimation') },
  { name: 'Share', methods: p('share', 'canShare') },
  { name: 'Filesystem', methods: p('writeFile', 'readFile', 'deleteFile', 'getUri') },
  { name: 'Clipboard', methods: p('write', 'read') },
  { name: 'Haptics', methods: p('impact', 'vibrate', 'selectionStart', 'selectionChanged', 'selectionEnd', 'notification') },
  { name: 'Purchases', methods: p('configure', 'logIn', 'getOfferings', 'purchasePackage', 'restorePurchases') }
];

/* Le côté Java, en une page : il note chaque appel, répond aux promesses
   (getLaunchUrl rend `lancement`), garde les écoutes pour leur envoyer un
   évènement plus tard. */
async function pontAndroid(page, { lancement = null } = {}) {
  await page.addInitScript(({ pont, entetes, lancement }) => {
    const natif = window.__natif = { appels: [], ecoutes: {} };
    const repondre = (m, data) => setTimeout(() => window.Capacitor.fromNative({
      callbackId: m.callbackId, pluginId: m.pluginId, methodName: m.methodName, success: true, data, save: m.methodName === 'addListener'
    }), 0);
    window.androidBridge = { postMessage(json) {
      const m = JSON.parse(json);
      natif.appels.push({ greffon: m.pluginId, methode: m.methodName, options: m.options });
      if (m.methodName === 'addListener') { natif.ecoutes[m.pluginId + ':' + m.options.eventName] = m.callbackId; return; }
      if (m.methodName === 'removeListener') return;
      const data = m.pluginId === 'App' && m.methodName === 'getLaunchUrl' ? (lancement ? { url: lancement } : {})
        : m.pluginId === 'Filesystem' && m.methodName === 'writeFile' ? { uri: 'file:///cache/' + m.options.path }
          : m.pluginId === 'Clipboard' && m.methodName === 'read' ? { value: 'copié', type: 'text/plain' } : {};
      repondre(m, data);
    } };
    // l'évènement d'un greffon, comme Java l'envoie à une écoute
    natif.emettre = (greffon, evenement, data) => {
      const id = natif.ecoutes[greffon + ':' + evenement];
      if (id) window.Capacitor.fromNative({ callbackId: id, pluginId: greffon, methodName: 'addListener', success: true, data, save: true });
      return !!id;
    };
    // l'ordre de JSInjector (Android) : le global, le pont, puis les en-têtes des greffons
    window.Capacitor = { DEBUG: false, isLoggingEnabled: false, Plugins: {} };
    window.WEBVIEW_SERVER_URL = location.origin;
    (0, eval)(pont);
    window.Capacitor.PluginHeaders = entetes;
  }, { pont: PONT, entetes: ENTETES, lancement });
}

const appels = (page, greffon, methode) => page.evaluate(([g, m]) => window.__natif.appels.filter(a => a.greffon === g && (!m || a.methode === m)), [greffon, methode]);
const emettre = (page, greffon, evenement, data) => page.evaluate(([g, e, d]) => window.__natif.emettre(g, e, d), [greffon, evenement, data]);

test('le pont natif se branche : lancement, barres, écoutes ; Google caché ; jamais « Installer Mirandola »', async ({ page }) => {
  const store = { ...nouveauStore(), fournisseurs: { google: true } };
  await pontAndroid(page);
  await brancher(page, store);
  await page.goto('./app');
  await expect(page.locator('html')).toHaveClass(/\bnatif\b/, { timeout: 10000 });
  await expect(page.locator('html')).toHaveClass(/natif-android/);
  await expect.poll(async () => (await appels(page, 'SplashScreen', 'hide')).length).toBe(1);
  expect((await appels(page, 'SystemBars', 'setStyle'))[0].options).toEqual({ style: 'LIGHT' });
  await expect.poll(async () => (await appels(page, 'App', 'addListener')).map(a => a.options.eventName).sort())
    .toEqual(['appUrlOpen', 'backButton', 'pause', 'resume']);
  expect(await appels(page, 'App', 'getLaunchUrl')).toHaveLength(1);
  // la connexion par Google ne marche pas dans une app : son bouton n'y paraît pas, l'e-mail reste
  await expect(page.getByRole('textbox', { name: 'Adresse e-mail' })).toBeVisible();
  await page.waitForTimeout(300);
  await expect(page.locator('#lext')).toBeHidden();
  // pas de service worker sous Capacitor : l'app est dans le binaire
  expect(await page.evaluate(async () => (navigator.serviceWorker ? (await navigator.serviceWorker.getRegistrations()).length : 0))).toBe(0);
  await page.getByRole('button', { name: 'Créer un compte' }).click();
  await page.getByRole('textbox', { name: 'Adresse e-mail' }).fill('lea@exemple.fr');
  await page.getByRole('textbox', { name: 'Mot de passe' }).fill('motdepasse-solide-42');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Créer le compte' }).click();
  await expect(page.getByText('Aucun paquet pour l’instant')).toBeVisible({ timeout: 10000 });
  await page.goto('./eleve/reglages');
  await expect(page.locator('[data-act="plus"]')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('[data-act="install"]')).toHaveCount(0);
});

test('un lien universel ouvre l’app sur ce qu’il désigne ; un autre domaine ou une page du site, rien', async ({ page }) => {
  const store = nouveauStore();
  await pontAndroid(page);
  await brancher(page, store);
  await inscrire(page);
  await emettre(page, 'App', 'appUrlOpen', { url: 'https://evil.example/app?go=new' });
  await emettre(page, 'App', 'appUrlOpen', { url: 'https://mirandola.fr/tarifs?go=new' });
  await page.waitForTimeout(500);
  await expect(page.locator('#app')).not.toHaveAttribute('data-view', 'import');
  expect(await emettre(page, 'App', 'appUrlOpen', { url: 'https://mirandola.fr/app?go=new' })).toBe(true);
  await expect(page.locator('#app')).toHaveAttribute('data-view', 'import', { timeout: 10000 });
});

test('Android lancé par un lien : l’adresse attend que l’app soit prête, puis s’ouvre', async ({ page }) => {
  const store = nouveauStore();
  await brancher(page, store);
  await inscrire(page);                                 // un compte, et sa session sur l'appareil
  await pontAndroid(page, { lancement: 'https://mirandola.fr/app?go=new' });
  await page.goto('./app');
  await expect(page.locator('#app')).toHaveAttribute('data-view', 'import', { timeout: 15000 });
});

test('le bouton retour : une feuille se ferme, puis l’écran d’avant, puis l’app passe en arrière-plan', async ({ page }) => {
  const store = nouveauStore();
  await pontAndroid(page);
  await brancher(page, store);
  await inscrire(page);
  await page.getByRole('button', { name: 'Nouveau paquet' }).click();
  await expect(page.locator('#app')).toHaveAttribute('data-view', 'import');
  // une boîte ouverte (le choix de la photo, sur Android) se ferme d'abord
  await page.locator('[data-cmode="photo"]').click();
  await page.locator('#aishot').click();                // « Prendre ou choisir des photos » : le champ sans « capture »
  await expect(page.locator('dialog.nt-choix')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Prendre une photo' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Choisir dans la galerie' })).toBeVisible();
  await emettre(page, 'App', 'backButton', { canGoBack: true });
  await expect(page.locator('dialog.nt-choix')).toBeHidden();
  await expect(page.locator('#app')).toHaveAttribute('data-view', 'import');
  // puis l'écran d'avant
  await emettre(page, 'App', 'backButton', { canGoBack: true });
  await expect(page.locator('#app')).not.toHaveAttribute('data-view', 'import', { timeout: 10000 });
  // tout au début : en arrière-plan, jamais fermée
  await emettre(page, 'App', 'backButton', { canGoBack: false });
  await expect.poll(async () => (await appels(page, 'App', 'minimizeApp')).length).toBe(1);
});

test('partager un fichier, télécharger, copier, vibrer : par les greffons', async ({ page }) => {
  const store = nouveauStore();
  await pontAndroid(page);
  await brancher(page, store);
  await inscrire(page);
  await expect(page.locator('html')).toHaveClass(/\bnatif\b/);
  const r = await page.evaluate(async () => {
    const f = new File(['%PDF-1.4'], 'Capitales.pdf', { type: 'application/pdf' });
    const peut = navigator.canShare({ files: [f] });
    await navigator.share({ files: [f], title: 'Capitales' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['{}'], { type: 'application/json' }));
    a.download = 'mirandola-bibliotheque.json';
    a.click();
    await navigator.clipboard.writeText('ABCD-EFGH-JK');
    const lu = await navigator.clipboard.readText();
    const vibre = navigator.vibrate(12);
    return { peut, lu, vibre };
  });
  expect(r).toEqual({ peut: true, lu: 'copié', vibre: true });
  await expect.poll(async () => (await appels(page, 'Share', 'share')).length).toBe(2);
  const [pdf, json] = await appels(page, 'Share', 'share');
  expect(pdf.options).toMatchObject({ title: 'Capitales', files: ['file:///cache/Capitales.pdf'] });
  expect(json.options).toMatchObject({ files: ['file:///cache/mirandola-bibliotheque.json'] });
  const ecrits = await appels(page, 'Filesystem', 'writeFile');
  expect(ecrits.map(e => [e.options.path, e.options.directory])).toEqual([['Capitales.pdf', 'CACHE'], ['mirandola-bibliotheque.json', 'CACHE']]);
  expect(atob(ecrits[0].options.data)).toBe('%PDF-1.4');
  expect((await appels(page, 'Clipboard', 'write'))[0].options).toEqual({ string: 'ABCD-EFGH-JK' });
  expect((await appels(page, 'Haptics', 'impact'))[0].options).toEqual({ style: 'LIGHT' });
});

test('sans le vrai pont, rien ne change : ni classe, ni greffon, ni morceau natif chargé', async ({ page }) => {
  const store = nouveauStore();
  // ce que posait déjà le parcours de l'app des magasins : un window.Capacitor sans pont natif
  await page.addInitScript(() => { window.Capacitor = { getPlatform: () => 'android', isNativePlatform: () => true, Plugins: { Purchases: {} } }; });
  const charges = [];
  page.on('request', r => { if (/\/assets\/natif-/.test(r.url())) charges.push(r.url()); });
  await brancher(page, store);
  await inscrire(page);
  await page.waitForTimeout(500);
  await expect(page.locator('html')).not.toHaveClass(/\bnatif\b/);
  expect(charges).toEqual([]);
  expect(await page.evaluate(() => typeof window.Capacitor.registerPlugin)).toBe('undefined');
});
