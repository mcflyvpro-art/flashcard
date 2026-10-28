# Vendre Folio+ et mettre Folio sur tous les appareils

Ce fichier dit **comment l'argent entre**. Folio+ se paie avec Stripe sur
ordinateur, et par l'achat intégré d'Apple et de Google dans les apps des
magasins. Folio Campus se vend de gré à gré. Il dit aussi **comment Folio
arrive sur chaque appareil** : les apps des magasins pour les téléphones et
les tablettes, le navigateur pour les ordinateurs. Il raconte enfin **chaque
parcours**, de la page d'accueil au premier euro.

Tout le code est prêt et prouvé. Il reste des comptes à ouvrir et des clés à
poser, pas à programmer. À relire avec `CLAUDE.md` et `docs/CAPACITOR.md`.

## Les décisions (2026-10-27)

- **Trois offres** (`src/offres.js`, la seule source de la règle) :
  - **Folio gratuit**, qui comprend :
    - le Memory Engine Lite ;
    - 5 livres à soi (les devoirs ne comptent pas) ;
    - le journal réduit ;
    - ni IA, ni QCM, ni associations, ni images, ni sons.
  - **Folio+** : tout, avec 50 cours mis en flashcards par l'IA chaque mois.
    Il coûte 29,99 € par an ou 4,99 € par mois.
  - **Folio Campus** : tout, payé par l'établissement.
- **Les comptes qui existaient le 2026-10-27 gardent tout.** La migration
  `20261027210000` leur offre Folio+, sans date de fin (source `offert`) :
  certains ont plus de 5 livres, et rien ne devait casser. Seuls les comptes
  créés après la migration commencent en Folio gratuit.
- **Sur un téléphone ou une tablette, Folio est l'app des magasins, jamais le
  site.** Les apps installées depuis le navigateur sur un téléphone vont
  disparaître. Sur un ordinateur, Folio est la version web, installable en un
  clic.
- **Folio+ s'achète dans l'app, sur tous les appareils.**
  - Sur ordinateur, dans le navigateur ou l'app installée : par Stripe.
  - Dans l'app iPhone, iPad ou Android : par l'achat intégré d'Apple ou de
    Google, au travers de RevenueCat.
- Un abonnement pris quelque part s'ouvre partout : c'est le même compte et
  la même base.
- **Folio Campus passe par toi.**
  1. L'établissement demande une démo.
  2. Tu échanges avec lui.
  3. Tu ouvres la démo et la licence depuis la console de l'éditeur.
  4. Les élèves et les professeurs téléchargent l'app et entrent avec un code.

## Le principe : la base décide, chaque magasin écrit sa ligne

```
 ordinateur (navigateur, app installée)       base Supabase
 ──────────────────────────────────────       ─────────────
 « Passer à Folio+ » ── paiement ──────────▶ page Stripe Checkout
                                Stripe ──signé──▶ stripe-webhook ─┐
 app des magasins (Capacitor)                                     │
 ───────────────────────────                                      ▼
 « Passer à Folio+ » ── RevenueCat ── Apple / Google    table abonnements
        │ (achat intégré, la feuille du magasin)        une ligne par source :
        └── magasins (au retour de l'achat) ─────────▶  stripe · apple · google · offert
                    RevenueCat ──webhook──▶ magasins ─┘          │
                                                                 ▼
 l'app, sur n'importe quel appareil ◀──────────── mon_offre() : gratuit, plus ou campus
```

- **Une seule source de vérité : la base.** L'app est publique : un drapeau
  posé par elle se contournerait en une ligne. Elle demande donc
  `mon_offre()`, l'applique (`ui/bridage.js`) et garde la réponse pour le
  hors ligne.
- **Ce qui coûte de l'argent se tient côté serveur :**
  - les images et les sons (politiques restrictives sur le seau `media`) ;
  - l'IA (la fonction `ai` demande `offre_de()` : `plus` en 402 pour un
    compte gratuit, `mquota` au-delà de 50 cours par mois).
