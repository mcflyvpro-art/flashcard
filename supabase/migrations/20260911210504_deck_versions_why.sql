-- Une version enregistrée doit dire ce qui l'a provoquée : « avant le
-- remplacement », « avant la fusion ». Sans cela, la liste n'est qu'une
-- suite de dates entre lesquelles on ne sait pas choisir.
alter table public.deck_versions add column if not exists why text not null default '';
create index if not exists deck_versions_deck_idx
  on public.deck_versions (deck_id, created_at desc);
