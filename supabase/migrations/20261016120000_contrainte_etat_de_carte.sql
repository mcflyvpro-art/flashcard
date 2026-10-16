-- M04.T3 : l'état d'une carte vérifié par la base elle-même, pas seulement
-- par l'app. Les 12 invariants de src/invariants.js (M04.T1) sont la
-- référence ; on n'en reprend ici que ceux qu'une requête SQL peut voir
-- ET que le moteur garantit par construction (bornes posées par `cl()`,
-- états produits par la machine d'états de src/fsrs.js) — relevé fait le
-- 2026-10-16 : 0 ligne sur 3 303 n'en viole un seul.
--
-- Pourquoi pas les autres, exprès :
-- - recto/verso non vides, échéance ≥ dernière révision : des lignes réelles
--   les violent (1 et 17, héritées d'avant M03) et `sync_deck_cards` réécrit
--   tout le paquet d'un coup — une seule carte refusée bloquerait la
--   synchronisation de tout le paquet, indéfiniment (flush() le garde dans
--   `dirty` tant que les deux écritures n'ont pas réussi). Ces cas-là se
--   réparent dans l'app : « Vérifier ma bibliothèque » (M04.T2).
-- - « fiche révisée ⇒ mémoire » : une fiche d'avant FSRS (n > 0 sans S)
--   n'est migrée par fsrsSeed() qu'à l'affichage ; un appareil resté hors
--   ligne depuis longtemps peut encore en pousser.
--
-- Un NaN ne passe pas non plus : en Postgres, 'NaN' est plus grand que tout
-- nombre, donc `<= 36500` le refuse.
alter table public.cards
  add constraint cards_etat_valide
    check (state is null or state in (1, 2, 3)),
  add constraint cards_palier_coherent
    check (case when state in (1, 3) then step is not null and step >= 0
                else step is null end),
  add constraint cards_stabilite_bornee
    check (stability is null or (stability >= 0.0001 and stability <= 36500)),
  add constraint cards_difficulte_bornee
    check (difficulty is null or (difficulty >= 1 and difficulty <= 10)),
  add constraint cards_trace_bornee
    check (trace2 is null or (trace2 >= 0.0001 and trace2 <= 36500)),
  add constraint cards_memoire_complete
    check ((stability is null) = (difficulty is null)
           and (last_review is null or stability is not null)),
  add constraint cards_compteurs_positifs
    check (reviews_count >= 0 and lapses >= 0);
