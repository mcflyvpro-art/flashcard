# Fiabilité de Mirandola

Ce qui surveille l'app, ce qui la teste, ce qui la sauvegarde, et que faire
quand quelque chose sonne. Mis en place le 2026-11-07 (demandé : « le max du
debug possible, le plus sécurisé »). Une app sans aucun bug, personne n'en
fait : ce qui rend une app stable, c'est de **voir** chaque erreur qui arrive
chez un utilisateur, de la **corriger avant** qu'elle touche beaucoup de
monde, et de pouvoir **revenir en arrière** en une minute.

## Ce qui tourne, et quand

| Quoi | Quand | Où | Ce qui le fait échouer |
|---|---|---|---|
| Lint, types, 860 tests du noyau, build, budget de poids, `npm audit` | chaque push sur `main`, chaque PR | `ci.yml` › check | une erreur, une faille « élevée » |
| Secrets dans le dépôt, tout l'historique (gitleaks) | idem | `ci.yml` › secrets | une clé, un jeton, un mot de passe |
| Parcours de bout en bout, Chromium (≈ 150) | idem | `ci.yml` › e2e | un parcours rouge |
| CodeQL (`security-extended`) | idem, et chaque lundi | `codeql.yml` | une alerte dans l'onglet Security |
| Base neuve : toutes les migrations depuis la première, puis toute la suite SQL | chaque changement de `supabase/`, chaque nuit | `base.yml` | une migration qui ne se rejoue plus, un cas SQL en échec |
| Le cliquet des types stricts : aucune erreur `tsc --strict` de plus par fichier | avec les types, à chaque push | `ci.yml` › check (`npm run typecheck`) | une erreur de type stricte nouvelle |
| Revue de sécurité par Claude | chaque PR (avec `ANTHROPIC_API_KEY`) | `revue-securite.yml` | — (commentaires sur la PR) |
| Safari (WebKit) : iPhone 13 et Safari de bureau, toute la suite | chaque nuit | `nuit.yml` › safari | un parcours rouge sous Safari |
| Le singe : 150 gestes au hasard par rôle et par écran, graine nouvelle | chaque nuit | `nuit.yml` › singe | la moindre erreur JavaScript |
| `npm audit` | chaque nuit | `nuit.yml` › dependances | une faille publiée dans la nuit |
| Tests de mutation (Stryker) sur le noyau | chaque dimanche | `nuit.yml` › mutation | un score sous le seuil |
| Sauvegarde chiffrée de la base, puis restaurée et vérifiée | chaque nuit | `sauvegarde.yml` | un secret manquant, une table qui ne revient pas entière, un cas SQL en échec sur la base restaurée |
| Vigie : site, app, en-têtes de sécurité, Supabase, erreurs remontées | toutes les 3 h | `vigie.yml` | voir plus bas — un ticket « vigie » s'ouvre |
| Mises à jour des dépendances et des actions | chaque lundi | Dependabot | — (pull requests) |

