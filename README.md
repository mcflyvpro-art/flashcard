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
