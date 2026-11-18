// La navigation au téléphone (2026-10-25) : le « Retour » d'un livre ramène
// là d'où on l'a ouvert (un devoir revenait sur la bibliothèque au lieu de
// « Ma classe »), et le balayage passe par les trois onglets dans l'ordre de
// la barre — Livres, Classe, Cercle des lecteurs — au doigt, la page voisine
// déjà visible pendant le geste. Les gestes sont de vrais événements tactiles
// (CDP), pas des clics : c'est ce que reçoit un téléphone.
import { test, expect } from '@playwright/test';
import { brancher, nouveauStore, semerLivre } from './faux-supabase.js';
import { semerCompte, semerPseudo } from './faux-cercle.js';
import { faireProfesseur, rpcClasses } from './faux-classes.js';
import { connecter } from './aide.js';

function eleveEnClasse() {
  const store = nouveauStore();
  const lea = semerCompte(store, 'lea@exemple.fr');
  const prof = semerCompte(store, 'prof@exemple.fr');
  semerPseudo(store, 'lea@exemple.fr', 'lea', 'Léa Martin');
  faireProfesseur(store, 'prof@exemple.fr', 'M. Durand');
  const [, cid] = rpcClasses(store, 'prof_creer_classe', { nom: '2nde B' }, { id: prof });
  store.cl.membres.push({ cid, uid: lea, depuis: new Date().toISOString() });
  store.cl.noms[lea] = 'Léa MARTIN';
  rpcClasses(store, 'prof_give', { cids: [cid], nom: 'Capitales', matiere: 'Géographie', due: '2099-01-01',
    cartes: [['France', 'Paris'], ['Italie', 'Rome']] }, { id: prof });
  semerLivre(store, 'lea@exemple.fr', 'Verbes', [['être', 'to be'], ['avoir', 'to have']]);
  return store;
}

async function telephone(browser, store) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await brancher(page, store);
  await connecter(page);
  /* les touchers natifs passent par CDP, que seul Chromium a : sous WebKit
     (tools/pw-webkit.config.js), les parcours qui ne glissent pas tournent quand même */
  const cdp = browser.browserType().name() === 'chromium' ? await ctx.newCDPSession(page) : null;
  const touche = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  /* `pas` mouvements de 16 ms : peu de pas, un geste vif ; beaucoup, un geste lent. À la hauteur
     d'un titre de section, jamais d'un champ : un doigt posé sur un champ y déplace le curseur */
  // tirer vers le bas, d'un point à un autre (une feuille qu'on referme)
  page.tirer = async (x, de, a, pas = 8) => {
    await touche('touchStart', x, de);
    for (let k = 1; k <= pas; k++) { await touche('touchMove', x, de + (a - de) * k / pas); await page.waitForTimeout(16); }
    await touche('touchEnd', x, a);
    await page.waitForTimeout(500);
  };
  page.glisser = async (de, a, { pas = 14, pendant, y = 140, avant = 450 } = {}) => {
    await touche('touchStart', de, y);
    for (let k = 1; k <= pas; k++) { await touche('touchMove', de + (a - de) * k / pas, y); await page.waitForTimeout(16); }
    if (pendant) await pendant();
    await touche('touchEnd', a, y);
    await page.waitForTimeout(avant || 90);
  };
  return page;
}

const ecran = page => page.locator('#app');

test('un devoir ouvert depuis « Ma classe » y revient par « Retour »', async ({ browser }) => {
  const page = await telephone(browser, eleveEnClasse());
  await page.getByRole('button', { name: 'Classe', exact: true }).click();
  await page.locator('[data-el="devoir"]').first().click();
  await expect(ecran(page)).toHaveAttribute('data-view', 'deck', { timeout: 10000 });
  await page.getByRole('button', { name: 'Retour' }).click();
  await expect(ecran(page)).toHaveAttribute('data-view', 'classes');

  // rouvert depuis la bibliothèque, le même livre y ramène
  await page.getByRole('button', { name: 'Paquets', exact: true }).click();
  await page.locator('[data-go]', { hasText: 'Capitales' }).first().click();
  await page.getByRole('button', { name: 'Retour' }).click();
  await expect(ecran(page)).toHaveAttribute('data-view', 'home');
});

