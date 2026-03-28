-- Audit odchozích e-mailů (draft / odeslání) po schválení uživatelem v UI.

create table if not exists public.outbound_email_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete set null,
  agent_run_id text,
  action text not null check (action in ('draft_created', 'sent')),
  to_email text not null,
  subject text not null,
  body_excerpt text,
  gmail_draft_id text,
  gmail_message_id text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists outbound_email_events_user_created_idx
  on public.outbound_email_events (user_id, created_at desc);

comment on table public.outbound_email_events is 'BOA-004: záznamy draftu a odeslání z aplikace (Gmail).';

alter table public.outbound_email_events enable row level security;

create policy "users_read_own_outbound_email_events"
on public.outbound_email_events
for select
to authenticated
using (user_id = auth.uid());
