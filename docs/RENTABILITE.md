# La rentabilité de l'IA

> Demandé le 2026-11-07 : « calcule toujours la rentabilité, pour que peu
> importe l'utilisation ce soit rentable ». Fait le 2026-11-08.

L'IA est le seul coût de Mirandola qui grandit avec l'usage d'un abonné.
Avant, un compte payant n'avait qu'un **nombre** de générations par mois :
rien ne bornait ce qu'une génération coûte (un PDF de 20 Mo d'un abonné
Infini peut peser près d'un million de jetons, soit **2,32 $** sur le
meilleur modèle), ni ce qu'un mois coûte (Infini continue sans limite de
nombre au-delà de ses 150). Un seul abonné pouvait coûter plus qu'il ne
rapporte.

## La règle

**Chaque compte a un plafond de coût d'IA par mois, et la base ne le laisse
jamais dépasser.** Le plafond est la moitié de ce que le compte rapporte au
pire. Tout est calculé, jamais recopié, par
`supabase/functions/_shared/rentabilite.js` (testé :
`test/rentabilite.test.js`).

Ce que rapporte un compte, au pire, chaque mois :

- le prix le plus bas qu'il puisse payer : **le code de lancement**
  appliqué (−20 %), et **la formule à l'année** (la moins chère par mois) ;
- moins **la TVA, 20 %**. La franchise de TVA en dispense aujourd'hui ; on
  compte comme si elle s'appliquait déjà ;
- moins **les cotisations, 25,6 %** du chiffre d'affaires hors taxe : le
  taux libéral, le plus haut des deux de `docs/ENTREPRISE.md` ;
- moins **Stripe**, 1,5 % + 0,25 € par paiement.

L'IA n'en prend jamais plus de la moitié (`PART_IA`). Un dollar est compté
pour un euro : c'est prudent, puisque le dollar vaut moins que l'euro depuis
2003, à quelques semaines de 2022 près.

| Formule | Prix | Net par mois | IA au plus | Marge au pire |
|---|---|---|---|---|
| Mirandola+, au mois | 5,99 € | 3,37 € | 0,89 € | 2,48 € |
| Mirandola+, au mois, lancement | 4,79 € | 2,65 € | 0,89 € | 1,76 € |
| Mirandola+, à l'année | 44,99 € | 2,25 € | 0,89 € | 1,36 € |
| **Mirandola+, à l'année, lancement** | **35,99 €** | **1,79 €** | **0,89 €** | **0,90 €** |
| Infini, au mois | 9,99 € | 5,79 € | 1,60 € | 4,19 € |
| Infini, au mois, lancement | 7,99 € | 4,58 € | 1,60 € | 2,98 € |
| Infini, à l'année | 79,99 € | 4,01 € | 1,60 € | 2,41 € |
| **Infini, à l'année, lancement** | **63,99 €** | **3,21 €** | **1,60 €** | **1,61 €** |

Les plafonds sont donc de **89 cents** (Mirandola+, professeur compris :
il paie le prix d'un élève) et de **160 cents** (Infini). Il reste au pire
0,90 € et 1,61 € par mois et par abonné pour l'hébergement et le bénéfice.

D'autres comptes ont leur propre plafond :

- **L'essai de 7 jours : 25 cents.** Aucun paiement n'est encore passé. Il
  n'est pas rentable par lui-même : c'est un coût d'acquisition, borné.
- **Campus : le quota de la licence fois 3 cents par génération**
  (`PAR_GENERATION_CAMPUS`). Le prix est sur devis. La console de l'éditeur
  affiche ce pire pendant la saisie d'une licence (« au pire … par mois »,
  `pire` de `src/cout-ia.js`) : un devis qui le couvre reste rentable quel
  que soit l'usage.

## Ce que l'usage ordinaire en prend

Une génération typique coûte **1,3 à 1,5 cent** sur le meilleur modèle
(mesures de `ai_usage`, novembre 2026 : un cours collé 0,7 c, une photo
1,1 c, une retouche 1,5 c, un PDF 4,6 c). Sur Claude Haiku 5.5, elle coûte
environ **0,07 cent**, vingt fois moins.