test('balayer : Paquets → Classe → Mes amis, la voisine visible sous le doigt', async ({ browser, browserName }) => {
  test.skip(browserName === 'webkit', 'un doigt qui glisse passe par CDP, que seul Chromium a');
  const page = await telephone(browser, eleveEnClasse());
  const erreurs = [];
  page.on('pageerror', e => erreurs.push(e.message));
  await expect(page.locator('.tabs button')).toHaveCount(3, { timeout: 10000 });

  // à mi-course, « Ma classe » est déjà là, à droite de la bibliothèque
  await page.glisser(330, 150, {
    pendant: async () => {
      await expect(page.locator('.balai')).toHaveCount(1);
      await expect(page.locator('.balai')).toContainText('Ma classe');
    }
  });
  await expect(ecran(page)).toHaveAttribute('data-view', 'classes');
  await expect(page.locator('.balai')).toHaveCount(0);           // la couche d'aperçu disparaît
  await page.glisser(330, 160);
  await expect(ecran(page)).toHaveAttribute('data-view', 'commu');

  await page.glisser(330, 120);                                   // au bout : la page résiste et revient
  await expect(ecran(page)).toHaveAttribute('data-view', 'commu');
  await page.glisser(120, 190, { pas: 20 });                      // court et lent : rien ne change
  await expect(ecran(page)).toHaveAttribute('data-view', 'commu');
  await page.glisser(100, 190, { pas: 3 });                       // court mais vif : ça passe
  await expect(ecran(page)).toHaveAttribute('data-view', 'classes');
  await page.glisser(80, 300);
  await expect(ecran(page)).toHaveAttribute('data-view', 'home');
  await expect(page.locator('.tabs button.on')).toHaveAttribute('aria-label', 'Paquets');
  expect(erreurs).toEqual([]);
});

/* Huit balayages enchaînés, chacun lancé pendant que la page d'avant finit
   sa course (2026-11-17, « quand je swipe très vite, ça bugue ») : avant, un
   geste sur deux tombait dans le vide et l'on finissait sur le mauvais
   onglet. Chacun compte désormais, la pastille suit, et aucune couche de
   voisine ne reste dans la page. */
test('balayer très vite : chaque geste compte, la pastille suit, rien ne reste', async ({ browser, browserName }) => {
  test.skip(browserName === 'webkit', 'un doigt qui glisse passe par CDP, que seul Chromium a');
  const page = await telephone(browser, eleveEnClasse());
  const erreurs = [];
  page.on('pageerror', e => erreurs.push(e.message));
  await expect(page.locator('.tabs button')).toHaveCount(3, { timeout: 10000 });
  const vif = async (de, a) => {
    await page.glisser(de, a, { pas: 4, avant: 0 });
  };
  // Paquets → Classe → Mes amis → Classe → Paquets → Classe, sans attendre la fin des courses
  for (const [de, a] of [[330, 60], [330, 60], [60, 330], [60, 330], [330, 60]]) await vif(de, a);
  await expect(ecran(page)).toHaveAttribute('data-view', 'classes');
  await expect(page.locator('.tabs button.on')).toHaveAttribute('aria-label', 'Classe');
  await expect.poll(() => page.evaluate(() => Math.round(new DOMMatrixReadOnly(getComputedStyle(document.querySelector('.tabs .sl')).transform).m41)))
    .toBe(74);
  await expect(page.locator('.balai')).toHaveCount(0);
  await expect(page.locator('#page')).not.toHaveAttribute('style', /translate/);

  // une couche orpheline (un geste perdu) ne survit pas au toucher suivant
  await page.evaluate(() => { const n = document.createElement('div'); n.className = 'balai'; document.body.append(n); });
  await page.glisser(200, 205, { pas: 1 });
  await expect(page.locator('.balai')).toHaveCount(0);
  expect(erreurs).toEqual([]);
});

/* Un geste abandonné en route (l'app qui passe derrière) rend la barre à
   l'onglet de la page : l'onglet voisin, allumé à mi-course, restait allumé
   — son icône blanche sur la barre claire (2026-11-18). Et changer
   d'onglet n'empile rien dans l'historique : sur l'iPhone, le glissé de
   retour d'iOS le suivait et emportait la page. */
test('un geste abandonné rend la barre à son onglet ; les onglets n’empilent rien', async ({ browser, browserName }) => {
  test.skip(browserName === 'webkit', 'un doigt qui glisse passe par CDP, que seul Chromium a');
  const page = await telephone(browser, eleveEnClasse());
  await expect(page.locator('.tabs button')).toHaveCount(3, { timeout: 10000 });
  const pile = await page.evaluate(() => history.length);
  await page.getByRole('button', { name: 'Classe', exact: true }).click();
  await page.getByRole('button', { name: /^Mes amis/ }).click();
  await page.getByRole('button', { name: 'Paquets', exact: true }).click();
  await expect(ecran(page)).toHaveAttribute('data-view', 'home');
  expect(await page.evaluate(() => history.length)).toBe(pile);
  await page.waitForTimeout(500);

  await page.glisser(330, 120, { pendant: async () => {
    await expect(page.locator('#app > .tabs button.on')).toHaveAttribute('aria-label', 'Classe');   // allumé à mi-course
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  } });
  await expect(ecran(page)).toHaveAttribute('data-view', 'home');
  await expect(page.locator('#app > .tabs button.on')).toHaveCount(1);
  await expect(page.locator('#app > .tabs button.on')).toHaveAttribute('aria-label', 'Paquets');
  await expect(page.locator('#app > .tabs button.vise')).toHaveCount(0);
  await expect(page.locator('.balai')).toHaveCount(0);
});

