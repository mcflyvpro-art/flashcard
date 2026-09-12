alter table public.decks add column if not exists meta jsonb not null default '{}'::jsonb;
