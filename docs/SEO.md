# Le référencement de mirandola.fr

> Le guide de l'utilisateur (« gère tout le SEO, dis-moi comment tester,
> visualiser, comprendre », 2026-11-02) et la mémoire technique pour qui
> reprend. Le chantier lui-même : `docs/LANDING.md`, tour 7.

## 1. Ce qui est en place

**Huit pages au lieu d'une.** Google ne montre de sous-liens sous un
résultat (« Tarifs », « Établissements »…) que s'il y a plusieurs pages à
montrer, et une page ne se place bien que sur ce dont elle parle. Le site a
donc une page par recherche :

| Adresse | Ce qu'on y cherche |
|---|---|
| `/` | Mirandola, flashcards IA, répétition espacée (l'accueil, inchangé) |
| `/flashcards-ia` | créer des flashcards avec l'IA, depuis un cours, une photo, un PDF |
| `/repetition-espacee` | la répétition espacée, la courbe de l'oubli, FSRS, comment réviser |
| `/etablissements` | Mirandola Campus : une app de révision pour un collège, un lycée, une prépa |
| `/professeurs` | devoirs suivis, défis en direct, cours particuliers |
| `/tarifs` | le prix de Mirandola+, de Campus |
| `/anki-quizlet` | Anki ou Quizlet, une alternative à Anki sur iPhone |
| `/a-propos` | Pourquoi Mirandola, Pic de la Mirandole |

**Sur chaque page**, ce que Google lit : un titre (60 signes au plus) et
une description (110 à 160) écrits pour donner envie de cliquer, l'adresse
officielle (canonique), un seul titre principal, tout le texte en HTML (pas
chargé par un script), un fil d'Ariane visible et en données structurées,
une image de partage à elle (1200 × 630, `public/site/og/`), la FAQ en
données structurées tirée mot pour mot du texte affiché.

**Pour tout le site** : un sitemap fabriqué à chaque build depuis la liste
des pages (`/sitemap.xml`), `robots.txt`, le nom du site et le logo en
données structurées (`WebSite`, `Organization`), le favicon à la racine
(`favicon.ico`, `favicon-48.png`, `apple-touch-icon.png` : Google veut un
carré multiple de 48 px), `llms.txt` (le résumé du site pour ChatGPT,
Perplexity, Claude), une clé IndexNow (Bing), une redirection `/tarifs/` →
`/tarifs`.

**Ce qui le garde juste** : `test/seo.test.js` vérifie tout ce qui précède
page par page, à chaque `npm run check` (titre, description, canonique, h1
unique, données structurées, FAQ identique au texte, liens qui mènent
quelque part, prix égaux à ceux de l'app et de Stripe, sitemap, robots,
favicon, aucune adresse qui croise celles de l'app). `e2e/pages.e2e.js`
ouvre chaque page dans un vrai navigateur.

## 2. À quoi ressemblera Mirandola dans Google

```
 [logo] Mirandola
        https://mirandola.fr
 Mirandola : flashcards IA et répétition espacée pour réviser
 L’IA fait de ton cours des flashcards, Mirandola te les repose juste avant
 l’oubli, avec l’algorithme d’Anki. Gratuit, hors ligne, pour élèves, profs…
     Tarifs                         Mirandola Campus
     Mirandola gratuit, Mirandola+  Collèges, lycées, prépas : Mirandola…
     Flashcards avec l’IA           La répétition espacée
     Colle ton cours, prends…       Courbe de l’oubli, intervalles…
```

- **Le nom du site et le logo** (en haut) : tirés de `WebSite` et
  `Organization` de l'accueil et du favicon. Quelques jours à quelques
  semaines après l'indexation.
- **Le titre et la description** : ceux de `src/site/pages.js`. Google peut
  réécrire une description s'il trouve mieux dans la page ; c'est normal.
- **Les sous-liens** : Google les choisit seul, jamais sur demande. Il
  lui faut plusieurs pages bien reliées (c'est fait : l'en-tête, le pied, le
  fil d'Ariane et des liens dans les textes) **et des gens qui cherchent
  « Mirandola »**. Ils viennent avec les recherches de marque, en général
  quelques semaines à quelques mois après le lancement.
- **Le fil d'Ariane** (« mirandola.fr › Tarifs ») sur les pages autres que
  l'accueil, sur ordinateur.
- **Une image** à côté du résultat au téléphone, grâce à
  `max-image-preview:large`.
- **Pas d'étoiles pour l'instant** : Google ne montre la note d'une app
  qu'avec de vrais avis. Quand il y en aura (sur la page, d'utilisateurs
  réels), on pourra les ajouter. Jamais d'avis inventés : c'est interdit et
  Google pénalise tout le site.
- **Les questions de la FAQ** ne s'affichent plus en accordéon dans Google
  (réservé depuis 2023 aux sites officiels de santé et de l'État), mais
  elles servent à comprendre la page et aux réponses des IA.

## 3. « Mirandola », c'est aussi une ville

Mirandola est une ville d'Italie (province de Modène) qui a sa page
Wikipédia dans chaque langue, et le nom de Pic de la Mirandole. Sur la
recherche « mirandola » toute seule, Google montrera d'abord la ville au
début, surtout hors de France. Ce qui fait gagner la marque :

1. **Des recherches de marque** : chaque élève qui tape « mirandola
   flashcards » ou « mirandola app » et clique apprend à Google ce que les
   gens veulent. Sur ces recherches, mirandola.fr sera premier très vite.
2. **Des signaux d'identité** : le nom du site, le logo et `Organization`
   (en place) ; la page `/a-propos`, dont les données structurées disent
   que l'app tient son nom de l'humaniste et n'a pas d'autre lien avec la
   ville (en place) ; **des profils officiels** (à faire, voir plus bas) que
   l'on relie dans `sameAs`.
3. **Des liens d'autres sites** vers mirandola.fr (voir plus bas).

Sur google.fr, pour un public français, mirandola.fr peut passer devant la
ville en quelques mois si la marque est cherchée.

## 4. À faire une fois (toi)

### Google Search Console (indispensable, 10 minutes)

1. Va sur <https://search.google.com/search-console>, connecte-toi avec le
   compte Google de Mirandola.
2. « Ajouter une propriété » → **Domaine** → `mirandola.fr`.
3. Google donne un enregistrement **TXT** (`google-site-verification=…`).
   Chez **OVH** : Web Cloud → Noms de domaine → `mirandola.fr` → Zone DNS →
   « Ajouter une entrée » → **TXT**, sous-domaine **`@`** (la racine : le
   champ est obligatoire, l'aperçu doit dire `mirandola.fr. IN TXT
   "google-site-verification=…"`), TTL par défaut, valeur : le texte de
   Google entier, guillemets non compris. « Ajouter ». (Brevo a déjà ses
   entrées dans la même zone : ne pas les toucher, plusieurs TXT à la
   racine cohabitent.)
4. Revenir dans la Search Console → « Valider ». Si ça échoue, attendre
   une heure (le temps que le DNS se propage) et recommencer.
5. Menu **Sitemaps** → `sitemap.xml` → Envoyer.
6. Menu **Inspection de l'URL** → coller `https://mirandola.fr/tarifs` →
   « Demander une indexation ». Refaire pour chaque page du tableau
   ci-dessus (une dizaine par jour au plus).

### Bing (5 minutes, sert aussi à ChatGPT et à DuckDuckGo)

1. <https://www.bing.com/webmasters> → « Importer depuis Google Search
   Console » : tout est repris, sitemap compris.
2. Après chaque mise en ligne qui change le texte d'une page :
   `node tools/indexnow.js` (ou `node tools/indexnow.js /tarifs`) prévient
   Bing, Yandex, Seznam et Naver dans la minute.

### Des profils officiels (les signaux d'identité)

Créer, au nom de Mirandola, avec le même logo et le lien mirandola.fr :
une page **LinkedIn** (entreprise), un compte **Instagram** ou **TikTok**
(là où sont les élèves), une chaîne **YouTube** (les vidéos de la Mirandola
Academy y ont leur place). Envoie-moi les adresses : je les ajoute dans
`sameAs` de l'accueil (`index.html`, `Organization`), et Google relie le
tout à la marque.

### Des liens vers mirandola.fr

Un lien depuis un site sérieux vaut plus que n'importe quel réglage :
- le site de chaque établissement client (page « outils numériques », CDI) ;
- les professeurs qui l'utilisent (blogs, Padlet, ENT, groupes Facebook de
  profs) ;
- les annuaires de l'edtech française, la presse éducation, Product Hunt ;
- à terme, le **GAR** (Gestionnaire d'accès aux ressources du ministère),
  la porte d'entrée des ressources numériques dans les ENT.

## 5. Tester et voir

**Avant de mettre en ligne** (sur ta machine) :
```
npm run check          # test/seo.test.js compris : il dit ce qui casse
npm run build && npx vite preview   # puis http://localhost:4173/tarifs
```

**Une fois en ligne**, chaque outil avec l'adresse d'une page :

| Outil | Ce qu'il montre |
|---|---|
| [Test des résultats enrichis](https://search.google.com/test/rich-results) | ce que Google comprend : fil d'Ariane, organisation, FAQ, article |
| [Validateur Schema.org](https://validator.schema.org/) | toutes les données structurées, même celles que Google n'affiche pas |
| [PageSpeed Insights](https://pagespeed.web.dev/) | vitesse au téléphone (Core Web Vitals) et la note SEO |
| [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/) | l'aperçu d'un lien partagé (image, titre) |
| Search Console → Inspection de l'URL | si la page est indexée, et la page telle que Google l'a lue |
| Google : `site:mirandola.fr` | les pages déjà dans l'index |

## 6. Suivre (une fois par semaine, 5 minutes)

Dans la Search Console :
- **Performances** : impressions (combien de fois Mirandola apparaît),
  clics, position moyenne, et surtout l'onglet **Requêtes** (ce que les gens
  ont tapé). Un titre ou une description se retouchent quand une page
  apparaît beaucoup mais est peu cliquée.
- **Pages** : combien sont indexées, et pourquoi pas les autres. Les
  écrans de l'app (`/connexion`, `/essayer`…) y sont « exclus par noindex » :
  c'est voulu.
- **Améliorations** : fil d'Ariane, données structurées, sans erreur.

Délais à attendre : indexation en quelques jours après l'envoi du sitemap,
des positions qui bougent pendant 2 à 3 mois, des sous-liens avec les
recherches de marque.

## 7. Retoucher une page sans rien casser

- **Le look** (couleurs, mise en page, images, animations, ordre des
  blocs) : libre. Google ne le voit pas, tant que la page reste rapide.
- **Le texte** : libre aussi, en gardant les mots que les gens cherchent
  (« flashcards », « répétition espacée », « établissement »…), un seul
  `<h1>`, et du texte écrit dans le HTML.
- **Le titre et la description** : dans `src/site/pages.js` (pas dans le
  HTML : le gabarit les pose). Les changer rarement, et mettre à jour `maj`.
- **Une adresse** : ne jamais la changer. Si c'est inévitable, une
  redirection permanente (308) de l'ancienne vers la nouvelle dans
  `vercel.json`, sinon la page repart de zéro.
- `npm run check` dit tout de suite si une retouche a cassé quelque chose.

## 8. Ajouter une page

1. Une entrée dans `src/site/pages.js` (adresse, fichier, nom, titre,
   description, `maj`, image).
2. Le fichier à la racine (copier `professeurs.html` : `<!-- @meta -->`
   dans la tête, `@icones`, `@tete`, `@ariane`, son contenu, un appel,
   `@pied`).
3. Son nom dans la redirection `/:page(…)/` de `vercel.json`.
4. Son image de partage : une entrée dans `OG_PAGES` de `tools/affiches.js`,
   puis `node tools/affiches.js pages`.
5. Un lien vers elle (le pied de page, `src/site/partiels/pied.html`, et une
   page voisine).
6. `npm run check` : le test dit ce qui manque.

## 9. Ce qu'on ne fait pas

Pas d'avis ni de chiffres inventés, pas de texte caché, pas de pages
copiées par ville (« flashcards Lyon », « flashcards Lille »), pas d'achat
de liens. Tout cela finit en pénalité pour le site entier.

## Mémoire technique

- La liste : `src/site/pages.js`. Le gabarit et le sitemap :
  `tools/site/gabarit.js` (greffon Vite `pagesDuSite`, `rendre`,
  `sitemap`, `llms`, `courbeOubli`). Les morceaux : `src/site/partiels/`.
  Le style des pages : `src/site/pages.css` (après `site.css`). Le script :
  `src/site/page.js` (et `commun.js`, partagé avec `site.js`).
- Vercel sert un fichier avant d'appliquer la réécriture vers l'app : avec
  `cleanUrls`, `/tarifs` sert `tarifs.html`. Sous `npm run dev` et
  `vite preview`, c'est le relais `adressesDeLApp` de `vite.config.js`.
- Le service worker ne sert ni ne range les pages du site (`PAGES` de
  `src/sw.js`, rempli au build) : rangées sous « app » comme une
  navigation de l'app, elles en prenaient la place hors ligne.
- Le budget : l'accueil ≤ 50 Ko, la plus lourde des autres pages ≤ 40 Ko
  (`tools/budget.js`).
- Les liens Wikipédia de `/a-propos` (`sameAs`) n'ont pas pu être ouverts
  depuis la session du 2026-11-02 (réseau fermé à wikipedia.org) : à
  vérifier une fois en ligne avec le validateur Schema.org.