- **Mirandola+** : 30 générations font environ 40 cents, la moitié du
  plafond. L'usage ordinaire ne l'approche pas.
- **Infini** : le meilleur modèle sert pour ses 150 générations, tant que
  les trois quarts du plafond (120 cents) ne sont pas pris. Ensuite, Claude
  Haiku prend le relais : plusieurs centaines de générations de plus avant
  le plafond. « Sans compter » reste vrai pour tout usage personnel.
- **Un professeur en Mirandola+** : environ 50 générations sur le meilleur
  modèle, puis environ 340 sur Haiku, soit à peu près ses 400.

## Comment la base le tient

1. **La fonction `ai` choisit le modèle** avant de réserver. Elle lit le
   nombre et la dépense du mois dans `ia_droits`. Le meilleur modèle sert
   tant que la dépense n'atteint pas les trois quarts du plafond
   (`PART_PREMIUM`), et, pour Infini, tant que ses 150 générations ne sont
   pas faites. Le plus économe sert ensuite.

2. **Elle estime le pire coût de la génération** :
   - son entrée : comptée par l'API (`count_tokens`, gratuit) pour un PDF ou
     un texte de plus de 20 000 jetons ; bornée sinon, à un jeton pour deux
     signes, plus 5 000 jetons par photo ;
   - sa sortie : au maximum permis (16 000 jetons, 32 000 pour Infini) ;
   - le tout au tarif du modèle le plus cher qu'elle pourrait essayer.

3. **`ia_reserver` réserve ce pire coût, d'un seul tenant**, un compte à la
   fois (verrou consultatif). La réservation n'est acceptée que si la
   dépense soldée, plus les réservations en vol, plus ce pire coût restent
   sous le plafond. Cinquante appels lancés ensemble ne passent pas plus que
   le plafond.

4. **`ia_solder` remplace le pire coût par le coût réel**, au tarif du
   modèle qui a répondu. Haiku 5.5 coûte cinq fois plus au-delà de 100 000
   jetons d'entrée (`TARIFS`), et ce palier est compté. Une réservation que
   personne n'a soldée (une fonction tombée en route) cesse de compter au
   bout de dix minutes.

5. **Un refus ne coûte rien.** Il y en a deux :
   - **« plafond »** : le mois est pris. L'élève lit « Ton IA a atteint son
     usage raisonnable du mois : la suite le 1er ».
   - **« lourd »** : cette génération-là ne tient pas dans ce qui reste. Un
     document trop lourd est compté, jamais lu. L'élève lit « Trop lourd pour
     ce qu'il te reste d'IA ce mois-ci : essaie un document plus court ».

Les conditions de vente le disent (article 2, « usage raisonnable » ;
`CGV_VERSION` du 2026-11-08).

## Les preuves

- `test/rentabilite.test.js` : les tarifs de la référence de l'API ; chaque
  formule, au prix plein comme au lancement, garde au moins 0,80 € de marge
  par mois ; les modèles de la fonction ont tous leur tarif.
- `supabase/tests/ia_rentable.sql` (10 cas) : le plafond tenu par la
  réservation au pire ; le solde ; la réservation abandonnée ; `ia_droits` ;
  les droits.
- `node tools/ia/essai.js` (16 vérifications, la vraie fonction sous Deno) :
  - un compte à son plafond est refusé sans appeler le modèle ;
  - un PDF trop lourd est compté puis refusé sans être lu ;
  - Haiku prend le relais aux trois quarts du plafond et passé les 150
    d'Infini, soldé à son tarif ;
  - trois appels lancés ensemble, avec la place d'un seul : un seul passe.
- `e2e/prompt.e2e.js` : l'élève lit les deux refus en clair.

## Quand quelque chose change

- **Un prix ou le code de lancement** : rien à faire. `PRIX` et `PROMO` de
  `_shared/abonnement.js` nourrissent le calcul. Le test échoue si une
  formule passe sous 0,80 € de marge.
- **Un modèle ou un tarif** : `TARIFS` de `_shared/rentabilite.js`. Le test
  échoue si la fonction emploie un modèle sans tarif.
- **Les cotisations, la TVA, Stripe** : `CHARGES`.
- **La part de l'IA** : `PART_IA`. La relever, c'est rogner la marge du
  pire abonné.
