-- Conseillers Supabase après 20261024232855 : `essais_codes` n'avait pas de
-- clé primaire, et les défis d'un club (lus par club, du plus récent au plus
-- ancien, sur la page du club) n'avaient pas d'index.
alter table public.essais_codes add column if not exists id bigint generated always as identity primary key;
create index if not exists duels_club_idx on public.duels (group_id, created_at desc);
