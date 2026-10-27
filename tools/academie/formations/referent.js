// Folio Academy — Référent : l'essentiel en quatre étapes (ordinateur, vouvoiement).
// Ce qui bloque un référent : activer sa console, créer les classes,
// distribuer les codes, corriger un compte. Le reste (licence et factures,
// ajouter un professeur, historique, cartes élève) se découvre.

async function scenario(t) {
  await t.carte({ sur: 'Folio Academy · Référent', titre: 'Mettre en place Folio',
    txt: 'Votre console, vos classes, vos codes, vos corrections.' });
  await t.dire('En tant que référent, vous organisez Folio pour tout l’établissement : les classes, les codes, et les comptes.');

  /* ---------- 1 ---------- */
  await t.chapitre('Activer votre console', ['Le code référent', 'L’accueil'], { sous: 'Le code référent, à usage unique.' });
  await t.dire('Première étape : activer votre console.');
  await t.sansCarte();
  await t.etape(0);
  await t.dire('Créez votre compte, puis, dans les Réglages, touchez J’ai un code et tapez le code référent que Folio vous a envoyé. Il ne sert qu’une fois.', async () => {
    await t.toucher('[data-lm="up"]');
    await t.pause(300);
    await t.taper('#em', 'claire.roux@lycee-demo.fr', { delai: 40 });
  });
  await t.etape(1);
  await t.dire('Voici votre console. Sur l’Accueil, vos deux codes, et l’état de votre licence.', async () => {
    await t.rideau(true);
    await t.aller('/essayer', 600);
    await t.L('.dm-role[data-v="ref"]').click();
    await t.pret(2000);
    await t.rideau(false);
    await t.zoom('[data-rf="copier"][data-id="eleve"] >> xpath=../..', 1.35);
  });
  await t.dezoom();

  /* ---------- 2 ---------- */
  await t.chapitre('Créer les classes', ['Nouvelle classe', 'Professeur principal'], { sous: 'Avant de donner les codes.' });
  await t.dire('Deuxième étape : créer vos classes, avant de donner les codes.', async () => {
    await t.L('[data-r="ref:classes"]').first().click();
    await t.pause(800);
  });
  await t.sansCarte();
  await t.etape(0);
  await t.dire('Tapez le nom de la classe, choisissez son niveau, et touchez Créer.', async () => {
    await t.taper('#rfcnom', '2nde C', { delai: 90 });
    await t.choisir('#rfcniv', '2nde');
    await t.toucher('.rf-b.pri:has-text("Créer")');
    await t.pause(900);
  });
  await t.dire('Elle apparaît aussitôt dans la liste. Faites-le pour chaque classe.', async () => {
    await t.montrer('[data-rf="classe"]:has-text("2nde C")');
  });
  await t.cacher();
  await t.etape(1);
  await t.dire('Ouvrez une classe pour voir son équipe, et désigner son professeur principal.', async () => {
    await t.toucher('[data-rf="classe"]:has-text("2nde A")');
    await t.pause(900);
    await t.toucher('[data-rf="pp"]');
    await t.pause(900);
  });

  /* ---------- 3 ---------- */
  await t.chapitre('Distribuer les codes', ['Code professeurs', 'Code élèves', 'Renouvellement'], { sous: 'D’abord les professeurs, puis les élèves.' });
  await t.dire('Troisième étape : distribuer les codes.', async () => {
    await t.L('[data-r="ref:accueil"]').first().click();
    await t.pause(800);
  });
  await t.sansCarte();
  await t.etape(0);
  await t.dire('Donnez d’abord le code professeurs, en salle des profs : chaque professeur entre, puis choisit ses classes.', async () => {
    await t.montrer('[data-rf="copier"][data-id="prof"] >> xpath=../..', { etiq: 'Code professeurs' });
  });
  await t.etape(1);
  await t.dire('Puis le code élèves, à chaque classe : l’élève entre, et choisit la sienne.', async () => {
    await t.montrer('[data-rf="copier"][data-id="eleve"] >> xpath=../..', { etiq: 'Code élèves' });
  });
  await t.dire('Afficher le montre en grand, avec un QR code.', async () => {
    await t.toucher('[data-rf="projeter"][data-id="eleve"]');
    await t.pause(2400);
    await t.toucher('[data-rf="projo-fin"]');
    await t.pause(500);
  });
  await t.etape(2);
  await t.dire('Les codes se renouvellent seuls chaque semaine, et ceux qui sont entrés restent. Besoin d’un nouveau code tout de suite ? Touchez Changer.', async () => {
    await t.montrer('[data-rf="changer"][data-id="eleve"]');
  });
  await t.cacher();

  /* ---------- 4 ---------- */
  await t.chapitre('Corriger un compte', ['Trouver', 'Corriger', 'Un départ'], { sous: 'Un nom, une classe, un départ.' });
  await t.dire('Dernière étape : corriger un compte.', async () => {
    await t.L('[data-r="ref:eleves"]').first().click();
    await t.pause(800);
  });
  await t.sansCarte();
  await t.etape(0);
  await t.dire('Dans Élèves, cherchez un nom, et ouvrez sa fiche.', async () => {
    await t.taper('#rfq', 'gar', { delai: 120 });
    await t.pause(700);
    await t.toucher('[data-rf="personne"]:has-text("Adam GARNIER")');
    await t.pause(800);
  });
  await t.etape(1);
  await t.dire('Vous seul pouvez corriger son nom, et changer sa classe.', async () => {
    await t.zoom('.rf-fiche', 1.3);
    await t.montrer('#rfnnom');
    await t.pause(1600);
    await t.montrer('.rf-deplacer.large');
  });
  await t.etape(2);
  await t.dire('Un élève quitte l’établissement ? Retirer de l’établissement libère sa place sur la licence. Son compte et ses livres restent à lui.', async () => {
    await t.montrer('[data-rf="retirer"]');
  });
  await t.dezoom();

  /* ---------- fin ---------- */
  await t.taire();
  await t.carte({ sur: 'Folio Academy · Référent', titre: 'Votre établissement est prêt', txt: 'À découvrir ensuite :',
    puces: ['Licence et factures', 'Ajouter un professeur', 'Historique', 'Cartes élève'] });
  await t.dire('C’est tout pour l’essentiel. Dans l’onglet Licence, vous retrouverez vos places, vos factures, et vos échanges avec Folio.');
  await t.dire('Bonne rentrée !');
  await t.pause(1200);
}

export default {
  nom: 'referent', fichier: 'Folio-Academy-3-Referent.mp4', mode: 'pc', module: 'Référent', depart: '/connexion',
  titre: 'Folio Academy — Référent : mettre en place Folio',
  intro: { sur: 'Folio Academy · Référent', titre: 'Mettre en place Folio', txt: 'L’essentiel en quatre étapes. Chacune a son minutage.',
    repliques: ['Bienvenue dans la Folio Academy !', 'Voici, en quatre étapes, comment mettre en place Folio dans votre établissement.'] },
  scenario
};
