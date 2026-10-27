// Folio Academy — Élève : l'essentiel en trois étapes (téléphone, tutoiement, comme l'app).
// Ce qui bloque un élève : entrer dans sa classe, faire un devoir, réviser
// chaque jour. Le reste (créer ses livres, journal, Cercle, courrier) se
// découvre : la carte de fin le nomme.

async function scenario(t) {
  let monde = null;

  await t.carte({ sur: 'Folio Academy · Élève', titre: 'Bien démarrer avec Folio',
    txt: 'Entrer dans ta classe, faire un devoir, réviser chaque jour.' });
  await t.dire('Folio, c’est ton carnet de révision : l’application te fait relire tes cours au bon moment, pour que tu les retiennes vraiment.', async () => {
    // en coulisse : Léa quitte son lycée, pour y entrer pour de vrai avec le code à l'étape 1
    await t.taille(1280, 800);
    await t.aller('/essayer', 600);
    await t.L('.dm-role[data-v="ref"]').click();
    await t.pret(1800);
  });
  await t.dire('Trois étapes : entrer dans ta classe, faire un devoir, et réviser un peu chaque jour.', async () => {
    await t.L('[data-r="ref:eleves"]').first().click();
    await t.pause(700);
    await t.L('[data-rf="personne"]', { hasText: 'Léa MARTIN' }).click();
    await t.pause(700);
    await t.L('[data-rf="retirer"]').click();
    await t.pause(500);
    await t.L('[data-rf="retirer"]').click();
    await t.pause(1200);
    monde = await t.lireDemo();
    await t.taille(0, 0);
    await t.aller('/connexion', 600);
  });

  /* ---------- 1 ---------- */
  await t.chapitre('Entrer dans ta classe', ['Ton compte', 'Le code', 'Ta classe'], { sous: 'Ton compte, puis le code de ton lycée.' });
  await t.dire('D’abord, rejoindre ta classe.');
  await t.sansCarte();
  await t.etape(0);
  await t.dire('Ouvre Folio et touche Créer un compte : ton adresse mail, un mot de passe, et c’est parti.', async () => {
    await t.toucher('[data-lm="up"]');
    await t.pause(300);
    await t.taper('#em', 'lea.martin@exemple.fr', { delai: 45 });
  });
  await t.dire('Ton lycée t’a remis une carte élève ? Choisis plutôt l’onglet Carte élève.', async () => {
    await t.montrer('[data-lm="carte"]');
  });
  await t.cacher();
  await t.etape(1);
  await t.dire('Une fois connecté, ouvre les Réglages.', async () => {
    await t.rideau(true);
    await t.ecrireDemo(monde);
    await t.aller('/demo/eleve/livres', 1000);
    await t.rideau(false);
    await t.toucher('[data-act="settings"]');
  });
  await t.dire('Touche J’ai un code, et tape le code que ton professeur t’a donné.', async () => {
    await t.toucher('[data-ce="ouvrir"]');
    await t.taper('#cecode', 'DEMXPK47', { delai: 110 });
    await t.toucher('#ceok');
  });
  await t.etape(2);
  await t.dire('Écris ton prénom et ton nom, choisis ta classe, puis touche Entrer.', async () => {
    await t.taper('#cepre', 'Léa', { delai: 90 });
    await t.taper('[data-cein="nom"]', 'Martin', { delai: 90 });
    await t.toucher('[data-ce="classe"]:has-text("2nde B")');
    await t.toucher('#cego');
    await t.pause(1300);
  });
  await t.dire('C’est fait : te voilà dans ta classe !', async () => {
    await t.montrer('[data-act="tab-classes"]', { etiq: 'Ta classe' });
  });
  await t.cacher();

  /* ---------- 2 ---------- */
  await t.chapitre('Faire un devoir', ['Ouvrir le devoir', 'Lire et retourner', 'Te noter'], { sous: 'Lire, retourner, se noter.' });
  await t.dire('Tes devoirs t’attendent dans l’onglet Classe.', async () => {
    await t.L('[data-act="tab-classes"]').click();
    await t.pause(800);
  });
  await t.sansCarte();
  await t.etape(0);
  await t.dire('Touche un devoir, puis Lire.', async () => {
    await t.toucher('[data-el="devoir"]:has-text("Fonctions affines")');
    await t.pause(900);
    await t.toucher('[data-act="study"]');
    await t.pause(700);
  });
  await t.etape(1);
  await t.dire('La question s’affiche. Cherche la réponse dans ta tête, puis touche la page pour la retourner.', async () => {
    await t.montrer('#top');
    await t.pause(2600);
    await t.toucher('#top');
    await t.pause(500);
  });
  await t.etape(2);
  await t.dire('Maintenant, sois honnête : Encore si tu ne savais pas, Difficile, Correct, ou Facile.', async () => {
    for (const g of ['g0', 'g1', 'g2', 'g3']) { await t.montrer(`.gr.${g}`); await t.pause(950); }
  });
  await t.dire('Folio te reposera la page au bon moment : plus c’était facile, plus elle reviendra tard.', async () => {
    await t.montrer('.grades');
  });
  await t.cacher();
  await t.dire('Continue ainsi jusqu’à la dernière page.', async () => {
    await t.toucher('.gr.g3');
    for (let k = 0; k < 5; k++) {
      await t.pause(350);
      await t.toucher('#top');
      await t.pause(300);
      await t.toucher('.gr.g3');
    }
    await t.pause(700);
  });
  await t.dire('Bravo ! Ton devoir est rendu tout seul : ton professeur voit ton travail, tu n’as rien à envoyer.', async () => {
    await t.montrer('.rev');
  });
  await t.cacher();

  /* ---------- 3 ---------- */
  await t.chapitre('Réviser chaque jour', ['La lecture du jour', 'Ton objectif'], { sous: 'Un peu, chaque jour : le secret pour retenir.' });
  await t.dire('Le secret pour retenir : un peu, chaque jour.', async () => {
    await t.aller('/demo/eleve/livres', 900);
  });
  await t.sansCarte();
  await t.etape(0);
  await t.dire('Dans l’onglet Livres, touche Lecture du jour : Folio rassemble les pages à revoir aujourd’hui, dans tous tes livres.', async () => {
    await t.montrer('[data-act="marathon"]');
    await t.pause(3200);
    await t.toucher('[data-act="marathon"]');
    await t.pause(900);
  });
  await t.dire('Tu lis, tu retournes, tu te notes : exactement comme pour un devoir.', async () => {
    await t.toucher('#top');
    await t.pause(600);
    await t.montrer('.grades');
  });
  await t.cacher();
  await t.etape(1);
  await t.dire('Le cercle, en haut de tes livres, suit ton objectif du jour. Quelques minutes suffisent.', async () => {
    await t.rideau(true);
    await t.aller('/demo/eleve/livres', 900);
    await t.rideau(false);
    await t.montrer('[data-act="goalinfo"]', { etiq: 'Objectif du jour' });
  });
  await t.cacher();
  await t.astuce('Pas de réseau ? Folio marche aussi hors ligne.');
  await t.dire('Et même sans réseau, Folio fonctionne : tes réponses partent dès que la connexion revient.');

  /* ---------- fin ---------- */
  await t.taire();
  await t.carte({ sur: 'Folio Academy · Élève', titre: 'À toi de jouer !', txt: 'À découvrir quand tu veux :',
    puces: ['Créer tes livres', 'Ton journal de progrès', 'Défier tes amis', 'Ton courrier'] });
  await t.dire('Tu connais l’essentiel. Le reste, tu le découvriras en chemin : créer tes propres livres, suivre tes progrès, défier tes amis.');
  await t.dire('Bonnes révisions !');
  await t.pause(1200);
}

export default {
  nom: 'eleve', fichier: 'Folio-Academy-1-Eleve.mp4', mode: 'tel', module: 'Élève', depart: '/essayer',
  titre: 'Folio Academy — Élève : bien démarrer',
  intro: { sur: 'Folio Academy · Élève', titre: 'Bien démarrer', txt: 'L’essentiel en trois étapes. Chacune a son minutage.',
    repliques: ['Bienvenue dans la Folio Academy !', 'En trois étapes, tu vas apprendre l’essentiel. Voici le programme.'] },
  scenario
};
