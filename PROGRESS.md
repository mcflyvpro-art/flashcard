# PROGRESS — Folio

<!-- PROTOCOLE (Claude, lis ceci avant tout) :
     · état courant      : sed -n '1,24p' PROGRESS.md
     · une mission       : grep -A20 '^## M07' PROGRESS.md
     · ce qui reste en P0: grep -n '^- \[ \].*\[P0\]' PROGRESS.md
     Mise à jour = changer [ ] en [x] sur la ligne + réécrire le bloc ÉTAT.
     Ne JAMAIS relire le fichier entier : il est fait pour être grepé.

     Décidé le 2026-09-18 : quand l'utilisateur tape /goal sans rien
     préciser, c'est le signal « reprends ». Aller voir CURSEUR ci-dessous,
     faire UNE seule tâche (celle-là, pas la suite de la mission), la
     cocher avec sa preuve une fois vraiment verte, mettre à jour ÉTAT,
     puis s'arrêter et attendre — jamais enchaîner sur la tâche suivante
     sans un nouveau /goal. -->

## ÉTAT
```
CURSEUR   M06.T3 (découpe d'app.js) — M01 fini, ordre P0 décidé le 2026-09-18, voir ORDRE
PHASE     P0 — lancement B2C
FAIT      19 / 148
DERNIER   2026-09-18 · M01.T5 : couverture du noyau (fsrs.js, fusion.js, file.js,
          parseur.js) mesurée avec `@vitest/coverage-v8` (devDependency ajoutée) —
          `npx vitest run --coverage` → 100 % lignes (327/327), 98,8 % instructions,
          100 % fonctions sur les 4 modules purs (cible : ≥ 90 % lignes). Le seul
          vrai trou trouvé était réel : FSRS-7 (34 paramètres, `f7*`) n'était
          exercé par aucun test — code mort en pratique (Anki et donc l'app
          n'utilisent que W6), mais dans le noyau et jamais vérifié ; désormais
          couvert par les mêmes propriétés que FSRS-6 dans test/fsrs.test.js.
          `mergeCard` avait aussi un angle mort sur les champs inconnus (ni
          contenu ni mémoire) : ajouté à test/fusion.test.js. Suite complète
          `npm test` → 134/134 ; `npm run build` ok. M01 est fini (5/5).
ORDRE P0  M01 → M06 → M04 → M05 → M07 → M09 → M08 → M10 → M11 → M13 → M12
          (noyau pur d'abord, découpe d'app.js tôt pour ne pas la laisser grossir ·
          intégrité + observabilité avant paiement · M07 avant M09, sa preuve est un
          test Playwright · paiement en dernier, sécurité/légal/infra déjà posés)
BLOQUÉ    M03.T3 (case) et M03.T7 (retrait JSONB `decks.cards`) : en suspens jusqu'au
          2026-09-25, fin des 7 j d'observation (tâche `folio-m03t3-audit-7j`). Alors :
          relire `card_sync_audit`, cocher M03.T3 si 0 écart, puis faire M03.T7. Ne
          bloque pas le reste du projet.
DETTE     M06.T7 profCartesDeDevoir (CI rouge, volontaire) — dans le lot M06
```

Légende : `[ ]` à faire · `[~]` en cours · `[x]` fait et prouvé.
Une tâche n'est cochée que si sa **preuve** tourne au vert. Pas d'exception.

---

# P0 · Stabilité et lancement B2C

But de phase : **zéro perte de données démontrée**, zéro erreur console sur les
parcours principaux, et une app vendable à un particulier.
Sortie de phase : les 13 missions P0 à 100 %.

