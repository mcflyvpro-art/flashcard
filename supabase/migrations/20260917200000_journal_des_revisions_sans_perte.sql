-- Le journal des révisions ne perdait pas des lignes par accident : il en
-- refusait, et l'app jetait le refus sans rien dire.
--
-- 1. `rating` était `not null`, mais le mode simple ne note pas — il dit
--    seulement su / à revoir. Chaque révision faite en mode simple partait
--    donc avec rating null et se faisait rejeter (23502). Aucune n'a jamais
--    été enregistrée.
-- 2. Rien ne permettait de réessayer un envoi : une coupure réseau perdait
--    la ligne pour de bon. L'app garde désormais ses révisions en attente
--    sur l'appareil et les rejoue ; il faut donc pouvoir les rejouer sans
--    créer de doublon. C'est le rôle de `client_id`, tiré par l'appareil.
--
-- Ces lignes nourrissent les statistiques ET l'optimiseur FSRS : une
-- révision perdue fausse les deux.

alter table public.reviews alter column rating drop not null;

alter table public.reviews add column if not exists client_id text;

-- Un même client_id ne peut entrer qu'une fois par compte : rejouer une
-- révision déjà reçue ne fait rien (merge-duplicates), au lieu de la
-- compter deux fois.
create unique index if not exists reviews_user_client_uniq
  on public.reviews (user_id, client_id)
  where client_id is not null;

comment on column public.reviews.client_id is
  'Identifiant tiré par l''appareil, pour rejouer un envoi sans doublon.';
comment on column public.reviews.rating is
  '0 encore · 1 difficile · 2 correct · 3 facile — null en mode simple.';
