-- Naplánované úlohy agenta (spouštění z Next přes /api/cron/scheduled-agent-tasks + pg_cron / volání zvenku).
create table if not exists public.user_scheduled_agent_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  cron_expression text not null,
  timezone text not null default 'Europe/Prague',
  system_prompt text not null,
  user_question text not null default 'Splň naplánovanou úlohu podle systémového zadání.',
  agent_id text not null default 'basic',
  enabled boolean not null default true,
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_scheduled_agent_tasks_agent_id_chk check (
    agent_id in ('basic', 'thinking-orchestrator')
  )
);

create index if not exists user_scheduled_agent_tasks_user_id_idx
  on public.user_scheduled_agent_tasks (user_id);

create index if not exists user_scheduled_agent_tasks_enabled_idx
  on public.user_scheduled_agent_tasks (enabled)
  where enabled = true;

alter table public.user_scheduled_agent_tasks enable row level security;

drop policy if exists "users_manage_own_scheduled_agent_tasks" on public.user_scheduled_agent_tasks;
create policy "users_manage_own_scheduled_agent_tasks"
on public.user_scheduled_agent_tasks
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
