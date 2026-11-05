# Les e-mails de Mirandola : envoyer, recevoir

Écrit le 2026-11-02, refait le même jour d'après les captures de Brevo et
d'OVH. Ce qu'il faut : **vérifier l'adresse** de qui crée un compte
(aujourd'hui on peut s'inscrire avec une adresse qui n'existe pas :
« Confirm email » est coupé dans Supabase depuis le 2026-10-29, faute de
serveur d'envoi), le **mot de passe oublié**, et **être prévenu** quand un
établissement demande une démo.

## Le choix : Brevo pour envoyer, OVH pour recevoir

- **Brevo** (brevo.com) : français, serveurs en Europe (RGPD), **gratuit
  jusqu'à 300 e-mails par jour**, sans carte bancaire. Deux portes : un
  serveur SMTP (Supabase Auth : confirmation de l'adresse, mot de passe
  oublié, changement d'adresse) et une API (la fonction `prevenir` : l'alerte
  d'une demande de démo, l'accusé de réception).
- **OVH** (le domaine `mirandola.fr`, serveurs de noms `dns103.ovh.net` et
  `ns103.ovh.net`) : la zone DNS, et l'offre e-mail livrée avec le domaine,
  **MX Plan « redirect »** : aucune boîte (« Vous n'avez pas la possibilité de
  créer de compte email », 0 / 0), mais **1 000 redirections gratuites**. Une
  adresse `…@mirandola.fr` existe donc dès qu'on la redirige vers une vraie
  boîte (Gmail) : pas besoin d'acheter de boîte.

300 par jour suffit au début : les élèves d'un établissement entrent avec un
code (aucun e-mail) ; seuls les particuliers et les professeurs en reçoivent
un. Au-delà, l'offre « Starter » de Brevo (environ 9 € par mois).

## Les adresses

| Adresse | Ce qu'elle est | Sert à |
|---|---|---|
| `noreply@mirandola.fr` | expéditeur Brevo, redirigée vers Gmail | envoie tous les e-mails (Supabase Auth, `prevenir`) ; une réponse d'étourdi arrive quand même |
| `contact@mirandola.fr` | redirigée vers Gmail | reçoit les alertes de demande de démo (`ALERTE_EMAIL`) ; c'est elle que voit un établissement quand il répond à l'accusé de réception |

---

## État au 2026-11-02 (vérifié depuis l'extérieur)

- [x] Compte Brevo « Mirandola », propriétaire : l'éditeur.
- [x] Domaine `mirandola.fr` ajouté dans Brevo (« Authentifier le domaine
  moi-même »).
- [x] Les 4 enregistrements de Brevo posés dans la zone DNS d'OVH, et
  **publiés** (lus par DNS public le 2026-11-02) : TXT `brevo-code:4167…` à
  la racine, CNAME `brevo1._domainkey` → `b1.mirandola-fr.dkim.brevo.com`
  (la clé DKIM se lit au bout), CNAME `brevo2._domainkey` →
  `b2.mirandola-fr.dkim.brevo.com`, TXT `_dmarc` →
  `v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com`. Brevo les voit tous
  les quatre (coches vertes).
- [x] Ne rien toucher d'autre dans la zone : les deux `A` de la racine et le
  `CNAME www` sont ceux de Vercel (le site), les trois `MX` d'OVH reçoivent
  le courrier (les redirections), le SPF `v=spf1 include:mx.ovh.com -all`
  n'a pas à nommer Brevo — Brevo envoie sous sa propre adresse de retour, et
  DMARC passe par DKIM (signé `mirandola.fr`).
- [ ] La suite, ci-dessous.

## 1. Brevo : finir le domaine (1 minute)

Paramètres → **Expéditeurs, domaine, IP** → onglet **Domaines** →
`mirandola.fr` → **Authentifiez** → à l'étape 4, **Vérifier les
enregistrements**, puis **Authentifier le domaine**. Le domaine passe à
« Authentifié » (point vert). S'il reste rouge : attendre dix minutes, puis
« Vérifier » encore (les DNS sont déjà publiés).

## 2. OVH : créer les deux adresses (5 minutes)

Web Cloud → **Emails** → `mirandola.fr` → **Gestion des redirections** →
**Ajouter une redirection**, deux fois :

| De | Vers | Copie |
|---|---|---|
| `contact@mirandola.fr` | ton adresse Gmail | **sans** copie (il n'y a pas de boîte) |
| `noreply@mirandola.fr` | ton adresse Gmail | **sans** copie |

Vérifier : depuis une autre adresse, écrire à `contact@mirandola.fr` → le
message arrive dans Gmail (la première fois, regarder aussi « Spam » et
« Promotions »). Compter quelques minutes après la création.

## 3. Brevo : l'expéditeur (2 minutes)

Paramètres → **Expéditeurs, domaine, IP** → onglet **Expéditeurs** →
**Ajouter un expéditeur** : nom `Mirandola`, adresse `noreply@mirandola.fr`.
Le domaine étant authentifié, Brevo le valide d'office ; s'il envoie un code,
il arrive dans Gmail par la redirection. Ajouter de même
`contact@mirandola.fr` (nom `Mirandola`) si tu veux répondre sous cette
adresse depuis Gmail (§ 8).

## 4. Brevo : les deux clés et la sécurité (5 minutes)

Paramètres → **SMTP et API** :

1. Onglet **SMTP** : noter le **serveur** (`smtp-relay.brevo.com`), le
   **port** (`587`) et l'**identifiant** (de la forme `…@smtp-brevo.com` —
   pas ton adresse Gmail). **Générer une nouvelle clé SMTP**, nommée
   « Supabase Auth » : la copier aussitôt (Brevo ne la remontre plus).
2. Onglet **Clés API** : **Générer une nouvelle clé API**, nommée
   « Mirandola prevenir » : une clé `xkeysib-…`, à copier aussitôt.

Ces deux clés ne vont **jamais** dans le dépôt ni dans une conversation :
elles se collent directement dans Supabase (§ 5 et § 7).

Puis Paramètres → **Sécurité** → **IP autorisées** : désactiver le blocage
des adresses IP inconnues. Supabase n'a pas d'adresse fixe : sinon Brevo
bloque ses envois et t'écrit « adresse IP non reconnue ». Si Brevo demande
de compléter le profil de l'entreprise (site `https://mirandola.fr`) ou
d'activer les e-mails transactionnels, le faire.

## 5. Supabase : le SMTP de Brevo (3 minutes)

Projet `qqbzefpdeinlynjtarqr` → **Authentication** → **Emails** → onglet
**SMTP Settings** → **Enable Custom SMTP** :

| Champ | Valeur |
|---|---|
| Sender email address | `noreply@mirandola.fr` |
| Sender name | `Mirandola` |
| Host | `smtp-relay.brevo.com` |
| Port number | `587` |
| Minimum interval per user | `60` (laisser) |
| Username | l'identifiant SMTP de Brevo (`…@smtp-brevo.com`) |
| Password | la clé SMTP |

**Save**. Puis **Authentication → Rate Limits → Rate limit for sending
emails** : `100` par heure (un SMTP neuf démarre à 30).

Les modèles (2026-11-02 : les treize que propose Supabase, en français, à la
mise en page de Mirandola). **Authentication → Emails**, onglet
**Templates** pour les six premiers, onglet **Security notifications** pour
les sept alertes (chacune s'allume d'abord, interrupteur en tête de la
page) : pour chacun, l'objet, puis tout le fichier dans « Message body »
(sur GitHub, « Copy raw file » ; la première ligne, en commentaire, rappelle
le modèle et l'objet) :

| Modèle Supabase | Objet | Fichier (`supabase/courriels/`) |
|---|---|---|
| Confirm sign up | Confirme ton adresse e-mail pour Mirandola | `confirmation.html` |
| Invite user | Ton compte Mirandola t’attend | `invitation.html` |
| Magic link | Ton code de connexion à Mirandola | `lien-magique.html` |
| Change email address | Confirme ta nouvelle adresse e-mail | `changement-adresse.html` |
| Reset password | Réinitialise ton mot de passe Mirandola | `mot-de-passe.html` |
| Reauthentication | Ton code de vérification Mirandola | `code-verification.html` |
| Password changed | Ton mot de passe Mirandola a été modifié | `alerte-mot-de-passe.html` |
| Email address changed | L’adresse e-mail de ton compte Mirandola a changé | `alerte-adresse.html` |
| Phone number changed | Le numéro de ton compte Mirandola a changé | `alerte-telephone.html` |
| Sign-in method linked | Nouvelle méthode de connexion sur ton compte Mirandola | `alerte-connexion-ajoutee.html` |
| Sign-in method removed | Une méthode de connexion a été retirée de ton compte Mirandola | `alerte-connexion-retiree.html` |
| Verification method added | Vérification en deux étapes ajoutée à ton compte Mirandola | `alerte-verification-ajoutee.html` |
| Verification method removed | Vérification en deux étapes retirée de ton compte Mirandola | `alerte-verification-retiree.html` |

**Chaque modèle a son usage dans l'app** (2026-11-04) : « Confirm sign up »
— le code de l'inscription (l'écran « Vérifie ta boîte mail. ») ; « Magic
link » — « Recevoir un code » sur l'écran de connexion ; « Reset password »
— « Mot de passe oublié » ; « Change email address » — Réglages → Sécurité
du compte → Adresse e-mail (un code à chacune des deux adresses) ;
« Reauthentication » — changer de mot de passe quand la session a plus de
24 h ; « Invite user » — une invitation envoyée depuis le tableau de bord de
Supabase (Authentication → Users → Invite) : l'app n'en envoie pas, les
comptes ouverts par l'éditeur ou le référent ont un mot de passe provisoire.
Les quatre premiers portent le code à 8 chiffres **et** le bouton : sur
iPhone, l'app de l'écran d'accueil ne reçoit pas les liens — on tape le
code. Parmi les alertes, **allumer** « Password changed », « Email address
changed », « Sign-in method linked » (Google relié à un compte existant),
« Verification method added » et « Verification method removed » (la
vérification en deux étapes) ; « Phone number changed » et « Sign-in method
removed » peuvent rester éteintes (l'app n'a ni téléphone ni de quoi
délier Google).

### Les réglages d'Authentication → Sign In / Providers → Email

D'après les captures du 2026-11-04, ce qu'il faut y mettre :

| Réglage | Valeur | Pourquoi |
|---|---|---|
| Enable email provider | ✅ | — |
| Confirm email | ✅ **à l'étape 6, pas avant** | le compte ne s'ouvre qu'avec le code reçu |
| Secure email change | ✅ (déjà) | un code à l'ancienne adresse aussi |
| Secure password change | ✅ **à allumer** | au-delà de 24 h de session, le code « Reauthentication » |
| Require current password when updating | ❌ laisser éteint | l'app ne le demande pas : le code le remplace |
| Prevent use of leaked passwords | ❌ (offre Pro) | — |
| Minimum password length | **10** (aujourd'hui 6) | l'app en demande 10 (`PWMIN`) ; la base doit refuser pareil |
| Password requirements | « Lowercase, uppercase letters and digits » ou rien | rien de plus dans l'app ; la longueur compte plus |
| Email OTP expiration | `3600` (déjà) | les e-mails disent « une heure » |
| Email OTP length | `8` (déjà) | l'app attend 8 chiffres (`CODE_EMAIL`) |

Et **Authentication → Multi-Factor** : « TOTP (App Authenticator) »
**Enabled** (c'est le réglage par défaut ; « Phone » reste coupé).

**URL Configuration** : *Site URL* `https://mirandola.fr`, et dans
*Redirect URLs* `https://mirandola.fr/**` (les liens des e-mails y
reviennent). Les modèles se refont par `node tools/courriels-auth.js` (la mise
en page est celle de `supabase/functions/_shared/courriels.js`, la même que
les e-mails de `prevenir`).

## 6. Essayer, PUIS rallumer la confirmation (10 minutes)

Dans cet ordre : tant que « Confirm email » est coupé, une inscription
n'envoie rien ; le mot de passe oublié, si.

1. **Le premier e-mail** : `https://mirandola.fr/connexion` → « Mot de passe
   oublié » avec l'adresse de ton propre compte. En moins d'une minute :
   l'e-mail « Ton nouveau mot de passe Mirandola », expéditeur
   `Mirandola <noreply@mirandola.fr>`, dans la boîte de réception. Son
   bouton ouvre « Choisis un nouveau mot de passe ».
2. **Sa signature** : dans Gmail, ⋮ → **Afficher l'original** : il faut lire
   `DKIM : 'PASS' avec le domaine mirandola.fr` et `DMARC : 'PASS'` (le SPF
   est celui de Brevo : PASS aussi).
3. **Sa note** (facultatif, le plus parlant) : sur mail-tester.com, copier
   l'adresse affichée ; créer un compte Mirandola avec cette adresse (rien
   ne part encore), puis « Mot de passe oublié » avec elle ; revenir sur
   mail-tester → **Vérifier votre score** : viser 9/10 ou plus. Ce compte
   d'essai se supprime ensuite (Claude peut le faire en base).
4. **Brevo** → menu **Transactionnel** → **Logs** : chaque envoi y est, avec
   son état (« Délivré »). C'est là qu'on regarde si un e-mail n'arrive pas.
5. **Rallumer la confirmation** : Supabase → **Authentication → Sign In /
   Providers → Email** → cocher **Confirm email** → **Save**.
6. **L'inscription pour de vrai** : créer un compte avec une adresse neuve
   (une variante Gmail fait l'affaire : `ton.adresse+essai1@gmail.com`
   arrive dans ta boîte) → l'écran « Vérifie ta boîte mail. » → l'e-mail
   « Confirme ton adresse e-mail pour Mirandola » arrive avec son code à 8
   chiffres → le taper (au téléphone, le clavier le propose seul) : le
   compte s'ouvre. Puis essayer une adresse qui n'existe pas : rien
   n'arrive, le compte ne s'ouvre jamais, et il part tout seul au bout de 7
   jours (`purge-comptes-non-confirmes`).
7. **Le reste, en deux minutes** : « Recevoir un code » sur l'écran de
   connexion (e-mail « Ton code de connexion ») ; Réglages → Sécurité du
   compte → Vérification en deux étapes → « Activer », lire le QR code avec
   l'app Mots de passe de l'iPhone, Google Authenticator ou 1Password, taper
   son code (e-mail d'alerte « Vérification en deux étapes ajoutée ») ; se
   déconnecter, se reconnecter : le code de l'application est demandé une
   fois ; Sécurité du compte → Mot de passe (e-mail « Mot de passe
   modifié »).

Les comptes Google, ceux qu'ouvrent l'éditeur et le référent (mot de passe
provisoire) et les élèves entrés avec un code ne sont pas concernés : ils
n'attendent aucun e-mail.

## 7. L'alerte d'une demande de démo (2 minutes)

La fonction `prevenir` (2026-11-02) est appelée par la base à chaque
« Demander une démo » (déclencheur `prevenir_demande`, migration
`20261102191527`) : l'alerte à `ALERTE_EMAIL` (établissement, contact,
fonction, e-mail, téléphone, nombre d'élèves, message, un bouton vers la
console ; « Répondre » écrit au contact) et l'accusé de réception au
demandeur (« Répondre » écrit à `ALERTE_EMAIL`). Une demande ne prévient
qu'une fois (`org_suivi.prevenu_le`).

Supabase → **Edge Functions → Secrets** → **Add new secret** :

| Secret | Valeur |
|---|---|
| `BREVO_API_KEY` | la clé API `xkeysib-…` (§ 4, pas la clé SMTP) |
| `ALERTE_EMAIL` | `contact@mirandola.fr` |

(`EXPEDITEUR` est facultatif : `noreply@mirandola.fr` par défaut.) Sans
ces deux secrets, la fonction ne fait rien et la demande reste dans la
console, comme avant.

Essai : `https://mirandola.fr/demande-demo`, avec en contact une variante
de ton Gmail (`ton.adresse+demo@gmail.com`) → deux e-mails : « Demande de
démo : … » (par `contact@`) et « Votre demande de démo Mirandola Campus ».
Puis effacer l'établissement d'essai dans la console (Établissements → sa
fiche → effacer). Le journal de la fonction (Supabase → Edge Functions →
`prevenir` → Logs) dit `prevenir <id> alerte accusé`.

## 8. Répondre sous `contact@mirandola.fr` depuis Gmail (facultatif)

Gmail → ⚙ → **Voir tous les paramètres** → **Comptes et importation** →
**Envoyer des e-mails en tant que** → **Ajouter une autre adresse** : nom
`Mirandola`, adresse `contact@mirandola.fr` → serveur SMTP
`smtp-relay.brevo.com`, port `587`, l'identifiant SMTP de Brevo, une clé SMTP
(en générer une seconde, « Gmail »), TLS → Gmail envoie un code à
`contact@mirandola.fr`, qui revient dans Gmail par la redirection → le
saisir. Ensuite, « De : » propose `contact@mirandola.fr` (signé DKIM
`mirandola.fr`, comme le reste). Ces envois comptent dans les 300 par jour.

## Plus tard

- DMARC : une fois que tout passe depuis quelques semaines (rapports dans
  Brevo), passer `p=none` à `p=quarantine` dans la zone d'OVH.
- Une vraie boîte (`contact@` lisible ailleurs que dans Gmail) : Zimbra
  Starter d'OVH (gratuit avec certains domaines) ou une offre payante ; les
  redirections suffisent tant qu'on est seul.

## Ce qui est dans le dépôt

- `supabase/functions/prevenir/index.ts` et ses e-mails
  (`supabase/functions/_shared/courriels.js`, testés : `test/courriels.test.js`) ;
- `supabase/migrations/20261102191527_prevenir_des_demandes.sql` (pg_net, le
  déclencheur, `prevenu_le`) ;
- `supabase/courriels/*.html` (les modèles de Supabase Auth) et
  `tools/courriels-auth.js` qui les écrit.
