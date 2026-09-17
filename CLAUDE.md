# Folio — consignes pour Claude

Folio est une PWA de révision (flashcards + moteur FSRS d'Anki) vendue en
**B2C** (élèves, étudiants) et en **B2B** (licences établissement : élèves,
professeurs, référents, éditeurs — modèle « à la Pronote »). Tout ce qui est
écrit ici doit tenir quand un lycée entier se connecte le même matin.

Langue : **français** partout — code commenté, messages de commit, réponses.

## Architecture réelle (à ne pas supposer autrement)

- **Aucun build, aucune dépendance, aucun framework.** Fichiers servis en statique.
  - `index.html` — écran d'ouverture inline, charge `app.css` puis `app.js`
  - `app.js` — **~10 000 lignes, un seul fichier**, découpé en sections
    `/* ---------- nom ---------- */`. Chercher la section par `grep -n -- "---------- "` avant d'éditer.
  - `app.css` — ~2 200 lignes
  - `sw.js` — service worker, réseau d'abord, cache en secours
  - `fsrs.wasm` — crate Rust `fsrs` 6.6.2 compilé (recette : `tools/BUILD-FSRS.md`). Ne jamais réécrire les formules à la main.
- **Rendu** : état global en `let` (haut de `app.js`, section « état »), `render()` reconstruit l'écran depuis `view`.
- **Backend : Supabase** (projet `qqbzefpdeinlynjtarqr`, eu-west-1), appelé en `fetch` brut via `api(path, method, body)` — pas de SDK `supabase-js`.
  - Auth : `signIn` / `signUp` / `refreshToken` (un seul rafraîchissement à la fois — ne pas casser ce verrou).
  - Données : PostgREST (`/rest/v1/...`), RLS stricte `user_id = auth.uid()` + rôles établissement.
  - Cache local `localStorage`, écritures en file (`dirty`, `gone`) rejouées par `flush()`.
  - Edge Function unique : `supabase/functions/ai/index.ts` (Anthropic, quotas dans `ai_usage`).
- **Schéma** : uniquement par migrations dans `supabase/migrations/` (horodatage `YYYYMMDDHHMMSS_nom_en_francais.sql`). Jamais de changement de schéma à la main dans le tableau de bord.
- Réglages non-SQL (auth, storage, secrets, pg_cron) : `supabase/REGLAGES.md`, à tenir à jour.

## Règles non négociables

1. **Bumper `const C = 'folio-vNN'` dans `sw.js` à chaque changement livré** de `app.js`, `app.css`, `index.html` ou `fsrs.wasm`. Toujours prendre le max existant + 1 — après un merge, vérifier qu'il n'a pas régressé (c'est déjà arrivé : v66 → v47).
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
python3 -m http.server 8080          # servir l'app en local (http://localhost:8080)
grep -n -- "---------- " app.js      # table des matières de app.js
supabase db diff / supabase migration new <nom>   # si la CLI est installée
```

Comptes de test : `supabase/comptes_test.sql` (admin, prof, élève).
