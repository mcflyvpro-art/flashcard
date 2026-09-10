# Cartes

PWA de flashcards. 100 % statique, aucune dépendance, aucun backend, thème clair unique.
Données en `localStorage`.

```
index.html · app.css · app.js · sw.js · manifest.webmanifest
logoflashcard.png    source des icônes
icons/               icônes PWA générées
decks/               paquets livrés avec l'app (injection par commit)
tools/inject.py      texte brut -> paquet + lien d'import
tools/build_2_1.py   paquets du cours 2.1
tools/make_icons.py  logoflashcard.png -> icons/
```

Matières : `italien` `anglais` `philo` `eco` `droit` `management` `lettres`.

Injection :

```bash
python3 tools/inject.py "Vocabulaire éco" -s eco -b https://<url-de-lapp> <<'EOF'
inflation = hausse générale des prix
PIB = production intérieure
EOF
```

Sortie : `decks/<slug>.json` + `decks/index.json` (commit = paquet poussé dans l'app)
et un lien `…/#i=<payload>` qui importe le paquet en un tap.

## Comptes et base de données

Chaque compte a sa propre bibliothèque dans Supabase (projet `flashcard`,
région eu-west-1). Trois tables, toutes en RLS stricte :

| table      | contenu                                        |
|------------|------------------------------------------------|
| `subjects` | matières du compte : nom, couleur, ordre        |
| `decks`    | paquets ; les cartes vivent en JSONB            |
| `sessions` | historique des scores, pour les courbes         |

La politique est la même partout : `user_id = auth.uid()`. Un compte ne peut
donc ni lire ni écrire les lignes d'un autre, même en forgeant une requête —
c'est Postgres qui filtre, pas le client.

La clé publique (`anon`) est écrite en clair dans `app.js`. C'est prévu : elle
ne donne accès à rien par elle-même, seul le jeton de session obtenu à la
connexion ouvre les lignes du compte.

L'app garde une copie locale de la bibliothèque pour démarrer instantanément
et fonctionner hors ligne ; les écritures partent en base et sont rejouées à
la reconnexion. Vider le navigateur ne perd plus rien : il suffit de se
reconnecter.

Les matières se créent, se renomment, se recolorent et se suppriment depuis
l'écran **Réglages** (engrenage, en haut de l'accueil), sur une palette de
16 teintes.

## Reprise de l'ancienne bibliothèque

À la première connexion d'un compte, si l'appareil contient encore une
bibliothèque `localStorage` de l'ancienne version, elle est envoyée dans le
compte — une seule fois, en ignorant les paquets déjà présents. Le dossier
`seed/` conserve les paquets d'origine en archive ; l'app ne le lit plus.

## Génération de cartes par IA

Le bouton étincelle de la feuille « Coller » transforme un texte de cours en
paires recto/verso, éditables avant l'ajout.

La clé Anthropic **n'est jamais dans le dépôt ni dans `app.js`** : ces fichiers
sont servis par GitHub Pages et donc lisibles par tout le monde. Elle vit dans
un secret de la fonction Edge `ai` (`supabase/functions/ai/index.ts`), qui est
la seule à parler à l'API. L'app n'envoie que le texte, accompagné du jeton de
session du compte connecté.

Secrets à définir sur le projet Supabase, dans *Edge Functions → Secrets* :

| secret | rôle |
|---|---|
| `ANTHROPIC_API_KEY` | obligatoire, sinon la fonction répond `nokey` |
| `AI_BUDGET_USD` | plafond de dépense sur le mois en cours (défaut 20) |
| `AI_DAILY_CALLS` | appels maximum par compte et par jour (défaut 30) |

Chaque appel est journalisé dans la table `ai_usage` (tokens consommés et coût
en cents). Le plafond mensuel est vérifié avant chaque appel : au-delà, la
fonction refuse et l'app affiche « Budget IA atteint ».

## Mode simple

**Réglages → Mode simple** éteint le moteur de planification : plus d'échéance,
plus de notes, seulement le balayage à gauche ou à droite. Un message détaille
les conséquences avant la bascule.

