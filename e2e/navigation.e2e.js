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
  const cdp = await ctx.newCDPSession(page);
  const touche = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  /* `pas` mouvements de 16 ms : peu de pas, un geste vif ; beaucoup, un geste lent */
  page.glisser = async (de, a, { pas = 14, pendant } = {}) => {
    await touche('touchStart', de, 420);
    for (let k = 1; k <= pas; k++) { await touche('touchMove', de + (a - de) * k / pas, 420); await page.waitForTimeout(16); }
    if (pendant) await pendant();
    await touche('touchEnd', a, 420);
    await page.waitForTimeout(450);
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
  await page.getByRole('button', { name: 'Livres', exact: true }).click();
  await page.locator('[data-go]', { hasText: 'Capitales' }).first().click();
  await page.getByRole('button', { name: 'Retour' }).click();
  await expect(ecran(page)).toHaveAttribute('data-view', 'home');
});

test('balayer : Livres → Classe → Cercle des lecteurs, la voisine visible sous le doigt', async ({ browser }) => {
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
  await expect(page.locator('.tabs button.on')).toHaveAttribute('aria-label', 'Livres');
  expect(erreurs).toEqual([]);
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
