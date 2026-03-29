-- Náhled inzerátu v globální cache (volitelné)
alter table public.market_listings
  add column if not exists image_url text null;

-- Uživatelské nálezy: kdo/kdy viděl inzerát (chat, nástroje, cron)
create table if not exists public.user_market_listing_finds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  external_id text not null,
  title text not null,
  location text not null,
  source text not null,
  url text not null,
  image_url text null,
  agent_run_id text null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (user_id, external_id)
);

create index if not exists user_market_listing_finds_user_last_seen_idx
  on public.user_market_listing_finds (user_id, last_seen_at desc);

comment on table public.user_market_listing_finds is
  'Inzeráty zachycené při běhu agenta, ručním hledání v Nástrojích nebo cronu; first_seen_at = první výskyt, last_seen_at = poslední.';

alter table public.user_market_listing_finds enable row level security;

create policy "user_market_listing_finds_select_own"
  on public.user_market_listing_finds
  for select
  to authenticated
  using (auth.uid() = user_id);