- **Le reste est une règle d'écran :** les 5 livres, les QCM et le journal.
  Un compte qui contournerait ces règles ne coûterait rien à personne. Et
  refuser un livre en base bloquerait la synchro de tout un appareil (règle
  5 de `CLAUDE.md`).
- **Une offre inconnue ne bride rien.** C'est le cas tant que la base ne la
  donne pas, par exemple quand la migration n'est pas appliquée ou qu'on est
  hors ligne sans copie : on ne retire jamais à quelqu'un ce qu'il a peut-être
  payé.
- **Chaque source a son écrivain, et aucune n'écrase une autre** :

  | Source | Qui l'écrit |
  |---|---|
  | `stripe` | `stripe-webhook` |
  | `apple`, `google` | `magasins` |
  | `offert` | la migration, ou `admin_offrir_plus` (l'éditeur) |

  Un ancien abonnement Stripe qui finit ne ferme pas celui pris sur
  l'iPhone.

## Tous les parcours

### Un élève sur ordinateur (B2C)

1. Il arrive sur la page d'accueil, à `/`.
2. Il choisit « Créer un compte » (`/inscription`), ou « Passer à Folio+ »
   (`/app?plus=annuel` ou `/app?plus=mensuel` : la formule attend la
   connexion).
3. Une fois inscrit, il est en **Folio gratuit**. Ce qui est dans Folio+
   porte un « + » et se grise. Le toucher ouvre l'écran Folio+ et dit
   pourquoi (« Ta bibliothèque est pleine », « QCM et associations »…).
4. Dans la barre latérale, une entrée **Folio+**, dans la lumière de la
   marque, ouvre l'écran : sa formule, puis « Passer à Folio+ ».
5. L'élève paie sur la page Stripe, puis revient sur `/app?plus=merci`.
   L'écran attend l'abonnement (il relit la base toutes les 2 s, 30 s au
   plus), puis affiche « Bienvenue dans Folio+ ».
6. L'entrée Folio+ s'en va. Tout s'ouvre, et **Folio+ se voit** :
   - le « + » après « Folio » dans la barre ;
   - le liseré de la marque sur son jeton, et sur celui de ses amis qui l'ont
     (`visuels()` le dit) ;
   - la lumière bleu-lilas-rose sur l'onglet allumé, le bouton principal,
     les barres de progression et le bouton rond.
7. Pour gérer son abonnement : Réglages → Folio+ → Gérer mon abonnement. Le
   portail de Stripe permet de changer de carte ou de formule, de voir ses
   factures et de résilier.

### Un élève sur téléphone (B2C)

**Aujourd'hui**, tant que les apps ne sont pas publiées et que `MAGASINS` est
vide, la version web reste au téléphone, comme avant. L'onglet Folio+ ferme
la barre du bas (Livres · Classe · Cercle · Folio+). Le paiement passe par
Stripe, et l'onglet s'en va une fois payé.

**Le jour où l'app est publiée** et son lien posé dans `MAGASINS` :

1. Sur le site, il crée son compte ou se connecte.
2. Une fois connecté, son téléphone ne voit plus qu'un écran
   (`ui/magasin.js`) : « Folio est une app. Télécharger sur l'App Store »
   (ou Google Play). Le code de classe, de partie ou de club qui attendait y
   est montré, à recopier dans l'app.
3. Dans l'app, il se connecte avec le même compte. L'onglet Folio+ ouvre la
   feuille d'achat d'Apple ou de Google. Une fois payé, `magasins` relit
   RevenueCat, Folio+ s'ouvre et l'onglet s'en va.
4. Pour gérer son abonnement :
   - dans les réglages de l'iPhone, ou dans Google Play ;
   - l'écran Folio+ y mène ;
   - sur un autre appareil, l'écran dit où il se gère.
5. « Restaurer mes achats » (demandé par Apple) sert pour un abonnement pris
   sur un autre appareil, ou avant une réinstallation.

Dans l'app des magasins, on ne voit jamais Stripe, ni aucun lien vers le
site pour payer. Un abonnement Stripe s'y ouvre quand même (règle 3.1.3(b) :
ce qui a été acheté ailleurs peut s'ouvrir dans l'app, puisque l'achat
intégré y est aussi proposé).

