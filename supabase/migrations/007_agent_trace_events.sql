create table if not exists public.agent_trace_events (
  id uuid primary key default gen_random_uuid(),
  run_id text not null,
  user_id text not null,
  conversation_id uuid references public.conversations(id) on delete set null,
  parent_id uuid references public.agent_trace_events(id) on delete cascade,
  step_index int not null,
  kind text not null check (kind in ('orchestrator', 'subagent', 'llm', 'tool')),
  name text not null,
  status text not null default 'success' check (status in ('success', 'error')),
  input_payload jsonb,
  output_payload jsonb,
  error_message text,
  duration_ms int,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists agent_trace_events_run_id_idx on public.agent_trace_events (run_id);
create index if not exists agent_trace_events_user_run_idx on public.agent_trace_events (user_id, run_id);

alter table public.agent_trace_events enable row level security;

create policy "users_read_own_agent_traces"
on public.agent_trace_events
for select
to authenticated
using (user_id = (auth.uid())::text);
