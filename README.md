# Cartes

PWA flashcards. 100 % statique, aucune dépendance, aucun backend. Données en `localStorage`.

```
index.html · app.css · app.js · sw.js · manifest.webmanifest
decks/      decks livrés avec l'app (injection par commit)
tools/inject.py   texte brut -> deck + lien d'import
```

Injection :

```bash
python3 tools/inject.py "Anglais · verbes" -b https://<url-de-lapp> <<'EOF'
hablar = parler
comer = manger
EOF
```

Sortie : `decks/<slug>.json` + `decks/index.json` (commit = deck poussé dans l'app) et un lien
`…/#i=<payload>` qui importe le deck en un tap.