## M01 · Noyau testable [P0] 5/5 ✅
But : toutes les règles métier dans du code pur, testé, sans DOM ni réseau.
- [x] M01.T1 · extraire le moteur FSRS dans `src/core/` — cible: 0 accès DOM/réseau — preuve: `grep -cE 'document|fetch|localStorage' src/fsrs.js` = 0
- [x] M01.T2 · tests du moteur — cible: ≥ 14 tests, ordre des 4 boutons garanti — preuve: `npm test`
- [x] M01.T3 · extraire la file de révision (sélection, mélange, quotas) — cible: fonction pure, 20 tests — preuve: `npm test -- file` → 27/27 (`grep -cE 'document|fetch|localStorage' src/file.js` = 0)
- [x] M01.T4 · extraire le parseur de cartes (collage, Quizlet, CSV) — cible: 25 cas, 0 crash sur entrée malformée — preuve: `npm test -- parseur` → 54/54 (dont 25 cas malformés dédiés) ; `grep -cE 'document|fetch|localStorage' src/parseur.js` = 0 ; vérifié aussi dans le navigateur (Playwright)
- [x] M01.T5 · couverture du noyau — cible: ≥ 90 % lignes sur `src/core/` — preuve: `npx vitest run --coverage` → 100 % lignes (327/327) sur fsrs.js/fusion.js/file.js/parseur.js

