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