### Un compte d'avant le 2026-10-27

Il a **Folio+ offert, sans fin**. Rien n'est grisé, il n'a pas d'onglet
Folio+, et il a les effets de Folio+. Ses Réglages disent « Folio+ ·
Offert ». C'est le cas du compte de Sam.

### Folio offert par l'éditeur

Console de l'éditeur → Comptes → la fiche d'un compte → **Offrir Folio+**
(sans fin) ou **Reprendre**. C'est la fonction `admin_offrir_plus`. Elle ne
touche qu'à la ligne `offert` : un abonnement payé reste à Stripe ou au
magasin.

### Un établissement (Folio Campus, B2B)

1. Sur le site, l'établissement choisit « Demander une démo »
   (`/demande-demo`).
2. Sa demande arrive dans la console de l'éditeur, onglet Établissements
   (étape Prospect, « demande neuve »). Les chiffres du haut la comptent.
3. Tu échanges avec lui. Le **prochain pas** de sa fiche propose
   successivement :
   - « Lancer la démo » ;
   - « Transmettre le code référent », avec un `mailto:` tout écrit ;
   - « Passer en licence », avec son prix.
4. Le référent entre avec son code et distribue ses deux codes, un pour les
   élèves et un pour les professeurs.
5. **Les élèves et les professeurs téléchargent l'app** et entrent avec ce
   code. Sur ordinateur, ils passent par le navigateur.
6. Ils sont alors en **Folio Campus** : tout est ouvert, sans rien acheter
   (règle 3.1.3(c) d'Apple : une app vendue à une organisation pour ses
   membres n'a pas d'achat intégré à proposer). Ils n'ont pas d'onglet
   Folio+.
7. La facture se fait depuis la console, onglet Facturation (Chorus Pro pour
   un établissement public).

Un e-mail à chaque demande de démo demanderait un service d'envoi (Resend,
Brevo…) et sa clé. Aujourd'hui, la demande attend dans la console.

### Le professeur particulier

C'est un compte B2C comme un autre : Folio gratuit, ou Folio+, avec l'onglet
Folio+ dans sa barre. Ses élèves sont en Folio gratuit (les devoirs ne
comptent jamais dans les 5 livres). Les comptes d'avant le 2026-10-27 ont
Folio+ offert.

### La démo sans compte

- L'élève de la démo essaie **Folio gratuit**, avec le même bridage que pour
  un vrai compte (`ui/bridage.js`). Un geste bridé ouvre la fenêtre de la
  démo, pas l'écran Folio+.
- Le professeur et le référent de la démo sont en **Campus**.
- La démo n'a pas d'onglet Folio+ : son bandeau mène au compte.
- Au téléphone, la démo reste dans le navigateur : il n'y a pas de compte à
  ouvrir dans l'app.

## Ce qui est dans le dépôt

