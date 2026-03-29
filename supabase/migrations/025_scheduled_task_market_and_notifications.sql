-- Parametry vyhledávání nabídek u naplánované úlohy + notifikace po běhu cronu.
alter table public.user_scheduled_agent_tasks
  add column if not exists market_listings_params jsonb null;

comment on column public.user_scheduled_agent_tasks.market_listings_params is
  'Volitelné parametry pro fetchMarketListings (JSON); používá je /api/cron/scheduled-agent-tasks.';

create table if not exists public.scheduled_task_run_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null references public.user_scheduled_agent_tasks(id) on delete cascade,
  agent_run_id text null,
  status text not null check (status in ('ok', 'error')),
  summary text not null default '',
  detail text null,
  read_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists scheduled_task_run_notifications_user_created_idx
  on public.scheduled_task_run_notifications (user_id, created_at desc);

create index if not exists scheduled_task_run_notifications_user_unread_idx
  on public.scheduled_task_run_notifications (user_id)
  where read_at is null;

alter table public.scheduled_task_run_notifications enable row level security;

drop policy if exists "users_read_own_scheduled_task_notifications" on public.scheduled_task_run_notifications;
create policy "users_read_own_scheduled_task_notifications"
on public.scheduled_task_run_notifications
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "users_update_own_scheduled_task_notifications" on public.scheduled_task_run_notifications;
create policy "users_update_own_scheduled_task_notifications"
on public.scheduled_task_run_notifications
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Zápis z backendu (service role) obchází RLS; uživatelské API používá admin client pro INSERT z cronu
-- a pro PATCH read_at authenticated.
