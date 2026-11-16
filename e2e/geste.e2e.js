// Le geste de la fiche (ui/geste.js, 2026-11-16) : plus on la porte loin à
// gauche ou à droite, plus la note change — Encore, Difficile | Correct,
// Facile, rangées comme leurs boutons. Le contour prend la couleur de la
// note, la bulle dit la note et son délai, le lâcher donne exactement cette
// note ; revenir au centre n'en donne aucune. Les gestes passent par la
// souris : le même code que le doigt (des événements « pointer »).
import { test, expect } from '@playwright/test';
import { brancher, nouveauStore, semerPaquetDu } from './faux-supabase.js';
import { inscrire } from './aide.js';

async function reviser(page, n = 6) {
  const store = nouveauStore();
  await brancher(page, store);
  await inscrire(page);
  semerPaquetDu(store, 'lea@exemple.fr', n);
  await page.reload();
  await page.getByRole('button', { name: /Révisions/ }).click();
  await page.getByRole('button', { name: /^Réviser/ }).click();
  await expect(page.locator('#top')).toBeVisible();
  // le geste se charge au calme ou à la première fiche
  await page.waitForFunction(() => performance.getEntriesByType('resource').some(r => /\/geste-/.test(r.name)), null, { timeout: 15000 });
  await page.waitForTimeout(500);                                      // la fiche a fini d'arriver
  return store;
}

const centre = async page => { const b = await page.locator('#top').boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };
const contour = page => page.locator('#top').evaluate(el => getComputedStyle(el.querySelector('.swr')).getPropertyValue('--swc').trim());
const teinte = (page, nom) => page.evaluate(n => {   // la couleur calculée d'un jeton, pour la comparer au contour
  const i = document.createElement('i'); i.style.color = `var(${n})`; document.body.append(i);
  const c = getComputedStyle(i).color; i.remove(); return c;
}, nom);

// porte la fiche à dx du centre (sans la lâcher), en plusieurs pas comme un doigt
async function porter(page, dx) {
  const [x, y] = await centre(page);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + 6, { steps: 12 });
  return [x, y];
}

test('porter la fiche choisit l’une des quatre notes : contour, bulle, bouton, et la note donnée au lâcher', async ({ page }) => {
  const store = await reviser(page);
  // retournée d'un appui : les quatre boutons sont là
  const [x0, y0] = await centre(page);
  await page.mouse.click(x0, y0);
  await expect(page.locator('.gr')).toHaveCount(4);

  const attendu = [];
  const cas = [[-190, 0, 'Encore', '--ko'], [-60, 1, 'Difficile', '--am'], [60, 2, 'Correct', '--ok'], [190, 3, 'Facile', '--az5']];
  for (const [dx, note, nom, jeton] of cas) {
    if (!(await page.locator('.gr').count())) { const [x, y] = await centre(page); await page.mouse.click(x, y); }
    const delai = (await page.locator(`.gr[data-g="${note}"] i`).textContent()).trim();
    await porter(page, dx);
    const bulle = page.locator('.gz-bulle.on');
    await expect(bulle).toBeVisible();
    await expect(bulle.locator('b')).toHaveText(nom);
    await expect(bulle.locator('span')).toHaveText(/^\d/.test(delai) ? 'dans ' + delai : delai);   // le délai même du bouton
    await expect(page.locator('.gr.vise')).toHaveAttribute('data-g', String(note));     // le bouton de la note s'allume
    await expect.poll(() => contour(page)).toBe(await teinte(page, jeton));            // le contour prend sa couleur
    await page.mouse.up();
    attendu.push(note);
    await expect.poll(() => (store.tables.reviews || []).length, { timeout: 10000 }).toBe(attendu.length);
    await page.waitForTimeout(350);                                                    // la fiche suivante arrive
  }
  expect(store.tables.reviews.map(r => r.rating)).toEqual(attendu);
  // la bulle s'efface d'elle-même une fois la page suivante arrivée
  await expect(page.locator('.gz-bulle.on')).toHaveCount(0, { timeout: 3000 });
  await expect(page.locator('.gr.vise')).toHaveCount(0);
});