| Fichier | Rôle |
|---|---|
| `supabase/migrations/20261027190000_folio_plus_abonnements.sql` | tables `abonnements` et `stripe_evenements`, `mon_offre()`, `delete_me()` qui refuse tant qu'un abonnement Stripe court, purge des évènements |
| `supabase/migrations/20261027210000_folio_plus_pour_tous.sql` | une ligne par source, `offre_de()` (interne), les médias réservés à Folio+ et Campus, Folio+ offert aux comptes d'avant, `admin_offrir_plus`, `visuels()` qui dit Folio+ |
| `supabase/tests/abonnements.sql`, `supabase/tests/folio_plus_pour_tous.sql` | 17 + 15 cas |
| `supabase/functions/paiement/index.ts` | payer (Stripe Checkout) et gérer (le portail) ; refuse un second abonnement, Folio+ offert ou d'un magasin, et Campus |
| `supabase/functions/stripe-webhook/index.ts` | vérifie la signature, relit l'abonnement, écrit la ligne `stripe` ; idempotent |
| `supabase/functions/magasins/index.ts` | RevenueCat : webhook (secret partagé) et retour d'achat de l'app (jeton vérifié) ; relit l'abonné, écrit la ligne `apple` ou `google` |
| `supabase/functions/ai/index.ts` | l'IA : Folio+ et Campus seulement, 50 cours par mois |
| `supabase/functions/_shared/abonnement.js` | les règles pures des trois fonctions (testées : `test/paiement.test.js`) |
| `tools/paiement/essai.js` | les trois fonctions sous Deno, face à un faux Stripe et un faux RevenueCat : 32 vérifications |
| `src/offres.js` | ce que chaque offre ouvre |
| `src/abonnement.js`, `src/plateformes.js` | prix, statuts, où se gère un abonnement, appareil, magasins, « mobile jamais web » (testés : `test/abonnement.test.js`) |
| `src/core/abonnement.js` | `offrePull()`, `offreLocale()`, `versStripe()`, `versMagasin()`, `restaurerAchats()` |
| `src/ui/bridage.js` | le bridage de Folio gratuit (vrai compte et démo), les marques `html.offre-gratuit`, `livres-plein`, `offre-plus` |
| `src/ui/plus-porte.js`, `src/ui/plus.js`, `src/ui/plus.css` | l'écran Folio+ (`…/folio-plus`, `?plus=…`) et l'onglet (`ongletPlus`) |
| `src/ui/magasin.js` | le téléphone connecté dans son navigateur, envoyé vers son magasin |
| `e2e/folio-plus.e2e.js` | l'onglet, le paiement, le retour, ce qui est grisé, l'ancien compte, Campus, l'app des magasins, hors ligne |

## 1. Stripe, pas à pas (en mode test d'abord)

1. **Créer le compte** sur stripe.com, au nom de l'entreprise. Ce doit être
   le même nom que dans la console de l'éditeur, onglet Entreprise (raison
   sociale, SIRET, IBAN). Rester en **mode test** jusqu'à l'étape 3 de
   « Essayer ».
2. **Le produit** : Catalogue de produits → « Folio+ », avec deux prix
   **récurrents, en EUR, TVA incluse** (« Inclusive ») :
   - 29,99 € par an ;
   - 4,99 € par mois.

   Noter leurs identifiants `price_…`. Ces montants doivent être identiques
   à ceux de `FORMULES` (`src/abonnement.js`), de la page d'accueil et des
   magasins. `test/site.test.js` garde la page et l'app d'accord. Stripe et
   les magasins se vérifient à l'œil.
3. **Le portail client** : Paramètres → Facturation → Portail client.
   - Autoriser : changer de moyen de paiement, voir ses factures, **annuler
     (à la fin de la période)**, passer d'un prix à l'autre.
   - Lien de retour : `https://www.folioflashcard.online/app?plus=retour`.
4. **Le point d'arrivée des évènements** : Développeurs → Webhooks →
   Ajouter un point de terminaison.
   - URL : `https://qqbzefpdeinlynjtarqr.supabase.co/functions/v1/stripe-webhook`
   - Évènements, exactement ceux de `EVENEMENTS` (`_shared/abonnement.js`) :
     - `checkout.session.completed` ;
     - `customer.subscription.created`, `customer.subscription.updated`,
       `customer.subscription.deleted`, `customer.subscription.paused`,
       `customer.subscription.resumed` ;
     - `invoice.paid`, `invoice.payment_failed`.
   - Noter le **secret de signature** `whsec_…`.
