// Le tuto de première connexion (2026-10-27, ui/tuto.js, scénarios de
// src/tuto.js) : un guide qui fait faire, sur le vrai écran, et que rien ne
// contourne sauf la croix, « Passer » et Échap. Un particulier finit son
// accueil, crée son premier livre, lit et note une page, voit son journal,
// ses amis, son courrier, et finit sur Folio+ ; un élève entré par un code a
// le sien, qui se passe et se rejoue des Réglages ; un professeur fait le
// tour de son espace, sa classe créée pour de vrai ; un référent celui de sa
// console ; l'éditeur n'en a pas. Dans la démo, chaque rôle a son tuto la
// première fois qu'on le prend ; « Créer un nouveau livre », la croix d'une
// feuille, un appui à côté ne font rien sauter, et le retour du navigateur
// ramène à l'étape d'où l'on était parti.
import { test, expect } from '@playwright/test';
import { brancher, nouveauStore } from './faux-supabase.js';
import { semerCompte } from './faux-cercle.js';
import { faireEleve, faireProfesseur, modele } from './faux-classes.js';
import { etab, semerEtablissement } from './faux-etablissement.js';
import { passerTuto } from './aide.js';

async function entrer(page, email) {
  await page.goto('./app');
  await expect(page.locator('#boot')).toHaveCount(0, { timeout: 10000 });
  await page.getByRole('textbox', { name: 'Adresse e-mail' }).fill(email);
  await page.getByRole('textbox', { name: 'Mot de passe' }).fill('motdepasse-solide-42');
  await page.getByRole('button', { name: 'Se connecter' }).click();
}

const bulle = page => page.locator('#tu .tu-bulle.vue');
const titre = page => bulle(page).locator('.tu-t');
const etape = (page, t) => expect(titre(page)).toHaveText(t, { timeout: 10000 });
/* « Suivant » : une bulle qui vient de se poser ignore un appui trop
   rapide (un double appui ne saute pas l'étape d'après) — on réessaie
   jusqu'à ce que l'étape change, comme quelqu'un qui retouche. */
async function suivant(page) {
  const avant = await titre(page).textContent();
  for (let n = 0; n < 8; n++) {
    await bulle(page).getByRole('button', { name: 'Suivant' }).click({ timeout: 3000 }).catch(() => {});
    const change = await page.waitForFunction(a => {
      const r = document.getElementById('tu'), b = document.querySelector('#tu .tu-bulle.vue .tu-t');
      return !r || r.dataset.mode === 'carte' || !b || b.textContent !== a;
    }, avant, { timeout: 700 }).then(() => true, () => false);
    if (change) return;
  }
  throw new Error(`« Suivant » ne passe pas l’étape « ${avant} »`);
}
const prefsDe = (store, id) => ((store.tables.prefs || []).find(r => r.user_id === id) || {}).data || {};

/* Toucher ce que montre l'anneau : le geste passe par le trou, comme un
   doigt. L'anneau glisse d'une cible à l'autre (0,45 s) : on attend qu'il
   se pose, sinon on viserait l'endroit où il passait — et l'on ne touche
   que si l'étape est toujours celle qu'on lisait. */
async function toucherLaCible(page, lue) {
  await expect(page.locator('#tu')).toHaveAttribute('data-mode', 'geste');
  const anneau = page.locator('#tu .tu-anneau');
  let avant = null, b = await anneau.boundingBox();
  for (let n = 0; n < 20 && JSON.stringify(b) !== JSON.stringify(avant); n++) {
    avant = b; await page.waitForTimeout(120); b = await anneau.boundingBox();
  }
  if (lue && (await page.locator('#tu').getAttribute('data-mode') !== 'geste' || await titre(page).textContent() !== lue)) return;
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
}

/* Les gestes qui ne sont pas un simple appui au centre de la cible. */
const GESTES = {
  'Dis si tu savais': page => page.locator('.grades button').nth(2).click({ timeout: 3000 }),
  'Écris ta première page': page => bulle(page).getByRole('button', { name: 'Remplir pour moi' }).click({ timeout: 3000 }),
  'Le livre': page => page.locator('#pflivres [data-pf="livre"]').first().click({ timeout: 3000 })
};

/* L'étape du moment, lue d'un coup (le titre et le mode ensemble : entre
   deux lectures, le tuto peut avoir avancé). `null` tant qu'elle se prépare. */
