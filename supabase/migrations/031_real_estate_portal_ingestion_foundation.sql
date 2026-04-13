create table if not exists public.portal_sources (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique,
  display_name text not null,
  base_url text,
  adapter_version text not null default '1.0.0',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint portal_sources_source_key_chk check (char_length(trim(source_key)) > 0)
);

create table if not exists public.listing_ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  source_key text not null references public.portal_sources (source_key) on update cascade,
  trigger_mode text not null default 'manual',
  status text not null default 'running',
  requested_by_user_id uuid null references auth.users (id) on delete set null,
  started_at timestamptz not null default now(),
  finished_at timestamptz null,
  fetched_count integer not null default 0,
  parsed_count integer not null default 0,
  upserted_count integer not null default 0,
  failed_count integer not null default 0,
  error_message text null,
  metadata jsonb not null default '{}'::jsonb,
  constraint listing_ingestion_runs_status_chk
    check (status in ('running', 'succeeded', 'partial', 'failed')),
  constraint listing_ingestion_runs_trigger_mode_chk
    check (trigger_mode in ('manual', 'scheduled', 'api'))
);

create index if not exists listing_ingestion_runs_source_started_idx
  on public.listing_ingestion_runs (source_key, started_at desc);

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  source_key text not null references public.portal_sources (source_key) on update cascade,
  source_listing_id text not null,
  title text not null,
  description text null,
  source_url text not null,
  locality text not null,
  city text null,
  district text null,
  region text null,
  country_code text not null default 'CZ',
  latitude double precision null,
  longitude double precision null,
  offer_type text null,
  property_type text null,
  disposition text null,
  floor_area_m2 numeric(10,2) null,
  land_area_m2 numeric(10,2) null,
  floor_number integer null,
  total_floors integer null,
  price_amount bigint null,
  currency text not null default 'CZK',
  price_note text null,
  is_active boolean not null default true,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  published_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint listings_source_listing_unique unique (source_key, source_listing_id)
);

create index if not exists listings_source_last_seen_idx
  on public.listings (source_key, last_seen_at desc);

create index if not exists listings_filter_price_idx
  on public.listings (price_amount)
  where price_amount is not null;

create index if not exists listings_filter_locality_idx
  on public.listings (locality);

create index if not exists listings_filter_dimensions_idx
  on public.listings (floor_area_m2, land_area_m2);

create table if not exists public.listing_media (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  media_url text not null,
  media_type text not null default 'image',
  sort_order integer not null default 0,
  width integer null,
  height integer null,
  created_at timestamptz not null default now(),
  constraint listing_media_unique unique (listing_id, media_url)
);

create index if not exists listing_media_listing_sort_idx
  on public.listing_media (listing_id, sort_order asc);

create table if not exists public.listing_raw_snapshots (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  source_key text not null,
  source_listing_id text not null,
  ingestion_run_id uuid null references public.listing_ingestion_runs (id) on delete set null,
  payload jsonb not null,
  payload_hash text null,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists listing_raw_snapshots_listing_fetched_idx
  on public.listing_raw_snapshots (listing_id, fetched_at desc);

create index if not exists listing_raw_snapshots_hash_idx
  on public.listing_raw_snapshots (payload_hash)
  where payload_hash is not null;

create table if not exists public.listing_parse_results (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  input_snapshot_id uuid null references public.listing_raw_snapshots (id) on delete set null,
  parser_name text not null,
  parser_version text not null default '1.0.0',
  confidence numeric(4,3) null,
  fallback_used boolean not null default false,
  parsed_data jsonb not null default '{}'::jsonb,
  diagnostics jsonb not null default '{}'::jsonb,
  parsed_at timestamptz not null default now(),
  constraint listing_parse_results_confidence_chk
    check (confidence is null or (confidence >= 0 and confidence <= 1))
);

create index if not exists listing_parse_results_listing_idx
  on public.listing_parse_results (listing_id, parsed_at desc);

alter table public.portal_sources enable row level security;
alter table public.listing_ingestion_runs enable row level security;
alter table public.listings enable row level security;
alter table public.listing_media enable row level security;
alter table public.listing_raw_snapshots enable row level security;
alter table public.listing_parse_results enable row level security;

drop policy if exists "listings_select_authenticated" on public.listings;
create policy "listings_select_authenticated"
  on public.listings
  for select
  to authenticated
  using (true);

drop policy if exists "listing_media_select_authenticated" on public.listing_media;
create policy "listing_media_select_authenticated"
  on public.listing_media
  for select
  to authenticated
  using (true);

insert into public.portal_sources (source_key, display_name, base_url, adapter_version, is_active)
values ('sreality', 'Sreality', 'https://www.sreality.cz', '1.0.0', true)
on conflict (source_key) do update
set
  display_name = excluded.display_name,
  base_url = excluded.base_url,
  adapter_version = excluded.adapter_version,
  is_active = excluded.is_active,
  updated_at = now();
