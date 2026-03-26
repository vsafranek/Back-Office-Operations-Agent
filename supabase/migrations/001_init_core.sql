create extension if not exists "pgcrypto";

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text,
  phone text,
  source_channel text,
  created_at timestamptz not null default now()
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  property_id uuid,
  status text not null default 'new',
  source_channel text,
  created_at timestamptz not null default now()
);

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  city text not null,
  district text,
  listed_price numeric(14,2),
  reconstruction_notes text,
  structural_changes text,
  created_at timestamptz not null default now()
);

create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references public.properties(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  sold_price numeric(14,2),
  sold_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  activity_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.calendar_slots (
  id uuid primary key default gen_random_uuid(),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  source text not null default 'google_calendar',
  created_at timestamptz not null default now()
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  report_type text not null,
  artifact_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.agent_runs (
  id bigint generated always as identity primary key,
  run_id text not null unique,
  user_id text not null,
  question text not null,
  intent text not null,
  answer text not null,
  confidence numeric(4,3) not null default 0,
  sources text[] not null default '{}',
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists public.workflow_runs (
  id bigint generated always as identity primary key,
  workflow_name text not null,
  run_ref text not null,
  status text not null default 'started',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists public.data_quality_issues (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  issue_code text not null,
  severity text not null default 'medium',
  status text not null default 'open',
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.market_listings (
  id uuid primary key default gen_random_uuid(),
  external_id text not null unique,
  title text not null,
  location text not null,
  source text not null,
  url text not null,
  observed_at timestamptz not null,
  created_at timestamptz not null default now()
);
