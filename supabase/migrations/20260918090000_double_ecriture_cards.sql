-- M03.T3 — double écriture : chaque paquet écrit continue d'aller dans le
-- champ JSONB `decks.cards` (personne ne lit encore ailleurs), mais écrit
-- aussi, dans la même opération, une ligne par carte dans `cards`
-- (M03.T1). Le but n'est pas de servir des lectures — ça viendra avec
-- M03.T6 — mais de faire tourner les deux formats en parallèle pendant
-- une semaine et de vérifier, par une requête de comparaison, qu'ils ne
-- divergent jamais avant de retirer le JSONB (M03.T7).
--
-- `sync_deck_cards` fait tout en une transaction : upsert des cartes
-- actuelles, puis suppression de celles qui ont disparu du tableau. Pas
-- de `security definer` ici — la fonction s'exécute avec les droits de
-- l'appelant, donc les politiques RLS de `cards` (M03.T1) s'appliquent
-- normalement : impossible d'écrire des cartes sur le paquet de
-- quelqu'un d'autre par ce chemin, exactement comme par la table
-- elle-même.
create or replace function public.sync_deck_cards(p_deck_id uuid, p_cards jsonb)
  returns void
  language plpgsql
  set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_ids text[];
begin
  if v_uid is null then
    raise exception 'sync_deck_cards : authentification requise';
  end if;

  select coalesce(array_agg(elem->>'id'), '{}')
    into v_ids
    from jsonb_array_elements(coalesce(p_cards, '[]'::jsonb)) elem;

  insert into public.cards (
    deck_id, id, user_id, front, back, state, step,
    stability, difficulty, trace2, due, last_review, interval_days,
    reviews_count, lapses, meta
  )
  select
    p_deck_id, elem->>'id', v_uid,
    coalesce(elem->>'f', ''), coalesce(elem->>'b', ''),
    (elem->>'st')::smallint, (elem->>'sp')::smallint,
    (elem->>'S')::double precision, (elem->>'D')::double precision, (elem->>'F')::double precision,
    (elem->>'d')::bigint, (elem->>'lr')::bigint, (elem->>'i')::double precision,
    coalesce((elem->>'n')::integer, 0), coalesce((elem->>'l')::integer, 0),
    (elem - 'id' - 'f' - 'b' - 'st' - 'sp' - 'S' - 'D' - 'F' - 'd' - 'lr' - 'i' - 'n' - 'l')
  from jsonb_array_elements(coalesce(p_cards, '[]'::jsonb)) elem
  where elem ? 'id'
  on conflict (deck_id, id) do update set
    user_id = excluded.user_id,
    front = excluded.front, back = excluded.back,
    state = excluded.state, step = excluded.step,
    stability = excluded.stability, difficulty = excluded.difficulty, trace2 = excluded.trace2,
    due = excluded.due, last_review = excluded.last_review, interval_days = excluded.interval_days,
    reviews_count = excluded.reviews_count, lapses = excluded.lapses, meta = excluded.meta;

  delete from public.cards
    where deck_id = p_deck_id and not (id = any(v_ids));
end $$;

revoke all on function public.sync_deck_cards(uuid, jsonb) from public;
grant execute on function public.sync_deck_cards(uuid, jsonb) to authenticated;

-- Amorce : sans ce passage, seuls les paquets modifiés après ce jour
-- recevraient leur miroir, et la requête de comparaison hurlerait sur
-- toute la bibliothèque existante pour rien. `on conflict do nothing`
-- rend l'amorce rejouable sans risque.
insert into public.cards (
  deck_id, id, user_id, front, back, state, step,
  stability, difficulty, trace2, due, last_review, interval_days,
  reviews_count, lapses, meta
)
select
  d.id, c->>'id', d.user_id,
  coalesce(c->>'f', ''), coalesce(c->>'b', ''),
  (c->>'st')::smallint, (c->>'sp')::smallint,
  (c->>'S')::double precision, (c->>'D')::double precision, (c->>'F')::double precision,
  (c->>'d')::bigint, (c->>'lr')::bigint, (c->>'i')::double precision,
  coalesce((c->>'n')::integer, 0), coalesce((c->>'l')::integer, 0),
  (c - 'id' - 'f' - 'b' - 'st' - 'sp' - 'S' - 'D' - 'F' - 'd' - 'lr' - 'i' - 'n' - 'l')
from public.decks d, jsonb_array_elements(d.cards) c
where c ? 'id'
on conflict (deck_id, id) do nothing;