5. **Facultatif, mais recommandé** :
   - Paramètres → Détails publics : les conditions de vente, puis
     `STRIPE_CGV=1` ;
   - Stripe Tax (la TVA européenne, guichet OSS), puis `STRIPE_TAXE=1` ;
   - les reçus par e-mail ;
   - le libellé sur le relevé bancaire : `FOLIO`.

## 2. Apple, Google et RevenueCat (l'app des magasins)

À faire une fois l'app construite avec Capacitor (`docs/CAPACITOR.md`).

1. **App Store Connect** (compte développeur : 99 $ par an) :
   - Créer l'app, puis un **groupe d'abonnements** « Folio+ » et deux
     abonnements renouvelables automatiquement : `folio_plus_annuel`
     (29,99 €) et `folio_plus_mensuel` (4,99 €).
   - Le mot « annuel » ou « mensuel » dans l'identifiant suffit à
     `formuleDuProduit()`.
   - Les conditions d'utilisation et la confidentialité vont dans la fiche.
   - Le programme pour les petits développeurs (15 % de commission au lieu
     de 30 %) se demande à part.
2. **Google Play Console** (25 $, une fois) :
   - Créer l'app, puis un abonnement `folio_plus` avec deux offres de base,
     `annuel` et `mensuel` (identifiants `folio_plus:annuel` et
     `folio_plus:mensuel`).
   - La commission est de 15 % sur les abonnements.
3. **RevenueCat** (gratuit jusqu'à 2 500 $ de revenu mensuel) :
   - Créer le projet, puis y relier l'app iOS (clé d'API App Store Connect,
     « In-App Purchase Key ») et l'app Android (compte de service Google).
   - Créer le **droit** (« entitlement ») `plus`, qui reçoit les quatre
     produits.
   - Créer une **offre** (« offering ») par défaut avec deux paquets :
     `$rc_annual` et `$rc_monthly`. L'app prend `current.annual` et
     `current.monthly`.
   - Les **clés publiques** de l'app (`appl_…` et `goog_…`) vont dans
     `REVENUECAT` (`src/abonnement.js`). Elles sont publiques par nature,
     comme la clé anon.
   - La **clé secrète** de l'API (`sk_…`) va dans le secret `RC_SECRET`,
     jamais dans le dépôt.
   - **Webhook** :
     - URL : `https://qqbzefpdeinlynjtarqr.supabase.co/functions/v1/magasins` ;
     - en-tête d'autorisation : une longue valeur au hasard (par exemple
       `Bearer ` suivi de 40 signes), recopiée telle quelle dans
       `RC_WEBHOOK_AUTH`.
   - Le greffon : `npm install @revenuecat/purchases-capacitor`, puis
     `npx cap sync`. L'app web ne l'importe pas : `core/abonnement.js` le
     trouve sous `Capacitor.Plugins.Purchases`.
4. **Les règles à relire avant chaque soumission** (elles changent tous les
   ans) :
   - developer.apple.com/app-store/review/guidelines, sections 3.1.1,
     3.1.2, 3.1.3 et 5.1.1(v) ;
   - les règles de paiement de Google Play.

   Ce que l'app fait pour s'y conformer :
   - elle n'affiche ni lien ni mention de Stripe ;
   - elle propose « Restaurer mes achats » ;
   - elle dit, à la suppression du compte, qu'un abonnement des magasins
     continue tant qu'il n'est pas résilié chez eux ;
   - Campus ne demande rien à Apple (règle 3.1.3(c)).

## 3. Supabase : la base, les fonctions, les secrets

