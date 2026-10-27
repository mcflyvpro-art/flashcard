# Vendre Folio+ et mettre Folio sur tous les appareils

Ce fichier dit **comment l'argent entre** (Folio+ payé sur le site, avec
Stripe) et **comment Folio arrive sur chaque appareil** (le navigateur
aujourd'hui, l'App Store, Google Play et le Microsoft Store ensuite). Tout le
code est prêt et prouvé : il reste des comptes à ouvrir et des clés à poser,
pas à programmer. À relire avec `CLAUDE.md` et `docs/CAPACITOR.md`.

## Le principe : un compte, un abonnement, partout

```
 site (navigateur)                         base Supabase
 ─────────────────                         ─────────────
 Folio+ → « Passer à Folio+ »
   │ POST /functions/v1/paiement ───────▶ fonction `paiement`
   │                                        │ demande une page à Stripe
   ◀──────────── { url } ─────────────────┘
   │ le navigateur va sur checkout.stripe.com (la carte ne passe jamais par Folio)
   │
   │                        Stripe ──signé──▶ fonction `stripe-webhook`
   │                                           │ relit l'abonnement chez Stripe
   │                                           └▶ table `abonnements`
   ▼
 /app?plus=merci  → l'écran Folio+ : « Bienvenue dans Folio+ », puis Folio partout
                                          ▲
 l'app, sur n'importe quel appareil ──────┘ mon_offre() : gratuit, plus ou campus
```

- **Une seule source de vérité : la base.** `mon_offre()` dit ce que le
  compte ouvre ; l'app ne décide rien d'elle-même (elle est publique, un
  drapeau posé par elle se contournerait).
