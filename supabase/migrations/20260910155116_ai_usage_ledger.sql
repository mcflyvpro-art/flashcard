create table if not exists public.ai_usage (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null default (now() at time zone 'utc')::date,
  op text not null,
  in_tok int not null default 0,
  out_tok int not null default 0,
  cents numeric(10,4) not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists ai_usage_user_day on public.ai_usage (user_id, day);
create index if not exists ai_usage_day on public.ai_usage (day);
alter table public.ai_usage enable row level security;
drop policy if exists ai_usage_own_read on public.ai_usage;
create policy ai_usage_own_read on public.ai_usage for select using (auth.uid() = user_id);
