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

⚠️ **Ces trois plafonds ne tiennent pas à l'échelle d'un établissement.** Le
budget est global à tous les comptes : un seul lycée actif l'épuise en
quelques jours, et la fonctionnalité s'éteint alors pour tout le monde, sans
prévenir personne. Aux quotas actuels, un élève qui les consomme entièrement
coûte environ 1,20 $ par jour. À remplacer par un pool de crédits par
établissement avant toute vente.

## Sauvegardes

L'offre gratuite ne garantit ni sauvegarde ni restauration, et met le projet
en pause après sept jours sans requête — c'est la seule raison d'être du
workflow `.github/workflows/keep-supabase-awake.yml`. Passer à l'offre
payante avant le premier établissement, et vérifier une restauration réelle
au moins une fois.