const etatTuto = page => page.evaluate(() => {
  const r = document.getElementById('tu');
  if (!r) return { fini: true };
  if (r.dataset.mode === 'carte') return { fini: !!r.querySelector('.tu-fin') };
  const b = r.querySelector('.tu-bulle.vue .tu-t');
  return b && !['attente', 'pause'].includes(r.dataset.mode) ? { mode: r.dataset.mode, titre: b.textContent } : null;
});

/* Joue le tuto, comme quelqu'un qui suit les bulles, jusqu'à l'étape qui
   porte ce titre (ou jusqu'à la carte de fin) ; rend les titres traversés. */
async function jusqua(page, but) {
  const vus = [];
  for (let n = 0; n < 60; n++) {
    const s = await etatTuto(page);
    if (s && s.fini) return vus;
    if (!s || s.fini === false) { await page.waitForTimeout(100); continue; }
    if (s.titre === but) return vus;
    if (vus.at(-1) !== s.titre) vus.push(s.titre);
    try {
      if (s.mode === 'geste') await (GESTES[s.titre] || toucherLaCible)(page, s.titre);
      else await page.locator('#tu .tu-bulle.vue [data-tu="suivant"]').click({ timeout: 3000 });
    } catch { continue; }                                            // l’étape a changé sous le doigt : on relit
    await page.waitForFunction(avant => {
      const r = document.getElementById('tu'), b = document.querySelector('#tu .tu-bulle.vue .tu-t');
      return !r || r.dataset.mode === 'carte' || !b || b.textContent !== avant;
    }, s.titre, { timeout: 2500 }).catch(() => {});                // rien n'a bougé (un appui trop tôt) : on relit, on retouche
  }
  throw new Error(`le tuto n’arrive pas à « ${but} » : ${vus.join(' → ')}`);
}

test('un particulier : son premier livre, une page lue et notée, son journal, ses amis, son courrier, Folio+', async ({ page }) => {
  test.setTimeout(120000);
  const store = { ...nouveauStore(), parDefaut: 'gratuit' };             // un compte neuf : Folio gratuit
  const lea = semerCompte(store, 'lea@exemple.fr');
  faireEleve(store, 'lea@exemple.fr');
  await brancher(page, store);
  await entrer(page, 'lea@exemple.fr');

  await page.getByRole('button', { name: 'Je révise pour moi' }).click({ timeout: 10000 });
  await page.getByLabel('Prénom').fill('Léa');
  await expect(page.locator('#bvpv')).toContainText('Libre');
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByRole('button', { name: 'Lycée' }).click();
  await page.getByRole('button', { name: 'Anglais' }).click();
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByRole('button', { name: 'C’est parti' }).click();

  // la carte du début, puis les gestes
  await expect(page.locator('#tu .tu-debut h2')).toHaveText('Bienvenue, Léa', { timeout: 10000 });
  await expect.poll(() => prefsDe(store, lea).tuto).toBe(1);          // vu dès qu'il commence
  await page.locator('#tu .tu-go').click();

  await etape(page, 'Ton premier livre');
  // un appui à côté ne fait rien : la bulle le rappelle, l'écran ne bouge pas
  await page.mouse.click(30, 300);
  await expect(page.locator('#tu')).toHaveClass(/rappel/);
  await expect(page.locator('#app')).toHaveAttribute('data-view', 'home');
  await toucherLaCible(page);

  await etape(page, 'Écris ta première page');
  await expect(page.locator('#app')).toHaveAttribute('data-view', 'import');
  // une autre façon de créer (l'onglet « Coller ») attendra : on écrit sa première page
  await page.locator('[data-cmode="coller"]').click();
  await expect(page.locator('#cf')).toBeVisible();
  await bulle(page).getByRole('button', { name: 'Remplir pour moi' }).click();
  await expect(page.locator('#cn')).toHaveText('3');
  await expect(page.locator('#nm')).toHaveValue('Verbes irréguliers');   // la matière choisie à l'accueil
  // l'étape a porté : le tuto laisse voir les pages (320 ms), puis passe à « Crée-le »
  await expect(page.locator('#tu .tu-bulle.vue .tu-t')).not.toHaveText('Écris ta première page', { timeout: 5000 });

  expect(await jusqua(page, 'Folio s’en souvient')).toEqual(['Crée-le', 'Lis-le', 'Retourne la page', 'Dis si tu savais']);
  await expect(page.locator('#tu')).toHaveAttribute('data-mode', 'centre');
  await suivant(page);

  expect(await jusqua(page, '')).toEqual(['Ton journal', 'Tes progrès', 'Le cercle', 'Tes amis', 'Ton courrier', 'Ta boîte']);
  await expect(page.locator('#app')).toHaveAttribute('data-view', 'mail');

  // la fin : Folio+, l'écran Folio+ de l'app (la vente est ouverte depuis le 2026-10-27)
  const fin = page.locator('#tu .tu-fin.plus');
  await expect(fin).toBeVisible({ timeout: 10000 });
  await expect(fin.getByRole('button', { name: 'Terminer' })).toBeVisible();
  await fin.getByRole('button', { name: 'Découvrir Folio+' }).click();
  await expect(page.locator('#tu')).toHaveCount(0);
  await expect(page.locator('#app')).toHaveAttribute('data-view', 'plus', { timeout: 10000 });

  // tout est vrai : le livre, ses trois pages, la page lue au journal
  const livre = (store.tables.decks || []).find(d => d.user_id === lea && d.name === 'Verbes irréguliers');
  expect(livre).toBeTruthy();
  await expect.poll(() => (store.tables.reviews || []).filter(r => r.user_id === lea).length).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

  // il ne revient pas de lui-même
  await page.reload();
  await expect(page.locator('#boot')).toHaveCount(0, { timeout: 10000 });
  await page.waitForTimeout(1500);
  await expect(page.locator('#tu')).toHaveCount(0);
});

