# Créer l'entreprise qui vend Mirandola

Ce document a été écrit le 6 novembre 2026 pour répondre à trois questions :

- quelle forme d'entreprise est la plus rentable pour démarrer ;
- ce qu'elle coûte, ligne par ligne ;
- dans quel ordre faire les démarches avant d'ouvrir la vente.

**Ce n'est pas un conseil juridique ni comptable.** Les chiffres viennent de
sources publiques recoupées, citées en bas. Les points marqués « à vérifier »
se tranchent au moment de l'immatriculation, avec le guichet unique de
l'INPI, l'URSSAF ou un expert-comptable. Une heure avec un expert-comptable,
entre 80 et 150 €, vaut la peine avant de signer quoi que ce soit.

---

## 1. La recommandation : micro-entreprise d'abord, SASU ensuite

### Démarrer en micro-entreprise

La micro-entreprise est une entreprise individuelle au régime micro. C'est la
forme la plus rentable tant que Mirandola fait moins de 30 000 à 40 000 € de
chiffre d'affaires par an.

- **Elle ne coûte rien à créer.** L'immatriculation au guichet unique
  (formalites.entreprises.gouv.fr) est gratuite.
- **Il n'y a ni comptable obligatoire, ni bilan.** On tient un livre des
  recettes et on déclare son chiffre d'affaires chaque mois ou chaque
  trimestre.
- **Les cotisations sont proportionnelles à l'encaissé.** Pas de chiffre
  d'affaires, pas de cotisations, et aucun forfait minimum.
- **La TVA ne s'applique pas** tant qu'on reste sous la franchise en base,
  soit 37 500 € de prestations de services par an (seuil majoré :
  41 250 €). Les prix affichés « TTC » (5,99 €, 44,99 €, 9,99 €, 79,99 €)
  restent donc entièrement à toi. Sur les factures, la mention à écrire est :
  « TVA non applicable, art. 293 B du CGI ». La console de l'éditeur le fait
  déjà quand le régime « franchise » est choisi dans l'onglet Entreprise.
- **Ton patrimoine personnel est protégé.** Depuis 2022, le patrimoine
  personnel d'un entrepreneur individuel est séparé de son patrimoine
  professionnel par défaut.

### L'activité à déclarer

- **Le code d'activité** : 58.29C, « édition de logiciels applicatifs »,
  vendus en abonnement.
- **Le régime social, à vérifier** au moment de la déclaration :
  - le plus probable est *BIC, prestations de services commerciales*, avec
    des cotisations de **21,2 %** du chiffre d'affaires en 2026 ;
  - si le guichet classe l'activité en libéral (*BNC*), le taux est de
    **25,6 %**.
- **La demande à faire : l'ACRE.** C'est une réduction des cotisations la
  première année. Son taux a changé plusieurs fois : vérifie celui en
  vigueur sur urssaf.fr au moment de la demande.
- **L'option à regarder : le versement libératoire de l'impôt.** 1,7 % du
  chiffre d'affaires en BIC services, payé avec les cotisations. Il est
  intéressant si ton revenu fiscal de référence le permet et si ta tranche
  d'impôt dépasse 11 %.

### Passer en SASU le moment venu

Quand passer :

- **Le chiffre d'affaires dépasse environ 40 000 €.** La TVA arrive de toute
  façon, et le plafond de la micro-entreprise est de 83 600 € en services.
- **Les dépenses deviennent lourdes.** En micro-entreprise, rien ne se
  déduit, alors qu'en société on paie l'impôt sur le bénéfice. Les dépenses
  qui pèsent ici :
  - l'IA d'Anthropic ;
  - Supabase en offre payante ;
  - la commission d'Apple ou de Google, 15 %, si l'app passe par leurs
    magasins ;
  - une campagne publicitaire.
- **Tu veux un associé, lever de l'argent, ou te verser un salaire.**

Ce que la SASU ajoute :

- **L'impôt sur les sociétés** : 15 % jusqu'à 42 500 € de bénéfice, puis
  25 %. Le seuil de 42 500 € est à vérifier dans la loi de finances de
  l'année.
- **Les dividendes au PFU** de **31,4 %** en 2026. La CSG sur les revenus du
  capital a augmenté de 1,4 point avec la loi de financement de la sécurité
  sociale pour 2026.
- **Un président assimilé salarié** : couvert comme un salarié, mais cher en
  cotisations s'il se verse un salaire.

Ce qu'elle coûte :

- **À la création** : environ 250 à 400 € (rédaction des statuts, annonce
  légale, frais du guichet) ;
