# Folio — consignes pour Claude

Folio est une PWA de révision (flashcards + moteur FSRS d'Anki) vendue en
**B2C** (élèves, étudiants) et en **B2B** (licences établissement : élèves,
professeurs, référents, éditeurs — modèle « à la Pronote »). Tout ce qui est
écrit ici doit tenir quand un lycée entier se connecte le même matin.

Langue : **français** partout — code commenté, messages de commit, réponses.

## Où on en est : PROGRESS.md

`PROGRESS.md` est la mémoire du projet. Il tient l'état de 148 tâches
chiffrées, réparties en 26 missions et 3 phases.

**Protocole, à suivre à la lettre — il est fait pour coûter le moins de
lecture possible :**

```sh
sed -n '1,20p' PROGRESS.md            # où on en est (20 lignes suffisent)
grep -A20 '^## M03' PROGRESS.md       # le détail d'une mission
grep -n '^- \[ \].*\[P0\]' PROGRESS.md  # ce qui reste avant le lancement
```

Ne jamais relire le fichier entier. Mettre à jour = changer `[ ]` en `[x]`
sur la ligne concernée, puis réécrire le bloc ÉTAT (CURSEUR, FAIT, DERNIER).

Une tâche ne se coche que si **sa preuve tourne au vert**. La preuve est
écrite sur la ligne : une commande, un chiffre, un rapport. Pas « ça a
l'air de marcher ».

## Architecture réelle (à ne pas supposer autrement)

- **Build Vite, sans framework ni dépendance à l'exécution.**
  - `index.html` — écran d'ouverture inline, charge `/src/app.css` puis `/src/app.js`
  - `src/app.js` — **~9 500 lignes, un seul fichier** (chantier M06.T3 : le
    découper ; étape 1/2 faite, l'état en est sorti — reste à couper le
    fichier lui-même en modules ≤ 800 lignes), sections
    `/* ---------- nom ---------- */`. Chercher par
    `grep -n -- "---------- " src/app.js` avant d'éditer.
  - `src/data/etat.js` — tout l'état mutable de l'app (109 variables : `db`,
    `view`, `study`, `animate`...), une liaison vive ES (`export let`) par
    variable et un « setter » générique par variable pour la réaffectation
    (`setDb`, `setView`...) — lire ses champs reste direct (`db.decks.push`),
    seule une réaffectation complète passe par le setter (M06.T3/M06.T4)
  - `src/fsrs.js` — le moteur, pur et testé (`test/fsrs.test.js`)
  - `src/fusion.js` — fusion à trois versions d'un paquet (M03.T4), pur et testé (`test/fusion.test.js`, `test/concurrence.test.js`)
  - `src/file.js` — construction de la file de révision : sélection, quota de cartes neuves, ordre (M01.T3), pur et testé (`test/file.test.js`)
  - `src/parseur.js` — parseur de cartes : collage, Quizlet, Anki texte brut, CSV/TSV, JSON (M01.T4), pur et testé (`test/parseur.test.js`)
  - `src/app.css` — ~2 200 lignes
  - `src/sw.js` — modèle du service worker ; `vite.config.js` le fabrique au build
  - `public/` — fsrs.wasm, manifeste, icônes
  - `fsrs.wasm` — crate Rust `fsrs` 6.6.2 compilé (recette : `tools/BUILD-FSRS.md`). Ne jamais réécrire les formules à la main.
- **Rendu** : état global dans `src/data/etat.js` (voir plus haut), `render()` (dans `app.js`) reconstruit l'écran depuis `view`.
- **Backend : Supabase** (projet `qqbzefpdeinlynjtarqr`, eu-west-1), appelé en `fetch` brut via `api(path, method, body)` — pas de SDK `supabase-js`.
  - Auth : `signIn` / `signUp` / `refreshToken` (un seul rafraîchissement à la fois — ne pas casser ce verrou).
  - Données : PostgREST (`/rest/v1/...`), RLS stricte `user_id = auth.uid()` + rôles établissement.
  - Cache local `localStorage`, écritures en file (`dirty`, `gone`) rejouées par `flush()`.
  - Edge Function unique : `supabase/functions/ai/index.ts` (Anthropic, quotas dans `ai_usage`).
- **Schéma** : uniquement par migrations dans `supabase/migrations/` (horodatage `YYYYMMDDHHMMSS_nom_en_francais.sql`). Jamais de changement de schéma à la main dans le tableau de bord.
- Réglages non-SQL (auth, storage, secrets, pg_cron) : `supabase/REGLAGES.md`, à tenir à jour.

## Règles non négociables

0. **Ces deux fichiers se mettent à jour dans le même commit que le
   changement, jamais « plus tard ».** Un dépôt qui se décrit faux est pire
   qu'un dépôt qui ne se décrit pas : on agit sur ce qu'il raconte.
   - `CLAUDE.md` dès que bouge l'architecture, l'infrastructure, une
     commande, le schéma, un service externe, une clé ou une règle de
     travail. C'est le fichier qui coûte le plus cher à laisser périmer :
     c'est lui qu'on lit en premier, à chaque session.
   - `PROGRESS.md` dès qu'une tâche avance : la case, puis le bloc ÉTAT.
   Un commit qui change l'infra sans toucher CLAUDE.md est un commit
   incomplet — le relire avant de valider.

1. **Ne jamais écrire de règle métier hors du noyau.** Le calcul vit dans un module pur et testé ; l'interface affiche, la couche données transporte.
2. **Toute table nouvelle a la RLS activée et des politiques** dans la même migration. Après une migration, lancer les advisors Supabase (sécurité + performance) via MCP.
3. **Aucun secret dans le dépôt.** Seule la clé `anon` vit dans `app.js`. Clés privées → secrets Edge Functions.
4. **Données d'élèves mineurs (RGPD)** : minimisation, pas de donnée perso dans les logs, purge programmée respectée (`20260917090000_purge_corbeille_programmee.sql`).
5. **Hors ligne d'abord** : toute écriture doit survivre à une coupure réseau (passer par la file, pas un `fetch` direct qui se perd).
6. Ne pas « corriger » en silence : un `catch (e) {}` vide doit être justifié par un commentaire, sinon remonter l'erreur (toast ou journal).

## Style de code

- Suivre le style existant : fonctions courtes, noms français, commentaires qui expliquent **pourquoi** (pas quoi), en prose.
- Pas d'ajout de bibliothèque externe sans accord explicite (l'app doit démarrer hors ligne).
- Messages de commit : titre court en français, puis un corps en prose qui explique le problème, la cause et la preuve de la correction.