test('« J’ai un code » dès l’accueil : l’accueil de sa classe, son tuto, passé puis rejoué des Réglages', async ({ page }) => {
  test.setTimeout(90000);
  const store = nouveauStore();
  const { org } = semerEtablissement(store, { nom: 'Lycée Camus', classes: ['2nde A'] });
  const zoe = semerCompte(store, 'zoe@exemple.fr');
  faireEleve(store, 'zoe@exemple.fr');
  await brancher(page, store);
  await entrer(page, 'zoe@exemple.fr');

  // le code s'ouvre par-dessus l'accueil : refermé, on y est encore
  await page.getByRole('button', { name: 'J’ai un code' }).click({ timeout: 10000 });
  await page.locator('#cecode').fill(org.codes.eleve);
  await page.locator('[data-ce="lire"]').click();
  await expect(page.locator('.ce-f .mhx b')).toHaveText('Lycée Camus', { timeout: 10000 });
  await page.getByLabel('Prénom').fill('Zoé');
  await page.getByLabel('Nom', { exact: true }).fill('Bernard');
  await expect(page.locator('#cenom')).toContainText('Zoé BERNARD');
  await page.locator('.ce-cl', { hasText: '2nde A' }).click();
  await page.locator('#cego').click();

  // élève de sa classe : son lycée, son pseudo, son visage
  await expect(page.locator('.bv-ecole')).toHaveText('Lycée Camus · 2nde A', { timeout: 10000 });
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByRole('button', { name: 'C’est parti' }).click();

  // puis son tuto, côté classe ; « Passer » dit où le retrouver
  await expect(page.locator('#tu .tu-debut h2')).toHaveText('Bienvenue, Zoé', { timeout: 10000 });
  await passerTuto(page);
  await expect(page.locator('.toast')).toContainText('Le tuto t’attend dans les Réglages');
  await expect.poll(() => prefsDe(store, zoe).tuto).toBe(1);

  // il ne revient pas de lui-même ; les Réglages le rejouent, depuis le début
  await page.goto('./eleve/reglages');
  await expect(page.locator('#boot')).toHaveCount(0, { timeout: 10000 });
  await page.getByRole('button', { name: 'Revoir le tuto' }).click({ timeout: 10000 });
  await expect(page.locator('#tu .tu-debut h2')).toHaveText('Bienvenue, Zoé', { timeout: 10000 });
  await page.locator('#tu .tu-go').click();
  await etape(page, 'Ton premier livre');                            // pas encore de livre : le premier se crée
  await expect(page.locator('#app')).toHaveAttribute('data-view', 'home');
  // la croix le quitte, et dit où le retrouver
  await bulle(page).getByRole('button', { name: 'Quitter le tuto' }).click();
  await expect(page.locator('#tu')).toHaveCount(0);
  await expect(page.locator('.toast')).toContainText('Le tuto t’attend dans les Réglages');
});