- **Chaque année** : 1 200 à 2 500 € d'expert-comptable.

**Pourquoi pas la SASU tout de suite.** À 10 000 € de chiffre d'affaires, la
comptabilité et les frais de la SASU mangent tout ce qu'elle fait gagner.
Commence en micro-entreprise, garde tes factures, et passe en SASU
(apport du fonds) quand les chiffres le disent. Un expert-comptable fait le
calcul en une heure.

**Mirandola Campus** se vend aussi à un lycée depuis une micro-entreprise.
L'acheteur public veut un SIRET et une facture déposée sur Chorus Pro, et la
console de l'éditeur sait déjà émettre les deux.

---

## 2. Ce que ça coûte

### La première année, en micro-entreprise

| Poste | Coût | Note |
|---|---|---|
| Immatriculation (guichet unique) | 0 € | |
| Médiateur de la consommation | 30 à 150 € (souvent pour 3 ans) | **Obligatoire** dès qu'on vend à des particuliers (art. L612-1 du code de la consommation). Son nom et son adresse vont dans `ENTREPRISE.mediateur` de `src/entreprise.js`. |
| Assurance responsabilité civile professionnelle | 150 à 400 € par an | Conseillée, pas obligatoire. Elle couvre une perte de données ou une faute qui fait du tort à un client. |
| Dépôt de la marque « Mirandola » à l'INPI | 190 € pour une classe, +40 € par classe en plus | Classes 9 (logiciel), 41 (éducation) et 42 (logiciel en ligne), soit **270 €** pour dix ans. Vérifie d'abord la marque sur data.inpi.fr. |
| Compte bancaire dédié | 0 à 10 € par mois | Obligatoire en micro-entreprise après deux années de suite à plus de 10 000 € de chiffre d'affaires ; conseillé dès le départ. |
| CFE (cotisation foncière des entreprises) | 0 € la première année | Ensuite environ 150 à 500 € selon la commune ; exonérée sous 5 000 € de chiffre d'affaires. |
| Domaine mirandola.fr | environ 10 € par an | Déjà payé. |

### Ce qui varie avec les ventes