- **Une seule règle par offre** : `src/offres.js` (ce que chaque offre ouvre)
  et `src/abonnement.js` (les prix, ce que l'écran en dit). La vraie app ne
  bride encore rien : le brider est M12.T2.
- **Payé sur le site, ouvert partout** : l'iPhone, l'Android, le Mac, le PC
  — même compte, même abonnement.

## Ce qui est dans le dépôt

| Fichier | Rôle |
|---|---|
| `supabase/migrations/20261027190000_folio_plus_abonnements.sql` | tables `abonnements` (lecture de sa ligne, aucune écriture par l'app) et `stripe_evenements` (service seul), `mon_offre()`, `delete_me()` qui refuse tant qu'un abonnement court, purge des évènements à 30 jours |
| `supabase/tests/abonnements.sql` | 17 cas : ce que chacun ouvre, personne ne s'offre Folio+ par l'API, la suppression de compte, les droits |
| `supabase/functions/paiement/index.ts` | payer (page Stripe Checkout) et gérer (portail Stripe) ; refuse un second abonnement, et Campus |
| `supabase/functions/stripe-webhook/index.ts` | vérifie la signature, relit l'abonnement, écrit sa ligne ; idempotent |
| `supabase/functions/_shared/abonnement.js` | les règles pures des deux fonctions (testées : `test/paiement.test.js`) |
| `tools/paiement/essai.js` | les deux fonctions lancées sous Deno face à un faux Stripe : 23 vérifications |
| `src/abonnement.js`, `src/plateformes.js` | prix, statuts, appareil, magasins (testés : `test/abonnement.test.js`) |
| `src/core/abonnement.js` | `offrePull()` (mon_offre), `versStripe()` (la fonction paiement) |
| `src/ui/plus-porte.js`, `src/ui/plus.js`, `src/ui/plus.css` | l'écran Folio+ (`…/folio-plus`, `?plus=…`) |
| `index.html`, `src/site/` | la section « Sur tous tes écrans » (`#telecharger`) |
| `e2e/folio-plus.e2e.js` | le parcours : payer, revenir, Campus, hors ligne, paiement pas encore ouvert |

## 1. Stripe, pas à pas (en mode test d'abord)

1. **Créer le compte** sur stripe.com, au nom de l'entreprise (le même que
   dans la console de l'éditeur, onglet Entreprise : raison sociale, SIRET,
   IBAN). Rester en **mode test** jusqu'à l'étape 5.
2. **Le produit** : Catalogue de produits → « Folio+ », deux prix
   **récurrents, en EUR, TVA incluse** (« Inclusive ») :
   - 29,99 € par an,
   - 4,99 € par mois.

   Noter leurs identifiants `price_…`. Ces montants sont ceux de
   `FORMULES` (`src/abonnement.js`) et de la page d'accueil : les trois
   doivent dire la même chose (`test/site.test.js` garde la page et l'app
   d'accord ; Stripe se vérifie à l'œil).
3. **Le portail client** : Paramètres → Facturation → Portail client.
   Autoriser : changer de moyen de paiement, voir ses factures, **annuler
   (à la fin de la période)**, passer d'un prix à l'autre (les deux prix de
   Folio+). Lien de retour par défaut : `https://www.folioflashcard.online/app?plus=retour`.
   C'est la résiliation « en trois clics » qu'impose la loi depuis 2023 :
   Réglages → Folio+ → Gérer mon abonnement → Annuler.
4. **Le point d'arrivée des évènements** : Développeurs → Webhooks →
   Ajouter un point de terminaison :
   - URL : `https://qqbzefpdeinlynjtarqr.supabase.co/functions/v1/stripe-webhook`
   - évènements (exactement ceux de `EVENEMENTS`, `_shared/abonnement.js`) :
     `checkout.session.completed`, `customer.subscription.created`,
     `customer.subscription.updated`, `customer.subscription.deleted`,
     `customer.subscription.paused`, `customer.subscription.resumed`,
     `invoice.paid`, `invoice.payment_failed`
   - noter le **secret de signature** `whsec_…`.
5. **Facultatif, mais recommandé** :
   - Paramètres → Détails publics : adresse des conditions de vente et de
     la confidentialité, puis `STRIPE_CGV=1` (la case à cocher sur la page
     de paiement) ;
   - Stripe Tax (TVA du pays de chaque acheteur européen, guichet OSS),
     puis `STRIPE_TAXE=1` ;
   - Paramètres → E-mails clients : reçus de paiement et de remboursement ;
   - l'image de marque (logo, couleurs) et le libellé sur le relevé
     bancaire : `FOLIO`.

## 2. Supabase : la base, les fonctions, les secrets

1. **La migration** `20261027190000_folio_plus_abonnements.sql` : MCP
   `apply_migration` (ou `supabase db push`), puis les advisors (sécurité et
   performance), puis `supabase/tests/abonnements.sql` (mode d'emploi des
   tests SQL dans `CLAUDE.md`).
2. **Les fonctions** :
   ```sh
   supabase functions deploy paiement
   supabase functions deploy stripe-webhook --no-verify-jwt
   ```
   `--no-verify-jwt` pour le webhook seulement : Stripe n'a pas de compte
   Folio, la signature remplace le jeton. Par le MCP
   (`deploy_edge_function`), donner aussi le fichier `../_shared/abonnement.js`
   et `verify_jwt: false` pour `stripe-webhook`.
3. **Les secrets** (Edge Functions → Secrets, ou `supabase secrets set …`) —
   jamais dans le dépôt, jamais dans une conversation :

   | Secret | Valeur |
   |---|---|
   | `STRIPE_SECRET_KEY` | `sk_test_…` (puis `sk_live_…`) |
   | `STRIPE_WEBHOOK_SECRET` | `whsec_…` du point d'arrivée |
   | `STRIPE_PRIX_ANNUEL` | `price_…` à 29,99 € |
   | `STRIPE_PRIX_MENSUEL` | `price_…` à 4,99 € |
   | `STRIPE_TAXE` | `1` si Stripe Tax est activé |
   | `STRIPE_CGV` | `1` une fois les conditions posées dans Stripe |

## 3. Essayer, en mode test

1. Ouvrir `https://www.folioflashcard.online/eleve/folio-plus` connecté
   (l'écran répond même la vente fermée : c'est fait pour essayer).
2. Payer avec la carte de test `4242 4242 4242 4242` (date future, n'importe
   quel code). Avec 3-D Secure : `4000 0025 0000 3155`.
3. Revenir sur « Bienvenue dans Folio+ » ; la ligne apparaît dans
   `abonnements` ; Réglages → Folio+ → Gérer mon abonnement ouvre le portail.
4. Annuler depuis le portail : « Se termine le … ».
5. Dans Stripe → Webhooks, chaque évènement doit répondre 200.

En local, sans Stripe : `node tools/paiement/essai.js` (Deno : variable
`DENO`, sinon `npx deno@2`) et `npx playwright test folio-plus`.

## 4. Ouvrir la vente

Une fois l'étape 3 réussie en mode test, puis rejouée avec les clés réelles
(M12.T5 : un vrai paiement, remboursé) :

- [ ] `VENTE_OUVERTE = true` dans `src/abonnement.js` (la ligne Folio+ des
      Réglages pour tous) ;
- [ ] dans `index.html`, sur le bouton « Passer à Folio+ » (`data-vente`) :
      `data-vente-an="/app?plus=annuel" data-vente-mois="/app?plus=mensuel"`
      — `test/site.test.js` refuse l'un sans l'autre ;
- [ ] les conditions de vente B2C dans `src/ui/legal-textes.js` : prix, durée,
      renouvellement, résiliation, **droit de rétractation de 14 jours** et
      ce qu'il devient quand l'accès commence aussitôt — à faire relire par
      un juriste ;
- [ ] **brider Folio gratuit pour de vrai** (M12.T2 : 5 livres, l'IA, le
      journal, Memory Engine Lite — `src/offres.js`), côté serveur, sans
      enfermer ceux qui ont déjà plus de 5 livres ; sinon la page d'accueil
      promet plus que l'app ne tient ;
- [ ] les quotas d'IA par abonné et par établissement (M12.T3, et
      `supabase/REGLAGES.md` : le plafond actuel est global).