test('un professeur particulier : sa classe créée pour de vrai, puis le tour de son espace, et c’est prêt', async ({ page }) => {
  test.setTimeout(120000);
  const store = nouveauStore();
  const marc = semerCompte(store, 'marc@exemple.fr');
  faireProfesseur(store, 'marc@exemple.fr', 'Marc DURAND');
  await brancher(page, store);
  await entrer(page, 'marc@exemple.fr');

  await expect(page.locator('#tu .tu-debut h2')).toHaveText('Bonjour, Marc', { timeout: 10000 });
  await expect(page.locator('#tu .tu-debut .tu-lien')).toHaveText('Passer');
  await page.locator('#tu .tu-go').click();
  expect(await jusqua(page, 'Nommez-la')).toEqual(['Le code élèves', 'Votre classe']);

  // la feuille reste à portée de main : on y tape, on y valide ; sa croix, elle, ne la ferme pas
  const feuille = page.locator('.menu:not(.sort)');
  await feuille.locator('.mx').click();
  await expect(feuille).toContainText('Nouvelle classe');
  await etape(page, 'Nommez-la');
  // un vrai compte : créer une vraie classe ne s'impose pas
  await expect(bulle(page).getByRole('button', { name: 'Plus tard' })).toBeVisible();
  await feuille.getByLabel('Nom', { exact: true }).fill('2nde 4');
  await feuille.getByRole('button', { name: 'Créer la classe' }).click();
  await etape(page, 'Ajoutez vos élèves');                            // la classe créée, la feuille d'après : le code à donner
  await expect(feuille).toContainText('2nde 4');

  expect(await jusqua(page, '')).toEqual(['Ajoutez vos élèves', 'Votre tableau de bord', 'À traiter', 'Une classe', 'Son suivi',
    'Ses devoirs', 'Donner un devoir', 'Le bilan', 'Défi en direct', 'L’agenda', 'Vos livres', 'Le courrier']);
  await expect(page.locator('#tu .tu-fin.pret h2')).toHaveText('Tout est prêt', { timeout: 10000 });
  await page.locator('#tu .tu-fin').getByRole('button', { name: 'Commencer' }).click();
  await expect(page.locator('#tu')).toHaveCount(0);
  await expect(page.locator('#app')).toHaveAttribute('data-view', 'mail');
  expect(modele(store).classes.some(c => c.name === '2nde 4')).toBe(true);
  expect(prefsDe(store, marc).tuto).toBe(1);
});

test('un professeur d’établissement : ses classes choisies dans le tuto, puis l’une d’elles et un élève', async ({ page }) => {
  test.setTimeout(120000);
  const store = nouveauStore();
  const { org, classes } = semerEtablissement(store, { nom: 'Lycée Camus', classes: ['2nde A', '1re B'] });
  const m = modele(store);
  const marc = semerCompte(store, 'durand@lycee.fr');
  m.roles[marc] = 'prof'; m.noms[marc] = 'Marc DURAND'; etab(store).membres[marc] = org.id;
  const lea = semerCompte(store, 'lea@lycee.fr');
  m.roles[lea] = 'eleve'; m.noms[lea] = 'Léa MARTIN'; etab(store).membres[lea] = org.id;
  m.membres.push({ cid: classes[0], uid: lea, depuis: new Date().toISOString() });
  await brancher(page, store);
  await entrer(page, 'durand@lycee.fr');

  await expect(page.locator('#tu .tu-debut h2')).toHaveText('Bonjour, Marc', { timeout: 10000 });
  await page.locator('#tu .tu-go').click();
  expect(await jusqua(page, 'Ajoutez vos classes')).toEqual(['Vos classes']);
  const feuille = page.locator('.menu:not(.sort)');
  await expect(bulle(page).getByRole('button', { name: 'Plus tard' })).toBeVisible();
  // « Terminé » sans classe ne finit pas l'étape : on y revient
  await page.locator('#pfmat').fill('Mathématiques');
  await feuille.locator('.pf-li', { hasText: '2nde A' }).locator('[data-pf="enseigner"]').click();
  await expect(feuille.locator('.pf-li', { hasText: '2nde A' })).toContainText('J’y enseigne');
  await feuille.getByRole('button', { name: 'Terminé' }).click();
  expect(store.et.services.some(s => s.cid === classes[0] && s.prof === marc && s.matiere === 'Mathématiques')).toBe(true);

  expect(await jusqua(page, 'Sa fiche')).toEqual(['Votre tableau de bord', 'À traiter', 'Une classe', 'Son suivi', 'Ses élèves']);
  await expect(feuille).toContainText('Léa MARTIN');
  await suivant(page);                                                 // « Suivant » referme la fiche
  await expect(feuille).toHaveCount(0);
  await etape(page, 'Ses devoirs');
  await bulle(page).getByRole('button', { name: 'Quitter le tuto' }).click();
  await expect(page.locator('#tu')).toHaveCount(0);
});

