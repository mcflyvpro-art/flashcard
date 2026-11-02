# Les e-mails de Mirandola : envoyer, recevoir

Écrit le 2026-11-02. Ce qu'il faut : **vérifier l'adresse** de qui crée un
compte (aujourd'hui on peut s'inscrire avec une adresse qui n'existe pas :
« Confirm email » est coupé dans Supabase depuis le 2026-10-29, faute de
serveur d'envoi), le **mot de passe oublié**, et **être prévenu** quand un
établissement demande une démo (aujourd'hui la demande n'apparaît que dans
la console de l'éditeur).

## Le choix : Brevo pour envoyer, OVH pour recevoir

- **Brevo** (brevo.com) : français, serveurs en Europe (RGPD), **gratuit
  jusqu'à 300 e-mails par jour**, sans carte bancaire. Il donne les deux
  portes dont on a besoin : un serveur SMTP (Supabase Auth s'y branche :
  confirmation de l'adresse, mot de passe oublié, changement d'adresse) et
  une API (la fonction `prevenir` : l'alerte d'une demande de démo, l'accusé
  de réception). Resend serait aussi simple, mais il est américain et
  plafonne à 100 par jour.
- **OVH** (où est le domaine `mirandola.fr` : ses serveurs de noms sont
  `dns103.ovh.net` et `ns103.ovh.net`) : on y pose les enregistrements DNS de
  Brevo, et ses **redirections e-mail gratuites** font arriver
  `contact@mirandola.fr` dans ta boîte Gmail.

300 par jour suffit largement au début : un lycée de 1 000 élèves qui
s'inscrit en une matinée, c'est le plafond de trois jours, mais les élèves
d'un établissement entrent avec un code (aucun e-mail) ; seuls les
particuliers et les professeurs en reçoivent un. Au-delà, l'offre
« Starter » de Brevo (environ 9 € par mois, 5 000 e-mails).

---

## 1. Brevo (15 minutes)

1. **brevo.com → S'inscrire**, au nom de l'entreprise (la SASU une fois
   déclarée ; ton nom en attendant, ça se change).
2. **Paramètres → Expéditeurs, domaines et IP dédiées → Domaines → Ajouter
   un domaine** : `mirandola.fr`, « Authentifier le domaine moi-même ».
   Brevo affiche 4 enregistrements à poser chez OVH (étape 2) : un TXT
   `brevo-code:…`, deux CNAME `brevo1._domainkey` et `brevo2._domainkey`
   (DKIM), un TXT `_dmarc`. Garde la page ouverte.
3. **Expéditeurs → Ajouter un expéditeur** : `noreply@mirandola.fr`, nom
   « Mirandola ».
4. **SMTP et API → onglet SMTP → Générer une nouvelle clé SMTP** : note le
   serveur (`smtp-relay.brevo.com`, port `587`), l'**identifiant** (de la
   forme `…@smtp-brevo.com`) et la **clé SMTP**. Pour Supabase Auth.
5. **SMTP et API → onglet Clés API → Générer une nouvelle clé API** (nom
   « Supabase ») : une clé `xkeysib-…`. Pour la fonction `prevenir`.
6. **Sécurité → IP autorisées** : désactive le blocage des IP inconnues
   (les fonctions de Supabase n'ont pas d'adresse fixe ; sinon Brevo refuse
   leurs envois et t'écrit « adresse IP non reconnue »).

Ces clés ne vont **jamais** dans le dépôt ni dans une conversation : elles
se collent directement dans Supabase (étapes 3 et 5).

## 2. OVH : le DNS de mirandola.fr (10 minutes, puis jusqu'à une heure de propagation)

1. **ovh.com → Web Cloud → Noms de domaine → mirandola.fr → Zone DNS →
   Ajouter une entrée**, pour chacun des 4 enregistrements de Brevo :
   - TXT : sous-domaine vide (la racine), valeur `brevo-code:…` ;
   - CNAME : sous-domaine `brevo1._domainkey`, cible donnée par Brevo ;
   - CNAME : sous-domaine `brevo2._domainkey`, cible donnée par Brevo ;
   - TXT : sous-domaine `_dmarc`, valeur donnée par Brevo
     (`v=DMARC1; p=none; rua=mailto:…`).

   Ne touche ni aux enregistrements `A`/`CNAME` du site (ceux de Vercel), ni
   aux `MX` d'OVH (ils servent à recevoir).
2. Reviens dans Brevo → **Authentifier**. Tant que ce n'est pas vert,
   attends (jusqu'à une heure) et réessaie. Sans cette étape, les e-mails
   partent… dans les indésirables.
3. **Recevoir** (facultatif, gratuit) : **Web Cloud → Emails →
   mirandola.fr → Redirections → Ajouter une redirection** :
   `contact@mirandola.fr` → ton adresse Gmail (garde « copie locale » coupée).
   Fais de même pour `noreply@mirandola.fr` si tu veux voir les réponses
   des étourdis. Si OVH demande d'activer l'offre e-mail du domaine (MX
   Plan), c'est l'offre gratuite livrée avec le nom de domaine.

## 3. Supabase Auth : la confirmation de l'adresse (5 minutes)

Projet `qqbzefpdeinlynjtarqr` :

1. **Authentication → Emails → SMTP Settings → Enable Custom SMTP** :
   - Sender email `noreply@mirandola.fr`, sender name `Mirandola` ;
   - Host `smtp-relay.brevo.com`, port `587` ;
   - Username : l'identifiant SMTP de Brevo, Password : la clé SMTP ;
   - Minimum interval : 60 secondes (défaut). Enregistrer.
2. **Authentication → Emails → Templates** : pour chaque modèle, l'objet et
   le corps des fichiers de `supabase/courriels/` (l'objet est écrit en tête
   de chaque fichier, en commentaire ; le reste se colle tel quel) :

   | Modèle Supabase | Fichier |
   |---|---|
   | Confirm sign up | `confirmation.html` |
   | Reset password | `mot-de-passe.html` |
   | Change email address | `changement-adresse.html` |
   | Magic link | `lien-magique.html` |
   | Invite user | `invitation.html` |
   | Reauthentication | `code-verification.html` |

   Ils se refont par `node tools/courriels-auth.js` (la même mise en page
   que les e-mails de la fonction `prevenir`).
3. **Authentication → Rate Limits → Rate limit for sending emails** : 100
   par heure (un SMTP neuf démarre à 30).
4. **Envoie-toi un essai** : crée un compte sur `https://mirandola.fr/inscription`
   avec une de tes adresses, **avant** l'étape 5 ; puis « Mot de passe
   oublié » : l'e-mail doit arriver en moins d'une minute, hors des
   indésirables, et son lien ouvrir « Choisis un nouveau mot de passe ».
5. **Authentication → Sign In / Providers → Email → coche « Confirm
   email »**. Dès lors, un compte ne s'ouvre qu'une fois son adresse
   confirmée. L'app sait déjà tout dire : « Compte créé : ouvre le lien reçu
   par e-mail », « Renvoyer l'e-mail », le vrai motif d'un refus
   (docs/CONNEXION.md § 1). Les comptes Google, ceux qu'ouvrent l'éditeur
   et le référent, et les élèves entrés avec un code ne sont pas concernés.

## 4. Être prévenu d'une demande de démo (2 minutes)

La fonction `prevenir` (2026-11-02) est appelée par la base à chaque
« Demander une démo » (déclencheur `prevenir_demande`, migration
`20261102191527`) : elle t'envoie la demande (établissement, contact,
fonction, e-mail, téléphone, nombre d'élèves, message, un bouton vers la
console ; « Répondre » écrit au contact), et envoie au demandeur un accusé
de réception (« Nous revenons vers vous très vite », « Répondre » t'écrit).

Supabase → **Edge Functions → Secrets** :

| Secret | Valeur |
|---|---|
| `BREVO_API_KEY` | la clé API `xkeysib-…` (Brevo, étape 5) |
| `ALERTE_EMAIL` | l'adresse où tu veux recevoir les demandes |
| `EXPEDITEUR` | facultatif, `noreply@mirandola.fr` par défaut |

Sans `BREVO_API_KEY` ou `ALERTE_EMAIL`, la fonction ne fait rien : la
demande reste dans la console, comme avant. Essai : une demande sur
`https://mirandola.fr/demande-demo` avec une de tes adresses en contact.
Chaque demande ne prévient qu'une fois (`org_suivi.prevenu_le`).

## Ce qui est dans le dépôt

- `supabase/functions/prevenir/index.ts` et ses e-mails
  (`supabase/functions/_shared/courriels.js`, testés : `test/courriels.test.js`) ;
- `supabase/migrations/20261102191527_prevenir_des_demandes.sql` (pg_net, le
  déclencheur, `prevenu_le`) ;
- `supabase/courriels/*.html` (les modèles de Supabase Auth) et
  `tools/courriels-auth.js` qui les écrit.
