-- Persist panel payload from cron runs so UI can render rich components
-- (e.g. market listings cards) in Scheduled Tasks notifications.
alter table public.scheduled_task_run_notifications
  add column if not exists panel_payload jsonb null;

comment on column public.scheduled_task_run_notifications.panel_payload is
  'Serialized agent panel payload (v1) for rendering rich UI blocks in cron notifications.';