## 5. Les applications des magasins : ce qui est permis

**Dans une app de l'App Store ou de Google Play, on ne vend pas Folio+ avec
Stripe.** Apple (règles 3.1.1 et 3.1.3 de l'App Store) et Google (règles de
paiement de Google Play) imposent leur propre paiement pour un abonnement
numérique acheté dans l'app, et interdisent d'y envoyer vers un paiement
moins cher ailleurs. Des exceptions existent aux États-Unis et, sous
conditions et avec des frais, dans l'Union européenne : elles changent
chaque année, **à relire sur developer.apple.com et dans les règles de
Google Play avant chaque soumission**.

Ce que le code fait déjà, sous Capacitor (`plateforme()` lit
`window.Capacitor.getPlatform()`, `peutVendre()` rend faux) :

- l'écran Folio+ n'y montre ni prix, ni formule, ni « Gérer mon
  abonnement » : seulement ce que le compte a ;
- un abonnement pris sur le site s'y ouvre (même compte, même base) ;
- **Folio Campus n'a rien à demander à Apple** : une app vendue directement
  à des établissements pour leurs élèves (règle 3.1.3(c)) ouvre l'accès
  sans achat dans l'app.

Ce qui reste à faire pour vendre aussi DANS les apps (plus tard) : l'achat
intégré d'Apple et de Google, réunis par **RevenueCat** (un seul « droit
Folio+ » pour Apple, Google et Stripe, un plugin Capacitor, un webhook vers
Supabase). La colonne `abonnements.source` (`apple`, `google`) est déjà là,
et `aEcrire()` empêche Stripe d'écraser un abonnement des magasins qui
court. Côté prix : 15 % de commission (programme pour les petits
développeurs d'Apple, abonnements Google) — garder le même prix ou le monter
un peu dans l'app.

## 6. Folio sur chaque appareil

| Appareil | Aujourd'hui | Plus tard | Coût |
|---|---|---|---|
| iPhone, iPad | Safari : Partager → Sur l'écran d'accueil | App Store (Capacitor) | 99 $ par an |
| Android | Chrome : Installer l'application | Google Play (Capacitor) | 25 $ une fois |
| Mac | Chrome, Edge : installer ; Safari : Ajouter au Dock | l'app iPad sur les Mac Apple Silicon (case « Mac » dans App Store Connect) | compris dans les 99 $ |
| Windows | Edge, Chrome : installer | Microsoft Store : empaqueter la PWA avec PWABuilder (pwabuilder.com) | compte développeur Microsoft |

- La page d'accueil (`#telecharger`) et l'écran Folio+ (« Folio partout »,
  avec un QR vers le téléphone sur ordinateur) disent ces gestes : ce sont
  ceux de `GESTES` (`src/plateformes.js`), la page est vérifiée contre eux.
- **Le jour où une app est publiée**, renseigner son lien dans `MAGASINS`
  (`src/plateformes.js`) — par exemple
  `android: 'https://play.google.com/store/apps/details?id=online.folioflashcard.app'` :
  le bouton « Télécharger sur Google Play » apparaît seul, sur le site et
  dans l'app, et passe avant l'installation par le navigateur.
- Les badges officiels (« Télécharger dans l'App Store », « Disponible sur
  Google Play ») se téléchargent depuis les pages marketing d'Apple et de
  Google et suivent leurs règles d'usage : les poser dans `public/site/`
  à ce moment-là.
