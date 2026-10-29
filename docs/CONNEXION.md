# Se connecter avec Google ou Apple

Écrit le 2026-10-29. **Le code est prêt** : sur l'écran de connexion, les
boutons « Continuer avec Google » et « Continuer avec Apple » apparaissent
**d'eux-mêmes** dès qu'un fournisseur est allumé dans Supabase (l'app lit
`GET /auth/v1/settings`), sans nouvelle version de l'app. Tant qu'aucun ne
l'est, rien ne change à l'écran.

Comment ça marche : le bouton envoie sur la page du fournisseur par
Supabase (`/auth/v1/authorize?provider=…`), qui renvoie à `…/app` avec la
session dans l'adresse ; l'app l'ouvre au démarrage et retire aussitôt les
jetons de l'adresse (`core/connexion-externe.js`, `ui/liens-entrants.js`,
`ui/fournisseurs.js`). Un compte créé ainsi est un compte comme un autre :
Mirandola gratuit, son accueil, « J'ai un code », Mirandola+.

Le même retour sert désormais au lien **« Mot de passe oublié »** de
l'e-mail : avant le 2026-10-29, il ramenait à l'écran de connexion sans rien
ouvrir ; il mène maintenant à « Choisis un nouveau mot de passe ».

---

## 0. Une fois pour toutes, dans Supabase

Authentication → **URL Configuration** (voir `supabase/REGLAGES.md`) :

| Réglage | Valeur |
|---|---|
| Site URL | `https://mirandola.fr` |
| Redirect URLs | `https://mirandola.fr/**`, `https://www.folioflashcard.online/**` (l'ancien domaine, tant qu'il sert) |

L'adresse de retour est celle **de l'app où l'on a touché le bouton** (son
origine) : une app installée sur l'ancien domaine y retrouve sa session.

L'adresse de rappel à donner à Google et à Apple, la même pour les deux :

```
https://qqbzefpdeinlynjtarqr.supabase.co/auth/v1/callback
```

---

## 1. Google (gratuit, 20 minutes)

1. **console.cloud.google.com** → crée un projet « Mirandola ».
2. **API et services → Écran de consentement OAuth** : type **Externe** ;
   nom de l'application « Mirandola », e-mail d'assistance, logo
   (`public/site/icone.svg` exporté en PNG 120 × 120) ; **domaines
   autorisés** : `mirandola.fr` et `supabase.co` ; liens vers les règles de
   confidentialité (`https://mirandola.fr/mentions/confidentialite`) et les
   conditions (`https://mirandola.fr/mentions/cgu`) ; champs d'application :
   `openid`, `email`, `profile` (rien d'autre : pas de vérification Google
   à demander). Puis **Publier l'application** (sinon seuls les testeurs
   listés peuvent se connecter).
3. **Identifiants → Créer des identifiants → ID client OAuth** → type
   **Application Web** :
   - Origines JavaScript autorisées : `https://mirandola.fr`
   - URI de redirection autorisés : `https://qqbzefpdeinlynjtarqr.supabase.co/auth/v1/callback`
   Note l'**ID client** et le **code secret**.
4. Supabase → **Authentication → Sign In / Providers → Google** : active-le,
   colle l'ID client et le code secret, enregistre.
5. Recharge l'écran de connexion de Mirandola : « Continuer avec Google »
   est là.

## 2. Apple (99 $ par an, l'Apple Developer Program)

Sans compte développeur Apple payant, pas de « Se connecter avec Apple ».

1. **developer.apple.com → Certificates, Identifiers & Profiles →
   Identifiers → +** → **App IDs** → `fr.mirandola.app`, coche **Sign in with
   Apple**.
2. **Identifiers → + → Services IDs** → `fr.mirandola.web` (c'est
   l'identifiant que Supabase appelle « Client ID ») → coche **Sign in with
   Apple** → **Configure** : Primary App ID `fr.mirandola.app` ; **Domains
   and Subdomains** : `mirandola.fr`, `qqbzefpdeinlynjtarqr.supabase.co` ;
   **Return URLs** : `https://qqbzefpdeinlynjtarqr.supabase.co/auth/v1/callback`.
3. **Keys → +** → coche **Sign in with Apple** (rattachée à
   `fr.mirandola.app`) → télécharge le fichier `.p8` (**une seule fois** :
   range-le en lieu sûr, jamais dans le dépôt) ; note le **Key ID** et ton
   **Team ID** (en haut à droite du compte).
4. Fabrique le **secret** que demande Supabase (un jeton signé avec la clé
   `.p8`) : la page Apple de la documentation Supabase (Auth → Social Login
   → Apple) a l'outil qui le fait à partir du Team ID, du Key ID, du
   Services ID et du `.p8`. **Il expire au bout de six mois au plus** : mets
   un rappel pour le refaire, sinon la connexion Apple s'arrête net.
5. Supabase → **Providers → Apple** : active-le ; Client IDs :
   `fr.mirandola.web` ; Secret Key : le jeton de l'étape 4 ; enregistre.
6. Apple peut donner une adresse relais (`…@privaterelay.appleid.com`) à qui
   choisit de masquer la sienne. Pour que les e-mails de Mirandola (mot de
   passe, reçus) lui parviennent : **Services → Sign in with Apple for Email
   Communication** → ajoute le domaine d'envoi et l'adresse d'expédition de
   Supabase (voir `supabase/REGLAGES.md`, Authentication → Emails).

---

## 3. À vérifier sur de vrais téléphones, une fois allumés

- **Android** (Mirandola posé sur l'écran d'accueil) : la page de Google
  s'ouvre dans un onglet de Chrome par-dessus l'app ; le retour y ouvre la
  session, que l'app installée retrouve (le même stockage que Chrome).
- **iPhone** (l'app posée sur l'écran d'accueil) : une page d'une autre
  adresse s'ouvre dans une fenêtre de Safari par-dessus l'app, dont le
  stockage n'est pas celui de l'app installée. **À essayer en premier** : si
  le retour reste dans cette fenêtre au lieu de rouvrir l'app connectée, je
  passe au flux par code (PKCE, la session échangée par l'app elle-même au
  retour) — dis-le-moi et c'est la prochaine étape.
- Dans le navigateur d'un ordinateur : rien de particulier.
- Un élève de moins de 15 ans : les conditions demandent 15 ans pour créer
  un compte seul ; la phrase sous les boutons le rappelle, comme la case du
  formulaire.
- Un compte d'établissement ou de professeur particulier ouvert par toi ou
  par un référent garde son adresse et son mot de passe : s'il « continue
  avec Google » sur la même adresse e-mail, Supabase relie les deux (même
  adresse vérifiée) — il retrouve le même compte.