Toutes les actions GitHub sont **épinglées à leur commit** (une étiquette
`v4` peut être déplacée par qui prend la main sur l'action ; un commit, non).
Dependabot les tient à jour.

## Ce que toi seul peux faire (une fois)

Dans GitHub → le dépôt → **Settings** :

1. **Secrets and variables → Actions → Secrets → New repository secret** :
   - `SUPABASE_DB_URL` : Supabase → le projet → **Connect** → « Session
     pooler » (pas « Direct connection » : GitHub n'a pas d'IPv6), la chaîne
     entière, `[YOUR-PASSWORD]` remplacé par le mot de passe de la base
     (Project Settings → Database → Reset database password si tu ne l'as
     plus). Sert à la sauvegarde et à la vigie.
   - `SAUVEGARDE_CLE` : 64 caractères au hasard, par exemple le résultat de
     `openssl rand -hex 32`. **Range-la aussi dans ton gestionnaire de mots
     de passe** : sans elle, aucune sauvegarde ne se relit, et GitHub ne te
     la redonnera jamais.
   - `SUPABASE_SERVICE_ROLE_KEY` (facultatif) : Project Settings → API →
     `service_role`. Avec elle, la sauvegarde emporte aussi les images et sons
     des pages (le seau « media »).
   - `ANTHROPIC_API_KEY` (facultatif) : pour la revue de sécurité de chaque
     pull request par Claude.
2. **Branches → Add branch ruleset** (ou « Branch protection rule ») sur
   `main` : *Require status checks to pass* → `check`, `e2e`, `secrets`,
   `analyse`. Ainsi plus rien n'arrive en production sans la CI verte.
3. **Code security** : *Dependabot alerts*, *Dependabot security updates*,
   *Secret scanning* et *Push protection* allumés (gratuits pour un dépôt
   public ; souvent déjà allumés).
4. **Notifications** (github.com/settings/notifications) : « Actions » →
   *Only notify for failed workflows*, par e-mail et dans l'app GitHub. C'est
   par là qu'arrivent les alertes de la vigie et des nuits.

Puis lancer une fois **Actions → Sauvegarde → Run workflow** (production) et
**Actions → Vigie → Run workflow** pour voir tout passer au vert.

## Les erreurs des utilisateurs

`src/core/rapport-erreurs.js` (le premier module de l'app) écoute les
exceptions non rattrapées, les promesses rejetées que personne n'attend, les
violations de la CSP, mesure le temps jusqu'au premier écran utile et
repère une ouverture bloquée (rien à l'écran au bout de 15 s). Chaque
rapport part **anonyme** — jamais la session, jamais l'adresse IP, le texte
nettoyé deux fois (`src/erreurs.js`, puis `texte_propre` en base) — dans la
fonction `signaler` de la base (migration `20261107143227`). La base compte
au lieu de recopier : une ligne par erreur différente et par jour, 200
différentes par jour au plus, 5 000 par heure au plus, 30 jours de garde.
Hors ligne, le rapport attend sur l'appareil (20 au plus) et part au retour du
réseau. La démo n'envoie rien.

**Les lire** : console de l'éditeur → **Santé** (`/admin/sante`) — les
ouvertures, les erreurs, le taux, les ouvertures bloquées et le temps jusqu'au
premier écran (p75) sur 24 h, puis chaque erreur des 7 derniers jours, la plus
fréquente d'abord : son texte, sa pile, ses écrans, ses navigateurs, ses
builds (le commit qui l'a fait naître).

**L'écran de secours** : si rien n'est venu à l'écran au bout de 15 s (un
morceau du build qui ne se charge pas, un démarrage qui bloque), l'ouverture
le dit et propose « Réessayer » ou « Réparer » (retire les copies hors ligne
de l'app, jamais les livres). C'est un script en ligne d'`app.html`, seul,
pour qu'il marche même quand plus rien d'autre ne marche (son empreinte est
dans la CSP de `vercel.json`, `test/demarrage.test.js`).

## Quand la vigie sonne

Un ticket **« vigie »** s'ouvre (ou reçoit un commentaire) et GitHub te
prévient. Il dit quoi, jamais le texte d'une erreur (le dépôt est public).

- **« erreur nouvelle »** : une erreur jamais vue avant. Santé → la trouver
  par son empreinte → lire le message, la pile, les écrans et navigateurs →
  la reproduire (CLAUDE.md, « Déboguer un bug ») → corriger → un test qui
  échouait avant.
- **« taux d'erreur au-dessus de 1 % »** : beaucoup d'utilisateurs touchés.
  Si c'est arrivé avec une mise en ligne (la colonne « builds » de Santé le
  dit), **revenir en arrière d'abord** : Vercel → le projet → Deployments → le
  déploiement d'avant → *Promote to Production* (instantané). Puis corriger
  tranquillement.
- **« ouvertures bloquées »** : des gens restent devant l'écran d'ouverture.
  Même réflexe : revenir à la version d'avant, puis chercher.
- **« / répond 500 »**, **« sans CSP »**, **« Supabase ne répond pas »** :
  Vercel ou Supabase. Regarder vercel.com/status et status.supabase.com ;
  côté Supabase, le projet en pause (7 jours sans requête, offre gratuite) se
  relance depuis le tableau de bord.

Fermer le ticket une fois réglé : la prochaine alerte en ouvrira un neuf.

## Restaurer la base

Le jour où il le faut vraiment (une migration qui a détruit des données, une
suppression par erreur) :

1. GitHub → Actions → **Sauvegarde** → la dernière exécution verte d'avant le
   problème → *Artifacts* → télécharger `sauvegarde-…` (un `.zip` qui contient
   le `.tar.gz.gpg`).
2. La déchiffrer : `gpg --decrypt mirandola-….tar.gz.gpg | tar xzf - -C restauration/`
   (la phrase : `SAUVEGARDE_CLE`, depuis ton gestionnaire de mots de passe).
   On y trouve `roles.sql`, `schema.sql`, `data.sql`, `comptes.tsv` (le nombre
   de lignes de chaque table) et, si la clé de service était posée, `media/`.
3. Dans un projet Supabase **neuf** (jamais par-dessus la production abîmée :
   on garde de quoi comparer), avec sa chaîne de connexion `$URL` :
   `psql "$URL" --single-transaction -v ON_ERROR_STOP=1 -f roles.sql -f schema.sql -c 'set session_replication_role = replica' -f data.sql`
4. Vérifier comme le fait la CI chaque nuit : `tools/sauvegarde/restaurer.sh`
   (le même nombre de lignes, puis toute la suite SQL).
5. Pointer l'app vers le nouveau projet (`VITE_SUPABASE_URL`,
   `VITE_SUPABASE_ANON_KEY` dans Vercel et dans les variables GitHub), puis
   reposer les secrets des fonctions Edge (`supabase/REGLAGES.md`).

La CI fait les étapes 2 à 4 chaque nuit sur une base vierge : la procédure est
éprouvée, pas seulement écrite (M13.T5).

## Ce que le premier passage a trouvé (2026-11-07)

Les workflows ont trouvé, dès leur première nuit, ce qu'aucun test local ne
voyait :

- **Base neuve** : toutes les migrations se rejouent de zéro, mais cinq
  fichiers de tests SQL ne passaient plus — écrits avant « un seul code »
  (2026-10-26), la salle d'attente du professeur particulier et la place
  du référent (2026-10-29), ou la treizième table protégée par la double
  authentification. Mis à jour, chacun vérifié sur la production en
  transaction annulée. Et un **vrai défaut** : le référent corrigeait le nom
  d'un élève, le professeur voyait toujours l'ancien
  (`20261107213201_le_nom_corrige_partout`).
- **Vigie** : sans problème, elle ouvrait quand même un ticket vide (une
  ligne vide comptée pour un problème) ; corrigé dans
  `tools/vigie/verifier.sh`.
- **Accessibilité** : l'or de Mirandola Infini, ajouté le même jour, n'avait
  que 4,24:1 de contraste.

## Ce qui reste à la main

- La protection contre les mots de passe compromis (HaveIBeenPwned) de
  Supabase demande l'offre Pro.
- Les tests de charge (M25.T3) ne se font pas contre la production gratuite :
  ils l'épuiseraient. Le jour d'une préproduction payante, `k6` contre elle.
- `minimatch`, dépendance d'ESLint, a une faille « modérée » (un motif de
  fichiers trop coûteux) : ESLint ne lit que nos propres motifs, sans surface
  d'attaque ; la seule correction redescend ESLint d'une version majeure.