> **Fait le 2026-10-28** : les deux migrations sont appliquées (dans l'ordre,
> l'une juste après l'autre), les advisors relus (rien à corriger : la table
> de service sans politique et les fonctions ouvertes aux comptes connectés
> sont voulues), `abonnements.sql` 17/17 et `folio_plus_pour_tous.sql` 15/15
> en base, les quatre fonctions déployées (`ai` et `paiement` avec
> vérification du jeton, `stripe-webhook` et `magasins` sans), chacune
> vérifiée identique au dépôt. 11 comptes ont reçu Folio+ offert (10 élèves,
> 1 professeur), aucun référent ni éditeur. **Il ne reste que les secrets**
> (point 3) : `ANTHROPIC_API_KEY` est posé ; manquent `STRIPE_SECRET_KEY` et
> `RC_SECRET` (les fonctions répondent `nokey`), et donc sans doute
> `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRIX_ANNUEL`, `STRIPE_PRIX_MENSUEL`,
> `RC_WEBHOOK_AUTH`, que les fonctions ne lisent qu'après les deux premiers.

1. **Les migrations**, dans l'ordre :
   - `20261027190000_folio_plus_abonnements.sql` ;
   - `20261027210000_folio_plus_pour_tous.sql` (Folio+ offert à tous les
     comptes qui existent à ce moment).

   Les appliquer par MCP `apply_migration` ou `supabase db push`. Lancer
   ensuite les advisors (sécurité et performance), puis
   `supabase/tests/abonnements.sql` et
   `supabase/tests/folio_plus_pour_tous.sql`.

   ⚠️ L'app en ligne bride les comptes que la base dit gratuits. Tant que
   la seconde migration n'est pas appliquée, la base ne dit rien et rien
   n'est bridé. Il faut l'appliquer **vite** : un compte créé entre-temps
   recevrait lui aussi Folio+ offert.
2. **Les fonctions** :
   ```sh
   supabase functions deploy paiement
   supabase functions deploy stripe-webhook --no-verify-jwt
   supabase functions deploy magasins --no-verify-jwt
   supabase functions deploy ai
   ```
   `stripe-webhook` et `magasins` se déploient sans vérification du jeton :
   Stripe et RevenueCat n'ont pas de compte Folio. La signature, ou le secret
   partagé, remplace le jeton ; `magasins` vérifie lui-même le jeton de
   l'app.

   Par le MCP (`deploy_edge_function`), joindre aussi
   `../_shared/abonnement.js`, et passer `verify_jwt: false` pour les deux
   fonctions sans vérification.
3. **Les secrets** (Edge Functions → Secrets, ou `supabase secrets set …`).
   Ils ne vont jamais dans le dépôt, ni dans une conversation :

   | Secret | Valeur |
   |---|---|
   | `STRIPE_SECRET_KEY` | `sk_test_…`, puis `sk_live_…` |
   | `STRIPE_WEBHOOK_SECRET` | `whsec_…` du point d'arrivée |
   | `STRIPE_PRIX_ANNUEL` | `price_…` à 29,99 € |
   | `STRIPE_PRIX_MENSUEL` | `price_…` à 4,99 € |
   | `STRIPE_TAXE`, `STRIPE_CGV` | `1` une fois activés dans Stripe |
   | `RC_SECRET` | `sk_…`, la clé secrète de RevenueCat |
   | `RC_WEBHOOK_AUTH` | la valeur de l'en-tête d'autorisation du webhook RevenueCat |
   | `RC_DROIT` | facultatif : le droit de Folio+, `plus` par défaut |
   | `AI_MONTHLY_PLUS` | facultatif : cours par mois avec Folio+, 50 par défaut |

## 4. Essayer

1. Créer un compte neuf sur `https://www.folioflashcard.online/inscription`.
   Il est en Folio gratuit et a l'onglet Folio+. Un compte d'avant la
   migration a Folio+ offert : il n'a rien à acheter.
2. Dans l'onglet Folio+, choisir « Passer à Folio+ », puis payer avec la
   carte de test `4242 4242 4242 4242`. Pour 3-D Secure :
   `4000 0025 0000 3155`.
3. L'écran affiche « Bienvenue dans Folio+ ». L'onglet s'en va et les
   effets de Folio+ apparaissent.
4. Réglages → Folio+ → Gérer mon abonnement → Annuler. L'écran affiche
   « Se termine le … ».
