# Se connecter : l'e-mail et Google

Écrit le 2026-10-29. Deux portes : **l'adresse e-mail et un mot de passe**, et
**« Continuer avec Google »**. Apple a été écarté le même jour (décidé : Google
et l'e-mail suffisent) ; même allumé dans Supabase, il n'aurait pas de bouton
(`ui/fournisseurs.js` ne nomme que Google).

Comment ça marche : le bouton Google envoie sur la page de Google par
Supabase (`/auth/v1/authorize?provider=google`), qui renvoie à `…/app` avec la
session dans l'adresse ; l'app l'ouvre au démarrage et retire aussitôt les
jetons de l'adresse (`core/connexion-externe.js`, `ui/liens-entrants.js`,
`ui/fournisseurs.js`). Le bouton n'apparaît que si Google est allumé dans
Supabase (l'app lit `GET /auth/v1/settings`), sans nouvelle version de l'app.
Un compte créé ainsi est un compte comme un autre : Mirandola gratuit, son
accueil, « J'ai un code », Mirandola+.

Le même retour sert aux liens des e-mails : **confirmer son adresse** et
**« Mot de passe oublié »** (qui mène à « Choisis un nouveau mot de passe »).

---

## 0. Une fois pour toutes, dans Supabase

Authentication → **URL Configuration** (voir `supabase/REGLAGES.md`) :

| Réglage | Valeur |
|---|---|
| Site URL | `https://mirandola.fr` |
| Redirect URLs | `https://mirandola.fr/**`, `https://www.folioflashcard.online/**` (l'ancien domaine, tant qu'il sert) |

---

## 1. L'inscription par e-mail : un serveur d'envoi à soi (SMTP)

**Le constat du 2026-10-29** : créer un compte avec une adresse et un mot de
passe « ne faisait rien ». Les journaux d'authentification disaient pourquoi :

- `429 email rate limit exceeded` : chaque inscription envoie un e-mail de
  confirmation, et **le service d'e-mails intégré de Supabase n'en envoie que
  2 par heure, et seulement aux adresses des membres de l'équipe du projet**
  (il n'est pas fait pour la production) ; au-delà, l'inscription est refusée ;
- `400 Email not confirmed` : les comptes créés attendaient un lien qui
  n'arrivait pas, et la connexion était refusée.

Google marchait : il ne demande aucun e-mail. Le « mot de passe oublié »
souffre du même mal, pour tout le monde.

Côté app (corrigé le même jour) : l'écran disait seulement « Inscription
impossible » ; il dit maintenant le vrai motif (`src/connexion-erreurs.js`,
`ui/connexion-refus.js`), propose **« Renvoyer l'e-mail »** quand l'adresse
attend sa confirmation (`core/confirmation.js`), et le message « Compte créé : ouvre le lien reçu par
e-mail » ne disparaît plus (il partait avec l'écran redessiné).

**Le remède, dans Supabase : un SMTP à soi.** Brevo (français, serveurs en
Europe, 300 e-mails par jour gratuits) ; Resend ou Postmark conviennent aussi.

1. **brevo.com** → crée un compte gratuit.
2. **Expéditeurs, domaines et IP dédiées → Domaines → Ajouter un domaine** :
   `mirandola.fr`. Brevo donne des enregistrements DNS (code Brevo, DKIM,
   DMARC) : ajoute-les là où se gère le DNS de `mirandola.fr` (Vercel →
   Domains, si ses serveurs de noms sont ceux de Vercel ; sinon chez le
   registraire), puis « Authentifier ». Sans eux, les e-mails finissent dans
   les indésirables.
3. **Expéditeurs → Ajouter** : `noreply@mirandola.fr`, nom « Mirandola ».
4. **SMTP et API → SMTP → Générer une nouvelle clé SMTP**. Note le serveur
   (`smtp-relay.brevo.com`, port `587`), l'identifiant de connexion et la clé
   (le mot de passe). Ne les mets jamais dans le dépôt.
5. Supabase → **Authentication → Emails → SMTP Settings** → active **Custom
   SMTP** : expéditeur `noreply@mirandola.fr`, nom `Mirandola`, hôte
   `smtp-relay.brevo.com`, port `587`, identifiant et clé de l'étape 4 →
   enregistrer.
6. Supabase → **Authentication → Rate Limits** : un SMTP neuf démarre à 30
   e-mails par heure ; monte « emails sent » à **100 par heure** au moins
   (une classe entière qui s'inscrit le même matin).
7. Supabase → **Authentication → Emails → Templates** : objet et texte en
   français, qui disent « Mirandola » (« Confirme ton adresse », « Choisis un
   nouveau mot de passe »), sans publicité ni image (les filtres anti-spam).

**Pour débloquer tout de suite, en attendant** : Authentication → Sign In /
Providers → **Email → décocher « Confirm email »**. Un compte s'ouvre alors dès
l'inscription, sans e-mail. Mais n'importe qui peut s'inscrire avec l'adresse
d'un autre, et le « mot de passe oublié » reste bloqué : **à réactiver dès que
le SMTP marche.** Les comptes déjà créés sans confirmation restent à confirmer
(Claude peut les confirmer en base, à la demande : `email_confirmed_at` de
`auth.users`).

**État au 2026-10-29 (décidé)** : « Confirm email » est **coupé** dans le
projet — tout le monde ouvre un compte dès l'inscription, adresse réelle ou
non ; le SMTP Brevo viendra plus tard. Les 3 comptes créés avant, restés sans
confirmation, **ne sont pas confirmés** : on n'y touche pas.

Les comptes ouverts par l'éditeur ou un référent (mot de passe provisoire)
sont confirmés d'office : ils n'attendent aucun e-mail.

---

## 2. Google (gratuit, 20 minutes) — en place depuis le 2026-10-29

L'adresse de rappel à donner à Google :

```
https://qqbzefpdeinlynjtarqr.supabase.co/auth/v1/callback
```

1. **console.cloud.google.com** → projet « Mirandola ».
2. **Google Auth Platform → Commencer** : nom « Mirandola », e-mail
   d'assistance ; cible **Externe** ; coordonnées.
3. **Branding** : page d'accueil `https://mirandola.fr`, confidentialité
   `https://mirandola.fr/mentions/confidentialite`, conditions
   `https://mirandola.fr/mentions/cgu` ; domaines autorisés `mirandola.fr` et
   `qqbzefpdeinlynjtarqr.supabase.co`. **Pas de logo** : il déclenche une
   vérification de la marque (plusieurs jours). Rien dans « Accès aux
   données » : l'e-mail et le profil sont donnés d'office, et ces accès non
   sensibles n'ont ni plafond d'utilisateurs ni vérification.
4. **Clients → Créer un client** → « Application Web » : origine
   `https://mirandola.fr`, URI de redirection celle ci-dessus. Copie l'ID
   client et le code secret aussitôt (Google ne remontre plus le secret).
5. **Audience → Publier l'application** (« En production »).
6. Supabase → **Authentication → Sign In / Providers → Google** : active-le,
   colle l'ID client et le code secret.

---

## 3. À vérifier sur de vrais téléphones

- **Android** (Mirandola posé sur l'écran d'accueil) : la page de Google
  s'ouvre dans un onglet de Chrome par-dessus l'app ; le retour y ouvre la
  session, que l'app installée retrouve (le même stockage que Chrome).
- **iPhone** (l'app posée sur l'écran d'accueil) : une page d'une autre
  adresse s'ouvre dans une fenêtre de Safari par-dessus l'app, dont le
  stockage n'est pas celui de l'app installée. **À essayer en premier** : si
  le retour reste dans cette fenêtre au lieu de rouvrir l'app connectée, on
  passe au flux par code (PKCE, la session échangée par l'app elle-même au
  retour). Le lien de confirmation d'un e-mail a la même question.
- Dans le navigateur d'un ordinateur : rien de particulier.
- Un élève de moins de 15 ans : les conditions demandent 15 ans pour créer
  un compte seul ; la phrase sous le bouton le rappelle, comme la case du
  formulaire.
- Un compte d'établissement ou de professeur particulier ouvert par l'éditeur
  ou un référent garde son adresse et son mot de passe : s'il « continue avec
  Google » sur la même adresse e-mail, Supabase relie les deux (même adresse
  vérifiée) — il retrouve le même compte.
