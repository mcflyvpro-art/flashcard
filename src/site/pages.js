/* Les pages du site (2026-11-02, le référencement « à fond ») : une page par
   question qu'on tape dans Google, chacune avec son adresse, son titre et sa
   description. Avant, tout tenait sur la page d'accueil : Google n'avait
   qu'une adresse à montrer, et rien pour faire des liens de site (les
   « sous-liens » sous le résultat) ni pour répondre à « répétition
   espacée », « flashcards IA » ou « Anki ou Quizlet ».

   Ce fichier est la seule source : vite.config.js en tire les entrées du
   build et le sitemap, tools/site/gabarit.js les balises de chaque page
   (titre, description, canonique, Open Graph, fil d'Ariane), src/sw.js la
   liste des navigations qu'il ne touche pas, et test/seo.test.js ce qu'il
   vérifie. Sans dépendance : Node et le navigateur le lisent tels quels.

   Une adresse ne doit jamais croiser celles de l'app (src/routes.js :
   /connexion, /eleve/…, /prof/…) : test/seo.test.js le vérifie. Le titre
   tient en 60 signes, la description entre 110 et 160 (au-delà, Google
   coupe). `maj` : la date du dernier vrai changement du texte, que le
   sitemap donne à Google — ne la bouger que si le contenu a bougé.
   docs/SEO.md. */

export const SITE = 'https://mirandola.fr';

/** @typedef {{ chemin: string, fichier: string, nom: string, titre: string, description: string,
 *   maj: string, image: string, imageAlt: string, type?: string }} PageDuSite */

/** @type {PageDuSite[]} */
export const PAGES = [
  {
    chemin: '/', fichier: 'index.html', nom: 'Accueil',
    titre: 'Mirandola : flashcards IA et répétition espacée pour réviser',
    description: 'L’IA fait de ton cours des flashcards, Mirandola te les repose juste avant l’oubli, avec l’algorithme d’Anki. Gratuit, hors ligne, pour élèves, profs et lycées.',
    maj: '2026-11-02', image: '/site/og.jpg',
    imageAlt: 'Mirandola, l’app de révision : trois livres empilés, l’app sur ordinateur et téléphone, et une page de flashcard'
  },
  {
    chemin: '/flashcards-ia', fichier: 'flashcards-ia.html', nom: 'Flashcards avec l’IA',
    titre: 'Créer des flashcards avec l’IA, depuis ton cours | Mirandola',
    description: 'Colle ton cours, prends une photo de ton cahier ou importe un PDF : l’IA de Mirandola en fait un livre de flashcards en quelques secondes, prêt à réviser.',
    maj: '2026-11-04', image: '/site/og/flashcards-ia.jpg',
    imageAlt: 'Un cours transformé en livre de flashcards par l’IA de Mirandola'
  },
  {
    chemin: '/repetition-espacee', fichier: 'repetition-espacee.html', nom: 'La répétition espacée', type: 'Article',
    titre: 'La répétition espacée, expliquée simplement | Mirandola',
    description: 'Courbe de l’oubli, intervalles, algorithme FSRS : comment la répétition espacée fait retenir 9 pages sur 10, et comment t’en servir pour tes examens.',
    maj: '2026-11-04', image: '/site/og/repetition-espacee.jpg',
    imageAlt: 'La courbe de l’oubli, et la mémoire qui reste haute avec la répétition espacée'
  },
  {
    chemin: '/moteur', fichier: 'moteur.html', nom: 'Le moteur FSRS', type: 'Article',
    titre: 'Le moteur FSRS de Mirandola, formule par formule',
    description: 'FSRS-6 dans le détail : la courbe d’oubli, la stabilité, la difficulté, les 21 paramètres, l’optimiseur et le banc d’essai. Les vraies équations du moteur.',
    maj: '2026-11-04', image: '/site/og/moteur.jpg',
    imageAlt: 'Les équations de FSRS-6, le moteur de révision de Mirandola, et ses courbes d’oubli'
  },
  {
    chemin: '/etablissements', fichier: 'etablissements.html', nom: 'Mirandola Campus',
    titre: 'Mirandola Campus : la révision pour tout l’établissement',
    description: 'Collèges, lycées, prépas : Mirandola Campus ouvre la révision par flashcards à tous vos élèves et professeurs en dix minutes. Démo gratuite 30 jours.',
    maj: '2026-11-04', image: '/site/og/etablissements.jpg',
    imageAlt: 'Mirandola Campus : l’espace du professeur, de l’élève et du référent de l’établissement'
  },
  {
    chemin: '/professeurs', fichier: 'professeurs.html', nom: 'Professeurs',
    titre: 'Mirandola pour les professeurs : devoirs, suivi, défis',
    description: 'Donnez un livre de flashcards en devoir, voyez qui l’a lu et ce qui bloque, lancez un défi en direct en classe. Gratuit pour les cours particuliers.',
    maj: '2026-11-04', image: '/site/og/professeurs.jpg',
    imageAlt: 'Le tableau de bord du professeur dans Mirandola'
  },
  {
    chemin: '/tarifs', fichier: 'tarifs.html', nom: 'Tarifs',
    titre: 'Tarifs : Mirandola gratuit, Mirandola+ et Mirandola Campus',
    description: 'Mirandola est gratuit. Mirandola+ ouvre l’IA et le Memory Engine Ultra pour 4,17 € par mois à l’année. Campus : de 5 à 2 € HT par élève et par an.',
    maj: '2026-11-04', image: '/site/og/tarifs.jpg',
    imageAlt: 'Les trois offres de Mirandola : gratuit, Mirandola+ et Mirandola Campus'
  },
  {
    chemin: '/anki-quizlet', fichier: 'anki-quizlet.html', nom: 'Anki, Quizlet ou Mirandola',
    titre: 'Anki, Quizlet ou Mirandola : quelle app de flashcards ?',
    description: 'Anki, Quizlet, Mirandola : ce que fait chaque app de flashcards, pour qui, et à quel prix. Et comment reprendre tes paquets Anki et tes listes Quizlet.',
    maj: '2026-11-04', image: '/site/og/anki-quizlet.jpg',
    imageAlt: 'Trois apps de flashcards comparées : Anki, Quizlet et Mirandola'
  },
  {
    chemin: '/a-propos', fichier: 'a-propos.html', nom: 'Pourquoi Mirandola', type: 'AboutPage',
    titre: 'Pourquoi Mirandola ? D’après Pic de la Mirandole',
    description: 'Mirandola tient son nom de Pic de la Mirandole, l’érudit à la mémoire prodigieuse né à Mirandola, en Italie. Ce que l’app veut faire, et comment.',
    maj: '2026-11-04', image: '/site/og/a-propos.jpg',
    imageAlt: 'Mirandola, d’après Pic de la Mirandole'
  }
];

/* L'adresse complète d'une page, telle que Google doit la retenir. */
export const adresse = p => SITE + p.chemin;

/* Les pages autres que l'accueil : celles que le gabarit habille. */
export const SOUS_PAGES = PAGES.filter(p => p.chemin !== '/');