| Poste | Coût | Note |
|---|---|---|
| Cotisations sociales | 21,2 % du chiffre d'affaires | Ou 25,6 % en BNC. Réduites la première année avec l'ACRE. |
| Stripe | environ 1,5 % + 0,25 € par paiement | Pour une carte européenne. 5,99 € par mois coûtent donc environ 0,34 € ; 44,99 € par an, environ 0,92 €. |
| IA Anthropic | environ 1 centime par génération, 4 à 5 centimes par PDF | Tenu par `AI_BUDGET_USD`, **à relever avant le lancement** (20 $ par mois aujourd'hui, pour tout le monde). |
| Supabase | 0 € puis 25 $ par mois (offre Pro) | Passer en Pro avant le lancement : sauvegardes, pas de mise en pause. |
| Vercel | 0 € puis 20 $ par mois (offre Pro) | L'offre gratuite interdit l'usage commercial : passer en Pro dès la première vente. |
| Brevo (e-mails) | 0 € jusqu'à 300 e-mails par jour | |

### Ce qui reste pour 200 abonnés à 5,99 € par mois

| | Par mois |
|---|---|
| Chiffre d'affaires | 1 198 € |
| Cotisations (21,2 %) | −254 € |
| Stripe | −68 € |
| IA, au pire 30 générations chacun | −60 € |
| Supabase et Vercel | −45 € |
| **Avant impôt sur le revenu** | **≈ 770 €** |

Un abonné Infini à 9,99 € laisse environ 6,50 € par mois, même en utilisant
beaucoup l'IA. Au-delà de 150 générations, l'IA passe sur Haiku, qui coûte
vingt fois moins.

---

## 3. Dans l'ordre

1. **Choisir ton médiateur.** La liste officielle est sur economie.gouv.fr,
   rubrique « médiateurs notifiés ». Prends-en un qui couvre la vente en
   ligne de services. Note son nom, son adresse et son site.
2. **T'immatriculer** sur formalites.entreprises.gouv.fr : micro-entreprise,
   activité 58.29C, demande d'ACRE, option pour le versement libératoire si
   elle te convient. Tu reçois ton SIREN et ton SIRET sous 1 à 4 semaines.
3. **Remplir les ⟦crochets⟧ du dépôt.** Tant qu'il en reste un, les textes
   ne sont pas opposables et **la vente ne doit pas ouvrir**.
   - Dans `src/editeur.js` : `EDITEUR`, ton nom suivi de « EI » (la mention
     est obligatoire pour un entrepreneur individuel).
   - Dans `src/entreprise.js` :
     - la forme (« entrepreneur individuel, régime micro ») ;
     - l'adresse : ton domicile, ou une domiciliation à 10 à 30 € par mois
       si tu ne veux pas le publier ;
     - l'immatriculation : SIREN et RCS, ou « dispensé
       d'immatriculation » ;
     - la TVA : « TVA non applicable, art. 293 B du CGI » ;
     - le directeur de la publication : toi ;
     - le médiateur.
   - Dans la console de l'éditeur, onglet Entreprise : les mêmes
     informations, pour les factures. Les deux doivent dire la même chose.
4. **Déposer la marque** à l'INPI, environ 270 € pour trois classes.
5. **Ouvrir le compte bancaire dédié** et le brancher à Stripe.
6. **Passer Supabase et Vercel en Pro, et relever `AI_BUDGET_USD`.**
7. **Ouvrir la vente** :
   - déployer les fonctions `ai`, `paiement` et `stripe-webhook` ;
   - poser `STRIPE_SECRET_KEY` ;
   - cliquer « Brancher Stripe » dans la console, onglet Entreprise.

   Le pas à pas est dans `docs/VENTE.md`.

### À surveiller ensuite

- **La franchise de TVA.** Au-delà de 37 500 € de chiffre d'affaires dans
  l'année (41 250 € pour le seuil majoré), la TVA à 20 % s'applique. Les
  prix « TTC » restent les mêmes, mais tu en gardes un sixième de moins :
  5,99 € TTC deviennent 4,99 € hors taxe. Prévois-le, ou ajuste les prix à
  ce moment-là. Il faut prévenir les abonnés 30 jours avant, comme les CGV le
  disent.
- **Les ventes aux particuliers des autres pays de l'UE.** Au-delà de
  10 000 € par an, la TVA du pays de chaque client s'applique, déclarée par
  le guichet unique OSS. Stripe Tax peut le calculer. Il reste à vérifier si
  ces ventes comptent aussi dans la franchise française.
- **La facture électronique entre entreprises.** La réception devient
  obligatoire pour toutes les entreprises en septembre 2026. L'émission
  suivra pour les petites entreprises, à une date à vérifier sur
  impots.gouv.fr. Les factures Campus passent déjà par Chorus Pro.
- **Le rappel de renouvellement.** Un abonnement annuel reconduit demande un
  rappel avant l'échéance (art. L215-1 du code de la consommation). Il est
  à mettre en place avant la première échéance, dans les réglages de
  Stripe : voir `docs/VENTE.md`.

---

## Sources (consultées le 6 novembre 2026)

- Plafonds et taux de la micro-entreprise en 2026 : [l-expert-comptable.com](https://www.l-expert-comptable.com/a/taux-urssaf-auto-entrepreneur-bareme-et-calcul), [astrolabe-conseil.fr](https://www.astrolabe-conseil.fr/micro-entreprise-taux-2026/), [abby.fr](https://abby.fr/guide/micro-entreprise/cotisations-sociales-auto-entrepreneur)
- Franchise en base de TVA en 2026, seuils maintenus : [indy.fr](https://www.indy.fr/guide/fiscalite/taxes/tva/abaissement-seuil-2026/), [CCI Lyon Métropole](https://www.lyon-metropole.cci.fr/actualite/micro-entreprises-le-projet-de-loi-de-finances-2026-relance-la-reforme-du-seuil-de)
- PFU à 31,4 % en 2026 : [bmfiduciaire.fr](https://www.bmfiduciaire.fr/prelevement-forfaitaire-unique-dividendes/), [Banque Transatlantique](https://www.banquetransatlantique.com/fr/actualites/loi-de-financement-de-la-securite-sociale-pour-2026-hausse-de-la-CSG.html)
- Médiateur de la consommation (obligation et prix) : [copeps.fr](https://copeps.fr/actualites/mediateur-consommation-auto-entrepreneur/), [CAPEB, fiche CM2C de novembre 2025](https://www.capeb.fr/www/capeb/media//centrevaldeloire/document/fiche-pratique-mediation-de-la-consommation-x-cm2c-novembre-2025.pdf)
- TVA des services électroniques dans l'UE et seuil de 10 000 € : [l-expert-comptable.com](https://www.l-expert-comptable.com/a/532222-le-mini-guichet-unique-de-tva.html), [swim.legal](https://www.swim.legal/blog/tva-e-commerce-regles-seuils-guichet-unique)