test.describe('sur ordinateur', () => {
  // un ordinateur, pas un téléphone en grand : une souris, sans écran tactile (« Cliquez », pas « Touchez »)
  test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

  test('un référent : ses codes, sa licence, puis chaque onglet de sa console, et c’est prêt', async ({ page }) => {
    test.setTimeout(90000);
    const store = nouveauStore();
    const { org } = semerEtablissement(store, { nom: 'Lycée Camus', classes: ['2nde A'] });
    const m = modele(store);
    const claire = semerCompte(store, 'ref@lycee.fr');
    m.roles[claire] = 'ref'; m.noms[claire] = 'Claire ROUX'; etab(store).membres[claire] = org.id;
    await brancher(page, store);
    await entrer(page, 'ref@lycee.fr');

    await expect(page.locator('#tu .tu-debut h2')).toHaveText('Bonjour, Claire', { timeout: 10000 });
    await page.locator('#tu .tu-go').click();
    await etape(page, 'Vos deux codes');
    await suivant(page);
    await etape(page, 'Votre licence');
    await suivant(page);
    for (const [t, aide, adresse] of [['Les classes', 'Cliquez sur « Classes »', /\/referent\/classes/],
      ['Les élèves', 'Cliquez sur « Élèves »', /\/referent\/eleves/], ['Les professeurs', 'Cliquez sur « Professeurs »', /\/referent\/professeurs/],
      ['La licence', 'Cliquez sur « Licence »', /\/referent\/licence/], ['L’historique', 'Cliquez sur « Historique »', /\/referent\/historique/]]) {
      await etape(page, t);
      await expect(bulle(page).locator('.tu-geste')).toHaveText(aide);     // à la souris, on clique
      await toucherLaCible(page);
      await expect(page).toHaveURL(adresse);
    }
    await expect(page.locator('#tu .tu-fin.pret')).toBeVisible({ timeout: 10000 });
    await page.locator('#tu .tu-fin').getByRole('button', { name: 'Commencer' }).click();
    await expect(page.locator('#tu')).toHaveCount(0);
  });

  test('l’éditeur n’a pas de tuto', async ({ page }) => {
    const store = nouveauStore();
    const moi = semerCompte(store, 'admin@folio.fr');
    modele(store).roles[moi] = 'admin';
    await brancher(page, store);
    await entrer(page, 'admin@folio.fr');
    await expect(page.locator('#app')).toHaveAttribute('data-view', 'admin', { timeout: 10000 });
    await page.waitForTimeout(1500);
    await expect(page.locator('#tu')).toHaveCount(0);
    await page.goto('./admin/reglages');
    await expect(page.locator('#app')).toHaveAttribute('data-view', 'settings', { timeout: 10000 });
    await expect(page.getByRole('button', { name: 'Revoir le tuto' })).toHaveCount(0);
  });
});