test('aller et revenir : la note suit le doigt, et revenir au centre n’en donne aucune', async ({ page }) => {
  const store = await reviser(page);
  const [x, y] = await porter(page, 190);
  await expect(page.locator('.gz-bulle.on b')).toHaveText('Facile');
  await page.mouse.move(x + 60, y, { steps: 8 });
  await expect(page.locator('.gz-bulle.on b')).toHaveText('Correct');
  await page.mouse.move(x - 60, y, { steps: 8 });
  await expect(page.locator('.gz-bulle.on b')).toHaveText('Difficile');
  await page.mouse.move(x - 4, y, { steps: 8 });
  await expect(page.locator('.gz-bulle.on')).toHaveCount(0);
  await page.mouse.up();
  await page.waitForTimeout(600);
  expect(store.tables.reviews || []).toHaveLength(0);                                   // rien n'est noté
  await expect(page.locator('#top')).not.toHaveClass(/gone/);
  // la fiche est revenue à sa place, sans couleur
  const t = await page.locator('#top').evaluate(el => [getComputedStyle(el).transform, el.style.getPropertyValue('--sw')]);
  expect(t[1]).toBe('0');
});

test('la note ne clignote pas sur sa limite : il faut la dépasser franchement pour en changer', async ({ page }) => {
  await reviser(page);
  const [x, y] = await porter(page, 44);                                                // juste passé le seuil (40 px)
  await expect(page.locator('.gz-bulle.on b')).toHaveText('Correct');
  await page.mouse.move(x + 35, y, { steps: 3 });                                       // repasse un peu sous le seuil
  await expect(page.locator('.gz-bulle.on b')).toHaveText('Correct');
  await page.mouse.move(x + 118, y, { steps: 6 });                                      // passe la limite de Facile (112 px au téléphone)
  await expect(page.locator('.gz-bulle.on b')).toHaveText('Facile');
  await page.mouse.move(x + 107, y, { steps: 3 });                                      // à peine en deçà : reste Facile
  await expect(page.locator('.gz-bulle.on b')).toHaveText('Facile');
  await page.mouse.move(x + 90, y, { steps: 3 });                                       // franchement en deçà : Correct
  await expect(page.locator('.gz-bulle.on b')).toHaveText('Correct');
  await page.mouse.move(x, y, { steps: 6 });
  await page.mouse.up();
});

test('un appui un peu glissé ne note rien, et la fiche revient', async ({ page }) => {
  const store = await reviser(page);
  await porter(page, 30);
  await expect(page.locator('.gz-bulle.on')).toHaveCount(0);
  await page.mouse.up();
  await page.waitForTimeout(600);
  expect(store.tables.reviews || []).toHaveLength(0);
  await expect(page.locator('#top')).not.toHaveClass(/gone/);
});

test('au bouton ou au clavier, la bulle dit aussi la note et son délai', async ({ page }) => {
  const store = await reviser(page);
  const [x, y] = await centre(page);
  await page.mouse.click(x, y);
  const delai = (await page.locator('.gr[data-g="2"] i').textContent()).trim();
  await page.locator('.gr[data-g="2"]').click();
  await expect(page.locator('.gz-bulle.on b')).toHaveText('Correct');
  await expect(page.locator('.gz-bulle.on span')).toHaveText('dans ' + delai);
  await expect.poll(() => (store.tables.reviews || []).length, { timeout: 10000 }).toBe(1);
  await page.waitForTimeout(400);
  await page.keyboard.press(' ');                                                     // retournée au clavier
  await expect(page.locator('.gr')).toHaveCount(4);
  await page.keyboard.press('4');
  await expect(page.locator('.gz-bulle.on b')).toHaveText('Facile');
  await expect.poll(() => (store.tables.reviews || []).map(r => r.rating), { timeout: 10000 }).toEqual([2, 3]);
});