5. Dans Stripe → Webhooks, chaque évènement doit répondre 200.
6. Dans l'app des magasins : un compte « sandbox » d'Apple, ou un testeur
   de licence de Google Play. Acheter, puis « Restaurer mes achats » sur un
   autre appareil. Dans RevenueCat → Webhooks, chaque évènement doit
   répondre 200.

En local, sans aucun service :
- `node tools/paiement/essai.js` (Deno : la variable `DENO`, sinon
  `npx deno@2`) ;
- `npx playwright test folio-plus`.

## 5. Avant le premier vrai paiement

- [ ] Rejouer l'étape 4 avec les clés réelles : un vrai paiement, remboursé
      ensuite (M12.T5).
- [ ] Écrire les conditions de vente B2C dans `src/ui/legal-textes.js` :
      prix, durée, renouvellement, résiliation, **droit de rétractation de
      14 jours**, et ce qu'il devient quand l'accès commence aussitôt. À
      faire relire par un juriste.
- [ ] Créer un pool d'IA par établissement (M12.T3) : aujourd'hui, Campus a
      50 cours par mois et par compte, et le plafond `AI_BUDGET_USD` est
      global (`supabase/REGLAGES.md`).
- [ ] Si la vente doit fermer de nouveau : `VENTE_OUVERTE = false`
      (`src/abonnement.js`), et retirer `data-vente-an` et `data-vente-mois`
      du bouton du site. `test/site.test.js` refuse l'un sans l'autre.

## 6. Folio sur chaque appareil

| Appareil | Aujourd'hui | Une fois l'app publiée | Coût |
|---|---|---|---|
| iPhone, iPad | la version web (comme avant) | **l'App Store seulement** : un téléphone connecté dans Safari est envoyé vers l'app | 99 $ par an |
| Android | la version web (comme avant) | **Google Play seulement**, de même | 25 $, une fois |
| Mac | la version web ; Chrome ou Edge l'installent, Safari l'ajoute au Dock | en plus, l'app de l'iPad sur les Mac à puce Apple (Mac App Store), avec le même abonnement | compris dans les 99 $ |
| Windows, Chromebook, Linux | la version web, installable en un clic (Edge, Chrome) | de même ; le Microsoft Store plus tard, si l'on veut (PWABuilder) | compte Microsoft |

- **Le jour où une app est publiée**, renseigner son lien dans `MAGASINS`
  (`src/plateformes.js`), par exemple
  `android: 'https://play.google.com/store/apps/details?id=online.folioflashcard.app'`.
  Deux choses en découlent :
  - un téléphone Android connecté dans son navigateur est envoyé vers
    Google Play (`versLeMagasin`, `ui/magasin.js`) ;
  - l'écran Folio+ propose « Télécharger sur Google Play ».
- **Le Mac** : l'app de l'iPad s'y installe depuis le Mac App Store. Il
  suffit de cocher « Mac (Apple Silicon) » dans App Store Connect : rien à
  construire de plus, et c'est le même abonnement Apple. Pour un Mac Intel,
  ou pour qui préfère le navigateur, il y a la version web. Une app Mac à
  part (Catalyst) n'est pas utile au départ.
- **Les liens imprimés et les QR** (classes, cartes élève, défis) mènent
  toujours à `folioflashcard.online`. Les liens universels (iOS) et App
  Links (Android) de `docs/CAPACITOR.md` les ouvrent directement dans l'app
  installée. Sans l'app, le navigateur montre le code à recopier (la carte
  de passage).
- La page d'accueil n'a plus de section « Sur tous tes écrans » (retirée le
  2026-10-27). Sa FAQ dit : « l'app sur l'App Store et Google Play ; sur
  ordinateur, le navigateur ».
- Les badges officiels (« Télécharger dans l'App Store », « Disponible sur
  Google Play ») se téléchargent depuis les pages marketing d'Apple et de
  Google, et suivent leurs règles d'usage. Les poser dans `public/site/` à
  ce moment-là.
