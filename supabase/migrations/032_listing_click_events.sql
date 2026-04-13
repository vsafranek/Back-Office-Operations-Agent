create table if not exists public.listing_click_events (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  user_id uuid null references auth.users (id) on delete set null,
  action text not null,
  source_url text null,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint listing_click_events_action_chk check (action in ('detail', 'source'))
);

create index if not exists listing_click_events_listing_created_idx
  on public.listing_click_events (listing_id, created_at desc);

create index if not exists listing_click_events_user_created_idx
  on public.listing_click_events (user_id, created_at desc)
  where user_id is not null;

alter table public.listing_click_events enable row level security;