## Déboguer un bug — méthode attendue

1. **Reproduire d'abord** (navigateur via `/run` ou Chrome, écran étroit ~390 px). Pas de correctif sans reproduction ou sans preuve lue dans les logs.
2. Côté serveur, lire avant de toucher : MCP Supabase `get_logs` (api, postgres, auth, edge-function) et `get_advisors`.
3. Distinguer **limite d'offre gratuite** vs **bug de code** :
   - Supabase Free : pause après 7 j d'inactivité, 500 Mo de base, 50 000 MAU, pas de sauvegarde, pool de connexions réduit, Edge Functions 150 s max. Erreurs typiques d'offre : `503`, `timeout`, `too many connections`, projet en pause.
   - Tout le reste (`401` en boucle, `42501` RLS, `PGRST…`, données écrasées entre appareils, écran blanc) = **bug de code** jusqu'à preuve du contraire.
4. Trouver la cause racine, corriger, puis vérifier dans le navigateur et relancer les advisors.

## Commandes utiles

```sh
npm run dev                          # serveur local (http://localhost:5173)
npm test                             # tests du noyau
npx vitest run --coverage            # couverture du noyau (fsrs/fusion/file/parseur), cible ≥ 90 % lignes
npm run check                        # lint + tests + build, comme la CI
grep -n -- "---------- " src/app.js  # table des matières de app.js
supabase db diff / supabase migration new <nom>   # si la CLI est installée
```

Comptes de test : `supabase/comptes_test.sql` (admin, prof, élève).
