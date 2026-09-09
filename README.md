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

## Publier depuis l'app

Le bouton nuage (accueil, ou menu ⋯ d'un paquet) écrit `decks/<clé>.json` et
`decks/index.json` dans ce dépôt en **un seul commit**, via l'API Git de GitHub.
Aucun serveur : le navigateur appelle `api.github.com` directement.

Au premier usage, l'app demande un jeton. Prendre un **fine-grained personal
access token** limité à ce seul dépôt, avec la permission **Contents:
read and write** et rien d'autre. Il est conservé dans le `localStorage` de
l'appareil sous la clé `cartes.gh` et n'est jamais écrit dans le dépôt.

Un paquet publié porte une `key` et une `rev` identiques à celles de
`decks/index.json`, donc la synchronisation descendante au démarrage le
reconnaît au lieu de le dupliquer.

## Partage à plusieurs

L'app n'a pas de comptes et n'en a pas besoin : `localStorage` est cloisonné
par origine **et par appareil**. Deux personnes qui installent la même URL ont
chacune leur propre bibliothèque, invisible de l'autre. Rien à configurer.

Filet de sécurité sans jeton : le bouton nuage de l'accueil propose
**Sauvegarder**, qui produit un lien `#i=…` contenant tous les paquets. Ouvrir
ce lien restaure la bibliothèque, sur n'importe quel appareil.
