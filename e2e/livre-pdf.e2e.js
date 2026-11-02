// Le menu « … » d'un livre (2026-11-02) : « PDF du livre » (src/pdf-livre.js,
// ui/livre-pdf.js) remet un vrai PDF — un tableau recto | verso, un champ
// modifiable par case —, au partage du téléphone. Et « Reprendre » ne montre
// plus une lecture dont le livre a été supprimé (src/file.js, `reprise`) :
// le livre « Paquet » de l'utilisateur, supprimé, s'y affichait encore.
import { test, expect } from '@playwright/test';
import { brancher, nouveauStore } from './faux-supabase.js';
import { creerLivre, inscrire, noter } from './aide.js';

test('PDF du livre, puis un livre supprimé quitte « Reprendre »', async ({ page }) => {
  const erreurs = [];
  page.on('pageerror', e => erreurs.push(e.message));
  // le partage du téléphone : on garde le fichier qu'on lui remet
  await page.addInitScript(() => {
    navigator.canShare = () => true;
    navigator.share = async d => { window.__partage = d; };
  });
  await brancher(page, nouveauStore());
  await inscrire(page);
  await creerLivre(page, 'Capitales', 3);

  // une lecture commencée puis quittée : « Reprendre » la propose
  await page.getByRole('button', { name: 'Lire 3' }).click();
  await noter(page, 'Facile');
  await page.getByRole('button', { name: 'Retour' }).first().click();
  await page.getByRole('button', { name: 'Retour' }).first().click();
  await expect(page.locator('.resume')).toContainText('Reprendre Capitales');
  await expect(page.locator('.resume')).toContainText('2 cartes restantes');

  // le PDF : recto et verso, remis au partage
  await page.locator('.tile, .brow', { hasText: 'Capitales' }).first().click();
  await page.getByRole('button', { name: 'Menu du livre' }).click();
  await page.locator('[data-mact="pdfopen"]').click();
  await page.locator('[data-mact="pdf-tout"]').click();
  await expect.poll(() => page.evaluate(() => !!window.__partage), { timeout: 10000 }).toBe(true);
  const pdf = await page.evaluate(async () => {
    const f = window.__partage.files[0];
    const b = new Uint8Array(await f.arrayBuffer());
    let s = '';
    for (const x of b) s += String.fromCharCode(x);
    return { nom: f.name, type: f.type, s };
  });
  expect(pdf.nom).toBe('Capitales.pdf');
  expect(pdf.type).toBe('application/pdf');
  expect(pdf.s.startsWith('%PDF-1.7')).toBe(true);
  expect(pdf.s).toContain('/AcroForm');
  const utf16 = t => '<FEFF' + [...t].map(c => c.charCodeAt(0).toString(16).padStart(4, '0').toUpperCase()).join('') + '>';
  expect(pdf.s).toContain('/V ' + utf16('Pays 1'));
  expect(pdf.s).toContain('/V ' + utf16('Capitale 3'));
  await expect(page.locator('.menu')).toHaveCount(0);

  // supprimer le livre (deux appuis) : « Reprendre » s'en va
  await page.getByRole('button', { name: 'Menu du livre' }).click();
  await page.locator('[data-mact="del"]').click();
  await page.locator('[data-mact="del"]').click();
  await expect(page.locator('.resume')).toHaveCount(0);
  expect(erreurs).toEqual([]);
});