test('la démo : un tuto par rôle la première fois, et rien ne le contourne', async ({ page }) => {
  test.setTimeout(150000);
  await brancher(page, nouveauStore());
  await page.goto('./essayer');
  await expect(page.locator('#boot')).toHaveCount(0, { timeout: 10000 });
  await page.locator('.dm-role[data-v="eleve"]').click();
  await expect(page.locator('#tu .tu-debut h2')).toHaveText('Tu es Léa, en 2nde B', { timeout: 10000 });
  await page.locator('#tu .tu-go').click();

  // une lecture : le retour du navigateur ne fait pas sauter d'étape, il ramène à « Lis-le »
  expect(await jusqua(page, 'Retourne la page')).toEqual(['Tes livres', 'Lis-le']);
  await expect(page.locator('#app')).toHaveAttribute('data-view', 'study');
  await page.goBack();
  await etape(page, 'Lis-le');
  await expect(page.locator('#app')).toHaveAttribute('data-view', 'deck');
  await toucherLaCible(page);
  await etape(page, 'Retourne la page');
  // un raccourci de la lecture marche aussi ; « annuler », non
  await page.keyboard.press('Control+z');
  await etape(page, 'Retourne la page');
  await page.keyboard.press(' ');
  await etape(page, 'Dis si tu savais');
  await bulle(page).getByRole('button', { name: 'Quitter le tuto' }).click();
  await expect(page.locator('#tu')).toHaveCount(0);
  await expect(page.locator('.toast')).toContainText('Revois le tuto depuis le bandeau');
  await page.getByRole('button', { name: 'Retour' }).first().click();      // le bandeau se cache pendant une lecture
  await expect(page.locator('.dm-bandeau')).toBeVisible();

  // la première fois en professeur : son tuto
  await page.locator('.dm-bandeau select').selectOption('prof');
  await expect(page.locator('#tu .tu-debut h2')).toHaveText('Vous êtes Marc, professeur', { timeout: 10000 });
  await page.locator('#tu .tu-go').click();
  expect(await jusqua(page, 'Le livre')).toEqual(['Le code élèves', 'Votre tableau de bord', 'À traiter', 'Une classe', 'Son suivi',
    'Ses élèves', 'Sa fiche', 'Ses devoirs', 'Donner un devoir']);

  // choisir le livre d'un devoir : « Créer un nouveau livre », la croix de la feuille, un appui à côté ne font rien
  const feuille = page.locator('.menu:not(.sort)');
  await feuille.locator('[data-pf="livre-neuf"]').click();
  await expect(page.locator('#tu')).toHaveClass(/rappel/);
  await feuille.locator('.mx').click();
  await page.mouse.click(8, 8);
  await page.waitForTimeout(500);
  await etape(page, 'Le livre');
  await expect(page.locator('#app')).toHaveAttribute('data-view', 'profclasse');
  await expect(feuille).toContainText('Quel livre');
  await feuille.locator('#pflivres [data-pf="livre"]', { hasText: 'Fonctions : le cours' }).click();

  // dans la démo, le devoir se donne pour de vrai (rien ne part : c'est le lycée de la démo)
  await etape(page, 'C’est prêt');
  await expect(bulle(page).getByRole('button', { name: 'Plus tard' })).toHaveCount(0);
  await toucherLaCible(page);
  await etape(page, 'Le bilan');
  await expect(page.locator('.toast')).toContainText('5 cartes');
  await page.keyboard.press('Escape');                                // Échap le quitte
  await expect(page.locator('#tu')).toHaveCount(0);

  // revenir à l'élève : son tuto est déjà vu ; le bandeau le rejoue
  await page.locator('.dm-bandeau select').selectOption('eleve');
  await expect(page).toHaveURL(/\/demo\/eleve\/classe$/, { timeout: 10000 });
  await page.waitForTimeout(1200);
  await expect(page.locator('#tu')).toHaveCount(0);
  await page.locator('.dm-bandeau [data-dm="tuto"]').click();
  await expect(page.locator('#tu .tu-debut h2')).toHaveText('Tu es Léa, en 2nde B', { timeout: 10000 });
  await passerTuto(page);

  // quitter la démo l'oublie : on y revient, le tuto du rôle choisi revient
  await page.locator('.dm-bandeau [data-dm="quitter"]').click();
  await expect(page).toHaveURL(/\/$/, { timeout: 10000 });
  await page.goto('./essayer');
  await expect(page.locator('#boot')).toHaveCount(0, { timeout: 10000 });
  await page.locator('.dm-role[data-v="ref"]').click();
  await expect(page.locator('#tu .tu-debut h2')).toHaveText('Vous êtes Claire, référente', { timeout: 10000 });
});

test.describe('la démo sur ordinateur', () => {
  test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

  test('un professeur de la démo finit sur Folio Campus, la marque du site', async ({ page }) => {
    test.setTimeout(120000);
    await brancher(page, nouveauStore());
    await page.goto('./essayer');
    await expect(page.locator('#boot')).toHaveCount(0, { timeout: 10000 });
    await page.locator('.dm-role[data-v="prof"]').click();
    await expect(page.locator('#tu .tu-debut h2')).toHaveText('Vous êtes Marc, professeur', { timeout: 10000 });
    await page.locator('#tu .tu-go').click();
    const vus = await jusqua(page, '');
    expect(vus.slice(-4)).toEqual(['Défi en direct', 'L’agenda', 'Vos livres', 'Le courrier']);
    const fin = page.locator('#tu .tu-fin.campus');
    await expect(fin.locator('h2')).toHaveText(/Folio\s+Campus/);
    await expect(fin.locator('.tu-campus-ic img')).toHaveAttribute('src', '/site/logo.svg');
    await expect(fin.getByRole('link', { name: 'Essayer dans mon établissement' })).toHaveAttribute('href', '/demande-demo');
    await fin.getByRole('button', { name: 'Continuer la démo' }).click();
    await expect(page.locator('#tu')).toHaveCount(0);
  });
});