Aucune donnée n'est effacée : l'échéance, l'intervalle, la facilité et le
nombre de réussites restent inscrits dans chaque carte. Réviser en mode simple
ne les fait pas avancer. Au rallumage, les cartes dont l'échéance est passée
pendant l'arrêt sont réparties sur plusieurs jours, à hauteur de l'objectif
quotidien, pour éviter un rattrapage massif le même jour.

## Échelons de reprise

Le moteur suit la série recommandée en pédagogie scolaire — Ebbinghaus pour la
forme de la courbe, Cepeda & Pashler pour l'écart optimal (10 à 20 % de
l'horizon visé) :

```
J+1 · J+3 · J+7 · J+15 · J+30 · J+60 · J+120 · J+240 · J+365
```

Une carte monte d'un échelon quand elle passe, de deux avec « Facile »,
redescend d'un avec « Difficile », et retourne à l'apprentissage du jour avec
« Encore ». Une carte durablement pénible reste sur son échelon au lieu de
monter.

## Types de cartes et modes d'exercice

Chaque ligne de carte porte un bouton dont l'icône dit ce qu'elle contient :
`…` carte simple, `T` vrai/faux, une image, un haut-parleur, une étiquette.
Il ouvre la feuille d'édition : type, image et son au recto comme au verso,
étiquettes libres.

**Mise en forme.** `**gras**`, `*italique*`, `__souligné__`, retours à la ligne
et listes à puces (`- `). Les formules s'écrivent entre `$` en LaTeX :
`$\frac{a+b}{2} \ge \sqrt{ab}$`. Le rendu couvre fractions, racines, indices,
exposants, lettres grecques et opérateurs courants — sans aucune bibliothèque,
pour que l'app démarre toujours hors ligne.

**Son.** Un enregistrement peut être attaché à une face ; sinon, si le paquet
déclare une langue, le navigateur lit le texte. Recto et verso ont chacun leur
langue (réglages du paquet), et la lecture suit le **contenu**, pas le côté
physique de la carte : si le paquet est inversé ou mélangé (bouton d'inversion,
« mélanger les deux sens »), le texte qui était au recto continue de se lire
dans sa langue d'origine même s'il s'affiche maintenant au verso. Dans le quiz,
le micro dicte la réponse au lieu de la taper, dans la langue de la réponse
attendue — qui suit la même logique si le quiz est inversé.

**Vrai / faux.** Le verso vaut `vrai` ou `faux`. Deux boutons remplacent le
balayage, la réponse est immédiate — pas de note à choisir, il n'y a pas de
nuance sur une question binaire.

**QCM.** Les trois mauvaises réponses sortent du paquet lui-même : ce sont des
réponses plausibles, pas du remplissage. Les cartes vrai/faux en sont exclues.

**Association.** Six paires par lot, on relie de gauche à droite. Une paire
trouvée du premier coup compte juste, sinon elle est comptée ratée.

**Longues définitions.** Le texte d'une carte rétrécit automatiquement selon
sa longueur pour tenir dans le cadre ; au-delà d'une définition vraiment
longue, il défile à l'intérieur de la carte plutôt que d'en déborder.

## Quiz

- **Tolérance** réglable par paquet : stricte (au caractère près), normale,
  souple. Réglages du paquet, dans le menu `…`.
- **Chrono** par question : aucun, 5, 10 ou 20 secondes. À zéro la question est
  perdue.
- **Indice** : dévoile la réponse lettre à lettre. Le nombre d'indices utilisés
  apparaît dans le bilan.
- **Je ne sais pas** : passe sans deviner, compté raté honnêtement.
- **Choix multiples** : bascule à la volée quand taper est trop lent.
- **Différence surlignée** : sur une réponse fausse, les lettres qui clochent
  sont marquées dans le bilan plutôt qu'un simple « faux ».
- **Série** : à partir de cinq bonnes réponses d'affilée, un petit compteur.
