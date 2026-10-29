# Réglages du projet Supabase

Ce qui ne s'écrit pas en SQL et vit donc dans le tableau de bord. À tenir à
jour ici : sans cette note, ces réglages n'existent nulle part dans le dépôt
et personne ne peut vérifier qu'ils sont bien posés.

## Authentication → Policies

| Réglage | Valeur attendue | Pourquoi |
|---|---|---|
| Longueur minimale du mot de passe | **10** | L'app refuse déjà en dessous (`PWMIN` dans `app.js`), mais ce contrôle-là ne protège que la personne qui se sert du formulaire. Celui qui appelle l'API directement passe outre tant que la base accepte six caractères. |
| Protection contre les mots de passe compromis | **activée** | Compare le mot de passe choisi à la base HaveIBeenPwned. Signalé par l'audit de sécurité Supabase tant qu'elle est éteinte. |
| Confirmation de l'adresse e-mail | **exigée** | Sans elle, n'importe qui ouvre un compte avec l'adresse d'un autre. |

## Authentication → URL Configuration (mirandola.fr, depuis le 2026-10-28)

L'app ne donne aucune adresse de retour à l'inscription ni au mot de passe
oublié (`signUp`, `resetPassword` de `core/coeur-sync.js`) : les liens des
e-mails mènent à la **Site URL** du projet, où l'aiguillage de la page
d'accueil (`index.html`) passe à l'app tout retour d'e-mail
(`access_token`, `error_code` dans l'adresse).

| Réglage | Valeur attendue |
|---|---|
| Site URL | `https://mirandola.fr` |
| Redirect URLs | `https://mirandola.fr/**`, et l'ancien domaine tant qu'il sert : `https://www.folioflashcard.online/**` |

Depuis le 2026-10-29, l'app **ouvre** la session que portent ces retours
(`#access_token=…`, `ui/liens-entrants.js`) — un lien « mot de passe
oublié » mène à « Choisis un nouveau mot de passe » — et les mêmes
réglages servent à **Google et Apple** (Sign In / Providers) : la marche à
suivre est dans `docs/CONNEXION.md`. Un fournisseur allumé fait paraître son
bouton sur l'écran de connexion, sans nouvelle version de l'app.

## Authentication → Emails

Les modèles (confirmation, mot de passe oublié, changement d'adresse) et,
s'il y en a un, le nom d'expéditeur du SMTP disent **Mirandola**, jamais
« Folio » (2026-10-28).

## Authentication → Rate limits

Laisser les limites par défaut au minimum, et les resserrer avant un
déploiement en établissement : l'inscription et la connexion sont les deux
portes qu'on essaie en premier.

## Storage

| Seau | Public | Types acceptés | Taille max |
|---|---|---|---|
| `media` | **non** | images (png, jpeg, webp, gif) et sons (webm, mpeg, mp4, ogg) | 8 Mo |

Le seau a été public jusqu'au 12 septembre 2026. La lecture est désormais
réservée au propriétaire du dossier (`media_read`, migration
`20260912_media_prive_et_surface_anonyme`), et l'app range un chemin dans la
carte plutôt qu'une adresse — l'adresse est signée à l'affichage, pour six
heures.

## Edge Functions → Secrets

| Secret | Rôle |
|---|---|
| `ANTHROPIC_API_KEY` | obligatoire, sinon la fonction `ai` répond `nokey` |
| `AI_BUDGET_USD` | plafond de dépense sur le mois en cours (défaut 20) |
| `AI_DAILY_CALLS` | appels maximum par compte et par jour (défaut 30) |
| `AI_DAILY_FILES` | photos et PDF maximum par compte et par jour (défaut 10) |
| `AI_MONTHLY_PLUS` | cours par élève et par mois avec Mirandola+ ou Campus (défaut 30, `IA_PAR_MOIS` de `src/offres.js`) ; un compte Mirandola gratuit reçoit `plus` (402) |
| `AI_MONTHLY_PROF` | la même chose pour un professeur, référent ou éditeur (rôle lu dans `user_roles`) : défaut 400, `IA_PROF_PAR_MOIS` — un garde-fou contre un compte volé |
| `AI_DAILY_PROF`, `AI_DAILY_FILES_PROF` | appels, et photos ou PDF, par jour d'un professeur (défaut 80 et 30) |

⚠️ **Ces trois plafonds ne tiennent pas à l'échelle d'un établissement.** Le
budget est global à tous les comptes : un seul lycée actif l'épuise en
quelques jours, et la fonctionnalité s'éteint alors pour tout le monde, sans
prévenir personne. Aux quotas actuels, un élève qui les consomme entièrement
coûte environ 1,20 $ par jour. À remplacer par un pool de crédits par
établissement avant toute vente.

## Mirandola+ : Stripe (2026-10-27)

Deux fonctions de plus, `paiement` (verify_jwt actif) et `stripe-webhook`
(**verify_jwt coupé** : `supabase functions deploy stripe-webhook --no-verify-jwt`,
la signature de Stripe remplace le jeton). Leurs secrets, et tout le pas à
pas (produit et prix dans Stripe, portail client, point d'arrivée des
évènements), dans **`docs/VENTE.md`** :

| Secret | Rôle |
|---|---|
| `STRIPE_SECRET_KEY` | obligatoire, sinon `paiement` répond `nokey` (l'app dit « le paiement ouvre bientôt ») |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…`, sinon `stripe-webhook` refuse tout |
| `STRIPE_PRIX_ANNUEL`, `STRIPE_PRIX_MENSUEL` | les `price_…` de Mirandola+ (49,99 € par an, 6,99 € par mois, depuis le 2026-10-28) |
| `STRIPE_TAXE` | `1` si Stripe Tax est activé |
| `STRIPE_CGV` | `1` pour faire cocher les conditions de vente (leur adresse posée dans Stripe) |
| `SITE_URL` | défaut `https://mirandola.fr` (retours de Stripe) |

La migration `20261027190000` pose la tâche pg_cron
`purge-stripe-evenements` (03:41 UTC, évènements de plus de 30 jours) ;
sans pg_cron, la lancer à la main comme les autres purges.

## Mirandola+ : l'app des magasins, par RevenueCat (2026-10-27)

La fonction `magasins` (**verify_jwt coupé** :
`supabase functions deploy magasins --no-verify-jwt`) reçoit le webhook de
RevenueCat (secret partagé) et le retour d'achat de l'app (jeton vérifié
auprès de Supabase Auth), relit l'abonné et écrit la ligne `apple` ou
`google` d'`abonnements`. Pas à pas : `docs/VENTE.md`, § 2.

| Secret | Rôle |
|---|---|
| `RC_SECRET` | la clé secrète de l'API RevenueCat (`sk_…`), sinon `magasins` répond `nokey` |
| `RC_WEBHOOK_AUTH` | la valeur exacte de l'en-tête Authorization du webhook RevenueCat |
| `RC_DROIT` | le droit (« entitlement ») de Mirandola+, défaut `plus` |

La migration `20261027210000` réserve aussi les écritures du seau `media` à
Mirandola+ et Campus (politiques restrictives `media_folio_plus` et
`media_folio_plus_maj`, qui s'ajoutent à celles du tableau de bord) et donne
Mirandola+ offert à tous les comptes qui existent quand on l'applique.

## Purge programmée

La confidentialité promet un livre supprimé « effacé définitivement au bout
de 30 jours » et un signalement clos effacé douze mois après. La migration
`20260917_purge_corbeille_programmee` pose deux tâches `pg_cron` qui
appliquent ces promesses côté serveur, plutôt que de dépendre d'un geste
(rouvrir l'écran Corbeille) ou de rien du tout (les signalements clos).

Si le projet Supabase n'a pas `pg_cron` activé, la migration le signale sans
échouer (`raise notice`). Activer alors **Database → Extensions → pg_cron**
dans le tableau de bord, puis exécuter une fois :

```sql
select cron.schedule('purge-corbeille-quotidienne', '17 3 * * *',
  'select public.purge_corbeille();');
select cron.schedule('purge-signalements-mensuelle', '32 3 1 * *',
  'select public.purge_signalements_clos();');
```

Vérifier ensuite que les deux tâches existent : `select * from cron.job;`.

D'autres tâches se sont ajoutées depuis, chacune posée par sa migration
(même garde `raise notice` sans pg_cron) :

| tâche | quand (UTC) | ce qu'elle fait | migration |
| --- | --- | --- | --- |
| `renouveler-codes-quotidien` | `53 2 * * *` | `renouveler_codes()` : un code élèves ou professeurs neuf pour chaque établissement dont le code a fait son temps (`org_codes.rythme`, semaine par défaut), tracé au journal du référent | `20261026110000` |
| `purge-salles-quotidienne` | `41 3 * * *` | `purge_salles()` : les parties en direct terminées | `20261024232855` |
| `purge-pseudos-quotidienne` | `29 3 * * *` | efface le journal des pseudos (`pseudo_journal`) de plus de 60 jours : 30 de réserve d'un pseudo quitté, 7 pour compter les changements ; les anciens pseudos d'un élève ne traînent pas | `20261027090000` |
| `audit-double-ecriture-cards-quotidien` | `3 4 * * *` | voir plus bas | `20260918100000` |

Le 2026-10-27, `cron.job` les contenait toutes les six, actives.

**Incident découvert le 2026-10-16 (M04.T5)** : cette migration n'avait
**jamais été appliquée en production**. Elle figurait dans le dépôt, mais
pas dans `list_migrations` : ni `purge_corbeille()`, ni
`reports.closed_at`, ni les deux tâches n'existaient, et 4 livres
attendaient en corbeille depuis plus de 30 jours (le plus ancien depuis le
2026-09-12). Appliquée ce jour-là, à l'identique du fichier. La première
purge réelle tourne la nuit suivante (3 h 17 UTC) ; la vérifier avec :

```sql
select status, return_message, start_time from cron.job_run_details
 where jobid = (select jobid from cron.job where jobname = 'purge-corbeille-quotidienne')
 order by start_time desc limit 5;
```

Leçon : une migration présente dans `supabase/migrations/` n'est pas une
migration appliquée. Comparer les noms des fichiers à `list_migrations`
après chaque session qui touche au schéma, en attendant que la CI les
applique elle-même (M13.T6).

## Audit de la double écriture (M03.T3)

Le temps que `decks.cards` (JSONB) et `cards` (une ligne par carte,
M03.T1) tournent en double écriture avant de basculer les lectures
(M03.T6) et de retirer le JSONB (M03.T7), une tâche `pg_cron`
(`audit-double-ecriture-cards-quotidien`, migration `20260918100000`)
rejoue chaque jour à 4 h 03 la comparaison des deux et journalise le
résultat dans `card_sync_audit`. Vérifier l'absence d'écart sur les sept
jours avant de cocher M03.T3 :

```sql
select * from card_sync_audit order by checked_at;
```

Une fois M03.T7 fait (JSONB retiré), cette tâche et la table n'ont plus
d'objet : les retirer (`select cron.unschedule('audit-double-ecriture-cards-quotidien');`
puis `drop table public.card_sync_audit; drop function public.check_card_sync_drift();`).

## Sauvegardes

L'offre gratuite ne garantit ni sauvegarde ni restauration, et met le projet
en pause après sept jours sans requête — c'est la seule raison d'être du
workflow `.github/workflows/keep-supabase-awake.yml`. Passer à l'offre
payante avant le premier établissement, et vérifier une restauration réelle
au moins une fois.

## Comptes créés à la main

`supabase/comptes_test.sql` crée les trois comptes d'essai (admin, prof, élève)
avec une classe et un devoir.

⚠ **Le piège à connaître.** Insérer un compte directement dans `auth.users`
laisse les colonnes de jetons à `NULL`, là où l'inscription normale y met une
chaîne vide. Le serveur d'authentification, écrit en Go, les lit dans un type
`string` qui n'accepte pas `NULL` : il répond **500 avant de regarder le mot de
passe**, et l'app affiche « connexion impossible » sans indiquer la cause. On le
lit dans les journaux `auth_logs` :

```
error finding user: sql: Scan error on column index 3,
name "confirmation_token": converting NULL to string is unsupported
```

Les huit colonnes concernées : `confirmation_token`, `recovery_token`,
`email_change_token_new`, `email_change_token_current`, `email_change`,
`phone_change`, `phone_change_token`, `reauthentication_token`. Toutes à `''`.

Poser une valeur par défaut sur ces colonnes demanderait d'être propriétaire de
`auth.users`, ce que le rôle de migration n'est pas : le fichier de création
les renseigne donc explicitement, et se termine par un filet de sécurité qui
répare tout compte existant.