## M02 · Écritures qui ne se perdent jamais [P0] 4/4 ✅
- [x] M02.T1 · file d'attente durable pour révisions et séances — preuve: `grep -c enqueue src/app.js` ≥ 3
- [x] M02.T2 · idempotence (client_id + merge-duplicates) — preuve: migration `20260917200000`
- [x] M02.T3 · `rating` nullable (mode simple n'écrivait rien depuis le J1) — preuve: advisor + insert test
- [x] M02.T4 · triage des erreurs 4xx/5xx dans la file — cible: une ligne refusée ne bloque pas les suivantes — preuve: revue `flushOutbox`

## M03 · Synchronisation par carte [P0] 4/7 ⬅ EN COURS
But : deux appareils travaillent sur le même paquet sans conflit ni perte.
Cible globale : **0 perte et 0 conflit visible sur 10 000 opérations concurrentes simulées.**
- [x] M03.T1 · table `cards` (une ligne par carte) + `usn` par objet — preuve: migrations `20260917220000`/`20260917221000`/`20260917221500` + `list_tables` (`public.cards`, `public.sync_counters`, `decks.usn`) ; test en transaction annulée : deux insertions puis une modification sur le même compte donnent usn = 1, 2, 3
- [x] M03.T2 · `revlog` ajoutable, l'état de carte s'en recalcule — cible: recalcul de 10 000 révisions < 500 ms — preuve: `npm test -- revlog` → 8/8, recalcul en 6 ms ; rejeu (`fsrsReplayCard`/`fsrsReplayAll`) extrait d'`app.js` vers `src/fsrs.js`, pur (`grep -cE 'document|fetch|localStorage' src/fsrs.js` = 0) ; suite complète `npm test` → 22/22
- [~] M03.T3 · double écriture (ancien champ JSONB + nouvelles tables) — cible: 100 % des écritures dans les deux, 7 jours — preuve: `card_sync_audit`, 0 écart chaque jour du 2026-09-18 au 2026-09-25.
      Déployé 2026-09-18 : migration `20260918090000` (fonction `sync_deck_cards`, amorce de toute la bibliothèque existante), `flush()` appelle la fonction juste après `pushDeck` et ne retire le paquet de `dirty` que si les deux écritures réussissent (src/app.js). Garde RLS testée en usurpant un autre compte → refusée (42501) sans rien écrire.
      Une comparaison ponctuelle ne prouve rien sur 7 jours : migration `20260918100000` pose une tâche `pg_cron` quotidienne (`audit-double-ecriture-cards-quotidien`, 4 h 03) qui journalise le résultat dans `card_sync_audit` (détail : `supabase/REGLAGES.md`). Premier relevé 2026-09-18 : 974/974, 0 écart. **Reste à faire avant de cocher : `select * from card_sync_audit order by checked_at;` le 2026-09-25, confirmer 0 écart sur les sept jours.**
- [x] M03.T4 · fusion à trois versions (base commune, locale, distante) — cible: 0 boîte de dialogue de conflit sur le jeu de tests — preuve: `npm test -- fusion` → 18/18 (dont 200 scénarios synthétiques, 0 exception, résultat déterministe) ; `src/fusion.js`, pur (`grep -cE 'document|fetch|localStorage'` = 0) ; suite complète `npm test` → 40/40
- [x] M03.T5 · simulateur de concurrence (2 appareils, hors ligne, reconnexion) — cible: 10 000 opérations, 0 divergence — preuve: `npm test -- concurrence` → 1/1 ; sur la même graine, 2381 reconnexions désordonnées, 340 conflits tranchés sans dialogue, 20 points de calme sans écart entre A, B et le serveur, point fixe atteint à la fin (une reconnexion de plus ne change plus rien) ; suite complète `npm test` → 41/41 ; `test/concurrence.test.js`, appuyé uniquement sur `mergeDeck` (`src/fusion.js`, M03.T4), aucune règle métier réécrite
- [x] M03.T6 · bascule des lectures sur les nouvelles tables — cible: temps de `pull()` < 800 ms pour 5 000 cartes — preuve: mesure journalisée — `pull()` lit désormais `cards` (M03.T1) par un `select` aliasé (`f:front`, `S:stability`...) qui rend au client les mêmes clés courtes qu'avant, sans conversion ; `decks` ne demande plus sa colonne `cards` (le JSONB reste écrit, M03.T3, en observation jusqu'au 2026-09-25, mais n'est plus lu ici). En vérifiant, trouvé un vrai bug avant toute mesure : PostgREST plafonne toute lecture à `db-max-rows` (1000 sur ce projet) et tronque au-delà **sans erreur** — un compte à plus de 1000 cartes aurait silencieusement perdu les suivantes. Corrigé par pagination (`apiPage`/`apiAll`, `src/app.js`) : première page avec `Range`+`Prefer: count=exact`, total lu dans `Content-Range`, pages suivantes en parallèle. Mesure : 5 000 cartes de test injectées sur `eleve@folio.app` (paquet temporaire, JSONB et `cards` mirroirs pour ne pas fausser l'audit M03.T3), 8 appels réels à `/rest/v1` (authentification comprise, comme fait l'app) : 468–597 ms, moyenne hors 1re connexion 483 ms — sous la cible de 800 ms. Nettoyage vérifié après coup : `decks` 32→32, `cards` 974→974. `npm run check` propre (41/41 tests, build ok) ; `get_advisors` (sécurité + performance) sans nouveau signalement.
- [~] M03.T7 · retrait du champ `cards` JSONB — preuve: migration + `npm test` — **différé au 2026-09-25** : attend la fin de l'observation de M03.T3 (voir BLOQUÉ en tête de fichier), pas de blocage du reste du projet d'ici là

## M04 · Intégrité de la bibliothèque [P0] 0/6
- [ ] M04.T1 · invariants de carte (S>0, 1≤D≤10, échéance future, état cohérent) — cible: 12 invariants — preuve: `npm test -- invariants`
- [ ] M04.T2 · écran « Vérifier ma bibliothèque » qui détecte et répare — cible: répare 8 familles d'anomalies — preuve: test sur base corrompue fabriquée
- [ ] M04.T3 · contrainte en base sur l'état de carte (CHECK) — cible: 0 ligne invalide acceptable — preuve: insert refusé
- [ ] M04.T4 · déduplication des cartes (même recto/verso) — cible: 0 doublon après passage — preuve: `npm test -- doublons`
- [ ] M04.T5 · corbeille et purge vérifiées de bout en bout — cible: 30 j exactement, tâche pg_cron active — preuve: `select * from cron.job`
- [ ] M04.T6 · export/import intégral de la bibliothèque — cible: export puis import = état identique au bit près — preuve: `npm test -- export`

## M05 · Observabilité [P0] 0/6
But : ne plus jamais deviner pourquoi ça plante.
- [ ] M05.T1 · Sentry branché (erreurs + rejets de promesse) — cible: 100 % des erreurs remontées, 0 donnée perso — preuve: erreur test visible dans Sentry
- [ ] M05.T2 · supprimer les `catch {}` muets — cible: 0 bloc vide sans commentaire (41 aujourd'hui) — preuve: `npx eslint .` 0 avertissement no-empty
- [ ] M05.T3 · journal des erreurs serveur consultable — cible: requête MCP `query_logs` documentée dans CLAUDE.md — preuve: la commande rend des lignes
- [ ] M05.T4 · mesure du démarrage (temps jusqu'à l'écran utile) — cible: p75 < 2 s en 4G simulée — preuve: Lighthouse
- [ ] M05.T5 · sonde externe + page d'état publique — cible: contrôle toutes les 5 min — preuve: URL publique
- [ ] M05.T6 · alerte si le taux d'erreur dépasse 1 % sur 1 h — preuve: alerte déclenchée en test

## M06 · Qualité du code [P0] 2/8
- [x] M06.T1 · build Vite + variables d'environnement — preuve: `npm run build`
- [x] M06.T2 · ESLint au dépôt + CI — preuve: `.github/workflows/ci.yml`
- [ ] M06.T3 · découpe `src/app.js` en modules — cible: **aucun fichier > 800 lignes** (9 795 aujourd'hui) — preuve: `awk 'END{print FILENAME, NR}'` sur chaque fichier
- [ ] M06.T4 · séparation core / data / ui — cible: `src/ui/` n'appelle jamais `api()` directement — preuve: `grep -rc "api(" src/ui/` = 0
- [ ] M06.T5 · 0 variable globale mutable partagée hors `src/data/etat.js` — preuve: revue + lint
- [ ] M06.T6 · ESLint strict (complexité ≤ 15, profondeur ≤ 4) — cible: 0 erreur, 0 avertissement — preuve: `npm run lint`
- [ ] M06.T7 · réparer « Redonner un devoir » (`profCartesDeDevoir`) — cible: CI verte — preuve: `npm run lint` + test bout-en-bout
- [ ] M06.T8 · TypeScript en vérification douce (`checkJs` + JSDoc) sur `src/core/` — cible: 0 erreur `tsc --noEmit` — preuve: la commande

## M07 · Tests bout-en-bout [P0] 0/7
- [ ] M07.T1 · Playwright installé, 1 parcours témoin — preuve: `npx playwright test`
- [ ] M07.T2 · parcours élève B2C: inscription → créer un livre → réviser 10 cartes → statistiques justes — cible: assertions sur les chiffres affichés — preuve: le test
- [ ] M07.T3 · parcours hors ligne: réviser sans réseau → reconnexion → 0 révision perdue — cible: 50 révisions, 50 retrouvées — preuve: le test
- [ ] M07.T4 · parcours deux appareils: édition croisée → 0 perte — preuve: le test
- [ ] M07.T5 · parcours quiz, association, QCM, vrai/faux — cible: 4 modes, score attendu exact — preuve: le test
- [ ] M07.T6 · captures de référence mobile (390 px) et bureau (1440 px) — cible: 12 écrans, 0 débordement horizontal — preuve: comparaison d'images
- [ ] M07.T7 · les tests tournent en CI — cible: < 5 min — preuve: durée du job

## M08 · PWA, performance, mobile [P0] 1/8
- [x] M08.T1 · service worker fabriqué au build (fini le numéro à la main) — preuve: `dist/sw.js`
- [ ] M08.T2 · budget de poids — cible: JS ≤ 120 Ko gzip, CSS ≤ 25 Ko (97 + 20 aujourd'hui) — preuve: `npm run build` + contrôle en CI
- [ ] M08.T3 · hors ligne complet — cible: 100 % des écrans consultables sans réseau — preuve: test Playwright en mode offline
- [ ] M08.T4 · mise à jour sans perdre la saisie en cours — cible: 0 rechargement pendant une révision — preuve: test
- [ ] M08.T5 · iOS installée: zones sûres, pas de rebond, clavier — cible: 0 défaut sur 6 contrôles — preuve: capture iPhone
- [ ] M08.T6 · Lighthouse — cible: PWA 100, Performance ≥ 90, Best practices ≥ 95 — preuve: rapport
- [ ] M08.T7 · fluidité des gestes (balayage) — cible: ≥ 55 im/s sur mobile d'entrée de gamme — preuve: trace navigateur
- [ ] M08.T8 · démarrage à froid — cible: écran utile < 1,5 s en 4G — preuve: Lighthouse

## M09 · Accessibilité (socle) [P0] 0/4
- [ ] M09.T1 · navigation clavier complète — cible: 100 % des actions atteignables — preuve: test Playwright clavier
- [ ] M09.T2 · contrastes — cible: 100 % du texte ≥ 4,5:1 — preuve: axe-core 0 violation
- [ ] M09.T3 · lecteur d'écran sur les 6 écrans principaux — cible: 0 élément sans nom accessible — preuve: axe-core
- [ ] M09.T4 · taille de cible tactile ≥ 44 px — cible: 0 bouton en dessous — preuve: test

## M10 · Sécurité [P0] 1/8
- [x] M10.T1 · `anon` ne peut plus appeler les fonctions d'administration — preuve: migration `20260917210000` + curl 400
- [ ] M10.T2 · revue des 100+ politiques RLS, une par une — cible: 0 avertissement Supabase — preuve: `get_advisors security`
- [ ] M10.T3 · chaque fonction `security definer` teste son appelant en première ligne — cible: 100 % — preuve: revue documentée
- [ ] M10.T4 · protection mots de passe compromis + longueur 10 — preuve: réglage Supabase actif
- [ ] M10.T5 · CSP en application réelle (plus en observation) — cible: 0 violation sur les parcours de test — preuve: console vide
- [ ] M10.T6 · limitation de débit sur inscription, connexion, IA — cible: 5 tentatives / 15 min — preuve: 6ᵉ tentative refusée
- [ ] M10.T7 · audit des jetons: expiration, rotation, déconnexion partout — preuve: test
- [ ] M10.T8 · revue de sécurité automatisée avant chaque livraison — preuve: `/security-review` en CI

## M11 · Conformité produit [P0] 0/6
- [ ] M11.T1 · mentions légales complètes (les ⟦crochets⟧ encore servis) — cible: 0 occurrence de ⟦ — preuve: `grep -c '⟦' src/app.js` = 0
- [ ] M11.T2 · CGU et CGV relues — preuve: fichier daté
- [ ] M11.T3 · export de mes données en 1 clic — cible: < 30 s, format lisible — preuve: test
- [ ] M11.T4 · suppression de compte effective — cible: 0 ligne restante après 24 h — preuve: requête SQL
- [ ] M11.T5 · registre des traitements + sous-traitants listés — preuve: document
- [ ] M11.T6 · bandeau cookies inutile car 0 traceur — cible: 0 cookie non essentiel — preuve: inspection

## M12 · Paiement B2C [P0] 0/5
- [ ] M12.T1 · Stripe en test: abonnement mensuel et annuel — preuve: paiement test abouti
- [ ] M12.T2 · limites du gratuit appliquées côté serveur — cible: contournement impossible depuis le client — preuve: test d'attaque
- [ ] M12.T3 · quotas IA par compte et par mois — cible: budget global jamais dépassé — preuve: simulation 100 comptes
- [ ] M12.T4 · webhooks Stripe idempotents — cible: 0 double facturation sur 100 rejeux — preuve: test
- [ ] M12.T5 · passage en clés réelles + première vente test — preuve: paiement réel remboursé

## M13 · Infrastructure de production [P0] 1/6
- [x] M13.T1 · CI lint + tests + build à chaque poussée — preuve: `.github/workflows/ci.yml`
- [ ] M13.T2 · Vercel Pro (le gratuit interdit l'usage commercial) + domaine — preuve: facture
- [ ] M13.T3 · Supabase Pro, région Paris (`eu-west-3`) — preuve: `get_project`
- [ ] M13.T4 · environnement de préproduction séparé — cible: 0 test sur la base de production — preuve: 2 projets distincts
- [ ] M13.T5 · restauration réellement testée — cible: base restaurée en < 30 min, procédure écrite — preuve: journal de l'exercice
- [ ] M13.T6 · migrations appliquées par la CI, jamais à la main — preuve: workflow

---

# P1 · B2B — pilote en établissement

But de phase : un lycée pilote utilise Folio une année entière sans incident.

## M14 · Modèle multi-établissement [P1] 0/5
- [ ] M14.T1 · entité établissement avec code UAI — cible: unicité garantie — preuve: contrainte
- [ ] M14.T2 · années scolaires et archivage — cible: passage d'année sans perte, 3 années conservées — preuve: test
- [ ] M14.T3 · cloisonnement strict entre établissements — cible: 0 fuite sur 50 tentatives croisées — preuve: `npm test -- cloisonnement`
- [ ] M14.T4 · quotas et licences par établissement — cible: dépassement bloqué côté serveur — preuve: test
- [ ] M14.T5 · tableau de bord d'occupation (élèves actifs, cartes, stockage) — preuve: écran

## M15 · Rôles et permissions [P1] 0/6
- [ ] M15.T1 · matrice écrite: 4 rôles × toutes les actions — cible: 100 % des cases décidées — preuve: tableau dans le dépôt
- [ ] M15.T2 · un test par case — cible: ≥ 120 tests de permission, 0 échec — preuve: `npm test -- permissions`
- [ ] M15.T3 · journal d'audit des actes sensibles — cible: 100 % tracés, consultables par le référent — preuve: test
- [ ] M15.T4 · prise d'identité pour le support, tracée — cible: impossible sans trace — preuve: test
- [ ] M15.T5 · un élève ne voit jamais les données d'un autre — cible: 0 fuite sur 50 tentatives — preuve: test
- [ ] M15.T6 · un prof ne voit que ses classes — cible: 0 fuite — preuve: test

## M16 · Espace professeur (ordinateur d'abord) [P1] 0/7
- [ ] M16.T1 · liste + détail côte à côte ≥ 1024 px, empilés en dessous — cible: 0 duplication de composant — preuve: revue
- [ ] M16.T2 · créer un devoir en ≤ 5 clics depuis un livre — preuve: test chronométré
- [ ] M16.T3 · suivi de classe: rendu, réussite, alertes — cible: chiffres égaux au SQL de référence — preuve: test
- [ ] M16.T4 · redonner un devoir (bug M06.T7) — preuve: test
- [ ] M16.T5 · calendrier et agenda des devoirs — cible: 0 décalage de fuseau — preuve: test sur 3 fuseaux
- [ ] M16.T6 · import d'un livre depuis Quizlet/Anki/CSV — cible: 4 formats, 95 % des cartes conservées — preuve: test
- [ ] M16.T7 · tout l'espace prof utilisable au clavier — preuve: test

## M17 · Espace élève scolaire (mobile d'abord) [P1] 0/5
- [ ] M17.T1 · devoirs du jour en page d'accueil — cible: ≤ 2 taps pour commencer — preuve: test
- [ ] M17.T2 · rendu d'un devoir hors ligne, remonté à la reconnexion — cible: 0 perte — preuve: test
- [ ] M17.T3 · séparation stricte livres perso / devoirs — cible: le prof ne voit rien du perso — preuve: test
- [ ] M17.T4 · rappels (notification) sans compte tiers — cible: 0 service externe — preuve: revue
- [ ] M17.T5 · parcours complet élève en < 3 min — preuve: test chronométré

## M18 · Espace référent / administration [P1] 0/6
- [ ] M18.T1 · import de comptes par fichier — cible: 1 000 élèves en < 60 s, rapport d'erreurs ligne à ligne — preuve: test
- [ ] M18.T2 · création de classes et affectation en masse — preuve: test
- [ ] M18.T3 · réinitialisation de mot de passe tracée — preuve: test
- [ ] M18.T4 · export des données de l'établissement — cible: < 5 min — preuve: test
- [ ] M18.T5 · suppression d'un élève et de toutes ses données — cible: 0 ligne restante — preuve: SQL
- [ ] M18.T6 · console d'état: incidents, quotas, dernières connexions — preuve: écran

## M19 · Classes, clubs, défis [P1] 0/6
- [ ] M19.T1 · scores recalculés côté serveur uniquement — cible: score forgé depuis le client = refusé — preuve: test d'attaque
- [ ] M19.T2 · classement cohérent — cible: 0 écart avec le SQL de référence sur 1 000 comptes — preuve: test
- [ ] M19.T3 · défi: départage, égalités, abandon — cible: 8 cas limites couverts — preuve: test
- [ ] M19.T4 · club: invitation, sortie, suppression — cible: 0 donnée orpheline — preuve: test
- [ ] M19.T5 · anti-triche: temps de réponse invraisemblables écartés — cible: détection > 95 % sur jeu fabriqué — preuve: test
- [ ] M19.T6 · étagère commune: retrait immédiat d'un livre signalé — cible: < 5 s — preuve: test

## M20 · Modération (données de mineurs) [P1] 0/4
- [ ] M20.T1 · signalement en 2 taps, copie jointe conservée — preuve: test
- [ ] M20.T2 · console de modération: délai de traitement affiché — cible: 100 % des signalements < 48 h — preuve: mesure
- [ ] M20.T3 · blocage réciproque effectif partout — cible: 0 contournement sur 20 chemins — preuve: test
- [ ] M20.T4 · purge des signalements clos à 12 mois — preuve: `cron.job`

## M21 · RGPD B2B [P1] 0/6
- [ ] M21.T1 · contrat de sous-traitance article 28 — preuve: document signable
- [ ] M21.T2 · AIPD rédigée (mineurs, grande échelle) — preuve: document
- [ ] M21.T3 · registre + liste des sous-traitants ultérieurs — preuve: document
- [ ] M21.T4 · IA en région européenne, ou désactivable par établissement — cible: 0 donnée élève hors UE — preuve: revue technique
- [ ] M21.T5 · DPA Supabase signé et archivé — preuve: document
- [ ] M21.T6 · dossier validé par un DPD d'académie — preuve: retour écrit

## M22 · Exploitation [P1] 0/5
- [ ] M22.T1 · disponibilité mesurée — cible: ≥ 99,5 % sur 90 jours glissants — preuve: sonde
- [ ] M22.T2 · temps de réponse API — cible: p95 < 400 ms — preuve: journaux
- [ ] M22.T3 · restauration testée chaque trimestre — preuve: journal daté
- [ ] M22.T4 · procédure d'incident écrite (qui, quoi, en combien de temps) — preuve: document
- [ ] M22.T5 · sauvegarde hors Supabase, chiffrée — cible: quotidienne, 30 jours — preuve: fichiers

---

# P2 · Échelle

## M23 · GAR et connexion par l'ENT [P2] 0/6
- [ ] M23.T1 · compte sans adresse e-mail (identité pseudonyme) — cible: tout le parcours élève fonctionne sans e-mail — preuve: test
- [ ] M23.T2 · SAML2 ou OpenID Connect — preuve: connexion réussie sur bac à sable
- [ ] M23.T3 · fiches ScoLOMFR publiées — preuve: moisson réussie
- [ ] M23.T4 · service web des abonnements (le GAR décide des droits) — preuve: test
- [ ] M23.T5 · contrat d'adhésion signé, opérateurs déclarés — preuve: accusé
- [ ] M23.T6 · tests de conformité RTFS passés — preuve: validation RENATER

## M24 · Accessibilité RGAA 4.1 [P2] 0/3
- [ ] M24.T1 · audit externe — cible: ≥ 75 % de conformité — preuve: rapport
- [ ] M24.T2 · corrections des non-conformités bloquantes — cible: 0 critère A en échec — preuve: contre-audit
- [ ] M24.T3 · déclaration d'accessibilité publiée — preuve: URL

## M25 · Montée en charge [P2] 0/5
- [ ] M25.T1 · index et plans de requête revus — cible: 0 séquentiel sur table > 100 k lignes — preuve: `explain`
- [ ] M25.T2 · pagination partout — cible: 0 requête sans limite — preuve: revue
- [ ] M25.T3 · test de charge — cible: 5 000 comptes simultanés, p95 < 800 ms — preuve: rapport k6
- [ ] M25.T4 · rentrée scolaire simulée — cible: 1 000 connexions/min tenues 10 min — preuve: rapport
- [ ] M25.T5 · coût par élève et par an mesuré — cible: < 0,50 € — preuve: facture rapportée aux comptes actifs

## M26 · Livraison et support [P2] 0/4
- [ ] M26.T1 · canal bêta (preview) avant chaque version — preuve: URL
- [ ] M26.T2 · journal des versions lisible par un prof — preuve: écran
- [ ] M26.T3 · page d'état publique — preuve: URL
- [ ] M26.T4 · délai de première réponse au support — cible: < 24 h ouvrées — preuve: mesure