/* Revenir au doigt (2026-11-17) : sur un paquet, un glissé de gauche à
   droite tire la page et découvre dessous l'onglet d'où l'on vient, puis
   y revient ; un glissé court revient à sa place. */
test('revenir au doigt : d’un paquet à « Mes paquets », l’onglet visible dessous', async ({ browser, browserName }) => {
  test.skip(browserName === 'webkit', 'un doigt qui glisse passe par CDP, que seul Chromium a');
  const page = await telephone(browser, eleveEnClasse());
  const erreurs = [];
  page.on('pageerror', e => erreurs.push(e.message));
  await page.locator('[data-go]', { hasText: 'Verbes' }).first().click();
  await expect(ecran(page)).toHaveAttribute('data-view', 'deck', { timeout: 10000 });
  await page.waitForTimeout(400);

  await page.glisser(60, 110, { pas: 20, y: 420 });                 // court et lent : la page revient
  await expect(ecran(page)).toHaveAttribute('data-view', 'deck');
  const carte = await page.locator('.rows .row input[data-k="f"]').first().boundingBox();
  await page.glisser(carte.x + 10, 330, { y: carte.y + carte.height / 2, pendant: async () => {
    await expect(page.locator('.balai.avec-barre')).toHaveCount(1);
    await expect(page.locator('.balai.avec-barre')).toContainText('Mes paquets');
  } });
  await expect(ecran(page)).toHaveAttribute('data-view', 'home');
  await expect(page.locator('.balai, .retour-ombre')).toHaveCount(0);
  await expect(page.locator('#app')).not.toHaveClass(/fade/);
  expect(erreurs).toEqual([]);
});

/* Une feuille se referme en la tirant vers le bas d'où que parte le doigt :
   sa grille de matières, pas seulement sa poignée ; tirée un peu, elle revient. */
test('une feuille se tire vers le bas depuis sa grille, et revient si on la lâche tôt', async ({ browser, browserName }) => {
  test.skip(browserName === 'webkit', 'un doigt qui glisse passe par CDP, que seul Chromium a');
  const page = await telephone(browser, eleveEnClasse());
  await page.locator('[data-go]', { hasText: 'Verbes' }).first().click();
  await expect(ecran(page)).toHaveAttribute('data-view', 'deck', { timeout: 10000 });
  await page.locator('.bar .ic').last().click();
  await expect(page.locator('.menu .mgrid')).toBeVisible();
  await expect(page.locator('.menu .mhd')).toContainText('Verbes');
  await page.waitForTimeout(500);                                    // la feuille a fini de monter
  const g = await page.locator('.menu .mgrid').boundingBox();
  await page.tirer(g.x + 60, g.y + 20, g.y + 50, 12);              // un peu, lentement : elle revient
  await expect(page.locator('.menu')).toHaveCount(1);
  await expect.poll(() => page.locator('.menu').evaluate(n => n.style.transform)).toBe('');
  expect(await page.locator('.menu .mgrid').boundingBox()).toEqual(g);   // à sa place exacte
  await page.tirer(g.x + 60, g.y + 20, g.y + 260);                 // franchement : elle part
  await expect(page.locator('.menu, .scrim')).toHaveCount(0);
  await expect(ecran(page)).toHaveAttribute('data-view', 'deck');
});

/* La poignée de rangement est au bord gauche, là où part le retour au
   doigt : tirée en hauteur, elle range toujours la carte. */
test('la poignée d’une carte la range encore, tirée vers le bas', async ({ browser, browserName }) => {
  test.skip(browserName === 'webkit', 'un doigt qui glisse passe par CDP, que seul Chromium a');
  const page = await telephone(browser, eleveEnClasse());
  await page.locator('[data-go]', { hasText: 'Verbes' }).first().click();
  await expect(ecran(page)).toHaveAttribute('data-view', 'deck', { timeout: 10000 });
  const recto = page.locator('.rows .row input[data-k="f"]').first();
  await expect(recto).toHaveValue('être');
  const p = await page.locator('.rows .row .grip').first().boundingBox();
  const pas = await page.locator('.rows .row').nth(1).evaluate(n => n.offsetTop - n.previousElementSibling.offsetTop);
  await page.tirer(p.x + p.width / 2, p.y + p.height / 2, p.y + p.height / 2 + pas + 4, 10);
  await expect(recto).toHaveValue('avoir');
  await expect(ecran(page)).toHaveAttribute('data-view', 'deck');
});

test('sur ordinateur, rien ne glisse', async ({ browser }) => {
  const store = eleveEnClasse();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await brancher(page, store);
  await connecter(page);
  await page.mouse.move(1100, 420);
  await page.mouse.down();
  await page.mouse.move(500, 420, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  await expect(ecran(page)).toHaveAttribute('data-view', 'home');
  await expect(page.locator('#page')).not.toHaveAttribute('style', /translate/);
});
