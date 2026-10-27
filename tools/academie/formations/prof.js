// Folio Academy — Professeur : l'essentiel en quatre étapes (ordinateur, vouvoiement).
// Ce qui bloque un professeur : avoir ses classes, y faire entrer ses
// élèves, donner un devoir, voir qui décroche. Le reste (groupes, messages,
// défis en direct, agenda) se découvre : la carte de fin le nomme.

const CL = { '2nde A': 'dece0000-0000-4000-8000-000000000101', '2nde B': 'dece0000-0000-4000-8000-000000000102' };

async function scenario(t) {
  await t.carte({ sur: 'Folio Academy · Professeur', titre: 'Bien démarrer avec Folio',
    txt: 'Vos classes, vos élèves, vos devoirs, leur suivi.' });
  await t.dire('Folio fait réviser vos élèves au bon moment : vous donnez les devoirs, l’application s’occupe du reste, et vous suivez le travail de chacun.');

  /* ---------- 1 ---------- */
  await t.chapitre('Choisir vos classes', ['Votre compte', 'Vos classes'], { sous: 'Le code professeurs, puis vos classes.' });
  await t.dire('Première étape : vos classes.');
  await t.sansCarte();
  await t.etape(0);
  await t.dire('Créez votre compte, puis, dans les Réglages, touchez J’ai un code et tapez le code professeurs que votre référent vous a remis.', async () => {
    await t.toucher('[data-lm="up"]');
    await t.pause(300);
    await t.taper('#em', 'marc.durand@lycee-demo.fr', { delai: 40 });
  });
  await t.etape(1);
  await t.dire('Vous arrivez sur votre tableau de bord. Touchez Mes classes.', async () => {
    await t.rideau(true);
    await t.aller('/essayer', 600);
    await t.L('.dm-role[data-v="prof"]').click();
    await t.pret(2000);
    await t.rideau(false);
    await t.toucher('.pf-btn[data-pf="choisir"]');
    await t.pause(600);
  });
  await t.dire('Indiquez votre matière, puis touchez Ajouter sur chaque classe où vous enseignez.', async () => {
    await t.taper('#pfmat', 'Mathématiques', { delai: 55 });
    await t.toucher(`[data-pf="enseigner"][data-id="${CL['2nde A']}"]`);
    await t.pause(900);
  });
  await t.dire('Touchez Terminé : vos classes sont prêtes.', async () => {
    await t.toucher('[data-pf="fermer"]');
    await t.pause(900);
    await t.montrer('.pf-ni[data-pf="classe"] >> nth=0 >> xpath=..');
  });
  await t.cacher();

  /* ---------- 2 ---------- */
  await t.chapitre('Faire entrer vos élèves', ['Le code élèves', 'Au tableau'], { sous: 'Un code, un QR code, et c’est fait.' });
  await t.dire('Deuxième étape : faire entrer vos élèves.');
  await t.sansCarte();
  await t.etape(0);
  await t.dire('Ouvrez une classe, puis touchez Code élèves.', async () => {
    await t.toucher(`.pf-ni[data-pf="classe"][data-id="${CL['2nde B']}"]`);
    await t.pause(900);
    await t.toucher('[data-pf="inviter"]');
    await t.pause(700);
  });
  await t.dire('Voici le code de votre établissement, avec son QR code.', async () => {
    await t.zoom('.menu:not(.sort)', 1.45);
  });
  await t.dezoom();
  await t.etape(1);
  await t.dire('En classe, projetez-le au tableau.', async () => {
    await t.toucher('.menu:not(.sort) [data-pf="tableau"]');
    await t.pause(900);
  });
  await t.dire('Chaque élève scanne le QR code ou tape le code, choisit sa classe, et le voilà inscrit : vous n’avez rien à valider.');
  await t.astuce('Le code change chaque semaine : les élèves déjà entrés restent.');
  await t.dire('Le code change chaque semaine, mais les élèves déjà entrés restent.', async () => {
    await t.fermerFeuille();
    const f = await t.cadreApp();
    if (await f.locator('.menu:not(.sort)').count()) await t.fermerFeuille();
  });
  await t.astuce('');

  /* ---------- 3 ---------- */
  await t.chapitre('Donner un devoir', ['Un livre', 'La date', 'Donner'], { sous: 'Un livre, une classe, une date.' });
  await t.dire('Troisième étape : donner un devoir.');
  await t.sansCarte();
  await t.etape(0);
  await t.dire('Touchez Devoir, et choisissez un livre. Pour en créer un, il suffit de coller votre cours ou une liste.', async () => {
    await t.toucher('.pf-btn[data-pf="donner"]');
    await t.pause(800);
    await t.montrer('.menu:not(.sort) [data-pf="livre-neuf"]');
    await t.pause(2600);
    await t.toucher('.menu:not(.sort) [data-pf="livre"]:has-text("Probabilités")');
    await t.pause(800);
  });
  await t.etape(1);
  await t.dire('La classe est déjà cochée. Choisissez la date de rendu.', async () => {
    await t.montrer(`.menu:not(.sort) [data-pf="cible"][data-id="${CL['2nde B']}"]`);
    await t.pause(1400);
    await t.toucher('.menu:not(.sort) [data-pf="due"]:has-text("Dans 1 semaine")');
  });
  await t.etape(2);
  await t.dire('Touchez Donner : c’est envoyé.', async () => {
    await t.toucher('.menu:not(.sort) [data-pf="donner-go"]');
    await t.pause(1100);
  });
  await t.dire('Vos élèves le reçoivent aussitôt. Ils n’ont rien à vous rendre : leur avancement remonte tout seul.', async () => {
    await t.toucher('[data-pf="onglet"][data-v="devoirs"]');
    await t.pause(800);
    await t.montrer('[data-pf="devoir"]:has-text("Probabilités")');
  });
  await t.cacher();

  /* ---------- 4 ---------- */
  await t.chapitre('Suivre vos élèves', ['Qui décroche', 'Ce qui bloque', 'À traiter'], { sous: 'Qui avance, qui décroche, ce qui bloque.' });
  await t.dire('Dernière étape : suivre le travail.');
  await t.sansCarte();
  await t.etape(0);
  await t.dire('L’onglet Élèves vous montre qui est en retard, et qui ne s’est jamais connecté.', async () => {
    await t.toucher('[data-pf="onglet"][data-v="eleves"]');
    await t.pause(700);
    await t.toucher('[data-pf="filtre"][data-v="ko"]');
    await t.pause(500);
    await t.zoom('.pf-tr >> nth=1', 1.4);
  });
  await t.dezoom();
  await t.etape(1);
  await t.dire('Ouvrez un devoir : Ce qui bloque montre les pages que la classe rate le plus. Vous savez exactement quoi reprendre en cours.', async () => {
    await t.toucher('[data-pf="filtre"][data-v="tous"]');
    await t.toucher('[data-pf="onglet"][data-v="devoirs"]');
    await t.pause(600);
    await t.toucher('[data-pf="devoir"]:has-text("Fonctions affines")');
    await t.pause(1100);
    await t.montrer('.menu:not(.sort) .pf-list');
  });
  await t.cacher();
  await t.fermerFeuille();
  await t.etape(2);
  await t.dire('Et chaque jour, sur votre tableau de bord, la liste À traiter vous dit ce qui demande votre attention.', async () => {
    await t.toucher('.pf-ni[data-pf="accueil"]');
    await t.pause(900);
    await t.zoom('.pf-panel >> nth=0', 1.45);
  });
  await t.dezoom();

  /* ---------- fin ---------- */
  await t.taire();
  await t.carte({ sur: 'Folio Academy · Professeur', titre: 'Vous êtes prêt !', txt: 'À découvrir ensuite :',
    puces: ['Créer un groupe', 'Écrire à la classe', 'Défi en direct au tableau', 'L’agenda'] });
  await t.dire('Vous avez l’essentiel. À découvrir ensuite : les groupes, les messages à la classe, les défis en direct au tableau, et l’agenda.');
  await t.dire('Bonne rentrée avec Folio !');
  await t.pause(1200);
}

export default {
  nom: 'prof', fichier: 'Folio-Academy-2-Professeur.mp4', mode: 'pc', module: 'Professeur', depart: '/connexion',
  titre: 'Folio Academy — Professeur : bien démarrer',
  intro: { sur: 'Folio Academy · Professeur', titre: 'Bien démarrer', txt: 'L’essentiel en quatre étapes. Chacune a son minutage.',
    repliques: ['Bienvenue dans la Folio Academy !', 'En quatre étapes, voici l’essentiel pour bien démarrer.'] },
  scenario
};
