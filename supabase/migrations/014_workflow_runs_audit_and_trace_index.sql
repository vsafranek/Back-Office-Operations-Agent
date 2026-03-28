-- BOA-007: bohatší audit workflow běhů + index pro retenci trace.

alter table public.workflow_runs add column if not exists error_message text;
alter table public.workflow_runs add column if not exists triggered_by text not null default 'cron';
alter table public.workflow_runs add column if not exists actor_user_id text;

comment on column public.workflow_runs.error_message is 'Chyba při selhání běhu (cron / agent enqueue).';
comment on column public.workflow_runs.triggered_by is 'Zdroj: cron | agent | manual | unknown.';
comment on column public.workflow_runs.actor_user_id is 'Uživatel nebo syntetický actor (např. automation_worker) u agent enqueue.';

create index if not exists agent_trace_events_created_at_idx
  on public.agent_trace_events (created_at);
