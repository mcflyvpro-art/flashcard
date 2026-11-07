// Le singe (2026-11-07, nuit.yml) : dans la démo sans compte, pour chaque
// rôle et sur deux écrans, des centaines de gestes au hasard sur tout ce qui
// se touche, sauf ce qui quitte la démo ; une graine qui change chaque nuit
// (GRAINE), et la moindre erreur JavaScript fait échouer le parcours, avec
// les six derniers gestes qui y ont mené (singe.ndjson dans SHOTS).
// Inactif dans les parcours ordinaires : SINGE=nombre de gestes par rôle.
//   SINGE=150 GRAINE=7 SHOTS=dossier npx playwright test e2e/singe.e2e.js
import { test, expect } from '@playwright/test';
import { appendFileSync, mkdirSync } from 'node:fs';
import { brancher, nouveauStore } from './faux-supabase.js';

const N = +(process.env.SINGE || 0);
const GRAINE = +(process.env.GRAINE || 1);
/* l'avertissement voulu des mentions légales tant que l'identité de
   l'entreprise n'est pas remplie (src/editeur.js) : pas un défaut */
const VOULU = /mentions légales incomplètes/;
const ROLES = (process.env.ROLES || 'eleve,prof,ref').split(',');
const ECRANS = [['tel', { width: 390, height: 844 }], ['pc', { width: 1360, height: 860 }]];
const SORTIE = (process.env.SHOTS || 'test-results') + '/singe.ndjson';
try { mkdirSync(process.env.SHOTS || 'test-results', { recursive: true }); } catch { /* il existe déjà */ }

function alea(graine) {
  let s = graine >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}

for (const [ecran, vp] of ECRANS) {
  for (const role of ROLES) {
    test(`le singe : ${role} sur ${ecran}`, async ({ browser }) => {
      test.skip(!N, 'SINGE=nombre de gestes pour le lancer (nuit.yml)');
      test.setTimeout(N * 3000 + 60000);
      const ctx = await browser.newContext({ viewport: vp, isMobile: ecran === 'tel', hasTouch: ecran === 'tel' });
      const page = await ctx.newPage();
      await brancher(page, nouveauStore(), { navigateur: true });
      await page.addInitScript(() => {
        // ce que le singe ne doit pas ouvrir pour de vrai : un autre onglet, une impression, le partage du système
        window.open = () => null; window.print = () => {};
        navigator.share = async () => {}; navigator.canShare = () => true;
      });
      const gestes = [], erreurs = [];
      const noter = (type, m) => { const e = { role, ecran, type, m: String(m).slice(0, 400), apres: gestes.slice(-6) }; erreurs.push(e); appendFileSync(SORTIE, JSON.stringify(e) + '\n'); };
      page.on('pageerror', e => noter('pageerror', e.stack || e.message));
      page.on('console', m => { if (m.type() === 'error' && !/favicon|ERR_|Failed to load resource/.test(m.text())) noter('console', m.text()); });
      page.on('dialog', d => d.dismiss());
      await page.goto('./essayer');
      await page.locator(`.dm-role[data-v="${role}"]`).click({ timeout: 15000 });
      const r = alea(GRAINE * 7919 + ecran.length * 97 + role.length * 13 + 7);
      for (let k = 0; k < N; k++) {
        if (!page.url().includes('/demo/') && !page.url().includes('/essayer')) {
          gestes.push('— sorti : ' + new URL(page.url()).pathname);
          await page.goto('./essayer');
          await page.locator(`.dm-role[data-v="${role}"]`).click({ timeout: 15000 }).catch(() => {});
          continue;
        }
        if (r() < 0.06) { await page.keyboard.press('Escape'); gestes.push('Échap'); continue; }
        if (r() < 0.03) { await page.goBack().catch(() => {}); gestes.push('Retour du navigateur'); continue; }
        const cibles = await page.evaluate(() => {
          const sel = 'button:not([disabled]), a[href], [data-act], [data-mact], [data-r], [data-cc], [data-pf], [data-ce], [data-fp], [data-tu], [role="tab"], input[type="checkbox"], select';
          const loin = /partir|quitter|logout|deconnect|tout-supprimer|do-delacc/i;
          return [...document.querySelectorAll(sel)].filter(n => {
            const b = n.getBoundingClientRect();
            if (!b.width || !b.height || b.bottom < 0 || b.top > innerHeight || b.right < 0 || b.left > innerWidth) return false;
            const st = getComputedStyle(n);
            if (st.visibility === 'hidden' || st.pointerEvents === 'none') return false;
            const s = [n.dataset.dm, n.dataset.act, n.dataset.mact, n.textContent].join(' ');
            if (loin.test(s)) return false;
            if (n.tagName === 'A' && n.target === '_blank') return false;
            if (n.tagName === 'A' && /^(mailto|tel|https?:)/.test(n.getAttribute('href') || '') && !(n.getAttribute('href') || '').startsWith(location.origin)) return false;
            return true;
          }).map((n, i) => { n.dataset.singe = String(i); return (n.dataset.act || n.dataset.mact || n.dataset.r || n.dataset.cc || n.dataset.pf || n.getAttribute('aria-label') || n.textContent || n.tagName).trim().replace(/\s+/g, ' ').slice(0, 40); });
        });
        if (!cibles.length) { await page.keyboard.press('Escape'); continue; }
        const i = Math.floor(r() * cibles.length);
        gestes.push(`${new URL(page.url()).pathname} → ${cibles[i]}`);
        const t0 = Date.now();
        const n = page.locator(`[data-singe="${i}"]`).first();
        const tag = await n.evaluate(x => x.tagName).catch(() => '');
        if (tag === 'SELECT') await n.selectOption({ index: 0 }).catch(() => {});
        else await n.click({ timeout: 800, noWaitAfter: true }).catch(() => {});
        // un champ apparu ? on y tape un peu, pour que les formulaires vivent
        if (r() < 0.25) {
          const champ = page.locator('input[type="text"]:visible, input:not([type]):visible, textarea:visible').first();
          if (await champ.count()) await champ.fill('Essai ' + k, { timeout: 800 }).catch(() => {});
        }
        const duree = Date.now() - t0;
        if (duree > 3000) appendFileSync(SORTIE, JSON.stringify({ lent: duree, role, ecran, geste: gestes.at(-1) }) + '\n');
        await page.waitForTimeout(120);
      }
      appendFileSync(SORTIE, JSON.stringify({ fin: true, role, ecran, graine: GRAINE, gestes: gestes.length, erreurs: erreurs.length }) + '\n');
      await ctx.close();
      expect(erreurs.filter(e => !VOULU.test(e.m)), 'erreurs JavaScript (singe.ndjson)').toEqual([]);
    });
  }
}

